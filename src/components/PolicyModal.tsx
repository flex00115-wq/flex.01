import React from 'react';
import { X } from 'lucide-react';
import { STORE_CONFIG } from '../config/store';

interface PolicyModalProps {
  doc: 'privacy' | 'terms' | 'how-to-order' | null;
  onClose: () => void;
}

export function PolicyModal({ doc, onClose }: PolicyModalProps) {
  if (!doc) return null;

  const title =
    doc === 'privacy'
      ? 'Privacy Policy'
      : doc === 'terms'
        ? 'Terms & IP Disclaimer'
        : 'How to Order in Bangladesh';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="policy-modal-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-[#231E3D] bg-[#131024] p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-[#231E3D] pb-3">
          <h2 id="policy-modal-title" className="font-display text-lg font-bold text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#231E3D] text-slate-300 hover:text-white"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-300">
          {doc === 'privacy' && (
            <>
              <p>
                FLEX processes visual card scans locally inside your browser using perspective cropping and perceptual matching. Customer scan photos are never stored on our servers.
              </p>
              <p>
                Trade requests and wishlist bookmarks submitted in the browser are stored locally unless you message our team directly via WhatsApp or Messenger.
              </p>
            </>
          )}

          {doc === 'terms' && (
            <>
              <p>
                All listed card prices are fixed in Bangladeshi Taka (BDT ৳) by FLEX Bangladesh. Delivery is available across all 64 districts of Bangladesh.
              </p>
              <p>
                Trading card artwork, character names, and franchises (Pokemon, Football, Naruto, Demon Slayer, Free Fire) belong to their respective trademark holders and are displayed solely for collector identification and resale.
              </p>
            </>
          )}

          {doc === 'how-to-order' && (
            <>
              <p>
                1. Find your card in the Marketplace or scan a physical card with our Visual Scanner to view its exact fixed BDT (৳) price and `#Serial`.
              </p>
              <p>
                2. Click <strong>How to Order</strong> on any card to send a pre-filled order message via WhatsApp or Messenger.
              </p>
              <p>
                3. Choose Cash on Delivery (COD), bKash, or Nagad. Dhaka delivery is ৳{STORE_CONFIG.deliveryInfo.dhakaCharge}; outside Dhaka is ৳{STORE_CONFIG.deliveryInfo.outsideDhakaCharge}. Orders over ৳{STORE_CONFIG.deliveryInfo.freeDeliveryThreshold.toLocaleString()} ship free!
              </p>
            </>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#FACC15] px-4 py-2 text-xs font-bold text-[#0B0917] hover:bg-[#FDE047]"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
