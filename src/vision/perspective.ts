import type { CornerPoint } from '../types/card';
import {
  applyHomography,
  estimateDominantTiltDegrees,
  normalizeLuminanceCdf,
  solveHomography,
} from './visionMath';

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for processing.'));
    img.src = src;
  });
}

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Compresses an uploaded image File/Blob into a crisp WebP (or JPEG fallback)
 * suited for storing 700+ cards smoothly in IndexedDB & catalog.json.
 */
export async function compressCardImage(
  file: Blob,
  maxWidth = 520,
  quality = 0.84
): Promise<string> {
  const rawUrl = await fileToDataUrl(file);
  const img = await loadImage(rawUrl);
  const scale = img.naturalWidth > maxWidth ? maxWidth / img.naturalWidth : 1;
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return rawUrl;

  ctx.drawImage(img, 0, 0, w, h);
  const webp = canvas.toDataURL('image/webp', quality);
  if (webp.startsWith('data:image/webp')) {
    return webp;
  }
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Smart Card Boundary Detector:
 * Analyzes edge gradients + saturation/luminance structure on a fast 160x160 grid to snap
 * onto trading card rectangles inside phone screens, desks, or hands (even with clipped bottom edges).
 * Falls back cleanly to a tight border if the photo is already a direct card scan.
 */
export function detectInitialCorners(
  img: HTMLImageElement
): [CornerPoint, CornerPoint, CornerPoint, CornerPoint] {
  const aspect = img.naturalWidth / Math.max(1, img.naturalHeight);

  try {
    const S = 160;
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.drawImage(img, 0, 0, S, S);
      const data = ctx.getImageData(0, 0, S, S).data;
      const luma = new Float32Array(S * S);
      const sat = new Float32Array(S * S);
      for (let i = 0; i < S * S; i++) {
        const r = data[i * 4];
        const g = data[i * 4 + 1];
        const b = data[i * 4 + 2];
        luma[i] = 0.299 * r + 0.587 * g + 0.114 * b;
        sat[i] = Math.max(r, g, b) - Math.min(r, g, b);
      }

      // Vertical edge magnitude (strong at card left/right borders) and horizontal edge magnitude (top/bottom)
      const gxMap = new Float32Array(S * S);
      const gyMap = new Float32Array(S * S);
      const edgeEnergy = new Float32Array(S * S);
      for (let y = 1; y < S - 1; y++) {
        for (let x = 1; x < S - 1; x++) {
          const idx = y * S + x;
          const gx = Math.abs(luma[idx + 1] - luma[idx - 1]);
          const gy = Math.abs(luma[idx + S] - luma[idx - S]);
          gxMap[idx] = gx;
          gyMap[idx] = gy;
          edgeEnergy[idx] = gx + gy;
        }
      }

      // Check if outer 4% border is mostly uniform/clean vs background clutter -> direct card scan
      let outerBorderEnergy = 0;
      let outerSamples = 0;
      for (let y = 2; y < S - 2; y++) {
        for (let x = 2; x < S - 2; x++) {
          if (x < 6 || x > S - 7 || y < 6 || y > S - 7) {
            outerBorderEnergy += edgeEnergy[y * S + x];
            outerSamples++;
          }
        }
      }
      const meanOuterEdge = outerBorderEnergy / Math.max(1, outerSamples);
      if (aspect > 0.64 && aspect < 0.80 && meanOuterEdge < 16) {
        return [
          { x: 0.03, y: 0.03 },
          { x: 0.97, y: 0.03 },
          { x: 0.97, y: 0.97 },
          { x: 0.03, y: 0.97 },
        ];
      }

      // Integral image of structure + colorfulness inside candidate box
      const integ = new Float32Array((S + 1) * (S + 1));
      for (let y = 0; y < S; y++) {
        let rowSum = 0;
        for (let x = 0; x < S; x++) {
          const i = y * S + x;
          rowSum += edgeEnergy[i] * 0.75 + sat[i] * 0.35;
          integ[(y + 1) * (S + 1) + (x + 1)] = integ[y * (S + 1) + (x + 1)] + rowSum;
        }
      }
      const rectSum = (x1: number, y1: number, x2: number, y2: number) =>
        integ[y2 * (S + 1) + x2] -
        integ[y1 * (S + 1) + x2] -
        integ[y2 * (S + 1) + x1] +
        integ[y1 * (S + 1) + x1];

      const totalSignal = Math.max(1, rectSum(0, 0, S, S));

      // Find top candidate left/right X peaks from vertical edge columns in central 20%..80% height
      const colScore = new Float32Array(S);
      for (let x = 3; x < S - 3; x++) {
        let s = 0;
        for (let y = Math.floor(S * 0.18); y < Math.floor(S * 0.85); y++) {
          s += gxMap[y * S + x] + gxMap[y * S + x - 1] * 0.5 + gxMap[y * S + x + 1] * 0.5;
        }
        colScore[x] = s / (S * 0.67);
      }

      const rowScore = new Float32Array(S);
      for (let y = 3; y < S - 3; y++) {
        let s = 0;
        for (let x = Math.floor(S * 0.2); x < Math.floor(S * 0.8); x++) {
          s += gyMap[y * S + x] + gyMap[(y - 1) * S + x] * 0.5 + gyMap[(y + 1) * S + x] * 0.5;
        }
        rowScore[y] = s / (S * 0.6);
      }

      // Pick candidate x1/x2/y1/y2 anchored on strong boundary peaks + coarse grid
      const pickTopCoords = (arr: Float32Array, minIdx: number, maxIdx: number, count: number): number[] => {
        const pts: Array<{ idx: number; val: number }> = [];
        for (let i = minIdx; i <= maxIdx; i++) {
          pts.push({ idx: i, val: arr[i] });
        }
        pts.sort((a, b) => b.val - a.val);
        const chosen: number[] = [];
        for (const p of pts) {
          if (chosen.every((c) => Math.abs(c - p.idx) >= 6)) {
            chosen.push(p.idx);
            if (chosen.length >= count) break;
          }
        }
        return chosen;
      };

      const leftCands = Array.from(new Set([...pickTopCoords(colScore, 4, 72, 6), 4, 24, 40, 48]));
      const rightCands = Array.from(new Set([...pickTopCoords(colScore, 88, 155, 6), 112, 120, 136, 155]));
      const topCands = Array.from(new Set([...pickTopCoords(rowScore, 3, 56, 6), 4, 16, 22, 32]));
      const botCands = Array.from(new Set([...pickTopCoords(rowScore, 100, 157, 5), 140, 150, 158]));

      let bestScore = -Infinity;
      let bestBox = { x1: 24, y1: 12, x2: 136, y2: 148 };

      for (const x1 of leftCands) {
        for (const x2 of rightCands) {
          const bw = x2 - x1;
          if (bw < 36 || bw > 154) continue;
          // Center bias (card is usually near horizontal center)
          const cxDist = Math.abs((x1 + x2) / 2 - S / 2) / S;
          if (cxDist > 0.28) continue;

          for (const y1 of topCands) {
            for (const y2 of botCands) {
              const bh = y2 - y1;
              if (bh < 52) continue;

              // Real-space aspect ratio of this candidate box
              const realRatio = (bw * aspect) / bh;
              if (realRatio < 0.50 || realRatio > 0.96) continue;

              const area = bw * bh;
              const inside = rectSum(x1, y1, x2, y2);
              const containment = inside / totalSignal;

              // Border edge alignment along left, right, top, and bottom (allowing bottom edge to touch frame)
              let edgeSupport = 0;
              let edgeSteps = 0;
              for (let y = y1 + 4; y < y2 - 4; y += 2) {
                edgeSupport += Math.max(gxMap[y * S + x1], gxMap[y * S + Math.min(S - 2, x1 + 1)]);
                edgeSupport += Math.max(gxMap[y * S + x2], gxMap[y * S + Math.max(1, x2 - 1)]);
                edgeSteps += 2;
              }
              for (let x = x1 + 4; x < x2 - 4; x += 2) {
                edgeSupport += Math.max(gyMap[y1 * S + x], gyMap[Math.min(S - 2, y1 + 1) * S + x]);
                if (y2 < S - 4) {
                  edgeSupport += Math.max(gyMap[y2 * S + x], gyMap[Math.max(1, y2 - 1) * S + x]);
                  edgeSteps += 2;
                } else {
                  // Card touches bottom of photo: match strong border contrast so internal bar lines don't cut off bottom
                  edgeSupport += 105;
                  edgeSteps += 2;
                }
              }
              const meanBorderEdge = edgeSupport / Math.max(1, edgeSteps);
              const aspectBonus = 1 - Math.min(1, Math.abs(realRatio - 5 / 7) * 1.8);
              const densityBonus = inside / Math.max(1, area);

              const score =
                meanBorderEdge * 1.35 +
                containment * 65 +
                densityBonus * 0.4 +
                aspectBonus * 20 -
                cxDist * 28;

              if (score > bestScore) {
                bestScore = score;
                bestBox = { x1, y1, x2, y2 };
              }
            }
          }
        }
      }

      if (bestScore > 20) {
        const left = Math.max(0.015, Math.min(0.45, bestBox.x1 / S));
        const right = Math.min(0.985, Math.max(0.55, bestBox.x2 / S));
        const top = Math.max(0.015, Math.min(0.45, bestBox.y1 / S));
        const bottom = Math.min(0.992, Math.max(0.55, bestBox.y2 / S));

        return [
          { x: Number(left.toFixed(3)), y: Number(top.toFixed(3)) },
          { x: Number(right.toFixed(3)), y: Number(top.toFixed(3)) },
          { x: Number(right.toFixed(3)), y: Number(bottom.toFixed(3)) },
          { x: Number(left.toFixed(3)), y: Number(bottom.toFixed(3)) },
        ];
      }
    }
  } catch {
    // Fallback cleanly below
  }

  // Fallback centered 5:7 card frame
  if (aspect > 0.62 && aspect < 0.82) {
    return [
      { x: 0.03, y: 0.03 },
      { x: 0.97, y: 0.03 },
      { x: 0.97, y: 0.97 },
      { x: 0.03, y: 0.97 },
    ];
  }
  const targetRatio = 5 / 7;
  let wFrac = 0.68;
  let hFrac = (wFrac * aspect) / targetRatio;
  if (hFrac > 0.84) {
    hFrac = 0.84;
    wFrac = (hFrac * targetRatio) / Math.max(0.2, aspect);
  }
  const left = Math.max(0.05, (1 - wFrac) / 2);
  const right = Math.min(0.95, 1 - left);
  const top = Math.max(0.05, (1 - hFrac) / 2);
  const bottom = Math.min(0.95, 1 - top);

  return [
    { x: Number(left.toFixed(3)), y: Number(top.toFixed(3)) },
    { x: Number(right.toFixed(3)), y: Number(top.toFixed(3)) },
    { x: Number(right.toFixed(3)), y: Number(bottom.toFixed(3)) },
    { x: Number(left.toFixed(3)), y: Number(bottom.toFixed(3)) },
  ];
}

