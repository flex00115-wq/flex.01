export interface Point2D {
  x: number;
  y: number;
}

/**
 * Solves for the 3x3 homography matrix H (as 9-element row-major array with h[8]=1)
 * that maps src[i] -> dst[i] for i=0..3.
 */
export function solveHomography(src: readonly Point2D[], dst: readonly Point2D[]): number[] {
  if (src.length !== 4 || dst.length !== 4) {
    throw new Error('Exactly 4 point pairs are required to solve homography.');
  }

  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const sx = src[i].x;
    const sy = src[i].y;
    const dx = dst[i].x;
    const dy = dst[i].y;

    A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]);
    b.push(dx);

    A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]);
    b.push(dy);
  }

  // Gaussian elimination with partial pivoting
  const n = 8;
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    let maxVal = Math.abs(A[col][col]);
    for (let row = col + 1; row < n; row++) {
      const val = Math.abs(A[row][col]);
      if (val > maxVal) {
        maxVal = val;
        maxRow = row;
      }
    }

    if (maxVal < 1e-10) {
      return [1, 0, 0, 0, 1, 0, 0, 0, 1];
    }

    if (maxRow !== col) {
      [A[col], A[maxRow]] = [A[maxRow], A[col]];
      [b[col], b[maxRow]] = [b[maxRow], b[col]];
    }

    const pivot = A[col][col];
    for (let row = col + 1; row < n; row++) {
      const factor = A[row][col] / pivot;
      if (factor === 0) continue;
      for (let k = col; k < n; k++) {
        A[row][k] -= factor * A[col][k];
      }
      b[row] -= factor * b[col];
    }
  }

  const h = new Array<number>(9).fill(0);
  h[8] = 1;
  for (let row = n - 1; row >= 0; row--) {
    let sum = b[row];
    for (let k = row + 1; k < n; k++) {
      sum -= A[row][k] * h[k];
    }
    h[row] = sum / A[row][row];
  }

  return h;
}

export function applyHomography(H: readonly number[], x: number, y: number): Point2D {
  const denom = H[6] * x + H[7] * y + H[8];
  if (Math.abs(denom) < 1e-9) {
    return { x, y };
  }
  return {
    x: (H[0] * x + H[1] * y + H[2]) / denom,
    y: (H[3] * x + H[4] * y + H[5]) / denom,
  };
}

const POPCOUNT_4BIT = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

/**
 * Computes Hamming distance between two equal-length hex hash strings.
 */
export function hexHammingDistance(hexA: string, hexB: string): number {
  const len = Math.min(hexA.length, hexB.length);
  let dist = Math.abs(hexA.length - hexB.length) * 4;
  for (let i = 0; i < len; i++) {
    const a = parseInt(hexA[i], 16);
    const b = parseInt(hexB[i], 16);
    if (Number.isNaN(a) || Number.isNaN(b)) {
      dist += 4;
    } else {
      dist += POPCOUNT_4BIT[a ^ b];
    }
  }
  return dist;
}

export function pHashSimilarity(hexA: string, hexB: string): number {
  const bits = Math.max(hexA.length, hexB.length, 16) * 4;
  const dist = hexHammingDistance(hexA, hexB);
  return Math.max(0, 1 - dist / bits);
}

