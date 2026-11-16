import type { CardCategory, CardCondition, CardItem, CardRarity } from '../types/card';

export interface PriceTrendPoint {
  period: string;
  phase: 'past' | 'current' | 'future';
  priceBdt: number;
  label: string;
}

export interface CardPriceAnalysis {
  isPriced: boolean;
  /** 100% FIXED by Admin — AI never alters this value */
  fixedCurrentPrice: number;
  /** Strictly < fixedCurrentPrice */
  estimatedPastPrice: number;
  /** Strictly > fixedCurrentPrice */
  predictedFuturePrice: number;
  pastDiscountPct: number;
  projectedGrowthPct: number;
  demandRating: 'High' | 'Surging' | 'Steady';
  liquidityNote: string;
  collectorSummary: string;
  series: PriceTrendPoint[];
}

function deterministicHash(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

const RARITY_GROWTH_BONUS: Record<CardRarity, number> = {
  Common: 0.16,
  Rare: 0.24,
  'Holo Rare': 0.34,
  'Ultra Rare': 0.44,
  'Secret Gold': 0.56,
  Mythic: 0.62,
};

const CONDITION_BONUS: Record<CardCondition, number> = {
  Mint: 0.06,
  'Near Mint': 0.03,
  'Lightly Played': 0.0,
};

const CATEGORY_DEMAND: Record<CardCategory, { rating: 'High' | 'Surging' | 'Steady'; note: string }> = {
  Pokemon: {
    rating: 'Surging',
    note: 'Strong collector demand across Dhaka & Chattogram hobby groups for holo & gold variants.',
  },
  Football: {
    rating: 'Surging',
    note: 'High liquidity during international match weeks and tournament cycles.',
  },
  Naruto: {
    rating: 'High',
    note: 'Consistent interest in Sage, Hokage, and Akatsuki foil editions.',
  },
  'Demon Slayer': {
    rating: 'High',
    note: 'Hashira and Hinokami foil pulls command steady collector premiums.',
  },
  'Free Fire': {
    rating: 'Steady',
    note: 'Active youth trading volume across Bangladesh campus & gaming communities.',
  },
};

/**
 * Generates per-card market analytics while strictly enforcing:
 *   estimatedPastPrice < fixedCurrentPrice < predictedFuturePrice
 */
export function analyzeCardPricing(card: CardItem): CardPriceAnalysis {
  const fixedCurrentPrice =
    typeof card.priceBdt === 'number' && Number.isFinite(card.priceBdt) && card.priceBdt > 0
      ? Math.round(card.priceBdt)
      : 0;

  if (fixedCurrentPrice <= 0) {
    return {
      isPriced: false,
      fixedCurrentPrice: 0,
      estimatedPastPrice: 0,
      predictedFuturePrice: 0,
      pastDiscountPct: 0,
      projectedGrowthPct: 0,
      demandRating: CATEGORY_DEMAND[card.category].rating,
      liquidityNote: CATEGORY_DEMAND[card.category].note,
      collectorSummary: 'Admin price has not been assigned yet. Check back or request a quote via WhatsApp.',
      series: [],
    };
  }

  const seed = deterministicHash(`${card.id}-${card.serial}-${card.category}-${card.rarity}`);
  const pastVariance = ((seed % 16) + 15) / 100; // 0.15 .. 0.30 (15% - 30% lower)
  const rarityBase = RARITY_GROWTH_BONUS[card.rarity] ?? 0.25;
  const conditionBonus = CONDITION_BONUS[card.condition] ?? 0.02;
  const microVariance = ((seed >> 4) % 9) / 100; // 0.00 .. 0.08
  const rawGrowth = Math.min(0.65, Math.max(0.15, rarityBase + conditionBonus + microVariance - 0.04));

  // Strict programmatic invariant: past < current < future
  const rawPast = Math.round(fixedCurrentPrice * (1 - pastVariance));
  const estimatedPastPrice =
    fixedCurrentPrice === 1 ? 0 : Math.min(fixedCurrentPrice - 1, Math.max(1, rawPast));

  const rawFuture = Math.round(fixedCurrentPrice * (1 + rawGrowth));
  const predictedFuturePrice = Math.max(fixedCurrentPrice + 1, rawFuture);

  const midPast = Math.min(
    fixedCurrentPrice - 1,
    Math.max(estimatedPastPrice, Math.round((estimatedPastPrice + fixedCurrentPrice) / 2))
  );
  const recentPast = Math.min(
    fixedCurrentPrice - 1,
    Math.max(midPast, Math.round(fixedCurrentPrice * (1 - pastVariance * 0.45)))
  );
  const nearFuture = Math.max(
    fixedCurrentPrice + 1,
    Math.min(predictedFuturePrice, Math.round(fixedCurrentPrice * (1 + rawGrowth * 0.48)))
  );

  const pastDiscountPct = Math.round(((fixedCurrentPrice - estimatedPastPrice) / fixedCurrentPrice) * 100);
  const projectedGrowthPct = Math.round(((predictedFuturePrice - fixedCurrentPrice) / fixedCurrentPrice) * 100);
  const demandInfo = CATEGORY_DEMAND[card.category];

  const series: PriceTrendPoint[] = [
    {
      period: '6M Ago',
      phase: 'past',
      priceBdt: estimatedPastPrice,
      label: `৳${estimatedPastPrice.toLocaleString()}`,
    },
    {
      period: '3M Ago',
      phase: 'past',
      priceBdt: midPast,
      label: `৳${midPast.toLocaleString()}`,
    },
    {
      period: '1M Ago',
      phase: 'past',
      priceBdt: recentPast,
      label: `৳${recentPast.toLocaleString()}`,
    },
    {
      period: 'Current',
      phase: 'current',
      priceBdt: fixedCurrentPrice,
      label: `৳${fixedCurrentPrice.toLocaleString()} (Fixed)`,
    },
    {
      period: '+3M Est',
      phase: 'future',
      priceBdt: nearFuture,
      label: `৳${nearFuture.toLocaleString()}`,
    },
    {
      period: '+6M Est',
      phase: 'future',
      priceBdt: predictedFuturePrice,
      label: `৳${predictedFuturePrice.toLocaleString()}`,
    },
  ];

  return {
    isPriced: true,
    fixedCurrentPrice,
    estimatedPastPrice,
    predictedFuturePrice,
    pastDiscountPct,
    projectedGrowthPct,
    demandRating: demandInfo.rating,
    liquidityNote: demandInfo.note,
    collectorSummary: `${card.rarity} ${card.category} edition in ${card.condition} condition shows a ${projectedGrowthPct}% projected 6-month upside over FLEX's fixed ৳${fixedCurrentPrice.toLocaleString()} retail benchmark.`,
    series,
  };
}
