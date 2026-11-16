import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCatalogBundle,
  deriveCardNameFromFilename,
  filterAdminCards,
  filterPublishedCards,
  formatBdt,
  getNextSerialNumber,
  parseCatalogBundle,
} from './catalogHelpers';
import type { CardItem } from '../types/card';

const sampleCards: CardItem[] = [
  {
    id: 'c1',
    serial: 1,
    name: 'Pikachu EX — পিকাচু হলোগ্রাফিক',
    category: 'Pokemon',
    priceBdt: 2500,
    publishStatus: 'published',
    stockStatus: 'available',
    sortOrder: 1,
    setName: 'Promo',
    rarity: 'Ultra Rare',
    condition: 'Mint',
    imageUrl: '/cards/pokemon-1.svg',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'c2',
    serial: 2,
    name: 'Messi 10 Gold',
    category: 'Football',
    priceBdt: null,
    publishStatus: 'draft',
    stockStatus: 'out_of_stock',
    sortOrder: 2,
    setName: 'World Cup',
    rarity: 'Secret Gold',
    condition: 'Near Mint',
    imageUrl: '/cards/football-1.svg',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

test('formatBdt formats Taka cleanly and handles unpriced', () => {
  assert.equal(formatBdt(2500), '৳2,500');
  assert.equal(formatBdt(null), 'Unpriced');
  assert.equal(formatBdt(0), 'Unpriced');
});

test('getNextSerialNumber increments from max serial', () => {
  assert.equal(getNextSerialNumber([]), 1);
  assert.equal(getNextSerialNumber(sampleCards), 3);
});

test('filterPublishedCards excludes drafts and matches Bengali/English/serial queries', () => {
  const all = filterPublishedCards(sampleCards, {
    query: '',
    category: 'All',
    stock: 'All',
    rarity: 'All',
    sortBy: 'serial_asc',
  });
  assert.equal(all.length, 1);
  assert.equal(all[0].id, 'c1');

  const bengali = filterPublishedCards(sampleCards, {
    query: 'পিকাচু',
    category: 'All',
    stock: 'All',
    rarity: 'All',
    sortBy: 'serial_asc',
  });
  assert.equal(bengali.length, 1);

  const bySerial = filterPublishedCards(sampleCards, {
    query: '#1',
    category: 'All',
    stock: 'All',
    rarity: 'All',
    sortBy: 'serial_asc',
  });
  assert.equal(bySerial.length, 1);
});

test('filterAdminCards filters unpriced cards accurately', () => {
  const unpriced = filterAdminCards(sampleCards, {
    query: '',
    category: 'All',
    publishStatus: 'All',
    stockStatus: 'All',
    unpricedOnly: true,
  });
  assert.equal(unpriced.length, 1);
  assert.equal(unpriced[0].id, 'c2');
});

test('catalog bundle export/import round-trips cleanly including sold status', () => {
  const soldSample = { ...sampleCards[1], stockStatus: 'sold' as const };
  const bundle = createCatalogBundle([sampleCards[0], soldSample]);
  const parsed = parseCatalogBundle(JSON.stringify(bundle));
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].name, sampleCards[0].name);
  assert.equal(parsed[1].stockStatus, 'sold');
  assert.equal(deriveCardNameFromFilename('charizard_vmax_holo.webp', 10), 'Charizard Vmax Holo');
});
