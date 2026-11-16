import type { CardFingerprint } from '../types/card';
import { loadImage } from './perspective';
import { computeKeypointSignature, normalizeLuminanceCdf } from './visionMath';

const DCT_SIZE = 32;
const HASH_SIZE = 8;

const COS_TABLE: number[][] = (() => {
  const table: number[][] = [];
  for (let u = 0; u < HASH_SIZE; u++) {
    const row: number[] = [];
    for (let x = 0; x < DCT_SIZE; x++) {
      row.push(Math.cos(((2 * x + 1) * u * Math.PI) / (2 * DCT_SIZE)));
    }
    table.push(row);
  }
  return table;
})();

function computeChannelDctHash(channel: Float32Array): string {
  const vals: number[] = [];
  const temp = new Float32Array(DCT_SIZE * HASH_SIZE);

  for (let y = 0; y < DCT_SIZE; y++) {
    const rowOffset = y * DCT_SIZE;
    for (let u = 0; u < HASH_SIZE; u++) {
      let sum = 0;
      const cosU = COS_TABLE[u];
      for (let x = 0; x < DCT_SIZE; x++) {
        sum += channel[rowOffset + x] * cosU[x];
      }
      temp[y * HASH_SIZE + u] = sum;
    }
  }

  for (let v = 0; v < HASH_SIZE; v++) {
    const cosV = COS_TABLE[v];
    for (let u = 0; u < HASH_SIZE; u++) {
      let sum = 0;
      for (let y = 0; y < DCT_SIZE; y++) {
        sum += temp[y * HASH_SIZE + u] * cosV[y];
      }
      vals.push(sum);
    }
  }

  const ac = vals.slice(1).sort((a, b) => a - b);
  const median = ac[Math.floor(ac.length / 2)];

  let hex = '';
  for (let i = 0; i < 64; i += 4) {
    let nibble = 0;
    for (let b = 0; b < 4; b++) {
      if (vals[i + b] > median) {
        nibble |= 1 << (3 - b);
      }
    }
    hex += nibble.toString(16);
  }
  return hex;
}

function drawNormalizedCanvas(
  imgOrCanvas: HTMLImageElement | HTMLCanvasElement,
  w: number,
  h: number
): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D unavailable.');
  ctx.drawImage(imgOrCanvas, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

interface NormalizedRegion {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function computeRegionHog(
  luma: Float32Array,
  w: number,
  h: number,
  region: NormalizedRegion,
  gridX: number,
  gridY: number
): number[] {
  const rx0 = Math.max(1, Math.floor(region.x0 * w));
  const ry0 = Math.max(1, Math.floor(region.y0 * h));
  const rx1 = Math.min(w - 2, Math.ceil(region.x1 * w));
  const ry1 = Math.min(h - 2, Math.ceil(region.y1 * h));

  const rw = Math.max(1, rx1 - rx0 + 1);
  const rh = Math.max(1, ry1 - ry0 + 1);
  const vec = new Array<number>(gridX * gridY * 4).fill(0);

  for (let y = ry0; y <= ry1; y++) {
    for (let x = rx0; x <= rx1; x++) {
      const gx = luma[y * w + (x + 1)] - luma[y * w + (x - 1)];
      const gy = luma[(y + 1) * w + x] - luma[(y - 1) * w + x];
      const mag = Math.sqrt(gx * gx + gy * gy);
      const angle = ((Math.atan2(gy, gx) + Math.PI) / Math.PI) * 2;
      const bin = Math.min(3, Math.floor(angle) % 4);
      const cx = Math.min(gridX - 1, Math.floor(((x - rx0) / rw) * gridX));
      const cy = Math.min(gridY - 1, Math.floor(((y - ry0) / rh) * gridY));
      vec[(cy * gridX + cx) * 4 + bin] += mag;
    }
  }

  const norm = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0)) || 1;
  return vec.map((v) => Number((v / norm).toFixed(4)));
}

