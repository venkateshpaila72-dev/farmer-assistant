const store = new Map();

/**
 * Simple session-lifetime cache, deliberately NOT React state — it lives at
 * module scope, so it survives a page's components unmounting when you
 * navigate away and remounting when you come back (which is what was
 * causing Market/News to reset to a loading skeleton every single time).
 * Resets only on a full page reload, which is the right lifetime for "don't
 * refetch things I already just looked at this session."
 */
export function getCached(key) {
  return store.has(key) ? store.get(key) : undefined;
}

export function setCached(key, value) {
  store.set(key, value);
}

// Called when the site language changes: cached lists (news, announcements…)
// hold text in the OLD language, so drop them and let pages refetch.
export function clearCache() {
  store.clear();
}