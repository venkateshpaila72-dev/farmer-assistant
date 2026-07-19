import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { Layers, Sprout, RefreshCw } from "lucide-react";
import { ImageUpload } from "../../components/ui/ImageUpload";
import { Button } from "../../components/ui/Button";
import { Panel } from "../../components/ui/Panel";
import { RevealOnScroll } from "../../components/motion/RevealOnScroll";
import { useAuth } from "../../context/AuthContext";
import { classifySoil } from "../../api/vision";
import { recommendCrop } from "../../api/ml";

const easeOut = [0.16, 1, 0.3, 1];

export default function SoilClassification() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [soilResult, setSoilResult] = useState(null);
  const [cropResult, setCropResult] = useState(null);
  const [cropsLoading, setCropsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError("");
    setSoilResult(null);
    setCropResult(null);
    try {
      // update_profile=false — this is a preview only. Changing the
      // farmer's actual saved soil type is a deliberate separate action,
      // handled later from the Profile tab, not implied by checking a photo.
      const soil = await classifySoil(user.username, file, false);
      setSoilResult(soil);
      setLoading(false);

      // Crop recommendations load in as their own step, right after the
      // soil result appears, so the "loading -> reveal" animation reads as
      // two connected beats rather than one flat instant result.
      setCropsLoading(true);
      const crop = await recommendCrop(user.username, soil.soil_type);
      setCropResult(crop);
    } catch (err) {
      setError(err.response?.data?.detail || t("vision.error"));
    } finally {
      setLoading(false);
      setCropsLoading(false);
    }
  }

  const probs = soilResult?.all_probabilities
    ? Object.entries(soilResult.all_probabilities).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <div>
      <Panel className="p-6 mb-6">
        <p className="text-sm text-ink-soft mb-4">{t("vision.soilNote")}</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <ImageUpload onFileSelect={setFile} disabled={loading} label={t("vision.uploadSoilPhoto")} />
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

      <AnimatePresence>
        {soilResult && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easeOut }}
            className="grid md:grid-cols-2 gap-4 items-start"
          >
            {/* Left: soil result */}
            <div className="flex flex-col gap-4">
              <Panel className="p-6 border-primary bg-primary-tint text-center">
                <span className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center mx-auto mb-3">
                  <Layers size={22} />
                </span>
                <div className="font-display text-2xl font-semibold mb-1">{soilResult.soil_type}</div>
                <div className="text-sm text-primary font-semibold">
                  {Math.round(soilResult.confidence)}% {t("cropTools.confidence")}
                </div>
              </Panel>

              {probs.length > 0 && (
                <Panel className="p-4">
                  <div className="text-[11px] uppercase tracking-wide text-ink-soft mb-3">{t("vision.allProbabilities")}</div>
                  <div className="flex flex-col gap-2.5">
                    {probs.map(([soil, prob], i) => (
                      <motion.div
                        key={soil}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.35, delay: 0.1 + i * 0.05, ease: easeOut }}
                      >
                        <div className="flex justify-between text-sm mb-1">
                          <span>{soil}</span>
                          <span className="text-ink-soft">{Math.round(prob)}%</span>
                        </div>
                        <div className="h-1.5 bg-border rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-primary rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${prob}%` }}
                            transition={{ duration: 0.5, delay: 0.15 + i * 0.05, ease: easeOut }}
                          />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </Panel>
              )}
            </div>

            {/* Right: crop recommendations for this soil */}
            <div>
              <div className="text-sm font-semibold text-ink-soft uppercase tracking-wide mb-3">
                {t("vision.cropsForThisSoil")}
              </div>

              {cropsLoading && (
                <div className="flex flex-col gap-3">
                  {[0, 1, 2].map((i) => (
                    <Panel key={i} className="p-4 h-[68px] animate-pulse bg-bg" />
                  ))}
                </div>
              )}

              {cropResult && (
                <div className="flex flex-col gap-3">
                  {cropResult.top_crops.map((c, i) => (
                    <motion.div
                      key={c.crop}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.2 + i * 0.08, ease: easeOut }}
                    >
                      <Panel className={`p-4 flex items-center gap-4 ${i === 0 ? "border-primary bg-primary-tint" : ""}`}>
                        <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${i === 0 ? "bg-primary text-white" : "bg-bg text-ink-soft"}`}>
                          <Sprout size={16} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-display font-semibold">{c.crop}</div>
                          <div className="h-1.5 bg-border rounded-full mt-1 overflow-hidden">
                            <motion.div
                              className={`h-full rounded-full ${i === 0 ? "bg-primary" : "bg-ink-soft"}`}
                              initial={{ width: 0 }}
                              animate={{ width: `${c.confidence}%` }}
                              transition={{ duration: 0.5, delay: 0.3 + i * 0.08, ease: easeOut }}
                            />
                          </div>
                        </div>
                        <span className="font-semibold shrink-0">{Math.round(c.confidence)}%</span>
                      </Panel>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}