/**
 * Warps an arbitrary 4-corner quadrilateral from sourceImg into a straight 300x420 card canvas
 * using inverse homography + bilinear sampling.
 */
export function warpCardPerspective(
  sourceImg: HTMLImageElement,
  corners: readonly [CornerPoint, CornerPoint, CornerPoint, CornerPoint],
  outWidth = 300,
  outHeight = 420
): { canvas: HTMLCanvasElement; dataUrl: string } {
  const maxWorkW = 900;
  const workScale = sourceImg.naturalWidth > maxWorkW ? maxWorkW / sourceImg.naturalWidth : 1;
  const sw = Math.max(1, Math.round(sourceImg.naturalWidth * workScale));
  const sh = Math.max(1, Math.round(sourceImg.naturalHeight * workScale));

  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = sw;
  srcCanvas.height = sh;
  const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
  if (!srcCtx) {
    throw new Error('2D canvas context unavailable.');
  }
  srcCtx.drawImage(sourceImg, 0, 0, sw, sh);
  const srcData = srcCtx.getImageData(0, 0, sw, sh).data;

  const srcPts = corners.map((c) => ({
    x: c.x * (sw - 1),
    y: c.y * (sh - 1),
  }));
  const dstPts = [
    { x: 0, y: 0 },
    { x: outWidth - 1, y: 0 },
    { x: outWidth - 1, y: outHeight - 1 },
    { x: 0, y: outHeight - 1 },
  ];

  // Inverse homography maps destination pixel -> source image coordinates
  const invH = solveHomography(dstPts, srcPts);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = outWidth;
  outCanvas.height = outHeight;
  const outCtx = outCanvas.getContext('2d', { willReadFrequently: true });
  if (!outCtx) {
    throw new Error('Output 2D canvas context unavailable.');
  }
  const outImageData = outCtx.createImageData(outWidth, outHeight);
  const dst = outImageData.data;

  for (let y = 0; y < outHeight; y++) {
    for (let x = 0; x < outWidth; x++) {
      const p = applyHomography(invH, x, y);
      const x0 = Math.max(0, Math.min(sw - 2, Math.floor(p.x)));
      const y0 = Math.max(0, Math.min(sh - 2, Math.floor(p.y)));
      const fx = Math.max(0, Math.min(1, p.x - x0));
      const fy = Math.max(0, Math.min(1, p.y - y0));

      const i00 = (y0 * sw + x0) * 4;
      const i10 = (y0 * sw + (x0 + 1)) * 4;
      const i01 = ((y0 + 1) * sw + x0) * 4;
      const i11 = ((y0 + 1) * sw + (x0 + 1)) * 4;

      const w00 = (1 - fx) * (1 - fy);
      const w10 = fx * (1 - fy);
      const w01 = (1 - fx) * fy;
      const w11 = fx * fy;

      const outIdx = (y * outWidth + x) * 4;
      dst[outIdx] = Math.round(srcData[i00] * w00 + srcData[i10] * w10 + srcData[i01] * w01 + srcData[i11] * w11);
      dst[outIdx + 1] = Math.round(srcData[i00 + 1] * w00 + srcData[i10 + 1] * w10 + srcData[i01 + 1] * w01 + srcData[i11 + 1] * w11);
      dst[outIdx + 2] = Math.round(srcData[i00 + 2] * w00 + srcData[i10 + 2] * w10 + srcData[i01 + 2] * w01 + srcData[i11 + 2] * w11);
      dst[outIdx + 3] = 255;
    }
  }

  outCtx.putImageData(outImageData, 0, 0);
  return {
    canvas: outCanvas,
    dataUrl: outCanvas.toDataURL('image/jpeg', 0.9),
  };
}

