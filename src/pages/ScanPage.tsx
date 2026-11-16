import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  Loader2,
  MessageCircle,
  RotateCcw,
  SlidersHorizontal,
  Upload,
} from 'lucide-react';
import { CornerEditor } from '../components/CornerEditor';
import { CATEGORY_META } from '../config/store';
import { navigateTo } from '../hooks/useRouter';
import { useCatalog } from '../storage/catalogStore';
import type { CardItem, CornerPoint, ScanResult } from '../types/card';
import { formatBdt, formatStockLabel } from '../utils/catalogHelpers';
import { detectInitialCorners, fileToDataUrl, loadImage } from '../vision/perspective';
import { scanCardImage } from '../vision/scannerPipeline';

interface ScanPageProps {
  initialMode?: string | null;
  onOrderCard: (card: CardItem) => void;
}

type ScanStep = 'entry' | 'camera' | 'corners' | 'scanning' | 'result';

export function ScanPage({ initialMode, onOrderCard }: ScanPageProps) {
  const { cards } = useCatalog();
  const [step, setStep] = useState<ScanStep>('entry');
  const [sourceUrl, setSourceUrl] = useState<string>('');
  const [corners, setCorners] = useState<[CornerPoint, CornerPoint, CornerPoint, CornerPoint]>([
    { x: 0.06, y: 0.06 },
    { x: 0.94, y: 0.06 },
    { x: 0.94, y: 0.94 },
    { x: 0.06, y: 0.94 },
  ]);
  const [autoCorners, setAutoCorners] = useState<[CornerPoint, CornerPoint, CornerPoint, CornerPoint]>([
    { x: 0.06, y: 0.06 },
    { x: 0.94, y: 0.06 },
    { x: 0.94, y: 0.94 },
    { x: 0.06, y: 0.94 },
  ]);
  const [scanProgressText, setScanProgressText] = useState<string>('Preparing scanner...');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setStep('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCameraError(
        'Camera access unavailable on this device or blocked by browser permissions. You can upload a photo instead.'
      );
    }
  }, []);

  useEffect(() => {
    if (initialMode === 'camera' && step === 'entry') {
      void startCamera();
    } else if (initialMode === 'upload' && step === 'entry') {
      // keep entry focused with upload highlighted
    }
  }, [initialMode, startCamera, step]);

  const loadPhotoForCorners = useCallback(async (dataUrl: string) => {
    stopCamera();
    const img = await loadImage(dataUrl);
    const initial = detectInitialCorners(img);
    setSourceUrl(dataUrl);
    setCorners(initial);
    setAutoCorners(initial);
    setScanResult(null);
    setStep('corners');
  }, [stopCamera]);

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    const url = await fileToDataUrl(file);
    await loadPhotoForCorners(url);
  };

  const handleCaptureFrame = async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    await loadPhotoForCorners(dataUrl);
  };

  const handleRunScan = async (activeCorners: [CornerPoint, CornerPoint, CornerPoint, CornerPoint]) => {
    if (!sourceUrl) return;
    setCorners(activeCorners);
    setStep('scanning');
    setScanProgressText('Stage 1/4 · Straightening card perspective...');
    try {
      const res = await scanCardImage(sourceUrl, activeCorners, cards, (msg) => {
        setScanProgressText(msg);
      });
      setScanResult(res);
      setStep('result');
    } catch (err) {
      setScanResult({
        status: 'not_found',
        confidence: 0,
        margin: 0,
        usedGemini: false,
        elapsedMs: 0,
        isolatedCropDataUrl: sourceUrl,
        reason: err instanceof Error ? err.message : 'Unable to process image.',
      });
      setStep('result');
    }
  };

  const resetScanner = () => {
    stopCamera();
    setSourceUrl('');
    setScanResult(null);
    setCameraError(null);
    setStep('entry');
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Scanner Header */}
      <div className="mb-8">
        <p className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#22D3EE]">
          <Camera className="h-4 w-4" aria-hidden="true" />
          <span>FLEX Card Scanner · Exact Catalog Match</span>
        </p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl font-extrabold text-white">
          Scan a Trading Card
        </h1>
        <p className="mt-2 max-w-2xl text-sm sm:text-base text-slate-300">
          Take a clear photo or upload an image of a card to find the exact published match in FLEX&apos;s Bangladesh inventory with live BDT (৳) price.
        </p>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Upload card photo"
        onChange={(e) => {
          void handleFileSelected(e.target.files?.[0]);
          e.currentTarget.value = '';
        }}
      />

      {/* Step 1: Entry Two-Column Cards (Matching Reference 2) */}
      {step === 'entry' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {/* Take photo Card */}
            <div className="flex flex-col justify-between rounded-2xl border border-[#22D3EE]/35 bg-[#131024] p-6">
              <div>
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#22D3EE]/35 bg-[#22D3EE]/10 text-[#22D3EE]">
                  <Camera className="h-5 w-5" aria-hidden="true" />
                </div>
                <h2 className="mt-4 font-display text-xl font-bold text-white">Take photo</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  Open your rear camera with a card-shaped guide frame. Place the card flat in even lighting with minimal glare.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void startCamera()}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#22D3EE] px-4 py-3 text-sm font-bold text-[#06202A] hover:bg-[#67E8F9] transition-colors"
              >
                <Camera className="h-4 w-4" aria-hidden="true" />
                <span>Take photo</span>
              </button>
            </div>

            {/* Upload photo Card */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                void handleFileSelected(e.dataTransfer.files?.[0]);
              }}
              className={`flex flex-col justify-between rounded-2xl border bg-[#131024] p-6 transition-colors ${
                dragOver ? 'border-[#FACC15] bg-[#FACC15]/5' : 'border-[#231E3D]'
              }`}
            >
              <div>
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#FACC15]/35 bg-[#FACC15]/10 text-[#FACC15]">
                  <Upload className="h-5 w-5" aria-hidden="true" />
                </div>
                <h2 className="mt-4 font-display text-xl font-bold text-white">Upload photo</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  Choose a JPEG, PNG, or WebP photo from your device or drag and drop it right here.
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FACC15] px-4 py-3 text-sm font-bold text-[#0B0917] hover:bg-[#FDE047] transition-colors"
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                <span>Upload photo</span>
              </button>
            </div>
          </div>

          <p className="border-t border-[#231E3D] pt-4 text-xs leading-relaxed text-slate-500">
            Photos are isolated and cropped in your browser and never stored by FLEX. Matching runs multi-region inner-artwork HOG &amp; keypoint analysis, auto-deskew &amp; glare normalization, in-browser CLIP embeddings, and optional Gemini Vision OCR verification.
          </p>
        </div>
      )}

      {/* Step 2: Camera Capture */}
      {step === 'camera' && (
        <div className="rounded-2xl border border-[#22D3EE]/35 bg-[#131024] p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-lg font-bold text-white">Align Card Inside Frame</h2>
            <button
              type="button"
              onClick={resetScanner}
              className="rounded-lg border border-[#231E3D] px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white"
            >
              Cancel
            </button>
          </div>

          {cameraError ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-200 space-y-4">
              <p>{cameraError}</p>
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  fileInputRef.current?.click();
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-[#FACC15] px-4 py-2.5 text-xs font-bold text-[#0B0917]"
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                <span>Upload Photo Instead</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative mx-auto aspect-[3/4] max-w-md overflow-hidden rounded-xl border border-[#231E3D] bg-black">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className="h-full w-full object-cover"
                />
                {/* Card Alignment Guide Frame */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
                  <div className="aspect-[5/7] h-full max-h-[82%] rounded-xl border-2 border-dashed border-[#22D3EE] shadow-[0_0_0_9999px_rgba(11,9,23,0.45)]" />
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => void handleCaptureFrame()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#22D3EE] px-6 py-3 text-sm font-bold text-[#06202A] hover:bg-[#67E8F9]"
                >
                  <Camera className="h-4 w-4" aria-hidden="true" />
                  <span>Capture Card</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Manual 4-Corner Adjustment (Matching Reference 3) */}
      {step === 'corners' && sourceUrl && (
        <CornerEditor
          imageUrl={sourceUrl}
          initialCorners={corners}
          onResetAuto={() => autoCorners}
          onConfirmCrop={(finalCorners) => void handleRunScan(finalCorners)}
          onBack={resetScanner}
        />
      )}

      {/* Step 4: Fast Scanning Progress */}
      {step === 'scanning' && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-[#22D3EE]/30 bg-[#131024] px-6 py-16 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#22D3EE]" aria-hidden="true" />
          <h2 className="mt-4 font-display text-xl font-bold text-white">Matching Card Artwork</h2>
          <p className="mt-2 text-sm text-slate-300">{scanProgressText}</p>
        </div>
      )}

      {/* Step 5: Verified Match or Strict Card Not Found (Matching Reference 4) */}
      {step === 'result' && scanResult && (
        <div className="space-y-6">
          {scanResult.status === 'matched' && scanResult.card ? (
            <div className="rounded-2xl border border-[#10B981]/45 bg-[#131024] p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-[#10B981]">
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  <span>Verified match</span>
                </span>
                <span className="font-mono-num text-xs text-slate-400">
                  {(scanResult.confidence * 100).toFixed(0)}% match · {(scanResult.elapsedMs / 1000).toFixed(2)}s
                </span>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-12 items-center gap-6">
                <div className="md:col-span-5 flex justify-center">
                  <div className="w-52 sm:w-60 overflow-hidden rounded-2xl border border-[#231E3D] bg-[#0B0917] p-3">
                    <img
                      src={scanResult.card.imageUrl}
                      alt={scanResult.card.name}
                      referrerPolicy="no-referrer"
                      className="aspect-[5/7] w-full rounded-xl object-cover"
                    />
                  </div>
                </div>

                <div className="md:col-span-7 space-y-4">
                  <div className="flex flex-wrap items-center gap-2.5 text-xs">
                    <span
                      className={`rounded-md border px-2.5 py-1 font-semibold ${
                        CATEGORY_META[scanResult.card.category].badgeClass
                      }`}
                    >
                      {scanResult.card.category}
                    </span>
                    <span className="font-mono-num text-slate-400">#{scanResult.card.serial}</span>
                    <span
                      className={`font-semibold ${
                        scanResult.card.stockStatus === 'available'
                          ? 'text-[#10B981]'
                          : scanResult.card.stockStatus === 'sold'
                            ? 'text-amber-400'
                            : 'text-rose-400'
                      }`}
                    >
                      {formatStockLabel(scanResult.card.stockStatus)}
                    </span>
                  </div>

                  <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                    {scanResult.card.name}
                  </h2>

                  <p className="font-mono-num text-3xl font-extrabold text-[#FACC15]">
                    {formatBdt(scanResult.card.priceBdt)}
                  </p>

                  <p className="text-xs text-slate-400">
                    Set: {scanResult.card.setName} · {scanResult.card.rarity} · {scanResult.card.condition}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => onOrderCard(scanResult.card!)}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#10B981] px-5 py-2.5 text-sm font-bold text-[#042318] hover:bg-[#34D399] transition-colors"
                    >
                      <MessageCircle className="h-4 w-4" aria-hidden="true" />
                      <span>How to Order</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => navigateTo(`/card/${encodeURIComponent(scanResult.card!.id)}`)}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#FACC15] px-5 py-2.5 text-sm font-bold text-[#0B0917] hover:bg-[#FDE047] transition-colors"
                    >
                      <span>View Card Details</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-500/45 bg-[#131024] p-6 sm:p-8">
              <div className="flex items-start gap-3">
                <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                  <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="space-y-2">
                  <h2 className="font-display text-2xl font-bold text-white">Card Not Found</h2>
                  <p className="text-sm leading-relaxed text-slate-300">
                    {scanResult.reason}
                  </p>
                  <p className="text-xs text-slate-400">
                    Tip: Drag the 4 yellow corners tightly around the card border, reduce overhead glare, and make sure the full front artwork is visible.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action bar below result (Matching Reference 4) */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={resetScanner}
              className="inline-flex items-center gap-2 rounded-xl bg-[#22D3EE] px-5 py-2.5 text-sm font-bold text-[#06202A] hover:bg-[#67E8F9] transition-colors"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span>Scan Another Card</span>
            </button>

            <button
              type="button"
              onClick={() => setStep('corners')}
              className="inline-flex items-center gap-2 rounded-xl border border-[#231E3D] bg-[#131024] px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-300 hover:border-slate-500 hover:text-white transition-colors"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              <span>Wrong crop? Adjust corners manually</span>
            </button>
          </div>

          <div className="flex items-center gap-3 border-t border-[#231E3D] pt-4 text-xs text-slate-400">
            <span>Isolated crop sent for matching (never stored):</span>
            <img
              src={scanResult.isolatedCropDataUrl}
              alt="Isolated card crop preview"
              className="h-12 w-9 rounded border border-[#231E3D] object-cover"
            />
          </div>
        </div>
      )}
    </div>
  );
}
