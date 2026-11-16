import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw, ScanLine, SlidersHorizontal, ArrowLeft } from 'lucide-react';
import type { CornerPoint } from '../types/card';

interface CornerEditorProps {
  imageUrl: string;
  initialCorners: [CornerPoint, CornerPoint, CornerPoint, CornerPoint];
  onResetAuto: () => [CornerPoint, CornerPoint, CornerPoint, CornerPoint];
  onConfirmCrop: (corners: [CornerPoint, CornerPoint, CornerPoint, CornerPoint]) => void;
  onBack: () => void;
}

export function CornerEditor({
  imageUrl,
  initialCorners,
  onResetAuto,
  onConfirmCrop,
  onBack,
}: CornerEditorProps) {
  const [corners, setCorners] = useState<[CornerPoint, CornerPoint, CornerPoint, CornerPoint]>(initialCorners);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCorners(initialCorners);
  }, [initialCorners]);

  const updatePointerCorner = useCallback((clientX: number, clientY: number, idx: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const nx = Math.max(0.01, Math.min(0.99, (clientX - rect.left) / rect.width));
    const ny = Math.max(0.01, Math.min(0.99, (clientY - rect.top) / rect.height));

    setCorners((prev) => {
      const next = [...prev] as [CornerPoint, CornerPoint, CornerPoint, CornerPoint];
      next[idx] = { x: Number(nx.toFixed(4)), y: Number(ny.toFixed(4)) };
      return next;
    });
  }, []);

  useEffect(() => {
    if (draggingIdx === null) return;

    const onPointerMove = (e: PointerEvent) => {
      e.preventDefault();
      updatePointerCorner(e.clientX, e.clientY, draggingIdx);
    };
    const onPointerUp = () => {
      setDraggingIdx(null);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [draggingIdx, updatePointerCorner]);

  const polygonPoints = corners.map((c) => `${c.x * 100},${c.y * 100}`).join(' ');

  return (
    <div className="rounded-2xl border border-[#FACC15]/30 bg-[#131024] p-5 sm:p-7">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
            <SlidersHorizontal className="h-5 w-5 text-[#FACC15]" aria-hidden="true" />
            <span>Adjust Card Corners</span>
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Drag the 4 yellow handles to the 4 outer corners of the card so background items are cropped out cleanly.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCorners(onResetAuto())}
          className="inline-flex items-center gap-1.5 self-start rounded-lg border border-[#231E3D] bg-[#0B0917] px-3 py-2 text-xs font-medium text-slate-200 hover:border-slate-500 transition-colors whitespace-nowrap"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Reset Corners</span>
        </button>
      </div>

      <div className="mt-6 flex justify-center">
        <div
          ref={containerRef}
          data-testid="corner-editor-stage"
          className="relative inline-block max-w-sm w-full select-none overflow-hidden rounded-xl border border-[#231E3D] bg-[#0B0917] touch-none"
        >
          <img
            src={imageUrl}
            alt="Card photo ready for 4-corner perspective crop"
            className="block w-full h-auto max-h-[390px] object-contain pointer-events-none select-none"
            draggable={false}
          />

          {/* Connecting yellow crop quadrilateral overlay */}
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            <polygon
              points={polygonPoints}
              fill="rgba(250, 204, 21, 0.08)"
              stroke="#FACC15"
              strokeWidth="0.9"
              strokeLinejoin="round"
            />
          </svg>

          {/* 4 draggable numbered yellow handles (1, 2, 3, 4) */}
          {corners.map((corner, idx) => (
            <button
              key={idx}
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                setDraggingIdx(idx);
              }}
              style={{
                left: `${corner.x * 100}%`,
                top: `${corner.y * 100}%`,
              }}
              aria-label={`Corner handle ${idx + 1}`}
              className={`absolute -translate-x-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#0B0917] bg-[#FACC15] font-mono-num text-xs font-extrabold text-[#0B0917] shadow-lg transition-transform ${
                draggingIdx === idx ? 'scale-125 ring-4 ring-[#FACC15]/40 cursor-grabbing' : 'hover:scale-110 cursor-grab'
              }`}
            >
              {idx + 1}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#231E3D] pt-5">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-[#231E3D] bg-[#0B0917] px-4 py-2.5 text-sm font-medium text-slate-300 hover:border-slate-500 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Choose Different Photo</span>
        </button>

        <button
          type="button"
          onClick={() => onConfirmCrop(corners)}
          className="inline-flex items-center gap-2 rounded-xl bg-[#22D3EE] px-6 py-3 text-sm font-bold text-[#06202A] hover:bg-[#67E8F9] transition-colors shadow-lg"
        >
          <ScanLine className="h-4 w-4" aria-hidden="true" />
          <span>Scan &amp; Match Card</span>
        </button>
      </div>
    </div>
  );
}