/**
 * Estimates dominant residual tilt (-25°..+25°) of the card canvas and deskews it cleanly.
 */
export function autoDeskewCanvas(sourceCanvas: HTMLCanvasElement): {
  canvas: HTMLCanvasElement;
  deskewDeg: number;
} {
  const sampleW = 96;
  const sampleH = 134;
  const probe = document.createElement('canvas');
  probe.width = sampleW;
  probe.height = sampleH;
  const pCtx = probe.getContext('2d', { willReadFrequently: true });
  if (!pCtx) return { canvas: sourceCanvas, deskewDeg: 0 };

  pCtx.drawImage(sourceCanvas, 0, 0, sampleW, sampleH);
  const pd = pCtx.getImageData(0, 0, sampleW, sampleH).data;
  const rawLuma = new Float32Array(sampleW * sampleH);
  for (let i = 0; i < sampleW * sampleH; i++) {
    rawLuma[i] = 0.299 * pd[i * 4] + 0.587 * pd[i * 4 + 1] + 0.114 * pd[i * 4 + 2];
  }
  const eqLuma = normalizeLuminanceCdf(rawLuma);
  const tiltDeg = estimateDominantTiltDegrees(eqLuma, sampleW, sampleH);

  if (Math.abs(tiltDeg) < 2) {
    return { canvas: sourceCanvas, deskewDeg: 0 };
  }

  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  if (!ctx) return { canvas: sourceCanvas, deskewDeg: 0 };

  ctx.fillStyle = '#0B0917';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  // Rotate opposite to detected tilt to align borders with image axes
  ctx.rotate((-tiltDeg * Math.PI) / 180);
  // Slight scale-up (~2-4%) avoids corner fill artifacts after small rotation
  const boost = 1 + Math.min(0.12, Math.abs(Math.sin((tiltDeg * Math.PI) / 180)) * 0.45);
  ctx.scale(boost, boost);
  ctx.drawImage(sourceCanvas, -w / 2, -h / 2, w, h);
  ctx.restore();

  return { canvas: out, deskewDeg: tiltDeg };
}

