import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { getFarmerWeather, getCurrentSeason } from "../api/weather";
import {
    CloudSun, Thermometer, Droplets, Wind, Sun, CloudRain,
    Cloud, Cloudy, CloudFog, CloudLightning, CloudSnow, AlertTriangle, Droplet
} from "lucide-react";

// WMO weather code → short description (translated by the caller via i18n)
function weatherLabel(code, t) {
    const c = Number(code);
    if (c === 0) return t("weather.codeClear", "Clear sky");
    if (c <= 2) return t("weather.codePartly", "Partly cloudy");
    if (c === 3) return t("weather.codeCloudy", "Overcast");
    if (c === 45 || c === 48) return t("weather.codeFog", "Fog");
    if (c >= 51 && c <= 57) return t("weather.codeDrizzle", "Drizzle");
    if (c >= 61 && c <= 67) return t("weather.codeRain", "Rain");
    if (c >= 71 && c <= 77) return t("weather.codeSnow", "Snow");
    if (c >= 80 && c <= 82) return t("weather.codeShowers", "Rain showers");
    if (c >= 95) return t("weather.codeStorm", "Thunderstorm");
    return t("weather.codeUnknown", "—");
}

function weatherIcon(code) {
    const c = Number(code);
    if (c === 0) return Sun;
    if (c <= 3) return CloudSun;
    if (c === 45 || c === 48) return CloudFog;
    if (c >= 51 && c <= 67) return CloudRain;
    if (c >= 71 && c <= 77) return CloudSnow;
    if (c >= 80 && c <= 82) return CloudRain;
    if (c >= 95) return CloudLightning;
    return Cloud;
}

const ALERT_KEYS = {
    extreme_heat: "dashboardHome.weatherAlert.extreme_heat",
    frost_risk: "dashboardHome.weatherAlert.frost_risk",
    heavy_rainfall: "dashboardHome.weatherAlert.heavy_rainfall",
    high_humidity: "dashboardHome.weatherAlert.high_humidity",
};

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
    const location = weather?.location;

    const stats = current ? [
        { icon: Thermometer, label: t("weather.temperature", "Temperature"), value: `${Math.round(current.temperature)}°C`, color: "#e74c3c" },
        { icon: Droplets, label: t("weather.humidity", "Humidity"), value: `${current.humidity}%`, color: "#3498db" },
        { icon: Wind, label: t("weather.wind", "Wind Speed"), value: `${current.wind_speed ?? 0} km/h`, color: "#2ecc71" },
        { icon: CloudRain, label: t("weather.rain", "Precipitation"), value: `${current.precipitation || 0} mm`, color: "#1abc9c" },
        { icon: Droplet, label: t("weather.soilMoisture", "Soil Moisture"), value: weather?.soil_moisture != null ? weather.soil_moisture : "—", color: "#9b59b6" },
        { icon: Cloud, label: t("weather.condition", "Condition"), value: weatherLabel(current.weather_code, t), color: "#f39c12" },
    ] : [];

    const CurrentIcon = weatherIcon(current?.weather_code);

    return (
        <div className="container" style={{ padding: "var(--spacing-lg) var(--spacing-md)" }}>
            <div className="page-header" style={{ borderRadius: "var(--radius-md)", marginBottom: "var(--spacing-xl)" }}>
                <h1 style={{ color: "white", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                    <CloudSun size={30} /> {t("weather.title", "Weather Station")}
                </h1>
                <p style={{ opacity: 0.8 }}>
                    {season ? `${t("weather.season", "Current Season")}: ${season.season} (${season.months || ""})` : ""}
                    {location?.state && ` · ${location.state}${location.district ? `, ${location.district}` : ""}`}
                </p>
            </div>

            {/* Alerts */}
            {alerts.map((a, i) => (
                <div key={i} className="alert-banner read-me">
                    <AlertTriangle size={18} />
                    {t(ALERT_KEYS[a] || a, a)}
                </div>
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
                            <p style={{ fontSize: "1.15rem", marginTop: "0.25rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                                <CurrentIcon size={22} />
                                {weatherLabel(current.weather_code, t)}
                            </p>
                        </div>
                        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "0.9rem" }}>
                                <Droplets size={15} /> {t("weather.humidity", "Humidity")}: {current.humidity}%
                            </span>
                            <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "0.9rem" }}>
                                <Wind size={15} /> {t("weather.wind", "Wind")}: {current.wind_speed ?? 0} km/h
                            </span>
                            <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "0.9rem" }}>
                                <CloudRain size={15} /> {t("weather.rain", "Rain")}: {current.precipitation || 0} mm
                            </span>
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
                                    <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--color-primary-dark)" }}>{s.value}</p>
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
                        {forecast.slice(0, 5).map((day, i) => {
                            const Icon = weatherIcon(day.weather_code);
                            return (
                                <div key={i} className="read-me" style={{
                                    flex: 1, textAlign: "center", padding: "1rem 0.75rem",
                                    borderRadius: "var(--radius-sm)",
                                    background: "var(--color-bg-base)",
                                    minWidth: "100px",
                                }}>
                                    <p style={{ fontWeight: 600, marginBottom: "0.35rem", fontSize: "0.9rem" }}>
                                        {day.date ? new Date(day.date).toLocaleDateString(undefined, { weekday: "short" }) : `Day ${i + 1}`}
                                    </p>
                                    <Icon size={22} color="var(--color-primary-light)" style={{ margin: "0 auto 0.3rem", display: "block" }} />
                                    <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--color-primary-dark)" }}>{Math.round(day.temp_max)}°</p>
                                    <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>{Math.round(day.temp_min)}°</p>
                                    {day.precipitation > 0 && (
                                        <p style={{ fontSize: "0.75rem", color: "#3498db", marginTop: "0.25rem" }}>
                                            <Droplets size={12} style={{ verticalAlign: "middle" }} /> {day.precipitation}mm
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </motion.div>
            )}

            {/* Soil moisture note */}
            {weather?.soil_moisture != null && (
                <motion.div className="card read-me" style={{ marginTop: "var(--spacing-lg)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                    <h3 style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "0.5rem" }}>
                        <Droplet size={20} color="var(--color-primary)" />
                        {t("weather.soilMoisture", "Soil Moisture")}
                    </h3>
                    <p style={{ color: "var(--color-text-muted)", lineHeight: 1.7 }}>
                        {weather.soil_moisture < 0.15
                            ? t("weather.soilDry", "Soil is quite dry — consider irrigation.")
                            : weather.soil_moisture < 0.3
                                ? t("weather.soilModerate", "Soil moisture is moderate. Good time for fertilizer application.")
                                : t("weather.soilWet", "Soil moisture is good. Ideal growing conditions.")}
                    </p>
                </motion.div>
            )}
        </div>
    );
}
