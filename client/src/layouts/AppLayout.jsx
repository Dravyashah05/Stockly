import { useState, useEffect, useRef, Suspense, lazy } from "react";
import { useNavigate, useLocation, NavLink, Link } from "react-router-dom";
import {
  House,
  Package,
  ArrowLeftRight,
  BarChart3,
  Settings,
  FolderKanban,
  Building2,
  Shield,
  LayoutDashboard,
  LogOut,
  Search,
  X,
  Moon,
  Sun,
  Bell,
  AlertTriangle,
  ArrowUpRight,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
  Smartphone,
  TrendingUp,
  TrendingDown,
  ArrowUpCircle,
  ArrowDownCircle,
  CheckCircle2,
  Clock,
  PackageX,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useSearch } from "../context/SearchContext";
import { getProducts } from "../api/products";
import { getRecentTransactions } from "../api/stock";
import { checkAppUpdate, dismissUpdateVersion } from "../api/appUpdate";
import {
  sendLowStockNotification,
  sendOutOfStockNotification,
  checkNotificationPermission,
} from "../utils/notifications";
import BottomNav from "./BottomNav";
import TopProgress from "../components/ui/TopProgress";
// Code-split: the AI drawer is heavy and only used on demand — keep it out
// of the initial bundle.
const AiCopilotDrawer = lazy(() => import("../components/ai/AiCopilotDrawer"));
import AppLogo from "../components/ui/AppLogo";
import AppUpdateModal from "../components/app/AppUpdateModal";