/**
 * Applies gentle gray-world white-balance + adaptive luminance equalization
 * so warm lighting shifts, dim rooms, and screen glare bars are suppressed before feature extraction.
 */
export function normalizeGlareAndContrast(sourceCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;

  const srcCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  const outCtx = out.getContext('2d', { willReadFrequently: true });
  if (!srcCtx || !outCtx) return sourceCanvas;

  const srcImg = srcCtx.getImageData(0, 0, w, h);
  const src = srcImg.data;
  const total = w * h;

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  const luma = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    const r = src[i * 4];
    const g = src[i * 4 + 1];
    const b = src[i * 4 + 2];
    sumR += r;
    sumG += g;
    sumB += b;
    luma[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  const meanR = sumR / Math.max(1, total);
  const meanG = sumG / Math.max(1, total);
  const meanB = sumB / Math.max(1, total);
  const meanGray = (meanR + meanG + meanB) / 3;

  // Very gentle white-balance nudge (0.93..1.07) preserves true card palette (Gold vs Purple vs Green)
  const gR = Math.max(0.93, Math.min(1.07, (meanGray / Math.max(20, meanR)) * 0.25 + 0.75));
  const gG = Math.max(0.93, Math.min(1.07, (meanGray / Math.max(20, meanG)) * 0.25 + 0.75));
  const gB = Math.max(0.93, Math.min(1.07, (meanGray / Math.max(20, meanB)) * 0.25 + 0.75));

  const eqLuma = normalizeLuminanceCdf(luma);
  const outImg = outCtx.createImageData(w, h);
  const dst = outImg.data;

  for (let i = 0; i < total; i++) {
    const r = src[i * 4] * gR;
    const g = src[i * 4 + 1] * gG;
    const b = src[i * 4 + 2] * gB;
    const baseL = Math.max(12, luma[i]);
    const ratio = (eqLuma[i] * 0.55 + baseL * 0.45) / baseL;
    dst[i * 4] = Math.max(0, Math.min(255, Math.round(r * ratio)));
    dst[i * 4 + 1] = Math.max(0, Math.min(255, Math.round(g * ratio)));
    dst[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(b * ratio)));
    dst[i * 4 + 3] = 255;
  }

  outCtx.putImageData(outImg, 0, 0);
  return out;
}

/**
 * Generates an alignment hypothesis canvas (for ±8% edge-clip/scale/offset or ±12°/±18° tilt tolerance).
 */
export function createTransformedCropCanvas(
  sourceCanvas: HTMLCanvasElement,
  opts: { scale?: number; dxFrac?: number; dyFrac?: number; angleDeg?: number }
): HTMLCanvasElement {
  const { scale = 1, dxFrac = 0, dyFrac = 0, angleDeg = 0 } = opts;
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  if (!ctx) return sourceCanvas;

  // Paint base canvas first so out-of-bounds areas preserve card color palette instead of artificial black bars
  ctx.drawImage(sourceCanvas, 0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2 + dxFrac * w, h / 2 + dyFrac * h);
  if (angleDeg !== 0) {
    ctx.rotate((angleDeg * Math.PI) / 180);
  }
  ctx.scale(scale, scale);
  ctx.drawImage(sourceCanvas, -w / 2, -h / 2, w, h);
  ctx.restore();
  return out;
}
