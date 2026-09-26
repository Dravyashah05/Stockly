import { useState, useEffect, useRef } from "react";
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
  PanelLeft,
  Menu,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useSearch } from "../context/SearchContext";
import { getProducts } from "../api/products";
import BottomNav from "./BottomNav";
import TopProgress from "../components/ui/TopProgress";

export default function AppLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const saved = localStorage.getItem("stockly_sidebar_open");
      return saved !== null ? saved === "true" : true;
    } catch {
      return true;
    }
  });
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [lowStockItems, setLowStockItems] = useState([]);

  const searchInputRef = useRef(null);
  const mobileSearchRef = useRef(null);
  const notifRef = useRef(null);

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

  // Fetch low stock items for the notification popover
  useEffect(() => {
    getProducts("?lowStock=true&limit=8")
      .then((r) => setLowStockItems(r.data || []))
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
    setMobileDrawerOpen(false);
    setNotificationsOpen(false);
  }, [loc.pathname]);

  // Keyboard shortcut Ctrl+B or Cmd+B to toggle sidebar, Escape to dismiss
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "b" || e.key === "B")) {
        e.preventDefault();
        toggleSidebar();
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setMobileDrawerOpen(false);
        setNotificationsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotificationsOpen(false);
    };
    if (notificationsOpen) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [notificationsOpen]);

  const navGroups = [
    {
      group: "Operations",
      items: [
        { to: "/home", label: "Dashboard", icon: House },
        { to: "/products", label: "Products Catalog", icon: Package },
        { to: "/stock", label: "Stock Ledger", icon: ArrowLeftRight },
        { to: "/categories", label: "Categories", icon: FolderKanban },
        { to: "/suppliers", label: "Suppliers & Vendors", icon: Building2 },
      ],
    },
    {
      group: "Intelligence",
      items: [
        { to: "/dashboard", label: "Insights & KPIs", icon: BarChart3 },
        { to: "/reports", label: "Reports & Export", icon: LayoutDashboard },
        { to: "/audit", label: "Security & Audit", icon: Shield },
      ],
    },
    {
      group: "System",
      items: [
        { to: "/settings", label: "App Settings & Sync", icon: Settings },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-100/70 dark:bg-zinc-950 flex flex-col lg:flex-row antialiased selection:bg-zinc-900 selection:text-white">
      <TopProgress />

      {/* 1. DESKTOP NATIVE COLLAPSIBLE SIDEBAR (lg+) */}
      <aside
        className={`hidden lg:flex flex-col bg-white dark:bg-zinc-900 border-r border-zinc-200/80 dark:border-zinc-800/80 shrink-0 sticky top-0 h-screen select-none z-30 transition-all duration-300 ease-in-out ${
          sidebarOpen
            ? "w-64 xl:w-72 opacity-100"
            : "w-0 opacity-0 overflow-hidden border-r-0 pointer-events-none"
        }`}
      >
        <div className="w-64 xl:w-72 flex flex-col h-full">
          {/* Sidebar Workspace Brand / Header */}
          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
            <Link to="/home" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 grid place-items-center font-black text-base shadow-sm group-hover:scale-105 transition-transform">
                S
              </div>
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

      {/* 2. MOBILE / TABLET SLIDE-OVER DRAWER (< lg) */}
      {mobileDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileDrawerOpen(false)}
          />

          {/* Slide-in Menu Panel */}
          <div className="relative w-4/5 max-w-xs bg-white dark:bg-zinc-900 h-full flex flex-col shadow-2xl border-r border-zinc-200/80 dark:border-zinc-800/80 animate-slide-up z-10">
            {/* Drawer Header */}
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <Link
                to="/home"
                onClick={() => setMobileDrawerOpen(false)}
                className="flex items-center gap-2.5"
              >
                <div className="w-9 h-9 rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 grid place-items-center font-black text-sm">
                  S
                </div>
                <div>
                  <div className="font-extrabold text-sm text-zinc-900 dark:text-white">Stockly OS</div>
                  <div className="text-[10px] text-zinc-400 font-medium">Inventory Workspace</div>
                </div>
              </Link>

              <div className="flex items-center gap-1">
                <button
                  onClick={toggle}
                  className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 grid place-items-center"
                >
                  {isDark ? <Sun size={15} /> : <Moon size={15} />}
                </button>
                <button
                  onClick={() => setMobileDrawerOpen(false)}
                  className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 grid place-items-center"
                  aria-label="Close menu"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Drawer Links */}
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
              {navGroups.map((g) => (
                <div key={g.group} className="space-y-1">
                  <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    {g.group}
                  </div>
                  <div className="space-y-0.5">
                    {g.items.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.to);
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={() => setMobileDrawerOpen(false)}
                          className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                            active
                              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm"
                              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/80"
                          }`}
                        >
                          <Icon size={16} strokeWidth={active ? 2.4 : 1.8} />
                          <span className="flex-1 truncate">{item.label}</span>
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
            </div>

            {/* Drawer User Card */}
            <div className="p-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50">
              <div className="p-2.5 rounded-2xl bg-white dark:bg-zinc-800/70 border border-zinc-200/70 dark:border-zinc-700/60 flex items-center justify-between gap-2">
                <Link
                  to="/settings"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="flex items-center gap-2.5 min-w-0 flex-1"
                >
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
                  className="w-8 h-8 rounded-xl grid place-items-center text-zinc-400 hover:text-red-600 hover:bg-red-50"
                  title="Sign Out"
                >
                  <LogOut size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. MAIN APPLICATION CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Native App Bar */}
        <header
          className="sticky top-0 z-20 bg-white/85 dark:bg-zinc-950/85 backdrop-blur-xl border-b border-zinc-200/80 dark:border-zinc-800/80"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="h-14 px-3 sm:px-6 flex items-center justify-between gap-2.5 sm:gap-3">
            {/* Left: Mobile menu button & Brand */}
            <div className="flex items-center gap-2 lg:hidden">
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(true)}
                className="w-9 h-9 grid place-items-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 transition"
                aria-label="Open sidebar menu"
              >
                <Menu size={18} />
              </button>

              <Link to="/home" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 grid place-items-center font-black text-xs shadow-xs">
                  S
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-sm tracking-tight text-zinc-900 dark:text-white">Stockly</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
              </Link>
            </div>

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
                    className="w-full pl-9 pr-8 py-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-medium placeholder:text-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:border-zinc-900 dark:focus:border-white focus:outline-none transition"
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
                  {lowStockItems.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-500 text-white font-bold text-[9px] grid place-items-center shadow-xs">
                      {lowStockItems.length}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden z-40 py-2 animate-slide-up">
                    <div className="px-4 py-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                      <div className="font-bold text-xs uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                        <AlertTriangle size={13} className="text-amber-500" />
                        Reorder Alerts ({lowStockItems.length})
                      </div>
                      <Link
                        to="/reports"
                        onClick={() => setNotificationsOpen(false)}
                        className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                      >
                        Reports →
                      </Link>
                    </div>

                    <div className="max-h-72 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
                      {lowStockItems.length > 0 ? (
                        lowStockItems.map((item) => (
                          <Link
                            key={item._id}
                            to={`/products/${item._id}`}
                            onClick={() => setNotificationsOpen(false)}
                            className="p-3 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition group"
                          >
                            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 grid place-items-center shrink-0 overflow-hidden">
                              {item.image ? (
                                <img src={item.image} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-sm">📦</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold text-zinc-900 dark:text-white truncate group-hover:underline flex items-center gap-1">
                                {item.name}
                                <ArrowUpRight size={11} className="text-zinc-400" />
                              </div>
                              <div className="text-[11px] text-zinc-500 font-medium">
                                {item.quantity} {item.unit} on hand (min {item.minimumStock ?? 5})
                              </div>
                            </div>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                item.quantity === 0
                                  ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                              }`}
                            >
                              {item.quantity === 0 ? "Out" : "Low"}
                            </span>
                          </Link>
                        ))
                      ) : (
                        <div className="py-8 text-center text-xs text-zinc-500">
                          ✨ All inventory items are well-stocked!
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile Quick Avatar */}
              <Link
                to="/settings"
                className="lg:hidden w-9 h-9 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 grid place-items-center font-bold text-xs shadow-2xs active:scale-95 transition"
              >
                {(user?.name?.[0] || "U").toUpperCase()}
              </Link>
            </div>
          </div>

          {/* Mobile drop search input */}
          {showSearch && searchOpen && (
            <div className="sm:hidden px-3 pb-3">
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
        <main className="flex-1 max-w-6xl w-full mx-auto p-3.5 sm:p-6 lg:p-8 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-10">
          {children}
        </main>

        {/* 5. DOCKED MOBILE BOTTOM APP BAR */}
        <BottomNav />
      </div>
    </div>
  );
}
