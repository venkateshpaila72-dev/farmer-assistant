import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { Select } from "../../components/ui/Select";
import { Panel } from "../../components/ui/Panel";
import { Skeleton } from "../../components/ui/Skeleton";
import { RevealOnScroll } from "../../components/motion/RevealOnScroll";
import { useAuth } from "../../context/AuthContext";
import { getPestAlerts } from "../../api/news";
import { getAvailableStates } from "../../api/market";
import { getOnboardingProfile } from "../../api/onboarding";

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

  const [states, setStates] = useState(null);
  const [state, setState] = useState("");
  const [alerts, setAlerts] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user?.username) return;
    getOnboardingProfile(user.username)
      .then((profile) => {
        const homeState = profile?.home_location?.state;
        if (homeState) setState(homeState);
      })
      .catch(() => {});
  }, [user?.username]);

  useEffect(() => {
    getAvailableStates().then((data) => setStates(data.states || [])).catch(() => setStates([]));
  }, []);

  useEffect(() => {
    setAlerts(null);
    setError(false);
    getPestAlerts(state || undefined)
      .then((data) => setAlerts(data.alerts || []))
      .catch(() => setError(true));
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
        <Panel className="p-8 text-center text-ink-soft">{t("news.loadError")}</Panel>
      ) : alerts === null ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : alerts.length === 0 ? (
        <Panel className="p-8 text-center text-ink-soft">{t("news.noAlerts")}</Panel>
      ) : (
        <div className="flex flex-col gap-3">
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