import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { TrendingUp } from "lucide-react";
import { Select } from "../../components/ui/Select";
import { Panel } from "../../components/ui/Panel";
import { Skeleton } from "../../components/ui/Skeleton";
import { RevealOnScroll } from "../../components/motion/RevealOnScroll";
import { useAuth } from "../../context/AuthContext";
import { getTrendingCrops, getAvailableStates } from "../../api/market";
import { getOnboardingProfile } from "../../api/onboarding";
import { getCached, setCached } from "../../utils/dataCache";

export default function TrendingCrops() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [states, setStates] = useState(() => getCached("market:states") ?? null);
  const [state, setState] = useState(() => getCached("market:trending:selectedState") ?? "");
  const trendingCacheKey = `market:trending:${state}`;
  const [trending, setTrending] = useState(() => (state ? getCached(trendingCacheKey) ?? null : null));
  const [error, setError] = useState(false);

  useEffect(() => {
    if (getCached("market:trending:selectedState") !== undefined) return;
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

  useEffect(() => {
    if (!state) return;
    setCached("market:trending:selectedState", state);
    const cached = getCached(trendingCacheKey);
    if (cached === undefined) setTrending(null);
    setError(false);
    getTrendingCrops(state, 8)
      .then((data) => {
        const list = data.trending_crops || [];
        setTrending(list);
        setCached(trendingCacheKey, list);
      })
      .catch(() => {
        if (cached === undefined) setError(true);
      });
  }, [state]);

  const maxScore = trending?.length ? Math.max(...trending.map((c) => c.trending_score)) : 1;

  return (
    <div className="flex flex-col gap-6">
      <Panel className="p-5">
        {states === null ? (
          <Skeleton className="h-11 w-full" />
        ) : (
          <Select label={t("market.state")} value={state} onChange={(e) => setState(e.target.value)}>
            <option value="">{t("market.selectState")}</option>
            {states.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        )}
      </Panel>

      {!state ? (
        <Panel className="p-8 text-center text-ink-soft">{t("market.pickState")}</Panel>
      ) : trending === null && !error ? (
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : error || trending.length === 0 ? (
        <Panel className="p-8 text-center text-ink-soft">{t("market.noData")}</Panel>
      ) : (
        <div className="flex flex-col gap-3">
          {trending.map((c, i) => (
            <RevealOnScroll key={c.commodity} delay={i * 0.05}>
              <Panel className={`p-4 flex items-center gap-4 ${i === 0 ? "border-accent bg-accent-tint" : ""}`}>
                <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${i === 0 ? "bg-accent text-white" : "bg-bg text-ink-soft"}`}>
                  <TrendingUp size={17} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-semibold capitalize">{c.commodity}</div>
                  <div className="h-1.5 bg-border rounded-full mt-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${i === 0 ? "bg-accent" : "bg-ink-soft"}`}
                      style={{ width: `${(c.trending_score / maxScore) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-display font-semibold">
                    &#8377;{Math.round(c.avg_price).toLocaleString("en-IN")}
                  </div>
                  <div className="text-xs text-ink-soft">{c.data_points} {t("market.listings")}</div>
                </div>
              </Panel>
            </RevealOnScroll>
          ))}
        </div>
      )}
    </div>
  );
}