import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { Select } from "../../components/ui/Select";
import { Panel } from "../../components/ui/Panel";
import { Skeleton } from "../../components/ui/Skeleton";
import { ErrorState } from "../../components/ui/ErrorState";
import { RevealOnScroll } from "../../components/motion/RevealOnScroll";
import { getPestAlerts } from "../../api/news";
import { getAvailableStates } from "../../api/market";
import { getCached, setCached } from "../../utils/dataCache";
import newsFallbackImg from "../../assets/news-fallback.png";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function proxyImage(url) {
  if (!url) return null;
  return `${API_BASE}/news/image-proxy?url=${encodeURIComponent(url)}`;
}

/** Human-readable relative time from an ISO-8601 timestamp. */
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

/** Full date for tooltip. */
function fullDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function PestAlerts() {
  const { t } = useTranslation();

  const [states, setStates] = useState(() => getCached("market:states") ?? null);
  // Always default to All India ("") — never auto-select farmer's home state
  const [state, setState] = useState("");
  const alertsCacheKey = `news:alerts:${state || "all"}`;
  const [alerts, setAlerts] = useState(() => getCached(alertsCacheKey) ?? null);
  const [error, setError] = useState(false);

  const [isLive, setIsLive] = useState(true);
  const [fetchedAt, setFetchedAt] = useState(null);

  // Load available Indian states (reuse market data)
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

  function loadAlerts() {
    setError(false);
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
                  <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-danger/10">
                    {alert.image ? (
                      <img
                        src={proxyImage(alert.image)}
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
                  <AlertTriangle size={18} className="text-danger mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-ink leading-snug">{alert.title}</h3>
                    <p
                      className="text-xs text-ink-soft mt-1"
                      title={fullDate(alert.published_at)}
                    >
                      {alert.source}
                      {timeAgo(alert.published_at) ? ` · ${timeAgo(alert.published_at)}` : ""}
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