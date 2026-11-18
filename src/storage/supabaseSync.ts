import {
  CARD_CATEGORIES,
  type CardCategory,
  type CardCondition,
  type CardFingerprint,
  type CardItem,
  type CardRarity,
  type PublishStatus,
  type StockStatus,
} from '../types/card';

export interface SupabaseEmbeddingPayload {
  neuralEmbedding?: number[];
  innerNeuralEmbedding?: number[];
}

export interface SupabaseCardRow {
  id: string;
  serial: number;
  name: string;
  category: string;
  price_bdt: number | null;
  publish_status: string;
  stock_status: string;
  rarity: string;
  set_name?: string | null;
  condition?: string | null;
  description?: string | null;
  display_order: number;
  image_url: string;
  phash: Record<string, unknown> | null;
  embedding: SupabaseEmbeddingPayload | number[] | null;
  created_at: string;
  updated_at: string;
}

const VALID_RARITIES: readonly CardRarity[] = [
  'Common',
  'Rare',
  'Holo Rare',
  'Ultra Rare',
  'Secret Gold',
  'Mythic',
];

const VALID_CONDITIONS: readonly CardCondition[] = ['Mint', 'Near Mint', 'Lightly Played'];

function normalizeCategory(raw: unknown): CardCategory {
  if (typeof raw === 'string' && (CARD_CATEGORIES as readonly string[]).includes(raw)) {
    return raw as CardCategory;
  }
  return 'Pokemon';
}

function normalizePublishStatus(raw: unknown): PublishStatus {
  return raw === 'draft' ? 'draft' : 'published';
}

function normalizeStockStatus(raw: unknown): StockStatus {
  if (raw === 'sold') return 'sold';
  if (raw === 'out_of_stock') return 'out_of_stock';
  return 'available';
}

function normalizeRarity(raw: unknown): CardRarity {
  if (typeof raw === 'string' && (VALID_RARITIES as readonly string[]).includes(raw)) {
    return raw as CardRarity;
  }
  return 'Rare';
}

function normalizeCondition(raw: unknown): CardCondition {
  if (typeof raw === 'string' && (VALID_CONDITIONS as readonly string[]).includes(raw)) {
    return raw as CardCondition;
  }
  return 'Near Mint';
}

export function splitFingerprintForSupabase(fp?: CardFingerprint): {
  phash: Record<string, unknown> | null;
  embedding: SupabaseEmbeddingPayload | null;
} {
  if (!fp) {
    return { phash: null, embedding: null };
  }

  const { neuralEmbedding, innerNeuralEmbedding, ...rest } = fp;
  const hasNeural = Array.isArray(neuralEmbedding) && neuralEmbedding.length > 0;
  const hasInnerNeural = Array.isArray(innerNeuralEmbedding) && innerNeuralEmbedding.length > 0;

  return {
    phash: Object.keys(rest).length > 0 ? (rest as Record<string, unknown>) : null,
    embedding:
      hasNeural || hasInnerNeural
        ? {
            ...(hasNeural ? { neuralEmbedding } : {}),
            ...(hasInnerNeural ? { innerNeuralEmbedding } : {}),
          }
        : null,
  };
}

export function combineFingerprintFromSupabase(
  phash: SupabaseCardRow['phash'],
  embedding: SupabaseCardRow['embedding']
): CardFingerprint | undefined {
  let base: Partial<CardFingerprint> | null = null;
  if (phash && typeof phash === 'object' && !Array.isArray(phash)) {
    base = { ...(phash as Partial<CardFingerprint>) };
  }

  let neuralEmbedding: number[] | undefined;
  let innerNeuralEmbedding: number[] | undefined;

  if (Array.isArray(embedding)) {
    neuralEmbedding = embedding;
  } else if (embedding && typeof embedding === 'object') {
    if (Array.isArray(embedding.neuralEmbedding)) {
      neuralEmbedding = embedding.neuralEmbedding;
    }
    if (Array.isArray(embedding.innerNeuralEmbedding)) {
      innerNeuralEmbedding = embedding.innerNeuralEmbedding;
    }
  }

  if (!base && !neuralEmbedding && !innerNeuralEmbedding) {
    return undefined;
  }

  return {
    rHash: typeof base?.rHash === 'string' ? base.rHash : '',
    gHash: typeof base?.gHash === 'string' ? base.gHash : '',
    bHash: typeof base?.bHash === 'string' ? base.bHash : '',
    edgeHash: typeof base?.edgeHash === 'string' ? base.edgeHash : '',
    spatialGrid: Array.isArray(base?.spatialGrid) ? base.spatialGrid : [],
    structuralVec: Array.isArray(base?.structuralVec) ? base.structuralVec : [],
    ...(base || {}),
    ...(neuralEmbedding ? { neuralEmbedding } : {}),
    ...(innerNeuralEmbedding ? { innerNeuralEmbedding } : {}),
    version: typeof base?.version === 'number' ? base.version : 1,
  };
}

