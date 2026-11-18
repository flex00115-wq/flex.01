import test from 'node:test';
import assert from 'node:assert/strict';
import { getSupabaseConfig, isSupabaseConfigured } from '../lib/supabase';
import type { CardFingerprint, CardItem } from '../types/card';
import {
  cardItemToSupabaseRow,
  cardPatchToSupabasePatch,
  combineFingerprintFromSupabase,
  extractStoragePathFromPublicUrl,
  isDataImageUrl,
  mergeRealtimeCardEvent,
  parseDataImageUrl,
  splitFingerprintForSupabase,
  supabaseRowToCardItem,
} from './supabaseSync';

const sampleFingerprint: CardFingerprint = {
  rHash: '0123456789abcdef',
  gHash: 'fedcba9876543210',
  bHash: '1122334455667788',
  edgeHash: '8877665544332211',
  spatialGrid: [0.1, 0.2, 0.3, 0.4],
  structuralVec: [0.5, 0.6],
  innerHogVec: [0.25, 0.75],
  colorChromaGrid: [0.9, 0.8],
  neuralEmbedding: [0.11, 0.22, 0.33],
  innerNeuralEmbedding: [0.44, 0.55],
  version: 3,
};

const sampleCard: CardItem = {
  id: 'flex-pkm-101',
  serial: 101,
  name: 'Pikachu EX — পিকাচু',
  category: 'Pokemon',
  priceBdt: 2500,
  publishStatus: 'published',
  stockStatus: 'available',
  sortOrder: 4,
  setName: 'Scarlet & Violet',
  rarity: 'Ultra Rare',
  condition: 'Mint',
  description: 'Verified holo card',
  imageUrl: 'https://example.supabase.co/storage/v1/object/public/card-images/cards/flex-pkm-101.webp',
  fingerprint: sampleFingerprint,
  createdAt: '2026-11-17T10:00:00.000Z',
  updatedAt: '2026-11-17T10:05:00.000Z',
};

test('isSupabaseConfigured returns false when env vars are unset', () => {
  assert.equal(getSupabaseConfig(), null);
  assert.equal(isSupabaseConfigured(), false);
});

test('cardItemToSupabaseRow and supabaseRowToCardItem round-trip all schema columns and v3 fingerprint', () => {
  const row = cardItemToSupabaseRow(sampleCard);

  assert.equal(row.id, sampleCard.id);
  assert.equal(row.serial, 101);
  assert.equal(row.name, 'Pikachu EX — পিকাচু');
  assert.equal(row.category, 'Pokemon');
  assert.equal(row.price_bdt, 2500);
  assert.equal(row.publish_status, 'published');
  assert.equal(row.stock_status, 'available');
  assert.equal(row.rarity, 'Ultra Rare');
  assert.equal(row.display_order, 4);
  assert.equal(row.image_url, sampleCard.imageUrl);
  assert.ok(row.phash);
  assert.deepEqual(row.embedding, {
    neuralEmbedding: [0.11, 0.22, 0.33],
    innerNeuralEmbedding: [0.44, 0.55],
  });

  const roundTrip = supabaseRowToCardItem(row);
  assert.deepEqual(roundTrip, sampleCard);
});

test('splitFingerprintForSupabase and combineFingerprintFromSupabase support array and object embeddings', () => {
  const split = splitFingerprintForSupabase(sampleFingerprint);
  assert.equal('neuralEmbedding' in (split.phash || {}), false);
  assert.equal('innerNeuralEmbedding' in (split.phash || {}), false);

  const combinedFromArray = combineFingerprintFromSupabase(split.phash, [0.7, 0.8, 0.9]);
  assert.deepEqual(combinedFromArray?.neuralEmbedding, [0.7, 0.8, 0.9]);
  assert.equal(combinedFromArray?.rHash, sampleFingerprint.rHash);
  assert.equal(combinedFromArray?.version, 3);
});

test('cardPatchToSupabasePatch maps partial admin updates accurately', () => {
  const patch = cardPatchToSupabasePatch({
    priceBdt: 3100,
    stockStatus: 'sold',
    publishStatus: 'draft',
    sortOrder: 9,
    updatedAt: '2026-11-17T12:00:00.000Z',
  });

  assert.equal(patch.price_bdt, 3100);
  assert.equal(patch.stock_status, 'sold');
  assert.equal(patch.publish_status, 'draft');
  assert.equal(patch.display_order, 9);
  assert.equal(patch.name, undefined);
  assert.equal(patch.updated_at, '2026-11-17T12:00:00.000Z');
});

test('mergeRealtimeCardEvent handles INSERT, UPDATE, and DELETE while preserving canonical sort', () => {
  const cardA: CardItem = { ...sampleCard, id: 'c1', serial: 1, sortOrder: 2, priceBdt: 1000 };
  const cardB: CardItem = { ...sampleCard, id: 'c2', serial: 2, sortOrder: 1, priceBdt: 2000 };

  // INSERT cardA into [cardB]
  const afterInsert = mergeRealtimeCardEvent([cardB], {
    eventType: 'INSERT',
    newRow: cardItemToSupabaseRow(cardA),
  });
  assert.deepEqual(
    afterInsert.map((c) => c.id),
    ['c2', 'c1']
  );

  // UPDATE cardA price & order ahead of cardB
  const updatedA: CardItem = { ...cardA, priceBdt: 1850, sortOrder: 0 };
  const afterUpdate = mergeRealtimeCardEvent(afterInsert, {
    eventType: 'UPDATE',
    newRow: cardItemToSupabaseRow(updatedA),
  });
  assert.deepEqual(
    afterUpdate.map((c) => c.id),
    ['c1', 'c2']
  );
  assert.equal(afterUpdate[0].priceBdt, 1850);

  // DELETE cardB
  const afterDelete = mergeRealtimeCardEvent(afterUpdate, {
    eventType: 'DELETE',
    oldId: 'c2',
  });
  assert.deepEqual(
    afterDelete.map((c) => c.id),
    ['c1']
  );
});

test('parseDataImageUrl decodes WebP data URL and extractStoragePathFromPublicUrl parses bucket paths', () => {
  const sampleBase64 = Buffer.from('RIFFWEBPTEST').toString('base64');
  const dataUrl = `data:image/webp;base64,${sampleBase64}`;

  assert.equal(isDataImageUrl(dataUrl), true);
  assert.equal(isDataImageUrl('https://cdn.example.com/card.webp'), false);

  const parsed = parseDataImageUrl(dataUrl);
  assert.ok(parsed);
  assert.equal(parsed.mimeType, 'image/webp');
  assert.equal(parsed.extension, 'webp');
  assert.equal(Buffer.from(parsed.bytes).toString('utf8'), 'RIFFWEBPTEST');

  const path = extractStoragePathFromPublicUrl(
    'https://abc.supabase.co/storage/v1/object/public/card-images/cards/flex-pkm-101-123.webp?t=1',
    'card-images'
  );
  assert.equal(path, 'cards/flex-pkm-101-123.webp');
});
