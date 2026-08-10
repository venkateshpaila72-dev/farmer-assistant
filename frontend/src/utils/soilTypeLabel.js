// The soil classifier ML model outputs one of 5 fixed labels ("Black Soil",
// "Cinder Soil", "Laterite Soil", "Peat Soil", "Yellow Soil" — see
// backend/saved_models/soil_classes.json) — a different vocabulary from
// onboarding's SoilTypeStep, where farmers manually pick from 7 different
// categories ("Alluvial", "Black", "Red", etc, under `soilTypes.*` keys
// without a "Soil" suffix).
//
// A farmer profile's saved soil_type can end up in EITHER vocabulary: it's
// either whatever they picked at onboarding, or it's been silently
// overwritten by the classifier's output the next time they used Photo
// Check with update_profile enabled (see backend routes/vision.py). Rather
// than assume which one a given value is, this tries both key styles
// before falling back to showing the raw backend string untranslated.
export function translateSoilType(t, rawSoilType) {
  if (!rawSoilType) return rawSoilType;
  const normalized = rawSoilType.toLowerCase().trim().replace(/\s+/g, "_");

  const classifierKey = `soilTypes.classifier_${normalized}`;
  const classifierTranslated = t(classifierKey);
  if (classifierTranslated !== classifierKey) return classifierTranslated;

  // Onboarding's keys are capitalized single words with no "_soil" suffix
  // (e.g. "Black", not "black_soil") — strip a trailing _soil if present
  // and re-capitalize to try that vocabulary too.
  const onboardingWord = normalized.replace(/_soil$/, "");
  const onboardingKey = `soilTypes.${onboardingWord.charAt(0).toUpperCase()}${onboardingWord.slice(1)}`;
  const onboardingTranslated = t(onboardingKey);
  if (onboardingTranslated !== onboardingKey) return onboardingTranslated;

  // i18next returns the key itself when nothing matches — fall back to the
  // raw backend string rather than showing a literal broken key.
  return rawSoilType;
}