import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { detectDisease, classifySoil, getDiseaseHistory } from "../api/vision";
import {
    Scan, Bug, CheckCircle2, Leaf, FlaskConical, History,
    Upload, Image as ImageIcon, AlertTriangle, RefreshCw, Sprout
} from "lucide-react";

function ResultCard({ result, t, kind }) {
    if (kind === "disease") {
        if (result.is_healthy) {
            return (
                <motion.div
                    className="card read-me"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ textAlign: "center", padding: "var(--spacing-xl)", borderTop: "5px solid var(--color-success)" }}
                >
                    <div style={{
                        width: "64px", height: "64px", borderRadius: "50%",
                        background: "rgba(92,184,92,0.12)", color: "var(--color-success)",
                        display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto var(--spacing-md)",
                    }}>
                        <CheckCircle2 size={32} />
                    </div>
                    <h3 style={{ color: "var(--color-success)", marginBottom: "0.25rem" }}>{t("vision.healthy", "Plant is healthy")}</h3>
                    <p style={{ color: "var(--color-text-muted)" }}>
                        {Math.round((result.confidence || 0) * 100)}% {t("vision.confidence", "Confidence")}
                    </p>
                    {result.image_url && (
                        <img src={result.image_url} alt="Plant" className="photo-preview" style={{ marginTop: "var(--spacing-md)", maxHeight: "220px" }} />
                    )}
                </motion.div>
            );
        }

        const fert = result.fertilizer;
        return (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-md)" }}>
                <div className="card read-me" style={{ borderTop: "5px solid var(--color-danger)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-md)", flexWrap: "wrap" }}>
                        <div style={{
                            width: "52px", height: "52px", borderRadius: "50%",
                            background: "rgba(217,83,79,0.12)", color: "var(--color-danger)",
                            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        }}>
                            <Bug size={26} />
                        </div>
                        <div style={{ flex: 1, minWidth: "200px" }}>
                            <h3 style={{ color: "var(--color-danger)", marginBottom: "0.25rem" }}>{result.disease}</h3>
                            <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                                {result.severity} · {Math.round((result.confidence || 0) * 100)}% {t("vision.confidence", "Confidence")}
                            </p>
                        </div>
                        {result.image_url && (
                            <img src={result.image_url} alt="Leaf" className="photo-preview" style={{ maxHeight: "140px" }} />
                        )}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "var(--spacing-md)", marginTop: "var(--spacing-md)" }}>
                        <div style={{ background: "var(--color-bg-base)", padding: "var(--spacing-md)", borderRadius: "var(--radius-sm)" }}>
                            <p style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-danger)", fontWeight: 600, marginBottom: "0.25rem" }}>
                                {t("vision.treatment", "Treatment")}
                            </p>
                            <p style={{ fontSize: "0.92rem" }}>{result.treatment}</p>
                        </div>
                        <div style={{ background: "var(--color-bg-base)", padding: "var(--spacing-md)", borderRadius: "var(--radius-sm)" }}>
                            <p style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-danger)", fontWeight: 600, marginBottom: "0.25rem" }}>
                                {t("vision.prevention", "Prevention")}
                            </p>
                            <p style={{ fontSize: "0.92rem" }}>{result.prevention}</p>
                        </div>
                    </div>
                </div>

                {fert?.applicable && fert.related_fertilizers?.length > 0 && (
                    <div className="card">
                        <h4 style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "var(--spacing-md)" }}>
                            <FlaskConical size={18} color="var(--color-accent)" />
                            {t("vision.relatedFertilizers", "Related Fertilizers")}
                        </h4>
                        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-sm)" }}>
                            {fert.related_fertilizers.map((f, i) => (
                                <div key={f.name} style={{
                                    display: "flex", gap: "var(--spacing-sm)", alignItems: "flex-start",
                                    padding: "var(--spacing-md)", borderRadius: "var(--radius-sm)",
                                    background: i === 0 ? "rgba(244,180,26,0.08)" : "var(--color-bg-base)",
                                    border: i === 0 ? "1px solid rgba(244,180,26,0.4)" : "1px solid var(--color-border)",
                                }}>
                                    <FlaskConical size={18} color={i === 0 ? "var(--color-accent)" : "var(--color-text-muted)"} style={{ marginTop: "2px", flexShrink: 0 }} />
                                    <div>
                                        <p style={{ fontWeight: 600, fontSize: "0.92rem" }}>{f.name}</p>
                                        <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>{f.reason}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {fert && !fert.applicable && (
                    <div className="card">
                        <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-muted)", marginBottom: "0.25rem" }}>
                            {t("vision.fertilizer", "Fertilizer")}
                        </p>
                        <p style={{ fontSize: "0.92rem" }}>{fert.note}</p>
                    </div>
                )}

                {result.top3?.length > 0 && (
                    <div className="card">
                        <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-muted)", marginBottom: "var(--spacing-sm)" }}>
                            {t("vision.otherPossibilities", "Other Possibilities")}
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                            {result.top3.map((item) => (
                                <div key={item.class} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
                                    <span>{item.class}</span>
                                    <span style={{ color: "var(--color-text-muted)" }}>{Math.round(item.confidence * 100)}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </motion.div>
        );
    }

    // Soil classification result
    return (
        <motion.div className="card read-me" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} style={{ borderTop: "5px solid var(--color-primary)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-md)", flexWrap: "wrap" }}>
                <div style={{
                    width: "52px", height: "52px", borderRadius: "50%",
                    background: "rgba(30,94,58,0.12)", color: "var(--color-primary)",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                    <Sprout size={26} />
                </div>
                <div style={{ flex: 1, minWidth: "200px" }}>
                    <h3 style={{ color: "var(--color-primary)", marginBottom: "0.25rem" }}>{result.soil_type}</h3>
                    <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                        {Math.round((result.confidence || 0) * 100)}% {t("vision.confidence", "Confidence")}
                    </p>
                </div>
                {result.image_url && (
                    <img src={result.image_url} alt="Soil" className="photo-preview" style={{ maxHeight: "140px" }} />
                )}
            </div>
            {result.all_probabilities?.length > 0 && (
                <div style={{ marginTop: "var(--spacing-md)" }}>
                    <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-muted)", marginBottom: "var(--spacing-sm)" }}>
                        {t("vision.allProbabilities", "All Probabilities")}
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                        {result.all_probabilities.map((item) => (
                            <div key={item.class} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
                                <span>{item.class}</span>
                                <span style={{ color: "var(--color-text-muted)" }}>{Math.round(item.confidence * 100)}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {result.profile_updated && (
                <p style={{ marginTop: "var(--spacing-md)", fontSize: "0.85rem", color: "var(--color-success)", display: "flex", alignItems: "center", gap: "6px" }}>
                    <CheckCircle2 size={16} /> {t("vision.profileUpdated", "Soil type saved to your profile")}
                </p>
            )}
        </motion.div>
    );
}

function PhotoUploader({ onAnalyze, analyzing, label, note, kind }) {
    const { t } = useTranslation();
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState("");
    const [error, setError] = useState("");
    const inputRef = useRef(null);

    const handleFile = (f) => {
        setFile(f);
        setError("");
        if (f) {
            const url = URL.createObjectURL(f);
            setPreview(url);
        } else {
            setPreview("");
        }
    };

    const handleAnalyze = async () => {
        if (!file) {
            setError(t("vision.noImage", "Please choose a photo first"));
            return;
        }
        setError("");
        await onAnalyze(file);
    };

    return (
        <div className="card" style={{ padding: "var(--spacing-lg)" }}>
            <p className="read-me" style={{ color: "var(--color-text-muted)", marginBottom: "var(--spacing-md)", fontSize: "0.92rem" }}>
                {note}
            </p>
            <div
                className="camera-uploader"
                style={{ cursor: "pointer", padding: "2rem 1rem", border: "2px dashed var(--color-border)", borderRadius: "var(--radius-md)" }}
                onClick={() => inputRef.current?.click()}
            >
                {preview ? (
                    <img src={preview} alt="Preview" className="photo-preview" style={{ maxHeight: "220px" }} />
                ) : (
                    <>
                        <ImageIcon size={40} color="var(--color-primary-light)" />
                        <p style={{ fontWeight: 500 }}>{label}</p>
                        <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>JPG · PNG · WEBP</p>
                    </>
                )}
            </div>
            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/jpg,image/webp"
                style={{ display: "none" }}
                onChange={(e) => handleFile(e.target.files?.[0])}
            />
            {error && <div className="alert-banner" style={{ marginTop: "var(--spacing-md)" }}><AlertTriangle size={16} /> {error}</div>}
            <button className="btn btn-primary" onClick={handleAnalyze} disabled={analyzing} style={{ marginTop: "var(--spacing-md)", padding: "0.75rem 2rem" }}>
                {analyzing ? (
                    <><RefreshCw size={16} className="spin" /> {t("vision.analyzing", "Analyzing...")}</>
                ) : (
                    <><Scan size={16} /> {t("vision.checkPhoto", "Check Photo")}</>
                )}
            </button>
        </div>
    );
}

export default function VisionTools() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [tab, setTab] = useState("disease"); // disease | soil | history
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const loadHistory = () => {
        if (!user?.username) return;
        setLoadingHistory(true);
        getDiseaseHistory(user.username, 10)
            .then((d) => setHistory(d.history || []))
            .catch(() => setHistory([]))
            .finally(() => setLoadingHistory(false));
    };

    useEffect(() => {
        if (tab === "history" && history.length === 0) loadHistory();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab]);

    const analyzeDisease = async (file) => {
        setLoading(true);
        setError("");
        setResult(null);
        try {
            const data = await detectDisease(user.username, file);
            setResult({ ...data, kind: "disease" });
        } catch (err) {
            setError(err.response?.data?.detail || t("vision.error", "Analysis failed. Please try again."));
        } finally {
            setLoading(false);
        }
    };

    const analyzeSoil = async (file) => {
        setLoading(true);
        setError("");
        setResult(null);
        try {
            const data = await classifySoil(user.username, file);
            setResult({ ...data, kind: "soil" });
        } catch (err) {
            setError(err.response?.data?.detail || t("vision.error", "Analysis failed. Please try again."));
        } finally {
            setLoading(false);
        }
    };

    const tabs = [
        { key: "disease", icon: Bug, label: t("vision.tabDisease", "Disease Detection") },
        { key: "soil", icon: Leaf, label: t("vision.tabSoil", "Soil Classification") },
        { key: "history", icon: History, label: t("vision.tabHistory", "Disease History") },
    ];

    return (
        <div className="container" style={{ padding: "var(--spacing-lg) var(--spacing-md)" }}>
            <div className="page-header" style={{ borderRadius: "var(--radius-md)", marginBottom: "var(--spacing-xl)" }}>
                <h1 style={{ color: "white", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                    <Scan size={30} /> {t("vision.title", "Photo Analysis")}
                </h1>
                <p style={{ opacity: 0.8 }}>{t("vision.subtitle", "Detect crop diseases and classify soil from photos")}</p>
            </div>

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

            {error && <div className="alert-banner"><AlertTriangle size={18} /> {error}</div>}

            {tab === "disease" && (
                <>
                    <PhotoUploader
                        onAnalyze={analyzeDisease}
                        analyzing={loading}
                        label={t("vision.uploadLeafPhoto", "Upload a photo of the affected leaf")}
                        note={t("vision.diseaseNote", "Upload a clear photo of a crop leaf. Our AI will detect the disease and suggest treatment and prevention.")}
                    />
                    {result && <div style={{ marginTop: "var(--spacing-lg)" }}><ResultCard result={result} t={t} kind="disease" /></div>}
                </>
            )}

            {tab === "soil" && (
                <>
                    <PhotoUploader
                        onAnalyze={analyzeSoil}
                        analyzing={loading}
                        label={t("vision.uploadSoilPhoto", "Upload a photo of your soil")}
                        note={t("vision.soilNote", "Upload a close-up photo of your field soil. The result is saved to your profile automatically.")}
                    />
                    {result && <div style={{ marginTop: "var(--spacing-lg)" }}><ResultCard result={result} t={t} kind="soil" />}</div>}
                </>
            )}

            {tab === "history" && (
                <div className="card">
                    <h3 style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "var(--spacing-md)" }}>
                        <History size={20} color="var(--color-primary)" />
                        {t("vision.historyTitle", "Past Disease Detections")}
                    </h3>
                    {loadingHistory ? (
                        <p style={{ color: "var(--color-text-muted)" }}>Loading...</p>
                    ) : history.length === 0 ? (
                        <p className="flex-center" style={{ color: "var(--color-text-muted)", padding: "2rem", textAlign: "center" }}>
                            {t("vision.noHistory", "No disease detections yet. Check a leaf photo to get started!")}
                        </p>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-sm)" }}>
                            {history.map((h, i) => (
                                <div key={i} style={{
                                    display: "flex", alignItems: "center", gap: "var(--spacing-md)",
                                    padding: "var(--spacing-md)", borderRadius: "var(--radius-sm)",
                                    background: "var(--color-bg-base)", flexWrap: "wrap",
                                }}>
                                    {h.image_url && <img src={h.image_url} alt="" style={{ width: "56px", height: "56px", objectFit: "cover", borderRadius: "var(--radius-sm)" }} />}
                                    <div style={{ flex: 1, minWidth: "180px" }}>
                                        <p style={{ fontWeight: 600, color: h.is_healthy ? "var(--color-success)" : "var(--color-danger)" }}>
                                            {h.is_healthy ? t("vision.healthy", "Healthy") : h.disease}
                                        </p>
                                        <p style={{ fontSize: "0.82rem", color: "var(--color-text-muted)" }}>
                                            {new Date(h.detected_at).toLocaleDateString()} · {Math.round((h.confidence || 0) * 100)}%
                                        </p>
                                    </div>
                                    {!h.is_healthy && (
                                        <span style={{
                                            fontSize: "0.72rem", fontWeight: 600, padding: "0.2rem 0.6rem",
                                            borderRadius: "var(--radius-full)", background: "rgba(217,83,79,0.1)", color: "var(--color-danger)",
                                        }}>
                                            {h.severity}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <style>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
