import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Landmark, RefreshCw } from "lucide-react";
import { Panel } from "../../components/ui/Panel";
import { Skeleton } from "../../components/ui/Skeleton";
import { ErrorState } from "../../components/ui/ErrorState";
import { RevealOnScroll } from "../../components/motion/RevealOnScroll";
import { getSchemeNews } from "../../api/news";
import { getCached, setCached } from "../../utils/dataCache";
import newsFallbackImg from "../../assets/news-fallback.png";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function proxyImage(url) {
  if (!url) return null;
  return `${API_BASE}/news/image-proxy?url=${encodeURIComponent(url)}`;
}

function timeAgo(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const hrs = Math.floor(diffMs / 3600000);
  if (hrs < 1) return "Just now";
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function SchemeNews() {
  const { t } = useTranslation();

  const newsCacheKey = "news:schemes:all";
  const [articles, setArticles] = useState(() => getCached(newsCacheKey) ?? null);
  const [error, setError] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  function loadNews(isManualRefresh = false) {
    setError(false);
    if (isManualRefresh) setRefreshing(true);
    getSchemeNews(undefined)
      .then((data) => {
        const list = data.articles || [];
        setArticles(list);
        setIsLive(data.is_live !== false);
        setFetchedAt(data.fetched_at || null);
        setCached(newsCacheKey, list);
      })
      .catch(() => {
        if (getCached(newsCacheKey) === undefined) setError(true);
      })
      .finally(() => {
        if (isManualRefresh) setRefreshing(false);
      });
  }

  useEffect(() => {
    if (articles === null || getCached(newsCacheKey) === undefined) {
      loadNews();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <Panel className="p-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">{t("news.allIndia")}</h2>
        </div>
        <button
          type="button"
          onClick={() => loadNews(true)}
          disabled={refreshing}
          title={t("news.refresh")}
          className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-dark disabled:opacity-50 transition-colors duration-150"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          {t("news.refresh")}
        </button>
      </Panel>

      <p className="text-xs text-ink-soft italic -mt-2">{t("news.schemeNewsDisclaimer")}</p>

      {error ? (
        <ErrorState message={t("news.loadError")} onRetry={() => loadNews()} />
      ) : articles === null ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : articles.length === 0 ? (
        <Panel className="p-8 text-center text-ink-soft">{t("news.noSchemeNews")}</Panel>
      ) : (
        <div className="flex flex-col gap-3">
          {!isLive && (
            <p className="text-xs text-ink-soft italic">
              {t("news.pastAlertsNote", { time: timeAgo(fetchedAt) || t("news.recently") })}
            </p>
          )}
          {articles.map((article, i) => (
            <RevealOnScroll key={article.url || i} delay={i * 0.04}>
              <a href={article.url} target="_blank" rel="noopener noreferrer">
                <Panel className="p-4 flex items-start gap-3">
                  <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-primary-tint">
                    {article.image ? (
                      <img
                        src={proxyImage(article.image)}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = newsFallbackImg;
                          e.currentTarget.className = "w-full h-full object-contain p-1.5";
                        }}
                        loading="lazy"
                      />
                    ) : (
                      <img
                        src={newsFallbackImg}
                        alt=""
                        className="w-full h-full object-contain p-1.5"
                        loading="lazy"
                      />
                    )}
                  </div>
                  <Landmark size={18} className="text-primary mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-ink leading-snug">{article.title}</h3>
                    <p className="text-xs text-ink-soft mt-1">
                      {article.source} &middot; {timeAgo(article.published_at)}
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