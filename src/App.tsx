import React, { Component, useState, type ErrorInfo, type ReactNode } from 'react';
import { AdminLockModal } from './components/AdminLockModal';
import { Footer } from './components/Footer';
import { Navbar } from './components/Navbar';
import { OrderModal } from './components/OrderModal';
import { PolicyModal } from './components/PolicyModal';
import { navigateTo, useRouter } from './hooks/useRouter';
import { AdminPage } from './pages/AdminPage';
import { CardDetailPage } from './pages/CardDetailPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { HomePage } from './pages/HomePage';
import { MarketplacePage } from './pages/MarketplacePage';
import { ScanPage } from './pages/ScanPage';
import { TradePage } from './pages/TradePage';
import { CatalogProvider } from './storage/catalogStore';
import type { CardItem } from './types/card';

function AppShell() {
  const { pathname, searchParams } = useRouter();
  const [orderCard, setOrderCard] = useState<CardItem | null>(null);
  const [policyDoc, setPolicyDoc] = useState<'privacy' | 'terms' | 'how-to-order' | null>(null);
  const [adminLockOpen, setAdminLockOpen] = useState(false);

  const isAdminRoute = pathname === '/flex-admin' || pathname.startsWith('/flex-admin/');
  const cardMatch = pathname.match(/^\/card\/(.+)$/);

  let content: React.ReactNode;
  if (isAdminRoute) {
    content = <AdminPage />;
  } else if (pathname === '/scan') {
    content = (
      <ScanPage
        initialMode={searchParams.get('mode')}
        onOrderCard={setOrderCard}
      />
    );
  } else if (pathname === '/marketplace') {
    content = (
      <MarketplacePage
        initialCategory={searchParams.get('category')}
        focusSearch={searchParams.get('focus') === 'search'}
        initialWishlistOnly={searchParams.get('wishlist') === '1'}
        onOrderCard={setOrderCard}
      />
    );
  } else if (pathname === '/categories') {
    content = <CategoriesPage />;
  } else if (pathname === '/trade') {
    content = <TradePage />;
  } else if (cardMatch) {
    content = <CardDetailPage cardId={cardMatch[1]} onOrderCard={setOrderCard} />;
  } else {
    content = <HomePage onOrderCard={setOrderCard} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0B0917] text-[#F8FAFC]">
      {!isAdminRoute && (
        <Navbar pathname={pathname} onOpenAdminLock={() => setAdminLockOpen(true)} />
      )}

      <main className="flex-1">{content}</main>

      {!isAdminRoute && <Footer onOpenPolicy={setPolicyDoc} />}

      <OrderModal card={orderCard} onClose={() => setOrderCard(null)} />
      <PolicyModal doc={policyDoc} onClose={() => setPolicyDoc(null)} />
      <AdminLockModal
        open={adminLockOpen}
        onClose={() => setAdminLockOpen(false)}
        onUnlocked={() => {
          setAdminLockOpen(false);
          navigateTo('/flex-admin');
        }}
      />
    </div>
  );
}

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || 'Unexpected rendering error.' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('FLEX render error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0B0917] px-4 text-[#F8FAFC]">
          <div className="max-w-md rounded-2xl border border-[#231E3D] bg-[#131024] p-6 space-y-3 text-center">
            <h1 className="font-display text-xl font-bold text-white">FLEX Storefront Recovery</h1>
            <p className="text-sm text-slate-300">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-[#FACC15] px-4 py-2 text-sm font-bold text-[#0B0917]"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <CatalogProvider>
        <AppShell />
      </CatalogProvider>
    </AppErrorBoundary>
  );
}
