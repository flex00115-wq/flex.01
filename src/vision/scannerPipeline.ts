import type { CardFingerprint, CardItem, CornerPoint, ScanResult } from '../types/card';
import { computeCardFingerprint, extractInnerArtworkDataUrl } from './perceptualHash';
import {
  autoDeskewCanvas,
  createTransformedCropCanvas,
  loadImage,
  normalizeGlareAndContrast,
  warpCardPerspective,
} from './perspective';
import {
  computeTextMatchScore,
  cosineSimilarity,
  evaluateMatchDecision,
  patchCorrelationSimilarity,
  pHashSimilarity,
  spatialGridSimilarity,
  type GeminiDecision,
  type ScoredCandidate,
} from './visionMath';

let workerInstance: Worker | null = null;
let workerUnavailable = false;
let msgCounter = 0;

// In-memory v2 fingerprint cache keyed by `${card.id}:${card.imageUrl}` for instant scans before background DB indexing completes
const runtimeFpCache = new Map<string, CardFingerprint>();

function getEmbeddingWorker(): Worker | null {
  if (workerUnavailable || typeof Worker === 'undefined') return null;
  if (!workerInstance) {
    try {
      workerInstance = new Worker(new URL('./embeddingWorker.ts', import.meta.url), {
        type: 'module',
      });
    } catch {
      workerUnavailable = true;
      return null;
    }
  }
  return workerInstance;
}

export function warmupNeuralWorker(): void {
  const worker = getEmbeddingWorker();
  if (!worker) return;
  const id = `warmup-${++msgCounter}`;
  worker.postMessage({ id, type: 'warmup' });
}

export function computeNeuralEmbeddingWithTimeout(
  imageDataUrl: string,
  timeoutMs = 1000
): Promise<number[] | null> {
  const worker = getEmbeddingWorker();
  if (!worker || !imageDataUrl) return Promise.resolve(null);

  return new Promise((resolve) => {
    const id = `embed-${++msgCounter}`;
    const timer = setTimeout(() => {
      worker.removeEventListener('message', onMsg);
      resolve(null);
    }, timeoutMs);

    const onMsg = (event: MessageEvent<{ id: string; embedding?: number[] | null }>) => {
      if (event.data?.id !== id) return;
      clearTimeout(timer);
      worker.removeEventListener('message', onMsg);
      resolve(event.data.embedding ?? null);
    };

    worker.addEventListener('message', onMsg);
    worker.postMessage({ id, type: 'embed', imageDataUrl });
  });
}

function chromaSimilarity(vecA: readonly number[], vecB: readonly number[]): number {
  const len = Math.min(vecA.length, vecB.length);
  if (len === 0) return 0;
  let absDiff = 0;
  for (let i = 0; i < len; i++) {
    absDiff += Math.abs(vecA[i] - vecB[i]);
  }
  const l1Sim = Math.max(0, 1 - (absDiff / len) * 2.1);
  const cosSim = Math.max(0, cosineSimilarity(vecA, vecB));
  return l1Sim * 0.55 + cosSim * 0.45;
}

/**
 * Multi-region glare-tolerant coarse + chromaticity + core artwork similarity.
 */
function scoreMultiRegionCoarse(query: CardFingerprint, target: CardFingerprint): number {
  const innerHog = Math.max(
    0,
    cosineSimilarity(query.innerHogVec ?? query.structuralVec, target.innerHogVec ?? target.structuralVec)
  );
  const chromaSim =
    query.colorChromaGrid && target.colorChromaGrid
      ? chromaSimilarity(query.colorChromaGrid, target.colorChromaGrid)
      : spatialGridSimilarity(query.spatialGrid, target.spatialGrid);
  const radialSim = Math.max(
    0,
    cosineSimilarity(
      query.radialStructureVec ?? query.structuralVec,
      target.radialStructureVec ?? target.structuralVec
    )
  );
  const keypointSim = Math.max(
    0,
    cosineSimilarity(
      query.keypointSignature ?? query.structuralVec,
      target.keypointSignature ?? target.structuralVec
    )
  );
  const topSim = Math.max(
    0,
    cosineSimilarity(query.topHogVec ?? query.structuralVec, target.topHogVec ?? target.structuralVec)
  );
  const botSim = Math.max(
    0,
    cosineSimilarity(query.bottomHogVec ?? query.structuralVec, target.bottomHogVec ?? target.structuralVec)
  );
  const edgeHashSim = pHashSimilarity(query.edgeHash, target.edgeHash);

  return (
    innerHog * 0.27 +
    chromaSim * 0.26 +
    radialSim * 0.14 +
    keypointSim * 0.11 +
    edgeHashSim * 0.10 +
    ((topSim + botSim) * 0.5) * 0.12
  );
}

