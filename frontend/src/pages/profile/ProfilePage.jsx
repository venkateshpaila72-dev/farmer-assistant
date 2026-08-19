import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { LogOut, User, MapPin, Calendar, Sparkles, Pencil, X } from "lucide-react";
import { Panel } from "../../components/ui/Panel";
import { Button } from "../../components/ui/Button";
import { Skeleton } from "../../components/ui/Skeleton";
import { ErrorState } from "../../components/ui/ErrorState";
import { ImageUpload } from "../../components/ui/ImageUpload";
import { RevealOnScroll } from "../../components/motion/RevealOnScroll";
import { useAuth } from "../../context/AuthContext";
import { getFarmerProfile } from "../../api/users";
import { getOnboardingProfile, saveOnboarding } from "../../api/onboarding";
import { classifySoil } from "../../api/vision";
import { LanguageStep } from "../onboarding/steps/LanguageStep";
import { SoilTypeStep } from "../onboarding/steps/SoilTypeStep";
import { FarmSizeStep } from "../onboarding/steps/FarmSizeStep";
import { CropsStep } from "../onboarding/steps/CropsStep";
import { IrrigationStep } from "../onboarding/steps/IrrigationStep";
import { ProblemStep } from "../onboarding/steps/ProblemStep";
import { LocationStep } from "../onboarding/steps/LocationStep";
import { WhatsAppOptInCard } from "../../components/whatsapp/WhatsAppOptInCard";

// The soil-image classifier's 5 output classes don't perfectly overlap with
// onboarding's 7-option list (see backend routes/ml.py for the full story).
// "Black Soil" and "Laterite Soil" map cleanly. The other 3 are the same
// best-effort approximations the backend already uses elsewhere, so a
// detected soil resolves consistently everywhere in the app — but they're
// shown to the farmer as a suggestion to confirm, never applied silently.
const CLASSIFIER_TO_ONBOARDING = {
  "Black Soil":    "Black",
  "Laterite Soil": "Laterite",
  "Cinder Soil":   "Sandy",     // approximation — no exact equivalent
  "Peat Soil":     "Clay",      // approximation — no exact equivalent
  "Yellow Soil":   "Laterite",  // approximation — no exact equivalent
};

// Click-to-edit pattern: every field shows as a plain read-only row by
// default (label + current value + an Edit button). Clicking Edit swaps
// that ONE row for the actual editable control (reusing onboarding's step
// components) plus Save/Cancel scoped to just that field. Only one field
// can be open at a time — keeps the page calm instead of showing 7 open
// forms at once.
//
// There's no per-field backend endpoint — POST /onboarding/save is a full
// upsert, same as onboarding uses. So "saving one field" still sends the
// whole form underneath; the UI just makes it feel scoped to what you
// actually touched, and reverts cleanly on Cancel since editing happens
// on a working copy, not the last-saved values.

function emptyLocation() {
  return { state: "", district: "", village: "", lat: null, lng: null };
}

function FieldRow({ label, value, onEdit }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="min-w-0">
        <div className="text-xs text-ink-soft mb-0.5">{label}</div>
        <div className="text-sm font-medium text-ink truncate">{value}</div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-dark transition-colors duration-150"
      >
        <Pencil size={13} />
      </button>
    </div>
  );
}

