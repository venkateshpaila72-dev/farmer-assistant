import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { saveOnboarding } from "../api/onboarding";
import { LANGUAGE_OPTIONS } from "../i18n";
import {
    Sprout, ChevronLeft, ChevronRight, Check, Droplets,
    Mountain, TreePine, Wheat, Languages
} from "lucide-react";

const SOIL_TYPES = ["Alluvial", "Black", "Red", "Laterite", "Desert", "Mountain", "Clay", "Sandy", "Loamy"];
const IRRIGATION_TYPES = ["Drip", "Sprinkler", "Canal", "Rainfed", "Borewell", "Well", "River"];
const COMMON_CROPS = ["Rice", "Wheat", "Maize", "Cotton", "Sugarcane", "Soybean", "Groundnut", "Mustard", "Gram", "Tur", "Jowar", "Bajra", "Ragi", "Tomato", "Onion", "Potato", "Chilli"];

const steps = [
    { key: "language", icon: Languages, titleKey: "onboarding.language" },
    { key: "soil", icon: Mountain, titleKey: "onboarding.soil" },
    { key: "farm", icon: TreePine, titleKey: "onboarding.farm" },
    { key: "crops", icon: Wheat, titleKey: "onboarding.crops" },
    { key: "irrigation", icon: Droplets, titleKey: "onboarding.irrigation" },
];

const CODE_TO_BACKEND_NAME = { en: "English", hi: "Hindi", te: "Telugu", ta: "Tamil", kn: "Kannada", mr: "Marathi", bn: "Bengali", pa: "Punjabi" };

