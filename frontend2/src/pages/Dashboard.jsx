import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { getFarmerWeather } from "../api/weather";
import { getFarmerPrices } from "../api/market";
import { getOnboardingProfile } from "../api/onboarding";
import {
    CloudSun, ShoppingCart, Scan, FlaskConical, MessageCircle,
    Thermometer, Droplets, Wind, Eye, ArrowRight, Sprout, AlertTriangle
} from "lucide-react";

const quickTools = [
    { to: "/crop-tools", icon: FlaskConical, labelKey: "dash.cropTools", color: "#5cb85c" },
    { to: "/vision", icon: Scan, labelKey: "dash.visionTools", color: "#5a7cb5" },
    { to: "/chat", icon: MessageCircle, labelKey: "dash.chat", color: "#7b5ea7" },
    { to: "/market", icon: ShoppingCart, labelKey: "dash.market", color: "#8c6239" },
];

const card = (delay) => ({
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.4 },
});

export default function Dashboard() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [weather, setWeather] = useState(null);
    const [prices, setPrices] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loadingW, setLoadingW] = useState(true);
    const [loadingP, setLoadingP] = useState(true);

    useEffect(() => {
        if (!user?.username) return;

        getFarmerWeather(user.username)
            .then(setWeather)
            .catch(() => { })
            .finally(() => setLoadingW(false));

        getFarmerPrices(user.username)
            .then(setPrices)
            .catch(() => { })
            .finally(() => setLoadingP(false));

        getOnboardingProfile(user.username)
            .then(setProfile)
            .catch(() => { });
    }, [user?.username]);

    const weatherData = weather?.current;
    const forecast = weather?.forecast?.slice(0, 5) || [];
    const alerts = weather?.alerts || [];
    // /market/farmer/{username} returns prices as { crop: { records, district } }
    const priceList = Object.entries(prices?.prices || {}).slice(0, 6);

    return (
        <div className="container" style={{ padding: "var(--spacing-lg) var(--spacing-md)" }}>
            {/* Welcome Header */}
            <motion.div {...card(0)}>
                <div style={{ marginBottom: "var(--spacing-xl)" }}>
                    <h1 style={{ fontSize: "var(--font-size-2xl)", display: "flex", alignItems: "center", gap: "8px" }}>
                        <Sprout size={28} />
                        <span className="read-me">{t("dash.welcome", { name: user?.username }, `Welcome, ${user?.username}!`)}</span>
                    </h1>
                    {profile && (
                        <p className="text-subtitle read-me">
                            {profile.preferred_crops?.join(", ")} · {profile.soil_type} · {profile.farm_acres} acres
                        </p>
                    )}
                </div>
            </motion.div>

            {/* Alerts */}
            {alerts.length > 0 && (
                <motion.div {...card(0.1)}>
                    {alerts.map((alert, i) => (
                        <div key={i} className="alert-banner read-me">
                            <AlertTriangle size={18} />
                            {alert}
                        </div>
                    ))}
                </motion.div>
            )}

            <div className="grid grid-cols-2" style={{ gap: "var(--spacing-lg)" }}>
                {/* Weather Card */}
                <motion.div {...card(0.15)}>
                    <div className="weather-widget read-me">
                        <div className="card-title" style={{ color: "white" }}>
                            <CloudSun size={22} />
                            {t("dash.weather", "Weather")}
                        </div>
                        {loadingW ? (
                            <p style={{ opacity: 0.7, marginTop: "1rem" }}>Loading weather...</p>
                        ) : weatherData ? (
                            <>
                                <div className="weather-main">
                                    <div className="weather-temp">{Math.round(weatherData.temperature || 0)}°</div>
                                    <div>
                                        <p style={{ fontSize: "1.1rem", fontWeight: 500 }}>
                                            {Number(weatherData.weather_code) === 0 ? "Clear" :
                                                Number(weatherData.weather_code) <= 3 ? "Cloudy" :
                                                Number(weatherData.weather_code) >= 51 && Number(weatherData.weather_code) <= 67 ? "Rain" :
                                                Number(weatherData.weather_code) >= 95 ? "Storm" : "—"}
                                        </p>
                                        <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem", opacity: 0.8, fontSize: "0.9rem" }}>
                                            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                                <Droplets size={14} /> {weatherData.humidity || 0}%
                                            </span>
                                            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                                <Wind size={14} /> {weatherData.wind_speed || 0} km/h
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                {forecast.length > 0 && (
                                    <div className="weather-forecast">
                                        {forecast.map((day, i) => (
                                            <div key={i} className="forecast-day">
                                                <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>
                                                    {day.date ? new Date(day.date).toLocaleDateString(undefined, { weekday: "short" }) : `Day ${i + 1}`}
                                                </span>
                                                <span style={{ fontSize: "1.1rem", fontWeight: 600 }}>{Math.round(day.temp_max || 0)}°</span>
                                                <span style={{ fontSize: "0.8rem", opacity: 0.6 }}>{Math.round(day.temp_min || 0)}°</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            <p style={{ opacity: 0.7, marginTop: "1rem" }}>Weather data unavailable</p>
                        )}
                        <Link to="/weather" style={{ color: "white", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "4px", marginTop: "1rem", opacity: 0.8 }}>
                            {t("dash.viewMore", "View Details")} <ArrowRight size={14} />
                        </Link>
                    </div>
                </motion.div>

                {/* Market Prices Card */}
                <motion.div {...card(0.25)}>
                    <div className="card read-me" style={{ height: "100%" }}>
                        <div className="card-title">
                            <ShoppingCart size={20} />
                            {t("dash.mandiPrices", "Mandi Prices")}
                        </div>
                        {loadingP ? (
                            <p style={{ color: "var(--color-text-muted)", marginTop: "0.5rem" }}>Loading prices...</p>
                        ) : priceList.length > 0 ? (
                            <div style={{ marginTop: "0.75rem" }}>
                                {priceList.map(([crop, data], i) => {
                                    const latest = data?.records?.[0];
                                    return (
                                        <div key={crop} style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            padding: "0.5rem 0",
                                            borderBottom: i < priceList.length - 1 ? "1px solid var(--color-border)" : "none",
                                            fontSize: "0.9rem",
                                        }}>
                                            <span style={{ fontWeight: 500, textTransform: "capitalize" }}>
                                                {crop.replace(/_/g, " ")}
                                                {data?.district === "statewide" && (
                                                    <span style={{ fontSize: "0.72rem", color: "var(--color-text-muted)", marginLeft: "6px" }}>(state)</span>
                                                )}
                                            </span>
                                            <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>
                                                {latest ? `₹${Math.round(latest.modal_price || latest.max_price || 0).toLocaleString("en-IN")}/q` : "—"}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p style={{ color: "var(--color-text-muted)", marginTop: "0.5rem" }}>No price data available</p>
                        )}
                        <Link to="/market" style={{ fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "4px", marginTop: "1rem" }}>
                            {t("dash.viewMore", "View Details")} <ArrowRight size={14} />
                        </Link>
                    </div>
                </motion.div>
            </div>

            {/* Quick Tools */}
            <motion.div {...card(0.35)} style={{ marginTop: "var(--spacing-xl)" }}>
                <h2 style={{ marginBottom: "var(--spacing-md)" }}>{t("dash.quickTools", "Quick Tools")}</h2>
                <div className="grid grid-cols-4">
                    {quickTools.map((tool, i) => {
                        const Icon = tool.icon;
                        return (
                            <Link key={tool.to} to={tool.to} className="card read-me" style={{ textDecoration: "none", textAlign: "center", padding: "1.5rem 1rem" }}>
                                <div style={{
                                    width: "56px", height: "56px", borderRadius: "var(--radius-md)",
                                    background: `${tool.color}15`,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    margin: "0 auto var(--spacing-sm)",
                                }}>
                                    <Icon size={26} color={tool.color} />
                                </div>
                                <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                                    {t(tool.labelKey, tool.labelKey.split(".").pop())}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </motion.div>
        </div>
    );
}
