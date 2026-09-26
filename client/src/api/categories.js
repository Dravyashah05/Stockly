import api from "./client";
export const getCategories = (search="") => api.get(`/categories${search?`?search=${encodeURIComponent(search)}`:""}`);
export const getCategoryStats = () => api.get("/categories/stats");
export const createCategory = (data) => api.post("/categories", data);
export const updateCategory = (id,data) => api.patch(`/categories/${id}`, data);
export const deleteCategory = (id, force=false) => api.delete(`/categories/${id}${force?"?force=true":""}`);
