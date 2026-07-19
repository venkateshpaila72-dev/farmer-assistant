import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FlaskConical, RefreshCw, AlertTriangle } from "lucide-react";
import { Select } from "../../components/ui/Select";
import { Button } from "../../components/ui/Button";
import { Panel } from "../../components/ui/Panel";
import { Skeleton } from "../../components/ui/Skeleton";
import { RevealOnScroll } from "../../components/motion/RevealOnScroll";
import { useAuth } from "../../context/AuthContext";
import { recommendFertilizer, getFertilizerTypes } from "../../api/ml";

export default function FertilizerSuggestion() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [cropTypes, setCropTypes] = useState(null);
  const [cropType, setCropType] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getFertilizerTypes()
      .then((data) => {
        setCropTypes(data.crop_types || []);
        if (data.crop_types?.length) setCropType(data.crop_types[0]);
      })
      .catch(() => setCropTypes([]));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await recommendFertilizer(user.username, cropType);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.detail || t("cropTools.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Panel className="p-6 mb-6">
        <p className="text-sm text-ink-soft mb-4">{t("cropTools.fertilizerAutoNote")}</p>
        {cropTypes === null ? (
          <Skeleton className="h-11 w-full" />
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <Select value={cropType} onChange={(e) => setCropType(e.target.value)} className="sm:flex-1">
              {cropTypes.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
            <Button type="submit" disabled={loading || !cropType}>
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" /> {t("cropTools.analyzing")}
                </>
              ) : (
                t("cropTools.getFertilizerSuggestion")
              )}
            </Button>
          </form>
        )}
        {error && <p className="text-sm text-danger mt-3">{error}</p>}
      </Panel>

      {result && (
        <RevealOnScroll>
          <div className="flex flex-col gap-3">
            {result.recommendations.map((rec, i) => (
              <Panel
                key={rec.fertilizer}
                className={`p-5 flex items-center gap-4 ${i === 0 ? "border-primary bg-primary-tint" : ""}`}
              >
                <span className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${i === 0 ? "bg-primary text-white" : "bg-bg text-ink-soft"}`}>
                  <FlaskConical size={20} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg font-semibold">{rec.fertilizer}</span>
                    {rec.low_sample && (
                      <span title={t("cropTools.lowSampleNote")}>
                        <AlertTriangle size={14} className="text-danger shrink-0" />
                      </span>
                    )}
                  </div>
                  <div className="h-1.5 bg-border rounded-full mt-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${i === 0 ? "bg-primary" : "bg-ink-soft"}`}
                      style={{ width: `${rec.confidence}%` }}
                    />
                  </div>
                </div>
                <span className="font-display text-xl font-semibold shrink-0">{Math.round(rec.confidence)}%</span>
              </Panel>
            ))}
          </div>

          <Panel className="p-4 mt-4 bg-bg">
            <div className="text-[11px] uppercase tracking-wide text-ink-soft mb-2">{t("cropTools.npkDeficit")}</div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <span className="text-ink-soft">N: </span>
                <span className="font-semibold">{result.deficits.N > 0 ? "+" : ""}{result.deficits.N}</span>
              </div>
              <div>
                <span className="text-ink-soft">P: </span>
                <span className="font-semibold">{result.deficits.P > 0 ? "+" : ""}{result.deficits.P}</span>
              </div>
              <div>
                <span className="text-ink-soft">K: </span>
                <span className="font-semibold">{result.deficits.K > 0 ? "+" : ""}{result.deficits.K}</span>
              </div>
            </div>
            <p className="text-xs text-ink-soft mt-2">{t("cropTools.deficitExplain")}</p>
          </Panel>
        </RevealOnScroll>
      )}
    </div>
  );
}