export default function ProfilePage() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  const [account, setAccount] = useState(null);
  const [savedForm, setSavedForm] = useState(null); // last known-saved values
  const [form, setForm] = useState(null);            // working copy, mutated while a field is open
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [detecting, setDetecting] = useState(false);
  const [detection, setDetection] = useState(null);

  useEffect(() => {
    if (!user?.username) return;
    setLoading(true);
    setLoadError(false);
    Promise.all([getFarmerProfile(user.username), getOnboardingProfile(user.username)])
      .then(([acc, onboarding]) => {
        setAccount(acc);
        const loaded = {
          chat_language:    onboarding.chat_language || "English",
          soil_type:        onboarding.soil_type || "",
          farm_acres:       onboarding.farm_acres ?? "",
          preferred_crops:  onboarding.preferred_crops || [],
          irrigation_type:  onboarding.irrigation_type || "",
          main_problem:     onboarding.main_problem || "",
          home_location:    onboarding.home_location || emptyLocation(),
        };
        setSavedForm(loaded);
        setForm(loaded);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [user?.username]);

  function update(field) {
    return (value) => setForm((f) => ({ ...f, [field]: value }));
  }

  function startEdit(field) {
    setDetection(null);
    setEditingField(field);
  }

  function cancelEdit() {
    setForm(savedForm); // discard any in-progress changes to the open field
    setDetection(null);
    setEditingField(null);
  }

  async function saveField() {
    setSaving(true);
    try {
      await saveOnboarding({ username: user.username, ...form });
      setSavedForm(form);
      setEditingField(null);
      setDetection(null);
      toast.success(t("profile.saved"));
    } catch (err) {
      toast.error(err.response?.data?.detail || t("profile.saveError"));
    } finally {
      setSaving(false);
    }
  }

  // Applies the detected soil tile immediately (no separate confirm click
  // required) — the farmer can still tap a different tile themselves if
  // they disagree with the detection, same as picking manually. Requiring
  // a manual "Use X" click before Save was too easy to miss: it's what
  // caused a correct detection to silently not get saved.
  async function handleDetectSoil(file) {
    setDetection(null);
    if (!file) return;
    setDetecting(true);
    try {
      const result = await classifySoil(user.username, file, false);
      const mapped = CLASSIFIER_TO_ONBOARDING[result.soil_type] || null;
      setDetection({ raw: result.soil_type, confidence: result.confidence, mapped });
      if (mapped) update("soil_type")(mapped);
    } catch (err) {
      toast.error(err.response?.data?.detail || t("profile.soilDetectError"));
    } finally {
      setDetecting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-5 md:p-8 max-w-3xl mx-auto flex flex-col gap-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (loadError || !form) {
    return (
      <div className="p-5 md:p-8">
        <ErrorState message={t("profile.loadError")} />
      </div>
    );
  }

  const langLabels = { English: "English", Hindi: "हिन्दी", Telugu: "తెలుగు", Tamil: "தமிழ்", Kannada: "ಕನ್ನಡ", Marathi: "मराठी", Bengali: "বাংলা", Punjabi: "ਪੰਜਾਬੀ" };
  const locationSummary = [form.home_location.village, form.home_location.district, form.home_location.state]
    .filter(Boolean).join(", ") || t("profile.notSet");

  const fields = [
    {
      key: "chat_language", label: t("languageStep.title"),
      value: langLabels[form.chat_language] || form.chat_language,
      edit: <LanguageStep value={form.chat_language} onChange={update("chat_language")} />,
    },
    {
      key: "soil_type", label: t("soilStep.title"),
      value: form.soil_type || t("profile.notSet"),
      edit: (
        <>
          <SoilTypeStep value={form.soil_type} onChange={update("soil_type")} />
          <div className="mt-5 pt-5 border-t border-border">
            <p className="text-sm font-semibold text-ink flex items-center gap-1.5 mb-1">
              <Sparkles size={14} className="text-primary" />
              {t("profile.detectSoilTitle")}
            </p>
            <p className="text-xs text-ink-soft mb-3">{t("profile.detectSoilSubtitle")}</p>
            <ImageUpload onFileSelect={handleDetectSoil} disabled={detecting} label={t("profile.detectSoilUpload")} />
            {detecting && <p className="text-xs text-ink-soft mt-2">{t("profile.detecting")}</p>}
            {detection && (
              <div className="mt-3 flex items-center gap-2 flex-wrap p-3 rounded-sm bg-bg border border-border text-sm">
                <span className="text-ink-soft">{t("profile.detectedAs")}</span>
                <span className="font-semibold text-ink">{detection.raw}</span>
                <span className="text-ink-soft">({detection.confidence.toFixed(1)}%)</span>
                {detection.mapped ? (
                  <span className="text-accent font-medium">{t("profile.setTo", { soil: detection.mapped })}</span>
                ) : (
                  <span className="text-danger">{t("profile.noExactMatch")}</span>
                )}
              </div>
            )}
          </div>
        </>
      ),
    },
    {
      key: "farm_acres", label: t("farmSizeStep.title"),
      value: form.farm_acres ? `${form.farm_acres} ${t("profile.acres")}` : t("profile.notSet"),
      edit: <FarmSizeStep value={form.farm_acres} onChange={update("farm_acres")} />,
    },
    {
      key: "preferred_crops", label: t("cropsStep.title"),
      value: form.preferred_crops.length ? form.preferred_crops.join(", ") : t("profile.notSet"),
      edit: <CropsStep value={form.preferred_crops} onChange={update("preferred_crops")} />,
    },
    {
      key: "irrigation_type", label: t("irrigationStep.title"),
      value: form.irrigation_type || t("profile.notSet"),
      edit: <IrrigationStep value={form.irrigation_type} onChange={update("irrigation_type")} />,
    },
    {
      key: "main_problem", label: t("problemStep.title"),
      value: form.main_problem || t("profile.notSet"),
      edit: <ProblemStep value={form.main_problem} onChange={update("main_problem")} />,
    },
    {
      key: "home_location", label: t("locationStep.title"),
      value: locationSummary,
      edit: <LocationStep value={form.home_location} onChange={update("home_location")} />,
    },
  ];

  return (
    <div className="p-5 md:p-8 max-w-3xl mx-auto flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">{t("profile.title")}</h1>
        <p className="text-sm text-ink-soft mt-1">{t("profile.subtitle")}</p>
      </div>

      <RevealOnScroll>
        <Panel className="p-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary-tint text-primary flex items-center justify-center shrink-0">
              <User size={24} />
            </div>
            <div className="min-w-0">
              <div className="font-display text-lg font-semibold text-ink truncate">{account.username}</div>
              <div className="text-sm text-ink-soft flex items-center gap-1.5 mt-0.5 truncate">
                <MapPin size={13} className="shrink-0" />
                <span className="truncate">{[account.village, account.city, account.state].filter(Boolean).join(", ")}</span>
              </div>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mt-5 pt-5 border-t border-border text-sm">
            <div className="flex items-center justify-between sm:justify-start sm:gap-2">
              <span className="text-ink-soft">{t("profile.phone")}</span>
              <span className="font-medium text-ink">{account.phone}</span>
            </div>
            {account.created_at && (
              <div className="flex items-center justify-between sm:justify-start sm:gap-2">
                <span className="text-ink-soft flex items-center gap-1"><Calendar size={13} /> {t("profile.memberSince")}</span>
                <span className="font-medium text-ink">{new Date(account.created_at).toLocaleDateString()}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-ink-soft mt-4">{t("profile.accountReadOnlyNote")}</p>
        </Panel>
      </RevealOnScroll>

      <RevealOnScroll delay={0.05}>
        <WhatsAppOptInCard />
      </RevealOnScroll>

      <RevealOnScroll delay={0.1}>
        <Panel className="p-5 flex flex-col divide-y divide-border">
          {fields.map((f) => (
            <div key={f.key} className={f.key === editingField ? "py-4 first:pt-0 last:pb-0" : "first:pt-0 last:pb-0"}>
              {editingField === f.key ? (
                <div className="py-1">
                  {f.edit}
                  <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-border">
                    <Button type="button" variant="ghost" onClick={cancelEdit} disabled={saving}>
                      <X size={15} /> {t("profile.cancel")}
                    </Button>
                    <Button type="button" onClick={saveField} disabled={saving}>
                      {saving ? t("profile.saving") : t("profile.saveField")}
                    </Button>
                  </div>
                </div>
              ) : (
                <FieldRow label={f.label} value={f.value} onEdit={() => startEdit(f.key)} />
              )}
            </div>
          ))}
        </Panel>
      </RevealOnScroll>

      <div className="pb-8">
        <Button type="button" variant="ghost" onClick={logout} className="text-danger border-danger/30 hover:border-danger">
          <LogOut size={16} /> {t("profile.logout")}
        </Button>
      </div>
    </div>
  );
}