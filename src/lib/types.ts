/* Stockly shared domain types — mirrors Google Sheets columns. */

export interface Product {
  id: string;
  name: string;
  sku: string;
  description: string;
  image: string;
  costPrice: number;
  sellingPrice: number;
  currentStock: number;
  minimumStock: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export type StockType = 'IN' | 'OUT';
export type StockOutReason = 'Sale' | 'Damaged' | 'Lost' | 'Return' | 'Other';

export interface StockTransaction {
  id: string;
  productId: string;
  productName: string;
  type: StockType;
  quantity: number;
  price: number;
  reason: string;
  note: string;
  idempotencyKey: string;
  createdAt: string;
}

export interface DashboardStats {
  totalProducts: number;
  totalUnits: number;
  lowStockCount: number;
  outOfStockCount: number;
  inventoryCostValue: number;
  inventoryRetailValue: number;
  recentMovements: StockTransaction[];
  lowStockItems: Product[];
}

/** Everything the app needs in one round trip (see `sync` Apps Script action). */
export interface SyncData {
  products: Product[];
  transactions: StockTransaction[];
  dashboard: DashboardStats;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ToastMsg {
  id: number;
  kind: 'success' | 'error' | 'info';
  text: string;
}
