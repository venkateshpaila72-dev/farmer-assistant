export function getErrorMessage(err, fallback) {
  if (err?.code === "ECONNABORTED") {
    return "The server is taking too long to respond. Please try again.";
  }
  if (!err?.response) {
    return "Network problem. Check your connection and try again.";
  }
  const detail = err.response.data?.detail;
  if (typeof detail === "string") {
    return detail;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item) => (typeof item === "object" && item !== null ? item.msg || JSON.stringify(item) : String(item)))
      .join("; ");
  }
  return fallback;
}
