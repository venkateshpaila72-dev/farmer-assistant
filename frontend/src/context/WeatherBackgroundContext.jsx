import { createContext, useContext, useState, useMemo } from "react";

const WeatherBackgroundContext = createContext(null);

/**
 * Tiny shared bit of state: "is it currently raining, for background
 * purposes". Time-of-day (dawn/day/dusk/night) is derived independently
 * from the client clock inside WeatherSkyBackground, since that's always
 * available — but rain can only be known once a page has actually fetched
 * weather data. Whichever page does that (currently DashboardHome) calls
 * `setIsRaining(...)` so the background — shared across every dashboard
 * page — reflects it, even after navigating elsewhere.
 */
export function WeatherBackgroundProvider({ children }) {
  const [isRaining, setIsRaining] = useState(false);
  const value = useMemo(() => ({ isRaining, setIsRaining }), [isRaining]);
  return <WeatherBackgroundContext.Provider value={value}>{children}</WeatherBackgroundContext.Provider>;
}

export function useWeatherBackground() {
  const ctx = useContext(WeatherBackgroundContext);
  if (!ctx) throw new Error("useWeatherBackground must be used within WeatherBackgroundProvider");
  return ctx;
}