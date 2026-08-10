import axios from "axios";

// In Vite, we configured a proxy for '/api', so we can call it relative to the origin.
const client = axios.create({
    baseURL: "/api",
});

client.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

client.interceptors.response.use(
    (res) => res,
    (err) => {
        // If unauthorized, log out and redirect to welcome/login page
        if (err.response?.status === 401) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            window.location.href = "/";
        }
        return Promise.reject(err);
    }
);

export default client;
