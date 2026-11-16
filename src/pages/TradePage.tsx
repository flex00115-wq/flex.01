import React from 'react';
import { ArrowRight, Camera, Clock, Repeat } from 'lucide-react';
import { navigateTo } from '../hooks/useRouter';

export function TradePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12 space-y-8">
      <div>
        <p className="inline-flex items-center gap-2 text-xs font-semibold text-[#22D3EE]">
          <Repeat className="h-4 w-4" aria-hidden="true" />
          <span>FLEX Collector Buyback &amp; Trade</span>
        </p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl font-extrabold text-white [text-wrap:balance]">
          Sell / Trade Your Cards
        </h1>
      </div>

      <section
        aria-labelledby="trade-coming-soon-heading"
        className="rounded-2xl border border-[#231E3D] bg-[#131024] p-6 sm:p-10 space-y-5"
      >
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FACC15]/35 bg-[#FACC15]/10 px-3 py-1 text-xs font-semibold text-[#FACC15]">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Coming Soon</span>
        </span>

        <div className="space-y-2.5">
          <h2
            id="trade-coming-soon-heading"
            className="font-display text-2xl sm:text-3xl font-extrabold text-white [text-wrap:balance]"
          >
            Sell &amp; Trade Feature Coming Soon
          </h2>
          <p className="max-w-xl text-sm sm:text-base leading-relaxed text-slate-300">
            We are currently upgrading our collector buyback &amp; trade system. For now, please use
            Scan or Explore Cards to check prices and order directly.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigateTo('/marketplace')}
            className="inline-flex items-center gap-2 rounded-xl bg-[#FACC15] px-5 py-3 text-sm font-bold text-[#0B0917] hover:bg-[#FDE047] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <span>Explore Cards</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => navigateTo('/scan')}
            className="inline-flex items-center gap-2 rounded-xl bg-[#22D3EE] px-5 py-3 text-sm font-bold text-[#06202A] hover:bg-[#67E8F9] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <Camera className="h-4 w-4" aria-hidden="true" />
            <span>Scan a Card</span>
          </button>
        </div>
      </section>
    </div>
  );
}
