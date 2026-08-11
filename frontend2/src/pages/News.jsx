import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { getFarmerNews, getPestAlerts, getSchemeNews, getPublicAnnouncements } from "../api/news";
import {
    Newspaper, Bug, Landmark, Megaphone, ExternalLink,
    AlertTriangle, RefreshCw, FileText
} from "lucide-react";

function timeAgo(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return "";
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return date.toLocaleDateString();
}

function ArticleCard({ article, t, i }) {
    return (
        <motion.a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="card read-me"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.04, 0.4) }}
            style={{ display: "block", textDecoration: "none", color: "inherit", overflow: "hidden" }}
        >
            <div style={{ display: "flex", gap: "var(--spacing-md)", alignItems: "flex-start" }}>
                {article.image && (
                    <img
                        src={article.image}
                        alt=""
                        loading="lazy"
                        style={{ width: "90px", height: "90px", objectFit: "cover", borderRadius: "var(--radius-sm)", flexShrink: 0 }}
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ fontSize: "0.98rem", lineHeight: 1.45, marginBottom: "0.35rem" }}>{article.title}</h4>
                    <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {article.description}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontWeight: 600 }}>{article.source}</span>
                        <span>·</span>
                        <span>{timeAgo(article.published_at)}</span>
                        <ExternalLink size={12} style={{ marginLeft: "auto" }} />
                    </p>
                </div>
            </div>
        </motion.a>
    );
}

function AlertItem({ alert, i, t }) {
    // Pest alerts may be strings or article objects depending on the source
    if (typeof alert === "string") {
        return (
            <div key={i} className="card read-me" style={{ padding: "var(--spacing-md)", display: "flex", gap: "var(--spacing-sm)", alignItems: "flex-start" }}>
                <AlertTriangle size={18} color="var(--color-warning)" style={{ flexShrink: 0, marginTop: "2px" }} />
                <p style={{ fontSize: "0.92rem" }}>{alert}</p>
            </div>
        );
    }
    return (
        <motion.a
            key={i}
            href={alert.url}
            target="_blank"
            rel="noopener noreferrer"
            className="card read-me"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.04, 0.4) }}
            style={{ display: "block", textDecoration: "none", color: "inherit" }}
        >
            <div style={{ display: "flex", gap: "var(--spacing-sm)", alignItems: "flex-start" }}>
                <AlertTriangle size={18} color="var(--color-warning)" style={{ flexShrink: 0, marginTop: "2px" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ fontSize: "0.95rem", marginBottom: "0.25rem" }}>{alert.title || alert.headline}</h4>
                    {alert.description && <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>{alert.description}</p>}
                    {alert.published_at && (
                        <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "0.4rem" }}>
                            {alert.source || alert.publisher} · {timeAgo(alert.published_at)}
                        </p>
                    )}
                </div>
            </div>
        </motion.a>
    );
}