export function cosineSimilarity(vecA: readonly number[], vecB: readonly number[]): number {
  const len = Math.min(vecA.length, vecB.length);
  if (len === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    const a = vecA[i];
    const b = vecB[i];
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }
  if (normA <= 1e-12 || normB <= 1e-12) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function spatialGridSimilarity(gridA: readonly number[], gridB: readonly number[]): number {
  const len = Math.min(gridA.length, gridB.length);
  if (len === 0) return 0;
  let absDiff = 0;
  for (let i = 0; i < len; i++) {
    absDiff += Math.abs(gridA[i] - gridB[i]);
  }
  const meanDiff = absDiff / len;
  return Math.max(0, Math.min(1, 1 - meanDiff * 2.4));
}

/**
 * Normalized Cross-Correlation (NCC) mapped from [-1, 1] to [0, 1] across aligned patch intensities.
 */
export function patchCorrelationSimilarity(patchA: readonly number[], patchB: readonly number[]): number {
  const len = Math.min(patchA.length, patchB.length);
  if (len === 0) return 0;

  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < len; i++) {
    sumA += patchA[i];
    sumB += patchB[i];
  }
  const meanA = sumA / len;
  const meanB = sumB / len;

  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < len; i++) {
    const da = patchA[i] - meanA;
    const db = patchB[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const denom = Math.sqrt(denA * denB);
  if (denom <= 1e-9) return 0;
  const ncc = num / denom;
  return Math.max(0, Math.min(1, (ncc + 1) / 2));
}

/**
 * Adaptive Histogram Equalization (clipped CDF) with specular glare compression.
 * Suppresses camera warm shifts, screen reflection bars, and dim exposure while preserving artwork edges.
 */
export function normalizeLuminanceCdf(luma: Float32Array): Float32Array {
  const len = luma.length;
  const out = new Float32Array(len);
  if (len === 0) return out;

  const hist = new Uint32Array(256);
  for (let i = 0; i < len; i++) {
    const bin = Math.max(0, Math.min(255, Math.round(luma[i])));
    hist[bin]++;
  }

  // CLAHE-style clip limit to prevent noise/glare plateaus from dominating
  const clipLimit = Math.max(4, Math.floor((len / 256) * 3.5));
  let excess = 0;
  for (let i = 0; i < 256; i++) {
    if (hist[i] > clipLimit) {
      excess += hist[i] - clipLimit;
      hist[i] = clipLimit;
    }
  }
  const redist = Math.floor(excess / 256);
  for (let i = 0; i < 256; i++) {
    hist[i] += redist;
  }

  const cdf = new Float32Array(256);
  let cumulative = 0;
  let cdfMin = -1;
  for (let i = 0; i < 256; i++) {
    cumulative += hist[i];
    cdf[i] = cumulative;
    if (cdfMin < 0 && cumulative > 0) {
      cdfMin = cumulative;
    }
  }

  const denom = Math.max(1, cumulative - Math.max(0, cdfMin));
  for (let i = 0; i < len; i++) {
    const bin = Math.max(0, Math.min(255, Math.round(luma[i])));
    const mapped = ((cdf[bin] - Math.max(0, cdfMin)) / denom) * 255;
    // Blend 75% equalized + 25% original normalized luminance to preserve midtone contrast cleanly
    out[i] = Math.max(0, Math.min(255, mapped * 0.75 + luma[i] * 0.25));
  }
  return out;
}

/**
 * Estimates dominant card tilt angle in degrees (-25°..+25°) by accumulating Sobel edge orientations
 * near card border lines (vertical and horizontal frames).
 */
export function estimateDominantTiltDegrees(
  luma: Float32Array,
  width: number,
  height: number
): number {
  if (width < 8 || height < 8) return 0;

  // Two 3x3 Gaussian smoothing passes prevent discrete staircase pixel edges (runs of 4-5px) from quantizing to 0°
  const pass1 = new Float32Array(luma);
  const smoothLuma = new Float32Array(luma);
  for (let pass = 0; pass < 2; pass++) {
    const src = pass === 0 ? luma : pass1;
    const dst = pass === 0 ? pass1 : smoothLuma;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        dst[i] =
          (src[i - width - 1] +
            2 * src[i - width] +
            src[i - width + 1] +
            2 * src[i - 1] +
            4 * src[i] +
            2 * src[i + 1] +
            src[i + width - 1] +
            2 * src[i + width] +
            src[i + width + 1]) /
          16;
      }
    }
  }

  // 4th-order Scharr orientation tensor: 4*(theta + 90°) == 4*theta (mod 360°),
  // aligning horizontal and vertical card borders while canceling staircase quantization bias.
  let sumSin4 = 0;
  let sumCos4 = 0;
  let totalMag = 0;
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const gx =
        -3 * smoothLuma[(y - 1) * width + (x - 1)] +
        3 * smoothLuma[(y - 1) * width + (x + 1)] -
        10 * smoothLuma[y * width + (x - 1)] +
        10 * smoothLuma[y * width + (x + 1)] -
        3 * smoothLuma[(y + 1) * width + (x - 1)] +
        3 * smoothLuma[(y + 1) * width + (x + 1)];
      const gy =
        -3 * smoothLuma[(y - 1) * width + (x - 1)] -
        10 * smoothLuma[(y - 1) * width + x] -
        3 * smoothLuma[(y - 1) * width + (x + 1)] +
        3 * smoothLuma[(y + 1) * width + (x - 1)] +
        10 * smoothLuma[(y + 1) * width + x] +
        3 * smoothLuma[(y + 1) * width + (x + 1)];

      const mag = Math.sqrt(gx * gx + gy * gy);
      if (mag < 96) continue;

      const theta = Math.atan2(gy, gx);
      sumSin4 += mag * Math.sin(4 * theta);
      sumCos4 += mag * Math.cos(4 * theta);
      totalMag += mag;
    }
  }

  if (totalMag <= 1e-3) return 0;
  const coherence = Math.hypot(sumSin4, sumCos4) / totalMag;
  if (coherence < 0.25) {
    return 0;
  }

  const deg = Math.round((Math.atan2(sumSin4, sumCos4) * 180) / (4 * Math.PI));
  if (deg < -25 || deg > 25) return 0;
  return deg === 0 ? 0 : deg;
}

