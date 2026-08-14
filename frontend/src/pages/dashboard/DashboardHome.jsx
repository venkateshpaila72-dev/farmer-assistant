import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { AlertTriangle, Leaf, ScanLine, MessageSquare, LineChart, ArrowRight, Droplets, Sun, CloudRain, Wind } from "lucide-react";
import { Panel } from "../../components/ui/Panel";
import { Plot } from "../../components/ui/Plot";
import { Ledger, LedgerRow } from "../../components/ui/Ledger";
import { Skeleton } from "../../components/ui/Skeleton";
import { RevealOnScroll } from "../../components/motion/RevealOnScroll";
import { useAuth } from "../../context/AuthContext";
import { getOnboardingProfile } from "../../api/onboarding";
import { getFarmerWeather } from "../../api/weather";
import { getFarmerPrices } from "../../api/market";
import { getFarmerNews } from "../../api/news";
import { translateCropName } from "../../utils/cropNameLabel";

// Picks a mood for the weather card from temperature + humidity, each with
// its own gradient, animated icon, and small floating accent shapes —
// purely decorative (no new data), just makes the "Today" card feel alive
// instead of a flat number.
function weatherMood(temp, humidity) {
  if (humidity >= 70) {
    return {
      gradient: "from-sky-500 to-cyan-600",
      Icon: CloudRain,
      accent: "text-sky-100",
    };
  }
  if (temp >= 32) {
    return {
      gradient: "from-orange-400 to-amber-600",
      Icon: Sun,
      accent: "text-amber-100",
    };
  }
  return {
    gradient: "from-emerald-500 to-teal-600",
    Icon: Wind,
    accent: "text-emerald-100",
  };
}

function WeatherIcon({ Icon, spin }) {
  return (
    <motion.div
      className="text-white/90"
      animate={spin ? { rotate: 360 } : { y: [0, -5, 0] }}
      transition={
        spin
          ? { duration: 16, repeat: Infinity, ease: "linear" }
          : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
      }
    >
      <Icon size={42} strokeWidth={1.6} />
    </motion.div>
  );
}

