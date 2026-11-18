import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import type {
  CardCategory,
  CardItem,
  PublishStatus,
  StockStatus,
  TradeRequest,
} from '../types/card';
import { parseCatalogBundle } from '../utils/catalogHelpers';
import { computeCardFingerprint, extractInnerArtworkDataUrl } from '../vision/perceptualHash';
import { computeNeuralEmbeddingWithTimeout, warmupNeuralWorker } from '../vision/scannerPipeline';
import {
  dbDeleteCard,
  dbGetAllCards,
  dbGetMeta,
  dbGetTradeRequests,
  dbPutCard,
  dbPutManyCards,
  dbPutTradeRequest,
  dbReplaceAllCards,
  dbSetMeta,
} from './indexedDb';
import {
  bulkPatchCardsInSupabase,
  deleteCardFromSupabase,
  fetchAllCardsFromSupabase,
  patchCardInSupabase,
  replaceAllCardsInSupabase,
  subscribeToRealtimeCards,
  upsertCardToSupabase,
  upsertManyCardsToSupabase,
} from './supabaseCards';
import { sortCardsCanonical } from './supabaseSync';

const WISHLIST_STORAGE_KEY = 'flex_wishlist_ids_v1';

interface CatalogContextValue {
  cards: CardItem[];
  publishedCards: CardItem[];
  tradeRequests: TradeRequest[];
  wishlistIds: string[];
  loading: boolean;
  fingerprintingProgress: { done: number; total: number } | null;
  addCard: (card: CardItem) => Promise<void>;
  addManyCards: (newCards: CardItem[]) => Promise<void>;
  updateCard: (id: string, patch: Partial<CardItem>) => Promise<void>;
  bulkUpdateCards: (ids: string[], patch: Partial<CardItem>) => Promise<{ succeeded: number; failed: number }>;
  moveCardOrder: (id: string, direction: 'up' | 'down') => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  replaceCatalog: (importedCards: CardItem[]) => Promise<void>;
  resetToSeedCatalog: () => Promise<void>;
  toggleWishlist: (id: string) => void;
  isWishlisted: (id: string) => boolean;
  submitTradeRequest: (req: TradeRequest) => Promise<void>;
  updateTradeStatus: (id: string, status: TradeRequest['status']) => Promise<void>;
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

function upsertCardIntoList(list: readonly CardItem[], incoming: CardItem): CardItem[] {
  const exists = list.some((c) => c.id === incoming.id);
  const next = exists
    ? list.map((c) => (c.id === incoming.id ? incoming : c))
    : [...list, incoming];
  return sortCardsCanonical(next);
}

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [tradeRequests, setTradeRequests] = useState<TradeRequest[]>([]);
  const cardsRef = useRef<CardItem[]>([]);
  const tradesRef = useRef<TradeRequest[]>([]);
  cardsRef.current = cards;
  tradesRef.current = tradeRequests;