/**
 * Extracts a 48-dim local corner/interest-point signature invariant to moderate rotation and border clipping.
 * Divides radial distance from card artwork center into 6 rings x 8 contrast/corner bins.
 */
export function computeKeypointSignature(
  luma: Float32Array,
  width: number,
  height: number
): number[] {
  const rings = 6;
  const sectors = 8;
  const vec = new Array<number>(rings * sectors).fill(0);
  if (width < 8 || height < 8) return vec;

  const cx = width * 0.5;
  const cy = height * 0.43; // artwork zone center
  const maxR = Math.hypot(cx, Math.max(cy, height - cy)) * 0.92;

  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const ix = luma[y * width + (x + 1)] - luma[y * width + (x - 1)];
      const iy = luma[(y + 1) * width + x] - luma[(y - 1) * width + x];
      const dxx = luma[y * width + (x + 2)] - 2 * luma[y * width + x] + luma[y * width + (x - 2)];
      const dyy = luma[(y + 2) * width + x] - 2 * luma[y * width + x] + luma[(y - 2) * width + x];
      // Harris-like corner strength combining perpendicular gradient & curvature
      const cornerResponse = Math.abs(ix * iy) + Math.sqrt(Math.abs(dxx * dyy)) * 0.65;
      if (cornerResponse < 18) continue;

      const r = Math.hypot(x - cx, y - cy);
      const ringIdx = Math.min(rings - 1, Math.floor((r / Math.max(1, maxR)) * rings));
      // Orientation invariant bin using gradient curvature ratio + local brightness sign
      const dom = Math.abs(ix) + Math.abs(iy) + 1;
      const ratio = Math.min(1, Math.abs(Math.abs(ix) - Math.abs(iy)) / dom);
      const bright = luma[y * width + x] > 128 ? 4 : 0;
      const subBin = Math.min(3, Math.floor(ratio * 4));
      vec[ringIdx * sectors + bright + subBin] += cornerResponse;
    }
  }

  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => Number((v / norm).toFixed(4)));
}

/**
 * Computes fuzzy text/OCR similarity (0..1) between extracted card text and catalog card metadata.
 */
export function computeTextMatchScore(
  extractedText: string | undefined,
  card: {
    serial: number;
    name: string;
    category: string;
    setName: string;
    rarity: string;
  }
): number {
  if (!extractedText || !extractedText.trim()) return 0;
  const raw = extractedText.toLowerCase();
  const normalizedTokens = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9#\s-]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 2);

  const nameTokens = normalizedTokens(card.name);
  const setTokens = normalizedTokens(card.setName);
  const rarityTokens = normalizedTokens(card.rarity);
  const queryTokens = new Set(normalizedTokens(raw));

  let score = 0;
  let hits = 0;

  for (const tok of nameTokens) {
    if (queryTokens.has(tok) || raw.includes(tok)) {
      hits++;
    }
  }
  if (nameTokens.length > 0) {
    score += (hits / nameTokens.length) * 0.58;
  }

  if (raw.includes(`#${card.serial}`) || queryTokens.has(String(card.serial))) {
    score += 0.22;
  }

  if (raw.includes(card.category.toLowerCase())) {
    score += 0.1;
  }

  const metaHits = [...setTokens, ...rarityTokens].filter((t) => raw.includes(t)).length;
  if (metaHits > 0) {
    score += Math.min(0.15, metaHits * 0.06);
  }

  return Math.max(0, Math.min(1, Number(score.toFixed(3))));
}

export interface ScoredCandidate<T = string> {
  id: T;
  stage2Score: number;
  neuralScore?: number;
  localPatchScore: number;
  innerStructureScore?: number;
  textMatchScore?: number;
  compositeScore: number;
}

export interface GeminiDecision {
  available: boolean;
  isMatch: boolean;
  matchedCardId: string | null;
  confidence: number;
  extractedText?: string;
  reason?: string;
}

export interface MatchGateResult<T = string> {
  matched: boolean;
  matchedId: T | null;
  confidence: number;
  margin: number;
  usedGemini: boolean;
  reason: string;
}

