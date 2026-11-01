import axios from "axios";


const client = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL ||
    "http://localhost:8000",
  timeout: 60000,
});


client.interceptors.request.use(
  (config) => {

    const token =
      localStorage.getItem(
        "token"
      );

    if (token) {
      config.headers.Authorization =
        `Bearer ${token}`;
    }


    /*
     * Tell the backend which language
     * should be used for dynamic content.
     *
     * This now includes:
     *
     * - News
     * - Announcements
     * - Market data
     *
     * Static UI text is still handled
     * by i18next.
     */
    if (
      (
        config.method ||
        "get"
      ).toLowerCase() ===
      "get"
    ) {

      const lang =
        localStorage.getItem(
          "language"
        ) || "en";


      if (
        lang !== "en" &&
        !config.params?.lang
      ) {

        config.params = {
          ...(config.params || {}),
          lang,
        };

      }
    }


    return config;
  }
);


client.interceptors.response.use(
  (res) => res,

  (err) => {
    const status = err.response?.status;
    const token = localStorage.getItem("token");
    const url = err.config?.url || "";
    const isLoginUrl = url.includes("/auth/verifyuser") || url.includes("/auth/verifyadmin");

    if (status === 401 && token && !isLoginUrl) {
      let role;
      try {
        const storedUser = JSON.parse(localStorage.getItem("user"));
        role = storedUser?.role;
      } catch {
        role = undefined;
      }

      const skipPaths = ["/", "/login", "/register", "/admin/login", "/server-error"];
      if (!skipPaths.includes(window.location.pathname)) {
        sessionStorage.setItem("redirectAfterLogin", window.location.pathname + window.location.search);
      }

      window.dispatchEvent(new CustomEvent("auth:logout", { detail: { role } }));
    }

    return Promise.reject(err);
  }
);


export default client;