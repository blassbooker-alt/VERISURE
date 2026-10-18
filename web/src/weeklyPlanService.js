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
    is_rest_day: false,
    workout_name: "",
    notes: "",
    exercises: [{ name: "", muscle_group: "", equipment: "", description: "", sets: "", reps: "", load: "", load_unit: "kg", rest: "", tempo: "", duration: "", distance: "", notes: "", video_url: "" }],
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
    if (!Array.isArray(day.exercises)) return `Revise a lista de exercicios de ${day.day}.`;
    if (day.is_rest_day) {
      if (day.exercises.length) return `${day.day} esta marcado como descanso, mas ainda tem exercicios.`;
      continue;
    }
    if (!day.workout_name?.trim() || !day.exercises.length) {
      return `Informe o treino e ao menos um exercicio para ${day.day}, ou marque como descanso.`;
    }
    for (const exercise of day.exercises) {
      if (!exercise.name?.trim()) return `Informe o nome de cada exercicio de ${day.day}.`;
      if (!exercise.sets?.trim() && !exercise.duration?.trim() && !exercise.distance?.trim()) {
        return `Informe series, duracao ou distancia para ${exercise.name}.`;
      }
      if (exercise.video_url?.trim()) {
        try {
          const video = new URL(exercise.video_url);
          if (video.protocol !== "https:") throw new Error("invalid protocol");
        } catch {
          return `Use um link HTTPS valido para o video de ${exercise.name}.`;
        }
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
    ? "id,professional_id,client_id,week_start,title,days,goal,warmup,status,version,published_at,confirmed_at,created_at,updated_at,professional:profiles!weekly_training_plans_professional_id_fkey(id,display_name,username)"
    : "id,professional_id,client_id,week_start,title,daily_calorie_goal,days,restaurants,confirmed_at,created_at,updated_at,professional:profiles!weekly_nutrition_plans_professional_id_fkey(id,display_name,username)";
  let query = client.from(table).select(select).eq("client_id", userId);
  if (kind === "personal") query = query.eq("status", "published");
  const { data, error } = await query.order("week_start", { ascending: false }).limit(26);
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

export async function loadPlansForClient(client, professionalId, clientId, kind, weekStart = getMonday()) {
  requireClient(client, professionalId);
  const table = kind === "personal" ? "weekly_training_plans" : "weekly_nutrition_plans";
  const { data, error } = await client.from(table)
    .select("*")
    .eq("professional_id", professionalId)
    .eq("client_id", clientId)
    .eq("week_start", weekStart);
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
    title: formatWeekTitle(values.weekStart || getMonday()),
    week_start: values.weekStart || getMonday(),
    days: values.days,
    ...(isTraining ? { status: "draft", goal: values.goal || "", warmup: values.warmup || "" } : {
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

export async function publishWeeklyTrainingPlan(client, planId) {
  const { data, error } = await client.rpc("publish_fortalfy_training_plan", { plan_id: planId });
  if (error) throw error;
  return data;
}

export async function startTrainingSession(client, planId, dayIndex, scheduledDate) {
  const { data, error } = await client.rpc("start_fortalfy_training_session", {
    plan_id: planId,
    day_index: dayIndex,
    scheduled_date: scheduledDate,
  });
  if (error) throw error;
  return data;
}

export async function loadTrainingSessionForDay(client, userId, planId, dayIndex, scheduledDate) {
  requireClient(client, userId);
  const { data: session, error } = await client.from("training_sessions")
    .select("id,plan_id,plan_version,day_index,scheduled_date,status,started_at,completed_at,duration_minutes,client_notes")
    .eq("client_id", userId).eq("plan_id", planId).eq("day_index", dayIndex).eq("scheduled_date", scheduledDate)
    .maybeSingle();
  if (error) throw error;
  if (!session) return null;
  const { data: exercises, error: exerciseError } = await client.from("training_session_exercises")
    .select("id,exercise_index,prescription")
    .eq("session_id", session.id).order("exercise_index");
  if (exerciseError) throw exerciseError;
  const exerciseIds = (exercises || []).map(exercise => exercise.id);
  let entries = [];
  if (exerciseIds.length) {
    const { data, error: entriesError } = await client.from("training_set_entries")
      .select("id,session_exercise_id,set_number,actual_load,load_unit,actual_reps,actual_duration_minutes,actual_distance,distance_unit,completed,rest_seconds,rpe,notes,updated_at")
      .in("session_exercise_id", exerciseIds).order("set_number");
    if (entriesError) throw entriesError;
    entries = data || [];
  }
  return { ...session, exercises: (exercises || []).map(exercise => ({
    ...exercise,
    sets: entries.filter(entry => entry.session_exercise_id === exercise.id),
  })) };
}

export async function saveTrainingSet(client, sessionExerciseId, set) {
  const { data, error } = await client.from("training_set_entries").upsert({
    session_exercise_id: sessionExerciseId,
    set_number: set.set_number,
    actual_load: set.actual_load === "" || set.actual_load === null ? null : Number(set.actual_load),
    load_unit: set.load_unit || "kg",
    actual_reps: set.actual_reps === "" || set.actual_reps === null ? null : Number(set.actual_reps),
    actual_duration_minutes: set.actual_duration_minutes === "" || set.actual_duration_minutes === null ? null : Number(set.actual_duration_minutes),
    actual_distance: set.actual_distance === "" || set.actual_distance === null ? null : Number(set.actual_distance),
    distance_unit: set.distance_unit || "km",
    completed: Boolean(set.completed),
    rest_seconds: set.rest_seconds === "" || set.rest_seconds === null ? null : Number(set.rest_seconds),
    rpe: set.rpe === "" || set.rpe === null ? null : Number(set.rpe),
    notes: set.notes || "",
    updated_at: new Date().toISOString(),
  }, { onConflict: "session_exercise_id,set_number" }).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateTrainingSession(client, userId, sessionId, values) {
  requireClient(client, userId);
  const { data, error } = await client.from("training_sessions").update(values)
    .eq("id", sessionId).eq("client_id", userId).select("*").single();
  if (error) throw error;
  return data;
}

export async function loadTrainingPerformance(client, userId, startDate, endDate) {
  requireClient(client, userId);
  const { data, error } = await client.from("training_sessions")
    .select("id,plan_id,plan_version,day_index,scheduled_date,status,started_at,completed_at,duration_minutes,client_notes,professional_id")
    .eq("client_id", userId).gte("scheduled_date", startDate).lte("scheduled_date", endDate)
    .order("scheduled_date", { ascending: false }).limit(500);
  if (error) throw error;
  const sessions = data || [];
  if (!sessions.length) return [];
  const { data: exercises, error: exerciseError } = await client.from("training_session_exercises")
    .select("id,session_id,exercise_index,prescription")
    .in("session_id", sessions.map(session => session.id)).order("exercise_index");
  if (exerciseError) throw exerciseError;
  const exerciseIds = (exercises || []).map(exercise => exercise.id);
  let entries = [];
  if (exerciseIds.length) {
    const { data, error: entryError } = await client.from("training_set_entries")
      .select("session_exercise_id,set_number,actual_load,load_unit,actual_reps,actual_duration_minutes,actual_distance,distance_unit,completed,rpe")
      .in("session_exercise_id", exerciseIds);
    if (entryError) throw entryError;
    entries = data || [];
  }
  return sessions.map(session => ({
    ...session,
    exercises: (exercises || []).filter(exercise => exercise.session_id === session.id).map(exercise => ({
      ...exercise,
      sets: entries.filter(entry => entry.session_exercise_id === exercise.id),
    })),
  }));
}

export async function loadProfessionalTrainingPerformance(client, professionalId, clientIds, startDate, endDate) {
  requireClient(client, professionalId);
  if (!Array.isArray(clientIds) || !clientIds.length) return [];
  const { data, error } = await client.from("training_sessions")
    .select("id,client_id,plan_id,plan_version,day_index,scheduled_date,status,started_at,completed_at,duration_minutes,client_notes")
    .eq("professional_id", professionalId).in("client_id", clientIds)
    .gte("scheduled_date", startDate).lte("scheduled_date", endDate)
    .order("scheduled_date", { ascending: false }).limit(500);
  if (error) throw error;
  const sessions = data || [];
  if (!sessions.length) return [];
  const { data: exercises, error: exerciseError } = await client.from("training_session_exercises")
    .select("id,session_id,exercise_index,prescription")
    .in("session_id", sessions.map(item => item.id)).order("exercise_index");
  if (exerciseError) throw exerciseError;
  const exerciseIds = (exercises || []).map(item => item.id);
  let entries = [];
  if (exerciseIds.length) {
    const { data, error: entryError } = await client.from("training_set_entries")
      .select("session_exercise_id,set_number,actual_load,load_unit,actual_reps,actual_duration_minutes,actual_distance,distance_unit,completed,rpe,notes")
      .in("session_exercise_id", exerciseIds);
    if (entryError) throw entryError;
    entries = data || [];
  }
  return sessions.map(session => ({
    ...session,
    exercises: (exercises || []).filter(exercise => exercise.session_id === session.id).map(exercise => ({
      ...exercise,
      sets: entries.filter(entry => entry.session_exercise_id === exercise.id),
    })),
  }));
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
