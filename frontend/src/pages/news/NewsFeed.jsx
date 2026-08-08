import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Newspaper, RotateCw } from "lucide-react";
import { Panel } from "../../components/ui/Panel";
import { Skeleton } from "../../components/ui/Skeleton";
import { ErrorState } from "../../components/ui/ErrorState";
import { RevealOnScroll } from "../../components/motion/RevealOnScroll";
import { useAuth } from "../../context/AuthContext";
import { getFarmerNews } from "../../api/news";
import { getCached, setCached } from "../../utils/dataCache";

function timeAgo(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const hrs = Math.floor(diffMs / 3600000);
  if (hrs < 1) return "Just now";
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NewsFeed() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const cacheKey = `news:feed:${user?.username}`;

  const [articles, setArticles] = useState(() => getCached(cacheKey) ?? null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  function load({ isManualRefresh = false } = {}) {
    setError(false);
    if (isManualRefresh) setRefreshing(true);
    getFarmerNews(user.username)
      .then((data) => {
        const list = data.articles || [];
        setArticles(list);
        setCached(cacheKey, list);
      })
      .catch(() => {
        if (getCached(cacheKey) === undefined) setError(true);
      })
      .finally(() => {
        if (isManualRefresh) setRefreshing(false);
      });
  }

  useEffect(() => {
    if (!user?.username) return;
    // Cached data (if any) is already showing via the initializer above —
    // this always refetches quietly in the background to stay current,
    // without resetting the view to a loading skeleton.
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.username]);

  // Manual refresh — the backend still applies its own 30-min cache per
  // query to protect GNews's free-tier daily quota, so this re-asks for
  // "the current best answer" rather than forcing a brand new API call
  // every tap; it's still the right button to have, since it's what makes
  // "the news feels stale" actionable instead of just waiting for the
  // next page load.
  const refreshButton = (
    <button
      type="button"
      onClick={() => load({ isManualRefresh: true })}
      disabled={refreshing}
      className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-primary transition-colors duration-150 disabled:opacity-50"
    >
      <RotateCw size={13} className={refreshing ? "animate-spin" : ""} />
      {refreshing ? t("news.refreshing") : t("news.refresh")}
    </button>
  );

  if (error) return <ErrorState message={t("news.loadError")} onRetry={load} />;

  if (articles === null) {
    return (
      <div className="grid sm:grid-cols-2 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i}>
            <Skeleton className="h-36 w-full mb-3" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex justify-end">{refreshButton}</div>
        <Panel className="p-8 text-center text-ink-soft">{t("news.empty")}</Panel>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">{refreshButton}</div>
      <div className="grid sm:grid-cols-2 gap-4">
        {articles.map((article, i) => (
          <RevealOnScroll key={article.url || i} delay={i * 0.05}>
            <a href={article.url} target="_blank" rel="noopener noreferrer" className="group block">
              <Panel className="overflow-hidden p-0">
                <div className="h-36 bg-primary-tint">
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
                <div className="p-4">
                  <h3 className="text-[15px] font-display font-semibold leading-snug group-hover:text-primary transition-colors">
                    {article.title}
                  </h3>
                  <p className="text-xs text-ink-soft mt-1.5">
                    {article.source} &middot; {timeAgo(article.published_at)}
                  </p>
                </div>
              </Panel>
            </a>
          </RevealOnScroll>
        ))}
      </div>
    </div>
  );
}