export default function AppLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const saved = localStorage.getItem("stockly_sidebar_open");
      return saved !== null ? saved === "true" : true;
    } catch {
      return true;
    }
  });
  const [aiCopilotOpen, setAiCopilotOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifTab, setNotifTab] = useState("all"); // "all" | "alerts" | "out"
  const [sidebarNotif, setSidebarNotif] = useState(() => {
    try { return localStorage.getItem("stockly_sidebar_notif") !== "false"; } catch { return true; }
  });
  const [lowStockItems, setLowStockItems] = useState([]);
  const [outStockItems, setOutStockItems] = useState([]);
  const [recentTx, setRecentTx] = useState([]);

  // Auto-Update State
  const [autoUpdateModalOpen, setAutoUpdateModalOpen] = useState(false);
  const [autoUpdateInfo, setAutoUpdateInfo] = useState(null);

  const searchInputRef = useRef(null);
  const mobileSearchRef = useRef(null);
  const notifRef = useRef(null);
  const updateCheckedRef = useRef(false);
  const notifSentRef = useRef(false);

  const loc = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isDark, toggle } = useTheme();
  const { search, setSearch } = useSearch();

  const showSearch = ["/products", "/stock"].some((p) => loc.pathname.startsWith(p));
  const placeholder = loc.pathname.startsWith("/products")
    ? "Search inventory catalog…"
    : loc.pathname.startsWith("/stock")
    ? "Filter ledger records…"
    : "Quick search…";
  const isActive = (to) => loc.pathname === to || (to !== "/home" && loc.pathname.startsWith(to));

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("stockly_sidebar_open", String(next));
      } catch {}
      return next;
    });
  };

  // Auto-check for updates on app start (once per session)
  useEffect(() => {
    if (updateCheckedRef.current) return;
    updateCheckedRef.current = true;

    try {
      const autoUpdate = localStorage.getItem("stockly_auto_update") !== "false";
      if (!autoUpdate) return;
    } catch {}

    const timer = setTimeout(async () => {
      try {
        const res = await checkAppUpdate();
        if (res?.hasUpdate) {
          setAutoUpdateInfo(res);
          setAutoUpdateModalOpen(true);
        }
      } catch {}
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  // Fetch low/out stock items and trigger local notifications if enabled
  useEffect(() => {
    getProducts({ limit: 50 })
      .then((r) => {
        const all = r.data || [];
        const low = all.filter(p => p.quantity > 0 && p.quantity <= (p.minimumStock ?? p.minimumQuantity ?? 5)).slice(0, 8);
        const out = all.filter(p => p.quantity === 0).slice(0, 8);
        setLowStockItems(low);
        setOutStockItems(out);

        // Check if we should dispatch a background notification for low/out items (once per session)
        if (!notifSentRef.current && (low.length > 0 || out.length > 0)) {
          try {
            const notifEnabled = localStorage.getItem("stockly_notifications_enabled") !== "false";
            if (notifEnabled) {
              notifSentRef.current = true;
              checkNotificationPermission().then((granted) => {
                if (granted) {
                  if (out.length > 0) {
                    sendOutOfStockNotification(out[0].name);
                  } else if (low.length > 0) {
                    sendLowStockNotification(low[0].name, low[0].quantity, low[0].minimumStock ?? 5);
                  }
                }
              });
            }
          } catch {}
        }
      })
      .catch(() => {});
    getRecentTransactions()
      .then((r) => setRecentTx((r.data || []).slice(0, 6)))
      .catch(() => {});
  }, [loc.pathname]);

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchInputRef.current?.focus(), 50);
  }, [searchOpen]);
  useEffect(() => {
    if (searchOpen) setTimeout(() => mobileSearchRef.current?.focus(), 50);
  }, [searchOpen]);

  // Close menus on route change
  useEffect(() => {
    setSearchOpen(false);
    setNotificationsOpen(false);
  }, [loc.pathname]);

  // Keyboard shortcut Ctrl+B or Cmd+B to toggle sidebar, Escape to dismiss
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "b" || e.key === "B")) {
        e.preventDefault();
        toggleSidebar();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "j")) {
        e.preventDefault();
        setAiCopilotOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setNotificationsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handleOpenCopilot = () => setAiCopilotOpen(true);
    window.addEventListener("stockly:open-copilot", handleOpenCopilot);
    return () => window.removeEventListener("stockly:open-copilot", handleOpenCopilot);
  }, []);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotificationsOpen(false);
    };
    if (notificationsOpen) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [notificationsOpen]);

  const totalAlerts = lowStockItems.length + outStockItems.length;

  const navGroups = [
    {
      group: "Operations",
      items: [
        { to: "/home", label: "Home", icon: House },
        { to: "/products", label: "Products", icon: Package },
        { to: "/stock", label: "Ledger", icon: ArrowLeftRight },
        { to: "/categories", label: "Categories", icon: FolderKanban },
        { to: "/suppliers", label: "Suppliers", icon: Building2 },
      ],
    },
    {
      group: "Intelligence",
      items: [
        {
          to: "#ai",
          label: "Stockly AI",
          icon: Sparkles,
          isAi: true,
          badge: "AI",
        },
        { to: "/dashboard", label: "Insights", icon: BarChart3 },
        { to: "/reports", label: "Reports", icon: LayoutDashboard },
        { to: "/audit", label: "Audit", icon: Shield },
      ],
    },
    {
      group: "System",
      items: [
        { to: "/settings", label: "Settings", icon: Settings },
        { to: "/app-store", label: "Mobile App", icon: Smartphone, badge: "APK" },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 flex flex-col lg:flex-row antialiased">
      <TopProgress />

      {/* 1. DESKTOP FLOATING GLASS SIDEBAR (lg+) */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 sticky top-0 h-screen select-none z-30 transition-all duration-300 ease-in-out ${
          sidebarOpen
            ? "w-[280px] xl:w-[312px] opacity-100 p-3"
            : "w-0 opacity-0 overflow-hidden p-0 pointer-events-none"
        }`}
      >
        <div className="w-[256px] xl:w-[288px] flex flex-col h-full rounded-3xl bg-white/75 dark:bg-zinc-900/75 backdrop-blur-2xl border border-white/50 dark:border-white/10 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.25)] overflow-hidden">
          {/* Sidebar Workspace Brand / Header */}
          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
            <Link to="/home" className="flex items-center gap-3 group">
              <AppLogo size="md" className="group-hover:scale-105 transition-transform" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-sm text-zinc-900 dark:text-white tracking-tight">Stockly OS</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="System Live" />
                </div>
                <div className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium">Inventory Workspace</div>
              </div>
            </Link>

            <div className="flex items-center gap-1">
              <button
                onClick={toggle}
                className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 grid place-items-center hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 transition"
                title={isDark ? "Switch to light mode" : "Switch to dark mode"}
                aria-label="Toggle theme"
              >
                {isDark ? <Sun size={15} /> : <Moon size={15} />}
              </button>

              <button
                onClick={toggleSidebar}
                className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 grid place-items-center hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white active:scale-95 transition"
                title="Hide sidebar (Ctrl+B)"
                aria-label="Hide sidebar"
              >
                <PanelLeftClose size={16} />
              </button>
            </div>
          </div>

          {/* Sidebar Nav Items */}
          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
            {navGroups.map((g) => (
              <div key={g.group} className="space-y-1">
                <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  {g.group}
                </div>
                <div className="space-y-0.5">
                  {g.items.map((item) => {
                    const Icon = item.icon;
                    if (item.isAi) {
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => setAiCopilotOpen(true)}
                          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-violet-700 dark:text-violet-300 bg-violet-50/70 dark:bg-violet-500/10 hover:bg-violet-100 dark:hover:bg-violet-500/20 active:scale-[0.98] transition-all duration-150 group"
                        >
                          <Icon size={16} className="text-violet-600 dark:text-violet-400 group-hover:scale-110 transition-transform" />
                          <span className="flex-1 text-left truncate">{item.label}</span>
                          <span className="px-1.5 py-0.5 rounded-full bg-violet-600 text-white text-[9px] font-extrabold uppercase shadow-2xs">
                            AI
                          </span>
                        </button>
                      );
                    }

                    const active = isActive(item.to);
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all duration-150 ${
                          active
                            ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm"
                            : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 hover:text-zinc-900 dark:hover:text-white"
                        }`}
                      >
                        <Icon size={16} strokeWidth={active ? 2.4 : 1.8} className="shrink-0" />
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge && (
                          <span className="px-1.5 py-0.5 rounded-md bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 text-[10px] font-extrabold uppercase">
                            {item.badge}
                          </span>
                        )}
                        {item.to === "/products" && lowStockItems.length > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                            {lowStockItems.length}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Sidebar Notification Widget */}
            {sidebarNotif && totalAlerts > 0 && (
              <div className="space-y-1">
                <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Alerts
                </div>
                <div className="rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 p-3 space-y-2">
                  {outStockItems.length > 0 && (
                    <Link to="/products" className="flex items-center gap-2.5 group">
                      <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-500/20 grid place-items-center shrink-0">
                        <PackageX size={13} className="text-red-600 dark:text-red-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold text-red-700 dark:text-red-300 group-hover:underline">{outStockItems.length} Out of Stock</div>
                        <div className="text-[10px] text-zinc-500 truncate">{outStockItems.slice(0,2).map(p=>p.name).join(", ")}{outStockItems.length>2?` +${outStockItems.length-2} more`:""}</div>
                      </div>
                    </Link>
                  )}
                  {lowStockItems.length > 0 && (
                    <Link to="/products" className="flex items-center gap-2.5 group">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-500/20 grid place-items-center shrink-0">
                        <AlertTriangle size={13} className="text-amber-600 dark:text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold text-amber-700 dark:text-amber-300 group-hover:underline">{lowStockItems.length} Low Stock</div>
                        <div className="text-[10px] text-zinc-500 truncate">{lowStockItems.slice(0,2).map(p=>p.name).join(", ")}{lowStockItems.length>2?` +${lowStockItems.length-2} more`:""}</div>
                      </div>
                    </Link>
                  )}
                  <button
                    onClick={() => { setSidebarNotif(false); try { localStorage.setItem("stockly_sidebar_notif","false"); } catch {} }}
                    className="w-full text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-center pt-1 transition"
                  >
                    Hide from sidebar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom User Card */}
          <div className="p-3 border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/50">
            <div className="p-2.5 rounded-2xl bg-white dark:bg-zinc-800/70 border border-zinc-200/70 dark:border-zinc-700/60 flex items-center justify-between gap-2 shadow-2xs">
              <Link to="/settings" className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-80 transition">
                <div className="w-8 h-8 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 grid place-items-center font-bold text-xs shrink-0">
                  {(user?.name?.[0] || "U").toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                    {user?.name || "Operations User"}
                  </div>
                  <div className="text-[10px] text-zinc-400 truncate">{user?.email || "Signed In"}</div>
                </div>
              </Link>

              <button
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
                className="w-8 h-8 rounded-xl grid place-items-center text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 active:scale-95 transition"
                title="Sign Out"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* 3. MAIN APPLICATION CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Native App Bar */}
        {/* Floating glass navbar */}
        <header
          className="sticky top-0 z-20 px-3 sm:px-6"
          style={{ paddingTop: "max(env(safe-area-inset-top), 10px)" }}
        >
          <div className="h-16 px-3 sm:px-4 flex items-center justify-between gap-2.5 sm:gap-3 rounded-2xl bg-white/75 dark:bg-zinc-900/75 backdrop-blur-2xl border border-white/50 dark:border-white/10 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.25)]">
            {/* Left: Compact mobile brand (no hamburger — bottom tabs own navigation) */}
            <Link to="/home" className="flex items-center gap-2 lg:hidden min-w-0" aria-label="Stockly home">
              <AppLogo size="sm" />
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="font-extrabold text-[15px] tracking-tight text-zinc-900 dark:text-white truncate">Stockly</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" title="System live" />
              </span>
            </Link>

            {/* Desktop Left: Sidebar Show/Hide Toggle & Breadcrumb */}
            <div className="hidden lg:flex items-center gap-3">
              <button
                type="button"
                onClick={toggleSidebar}
                className="w-9 h-9 grid place-items-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white active:scale-95 transition"
                title={sidebarOpen ? "Hide sidebar (Ctrl+B)" : "Show sidebar (Ctrl+B)"}
                aria-label="Toggle sidebar"
              >
                {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
              </button>

              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 dark:text-zinc-500">
                <span className="text-zinc-800 dark:text-zinc-200 font-bold">Stockly Cloud</span>
                <span>/</span>
                <span className="capitalize text-zinc-600 dark:text-zinc-400">
                  {loc.pathname.replace("/", "").replace(/-/g, " ") || "Dashboard"}
                </span>
              </div>
            </div>

            {/* Global Search Bar Trigger (Inline on desktop) */}
            {showSearch && (
              <div className="hidden sm:flex flex-1 max-w-sm mx-auto">
                <div className="relative w-full">
                  <Search
                    size={14}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
                  />
                  <input
                    ref={searchInputRef}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={placeholder}
                    className="w-full pl-9 pr-8 py-2.5 bg-zinc-100 dark:bg-zinc-900 border border-transparent rounded-full text-[13px] font-medium placeholder:text-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:border-zinc-300 dark:focus:border-zinc-700 focus:outline-none transition"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Right Action Icons */}
            <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
              {/* AI Copilot Trigger Button — desktop only (bottom tab orb covers mobile) */}
              <button
                type="button"
                onClick={() => setAiCopilotOpen(true)}
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold shadow-sm shadow-primary-600/25 active:scale-95 transition"
                title="Open Stockly AI (Ctrl+K)"
              >
                <Sparkles size={14} />
                <span className="hidden sm:inline">Stockly AI</span>
              </button>

              {/* Mobile search trigger */}
              {showSearch && (
                <button
                  onClick={() => setSearchOpen((v) => !v)}
                  className={`w-9 h-9 grid place-items-center rounded-xl border transition sm:hidden ${
                    searchOpen
                      ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white"
                      : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400"
                  }`}
                  aria-label="Toggle search"
                >
                  <Search size={15} />
                </button>
              )}

              {/* Notification Center */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setNotificationsOpen((v) => !v)}
                  className={`w-9 h-9 grid place-items-center rounded-xl border transition relative ${
                    notificationsOpen
                      ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white"
                      : "bg-white dark:bg-zinc-900 border-zinc-200/90 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 shadow-2xs"
                  }`}
                  aria-label="Notifications"
                >
                  <Bell size={15} />
                  {totalAlerts > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-500 text-white font-bold text-[9px] grid place-items-center shadow-xs">
                      {totalAlerts}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-88 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden z-40 animate-slide-up" style={{width:"22rem"}}>
                    {/* Panel header */}
                    <div className="px-4 pt-3 pb-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bell size={14} className="text-zinc-500" />
                        <span className="font-bold text-sm text-zinc-900 dark:text-white">Notifications</span>
                        {totalAlerts > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-extrabold">{totalAlerts}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { const next = !sidebarNotif; setSidebarNotif(next); try { localStorage.setItem("stockly_sidebar_notif", String(next)); } catch {} }}
                          className="text-[10px] font-semibold text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition"
                          title="Toggle sidebar notifications"
                        >
                          {sidebarNotif ? "Sidebar: On" : "Sidebar: Off"}
                        </button>
                        <button onClick={() => setNotificationsOpen(false)} className="w-6 h-6 grid place-items-center rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                          <X size={13}/>
                        </button>
                      </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-zinc-100 dark:border-zinc-800 px-2 pt-1">
                      {[
                        { key: "all", label: "All", count: totalAlerts + recentTx.length },
                        { key: "alerts", label: "Low Stock", count: lowStockItems.length },
                        { key: "out", label: "Out of Stock", count: outStockItems.length },
                        { key: "activity", label: "Activity", count: recentTx.length },
                      ].map(tab => (
                        <button
                          key={tab.key}
                          onClick={() => setNotifTab(tab.key)}
                          className={`flex items-center gap-1 px-3 py-2 text-[11px] font-bold rounded-t-lg transition border-b-2 -mb-px ${
                            notifTab === tab.key
                              ? "border-zinc-900 dark:border-white text-zinc-900 dark:text-white"
                              : "border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                          }`}
                        >
                          {tab.label}
                          {tab.count > 0 && (
                            <span className={`px-1.5 rounded-full text-[9px] font-extrabold ${notifTab===tab.key ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"}`}>{tab.count}</span>
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Tab content */}
                    <div className="max-h-80 overflow-y-auto divide-y divide-zinc-50 dark:divide-zinc-800/60">
                      {/* Out of stock items */}
                      {(notifTab === "all" || notifTab === "out") && outStockItems.map(item => (
                        <Link key={item._id} to={`/products/${item._id}`} onClick={() => setNotificationsOpen(false)}
                          className="p-3 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition group">
                          <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 grid place-items-center shrink-0 overflow-hidden">
                            {item.image ? <img src={item.image} alt="" className="w-full h-full object-cover rounded-xl"/> : <PackageX size={15} className="text-red-500"/>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-zinc-900 dark:text-white truncate group-hover:underline">{item.name} <ArrowUpRight size={10} className="inline text-zinc-400"/></div>
                            <div className="text-[11px] text-zinc-500">0 units · min {item.minimumStock ?? 5}</div>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300 shrink-0">Out</span>
                        </Link>
                      ))}

                      {/* Low stock items */}
                      {(notifTab === "all" || notifTab === "alerts") && lowStockItems.map(item => (
                        <Link key={item._id} to={`/products/${item._id}`} onClick={() => setNotificationsOpen(false)}
                          className="p-3 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition group">
                          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 grid place-items-center shrink-0 overflow-hidden">
                            {item.image ? <img src={item.image} alt="" className="w-full h-full object-cover rounded-xl"/> : <AlertTriangle size={14} className="text-amber-500"/>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-zinc-900 dark:text-white truncate group-hover:underline">{item.name} <ArrowUpRight size={10} className="inline text-zinc-400"/></div>
                            <div className="text-[11px] text-zinc-500">{item.quantity} {item.unit || "units"} · min {item.minimumStock ?? 5}</div>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 shrink-0">Low</span>
                        </Link>
                      ))}

                      {/* Recent transactions */}
                      {(notifTab === "all" || notifTab === "activity") && recentTx.map(t => (
                        <div key={t._id} className="p-3 flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 border ${t.type==="IN" ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20" : "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20"}`}>
                            {t.type === "IN" ? <TrendingUp size={13} className="text-emerald-600 dark:text-emerald-400"/> : <TrendingDown size={13} className="text-red-500 dark:text-red-400"/>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-zinc-900 dark:text-white truncate">{t.productId?.name || "Product"}</div>
                            <div className="text-[11px] text-zinc-500 flex items-center gap-1">
                              <span className={`font-semibold ${t.type==="IN"?"text-emerald-600":"text-red-500"}`}>{t.type} {t.quantity}</span>
                              <span>·</span>
                              <span>{t.reason || "—"}</span>
                            </div>
                          </div>
                          <div className="text-[10px] text-zinc-400 shrink-0">{new Date(t.createdAt).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</div>
                        </div>
                      ))}

                      {/* Empty state */}
                      {(
                        (notifTab === "all" && totalAlerts === 0 && recentTx.length === 0) ||
                        (notifTab === "alerts" && lowStockItems.length === 0) ||
                        (notifTab === "out" && outStockItems.length === 0) ||
                        (notifTab === "activity" && recentTx.length === 0)
                      ) && (
                        <div className="py-10 text-center text-xs text-zinc-500">
                          <CheckCircle2 size={28} className="mx-auto mb-2 text-emerald-500 opacity-60"/>
                          {notifTab === "activity" ? "No recent transactions" : "✨ All inventory is well-stocked!"}
                        </div>
                      )}
                    </div>

                    {/* Footer quick actions */}
                    <div className="px-3 py-2.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                      <Link
                        to="/stock?type=IN"
                        onClick={() => setNotificationsOpen(false)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition active:scale-95"
                      >
                        <ArrowUpCircle size={12}/> Stock In
                      </Link>
                      <Link
                        to="/stock?type=OUT"
                        onClick={() => setNotificationsOpen(false)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[11px] font-bold transition active:scale-95"
                      >
                        <ArrowDownCircle size={12}/> Stock Out
                      </Link>
                      <Link
                        to="/products"
                        onClick={() => setNotificationsOpen(false)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[11px] font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition active:scale-95"
                      >
                        Products
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile drop-down search */}
          {showSearch && searchOpen && (
            <div className="sm:hidden mt-2 p-2.5 rounded-2xl bg-white/75 dark:bg-zinc-900/75 backdrop-blur-2xl border border-white/50 dark:border-white/10 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.25)]">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
                />
                <input
                  ref={mobileSearchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={placeholder}
                  className="w-full pl-9 pr-9 py-2.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold placeholder:text-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:border-zinc-900 dark:focus:border-white focus:outline-none transition"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          )}
        </header>

        {/* 4. SCROLLABLE APPLICATION VIEWPORT */}
        <main key={loc.pathname} className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 pb-28 lg:pb-12 animate-fade-in">
          {children}
        </main>

        {/* 5. DOCKED MOBILE BOTTOM APP BAR */}
        <BottomNav />

        {/* 6. AI COPILOT SLIDE-OVER DRAWER */}
        {aiCopilotOpen && (
          <Suspense fallback={null}>
            <AiCopilotDrawer open={aiCopilotOpen} onClose={() => setAiCopilotOpen(false)} />
          </Suspense>
        )}

        {/* 7. APP UPDATE MODAL */}
        <AppUpdateModal
          open={autoUpdateModalOpen}
          onClose={() => setAutoUpdateModalOpen(false)}
          updateInfo={autoUpdateInfo}
          onRemindLater={(info) => {
            if (info?.latestVersion) dismissUpdateVersion(info.latestVersion);
            setAutoUpdateModalOpen(false);
          }}
        />
      </div>
    </div>
  );
}
