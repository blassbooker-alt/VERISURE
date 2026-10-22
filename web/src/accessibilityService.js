export const ACCESSIBILITY_PREFERENCE_KEY = "fortalfy.accessibility.guest.v1";
export const ACCESSIBILITY_METADATA_KEY = "fortalfy_accessibility";
export const ACCESSIBILITY_TEXT_SCALES = [85, 100, 115, 130, 150];

export const DEFAULT_ACCESSIBILITY_PREFERENCES = Object.freeze({
  textScale: 100,
  highContrast: false,
  reduceMotion: false,
});

function browserStorage() {
  try { return globalThis.localStorage; } catch { return null; }
}

export function accessibilityStorageKey(userId) {
  return userId ? `fortalfy.accessibility.user.${userId}.v1` : ACCESSIBILITY_PREFERENCE_KEY;
}

function pendingSyncStorageKey(userId) {
  return `fortalfy.accessibility.pending.${userId}.v1`;
}

function setPendingSync(userId, pending, storage = browserStorage()) {
  if (!userId || !storage) return false;
  try {
    if (pending) storage.setItem(pendingSyncStorageKey(userId), "true");
    else storage.removeItem(pendingSyncStorageKey(userId));
    return true;
  } catch {
    return false;
  }
}

function hasPendingSync(userId, storage) {
  try { return Boolean(userId && storage?.getItem(pendingSyncStorageKey(userId)) === "true"); }
  catch { return false; }
}

export function normalizeAccessibilityPreferences(value) {
  const preferences = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const scale = Number(preferences.textScale);
  return {
    textScale: ACCESSIBILITY_TEXT_SCALES.includes(scale) ? scale : DEFAULT_ACCESSIBILITY_PREFERENCES.textScale,
    highContrast: preferences.highContrast === true,
    reduceMotion: preferences.reduceMotion === true,
  };
}

export function readAccessibilityPreferences(storage = browserStorage(), userId = null) {
  try {
    const stored = storage?.getItem(accessibilityStorageKey(userId));
    return normalizeAccessibilityPreferences(stored ? JSON.parse(stored) : null);
  } catch {
    return { ...DEFAULT_ACCESSIBILITY_PREFERENCES };
  }
}

export function saveLocalAccessibilityPreferences(preferences, storage = browserStorage(), userId = null) {
  if (!storage) return false;
  try {
    storage?.setItem(accessibilityStorageKey(userId), JSON.stringify(normalizeAccessibilityPreferences(preferences)));
    return true;
  } catch {
    return false;
  }
}

export function getAccountAccessibilityPreferences(user, storage = browserStorage()) {
  const localPreferences = readAccessibilityPreferences(storage, user?.id || null);
  if (hasPendingSync(user?.id, storage)) return localPreferences;
  const accountPreferences = user?.user_metadata?.[ACCESSIBILITY_METADATA_KEY];
  if (accountPreferences && typeof accountPreferences === "object" && !Array.isArray(accountPreferences)) {
    return normalizeAccessibilityPreferences(accountPreferences);
  }
  return localPreferences;
}

export function applyAccessibilityPreferences(
  value,
  systemPrefersReducedMotion = false,
  documentElement = globalThis.document?.documentElement,
) {
  const preferences = normalizeAccessibilityPreferences(value);
  if (!documentElement) return preferences;
  documentElement.dataset.textScale = String(preferences.textScale);
  documentElement.dataset.highContrast = String(preferences.highContrast);
  documentElement.dataset.reduceMotion = String(preferences.reduceMotion || systemPrefersReducedMotion);
  return preferences;
}

export function initializeAccessibilityPreferences() {
  const preferences = readAccessibilityPreferences();
  let systemPrefersReducedMotion = false;
  try { systemPrefersReducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false; }
  catch { /* Use the explicit preference when system settings are unavailable. */ }
  applyAccessibilityPreferences(preferences, systemPrefersReducedMotion);
  return preferences;
}

export async function saveAccessibilityPreferences(client, userId, preferences) {
  const normalized = normalizeAccessibilityPreferences(preferences);
  const storage = browserStorage();
  const localSaved = saveLocalAccessibilityPreferences(normalized, storage, userId);
  if (userId) setPendingSync(userId, true, storage);
  if (!userId || !client?.auth?.updateUser) {
    if (!localSaved) throw Object.assign(new Error("Não foi possível salvar as preferências neste aparelho."), { localSaved: false });
    return { localSaved, synced: false };
  }
  const { error } = await client.auth.updateUser({ data: { [ACCESSIBILITY_METADATA_KEY]: normalized } });
  if (error) throw Object.assign(error, { localSaved });
  setPendingSync(userId, false, storage);
  return { localSaved, synced: true };
}
