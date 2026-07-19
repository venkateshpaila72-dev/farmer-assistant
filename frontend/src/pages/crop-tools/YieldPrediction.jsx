import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Wheat, RefreshCw, AlertTriangle } from "lucide-react";
import { Select } from "../../components/ui/Select";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Panel } from "../../components/ui/Panel";
import { Skeleton } from "../../components/ui/Skeleton";
import { RevealOnScroll } from "../../components/motion/RevealOnScroll";
import { useAuth } from "../../context/AuthContext";
import { predictYield, getYieldOptions } from "../../api/ml";

const currentYear = new Date().getFullYear();

// Formats the result for each unit group the backend can now return —
// weight/count/bale each have a genuinely different real-world unit, so
// each needs its own headline number and subtitle rather than one blended
// "yield_per_hectare" figure.
function formatResult(result, t) {
  switch (result.unit_group) {
    case "count":
      return {
        headline: `${result.total_nuts.toLocaleString("en-IN")} ${t("cropTools.nuts")}`,
        subtitle: `${result.crop} \u00b7 ${result.area_hectares} ha \u00b7 ${result.yield_nuts_per_ha.toLocaleString("en-IN")} ${t("cropTools.nutsPerHectare")}`,
      };
    case "bale":
      return {
        headline: `${result.total_bales.toLocaleString("en-IN", { maximumFractionDigits: 1 })} ${t("cropTools.bales")}`,
        subtitle: `${result.crop} \u00b7 ${result.area_hectares} ha \u00b7 ${result.yield_bales_per_ha.toLocaleString("en-IN", { maximumFractionDigits: 2 })} ${t("cropTools.perHectare")}`,
      };
    case "weight":
    default:
      return {
        headline: `${result.total_quintals.toLocaleString("en-IN", { maximumFractionDigits: 1 })} ${t("cropTools.quintals")}`,
        subtitle: `${result.crop} \u00b7 ${result.area_hectares} ha \u00b7 ${result.yield_kg_per_ha.toLocaleString("en-IN", { maximumFractionDigits: 0 })} kg ${t("cropTools.perHectare")}`,
      };
  }
}

export default function YieldPrediction() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [options, setOptions] = useState(null);
  const [form, setForm] = useState({ crop: "", season: "", year: currentYear, area_hectares: "" });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getYieldOptions()
      .then((data) => {
        setOptions(data);
        setForm((f) => ({
          ...f,
          crop: data.crops?.[0] || "",
          season: data.seasons?.[0] || "",
        }));
      })
      .catch(() => setOptions({ crops: [], seasons: [], states: [] }));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await predictYield({ username: user.username, ...form, area_hectares: parseFloat(form.area_hectares) });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.detail || t("cropTools.error"));
    } finally {
      setLoading(false);
    }
  }

  const valid = form.crop && form.season && form.year && form.area_hectares > 0;
  const formatted = result ? formatResult(result, t) : null;

  return (
    <div>
      <Panel className="p-6 mb-6">
        {options === null ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Select label={t("cropTools.crop")} value={form.crop} onChange={(e) => setForm({ ...form, crop: e.target.value })}>
                {options.crops.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
              <Select label={t("cropTools.season")} value={form.season} onChange={(e) => setForm({ ...form, season: e.target.value })}>
                {options.seasons.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
              <Input
                label={t("cropTools.year")}
                type="number"
                min="2000"
                max={currentYear + 1}
                value={form.year}
                onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) || currentYear })}
              />
              <Input
                label={t("cropTools.areaHectares")}
                type="number"
                min="0.1"
                step="0.1"
                placeholder="e.g. 1.5"
                value={form.area_hectares}
                onChange={(e) => setForm({ ...form, area_hectares: e.target.value })}
              />
            </div>
            <Button type="submit" disabled={loading || !valid} className="self-start">
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" /> {t("cropTools.analyzing")}
                </>
              ) : (
                t("cropTools.getYieldPrediction")
              )}
            </Button>
          </form>
        )}
        {error && <p className="text-sm text-danger mt-3">{error}</p>}
      </Panel>

      {result && (
        <RevealOnScroll>
          {result.out_of_range_warning && (
            <div className="flex items-start gap-2.5 bg-danger-tint text-danger rounded-sm px-4 py-3 text-sm mb-3">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{t("cropTools.outOfRangeWarning")}</span>
            </div>
          )}
          <Panel className="p-6 border-primary bg-primary-tint text-center">
            <span className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center mx-auto mb-3">
              <Wheat size={22} />
            </span>
            <div className="font-display text-3xl font-semibold mb-1">{formatted.headline}</div>
            <div className="text-sm text-primary font-semibold">{formatted.subtitle}</div>
          </Panel>
        </RevealOnScroll>
      )}
    </div>
  );
}