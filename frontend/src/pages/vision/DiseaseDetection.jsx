import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Bug, CheckCircle2, RefreshCw, FlaskConical, ShieldCheck, Stethoscope } from "lucide-react";
import { ImageUpload } from "../../components/ui/ImageUpload";
import { Button } from "../../components/ui/Button";
import { Panel } from "../../components/ui/Panel";
import { ConfidenceRing } from "../../components/ui/ConfidenceRing";
import { useAuth } from "../../context/AuthContext";
import { detectDisease } from "../../api/vision";

const easeOut = [0.16, 1, 0.3, 1];

// Maps whatever casing the backend sends ("Low"/"low"/"High"...) to a
// consistent color so the severity badge always reads correctly at a
// glance, without depending on the backend's exact string casing.
function severityTone(severity) {
  const s = (severity || "").toLowerCase();
  if (s.includes("high") || s.includes("severe")) return { bg: "bg-danger", text: "text-danger", tint: "bg-danger-tint" };
  if (s.includes("medium") || s.includes("moderate")) return { bg: "bg-amber-500", text: "text-amber-700", tint: "bg-amber-50" };
  if (s.includes("low")) return { bg: "bg-accent", text: "text-accent", tint: "bg-accent-tint" };
  return { bg: "bg-ink-soft", text: "text-ink-soft", tint: "bg-bg" };
}

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
          <Button type="submit" disabled={!file} loading={loading} className="self-start">
            {t("vision.checkPhoto")}
          </Button>
        </form>
        {error && (
          <motion.p initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} className="text-sm text-danger mt-3">
            {error}
          </motion.p>
        )}
      </Panel>

      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key={result.is_healthy ? "healthy" : result.disease}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: easeOut }}
          >
            {result.is_healthy ? (
              <Panel className="p-8 border-accent bg-accent-tint text-center overflow-hidden relative">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
                  className="w-16 h-16 rounded-full bg-accent text-white flex items-center justify-center mx-auto mb-4"
                >
                  <CheckCircle2 size={28} />
                </motion.div>
                <div className="font-display text-2xl font-semibold text-accent mb-2">{t("vision.healthy")}</div>
                <div className="flex justify-center">
                  <ConfidenceRing value={result.confidence} size={56} color="rgb(22,101,52)" trackColor="rgba(22,101,52,0.15)" />
                </div>
              </Panel>
            ) : (
              <>
                <Panel className="p-6 border-danger bg-danger-tint mb-4">
                  <div className="flex items-center gap-4 mb-4">
                    <motion.span
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 320, damping: 18 }}
                      className="w-12 h-12 rounded-full bg-danger text-white flex items-center justify-center shrink-0"
                    >
                      <Bug size={22} />
                    </motion.span>
                    <div className="flex-1 min-w-0">
                      <div className="font-display text-xl font-semibold text-danger">{result.disease}</div>
                      {result.severity && (
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide ${severityTone(result.severity).text} ${severityTone(result.severity).tint} rounded-full px-2 py-0.5 mt-1`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${severityTone(result.severity).bg}`} />
                          {result.severity}
                        </span>
                      )}
                    </div>
                    <ConfidenceRing value={result.confidence} size={52} color="rgb(180,35,24)" trackColor="rgba(180,35,24,0.15)" />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4 text-sm">
                    <div className="flex gap-2.5">
                      <Stethoscope size={16} className="text-danger shrink-0 mt-0.5" />
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-danger/80 mb-1">{t("vision.treatment")}</div>
                        <div className="font-medium text-ink">{result.treatment}</div>
                      </div>
                    </div>
                    <div className="flex gap-2.5">
                      <ShieldCheck size={16} className="text-danger shrink-0 mt-0.5" />
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-danger/80 mb-1">{t("vision.prevention")}</div>
                        <div className="font-medium text-ink">{result.prevention}</div>
                      </div>
                    </div>
                  </div>
                </Panel>

                {result.fertilizer?.applicable && result.fertilizer.related_fertilizers?.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.15, ease: easeOut }}
                    className="mb-4"
                  >
                    <div className="text-[11px] uppercase tracking-wide text-ink-soft mb-2">
                      {t("vision.relatedFertilizers")}
                    </div>
                    <div className="flex flex-col gap-2.5">
                      {result.fertilizer.related_fertilizers.map((f, i) => (
                        <Panel
                          key={f.name}
                          className={`p-4 flex items-start gap-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm ${i === 0 ? "border-accent bg-accent-tint" : ""}`}
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
                  </motion.div>
                )}

                {result.fertilizer && !result.fertilizer.applicable && (
                  <Panel className="p-4 mb-4 bg-bg">
                    <div className="text-[11px] uppercase tracking-wide text-ink-soft mb-1.5">{t("vision.fertilizer")}</div>
                    <p className="text-sm text-ink-soft">{result.fertilizer.note}</p>
                  </Panel>
                )}

                {result.top3?.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.25, ease: easeOut }}
                  >
                    <Panel className="p-4">
                      <div className="text-[11px] uppercase tracking-wide text-ink-soft mb-3">{t("vision.otherPossibilities")}</div>
                      <div className="flex flex-col gap-3">
                        {result.top3.map((item) => (
                          <div key={item.class}>
                            <div className="flex justify-between text-sm mb-1">
                              <span>{item.class}</span>
                              <span className="text-ink-soft">{Math.round(item.confidence)}%</span>
                            </div>
                            <div className="h-1.5 bg-border rounded-full overflow-hidden">
                              <motion.div
                                className="h-full bg-ink-soft rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${item.confidence}%` }}
                                transition={{ duration: 0.5, ease: easeOut }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </Panel>
                  </motion.div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}