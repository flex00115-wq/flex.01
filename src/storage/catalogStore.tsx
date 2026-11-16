import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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

  // Hydrate catalog from IndexedDB or public/catalog.json
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [storedCards, storedTrades, initialized] = await Promise.all([
          dbGetAllCards(),
          dbGetTradeRequests(),
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

        if (!active) return;
        setCards(
          [...initialCards].sort((a, b) => a.sortOrder - b.sortOrder || a.serial - b.serial)
        );
        setTradeRequests(
          [...storedTrades].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        );
      } finally {
        if (active) setLoading(false);
      }
    })();

    // Warm up Transformers.js Web Worker silently in the background
    warmupNeuralWorker();

    return () => {
      active = false;
    };
  }, [loadSeedCatalog]);

  // Background v3 fingerprint pre-indexing for any cards missing v3 multi-region fingerprints
  useEffect(() => {
    if (loading || indexingRef.current || cards.length === 0) return;
    const missing = cards.filter((c) => c.imageUrl && (!c.fingerprint || c.fingerprint.version < 3));
    if (missing.length === 0) return;

    indexingRef.current = true;
    let cancelled = false;

    (async () => {
      setFingerprintingProgress({ done: 0, total: missing.length });
      const updatedBatch: CardItem[] = [];

      for (let i = 0; i < missing.length; i++) {
        if (cancelled) break;
        const card = missing[i];
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
    setCards((prev) =>
      [...prev, card].sort((a, b) => a.sortOrder - b.sortOrder || a.serial - b.serial)
    );
    await dbPutCard(card);
    await dbSetMeta('catalog_initialized_v1', true);
  }, []);

  const addManyCards = useCallback(async (newCards: CardItem[]) => {
    if (newCards.length === 0) return;
    setCards((prev) =>
      [...prev, ...newCards].sort((a, b) => a.sortOrder - b.sortOrder || a.serial - b.serial)
    );
    await dbPutManyCards(newCards);
    await dbSetMeta('catalog_initialized_v1', true);
  }, []);

  const updateCard = useCallback(async (id: string, patch: Partial<CardItem>) => {
    const existing = cardsRef.current.find((c) => c.id === id);
    if (!existing) return;
    const updatedItem: CardItem = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    const nextCards = cardsRef.current
      .map((c) => (c.id === id ? updatedItem : c))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.serial - b.serial);
    cardsRef.current = nextCards;
    setCards(nextCards);
    await dbPutCard(updatedItem);
  }, []);

  const bulkUpdateCards = useCallback(
    async (ids: string[], patch: Partial<CardItem>): Promise<{ succeeded: number; failed: number }> => {
      if (ids.length === 0) return { succeeded: 0, failed: 0 };
      const idSet = new Set(ids);
      const changed: CardItem[] = [];
      const now = new Date().toISOString();

      const nextCards = cardsRef.current.map((c) => {
        if (!idSet.has(c.id)) return c;
        const next: CardItem = { ...c, ...patch, updatedAt: now };
        changed.push(next);
        return next;
      });
      cardsRef.current = nextCards;
      setCards(nextCards);

      await dbPutManyCards(changed);
      return { succeeded: changed.length, failed: ids.length - changed.length };
    },
    []
  );

  const moveCardOrder = useCallback(async (id: string, direction: 'up' | 'down') => {
    const sorted = [...cardsRef.current].sort((a, b) => a.sortOrder - b.sortOrder || a.serial - b.serial);
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

    cardsRef.current = sorted;
    setCards(sorted);
    await dbPutManyCards([updatedCurrent, updatedNeighbor]);
  }, []);

  const deleteCard = useCallback(async (id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
    await dbDeleteCard(id);
  }, []);

  const replaceCatalog = useCallback(async (importedCards: CardItem[]) => {
    const sorted = [...importedCards].sort((a, b) => a.sortOrder - b.sortOrder || a.serial - b.serial);
    setCards(sorted);
    await dbReplaceAllCards(sorted);
    await dbSetMeta('catalog_initialized_v1', true);
  }, []);

  const resetToSeedCatalog = useCallback(async () => {
    const seeded = await loadSeedCatalog();
    setCards(seeded);
    await dbReplaceAllCards(seeded);
    await dbSetMeta('catalog_initialized_v1', true);
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
