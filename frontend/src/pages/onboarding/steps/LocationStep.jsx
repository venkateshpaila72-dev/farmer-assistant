import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MapPin, LocateFixed } from "lucide-react";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";

async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=12&addressdetails=1`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Reverse geocoding failed");
  const data = await res.json();
  const addr = data.address || {};
  return {
    state: addr.state || "",
    district: addr.state_district || addr.county || "",
    village: addr.village || addr.town || addr.city || addr.hamlet || addr.suburb || "",
  };
}

export function LocationStep({ value, onChange }) {
  const { t } = useTranslation();
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState("");

  function update(field) {
    return (e) => onChange({ ...value, [field]: e.target.value });
  }

  function captureGPS() {
    if (!("geolocation" in navigator)) {
      setGeoError(t("locationStep.geoNotSupported"));
      return;
    }
    setLocating(true);
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        try {
          const address = await reverseGeocode(lat, lng);
          onChange({ ...value, ...address, lat, lng });
        } catch {
          onChange({ ...value, lat, lng });
          setGeoError(t("locationStep.geoPartialFail"));
        } finally {
          setLocating(false);
        }
      },
      () => {
        setGeoError(t("locationStep.geoFailed"));
        setLocating(false);
      },
      { timeout: 8000 }
    );
  }

  return (
    <div>
      <h2 className="text-xl mb-1">{t("locationStep.title")}</h2>
      <p className="text-sm text-ink-soft mb-5">{t("locationStep.subtitle")}</p>

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Button type="button" variant="ghost" onClick={captureGPS} disabled={locating}>
            <LocateFixed size={16} />
            {locating ? t("locationStep.locating") : t("locationStep.useMyLocation")}
          </Button>
          {value.lat && value.lng && (
            <span className="text-xs text-accent flex items-center gap-1">
              <MapPin size={13} /> {t("locationStep.locationCaptured")}
            </span>
          )}
        </div>
        {geoError && <p className="text-xs text-danger">{geoError}</p>}

        <div className="grid sm:grid-cols-2 gap-4">
          <Input label={t("locationStep.state")} value={value.state || ""} onChange={update("state")} />
          <Input label={t("locationStep.district")} value={value.district || ""} onChange={update("district")} />
        </div>
        <Input label={t("locationStep.village")} value={value.village || ""} onChange={update("village")} />
        <p className="text-xs text-ink-soft -mt-1">{t("locationStep.autofillNote")}</p>
      </div>
    </div>
  );
}