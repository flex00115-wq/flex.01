import React from 'react';
import { Bookmark, MessageCircle } from 'lucide-react';
import { CATEGORY_META } from '../config/store';
import { navigateTo } from '../hooks/useRouter';
import type { CardItem } from '../types/card';
import { formatBdt, formatStockLabel } from '../utils/catalogHelpers';

interface CardTileProps {
  card: CardItem;
  wishlisted: boolean;
  onToggleWishlist: (id: string) => void;
  onOrder: (card: CardItem) => void;
}

export function CardTile({ card, wishlisted, onToggleWishlist, onOrder }: CardTileProps) {
  const catMeta = CATEGORY_META[card.category];

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-[#231E3D] bg-[#131024] transition-transform duration-200 hover:-translate-y-0.5 hover:border-[#393163]">
      <div className="relative aspect-[5/7] w-full overflow-hidden bg-[#0B0917]">
        <a
          href={`/card/${encodeURIComponent(card.id)}`}
          onClick={(e) => {
            e.preventDefault();
            navigateTo(`/card/${encodeURIComponent(card.id)}`);
          }}
          className="block h-full w-full"
          aria-label={`View details for ${card.name}`}
        >
          <img
            src={card.imageUrl}
            alt={card.name}
            referrerPolicy="no-referrer"
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </a>

        <button
          type="button"
          onClick={() => onToggleWishlist(card.id)}
          aria-label={wishlisted ? `Remove ${card.name} from wishlist` : `Save ${card.name} to wishlist`}
          className={`absolute top-2.5 right-2.5 inline-flex h-9 w-9 items-center justify-center rounded-lg border backdrop-blur-md transition-colors ${
            wishlisted
              ? 'border-[#FACC15]/60 bg-[#FACC15] text-[#0B0917]'
              : 'border-white/15 bg-[#0B0917]/80 text-slate-200 hover:border-white/40'
          }`}
        >
          <Bookmark className={`h-4 w-4 ${wishlisted ? 'fill-current' : ''}`} aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
          <span style={{ color: catMeta.accentHex }} className="font-medium truncate">
            {card.category}
          </span>
          <span className="font-mono-num text-slate-400 shrink-0">#{card.serial}</span>
        </div>

        <a
          href={`/card/${encodeURIComponent(card.id)}`}
          onClick={(e) => {
            e.preventDefault();
            navigateTo(`/card/${encodeURIComponent(card.id)}`);
          }}
          className="mt-1.5 line-clamp-2 font-display text-base font-semibold leading-snug text-white hover:text-[#FACC15] transition-colors"
        >
          {card.name}
        </a>

        <p className="mt-1 truncate text-xs text-slate-400">
          {card.setName} · {card.rarity}
        </p>

        <div className="mt-auto pt-4 flex items-center justify-between gap-2 border-t border-[#231E3D]/70">
          <div>
            <p className="font-mono-num text-lg font-bold text-[#FACC15]">
              {formatBdt(card.priceBdt)}
            </p>
            <p
              className={`text-[11px] font-medium ${
                card.stockStatus === 'available'
                  ? 'text-[#10B981]'
                  : card.stockStatus === 'sold'
                    ? 'text-amber-400'
                    : 'text-rose-400'
              }`}
            >
              {formatStockLabel(card.stockStatus, true)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onOrder(card)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981]/15 border border-[#10B981]/40 px-3 py-2 text-xs font-semibold text-[#34D399] hover:bg-[#10B981] hover:text-[#042318] transition-colors whitespace-nowrap shrink-0"
          >
            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Order</span>
          </button>
        </div>
      </div>
    </article>
  );
}