/**
 * Core inner-artwork & text-strip detail similarity (immune to shared template frame & glare).
 */
function scoreLocalAndInnerDetail(
  query: CardFingerprint,
  target: CardFingerprint,
  baseChromaOverride?: number
): { localPatchScore: number; innerStructureScore: number } {
  const innerEdgeNcc =
    query.innerEdgePatch && target.innerEdgePatch
      ? patchCorrelationSimilarity(query.innerEdgePatch, target.innerEdgePatch)
      : 0;
  const innerLumaNcc =
    query.innerLumaPatch && target.innerLumaPatch
      ? patchCorrelationSimilarity(query.innerLumaPatch, target.innerLumaPatch)
      : 0;
  const topTextNcc =
    query.topTextPatch && target.topTextPatch
      ? patchCorrelationSimilarity(query.topTextPatch, target.topTextPatch)
      : 0.5;
  const namePlateNcc =
    query.namePlatePatch && target.namePlatePatch
      ? patchCorrelationSimilarity(query.namePlatePatch, target.namePlatePatch)
      : 0.5;
  const fullPatchNcc =
    query.patchThumb && target.patchThumb
      ? patchCorrelationSimilarity(query.patchThumb, target.patchThumb)
      : spatialGridSimilarity(query.spatialGrid, target.spatialGrid);

  const innerHog = Math.max(
    0,
    cosineSimilarity(query.innerHogVec ?? query.structuralVec, target.innerHogVec ?? target.structuralVec)
  );
  const alignedChroma =
    query.colorChromaGrid && target.colorChromaGrid
      ? chromaSimilarity(query.colorChromaGrid, target.colorChromaGrid)
      : 0.5;
  const chromaSim =
    baseChromaOverride !== undefined
      ? baseChromaOverride * 0.55 + alignedChroma * 0.45
      : alignedChroma;

  const innerStructureScore =
    innerHog * 0.23 +
    innerEdgeNcc * 0.23 +
    innerLumaNcc * 0.15 +
    chromaSim * 0.25 +
    ((topTextNcc + namePlateNcc) * 0.5) * 0.14;

  const localPatchScore =
    innerEdgeNcc * 0.25 +
    innerLumaNcc * 0.21 +
    ((topTextNcc + namePlateNcc) * 0.5) * 0.32 +
    fullPatchNcc * 0.22;

  return { localPatchScore, innerStructureScore };
}

async function imageUrlToBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    if (url.startsWith('data:')) {
      const [header, data] = url.split(',');
      const mimeMatch = header.match(/data:([^;]+)/);
      return { base64: data, mimeType: mimeMatch?.[1] || 'image/png' };
    }
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 336;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, 240, 336);
    const jpeg = canvas.toDataURL('image/jpeg', 0.85);
    return { base64: jpeg.split(',')[1], mimeType: 'image/jpeg' };
  } catch {
    return null;
  }
}

async function tryGeminiVerify(
  cropDataUrl: string,
  shortlisted: CardItem[]
): Promise<GeminiDecision | null> {
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('.github.io')) {
    return null;
  }
  try {
    const queryBase64 = cropDataUrl.split(',')[1];
    if (!queryBase64) return null;

    const candidatesPayload = await Promise.all(
      shortlisted.slice(0, 12).map(async (c) => {
        const encoded = await imageUrlToBase64(c.imageUrl);
        return {
          id: c.id,
          serial: c.serial,
          name: c.name,
          category: c.category,
          setName: c.setName,
          rarity: c.rarity,
          imageBase64: encoded?.base64,
          mimeType: encoded?.mimeType || 'image/jpeg',
        };
      })
    );

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    const res = await fetch('/api/vision-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        queryImageBase64: queryBase64,
        queryMimeType: 'image/jpeg',
        candidates: candidatesPayload,
      }),
    });

    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      available?: boolean;
      fallback?: boolean;
      extractedText?: string;
      isMatch?: boolean;
      matchedCardId?: string | null;
      confidence?: number;
      reason?: string;
    };

    if (!data.available || data.fallback) {
      return null;
    }

    return {
      available: true,
      isMatch: Boolean(data.isMatch),
      matchedCardId: data.matchedCardId ?? null,
      confidence: typeof data.confidence === 'number' ? data.confidence : 0,
      extractedText: data.extractedText || '',
      reason: data.reason,
    };
  } catch {
    return null;
  }
}

export interface ScanProgressCallback {
  (stage: string): void;
}