function computeRadialStructureVec(luma: Float32Array, w: number, h: number): number[] {
  const rings = 8;
  const vec = new Array<number>(rings * 4).fill(0);
  const counts = new Array<number>(rings).fill(0);
  const cx = w * 0.5;
  const cy = h * 0.41;
  const maxR = Math.min(w * 0.42, h * 0.36);

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const r = Math.hypot(x - cx, y - cy);
      if (r > maxR) continue;
      const ring = Math.min(rings - 1, Math.floor((r / maxR) * rings));
      const gx = luma[y * w + (x + 1)] - luma[y * w + (x - 1)];
      const gy = luma[(y + 1) * w + x] - luma[(y - 1) * w + x];
      const mag = Math.sqrt(gx * gx + gy * gy);
      const lum = luma[y * w + x];
      const base = ring * 4;
      vec[base] += mag;
      vec[base + 1] += lum;
      vec[base + 2] += mag * mag;
      vec[base + 3] += Math.abs(Math.abs(gx) - Math.abs(gy));
      counts[ring]++;
    }
  }

  for (let ring = 0; ring < rings; ring++) {
    const c = Math.max(1, counts[ring]);
    const base = ring * 4;
    const meanMag = vec[base] / c;
    const meanLum = vec[base + 1] / c;
    const meanSq = vec[base + 2] / c;
    const stdMag = Math.sqrt(Math.max(0, meanSq - meanMag * meanMag));
    const aniso = vec[base + 3] / c;
    vec[base] = meanMag / 180;
    vec[base + 1] = meanLum / 255;
    vec[base + 2] = stdMag / 160;
    vec[base + 3] = aniso / 150;
  }

  const norm = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0)) || 1;
  return vec.map((v) => Number((v / norm).toFixed(4)));
}

function sampleRegionPatch(
  luma: Float32Array,
  w: number,
  h: number,
  region: NormalizedRegion,
  outW: number,
  outH: number
): number[] {
  const patch: number[] = [];
  for (let py = 0; py < outH; py++) {
    const fy = outH > 1 ? py / (outH - 1) : 0.5;
    const sy = Math.min(h - 1, Math.max(0, Math.round((region.y0 + fy * (region.y1 - region.y0)) * (h - 1))));
    for (let px = 0; px < outW; px++) {
      const fx = outW > 1 ? px / (outW - 1) : 0.5;
      const sx = Math.min(w - 1, Math.max(0, Math.round((region.x0 + fx * (region.x1 - region.x0)) * (w - 1))));
      patch.push(Math.round(luma[sy * w + sx]));
    }
  }
  return patch;
}

export async function extractInnerArtworkDataUrl(
  source: HTMLImageElement | HTMLCanvasElement | string
): Promise<string> {
  const media = typeof source === 'string' ? await loadImage(source) : source;
  const sw = media instanceof HTMLImageElement ? media.naturalWidth : media.width;
  const sh = media instanceof HTMLImageElement ? media.naturalHeight : media.height;

  const sx = Math.round(sw * 0.10);
  const sy = Math.round(sh * 0.16);
  const sWidth = Math.max(1, Math.round(sw * 0.80));
  const sHeight = Math.max(1, Math.round(sh * 0.52));

  const out = document.createElement('canvas');
  out.width = 224;
  out.height = 224;
  const ctx = out.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(media, sx, sy, sWidth, sHeight, 0, 0, 224, 224);
  return out.toDataURL('image/jpeg', 0.88);
}

/**
 * Computes Version 3 glare-tolerant, hue-preserving, multi-region visual fingerprint.
 */
