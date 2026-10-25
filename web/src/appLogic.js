export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function normalizeMealEntries(value) {
  if (!Array.isArray(value)) return [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const oldestDate = new Date(today);
  oldestDate.setDate(oldestDate.getDate() - 29);
  return value.filter(entry => entry
    && typeof entry.id === "string"
    && typeof entry.name === "string"
    && entry.name.trim()
    && Number.isInteger(entry.calories)
    && entry.calories >= 0
    && entry.calories <= 10000
    && typeof entry.date === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(entry.date)
    && localDateKey(new Date(`${entry.date}T00:00:00`)) === entry.date
    && new Date(`${entry.date}T00:00:00`) >= oldestDate
    && new Date(`${entry.date}T00:00:00`) <= today)
    .map(entry => ({
      ...entry,
      mealType: ["breakfast", "lunch", "snack", "dinner"].includes(entry.mealType) ? entry.mealType : "other",
      time: typeof entry.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(entry.time) ? entry.time : "",
      portion: typeof entry.portion === "string" ? entry.portion.slice(0, 40) : "",
      protein: Number.isFinite(entry.protein) && entry.protein >= 0 && entry.protein <= 1000 ? entry.protein : null,
      carbs: Number.isFinite(entry.carbs) && entry.carbs >= 0 && entry.carbs <= 1000 ? entry.carbs : null,
      fat: Number.isFinite(entry.fat) && entry.fat >= 0 && entry.fat <= 1000 ? entry.fat : null,
      foodGroup: ["fruit", "vegetable"].includes(entry.foodGroup) ? entry.foodGroup : "other",
    }));
}

export function sumMealCalories(entries) {
  return normalizeMealEntries(entries).reduce((total, entry) => total + entry.calories, 0);
}

export function mealsForDate(entries, date = localDateKey()) {
  return normalizeMealEntries(entries).filter(entry => entry.date === date);
}

export function isValidVideoDuration(duration, limitSeconds = 30) {
  return Number.isFinite(duration) && duration > 0 && duration <= limitSeconds;
}
