import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Bug, CheckCircle2, RefreshCw, FlaskConical } from "lucide-react";
import { ImageUpload } from "../../components/ui/ImageUpload";
import { Button } from "../../components/ui/Button";
import { Panel } from "../../components/ui/Panel";
import { RevealOnScroll } from "../../components/motion/RevealOnScroll";
import { useAuth } from "../../context/AuthContext";
import { detectDisease } from "../../api/vision";

export default function DiseaseDetection() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await detectDisease(user.username, file);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.detail || t("vision.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Panel className="p-6 mb-6">
        <p className="text-sm text-ink-soft mb-4">{t("vision.diseaseNote")}</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <ImageUpload onFileSelect={setFile} disabled={loading} label={t("vision.uploadLeafPhoto")} />
          <Button type="submit" disabled={!file || loading} className="self-start">
            {loading ? (
              <>
                <RefreshCw size={16} className="animate-spin" /> {t("vision.analyzing")}
              </>
            ) : (
              t("vision.checkPhoto")
            )}
          </Button>
        </form>
        {error && <p className="text-sm text-danger mt-3">{error}</p>}
      </Panel>

      {result && (
        <RevealOnScroll>
          {result.is_healthy ? (
            <Panel className="p-6 border-accent bg-accent-tint text-center">
              <span className="w-12 h-12 rounded-full bg-accent text-white flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={22} />
              </span>
              <div className="font-display text-2xl font-semibold text-accent mb-1">{t("vision.healthy")}</div>
              <div className="text-sm text-accent">{Math.round(result.confidence)}% {t("cropTools.confidence")}</div>
            </Panel>
          ) : (
            <>
              <Panel className="p-6 border-danger bg-danger-tint mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-11 h-11 rounded-full bg-danger text-white flex items-center justify-center shrink-0">
                    <Bug size={20} />
                  </span>
                  <div>
                    <div className="font-display text-xl font-semibold text-danger">{result.disease}</div>
                    <div className="text-xs text-danger font-semibold">
                      {result.severity} &middot; {Math.round(result.confidence)}% {t("cropTools.confidence")}
                    </div>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-danger/80 mb-1">{t("vision.treatment")}</div>
                    <div className="font-medium text-ink">{result.treatment}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-danger/80 mb-1">{t("vision.prevention")}</div>
                    <div className="font-medium text-ink">{result.prevention}</div>
                  </div>
                </div>
              </Panel>

              {result.fertilizer?.applicable && result.fertilizer.related_fertilizers?.length > 0 && (
                <div className="mb-4">
                  <div className="text-[11px] uppercase tracking-wide text-ink-soft mb-2">
                    {t("vision.relatedFertilizers")}
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {result.fertilizer.related_fertilizers.map((f, i) => (
                      <Panel
                        key={f.name}
                        className={`p-4 flex items-start gap-3 ${i === 0 ? "border-accent bg-accent-tint" : ""}`}
                      >
                        <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${i === 0 ? "bg-accent text-white" : "bg-bg text-ink-soft"}`}>
                          <FlaskConical size={16} />
                        </span>
                        <div className="min-w-0">
                          <div className={`font-display font-semibold ${i === 0 ? "text-accent" : "text-ink"}`}>{f.name}</div>
                          <p className="text-sm text-ink-soft mt-0.5">{f.reason}</p>
                        </div>
                      </Panel>
                    ))}
                  </div>
                </div>
              )}

              {result.fertilizer && !result.fertilizer.applicable && (
                <Panel className="p-4 mb-4 bg-bg">
                  <div className="text-[11px] uppercase tracking-wide text-ink-soft mb-1.5">{t("vision.fertilizer")}</div>
                  <p className="text-sm text-ink-soft">{result.fertilizer.note}</p>
                </Panel>
              )}

              {result.top3?.length > 0 && (
                <Panel className="p-4">
                  <div className="text-[11px] uppercase tracking-wide text-ink-soft mb-2">{t("vision.otherPossibilities")}</div>
                  <div className="flex flex-col gap-2">
                    {result.top3.map((item) => (
                      <div key={item.class} className="flex items-center justify-between text-sm">
                        <span>{item.class}</span>
                        <span className="text-ink-soft">{Math.round(item.confidence)}%</span>
                      </div>
                    ))}
                  </div>
                </Panel>
              )}
            </>
          )}
        </RevealOnScroll>
      )}
    </div>
  );
}