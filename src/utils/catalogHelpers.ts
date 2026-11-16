import { STORE_CONFIG } from '../config/store';
import type {
  CardCategory,
  CardItem,
  CardRarity,
  CatalogBundle,
  PublishStatus,
  StockStatus,
} from '../types/card';

export function formatBdt(amount: number | null | undefined): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return 'Unpriced';
  }
  return `৳${Math.round(amount).toLocaleString('en-US')}`;
}

export function formatStockLabel(status: StockStatus, short = false): string {
  if (status === 'available') return short ? 'In Stock' : 'Available in Stock';
  if (status === 'sold') return 'Sold';
  return 'Out of Stock';
}

export function getNextSerialNumber(cards: readonly CardItem[]): number {
  if (cards.length === 0) return 1;
  let maxSerial = 0;
  for (const card of cards) {
    if (card.serial > maxSerial) maxSerial = card.serial;
  }
  return maxSerial + 1;
}

export function getNextSortOrder(cards: readonly CardItem[]): number {
  if (cards.length === 0) return 1;
  let maxOrder = 0;
  for (const card of cards) {
    if (card.sortOrder > maxOrder) maxOrder = card.sortOrder;
  }
  return maxOrder + 1;
}

export interface MarketplaceFilter {
  query: string;
  category: CardCategory | 'All';
  stock: StockStatus | 'All';
  rarity: CardRarity | 'All';
  minPrice?: number | null;
  maxPrice?: number | null;
  sortBy: 'serial_asc' | 'price_asc' | 'price_desc' | 'newest';
}

export function filterPublishedCards(
  cards: readonly CardItem[],
  filter: MarketplaceFilter
): CardItem[] {
  const q = filter.query.trim().toLowerCase();
  const serialLookup = q.startsWith('#') ? q.slice(1) : q;

  const filtered = cards.filter((card) => {
    if (card.publishStatus !== 'published') return false;
    if (filter.category !== 'All' && card.category !== filter.category) return false;
    if (filter.stock !== 'All' && card.stockStatus !== filter.stock) return false;
    if (filter.rarity !== 'All' && card.rarity !== filter.rarity) return false;

    if (typeof filter.minPrice === 'number' && filter.minPrice > 0) {
      if (card.priceBdt === null || card.priceBdt < filter.minPrice) return false;
    }
    if (typeof filter.maxPrice === 'number' && filter.maxPrice > 0) {
      if (card.priceBdt === null || card.priceBdt > filter.maxPrice) return false;
    }

    if (q.length > 0) {
      const nameMatch = card.name.toLowerCase().includes(q);
      const setMatch = card.setName.toLowerCase().includes(q);
      const catMatch = card.category.toLowerCase().includes(q);
      const serialMatch = serialLookup.length > 0 && String(card.serial) === serialLookup;
      if (!nameMatch && !setMatch && !catMatch && !serialMatch) return false;
    }
    return true;
  });

  return [...filtered].sort((a, b) => {
    switch (filter.sortBy) {
      case 'price_asc':
        return (a.priceBdt ?? Number.MAX_SAFE_INTEGER) - (b.priceBdt ?? Number.MAX_SAFE_INTEGER);
      case 'price_desc':
        return (b.priceBdt ?? -1) - (a.priceBdt ?? -1);
      case 'newest':
        return b.serial - a.serial;
      case 'serial_asc':
      default:
        return a.sortOrder - b.sortOrder || a.serial - b.serial;
    }
  });
}

export interface AdminFilter {
  query: string;
  category: CardCategory | 'All';
  publishStatus: PublishStatus | 'All';
  stockStatus: StockStatus | 'All';
  unpricedOnly: boolean;
}

export function filterAdminCards(cards: readonly CardItem[], filter: AdminFilter): CardItem[] {
  const q = filter.query.trim().toLowerCase();
  const serialQuery = q.startsWith('#') ? q.slice(1) : q;

  return cards
    .filter((card) => {
      if (filter.category !== 'All' && card.category !== filter.category) return false;
      if (filter.publishStatus !== 'All' && card.publishStatus !== filter.publishStatus) return false;
      if (filter.stockStatus !== 'All' && card.stockStatus !== filter.stockStatus) return false;
      if (filter.unpricedOnly && card.priceBdt !== null && card.priceBdt > 0) return false;
      if (q.length > 0) {
        const matchName = card.name.toLowerCase().includes(q);
        const matchSerial = serialQuery.length > 0 && String(card.serial).includes(serialQuery);
        if (!matchName && !matchSerial) return false;
      }
      return true;
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.serial - b.serial);
}

export function buildOrderMessage(card: CardItem): string {
  const priceText = card.priceBdt ? `৳${card.priceBdt.toLocaleString('en-US')}` : 'Quote Requested';
  return [
    `Hello FLEX Bangladesh! I would like to order:`,
    `• Card: ${card.name}`,
    `• Serial: #${card.serial}`,
    `• Category: ${card.category}`,
    `• Listed Price: ${priceText}`,
    `Please confirm availability and Cash on Delivery / bKash / Nagad details.`,
  ].join('\n');
}

export function buildWhatsAppOrderUrl(card: CardItem): string {
  const text = encodeURIComponent(buildOrderMessage(card));
  return `https://wa.me/${STORE_CONFIG.whatsappNumber}?text=${text}`;
}

export function buildMessengerOrderUrl(): string {
  return `https://m.me/${STORE_CONFIG.messengerHandle}`;
}

export function createCatalogBundle(cards: readonly CardItem[]): CatalogBundle {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    storeName: STORE_CONFIG.brandName,
    currency: 'BDT',
    cards: [...cards].sort((a, b) => a.serial - b.serial),
  };
}

export function parseCatalogBundle(rawJson: string): CardItem[] {
  const parsed = JSON.parse(rawJson) as Partial<CatalogBundle> | CardItem[];
  const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.cards) ? parsed.cards : null;
  if (!list) {
    throw new Error('Invalid catalog bundle format. Expected { cards: [...] }.');
  }
  return list.map((item, idx) => ({
    id: String(item.id || `card-${idx + 1}`),
    serial: typeof item.serial === 'number' && item.serial > 0 ? item.serial : idx + 1,
    name: String(item.name || `Card #${idx + 1}`),
    category: item.category || 'Pokemon',
    priceBdt: typeof item.priceBdt === 'number' && item.priceBdt > 0 ? Math.round(item.priceBdt) : null,
    publishStatus: item.publishStatus === 'draft' ? 'draft' : 'published',
    stockStatus:
      item.stockStatus === 'sold'
        ? 'sold'
        : item.stockStatus === 'out_of_stock'
          ? 'out_of_stock'
          : 'available',
    sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : idx + 1,
    setName: String(item.setName || 'Base Set'),
    rarity: item.rarity || 'Rare',
    condition: item.condition || 'Near Mint',
    description: item.description ? String(item.description) : undefined,
    imageUrl: String(item.imageUrl || ''),
    fingerprint: item.fingerprint,
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString(),
  }));
}

export function deriveCardNameFromFilename(filename: string, serial: number): string {
  const base = filename.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim();
  if (!base) return `FLEX Card #${serial}`;
  return base.replace(/\b\w/g, (c) => c.toUpperCase());
}
