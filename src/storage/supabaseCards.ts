import { CARD_IMAGES_BUCKET, getSupabaseClient } from '../lib/supabase';
import type { CardItem } from '../types/card';
import {
  cardItemToSupabaseRow,
  cardPatchToSupabasePatch,
  extractStoragePathFromPublicUrl,
  isDataImageUrl,
  parseDataImageUrl,
  sortCardsCanonical,
  supabaseRowToCardItem,
  type SupabaseCardRow,
} from './supabaseSync';

const CARDS_TABLE = 'cards';
const PAGE_SIZE = 1000;
const UPSERT_BATCH_SIZE = 50;
const IMAGE_UPLOAD_CONCURRENCY = 6;

export async function fetchAllCardsFromSupabase(): Promise<CardItem[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const allRows: SupabaseCardRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(CARDS_TABLE)
      .select('*')
      .order('display_order', { ascending: true })
      .order('serial', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Supabase fetch failed: ${error.message}`);
    }

    const batch = (data as SupabaseCardRow[] | null) ?? [];
    allRows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return sortCardsCanonical(allRows.map(supabaseRowToCardItem));
}

export async function uploadCardImageToBucket(cardId: string, imageUrl: string): Promise<string> {
  if (!isDataImageUrl(imageUrl)) return imageUrl;

  const supabase = getSupabaseClient();
  if (!supabase) return imageUrl;

  const parsed = parseDataImageUrl(imageUrl);
  if (!parsed) return imageUrl;

  const safeId = cardId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const objectPath = `cards/${safeId}-${Date.now()}.${parsed.extension}`;
  const blobBytes = new Uint8Array(parsed.bytes.byteLength);
  blobBytes.set(parsed.bytes);
  const blob = new Blob([blobBytes], { type: parsed.mimeType });

  const { error: uploadError } = await supabase.storage
    .from(CARD_IMAGES_BUCKET)
    .upload(objectPath, blob, {
      contentType: parsed.mimeType,
      cacheControl: '31536000',
      upsert: true,
    });

  if (uploadError) {
    console.warn(
      `[FLEX Supabase] Failed uploading image to "${CARD_IMAGES_BUCKET}" bucket:`,
      uploadError.message
    );
    return imageUrl;
  }

  const { data } = supabase.storage.from(CARD_IMAGES_BUCKET).getPublicUrl(objectPath);
  return data.publicUrl || imageUrl;
}

async function prepareCardsWithBucketImages(cards: readonly CardItem[]): Promise<CardItem[]> {
  const result: CardItem[] = new Array(cards.length);
  let cursor = 0;

  async function worker() {
    while (cursor < cards.length) {
      const idx = cursor++;
      const card = cards[idx];
      if (card.imageUrl && isDataImageUrl(card.imageUrl)) {
        const publicUrl = await uploadCardImageToBucket(card.id, card.imageUrl);
        result[idx] = publicUrl !== card.imageUrl ? { ...card, imageUrl: publicUrl } : card;
      } else {
        result[idx] = card;
      }
    }
  }

  const workerCount = Math.min(IMAGE_UPLOAD_CONCURRENCY, cards.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return result;
}

export async function upsertCardToSupabase(card: CardItem): Promise<CardItem> {
  const supabase = getSupabaseClient();
  if (!supabase) return card;

  const [prepared] = await prepareCardsWithBucketImages([card]);
  const row = cardItemToSupabaseRow(prepared);

  const { error } = await supabase.from(CARDS_TABLE).upsert(row, { onConflict: 'id' });
  if (error) {
    throw new Error(`Supabase upsert failed: ${error.message}`);
  }
  return prepared;
}

export async function upsertManyCardsToSupabase(cards: readonly CardItem[]): Promise<CardItem[]> {
  if (cards.length === 0) return [];
  const supabase = getSupabaseClient();
  if (!supabase) return [...cards];

  const prepared = await prepareCardsWithBucketImages(cards);
  const rows = prepared.map(cardItemToSupabaseRow);

  for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
    const chunk = rows.slice(i, i + UPSERT_BATCH_SIZE);
    const { error } = await supabase.from(CARDS_TABLE).upsert(chunk, { onConflict: 'id' });
    if (error) {
      throw new Error(`Supabase bulk upsert failed: ${error.message}`);
    }
  }
  return prepared;
}

export async function patchCardInSupabase(id: string, patch: Partial<CardItem>): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const nextPatch = { ...patch };
  if (nextPatch.imageUrl && isDataImageUrl(nextPatch.imageUrl)) {
    nextPatch.imageUrl = await uploadCardImageToBucket(id, nextPatch.imageUrl);
  }

  const rowPatch = cardPatchToSupabasePatch(nextPatch);
  const { error } = await supabase.from(CARDS_TABLE).update(rowPatch).eq('id', id);
  if (error) {
    throw new Error(`Supabase update failed: ${error.message}`);
  }
}

export async function bulkPatchCardsInSupabase(
  ids: readonly string[],
  patch: Partial<CardItem>
): Promise<{ succeeded: number; failed: number }> {
  if (ids.length === 0) return { succeeded: 0, failed: 0 };
  const supabase = getSupabaseClient();
  if (!supabase) return { succeeded: ids.length, failed: 0 };

  const rowPatch = cardPatchToSupabasePatch(patch);
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { error } = await supabase.from(CARDS_TABLE).update(rowPatch).in('id', chunk);
    if (error) {
      failed += chunk.length;
    } else {
      succeeded += chunk.length;
    }
  }

  return { succeeded, failed };
}

export async function deleteCardFromSupabase(id: string, imageUrl?: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase.from(CARDS_TABLE).delete().eq('id', id);
  if (error) {
    throw new Error(`Supabase delete failed: ${error.message}`);
  }

  if (imageUrl) {
    const storagePath = extractStoragePathFromPublicUrl(imageUrl, CARD_IMAGES_BUCKET);
    if (storagePath) {
      await supabase.storage.from(CARD_IMAGES_BUCKET).remove([storagePath]).catch(() => {});
    }
  }
}

export async function replaceAllCardsInSupabase(cards: readonly CardItem[]): Promise<CardItem[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [...cards];

  const prepared = await upsertManyCardsToSupabase(cards);
  const keepIds = new Set(prepared.map((c) => c.id));

  const { data: existingRows, error: listError } = await supabase
    .from(CARDS_TABLE)
    .select('id, image_url');

  if (!listError && Array.isArray(existingRows)) {
    const stale = (existingRows as Array<{ id: string; image_url?: string }>).filter(
      (r) => !keepIds.has(r.id)
    );
    const staleIds = stale.map((r) => r.id);
    for (let i = 0; i < staleIds.length; i += 100) {
      await supabase
        .from(CARDS_TABLE)
        .delete()
        .in('id', staleIds.slice(i, i + 100));
    }

    const stalePaths = stale
      .map((r) => (r.image_url ? extractStoragePathFromPublicUrl(r.image_url, CARD_IMAGES_BUCKET) : null))
      .filter((p): p is string => Boolean(p));
    if (stalePaths.length > 0) {
      await supabase.storage.from(CARD_IMAGES_BUCKET).remove(stalePaths).catch(() => {});
    }
  }

  return prepared;
}

export function subscribeToRealtimeCards(handlers: {
  onUpsert: (card: CardItem) => void;
  onDelete: (id: string) => void;
}): () => void {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  const channel = supabase
    .channel(`flex-cards-realtime-${Math.random().toString(36).slice(2, 8)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: CARDS_TABLE },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          const oldRecord = payload.old as { id?: string } | null;
          if (oldRecord?.id) {
            handlers.onDelete(String(oldRecord.id));
          }
          return;
        }

        const newRecord = payload.new as SupabaseCardRow | null;
        if (newRecord?.id) {
          handlers.onUpsert(supabaseRowToCardItem(newRecord));
        }
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
