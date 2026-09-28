import React, { Suspense, lazy, useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { ThemeProvider } from "./context/ThemeContext";
import { SearchProvider } from "./context/SearchContext";
import { FullPageLoader } from "./components/ui/Loader";

const Home = lazy(()=> import("./pages/Home"));
const Dashboard = lazy(()=> import("./pages/Dashboard"));
const Products = lazy(()=> import("./pages/Products"));
const Suppliers = lazy(()=> import("./pages/Suppliers"));
const ProductDetails = lazy(()=> import("./pages/ProductDetails"));
const Categories = lazy(()=> import("./pages/Categories"));
const Stock = lazy(()=> import("./pages/Stock"));
const StockHistory = lazy(()=> import("./pages/StockHistory"));
const Settings = lazy(()=> import("./pages/Settings"));
const Reports = lazy(()=> import("./pages/Reports"));
const Audit = lazy(()=> import("./pages/Audit"));
const AppStore = lazy(()=> import("./pages/AppStore"));
const Login = lazy(()=> import("./pages/Login"));
const NotFound = lazy(()=> import("./pages/NotFound"));

function useNativeMobileIntegration() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathnameRef = React.useRef(location.pathname);
  pathnameRef.current = location.pathname;
  const navigateRef = React.useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    window.__stocklyNavigate = (targetPath) => {
      if (targetPath) {
        navigateRef.current(targetPath);
      }
    };
    return () => {
      delete window.__stocklyNavigate;
    };
  }, []);

  // Register native listeners ONCE — re-registering on every route change
  // stacked duplicate backButton/appUrlOpen handlers (multiple exitApp /
  // navigate calls per press). Route-aware logic reads pathnameRef.
  useEffect(() => {
    let cancelled = false;
    const handles = [];
    async function initNative() {
      if (typeof window === "undefined" || !window.Capacitor?.isNativePlatform?.()) return;

      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        if (cancelled) return;
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: "#09090b" });
      } catch {}

      try {
        const { SplashScreen } = await import("@capacitor/splash-screen");
        if (!cancelled) await SplashScreen.hide();
      } catch {}

      try {
        const { App: CapApp } = await import("@capacitor/app");
        if (cancelled) return;
        const backHandle = await CapApp.addListener("backButton", ({ canGoBack }) => {
          const path = pathnameRef.current;
          if (path === "/home" || path === "/login") {
            CapApp.exitApp();
          } else if (canGoBack || window.history.length > 1) {
            navigateRef.current(-1);
          } else {
            CapApp.exitApp();
          }
        });
        handles.push(backHandle);

        // Handle Android Home Screen Widget and Shortcut deep-links
        const urlHandle = await CapApp.addListener("appUrlOpen", (event) => {
          try {
            if (!event?.url) return;
            const rawUrl = event.url;
            const nav = navigateRef.current;
            if (rawUrl.includes("scan")) {
              nav("/stock?action=scan");
            } else if (rawUrl.includes("add-product")) {
              nav("/products?action=add");
            } else if (rawUrl.includes("filter=low") || rawUrl.includes("low-stock")) {
              nav("/products?filter=low");
            } else if (rawUrl.includes("stock/history")) {
              nav("/stock/history");
            } else if (rawUrl.includes("stock?type=IN")) {
              nav("/stock?type=IN");
            } else if (rawUrl.includes("stock?type=OUT")) {
              nav("/stock?type=OUT");
            } else if (rawUrl.includes("products")) {
              nav("/products");
            } else if (rawUrl.includes("home")) {
              nav("/home");
            } else {
              const parsed = new URL(rawUrl);
              const path = (parsed.pathname || "") + (parsed.search || "");
              if (path && path !== "/") nav(path);
            }
          } catch (e) {
            console.warn("Deep link handling error:", e);
          }
        });
        handles.push(urlHandle);
      } catch {}
    }

    initNative();
    return () => {
      cancelled = true;
      for (const h of handles) {
        try { h.remove(); } catch {}
      }
    };
  }, []);
}

function Protected({ children }){
  const { isAuthenticated } = useAuth();
  const loc = useLocation();
  if(!isAuthenticated) return <Navigate to="/login" state={{ from: loc }} replace />;
  return children;
}

function AppRoutes(){
  useNativeMobileIntegration();
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const isLogin = location.pathname==="/login";
  if(isLogin){
    return (
      <Suspense fallback={<FullPageLoader/>}>
        <Routes>
          <Route path="/login" element={isAuthenticated ? <Navigate to="/home" replace/> : <Login/>} />
          <Route path="*" element={<Navigate to="/login" replace/>} />
        </Routes>
      </Suspense>
    )
  }
  return (
    <Protected>
      <SearchProvider>
        <AppLayout>
          <Suspense fallback={<FullPageLoader/>}>
          <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/stock" element={<Stock />} />
            <Route path="/products" element={<Products />} />
            <Route path="/products/:id" element={<ProductDetails />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/stock/history" element={<StockHistory />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/audit" element={<Audit />} />
            <Route path="/app-store" element={<AppStore />} />
            <Route path="/download" element={<Navigate to="/app-store" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </AppLayout>
      </SearchProvider>
    </Protected>
  )
}

export default function App(){
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes/>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
