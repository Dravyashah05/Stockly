import api from "./client";
export const getSuppliers = (search="") => api.get(`/suppliers${search?`?search=${encodeURIComponent(search)}`:""}`);
export const createSupplier = (data) => api.post("/suppliers", data);
export const updateSupplier = (id, data) => api.put(`/suppliers/${id}`, data);
export const deleteSupplier = (id) => api.delete(`/suppliers/${id}`);
