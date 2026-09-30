import axios from "axios";

const isNativePlatform = typeof window !== "undefined" && (
  Boolean(window.Capacitor?.isNativePlatform?.()) ||
  window.location.protocol === "capacitor:" ||
  window.location.protocol === "ionic:"
);

const DEFAULT_REMOTE_API = "https://stocklybydns.vercel.app/api";
const API_URL = import.meta.env.VITE_API_URL || (isNativePlatform ? DEFAULT_REMOTE_API : "/api");

const client = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  // Hung requests previously hung the UI forever — fail fast instead.
  timeout: 15000,
});

client.interceptors.request.use((config)=>{
  const token = localStorage.getItem("token");
  if(token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res)=>res,
  async (err)=>{
    const status = err.response?.status;
    const msg = err.response?.data?.message || err.message || "Request failed";
    // 429: retry once after Retry-After
    if(status===429 && !err.config._retry){
      err.config._retry=true;
      const retryAfter = parseInt(err.response.headers["retry-after"]||"2",10)*1000;
      await new Promise(r=> setTimeout(r, Math.min(retryAfter, 3000)));
      return client(err.config);
    }
    // Transient network/server failures: one retry with backoff so a single
    // blip doesn't surface as a hard error. Aborts are never retried and
    // are re-thrown untouched so callers can detect cancellation via
    // err.code === "ERR_CANCELED" instead of showing a "canceled" toast.
    const isAbort = err.code === "ECONNABORTED" || err.code === "ERR_CANCELED" || err.name === "CanceledError";
    if (isAbort) return Promise.reject(err);
    const shouldRetry = !isAbort && !err.config._netRetry && (!err.response || err.response.status >= 500);
    if(shouldRetry){
      err.config._netRetry = true;
      await new Promise(r=> setTimeout(r, 800));
      return client(err.config);
    }
    if(status === 401 && localStorage.getItem("token")){
      const isAuthRoute = err.config?.url?.includes("/auth/");
      if(!isAuthRoute){
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        if(window.location.pathname !== "/login"){
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(new Error(msg));
  }
);

async function request(endpoint, options={}){
  const method = (options.method||"GET").toLowerCase();
  let body;
  if (options.body !== undefined) {
    try {
      body = typeof options.body === "string" ? JSON.parse(options.body) : options.body;
    } catch {
      return Promise.reject(new Error("Invalid request body"));
    }
  }
  const res = await client({ url: endpoint, method, data: body, headers: options.headers, signal: options.signal });
  return res.data;
}

// Lightweight in-memory GET cache for slow-changing reference data
// (categories / suppliers / options). Keyed by URL, TTL-based, and only
// used for exact endpoint matches the caller opts into — never for
// paginated or search results.
const refCache = new Map();

function cachedGet(endpoint, ttlMs = 60000, config) {
  const key = `GET ${endpoint}`;
  const now = Date.now();
  const hit = refCache.get(key);
  if (hit && now - hit.at < ttlMs) return Promise.resolve(hit.data);
  return client.get(endpoint, config).then((r) => {
    refCache.set(key, { at: Date.now(), data: r.data });
    // Bound memory: evict oldest entries past a small cap.
    if (refCache.size > 50) {
      const oldest = refCache.keys().next().value;
      refCache.delete(oldest);
    }
    return r.data;
  });
}

function invalidateReferenceCache(prefix) {
  for (const key of refCache.keys()) {
    if (!prefix || key.includes(prefix)) refCache.delete(key);
  }
}

const api = {
  get: (endpoint, config) => client.get(endpoint, config).then(r=>r.data),
  post: (endpoint, body, config) => client.post(endpoint, body, config).then(r=>r.data),
  put: (endpoint, body, config) => client.put(endpoint, body, config).then(r=>r.data),
  patch: (endpoint, body, config) => client.patch(endpoint, body, config).then(r=>r.data),
  delete: (endpoint, config) => client.delete(endpoint, config).then(r=>r.data),
  request
};

export default api;
export { client, cachedGet, invalidateReferenceCache };
