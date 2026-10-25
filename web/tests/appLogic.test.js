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

test("keeps legacy meal records while normalizing user-entered nutrition fields", () => {
  const today = localDateKey();
  const entries = normalizeMealEntries([
    { id: "legacy", name: "Almoço", calories: 520, date: today },
    { id: "new", name: "Arroz integral", calories: 215, date: today, mealType: "lunch", time: "12:30", portion: "1 xícara", protein: 5.2, carbs: 45, fat: 1.8, foodGroup: "other" },
    { id: "invalid", name: "Comida", calories: 10, date: today, protein: -4 },
  ]);

  assert.equal(entries.length, 3);
  assert.equal(entries[0].mealType, "other");
  assert.equal(entries[0].protein, null);
  assert.equal(entries[1].mealType, "lunch");
  assert.equal(entries[1].time, "12:30");
  assert.equal(entries[1].protein, 5.2);
  assert.equal(entries[1].portion, "1 xícara");
  assert.equal(entries[2].protein, null);
});

test("daily meal totals do not mix dates and include only valid recent records", () => {
  const today = localDateKey();
  const yesterday = new Date(`${today}T12:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = localDateKey(yesterday);
  const entries = [
    { id: "today", name: "Café", calories: 250, date: today },
    { id: "yesterday", name: "Jantar", calories: 700, date: yesterdayKey },
  ];

  assert.deepEqual(mealsForDate(entries, today).map(meal => meal.id), ["today"]);
  assert.equal(sumMealCalories(mealsForDate(entries, yesterdayKey)), 700);
});

test("video duration accepts up to 30 seconds and rejects longer or unreadable media", () => {
  assert.equal(isValidVideoDuration(30), true);
  assert.equal(isValidVideoDuration(30.01), false);
  assert.equal(isValidVideoDuration(Number.NaN), false);
});
