// WMO weather codes (used by Open-Meteo) -> short human label.
// Only covers the common cases we display; unknown codes fall back gracefully.
const WEATHER_CODE_LABELS = {
  0: "Clear sky",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Rain showers",
  81: "Rain showers",
  82: "Violent rain showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Thunderstorm with hail",
};

export function weatherCodeToLabel(code) {
  return WEATHER_CODE_LABELS[code] ?? "Weather unavailable";
}

export function formatTemp(temp) {
  return typeof temp === "number" ? `${Math.round(temp)}°C` : "—";
}

export function titleCase(name) {
  if (!name) return "";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// Time-of-day greeting word, used to make the top bar read like a real
// personal greeting ("Good morning, Divya") instead of a flat "Hi, divya123".
export function timeOfDayGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}