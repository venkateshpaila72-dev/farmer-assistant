import { useState, useEffect } from "react";

/**
 * Reads the browser's current position once on mount.
 * Returns { lat, lng, loading, error }.
 * error is a short string ("denied" | "unsupported" | "unavailable") so callers
 * can show a graceful fallback instead of a raw browser error message.
 */
export function useGeolocation() {
  const [state, setState] = useState({ lat: null, lng: null, loading: true, error: null });

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setState({ lat: null, lng: null, loading: false, error: "unsupported" });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          loading: false,
          error: null,
        });
      },
      (err) => {
        setState({
          lat: null,
          lng: null,
          loading: false,
          error: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable",
        });
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 }
    );
  }, []);

  return state;
}