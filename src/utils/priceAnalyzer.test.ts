import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCardPricing } from './priceAnalyzer';
import type { CardItem } from '../types/card';

function makeCard(priceBdt: number | null, overrides: Partial<CardItem> = {}): CardItem {
  return {
    id: 'test-card-1',
    serial: 1,
    name: 'Pikachu EX Gold',
    category: 'Pokemon',
    priceBdt,
    publishStatus: 'published',
    stockStatus: 'available',
    sortOrder: 1,
    setName: 'Promo',
    rarity: 'Ultra Rare',
    condition: 'Mint',
    imageUrl: '/cards/pokemon-1.svg',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test('analyzeCardPricing strictly preserves fixedCurrentPrice and enforces past < current < future', () => {
  const prices = [1, 2, 10, 50, 550, 1450, 2500, 12500, 50000];
  for (const price of prices) {
    const result = analyzeCardPricing(makeCard(price));
    assert.equal(result.isPriced, true);
    assert.equal(result.fixedCurrentPrice, price);
    assert.ok(
      result.estimatedPastPrice < result.fixedCurrentPrice,
      `Expected past (${result.estimatedPastPrice}) < current (${result.fixedCurrentPrice})`
    );
    assert.ok(
      result.predictedFuturePrice > result.fixedCurrentPrice,
      `Expected future (${result.predictedFuturePrice}) > current (${result.fixedCurrentPrice})`
    );
    assert.equal(result.series.length, 6);
    const currentPoint = result.series.find((p) => p.phase === 'current');
    assert.equal(currentPoint?.priceBdt, price);
    for (const pt of result.series) {
      if (pt.phase === 'past') {
        assert.ok(pt.priceBdt < price);
      }
      if (pt.phase === 'future') {
        assert.ok(pt.priceBdt > price);
      }
    }
  }
});

test('analyzeCardPricing handles unpriced cards gracefully', () => {
  const result = analyzeCardPricing(makeCard(null));
  assert.equal(result.isPriced, false);
  assert.equal(result.fixedCurrentPrice, 0);
  assert.equal(result.series.length, 0);
});
