import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Landmark, RefreshCw } from "lucide-react";
import { Select } from "../../components/ui/Select";
import { Panel } from "../../components/ui/Panel";
import { Skeleton } from "../../components/ui/Skeleton";
import { ErrorState } from "../../components/ui/ErrorState";
import { RevealOnScroll } from "../../components/motion/RevealOnScroll";
import { useAuth } from "../../context/AuthContext";
import { getSchemeNews } from "../../api/news";
import { getAvailableStates } from "../../api/market";
import { getOnboardingProfile } from "../../api/onboarding";
import { getCached, setCached } from "../../utils/dataCache";

function timeAgo(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const hrs = Math.floor(diffMs / 3600000);
  if (hrs < 1) return "Just now";
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// This tab is the informal "in the news" signal for new government
// schemes — GNews-sourced, not verified. The Announcements tab is where
// an admin has actually reviewed a scheme and turned it into a proper
// structured card (benefit/eligibility/where-to-apply); this feed exists
// to help notice something worth reviewing, not to replace that step. The
// UI below deliberately keeps a lighter, less "official" visual treatment
// than the announcement scheme cards, and a persistent note explaining
// the distinction so farmers don't mistake a news mention for a verified
// benefit they're guaranteed to receive.
export default function SchemeNews() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [states, setStates] = useState(() => getCached("market:states") ?? null);
  const [state, setState] = useState(() => getCached("news:schemes:selectedState") ?? "");
  const newsCacheKey = `news:schemes:${state || "all"}`;
  const [articles, setArticles] = useState(() => getCached(newsCacheKey) ?? null);
  const [error, setError] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (getCached("news:schemes:selectedState") !== undefined) return;
    if (!user?.username) return;
    getOnboardingProfile(user.username)
      .then((profile) => {
        const homeState = profile?.home_location?.state;
        if (homeState) setState(homeState);
      })
      .catch(() => {});
  }, [user?.username]);

  useEffect(() => {
    if (states !== null) return;
    getAvailableStates()
      .then((data) => {
        const list = data.states || [];
        setStates(list);
        setCached("market:states", list);
      })
      .catch(() => setStates([]));
  }, [states]);

  // isManualRefresh distinguishes an explicit tap of the Refresh button
  // (always hits the live API, shows a spinner on the button) from the
  // background/first-time load below (no spinner — the skeleton already
  // covers that case).
  function loadNews(isManualRefresh = false) {
    setError(false);
    if (isManualRefresh) setRefreshing(true);
    setCached("news:schemes:selectedState", state);
    getSchemeNews(state || undefined)
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

  // Deliberately does NOT refetch every time this tab is revisited or the
  // farmer navigates away and back — only fetches when there's genuinely
  // nothing cached yet for the selected state (first-ever view of that
  // state this session). Any further update only happens via the explicit
  // Refresh button below, per request — no silent background reloading.
  useEffect(() => {
    if (getCached(newsCacheKey) === undefined) {
      loadNews();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div className="flex flex-col gap-6">
      <Panel className="p-5 flex items-center justify-between gap-3">
        <div className="flex-1">
          {states === null ? (
            <Skeleton className="h-11 w-full" />
          ) : (
            <Select label={t("market.state")} value={state} onChange={(e) => setState(e.target.value)}>
              <option value="">{t("news.allIndia")}</option>
              {states.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          )}
        </div>
        <button
          type="button"
          onClick={() => loadNews(true)}
          disabled={refreshing}
          title={t("news.refresh")}
          className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-dark disabled:opacity-50 transition-colors duration-150 self-end mb-0.5"
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