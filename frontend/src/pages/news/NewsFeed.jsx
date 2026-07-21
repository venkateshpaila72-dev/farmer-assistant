import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Newspaper } from "lucide-react";
import { Panel } from "../../components/ui/Panel";
import { Skeleton } from "../../components/ui/Skeleton";
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

  useEffect(() => {
    if (!user?.username) return;
    // Cached data (if any) is already showing via the initializer above —
    // this always refetches quietly in the background to stay current,
    // without resetting the view to a loading skeleton.
    getFarmerNews(user.username)
      .then((data) => {
        const list = data.articles || [];
        setArticles(list);
        setCached(cacheKey, list);
      })
      .catch(() => {
        if (getCached(cacheKey) === undefined) setError(true);
      });
  }, [user?.username]);

  if (error) return <Panel className="p-8 text-center text-ink-soft">{t("news.loadError")}</Panel>;

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

  if (articles.length === 0) return <Panel className="p-8 text-center text-ink-soft">{t("news.empty")}</Panel>;

  return (
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
  );
}