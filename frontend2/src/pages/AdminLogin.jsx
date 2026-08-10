import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Shield, LogIn, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { loginAdmin } from "../api/auth";

export default function AdminLogin() {
    const { t } = useTranslation();
    const { login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email || !password) { setError("Please fill all fields"); return; }
        setLoading(true);
        setError("");
        try {
            const data = await loginAdmin(email, password);
            login(data);
            navigate("/admin");
        } catch (err) {
            setError(err.response?.data?.detail || "Login failed. Check your credentials.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: "100vh",
            background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
        }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="card"
                style={{ maxWidth: "420px", width: "100%", padding: "2.5rem 2rem" }}
            >
                <div style={{ textAlign: "center", marginBottom: "2rem" }}>
                    <Shield size={36} color="var(--color-primary)" style={{ marginBottom: "0.5rem" }} />
                    <h2 style={{ fontSize: "var(--font-size-2xl)" }}>Admin Access</h2>
                    <p className="text-subtitle">Administrative Control Panel</p>
                </div>

                {error && <div className="alert-banner">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@gmail.com" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <div style={{ position: "relative" }}>
                            <input className="form-input" type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                            <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)" }}>
                                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: "100%", marginTop: "0.5rem", padding: "0.85rem" }}>
                        {loading ? "Authenticating..." : <><LogIn size={18} /> Login</>}
                    </button>
                </form>
                <p style={{ textAlign: "center", marginTop: "1.5rem" }}>
                    <Link to="/" style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>← Back to Home</Link>
                </p>
            </motion.div>
        </div>
    );
}
