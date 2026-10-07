import axios from "axios";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000",
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Tell the backend which language to translate dynamic content (news,
  // announcements) into. Static UI text is handled by i18next. Backend skips
  // translation for "en" and for paths it doesn't translate.
  if ((config.method || "get").toLowerCase() === "get") {
    const lang = localStorage.getItem("language") || "en";
    if (lang !== "en" && !config.params?.lang) {
      config.params = { ...(config.params || {}), lang };
    }
  }
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;

    if (status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    } else if (status >= 500) {
      // 401 and 422 are intentionally excluded — those are shown as
      // inline form/page messages by the calling code instead.
      window.location.href = "/server-error";
    }

    return Promise.reject(err);
  }
);

export default client;