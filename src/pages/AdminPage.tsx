import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Download,
  Edit3,
  KeyRound,
  Layers,
  Lock,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { CARD_CATEGORIES } from '../config/store';
import { navigateTo } from '../hooks/useRouter';
import { useCatalog } from '../storage/catalogStore';
import {
  ADMIN_SESSION_KEY,
  changeAdminPassword,
  hydrateAdminPasswordFromDb,
  verifyAdminPassword,
} from '../utils/adminAuth';
import type {
  CardCategory,
  CardCondition,
  CardItem,
  CardRarity,
  PublishStatus,
  StockStatus,
} from '../types/card';
import {
  createCatalogBundle,
  deriveCardNameFromFilename,
  filterAdminCards,
  formatBdt,
  getNextSerialNumber,
  getNextSortOrder,
  parseCatalogBundle,
} from '../utils/catalogHelpers';
import { computeCardFingerprint } from '../vision/perceptualHash';
import { compressCardImage } from '../vision/perspective';

type AdminTab = 'inventory' | 'trades' | 'bundle' | 'settings';
type PriorityUploadPanel = 'none' | 'single' | 'bulk';

const RARITIES: readonly CardRarity[] = [
  'Common',
  'Rare',
  'Holo Rare',
  'Ultra Rare',
  'Secret Gold',
  'Mythic',
];

