import api, { cachedGet, invalidateReferenceCache } from "./client";
const LIST_TTL_MS = 60000;
export const getSuppliers = (search="", config) => {
  if (!search) return cachedGet("/suppliers", LIST_TTL_MS, config);
  return api.get(`/suppliers?search=${encodeURIComponent(search)}`, config);
};
export const createSupplier = (data) => {
  invalidateReferenceCache("/suppliers");
  return api.post("/suppliers", data);
};
export const updateSupplier = (id, data) => {
  invalidateReferenceCache("/suppliers");
  return api.put(`/suppliers/${id}`, data);
};
export const deleteSupplier = (id) => {
  invalidateReferenceCache("/suppliers");
  return api.delete(`/suppliers/${id}`);
};
