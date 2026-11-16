import { CARD_CATEGORIES, type CardCategory } from '../types/card';
export { CARD_CATEGORIES };

export const STORE_CONFIG = {
  brandName: 'FLEX',
  tagline: 'Collect. Trade. Flex.',
  eyebrow: 'Bangladesh Trading Card Storefront · Prices in BDT (৳)',
  currencySymbol: '৳',
  whatsappNumber: '8801700000000',
  messengerHandle: 'flexcardsbd',
  supportEmail: 'orders@flexcards.bd',
  /** Default owner password for Admin access (can be updated inside Admin Panel Settings) */
  defaultAdminPassword: 'flex2026x',
  deliveryInfo: {
    dhakaCharge: 70,
    outsideDhakaCharge: 130,
    freeDeliveryThreshold: 3000,
    paymentMethods: ['Cash on Delivery (COD)', 'bKash', 'Nagad'],
  },
} as const;

export interface CategoryMeta {
  id: CardCategory;
  title: string;
  subtitle: string;
  accentHex: string;
  borderClass: string;
  badgeClass: string;
  glowClass: string;
  gradientBg: string;
}

export const CATEGORY_META: Record<CardCategory, CategoryMeta> = {
  Pokemon: {
    id: 'Pokemon',
    title: 'Pokemon',
    subtitle: 'Electric foils, iconic evolutions & vintage pulls',
    accentHex: '#FACC15',
    borderClass: 'border-[#FACC15]/30 hover:border-[#FACC15]/70',
    badgeClass: 'text-[#FACC15] border-[#FACC15]/40 bg-[#FACC15]/10',
    glowClass: 'from-[#FACC15]/15 via-[#131024] to-[#131024]',
    gradientBg: 'from-[#2A220E] via-[#171326] to-[#110E1F]',
  },
  Football: {
    id: 'Football',
    title: 'Football',
    subtitle: 'Match-day legends, rookies & championship parallels',
    accentHex: '#10B981',
    borderClass: 'border-[#10B981]/30 hover:border-[#10B981]/70',
    badgeClass: 'text-[#10B981] border-[#10B981]/40 bg-[#10B981]/10',
    glowClass: 'from-[#10B981]/15 via-[#131024] to-[#131024]',
    gradientBg: 'from-[#0D2922] via-[#131829] to-[#110E1F]',
  },
  Naruto: {
    id: 'Naruto',
    title: 'Naruto',
    subtitle: 'Shinobi scrolls, clan emblems & chakra rares',
    accentHex: '#F97316',
    borderClass: 'border-[#F97316]/30 hover:border-[#F97316]/70',
    badgeClass: 'text-[#FB923C] border-[#F97316]/40 bg-[#F97316]/10',
    glowClass: 'from-[#F97316]/15 via-[#131024] to-[#131024]',
    gradientBg: 'from-[#2D1810] via-[#1A1326] to-[#110E1F]',
  },
  'Demon Slayer': {
    id: 'Demon Slayer',
    title: 'Demon Slayer',
    subtitle: 'Nichirin blades, breathing forms & night-bloom foils',
    accentHex: '#A855F7',
    borderClass: 'border-[#A855F7]/30 hover:border-[#A855F7]/70',
    badgeClass: 'text-[#C084FC] border-[#A855F7]/40 bg-[#A855F7]/10',
    glowClass: 'from-[#A855F7]/15 via-[#131024] to-[#131024]',
    gradientBg: 'from-[#251338] via-[#18122B] to-[#110E1F]',
  },
  'Free Fire': {
    id: 'Free Fire',
    title: 'Free Fire',
    subtitle: 'Tactical drops, survivor skins & battle-royale editions',
    accentHex: '#F59E0B',
    borderClass: 'border-[#F59E0B]/30 hover:border-[#EF4444]/70',
    badgeClass: 'text-[#FBBF24] border-[#F59E0B]/40 bg-[#F59E0B]/10',
    glowClass: 'from-[#F59E0B]/15 via-[#131024] to-[#131024]',
    gradientBg: 'from-[#2E1B0E] via-[#1C1225] to-[#110E1F]',
  },
};
