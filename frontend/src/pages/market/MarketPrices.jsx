import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";
import { Search, TrendingUp, TrendingDown, ArrowLeft } from "lucide-react";
import { Select } from "../../components/ui/Select";
import { Panel } from "../../components/ui/Panel";
import { Skeleton } from "../../components/ui/Skeleton";
import { RevealOnScroll } from "../../components/motion/RevealOnScroll";
import { useAuth } from "../../context/AuthContext";
import { getPrices, getAvailableStates } from "../../api/market";
import { getOnboardingProfile } from "../../api/onboarding";
import { getCached, setCached } from "../../utils/dataCache";

// Groups listings by market and averages the price there — this is the real
// decision a farmer is making ("which market pays more"), not a day-to-day
// trend, so a per-market comparison is a better fit than a time-series line.
function buildMarketComparison(listings) {
  const byMarket = {};
  for (const l of listings) {
    const key = `${l.market}, ${l.district}`;
    if (!byMarket[key]) byMarket[key] = { total: 0, count: 0, market: l.market, district: l.district };
    byMarket[key].total += l.modal_price;
    byMarket[key].count += 1;
  }
  return Object.entries(byMarket)
    .map(([label, v]) => ({ label, avg_price: Math.round(v.total / v.count), records: v.count }))
    .sort((a, b) => b.avg_price - a.avg_price);
}

