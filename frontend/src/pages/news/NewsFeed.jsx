import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { RotateCw } from "lucide-react";
import { Panel } from "../../components/ui/Panel";
import { Skeleton } from "../../components/ui/Skeleton";
import { ErrorState } from "../../components/ui/ErrorState";
import { RevealOnScroll } from "../../components/motion/RevealOnScroll";
import { getNewsFeed } from "../../api/news";
import { getCached, setCached } from "../../utils/dataCache";
import newsFallbackImg from "../../assets/news-fallback.png";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

/** Build a proxied image URL through our backend to bypass CORS / hotlink blocks. */
function proxyImage(url) {
  if (!url) return null;
  return `${API_BASE}/news/image-proxy?url=${encodeURIComponent(url)}`;
}

/** Human-readable relative time from an ISO-8601 timestamp.
 *  Returns "" for missing/invalid timestamps. Adds a full-date title via the caller. */
function timeAgo(iso) {
  if (!iso) return "";
  const parsed = new Date(iso);
  if (isNaN(parsed.getTime())) return "";
  const diffMs = Date.now() - parsed.getTime();
  if (diffMs < 0) return "Just now";
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/** Format ISO string to a readable date for tooltip. */
function fullDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const CACHE_KEY = "news:feed:global";

export default function NewsFeed() {
  const { t } = useTranslation();

  const [articles, setArticles] = useState(() => getCached(CACHE_KEY) ?? null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const [freshnessWindow, setFreshnessWindow] = useState("20 days");

  function load({ isManualRefresh = false } = {}) {
    setError(false);
    if (isManualRefresh) setRefreshing(true);
    getNewsFeed()
      .then((data) => {
        const list = data.articles || [];
        setArticles(list);
        setIsLive(data.is_live !== false);
        setFreshnessWindow(data.freshness_window || "20 days");
        setCached(CACHE_KEY, list);
      })
      .catch(() => {
        if (getCached(CACHE_KEY) === undefined) setError(true);
      })
      .finally(() => {
        if (isManualRefresh) setRefreshing(false);
      });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <ErrorState message={t("news.loadError")} onRetry={load} />;

  return (
    <div className="flex flex-col gap-6">
      {/* Refresh button — no dropdown */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => load({ isManualRefresh: true })}
          disabled={refreshing}
          title={t("news.refresh")}
          className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-primary transition-colors duration-150 disabled:opacity-50"
        >
          <RotateCw size={13} className={refreshing ? "animate-spin" : ""} />
          {t("news.refresh")}
        </button>
      </div>

      {articles === null ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <Skeleton className="h-36 w-full mb-3" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      ) : articles.length === 0 ? (
        <Panel className="p-8 text-center text-ink-soft">{t("news.empty")}</Panel>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 -mb-2">
            <p className="text-xs text-ink-soft italic">
              {isLive ? `Real-time updates available. Showing the last ${freshnessWindow}.` : `Offline fallback. Showing the last ${freshnessWindow}.`}
            </p>
          </div>
          {articles.map((article, i) => (
            <RevealOnScroll key={article.url || i} delay={i * 0.05}>
              <a href={article.url} target="_blank" rel="noopener noreferrer" className="group block">
                <Panel className="overflow-hidden p-0">
                  <div className="h-36 bg-primary-tint relative">
                    {article.image ? (
                      <img
                        src={proxyImage(article.image)}
                        alt=""
                        className="w-full h-full object-cover transition-transform duration-300 ease-out-expo group-hover:scale-105"
                        onError={(e) => {
                          // Broken upstream image (dead link, hotlink block, etc.)
                          // — swap straight to our own fallback image.
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = newsFallbackImg;
                          e.currentTarget.className =
                            "w-full h-full object-contain p-4";
                        }}
                        loading="lazy"
                      />
                    ) : (
                      // No image at all — show the fallback image directly.
                      <img
                        src={newsFallbackImg}
                        alt=""
                        className="w-full h-full object-contain p-4"
                        loading="lazy"
                      />
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="text-[15px] font-display font-semibold leading-snug group-hover:text-primary transition-colors">
                      {article.title}
                    </h3>
                    <p
                      className="text-xs text-ink-soft mt-1.5"
                      title={fullDate(article.published_at)}
                    >
                      {article.source}
                      {timeAgo(article.published_at) ? ` · ${timeAgo(article.published_at)}` : ""}
                    </p>
                  </div>
                </Panel>
              </a>
            </RevealOnScroll>
          ))}
        </div>
      )}
    </div>
  );
}