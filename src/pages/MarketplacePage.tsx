import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react';
import { CardTile } from '../components/CardTile';
import { CARD_CATEGORIES } from '../config/store';
import { useCatalog } from '../storage/catalogStore';
import type { CardCategory, CardItem, CardRarity, StockStatus } from '../types/card';
import { filterPublishedCards } from '../utils/catalogHelpers';

interface MarketplacePageProps {
  initialCategory?: string | null;
  focusSearch?: boolean;
  initialWishlistOnly?: boolean;
  onOrderCard: (card: CardItem) => void;
}

const RARITIES: readonly (CardRarity | 'All')[] = [
  'All',
  'Common',
  'Rare',
  'Holo Rare',
  'Ultra Rare',
  'Secret Gold',
  'Mythic',
];

const PAGE_SIZE = 24;

export function MarketplacePage({
  initialCategory,
  focusSearch,
  initialWishlistOnly,
  onOrderCard,
}: MarketplacePageProps) {
  const { cards, wishlistIds, isWishlisted, toggleWishlist } = useCatalog();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CardCategory | 'All'>(() =>
    CARD_CATEGORIES.includes(initialCategory as CardCategory)
      ? (initialCategory as CardCategory)
      : 'All'
  );
  const [stock, setStock] = useState<StockStatus | 'All'>('All');
  const [rarity, setRarity] = useState<CardRarity | 'All'>('All');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState<'serial_asc' | 'price_asc' | 'price_desc' | 'newest'>('serial_asc');
  const [wishlistOnly, setWishlistOnly] = useState(Boolean(initialWishlistOnly));
  const [page, setPage] = useState(1);

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (initialCategory && CARD_CATEGORIES.includes(initialCategory as CardCategory)) {
      setCategory(initialCategory as CardCategory);
      setPage(1);
    } else if (initialCategory === null) {
      setCategory('All');
    }
  }, [initialCategory]);

  useEffect(() => {
    setWishlistOnly(Boolean(initialWishlistOnly));
  }, [initialWishlistOnly]);

  useEffect(() => {
    if (focusSearch) {
      searchInputRef.current?.focus();
    }
  }, [focusSearch]);

  const filtered = useMemo(() => {
    const base = filterPublishedCards(cards, {
      query,
      category,
      stock,
      rarity,
      minPrice: minPrice ? Number(minPrice) : null,
      maxPrice: maxPrice ? Number(maxPrice) : null,
      sortBy,
    });
    if (wishlistOnly) {
      return base.filter((c) => wishlistIds.includes(c.id));
    }
    return base;
  }, [cards, query, category, stock, rarity, minPrice, maxPrice, sortBy, wishlistOnly, wishlistIds]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage]
  );

  const resetFilters = () => {
    setQuery('');
    setCategory('All');
    setStock('All');
    setRarity('All');
    setMinPrice('');
    setMaxPrice('');
    setWishlistOnly(false);
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#22D3EE]">
            FLEX Bangladesh Catalog · Prices in BDT (৳)
          </p>
          <h1 className="mt-1 font-display text-3xl sm:text-4xl font-extrabold text-white">
            {wishlistOnly ? 'Saved Wishlist Cards' : 'Trading Card Marketplace'}
          </h1>
        </div>

        <button
          type="button"
          onClick={() => {
            setWishlistOnly((v) => !v);
            setPage(1);
          }}
          className={`inline-flex items-center gap-2 self-start rounded-xl border px-4 py-2 text-xs sm:text-sm font-semibold transition-colors ${
            wishlistOnly
              ? 'border-[#FACC15] bg-[#FACC15] text-[#0B0917]'
              : 'border-[#231E3D] bg-[#131024] text-slate-200 hover:border-slate-500'
          }`}
        >
          <Bookmark className={`h-4 w-4 ${wishlistOnly ? 'fill-current' : ''}`} aria-hidden="true" />
          <span>Saved Cards ({wishlistIds.length})</span>
        </button>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {(['All', ...CARD_CATEGORIES] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => {
              setCategory(cat);
              setPage(1);
            }}
            className={`rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
              category === cat
                ? 'bg-[#FACC15] text-[#0B0917]'
                : 'border border-[#231E3D] bg-[#131024] text-slate-300 hover:text-white'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Search & Filter Bar */}
      <div className="rounded-2xl border border-[#231E3D] bg-[#131024] p-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="relative md:col-span-5">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search English / বাংলা name or #serial..."
              aria-label="Search cards by English or Bengali name or serial"
              className="w-full rounded-xl border border-[#231E3D] bg-[#0B0917] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-[#22D3EE] focus:outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <select
              value={stock}
              onChange={(e) => {
                setStock(e.target.value as StockStatus | 'All');
                setPage(1);
              }}
              aria-label="Filter by stock status"
              className="w-full rounded-xl border border-[#231E3D] bg-[#0B0917] px-3 py-2.5 text-sm text-slate-200 focus:border-[#22D3EE] focus:outline-none"
            >
              <option value="All">All stock</option>
              <option value="available">Available</option>
              <option value="sold">Sold</option>
              <option value="out_of_stock">Out of stock</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={rarity}
              onChange={(e) => {
                setRarity(e.target.value as CardRarity | 'All');
                setPage(1);
              }}
              aria-label="Filter by rarity"
              className="w-full rounded-xl border border-[#231E3D] bg-[#0B0917] px-3 py-2.5 text-sm text-slate-200 focus:border-[#22D3EE] focus:outline-none"
            >
              {RARITIES.map((r) => (
                <option key={r} value={r}>
                  {r === 'All' ? 'All rarities' : r}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              aria-label="Sort cards"
              className="w-full rounded-xl border border-[#231E3D] bg-[#0B0917] px-3 py-2.5 text-sm text-slate-200 focus:border-[#22D3EE] focus:outline-none"
            >
              <option value="serial_asc">Order: Serial #1 →</option>
              <option value="price_asc">Price: Low to High (৳)</option>
              <option value="price_desc">Price: High to Low (৳)</option>
              <option value="newest">Newest Serial First</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            <span>Price (৳):</span>
            <input
              type="number"
              min={0}
              value={minPrice}
              onChange={(e) => {
                setMinPrice(e.target.value);
                setPage(1);
              }}
              placeholder="Min ৳"
              aria-label="Minimum price in BDT"
              className="w-24 rounded-lg border border-[#231E3D] bg-[#0B0917] px-2.5 py-1.5 text-xs text-white focus:border-[#22D3EE] focus:outline-none"
            />
            <span>–</span>
            <input
              type="number"
              min={0}
              value={maxPrice}
              onChange={(e) => {
                setMaxPrice(e.target.value);
                setPage(1);
              }}
              placeholder="Max ৳"
              aria-label="Maximum price in BDT"
              className="w-24 rounded-lg border border-[#231E3D] bg-[#0B0917] px-2.5 py-1.5 text-xs text-white focus:border-[#22D3EE] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="font-mono-num">
              {filtered.length} {filtered.length === 1 ? 'card' : 'cards'} matched
            </span>
            {(query || category !== 'All' || stock !== 'All' || rarity !== 'All' || minPrice || maxPrice || wishlistOnly) && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 text-[#22D3EE] hover:underline"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results Grid */}
      {paginated.length === 0 ? (
        <div className="rounded-2xl border border-[#231E3D] bg-[#131024] p-12 text-center space-y-3">
          <p className="font-display text-lg font-bold text-white">No cards match your filters</p>
          <p className="text-sm text-slate-400">
            Try clearing your search query or switching to All categories.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center rounded-xl bg-[#FACC15] px-4 py-2 text-xs font-bold text-[#0B0917]"
          >
            Show All Cards
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {paginated.map((card) => (
            <CardTile
              key={card.id}
              card={card}
              wishlisted={isWishlisted(card.id)}
              onToggleWishlist={toggleWishlist}
              onOrder={onOrderCard}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-[#231E3D] pt-6 text-sm text-slate-300">
          <span className="font-mono-num text-xs text-slate-400">
            Page {safePage} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-[#231E3D] bg-[#131024] px-3 py-2 text-xs font-semibold disabled:opacity-40 hover:border-slate-500"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              <span>Previous</span>
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-[#231E3D] bg-[#131024] px-3 py-2 text-xs font-semibold disabled:opacity-40 hover:border-slate-500"
            >
              <span>Next</span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
