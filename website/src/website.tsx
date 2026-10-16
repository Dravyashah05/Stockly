import { Suspense, lazy, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  Boxes,
  ChevronDown,
  CircleAlert,
  Eye,
  EyeOff,
  LayoutDashboard,
  LogOut,
  Plus,
  Search,
  Settings,
  TrendingUp,
  UserRound,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  devicesApi,
  getAuthSession,
  loginAccount,
  registerAccount,
  signOutAccount,
  sheetsApi,
  type DeviceInfo,
  getCachedProfile,
  refreshMyProfile,
  type CreatedLink,
  type LinkView,
} from "./shared/api-client";
import { formatMoney } from "./shared/config";
import {
  stockStatus,
  useStore,
} from "./shared/store";
import type { Product } from "./shared/types";
import ProductTable from "./table";

/* Below-the-fold chunks: reports tab, first-run setup, and all dialogs load
 * on demand instead of in the initial bundle. Brand + fallbacks stay inline
 * below — importing them from the lazy modules would drag those chunks
 * into the initial bundle. */
const Reports = lazy(() => import("./reports"));
const ConnectSheet = lazy(() => import("./connect").then((m) => ({ default: m.ConnectSheet })));
const ProductDialog = lazy(() => import("./dialogs").then((m) => ({ default: m.ProductDialog })));
const StockDialog = lazy(() => import("./dialogs").then((m) => ({ default: m.StockDialog })));
const ConfirmDialog = lazy(() => import("./dialogs").then((m) => ({ default: m.ConfirmDialog })));

function Brand() {
  return (
    <a className="brand" href="/">
      <span className="brand-mark">S</span>
      <span>stockly</span>
      <ChevronDown size={14} />
    </a>
  );
}

function DialogFallback() {
  return (
    <div className="scrim" role="presentation">
      <div className="dialog">
        <p className="empty">Loading…</p>
      </div>
    </div>
  );
}

function ConnectFallback() {
  return (
    <main className="login-wrap">
      <section className="login-card">
        <p className="empty">Loading…</p>
      </section>
    </main>
  );
}

type Tab = "overview" | "products" | "reports" | "history" | "settings";
type ProductFilter = "all" | "ok" | "low" | "out";

