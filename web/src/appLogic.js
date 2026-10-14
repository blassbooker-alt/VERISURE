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
    && new Date(`${entry.date}T00:00:00`) <= today);
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
