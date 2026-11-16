import React, { useState } from 'react';
import { Camera, Lock, Menu, X } from 'lucide-react';
import { navigateTo } from '../hooks/useRouter';

interface NavbarProps {
  pathname: string;
  onOpenAdminLock: () => void;
}

export function BrandMark() {
  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#FACC15]/40 bg-gradient-to-br from-[#FACC15]/20 via-[#22D3EE]/15 to-[#131024] font-display text-base font-extrabold text-[#FACC15]">
        F
      </span>
      <span className="font-display text-lg font-bold tracking-[0.14em] text-white">FLEX</span>
    </span>
  );
}

export function Navbar({ pathname, onOpenAdminLock }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const isScan = pathname.startsWith('/scan');
  const isMarket = pathname.startsWith('/marketplace');
  const isCategories = pathname.startsWith('/categories');
  const isTrade = pathname.startsWith('/trade');

  const handleNav = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    e.preventDefault();
    setMobileOpen(false);
    navigateTo(path);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[#231E3D] bg-[#0B0917]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-3.5 sm:px-6">
        <a
          href="/"
          onClick={(e) => handleNav(e, '/')}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FACC15] rounded-lg"
          aria-label="FLEX Home"
        >
          <BrandMark />
        </a>

        <nav className="hidden md:flex items-center gap-6 lg:gap-7 text-sm font-medium" aria-label="Primary Navigation">
          <a
            href="/scan"
            onClick={(e) => handleNav(e, '/scan')}
            className={`relative inline-flex items-center gap-1.5 py-1.5 whitespace-nowrap shrink-0 transition-colors ${
              isScan ? 'text-[#22D3EE] font-semibold' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Camera className="h-4 w-4 text-[#22D3EE]" aria-hidden="true" />
            <span>Scan</span>
            {isScan && (
              <span className="absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full bg-[#FACC15]" />
            )}
          </a>

          <a
            href="/marketplace"
            onClick={(e) => handleNav(e, '/marketplace')}
            className={`relative py-1.5 whitespace-nowrap shrink-0 transition-colors ${
              isMarket ? 'text-white font-semibold' : 'text-slate-300 hover:text-white'
            }`}
          >
            <span>Marketplace</span>
            {isMarket && (
              <span className="absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full bg-[#FACC15]" />
            )}
          </a>

          <a
            href="/categories"
            onClick={(e) => handleNav(e, '/categories')}
            className={`relative py-1.5 whitespace-nowrap shrink-0 transition-colors ${
              isCategories ? 'text-white font-semibold' : 'text-slate-300 hover:text-white'
            }`}
          >
            <span>Categories</span>
            {isCategories && (
              <span className="absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full bg-[#FACC15]" />
            )}
          </a>

          <a
            href="/trade"
            onClick={(e) => handleNav(e, '/trade')}
            className={`relative inline-flex items-center gap-1.5 py-1.5 whitespace-nowrap shrink-0 transition-colors ${
              isTrade ? 'text-white font-semibold' : 'text-slate-300 hover:text-white'
            }`}
          >
            <span>Trade</span>
            <span className="rounded-full border border-[#FACC15]/30 bg-[#FACC15]/10 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[#FACC15]">
              Soon
            </span>
            {isTrade && (
              <span className="absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full bg-[#FACC15]" />
            )}
          </a>

          <a
            href="/marketplace?focus=search"
            onClick={(e) => handleNav(e, '/marketplace?focus=search')}
            className="py-1.5 whitespace-nowrap shrink-0 text-slate-300 hover:text-white transition-colors"
          >
            Search
          </a>

          <button
            type="button"
            onClick={onOpenAdminLock}
            aria-label="Admin (Locked)"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#231E3D] bg-[#131024] px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:border-[#FACC15]/50 hover:text-[#FACC15] transition-colors whitespace-nowrap shrink-0"
          >
            <Lock className="h-3.5 w-3.5 text-[#FACC15]" aria-hidden="true" />
            <span>Admin</span>
          </button>
        </nav>

        <div className="flex items-center gap-2.5 shrink-0">
          <a
            href="/marketplace"
            onClick={(e) => handleNav(e, '/marketplace')}
            className="inline-flex items-center justify-center rounded-lg bg-[#FACC15] px-4 py-2 text-xs sm:text-sm font-bold text-[#0B0917] hover:bg-[#FDE047] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Explore Cards
          </a>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex md:hidden h-10 w-10 items-center justify-center rounded-lg border border-[#231E3D] bg-[#131024] text-slate-200 hover:border-slate-500"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav
          className="md:hidden border-t border-[#231E3D] bg-[#0F0C1F] px-4 py-3 space-y-1"
          aria-label="Mobile Navigation"
        >
          {[
            { label: 'Scan Card', href: '/scan' },
            { label: 'Marketplace', href: '/marketplace' },
            { label: 'Categories', href: '/categories' },
            { label: 'Sell / Trade Your Cards', href: '/trade', soon: true },
            { label: 'Saved Wishlist', href: '/marketplace?wishlist=1' },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={(e) => handleNav(e, item.href)}
              className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-slate-200 hover:bg-[#1B1633] hover:text-white"
            >
              <span>{item.label}</span>
              {item.soon && (
                <span className="rounded-full border border-[#FACC15]/30 bg-[#FACC15]/10 px-2 py-0.5 text-[10px] font-semibold text-[#FACC15]">
                  Soon
                </span>
              )}
            </a>
          ))}

          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              onOpenAdminLock();
            }}
            aria-label="Admin (Locked)"
            className="flex w-full items-center gap-2 rounded-lg border border-[#231E3D] bg-[#131024] px-3 py-2.5 text-left text-sm font-semibold text-[#FACC15] hover:bg-[#1B1633]"
          >
            <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Admin</span>
          </button>
        </nav>
      )}
    </header>
  );
}
