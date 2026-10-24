export const THEME_PREFERENCE_KEY = "fortalfy.theme.guest.v1";
export const THEME_METADATA_KEY = "fortalfy_theme";
// Light appearance is temporarily disabled throughout the product.
export const THEME_PREFERENCES = ["dark"];

function browserStorage() {
  try { return globalThis.localStorage; } catch { return null; }
}

export function normalizeThemePreference(value) {
  return THEME_PREFERENCES.includes(value) ? value : "dark";
}

export function resolveThemePreference(preference, systemPrefersDark = true) {
  return "dark";
}

export function themeStorageKey(userId) {
  return userId ? `fortalfy.theme.user.${userId}.v1` : THEME_PREFERENCE_KEY;
}

export function readThemePreference(storage = browserStorage(), userId = null) {
  try {
    return normalizeThemePreference(storage?.getItem(themeStorageKey(userId)));
  } catch {
    return "dark";
  }
}

export function saveLocalThemePreference(preference, storage = browserStorage(), userId = null) {
  try {
    storage?.setItem(themeStorageKey(userId), normalizeThemePreference(preference));
    return true;
  } catch {
    return false;
  }
}

export function applyThemePreference(preference, systemPrefersDark = true, documentElement = globalThis.document?.documentElement) {
  const theme = resolveThemePreference(preference, systemPrefersDark);
  if (documentElement) {
    documentElement.dataset.theme = theme;
    documentElement.style.colorScheme = theme;
  }
  return theme;
}

export function initializeThemePreference() {
  const preference = readThemePreference();
  let systemPrefersDark = true;
  try { systemPrefersDark = globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true; } catch { /* use the dark default */ }
  applyThemePreference(preference, systemPrefersDark);
  return preference;
}

export async function saveThemePreference(client, userId, preference) {
  const normalized = normalizeThemePreference(preference);
  const localSaved = saveLocalThemePreference(normalized, browserStorage(), userId);
  if (!userId || !client?.auth?.updateUser) return { localSaved, synced: false };
  const { error } = await client.auth.updateUser({ data: { [THEME_METADATA_KEY]: normalized } });
  if (error) throw Object.assign(error, { localSaved });
  return { localSaved, synced: true };
}

export function getAccountThemePreference(user, storage = browserStorage()) {
  return "dark";
}
