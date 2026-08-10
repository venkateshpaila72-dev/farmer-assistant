import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { recommendCrop, recommendFertilizer, getFertilizerTypes, predictYield, getYieldOptions } from "../api/ml";
import { FlaskConical, Sprout, Leaf, BarChart3, ChevronDown } from "lucide-react";

export default function CropTools() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [tab, setTab] = useState("crop"); // crop | fertilizer | yield
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Fertilizer state
    const [fertTypes, setFertTypes] = useState({ soil_types: [], crop_types: [] });
    const [fertCrop, setFertCrop] = useState("");

    // Yield state
    const [yieldOpts, setYieldOpts] = useState({ crops: [], seasons: [] });
    const [yieldForm, setYieldForm] = useState({ crop: "", season: "", year: new Date().getFullYear(), area_hectares: "", rainfall: "" });

    useEffect(() => {
        getFertilizerTypes().then(setFertTypes).catch(() => { });
        getYieldOptions().then(setYieldOpts).catch(() => { });
    }, []);

    const runCrop = async () => {
        setLoading(true); setError(""); setResult(null);
        try {
            const data = await recommendCrop(user.username);
            setResult(data);
        } catch (e) { setError(e.response?.data?.detail || "Failed to get recommendation"); }
        setLoading(false);
    };

    const runFert = async () => {
        if (!fertCrop) { setError("Please select a crop type"); return; }
        setLoading(true); setError(""); setResult(null);
        try {
            const data = await recommendFertilizer(user.username, fertCrop);
            setResult(data);
        } catch (e) { setError(e.response?.data?.detail || "Failed"); }
        setLoading(false);
    };

    const runYield = async () => {
        if (!yieldForm.crop || !yieldForm.season || !yieldForm.area_hectares) { setError("Please fill all fields"); return; }
        setLoading(true); setError(""); setResult(null);
        try {
            const data = await predictYield({ username: user.username, ...yieldForm });
            setResult(data);
        } catch (e) { setError(e.response?.data?.detail || "Failed"); }
        setLoading(false);
    };

    const tabs = [
        { key: "crop", icon: Sprout, label: t("tools.cropRecommend", "Crop Recommendation") },
        { key: "fertilizer", icon: Leaf, label: t("tools.fertilizer", "Fertilizer Advice") },
        { key: "yield", icon: BarChart3, label: t("tools.yieldPredict", "Yield Prediction") },
    ];

    return (
        <div className="container" style={{ padding: "var(--spacing-lg) var(--spacing-md)" }}>
            <div className="page-header" style={{ borderRadius: "var(--radius-md)", marginBottom: "var(--spacing-xl)" }}>
                <h1 style={{ color: "white", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                    <FlaskConical size={30} /> {t("tools.title", "Crop & Soil Tools")}
                </h1>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "var(--spacing-lg)", flexWrap: "wrap" }}>
                {tabs.map((tb) => {
                    const Icon = tb.icon;
                    return (
                        <button key={tb.key} className={`btn ${tab === tb.key ? "btn-primary" : "btn-secondary"}`} onClick={() => { setTab(tb.key); setResult(null); setError(""); }}>
                            <Icon size={16} /> {tb.label}
                        </button>
                    );
                })}
            </div>

            {error && <div className="alert-banner">{error}</div>}

            <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={tab}>
                {tab === "crop" && (
                    <div style={{ textAlign: "center", padding: "var(--spacing-lg)" }}>
                        <Sprout size={48} color="var(--color-primary)" style={{ marginBottom: "1rem" }} />
                        <h3>{t("tools.cropDesc", "Get AI-powered crop recommendations based on your soil and weather")}</h3>
                        <p className="read-me" style={{ color: "var(--color-text-muted)", marginBottom: "1.5rem" }}>
                            {t("tools.cropInfo", "Uses your farm profile, current weather data, and soil type to suggest the best crops.")}
                        </p>
                        <button className="btn btn-primary" onClick={runCrop} disabled={loading} style={{ padding: "0.85rem 2.5rem" }}>
                            {loading ? "Analyzing..." : t("tools.getRecommendation", "Get Recommendation")}
                        </button>
                    </div>
                )}

                {tab === "fertilizer" && (
                    <div style={{ padding: "var(--spacing-md)" }}>
                        <h3 style={{ marginBottom: "1rem" }}>{t("tools.fertDesc", "Select your crop for fertilizer recommendations")}</h3>
                        <div className="form-group">
                            <label className="form-label">{t("tools.cropType", "Crop Type")}</label>
                            <select className="form-select" value={fertCrop} onChange={(e) => setFertCrop(e.target.value)}>
                                <option value="">-- Select --</option>
                                {fertTypes.crop_types?.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <button className="btn btn-primary" onClick={runFert} disabled={loading}>
                            {loading ? "Analyzing..." : t("tools.getFertilizer", "Get Fertilizer Advice")}
                        </button>
                    </div>
                )}

                {tab === "yield" && (
                    <div style={{ padding: "var(--spacing-md)" }}>
                        <h3 style={{ marginBottom: "1rem" }}>{t("tools.yieldDesc", "Predict your expected crop yield")}</h3>
                        <div className="grid grid-cols-2">
                            <div className="form-group">
                                <label className="form-label">Crop</label>
                                <select className="form-select" value={yieldForm.crop} onChange={(e) => setYieldForm((f) => ({ ...f, crop: e.target.value }))}>
                                    <option value="">-- Select --</option>
                                    {yieldOpts.crops?.map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Season</label>
                                <select className="form-select" value={yieldForm.season} onChange={(e) => setYieldForm((f) => ({ ...f, season: e.target.value }))}>
                                    <option value="">-- Select --</option>
                                    {yieldOpts.seasons?.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Area (hectares)</label>
                                <input className="form-input" type="number" value={yieldForm.area_hectares} onChange={(e) => setYieldForm((f) => ({ ...f, area_hectares: parseFloat(e.target.value) || "" }))} placeholder="e.g. 2" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Rainfall (mm)</label>
                                <input className="form-input" type="number" value={yieldForm.rainfall} onChange={(e) => setYieldForm((f) => ({ ...f, rainfall: parseFloat(e.target.value) || "" }))} placeholder="e.g. 800" />
                            </div>
                        </div>
                        <button className="btn btn-primary" onClick={runYield} disabled={loading}>
                            {loading ? "Predicting..." : t("tools.predictYield", "Predict Yield")}
                        </button>
                    </div>
                )}
            </motion.div>

            {/* Result Display */}
            {result && (
                <motion.div className="card read-me" style={{ marginTop: "var(--spacing-lg)" }} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
                    <h3 style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "0.75rem" }}>
                        <FlaskConical size={20} color="var(--color-primary)" />
                        {t("tools.result", "Result")}
                    </h3>
                    <div style={{ whiteSpace: "pre-line", lineHeight: 1.7, color: "var(--color-text-main)" }}>
                        {typeof result === "string" ? result : (
                            <div>
                                {result.recommendation && <p><strong>Recommendation:</strong> {result.recommendation}</p>}
                                {result.predicted_yield && <p><strong>Predicted Yield:</strong> {result.predicted_yield}</p>}
                                {result.fertilizer && <p><strong>Fertilizer:</strong> {result.fertilizer}</p>}
                                {result.crops && <p><strong>Crops:</strong> {Array.isArray(result.crops) ? result.crops.join(", ") : result.crops}</p>}
                                {result.advice && <p><strong>Advice:</strong> {result.advice}</p>}
                                {/* Fallback: dump remaining keys */}
                                {Object.entries(result).filter(([k]) => !["recommendation", "predicted_yield", "fertilizer", "crops", "advice"].includes(k)).map(([k, v]) => (
                                    <p key={k}><strong>{k}:</strong> {typeof v === "object" ? JSON.stringify(v) : String(v)}</p>
                                ))}
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </div>
    );
}
