import test from "node:test";
import assert from "node:assert/strict";
import {
  ACCESSIBILITY_METADATA_KEY, ACCESSIBILITY_PREFERENCE_KEY, ACCESSIBILITY_TEXT_SCALES,
  accessibilityStorageKey, applyAccessibilityPreferences, getAccountAccessibilityPreferences,
  normalizeAccessibilityPreferences, readAccessibilityPreferences, saveAccessibilityPreferences,
  saveLocalAccessibilityPreferences,
} from "./accessibilityService.js";

function createStorage() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    values,
  };
}

test("normalizes the supported text scales and boolean preferences", () => {
  assert.deepEqual(ACCESSIBILITY_TEXT_SCALES, [85, 100, 115, 130, 150]);
  assert.deepEqual(normalizeAccessibilityPreferences({ textScale: 130, highContrast: true, reduceMotion: 1 }), {
    textScale: 130, highContrast: true, reduceMotion: false,
  });
  assert.deepEqual(normalizeAccessibilityPreferences({ textScale: 120, highContrast: "yes" }), {
    textScale: 100, highContrast: false, reduceMotion: false,
  });
});

test("stores guest and account accessibility settings under isolated keys", () => {
  const storage = createStorage();
  assert.notEqual(accessibilityStorageKey("account-a"), accessibilityStorageKey("account-b"));
  assert.notEqual(accessibilityStorageKey("account-a"), ACCESSIBILITY_PREFERENCE_KEY);
  saveLocalAccessibilityPreferences({ textScale: 150, highContrast: true }, storage, "account-a");
  saveLocalAccessibilityPreferences({ textScale: 85 }, storage);
  assert.deepEqual(readAccessibilityPreferences(storage, "account-a"), {
    textScale: 150, highContrast: true, reduceMotion: false,
  });
  assert.deepEqual(readAccessibilityPreferences(storage, "account-b"), {
    textScale: 100, highContrast: false, reduceMotion: false,
  });
  assert.deepEqual(readAccessibilityPreferences(storage), {
    textScale: 85, highContrast: false, reduceMotion: false,
  });
});

test("account metadata takes precedence over the account's local fallback", () => {
  const storage = createStorage();
  saveLocalAccessibilityPreferences({ textScale: 115 }, storage, "account-a");
  const user = { id: "account-a", user_metadata: { [ACCESSIBILITY_METADATA_KEY]: { textScale: 130, reduceMotion: true } } };
  assert.deepEqual(getAccountAccessibilityPreferences(user, storage), {
    textScale: 130, highContrast: false, reduceMotion: true,
  });
  assert.deepEqual(getAccountAccessibilityPreferences({ id: "account-a", user_metadata: {} }, storage), {
    textScale: 115, highContrast: false, reduceMotion: false,
  });
});

test("a locally saved setting stays authoritative until its remote sync succeeds", () => {
  const storage = createStorage();
  const user = { id: "account-a", user_metadata: { [ACCESSIBILITY_METADATA_KEY]: { textScale: 100 } } };
  saveLocalAccessibilityPreferences({ textScale: 150 }, storage, "account-a");
  storage.setItem("fortalfy.accessibility.pending.account-a.v1", "true");
  assert.equal(getAccountAccessibilityPreferences(user, storage).textScale, 150);
});

test("applies text, contrast, and motion preferences to the document root", () => {
  const root = { dataset: {} };
  applyAccessibilityPreferences({ textScale: 150, highContrast: true, reduceMotion: false }, true, root);
  assert.deepEqual(root.dataset, { textScale: "150", highContrast: "true", reduceMotion: "true" });
  applyAccessibilityPreferences({ textScale: 85 }, false, root);
  assert.deepEqual(root.dataset, { textScale: "85", highContrast: "false", reduceMotion: "false" });
});

test("saves locally and synchronizes non-sensitive account metadata", async () => {
  const storage = createStorage();
  const originalStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  let sent;
  try {
    const result = await saveAccessibilityPreferences({
      auth: { updateUser: async value => { sent = value; return { error: null }; } },
    }, "account-a", { textScale: 115, highContrast: true });
    assert.deepEqual(result, { localSaved: true, synced: true });
    assert.deepEqual(sent, { data: { [ACCESSIBILITY_METADATA_KEY]: { textScale: 115, highContrast: true, reduceMotion: false } } });
    assert.deepEqual(readAccessibilityPreferences(storage, "account-a"), { textScale: 115, highContrast: true, reduceMotion: false });
    assert.equal(storage.getItem("fortalfy.accessibility.pending.account-a.v1"), null);
  } finally {
    if (originalStorage === undefined) delete globalThis.localStorage;
    else Object.defineProperty(globalThis, "localStorage", { configurable: true, value: originalStorage });
  }
});

test("reports remote sync errors while retaining the local account preference", async () => {
  const storage = createStorage();
  const originalStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  const failure = new Error("offline");
  try {
    await assert.rejects(
      saveAccessibilityPreferences({ auth: { updateUser: async () => ({ error: failure }) } }, "account-a", { reduceMotion: true }),
      error => error === failure && error.localSaved === true,
    );
    assert.equal(readAccessibilityPreferences(storage, "account-a").reduceMotion, true);
  } finally {
    if (originalStorage === undefined) delete globalThis.localStorage;
    else Object.defineProperty(globalThis, "localStorage", { configurable: true, value: originalStorage });
  }
});

test("fails explicitly if guest preferences cannot be persisted", async () => {
  const originalStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { setItem() { throw new Error("storage full"); } } });
  try {
    await assert.rejects(
      saveAccessibilityPreferences(null, null, { textScale: 150 }),
      error => error.localSaved === false && /salvar/.test(error.message),
    );
  } finally {
    if (originalStorage === undefined) delete globalThis.localStorage;
    else Object.defineProperty(globalThis, "localStorage", { configurable: true, value: originalStorage });
  }
});
