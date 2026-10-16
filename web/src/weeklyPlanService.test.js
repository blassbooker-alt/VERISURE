import test from "node:test";
import assert from "node:assert/strict";
import {
  createNutritionDays, createTrainingDays, formatWeekTitle, getMonday,
  validateNutritionPlan, validateTrainingPlan,
} from "./weeklyPlanService.js";

test("getMonday returns the local Monday for a midweek date", () => {
  assert.equal(getMonday(new Date(2024, 2, 20)), "2024-03-18");
});

test("formatWeekTitle includes the ISO week and complete date range", () => {
  assert.match(formatWeekTitle("2024-03-18"), /^Semana 12 – 18 de março a 24 de março de 2024$/);
});

test("training plan requires seven complete days and HTTPS video links", () => {
  const days = createTrainingDays().map((day, index) => ({
    ...day,
    workout_name: `Treino ${index + 1}`,
    exercises: [{
      name: "Agachamento",
      description: "Execução controlada",
      sets: "3",
      reps: "12",
      load: "20 kg",
      rest: "60 s",
      video_url: "https://example.com/video",
    }],
  }));
  assert.equal(validateTrainingPlan(days), "");
  assert.match(validateTrainingPlan(days.slice(0, 6)), /sete dias/);
  assert.match(validateTrainingPlan(days.map((day, index) => index ? day : {
    ...day,
    exercises: [{ ...day.exercises[0], video_url: "http://example.com/video" }],
  })), /HTTPS/);
});

test("nutrition plan requires all meals and real restaurant details", () => {
  const days = createNutritionDays().map((day, index) => ({
    ...day,
    cafe: { description: `Cafe ${index}`, calories: "350", protein_g: "", carbohydrates_g: "", fat_g: "" },
    almoco: { description: `Almoco ${index}`, calories: "500", protein_g: "", carbohydrates_g: "", fat_g: "" },
    lanche: { description: `Lanche ${index}`, calories: "200", protein_g: "", carbohydrates_g: "", fat_g: "" },
    jantar: { description: `Jantar ${index}`, calories: "450", protein_g: "", carbohydrates_g: "", fat_g: "" },
    ceia: { description: `Ceia ${index}`, calories: "100", protein_g: "", carbohydrates_g: "", fat_g: "" },
  }));
  const restaurants = [{ name: "Restaurante", address: "Rua Central, 10", dishes: "Prato do dia", price_range: "R$ 20–30" }];
  assert.equal(validateNutritionPlan("2000", days, restaurants), "");
  assert.match(validateNutritionPlan("2000", days.slice(0, 6), restaurants), /sete dias/);
  assert.match(validateNutritionPlan("2000", days, []), /restaurante/);
});
