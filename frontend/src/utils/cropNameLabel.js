// The backend's crop vocabulary (backend/saved_models/yield_metadata.json's
// crop_unit_map) has some raw labels with parentheses/slashes/inconsistent
// casing (e.g. "Cotton(lint)", "Arhar/Tur", "other oilseeds"). This
// normalizes any raw crop string into the same key format used when the
// `cropNames.*` translations were added, so lookups are resilient to exact
// capitalization/spacing without needing every call site to normalize
// itself. Falls back to the raw string when a crop isn't in the
// translated set (e.g. AGMARKNET market listings often include variety/
// grade suffixes — "Tomato Hybrid", "Onion Nasik" — beyond the base 55
// crop names, which won't match and will just display as-is untranslated).
export function translateCropName(t, rawCropName) {
  if (!rawCropName) return rawCropName;
  const key = `cropNames.${rawCropName
    .toLowerCase()
    .trim()
    .replace(/[(),]/g, " ")       // parens/commas become a separator, not stripped —
    .replace(/[\s/&-]+/g, "_")    // otherwise "Cotton(lint)" -> "cottonlint" not "cotton_lint"
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")}`;
  const translated = t(key);
  return translated === key ? rawCropName : translated;
}