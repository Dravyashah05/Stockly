import api from "./client";

export const login = (data) => api.post("/auth/login", data);
export const register = (data) => api.post("/auth/register", data);
export const me = () => api.get("/auth/me");
export const updateMe = (data) => api.put("/auth/me", data);
export const changePassword = (data) => api.post("/auth/change-password", data);
export const getSessions = () => api.get("/auth/sessions");
export const revokeSession = (id) => api.delete(`/auth/sessions/${id}`);
export const revokeAllSessions = (all = false) => api.delete(`/auth/sessions${all ? "?all=true" : ""}`);
export const logoutSession = () => api.post("/auth/logout");

// Device Pairing — Workflow 1: Pairing Code
export const createPairingCode = (data = {}) => api.post("/auth/pairing/code", data);
export const getPairingStatus = () => api.get("/auth/pairing/code/status");
export const cancelPairingCode = () => api.delete("/auth/pairing/code");
export const claimPairingCode = (data) => api.post("/auth/pairing/claim", data);

// Device Pairing — Workflow 2: Quick QR Login / Tickets
export const createLoginTicket = (data = {}) => api.post("/auth/pairing/ticket", data);
export const pollLoginTicket = (ticketId) => api.get(`/auth/pairing/ticket/${ticketId}`);
export const getTicketInfo = (identifier) => api.get(`/auth/pairing/ticket/info/${identifier}`);
export const authorizeLoginTicket = (data) => api.post("/auth/pairing/ticket/authorize", data);
export const rejectLoginTicket = (data) => api.post("/auth/pairing/ticket/reject", data);