export function AdminPage() {
  const {
    cards,
    tradeRequests,
    fingerprintingProgress,
    addCard,
    addManyCards,
    updateCard,
    bulkUpdateCards,
    moveCardOrder,
    deleteCard,
    replaceCatalog,
    resetToSeedCatalog,
    updateTradeStatus,
  } = useCatalog();

  const [authed, setAuthed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(ADMIN_SESSION_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [passcode, setPasscode] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    void hydrateAdminPasswordFromDb();
    try {
      setAuthed(sessionStorage.getItem(ADMIN_SESSION_KEY) === '1');
    } catch {
      setAuthed(false);
    }
  }, []);

  const [activeTab, setActiveTab] = useState<AdminTab>('inventory');
  const [uploadPanel, setUploadPanel] = useState<PriorityUploadPanel>('single');

  // Change Admin Password Settings state
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');

  // Inventory Filters & Pagination
  const [query, setQuery] = useState('');
  const [filterCat, setFilterCat] = useState<CardCategory | 'All'>('All');
  const [filterPublish, setFilterPublish] = useState<PublishStatus | 'All'>('All');
  const [filterStock, setFilterStock] = useState<StockStatus | 'All'>('All');
  const [unpricedOnly, setUnpricedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Selection, Bulk Price & Status Banner
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkPriceInput, setBulkPriceInput] = useState('');
  const [statusBanner, setStatusBanner] = useState<string>('');
  const [savedRowIds, setSavedRowIds] = useState<Record<string, boolean>>({});
  const [editingCard, setEditingCard] = useState<CardItem | null>(null);

  // Refs for rapid Enter-to-save-and-jump price input focus
  const priceInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Single Upload state
  const [singleName, setSingleName] = useState('');
  const [singleCategory, setSingleCategory] = useState<CardCategory>('Pokemon');
  const [singlePrice, setSinglePrice] = useState('');
  const [singlePublish, setSinglePublish] = useState<PublishStatus>('published');
  const [singleStock, setSingleStock] = useState<StockStatus>('available');
  const [singleSet, setSingleSet] = useState('Promo');
  const [singleRarity, setSingleRarity] = useState<CardRarity>('Holo Rare');
  const [singleCondition, setSingleCondition] = useState<CardCondition>('Mint');
  const [singleImageUrl, setSingleImageUrl] = useState('');
  const [singleBusy, setSingleBusy] = useState(false);

  // Bulk Upload state
  const [bulkCategory, setBulkCategory] = useState<CardCategory>('Pokemon');
  const [bulkPublish, setBulkPublish] = useState<PublishStatus>('draft');
  const [bulkStock, setBulkStock] = useState<StockStatus>('available');
  const [bulkSet, setBulkSet] = useState('Bulk Drop 2026');
  const [bulkRarity, setBulkRarity] = useState<CardRarity>('Rare');
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  const importInputRef = useRef<HTMLInputElement | null>(null);

  const filteredCards = useMemo(
    () =>
      filterAdminCards(cards, {
        query,
        category: filterCat,
        publishStatus: filterPublish,
        stockStatus: filterStock,
        unpricedOnly,
      }),
    [cards, query, filterCat, filterPublish, filterStock, unpricedOnly]
  );

  const totalPages = Math.max(1, Math.ceil(filteredCards.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageCards = useMemo(
    () => filteredCards.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filteredCards, safePage, pageSize]
  );

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyAdminPassword(passcode)) {
      try {
        sessionStorage.setItem(ADMIN_SESSION_KEY, '1');
      } catch {
        // ignore
      }
      setAuthed(true);
      setLoginError('');
    } else {
      setLoginError('Incorrect owner password.');
    }
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');
    const result = changeAdminPassword({
      currentPassword: currentPwd,
      newPassword: newPwd,
      confirmPassword: confirmPwd,
    });
    if (result.ok === false) {
      setPwdError(result.error);
      return;
    }
    setCurrentPwd('');
    setNewPwd('');
    setConfirmPwd('');
    setPwdSuccess('Admin password updated. Use your new password next time you unlock FLEX Admin.');
    setStatusBanner('Owner Admin password updated.');
  };

  const handleLogout = () => {
    try {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
    } catch {
      // ignore
    }
    setAuthed(false);
    setPasscode('');
    navigateTo('/');
  };

  const markRowSaved = (id: string) => {
    setSavedRowIds((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setSavedRowIds((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }, 2200);
  };

  const toggleSelectAllPage = (checked: boolean) => {
    const pageIds = pageCards.map((c) => c.id);
    if (checked) {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    } else {
      const pageSet = new Set(pageIds);
      setSelectedIds((prev) => prev.filter((id) => !pageSet.has(id)));
    }
  };

  const handleBulkAction = async (
    label: string,
    patch: Partial<CardItem>
  ) => {
    if (selectedIds.length === 0) return;
    const res = await bulkUpdateCards(selectedIds, patch);
    setStatusBanner(`${label}: ${res.succeeded} succeeded, ${res.failed} failed.`);
  };

  const handleInlinePriceCommit = async (
    card: CardItem,
    rawValue: string,
    jumpToNextRow: boolean
  ) => {
    const parsed = rawValue.trim() === '' ? null : Math.max(0, Math.round(Number(rawValue)));
    const normalized = parsed !== null && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    if (normalized !== card.priceBdt) {
      await updateCard(card.id, { priceBdt: normalized });
      markRowSaved(card.id);
    }
    if (jumpToNextRow) {
      const idx = pageCards.findIndex((c) => c.id === card.id);
      const nextCard = pageCards[idx + 1];
      if (nextCard) {
        const nextInput = priceInputRefs.current[nextCard.id];
        nextInput?.focus();
        nextInput?.select();
      }
    }
  };

  const handleExportCatalog = () => {
    const bundle = createCatalogBundle(cards);
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'catalog.json';
    a.click();
    URL.revokeObjectURL(url);
    setStatusBanner(`Exported catalog.json (${cards.length} cards). Place in public/catalog.json before publishing.`);
  };

  const handleImportCatalog = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const imported = parseCatalogBundle(text);
      await replaceCatalog(imported);
      setStatusBanner(`Imported ${imported.length} cards from ${file.name}.`);
      setActiveTab('inventory');
    } catch (err) {
      setStatusBanner(err instanceof Error ? err.message : 'Failed to import catalog JSON.');
    }
  };

  const handleSingleFile = async (file: File | undefined) => {
    if (!file) return;
    const webp = await compressCardImage(file, 520, 0.84);
    setSingleImageUrl(webp);
    if (!singleName.trim()) {
      setSingleName(deriveCardNameFromFilename(file.name, getNextSerialNumber(cards)));
    }
  };

  const handleCreateSingleCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleName.trim() || !singleImageUrl) {
      setStatusBanner('Please provide both a card image and card name.');
      return;
    }
    setSingleBusy(true);
    try {
      const serial = getNextSerialNumber(cards);
      const sortOrder = getNextSortOrder(cards);
      const fp = await computeCardFingerprint(singleImageUrl);
      const now = new Date().toISOString();
      const newCard: CardItem = {
        id: `flex-card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        serial,
        name: singleName.trim(),
        category: singleCategory,
        priceBdt: singlePrice ? Math.max(1, Math.round(Number(singlePrice))) : null,
        publishStatus: singlePublish,
        stockStatus: singleStock,
        sortOrder,
        setName: singleSet.trim() || 'Promo',
        rarity: singleRarity,
        condition: singleCondition,
        imageUrl: singleImageUrl,
        fingerprint: fp,
        createdAt: now,
        updatedAt: now,
      };
      await addCard(newCard);
      setSingleName('');
      setSinglePrice('');
      setSingleImageUrl('');
      setStatusBanner(`Added #${serial} "${newCard.name}" to inventory.`);
      setActiveTab('inventory');
    } finally {
      setSingleBusy(false);
    }
  };

  const handleBulkUploadFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setBulkProgress({ done: 0, total: files.length });

    let nextSerial = getNextSerialNumber(cards);
    let nextOrder = getNextSortOrder(cards);
    const created: CardItem[] = [];
    const now = new Date().toISOString();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const compressed = await compressCardImage(file, 520, 0.84);
        const fp = await computeCardFingerprint(compressed);
        const serial = nextSerial++;
        const sortOrder = nextOrder++;
        created.push({
          id: `flex-bulk-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          serial,
          name: deriveCardNameFromFilename(file.name, serial),
          category: bulkCategory,
          priceBdt: null,
          publishStatus: bulkPublish,
          stockStatus: bulkStock,
          sortOrder,
          setName: bulkSet.trim() || 'Bulk Drop 2026',
          rarity: bulkRarity,
          condition: 'Mint',
          imageUrl: compressed,
          fingerprint: fp,
          createdAt: now,
          updatedAt: now,
        });
      } catch {
        // skip unreadable file
      }
      setBulkProgress({ done: i + 1, total: files.length });
    }

    if (created.length > 0) {
      await addManyCards(created);
      setStatusBanner(
        `Bulk upload complete: ${created.length} cards added (#${created[0].serial} – #${created[created.length - 1].serial}).`
      );
      setActiveTab('inventory');
    }
    setBulkProgress(null);
  };

  if (!authed) {
    return (
      <div className="mx-auto flex min-h-[75vh] max-w-md items-center px-4 py-12">
        <form
          onSubmit={handleLogin}
          className="w-full rounded-2xl border border-[#231E3D] bg-[#131024] p-7 space-y-5 shadow-2xl"
        >
          <div className="flex items-center gap-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#FACC15]/40 bg-[#FACC15]/10 text-[#FACC15]">
              <Lock className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-white">FLEX Team Access</h1>
              <p className="text-xs text-slate-400">Protected inventory &amp; pricing portal</p>
            </div>
          </div>

          {loginError && (
            <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {loginError}
            </p>
          )}

          <div>
            <label htmlFor="admin-passcode" className="block text-xs font-semibold text-slate-300 mb-1.5">
              Team Passcode
            </label>
            <input
              id="admin-passcode"
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter team passcode"
              autoFocus
              className="w-full rounded-xl border border-[#231E3D] bg-[#0B0917] px-3.5 py-2.5 text-sm text-white focus:border-[#FACC15] focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={() => navigateTo('/')}
              className="text-xs text-slate-400 hover:text-white"
            >
              ← Return to storefront
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[#FACC15] px-5 py-2.5 text-sm font-bold text-[#0B0917] hover:bg-[#FDE047]"
            >
              Unlock Console
            </button>
          </div>
        </form>
      </div>
    );
  }

  const allOnPageSelected =
    pageCards.length > 0 && pageCards.every((c) => selectedIds.includes(c.id));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-6">
      {/* Top Admin Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#231E3D] pb-5">
        <div>
          <p className="text-xs font-semibold text-[#22D3EE]">
            FLEX Inventory Control · {cards.length} Total Cards
          </p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold text-white">
            Catalog &amp; Pricing Console
          </h1>
          {fingerprintingProgress && (
            <p className="mt-1 text-xs text-[#22D3EE]">
              Indexing visual fingerprints: {fingerprintingProgress.done} / {fingerprintingProgress.total}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCatalog}
            className="inline-flex items-center gap-2 rounded-xl border border-[#22D3EE]/40 bg-[#22D3EE]/10 px-3.5 py-2 text-xs font-semibold text-[#22D3EE] hover:bg-[#22D3EE]/20"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Export Catalog Bundle (catalog.json)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#231E3D] bg-[#131024] px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-[#22D3EE]/50 hover:text-[#22D3EE]"
          >
            <Settings className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Change Password</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#231E3D] bg-[#131024] px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-[#FACC15]/50 hover:text-[#FACC15]"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Lock / Logout</span>
          </button>
        </div>
      </div>

      {/* Admin Secondary Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: 'inventory', label: `Inventory & Uploads (${cards.length})` },
          { id: 'trades', label: `Trade Requests (${tradeRequests.length})` },
          { id: 'bundle', label: 'Export / Import Bundle' },
          { id: 'settings', label: 'Settings' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as AdminTab)}
            className={`rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-[#FACC15] text-[#0B0917]'
                : 'border border-[#231E3D] bg-[#131024] text-slate-300 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Cyan Status Banner */}
      {statusBanner && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border border-[#22D3EE]/45 bg-[#0C202E] px-4 py-3 text-sm font-medium text-[#22D3EE]"
        >
          <span>{statusBanner}</span>
          <button
            type="button"
            onClick={() => setStatusBanner('')}
            aria-label="Dismiss status banner"
            className="text-slate-300 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* TAB 1: PRIORITY UPLOADS + RAPID INLINE PRICING INVENTORY TABLE */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          {/* Two Prominent High-Priority Upload Cards Right Above the Table */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setUploadPanel((prev) => (prev === 'single' ? 'none' : 'single'))}
              aria-expanded={uploadPanel === 'single'}
              className={`flex items-start justify-between gap-4 rounded-2xl border p-5 text-left transition-colors ${
                uploadPanel === 'single'
                  ? 'border-[#FACC15] bg-[#1C1633]'
                  : 'border-[#231E3D] bg-[#131024] hover:border-[#FACC15]/50'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#FACC15]/40 bg-[#FACC15]/15 text-[#FACC15]">
                  <Plus className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-base font-bold text-white">Single Card Upload</h2>
                    <span className="rounded bg-[#FACC15]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#FACC15]">
                      Fast List
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Upload 1 card (English/বাংলা name, Category, Price ৳, Stock, Publish, Rarity/Set) and list it right into the table below.
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-lg border border-[#231E3D] bg-[#0B0917] px-2.5 py-1 text-xs font-semibold text-[#FACC15]">
                {uploadPanel === 'single' ? 'Hide' : 'Open'}
              </span>
            </button>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                setUploadPanel('bulk');
                void handleBulkUploadFiles(e.dataTransfer.files);
              }}
              className={`flex items-start justify-between gap-4 rounded-2xl border p-5 transition-colors ${
                uploadPanel === 'bulk'
                  ? 'border-[#22D3EE] bg-[#121D30]'
                  : 'border-[#231E3D] bg-[#131024] hover:border-[#22D3EE]/50'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#22D3EE]/40 bg-[#22D3EE]/15 text-[#22D3EE]">
                  <Layers className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-base font-bold text-white">Bulk Upload (100+ Cards)</h2>
                    <span className="rounded bg-[#22D3EE]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#22D3EE]">
                      Auto Serial
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Drag &amp; drop 100+ images at once. Auto-assigns sequential Serials (#{getNextSerialNumber(cards)}, #{getNextSerialNumber(cards) + 1}...) and loads straight into the table for rapid pricing.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUploadPanel((prev) => (prev === 'bulk' ? 'none' : 'bulk'))}
                aria-expanded={uploadPanel === 'bulk'}
                className="shrink-0 rounded-lg border border-[#231E3D] bg-[#0B0917] px-2.5 py-1 text-xs font-semibold text-[#22D3EE] hover:border-[#22D3EE]/50"
              >
                {uploadPanel === 'bulk' ? 'Hide' : 'Open'}
              </button>
            </div>
          </div>

          {/* Expanded Single Card Upload Form */}
          {uploadPanel === 'single' && (
            <form
              onSubmit={(e) => void handleCreateSingleCard(e)}
              className="rounded-2xl border border-[#FACC15]/35 bg-[#131024] p-5 sm:p-6 space-y-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-bold text-white">Single Card Upload</h3>
                  <p className="text-xs text-slate-400">
                    Auto-compresses photo to WebP &amp; indexes visual fingerprint immediately as Serial #{getNextSerialNumber(cards)}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setUploadPanel('none')}
                  aria-label="Close single card upload panel"
                  className="rounded-lg border border-[#231E3D] p-1.5 text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="sm:col-span-2 lg:col-span-4">
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Card Front Image *</label>
                  <div className="flex items-center gap-4">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#231E3D] bg-[#0B0917] px-4 py-2 text-xs font-semibold text-slate-200 hover:border-[#22D3EE]">
                      <Upload className="h-4 w-4 text-[#22D3EE]" aria-hidden="true" />
                      <span>{singleImageUrl ? 'Replace Card Image' : 'Select Card Image'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => void handleSingleFile(e.target.files?.[0])}
                      />
                    </label>
                    {singleImageUrl && (
                      <img
                        src={singleImageUrl}
                        alt="Single card preview"
                        className="h-14 w-10 rounded-lg border border-[#231E3D] object-cover"
                      />
                    )}
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="single-name" className="block text-xs font-semibold text-slate-300 mb-1">
                    Card Name (English / বাংলা) *
                  </label>
                  <input
                    id="single-name"
                    type="text"
                    required
                    value={singleName}
                    onChange={(e) => setSingleName(e.target.value)}
                    placeholder="e.g. Pikachu EX — পিকাচু হলোগ্রাফিক"
                    className="w-full rounded-xl border border-[#231E3D] bg-[#0B0917] px-3 py-2 text-sm text-white focus:border-[#22D3EE] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="single-cat" className="block text-xs font-semibold text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    id="single-cat"
                    value={singleCategory}
                    onChange={(e) => setSingleCategory(e.target.value as CardCategory)}
                    className="w-full rounded-xl border border-[#231E3D] bg-[#0B0917] px-3 py-2 text-sm text-white"
                  >
                    {CARD_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="single-price" className="block text-xs font-semibold text-slate-300 mb-1">
                    Price BDT (৳)
                  </label>
                  <input
                    id="single-price"
                    type="number"
                    min={0}
                    value={singlePrice}
                    onChange={(e) => setSinglePrice(e.target.value)}
                    placeholder="Leave blank if unpriced"
                    className="w-full rounded-xl border border-[#231E3D] bg-[#0B0917] px-3 py-2 font-mono-num text-sm text-[#FACC15]"
                  />
                </div>

                <div>
                  <label htmlFor="single-stock" className="block text-xs font-semibold text-slate-300 mb-1">
                    Stock Status
                  </label>
                  <select
                    id="single-stock"
                    value={singleStock}
                    onChange={(e) => setSingleStock(e.target.value as StockStatus)}
                    className="w-full rounded-xl border border-[#231E3D] bg-[#0B0917] px-3 py-2 text-sm text-white"
                  >
                    <option value="available">available</option>
                    <option value="sold">sold</option>
                    <option value="out_of_stock">out_of_stock</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="single-publish" className="block text-xs font-semibold text-slate-300 mb-1">
                    Publish Status
                  </label>
                  <select
                    id="single-publish"
                    value={singlePublish}
                    onChange={(e) => setSinglePublish(e.target.value as PublishStatus)}
                    className="w-full rounded-xl border border-[#231E3D] bg-[#0B0917] px-3 py-2 text-sm text-white"
                  >
                    <option value="published">published</option>
                    <option value="draft">draft</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="single-rarity" className="block text-xs font-semibold text-slate-300 mb-1">
                    Rarity
                  </label>
                  <select
                    id="single-rarity"
                    value={singleRarity}
                    onChange={(e) => setSingleRarity(e.target.value as CardRarity)}
                    className="w-full rounded-xl border border-[#231E3D] bg-[#0B0917] px-3 py-2 text-sm text-white"
                  >
                    {RARITIES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="single-set" className="block text-xs font-semibold text-slate-300 mb-1">
                    Set Name
                  </label>
                  <input
                    id="single-set"
                    type="text"
                    value={singleSet}
                    onChange={(e) => setSingleSet(e.target.value)}
                    className="w-full rounded-xl border border-[#231E3D] bg-[#0B0917] px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div>
                  <label htmlFor="single-condition" className="sr-only">Condition</label>
                  <select
                    id="single-condition"
                    value={singleCondition}
                    onChange={(e) => setSingleCondition(e.target.value as CardCondition)}
                    className="rounded-xl border border-[#231E3D] bg-[#0B0917] px-3 py-2 text-xs text-slate-300"
                  >
                    <option value="Mint">Condition: Mint</option>
                    <option value="Near Mint">Condition: Near Mint</option>
                    <option value="Lightly Played">Condition: Lightly Played</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={singleBusy}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#FACC15] px-5 py-2.5 text-sm font-bold text-[#0B0917] hover:bg-[#FDE047] disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>{singleBusy ? 'Saving & Fingerprinting...' : 'List Card Now'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Expanded Bulk Upload (100+ Cards) Panel */}
          {uploadPanel === 'bulk' && (
            <div className="rounded-2xl border border-[#22D3EE]/35 bg-[#131024] p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-bold text-white">Bulk Upload (100+ Cards)</h3>
                  <p className="text-xs text-slate-400">
                    Drop 100+ card photos simultaneously. Assigns sequential Serials starting at #{getNextSerialNumber(cards)} and loads into the table below.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setUploadPanel('none')}
                  aria-label="Close bulk upload panel"
                  className="rounded-lg border border-[#231E3D] p-1.5 text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Category</label>
                  <select
                    value={bulkCategory}
                    onChange={(e) => setBulkCategory(e.target.value as CardCategory)}
                    className="w-full rounded-xl border border-[#231E3D] bg-[#0B0917] px-2.5 py-2 text-xs text-white"
                  >
                    {CARD_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Initial Publish</label>
                  <select
                    value={bulkPublish}
                    onChange={(e) => setBulkPublish(e.target.value as PublishStatus)}
                    className="w-full rounded-xl border border-[#231E3D] bg-[#0B0917] px-2.5 py-2 text-xs text-white"
                  >
                    <option value="draft">draft (price first)</option>
                    <option value="published">published</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Initial Stock</label>
                  <select
                    value={bulkStock}
                    onChange={(e) => setBulkStock(e.target.value as StockStatus)}
                    className="w-full rounded-xl border border-[#231E3D] bg-[#0B0917] px-2.5 py-2 text-xs text-white"
                  >
                    <option value="available">available</option>
                    <option value="sold">sold</option>
                    <option value="out_of_stock">out_of_stock</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Rarity</label>
                  <select
                    value={bulkRarity}
                    onChange={(e) => setBulkRarity(e.target.value as CardRarity)}
                    className="w-full rounded-xl border border-[#231E3D] bg-[#0B0917] px-2.5 py-2 text-xs text-white"
                  >
                    {RARITIES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Set Name</label>
                  <input
                    type="text"
                    value={bulkSet}
                    onChange={(e) => setBulkSet(e.target.value)}
                    className="w-full rounded-xl border border-[#231E3D] bg-[#0B0917] px-2.5 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <label
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void handleBulkUploadFiles(e.dataTransfer.files);
                }}
                className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#22D3EE]/45 bg-[#0B0917] px-6 py-8 text-center cursor-pointer hover:border-[#22D3EE] transition-colors"
              >
                <Upload className="h-7 w-7 text-[#22D3EE]" aria-hidden="true" />
                <span className="mt-2 font-display text-sm font-bold text-white">
                  Click or Drag &amp; Drop 100+ Card Images Here
                </span>
                <span className="mt-1 text-xs text-slate-400">
                  JPEG, PNG, WebP supported · Sequential Serials &amp; instant table pricing
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => void handleBulkUploadFiles(e.target.files)}
                />
              </label>

              {bulkProgress && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-[#22D3EE]">
                    <span>Compressing &amp; indexing cards...</span>
                    <span className="font-mono-num">
                      {bulkProgress.done} / {bulkProgress.total}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#0B0917]">
                    <div
                      className="h-full bg-[#22D3EE] transition-all"
                      style={{ width: `${Math.round((bulkProgress.done / bulkProgress.total) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Top Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#231E3D] bg-[#131024] p-4">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search name or #serial..."
                aria-label="Search inventory by name or serial"
                className="w-full rounded-xl border border-[#231E3D] bg-[#0B0917] py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-[#22D3EE] focus:outline-none"
              />
            </div>

            <select
              value={filterCat}
              onChange={(e) => {
                setFilterCat(e.target.value as CardCategory | 'All');
                setPage(1);
              }}
              aria-label="Filter inventory category"
              className="rounded-xl border border-[#231E3D] bg-[#0B0917] px-3 py-2 text-sm text-slate-200 focus:border-[#22D3EE] focus:outline-none"
            >
              <option value="All">All categories</option>
              {CARD_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={filterPublish}
              onChange={(e) => {
                setFilterPublish(e.target.value as PublishStatus | 'All');
                setPage(1);
              }}
              aria-label="Filter publish status"
              className="rounded-xl border border-[#231E3D] bg-[#0B0917] px-3 py-2 text-sm text-slate-200 focus:border-[#22D3EE] focus:outline-none"
            >
              <option value="All">All statuses</option>
              <option value="published">published</option>
              <option value="draft">draft</option>
            </select>

            <select
              value={filterStock}
              onChange={(e) => {
                setFilterStock(e.target.value as StockStatus | 'All');
                setPage(1);
              }}
              aria-label="Filter stock status"
              className="rounded-xl border border-[#231E3D] bg-[#0B0917] px-3 py-2 text-sm text-slate-200 focus:border-[#22D3EE] focus:outline-none"
            >
              <option value="All">All stock</option>
              <option value="available">available</option>
              <option value="sold">sold</option>
              <option value="out_of_stock">out_of_stock</option>
            </select>

            <label className="inline-flex items-center gap-2 text-sm text-slate-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={unpricedOnly}
                onChange={(e) => {
                  setUnpricedOnly(e.target.checked);
                  setPage(1);
                }}
                className="h-4 w-4 rounded border-[#231E3D] accent-[#FACC15]"
              />
              <span>Unpriced only</span>
            </label>
          </div>

          {/* Bulk Action Toolbar when rows are selected */}
          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#FACC15]/40 bg-[#1B1633] px-4 py-2.5 text-xs">
              <span className="font-semibold text-[#FACC15]">
                {selectedIds.length} selected
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleBulkAction('Bulk publish', { publishStatus: 'published' })}
                  className="rounded-lg bg-[#10B981] px-3 py-1.5 font-bold text-[#042318] hover:bg-[#34D399]"
                >
                  Bulk Publish
                </button>
                <button
                  type="button"
                  onClick={() => void handleBulkAction('Bulk draft', { publishStatus: 'draft' })}
                  className="rounded-lg border border-[#231E3D] bg-[#0B0917] px-3 py-1.5 font-semibold text-slate-200"
                >
                  Bulk Draft
                </button>

                <div className="inline-flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    value={bulkPriceInput}
                    onChange={(e) => setBulkPriceInput(e.target.value)}
                    placeholder="Price ৳"
                    aria-label="Bulk set price BDT"
                    className="w-24 rounded-lg border border-[#231E3D] bg-[#0B0917] px-2.5 py-1.5 font-mono-num text-xs text-[#FACC15]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const val = Math.round(Number(bulkPriceInput));
                      if (Number.isFinite(val) && val > 0) {
                        void handleBulkAction(`Bulk price (৳${val})`, { priceBdt: val });
                        setBulkPriceInput('');
                      }
                    }}
                    className="rounded-lg bg-[#FACC15] px-2.5 py-1.5 font-bold text-[#0B0917] hover:bg-[#FDE047]"
                  >
                    Set Price
                  </button>
                </div>

                <select
                  defaultValue=""
                  aria-label="Bulk assign stock"
                  onChange={(e) => {
                    const val = e.target.value as StockStatus;
                    if (val) {
                      void handleBulkAction(`Bulk stock (${val})`, { stockStatus: val });
                      e.currentTarget.value = '';
                    }
                  }}
                  className="rounded-lg border border-[#231E3D] bg-[#0B0917] px-2.5 py-1.5 font-semibold text-slate-200"
                >
                  <option value="">Bulk Stock...</option>
                  <option value="available">Set available</option>
                  <option value="sold">Set sold</option>
                  <option value="out_of_stock">Set out_of_stock</option>
                </select>

                <select
                  defaultValue=""
                  aria-label="Bulk assign category"
                  onChange={(e) => {
                    const val = e.target.value as CardCategory;
                    if (val) {
                      void handleBulkAction(`Bulk category (${val})`, { category: val });
                      e.currentTarget.value = '';
                    }
                  }}
                  className="rounded-lg border border-[#231E3D] bg-[#0B0917] px-2.5 py-1.5 font-semibold text-slate-200"
                >
                  <option value="">Bulk Category...</option>
                  {CARD_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      Set {c}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="px-2 py-1 text-slate-400 hover:text-white"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Inventory Table */}
          <div className="overflow-x-auto rounded-2xl border border-[#231E3D] bg-[#131024]">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="border-b border-[#231E3D] bg-[#0F0C1E] text-xs font-semibold text-slate-400">
                <tr>
                  <th className="w-10 px-3 py-3.5">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={(e) => toggleSelectAllPage(e.target.checked)}
                      aria-label="Select all cards on current page"
                      className="h-4 w-4 rounded accent-[#FACC15]"
                    />
                  </th>
                  <th className="px-3 py-3.5">Serial</th>
                  <th className="px-3 py-3.5">Image</th>
                  <th className="px-3 py-3.5">Name</th>
                  <th className="px-3 py-3.5">Category</th>
                  <th className="px-3 py-3.5">Price BDT</th>
                  <th className="px-3 py-3.5">Publish</th>
                  <th className="px-3 py-3.5">Stock</th>
                  <th className="px-3 py-3.5">Order</th>
                  <th className="px-3 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#231E3D]/70">
                {pageCards.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-sm text-slate-400">
                      No cards match your current filters.
                    </td>
                  </tr>
                ) : (
                  pageCards.map((card) => {
                    const isChecked = selectedIds.includes(card.id);
                    const isSaved = Boolean(savedRowIds[card.id]);
                    return (
                      <tr key={card.id} className="hover:bg-[#191530]/60 transition-colors">
                        <td className="px-3 py-3 align-middle">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              setSelectedIds((prev) =>
                                e.target.checked
                                  ? [...prev, card.id]
                                  : prev.filter((id) => id !== card.id)
                              );
                            }}
                            aria-label={`Select card #${card.serial} ${card.name}`}
                            className="h-4 w-4 rounded accent-[#FACC15]"
                          />
                        </td>

                        <td className="px-3 py-3 align-middle font-mono-num text-xs font-semibold text-slate-300">
                          #{card.serial}
                        </td>

                        <td className="px-3 py-3 align-middle">
                          <img
                            src={card.imageUrl}
                            alt={card.name}
                            className="h-12 w-9 rounded-md border border-[#231E3D] object-cover bg-[#0B0917]"
                          />
                        </td>

                        <td className="px-3 py-3 align-middle min-w-[220px]">
                          <input
                            type="text"
                            defaultValue={card.name}
                            key={`name-${card.id}-${card.name}`}
                            aria-label={`Name for serial #${card.serial}`}
                            onBlur={(e) => {
                              const nextName = e.target.value.trim();
                              if (nextName && nextName !== card.name) {
                                void updateCard(card.id, { name: nextName });
                                markRowSaved(card.id);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur();
                              }
                            }}
                            className="w-full rounded-lg border border-[#231E3D] bg-[#0B0917] px-2.5 py-1.5 text-sm text-white focus:border-[#22D3EE] focus:outline-none"
                          />
                          {isSaved && (
                            <span className="mt-1 block text-[11px] text-[#22D3EE]">Saved</span>
                          )}
                        </td>

                        <td className="px-3 py-3 align-middle">
                          <select
                            value={card.category}
                            aria-label={`Category for serial #${card.serial}`}
                            onChange={(e) => {
                              void updateCard(card.id, {
                                category: e.target.value as CardCategory,
                              });
                              markRowSaved(card.id);
                            }}
                            className="rounded-lg border border-[#231E3D] bg-[#0B0917] px-2.5 py-1.5 text-xs text-slate-200 focus:border-[#22D3EE] focus:outline-none"
                          >
                            {CARD_CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="px-3 py-3 align-middle">
                          <input
                            ref={(el) => {
                              priceInputRefs.current[card.id] = el;
                            }}
                            type="number"
                            min={0}
                            defaultValue={card.priceBdt ?? ''}
                            key={`price-${card.id}-${card.priceBdt ?? 'empty'}`}
                            placeholder="Unpriced"
                            aria-label={`Price BDT for serial #${card.serial}`}
                            onBlur={(e) => void handleInlinePriceCommit(card, e.target.value, false)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void handleInlinePriceCommit(card, e.currentTarget.value, true);
                              }
                            }}
                            className="w-24 rounded-lg border border-[#231E3D] bg-[#0B0917] px-2.5 py-1.5 font-mono-num text-xs font-bold text-[#FACC15] placeholder:font-normal placeholder:text-slate-500 focus:border-[#FACC15] focus:outline-none"
                          />
                        </td>

                        <td className="px-3 py-3 align-middle">
                          <select
                            value={card.publishStatus}
                            aria-label={`Publish status for serial #${card.serial}`}
                            onChange={(e) => {
                              void updateCard(card.id, {
                                publishStatus: e.target.value as PublishStatus,
                              });
                              markRowSaved(card.id);
                            }}
                            className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold focus:outline-none ${
                              card.publishStatus === 'published'
                                ? 'border-[#10B981]/50 bg-[#10B981]/10 text-[#34D399]'
                                : 'border-[#231E3D] bg-[#0B0917] text-slate-400'
                            }`}
                          >
                            <option value="published">published</option>
                            <option value="draft">draft</option>
                          </select>
                        </td>

                        <td className="px-3 py-3 align-middle">
                          <select
                            value={card.stockStatus}
                            aria-label={`Stock status for serial #${card.serial}`}
                            onChange={(e) => {
                              void updateCard(card.id, {
                                stockStatus: e.target.value as StockStatus,
                              });
                              markRowSaved(card.id);
                            }}
                            className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold focus:outline-none ${
                              card.stockStatus === 'available'
                                ? 'border-[#231E3D] bg-[#0B0917] text-slate-200 focus:border-[#22D3EE]'
                                : card.stockStatus === 'sold'
                                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                                  : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                            }`}
                          >
                            <option value="available">available</option>
                            <option value="sold">sold</option>
                            <option value="out_of_stock">out_of_stock</option>
                          </select>
                        </td>

                        <td className="px-3 py-3 align-middle">
                          <div className="inline-flex items-center gap-1.5">
                            <span className="font-mono-num text-xs text-slate-400">#{card.sortOrder}</span>
                            <button
                              type="button"
                              onClick={() => void moveCardOrder(card.id, 'up')}
                              aria-label={`Move #${card.serial} up`}
                              className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#231E3D] bg-[#0B0917] text-slate-300 hover:border-slate-500"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void moveCardOrder(card.id, 'down')}
                              aria-label={`Move #${card.serial} down`}
                              className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#231E3D] bg-[#0B0917] text-slate-300 hover:border-slate-500"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>

                        <td className="px-3 py-3 align-middle text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingCard(card)}
                              aria-label={`Edit #${card.serial} ${card.name}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#231E3D] bg-[#1B1633] px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-500"
                            >
                              <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteCard(card.id)}
                              aria-label={`Delete #${card.serial} ${card.name}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/25"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Table Pagination Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#231E3D] bg-[#0F0C1E] px-4 py-3 text-xs text-slate-400">
              <div className="flex items-center gap-4">
                <span className="font-mono-num">Total matching: {filteredCards.length}</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  aria-label="Rows per page"
                  className="rounded border border-[#231E3D] bg-[#0B0917] px-2 py-1 text-xs text-slate-200"
                >
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-[#231E3D] bg-[#131024] px-3 py-1.5 text-slate-300 disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="font-mono-num">
                  Page {safePage} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-lg border border-[#231E3D] bg-[#131024] px-3 py-1.5 text-slate-300 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TRADE REQUESTS */}
      {activeTab === 'trades' && (
        <div className="space-y-4">
          {tradeRequests.length === 0 ? (
            <div className="rounded-2xl border border-[#231E3D] bg-[#131024] p-10 text-center text-sm text-slate-400">
              No collector trade requests submitted yet. Submissions from /trade appear here.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {tradeRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex gap-4 rounded-2xl border border-[#231E3D] bg-[#131024] p-4"
                >
                  {req.imageDataUrl ? (
                    <img
                      src={req.imageDataUrl}
                      alt={req.cardName}
                      className="h-24 w-18 rounded-lg border border-[#231E3D] object-cover shrink-0"
                    />
                  ) : (
                    <div className="flex h-24 w-18 shrink-0 items-center justify-center rounded-lg border border-[#231E3D] bg-[#0B0917] text-[10px] text-slate-500">
                      No photo
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display font-bold text-white truncate">{req.cardName}</h3>
                      <span className="font-mono-num text-sm font-bold text-[#FACC15] shrink-0">
                        {formatBdt(req.askingPriceBdt)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      {req.category} · {req.condition} · {req.city}
                    </p>
                    <p className="text-xs text-slate-300">
                      Seller: <strong>{req.sellerName}</strong> ({req.phone})
                    </p>
                    {req.notes && <p className="text-xs text-slate-400">{req.notes}</p>}

                    <div className="pt-2">
                      <select
                        value={req.status}
                        aria-label={`Trade status for ${req.cardName}`}
                        onChange={(e) =>
                          void updateTradeStatus(req.id, e.target.value as typeof req.status)
                        }
                        className="rounded-lg border border-[#231E3D] bg-[#0B0917] px-2.5 py-1 text-xs font-semibold text-white"
                      >
                        <option value="pending">pending</option>
                        <option value="reviewed">reviewed</option>
                        <option value="accepted">accepted</option>
                        <option value="declined">declined</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: EXPORT / IMPORT CATALOG BUNDLE */}
      {activeTab === 'bundle' && (
        <div className="rounded-2xl border border-[#231E3D] bg-[#131024] p-6 sm:p-8 space-y-6 max-w-3xl">
          <div>
            <h2 className="font-display text-xl font-bold text-white">
              Zero-API-Key Global Publishing Bundle
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
              All edits and bulk uploads live instantly in your browser&apos;s IndexedDB. When you are ready to publish updates globally to all customers with one click, export <code className="text-[#22D3EE]">catalog.json</code> and drop it into <code className="text-[#22D3EE]">public/catalog.json</code>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleExportCatalog}
              className="inline-flex items-center gap-2 rounded-xl bg-[#FACC15] px-5 py-3 text-sm font-bold text-[#0B0917] hover:bg-[#FDE047]"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Export Catalog Bundle (catalog.json)</span>
            </button>

            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(e) => {
                void handleImportCatalog(e.target.files?.[0]);
                e.currentTarget.value = '';
              }}
            />

            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl border border-[#22D3EE]/50 bg-[#22D3EE]/10 px-5 py-3 text-sm font-bold text-[#22D3EE] hover:bg-[#22D3EE]/20"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              <span>Import Catalog (.json)</span>
            </button>

            <button
              type="button"
              onClick={() => void resetToSeedCatalog()}
              className="inline-flex items-center gap-2 rounded-xl border border-[#231E3D] bg-[#0B0917] px-4 py-3 text-xs font-semibold text-slate-300 hover:text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Reload from public/catalog.json</span>
            </button>
          </div>

          <div className="rounded-xl border border-[#231E3D] bg-[#0B0917] p-4 text-xs text-slate-400 space-y-1">
            <p className="flex items-center gap-2 font-semibold text-white">
              <CheckCircle2 className="h-4 w-4 text-[#10B981]" aria-hidden="true" />
              <span>Current Catalog Snapshot</span>
            </p>
            <p>Total cards: {cards.length} · Published: {cards.filter((c) => c.publishStatus === 'published').length}</p>
            <p>Fingerprinted cards ready for instant visual scan: {cards.filter((c) => Boolean(c.fingerprint)).length}</p>
          </div>
        </div>
      )}

      {/* TAB 4: SETTINGS & CHANGE ADMIN PASSWORD */}
      {activeTab === 'settings' && (
        <div className="max-w-xl rounded-2xl border border-[#231E3D] bg-[#131024] p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#FACC15]/40 bg-[#FACC15]/10 text-[#FACC15]">
              <KeyRound className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-white">Change Admin Password</h2>
              <p className="text-xs text-slate-400">
                Update your Owner Admin login password anytime. Stored securely in your browser for this storefront console.
              </p>
            </div>
          </div>

          {pwdError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200"
            >
              <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400" aria-hidden="true" />
              <span>{pwdError}</span>
            </div>
          )}

          {pwdSuccess && (
            <div
              role="status"
              className="flex items-center gap-2 rounded-xl border border-[#10B981]/45 bg-[#10B981]/10 px-3.5 py-2.5 text-xs text-[#34D399]"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{pwdSuccess}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label htmlFor="settings-current-pwd" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Current Password
              </label>
              <input
                id="settings-current-pwd"
                type="password"
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                placeholder="Enter current owner password"
                className="w-full rounded-xl border border-[#231E3D] bg-[#0B0917] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-[#FACC15] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="settings-new-pwd" className="block text-xs font-semibold text-slate-300 mb-1.5">
                New Password (min 6 characters)
              </label>
              <input
                id="settings-new-pwd"
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                placeholder="Enter new owner password"
                className="w-full rounded-xl border border-[#231E3D] bg-[#0B0917] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-[#FACC15] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="settings-confirm-pwd" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Confirm New Password
              </label>
              <input
                id="settings-confirm-pwd"
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                placeholder="Re-enter new owner password"
                className="w-full rounded-xl border border-[#231E3D] bg-[#0B0917] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-[#FACC15] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-[#FACC15] px-5 py-2.5 text-sm font-bold text-[#0B0917] hover:bg-[#FDE047] transition-colors"
            >
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              <span>Update Admin Password</span>
            </button>
          </form>
        </div>
      )}

      {/* Full Edit Card Modal */}
      {editingCard && (
        <EditCardModal
          card={editingCard}
          onClose={() => setEditingCard(null)}
          onSave={async (patch) => {
            await updateCard(editingCard.id, patch);
            markRowSaved(editingCard.id);
            setEditingCard(null);
          }}
        />
      )}
    </div>
  );
}

interface EditCardModalProps {
  card: CardItem;
  onClose: () => void;
  onSave: (patch: Partial<CardItem>) => Promise<void>;
}

function EditCardModal({ card, onClose, onSave }: EditCardModalProps) {
  const [cardName, setCardName] = useState(card.name);
  const [category, setCategory] = useState<CardCategory>(card.category);
  const [priceBdt, setPriceBdt] = useState(card.priceBdt ? String(card.priceBdt) : '');
  const [publishStatus, setPublishStatus] = useState<PublishStatus>(card.publishStatus);
  const [stockStatus, setStockStatus] = useState<StockStatus>(card.stockStatus);
  const [setName, setSetName] = useState(card.setName);
  const [rarity, setRarity] = useState<CardRarity>(card.rarity);
  const [condition, setCondition] = useState<CardCondition>(card.condition);
  const [description, setDescription] = useState(card.description || '');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const parsedPrice = priceBdt.trim() ? Math.max(1, Math.round(Number(priceBdt))) : null;
      await onSave({
        name: cardName.trim() || card.name,
        category,
        priceBdt: parsedPrice,
        publishStatus,
        stockStatus,
        setName: setName.trim() || card.setName,
        rarity,
        condition,
        description: description.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-card-title"
    >
      <form
        onSubmit={(e) => void submit(e)}
        className="w-full max-w-lg rounded-2xl border border-[#231E3D] bg-[#131024] p-6 space-y-4 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[#231E3D] pb-3">
          <h2 id="edit-card-title" className="font-display text-lg font-bold text-white">
            Edit Card #{card.serial}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close edit modal"
            className="rounded-lg border border-[#231E3D] p-1.5 text-slate-300 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-300 mb-1">Name</label>
            <input
              type="text"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              className="w-full rounded-xl border border-[#231E3D] bg-[#0B0917] px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CardCategory)}
              className="w-full rounded-xl border border-[#231E3D] bg-[#0B0917] px-3 py-2 text-sm text-white"
            >
              {CARD_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Price BDT (৳)</label>
            <input
              type="number"
              min={0}
              value={priceBdt}
              onChange={(e) => setPriceBdt(e.target.value)}
              className="w-full rounded-xl border border-[#231E3D] bg-[#0B0917] px-3 py-2 font-mono-num text-sm text-[#FACC15]"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Publish Status</label>
            <select
              value={publishStatus}
              onChange={(e) => setPublishStatus(e.target.value as PublishStatus)}
              className="w-full rounded-xl border border-[#231E3D] bg-[#0B0917] px-3 py-2 text-sm text-white"
            >
              <option value="published">published</option>
              <option value="draft">draft</option>
            </select>
          </div>
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Stock / Selling Status</label>
            <select
              value={stockStatus}
              onChange={(e) => setStockStatus(e.target.value as StockStatus)}
              className="w-full rounded-xl border border-[#231E3D] bg-[#0B0917] px-3 py-2 text-sm text-white"
            >
              <option value="available">available</option>
              <option value="sold">sold</option>
              <option value="out_of_stock">out_of_stock</option>
            </select>
          </div>
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Set Name</label>
            <input
              type="text"
              value={setName}
              onChange={(e) => setSetName(e.target.value)}
              className="w-full rounded-xl border border-[#231E3D] bg-[#0B0917] px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Rarity</label>
            <select
              value={rarity}
              onChange={(e) => setRarity(e.target.value as CardRarity)}
              className="w-full rounded-xl border border-[#231E3D] bg-[#0B0917] px-3 py-2 text-sm text-white"
            >
              {RARITIES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-300 mb-1">Condition</label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value as CardCondition)}
              className="w-full rounded-xl border border-[#231E3D] bg-[#0B0917] px-3 py-2 text-sm text-white"
            >
              <option value="Mint">Mint</option>
              <option value="Near Mint">Near Mint</option>
              <option value="Lightly Played">Lightly Played</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-300 mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-[#231E3D] bg-[#0B0917] px-3 py-2 text-sm text-white"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#231E3D] px-4 py-2 text-xs font-semibold text-slate-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-[#FACC15] px-5 py-2 text-xs font-bold text-[#0B0917]"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
