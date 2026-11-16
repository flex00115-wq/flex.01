import React from 'react';
import { CARD_CATEGORIES, STORE_CONFIG } from '../config/store';
import { navigateTo } from '../hooks/useRouter';
import { BrandMark } from './Navbar';

interface FooterProps {
  onOpenPolicy: (doc: 'privacy' | 'terms' | 'how-to-order') => void;
}

export function Footer({ onOpenPolicy }: FooterProps) {
  const go = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    e.preventDefault();
    navigateTo(path);
  };

  return (
    <footer className="border-t border-[#231E3D] bg-[#090714] mt-16">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3">
            <BrandMark />
            <p className="text-sm leading-relaxed text-slate-400 max-w-xs">
              Trading card marketplace in Bangladesh. All prices in BDT (৳). Delivery inside Bangladesh only.
            </p>
            <p className="text-xs text-slate-500">
              COD · bKash · Nagad · {STORE_CONFIG.supportEmail}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Categories</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              {CARD_CATEGORIES.map((cat) => (
                <li key={cat}>
                  <a
                    href={`/marketplace?category=${encodeURIComponent(cat)}`}
                    onClick={(e) => go(e, `/marketplace?category=${encodeURIComponent(cat)}`)}
                    className="hover:text-white transition-colors"
                  >
                    {cat}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Explore</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <a href="/scan" onClick={(e) => go(e, '/scan')} className="hover:text-white transition-colors">
                  Scan a Card
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenPolicy('how-to-order')}
                  className="hover:text-white transition-colors text-left"
                >
                  How to Order
                </button>
              </li>
              <li>
                <a href="/trade" onClick={(e) => go(e, '/trade')} className="hover:text-white transition-colors">
                  Sell / Trade Your Cards
                </a>
              </li>
              <li>
                <a
                  href="/marketplace?wishlist=1"
                  onClick={(e) => go(e, '/marketplace?wishlist=1')}
                  className="hover:text-white transition-colors"
                >
                  Saved Wishlist
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Policies & Contact</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <button
                  type="button"
                  onClick={() => onOpenPolicy('privacy')}
                  className="hover:text-white transition-colors text-left"
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenPolicy('terms')}
                  className="hover:text-white transition-colors text-left"
                >
                  Terms & IP Disclaimer
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-[#231E3D]/70 pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} FLEX Bangladesh. All prices fixed in BDT (৳).</p>
          <p>Visual scanner runs privately in your browser.</p>
        </div>
      </div>
    </footer>
  );
}
