const GOALS = new Set(["emagrecimento", "forca", "cardio", "mobilidade", "alimentacao", "bem-estar", "comunidade"]);
const INTERESTS = new Set(["feed", "food", "shop", "treinos", "pass"]);
const ACCOUNT_KINDS = new Set(["cliente", "personal", "nutricionista", "academia"]);
const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;

function validBirthDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isFutureDate(value, today) {
  const date = new Date(`${value}T00:00:00`);
  return date > new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

export function validateSignup(fields, today = new Date()) {
  const errors = {};
  const name = fields.name?.trim() || "";
  const username = fields.username?.trim().toLowerCase() || "";

  if (name.length < 2 || name.length > 120) errors.name = "Informe seu nome (de 2 a 120 caracteres).";
  if (!USERNAME_PATTERN.test(username)) errors.username = "Use de 3 a 30 caracteres: letras, números, ponto ou _.";
  if (!ACCOUNT_KINDS.has(fields.kind || "cliente")) errors.kind = "Escolha um tipo de conta válido.";
  if (!validBirthDate(fields.birthDate)) {
    errors.birthDate = "Informe uma data de nascimento válida.";
  } else if (isFutureDate(fields.birthDate, today)) {
    errors.birthDate = "A data de nascimento não pode estar no futuro.";
  }
  if (!fields.acceptedTerms) errors.acceptedTerms = "Confirme a aceitação dos termos e diretrizes.";
  if (!Array.isArray(fields.goals) || !fields.goals.length || fields.goals.some(goal => !GOALS.has(goal))) {
    errors.goals = "Escolha ao menos um objetivo.";
  }
  if (!Array.isArray(fields.interests) || !fields.interests.length || fields.interests.some(interest => !INTERESTS.has(interest))) {
    errors.interests = "Escolha ao menos um interesse.";
  }

  return errors;
}

export function validateOnboarding(fields, today = new Date()) {
  const errors = {};
  if (!validBirthDate(fields.birthDate)) {
    errors.birthDate = "Informe uma data de nascimento válida.";
  } else if (isFutureDate(fields.birthDate, today)) {
    errors.birthDate = "A data de nascimento não pode estar no futuro.";
  }
  if (!Array.isArray(fields.goals) || !fields.goals.length || fields.goals.some(goal => !GOALS.has(goal))) {
    errors.goals = "Escolha ao menos um objetivo.";
  }
  if (!Array.isArray(fields.interests) || !fields.interests.length || fields.interests.some(interest => !INTERESTS.has(interest))) {
    errors.interests = "Escolha ao menos um interesse.";
  }
  if (!fields.acceptedTerms) errors.acceptedTerms = "Confirme a aceitação dos termos e diretrizes.";
  return errors;
}

export function isDemoUser(userId) {
  if (!userId || typeof userId !== "string") return false;
  return userId === "demo-user-fortalfy" || userId.startsWith("demo-") || userId.startsWith("local-");
}

export async function loadUserPreferences(client, userId) {
  if (!client || !userId || isDemoUser(userId)) throw new Error("Entre com uma conta real para carregar suas preferências.");

  const { data, error } = await client.from("user_preferences")
    .select("birth_date,goals,interests,accepted_terms_at,onboarding_completed")
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116" || /0 rows/i.test(error.message || "") || /0 rows/i.test(error.details || "")) {
      return {
        birth_date: "",
        goals: [],
        interests: [],
        accepted_terms_at: null,
        onboarding_completed: false,
      };
    }
    if (error instanceof Error) throw error;
    throw Object.assign(new Error(error.message || "Não foi possível carregar as preferências do usuário."), { code: error.code });
  }
  return data;
}

export async function saveOnboarding(client, userId, fields) {
  const errors = validateOnboarding(fields);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  if (!client || !userId || isDemoUser(userId)) throw new Error("Entre com uma conta real para salvar suas preferências.");

  const payload = {
    birth_date: fields.birthDate,
    goals: fields.goals,
    interests: fields.interests,
    accepted_terms_at: new Date().toISOString(),
    onboarding_completed: true,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client.from("user_preferences")
    .update(payload)
    .eq("user_id", userId)
    .select("birth_date,goals,interests,accepted_terms_at,onboarding_completed")
    .single();

  if (error) {
    if ((error.code === "PGRST116" || /0 rows/i.test(error.message || "")) && typeof client.from("user_preferences").upsert === "function") {
      const upsertRes = await client.from("user_preferences")
        .upsert({ user_id: userId, ...payload }, { onConflict: "user_id" })
        .select("birth_date,goals,interests,accepted_terms_at,onboarding_completed")
        .single();
      if (!upsertRes.error && upsertRes.data) {
        return upsertRes.data;
      }
    }
    throw error;
  }
  return data;
}

export async function createAccount(client, fields, emailRedirectTo) {
  const { data, error } = await client.auth.signUp({
    email: fields.email.trim(),
    password: fields.password,
    options: {
      emailRedirectTo,
      data: {
        display_name: fields.name.trim(),
        username: fields.username.trim().toLowerCase(),
        kind: ACCOUNT_KINDS.has(fields.kind) ? fields.kind : "cliente",
        city: fields.city.trim() || null,
        birth_date: fields.birthDate,
        goals: fields.goals,
        interests: fields.interests,
        accepted_terms: fields.acceptedTerms,
      },
    },
  });
  if (error) throw error;
  return data;
}

export async function signInWithGoogle(client, redirectTo) {
  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) throw error;
}
