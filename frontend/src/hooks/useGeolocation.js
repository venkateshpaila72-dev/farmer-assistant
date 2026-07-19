import { useState, useEffect } from "react";

// Fallback used only if the browser denies/lacks geolocation, or never calls
// back at all — New Delhi as a neutral default so the hero still shows real
// weather instead of hanging forever.
const FALLBACK = { lat: 28.6139, lng: 77.209 };
const HARD_TIMEOUT_MS = 6000;

export function useGeolocation() {
  const [coords, setCoords] = useState(null);
  const [source, setSource] = useState("pending"); // pending | gps | fallback
  const [error, setError] = useState(null);

  useEffect(() => {
    let settled = false;

    function settle(value, src, err) {
      if (settled) return; // browser callback and hard-timeout can't both win
      settled = true;
      setCoords(value);
      setSource(src);
      if (err) setError(err);
    }

    if (!("geolocation" in navigator)) {
      settle(FALLBACK, "fallback", "Geolocation not supported by this browser.");
      return;
    }

    // Belt-and-suspenders: some browsers/permission states never invoke
    // either callback below (observed in practice, not just theoretical) —
    // this guarantees we always end up with *some* coordinates.
    const hardTimeout = setTimeout(() => {
      settle(FALLBACK, "fallback", "Location request timed out.");
    }, HARD_TIMEOUT_MS);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(hardTimeout);
        settle({ lat: pos.coords.latitude, lng: pos.coords.longitude }, "gps", null);
      },
      (err) => {
        clearTimeout(hardTimeout);
        settle(FALLBACK, "fallback", err.message);
      },
      { timeout: HARD_TIMEOUT_MS }
    );

    return () => clearTimeout(hardTimeout);
  }, []);

  return { coords, source, error };
}