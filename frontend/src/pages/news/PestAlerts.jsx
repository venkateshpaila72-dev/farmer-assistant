import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { Select } from "../../components/ui/Select";
import { Panel } from "../../components/ui/Panel";
import { Skeleton } from "../../components/ui/Skeleton";
import { ErrorState } from "../../components/ui/ErrorState";
import { RevealOnScroll } from "../../components/motion/RevealOnScroll";
import { useAuth } from "../../context/AuthContext";
import { getPestAlerts } from "../../api/news";
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

export default function PestAlerts() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [states, setStates] = useState(() => getCached("market:states") ?? null);
  // The chosen state itself is cached too, so coming back to this tab keeps
  // whatever you were last looking at instead of resetting to your home state.
  const [state, setState] = useState(() => getCached("news:alerts:selectedState") ?? "");
  const alertsCacheKey = `news:alerts:${state || "all"}`;
  const [alerts, setAlerts] = useState(() => getCached(alertsCacheKey) ?? null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (getCached("news:alerts:selectedState") !== undefined) return; // already chosen this session
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

  // FIX: previously this only ever showed "No pest alerts right now" the
  // moment GNews's live query for the day came back empty — which, for
  // pest/disease-outbreak-specific English coverage of India, is common
  // and doesn't necessarily mean there's genuinely nothing relevant to
  // show. The backend now falls back to the most recently fetched batch
  // for this state when today's live query is empty (see routes/news.py),
  // flagged via is_live/fetched_at — surfaced here so it's clear these are
  // recent past alerts, not breaking news.
  const [isLive, setIsLive] = useState(true);
  const [fetchedAt, setFetchedAt] = useState(null);

  function loadAlerts() {
    setError(false);
    setCached("news:alerts:selectedState", state);
    getPestAlerts(state || undefined)
      .then((data) => {
        const list = data.alerts || [];
        setAlerts(list);
        setIsLive(data.is_live !== false);
        setFetchedAt(data.fetched_at || null);
        setCached(alertsCacheKey, list);
      })
      .catch(() => {
        if (getCached(alertsCacheKey) === undefined) setError(true);
      });
  }

  useEffect(() => {
    // Cached alerts (if any) already show via the initializer — this
    // refetches quietly in the background rather than resetting to a skeleton.
    loadAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div className="flex flex-col gap-6">
      <Panel className="p-5">
        {states === null ? (
          <Skeleton className="h-11 w-full" />
        ) : (
          <Select label={t("market.state")} value={state} onChange={(e) => setState(e.target.value)}>
            <option value="">{t("news.allIndia")}</option>
            {states.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        )}
      </Panel>

      {error ? (
        <ErrorState message={t("news.loadError")} onRetry={loadAlerts} />
      ) : alerts === null ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : alerts.length === 0 ? (
        <Panel className="p-8 text-center text-ink-soft">{t("news.noAlerts")}</Panel>
      ) : (
        <div className="flex flex-col gap-3">
          {!isLive && (
            <p className="text-xs text-ink-soft italic">
              {t("news.pastAlertsNote", { time: timeAgo(fetchedAt) || t("news.recently") })}
            </p>
          )}
          {alerts.map((alert, i) => (
            <RevealOnScroll key={alert.url || i} delay={i * 0.04}>
              <a href={alert.url} target="_blank" rel="noopener noreferrer">
                <Panel className="p-4 flex items-start gap-3 border-danger/40 bg-danger-tint">
                  <AlertTriangle size={18} className="text-danger mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-ink leading-snug">{alert.title}</h3>
                    <p className="text-xs text-ink-soft mt-1">
                      {alert.source} &middot; {timeAgo(alert.published_at)}
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