import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { LANGUAGE_OPTIONS } from "../i18n";
import {
    Sprout, Leaf, CloudSun, ShoppingCart, MessageCircle,
    Scan, Shield, ArrowRight, Volume2
} from "lucide-react";
import { speakText } from "../utils/speak";

const features = [
    { icon: CloudSun, titleKey: "home.feature.weather", descKey: "home.feature.weatherDesc", color: "#4a8c6f" },
    { icon: ShoppingCart, titleKey: "home.feature.market", descKey: "home.feature.marketDesc", color: "#8c6239" },
    { icon: Scan, titleKey: "home.feature.vision", descKey: "home.feature.visionDesc", color: "#5a7cb5" },
    { icon: MessageCircle, titleKey: "home.feature.chat", descKey: "home.feature.chatDesc", color: "#7b5ea7" },
];

export default function Home() {
    const { t, i18n } = useTranslation();

    const handleLangSelect = (code) => {
        i18n.changeLanguage(code);
    };

    return (
        <div style={{ minHeight: "100vh", background: "var(--color-bg-base)" }}>
            {/* Hero Section */}
            <div style={{
                background: "linear-gradient(135deg, #123d25 0%, #1e5e3a 40%, #2d8553 100%)",
                color: "white",
                padding: "3rem 1.5rem 4rem",
                textAlign: "center",
                position: "relative",
                overflow: "hidden",
            }}>
                {/* Decorative Background Elements */}
                <div style={{
                    position: "absolute", top: "-50px", right: "-50px",
                    width: "200px", height: "200px", borderRadius: "50%",
                    background: "rgba(255,255,255,0.03)",
                }} />
                <div style={{
                    position: "absolute", bottom: "-30px", left: "-30px",
                    width: "150px", height: "150px", borderRadius: "50%",
                    background: "rgba(255,255,255,0.03)",
                }} />

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", marginBottom: "1rem" }}>
                        <Sprout size={44} />
                        <h1 style={{
                            fontFamily: "'Outfit', sans-serif",
                            fontSize: "clamp(2rem, 5vw, 3rem)",
                            fontWeight: 800,
                            color: "white",
                        }}>
                            {t("app.name", "Farmer Assistant")}
                        </h1>
                    </div>
                    <p style={{ fontSize: "1.15rem", opacity: 0.85, maxWidth: "600px", margin: "0 auto 2rem" }}>
                        {t("home.subtitle", "Your smart farming companion — weather, market prices, crop advice, and AI chat in your language")}
                    </p>
                    <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
                        <Link to="/login" className="btn btn-accent" style={{ fontSize: "1.05rem", padding: "0.85rem 2rem" }}>
                            <Leaf size={20} />
                            {t("home.farmerLogin", "Farmer Login")}
                            <ArrowRight size={18} />
                        </Link>
                        <Link to="/admin/login" className="btn btn-secondary" style={{
                            fontSize: "1.05rem", padding: "0.85rem 2rem",
                            color: "white", borderColor: "rgba(255,255,255,0.4)",
                        }}>
                            <Shield size={18} />
                            {t("home.adminLogin", "Admin Access")}
                        </Link>
                    </div>
                </motion.div>
            </div>

            {/* Language Picker */}
            <div className="container" style={{ marginTop: "-1.5rem", position: "relative", zIndex: 10 }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="card"
                    style={{ padding: "1.5rem", textAlign: "center" }}
                >
                    <h3 style={{ marginBottom: "1rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                        <Volume2 size={22} color="var(--color-primary)" />
                        {t("home.chooseLanguage", "Choose Your Language")}
                    </h3>
                    <div className="lang-selector-grid" style={{ margin: "0 auto" }}>
                        {LANGUAGE_OPTIONS.map((lang) => (
                            <button
                                key={lang.code}
                                className={`lang-btn ${i18n.language === lang.code ? "active" : ""}`}
                                onClick={() => handleLangSelect(lang.code)}
                            >
                                <span style={{ fontSize: "1.1rem" }}>{lang.label}</span>
                            </button>
                        ))}
                    </div>
                </motion.div>
            </div>

            {/* Features Section */}
            <div className="container section">
                <h2 style={{ textAlign: "center", marginBottom: "var(--spacing-xl)" }}>
                    {t("home.features", "What You Can Do")}
                </h2>
                <div className="grid grid-cols-2" style={{ maxWidth: "900px", margin: "0 auto" }}>
                    {features.map((feat, i) => {
                        const Icon = feat.icon;
                        return (
                            <motion.div
                                key={i}
                                className="card read-me"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 * i + 0.5 }}
                                style={{ cursor: "default" }}
                            >
                                <div className="card-title">
                                    <div style={{
                                        width: "42px", height: "42px",
                                        borderRadius: "var(--radius-sm)",
                                        background: `${feat.color}15`,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                    }}>
                                        <Icon size={22} color={feat.color} />
                                    </div>
                                    {t(feat.titleKey, feat.titleKey)}
                                </div>
                                <p style={{ color: "var(--color-text-muted)", marginTop: "var(--spacing-sm)" }}>
                                    {t(feat.descKey, feat.descKey)}
                                </p>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* Register CTA */}
            <div style={{
                background: "var(--color-primary-dark)",
                color: "white",
                padding: "3rem 1.5rem",
                textAlign: "center",
            }}>
                <h2 style={{ color: "white", marginBottom: "0.75rem" }}>
                    {t("home.newFarmer", "New here? Create your farm profile")}
                </h2>
                <p style={{ opacity: 0.8, marginBottom: "1.5rem" }}>
                    {t("home.registerDesc", "Set up your profile in minutes and get personalized advice")}
                </p>
                <Link to="/register" className="btn btn-accent" style={{ fontSize: "1.05rem", padding: "0.85rem 2.5rem" }}>
                    {t("home.registerButton", "Register Now")}
                    <ArrowRight size={18} />
                </Link>
            </div>

            {/* Footer */}
            <footer style={{
                background: "#0a1f13",
                color: "rgba(255,255,255,0.5)",
                padding: "1.5rem",
                textAlign: "center",
                fontSize: "0.85rem",
            }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginBottom: "0.5rem" }}>
                    <Sprout size={16} />
                    <span style={{ fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>Farmer Assistant</span>
                </div>
                <p>Built with ❤ for Indian Farmers</p>
            </footer>
        </div>
    );
}
