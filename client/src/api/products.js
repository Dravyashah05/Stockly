import api, { client } from "./client";
export const getProducts = (params="", config) => {
  if(typeof params==="string") return api.get(`/products${params}`, config);
  const q = new URLSearchParams(params).toString();
  return api.get(`/products${q?`?${q}`:""}`, config);
};
export const getProduct = (id) => api.get(`/products/${id}`);
export const createProduct = (data) => api.post("/products", data);
export const updateProduct = (id, data) => api.patch(`/products/${id}`, data);
export const deleteProduct = (id) => api.delete(`/products/${id}`);
export const bulkDeleteProducts = (ids) => api.post("/products/bulk-delete", { ids });
export const bulkUpdateProducts = (ids, updates) => api.post("/products/bulk-update", { ids, updates });
export const uploadProductImage = async (file) => {
  const formData = new FormData();
  formData.append("image", file);
  const token = localStorage.getItem("token");
  const res = await client.post("/products/upload-image", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    // Image uploads need headroom over the 15s default API timeout.
    timeout: 60000,
  });
  return res.data;
};
