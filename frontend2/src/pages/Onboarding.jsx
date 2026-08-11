import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { saveOnboarding } from "../api/onboarding";
import { LANGUAGE_OPTIONS } from "../i18n";
import {
    Sprout, ChevronLeft, ChevronRight, Check, Droplets,
    Mountain, TreePine, Wheat, Languages, AlertTriangle, MapPin, LocateFixed
} from "lucide-react";

// Values must match the backend schema (app/db/schemas.py → OnboardingData):
// username, soil_type, farm_acres, preferred_crops, irrigation_type,
// main_problem, chat_language, home_location {state, district, village, lat, lng}
const SOIL_TYPES = ["Alluvial", "Black", "Red", "Laterite", "Desert", "Mountain", "Clay", "Sandy", "Loamy"];
const IRRIGATION_TYPES = ["Drip", "Sprinkler", "Canal", "Rainfed", "Borewell", "Well", "River"];
const COMMON_CROPS = ["Rice", "Wheat", "Maize", "Cotton", "Sugarcane", "Soybean", "Groundnut", "Mustard", "Gram", "Tur", "Jowar", "Bajra", "Ragi", "Tomato", "Onion", "Potato", "Chilli"];
const PROBLEMS = ["pests", "water", "price", "disease"];
const CODE_TO_BACKEND_NAME = { en: "English", hi: "Hindi", te: "Telugu", ta: "Tamil", kn: "Kannada", mr: "Marathi", bn: "Bengali", pa: "Punjabi" };

const steps = [
    { key: "language", icon: Languages, titleKey: "onboarding.language" },
    { key: "soil", icon: Mountain, titleKey: "onboarding.soil" },
    { key: "farm", icon: TreePine, titleKey: "onboarding.farm" },
    { key: "crops", icon: Wheat, titleKey: "onboarding.crops" },
    { key: "irrigation", icon: Droplets, titleKey: "onboarding.irrigation" },
    { key: "problem", icon: AlertTriangle, titleKey: "onboarding.problem" },
    { key: "location", icon: MapPin, titleKey: "onboarding.location" },
];