function titleCase(name) {
  if (!name) return "";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export default function DashboardHome() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [weather, setWeather] = useState(null);
  const [weatherError, setWeatherError] = useState(false);
  const [prices, setPrices] = useState(null);
  const [pricesError, setPricesError] = useState(false);
  const [news, setNews] = useState(null);
  const [newsError, setNewsError] = useState(false);

  useEffect(() => {
    if (!user?.username) return;
    getOnboardingProfile(user.username).then(setProfile).catch(() => {});
    getFarmerWeather(user.username).then(setWeather).catch(() => setWeatherError(true));
    getFarmerPrices(user.username).then(setPrices).catch(() => setPricesError(true));
    getFarmerNews(user.username).then((data) => setNews(data.articles || [])).catch(() => setNewsError(true));
  }, [user?.username]);

  const priceRows = prices?.prices ? Object.entries(prices.prices) : [];

  // Tones chosen to match the reference design: green for Crop Tools, warm
  // orange for Photo Check, blue for Chat, neutral for Market — each fills
  // solid with white text on hover instead of just a static tint.
  const quickActions = [
    { to: "/crop-tools", icon: Leaf, tone: "crop", titleKey: "sidebar.cropTools", descKey: "dashboardHome.cropToolsDesc" },
    { to: "/vision", icon: ScanLine, tone: "soil", titleKey: "sidebar.vision", descKey: "dashboardHome.visionDesc" },
    { to: "/chat", icon: MessageSquare, tone: "info", titleKey: "sidebar.chat", descKey: "dashboardHome.chatDesc" },
    { to: "/market", icon: LineChart, tone: "plain", titleKey: "sidebar.market", descKey: "dashboardHome.marketDesc" },
  ];

  const displayName = titleCase(profile?.name || user?.username);

  return (
    <div className="relative">
      {/* Ambient page backdrop — your photo, blurred and faded behind a
          cream→green wash so it reads as atmosphere rather than a distinct
          image, matching the reference design's soft backdrop. Fixed so it
          stays put while the page scrolls. */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <img
          src="/dashboard-hero.jpg"
          alt=""
          className="w-full h-full object-cover scale-110 blur-2xl opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-bg/90 via-bg/85 to-accent-tint/70" />
      </div>

      <div className="relative z-[1] max-w-5xl mx-auto px-5 md:px-8 py-6 md:py-10 flex flex-col gap-8">
      {/* Alert banner */}
      {weather?.alerts?.[0] ? (
        <RevealOnScroll className="flex items-start gap-2.5 bg-danger-tint text-danger rounded-sm px-4 py-3 text-sm font-semibold">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          {t(`dashboardHome.weatherAlert.${weather.alerts[0]}`)}
        </RevealOnScroll>
      ) : weather ? (
        <RevealOnScroll className="flex items-start gap-2.5 bg-accent-tint text-accent rounded-sm px-4 py-3 text-sm font-semibold">
          <Leaf size={17} className="mt-0.5 shrink-0" />
          {t("dashboardHome.alertNone")}
        </RevealOnScroll>
      ) : null}

      {/* Welcome hero banner */}
      <RevealOnScroll>
        <div className="relative rounded-lg overflow-hidden h-[220px] md:h-[280px]">
          <motion.img
            src="/dashboard-hero.jpg"
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            initial={{ scale: 1.08 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/25 to-transparent" />
          <div className="relative h-full flex flex-col justify-end p-6 md:p-8">
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="text-2xl md:text-[32px] font-display font-bold text-white"
            >
              {t("dashboardHome.welcomeHeading", { name: displayName })}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-white/85 text-sm md:text-base mt-1.5 max-w-md"
            >
              {t("dashboardHome.welcomeSub")}
            </motion.p>
          </div>
        </div>
      </RevealOnScroll>

      {/* Weather + season + your crop prices */}
      <RevealOnScroll className="grid md:grid-cols-[1fr_1.4fr] gap-4">
        {weather ? (
          (() => {
            const mood = weatherMood(weather.current.temperature, weather.current.humidity);
            return (
              <Panel
                className={`p-5 relative overflow-hidden text-white border-none bg-gradient-to-br ${mood.gradient}`}
              >
                {/* soft floating accent circles, purely decorative */}
                <motion.span
                  className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10"
                  animate={{ scale: [1, 1.12, 1] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.span
                  className="absolute bottom-2 -left-4 w-16 h-16 rounded-full bg-white/10"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
                />

                <div className="relative flex items-start justify-between">
                  <div>
                    <div className={`text-[11px] uppercase tracking-wide mb-2 ${mood.accent}`}>
                      {t("dashboardHome.today")}
                    </div>
                    <div className="font-display text-4xl font-semibold mb-1">
                      {Math.round(weather.current.temperature)}&deg;C
                    </div>
                    <div className={`text-sm mb-4 flex items-center gap-1.5 ${mood.accent}`}>
                      <Droplets size={14} />
                      {t("hero.humidity", { value: weather.current.humidity })}
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-white bg-white/15 rounded-full px-2.5 py-1 w-fit backdrop-blur-sm">
                      {t("dashboardHome.season")}: {weather.season || "\u2014"}
                    </div>
                  </div>
                  <WeatherIcon Icon={mood.Icon} spin={mood.Icon === Sun} />
                </div>
              </Panel>
            );
          })()
        ) : weatherError ? (
          <Panel className="p-5">
            <div className="text-[11px] uppercase tracking-wide text-ink-soft mb-2">{t("dashboardHome.today")}</div>
            <p className="text-sm text-ink-soft">{t("hero.unavailable")}</p>
          </Panel>
        ) : (
          <Panel className="p-5">
            <div className="text-[11px] uppercase tracking-wide text-ink-soft mb-2">{t("dashboardHome.today")}</div>
            <Skeleton className="h-9 w-24 mb-2" />
            <Skeleton className="h-4 w-32 mb-4" />
            <Skeleton className="h-6 w-28 rounded-full" />
          </Panel>
        )}

        <Panel className="p-5">
          <div className="text-[11px] uppercase tracking-wide text-ink-soft mb-3">{t("dashboardHome.yourPrices")}</div>
          {prices ? (
            priceRows.length > 0 ? (
              <Ledger>
                {priceRows.map(([crop, data]) => {
                  const latest = data.records?.[0];
                  const isStatewide = data.district === "statewide";
                  return (
                    <LedgerRow
                      key={crop}
                      icon={Droplets}
                      label={isStatewide ? `${translateCropName(t, crop)} (${t("dashboardHome.statewide")})` : translateCropName(t, crop)}
                      value={latest ? `\u20B9${Math.round(latest.modal_price).toLocaleString("en-IN")}` : "\u2014"}
                    />
                  );
                })}
              </Ledger>
            ) : (
              <p className="text-sm text-ink-soft">{t("dashboardHome.noPrices")}</p>
            )
          ) : pricesError ? (
            <p className="text-sm text-ink-soft">{t("hero.unavailable")}</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-2/3" />
            </div>
          )}
        </Panel>
      </RevealOnScroll>

      {/* Quick actions - each fills with its own color on hover */}
      <div>
        <h2 className="text-sm font-semibold text-ink-soft uppercase tracking-wide mb-3">
          {t("dashboardHome.quickActions")}
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {quickActions.map(({ to, icon: Icon, tone, titleKey, descKey }, i) => (
            <RevealOnScroll key={to} delay={i * 0.05}>
              <Link to={to}>
                <Plot tone={tone} hoverColor className="h-full flex flex-col gap-2.5">
                  <Icon size={22} />
                  <h3 className="font-display font-semibold text-base">{t(titleKey)}</h3>
                  <p className="text-[13.5px] opacity-90">{t(descKey)}</p>
                </Plot>
              </Link>
            </RevealOnScroll>
          ))}
        </div>
      </div>

      {/* Recent news strip */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-ink-soft uppercase tracking-wide">
            {t("dashboardHome.recentNews")}
          </h2>
          <Link to="/news" className="text-xs font-semibold text-primary flex items-center gap-1">
            {t("dashboardHome.viewAll")} <ArrowRight size={13} />
          </Link>
        </div>
        {news === null && !newsError ? (
          <div className="grid sm:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i}>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : newsError || news.length === 0 ? (
          <p className="text-sm text-ink-soft">{t("news.empty")}</p>
        ) : (
          <div className="grid sm:grid-cols-3 gap-4">
            {news.slice(0, 3).map((article, i) => (
              <RevealOnScroll key={article.url || i} delay={i * 0.05}>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[14px] font-medium text-ink hover:text-primary transition-colors leading-snug"
                >
                  {article.title}
                </a>
              </RevealOnScroll>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}