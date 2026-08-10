import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Sprout, Eye, EyeOff, LogIn } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { loginFarmer } from "../api/auth";

export default function Login() {
    const { t } = useTranslation();
    const { login } = useAuth();
    const navigate = useNavigate();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!username || !password) { setError(t("auth.fillAll", "Please fill all fields")); return; }
        setLoading(true);
        setError("");
        try {
            const data = await loginFarmer(username, password);
            login(data);
            navigate("/dashboard");
        } catch (err) {
            setError(err.response?.data?.detail || t("auth.loginFailed", "Login failed. Please try again."));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: "100vh",
            background: "linear-gradient(135deg, #f4f6f3 0%, #e8ede9 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
        }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="card"
                style={{ width: "100%", maxWidth: "420px", padding: "2.5rem 2rem" }}
            >
                <div style={{ textAlign: "center", marginBottom: "2rem" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginBottom: "0.5rem" }}>
                        <Sprout size={30} color="var(--color-primary)" />
                        <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: "1.4rem", color: "var(--color-primary)" }}>
                            {t("app.name", "Farmer Assistant")}
                        </span>
                    </div>
                    <h2 style={{ fontSize: "var(--font-size-2xl)", marginTop: "0.5rem" }}>
                        {t("auth.farmerLogin", "Farmer Login")}
                    </h2>
                    <p className="text-subtitle">{t("auth.loginSubtitle", "Welcome back! Enter your details")}</p>
                </div>

                {error && <div className="alert-banner" style={{ marginBottom: "1rem" }}>{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">{t("auth.username", "Username")}</label>
                        <input
                            className="form-input"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder={t("auth.usernamePlaceholder", "Enter your username")}
                            autoComplete="username"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t("auth.password", "Password")}</label>
                        <div style={{ position: "relative" }}>
                            <input
                                className="form-input"
                                type={showPw ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPw(!showPw)}
                                style={{
                                    position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
                                    background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)",
                                }}
                            >
                                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading}
                        style={{ width: "100%", marginTop: "0.5rem", padding: "0.85rem" }}
                    >
                        {loading ? t("auth.loggingIn", "Logging in...") : (
                            <><LogIn size={18} /> {t("auth.login", "Login")}</>
                        )}
                    </button>
                </form>

                <p style={{ textAlign: "center", marginTop: "1.5rem", color: "var(--color-text-muted)" }}>
                    {t("auth.noAccount", "Don't have an account?")}{" "}
                    <Link to="/register" style={{ fontWeight: 600 }}>{t("auth.registerLink", "Register here")}</Link>
                </p>
                <p style={{ textAlign: "center", marginTop: "0.5rem" }}>
                    <Link to="/" style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>← {t("auth.backHome", "Back to Home")}</Link>
                </p>
            </motion.div>
        </div>
    );
}