export default function MarketPrices() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [states, setStates] = useState(() => getCached("market:states") ?? null);
  const [state, setState] = useState(() => getCached("market:prices:selectedState") ?? "");

  const [allPrices, setAllPrices] = useState(() => (state ? getCached(`market:prices:${state}`) ?? null : null));
  const [search, setSearch] = useState(() => getCached("market:prices:search") ?? "");
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedCommodity, setSelectedCommodity] = useState(() => getCached("market:prices:selectedCommodity") ?? "");

  useEffect(() => {
    if (getCached("market:prices:selectedState") !== undefined) return; // already chosen this session
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
    setCached("market:prices:selectedState", state);
    // Don't wipe selection/search when re-entering with a state already
    // cached — only reset them on a genuine state change within this visit.
    const cachedForState = getCached(`market:prices:${state}`);
    if (cachedForState === undefined) {
      setAllPrices(null);
      setSelectedCommodity("");
      setSearch("");
    }
    getPrices({ state, limit: 300 })
      .then((data) => {
        const list = data.prices || [];
        setAllPrices(list);
        setCached(`market:prices:${state}`, list);
      })
      .catch(() => {
        if (cachedForState === undefined) setAllPrices([]);
      });
  }, [state]);

  useEffect(() => { setCached("market:prices:search", search); }, [search]);
  useEffect(() => { setCached("market:prices:selectedCommodity", selectedCommodity); }, [selectedCommodity]);

  const commodityList = useMemo(() => {
    if (!allPrices) return [];
    const seen = new Map();
    for (const p of allPrices) {
      if (!seen.has(p.commodity)) seen.set(p.commodity, p.commodity_raw);
    }
    return [...seen.values()].sort();
  }, [allPrices]);

  // No cap here — show every matching commodity, the dropdown scrolls.
  const searchResults = useMemo(() => {
    if (!search.trim()) return commodityList;
    const q = search.trim().toLowerCase();
    return commodityList.filter((c) => c.toLowerCase().includes(q));
  }, [search, commodityList]);

  const listings = useMemo(() => {
    if (!selectedCommodity || !allPrices) return [];
    return allPrices
      .filter((p) => p.commodity_raw === selectedCommodity)
      .sort((a, b) => b.modal_price - a.modal_price);
  }, [selectedCommodity, allPrices]);

  const marketComparison = useMemo(() => buildMarketComparison(listings), [listings]);
  const avgPrice = marketComparison.length
    ? Math.round(marketComparison.reduce((s, m) => s + m.avg_price, 0) / marketComparison.length)
    : 0;

  const highest = listings[0];
  const lowest = listings[listings.length - 1];

  function pickCommodity(name) {
    setSelectedCommodity(name);
    setSearch(name);
    setSearchFocused(false);
  }

  function clearSelection() {
    setSelectedCommodity("");
    setSearch("");
  }

  // Default browse list before any commodity is picked — sorted by date so
  // the most recent listings surface first, capped for readability.
  const browseList = useMemo(() => {
    if (!allPrices) return [];
    return [...allPrices]
      .sort((a, b) => new Date(b.arrival_date) - new Date(a.arrival_date))
      .slice(0, 30);
  }, [allPrices]);

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

          <div className="flex flex-col gap-1.5 relative">
            <label className="text-sm font-medium text-ink">{t("market.commodity")}</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none" />
              <input
                type="text"
                value={search}
                disabled={!state || allPrices === null}
                onChange={(e) => { setSearch(e.target.value); setSelectedCommodity(""); }}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                placeholder={t("market.commodityPlaceholder")}
                className="w-full rounded-sm border border-border bg-surface pl-9 pr-3.5 py-2.5 text-[15px] text-ink focus:border-primary focus:outline-none disabled:opacity-50"
              />
            </div>

            {searchFocused && state && allPrices !== null && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-surface border border-border rounded-sm shadow-sm z-10 max-h-64 overflow-y-auto">
                {searchResults.length === 0 ? (
                  <div className="px-3.5 py-3 text-sm text-ink-soft">{t("market.noCommoditiesFound")}</div>
                ) : (
                  searchResults.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onMouseDown={() => pickCommodity(c)}
                      className="w-full text-left px-3.5 py-2.5 text-sm hover:bg-bg transition-colors duration-100"
                    >
                      {c}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </Panel>

      {!state ? (
        <Panel className="p-8 text-center text-ink-soft">{t("market.pickState")}</Panel>
      ) : allPrices === null ? (
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : !selectedCommodity ? (
        // Default browse view - the general list, like before, not an empty state.
        browseList.length === 0 ? (
          <Panel className="p-8 text-center text-ink-soft">{t("market.noData")}</Panel>
        ) : (
          <div className="flex flex-col gap-2.5">
            {browseList.map((p, i) => (
              <RevealOnScroll key={i} delay={Math.min(i, 10) * 0.02}>
                <button type="button" onClick={() => pickCommodity(p.commodity_raw)} className="w-full text-left">
                  <Panel className="p-4 flex items-center justify-between gap-4 hover:border-ink-soft transition-colors duration-150">
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
                </button>
              </RevealOnScroll>
            ))}
          </div>
        )
      ) : listings.length === 0 ? (
        <Panel className="p-8 text-center text-ink-soft">{t("market.noData")}</Panel>
      ) : (
        <>
          <button
            type="button"
            onClick={clearSelection}
            className="flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink w-fit"
          >
            <ArrowLeft size={15} /> {t("market.backToSearch")}
          </button>

          <RevealOnScroll className="grid sm:grid-cols-2 gap-4">
            <Panel className="p-4 border-accent bg-accent-tint flex items-start gap-3">
              <TrendingUp size={18} className="text-accent mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-accent/80 mb-0.5">{t("market.highestPrice")}</div>
                <div className="font-display text-lg font-semibold text-accent">
                  &#8377;{Math.round(highest.modal_price).toLocaleString("en-IN")}
                </div>
                <div className="text-xs text-ink-soft mt-0.5">
                  {highest.market}, {highest.district} &middot; {highest.arrival_date}
                </div>
              </div>
            </Panel>
            <Panel className="p-4 bg-bg flex items-start gap-3">
              <TrendingDown size={18} className="text-ink-soft mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-ink-soft mb-0.5">{t("market.lowestPrice")}</div>
                <div className="font-display text-lg font-semibold">
                  &#8377;{Math.round(lowest.modal_price).toLocaleString("en-IN")}
                </div>
                <div className="text-xs text-ink-soft mt-0.5">
                  {lowest.market}, {lowest.district} &middot; {lowest.arrival_date}
                </div>
              </div>
            </Panel>
          </RevealOnScroll>

          {/* Market comparison bar chart - ranked, with an average reference line */}
          {marketComparison.length > 1 && (
            <RevealOnScroll>
              <Panel className="p-5">
                <div className="text-[11px] uppercase tracking-wide text-ink-soft mb-1">
                  {t("market.marketComparison", { commodity: selectedCommodity })}
                </div>
                <p className="text-xs text-ink-soft mb-3">{t("market.marketComparisonNote")}</p>
                <div style={{ height: Math.max(180, marketComparison.length * 44) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={marketComparison}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                    >
                      <XAxis type="number" tick={{ fontSize: 11, fill: "#5B5140" }} tickLine={false} axisLine={false} />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={140}
                        tick={{ fontSize: 12, fill: "#2A2114" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <ReferenceLine x={avgPrice} stroke="#5B5140" strokeDasharray="4 4" />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, borderColor: "#E4E2D6", fontSize: 13 }}
                        formatter={(v) => [`\u20B9${v}`, t("market.avgPrice")]}
                      />
                      <Bar dataKey="avg_price" radius={[0, 4, 4, 0]}>
                        {marketComparison.map((m, i) => (
                          <Cell key={i} fill={m.avg_price >= avgPrice ? "#166534" : "#9A3412"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-ink-soft mt-2">
                  {t("market.avgPrice")}: &#8377;{avgPrice.toLocaleString("en-IN")}
                </p>
              </Panel>
            </RevealOnScroll>
          )}

          <div>
            <div className="text-sm font-semibold text-ink-soft uppercase tracking-wide mb-3">
              {t("market.allListings", { count: listings.length })}
            </div>
            <div className="flex flex-col gap-2.5">
              {listings.map((p, i) => (
                <RevealOnScroll key={i} delay={Math.min(i, 8) * 0.02}>
                  <Panel className={`p-4 flex items-center justify-between gap-4 ${i === 0 ? "border-accent bg-accent-tint" : ""}`}>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm">{p.market}, {p.district}</div>
                      <div className="text-xs text-ink-soft mt-0.5">{p.arrival_date}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`font-display text-lg font-semibold ${i === 0 ? "text-accent" : ""}`}>
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
          </div>
        </>
      )}
    </div>
  );
}