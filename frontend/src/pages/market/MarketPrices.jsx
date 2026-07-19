import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Select } from "../../components/ui/Select";
import { Panel } from "../../components/ui/Panel";
import { Skeleton } from "../../components/ui/Skeleton";
import { RevealOnScroll } from "../../components/motion/RevealOnScroll";
import { useAuth } from "../../context/AuthContext";
import { getPrices, getAvailableStates, getPriceTrend } from "../../api/market";
import { getOnboardingProfile } from "../../api/onboarding";

export default function MarketPrices() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [states, setStates] = useState(null);
  const [state, setState] = useState("");
  const [commodity, setCommodity] = useState("");
  const [prices, setPrices] = useState(null);
  const [pricesError, setPricesError] = useState(false);
  const [trend, setTrend] = useState(null);

  // Default the filter to the farmer's own state from their profile.
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
    if (!state) return;
    setPrices(null);
    setPricesError(false);
    getPrices({ state, commodity: commodity || undefined, limit: 30 })
      .then((data) => setPrices(data.prices || []))
      .catch(() => setPricesError(true));
  }, [state, commodity]);

  useEffect(() => {
    if (!state || !commodity) {
      setTrend(null);
      return;
    }
    getPriceTrend(state, commodity)
      .then((data) => setTrend([...data.trend].reverse()))
      .catch(() => setTrend(null));
  }, [state, commodity]);

  return (
    <div className="flex flex-col gap-6">
      <Panel className="p-5">
        <div className="grid sm:grid-cols-2 gap-4">
          {states === null ? (
            <Skeleton className="h-11 w-full" />
          ) : (
            <Select label={t("market.state")} value={state} onChange={(e) => setState(e.target.value)}>
              <option value="">{t("market.selectState")}</option>
              {states.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink">{t("market.commodity")}</label>
            <input
              type="text"
              value={commodity}
              onChange={(e) => setCommodity(e.target.value)}
              placeholder={t("market.commodityPlaceholder")}
              className="w-full rounded-sm border border-border bg-surface px-3.5 py-2.5 text-[15px] text-ink focus:border-primary focus:outline-none"
            />
          </div>
        </div>
      </Panel>

      {!state ? (
        <Panel className="p-8 text-center text-ink-soft">{t("market.pickState")}</Panel>
      ) : prices === null && !pricesError ? (
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : pricesError || prices.length === 0 ? (
        <Panel className="p-8 text-center text-ink-soft">{t("market.noData")}</Panel>
      ) : (
        <>
          {trend && trend.length > 1 && (
            <RevealOnScroll>
              <Panel className="p-5">
                <div className="text-[11px] uppercase tracking-wide text-ink-soft mb-3">
                  {t("market.priceTrend", { commodity })}
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="arrival_date" tick={{ fontSize: 11, fill: "#5B5140" }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#5B5140" }} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, borderColor: "#E4E2D6", fontSize: 13 }}
                        formatter={(v) => [`\u20B9${v}`, t("market.modalPrice")]}
                      />
                      <Line type="monotone" dataKey="modal_price" stroke="#9A3412" strokeWidth={2.5} dot={{ r: 3, fill: "#9A3412" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            </RevealOnScroll>
          )}

          <div className="flex flex-col gap-2.5">
            {prices.map((p, i) => (
              <RevealOnScroll key={i} delay={i * 0.02}>
                <Panel className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm">{p.commodity_raw}</div>
                    <div className="text-xs text-ink-soft mt-0.5">
                      {p.market}, {p.district} &middot; {p.arrival_date}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-display text-lg font-semibold">
                      &#8377;{Math.round(p.modal_price).toLocaleString("en-IN")}
                    </div>
                    <div className="text-xs text-ink-soft">
                      &#8377;{Math.round(p.min_price)}&ndash;{Math.round(p.max_price)}
                    </div>
                  </div>
                </Panel>
              </RevealOnScroll>
            ))}
          </div>
        </>
      )}
    </div>
  );
}