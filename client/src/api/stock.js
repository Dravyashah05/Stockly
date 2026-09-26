import api from "./client";
export const stockIn = (data) => api.post("/stock/in", data);
export const stockOut = (data) => api.post("/stock/out", data);
export const getStockHistory = (params={}) => {
  if(typeof params==="string" && params.startsWith("/")) return api.get(`/stock/history${params}`);
  const q = new URLSearchParams(params).toString();
  // support legacy productId param
  if(params.productId && !q.includes("productId")) {}
  return api.get(`/stock/history${q?`?${q}`:""}`);
};
export const getStockHistoryByProduct = (productId) => api.get(`/stock/history/${productId}`);
export const getRecentTransactions = () => api.get("/stock/recent");
export const updateStockTransaction = (id, data) => api.put(`/stock/${id}`, data);
export const deleteStockTransaction = (id) => api.delete(`/stock/${id}`);
