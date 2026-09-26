import api from "./client";
export const getAuditLogs = (params={}) => {
  const q = new URLSearchParams(params).toString();
  return api.get(`/audit${q?`?${q}`:""}`);
};
export const getEntityHistory = (entity, id) => api.get(`/audit/${entity}/${id}`);