export async function computeCardFingerprint(
  source: HTMLImageElement | HTMLCanvasElement | string
): Promise<CardFingerprint> {
  const media = typeof source === 'string' ? await loadImage(source) : source;

  // 1. 32x32 sample for true-hue RGB pHash, chromaticity grid, & glare-normalized Edge pHash
  const img32 = drawNormalizedCanvas(media, DCT_SIZE, DCT_SIZE);
  const d32 = img32.data;
  const n32 = DCT_SIZE * DCT_SIZE;
  const rChan = new Float32Array(n32);
  const gChan = new Float32Array(n32);
  const bChan = new Float32Array(n32);
  const rawLuma32 = new Float32Array(n32);

  for (let i = 0; i < n32; i++) {
    const r = d32[i * 4];
    const g = d32[i * 4 + 1];
    const b = d32[i * 4 + 2];
    rChan[i] = r;
    gChan[i] = g;
    bChan[i] = b;
    rawLuma32[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  const luma32 = normalizeLuminanceCdf(rawLuma32);
  const edgeChan = new Float32Array(n32);
  for (let y = 1; y < DCT_SIZE - 1; y++) {
    for (let x = 1; x < DCT_SIZE - 1; x++) {
      const idx = y * DCT_SIZE + x;
      const gx =
        -luma32[(y - 1) * DCT_SIZE + (x - 1)] +
        luma32[(y - 1) * DCT_SIZE + (x + 1)] -
        2 * luma32[y * DCT_SIZE + (x - 1)] +
        2 * luma32[y * DCT_SIZE + (x + 1)] -
        luma32[(y + 1) * DCT_SIZE + (x - 1)] +
        luma32[(y + 1) * DCT_SIZE + (x + 1)];
      const gy =
        -luma32[(y - 1) * DCT_SIZE + (x - 1)] -
        2 * luma32[(y - 1) * DCT_SIZE + x] -
        luma32[(y - 1) * DCT_SIZE + (x + 1)] +
        luma32[(y + 1) * DCT_SIZE + (x - 1)] +
        2 * luma32[(y + 1) * DCT_SIZE + x] +
        luma32[(y + 1) * DCT_SIZE + (x + 1)];
      edgeChan[idx] = Math.sqrt(gx * gx + gy * gy);
    }
  }

  const rHash = computeChannelDctHash(rChan);
  const gHash = computeChannelDctHash(gChan);
  const bHash = computeChannelDctHash(bChan);
  const edgeHash = computeChannelDctHash(edgeChan);

  // 2. 4x4 Spatial Zone Signature (64 floats) + 4x4 Brightness-Invariant Chromaticity Grid (32 floats)
  const spatialGrid: number[] = [];
  const colorChromaGrid: number[] = [];
  const zoneSize = DCT_SIZE / 4;
  for (let zy = 0; zy < 4; zy++) {
    for (let zx = 0; zx < 4; zx++) {
      let sR = 0;
      let sG = 0;
      let sB = 0;
      let sE = 0;
      const count = zoneSize * zoneSize;
      for (let py = 0; py < zoneSize; py++) {
        for (let px = 0; px < zoneSize; px++) {
          const i = (zy * zoneSize + py) * DCT_SIZE + (zx * zoneSize + px);
          sR += rChan[i];
          sG += gChan[i];
          sB += bChan[i];
          sE += Math.min(255, edgeChan[i] / 2);
        }
      }
      const avgR = sR / count;
      const avgG = sG / count;
      const avgB = sB / count;
      const sumRgb = Math.max(24, avgR + avgG + avgB);
      // Opponent color chromaticity (invariant to exposure/glare brightness, separates gold/purple/green/red/blue)
      colorChromaGrid.push(
        Number(((avgR - avgG) / sumRgb).toFixed(4)),
        Number(((0.5 * (avgR + avgG) - avgB) / sumRgb).toFixed(4))
      );
      spatialGrid.push(
        Number((avgR / 255).toFixed(4)),
        Number((avgG / 255).toFixed(4)),
        Number((avgB / 255).toFixed(4)),
        Number((sE / (count * 255)).toFixed(4))
      );
    }
  }

  // 3. Glare-Normalized 72x100 luminance map for core artwork HOG, text strip patches, radial rings, keypoints
  const W = 72;
  const H = 100;
  const imgHi = drawNormalizedCanvas(media, W, H);
  const dHi = imgHi.data;
  const rawLumaHi = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    rawLumaHi[i] = 0.299 * dHi[i * 4] + 0.587 * dHi[i * 4 + 1] + 0.114 * dHi[i * 4 + 2];
  }
  const lumaHi = normalizeLuminanceCdf(rawLumaHi);

  const structuralVec = computeRegionHog(lumaHi, W, H, { x0: 0.04, y0: 0.04, x1: 0.96, y1: 0.96 }, 4, 4);
  // Tight core artwork zone (focuses directly on central character/emblem inside frame)
  const innerHogVec = computeRegionHog(lumaHi, W, H, { x0: 0.18, y0: 0.21, x1: 0.82, y1: 0.60 }, 4, 4);
  const topHogVec = computeRegionHog(lumaHi, W, H, { x0: 0.10, y0: 0.06, x1: 0.90, y1: 0.15 }, 4, 2);
  const bottomHogVec = computeRegionHog(lumaHi, W, H, { x0: 0.10, y0: 0.67, x1: 0.90, y1: 0.83 }, 4, 2);
  const radialStructureVec = computeRadialStructureVec(lumaHi, W, H);
  const keypointSignature = computeKeypointSignature(lumaHi, W, H);

  // Core 16x16 artwork edge & luma patches (center symbol x: 0.18..0.82, y: 0.21..0.60)
  const innerEdgePatch: number[] = [];
  const innerLumaPatch: number[] = [];
  for (let py = 0; py < 16; py++) {
    const sy = Math.min(H - 2, Math.max(1, Math.round((0.21 + (py / 15) * 0.39) * (H - 1))));
    for (let px = 0; px < 16; px++) {
      const sx = Math.min(W - 2, Math.max(1, Math.round((0.18 + (px / 15) * 0.64) * (W - 1))));
      const gx = lumaHi[sy * W + (sx + 1)] - lumaHi[sy * W + (sx - 1)];
      const gy = lumaHi[(sy + 1) * W + sx] - lumaHi[(sy - 1) * W + sx];
      innerEdgePatch.push(Math.min(255, Math.round(Math.sqrt(gx * gx + gy * gy) * 0.75)));
      innerLumaPatch.push(Math.round(lumaHi[sy * W + sx]));
    }
  }

  // Top Header Text Strip (24x6) & Card Name Plate Text Strip (24x8)
  const topTextPatch = sampleRegionPatch(lumaHi, W, H, { x0: 0.11, y0: 0.07, x1: 0.89, y1: 0.14 }, 24, 6);
  const namePlatePatch = sampleRegionPatch(lumaHi, W, H, { x0: 0.11, y0: 0.68, x1: 0.89, y1: 0.81 }, 24, 8);

  // 18x24 CDF-normalized full patch luminance grid
  const imgPatch = drawNormalizedCanvas(media, 18, 24);
  const dp = imgPatch.data;
  const rawPatch = new Float32Array(18 * 24);
  for (let i = 0; i < 18 * 24; i++) {
    rawPatch[i] = 0.299 * dp[i * 4] + 0.587 * dp[i * 4 + 1] + 0.114 * dp[i * 4 + 2];
  }
  const patchThumb = Array.from(normalizeLuminanceCdf(rawPatch), (v) => Math.round(v));

  return {
    rHash,
    gHash,
    bHash,
    edgeHash,
    spatialGrid,
    structuralVec,
    patchThumb,
    innerHogVec,
    topHogVec,
    bottomHogVec,
    innerEdgePatch,
    innerLumaPatch,
    topTextPatch,
    namePlatePatch,
    colorChromaGrid,
    radialStructureVec,
    keypointSignature,
    version: 3,
  };
}
