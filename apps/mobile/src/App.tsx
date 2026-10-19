import React, { Suspense, lazy, useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { CloudOff } from 'lucide-react';
import { StoreProvider, useStore } from '@stockly/shared-client/store';
import { LS_KEYS, isConfigured } from '@stockly/shared-client/config';
import { SheetSetupScreen } from './screens/AccessScreens';
import type { Product } from '@stockly/shared-types';
import { BottomNav, DesktopSidebar, DesktopToolbar, SyncStatus, Toasts, AppLoader, hasOpenOverlay, useOverlayOpen, type TabKey } from './components/ui';
import HomeScreen from './screens/HomeScreen';
import type { ProductFilter } from './screens/ProductsScreen';

// Home remains in the startup bundle; secondary screens load on first visit.
const ProductsScreen = lazy(() => import('./screens/ProductsScreen'));
const HistoryScreen = lazy(() => import('./screens/HistoryScreen'));
const SettingsScreen = lazy(() => import('./screens/SettingsScreen'));

/* Overlays split out of the initial bundle: the form + stock sheets carry
 * image-compression and picker code that isn't needed until first opened.
 * Tabs stay eager so switching never flashes a fallback. */
const ProductForm = lazy(() => import('./components/ProductForm'));
const StockSheet = lazy(() => import('./components/StockSheet'));

export type StockRequest = { mode: 'IN' | 'OUT'; productId: string; n: number } | null;

/** Swipe order for edge gestures (Home ↔ Products ↔ History ↔ Settings). */
const TAB_ORDER: TabKey[] = ['home', 'products', 'history', 'settings'];

function Shell() {
  const [tab, setTab] = useState<TabKey>('home');
  // Tab switches render in a transition: the tap + nav highlight paint
  // immediately while the new screen (50-row list + images) renders in the
  // background without freezing the UI.
  const [, startSwitch] = useTransition();
  const switchTab = useCallback((t: TabKey) => {
    startSwitch(() => setTab(t));
  }, []);
  const [stockReq, setStockReq] = useState<StockRequest>(null);
  // Desktop sidebar hide/show (persisted; desktop layout only).
  const [sideCollapsed, setSideCollapsed] = useState(() => {
    try {
      return localStorage.getItem(LS_KEYS.sidebar) === '1';
    } catch {
      return false;
    }
  });
  const toggleSidebar = useCallback(() => {
    setSideCollapsed((v) => {
      try {
        localStorage.setItem(LS_KEYS.sidebar, v ? '0' : '1');
      } catch { /* ignore */ }
      return !v;
    });
  }, []);
  const [productFilter, setProductFilter] = useState<ProductFilter>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const { toasts, dismissToast, configured, ready, loading, lastSync, online, pendingIds, failedOps, retryFailedOp, dismissFailedOp } = useStore();
  // Hide the bottom nav under any popup so sheet buttons are never covered.
  const overlayOpen = useOverlayOpen();
  const showSync = !overlayOpen && (pendingIds.length > 0 || failedOps.length > 0);

  /* Branded startup loader: shows on every cold start for a minimum
   *  brand moment (~1.5s) while screens mount + fetch underneath. Cached
   *  screens are usable immediately after; uncached first installs keep
   *  the loader until the initial request settles. A 12s safety forces it
   *  away on hung networks — the app behind shows skeletons/offline
   *  states instead of a stuck spinner. Fades out, then unmounts after
   *  the transition. */
  const [forced, setForced] = useState(false);
  const [loaderGone, setLoaderGone] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setForced(true), 12000);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    const t = window.setTimeout(() => setMinElapsed(true), 1500);
    return () => window.clearTimeout(t);
  }, []);
  const dataReady = ready || !configured;
  const hasCachedData = lastSync !== null;
  const showLoader = !loaderGone && !(forced || ((hasCachedData || dataReady) && minElapsed));
  useEffect(() => {
    if (!showLoader && !loaderGone) {
      const t = window.setTimeout(() => setLoaderGone(true), 320);
      return () => window.clearTimeout(t);
    }
  }, [showLoader, loaderGone]);
  const loaderStatus = !configured
    ? 'Welcome to Stockly'
    : loading
      ? 'Syncing your inventory…'
      : 'Getting things ready…';

  const openAdd = useCallback(() => {
    setEditing(null);
    setFormOpen(true);
  }, []);
  const openEdit = useCallback((p: Product) => {
    setEditing(p);
    setFormOpen(true);
  }, []);

  const goProducts = useCallback(
    (filter?: 'low' | 'out') => {
      setProductFilter(filter || 'all');
      startSwitch(() => setTab('products'));
    },
    [],
  );

  const openStock = useCallback((mode: 'IN' | 'OUT', productId?: string) => {
    setStockReq({ mode, productId: productId || '', n: Date.now() });
  }, []);

  // Stable callbacks: inline closures here would give every screen new props
  // on each store tick (toasts, sync badges) and re-render whole lists.
  const stockInHome = useCallback(() => openStock('IN'), [openStock]);
  const stockOutHome = useCallback(() => openStock('OUT'), [openStock]);
  const stockInFor = useCallback((p: Product) => openStock('IN', p.id), [openStock]);
  const stockOutFor = useCallback((p: Product) => openStock('OUT', p.id), [openStock]);
  const goHistoryTab = useCallback(() => startSwitch(() => setTab('history')), []);
  const closeForm = useCallback(() => setFormOpen(false), []);
  const closeStock = useCallback(() => setStockReq(null), []);
  const retryOp = useCallback((k: string) => void retryFailedOp(k), [retryFailedOp]);
  const pageTitle = tab === 'home' ? 'Dashboard' : tab === 'products' ? 'Products' : tab === 'history' ? 'Transaction History' : 'Settings';

  /* Horizontal swipe switches tabs. Guards keep it out of the way:
   * - single touch only, inputs never start a swipe;
   * - horizontal must dominate vertical (page scroll untouched);
   * - touches starting inside a horizontally scrollable strip belong
   *   to that strip;
   * - sheets/detail/toasts live in portals outside the swipe zone, and the
   *   bottom nav sits outside it too — taps there are never hijacked. */
  const swipeZoneRef = useRef<HTMLDivElement>(null);
  const swipeStart = useRef<{ x: number; y: number; id: number; blocked: boolean } | null>(null);
  const onSwipeStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) {
      swipeStart.current = null;
      return;
    }
    const t = e.touches[0];
    const target = e.target instanceof HTMLElement ? e.target : null;
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) {
      swipeStart.current = null;
      return;
    }
    let blocked = false;
    let n = target;
    const zone = swipeZoneRef.current;
    while (n && n !== zone) {
      if (n.scrollWidth > n.clientWidth + 8) {
        blocked = true;
        break;
      }
      n = n.parentElement;
    }
    swipeStart.current = { x: t.clientX, y: t.clientY, id: t.identifier, blocked };
  }, []);
  const onSwipeCancel = useCallback(() => {
    swipeStart.current = null;
  }, []);
  const onSwipeEnd = useCallback(
    (e: React.TouchEvent) => {
      const s = swipeStart.current;
      swipeStart.current = null;
      if (!s || s.blocked) return;
      const t = e.changedTouches[0];
      if (!t || t.identifier !== s.id) return;
      const dx = t.clientX - s.x;
      const adx = Math.abs(dx);
      const ady = Math.abs(t.clientY - s.y);
      if (adx < 70 || adx < ady * 1.6) return;
      const i = TAB_ORDER.indexOf(tab);
      if (dx < 0 && i < TAB_ORDER.length - 1) switchTab(TAB_ORDER[i + 1]);
      else if (dx > 0 && i > 0) switchTab(TAB_ORDER[i - 1]);
    },
    [tab, switchTab],
  );

  // Android hardware back button: open sheets/detail handle themselves
  // (shared dismiss stack in ui.tsx); here we only step back through tabs.
  useEffect(() => {
    let remove: (() => void) | undefined;
    (async () => {
      try {
        const { App } = await import('@capacitor/app');
        const h = await App.addListener('backButton', () => {
          if (hasOpenOverlay()) return;
          if (formOpen) {
            setFormOpen(false);
            return;
          }
          if (tab !== 'home') {
            setTab('home');
            return;
          }
          void App.exitApp();
        });
        remove = () => {
          void h.remove();
        };
      } catch {
        /* web — browser back button works natively */
      }
    })();
    return () => remove?.();
  }, [formOpen, tab]);

  // Hide splash as soon as the UI is up (native only).
  useEffect(() => {
    (async () => {
      try {
        const { SplashScreen } = await import('@capacitor/splash-screen');
        await SplashScreen.hide();
      } catch { /* web */ }
    })();
  }, []);

  return (
    <div className="min-h-dvh bg-(--bg) text-(--ink)">
      <div className="ambient" aria-hidden="true" />
      <div className={`app-shell relative z-[1] mx-auto min-h-dvh max-w-md sm:border-x sm:border-(--stroke-dim) ${sideCollapsed ? 'side-collapsed' : ''}`}>
        <DesktopSidebar tab={tab} onNavigate={switchTab} onStock={openStock} collapsed={sideCollapsed} />
        <DesktopToolbar title={pageTitle} online={online} pending={pendingIds.length} failed={failedOps.length} lastSync={lastSync} sideCollapsed={sideCollapsed} onToggleSidebar={toggleSidebar} />
        {!configured ? (
          <div className="backend-banner safe-top sticky top-0 z-20 px-3 pt-3">
            <button
              onClick={() => setTab('settings')}
              className="glass mx-auto flex w-full max-w-md items-center gap-2.5 rounded-2xl border-amber-500/25 px-4 py-3 text-left"
            >
              <CloudOff size={18} className="shrink-0 text-amber-500" />
              <span className="flex-1 text-[13px] font-medium text-(--ink)">
                Backend not connected — tap to paste your Apps Script URL.
              </span>
            </button>
          </div>
        ) : null}

        {/* Perf: mount ONLY the active tab. Previously all screens stayed
            mounted (multiple DOM trees + filters re-running on every store
            change), which dropped frames on 60/90Hz phones during scroll.
            The swipe-zone wraps every tab so edge swipes switch pages. */}
        <div
          ref={swipeZoneRef}
          onTouchStart={onSwipeStart}
          onTouchEnd={onSwipeEnd}
          onTouchCancel={onSwipeCancel}
          className="swipe-zone"
        >
        {tab === 'home' ? (
          <div className="animate-page-in">
            <HomeScreen
              onAddProduct={openAdd}
              onStockIn={stockInHome}
              onStockOut={stockOutHome}
              onStockInProduct={stockInFor}
              onStockOutProduct={stockOutFor}
              goProducts={goProducts}
              goHistory={goHistoryTab}
            />
          </div>
        ) : null}
        <Suspense fallback={null}>
          {tab === 'products' ? (
            <div key={productFilter} className="animate-page-in">
              <ProductsScreen
                initialFilter={productFilter}
                onAdd={openAdd}
                onEdit={openEdit}
                onStockIn={stockInFor}
                onStockOut={stockOutFor}
              />
            </div>
          ) : null}
          {tab === 'history' ? (
            <div className="animate-page-in">
              <HistoryScreen />
            </div>
          ) : null}
          {tab === 'settings' ? (
            <div className="animate-page-in">
              <SettingsScreen />
            </div>
          ) : null}
        </Suspense>
        </div>

        {overlayOpen ? null : <BottomNav tab={tab} setTab={switchTab} />}
        <Suspense fallback={null}>
          {formOpen ? <ProductForm open={formOpen} editing={editing} onClose={closeForm} /> : null}
          {stockReq !== null ? (
            <StockSheet
              open={stockReq !== null}
              initialMode={stockReq?.mode || 'IN'}
              productId={stockReq?.productId || ''}
              openKey={stockReq?.n || 0}
              onClose={closeStock}
            />
          ) : null}
        </Suspense>
        {showSync ? (
          <SyncStatus
            pending={pendingIds.length}
            failed={failedOps}
            onRetry={retryOp}
            onDismiss={dismissFailedOp}
          />
        ) : null}
        <Toasts toasts={toasts} onDismiss={dismissToast} lifted={showSync} />
      </div>
      {!loaderGone ? <AppLoader status={loaderStatus} fading={!showLoader} /> : null}
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider><Gate /></StoreProvider>
  );
}

