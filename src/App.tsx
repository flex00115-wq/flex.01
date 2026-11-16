import React, { useState } from 'react';
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

export default function App() {
  return (
    <CatalogProvider>
      <AppShell />
    </CatalogProvider>
  );
}
