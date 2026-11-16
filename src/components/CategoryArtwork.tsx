import React from 'react';
import type { CardCategory, CardItem } from '../types/card';

interface CategoryArtworkProps {
  category: CardCategory;
  previewCards: CardItem[];
}

export function CategoryArtwork({ category, previewCards }: CategoryArtworkProps) {
  const leadCard = previewCards[0];

  const renderWorldIllustration = () => {
    switch (category) {
      case 'Pokemon':
        return (
          <svg viewBox="0 0 220 150" className="h-full w-full" aria-hidden="true">
            <defs>
              <radialGradient id="cat-pkm-glow" cx="50%" cy="45%" r="55%">
                <stop offset="0%" stopColor="#FACC15" stopOpacity="0.34" />
                <stop offset="100%" stopColor="#131024" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="220" height="150" rx="10" fill="#171326" />
            <rect width="220" height="150" rx="10" fill="url(#cat-pkm-glow)" />
            <circle cx="110" cy="75" r="46" fill="none" stroke="#FACC15" strokeOpacity="0.32" strokeWidth="1.5" strokeDasharray="4 4" />
            <path d="M74 75 A36 36 0 0 1 146 75 Z" fill="#FACC15" fillOpacity="0.22" stroke="#FACC15" strokeWidth="2" />
            <path d="M74 75 A36 36 0 0 0 146 75 Z" fill="#1E1B4B" stroke="#FACC15" strokeWidth="2" />
            <line x1="74" y1="75" x2="146" y2="75" stroke="#FACC15" strokeWidth="2.5" />
            <circle cx="110" cy="75" r="10" fill="#0B0917" stroke="#FACC15" strokeWidth="2.5" />
            <polygon points="164,22 146,54 162,54 150,82 178,44 162,44" fill="#FDE047" opacity="0.85" />
            <polygon points="44,92 34,112 45,112 38,132 56,106 46,106" fill="#FACC15" opacity="0.65" />
          </svg>
        );
      case 'Football':
        return (
          <svg viewBox="0 0 220 150" className="h-full w-full" aria-hidden="true">
            <defs>
              <radialGradient id="cat-ftb-glow" cx="50%" cy="50%" r="58%">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#131024" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="220" height="150" rx="10" fill="#0F1D1C" />
            <rect width="220" height="150" rx="10" fill="url(#cat-ftb-glow)" />
            <rect x="20" y="18" width="180" height="114" rx="6" fill="none" stroke="#10B981" strokeOpacity="0.35" strokeWidth="1.5" />
            <line x1="110" y1="18" x2="110" y2="132" stroke="#10B981" strokeOpacity="0.3" strokeWidth="1.5" />
            <circle cx="110" cy="75" r="26" fill="none" stroke="#10B981" strokeOpacity="0.45" strokeWidth="1.5" />
            <path d="M88 46 H132 V72 C132 94, 118 106, 110 110 C102 106, 88 94, 88 72 Z" fill="#10B981" fillOpacity="0.22" stroke="#34D399" strokeWidth="2" />
            <text x="110" y="84" textAnchor="middle" fontFamily="Outfit,sans-serif" fontWeight="800" fontSize="24" fill="#A7F3D0">10</text>
          </svg>
        );
      case 'Naruto':
        return (
          <svg viewBox="0 0 220 150" className="h-full w-full" aria-hidden="true">
            <defs>
              <radialGradient id="cat-nrt-glow" cx="50%" cy="48%" r="56%">
                <stop offset="0%" stopColor="#F97316" stopOpacity="0.34" />
                <stop offset="100%" stopColor="#131024" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="220" height="150" rx="10" fill="#1D1214" />
            <rect width="220" height="150" rx="10" fill="url(#cat-nrt-glow)" />
            <circle cx="110" cy="75" r="40" fill="none" stroke="#FB923C" strokeOpacity="0.35" strokeWidth="2" />
            <path d="M110 50 C126 50, 134 64, 130 78 C126 92, 110 98, 96 92 C84 86, 84 68, 96 64 C106 61, 116 70, 112 79" fill="none" stroke="#F97316" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M148 36 L176 46 L154 64 Z" fill="#FB923C" opacity="0.65" />
            <path d="M44 106 L72 94 L66 118 Z" fill="#F97316" opacity="0.55" />
          </svg>
        );
      case 'Demon Slayer':
        return (
          <svg viewBox="0 0 220 150" className="h-full w-full" aria-hidden="true">
            <defs>
              <radialGradient id="cat-dms-glow" cx="50%" cy="48%" r="58%">
                <stop offset="0%" stopColor="#A855F7" stopOpacity="0.34" />
                <stop offset="100%" stopColor="#131024" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="220" height="150" rx="10" fill="#181128" />
            <rect width="220" height="150" rx="10" fill="url(#cat-dms-glow)" />
            <line x1="58" y1="120" x2="162" y2="30" stroke="#E9D5FF" strokeWidth="5" strokeLinecap="round" />
            <line x1="78" y1="90" x2="96" y2="108" stroke="#FACC15" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M45 78 Q110 34 175 78" fill="none" stroke="#C084FC" strokeOpacity="0.55" strokeWidth="2.5" />
            <circle cx="156" cy="108" r="10" fill="#A855F7" fillOpacity="0.25" stroke="#C084FC" strokeWidth="1.5" />
          </svg>
        );
      case 'Free Fire':
      default:
        return (
          <svg viewBox="0 0 220 150" className="h-full w-full" aria-hidden="true">
            <defs>
              <radialGradient id="cat-ffr-glow" cx="50%" cy="48%" r="58%">
                <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.34" />
                <stop offset="100%" stopColor="#131024" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="220" height="150" rx="10" fill="#1F1212" />
            <rect width="220" height="150" rx="10" fill="url(#cat-ffr-glow)" />
            <polygon points="110,22 152,46 152,102 110,126 68,102 68,46" fill="none" stroke="#F59E0B" strokeOpacity="0.45" strokeWidth="2" />
            <polygon points="78,98 86,52 102,72 110,42 118,72 134,52 142,98" fill="#F59E0B" fillOpacity="0.28" stroke="#FBBF24" strokeWidth="2" strokeLinejoin="round" />
            <rect x="78" y="98" width="64" height="8" rx="3" fill="#EF4444" fillOpacity="0.7" />
          </svg>
        );
    }
  };

  return (
    <div className="relative h-36 w-full overflow-hidden rounded-xl border border-white/10 bg-[#0D0A1B]">
      {renderWorldIllustration()}
      {leadCard && (
        <div className="absolute right-2.5 bottom-2.5 h-24 w-[68px] rotate-6 overflow-hidden rounded-lg border border-white/25 bg-[#0B0917] shadow-lg transition-transform duration-200 group-hover:rotate-3 group-hover:scale-105">
          <img
            src={leadCard.imageUrl}
            alt={leadCard.name}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        </div>
      )}
    </div>
  );
}
