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
                    {tab === "crop" && result.top_crops && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-sm)" }}>
                            <div style={{
                                display: "flex", alignItems: "center", gap: "var(--spacing-md)", flexWrap: "wrap",
                                padding: "var(--spacing-md)", borderRadius: "var(--radius-sm)",
                                background: "rgba(30,94,58,0.08)", border: "1px solid rgba(30,94,58,0.25)",
                            }}>
                                <Sprout size={26} color="var(--color-primary)" />
                                <div>
                                    <p style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>{t("tools.cropRecommend", "Crop Recommendation")}</p>
                                    <p style={{ fontWeight: 700, fontSize: "1.15rem", color: "var(--color-primary-dark)", textTransform: "capitalize" }}>
                                        {result.best_crop?.replace(/_/g, " ")}
                                    </p>
                                </div>
                                <span style={{
                                    marginLeft: "auto", fontSize: "0.85rem", fontWeight: 600, padding: "0.3rem 0.8rem",
                                    borderRadius: "var(--radius-full)", background: "white", color: "var(--color-primary)",
                                }}>
                                    {result.confidence}% {t("cropTools.confidence", "confidence")}
                                </span>
                            </div>
                            <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                                {result.season && <>Season: <strong>{result.season}</strong> · </>}
                                {result.location && <>State: <strong>{result.location}</strong> · </>}
                                {result.soil_type && <>Soil: <strong style={{ textTransform: "capitalize" }}>{result.soil_type.replace(/_/g, " ")}</strong></>}
                            </p>
                            <div>
                                <p style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--color-text-muted)", marginBottom: "0.4rem" }}>Top 3</p>
                                {result.top_crops.map((c) => (
                                    <div key={c.crop} style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", fontSize: "0.92rem", borderBottom: "1px solid var(--color-border)" }}>
                                        <span style={{ textTransform: "capitalize" }}>{c.crop.replace(/_/g, " ")}</span>
                                        <span style={{ color: "var(--color-text-muted)" }}>{c.confidence}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {tab === "fertilizer" && result.recommendations && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-md)" }}>
                            {result.deficits && (
                                <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                                    {Object.entries(result.deficits).map(([k, v]) => (
                                        <span key={k} style={{
                                            fontSize: "0.8rem", fontWeight: 600, padding: "0.3rem 0.8rem", borderRadius: "var(--radius-full)",
                                            background: v > 0 ? "rgba(217,83,79,0.1)" : "rgba(92,184,92,0.1)",
                                            color: v > 0 ? "var(--color-danger)" : "var(--color-success)",
                                        }}>
                                            {k}: {v > 0 ? `+${v}` : "OK"}
                                        </span>
                                    ))}
                                </div>
                            )}
                            {result.recommendations.map((rec, i) => (
                                <div key={rec.fertilizer} style={{
                                    display: "flex", alignItems: "center", gap: "var(--spacing-sm)",
                                    padding: "var(--spacing-md)", borderRadius: "var(--radius-sm)",
                                    background: i === 0 ? "rgba(30,94,58,0.08)" : "var(--color-bg-base)",
                                    border: i === 0 ? "1px solid rgba(30,94,58,0.3)" : "1px solid var(--color-border)",
                                }}>
                                    <Leaf size={20} color={i === 0 ? "var(--color-primary)" : "var(--color-text-muted)"} style={{ flexShrink: 0 }} />
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontWeight: 600 }}>{rec.fertilizer}</p>
                                        {rec.low_sample && (
                                            <p style={{ fontSize: "0.75rem", color: "var(--color-warning)" }}>{t("cropTools.lowSampleNote", "Fewer training examples for this fertilizer")}</p>
                                        )}
                                    </div>
                                    <span style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>{rec.confidence}%</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {tab === "yield" && result.unit_group && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-md)" }}>
                            {result.out_of_range_warning && (
                                <div className="alert-banner">
                                    {t("cropTools.outOfRangeWarning", "This prediction is outside the range the model was trained on")}
                                </div>
                            )}
                            <div style={{
                                padding: "var(--spacing-lg)", borderRadius: "var(--radius-sm)", textAlign: "center",
                                background: "rgba(30,94,58,0.08)", border: "1px solid rgba(30,94,58,0.25)",
                            }}>
                                <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>{t("tools.predictYield", "Predicted Yield")}</p>
                                <p style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--color-primary-dark)" }}>
                                    {result.unit_group === "count" ? (
                                        `${Math.round(result.yield_nuts_per_ha || 0).toLocaleString("en-IN")} ${t("cropTools.nuts", "nuts")}/${t("cropTools.perHectare", "per hectare")}`
                                    ) : result.unit_group === "bale" ? (
                                        `${result.yield_bales_per_ha} ${t("cropTools.bales", "bales")}/${t("cropTools.perHectare", "per hectare")}`
                                    ) : (
                                        `${result.yield_tonnes_per_ha} ${t("cropTools.quintals", "quintals")}/${t("cropTools.perHectare", "per hectare")}`
                                    )}
                                </p>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "var(--spacing-sm)" }}>
                                {result.unit_group === "weight" && (
                                    <>
                                        <div className="stat-pill"><p style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>{t("cropTools.perHectare", "per hectare")}</p><p className="stat-val" style={{ fontSize: "1.1rem" }}>{result.yield_kg_per_ha} kg</p></div>
                                        <div className="stat-pill"><p style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>Total</p><p className="stat-val" style={{ fontSize: "1.1rem" }}>{result.total_quintals} q</p></div>
                                    </>
                                )}
                                {result.unit_group === "count" && (
                                    <div className="stat-pill"><p style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>Total</p><p className="stat-val" style={{ fontSize: "1.1rem" }}>{Math.round(result.total_nuts || 0).toLocaleString("en-IN")}</p></div>
                                )}
                                {result.unit_group === "bale" && (
                                    <div className="stat-pill"><p style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>Total</p><p className="stat-val" style={{ fontSize: "1.1rem" }}>{result.total_bales}</p></div>
                                )}
                                <div className="stat-pill"><p style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>Area</p><p className="stat-val" style={{ fontSize: "1.1rem" }}>{result.area_hectares} ha</p></div>
                                <div className="stat-pill"><p style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>{t("cropTools.crop", "Crop")}</p><p className="stat-val" style={{ fontSize: "1.1rem", textTransform: "capitalize" }}>{result.crop?.replace(/_/g, " ")}</p></div>
                            </div>
                        </div>
                    )}
                </motion.div>
            )}
        </div>
    );
}
