import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
    getAnalytics, getAllFarmers, getAnnouncements,
    postAnnouncement, editAnnouncement
} from "../api/admin";
import { uploadMarketDataset, getUploadStatus, runMarketSync } from "../api/market";
import {
    Shield, Users, Megaphone, Database, RefreshCw, Plus,
    Pencil, Upload, X, Check, BarChart3
} from "lucide-react";

const EMPTY_FORM = {
    title: "", content: "", benefit: "", eligibility: "",
    where_to_apply: "", official_link: "", scheme_status: "active",
};

export default function Admin() {
    const { t } = useTranslation();
    const [tab, setTab] = useState("overview"); // overview | farmers | announcements | market
    const [analytics, setAnalytics] = useState(null);
    const [farmers, setFarmers] = useState([]);
    const [announcements, setAnnouncements] = useState([]);
    const [uploadStatus, setUploadStatus] = useState(null);

    const [form, setForm] = useState(EMPTY_FORM);
    const [editingId, setEditingId] = useState(null);
    const [imageFile, setImageFile] = useState(null);
    const [formOpen, setFormOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [csvFile, setCsvFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState("");
    const [toast, setToast] = useState("");

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(""), 3500);
    };

    const loadAll = () => {
        getAnalytics().then(setAnalytics).catch(() => {});
        getAllFarmers().then((d) => setFarmers(d.farmers || [])).catch(() => {});
        getAnnouncements().then((d) => setAnnouncements(d.announcements || [])).catch(() => {});
        getUploadStatus().then(setUploadStatus).catch(() => {});
    };

    useEffect(() => {
        loadAll();
    }, []);

    const openNewForm = () => {
        setForm(EMPTY_FORM);
        setEditingId(null);
        setImageFile(null);
        setFormOpen(true);
    };

    const openEditForm = (ann) => {
        setForm({
            title: ann.title || "",
            content: ann.content || "",
            benefit: ann.benefit || "",
            eligibility: ann.eligibility || "",
            where_to_apply: ann.where_to_apply || "",
            official_link: ann.official_link || "",
            scheme_status: ann.scheme_status || "active",
        });
        setEditingId(ann.id);
        setImageFile(null);
        setFormOpen(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.title.trim() || !form.content.trim()) {
            setError("Title and content are required");
            return;
        }
        setSaving(true);
        setError("");
        try {
            if (editingId) {
                await editAnnouncement(editingId, { ...form, imageFile });
            } else {
                await postAnnouncement({ ...form, posted_by: "admin", imageFile });
            }
            showToast(editingId ? t("admin.update", "Update") + " ✓" : t("admin.post", "Post") + " ✓");
            setFormOpen(false);
            loadAll();
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to save announcement");
        } finally {
            setSaving(false);
        }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!csvFile) {
            setError(t("admin.fileRequired", "Please choose a CSV file"));
            return;
        }
        setUploading(true);
        setError("");
        try {
            const data = await uploadMarketDataset(csvFile, "admin");
            showToast(`${data.imported || data.count || ""} ${t("admin.recordsImported", "Records imported")} ✓`);
            setCsvFile(null);
            getUploadStatus().then(setUploadStatus).catch(() => {});
            e.target.reset?.();
        } catch (err) {
            setError(err.response?.data?.detail || "Upload failed");
        } finally {
            setUploading(false);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            const data = await runMarketSync();
            showToast(data.message || "Sync triggered ✓");
        } catch {
            showToast("Sync failed — is the backend configured?");
        } finally {
            setSyncing(false);
        }
    };

    const tabs = [
        { key: "overview", icon: BarChart3, label: t("admin.tabOverview", "Overview") },
        { key: "farmers", icon: Users, label: t("admin.tabFarmers", "Farmers") },
        { key: "announcements", icon: Megaphone, label: t("admin.tabAnnouncements", "Announcements") },
        { key: "market", icon: Database, label: t("admin.tabMarket", "Market Data") },
    ];

    return (
        <div className="container" style={{ padding: "var(--spacing-lg) var(--spacing-md)" }}>
            <div className="page-header" style={{ borderRadius: "var(--radius-md)", marginBottom: "var(--spacing-xl)" }}>
                <h1 style={{ color: "white", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                    <Shield size={30} /> {t("admin.panelTitle", "Admin Panel")}
                </h1>
                <p style={{ opacity: 0.8 }}>{t("admin.panelSubtitle", "Manage farmers, announcements, and market data")}</p>
            </div>

            {toast && (
                <div className="alert-banner" style={{ background: "rgba(92,184,92,0.1)", borderLeftColor: "var(--color-success)", color: "var(--color-success)" }}>
                    <Check size={18} /> {toast}
                </div>
            )}
            {error && <div className="alert-banner"><X size={18} /> {error}</div>}

            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "var(--spacing-lg)", flexWrap: "wrap", alignItems: "center" }}>
                {tabs.map((tb) => {
                    const Icon = tb.icon;
                    return (
                        <button key={tb.key} className={`btn ${tab === tb.key ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab(tb.key)}>
                            <Icon size={16} /> {tb.label}
                        </button>
                    );
                })}
                <button className="btn btn-secondary" onClick={loadAll} style={{ marginLeft: "auto" }}>
                    <RefreshCw size={15} /> {t("news.refresh", "Refresh")}
                </button>
            </div>

            {/* ── Overview ── */}
            {tab === "overview" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <h3 style={{ marginBottom: "var(--spacing-md)" }}>{t("admin.analyticsTitle", "Platform Analytics")}</h3>
                    <div className="grid grid-cols-2" style={{ maxWidth: "560px" }}>
                        <div className="stat-pill">
                            <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>{t("admin.totalFarmers", "Total Farmers")}</p>
                            <p className="stat-val">{analytics?.total_farmers ?? "—"}</p>
                        </div>
                        <div className="stat-pill">
                            <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>{t("admin.totalAdmins", "Total Admins")}</p>
                            <p className="stat-val">{analytics?.total_admins ?? "—"}</p>
                        </div>
                    </div>

                    <h3 style={{ margin: "var(--spacing-xl) 0 var(--spacing-md)" }}>{t("admin.farmerTable", "Registered Farmers")}</h3>
                    <FarmerTable farmers={farmers.slice(0, 8)} t={t} />
                    {farmers.length > 8 && (
                        <button className="btn btn-secondary" onClick={() => setTab("farmers")} style={{ marginTop: "var(--spacing-sm)" }}>
                            {t("dash.viewMore", "View Details")} ({farmers.length})
                        </button>
                    )}
                </motion.div>
            )}

            {/* ── Farmers ── */}
            {tab === "farmers" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <h3 style={{ marginBottom: "var(--spacing-md)" }}>{t("admin.farmerTable", "Registered Farmers")}</h3>
                    <FarmerTable farmers={farmers} t={t} />
                    {farmers.length === 0 && (
                        <div className="card flex-center" style={{ padding: "3rem" }}>
                            <Users size={40} color="var(--color-text-muted)" />
                            <p style={{ color: "var(--color-text-muted)" }}>{t("admin.noFarmers", "No farmers registered yet")}</p>
                        </div>
                    )}
                </motion.div>
            )}

            {/* ── Announcements ── */}
            {tab === "announcements" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    {!formOpen && (
                        <button className="btn btn-primary" onClick={openNewForm} style={{ marginBottom: "var(--spacing-lg)" }}>
                            <Plus size={16} /> {t("admin.newAnnouncement", "New Announcement")}
                        </button>
                    )}

                    {formOpen && (
                        <div className="card" style={{ padding: "var(--spacing-lg)", marginBottom: "var(--spacing-lg)" }}>
                            <h3 style={{ marginBottom: "var(--spacing-md)" }}>
                                {editingId ? t("admin.editAnnouncement", "Edit Announcement") : t("admin.newAnnouncement", "New Announcement")}
                            </h3>
                            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-md)" }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">{t("admin.annTitle", "Title")} *</label>
                                    <input className="form-input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">{t("admin.annContent", "Content")} *</label>
                                    <textarea className="form-input" rows={4} value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} />
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--spacing-md)" }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">{t("admin.annBenefit", "Benefit")}</label>
                                        <input className="form-input" value={form.benefit} onChange={(e) => setForm((f) => ({ ...f, benefit: e.target.value }))} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">{t("admin.annEligibility", "Eligibility")}</label>
                                        <input className="form-input" value={form.eligibility} onChange={(e) => setForm((f) => ({ ...f, eligibility: e.target.value }))} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">{t("admin.annWhereToApply", "Where to Apply")}</label>
                                        <input className="form-input" value={form.where_to_apply} onChange={(e) => setForm((f) => ({ ...f, where_to_apply: e.target.value }))} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">{t("admin.annOfficialLink", "Official Link")}</label>
                                        <input className="form-input" value={form.official_link} onChange={(e) => setForm((f) => ({ ...f, official_link: e.target.value }))} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">{t("admin.annStatus", "Scheme Status")}</label>
                                        <select className="form-select" value={form.scheme_status} onChange={(e) => setForm((f) => ({ ...f, scheme_status: e.target.value }))}>
                                            <option value="active">{t("admin.statusActive", "Active")}</option>
                                            <option value="discontinued">{t("admin.statusDiscontinued", "Discontinued")}</option>
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">{t("admin.annImage", "Image (optional)")}</label>
                                        <input
                                            className="form-input"
                                            type="file"
                                            accept="image/jpeg,image/png,image/jpg,image/webp"
                                            onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                                        />
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: "0.75rem" }}>
                                    <button className="btn btn-primary" type="submit" disabled={saving}>
                                        {saving ? <><RefreshCw size={16} className="spin" /> ...</> : <><Check size={16} /> {editingId ? t("admin.update", "Update") : t("admin.post", "Post")}</>}
                                    </button>
                                    <button type="button" className="btn btn-secondary" onClick={() => { setFormOpen(false); setError(""); }}>
                                        <X size={16} /> {t("admin.cancel", "Cancel")}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {announcements.length === 0 ? (
                        <div className="card flex-center" style={{ padding: "3rem", flexDirection: "column", gap: "0.5rem" }}>
                            <Megaphone size={40} color="var(--color-text-muted)" />
                            <p style={{ color: "var(--color-text-muted)" }}>{t("admin.emptyAnnouncements", "No announcements yet. Post the first one!")}</p>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-md)" }}>
                            {announcements.map((ann) => (
                                <div key={ann.id} className="card" style={{ padding: "var(--spacing-lg)" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--spacing-md)", flexWrap: "wrap" }}>
                                        <div style={{ flex: 1, minWidth: "220px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "0.35rem" }}>
                                                <span style={{
                                                    fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase",
                                                    padding: "0.2rem 0.6rem", borderRadius: "var(--radius-full)",
                                                    background: ann.scheme_status === "discontinued" ? "rgba(217,83,79,0.12)" : "rgba(92,184,92,0.12)",
                                                    color: ann.scheme_status === "discontinued" ? "var(--color-danger)" : "var(--color-success)",
                                                }}>
                                                    {ann.scheme_status === "discontinued" ? t("admin.statusDiscontinued", "Discontinued") : t("admin.statusActive", "Active")}
                                                </span>
                                                {ann.created_at && <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>{new Date(ann.updated_at || ann.created_at).toLocaleDateString()}</span>}
                                            </div>
                                            <h4 style={{ fontSize: "1.05rem", marginBottom: "0.3rem" }}>{ann.title}</h4>
                                            <p style={{ fontSize: "0.9rem", color: "var(--color-text-muted)", whiteSpace: "pre-wrap" }}>{ann.content}</p>
                                        </div>
                                        <div style={{ display: "flex", gap: "0.5rem" }}>
                                            <button className="btn btn-secondary" onClick={() => openEditForm(ann)} style={{ padding: "0.4rem 0.9rem", fontSize: "0.85rem" }}>
                                                <Pencil size={14} /> {t("admin.editAnnouncement", "Edit")}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </motion.div>
            )}

            {/* ── Market data ── */}
            {tab === "market" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="card" style={{ padding: "var(--spacing-lg)", marginBottom: "var(--spacing-lg)" }}>
                        <h3 style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "0.35rem" }}>
                            <Database size={20} color="var(--color-primary)" /> {t("admin.marketUploadTitle", "Upload Market Dataset")}
                        </h3>
                        <p className="read-me" style={{ fontSize: "0.88rem", color: "var(--color-text-muted)", marginBottom: "var(--spacing-md)" }}>
                            {t("admin.marketUploadNote", "Upload a CSV of AGMARKNET market prices. The system parses and stores the records.")}
                        </p>
                        <form onSubmit={handleUpload} style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
                            <input
                                type="file"
                                accept=".csv,text/csv"
                                className="form-input"
                                style={{ flex: 1, minWidth: "220px" }}
                                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                            />
                            <button className="btn btn-primary" type="submit" disabled={uploading}>
                                {uploading ? <><RefreshCw size={16} className="spin" /> {t("admin.uploading", "Uploading...")}</> : <><Upload size={16} /> {t("admin.upload", "Upload")}</>}
                            </button>
                            <button type="button" className="btn btn-secondary" onClick={handleSync} disabled={syncing}>
                                <RefreshCw size={15} className={syncing ? "spin" : ""} /> AGMARKNET
                            </button>
                        </form>
                    </div>

                    <div className="card" style={{ padding: "var(--spacing-lg)" }}>
                        <h4 style={{ marginBottom: "var(--spacing-md)" }}>{t("admin.uploadStatus", "Upload Status")}</h4>
                        <div className="grid grid-cols-2" style={{ maxWidth: "420px" }}>
                            <div className="stat-pill">
                                <p style={{ fontSize: "0.82rem", color: "var(--color-text-muted)" }}>{t("admin.lastUploaded", "Last uploaded")}</p>
                                <p className="stat-val" style={{ fontSize: "1.1rem" }}>
                                    {uploadStatus?.last_upload_at ? new Date(uploadStatus.last_upload_at).toLocaleDateString() : t("admin.never", "Never")}
                                </p>
                            </div>
                            <div className="stat-pill">
                                <p style={{ fontSize: "0.82rem", color: "var(--color-text-muted)" }}>{t("admin.recordsImported", "Records imported")}</p>
                                <p className="stat-val" style={{ fontSize: "1.1rem" }}>{uploadStatus?.total_records ?? uploadStatus?.records ?? "—"}</p>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}

            <style>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}

function FarmerTable({ farmers, t }) {
    if (farmers.length === 0) {
        return (
            <div className="card flex-center" style={{ padding: "3rem" }}>
                <Users size={40} color="var(--color-text-muted)" />
                <p style={{ color: "var(--color-text-muted)" }}>{t("admin.noFarmers", "No farmers registered yet")}</p>
            </div>
        );
    }
    return (
        <div className="data-table-wrapper">
            <table className="data-table">
                <thead>
                    <tr>
                        <th>{t("admin.colUsername", "Username")}</th>
                        <th>{t("admin.colPhone", "Phone")}</th>
                        <th>{t("admin.colState", "State")}</th>
                        <th>Joined</th>
                    </tr>
                </thead>
                <tbody>
                    {farmers.map((f, i) => (
                        <tr key={f.username || i} className="read-me">
                            <td style={{ fontWeight: 500 }}>{f.username}</td>
                            <td>{f.phone || "—"}</td>
                            <td>{[f.village, f.city, f.state].filter(Boolean).join(", ") || "—"}</td>
                            <td>{f.created_at ? new Date(f.created_at).toLocaleDateString() : "—"}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
