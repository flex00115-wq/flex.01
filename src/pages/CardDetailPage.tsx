import React, { useMemo } from 'react';
import {
  ArrowLeft,
  Bookmark,
  MessageCircle,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CATEGORY_META } from '../config/store';
import { navigateTo } from '../hooks/useRouter';
import { useCatalog } from '../storage/catalogStore';
import type { CardItem } from '../types/card';
import { formatBdt, formatStockLabel } from '../utils/catalogHelpers';
import { analyzeCardPricing } from '../utils/priceAnalyzer';

interface CardDetailPageProps {
  cardId: string;
  onOrderCard: (card: CardItem) => void;
}

export function CardDetailPage({ cardId, onOrderCard }: CardDetailPageProps) {
  const { cards, loading, isWishlisted, toggleWishlist } = useCatalog();

  const card = useMemo(
    () => cards.find((c) => c.id === decodeURIComponent(cardId)),
    [cards, cardId]
  );

  const analysis = useMemo(() => (card ? analyzeCardPricing(card) : null), [card]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center text-slate-400">
        Loading card details...
      </div>
    );
  }

  if (!card || !analysis) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-white">Card Not Found</h1>
        <p className="text-sm text-slate-400">
          This card may have been removed or moved from FLEX&apos;s published catalog.
        </p>
        <button
          type="button"
          onClick={() => navigateTo('/marketplace')}
          className="inline-flex items-center gap-2 rounded-xl bg-[#FACC15] px-5 py-2.5 text-sm font-bold text-[#0B0917]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to Marketplace</span>
        </button>
      </div>
    );
  }

  const catMeta = CATEGORY_META[card.category];
  const wishlisted = isWishlisted(card.id);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 space-y-10">
      <div>
        <button
          type="button"
          onClick={() => navigateTo('/marketplace')}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to Marketplace</span>
        </button>
      </div>

      {/* Main Card Purchase Module */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 flex justify-center">
          <div className="w-full max-w-sm rounded-2xl border border-[#231E3D] bg-[#131024] p-5">
            <img
              src={card.imageUrl}
              alt={card.name}
              referrerPolicy="no-referrer"
              className="aspect-[5/7] w-full rounded-xl object-cover shadow-2xl"
            />
          </div>
        </div>

        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <span className={`rounded-md border px-2.5 py-1 font-semibold ${catMeta.badgeClass}`}>
                {card.category}
              </span>
              <span className="font-mono-num text-slate-400">Serial #{card.serial}</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span
                className={`font-semibold ${
                  card.stockStatus === 'available'
                    ? 'text-[#10B981]'
                    : card.stockStatus === 'sold'
                      ? 'text-amber-400'
                      : 'text-rose-400'
                }`}
              >
                {formatStockLabel(card.stockStatus)}
              </span>
            </div>

            <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white">
              {card.name}
            </h1>

            <div className="flex items-baseline gap-3">
              <span className="font-mono-num text-4xl font-extrabold text-[#FACC15]">
                {formatBdt(card.priceBdt)}
              </span>
              <span className="text-xs text-slate-400">Admin Fixed Retail Price (BDT)</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 rounded-2xl border border-[#231E3D] bg-[#131024] p-4 text-xs">
            <div>
              <p className="text-slate-400">Set</p>
              <p className="mt-1 font-semibold text-white">{card.setName}</p>
            </div>
            <div>
              <p className="text-slate-400">Rarity</p>
              <p className="mt-1 font-semibold text-white">{card.rarity}</p>
            </div>
            <div>
              <p className="text-slate-400">Condition</p>
              <p className="mt-1 font-semibold text-white">{card.condition}</p>
            </div>
          </div>

          {card.description && (
            <p className="text-sm leading-relaxed text-slate-300">{card.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onOrderCard(card)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#10B981] px-6 py-3 text-sm font-bold text-[#042318] hover:bg-[#34D399] transition-colors"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              <span>How to Order</span>
            </button>

            <button
              type="button"
              onClick={() => toggleWishlist(card.id)}
              className={`inline-flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold transition-colors ${
                wishlisted
                  ? 'border-[#FACC15] bg-[#FACC15]/15 text-[#FACC15]'
                  : 'border-[#231E3D] bg-[#131024] text-slate-200 hover:border-slate-500'
              }`}
            >
              <Bookmark className={`h-4 w-4 ${wishlisted ? 'fill-current' : ''}`} aria-hidden="true" />
              <span>{wishlisted ? 'Saved in Wishlist' : 'Save to Wishlist'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="h-4 w-4 text-[#10B981]" aria-hidden="true" />
            <span>Cash on Delivery (COD), bKash &amp; Nagad supported across Bangladesh.</span>
          </div>
        </div>
      </section>

      {/* AI Price Analyzer Section */}
      <section className="rounded-2xl border border-[#231E3D] bg-[#131024] p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#22D3EE]">
              <TrendingUp className="h-4 w-4" aria-hidden="true" />
              <span>AI Price Analyzer · Collector Market Trajectory</span>
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold text-white">
              Past → Current → Future Valuation
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            Demand: <strong className="text-[#10B981]">{analysis.demandRating}</strong>
          </span>
        </div>

        {!analysis.isPriced ? (
          <div className="rounded-xl border border-[#231E3D] bg-[#0B0917] p-6 text-sm text-slate-300">
            {analysis.collectorSummary}
          </div>
        ) : (
          <>
            {/* 3 Valuation Summary Boxes */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-[#231E3D] bg-[#0B0917] p-4">
                <p className="text-xs text-slate-400">Estimated Past Price (6M Ago)</p>
                <p className="mt-1.5 font-mono-num text-2xl font-bold text-slate-200">
                  {formatBdt(analysis.estimatedPastPrice)}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {analysis.pastDiscountPct}% below current fixed price
                </p>
              </div>

              <div className="rounded-xl border border-[#FACC15]/45 bg-[#0B0917] p-4">
                <p className="text-xs font-semibold text-[#FACC15]">Current Price (Admin Fixed)</p>
                <p className="mt-1.5 font-mono-num text-2xl font-extrabold text-[#FACC15]">
                  {formatBdt(analysis.fixedCurrentPrice)}
                </p>
                <p className="mt-1 text-xs text-slate-300">Locked storefront retail price</p>
              </div>

              <div className="rounded-xl border border-[#10B981]/40 bg-[#0B0917] p-4">
                <p className="text-xs font-semibold text-[#10B981]">Predicted Future Price (+6M Est)</p>
                <p className="mt-1.5 font-mono-num text-2xl font-bold text-[#34D399]">
                  {formatBdt(analysis.predictedFuturePrice)}
                </p>
                <p className="mt-1 text-xs text-[#10B981]">
                  +{analysis.projectedGrowthPct}% projected collector upside
                </p>
              </div>
            </div>

            {/* Interactive Recharts Trend Chart */}
            <div className="h-72 w-full rounded-xl border border-[#231E3D] bg-[#0B0917] p-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analysis.series} margin={{ top: 14, right: 18, left: 6, bottom: 4 }}>
                  <defs>
                    <linearGradient id="flexPriceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22D3EE" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#22D3EE" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#231E3D" strokeDasharray="4 4" vertical={false} />
                  <XAxis
                    dataKey="period"
                    stroke="#94A3B8"
                    tick={{ fill: '#94A3B8', fontSize: 12 }}
                    axisLine={{ stroke: '#231E3D' }}
                  />
                  <YAxis
                    stroke="#94A3B8"
                    tick={{ fill: '#94A3B8', fontSize: 12 }}
                    axisLine={false}
                    tickFormatter={(v) => `৳${Number(v).toLocaleString()}`}
                    width={72}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#131024',
                      borderColor: '#231E3D',
                      borderRadius: '12px',
                      color: '#F8FAFC',
                      fontSize: '12px',
                    }}
                    formatter={(value) => [`৳${Number(value).toLocaleString()}`, 'Valuation']}
                  />
                  <ReferenceLine
                    x="Current"
                    stroke="#FACC15"
                    strokeDasharray="3 3"
                    label={{
                      value: 'Fixed Now',
                      fill: '#FACC15',
                      fontSize: 11,
                      position: 'top',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="priceBdt"
                    stroke="#22D3EE"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#flexPriceGradient)"
                    activeDot={{ r: 6, fill: '#FACC15', stroke: '#0B0917', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs text-slate-300 border-t border-[#231E3D] pt-4">
              <p>{analysis.collectorSummary}</p>
              <p className="text-slate-400">{analysis.liquidityNote}</p>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
