import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sprout, RefreshCw } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Panel } from "../../components/ui/Panel";
import { RevealOnScroll } from "../../components/motion/RevealOnScroll";
import { useAuth } from "../../context/AuthContext";
import { recommendCrop } from "../../api/ml";
import { translateSoilType } from "../../utils/soilTypeLabel";
import { translateCropName } from "../../utils/cropNameLabel";

export default function CropRecommendation() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGetRecommendation() {
    setLoading(true);
    setError("");
    try {
      const data = await recommendCrop(user.username);
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
        <p className="text-sm text-ink-soft mb-4">{t("cropTools.cropAutoNote")}</p>
        <Button onClick={handleGetRecommendation} disabled={loading}>
          {loading ? (
            <>
              <RefreshCw size={16} className="animate-spin" /> {t("cropTools.analyzing")}
            </>
          ) : (
            t("cropTools.getCropRecommendation")
          )}
        </Button>
        {error && <p className="text-sm text-danger mt-3">{error}</p>}
      </Panel>

      {result && (
        <RevealOnScroll>
          <div className="mb-4 flex flex-wrap gap-2 text-xs">
            <span className="font-semibold text-accent bg-accent-tint px-2.5 py-1 rounded-full">
              {result.season}
            </span>
            <span className="font-semibold text-ink-soft bg-bg border border-border px-2.5 py-1 rounded-full">
              {translateSoilType(t, result.soil_type)}
            </span>
            {result.location && (
              <span className="font-semibold text-ink-soft bg-bg border border-border px-2.5 py-1 rounded-full">
                {result.location}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {result.top_crops.map((c, i) => (
              <Panel
                key={c.crop}
                className={`p-5 flex items-center gap-4 ${i === 0 ? "border-primary bg-primary-tint" : ""}`}
              >
                <span className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${i === 0 ? "bg-primary text-white" : "bg-bg text-ink-soft"}`}>
                  <Sprout size={20} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-lg font-semibold">{translateCropName(t, c.crop)}</div>
                  <div className="h-1.5 bg-border rounded-full mt-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${i === 0 ? "bg-primary" : "bg-ink-soft"}`}
                      style={{ width: `${c.confidence}%` }}
                    />
                  </div>
                </div>
                <span className="font-display text-xl font-semibold shrink-0">{Math.round(c.confidence)}%</span>
              </Panel>
            ))}
          </div>
        </RevealOnScroll>
      )}
    </div>
  );
}