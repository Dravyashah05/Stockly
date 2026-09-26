import api from "./http";

export function getStoredAiSettings() {
  try {
    const raw = localStorage.getItem("stockly_ai_settings");
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    apiKey: "",
    baseURL: "https://api.opencode.ai/v1",
    model: "deepseek/deepseek-chat",
  };
}

export function saveStoredAiSettings(settings) {
  try {
    localStorage.setItem("stockly_ai_settings", JSON.stringify(settings));
  } catch {}
}

function getAiHeaders() {
  const { apiKey, baseURL, model } = getStoredAiSettings();
  const headers = {};
  if (apiKey?.trim()) headers["x-opencode-api-key"] = apiKey.trim();
  if (baseURL?.trim()) headers["x-opencode-base-url"] = baseURL.trim();
  if (model?.trim()) headers["x-opencode-model"] = model.trim();
  return headers;
}

export async function getAiStatus() {
  const res = await api.get("/ai/status");
  return res.data;
}

export async function chatCopilot(message, history = []) {
  const headers = getAiHeaders();
  const res = await api.post(
    "/ai/chat",
    { message, history },
    { headers }
  );
  return res.data;
}

export async function generateProductDescription({ name, category, unit, currentDescription }) {
  const headers = getAiHeaders();
  const res = await api.post(
    "/ai/generate-description",
    { name, category, unit, currentDescription },
    { headers }
  );
  return res.data;
}

export async function getRestockForecast() {
  const headers = getAiHeaders();
  const res = await api.post("/ai/forecast", {}, { headers });
  return res.data;
}
