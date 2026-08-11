import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { getOnboardingProfile, saveOnboarding } from "../api/onboarding";
import { classifySoil } from "../api/vision";
import { LANGUAGE_OPTIONS } from "../i18n";
import {
    User, MapPin, Mountain, Trees, Droplets, Languages,
    Camera, Check, LogOut, RefreshCw, Sprout, Phone, Calendar
} from "lucide-react";

const CODE_TO_BACKEND_NAME = { en: "English", hi: "Hindi", te: "Telugu", ta: "Tamil", kn: "Kannada", mr: "Marathi", bn: "Bengali", pa: "Punjabi" };
const SOIL_TYPES = ["Alluvial", "Black", "Red", "Laterite", "Desert", "Mountain", "Clay", "Sandy", "Loamy"];
const IRRIGATION_TYPES = ["Drip", "Sprinkler", "Canal", "Rainfed", "Borewell", "Well", "River"];
const COMMON_CROPS = ["Rice", "Wheat", "Maize", "Cotton", "Sugarcane", "Soybean", "Groundnut", "Mustard", "Gram", "Tur", "Jowar", "Bajra", "Ragi", "Tomato", "Onion", "Potato", "Chilli"];

export default function Profile() {
    const { t, i18n } = useTranslation();
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [profile, setProfile] = useState(null);
    const [form, setForm] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [detecting, setDetecting] = useState(false);
    const [detected, setDetected] = useState(null);
    const [toast, setToast] = useState("");
    const soilInputRef = useRef(null);

    useEffect(() => {
        if (!user?.username) return;
        getOnboardingProfile(user.username)
            .then((data) => {
                setProfile(data);
                setForm({
                    soil_type: data.soil_type || "",
                    farm_acres: data.farm_acres ?? "",
                    preferred_crops: data.preferred_crops || [],
                    irrigation_type: data.irrigation_type || "",
                    chat_language: data.chat_language || "English",
                });
            })
            .catch(() => setError(t("profile.loadError", "Failed to load profile")))
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.username]);

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(""), 3000);
    };

    const toggleCrop = (crop) => {
        setForm((f) => ({
            ...f,
            preferred_crops: f.preferred_crops.includes(crop)
                ? f.preferred_crops.filter((c) => c !== crop)
                : [...f.preferred_crops, crop],
        }));
    };

    const handleSave = async () => {
        if (!form || !user) return;
        setSaving(true);
        setError("");
        try {
            await saveOnboarding({
                username: user.username,
                soil_type: form.soil_type,
                soil_image_url: profile?.soil_image_url || "",
                farm_acres: Number(form.farm_acres) || 0,
                preferred_crops: form.preferred_crops,
                irrigation_type: form.irrigation_type,
                main_problem: profile?.main_problem || "",
                chat_language: form.chat_language,
                home_location: profile?.home_location || { state: "", district: "", village: "", lat: null, lng: null },
            });
            showToast(t("profile.updated", "Profile updated"));
            const fresh = await getOnboardingProfile(user.username);
            setProfile(fresh);
        } catch (err) {
            setError(err.response?.data?.detail || t("profile.saveError", "Failed to save profile"));
        } finally {
            setSaving(false);
        }
    };

    const handleSoilPhoto = async (file) => {
        if (!file || !user) return;
        setDetecting(true);
        setDetected(null);
        try {
            const data = await classifySoil(user.username, file, true, false);
            setDetected(data);
            setForm((f) => ({
                ...f,
                soil_type: data.soil_type?.toLowerCase().replace(" ", "_") || f.soil_type,
            }));
            showToast(t("profile.detectedAs", "Detected as") + ` ${data.soil_type}`);
        } catch {
            setError(t("profile.soilDetectError", "Soil detection failed"));
        } finally {
            setDetecting(false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    if (loading) {
        return (
            <div className="container flex-center" style={{ minHeight: "50vh" }}>
                <p style={{ color: "var(--color-text-muted)" }}>Loading profile...</p>
            </div>
        );
    }

    const loc = profile?.home_location || {};

    return (
        <div className="container" style={{ padding: "var(--spacing-lg) var(--spacing-md)", maxWidth: "820px" }}>
            <div className="page-header" style={{ borderRadius: "var(--radius-md)", marginBottom: "var(--spacing-xl)" }}>
                <h1 style={{ color: "white", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                    <User size={30} /> {t("profile.title", "My Profile")}
                </h1>
                <p style={{ opacity: 0.8 }}>{t("profile.subtitle", "Manage your farm details")}</p>
            </div>

            {toast && (
                <div className="alert-banner" style={{ background: "rgba(92,184,92,0.1)", borderLeftColor: "var(--color-success)", color: "var(--color-success)" }}>
                    <Check size={18} /> {toast}
                </div>
            )}
            {error && <div className="alert-banner">{error}</div>}

            {/* Identity card */}
            <motion.div className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: "var(--spacing-lg)", overflow: "hidden" }}>
                <div style={{ background: "linear-gradient(135deg, #123d25, #2d8553)", padding: "1.5rem", display: "flex", alignItems: "center", gap: "var(--spacing-md)", flexWrap: "wrap" }}>
                    <div style={{
                        width: "64px", height: "64px", borderRadius: "50%", background: "rgba(255,255,255,0.15)",
                        display: "flex", alignItems: "center", justifyContent: "center", color: "white", flexShrink: 0,
                    }}>
                        <Sprout size={32} />
                    </div>
                    <div style={{ color: "white", flex: 1, minWidth: "200px" }}>
                        <h3 style={{ color: "white", fontSize: "1.25rem" }}>{user?.username}</h3>
                        <p style={{ opacity: 0.8, fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px" }}>
                            <MapPin size={14} /> {[loc.village, loc.district, loc.state].filter(Boolean).join(", ") || t("profile.notSet", "Not set")}
                        </p>
                    </div>
                    <button className="btn btn-secondary" onClick={handleLogout} style={{ background: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.35)", color: "white" }}>
                        <LogOut size={16} /> {t("profile.logout", "Logout")}
                    </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "var(--spacing-sm)", padding: "var(--spacing-md)" }}>
                    <div className="stat-pill">
                        <p style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>{t("profile.phone", "Phone")}</p>
                        <p style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: "5px" }}><Phone size={14} /> {user?.phone || profile?.phone || "—"}</p>
                    </div>
                    <div className="stat-pill">
                        <p style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>{t("profile.soilType", "Soil Type")}</p>
                        <p style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: "5px", textTransform: "capitalize" }}><Mountain size={14} /> {form?.soil_type?.replace("_", " ") || t("profile.notSet", "Not set")}</p>
                    </div>
                    <div className="stat-pill">
                        <p style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>{t("profile.farmSize", "Farm Size")}</p>
                        <p style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: "5px" }}><Trees size={14} /> {form?.farm_acres ?? "—"} {t("profile.acres", "acres")}</p>
                    </div>
                    {profile?.created_at && (
                        <div className="stat-pill">
                            <p style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>{t("profile.memberSince", "Member since")}</p>
                            <p style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: "5px" }}><Calendar size={14} /> {new Date(profile.created_at).toLocaleDateString()}</p>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Editable farm details */}
            <motion.div className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{ marginBottom: "var(--spacing-lg)", padding: "var(--spacing-lg)" }}>
                <h3 style={{ marginBottom: "var(--spacing-md)" }}>{t("profile.subtitle", "Manage your farm details")}</h3>

                {/* Soil type with photo detect */}
                <div className="form-group">
                    <label className="form-label">{t("profile.soilType", "Soil Type")}</label>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <select className="form-select" style={{ flex: 1, minWidth: "160px" }} value={form?.soil_type || ""} onChange={(e) => setForm((f) => ({ ...f, soil_type: e.target.value }))}>
                            <option value="">-- {t("profile.notSet", "Not set")} --</option>
                            {SOIL_TYPES.map((s) => <option key={s} value={s.toLowerCase()}>{s}</option>)}
                        </select>
                        <button className="btn btn-secondary" onClick={() => soilInputRef.current?.click()} disabled={detecting}>
                            {detecting ? <RefreshCw size={15} className="spin" /> : <Camera size={15} />} {t("profile.detectSoilUpload", "Detect from photo")}
                        </button>
                        <input
                            ref={soilInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/jpg,image/webp"
                            style={{ display: "none" }}
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleSoilPhoto(file);
                                e.target.value = "";
                            }}
                        />
                    </div>
                    {detected && (
                        <p style={{ fontSize: "0.85rem", color: "var(--color-success)", marginTop: "0.4rem", display: "flex", alignItems: "center", gap: "6px" }}>
                            <Check size={15} /> {t("profile.detectedAs", "Detected as")}: <strong>{detected.soil_type}</strong> ({Math.round((detected.confidence || 0) * 100)}%)
                        </p>
                    )}
                </div>

                <div className="form-group">
                    <label className="form-label">{t("profile.farmSize", "Farm Size")} ({t("profile.acres", "acres")})</label>
                    <input
                        className="form-input"
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={form?.farm_acres ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, farm_acres: parseFloat(e.target.value) || "" }))}
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">{t("profile.crops", "Crops")}</label>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        {COMMON_CROPS.map((crop) => {
                            const selected = form?.preferred_crops?.includes(crop);
                            return (
                                <button
                                    key={crop}
                                    type="button"
                                    onClick={() => toggleCrop(crop)}
                                    className={`option-pill ${selected ? "active" : ""}`}
                                    style={{
                                        padding: "0.4rem 0.9rem", borderRadius: "var(--radius-full)", fontSize: "0.85rem",
                                        border: selected ? "2px solid var(--color-primary)" : "2px solid var(--color-border)",
                                        background: selected ? "rgba(30,94,58,0.08)" : "white",
                                        cursor: "pointer", fontWeight: selected ? 600 : 400,
                                    }}
                                >
                                    {selected && <Check size={13} style={{ verticalAlign: "middle", marginRight: "4px" }} />}
                                    {crop}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--spacing-md)" }}>
                    <div className="form-group">
                        <label className="form-label">{t("profile.irrigation", "Irrigation")}</label>
                        <select className="form-select" value={form?.irrigation_type || ""} onChange={(e) => setForm((f) => ({ ...f, irrigation_type: e.target.value }))}>
                            <option value="">-- {t("profile.notSet", "Not set")} --</option>
                            {IRRIGATION_TYPES.map((irr) => <option key={irr} value={irr}>{irr}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t("profile.language", "Chat Language")}</label>
                        <select
                            className="form-select"
                            value={form?.chat_language || "English"}
                            onChange={(e) => {
                                const name = e.target.value;
                                setForm((f) => ({ ...f, chat_language: name }));
                                const code = Object.keys(CODE_TO_BACKEND_NAME).find((k) => CODE_TO_BACKEND_NAME[k] === name);
                                if (code) i18n.changeLanguage(code);
                            }}
                        >
                            {LANGUAGE_OPTIONS.map((l) => <option key={l.code} value={CODE_TO_BACKEND_NAME[l.code]}>{l.label}</option>)}
                        </select>
                    </div>
                </div>

                <div style={{ display: "flex", gap: "0.75rem", marginTop: "var(--spacing-md)" }}>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? <><RefreshCw size={16} className="spin" /> {t("profile.saving", "Saving...")}</> : <><Check size={16} /> {t("profile.save", "Save Changes")}</>}
                    </button>
                </div>
            </motion.div>

            <style>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