/* Central route guard:
 * Directly boots into the inventory workspace if configured.
 * If no sheet is connected yet, displays SheetSetupScreen.
 * No login or admin system required. */
type GatePhase =
  | { name: 'loading' }
  | { name: 'setup'; message?: string }
  | { name: 'app' };

function Gate() {
  const [phase, setPhase] = useState<GatePhase>({ name: 'loading' });
  const { setConfiguredFlag } = useStore();

  const evaluate = useCallback(() => {
    if (isConfigured()) {
      setConfiguredFlag();
      setPhase({ name: 'app' });
    } else {
      setPhase({ name: 'setup' });
    }
  }, [setConfiguredFlag]);

  useEffect(() => {
    evaluate();
  }, [evaluate]);

  // Native splash screen: Shell used to hide it, but Shell only mounts in
  // the app phase now — with launchAutoHide:false the splash would stick
  // forever on login/setup. Hide it for every phase.
  useEffect(() => {
    (async () => {
      try {
        const { SplashScreen } = await import('@capacitor/splash-screen');
        await SplashScreen.hide();
      } catch {
        /* web — no splash plugin */
      }
    })();
  }, []);

  if (phase.name === 'loading') {
    return (
      <div className="min-h-dvh bg-(--bg) text-(--ink)">
        <div className="ambient" aria-hidden="true" />
      </div>
    );
  }
  if (phase.name === 'setup') {
    return (
      <SheetSetupScreen
        mode="setup"
        initialMessage={phase.message}
        onConnected={() => evaluate()}
      />
    );
  }
  return <Shell />;
}