function AnnouncementCard({ a, t }) {
    return (
        <motion.div className="card read-me" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ overflow: "hidden" }}>
            {a.image_url && <img src={a.image_url} alt="" style={{ width: "100%", maxHeight: "260px", objectFit: "cover" }} />}
            <div style={{ padding: "var(--spacing-lg)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                    <span style={{
                        fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                        padding: "0.2rem 0.6rem", borderRadius: "var(--radius-full)",
                        background: a.scheme_status === "discontinued" ? "rgba(217,83,79,0.12)" : "rgba(92,184,92,0.12)",
                        color: a.scheme_status === "discontinued" ? "var(--color-danger)" : "var(--color-success)",
                    }}>
                        {a.scheme_status === "discontinued" ? t("news.discontinued", "Discontinued") : t("admin.statusActive", "Active")}
                    </span>
                    {a.created_at && <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>{timeAgo(a.updated_at || a.created_at)}</span>}
                </div>
                <h3 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>{a.title}</h3>
                <p style={{ fontSize: "0.92rem", color: "var(--color-text-main)", whiteSpace: "pre-wrap", marginBottom: "var(--spacing-md)" }}>{a.content}</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--spacing-sm)" }}>
                    {a.benefit && (
                        <div style={{ background: "var(--color-bg-base)", padding: "var(--spacing-sm)", borderRadius: "var(--radius-sm)" }}>
                            <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "0.15rem" }}>{t("news.benefit", "Benefit")}</p>
                            <p style={{ fontSize: "0.85rem" }}>{a.benefit}</p>
                        </div>
                    )}
                    {a.eligibility && (
                        <div style={{ background: "var(--color-bg-base)", padding: "var(--spacing-sm)", borderRadius: "var(--radius-sm)" }}>
                            <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "0.15rem" }}>{t("news.eligibility", "Eligibility")}</p>
                            <p style={{ fontSize: "0.85rem" }}>{a.eligibility}</p>
                        </div>
                    )}
                </div>
                {a.where_to_apply && (
                    <p style={{ fontSize: "0.85rem", marginTop: "var(--spacing-sm)" }}>
                        <strong>{t("news.whereToApply", "Where to Apply")}:</strong> {a.where_to_apply}
                    </p>
                )}
                {a.official_link && (
                    <a href={a.official_link} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ marginTop: "var(--spacing-md)", padding: "0.45rem 1rem", fontSize: "0.85rem", display: "inline-flex" }}>
                        {t("news.officialLink", "Official Link")} <ExternalLink size={14} style={{ marginLeft: "6px" }} />
                    </a>
                )}
            </div>
        </motion.div>
    );
}

