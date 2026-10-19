import { useState, useEffect, useRef } from 'react';
import {
  Home,
  Boxes,
  ArrowDownToLine,
  ArrowUpFromLine,
  History,
  Smartphone,
  Settings as SettingsIcon,
  Plus,
  RefreshCw,
  Moon,
  Sun,
  ExternalLink,
  Menu,
  X,
} from 'lucide-react';
import { StoreProvider, useStore } from '@stockly/shared-client/store';
import { isConfigured } from '@stockly/shared-client/config';
import type { Product } from '@stockly/shared-types';
import { GlassButton, GlassDialog } from '@stockly/ui';

import WebSheetSetup from './WebSheetSetup';
import WebDashboard from './WebDashboard';
import WebProducts from './WebProducts';
import WebProductModal from './WebProductModal';
import WebStockModal from './WebStockModal';
import WebHistory from './WebHistory';
import WebDevices from './WebDevices';
import WebSettings from './WebSettings';

export type WebTab = 'home' | 'products' | 'history' | 'devices' | 'settings';

function WebShell() {
  const [activeTab, setActiveTab] = useState<WebTab>('home');
  const [productFilter, setProductFilter] = useState<string>('all');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Modals state
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockMode, setStockMode] = useState<'IN' | 'OUT'>('IN');
  const [stockTargetProductId, setStockTargetProductId] = useState<string | undefined>(undefined);

  const [sheetModalOpen, setSheetModalOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const {
    products,
    categories,
    transactions,
    refreshing,
    lastSync,
    online,
    theme,
    setTheme,
    refresh,
    saveProduct,
    removeProduct,
    doStockIn,
    doStockOut,
    loadMoreTransactions,
    txLoadingMore,
    txExhausted,
  } = useStore();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setEditingProduct(null);
        setProductModalOpen(true);
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        setStockMode('IN');
        setStockTargetProductId(undefined);
        setStockModalOpen(true);
      } else if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        setStockMode('OUT');
        setStockTargetProductId(undefined);
        setStockModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const openStockIn = (productId?: string) => {
    setStockMode('IN');
    setStockTargetProductId(productId);
    setStockModalOpen(true);
  };

  const openStockOut = (productId?: string) => {
    setStockMode('OUT');
    setStockTargetProductId(productId);
    setStockModalOpen(true);
  };

  const openNewProduct = () => {
    setEditingProduct(null);
    setProductModalOpen(true);
  };

  const openEditProduct = (p: Product) => {
    setEditingProduct(p);
    setProductModalOpen(true);
  };

  const handleNavigateWithFilter = (tab: string, filter?: string) => {
    if (filter) setProductFilter(filter);
    setActiveTab(tab as WebTab);
  };

  const NAV_ITEMS: { key: WebTab; label: string; icon: React.ReactNode }[] = [
    { key: 'home', label: 'Dashboard', icon: <Home size={18} /> },
    { key: 'products', label: 'Products & Stock', icon: <Boxes size={18} /> },
    { key: 'history', label: 'Transaction Log', icon: <History size={18} /> },
    { key: 'devices', label: 'Linked Devices', icon: <Smartphone size={18} /> },
    { key: 'settings', label: 'Settings', icon: <SettingsIcon size={18} /> },
  ];

  return (
    <div className="flex h-screen bg-[#F7F7F2] dark:bg-[#111210] text-[#151515] dark:text-[#F7F7F2] overflow-hidden font-sans">
      {/* Mobile Sidebar Scrim */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Desktop Left Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 flex flex-col justify-between border-r border-[#D9D9D0]/60 dark:border-neutral-800 bg-[#F7F7F2]/95 dark:bg-[#151515]/95 backdrop-blur-xl p-5 transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="space-y-6">
          {/* Logo & Brand Header */}
          <div className="flex items-center justify-between">
            <a href="#/" className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#C7FF4D] text-[#151515] font-black text-xl shadow-inner">
                S
              </span>
              <div>
                <span className="text-[17px] font-extrabold tracking-tight">Stockly</span>
                <span className="text-[11px] block font-mono text-neutral-500 font-semibold">Web Workspace</span>
              </div>
            </a>
            <button
              type="button"
              className="lg:hidden p-1.5 rounded-lg text-neutral-500"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={20} />
            </button>
          </div>

          {/* Quick Stock Movement Buttons in Sidebar */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                openStockIn();
                setSidebarOpen(false);
              }}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-[12px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
            >
              <ArrowDownToLine size={14} /> Stock In
            </button>
            <button
              type="button"
              onClick={() => {
                openStockOut();
                setSidebarOpen(false);
              }}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-[12px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
            >
              <ArrowUpFromLine size={14} /> Stock Out
            </button>
          </div>

          {/* Primary Navigation Links */}
          <nav aria-label="Main Navigation" className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.key);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[14px] font-bold transition-all ${
                    active
                      ? 'bg-[#151515] text-white dark:bg-[#C7FF4D] dark:text-[#151515] shadow-sm'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/60'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: Sync Status & User Profile */}
        <div className="space-y-4 pt-4 border-t border-[#D9D9D0]/50 dark:border-neutral-800">
          {/* Live Sync Status */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/60 dark:bg-neutral-800/50 border border-[#D9D9D0]/40 dark:border-neutral-700/50 text-[12px]">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${online ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span className="font-semibold truncate">
                {refreshing ? 'Syncing…' : online ? 'Google Sheet Synced' : 'Offline'}
              </span>
            </div>
            <button
              type="button"
              title="Force Sync"
              onClick={() => void refresh()}
              disabled={refreshing}
              className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Workspace info & Theme switcher */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#C7FF4D]/20 text-[#151515] dark:text-[#C7FF4D] font-bold text-sm">
                S
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-bold truncate">Stockly Workspace</p>
                <p className="text-[11px] text-neutral-400 truncate">Inventory System</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-lg text-neutral-500 hover:text-black dark:hover:text-white transition-colors"
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 px-6 border-b border-[#D9D9D0]/60 dark:border-neutral-800 flex items-center justify-between gap-4 bg-[#F7F7F2]/80 dark:bg-[#111210]/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="lg:hidden p-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={18} />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-[13px] font-medium text-neutral-500">
              <span>Stockly</span>
              <span>/</span>
              <span className="font-bold text-neutral-900 dark:text-white capitalize">{activeTab}</span>
            </div>
          </div>

          {/* Quick Actions in Header */}
          <div className="flex items-center gap-3">
            <a
              href="#/"
              className="hidden sm:flex items-center gap-1.5 text-[12px] font-bold text-neutral-500 hover:text-black dark:hover:text-white px-3 py-1.5 rounded-lg border border-neutral-300/60 dark:border-neutral-800 transition-colors"
            >
              <span>Public Site</span>
              <ExternalLink size={12} />
            </a>

            <GlassButton
              variant="primary"
              size="sm"
              onClick={openNewProduct}
              iconStart={<Plus size={15} />}
            >
              New Product
            </GlassButton>
          </div>
        </header>

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'home' && (
              <WebDashboard
                products={products}
                transactions={transactions}
                refreshing={refreshing}
                lastSync={lastSync}
                onRefresh={() => void refresh()}
                onStockIn={openStockIn}
                onStockOut={openStockOut}
                onNewProduct={openNewProduct}
                onNavigateTab={handleNavigateWithFilter}
              />
            )}

            {activeTab === 'products' && (
              <WebProducts
                products={products}
                categories={categories}
                initialFilter={productFilter}
                onNewProduct={openNewProduct}
                onEditProduct={openEditProduct}
                onDeleteProduct={removeProduct}
                onStockIn={openStockIn}
                onStockOut={openStockOut}
              />
            )}

            {activeTab === 'history' && (
              <WebHistory
                transactions={transactions}
                onLoadMore={() => void loadMoreTransactions(50)}
                hasMore={!txExhausted}
                loadingMore={txLoadingMore}
              />
            )}

            {activeTab === 'devices' && <WebDevices />}

            {activeTab === 'settings' && (
              <WebSettings
                theme={theme}
                onThemeChange={setTheme}
                onReconnectSheet={() => setSheetModalOpen(true)}
                onForceSync={() => void refresh()}
              />
            )}
          </div>
        </main>
      </div>

      {/* Product Creation / Edit Modal */}
      <WebProductModal
        open={productModalOpen}
        onClose={() => setProductModalOpen(false)}
        categories={categories}
        editingProduct={editingProduct}
        onSave={saveProduct}
      />

      {/* Stock In / Out Modal */}
      <WebStockModal
        open={stockModalOpen}
        onClose={() => setStockModalOpen(false)}
        products={products}
        initialMode={stockMode}
        initialProductId={stockTargetProductId}
        onStockIn={doStockIn}
        onStockOut={doStockOut}
      />

      {/* Sheet Reconnect Modal */}
      {sheetModalOpen && (
        <GlassDialog
          open={sheetModalOpen}
          onClose={() => setSheetModalOpen(false)}
          title="Reconnect Google Sheet"
          size="md"
        >
          <WebSheetSetup
            mode="repair"
            onConnected={() => {
              setSheetModalOpen(false);
              void refresh();
            }}
          />
        </GlassDialog>
      )}
    </div>
  );
}

export default function WebApp() {
  const [configured, setConfigured] = useState(() => isConfigured());

  if (!configured) {
    return (
      <WebSheetSetup
        mode="setup"
        onConnected={() => setConfigured(true)}
      />
    );
  }

  return (
    <StoreProvider>
      <WebShell />
    </StoreProvider>
  );
}
