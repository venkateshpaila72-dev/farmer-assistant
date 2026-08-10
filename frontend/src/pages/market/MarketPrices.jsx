import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";
import { Search, TrendingUp, TrendingDown, ArrowLeft } from "lucide-react";
import { Select } from "../../components/ui/Select";
import { Panel } from "../../components/ui/Panel";
import { Skeleton } from "../../components/ui/Skeleton";
import { ErrorState } from "../../components/ui/ErrorState";
import { RevealOnScroll } from "../../components/motion/RevealOnScroll";
import { useAuth } from "../../context/AuthContext";
import { getPrices, getAvailableStates } from "../../api/market";
import { getOnboardingProfile } from "../../api/onboarding";
import { getCached, setCached } from "../../utils/dataCache";
import { translateCropName } from "../../utils/cropNameLabel";

// AGMARKNET records the same market/commodity/date multiple times when
// different varieties or grades were traded — e.g. two Banana lots at the
// same APMC on the same day, priced separately. This surfaces that instead
// of leaving same-market-same-date rows looking like unexplained duplicates.
function varietyLabel(p) {
  const junk = new Set(["", "na", "n/a", "-", "none"]);
  const parts = [p.variety, p.grade].filter((v) => v && !junk.has(v.trim().toLowerCase()));
  return parts.length ? parts.join(", ") : null;
}

// Groups listings by market and averages the price there — this is the real
// decision a farmer is making ("which market pays more"), not a day-to-day
// trend, so a per-market comparison is a better fit than a time-series line.
// Grouped by variety/grade too, not just market — averaging different
// varieties of the same commodity together would blur the comparison.
function buildMarketComparison(listings) {
  const byMarket = {};
  for (const l of listings) {
    const variety = varietyLabel(l);
    const key = variety ? `${l.market}, ${l.district} (${variety})` : `${l.market}, ${l.district}`;
    if (!byMarket[key]) byMarket[key] = { total: 0, count: 0 };
    byMarket[key].total += l.modal_price;
    byMarket[key].count += 1;
  }
  return Object.entries(byMarket)
    .map(([label, v]) => ({ label, avg_price: Math.round(v.total / v.count), records: v.count }))
    .sort((a, b) => b.avg_price - a.avg_price);
}

// How many records to pull per page/load-more click.
const PAGE_SIZE = 300;

// vs-7-days-ago trend for one commodity, computed from whatever rows are
// already loaded — groups by date, compares the latest date's average price
// against the loaded date closest to 7 days before it. Returns null when
// there isn't enough spread in the loaded data to say anything meaningful.
function buildTrend(commodityRaw, allPrices) {
  if (!allPrices) return null;
  const rows = allPrices.filter((p) => p.commodity_raw === commodityRaw && p.arrival_date);
  if (rows.length < 2) return null;

  const byDate = {};
  for (const r of rows) {
    if (!byDate[r.arrival_date]) byDate[r.arrival_date] = { total: 0, count: 0 };
    byDate[r.arrival_date].total += r.modal_price;
    byDate[r.arrival_date].count += 1;
  }
  const dates = Object.keys(byDate)
    .map((d) => ({ time: new Date(d).getTime(), avg: byDate[d].total / byDate[d].count }))
    .filter((d) => !Number.isNaN(d.time))
    .sort((a, b) => b.time - a.time);
  if (dates.length < 2) return null;

  const latest = dates[0];
  const targetTime = latest.time - 7 * 24 * 60 * 60 * 1000;
  let past = null;
  let bestDiff = Infinity;
  for (let i = 1; i < dates.length; i++) {
    const diff = Math.abs(dates[i].time - targetTime);
    if (diff < bestDiff) { bestDiff = diff; past = dates[i]; }
  }
  // Only trust it if the closest date we have is within 4 days of the
  // 7-day mark — otherwise we're comparing against something too far off.
  if (!past || bestDiff > 4 * 24 * 60 * 60 * 1000) return null;

  const pct = ((latest.avg - past.avg) / past.avg) * 100;
  if (Math.abs(pct) < 1) return null; // too small to be a meaningful signal
  return { up: pct > 0, pct: Math.round(Math.abs(pct)) };
}

