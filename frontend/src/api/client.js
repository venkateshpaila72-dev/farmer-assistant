import axios from "axios";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000",
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;

    // 401 — session expired or token invalid.
    // Dispatch a custom event so AuthContext can perform a clean React Router
    // redirect. Avoid a hard window.location.href reload (that would blow away
    // React state and can cause redirect loops from the login page itself).
    // Guard: if already on a public auth page, do nothing to prevent loops.
    if (status === 401) {
      const publicPaths = ["/login", "/register", "/admin/login"];
      const isPublic = publicPaths.some(
        (p) => window.location.pathname === p || window.location.pathname.startsWith(p)
      );
      if (!isPublic) {
        // Remember where the user was trying to go so login can redirect back.
        sessionStorage.setItem("redirectAfterLogin", window.location.pathname);
        window.dispatchEvent(new CustomEvent("auth:logout"));
      }
    }

    // All other status codes (400, 403, 404, 422, 500, 502, 503, network…)
    // are returned to the calling service/component so each feature can
    // decide its own error state. NEVER globally redirect to /server-error
    // — a weather/market/news API failure must not hijack the whole app.

    return Promise.reject(err);
  }
);

export default client;