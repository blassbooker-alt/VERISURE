export const WEEKDAYS = ["Segunda-feira", "Terca-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sabado", "Domingo"];
export const MEALS = [
  ["cafe", "Cafe da manha"],
  ["almoco", "Almoco"],
  ["lanche", "Lanche"],
  ["jantar", "Jantar"],
  ["ceia", "Ceia"],
];

export function getMonday(date = new Date()) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const dayIndex = (day.getDay() + 6) % 7;
  day.setDate(day.getDate() - dayIndex);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}

export function dateAtOffset(date, offset) {
  const result = new Date(`${date}T12:00:00`);
  result.setDate(result.getDate() + offset);
  return result;
}

export function formatWeekTitle(startDate) {
  const start = new Date(`${startDate}T12:00:00`);
  const end = dateAtOffset(startDate, 6);
  const [year, month, day] = startDate.split("-").map(Number);
  const thursday = new Date(Date.UTC(year, month - 1, day));
  thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((thursday - yearStart) / 86400000) + 1) / 7);
  return `Semana ${weekNumber} – ${start.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })} a ${end.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}`;
}

export function createTrainingDays() {
  return WEEKDAYS.map(day => ({
    day,
    workout_name: "",
    notes: "",
    exercises: [{ name: "", description: "", sets: "", reps: "", load: "", rest: "", video_url: "" }],
  }));
}

export function createNutritionDays() {
  return WEEKDAYS.map(day => ({
    day,
    cafe: { description: "", calories: "", protein_g: "", carbohydrates_g: "", fat_g: "" },
    almoco: { description: "", calories: "", protein_g: "", carbohydrates_g: "", fat_g: "" },
    lanche: { description: "", calories: "", protein_g: "", carbohydrates_g: "", fat_g: "" },
    jantar: { description: "", calories: "", protein_g: "", carbohydrates_g: "", fat_g: "" },
    ceia: { description: "", calories: "", protein_g: "", carbohydrates_g: "", fat_g: "" },
  }));
}

export function validateTrainingPlan(days) {
  if (!Array.isArray(days) || days.length !== 7) return "Preencha os sete dias da semana.";
  for (const day of days) {
    if (!day.workout_name?.trim() || !Array.isArray(day.exercises) || !day.exercises.length) {
      return `Informe o treino e ao menos um exercicio para ${day.day}.`;
    }
    for (const exercise of day.exercises) {
      if (!exercise.name?.trim() || !exercise.description?.trim() || !exercise.sets?.trim()
        || !exercise.reps?.trim() || !exercise.load?.trim() || !exercise.rest?.trim()) {
        return `Complete nome, descricao, series, repeticoes, carga e descanso dos exercicios de ${day.day}.`;
      }
      try {
        const video = new URL(exercise.video_url);
        if (video.protocol !== "https:") throw new Error("invalid protocol");
      } catch {
        return `Adicione um link HTTPS de video para cada exercicio de ${day.day}.`;
      }
    }
  }
  return "";
}

export function validateNutritionPlan(dailyCalories, days, restaurants) {
  const target = Number(dailyCalories);
  if (!Number.isInteger(target) || target < 500 || target > 10000) return "Informe uma meta diaria entre 500 e 10.000 kcal.";
  if (!Array.isArray(days) || days.length !== 7) return "Preencha os sete dias da semana.";
  for (const day of days) {
    for (const [key, label] of MEALS) {
      const meal = day[key];
      if (!meal?.description?.trim() || meal.calories === "" || !Number.isInteger(Number(meal.calories)) || Number(meal.calories) < 0) {
        return `Informe a descricao e as calorias de ${label.toLowerCase()} em ${day.day}.`;
      }
      for (const macro of ["protein_g", "carbohydrates_g", "fat_g"]) {
        if (meal[macro] !== "" && (!Number.isFinite(Number(meal[macro])) || Number(meal[macro]) < 0)) {
          return `Revise os macros de ${label.toLowerCase()} em ${day.day}.`;
        }
      }
    }
  }
  if (!Array.isArray(restaurants) || !restaurants.length) return "Adicione ao menos um restaurante recomendado e verificado pela nutricionista.";
  if (restaurants.some(item => !item.name?.trim() || !item.address?.trim() || !item.dishes?.trim() || !item.price_range?.trim())) {
    return "Complete nome, endereco, pratos sugeridos e faixa de preco de cada restaurante.";
  }
  return "";
}

