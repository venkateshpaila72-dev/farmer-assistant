import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Leaf, ScanLine, MessageSquare, LineChart, ArrowRight, Droplets } from "lucide-react";
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

  const quickActions = [
    { to: "/crop-tools", icon: Leaf, tone: "soil", titleKey: "sidebar.cropTools", descKey: "dashboardHome.cropToolsDesc" },
    { to: "/vision", icon: ScanLine, tone: "crop", titleKey: "sidebar.vision", descKey: "dashboardHome.visionDesc" },
    { to: "/chat", icon: MessageSquare, tone: "ink", titleKey: "sidebar.chat", descKey: "dashboardHome.chatDesc" },
    { to: "/market", icon: LineChart, tone: "plain", titleKey: "sidebar.market", descKey: "dashboardHome.marketDesc" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-5 md:px-8 py-6 md:py-10 flex flex-col gap-8">
      {/* Alert banner */}
      {weather?.alerts?.[0] ? (
        <RevealOnScroll className="flex items-start gap-2.5 bg-danger-tint text-danger rounded-sm px-4 py-3 text-sm font-semibold">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          {weather.alerts[0]}
        </RevealOnScroll>
      ) : weather ? (
        <RevealOnScroll className="flex items-start gap-2.5 bg-accent-tint text-accent rounded-sm px-4 py-3 text-sm font-semibold">
          <Leaf size={17} className="mt-0.5 shrink-0" />
          {t("dashboardHome.alertNone")}
        </RevealOnScroll>
      ) : null}

      {/* Weather + season + your crop prices */}
      <RevealOnScroll className="grid md:grid-cols-[1fr_1.4fr] gap-4">
        <Panel className="p-5">
          <div className="text-[11px] uppercase tracking-wide text-ink-soft mb-2">{t("dashboardHome.today")}</div>
          {weather ? (
            <>
              <div className="font-display text-3xl font-semibold mb-1">
                {Math.round(weather.current.temperature)}&deg;C
              </div>
              <div className="text-sm text-ink-soft mb-4">
                {t("hero.humidity", { value: weather.current.humidity })}
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-accent bg-accent-tint rounded-full px-2.5 py-1 w-fit">
                {t("dashboardHome.season")}: {weather.season || "\u2014"}
              </div>
            </>
          ) : weatherError ? (
            <p className="text-sm text-ink-soft">{t("hero.unavailable")}</p>
          ) : (
            <>
              <Skeleton className="h-9 w-24 mb-2" />
              <Skeleton className="h-4 w-32 mb-4" />
              <Skeleton className="h-6 w-28 rounded-full" />
            </>
          )}
        </Panel>

        <Panel className="p-5">
          <div className="text-[11px] uppercase tracking-wide text-ink-soft mb-3">{t("dashboardHome.yourPrices")}</div>
          {prices ? (
            priceRows.length > 0 ? (
              <Ledger>
                {priceRows.map(([crop, records]) => {
                  const latest = records[0];
                  return (
                    <LedgerRow
                      key={crop}
                      icon={Droplets}
                      label={crop}
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

      {/* Quick actions - varied Plot tones, not identical repeated cards */}
      <div>
        <h2 className="text-sm font-semibold text-ink-soft uppercase tracking-wide mb-3">
          {t("dashboardHome.quickActions")}
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {quickActions.map(({ to, icon: Icon, tone, titleKey, descKey }, i) => (
            <RevealOnScroll key={to} delay={i * 0.05}>
              <Link to={to}>
                <Plot tone={tone} className="h-full flex flex-col gap-2.5">
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
  );
}