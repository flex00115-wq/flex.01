import React, { useMemo } from 'react';
import { ArrowRight, Camera, Upload } from 'lucide-react';
import { CardTile } from '../components/CardTile';
import { CategoryArtwork } from '../components/CategoryArtwork';
import { CARD_CATEGORIES, CATEGORY_META, STORE_CONFIG } from '../config/store';
import { navigateTo } from '../hooks/useRouter';
import { useCatalog } from '../storage/catalogStore';
import type { CardItem } from '../types/card';

interface HomePageProps {
  onOrderCard: (card: CardItem) => void;
}

export function HomePage({ onOrderCard }: HomePageProps) {
  const { publishedCards, isWishlisted, toggleWishlist } = useCatalog();

  // Pick 1 featured published card per category for the 5-card fanned hero showcase
  const fannedCards = useMemo(() => {
    const picks: CardItem[] = [];
    for (const cat of CARD_CATEGORIES) {
      const match = publishedCards.find((c) => c.category === cat);
      if (match) picks.push(match);
    }
    if (picks.length < 5) {
      for (const c of publishedCards) {
        if (!picks.some((p) => p.id === c.id)) {
          picks.push(c);
          if (picks.length >= 5) break;
        }
      }
    }
    return picks.slice(0, 5);
  }, [publishedCards]);

  const featuredCards = useMemo(() => publishedCards.slice(0, 8), [publishedCards]);

  const fanTransforms = [
    '-rotate-12 translate-y-4 z-10',
    '-rotate-6 translate-y-1.5 z-20',
    'rotate-0 -translate-y-1 z-30',
    'rotate-6 translate-y-1.5 z-20',
    'rotate-12 translate-y-4 z-10',
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 space-y-16">
      {/* Hero Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 items-center gap-10 lg:gap-10 pt-2">
        <div className="lg:col-span-6 lg:pr-4 space-y-6">
          <p className="text-xs sm:text-sm font-semibold tracking-wide text-[#22D3EE]">
            {STORE_CONFIG.eyebrow}
          </p>

          <h1 className="font-display text-4xl sm:text-5xl xl:text-[54px] font-extrabold tracking-tight leading-[1.08] text-white [text-wrap:balance]">
            {STORE_CONFIG.tagline}
          </h1>

          <p className="max-w-md text-base sm:text-lg leading-relaxed text-slate-300">
            Discover your favorite cards. Build your collection. Trade with collectors across Bangladesh.
          </p>

          {/* 3 Primary Hero Action Buttons + Secondary */}
          <div className="space-y-3 pt-1">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => navigateTo('/scan?mode=camera')}
                className="inline-flex items-center gap-2 rounded-xl bg-[#22D3EE] px-4 py-3 text-sm font-bold text-[#06202A] hover:bg-[#67E8F9] transition-colors whitespace-nowrap shrink-0 shadow-lg shadow-[#22D3EE]/15"
              >
                <Camera className="h-4 w-4" aria-hidden="true" />
                <span>Capture / Scan Card</span>
              </button>

              <button
                type="button"
                onClick={() => navigateTo('/scan?mode=upload')}
                className="inline-flex items-center gap-2 rounded-xl border border-[#A855F7]/50 bg-[#A855F7]/20 px-4 py-3 text-sm font-bold text-purple-100 hover:bg-[#A855F7]/35 transition-colors whitespace-nowrap shrink-0"
              >
                <Upload className="h-4 w-4 text-[#C084FC]" aria-hidden="true" />
                <span>Upload Card</span>
              </button>

              <button
                type="button"
                onClick={() => navigateTo('/marketplace')}
                className="inline-flex items-center gap-2 rounded-xl bg-[#FACC15] px-5 py-3 text-sm font-bold text-[#0B0917] hover:bg-[#FDE047] transition-colors whitespace-nowrap shrink-0 shadow-lg shadow-[#FACC15]/15"
              >
                <span>Explore Cards</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div>
              <button
                type="button"
                onClick={() => navigateTo('/trade')}
                className="inline-flex items-center gap-2 rounded-xl border border-[#231E3D] bg-[#131024] px-4 py-2.5 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:text-white transition-colors whitespace-nowrap"
              >
                <span>Sell / Trade Your Cards</span>
              </button>
            </div>
          </div>
        </div>

        {/* Fanned 5-Card Showcase */}
        <div className="lg:col-span-6 flex items-center justify-center lg:justify-end py-6">
          <div className="relative flex items-center justify-center -space-x-10 sm:-space-x-12 lg:-space-x-14 pr-2">
            {fannedCards.map((card, index) => (
              <button
                key={card.id}
                type="button"
                onClick={() => navigateTo(`/card/${encodeURIComponent(card.id)}`)}
                aria-label={`Inspect ${card.name}`}
                className={`group relative h-40 w-28 sm:h-48 sm:w-34 xl:h-52 xl:w-36 overflow-hidden rounded-2xl border-2 border-white/20 bg-[#131024] shadow-2xl transition-all duration-200 hover:-translate-y-3 hover:z-40 hover:border-[#FACC15] ${fanTransforms[index] || ''}`}
              >
                <img
                  src={card.imageUrl}
                  alt={card.name}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Browse by Category — 5 Exact Worlds */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
              Browse by Category
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Five dedicated worlds, each curated and priced in Bangladeshi Taka (৳).
            </p>
          </div>
          <a
            href="/categories"
            onClick={(e) => {
              e.preventDefault();
              navigateTo('/categories');
            }}
            className="text-sm font-semibold text-[#22D3EE] hover:text-[#67E8F9] transition-colors whitespace-nowrap"
          >
            View all categories →
          </a>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {CARD_CATEGORIES.map((category) => {
            const meta = CATEGORY_META[category];
            const catCards = publishedCards.filter((c) => c.category === category);
            return (
              <button
                key={category}
                type="button"
                onClick={() => navigateTo(`/marketplace?category=${encodeURIComponent(category)}`)}
                className={`group flex flex-col justify-between rounded-2xl border bg-gradient-to-b ${meta.gradientBg} ${meta.borderClass} p-4 text-left transition-all duration-200 hover:-translate-y-1`}
              >
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <h3
                      className="font-display text-base sm:text-[17px] font-bold whitespace-nowrap"
                      style={{ color: meta.accentHex }}
                    >
                      {meta.title}
                    </h3>
                    <span className="font-mono-num text-xs text-slate-300 shrink-0 whitespace-nowrap">
                      {catCards.length} {catCards.length === 1 ? 'card' : 'cards'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-300/90 min-h-[38px]">
                    {meta.subtitle}
                  </p>
                </div>

                <div className="mt-4">
                  <CategoryArtwork category={category} previewCards={catCards} />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Featured Drops */}
      {featuredCards.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
                Featured Inventory
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Live published cards with fixed BDT (৳) pricing ready for Bangladesh delivery.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigateTo('/marketplace')}
              className="text-sm font-semibold text-[#FACC15] hover:text-[#FDE047] whitespace-nowrap"
            >
              Browse all {publishedCards.length} →
            </button>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featuredCards.map((card) => (
              <CardTile
                key={card.id}
                card={card}
                wishlisted={isWishlisted(card.id)}
                onToggleWishlist={toggleWishlist}
                onOrder={onOrderCard}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
