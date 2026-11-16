import React, { useState } from 'react';
import { Check, Copy, ExternalLink, MessageCircle, ShieldCheck, Truck, X } from 'lucide-react';
import { STORE_CONFIG } from '../config/store';
import type { CardItem } from '../types/card';
import {
  buildMessengerOrderUrl,
  buildOrderMessage,
  buildWhatsAppOrderUrl,
  formatBdt,
  formatStockLabel,
} from '../utils/catalogHelpers';

interface OrderModalProps {
  card: CardItem | null;
  onClose: () => void;
}

export function OrderModal({ card, onClose }: OrderModalProps) {
  const [copied, setCopied] = useState(false);
  if (!card) return null;

  const orderMessage = buildOrderMessage(card);
  const whatsappUrl = buildWhatsAppOrderUrl(card);
  const messengerUrl = buildMessengerOrderUrl();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(orderMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-modal-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-[#231E3D] bg-[#131024] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-[#22D3EE]">Direct Bangladesh Order</p>
            <h2 id="order-modal-title" className="mt-1 font-display text-xl font-bold text-white">
              Order {card.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#231E3D] text-slate-300 hover:bg-[#1E1938] hover:text-white"
            aria-label="Close order dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-4 rounded-xl border border-[#231E3D] bg-[#0B0917] p-3.5">
          <img
            src={card.imageUrl}
            alt={card.name}
            referrerPolicy="no-referrer"
            className="h-20 w-14 rounded-lg object-cover border border-white/10 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>{card.category}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num">#{card.serial}</span>
              <span aria-hidden="true">·</span>
              <span
                className={
                  card.stockStatus === 'available'
                    ? 'text-[#10B981]'
                    : card.stockStatus === 'sold'
                      ? 'text-amber-400'
                      : 'text-rose-400'
                }
              >
                {formatStockLabel(card.stockStatus, true)}
              </span>
            </div>
            <p className="mt-1 truncate font-semibold text-white">{card.name}</p>
            <p className="mt-1 font-mono-num text-lg font-bold text-[#FACC15]">
              {formatBdt(card.priceBdt)}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-xs text-slate-300">
          <div className="rounded-xl border border-[#231E3D] bg-[#0B0917]/70 p-3">
            <div className="flex items-center gap-2 font-semibold text-white">
              <Truck className="h-4 w-4 text-[#22D3EE]" aria-hidden="true" />
              <span>Bangladesh Delivery</span>
            </div>
            <p className="mt-1.5 text-slate-400">
              Dhaka: ৳{STORE_CONFIG.deliveryInfo.dhakaCharge} · Outside Dhaka: ৳{STORE_CONFIG.deliveryInfo.outsideDhakaCharge}
            </p>
            <p className="mt-0.5 text-[#10B981]">
              Free delivery over ৳{STORE_CONFIG.deliveryInfo.freeDeliveryThreshold.toLocaleString()}
            </p>
          </div>

          <div className="rounded-xl border border-[#231E3D] bg-[#0B0917]/70 p-3">
            <div className="flex items-center gap-2 font-semibold text-white">
              <ShieldCheck className="h-4 w-4 text-[#10B981]" aria-hidden="true" />
              <span>Payment Options</span>
            </div>
            <p className="mt-1.5 text-slate-400">
              {STORE_CONFIG.deliveryInfo.paymentMethods.join(' · ')}
            </p>
            <p className="mt-0.5 text-slate-400">Sleeved & top-loaded before dispatch</p>
          </div>
        </div>

        <div className="mt-5 space-y-2.5">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#10B981] px-4 py-3 text-sm font-bold text-[#042318] hover:bg-[#34D399] transition-colors"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            <span>Order via WhatsApp (Pre-filled)</span>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>

          <div className="grid grid-cols-2 gap-2.5">
            <a
              href={messengerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl border border-[#231E3D] bg-[#1B1633] px-3 py-2.5 text-xs font-semibold text-white hover:border-[#22D3EE]/60 transition-colors"
            >
              <span>Order via Messenger</span>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>

            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 rounded-xl border border-[#231E3D] bg-[#0B0917] px-3 py-2.5 text-xs font-semibold text-slate-200 hover:border-slate-500 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[#10B981]" aria-hidden="true" />
                  <span>Copied Details</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Copy Order Text</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
