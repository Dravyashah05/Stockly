import React, { Suspense, lazy } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
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
const Login = lazy(()=> import("./pages/Login"));
const NotFound = lazy(()=> import("./pages/NotFound"));

function Protected({ children }){
  const { isAuthenticated } = useAuth();
  const loc = useLocation();
  if(!isAuthenticated) return <Navigate to="/login" state={{ from: loc }} replace />;
  return children;
}

function AppRoutes(){
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