/**
 * Full 4-Stage Visual Card Scanner (2-3s target):
 * - Auto-deskew (-25°..+25° tilt tolerance) + glare/contrast normalization
 * - Multi-region inner-artwork, chromaticity, top/nameplate text strip & keypoints + alignment hypotheses
 * - Parallel CLIP Vision Transformer (full + inner artwork) embeddings
 * - Hybrid Gemini Vision + OCR verification on Top 12 candidates
 */
export async function scanCardImage(
  sourceImageUrl: string,
  corners: readonly [CornerPoint, CornerPoint, CornerPoint, CornerPoint],
  catalogCards: readonly CardItem[],
  onProgress?: ScanProgressCallback
): Promise<ScanResult> {
  const startedAt = performance.now();
  const publishedCards = catalogCards.filter((c) => c.publishStatus === 'published');

  // Stage 1: Perspective warp, auto-deskew & glare normalization
  onProgress?.('Stage 1/4 · Straightening perspective & correcting tilt/glare...');
  const img = await loadImage(sourceImageUrl);
  const { canvas: warpedCanvas } = warpCardPerspective(img, corners);
  const { canvas: deskewedCanvas } = autoDeskewCanvas(warpedCanvas);
  const isolatedCropDataUrl = deskewedCanvas.toDataURL('image/jpeg', 0.92);
  const normalizedCanvas = normalizeGlareAndContrast(deskewedCanvas);

  if (publishedCards.length === 0) {
    return {
      status: 'not_found',
      confidence: 0,
      margin: 0,
      usedGemini: false,
      elapsedMs: Math.round(performance.now() - startedAt),
      isolatedCropDataUrl,
      reason: 'No published cards exist in the FLEX catalog yet.',
    };
  }

  // Stage 2: Extract v3 multi-region query fingerprint & ensure v3 fingerprints across catalog
  onProgress?.('Stage 2/4 · Analyzing inner artwork, color hue, text & keypoints...');
  const baseQueryFp = await computeCardFingerprint(normalizedCanvas);

  const fingerprintedCatalog: Array<{ card: CardItem; fp: CardFingerprint }> = [];
  for (const card of publishedCards) {
    if (card.fingerprint && card.fingerprint.version >= 3) {
      fingerprintedCatalog.push({ card, fp: card.fingerprint });
      continue;
    }
    const cacheKey = `${card.id}:${card.imageUrl}`;
    const cached = runtimeFpCache.get(cacheKey);
    if (cached && cached.version >= 3) {
      fingerprintedCatalog.push({ card, fp: cached });
      continue;
    }
    if (card.imageUrl) {
      try {
        const fp = await computeCardFingerprint(card.imageUrl);
        runtimeFpCache.set(cacheKey, fp);
        fingerprintedCatalog.push({ card, fp });
      } catch {
        // skip unreadable image
      }
    }
  }

  const coarseAll = fingerprintedCatalog
    .map(({ card, fp }) => ({
      card,
      fp,
      coarseScore: scoreMultiRegionCoarse(baseQueryFp, fp),
    }))
    .sort((a, b) => b.coarseScore - a.coarseScore);

  const top18 = coarseAll.slice(0, 18);

  // Evaluate edge-clip (±8%/±12% scale/offset) & residual tilt (±10°, ±18°) alignment hypotheses
  const queryHypotheses: CardFingerprint[] = [baseQueryFp];
  const topCoarseScore = top18[0]?.coarseScore ?? 0;

  if (topCoarseScore < 0.90) {
    const hypothesisConfigs: Array<{ scale?: number; dxFrac?: number; dyFrac?: number; angleDeg?: number }> = [
      { scale: 1.08, dyFrac: 0.04 },
      { scale: 1.08, dyFrac: -0.04 },
      { scale: 0.90, dyFrac: -0.05 },
      { scale: 0.92 },
      { angleDeg: -10 },
      { angleDeg: 10 },
    ];
    if (topCoarseScore < 0.76) {
      hypothesisConfigs.push({ angleDeg: -18 }, { angleDeg: 18 });
    }
    const extraFps = await Promise.all(
      hypothesisConfigs.map((cfg) =>
        computeCardFingerprint(createTransformedCropCanvas(normalizedCanvas, cfg))
      )
    );
    queryHypotheses.push(...extraFps);
  }

  // Stage 3 & Stage 4 Setup: Run CLIP embeddings (full + inner artwork) & Gemini top-12 verification in parallel
  onProgress?.('Stage 3/4 · Computing CLIP embeddings & inner-artwork detail scores...');

  const bestAlignedPerCandidate = top18.map(({ card, fp }) => {
    let bestCoarse = 0;
    let bestLocal = 0;
    let bestInner = 0;
    let bestCombined = 0;

    const baseChroma =
      baseQueryFp.colorChromaGrid && fp.colorChromaGrid
        ? chromaSimilarity(baseQueryFp.colorChromaGrid, fp.colorChromaGrid)
        : undefined;

    for (const qFp of queryHypotheses) {
      const cScore = scoreMultiRegionCoarse(qFp, fp);
      const { localPatchScore, innerStructureScore } = scoreLocalAndInnerDetail(qFp, fp, baseChroma);
      const combined = cScore * 0.45 + innerStructureScore * 0.35 + localPatchScore * 0.2;
      if (combined > bestCombined) {
        bestCombined = combined;
        bestCoarse = cScore;
        bestLocal = localPatchScore;
        bestInner = innerStructureScore;
      }
    }

    return {
      card,
      fp,
      stage2Score: bestCoarse,
      localPatchScore: bestLocal,
      innerStructureScore: bestInner,
      localCombined: bestCombined,
    };
  });

  bestAlignedPerCandidate.sort((a, b) => b.localCombined - a.localCombined);
  const top12ForVerify = bestAlignedPerCandidate.slice(0, 12);

  // Extract CLIP embeddings (full card + inner artwork) and optionally query Gemini Vision in parallel
  const innerCropDataUrl = await extractInnerArtworkDataUrl(deskewedCanvas);

  onProgress?.('Stage 4/4 · Verifying top 12 candidates & OCR text...');
  const [queryFullClip, queryInnerClip, geminiDecision] = await Promise.all([
    computeNeuralEmbeddingWithTimeout(isolatedCropDataUrl, 900),
    computeNeuralEmbeddingWithTimeout(innerCropDataUrl, 900),
    top12ForVerify.length > 0 && top12ForVerify[0].localCombined >= 0.40
      ? tryGeminiVerify(
          isolatedCropDataUrl,
          top12ForVerify.map((c) => c.card)
        )
      : Promise.resolve(null),
  ]);

  const extractedText = geminiDecision?.extractedText;

  const detailedCandidates: Array<ScoredCandidate<string> & { card: CardItem }> =
    bestAlignedPerCandidate.map((item) => {
      const { card, fp, stage2Score, localPatchScore, innerStructureScore } = item;

      const hasFullClip = Boolean(queryFullClip && fp.neuralEmbedding);
      const hasInnerClip = Boolean(queryInnerClip && fp.innerNeuralEmbedding);

      let neuralScore: number | undefined;
      if (hasFullClip && hasInnerClip) {
        const sFull = Math.max(0, cosineSimilarity(queryFullClip!, fp.neuralEmbedding!));
        const sInner = Math.max(0, cosineSimilarity(queryInnerClip!, fp.innerNeuralEmbedding!));
        neuralScore = sFull * 0.45 + sInner * 0.55;
      } else if (hasFullClip) {
        neuralScore = Math.max(0, cosineSimilarity(queryFullClip!, fp.neuralEmbedding!));
      } else if (hasInnerClip) {
        neuralScore = Math.max(0, cosineSimilarity(queryInnerClip!, fp.innerNeuralEmbedding!));
      }

      const textMatchScore = extractedText ? computeTextMatchScore(extractedText, card) : 0;

      // Calibrated fusion: inner artwork & local structure + CLIP + OCR text boost
      let compositeScore =
        neuralScore !== undefined
          ? stage2Score * 0.30 +
            innerStructureScore * 0.30 +
            localPatchScore * 0.16 +
            neuralScore * 0.24
          : stage2Score * 0.38 + innerStructureScore * 0.38 + localPatchScore * 0.24;

      if (textMatchScore > 0) {
        compositeScore = Math.min(0.99, compositeScore * 0.85 + textMatchScore * 0.15);
      }

      return {
        id: card.id,
        card,
        stage2Score,
        neuralScore,
        localPatchScore,
        innerStructureScore,
        textMatchScore,
        compositeScore,
      };
    });

  detailedCandidates.sort((a, b) => b.compositeScore - a.compositeScore);

  const decision = evaluateMatchDecision(detailedCandidates, geminiDecision);
  const matchedCard = decision.matchedId
    ? detailedCandidates.find((c) => c.id === decision.matchedId)?.card
    : undefined;

  return {
    status: decision.matched && matchedCard ? 'matched' : 'not_found',
    card: matchedCard,
    confidence: decision.confidence,
    margin: decision.margin,
    usedGemini: decision.usedGemini,
    elapsedMs: Math.round(performance.now() - startedAt),
    isolatedCropDataUrl,
    reason: decision.reason,
    topCandidates: detailedCandidates.slice(0, 3).map((c) => ({
      card: c.card,
      score: Number(c.compositeScore.toFixed(3)),
    })),
  };
}