export function cardItemToSupabaseRow(card: CardItem): SupabaseCardRow {
  const { phash, embedding } = splitFingerprintForSupabase(card.fingerprint);
  return {
    id: card.id,
    serial: Math.max(1, Math.round(card.serial)),
    name: card.name,
    category: card.category,
    price_bdt:
      typeof card.priceBdt === 'number' && Number.isFinite(card.priceBdt) && card.priceBdt > 0
        ? Math.round(card.priceBdt)
        : null,
    publish_status: card.publishStatus,
    stock_status: card.stockStatus,
    rarity: card.rarity,
    set_name: card.setName || 'Base Set',
    condition: card.condition || 'Near Mint',
    description: card.description ?? null,
    display_order: Math.round(card.sortOrder),
    image_url: card.imageUrl || '',
    phash,
    embedding,
    created_at: card.createdAt || new Date().toISOString(),
    updated_at: card.updatedAt || new Date().toISOString(),
  };
}

export function supabaseRowToCardItem(row: SupabaseCardRow): CardItem {
  const serial =
    typeof row.serial === 'number' && Number.isFinite(row.serial) && row.serial > 0
      ? Math.round(row.serial)
      : 1;
  const sortOrder =
    typeof row.display_order === 'number' && Number.isFinite(row.display_order)
      ? Math.round(row.display_order)
      : serial;

  return {
    id: String(row.id),
    serial,
    name: String(row.name || `Card #${serial}`),
    category: normalizeCategory(row.category),
    priceBdt:
      typeof row.price_bdt === 'number' && Number.isFinite(row.price_bdt) && row.price_bdt > 0
        ? Math.round(row.price_bdt)
        : null,
    publishStatus: normalizePublishStatus(row.publish_status),
    stockStatus: normalizeStockStatus(row.stock_status),
    sortOrder,
    setName: String(row.set_name || 'Base Set'),
    rarity: normalizeRarity(row.rarity),
    condition: normalizeCondition(row.condition),
    description: row.description ? String(row.description) : undefined,
    imageUrl: String(row.image_url || ''),
    fingerprint: combineFingerprintFromSupabase(row.phash, row.embedding),
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export function cardPatchToSupabasePatch(patch: Partial<CardItem>): Partial<SupabaseCardRow> {
  const out: Partial<SupabaseCardRow> = {};
  if (patch.serial !== undefined) out.serial = Math.max(1, Math.round(patch.serial));
  if (patch.name !== undefined) out.name = patch.name;
  if (patch.category !== undefined) out.category = patch.category;
  if (patch.priceBdt !== undefined) {
    out.price_bdt =
      typeof patch.priceBdt === 'number' && Number.isFinite(patch.priceBdt) && patch.priceBdt > 0
        ? Math.round(patch.priceBdt)
        : null;
  }
  if (patch.publishStatus !== undefined) out.publish_status = patch.publishStatus;
  if (patch.stockStatus !== undefined) out.stock_status = patch.stockStatus;
  if (patch.rarity !== undefined) out.rarity = patch.rarity;
  if (patch.setName !== undefined) out.set_name = patch.setName;
  if (patch.condition !== undefined) out.condition = patch.condition;
  if (patch.description !== undefined) out.description = patch.description ?? null;
  if (patch.sortOrder !== undefined) out.display_order = Math.round(patch.sortOrder);
  if (patch.imageUrl !== undefined) out.image_url = patch.imageUrl;
  if (patch.fingerprint !== undefined) {
    const { phash, embedding } = splitFingerprintForSupabase(patch.fingerprint);
    out.phash = phash;
    out.embedding = embedding;
  }
  out.updated_at = patch.updatedAt || new Date().toISOString();
  return out;
}

export function sortCardsCanonical(cards: readonly CardItem[]): CardItem[] {
  return [...cards].sort((a, b) => a.sortOrder - b.sortOrder || a.serial - b.serial);
}

export function mergeRealtimeCardEvent(
  current: readonly CardItem[],
  event: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    newRow?: SupabaseCardRow | null;
    oldId?: string | null;
  }
): CardItem[] {
  if (event.eventType === 'DELETE') {
    if (!event.oldId) return [...current];
    return sortCardsCanonical(current.filter((c) => c.id !== event.oldId));
  }

  if (!event.newRow || !event.newRow.id) return [...current];
  const incoming = supabaseRowToCardItem(event.newRow);
  const exists = current.some((c) => c.id === incoming.id);
  const next = exists
    ? current.map((c) => (c.id === incoming.id ? incoming : c))
    : [...current, incoming];
  return sortCardsCanonical(next);
}

export function isDataImageUrl(url: string): boolean {
  return /^data:image\/[a-zA-Z0-9+.-]+;base64,/i.test(url);
}

export function parseDataImageUrl(dataUrl: string): {
  mimeType: string;
  extension: string;
  bytes: Uint8Array;
} | null {
  const match = /^data:(image\/([a-zA-Z0-9+.-]+));base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) return null;

  const mimeType = match[1].toLowerCase();
  const subtype = match[2].toLowerCase();
  const base64 = match[3];
  const extension =
    subtype === 'webp'
      ? 'webp'
      : subtype === 'png'
        ? 'png'
        : subtype === 'svg+xml'
          ? 'svg'
          : 'jpg';

  let bytes: Uint8Array;
  if (typeof atob === 'function') {
    const bin = atob(base64);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
  } else {
    bytes = Uint8Array.from(Buffer.from(base64, 'base64'));
  }

  return { mimeType, extension, bytes };
}

export function extractStoragePathFromPublicUrl(
  imageUrl: string,
  bucket = 'card-images'
): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = imageUrl.indexOf(marker);
  if (idx === -1) return null;
  const raw = imageUrl.slice(idx + marker.length).split('?')[0];
  return raw ? decodeURIComponent(raw) : null;
}
