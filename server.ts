import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import type { Request, Response } from "express";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === "production";

interface CandidateInput {
  id: string;
  serial: number;
  name: string;
  category: string;
  setName: string;
  rarity?: string;
  imageBase64?: string;
  mimeType?: string;
}

interface VerifyRequestBody {
  queryImageBase64?: string;
  queryMimeType?: string;
  candidates?: CandidateInput[];
}

function getValidGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "18mb" }));

  app.post("/api/vision-verify", async (req: Request, res: Response) => {
    const ai = getValidGeminiClient();
    if (!ai) {
      res.status(200).json({
        available: false,
        fallback: true,
        reason: "no_api_key",
      });
      return;
    }

    const body = (req.body || {}) as VerifyRequestBody;
    const queryImageBase64 = body.queryImageBase64;
    const queryMimeType = body.queryMimeType || "image/jpeg";
    const candidates = Array.isArray(body.candidates) ? body.candidates.slice(0, 12) : [];

    if (!queryImageBase64 || candidates.length === 0) {
      res.status(400).json({
        available: true,
        fallback: true,
        reason: "invalid_payload",
      });
      return;
    }

    try {
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
        {
          text: [
            "You are a Google-Lens-grade trading card visual + OCR verifier for FLEX Bangladesh.",
            "The first image is a real-world customer camera photo or scan of a trading card (it may have phone screen glare, horizontal light reflections, moire lines, warm lighting color shifts, background fingers/hands, slight camera tilt, or slightly clipped outer edges).",
            "STEP 1 (OCR): Read ALL visible text printed on the scanned card into extractedText (title, character/player name, HP/stats, move names, set code, serial #, jersey number, rarity).",
            "STEP 2 (INNER ARTWORK & LAYOUT): Compare the inner illustration/character face, central symbol/emblem, body pose, top header bar, name plate, and internal typography against the numbered candidate catalog cards below.",
            "EXPLICITLY IGNORE: camera glare streaks, phone screen moire, warm/cool lighting tint, fingers/background outside the border, slight tilt, and slightly cropped edges.",
            "CRITICAL ANTI-FALSE-MATCH RULE: If the scanned card depicts a genuinely different character, different edition/variant, or a non-catalog card/unrelated image, set matchedCardId to null and isMatch to false. Never guess or force a match.",
          ].join(" "),
        },
        {
          inlineData: {
            mimeType: queryMimeType,
            data: queryImageBase64,
          },
        },
      ];

      candidates.forEach((candidate, idx) => {
        parts.push({
          text: `Candidate ${idx + 1}: id="${candidate.id}", serial=#${candidate.serial}, name="${candidate.name}", category="${candidate.category}", set="${candidate.setName}", rarity="${candidate.rarity || ""}"`,
        });
        if (candidate.imageBase64) {
          parts.push({
            inlineData: {
              mimeType: candidate.mimeType || "image/jpeg",
              data: candidate.imageBase64,
            },
          });
        }
      });

      const verifyConfig = {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            extractedText: {
              type: Type.STRING,
              description: "All visible text read from the scanned card (title, HP, attacks, set code, serial #, rarity).",
            },
            isMatch: {
              type: Type.BOOLEAN,
              description: "True only if the scanned card depicts the exact same card as one of the candidates.",
            },
            matchedCardId: {
              type: Type.STRING,
              nullable: true,
              description: "Exact candidate id if matched, otherwise null.",
            },
            confidence: {
              type: Type.NUMBER,
              description: "Confidence from 0.0 to 1.0.",
            },
            reason: {
              type: Type.STRING,
              description: "Short explanation referencing read text and inner artwork.",
            },
          },
          required: ["extractedText", "isMatch", "confidence", "reason"],
        },
      };

      let response;
      try {
        response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: { parts },
          config: verifyConfig,
        });
      } catch (primaryErr) {
        console.warn("Primary gemini-2.5-flash error, trying fallback model:", primaryErr instanceof Error ? primaryErr.message : primaryErr);
        response = await ai.models.generateContent({
          model: "gemini-4-hydrogen",
          contents: { parts },
          config: verifyConfig,
        });
      }

      const parsed = JSON.parse((response.text ?? "{}").trim()) as {
        extractedText?: string;
        isMatch?: boolean;
        matchedCardId?: string | null;
        confidence?: number;
        reason?: string;
      };

      const validId =
        parsed.isMatch &&
        parsed.matchedCardId &&
        candidates.some((c) => c.id === parsed.matchedCardId)
          ? parsed.matchedCardId
          : null;

      res.status(200).json({
        available: true,
        fallback: false,
        extractedText: parsed.extractedText || "",
        isMatch: Boolean(validId),
        matchedCardId: validId,
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
        reason: parsed.reason || "",
      });
    } catch (error) {
      console.warn("Gemini Vision verification fallback triggered:", error instanceof Error ? error.message : error);
      res.status(200).json({
        available: false,
        fallback: true,
        reason: "gemini_error_or_rate_limit",
      });
    }
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      const indexFile = path.join(distPath, "index.html");
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send("Build output not found. Run npm run build first.");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`FLEX server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start FLEX server:", err);
  process.exit(1);
});
