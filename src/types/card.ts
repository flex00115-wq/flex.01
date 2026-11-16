export type CardCategory =
  | 'Pokemon'
  | 'Football'
  | 'Naruto'
  | 'Demon Slayer'
  | 'Free Fire';

export const CARD_CATEGORIES: readonly CardCategory[] = [
  'Pokemon',
  'Football',
  'Naruto',
  'Demon Slayer',
  'Free Fire',
] as const;

export type PublishStatus = 'published' | 'draft';
export type StockStatus = 'available' | 'sold' | 'out_of_stock';
export type CardRarity =
  | 'Common'
  | 'Rare'
  | 'Holo Rare'
  | 'Ultra Rare'
  | 'Secret Gold'
  | 'Mythic';
export type CardCondition = 'Mint' | 'Near Mint' | 'Lightly Played';

export interface CardFingerprint {
  /** 64-bit hex DCT pHash for Red channel (glare-normalized) */
  rHash: string;
  /** 64-bit hex DCT pHash for Green channel (glare-normalized) */
  gHash: string;
  /** 64-bit hex DCT pHash for Blue channel (glare-normalized) */
  bHash: string;
  /** 64-bit hex DCT pHash for Sobel edge magnitude */
  edgeHash: string;
  /** 4x4 spatial zone signature: 16 zones * 4 values [R, G, B, Edge] = 64 normalized floats */
  spatialGrid: number[];
  /** Compact 64-dim structural gradient descriptor */
  structuralVec: number[];
  /** 18x24 normalized luminance patch grid */
  patchThumb?: number[];
  /** Version 2: Center 65% inner artwork 64-dim HOG (edge-clip & glare invariant) */
  innerHogVec?: number[];
  /** Version 2: Top title/HP zone 32-dim HOG */
  topHogVec?: number[];
  /** Version 2: Bottom name/move/serial zone 32-dim HOG */
  bottomHogVec?: number[];
  /** Version 2: 16x16 inner artwork normalized Sobel edge patch */
  innerEdgePatch?: number[];
  /** Version 2: 16x16 inner artwork CDF-equalized luminance patch */
  innerLumaPatch?: number[];
  /** Version 3: 24x6 top header bar luminance strip (differentiates title/HP text width) */
  topTextPatch?: number[];
  /** Version 3: 24x8 name plate luminance strip (differentiates character/attack text layout) */
  namePlatePatch?: number[];
  /** Version 3: 4x4 white-balance-gentle RGB chromaticity signature (separates Gold vs Purple/Green/Blue) */
  colorChromaGrid?: number[];
  /** Version 2: 32-dim rotation-invariant concentric radial ring structure descriptor */
  radialStructureVec?: number[];
  /** Version 2: 48-dim local corner/interest-point signature */
  keypointSignature?: number[];
  /** Deep neural embedding of full card from Transformers.js CLIP Web Worker */
  neuralEmbedding?: number[];
  /** Deep neural embedding of center 65% inner artwork crop from Transformers.js CLIP */
  innerNeuralEmbedding?: number[];
  /** Fingerprint format version */
  version: number;
}

export interface CardItem {
  id: string;
  serial: number;
  name: string;
  category: CardCategory;
  /** Fixed BDT price set exclusively by Admin. Null means unpriced. */
  priceBdt: number | null;
  publishStatus: PublishStatus;
  stockStatus: StockStatus;
  sortOrder: number;
  setName: string;
  rarity: CardRarity;
  condition: CardCondition;
  description?: string;
  imageUrl: string;
  fingerprint?: CardFingerprint;
  createdAt: string;
  updatedAt: string;
}

export interface TradeRequest {
  id: string;
  sellerName: string;
  phone: string;
  city: string;
  cardName: string;
  category: CardCategory;
  condition: CardCondition;
  askingPriceBdt: number;
  notes: string;
  imageDataUrl: string;
  status: 'pending' | 'reviewed' | 'accepted' | 'declined';
  createdAt: string;
}

export interface CatalogBundle {
  version: number;
  exportedAt: string;
  storeName: string;
  currency: 'BDT';
  cards: CardItem[];
}

export interface CornerPoint {
  x: number; // normalized 0..1 relative to image width
  y: number; // normalized 0..1 relative to image height
}

export interface ScanResult {
  status: 'matched' | 'not_found';
  card?: CardItem;
  confidence: number;
  margin: number;
  usedGemini: boolean;
  elapsedMs: number;
  isolatedCropDataUrl: string;
  reason: string;
  topCandidates?: Array<{ card: CardItem; score: number }>;
}
