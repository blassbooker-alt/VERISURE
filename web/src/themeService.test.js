import test from "node:test";
import assert from "node:assert/strict";
import {
  applyThemePreference, getAccountThemePreference, normalizeThemePreference, readThemePreference,
  resolveThemePreference, saveThemePreference, saveLocalThemePreference, themeStorageKey,
} from "./themeService.js";

function createStorage() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    values,
  };
}

test("appearance remains dark regardless of saved or system appearance", () => {
  assert.equal(normalizeThemePreference("invalid"), "dark");
  assert.equal(normalizeThemePreference("light"), "dark");
  assert.equal(normalizeThemePreference("system"), "dark");
  assert.equal(readThemePreference(createStorage()), "dark");
  assert.equal(resolveThemePreference("system", true), "dark");
  assert.equal(resolveThemePreference("system", false), "dark");
  assert.equal(resolveThemePreference("light", true), "dark");
});

test("appearance persistence uses separate guest and per-account storage keys", () => {
  const storage = createStorage();
  assert.notEqual(themeStorageKey("user-a"), themeStorageKey("user-b"));
  assert.equal(saveLocalThemePreference("light", storage, "user-a"), true);
  assert.equal(readThemePreference(storage, "user-a"), "dark");
  assert.equal(readThemePreference(storage, "user-b"), "dark");
  assert.equal(readThemePreference(storage), "dark");
});

test("account metadata takes precedence over its local fallback", () => {
  const storage = createStorage();
  saveLocalThemePreference("light", storage, "user-a");
  assert.equal(getAccountThemePreference({ id: "user-a", user_metadata: { fortalfy_theme: "dark" } }, storage), "dark");
  assert.equal(getAccountThemePreference({ id: "user-a", user_metadata: { fortalfy_theme: "light" } }, storage), "dark");
});

test("applying a preference updates the root theme without navigation or reload", () => {
  const root = { dataset: {}, style: {} };
  assert.equal(applyThemePreference("light", true, root), "dark");
  assert.deepEqual(root.dataset, { theme: "dark" });
  assert.equal(root.style.colorScheme, "dark");
});

test("saving appearance writes locally and syncs non-sensitive account metadata", async () => {
  const storage = createStorage();
  const originalStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  let sent;
  try {
    const result = await saveThemePreference({ auth: { updateUser: async value => { sent = value; return { error: null }; } } }, "user-a", "light");
    assert.deepEqual(result, { localSaved: true, synced: true });
    assert.deepEqual(sent, { data: { fortalfy_theme: "dark" } });
    assert.equal(readThemePreference(storage, "user-a"), "dark");
  } finally {
    if (originalStorage === undefined) delete globalThis.localStorage;
    else Object.defineProperty(globalThis, "localStorage", { configurable: true, value: originalStorage });
  }
});
