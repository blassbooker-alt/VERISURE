import test from "node:test";
import assert from "node:assert/strict";
import { isValidVideoDuration, localDateKey, mealsForDate, normalizeMealEntries, sumMealCalories } from "../src/appLogic.js";

test("meal totals include each valid registered meal exactly once", () => {
  const entries = [
    { id: "a", name: "Almoço", calories: 520, date: localDateKey() },
    { id: "b", name: "Lanche", calories: 180, date: localDateKey() },
  ];
  assert.equal(sumMealCalories(entries), 700);
});

test("meal normalization rejects malformed and out-of-range entries", () => {
  const entries = [
    { id: "a", name: "Almoço", calories: 520, date: localDateKey() },
    { id: "b", name: " ", calories: 100, date: localDateKey() },
    { id: "c", name: "Lanche", calories: 10001, date: localDateKey() },
    null,
  ];
  assert.deepEqual(normalizeMealEntries(entries).map(entry => entry.id), ["a"]);
});

test("daily calorie totals exclude meals from other days", () => {
  const today = localDateKey();
  const yesterday = localDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const entries = [
    { id: "today", name: "Almoço", calories: 500, date: today },
    { id: "yesterday", name: "Jantar", calories: 700, date: yesterday },
  ];
  assert.equal(sumMealCalories(mealsForDate(entries, today)), 500);
});

test("video duration accepts up to 30 seconds and rejects longer or unreadable media", () => {
  assert.equal(isValidVideoDuration(30), true);
  assert.equal(isValidVideoDuration(30.01), false);
  assert.equal(isValidVideoDuration(Number.NaN), false);
});
