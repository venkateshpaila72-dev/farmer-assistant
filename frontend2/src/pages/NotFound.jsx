import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { Compass, Home, LayoutDashboard } from "lucide-react";

export default function NotFound() {
    const { t } = useTranslation();
    const { isAuthenticated } = useAuth();

    return (
        <div style={{
            minHeight: "100vh",
            background: "var(--color-bg-base)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
        }}>
            <div className="card" style={{ textAlign: "center", padding: "3rem 2rem", maxWidth: "480px", width: "100%" }}>
                <div style={{
                    width: "80px", height: "80px", borderRadius: "50%",
                    background: "rgba(30,94,58,0.1)", color: "var(--color-primary)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto var(--spacing-lg)",
                }}>
                    <Compass size={40} />
                </div>
                <h1 style={{ fontSize: "3rem", fontWeight: 800, color: "var(--color-primary)", lineHeight: 1 }}>
                    404
                </h1>
                <h2 style={{ margin: "0.5rem 0" }}>{t("notFound.title", "Page Not Found")}</h2>
                <p style={{ color: "var(--color-text-muted)", marginBottom: "var(--spacing-xl)" }}>
                    {t("notFound.message", "The page you are looking for does not exist or has been moved.")}
                </p>
                <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
                    <Link to="/" className="btn btn-primary">
                        <Home size={16} /> {t("notFound.backHome", "Go to Home")}
                    </Link>
                    {isAuthenticated && (
                        <Link to="/dashboard" className="btn btn-secondary">
                            <LayoutDashboard size={16} /> {t("notFound.backDashboard", "Go to Dashboard")}
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}