function requireClient(client, userId) {
  if (!client || !userId || userId.startsWith("demo-") || userId.startsWith("local-")) {
    throw new Error("Entre com uma conta real para acessar os planos semanais.");
  }
}

export async function loadWeeklyPlans(client, userId, kind) {
  requireClient(client, userId);
  const table = kind === "personal" ? "weekly_training_plans" : "weekly_nutrition_plans";
  const select = kind === "personal"
    ? "id,professional_id,client_id,week_start,title,days,confirmed_at,created_at,updated_at,professional:profiles!weekly_training_plans_professional_id_fkey(id,display_name,username)"
    : "id,professional_id,client_id,week_start,title,daily_calorie_goal,days,restaurants,confirmed_at,created_at,updated_at,professional:profiles!weekly_nutrition_plans_professional_id_fkey(id,display_name,username)";
  const { data, error } = await client.from(table)
    .select(select)
    .eq("client_id", userId)
    .order("week_start", { ascending: false })
    .limit(26);
  if (error) throw error;
  const plans = data || [];
  if (kind !== "personal" || !plans.length) return plans.map(plan => ({ ...plan, completedDays: [] }));
  const { data: completions, error: completionError } = await client.from("training_plan_completions")
    .select("plan_id,day_index")
    .eq("client_id", userId)
    .in("plan_id", plans.map(plan => plan.id));
  if (completionError) throw completionError;
  const completionMap = new Map();
  (completions || []).forEach(item => {
    const values = completionMap.get(item.plan_id) || [];
    values.push(item.day_index);
    completionMap.set(item.plan_id, values);
  });
  return plans.map(plan => ({ ...plan, completedDays: completionMap.get(plan.id) || [] }));
}

export async function loadPlansForClient(client, professionalId, clientId, kind) {
  requireClient(client, professionalId);
  const table = kind === "personal" ? "weekly_training_plans" : "weekly_nutrition_plans";
  const { data, error } = await client.from(table)
    .select("*")
    .eq("professional_id", professionalId)
    .eq("client_id", clientId)
    .eq("week_start", getMonday());
  if (error) throw error;
  return data?.[0] || null;
}

export async function saveWeeklyPlan(client, professionalId, clientId, kind, values) {
  requireClient(client, professionalId);
  const isTraining = kind === "personal";
  const validation = isTraining
    ? validateTrainingPlan(values.days)
    : validateNutritionPlan(values.dailyCalories, values.days, values.restaurants);
  if (validation) throw new Error(validation);
  const table = isTraining ? "weekly_training_plans" : "weekly_nutrition_plans";
  const payload = {
    professional_id: professionalId,
    client_id: clientId,
    week_start: getMonday(),
    title: formatWeekTitle(getMonday()),
    days: values.days,
    ...(isTraining ? {} : {
      daily_calorie_goal: Number(values.dailyCalories),
      restaurants: values.restaurants,
    }),
  };
  const { data, error } = await client.from(table)
    .upsert(payload, { onConflict: "professional_id,client_id,week_start" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function confirmWeeklyPlan(client, planId, kind) {
  const rpc = kind === "personal" ? "confirm_fortalfy_training_plan" : "confirm_fortalfy_nutrition_plan";
  const { data, error } = await client.rpc(rpc, { plan_id: planId });
  if (error) throw error;
  return data;
}

export async function setTrainingDayCompleted(client, userId, planId, dayIndex, completed) {
  requireClient(client, userId);
  const query = completed
    ? client.from("training_plan_completions").insert({ plan_id: planId, client_id: userId, day_index: dayIndex })
    : client.from("training_plan_completions").delete().eq("plan_id", planId).eq("client_id", userId).eq("day_index", dayIndex);
  const { error } = await query;
  if (error && !(completed && error.code === "23505")) throw error;
}
