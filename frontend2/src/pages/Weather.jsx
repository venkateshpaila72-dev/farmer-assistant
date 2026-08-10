import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { getFarmerWeather, getCurrentSeason } from "../api/weather";
import {
    CloudSun, Thermometer, Droplets, Wind, Eye, Gauge, Sun, CloudRain, AlertTriangle
} from "lucide-react";

export default function Weather() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [weather, setWeather] = useState(null);
    const [season, setSeason] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.username) return;
        Promise.all([
            getFarmerWeather(user.username),
            getCurrentSeason(),
        ])
            .then(([w, s]) => { setWeather(w); setSeason(s); })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [user?.username]);

    if (loading) {
        return (
            <div className="container flex-center" style={{ minHeight: "50vh" }}>
                <p style={{ color: "var(--color-text-muted)" }}>Loading weather data...</p>
            </div>
        );
    }

    const current = weather?.current;
    const forecast = weather?.forecast || [];
    const alerts = weather?.alerts || [];
    const advisory = weather?.advisory;

    const stats = current ? [
        { icon: Thermometer, label: t("weather.temperature", "Temperature"), value: `${Math.round(current.temperature)}°C`, color: "#e74c3c" },
        { icon: Droplets, label: t("weather.humidity", "Humidity"), value: `${current.humidity}%`, color: "#3498db" },
        { icon: Wind, label: t("weather.wind", "Wind Speed"), value: `${current.windspeed} km/h`, color: "#2ecc71" },
        { icon: Eye, label: t("weather.visibility", "UV Index"), value: current.uv_index ?? "—", color: "#f39c12" },
        { icon: Gauge, label: t("weather.pressure", "Pressure"), value: `${current.pressure || "—"} hPa`, color: "#9b59b6" },
        { icon: CloudRain, label: t("weather.rain", "Precipitation"), value: `${current.precipitation || 0} mm`, color: "#1abc9c" },
    ] : [];

    return (
        <div className="container" style={{ padding: "var(--spacing-lg) var(--spacing-md)" }}>
            <div className="page-header" style={{ borderRadius: "var(--radius-md)", marginBottom: "var(--spacing-xl)" }}>
                <h1 style={{ color: "white", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                    <CloudSun size={30} /> {t("weather.title", "Weather Station")}
                </h1>
                {season && <p style={{ opacity: 0.8 }}>{t("weather.season", "Current Season")}: {season.season} ({season.months})</p>}
            </div>

            {/* Alerts */}
            {alerts.map((a, i) => (
                <div key={i} className="alert-banner read-me"><AlertTriangle size={18} /> {a}</div>
            ))}

            {/* Current overview */}
            {current && (
                <motion.div
                    className="weather-widget read-me"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ marginBottom: "var(--spacing-xl)" }}
                >
                    <div className="weather-main">
                        <div>
                            <div className="weather-temp">{Math.round(current.temperature)}°C</div>
                            <p style={{ fontSize: "1.15rem", marginTop: "0.25rem" }}>{current.description}</p>
                        </div>
                        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                            {stats.slice(1, 4).map((s, i) => {
                                const Icon = s.icon;
                                return (
                                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                        <Icon size={16} /> <span style={{ fontSize: "0.9rem" }}>{s.label}: {s.value}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Stats grid */}
            <div className="grid grid-cols-3" style={{ marginBottom: "var(--spacing-xl)" }}>
                {stats.map((s, i) => {
                    const Icon = s.icon;
                    return (
                        <motion.div
                            key={i}
                            className="card read-me"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.05 * i }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <div style={{
                                    width: "40px", height: "40px", borderRadius: "var(--radius-sm)",
                                    background: `${s.color}15`, display: "flex", alignItems: "center", justifyContent: "center",
                                }}>
                                    <Icon size={20} color={s.color} />
                                </div>
                                <div>
                                    <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>{s.label}</p>
                                    <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--color-primary-dark)" }}>{s.value}</p>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* 5-Day Forecast */}
            {forecast.length > 0 && (
                <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                    <h3 style={{ marginBottom: "var(--spacing-md)" }}>{t("weather.forecast", "5-Day Forecast")}</h3>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--spacing-sm)", overflowX: "auto" }}>
                        {forecast.slice(0, 5).map((day, i) => (
                            <div key={i} className="read-me" style={{
                                flex: 1, textAlign: "center", padding: "1rem 0.75rem",
                                borderRadius: "var(--radius-sm)",
                                background: "var(--color-bg-base)",
                                minWidth: "100px",
                            }}>
                                <p style={{ fontWeight: 600, marginBottom: "0.35rem", fontSize: "0.9rem" }}>{day.day || `Day ${i + 1}`}</p>
                                <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--color-primary-dark)" }}>{Math.round(day.max_temp)}°</p>
                                <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>{Math.round(day.min_temp)}°</p>
                                {day.precipitation > 0 && (
                                    <p style={{ fontSize: "0.75rem", color: "#3498db", marginTop: "0.25rem" }}>
                                        <Droplets size={12} style={{ verticalAlign: "middle" }} /> {day.precipitation}mm
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Advisory */}
            {advisory && (
                <motion.div className="card read-me" style={{ marginTop: "var(--spacing-lg)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                    <h3 style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "0.5rem" }}>
                        <Sun size={20} color="var(--color-accent)" />
                        {t("weather.advisory", "Farming Advisory")}
                    </h3>
                    <p style={{ color: "var(--color-text-muted)", lineHeight: 1.7, whiteSpace: "pre-line" }}>
                        {typeof advisory === "string" ? advisory : JSON.stringify(advisory)}
                    </p>
                </motion.div>
            )}
        </div>
    );
}
