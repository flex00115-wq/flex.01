import React from 'react';
import { ArrowRight } from 'lucide-react';
import { CategoryArtwork } from '../components/CategoryArtwork';
import { CARD_CATEGORIES, CATEGORY_META } from '../config/store';
import { navigateTo } from '../hooks/useRouter';
import { useCatalog } from '../storage/catalogStore';
import { formatBdt } from '../utils/catalogHelpers';

export function CategoriesPage() {
  const { publishedCards } = useCatalog();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 space-y-8">
      <div>
        <p className="text-xs font-semibold text-[#22D3EE]">5 Curated Worlds</p>
        <h1 className="mt-1 font-display text-3xl sm:text-4xl font-extrabold text-white">
          Browse All Card Categories
        </h1>
        <p className="mt-2 max-w-2xl text-sm sm:text-base text-slate-300">
          Explore FLEX&apos;s five official Bangladesh collector categories with live stock counts and BDT (৳) price ranges.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {CARD_CATEGORIES.map((category) => {
          const meta = CATEGORY_META[category];
          const catCards = publishedCards.filter((c) => c.category === category);
          const priced = catCards.map((c) => c.priceBdt).filter((p): p is number => typeof p === 'number' && p > 0);
          const minP = priced.length > 0 ? Math.min(...priced) : null;
          const maxP = priced.length > 0 ? Math.max(...priced) : null;

          return (
            <button
              key={category}
              type="button"
              onClick={() => navigateTo(`/marketplace?category=${encodeURIComponent(category)}`)}
              className={`group flex flex-col justify-between rounded-2xl border bg-gradient-to-b ${meta.gradientBg} ${meta.borderClass} p-6 text-left transition-all duration-200 hover:-translate-y-1`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-2xl font-bold" style={{ color: meta.accentHex }}>
                    {meta.title}
                  </h2>
                  <span className="font-mono-num text-xs text-slate-300">
                    {catCards.length} published
                  </span>
                </div>
                <p className="text-sm text-slate-300">{meta.subtitle}</p>
              </div>

              <div className="my-5">
                <CategoryArtwork category={category} previewCards={catCards} />
              </div>

              <div className="flex items-center justify-between border-t border-white/10 pt-4 text-xs">
                <span className="font-mono-num text-slate-300">
                  {minP !== null && maxP !== null
                    ? `${formatBdt(minP)} – ${formatBdt(maxP)}`
                    : 'Browse collection'}
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-white group-hover:text-[#FACC15]">
                  <span>Explore</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
