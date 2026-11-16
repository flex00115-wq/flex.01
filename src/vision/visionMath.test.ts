import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyHomography,
  computeKeypointSignature,
  computeTextMatchScore,
  cosineSimilarity,
  estimateDominantTiltDegrees,
  evaluateMatchDecision,
  hexHammingDistance,
  normalizeLuminanceCdf,
  patchCorrelationSimilarity,
  pHashSimilarity,
  solveHomography,
  spatialGridSimilarity,
} from './visionMath';

test('solveHomography maps tilted quadrilateral cleanly to unit rectangle', () => {
  const src = [
    { x: 20, y: 30 },
    { x: 220, y: 10 },
    { x: 240, y: 330 },
    { x: 10, y: 310 },
  ];
  const dst = [
    { x: 0, y: 0 },
    { x: 300, y: 0 },
    { x: 300, y: 420 },
    { x: 0, y: 420 },
  ];

  const H = solveHomography(dst, src);
  const topLeft = applyHomography(H, 0, 0);
  const bottomRight = applyHomography(H, 300, 420);

  assert.ok(Math.abs(topLeft.x - 20) < 1e-4);
  assert.ok(Math.abs(topLeft.y - 30) < 1e-4);
  assert.ok(Math.abs(bottomRight.x - 240) < 1e-4);
  assert.ok(Math.abs(bottomRight.y - 330) < 1e-4);
});

test('hexHammingDistance and pHashSimilarity measure bit differences accurately', () => {
  assert.equal(hexHammingDistance('ffff0000', 'ffff0000'), 0);
  assert.equal(hexHammingDistance('ffff0000', 'ffff000f'), 4);
  assert.equal(pHashSimilarity('0000000000000000', '0000000000000000'), 1);
  assert.equal(pHashSimilarity('0000000000000000', 'ffffffffffffffff'), 0);
});

test('cosineSimilarity, spatialGridSimilarity, and patchCorrelationSimilarity behave monotonically', () => {
  assert.ok(cosineSimilarity([1, 2, 3], [2, 4, 6]) > 0.999);
  assert.ok(cosineSimilarity([1, 0], [0, 1]) === 0);
  assert.equal(spatialGridSimilarity([0.5, 0.2], [0.5, 0.2]), 1);
  assert.ok(patchCorrelationSimilarity([10, 20, 30, 40], [15, 30, 45, 60]) > 0.99);
});

test('normalizeLuminanceCdf expands low-contrast dark/glare images', () => {
  const lowContrast = new Float32Array([180, 185, 190, 195, 200, 205, 210, 215]);
  const equalized = normalizeLuminanceCdf(lowContrast);
  const spreadIn = lowContrast[7] - lowContrast[0];
  const spreadOut = equalized[7] - equalized[0];
  assert.ok(spreadOut > spreadIn * 2);
});

test('estimateDominantTiltDegrees detects tilted edge line accurately', () => {
  const w = 64;
  const h = 64;
  const img = new Float32Array(w * h).fill(20);
  const angleRad = (12 * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const rx = (x - w / 2) * cos + (y - h / 2) * sin;
      const ry = -(x - w / 2) * sin + (y - h / 2) * cos;
      if (Math.abs(rx) < 18 && Math.abs(ry) < 24) {
        img[y * w + x] = 220;
      }
    }
  }
  const detected = estimateDominantTiltDegrees(img, w, h);
  assert.ok(Math.abs(detected - 12) <= 2, `Expected ~12 deg tilt, got ${detected}`);
});

test('computeKeypointSignature produces normalized 48-dim vector and computeTextMatchScore matches Pikachu EX', () => {
  const w = 32;
  const h = 32;
  const img = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      img[y * w + x] = (x > 10 && x < 22 && y > 8 && y < 22) ? 240 : 30;
    }
  }
  const kp = computeKeypointSignature(img, w, h);
  assert.equal(kp.length, 48);
  assert.ok(kp.some((v) => v > 0));

  const scoreMatch = computeTextMatchScore('POKEMON HP 210 Pikachu EX THUNDERBOLT 180 #1 PKM-025', {
    serial: 1,
    name: 'Pikachu EX — পিকাচু হলোগ্রাফিক',
    category: 'Pokemon',
    setName: 'Scarlet & Violet Promo',
    rarity: 'Ultra Rare',
  });
  const scoreMismatch = computeTextMatchScore('Messi 10 Inter Miami CF Strike Gold #6', {
    serial: 1,
    name: 'Pikachu EX — পিকাচু হলোগ্রাফিক',
    category: 'Pokemon',
    setName: 'Scarlet & Violet Promo',
    rarity: 'Ultra Rare',
  });
  assert.ok(scoreMatch > 0.55);
  assert.ok(scoreMismatch < 0.25);
});

test('evaluateMatchDecision rejects low-confidence or ambiguous candidates (anti-false-match)', () => {
  const lowRes = evaluateMatchDecision([
    { id: 'c1', stage2Score: 0.55, localPatchScore: 0.5, compositeScore: 0.54 },
    { id: 'c2', stage2Score: 0.4, localPatchScore: 0.4, compositeScore: 0.42 },
  ]);
  assert.equal(lowRes.matched, false);
  assert.equal(lowRes.matchedId, null);

  const tieRes = evaluateMatchDecision([
    { id: 'c1', stage2Score: 0.72, localPatchScore: 0.7, compositeScore: 0.71 },
    { id: 'c2', stage2Score: 0.71, localPatchScore: 0.69, compositeScore: 0.7 },
  ]);
  assert.equal(tieRes.matched, false);

  const clearRes = evaluateMatchDecision([
    { id: 'c1', stage2Score: 0.84, localPatchScore: 0.82, innerStructureScore: 0.85, compositeScore: 0.84 },
    { id: 'c2', stage2Score: 0.62, localPatchScore: 0.6, innerStructureScore: 0.61, compositeScore: 0.61 },
  ]);
  assert.equal(clearRes.matched, true);
  assert.equal(clearRes.matchedId, 'c1');

  const geminiReject = evaluateMatchDecision(
    [
      { id: 'c1', stage2Score: 0.82, localPatchScore: 0.8, compositeScore: 0.81 },
    ],
    { available: true, isMatch: false, matchedCardId: null, confidence: 0.91, reason: 'Different card' }
  );
  assert.equal(geminiReject.matched, false);
});