  const [wishlistIds, setWishlistIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(WISHLIST_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(true);
  const [fingerprintingProgress, setFingerprintingProgress] = useState<{ done: number; total: number } | null>(null);
  const indexingRef = useRef(false);
  const attemptedFingerprintIdsRef = useRef<Set<string>>(new Set());

  const loadSeedCatalog = useCallback(async (): Promise<CardItem[]> => {
    try {
      const res = await fetch('/catalog.json', { cache: 'no-cache' });
      if (!res.ok) return [];
      const text = await res.text();
      return parseCatalogBundle(text);
    } catch {
      return [];
    }
  }, []);

  // Hydrate catalog from Supabase (with live multi-device sync) or automatic IndexedDB fallback
  useEffect(() => {
    let active = true;
    const supabaseEnabled = isSupabaseConfigured();

    const hydrateFromLocal = async (): Promise<CardItem[]> => {
      const [storedCards, initialized] = await Promise.all([
        dbGetAllCards(),
        dbGetMeta<boolean>('catalog_initialized_v1'),
      ]);
      let initialCards = storedCards;
      if (!initialized && storedCards.length === 0) {
        initialCards = await loadSeedCatalog();
        if (initialCards.length > 0) {
          await dbPutManyCards(initialCards);
          await dbSetMeta('catalog_initialized_v1', true);
        }
      }
      return sortCardsCanonical(initialCards);
    };

    (async () => {
      try {
        const storedTradesPromise = dbGetTradeRequests();
        let initialCards: CardItem[] = [];

        if (supabaseEnabled) {
          try {
            let remoteCards = await fetchAllCardsFromSupabase();
            if (remoteCards.length === 0) {
              const seededRemote = await dbGetMeta<boolean>('supabase_seeded_v1');
              if (!seededRemote) {
                const seedCards = await loadSeedCatalog();
                if (seedCards.length > 0) {
                  remoteCards = await upsertManyCardsToSupabase(seedCards);
                  await dbSetMeta('supabase_seeded_v1', true);
                }
              }
            } else {
              await dbSetMeta('supabase_seeded_v1', true);
            }
            initialCards = sortCardsCanonical(remoteCards);
            await dbReplaceAllCards(initialCards);
            await dbSetMeta('catalog_initialized_v1', true);
          } catch (err) {
            console.warn(
              '[FLEX Supabase] Falling back to IndexedDB cache:',
              err instanceof Error ? err.message : err
            );
            initialCards = await hydrateFromLocal();
          }
        } else {
          initialCards = await hydrateFromLocal();
        }

        const storedTrades = await storedTradesPromise;
        if (!active) return;

        cardsRef.current = initialCards;
        setCards(initialCards);
        setTradeRequests(
          [...storedTrades].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        );
      } finally {
        if (active) setLoading(false);
      }
    })();

    // Warm up Transformers.js Web Worker silently in the background
    warmupNeuralWorker();

    if (!supabaseEnabled) {
      return () => {
        active = false;
      };
    }

    const unsubscribeRealtime = subscribeToRealtimeCards({
      onUpsert: (incomingCard) => {
        if (!active) return;
        const next = upsertCardIntoList(cardsRef.current, incomingCard);
        cardsRef.current = next;
        setCards(next);
        void dbPutCard(incomingCard);
      },
      onDelete: (deletedId) => {
        if (!active) return;
        const next = cardsRef.current.filter((c) => c.id !== deletedId);
        cardsRef.current = next;
        setCards(next);
        void dbDeleteCard(deletedId);
      },
    });

    const handleVisibilitySync = () => {
      if (document.visibilityState !== 'visible') return;
      void fetchAllCardsFromSupabase()
        .then((remoteCards) => {
          if (!active) return;
          const sorted = sortCardsCanonical(remoteCards);
          cardsRef.current = sorted;
          setCards(sorted);
          void dbReplaceAllCards(sorted);
        })
        .catch(() => {
          // keep current view if transient offline
        });
    };

    document.addEventListener('visibilitychange', handleVisibilitySync);

    return () => {
      active = false;
      unsubscribeRealtime();
      document.removeEventListener('visibilitychange', handleVisibilitySync);
    };
  }, [loadSeedCatalog]);

  // Background v3 fingerprint pre-indexing for any cards missing v3 multi-region fingerprints
  useEffect(() => {
    if (loading || indexingRef.current || cards.length === 0) return;
    const missing = cards.filter(
      (c) =>
        c.imageUrl &&
        (!c.fingerprint || c.fingerprint.version < 3) &&
        !attemptedFingerprintIdsRef.current.has(c.id)
    );
    if (missing.length === 0) return;

    indexingRef.current = true;
    let cancelled = false;

    (async () => {
      setFingerprintingProgress({ done: 0, total: missing.length });
      const updatedBatch: CardItem[] = [];
      const supabaseEnabled = isSupabaseConfigured();

      for (let i = 0; i < missing.length; i++) {
        if (cancelled) break;
        const card = missing[i];
        attemptedFingerprintIdsRef.current.add(card.id);
        try {
          const fp = await computeCardFingerprint(card.imageUrl);
          // Optionally attach full + inner CLIP embeddings if worker is warm (quick non-blocking check)
          const [neural, innerUrl] = await Promise.all([
            computeNeuralEmbeddingWithTimeout(card.imageUrl, 320),
            extractInnerArtworkDataUrl(card.imageUrl).catch(() => ''),
          ]);
          if (neural) {
            fp.neuralEmbedding = neural;
          }
          if (innerUrl) {
            const innerNeural = await computeNeuralEmbeddingWithTimeout(innerUrl, 320);
            if (innerNeural) {
              fp.innerNeuralEmbedding = innerNeural;
            }
          }
          const updated: CardItem = { ...card, fingerprint: fp };
          updatedBatch.push(updated);
          await dbPutCard(updated);
          if (supabaseEnabled) {
            await patchCardInSupabase(card.id, {
              fingerprint: fp,
              updatedAt: card.updatedAt,
            }).catch(() => {});
          }
        } catch {
          // continue indexing remaining cards
        }
        if (!cancelled) {
          setFingerprintingProgress({ done: i + 1, total: missing.length });
        }
      }

      if (!cancelled && updatedBatch.length > 0) {
        const map = new Map(updatedBatch.map((c) => [c.id, c]));
        setCards((prev) => prev.map((c) => map.get(c.id) || c));
      }
      if (!cancelled) {
        setFingerprintingProgress(null);
      }
      indexingRef.current = false;
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, cards]);

  const publishedCards = useMemo(
    () =>
      cards
        .filter((c) => c.publishStatus === 'published')
        .sort((a, b) => a.sortOrder - b.sortOrder || a.serial - b.serial),
    [cards]
  );

  const addCard = useCallback(async (card: CardItem) => {
    const optimistic = upsertCardIntoList(cardsRef.current, card);
    cardsRef.current = optimistic;
    setCards(optimistic);
    await dbPutCard(card);
    await dbSetMeta('catalog_initialized_v1', true);

    if (isSupabaseConfigured()) {
      try {
        const saved = await upsertCardToSupabase(card);
        if (saved.imageUrl !== card.imageUrl) {
          const synced = upsertCardIntoList(cardsRef.current, saved);
          cardsRef.current = synced;
          setCards(synced);
          await dbPutCard(saved);
        }
      } catch (err) {
        console.error('[FLEX Supabase] addCard sync failed:', err);
      }
    }
  }, []);

  const addManyCards = useCallback(async (newCards: CardItem[]) => {
    if (newCards.length === 0) return;
    const optimistic = sortCardsCanonical([...cardsRef.current, ...newCards]);
    cardsRef.current = optimistic;
    setCards(optimistic);
    await dbPutManyCards(newCards);
    await dbSetMeta('catalog_initialized_v1', true);

    if (isSupabaseConfigured()) {
      try {
        const savedList = await upsertManyCardsToSupabase(newCards);
        const savedMap = new Map(savedList.map((c) => [c.id, c]));
        const synced = sortCardsCanonical(
          cardsRef.current.map((c) => savedMap.get(c.id) || c)
        );
        cardsRef.current = synced;
        setCards(synced);
        await dbPutManyCards(savedList);
      } catch (err) {
        console.error('[FLEX Supabase] addManyCards sync failed:', err);
      }
    }
  }, []);

  const updateCard = useCallback(async (id: string, patch: Partial<CardItem>) => {
    const existing = cardsRef.current.find((c) => c.id === id);
    if (!existing) return;
    const updatedItem: CardItem = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    const nextCards = sortCardsCanonical(
      cardsRef.current.map((c) => (c.id === id ? updatedItem : c))
    );
    cardsRef.current = nextCards;
    setCards(nextCards);
    await dbPutCard(updatedItem);

    if (isSupabaseConfigured()) {
      try {
        await patchCardInSupabase(id, { ...patch, updatedAt: updatedItem.updatedAt });
      } catch (err) {
        console.error('[FLEX Supabase] updateCard sync failed:', err);
      }
    }
  }, []);

  const bulkUpdateCards = useCallback(
    async (ids: string[], patch: Partial<CardItem>): Promise<{ succeeded: number; failed: number }> => {
      if (ids.length === 0) return { succeeded: 0, failed: 0 };
      const idSet = new Set(ids);
      const changed: CardItem[] = [];
      const now = new Date().toISOString();

      const nextCards = sortCardsCanonical(
        cardsRef.current.map((c) => {
          if (!idSet.has(c.id)) return c;
          const next: CardItem = { ...c, ...patch, updatedAt: now };
          changed.push(next);
          return next;
        })
      );
      cardsRef.current = nextCards;
      setCards(nextCards);

      await dbPutManyCards(changed);

      if (isSupabaseConfigured()) {
        return bulkPatchCardsInSupabase(ids, { ...patch, updatedAt: now });
      }
      return { succeeded: changed.length, failed: ids.length - changed.length };
    },
    []
  );

  const moveCardOrder = useCallback(async (id: string, direction: 'up' | 'down') => {
    const sorted = sortCardsCanonical(cardsRef.current);
    const idx = sorted.findIndex((c) => c.id === id);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const current = sorted[idx];
    const neighbor = sorted[swapIdx];
    const tempOrder = current.sortOrder;
    const now = new Date().toISOString();
    const updatedCurrent: CardItem = {
      ...current,
      sortOrder:
        neighbor.sortOrder === current.sortOrder
          ? direction === 'up'
            ? current.sortOrder - 1
            : current.sortOrder + 1
          : neighbor.sortOrder,
      updatedAt: now,
    };
    const updatedNeighbor: CardItem = {
      ...neighbor,
      sortOrder: tempOrder,
      updatedAt: now,
    };
    sorted[idx] = updatedNeighbor;
    sorted[swapIdx] = updatedCurrent;

    const canonical = sortCardsCanonical(sorted);
    cardsRef.current = canonical;
    setCards(canonical);
    await dbPutManyCards([updatedCurrent, updatedNeighbor]);

    if (isSupabaseConfigured()) {
      try {
        await Promise.all([
          patchCardInSupabase(updatedCurrent.id, {
            sortOrder: updatedCurrent.sortOrder,
            updatedAt: now,
          }),
          patchCardInSupabase(updatedNeighbor.id, {
            sortOrder: updatedNeighbor.sortOrder,
            updatedAt: now,
          }),
        ]);
      } catch (err) {
        console.error('[FLEX Supabase] moveCardOrder sync failed:', err);
      }
    }
  }, []);

  const deleteCard = useCallback(async (id: string) => {
    const existing = cardsRef.current.find((c) => c.id === id);
    const next = cardsRef.current.filter((c) => c.id !== id);
    cardsRef.current = next;
    setCards(next);
    await dbDeleteCard(id);

    if (isSupabaseConfigured()) {
      try {
        await deleteCardFromSupabase(id, existing?.imageUrl);
      } catch (err) {
        console.error('[FLEX Supabase] deleteCard sync failed:', err);
      }
    }
  }, []);

  const replaceCatalog = useCallback(async (importedCards: CardItem[]) => {
    const sorted = sortCardsCanonical(importedCards);
    cardsRef.current = sorted;
    setCards(sorted);
    await dbReplaceAllCards(sorted);
    await dbSetMeta('catalog_initialized_v1', true);

    if (isSupabaseConfigured()) {
      try {
        const synced = sortCardsCanonical(await replaceAllCardsInSupabase(sorted));
        cardsRef.current = synced;
        setCards(synced);
        await dbReplaceAllCards(synced);
        await dbSetMeta('supabase_seeded_v1', true);
      } catch (err) {
        console.error('[FLEX Supabase] replaceCatalog sync failed:', err);
      }
    }
  }, []);

  const resetToSeedCatalog = useCallback(async () => {
    const seeded = sortCardsCanonical(await loadSeedCatalog());
    cardsRef.current = seeded;
    setCards(seeded);
    await dbReplaceAllCards(seeded);
    await dbSetMeta('catalog_initialized_v1', true);

    if (isSupabaseConfigured()) {
      try {
        const synced = sortCardsCanonical(await replaceAllCardsInSupabase(seeded));
        cardsRef.current = synced;
        setCards(synced);
        await dbReplaceAllCards(synced);
        await dbSetMeta('supabase_seeded_v1', true);
      } catch (err) {
        console.error('[FLEX Supabase] resetToSeedCatalog sync failed:', err);
      }
    }
  }, [loadSeedCatalog]);

  const toggleWishlist = useCallback((id: string) => {
    setWishlistIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const isWishlisted = useCallback((id: string) => wishlistIds.includes(id), [wishlistIds]);

  const submitTradeRequest = useCallback(async (req: TradeRequest) => {
    setTradeRequests((prev) => [req, ...prev]);
    await dbPutTradeRequest(req);
  }, []);

  const updateTradeStatus = useCallback(async (id: string, status: TradeRequest['status']) => {
    const existing = tradesRef.current.find((item) => item.id === id);
    if (!existing) return;
    const target: TradeRequest = { ...existing, status };
    const nextTrades = tradesRef.current.map((item) => (item.id === id ? target : item));
    tradesRef.current = nextTrades;
    setTradeRequests(nextTrades);
    await dbPutTradeRequest(target);
  }, []);

  const value = useMemo<CatalogContextValue>(
    () => ({
      cards,
      publishedCards,
      tradeRequests,
      wishlistIds,
      loading,
      fingerprintingProgress,
      addCard,
      addManyCards,
      updateCard,
      bulkUpdateCards,
      moveCardOrder,
      deleteCard,
      replaceCatalog,
      resetToSeedCatalog,
      toggleWishlist,
      isWishlisted,
      submitTradeRequest,
      updateTradeStatus,
    }),
    [
      cards,
      publishedCards,
      tradeRequests,
      wishlistIds,
      loading,
      fingerprintingProgress,
      addCard,
      addManyCards,
      updateCard,
      bulkUpdateCards,
      moveCardOrder,
      deleteCard,
      replaceCatalog,
      resetToSeedCatalog,
      toggleWishlist,
      isWishlisted,
      submitTradeRequest,
      updateTradeStatus,
    ]
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogContextValue {
  const ctx = useContext(CatalogContext);
  if (!ctx) {
    throw new Error('useCatalog must be used inside CatalogProvider');
  }
  return ctx;
}

export type { CardCategory, PublishStatus, StockStatus };
