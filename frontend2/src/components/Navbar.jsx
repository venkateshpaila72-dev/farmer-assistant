import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import {
    Sprout, LayoutDashboard, CloudSun, ShoppingCart, Scan,
    FlaskConical, MessageCircle, Newspaper, User, LogOut, Menu, X, Shield
} from "lucide-react";

const farmerLinks = [
    { to: "/dashboard", icon: LayoutDashboard, labelKey: "nav.dashboard" },
    { to: "/weather", icon: CloudSun, labelKey: "nav.weather" },
    { to: "/market", icon: ShoppingCart, labelKey: "nav.market" },
    { to: "/crop-tools", icon: FlaskConical, labelKey: "nav.cropTools" },
    { to: "/vision", icon: Scan, labelKey: "nav.vision" },
    { to: "/news", icon: Newspaper, labelKey: "nav.news" },
    { to: "/chat", icon: MessageCircle, labelKey: "nav.chat" },
    { to: "/profile", icon: User, labelKey: "nav.profile" },
];

const adminLinks = [
    { to: "/admin", icon: Shield, labelKey: "nav.adminPanel" },
];

export default function Navbar() {
    const { t } = useTranslation();
    const { user, logout, isAdmin } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [mobileOpen, setMobileOpen] = useState(false);

    if (!user) return null;

    const links = isAdmin ? adminLinks : farmerLinks;

    const handleLogout = () => {
        logout();
        navigate("/");
        setMobileOpen(false);
    };

    return (
        <>
            <nav className="navbar flex-between">
                <Link to={isAdmin ? "/admin" : "/dashboard"} className="nav-brand">
                    <Sprout size={28} />
                    <span>{t("app.name", "Farmer Assistant")}</span>
                </Link>

                {/* Desktop Nav Links */}
                <div className="nav-links">
                    {links.map((link) => {
                        const Icon = link.icon;
                        const isActive = location.pathname === link.to;
                        return (
                            <Link
                                key={link.to}
                                to={link.to}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    padding: "6px 14px",
                                    borderRadius: "var(--radius-full)",
                                    fontWeight: 500,
                                    fontSize: "0.9rem",
                                    backgroundColor: isActive ? "var(--color-primary)" : "transparent",
                                    color: isActive ? "white" : "var(--color-text-muted)",
                                    transition: "all var(--transition-fast)",
                                }}
                            >
                                <Icon size={16} />
                                {t(link.labelKey, link.labelKey.split(".").pop())}
                            </Link>
                        );
                    })}
                    <button
                        className="btn-icon"
                        onClick={handleLogout}
                        title={t("nav.logout", "Logout")}
                        style={{
                            background: "none",
                            color: "var(--color-danger)",
                            border: "1px solid var(--color-danger)",
                            cursor: "pointer",
                        }}
                    >
                        <LogOut size={18} />
                    </button>
                </div>

                {/* Mobile Hamburger */}
                <button
                    className="btn-icon"
                    onClick={() => setMobileOpen(!mobileOpen)}
                    style={{
                        display: "none",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--color-primary)",
                    }}
                    id="mobile-menu-toggle"
                >
                    {mobileOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
                <style>{`
          @media (max-width: 768px) {
            #mobile-menu-toggle { display: flex !important; }
          }
        `}</style>
            </nav>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {mobileOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.25 }}
                        style={{
                            position: "fixed",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: "rgba(0,0,0,0.5)",
                            zIndex: 999,
                        }}
                        onClick={() => setMobileOpen(false)}
                    >
                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                position: "absolute",
                                right: 0,
                                top: 0,
                                bottom: 0,
                                width: "280px",
                                background: "white",
                                padding: "var(--spacing-lg)",
                                display: "flex",
                                flexDirection: "column",
                                gap: "var(--spacing-sm)",
                                boxShadow: "-4px 0 15px rgba(0,0,0,0.1)",
                            }}
                        >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--spacing-md)" }}>
                                <span style={{ fontWeight: 700, color: "var(--color-primary)", fontSize: "1.1rem" }}>
                                    <Sprout size={20} style={{ verticalAlign: "middle", marginRight: "6px" }} />
                                    Menu
                                </span>
                                <button onClick={() => setMobileOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                                    <X size={22} />
                                </button>
                            </div>
                            {links.map((link) => {
                                const Icon = link.icon;
                                const isActive = location.pathname === link.to;
                                return (
                                    <Link
                                        key={link.to}
                                        to={link.to}
                                        onClick={() => setMobileOpen(false)}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "10px",
                                            padding: "12px 16px",
                                            borderRadius: "var(--radius-sm)",
                                            fontWeight: 500,
                                            backgroundColor: isActive ? "rgba(30,94,58,0.1)" : "transparent",
                                            color: isActive ? "var(--color-primary)" : "var(--color-text-main)",
                                        }}
                                    >
                                        <Icon size={20} />
                                        {t(link.labelKey, link.labelKey.split(".").pop())}
                                    </Link>
                                );
                            })}
                            <hr style={{ borderColor: "var(--color-border)", margin: "var(--spacing-sm) 0" }} />
                            <button
                                onClick={handleLogout}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "10px",
                                    padding: "12px 16px",
                                    borderRadius: "var(--radius-sm)",
                                    background: "none",
                                    border: "none",
                                    color: "var(--color-danger)",
                                    fontWeight: 500,
                                    cursor: "pointer",
                                    fontSize: "1rem",
                                }}
                            >
                                <LogOut size={20} />
                                {t("nav.logout", "Logout")}
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