export const STRICT_MATCH_THRESHOLDS = {
  /** Calibrated local composite threshold combining multi-region inner artwork, CLIP, and structure */
  minLocalComposite: 0.66,
  /** Minimum inner-artwork / local structure score (immune to outer border clipping & glare) */
  minLocalPatch: 0.58,
  /** Minimum separation margin over 2nd-best distinct candidate */
  minMargin: 0.015,
  /** Minimum Gemini Vision confidence when Gemini confirms a candidate */
  minGeminiConfidence: 0.72,
  /** Minimum local visual sanity score when Gemini confirms a match */
  minLocalSanityForGemini: 0.42,
} as const;

/**
 * Calibrated Hybrid Anti-False-Match Gate:
 * Combines CLIP embeddings, glare-tolerant inner-artwork HOG/Keypoints, OCR/text metadata,
 * and Gemini Vision verification so real-world camera scans pass cleanly while unrelated cards return Card Not Found.
 */
export function evaluateMatchDecision<T extends string>(
  rankedCandidates: readonly ScoredCandidate<T>[],
  gemini?: GeminiDecision | null
): MatchGateResult<T> {
  if (rankedCandidates.length === 0) {
    return {
      matched: false,
      matchedId: null,
      confidence: 0,
      margin: 0,
      usedGemini: false,
      reason: 'No published cards in catalog to match against.',
    };
  }

  const top1 = rankedCandidates[0];
  const top2 = rankedCandidates[1];
  const margin = top2 ? Math.max(0, top1.compositeScore - top2.compositeScore) : 1;

  // 1. Primary Gemini Vision + OCR Verifier when available
  if (gemini && gemini.available) {
    if (!gemini.isMatch || !gemini.matchedCardId) {
      return {
        matched: false,
        matchedId: null,
        confidence: gemini.confidence,
        margin,
        usedGemini: true,
        reason: gemini.reason || 'Visual verification confirmed this card does not match our catalog.',
      };
    }

    const geminiPick = rankedCandidates.find((c) => c.id === gemini.matchedCardId);
    const localSanity = Math.max(
      geminiPick?.compositeScore ?? 0,
      geminiPick?.innerStructureScore ?? 0,
      geminiPick?.neuralScore ?? 0
    );

    if (
      geminiPick &&
      gemini.confidence >= STRICT_MATCH_THRESHOLDS.minGeminiConfidence &&
      localSanity >= STRICT_MATCH_THRESHOLDS.minLocalSanityForGemini
    ) {
      const fused = Math.min(0.99, gemini.confidence * 0.65 + geminiPick.compositeScore * 0.35);
      return {
        matched: true,
        matchedId: geminiPick.id,
        confidence: Number(fused.toFixed(3)),
        margin,
        usedGemini: true,
        reason: gemini.reason || 'Verified by Gemini Vision OCR & inner artwork structure.',
      };
    }

    return {
      matched: false,
      matchedId: null,
      confidence: gemini.confidence,
      margin,
      usedGemini: true,
      reason: 'Confidence below strict verification threshold.',
    };
  }

  // 2. Client-Side Multi-Signal Gate (CLIP + Multi-Region Inner Artwork + Tilt Alignment + Keypoints)
  const effectiveLocalStructure = Math.max(
    top1.localPatchScore,
    top1.innerStructureScore ?? 0
  );

  if (top1.compositeScore < STRICT_MATCH_THRESHOLDS.minLocalComposite) {
    return {
      matched: false,
      matchedId: null,
      confidence: top1.compositeScore,
      margin,
      usedGemini: false,
      reason: 'Card artwork & layout similarity is below the strict match threshold.',
    };
  }

  if (effectiveLocalStructure < STRICT_MATCH_THRESHOLDS.minLocalPatch) {
    return {
      matched: false,
      matchedId: null,
      confidence: top1.compositeScore,
      margin,
      usedGemini: false,
      reason: 'Inner card artwork structure did not verify cleanly against catalog cards.',
    };
  }

  if (
    rankedCandidates.length > 1 &&
    margin < STRICT_MATCH_THRESHOLDS.minMargin &&
    top1.compositeScore < 0.86
  ) {
    return {
      matched: false,
      matchedId: null,
      confidence: top1.compositeScore,
      margin,
      usedGemini: false,
      reason: 'Multiple similar cards scored closely without a clear winner. Reframe clearly and retry.',
    };
  }

  return {
    matched: true,
    matchedId: top1.id,
    confidence: Number(top1.compositeScore.toFixed(3)),
    margin: Number(margin.toFixed(3)),
    usedGemini: false,
    reason: 'Exact catalog visual & inner-artwork match verified.',
  };
}
