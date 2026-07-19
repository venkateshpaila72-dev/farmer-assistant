import { useState, useEffect } from "react";
import { useTranslation, Trans } from "react-i18next";
import { Sprout, ArrowRight, MessageSquare, ScanLine, TrendingUp, CloudSun, LineChart, Droplets, Clock, Bug, Newspaper } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicLayout } from "../../layouts/PublicLayout";
import { Button } from "../../components/ui/Button";
import { Plot } from "../../components/ui/Plot";
import { Ledger, LedgerRow } from "../../components/ui/Ledger";
import { Panel } from "../../components/ui/Panel";
import { Skeleton } from "../../components/ui/Skeleton";
import { FadeUp } from "../../components/motion/FadeUp";
import { RevealOnScroll } from "../../components/motion/RevealOnScroll";
import { useGeolocation } from "../../hooks/useGeolocation";
import { getCurrentWeather } from "../../api/weather";
import { getTrendingCrops } from "../../api/market";
import { getNewsFeed } from "../../api/news";
import { DEFAULT_PUBLIC_STATE } from "../../utils/constants";

function timeAgo(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const hrs = Math.floor(diffMs / 3600000);
  if (hrs < 1) return "Just now";
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Home() {
  const { t } = useTranslation();
  const { coords } = useGeolocation();

  const [weather, setWeather] = useState(null);
  const [weatherError, setWeatherError] = useState(false);

  const [trending, setTrending] = useState(null);
  const [trendingUnavailable, setTrendingUnavailable] = useState(false);

  const [news, setNews] = useState(null);
  const [newsError, setNewsError] = useState(false);

  useEffect(() => {
    if (!coords) return;
    getCurrentWeather(coords.lat, coords.lng)
      .then(setWeather)
      .catch(() => setWeatherError(true));
  }, [coords]);

  useEffect(() => {
    getTrendingCrops(DEFAULT_PUBLIC_STATE, 5)
      .then((data) => setTrending(data.trending_crops || []))
      .catch(() => setTrendingUnavailable(true));
  }, []);

  useEffect(() => {
    getNewsFeed({ maxResults: 4 })
      .then((data) => setNews(data.articles || []))
      .catch(() => setNewsError(true));
  }, []);

  return (
    <PublicLayout>
      {/* Hero */}
      <header className="max-w-6xl mx-auto px-6 pt-16 pb-14 grid md:grid-cols-[1.1fr_0.9fr] gap-10 md:gap-14 items-center">
        <div>
          <FadeUp as="span" className="inline-flex items-center gap-2 text-[13px] font-semibold text-accent bg-accent-tint px-3 py-1.5 rounded-full mb-4">
            {t("hero.badge")}
          </FadeUp>
          <FadeUp as="h1" delay={0.08} className="text-4xl md:text-5xl leading-tight">
            {t("hero.title")}
          </FadeUp>
          <FadeUp as="p" delay={0.16} className="text-lg text-ink-soft mt-5 mb-7 max-w-[46ch]">
            {t("hero.lede")}
          </FadeUp>
          <FadeUp delay={0.24} className="flex flex-wrap gap-3.5">
            <Link to="/register">
              <Button variant="primary">
                {t("hero.ctaPrimary")} <ArrowRight size={16} />
              </Button>
            </Link>
            <a href="#features">
              <Button variant="ghost">{t("hero.ctaSecondary")}</Button>
            </a>
          </FadeUp>
          <FadeUp as="p" delay={0.3} className="text-sm text-ink-soft mt-4">
            {t("hero.note")}
          </FadeUp>
        </div>

        <FadeUp delay={0.2} className="max-w-[320px] mx-auto w-full">
          <Panel className="p-4">
            <div className="bg-bg rounded-md p-4">
              {weather?.alerts?.[0] ? (
                <div className="flex items-start gap-2 bg-danger-tint text-danger rounded-sm px-3 py-2.5 text-[13px] font-semibold mb-3.5">
                  <Bug size={16} className="mt-0.5 shrink-0" />
                  {weather.alerts[0]}
                </div>
              ) : (
                <div className="flex items-start gap-2 bg-accent-tint text-accent rounded-sm px-3 py-2.5 text-[13px] font-semibold mb-3.5">
                  <Sprout size={16} className="mt-0.5 shrink-0" />
                  {t("hero.noAlerts")}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5 mb-3.5">
                <Panel className="p-3">
                  <div className="text-[11px] uppercase tracking-wide text-ink-soft mb-1">{t("hero.today")}</div>
                  {weather ? (
                    <>
                      <div className="font-display text-xl font-semibold">
                        {Math.round(weather.current.temperature)}&deg;C
                      </div>
                      <div className="text-xs text-accent font-semibold mt-0.5">
                        {t("hero.humidity", { value: weather.current.humidity })}
                      </div>
                    </>
                  ) : weatherError ? (
                    <div className="text-xs text-ink-soft mt-1">{t("hero.unavailable")}</div>
                  ) : (
                    <>
                      <Skeleton className="h-6 w-14 mb-1.5" />
                      <Skeleton className="h-3 w-20" />
                    </>
                  )}
                </Panel>
                <Panel className="p-3">
                  <div className="text-[11px] uppercase tracking-wide text-ink-soft mb-1">
                    {t("hero.marketPrice")}
                  </div>
                  {trending ? (
                    <>
                      <div className="font-display text-xl font-semibold">
                        {trending.length}
                      </div>
                      <div className="text-xs text-ink-soft font-semibold mt-0.5">
                        {trending.length === 1 ? "crop tracked" : "crops tracked"}
                      </div>
                    </>
                  ) : trendingUnavailable ? (
                    <div className="text-xs text-ink-soft mt-1">{t("hero.noDataYet")}</div>
                  ) : (
                    <>
                      <Skeleton className="h-6 w-16 mb-1.5" />
                      <Skeleton className="h-3 w-14" />
                    </>
                  )}
                </Panel>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <Panel className="p-3 flex flex-col gap-2">
                  <span className="w-7 h-7 rounded-lg bg-primary-tint text-primary flex items-center justify-center">
                    <MessageSquare size={15} />
                  </span>
                  <span className="text-[13px] font-semibold">{t("hero.askAssistant")}</span>
                </Panel>
                <Panel className="p-3 flex flex-col gap-2">
                  <span className="w-7 h-7 rounded-lg bg-primary-tint text-primary flex items-center justify-center">
                    <ScanLine size={15} />
                  </span>
                  <span className="text-[13px] font-semibold">{t("hero.checkLeafPhoto")}</span>
                </Panel>
              </div>
            </div>
          </Panel>
        </FadeUp>
      </header>

      {/* Features - varied-size Plot patchwork, not a repeated card grid */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-16">
        <RevealOnScroll className="max-w-xl mb-11">
          <span className="inline-block text-[13px] font-semibold text-accent bg-accent-tint px-3 py-1.5 rounded-full mb-3.5">
            {t("features.badge")}
          </span>
          <h2 className="text-2xl md:text-3xl mt-1">{t("features.title")}</h2>
          <p className="text-ink-soft mt-3">{t("features.subtitle")}</p>
        </RevealOnScroll>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <RevealOnScroll className="md:col-span-4">
            <Plot tone="soil" className="h-full flex flex-col gap-3">
              <Sprout size={26} />
              <h3 className="text-lg font-display font-semibold">{t("features.crop.title")}</h3>
              <p className="text-[14.5px]">{t("features.crop.desc")}</p>
            </Plot>
          </RevealOnScroll>

          <RevealOnScroll delay={0.06} className="md:col-span-2">
            <Plot tone="crop" className="h-full flex flex-col gap-3">
              <ScanLine size={24} />
              <h3 className="text-base font-display font-semibold">{t("features.photo.title")}</h3>
              <p className="text-[14px]">{t("features.photo.desc")}</p>
            </Plot>
          </RevealOnScroll>

          <RevealOnScroll delay={0.1} className="md:col-span-3">
            <Plot tone="plain" className="h-full flex flex-col gap-3">
              <LineChart size={24} className="text-primary" />
              <h3 className="text-base font-display font-semibold">{t("features.market.title")}</h3>
              <p className="text-[14px] text-ink-soft">{t("features.market.desc")}</p>
            </Plot>
          </RevealOnScroll>

          <RevealOnScroll delay={0.14} className="md:col-span-3">
            <Plot tone="ink" className="h-full flex flex-col gap-3">
              <CloudSun size={24} />
              <h3 className="text-base font-display font-semibold">{t("features.weather.title")}</h3>
              <p className="text-[14px] opacity-80">{t("features.weather.desc")}</p>
            </Plot>
          </RevealOnScroll>

          <RevealOnScroll delay={0.18} className="md:col-span-6">
            <Plot tone="soil" className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
              <MessageSquare size={26} className="shrink-0" />
              <div>
                <h3 className="text-lg font-display font-semibold">{t("features.chat.title")}</h3>
                <p className="text-[14.5px] mt-1">{t("features.chat.desc")}</p>
              </div>
            </Plot>
          </RevealOnScroll>
        </div>
      </section>

      {/* Dashboard preview - Ledger instead of stat cards */}
      <section id="dashboard" className="max-w-6xl mx-auto px-6 py-16">
        <RevealOnScroll className="max-w-xl mb-11">
          <span className="inline-block text-[13px] font-semibold text-accent bg-accent-tint px-3 py-1.5 rounded-full mb-3.5">
            {t("dashboardPreview.badge")}
          </span>
          <h2 className="text-2xl md:text-3xl mt-1">{t("dashboardPreview.title")}</h2>
          <p className="text-ink-soft mt-3">{t("dashboardPreview.subtitle")}</p>
        </RevealOnScroll>

        <RevealOnScroll>
          <Panel className="overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <strong className="font-display text-base">Ramesh&rsquo;s dashboard &mdash; Anantapur</strong>
              <span className="text-xs font-semibold text-accent bg-accent-tint px-2.5 py-1 rounded-full">
                {t("dashboardPreview.season")}
              </span>
            </div>
            <div className="grid md:grid-cols-[1.3fr_1fr] gap-5 p-6">
              <div className="bg-bg border border-border rounded-sm p-4.5">
                <div className="text-[11px] uppercase tracking-wide text-ink-soft mb-3">
                  {t("dashboardPreview.groundnutChart")}
                </div>
                <div className="flex items-end gap-2 h-28">
                  {[52, 61, 58, 70, 66, 78, 90].map((h, i) => (
                    <div
                      key={i}
                      className={`flex-1 rounded-t ${i === 6 ? "bg-accent" : "bg-primary/85"}`}
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </div>
              <Panel className="bg-bg p-4">
                <Ledger>
                  <LedgerRow icon={Droplets} label={t("ledger.soilMoisture")} value={t("ledger.adequate")} />
                  <LedgerRow icon={Clock} label={t("ledger.nextIrrigation")} value={t("ledger.days", { count: 3 })} />
                  <LedgerRow icon={Bug} label={t("ledger.diseaseRisk")} value={t("ledger.watch")} tone="down" />
                  <LedgerRow icon={TrendingUp} label={t("ledger.marketTrend")} value={t("ledger.rising")} tone="up" />
                </Ledger>
              </Panel>
            </div>
          </Panel>
        </RevealOnScroll>
      </section>

      {/* News - real articles + images from the backend's news feed */}
      <section id="news" className="max-w-6xl mx-auto px-6 py-16">
        <RevealOnScroll className="max-w-xl mb-11">
          <span className="inline-block text-[13px] font-semibold text-accent bg-accent-tint px-3 py-1.5 rounded-full mb-3.5">
            {t("news.badge")}
          </span>
          <h2 className="text-2xl md:text-3xl mt-1">{t("news.title")}</h2>
          <p className="text-ink-soft mt-3">{t("news.subtitle")}</p>
        </RevealOnScroll>

        {newsError ? (
          <Panel className="p-8 text-center text-ink-soft">{t("news.loadError")}</Panel>
        ) : news === null ? (
          <div className="grid md:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i}>
                <Skeleton className="h-36 w-full mb-3" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : news.length === 0 ? (
          <Panel className="p-8 text-center text-ink-soft">{t("news.empty")}</Panel>
        ) : (
          <div className="grid md:grid-cols-4 gap-4">
            {news.map((article, i) => (
              <RevealOnScroll key={article.url || i} delay={i * 0.05}>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block"
                >
                  <div className="h-36 rounded-md overflow-hidden bg-primary-tint mb-3">
                    {article.image ? (
                      <img
                        src={article.image}
                        alt=""
                        className="w-full h-full object-cover transition-transform duration-300 ease-out-expo group-hover:scale-105"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-primary">
                        <Newspaper size={28} />
                      </div>
                    )}
                  </div>
                  <h3 className="text-[15px] font-display font-semibold leading-snug group-hover:text-primary transition-colors">
                    {article.title}
                  </h3>
                  <p className="text-xs text-ink-soft mt-1.5">
                    {article.source} &middot; {timeAgo(article.published_at)}
                  </p>
                </a>
              </RevealOnScroll>
            ))}
          </div>
        )}
      </section>

      {/* CTA */}
      <section id="trust" className="max-w-6xl mx-auto px-6 py-16">
        <RevealOnScroll>
          <Plot tone="soil" className="!bg-primary text-white p-10 md:p-14 flex flex-wrap items-center justify-between gap-8">
            <h2 className="text-white text-2xl md:text-3xl max-w-[22ch]">{t("cta.title")}</h2>
            <Link to="/register">
              <Button variant="inverse">
                {t("cta.button")} <ArrowRight size={16} />
              </Button>
            </Link>
          </Plot>
        </RevealOnScroll>
      </section>
    </PublicLayout>
  );
}