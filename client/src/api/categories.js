import api, { cachedGet, invalidateReferenceCache } from "./client";
const LIST_TTL_MS = 60000;
export const getCategories = (search="", config) => {
  if (!search) return cachedGet("/categories", LIST_TTL_MS, config);
  return api.get(`/categories?search=${encodeURIComponent(search)}`, config);
};
export const getCategoryStats = () => api.get("/categories/stats");
export const createCategory = (data) => {
  invalidateReferenceCache("/categories");
  return api.post("/categories", data);
};
export const updateCategory = (id,data) => {
  invalidateReferenceCache("/categories");
  return api.patch(`/categories/${id}`, data);
};
export const deleteCategory = (id, force=false) => {
  invalidateReferenceCache("/categories");
  return api.delete(`/categories/${id}${force?"?force=true":""}`);
};
