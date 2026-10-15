import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Boxes,
  ChevronDown,
  CircleAlert,
  LayoutDashboard,
  LogOut,
  Plus,
  Search,
  Settings,
  TrendingDown,
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
  type ProductFormInput,
} from "./shared/store";
import type { Product } from "./shared/types";

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
      <section className="login-card">
        <Brand />
        <p className="eyebrow">INVENTORY WORKSPACE</p>
        <h1>{register ? "Create your account" : "Welcome back"}</h1>
        <p className="muted">
          Sign in to manage your products and stock activity.
        </p>
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
            <input
              name="password"
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              minLength={register ? 10 : undefined}
              required
            />
          </label>
          {error && <p className="error-text">{error}</p>}
          <button className="primary-btn" disabled={busy}>
            {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
          </button>
        </form>
        <button
          className="text-btn"
          onClick={() => {
            setRegister(!register);
            setError("");
          }}
        >
          {register
            ? "Already registered? Sign in"
            : "New to Stockly? Create an account"}
        </button>
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
    const result = store.products.filter((p) => {
      const matchesQuery = `${p.name} ${p.sku} ${p.categoryName || ""}`
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchesStatus = productFilter === "all" || stockStatus(p) === productFilter;
      return matchesQuery && matchesStatus;
    });
    return result.sort((a, b) => {
      if (productSort === "stock") return b.currentStock - a.currentStock;
      if (productSort === "low") return a.currentStock - b.currentStock;
      if (productSort === "value") return b.sellingPrice - a.sellingPrice;
      return a.name.localeCompare(b.name);
    });
  }, [store.products, query, productFilter, productSort]);
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
                products={store.products
                  .filter((p) => stockStatus(p) !== "ok")
                  .slice(0, 6)}
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
              onDelete={async (p) => {
                if (confirm(`Delete ${p.name}?`)) {
                  const ok = await store.removeProduct(p.id);
                  setNotice(
                    ok ? "Product deleted." : "Could not delete product.",
                  );
                }
              }}
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
            <div className="table-scroll">
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
          <Reports
            transactions={store.transactions}
            products={store.products}
            onLoadOlder={() =>
              void store.loadMoreTransactions(store.transactions.length + 100)
            }
            loadingMore={store.txLoadingMore}
            exhausted={store.txExhausted}
          />
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
      )}
      {stock && (
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
      )}
    </div>
  );
}

function ConnectSheet({
  initialError,
  onConnected,
  onSignOut,
}: {
  initialError: string;
  onConnected: () => void;
  onSignOut: () => void;
}) {
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await sheetsApi.connectSheet(
        String(new FormData(e.currentTarget).get("url")).trim(),
      );
      onConnected();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not verify this Google Sheet.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-wrap">
      <section className="login-card">
        <Brand />
        <p className="eyebrow">FIRST TIME SETUP</p>
        <h1>Connect your inventory</h1>
        <p className="muted">
          Paste your private Google Apps Script Web App URL. Stockly verifies it
          through the shared backend and never stores the URL in this browser.
        </p>
        <form className="form-stack" onSubmit={submit}>
          <label>
            Apps Script Web App URL
            <input
              name="url"
              type="url"
              placeholder="https://script.google.com/macros/s/…/exec"
              required
            />
          </label>
          {error && <p className="error-text">{error}</p>}
          <button className="primary-btn" disabled={busy}>
            {busy ? "Verifying…" : "Verify and connect"}
          </button>
        </form>
        <p className="muted">
          Deploy `apps-script/Code.gs` as a Web App, then keep your Google Sheet
          private.
        </p>
        <button className="text-btn" onClick={onSignOut}>
          Sign out
        </button>
      </section>
    </main>
  );
}

