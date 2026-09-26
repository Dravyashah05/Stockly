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
  const res = await client({ url: endpoint, method, data: options.body ? JSON.parse(options.body) : undefined, headers: options.headers });
  return res.data;
}

const api = {
  get: (endpoint) => client.get(endpoint).then(r=>r.data),
  post: (endpoint, body) => client.post(endpoint, body).then(r=>r.data),
  put: (endpoint, body) => client.put(endpoint, body).then(r=>r.data),
  patch: (endpoint, body) => client.patch(endpoint, body).then(r=>r.data),
  delete: (endpoint) => client.delete(endpoint).then(r=>r.data),
  request
};

export default api;
export { client };
