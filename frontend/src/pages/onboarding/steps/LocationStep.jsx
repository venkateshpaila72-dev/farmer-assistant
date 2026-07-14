import { useState } from "react";
import { MapPin, LocateFixed } from "lucide-react";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";

export function LocationStep({ value, onChange }) {
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState("");

  function update(field) {
    return (e) => onChange({ ...value, [field]: e.target.value });
  }

  function captureGPS() {
    if (!("geolocation" in navigator)) {
      setGeoError("Your browser doesn't support location.");
      return;
    }
    setLocating(true);
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({ ...value, lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setGeoError("Couldn't get your location. Allow location access and try again.");
        setLocating(false);
      },
      { timeout: 8000 }
    );
  }

  return (
    <div>
      <h2 className="text-xl mb-1">Where&rsquo;s your farm?</h2>
      <p className="text-sm text-ink-soft mb-5">Used for weather, and to find local prices and news.</p>

      <div className="flex flex-col gap-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="State" value={value.state || ""} onChange={update("state")} />
          <Input label="District" value={value.district || ""} onChange={update("district")} />
        </div>
        <Input label="Village" value={value.village || ""} onChange={update("village")} />

        <div className="flex items-center gap-3 flex-wrap">
          <Button type="button" variant="ghost" onClick={captureGPS} disabled={locating}>
            <LocateFixed size={16} />
            {locating ? "Locating\u2026" : "Use my current location"}
          </Button>
          {value.lat && value.lng && (
            <span className="text-xs text-accent flex items-center gap-1">
              <MapPin size={13} /> Location captured
            </span>
          )}
        </div>
        {geoError && <p className="text-xs text-danger">{geoError}</p>}
      </div>
    </div>
  );
}