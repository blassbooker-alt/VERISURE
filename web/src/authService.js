const GOALS = new Set(["emagrecimento", "forca", "cardio", "mobilidade", "alimentacao", "bem-estar", "comunidade"]);
const INTERESTS = new Set(["feed", "food", "shop", "treinos", "pass"]);
const ACCOUNT_KINDS = new Set([
  "cliente", "personal", "nutricionista", "academia", "marca",
  "restaurante", "empresa", "vendedor", "influenciador",
]);
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

export function isUsernameAvailabilityFunctionMissing(error) {
  const message = [error?.message, error?.details, error?.hint].filter(Boolean).join(" ");
  return (error?.code === "PGRST202" || error?.code === "42883")
    && /is_fortalfy_username_available/i.test(message);
}

export function isExistingEmailSignup(data) {
  return Boolean(!data?.session && data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0);
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

  // Use the identity from the same session whose JWT Supabase sends with the
  // request. A stale userId prop can otherwise fail the user_preferences RLS
  // check even when the signed-in account is valid.
  let authenticatedUserId = userId;
  if (typeof client.auth?.getSession === "function") {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    authenticatedUserId = data?.session?.user?.id || "";
    if (!authenticatedUserId) {
      throw new Error("Sua sessão expirou. Entre novamente para salvar suas preferências.");
    }
  }

  const payload = {
    birth_date: fields.birthDate,
    goals: fields.goals,
    interests: fields.interests,
    accepted_terms_at: new Date().toISOString(),
    onboarding_completed: true,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client.from("user_preferences")
    .upsert({ user_id: authenticatedUserId, ...payload }, { onConflict: "user_id" })
    .select("birth_date,goals,interests,accepted_terms_at,onboarding_completed")
    .single();

  if (error) {
    if (error.code === "42501" || /row-level security/i.test(error.message || "")) {
      throw new Error("Não foi possível salvar suas preferências nesta sessão. Saia da conta, entre novamente e tente de novo.");
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
        ...(fields.acceptedBenefitsTerms ? {
          accepted_benefit_terms: true,
          benefit_terms_version: "fortalfy-benefits-v1",
        } : {}),
      },
    },
  });
  if (error) throw error;
  return data;
}

export async function verifySignupOtp(client, email, token) {
  const normalizedEmail = String(email || "").trim();
  const normalizedToken = String(token || "").trim().replace(/\s+/g, "");
  if (!normalizedEmail || !normalizedToken) throw new Error("Informe o e-mail e o código recebido.");
  const { data, error } = await client.auth.verifyOtp({
    email: normalizedEmail,
    token: normalizedToken,
    type: "signup",
  });
  if (error) throw error;
  return data;
}

export async function resendSignupOtp(client, email) {
  const normalizedEmail = String(email || "").trim();
  if (!normalizedEmail) throw new Error("Informe o e-mail usado no cadastro.");
  const { data, error } = await client.auth.resend({
    type: "signup",
    email: normalizedEmail,
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