export default function Onboarding() {
    const { t, i18n } = useTranslation();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [step, setStep] = useState(0);
    const [profile, setProfile] = useState({
        chat_language: CODE_TO_BACKEND_NAME[i18n.language] || "English",
        soil_type: "",
        farm_size_acres: "",
        crops: [],
        irrigation_type: "",
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const canNext = () => {
        switch (step) {
            case 0: return !!profile.chat_language;
            case 1: return !!profile.soil_type;
            case 2: return profile.farm_size_acres > 0;
            case 3: return profile.crops.length > 0;
            case 4: return !!profile.irrigation_type;
            default: return false;
        }
    };

    const toggleCrop = (crop) => {
        setProfile((p) => ({
            ...p,
            crops: p.crops.includes(crop) ? p.crops.filter((c) => c !== crop) : [...p.crops, crop],
        }));
    };

    const handleFinish = async () => {
        setSaving(true);
        setError("");
        try {
            await saveOnboarding({ ...profile, username: user.username });
            navigate("/dashboard");
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to save profile, please try again.");
        } finally {
            setSaving(false);
        }
    };

    const handleLangSelect = (code) => {
        i18n.changeLanguage(code);
        setProfile((p) => ({ ...p, chat_language: CODE_TO_BACKEND_NAME[code] || "English" }));
    };

    const renderStep = () => {
        switch (step) {
            case 0:
                return (
                    <div className="lang-selector-grid">
                        {LANGUAGE_OPTIONS.map((lang) => (
                            <button
                                key={lang.code}
                                className={`lang-btn ${i18n.language === lang.code ? "active" : ""}`}
                                onClick={() => handleLangSelect(lang.code)}
                            >
                                {lang.label}
                            </button>
                        ))}
                    </div>
                );
            case 1:
                return (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
                        {SOIL_TYPES.map((soil) => (
                            <button
                                key={soil}
                                onClick={() => setProfile((p) => ({ ...p, soil_type: soil }))}
                                style={{
                                    padding: "1rem",
                                    borderRadius: "var(--radius-sm)",
                                    border: profile.soil_type === soil ? "2px solid var(--color-primary)" : "2px solid var(--color-border)",
                                    background: profile.soil_type === soil ? "rgba(30,94,58,0.08)" : "white",
                                    cursor: "pointer",
                                    fontWeight: profile.soil_type === soil ? 600 : 400,
                                    transition: "all 0.2s",
                                    fontSize: "0.95rem",
                                }}
                            >
                                {soil}
                            </button>
                        ))}
                    </div>
                );
            case 2:
                return (
                    <div style={{ maxWidth: "300px", margin: "0 auto" }}>
                        <label className="form-label" style={{ fontSize: "1rem", marginBottom: "0.75rem", display: "block", textAlign: "center" }}>
                            {t("onboarding.farmSizeLabel", "Farm Size (in Acres)")}
                        </label>
                        <input
                            type="number"
                            className="form-input"
                            value={profile.farm_size_acres}
                            onChange={(e) => setProfile((p) => ({ ...p, farm_size_acres: parseFloat(e.target.value) || "" }))}
                            placeholder="e.g. 5"
                            min="0.1"
                            step="0.1"
                            style={{ textAlign: "center", fontSize: "1.5rem", padding: "1rem" }}
                        />
                    </div>
                );
            case 3:
                return (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.6rem" }}>
                        {COMMON_CROPS.map((crop) => {
                            const selected = profile.crops.includes(crop);
                            return (
                                <button
                                    key={crop}
                                    onClick={() => toggleCrop(crop)}
                                    style={{
                                        padding: "0.7rem 0.5rem",
                                        borderRadius: "var(--radius-sm)",
                                        border: selected ? "2px solid var(--color-primary)" : "2px solid var(--color-border)",
                                        background: selected ? "rgba(30,94,58,0.08)" : "white",
                                        cursor: "pointer",
                                        fontWeight: selected ? 600 : 400,
                                        transition: "all 0.2s",
                                        fontSize: "0.85rem",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "4px",
                                    }}
                                >
                                    {selected && <Check size={14} />}
                                    {crop}
                                </button>
                            );
                        })}
                    </div>
                );
            case 4:
                return (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", maxWidth: "500px", margin: "0 auto" }}>
                        {IRRIGATION_TYPES.map((irr) => (
                            <button
                                key={irr}
                                onClick={() => setProfile((p) => ({ ...p, irrigation_type: irr }))}
                                style={{
                                    padding: "1rem",
                                    borderRadius: "var(--radius-sm)",
                                    border: profile.irrigation_type === irr ? "2px solid var(--color-primary)" : "2px solid var(--color-border)",
                                    background: profile.irrigation_type === irr ? "rgba(30,94,58,0.08)" : "white",
                                    cursor: "pointer",
                                    fontWeight: profile.irrigation_type === irr ? 600 : 400,
                                    transition: "all 0.2s",
                                    fontSize: "0.95rem",
                                }}
                            >
                                {irr}
                            </button>
                        ))}
                    </div>
                );
            default:
                return null;
        }
    };

    const StepIcon = steps[step].icon;

    return (
        <div style={{
            minHeight: "100vh",
            background: "var(--color-bg-base)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "2rem 1rem",
        }}>
            {/* Progress Bar */}
            <div style={{ width: "100%", maxWidth: "600px", marginBottom: "2rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    {steps.map((s, i) => {
                        const Icon = s.icon;
                        return (
                            <div key={s.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                                <div style={{
                                    width: "40px", height: "40px",
                                    borderRadius: "50%",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    background: i <= step ? "var(--color-primary)" : "var(--color-border)",
                                    color: i <= step ? "white" : "var(--color-text-muted)",
                                    transition: "all 0.3s",
                                    fontWeight: 600,
                                }}>
                                    {i < step ? <Check size={18} /> : <Icon size={18} />}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div style={{ height: "4px", background: "var(--color-border)", borderRadius: "2px", position: "relative" }}>
                    <motion.div
                        style={{ height: "100%", background: "var(--color-primary)", borderRadius: "2px" }}
                        animate={{ width: `${((step) / (steps.length - 1)) * 100}%` }}
                        transition={{ duration: 0.3 }}
                    />
                </div>
            </div>

            {/* Step Card */}
            <motion.div
                className="card"
                style={{ width: "100%", maxWidth: "700px", padding: "2rem" }}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                key={step}
                transition={{ duration: 0.3 }}
            >
                <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
                    <StepIcon size={32} color="var(--color-primary)" style={{ marginBottom: "0.5rem" }} />
                    <h2 style={{ fontSize: "var(--font-size-2xl)" }}>
                        {t(steps[step].titleKey, steps[step].key)}
                    </h2>
                    <p className="read-me" style={{ color: "var(--color-text-muted)" }}>
                        {t(`onboarding.${steps[step].key}Desc`, `Select your ${steps[step].key}`)}
                    </p>
                </div>

                {error && <div className="alert-banner" style={{ marginBottom: "1rem" }}>{error}</div>}

                {renderStep()}

                {/* Navigation */}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2rem" }}>
                    <button
                        className="btn btn-secondary"
                        onClick={() => setStep((s) => s - 1)}
                        disabled={step === 0}
                        style={{ opacity: step === 0 ? 0.4 : 1 }}
                    >
                        <ChevronLeft size={18} />
                        {t("onboarding.back", "Back")}
                    </button>

                    {step < steps.length - 1 ? (
                        <button
                            className="btn btn-primary"
                            onClick={() => setStep((s) => s + 1)}
                            disabled={!canNext()}
                            style={{ opacity: canNext() ? 1 : 0.5 }}
                        >
                            {t("onboarding.next", "Next")}
                            <ChevronRight size={18} />
                        </button>
                    ) : (
                        <button
                            className="btn btn-primary"
                            onClick={handleFinish}
                            disabled={!canNext() || saving}
                        >
                            {saving ? t("onboarding.saving", "Saving...") : (
                                <><Check size={18} /> {t("onboarding.finish", "Finish Setup")}</>
                            )}
                        </button>
                    )}
                </div>
            </motion.div>

            <p style={{ marginTop: "1rem", color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
                {t("onboarding.stepOf", { current: step + 1, total: steps.length }, `Step ${step + 1} of ${steps.length}`)}
            </p>
        </div>
    );
}
