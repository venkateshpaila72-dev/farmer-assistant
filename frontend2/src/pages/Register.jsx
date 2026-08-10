import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Sprout, Eye, EyeOff, UserPlus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { registerFarmer, loginFarmer, checkUsernameAvailable } from "../api/auth";

export default function Register() {
    const { t } = useTranslation();
    const { login } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ username: "", password: "", confirmPw: "", phone: "", door_no: "", village: "", city: "", state: "" });
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.username || !form.password) { setError(t("auth.fillAll", "Please fill all required fields")); return; }
        if (form.password !== form.confirmPw) { setError(t("auth.passwordMismatch", "Passwords do not match")); return; }
        if (form.password.length < 4) { setError(t("auth.passwordShort", "Password must be at least 4 characters")); return; }
        setLoading(true);
        setError("");
        try {
            const avail = await checkUsernameAvailable(form.username);
            if (!avail.available) { setError(t("auth.usernameTaken", "Username is already taken")); setLoading(false); return; }
            const { confirmPw, ...payload } = form;
            await registerFarmer(payload);
            const loginData = await loginFarmer(form.username, form.password);
            login(loginData);
            navigate("/onboarding");
        } catch (err) {
            setError(err.response?.data?.detail || t("auth.registerFailed", "Registration failed. Please try again."));
        } finally {
            setLoading(false);
        }
    };

    const fields = [
        { key: "username", label: t("auth.username", "Username"), required: true, type: "text" },
        { key: "password", label: t("auth.password", "Password"), required: true, type: "password" },
        { key: "confirmPw", label: t("auth.confirmPassword", "Confirm Password"), required: true, type: "password" },
        { key: "phone", label: t("auth.phone", "Phone Number"), type: "tel" },
        { key: "door_no", label: t("auth.doorNo", "Door Number"), type: "text" },
        { key: "village", label: t("auth.village", "Village"), type: "text" },
        { key: "city", label: t("auth.city", "City / District"), type: "text" },
        { key: "state", label: t("auth.state", "State"), type: "text" },
    ];

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
                style={{ width: "100%", maxWidth: "480px", padding: "2rem" }}
            >
                <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
                    <Sprout size={30} color="var(--color-primary)" style={{ marginBottom: "0.5rem" }} />
                    <h2 style={{ fontSize: "var(--font-size-2xl)" }}>{t("auth.registerTitle", "Create Farm Account")}</h2>
                    <p className="text-subtitle">{t("auth.registerSubtitle", "Join thousands of smart farmers")}</p>
                </div>

                {error && <div className="alert-banner">{error}</div>}

                <form onSubmit={handleSubmit}>
                    {fields.map((f) => (
                        <div className="form-group" key={f.key}>
                            <label className="form-label">
                                {f.label} {f.required && <span style={{ color: "var(--color-danger)" }}>*</span>}
                            </label>
                            <div style={{ position: "relative" }}>
                                <input
                                    className="form-input"
                                    type={f.type === "password" ? (showPw ? "text" : "password") : f.type}
                                    value={form[f.key]}
                                    onChange={(e) => update(f.key, e.target.value)}
                                    placeholder={f.label}
                                />
                                {f.type === "password" && f.key === "password" && (
                                    <button
                                        type="button"
                                        onClick={() => setShowPw(!showPw)}
                                        style={{
                                            position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
                                            background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)"
                                        }}
                                    >
                                        {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    <button
                        type="submit" className="btn btn-primary" disabled={loading}
                        style={{ width: "100%", marginTop: "0.5rem", padding: "0.85rem" }}
                    >
                        {loading ? t("auth.registering", "Creating account...") : (
                            <><UserPlus size={18} /> {t("auth.register", "Register")}</>
                        )}
                    </button>
                </form>

                <p style={{ textAlign: "center", marginTop: "1.5rem", color: "var(--color-text-muted)" }}>
                    {t("auth.hasAccount", "Already have an account?")}{" "}
                    <Link to="/login" style={{ fontWeight: 600 }}>{t("auth.loginLink", "Login here")}</Link>
                </p>
                <p style={{ textAlign: "center", marginTop: "0.5rem" }}>
                    <Link to="/" style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>← {t("auth.backHome", "Back to Home")}</Link>
                </p>
            </motion.div>
        </div>
    );
}
