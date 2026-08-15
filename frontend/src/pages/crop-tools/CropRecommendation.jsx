import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Sprout, ChevronDown, Thermometer, Droplets, CloudRain, FlaskConical, Crown } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Panel } from "../../components/ui/Panel";
import { ConfidenceRing } from "../../components/ui/ConfidenceRing";
import { RevealOnScroll } from "../../components/motion/RevealOnScroll";
import { useAuth } from "../../context/AuthContext";
import { recommendCrop } from "../../api/ml";
import { translateSoilType } from "../../utils/soilTypeLabel";
import { translateCropName } from "../../utils/cropNameLabel";

const easeOut = [0.16, 1, 0.3, 1];

// The 7 raw factors the ML model was fed (backend's `inputs_used`), each
// with an icon + the translation key for its label. Same set of inputs
// drove every one of the top_crops predictions — expanding any card shows
// this, just framed around that card's own confidence score.
const INPUT_FACTORS = [
  { key: "N",           labelKey: "cropTools.nitrogen",   unit: "",     Icon: FlaskConical },
  { key: "P",           labelKey: "cropTools.phosphorus", unit: "",     Icon: FlaskConical },
  { key: "K",           labelKey: "cropTools.potassium",  unit: "",     Icon: FlaskConical },
  { key: "ph",          labelKey: "cropTools.phLevel",    unit: "",     Icon: FlaskConical },
  { key: "temperature", labelKey: "cropTools.temperature",unit: "°C",   Icon: Thermometer },
  { key: "humidity",    labelKey: "cropTools.humidity",   unit: "%",    Icon: Droplets },
  { key: "rainfall",    labelKey: "cropTools.rainfall",   unit: "mm",   Icon: CloudRain },
];

export default function CropRecommendation() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedCrop, setExpandedCrop] = useState(null);

  async function handleGetRecommendation() {
    setLoading(true);
    setError("");
    try {
      const data = await recommendCrop(user.username);
      setResult(data);
      setExpandedCrop(null);
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
        <Button onClick={handleGetRecommendation} loading={loading}>
          {t("cropTools.getCropRecommendation")}
        </Button>
        {error && (
          <motion.p initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} className="text-sm text-danger mt-3">
            {error}
          </motion.p>
        )}
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
            {result.top_crops.map((c, i) => {
              const isOpen = expandedCrop === c.crop;
              const isBest = i === 0;
              return (
                <motion.div
                  key={c.crop}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.08, ease: easeOut }}
                >
                  <Panel
                    className={`overflow-hidden transition-shadow duration-200 ${isBest ? "border-primary bg-primary-tint shadow-sm" : "hover:shadow-sm"}`}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedCrop(isOpen ? null : c.crop)}
                      aria-expanded={isOpen}
                      className="w-full p-5 flex items-center gap-4 text-left"
                    >
                      <div className="relative shrink-0">
                        <ConfidenceRing
                          value={c.confidence}
                          size={48}
                          stroke={4}
                          color={isBest ? "rgb(154,52,18)" : "rgb(91,81,64)"}
                          trackColor={isBest ? "rgba(154,52,18,0.15)" : "rgba(91,81,64,0.12)"}
                        />
                        {isBest && (
                          <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center">
                            <Crown size={11} />
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-display text-lg font-semibold flex items-center gap-2">
                          {translateCropName(t, c.crop)}
                          {isBest && (
                            <span className="text-[10px] font-bold uppercase tracking-wide text-primary bg-white/70 rounded-full px-2 py-0.5">
                              {t("cropTools.bestMatch")}
                            </span>
                          )}
                        </div>
                        <div className="h-1.5 bg-border rounded-full mt-1.5 overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full ${isBest ? "bg-primary" : "bg-ink-soft"}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${c.confidence}%` }}
                            transition={{ duration: 0.6, delay: 0.15 + i * 0.08, ease: easeOut }}
                          />
                        </div>
                      </div>
                      <ChevronDown
                        size={18}
                        className={`shrink-0 text-ink-soft transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                      />
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: easeOut }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-5 pt-1 border-t border-border/60">
                            <p className="text-xs text-ink-soft mt-3 mb-3">
                              {t("cropTools.whyExplain", { crop: translateCropName(t, c.crop) })}
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              {INPUT_FACTORS.map(({ key, labelKey, unit, Icon }) => (
                                <div key={key} className="bg-bg rounded-lg p-3 flex flex-col gap-1">
                                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-soft">
                                    <Icon size={12} /> {t(labelKey)}
                                  </div>
                                  <div className="font-display text-sm font-semibold">
                                    {result.inputs_used?.[key]}{unit}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Panel>
                </motion.div>
              );
            })}
          </div>
        </RevealOnScroll>
      )}
    </div>
  );
}