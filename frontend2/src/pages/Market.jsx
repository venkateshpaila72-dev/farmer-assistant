import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { getPrices, getAvailableStates, getFarmerPrices } from "../api/market";
import { ShoppingCart, Search, MapPin, TrendingUp } from "lucide-react";

export default function Market() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [prices, setPrices] = useState([]);
    const [farmerPrices, setFarmerPrices] = useState([]);
    const [states, setStates] = useState([]);
    const [filter, setFilter] = useState({ state: "", commodity: "" });
    const [loading, setLoading] = useState(false);
    const [tab, setTab] = useState("my"); // my | browse

    useEffect(() => {
        getAvailableStates().then((d) => setStates(d.states || d || [])).catch(() => { });
        if (user?.username) {
            getFarmerPrices(user.username).then((d) => setFarmerPrices(d.prices || [])).catch(() => { });
        }
    }, [user?.username]);

    const searchPrices = async () => {
        setLoading(true);
        try {
            const d = await getPrices({ state: filter.state, commodity: filter.commodity, limit: 50 });
            setPrices(d.prices || d || []);
        } catch {
            setPrices([]);
        }
        setLoading(false);
    };

    // /market/farmer/{username} returns prices as { crop: { records, district } }
    const farmerRows = Object.entries(farmerPrices?.prices || {}).flatMap(([crop, data]) =>
        (data?.records || []).map((r) => ({ ...r, crop, _district: data.district }))
    );
    const displayPrices = tab === "my" ? farmerRows : prices;

    return (
        <div className="container" style={{ padding: "var(--spacing-lg) var(--spacing-md)" }}>
            <div className="page-header" style={{ borderRadius: "var(--radius-md)", marginBottom: "var(--spacing-xl)" }}>
                <h1 style={{ color: "white", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                    <ShoppingCart size={30} /> {t("market.title", "Mandi Market Prices")}
                </h1>
                <p style={{ opacity: 0.8 }}>{t("market.subtitle", "Live AGMARKNET prices from across India")}</p>
            </div>

            {/* Tab Toggle */}
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "var(--spacing-lg)" }}>
                <button className={`btn ${tab === "my" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab("my")}>
                    <MapPin size={16} /> {t("market.myCrops", "My Crops")}
                </button>
                <button className={`btn ${tab === "browse" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab("browse")}>
                    <Search size={16} /> {t("market.browse", "Browse All")}
                </button>
            </div>

            {/* Search Filters (Browse tab) */}
            {tab === "browse" && (
                <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginBottom: "var(--spacing-lg)" }}>
                    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
                        <div className="form-group" style={{ flex: 1, minWidth: "160px", marginBottom: 0 }}>
                            <label className="form-label">{t("market.state", "State")}</label>
                            <select className="form-select" value={filter.state} onChange={(e) => setFilter((f) => ({ ...f, state: e.target.value }))}>
                                <option value="">{t("market.allStates", "All States")}</option>
                                {states.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="form-group" style={{ flex: 1, minWidth: "160px", marginBottom: 0 }}>
                            <label className="form-label">{t("market.commodity", "Commodity")}</label>
                            <input className="form-input" placeholder={t("market.commodityPlaceholder", "e.g. Rice, Wheat")} value={filter.commodity} onChange={(e) => setFilter((f) => ({ ...f, commodity: e.target.value }))} />
                        </div>
                        <button className="btn btn-primary" onClick={searchPrices} disabled={loading}>
                            <Search size={16} /> {loading ? "..." : t("market.search", "Search")}
                        </button>
                    </div>
                </motion.div>
            )}

            {/* Price Table */}
            {displayPrices.length > 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>{t("market.commodity", "Commodity")}</th>
                                    <th>{t("market.market", "Market")}</th>
                                    <th>{t("market.stateName", "State")}</th>
                                    <th>{t("market.minPrice", "Min ₹")}</th>
                                    <th>{t("market.maxPrice", "Max ₹")}</th>
                                    <th>{t("market.modalPrice", "Modal ₹")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayPrices.map((p, i) => (
                                    <tr key={i} className="read-me">
                                        <td style={{ fontWeight: 500, textTransform: "capitalize" }}>
                                            {p.crop ? p.crop.replace(/_/g, " ") : p.commodity}
                                            {p._district === "statewide" && (
                                                <span style={{ fontSize: "0.72rem", color: "var(--color-text-muted)", marginLeft: "6px" }}>(state)</span>
                                            )}
                                        </td>
                                        <td>{p.market || p.district || "—"}</td>
                                        <td>{p.state || "—"}</td>
                                        <td>{p.min_price || "—"}</td>
                                        <td>{p.max_price || "—"}</td>
                                        <td style={{ fontWeight: 600, color: "var(--color-primary)" }}>{p.modal_price || "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            ) : (
                <div className="card flex-center" style={{ padding: "3rem", flexDirection: "column", gap: "0.75rem" }}>
                    <TrendingUp size={40} color="var(--color-text-muted)" />
                    <p style={{ color: "var(--color-text-muted)" }}>
                        {tab === "my" ? t("market.noFarmerPrices", "No prices for your crops yet") : t("market.noResults", "Search for market prices above")}
                    </p>
                </div>
            )}
        </div>
    );
}
