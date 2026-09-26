import api from "./client";
export const dailyReport = (date) => api.get(`/reports/daily${date ? `?date=${date}` : ""}`);
export const stockInReport = (params={}) => {
  const q = new URLSearchParams(params).toString();
  return api.get(`/reports/stock-in${q?`?${q}`:""}`); 
};
export const stockOutReport = (params={}) => {
  const q = new URLSearchParams(params).toString();
  return api.get(`/reports/stock-out${q?`?${q}`:""}`);
};
export const lowStockReport = () => api.get("/reports/low-stock");
export const categoryWiseReport = () => api.get("/reports/category-wise");
export const supplierWiseReport = (params={}) => {
  const q = new URLSearchParams(params).toString();
  return api.get(`/reports/supplier-wise${q?`?${q}`:""}`);
};
export const productMovementReport = (params={}) => {
  const q = new URLSearchParams(params).toString();
  return api.get(`/reports/product-movement${q?`?${q}`:""}`);
};
export const valuationReport = () => api.get("/reports/valuation");
export const monthlyReport = (year) => api.get(`/reports/monthly${year?`?year=${year}`:""}`);