function readRouteTab(): Tab {
  const value = window.location.hash.replace(/^#\/?/, "");
  return ["overview", "products", "reports", "history", "settings"].includes(value)
    ? (value as Tab)
    : "overview";
}

function useWorkspaceRoute(): [Tab, (next: Tab) => void] {
  const [tab, setTab] = useState<Tab>(readRouteTab);
  useEffect(() => {
    const syncRoute = () => setTab(readRouteTab());
    window.addEventListener("hashchange", syncRoute);
    window.addEventListener("popstate", syncRoute);
    return () => {
      window.removeEventListener("hashchange", syncRoute);
      window.removeEventListener("popstate", syncRoute);
    };
  }, []);
  const navigate = (next: Tab) => {
    if (readRouteTab() !== next) window.location.hash = `/${next}`;
    setTab(next);
  };
  return [tab, navigate];
}

export default function Website() {
  const [session, setSession] = useState(() => getAuthSession());
  if (!session)
    return <Login onSignedIn={() => setSession(getAuthSession())} />;
  return <Inventory key={session} onSignOut={() => setSession(null)} />;
}

function Login({ onSignedIn }: { onSignedIn: () => void }) {
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = new FormData(event.currentTarget);
    try {
      if (register) {
        await registerAccount(
          String(values.get("name")),
          String(values.get("email")),
          String(values.get("password")),
        );
      } else {
        await loginAccount(
          String(values.get("email")),
          String(values.get("password")),
        );
      }
      onSignedIn();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not sign in. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-wrap">
      <section className="login-card" aria-labelledby="login-title">
        <Brand />
        <p className="eyebrow">STOCKLY</p>
        <h1 id="login-title">{register ? "Create your account" : "Welcome back"}</h1>
        <p className="muted">
          {register
            ? "One account for your shop — your inventory syncs everywhere."
            : "Sign in to pick up where you left off."}
        </p>
        <div className="segmented" role="group" aria-label="Sign-in mode">
          <button
            type="button"
            aria-pressed={!register}
            className={!register ? "active" : ""}
            onClick={() => {
              setRegister(false);
              setError("");
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            aria-pressed={register}
            className={register ? "active" : ""}
            onClick={() => {
              setRegister(true);
              setError("");
            }}
          >
            Create account
          </button>
        </div>
        <form onSubmit={submit} className="form-stack">
          {register && (
            <label>
              Your name
              <input name="name" autoComplete="name" required />
            </label>
          )}
          <label>
            Email address
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <span className="password-wrap">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete={register ? "new-password" : "current-password"}
                minLength={register ? 10 : undefined}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
          </label>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <button className="primary-btn" disabled={busy}>
            {busy
              ? register
                ? "Creating account…"
                : "Signing in…"
              : register
                ? "Create account"
                : "Sign in"}
          </button>
        </form>
        <p className="muted login-note">
          Passwords are hashed on the server and never stored as plain text.
        </p>
      </section>
    </main>
  );
}

function Inventory({ onSignOut }: { onSignOut: () => void }) {
  const store = useStore();
  const refresh = store.refresh;
  const setConfiguredFlag = store.setConfiguredFlag;
  const [tab, setTab] = useWorkspaceRoute();
  const [query, setQuery] = useState("");
  // Defer filtering a frame so typing stays smooth on large catalogs.
  const deferredQuery = useDeferredValue(query);
  const [productFilter, setProductFilter] = useState<ProductFilter>("all");
  const [productSort, setProductSort] = useState("name");
  const [product, setProduct] = useState<Product | null | "new">(null);
  const [stock, setStock] = useState<{
    product: Product;
    type: "IN" | "OUT";
  } | null>(null);
  const [notice, setNotice] = useState("");
  const [connection, setConnection] = useState<boolean | null>(null);
  const [connectionError, setConnectionError] = useState("");
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [deviceError, setDeviceError] = useState("");
  const [profile, setProfile] = useState(() => getCachedProfile());
  const [revokingDevice, setRevokingDevice] = useState("");
  const [deviceLink, setDeviceLink] = useState<CreatedLink | null>(null);
  const [deviceLinkView, setDeviceLinkView] = useState<LinkView | null>(null);
  const [deviceLinkBusy, setDeviceLinkBusy] = useState(false);
  // Pending delete target for the accessible confirm dialog (replaces
  // blocking window.confirm, which traps neither focus nor styling).
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  useEffect(() => {
    void refreshMyProfile().then(setProfile);
  }, []);
  useEffect(() => {
    void sheetsApi
      .getConnection()
      .then((c) => {
        setConnection(c.connected && c.status === "verified");
        if (c.connected && c.status === "verified") {
          setConfiguredFlag();
          void refresh();
        }
      })
      .catch((e) => {
        setConnection(false);
        setConnectionError(
          e instanceof Error
            ? e.message
            : "Could not check your sheet connection.",
        );
      });
  }, [refresh, setConfiguredFlag]);
  useEffect(() => {
    if (tab === "settings")
      void devicesApi
        .listDevices()
        .then((r) => {
          setDevices(r.devices);
          setDeviceError("");
        })
        .catch((e) =>
          setDeviceError(
            e instanceof Error ? e.message : "Could not load linked devices.",
          ),
        );
  }, [tab]);
  const deviceLinkStatus = deviceLinkView?.status;
  useEffect(() => {
    if (!deviceLink || (deviceLinkStatus && !["pending", "claimed"].includes(deviceLinkStatus))) return;
    let stopped = false;
    const poll = async () => {
      try {
        const view = await devicesApi.getLink(deviceLink.linkId);
        if (!stopped) setDeviceLinkView(view);
      } catch {
        // Keep polling through transient connection failures.
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 3000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [deviceLink, deviceLinkStatus]);
  const filtered = useMemo(() => {
    const needle = deferredQuery.toLowerCase();
    const result = store.products.filter((p) => {
      const matchesQuery = `${p.name} ${p.sku} ${p.categoryName || ""}`
        .toLowerCase()
        .includes(needle);
      const matchesStatus = productFilter === "all" || stockStatus(p) === productFilter;
      return matchesQuery && matchesStatus;
    });
    return result.sort((a, b) => {
      if (productSort === "stock") return b.currentStock - a.currentStock;
      if (productSort === "low") return a.currentStock - b.currentStock;
      if (productSort === "value") return b.sellingPrice - a.sellingPrice;
      return a.name.localeCompare(b.name);
    });
  }, [store.products, deferredQuery, productFilter, productSort]);
  // Overview preview + reports loader use ref-stable wrappers so the memoized
  // table/reports below skip re-renders on unrelated store ticks.
  const lowStockPreview = useMemo(
    () => store.products.filter((p) => stockStatus(p) !== "ok").slice(0, 6),
    [store.products],
  );
  const loadOlderRef = useRef(() => {});
  loadOlderRef.current = () =>
    void store.loadMoreTransactions(store.transactions.length + 100);
  const loadOlder = useCallback(() => loadOlderRef.current(), []);
  const confirmDelete = useCallback(async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const ok = await store.removeProduct(deleting.id);
      setNotice(ok ? "Product deleted." : "Could not delete product.");
      if (ok) setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  }, [deleting, store]);
  async function signOut() {
    signOutAccount();
    onSignOut();
  }
  async function decideDeviceLink(approve: boolean) {
    if (!deviceLink) return;
    setDeviceLinkBusy(true);
    setDeviceError("");
    try {
      const result = approve
        ? await devicesApi.approveLink(deviceLink.linkId)
        : await devicesApi.rejectLink(deviceLink.linkId);
      setDeviceLinkView((current) => current ? { ...current, status: result.status } : current);
      if (approve) {
        const latest = await devicesApi.listDevices();
        setDevices(latest.devices);
      }
    } catch (e) {
      setDeviceError(e instanceof Error ? e.message : "Could not update the device link.");
    } finally {
      setDeviceLinkBusy(false);
    }
  }
  if (connection === false)
    return (
      <Suspense fallback={<ConnectFallback />}>
        <ConnectSheet
          initialError={connectionError}
          onConnected={() => {
            setConnection(true);
            setConnectionError("");
            setConfiguredFlag();
            void refresh();
          }}
          onSignOut={signOut}
        />
      </Suspense>
    );
  return (
    <div className="workspace">
      <aside className="sidebar">
        <Brand />
        <p className="eyebrow nav-label">WORKSPACE</p>
        <nav>
          {(
            [
              ["overview", LayoutDashboard, "Overview"],
              ["products", Boxes, "Products"],
              ["reports", BarChart3, "Reports"],
              ["history", Activity, "Transactions"],
              ["settings", Settings, "Settings"],
            ] as const
          ).map(([id, Icon, label]) => (
            <button
              key={id}
              className={tab === id ? "nav-item active" : "nav-item"}
              onClick={() => setTab(id)}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
        <button className="nav-item signout" onClick={signOut}>
          <LogOut size={18} />
          Sign out
        </button>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div>
            <p className="eyebrow">STOCKLY / {tab.toUpperCase()}</p>
            <h1>
              {tab === "overview"
                ? "Overview"
                : tab === "products"
                  ? "Products"
                  : tab === "reports"
                    ? "Reports"
                    : tab === "history"
                      ? "Transactions"
                      : "Settings"}
            </h1>
          </div>
          <div className="topbar-actions">
            <button
              className="outline-btn"
              onClick={() => void store.refresh()}
              disabled={store.refreshing}
            >
              {store.refreshing ? "Syncing…" : "Refresh data"}
            </button>
            <details className="profile-menu">
              <summary aria-label="Open profile and account menu">
                <UserRound size={18} />
              </summary>
              <div className="profile-popover">
                <button onClick={() => setTab("settings")}>Account settings</button>
                <button onClick={() => void signOut()}>Sign out</button>
              </div>
            </details>
          </div>
        </header>
        {notice && (
          <div className="notice" role="status">
            {notice}
            <button onClick={() => setNotice("")} aria-label="Dismiss">
              <X size={16} />
            </button>
          </div>
        )}
        {store.error && (
          <div className="notice warn">
            <CircleAlert size={17} />
            {store.error}
            <button onClick={() => void store.refresh()} className="text-btn">
              Retry
            </button>
          </div>
        )}
        {!store.online && (
          <div className="notice warn" role="status" aria-live="polite">
            You’re offline. Cached inventory is shown; pending changes will sync when you reconnect.
          </div>
        )}
        {tab === "overview" && (
          <>
            <section className="stats-grid">
              {(
                [
                  [
                    "Products",
                    store.dashboard?.totalProducts ?? store.products.length,
                    Boxes,
                  ],
                  [
                    "Units in stock",
                    store.dashboard?.totalUnits ??
                      store.products.reduce((n, p) => n + p.currentStock, 0),
                    TrendingUp,
                  ],
                  [
                    "Low stock",
                    store.dashboard?.lowStockCount ??
                      store.products.filter((p) => stockStatus(p) === "low")
                        .length,
                    CircleAlert,
                  ],
                  [
                    "Stock value",
                    formatMoney(store.dashboard?.inventoryCostValue ?? 0),
                    Activity,
                  ],
                ] as [string, string | number, LucideIcon][]
              ).map(([title, value, Icon]) => (
                <article className="stat-card" key={title}>
                  <div className="stat-icon">
                    <Icon size={19} />
                  </div>
                  <span>{title}</span>
                  <strong>{value}</strong>
                </article>
              ))}
            </section>
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Low stock</h2>
                  <p className="muted">Products that need attention</p>
                </div>
                <button className="text-btn" onClick={() => setTab("products")}>
                  View products →
                </button>
              </div>
              <ProductTable
                products={lowStockPreview}
                onStock={setStock}
                onEdit={setProduct}
              />
            </section>
          </>
        )}
        {tab === "products" && (
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Product catalog</h2>
                <p className="muted">Search and manage your inventory</p>
              </div>
              <button
                className="primary-btn compact"
                onClick={() => setProduct("new")}
              >
                <Plus size={17} />
                Add product
              </button>
            </div>
            <div className="catalog-tools">
              <label className="search">
                <Search size={17} />
                <input
                  aria-label="Search products by name, SKU, or category"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, SKU or category"
                />
              </label>
              <label className="tool-select">
                <span>Stock status</span>
                <select aria-label="Filter products by stock status" value={productFilter} onChange={(e) => setProductFilter(e.target.value as ProductFilter)}>
                  <option value="all">All products</option>
                  <option value="ok">In stock</option>
                  <option value="low">Low stock</option>
                  <option value="out">Out of stock</option>
                </select>
              </label>
              <label className="tool-select">
                <span>Sort by</span>
                <select aria-label="Sort products" value={productSort} onChange={(e) => setProductSort(e.target.value)}>
                  <option value="name">Name</option>
                  <option value="stock">Stock: high to low</option>
                  <option value="low">Stock: low to high</option>
                  <option value="value">Selling price</option>
                </select>
              </label>
            </div>
            <ProductTable
              products={filtered}
              onStock={setStock}
              onEdit={setProduct}
              onDelete={setDeleting}
            />
          </section>
        )}
        {tab === "history" && (
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Recent transactions</h2>
                <p className="muted">
                  Stock movements recorded in your account
                </p>
              </div>
            </div>
            <div className="table-scroll history-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Type</th>
                    <th>Quantity</th>
                    <th>Reason</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {store.transactions.map((t) => (
                    <tr key={t.id}>
                      <td>{t.productName}</td>
                      <td>
                        <span
                          className={
                            t.type === "IN" ? "tag green" : "tag orange"
                          }
                        >
                          {t.type === "IN" ? "Stock in" : "Stock out"}
                        </span>
                      </td>
                      <td>
                        {t.type === "IN" ? "+" : "−"}
                        {t.quantity}
                      </td>
                      <td>{t.reason || "—"}</td>
                      <td>{new Date(t.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!store.transactions.length && (
                <p className="empty">
                  Transactions will appear here after stock changes.
                </p>
              )}
            </div>
            {/* Card layout for narrow screens: same rows, stacked. */}
            <div className="tx-cards">
              {store.transactions.map((t) => (
                <article className="tx-card" key={t.id} aria-label={`${t.type === "IN" ? "Stock in" : "Stock out"} ${t.productName}`}>
                  <div className="tx-card-head">
                    <strong>{t.productName}</strong>
                    <span
                      className={t.type === "IN" ? "tag green" : "tag orange"}
                    >
                      {t.type === "IN" ? "Stock in" : "Stock out"}
                    </span>
                  </div>
                  <div className="tx-card-meta">
                    <span>
                      Qty{" "}
                      <strong>
                        {t.type === "IN" ? "+" : "−"}
                        {t.quantity}
                      </strong>
                    </span>
                    <span>{t.reason || "—"}</span>
                    <span>{new Date(t.createdAt).toLocaleString()}</span>
                  </div>
                </article>
              ))}
              {!store.transactions.length && (
                <p className="empty">
                  Transactions will appear here after stock changes.
                </p>
              )}
            </div>
            {!store.txExhausted && (
              <div className="load-more-row">
                <button
                  className="outline-btn"
                  disabled={store.txLoadingMore}
                  onClick={() =>
                    void store.loadMoreTransactions(store.transactions.length + 100)
                  }
                >
                  {store.txLoadingMore ? "Loading…" : "Load older transactions"}
                </button>
              </div>
            )}
          </section>
        )}
        {tab === "reports" && (
          <Suspense
            fallback={
              <section className="panel">
                <p className="empty">Loading reports…</p>
              </section>
            }
          >
            <Reports
              transactions={store.transactions}
              products={store.products}
              onLoadOlder={loadOlder}
              loadingMore={store.txLoadingMore}
              exhausted={store.txExhausted}
            />
          </Suspense>
        )}
        {tab === "settings" && (
          <>
            <section className="panel settings-panel">
              <h2>Account settings</h2>
              {profile && (
                <dl className="profile-details">
                  <div><dt>Name</dt><dd>{profile.name}</dd></div>
                  <div><dt>Email</dt><dd>{profile.email}</dd></div>
                  <div><dt>Account status</dt><dd>{profile.accountStatus}</dd></div>
                </dl>
              )}
              <p className="muted">
                Your account and inventory are shared with your Stockly mobile
                app.
              </p>
              <button
                className="outline-btn"
                onClick={() => void store.refresh()}
              >
                Sync inventory now
              </button>
              <button className="danger-btn" onClick={() => void signOut()}>
                Sign out of this device
              </button>
            </section>
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Linked devices</h2>
                  <p className="muted">Devices with access to this account</p>
                </div>
              </div>
              <div className="device-link-panel">
                <div>
                  <strong>Link another device</strong>
                  <p className="muted">Generate a one-time code, then approve the request here.</p>
                </div>
                {!deviceLink ? (
                  <button
                    className="outline-btn"
                    disabled={deviceLinkBusy}
                    onClick={async () => {
                      setDeviceLinkBusy(true);
                      setDeviceError("");
                      try {
                        setDeviceLink(await devicesApi.createLink("code"));
                        setDeviceLinkView(null);
                      } catch (e) {
                        setDeviceError(e instanceof Error ? e.message : "Could not create a device link.");
                      } finally {
                        setDeviceLinkBusy(false);
                      }
                    }}
                  >
                    {deviceLinkBusy ? "Generating…" : "Generate code"}
                  </button>
                ) : (
                  <div className="link-code-card">
                    <strong>{deviceLink.code || "Code unavailable"}</strong>
                    <span role="status" aria-live="polite">
                      {deviceLinkView?.status === "claimed"
                        ? `${deviceLinkView.claimantName || "A device"} is requesting access.`
                        : deviceLinkView?.status === "approved"
                          ? "Device linked."
                          : deviceLinkView?.status && deviceLinkView.status !== "pending"
                            ? `Link ${deviceLinkView.status}.`
                            : `Expires ${new Date(deviceLink.expiresAt).toLocaleTimeString()}.`}
                    </span>
                    {deviceLinkView?.status === "claimed" && (
                      <div className="link-actions">
                        <button className="outline-btn" disabled={deviceLinkBusy} onClick={() => void decideDeviceLink(false)}>Reject</button>
                        <button className="primary-btn" disabled={deviceLinkBusy} onClick={() => void decideDeviceLink(true)}>{deviceLinkBusy ? "Approving…" : "Approve"}</button>
                      </div>
                    )}
                    <button className="text-btn" onClick={() => {
                      const id = deviceLink.linkId;
                      setDeviceLink(null);
                      setDeviceLinkView(null);
                      void devicesApi.cancelLink(id).catch(() => undefined);
                    }}>Cancel link</button>
                  </div>
                )}
              </div>
              {deviceError && <p className="error-text">{deviceError}</p>}
              {devices.map((d) => (
                <div className="device-row" key={d.deviceId}>
                  <div>
                    <strong>{d.name || "Stockly device"}</strong>
                    <p className="muted">
                      {d.platform} · Last active{" "}
                      {d.lastActiveAt
                        ? new Date(d.lastActiveAt).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                  <button
                    className="outline-btn"
                    disabled={revokingDevice === d.deviceId}
                    onClick={async () => {
                      setRevokingDevice(d.deviceId);
                      try {
                        await devicesApi.revokeDevice(d.deviceId);
                        setDevices((list) =>
                          list.filter((x) => x.deviceId !== d.deviceId),
                        );
                      } catch (e) {
                        setDeviceError(
                          e instanceof Error
                            ? e.message
                            : "Could not revoke device.",
                        );
                      } finally {
                        setRevokingDevice("");
                      }
                    }}
                  >
                    {revokingDevice === d.deviceId ? "Revoking…" : "Revoke"}
                  </button>
                </div>
              ))}
              {!devices.length && !deviceError && (
                <p className="empty">No linked devices found.</p>
              )}
            </section>
          </>
        )}
      </main>
      {product && (
        <Suspense fallback={<DialogFallback />}>
          <ProductDialog
            item={product === "new" ? null : product}
            categories={store.categories}
            onClose={() => setProduct(null)}
            onSave={async (input) => {
              const ok = await store.saveProduct(
                input,
                product === "new" ? undefined : product.id,
              );
              setNotice(ok ? "Product saved." : "Could not save product.");
              if (ok) setProduct(null);
            }}
          />
        </Suspense>
      )}
      {stock && (
        <Suspense fallback={<DialogFallback />}>
          <StockDialog
            data={stock}
            onClose={() => setStock(null)}
            onSubmit={async (quantity, reason) => {
              const ok =
                stock.type === "IN"
                  ? await store.doStockIn({
                      productId: stock.product.id,
                      quantity,
                    })
                  : await store.doStockOut({
                      productId: stock.product.id,
                      quantity,
                      reason,
                    });
              setNotice(ok ? "Stock updated." : "Could not update stock.");
              if (ok) setStock(null);
            }}
          />
        </Suspense>
      )}
      {deleting && (
        <Suspense fallback={<DialogFallback />}>
          <ConfirmDialog
            title="Delete product?"
            body={`“${deleting.name}” will be removed from your catalog. Past transactions are kept for records. This cannot be undone.`}
            confirmLabel="Delete"
            busy={deleteBusy}
            onCancel={() => setDeleting(null)}
            onConfirm={() => void confirmDelete()}
          />
        </Suspense>
      )}
    </div>
  );
}