export default function News() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [tab, setTab] = useState("feed"); // feed | alerts | schemes | announcements
    const [articles, setArticles] = useState([]);
    const [alerts, setAlerts] = useState({ alerts: [], is_live: false, fetched_at: null });
    const [schemes, setSchemes] = useState({ articles: [], is_live: false, fetched_at: null });
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(false);
    const [state, setState] = useState("");

    const loadAll = async () => {
        setLoading(true);
        try {
            const newsData = await getFarmerNews(user.username);
            setArticles(newsData.articles || []);
            setState(newsData.state || "");
        } catch {
            setArticles([]);
        }
        try {
            const a = await getPestAlerts();
            setAlerts(a);
        } catch {
            setAlerts({ alerts: [], is_live: false, fetched_at: null });
        }
        try {
            const s = await getSchemeNews();
            setSchemes(s);
        } catch {
            setSchemes({ articles: [], is_live: false, fetched_at: null });
        }
        try {
            const an = await getPublicAnnouncements();
            setAnnouncements(an.announcements || []);
        } catch {
            setAnnouncements([]);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.username]);

    const tabs = [
        { key: "feed", icon: Newspaper, label: t("news.tabFeed", "News") },
        { key: "alerts", icon: Bug, label: t("news.tabAlerts", "Pest Alerts") },
        { key: "schemes", icon: Landmark, label: t("news.tabSchemes", "Schemes") },
        { key: "announcements", icon: Megaphone, label: t("news.tabAnnouncements", "Announcements") },
    ];

    const isLive = tab === "alerts" ? alerts.is_live : schemes.is_live;
    const fetchedAt = tab === "alerts" ? alerts.fetched_at : schemes.fetched_at;

    return (
        <div className="container" style={{ padding: "var(--spacing-lg) var(--spacing-md)" }}>
            <div className="page-header" style={{ borderRadius: "var(--radius-md)", marginBottom: "var(--spacing-xl)" }}>
                <h1 style={{ color: "white", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                    <Newspaper size={30} /> {t("news.pageTitle", "Farming News")}
                </h1>
                <p style={{ opacity: 0.8 }}>
                    {t("news.pageSubtitle", "News, alerts and schemes for Indian farmers")}
                    {state && ` · ${state}`}
                </p>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "var(--spacing-lg)", flexWrap: "wrap", alignItems: "center" }}>
                {tabs.map((tb) => {
                    const Icon = tb.icon;
                    return (
                        <button key={tb.key} className={`btn ${tab === tb.key ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab(tb.key)}>
                            <Icon size={16} /> {tb.label}
                        </button>
                    );
                })}
                <button className="btn btn-secondary" onClick={loadAll} style={{ marginLeft: "auto" }} disabled={loading}>
                    <RefreshCw size={15} className={loading ? "spin" : ""} /> {t("news.refresh", "Refresh")}
                </button>
            </div>

            {(tab === "alerts" || tab === "schemes") && (fetchedAt || !isLive) && (
                <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginBottom: "var(--spacing-md)", display: "flex", alignItems: "center", gap: "6px" }}>
                    {isLive ? (
                        <><span style={{ color: "var(--color-success)", fontWeight: 600 }}>●</span> {t("news.live", "Live")}</>
                    ) : (
                        <><span style={{ color: "var(--color-warning)", fontWeight: 600 }}>●</span> {t("news.cached", "Saved from last check")}{fetchedAt ? ` · ${t("news.lastChecked", "Last checked")}: ${new Date(fetchedAt).toLocaleString()}` : ""}</>
                    )}
                </p>
            )}

            {loading && <p className="flex-center" style={{ color: "var(--color-text-muted)", padding: "2rem" }}>Loading...</p>}

            {!loading && tab === "feed" && (
                articles.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-md)" }}>
                        {articles.map((a, i) => <ArticleCard key={a.url || i} article={a} t={t} i={i} />)}
                    </div>
                ) : (
                    <div className="card flex-center" style={{ padding: "3rem", flexDirection: "column", gap: "0.5rem" }}>
                        <Newspaper size={40} color="var(--color-text-muted)" />
                        <p style={{ color: "var(--color-text-muted)" }}>{t("news.noNews", "No news articles found right now.")}</p>
                    </div>
                )
            )}

            {!loading && tab === "alerts" && (
                alerts.alerts.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-md)" }}>
                        {alerts.alerts.map((a, i) => <AlertItem key={i} alert={a} i={i} t={t} />)}
                    </div>
                ) : (
                    <div className="card flex-center" style={{ padding: "3rem", flexDirection: "column", gap: "0.5rem" }}>
                        <Bug size={40} color="var(--color-text-muted)" />
                        <p style={{ color: "var(--color-text-muted)" }}>{t("news.noAlerts", "No pest alerts right now")}</p>
                    </div>
                )
            )}

            {!loading && tab === "schemes" && (
                <>
                    {schemes.articles.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-md)" }}>
                            {schemes.articles.map((a, i) => <ArticleCard key={a.url || i} article={a} t={t} i={i} />)}
                        </div>
                    ) : (
                        <div className="card flex-center" style={{ padding: "3rem", flexDirection: "column", gap: "0.5rem" }}>
                            <Landmark size={40} color="var(--color-text-muted)" />
                            <p style={{ color: "var(--color-text-muted)" }}>{t("news.noSchemeNews", "No scheme news right now")}</p>
                        </div>
                    )}
                    <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "var(--spacing-md)" }}>
                        {t("news.schemeNewsDisclaimer", "These are news mentions. For verified scheme details, check the Announcements tab.")}
                    </p>
                </>
            )}

            {!loading && tab === "announcements" && (
                announcements.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-lg)" }}>
                        {announcements.map((a) => <AnnouncementCard key={a.id} a={a} t={t} />)}
                    </div>
                ) : (
                    <div className="card flex-center" style={{ padding: "3rem", flexDirection: "column", gap: "0.5rem" }}>
                        <Megaphone size={40} color="var(--color-text-muted)" />
                        <p style={{ color: "var(--color-text-muted)" }}>{t("news.noAnnouncements", "No announcements yet")}</p>
                    </div>
                )
            )}

            <style>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