async function reverseGeocode(lat, lng) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=12&addressdetails=1`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("Reverse geocoding failed");
    const data = await res.json();
    const addr = data.address || {};
    return {
        state: addr.state || "",
        district: addr.state_district || addr.county || "",
        village: addr.village || addr.town || addr.city || addr.hamlet || addr.suburb || "",
    };
}

export default function Onboarding() {
    const { t, i18n } = useTranslation();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [step, setStep] = useState(0);
    const [profile, setProfile] = useState({
        chat_language: CODE_TO_BACKEND_NAME[i18n.language] || "English",
        soil_type: "",
        farm_acres: "",
        preferred_crops: [],
        irrigation_type: "",
        main_problem: "",
        home_location: { state: "", district: "", village: "", lat: null, lng: null },
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [locating, setLocating] = useState(false);
    const [geoError, setGeoError] = useState("");

    const canNext = () => {
        switch (step) {
            case 0: return !!profile.chat_language;
            case 1: return !!profile.soil_type;
            case 2: return profile.farm_acres > 0;
            case 3: return profile.preferred_crops.length > 0;
            case 4: return !!profile.irrigation_type;
            case 5: return !!profile.main_problem;
            case 6: {
                const loc = profile.home_location;
                return !!(loc.state && loc.district && loc.village && loc.lat && loc.lng);
            }
            default: return false;
        }
    };

    const toggleCrop = (crop) => {
        setProfile((p) => ({
            ...p,
            preferred_crops: p.preferred_crops.includes(crop)
                ? p.preferred_crops.filter((c) => c !== crop)
                : [...p.preferred_crops, crop],
        }));
    };

    const handleFinish = async () => {
        setSaving(true);
        setError("");
        try {
            await saveOnboarding({ username: user.username, ...profile });
            navigate("/dashboard");
        } catch (err) {
            setError(err.response?.data?.detail || t("onboarding.saveError", "Failed to save profile, please try again."));
        } finally {
            setSaving(false);
        }
    };

    const handleLangSelect = (code) => {
        i18n.changeLanguage(code);
        setProfile((p) => ({ ...p, chat_language: CODE_TO_BACKEND_NAME[code] || "English" }));
    };

    const captureGPS = () => {
        if (!("geolocation" in navigator)) {
            setGeoError(t("locationStep.geoNotSupported", "Geolocation is not supported in this browser"));
            return;
        }
        setLocating(true);
        setGeoError("");
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude: lat, longitude: lng } = pos.coords;
                try {
                    const address = await reverseGeocode(lat, lng);
                    setProfile((p) => ({ ...p, home_location: { ...p.home_location, ...address, lat, lng } }));
                } catch {
                    setProfile((p) => ({ ...p, home_location: { ...p.home_location, lat, lng } }));
                    setGeoError(t("locationStep.geoPartialFail", "Location captured, but village/state could not be auto-filled. Please type them."));
                } finally {
                    setLocating(false);
                }
            },
            () => {
                setGeoError(t("locationStep.geoFailed", "Could not get your location. Please type it manually."));
                setLocating(false);
            },
            { timeout: 8000 }
        );
    };

    const setLoc = (field) => (e) =>
        setProfile((p) => ({ ...p, home_location: { ...p.home_location, [field]: e.target.value } }));

    const renderStep = () => {
        switch (step) {
            case 0:
                return (
                    <div className="lang-selector-grid" style={{ margin: "0 auto" }}>
                        {LANGUAGE_OPTIONS.map((lang) => (
                            <button
                                key={lang.code}
                                className={`lang-btn ${i18n.language === lang.code ? "active" : ""}`}
                                onClick={() => handleLangSelect(lang.code)}
                                style={{ padding: "0.9rem 0.75rem" }}
                            >
                                <span style={{ fontSize: "0.95rem" }}>{lang.label}</span>
                            </button>
                        ))}
                    </div>
                );
            case 1:
                return (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.75rem" }}>
                        {SOIL_TYPES.map((soil) => (
                            <button
                                key={soil}
                                onClick={() => setProfile((p) => ({ ...p, soil_type: soil.toLowerCase() }))}
                                style={{
                                    padding: "1rem 0.5rem",
                                    borderRadius: "var(--radius-sm)",
                                    border: profile.soil_type === soil.toLowerCase() ? "2px solid var(--color-primary)" : "2px solid var(--color-border)",
                                    background: profile.soil_type === soil.toLowerCase() ? "rgba(30,94,58,0.08)" : "white",
                                    cursor: "pointer",
                                    fontWeight: profile.soil_type === soil.toLowerCase() ? 600 : 400,
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
                            value={profile.farm_acres}
                            onChange={(e) => setProfile((p) => ({ ...p, farm_acres: parseFloat(e.target.value) || "" }))}
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
                            const selected = profile.preferred_crops.includes(crop);
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
            case 5:
                return (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem", maxWidth: "480px", margin: "0 auto" }}>
                        {PROBLEMS.map((problem) => (
                            <button
                                key={problem}
                                onClick={() => setProfile((p) => ({ ...p, main_problem: problem }))}
                                style={{
                                    padding: "1.1rem",
                                    borderRadius: "var(--radius-sm)",
                                    border: profile.main_problem === problem ? "2px solid var(--color-primary)" : "2px solid var(--color-border)",
                                    background: profile.main_problem === problem ? "rgba(30,94,58,0.08)" : "white",
                                    cursor: "pointer",
                                    fontWeight: profile.main_problem === problem ? 600 : 400,
                                    transition: "all 0.2s",
                                    fontSize: "1rem",
                                    textTransform: "capitalize",
                                }}
                            >
                                {t(`problem.${problem}`, problem)}
                            </button>
                        ))}
                    </div>
                );
            case 6:
                return (
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
                            <button className="btn btn-primary" onClick={captureGPS} disabled={locating} style={{ padding: "0.6rem 1.2rem" }}>
                                <LocateFixed size={16} />
                                {locating ? t("locationStep.locating", "Locating...") : t("locationStep.useMyLocation", "Use My Location")}
                            </button>
                            {profile.home_location.lat && profile.home_location.lng && (
                                <span style={{ fontSize: "0.85rem", color: "var(--color-success)", display: "flex", alignItems: "center", gap: "5px" }}>
                                    <MapPin size={14} /> {t("locationStep.locationCaptured", "Location captured ✓")}
                                </span>
                            )}
                        </div>
                        {geoError && <div className="alert-banner">{geoError}</div>}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--spacing-md)" }}>
                            <div className="form-group">
                                <label className="form-label">{t("locationStep.state", "State")} *</label>
                                <input className="form-input" value={profile.home_location.state} onChange={setLoc("state")} placeholder="e.g. Maharashtra" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t("locationStep.district", "District")} *</label>
                                <input className="form-input" value={profile.home_location.district} onChange={setLoc("district")} placeholder="e.g. Pune" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t("locationStep.village", "Village")} *</label>
                                <input className="form-input" value={profile.home_location.village} onChange={setLoc("village")} placeholder="e.g. Shivapur" />
                            </div>
                        </div>
                        <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: "0.5rem" }}>
                            {t("locationStep.autofillNote", "Tip: Use My Location auto-fills these from GPS. You can also type them.")}
                        </p>
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
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "1.5rem" }}>
                <Sprout size={30} color="var(--color-primary)" />
                <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.4rem", fontWeight: 800, color: "var(--color-primary)" }}>
                    {t("app.name", "Farmer Assistant")}
                </h1>
            </div>

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
                        animate={{ width: `${(step / (steps.length - 1)) * 100}%` }}
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