// One row in the commodity search dropdown — bold when it's one of the
// farmer's preferred crops, with a small up/down trend badge when available.
function CommodityRow({ c, onPick }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onMouseDown={() => onPick(c.raw)}
      className={`w-full flex items-center justify-between gap-2 text-left px-3.5 py-2.5 text-sm hover:bg-bg transition-colors duration-100 ${
        c.preferred ? "font-semibold text-primary" : "text-ink"
      }`}
    >
      <span className="truncate">{translateCropName(t, c.raw)}</span>
      {c.trend && (
        <span className={`flex items-center gap-0.5 text-[11px] font-medium shrink-0 ${c.trend.up ? "text-accent" : "text-danger"}`}>
          {c.trend.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {c.trend.pct}%
        </span>
      )}
    </button>
  );
}

export default function MarketPrices() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [states, setStates] = useState(() => getCached("market:states") ?? null);
  const [state, setState] = useState(() => getCached("market:prices:selectedState") ?? "");

  const [allPrices, setAllPrices] = useState(() => (state ? getCached(`market:prices:${state}`) ?? null : null));
  const [priceError, setPriceError] = useState(false);
  const [search, setSearch] = useState(() => getCached("market:prices:search") ?? "");
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedCommodity, setSelectedCommodity] = useState(() => getCached("market:prices:selectedCommodity") ?? "");
  const [preferredCrops, setPreferredCrops] = useState(() => getCached("market:prices:preferredCrops") ?? []);
  const [hasMore, setHasMore] = useState(() => (state ? getCached(`market:prices:hasMore:${state}`) ?? true : true));
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    // Guarded on preferredCrops (not selectedState) so this still runs even
    // when a state was already picked/cached in an earlier session, before
    // "your crops" highlighting existed.
    if (getCached("market:prices:preferredCrops") !== undefined) return;
    if (!user?.username) return;
    getOnboardingProfile(user.username)
      .then((profile) => {
        const homeState = profile?.home_location?.state;
        if (!state && homeState) setState(homeState);
        const crops = profile?.preferred_crops || [];
        setPreferredCrops(crops);
        setCached("market:prices:preferredCrops", crops);
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

  function loadPrices(skipCacheCheck) {
    if (!state) return;
    setCached("market:prices:selectedState", state);
    const cachedForState = skipCacheCheck ? undefined : getCached(`market:prices:${state}`);
    if (cachedForState === undefined) {
      setAllPrices(null);
      setSelectedCommodity("");
      setSearch("");
      setHasMore(true);
    }
    setPriceError(false);
    // If extra pages were already pulled in this session via "load more",
    // skip the background page-1 refresh — it would otherwise clobber the
    // already-loaded pages with just the first 300 records again.
    if (cachedForState && cachedForState.length > PAGE_SIZE) {
      setAllPrices(cachedForState);
      setHasMore(getCached(`market:prices:hasMore:${state}`) ?? false);
      return;
    }
    getPrices({ state, limit: PAGE_SIZE })
      .then((data) => {
        const list = data.prices || [];
        setAllPrices(list);
        setCached(`market:prices:${state}`, list);
        const more = list.length >= PAGE_SIZE;
        setHasMore(more);
        setCached(`market:prices:hasMore:${state}`, more);
      })
      .catch((err) => {
        // A 404 here means the backend genuinely has no data uploaded for
        // this state yet — that's a real empty state, not a failure.
        // Anything else (network drop, timeout, 500) is a real error and
        // must NOT be silently shown as "no data", or a farmer hitting a
        // flaky connection sees a misleading "nothing here" instead of
        // knowing they can retry.
        if (err.response?.status === 404) {
          if (cachedForState === undefined) setAllPrices([]);
        } else if (cachedForState === undefined) {
          setPriceError(true);
        }
      });
  }

  useEffect(() => {
    loadPrices(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  async function loadMore() {
    if (!state || loadingMore || !hasMore || !allPrices) return;
    setLoadingMore(true);
    try {
      const data = await getPrices({ state, limit: PAGE_SIZE, skip: allPrices.length });
      const next = data.prices || [];
      const merged = [...allPrices, ...next];
      setAllPrices(merged);
      setCached(`market:prices:${state}`, merged);
      const more = next.length >= PAGE_SIZE;
      setHasMore(more);
      setCached(`market:prices:hasMore:${state}`, more);
    } catch {
      setHasMore(false);
      setCached(`market:prices:hasMore:${state}`, false);
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => { setCached("market:prices:search", search); }, [search]);
  useEffect(() => { setCached("market:prices:selectedCommodity", selectedCommodity); }, [selectedCommodity]);

  // Unique commodities for this state, flagged when they match one of the
  // farmer's onboarding preferred_crops, sorted so preferred ones lead.
  const commodityMeta = useMemo(() => {
    if (!allPrices) return [];
    const seen = new Map(); // raw name -> lowercase name
    for (const p of allPrices) {
      if (!seen.has(p.commodity_raw)) seen.set(p.commodity_raw, p.commodity);
    }
    const prefLower = preferredCrops.map((c) => c.toLowerCase());
    const isPreferred = (lower) => prefLower.some((c) => lower.includes(c) || c.includes(lower));
    return [...seen.entries()]
      .map(([raw, lower]) => ({ raw, preferred: isPreferred(lower) }))
      .sort((a, b) => (a.preferred === b.preferred ? a.raw.localeCompare(b.raw) : a.preferred ? -1 : 1));
  }, [allPrices, preferredCrops]);

  // No cap here — show every matching commodity, the dropdown scrolls.
  // Each row carries its own vs-7-days trend for the quick visual signal.
  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q ? commodityMeta.filter((c) => c.raw.toLowerCase().includes(q)) : commodityMeta;
    return base.map((c) => ({ ...c, trend: buildTrend(c.raw, allPrices) }));
  }, [search, commodityMeta, allPrices]);

  const preferredResults = useMemo(() => searchResults.filter((c) => c.preferred), [searchResults]);
  const otherResults = useMemo(() => searchResults.filter((c) => !c.preferred), [searchResults]);

  const selectedTrend = useMemo(
    () => (selectedCommodity ? buildTrend(selectedCommodity, allPrices) : null),
    [selectedCommodity, allPrices]
  );

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
                  <>
                    {preferredResults.length > 0 && (
                      <div className="px-3.5 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-primary/70">
                        {t("market.yourCrops")}
                      </div>
                    )}
                    {preferredResults.map((c) => <CommodityRow key={c.raw} c={c} onPick={pickCommodity} />)}
                    {preferredResults.length > 0 && otherResults.length > 0 && (
                      <div className="border-t border-border my-1" />
                    )}
                    {otherResults.map((c) => <CommodityRow key={c.raw} c={c} onPick={pickCommodity} />)}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </Panel>

      {!state ? (
        <Panel className="p-8 text-center text-ink-soft">{t("market.pickState")}</Panel>
      ) : priceError ? (
        <ErrorState message={t("market.loadError")} onRetry={() => loadPrices(true)} />
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
                      <div className="font-semibold text-sm">{translateCropName(t, p.commodity_raw)}</div>
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
            {hasMore && (
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="self-center mt-1 text-sm font-semibold text-primary hover:text-primary-dark disabled:opacity-50 transition-colors duration-150"
              >
                {loadingMore ? t("market.loadingMore") : t("market.loadMore")}
              </button>
            )}
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
                  {varietyLabel(highest) && <> &middot; {varietyLabel(highest)}</>}
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
                  {varietyLabel(lowest) && <> &middot; {varietyLabel(lowest)}</>}
                </div>
              </div>
            </Panel>
          </RevealOnScroll>

          {/* Market comparison bar chart - ranked, with an average reference line */}
          {marketComparison.length > 1 && (
            <RevealOnScroll>
              <Panel className="p-5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] uppercase tracking-wide text-ink-soft">
                    {t("market.marketComparison", { commodity: translateCropName(t, selectedCommodity) })}
                  </span>
                  {selectedTrend && (
                    <span
                      className={`flex items-center gap-0.5 text-xs font-semibold ${selectedTrend.up ? "text-accent" : "text-danger"}`}
                      title={t("market.vsLastWeek")}
                    >
                      {selectedTrend.up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                      {selectedTrend.pct}%
                    </span>
                  )}
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
                      <div className="text-xs text-ink-soft mt-0.5">
                        {p.arrival_date}
                        {varietyLabel(p) && <> &middot; {varietyLabel(p)}</>}
                      </div>
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
            {hasMore && (
              <div className="flex justify-center mt-3">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="text-sm font-semibold text-primary hover:text-primary-dark disabled:opacity-50 transition-colors duration-150"
                >
                  {loadingMore ? t("market.loadingMore") : t("market.loadMore")}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}