import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { AuthLayout } from "../../layouts/AuthLayout";
import { Panel } from "../../components/ui/Panel";
import { Button } from "../../components/ui/Button";
import { useAuth } from "../../context/AuthContext";
import { saveOnboarding } from "../../api/onboarding";
import { LanguageStep } from "./steps/LanguageStep";
import { SoilTypeStep } from "./steps/SoilTypeStep";
import { FarmSizeStep } from "./steps/FarmSizeStep";
import { CropsStep } from "./steps/CropsStep";
import { IrrigationStep } from "./steps/IrrigationStep";
import { ProblemStep } from "./steps/ProblemStep";
import { LocationStep } from "./steps/LocationStep";

// Language goes first on purpose — everything after it should render in the
// language the farmer just picked, not just get saved for later.
const STEPS = ["chat_language", "soil_type", "farm_acres", "preferred_crops", "irrigation_type", "main_problem", "home_location"];

const initial = {
  chat_language: "English",
  soil_type: "",
  farm_acres: "",
  preferred_crops: [],
  irrigation_type: "",
  main_problem: "",
  home_location: { state: "", district: "", village: "", lat: null, lng: null },
};

function isStepValid(key, data) {
  switch (key) {
    case "chat_language": return !!data.chat_language;
    case "soil_type": return !!data.soil_type;
    case "farm_acres": return !!data.farm_acres && data.farm_acres > 0;
    case "preferred_crops": return data.preferred_crops.length > 0;
    case "irrigation_type": return !!data.irrigation_type;
    case "main_problem": return !!data.main_problem;
    case "home_location": {
      const loc = data.home_location;
      return !!(loc.state && loc.district && loc.village && loc.lat && loc.lng);
    }
    default: return true;
  }
}

export default function OnboardingFlow() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [data, setData] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const stepKey = STEPS[stepIndex];
  const valid = isStepValid(stepKey, data);
  const isLast = stepIndex === STEPS.length - 1;

  async function handleNext() {
    if (!isLast) {
      setStepIndex((i) => i + 1);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await saveOnboarding({ username: user.username, ...data });
      toast.success(t("onboarding.saved"));
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || t("onboarding.saveError"));
    } finally {
      setSubmitting(false);
    }
  }

  function renderStep() {
    switch (stepKey) {
      case "chat_language":
        return <LanguageStep value={data.chat_language} onChange={(v) => setData({ ...data, chat_language: v })} />;
      case "soil_type":
        return <SoilTypeStep value={data.soil_type} onChange={(v) => setData({ ...data, soil_type: v })} />;
      case "farm_acres":
        return <FarmSizeStep value={data.farm_acres} onChange={(v) => setData({ ...data, farm_acres: v })} />;
      case "preferred_crops":
        return <CropsStep value={data.preferred_crops} onChange={(v) => setData({ ...data, preferred_crops: v })} />;
      case "irrigation_type":
        return <IrrigationStep value={data.irrigation_type} onChange={(v) => setData({ ...data, irrigation_type: v })} />;
      case "main_problem":
        return <ProblemStep value={data.main_problem} onChange={(v) => setData({ ...data, main_problem: v })} />;
      case "home_location":
        return <LocationStep value={data.home_location} onChange={(v) => setData({ ...data, home_location: v })} />;
      default:
        return null;
    }
  }

  return (
    <AuthLayout maxWidth="max-w-lg">
      <div className="flex gap-1.5 mb-6">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i <= stepIndex ? "bg-primary" : "bg-border"}`}
          />
        ))}
      </div>

      <Panel className="p-6">
        {renderStep()}
        {error && <p className="text-sm text-danger mt-4">{error}</p>}
        <div className="flex justify-between items-center mt-7">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            disabled={stepIndex === 0}
            className={stepIndex === 0 ? "invisible" : ""}
          >
            <ArrowLeft size={16} /> {t("onboarding.back")}
          </Button>
          <Button type="button" onClick={handleNext} disabled={!valid || submitting}>
            {submitting ? t("onboarding.saving") : isLast ? t("onboarding.finish") : t("onboarding.next")}
            {!submitting && <ArrowRight size={16} />}
          </Button>
        </div>
      </Panel>
    </AuthLayout>
  );
}