function Reports({
  transactions,
  products,
  onLoadOlder,
  loadingMore,
  exhausted,
}: {
  transactions: import("./shared/types").StockTransaction[];
  products: Product[];
  onLoadOlder: () => void;
  loadingMore: boolean;
  exhausted: boolean;
}) {
  const added = transactions
    .filter((t) => t.type === "IN")
    .reduce((n, t) => n + t.quantity, 0);
  const removed = transactions
    .filter((t) => t.type === "OUT")
    .reduce((n, t) => n + t.quantity, 0);
  function exportCsv() {
    const rows = [
      ["Date", "Product", "Type", "Quantity", "Price", "Reason"],
      ...transactions.map((t) => [
        new Date(t.createdAt).toISOString(),
        t.productName,
        t.type,
        String(t.quantity),
        String(t.price),
        t.reason,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "stockly-transactions.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <section className="stats-grid">
        <article className="stat-card">
          <span>Units received</span>
          <strong>{added}</strong>
        </article>
        <article className="stat-card">
          <span>Units removed</span>
          <strong>{removed}</strong>
        </article>
        <article className="stat-card">
          <span>Net movement</span>
          <strong>{added - removed}</strong>
        </article>
        <article className="stat-card">
          <span>Catalog value</span>
          <strong>
            {formatMoney(
              products.reduce((n, p) => n + p.currentStock * p.costPrice, 0),
            )}
          </strong>
        </article>
      </section>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Inventory activity report</h2>
            <p className="muted">Based on the synced transaction history</p>
          </div>
          <button className="outline-btn" onClick={exportCsv}>
            Download CSV
          </button>
        </div>
        <p className="muted">
          {transactions.length} loaded transactions · {products.length} products
        </p>
        {!exhausted && (
          <button
            className="outline-btn"
            disabled={loadingMore}
            onClick={onLoadOlder}
          >
            {loadingMore ? "Loading…" : "Load older transactions"}
          </button>
        )}
      </section>
    </>
  );
}

function ProductTable({
  products,
  onStock,
  onEdit,
  onDelete,
}: {
  products: Product[];
  onStock: (x: { product: Product; type: "IN" | "OUT" }) => void;
  onEdit: (p: Product) => void;
  onDelete?: (p: Product) => void;
}) {
  return (
    <div className="table-scroll">
      <table aria-label="Inventory products">
        <thead>
          <tr>
            <th>Product</th>
            <th>SKU</th>
            <th>Category</th>
            <th>Stock</th>
            <th>Price</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
            {products.map((p) => (
            <tr key={p.id}>
              <td>
                <strong>{p.name}</strong>
                <small>{p.description}</small>
              </td>
              <td>{p.sku || "—"}</td>
              <td>{p.categoryName || "Uncategorized"}</td>
              <td>
                <span
                  className={
                    stockStatus(p) === "ok" ? "tag green" : "tag orange"
                  }
                >
                  {p.currentStock} {stockStatus(p) === "low" ? "· Low" : ""}
                  {stockStatus(p) === "out" ? "· Out" : ""}
                </span>
              </td>
              <td>{formatMoney(p.sellingPrice)}</td>
              <td>
                <div className="row-actions">
                  <button
                    title={`Stock in ${p.name}`}
                    aria-label={`Stock in ${p.name}`}
                    onClick={() => onStock({ product: p, type: "IN" })}
                  >
                    <TrendingUp size={16} />
                  </button>
                  <button
                    title={`Stock out ${p.name}`}
                    aria-label={`Stock out ${p.name}`}
                    disabled={p.currentStock <= 0}
                    onClick={() => onStock({ product: p, type: "OUT" })}
                  >
                    <TrendingDown size={16} />
                  </button>
                  <button onClick={() => onEdit(p)} aria-label={`Edit ${p.name}`}>Edit</button>
                  {onDelete && (
                    <button
                      className="delete-action"
                      aria-label={`Delete ${p.name}`}
                      onClick={() => onDelete(p)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!products.length && <p className="empty">No products to show.</p>}
    </div>
  );
}

function ProductDialog({
  item,
  categories,
  onClose,
  onSave,
}: {
  item: Product | null;
  categories: { id: string; name: string }[];
  onClose: () => void;
  onSave: (input: ProductFormInput) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const f = new FormData(e.currentTarget);
      await onSave({
        name: String(f.get("name")),
        sku: String(f.get("sku")),
        categoryId: String(f.get("categoryId")),
        description: String(f.get("description")),
        image: "",
        costPrice: Number(f.get("costPrice")),
        sellingPrice: Number(f.get("sellingPrice")),
        currentStock: Number(f.get("currentStock")),
        minimumStock: Number(f.get("minimumStock")),
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="scrim"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form className="dialog" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="product-dialog-title">
        <div className="dialog-head">
          <h2 id="product-dialog-title">{item ? "Edit product" : "Add product"}</h2>
          <button type="button" onClick={onClose} aria-label="Close product form">
            <X size={18} />
          </button>
        </div>
        <label>
          Product name
          <input name="name" required defaultValue={item?.name} />
        </label>
        <div className="two-col">
          <label>
            SKU
            <input name="sku" defaultValue={item?.sku} />
          </label>
          <label>
            Category
            <select name="categoryId" defaultValue={item?.categoryId || ""}>
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Description
          <input name="description" defaultValue={item?.description} />
        </label>
        <div className="two-col">
          <label>
            Cost price
            <input
              name="costPrice"
              type="number"
              min="0"
              step="0.01"
              defaultValue={item?.costPrice ?? 0}
            />
          </label>
          <label>
            Selling price
            <input
              name="sellingPrice"
              type="number"
              min="0"
              step="0.01"
              defaultValue={item?.sellingPrice ?? 0}
            />
          </label>
        </div>
        <div className="two-col">
          <label>
            Current stock
            <input
              name="currentStock"
              type="number"
              min="0"
              defaultValue={item?.currentStock ?? 0}
            />
          </label>
          <label>
            Low stock threshold
            <input
              name="minimumStock"
              type="number"
              min="0"
              defaultValue={item?.minimumStock ?? 0}
            />
          </label>
        </div>
        <div className="dialog-actions">
          <button type="button" className="outline-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-btn" disabled={busy}>
            {busy ? "Saving…" : "Save product"}
          </button>
        </div>
      </form>
    </div>
  );
}

function StockDialog({
  data,
  onClose,
  onSubmit,
}: {
  data: { product: Product; type: "IN" | "OUT" };
  onClose: () => void;
  onSubmit: (q: number, r: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const f = new FormData(e.currentTarget);
      await onSubmit(Number(f.get("quantity")), String(f.get("reason") || ""));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="scrim"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form className="dialog" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="stock-dialog-title">
        <div className="dialog-head">
          <h2 id="stock-dialog-title">Stock {data.type === "IN" ? "in" : "out"}</h2>
          <button type="button" onClick={onClose} aria-label="Close stock adjustment">
            <X size={18} />
          </button>
        </div>
        <p className="muted">
          {data.product.name} · Available: {data.product.currentStock}
        </p>
        <label>
          Quantity
          <input
            name="quantity"
            type="number"
            min="1"
            max={data.type === "OUT" ? data.product.currentStock : undefined}
            required
            autoFocus
          />
        </label>
        {data.type === "OUT" && (
          <label>
            Reason
            <select name="reason">
              <option>Sale</option>
              <option>Damaged</option>
              <option>Lost</option>
              <option>Return</option>
              <option>Other</option>
            </select>
          </label>
        )}
        <div className="dialog-actions">
          <button type="button" className="outline-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-btn" disabled={busy}>
            {busy ? "Saving…" : "Confirm"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Brand() {
  return (
    <a className="brand" href="/">
      <span className="brand-mark">S</span>
      <span>stockly</span>
      <ChevronDown size={14} />
    </a>
  );
}
