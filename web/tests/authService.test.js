import test from "node:test";
import assert from "node:assert/strict";
import {
  createAccount, isDemoUser, isExistingEmailSignup, isUsernameAvailabilityFunctionMissing, loadUserPreferences, saveOnboarding, signInWithGoogle,
  validateOnboarding, validateSignup,
} from "../src/authService.js";

const validFields = {
  name: "Ana Fortalfy",
  username: "ana_fortalfy",
  kind: "cliente",
  email: "ana@example.com",
  password: "a-strong-password",
  birthDate: "1995-04-23",
  city: "Fortaleza",
  goals: ["forca"],
  interests: ["feed", "treinos"],
  acceptedTerms: true,
};

test("signup validates username, birth date, goals, interests, and consent", () => {
  assert.deepEqual(validateSignup(validFields, new Date("2026-10-14T12:00:00")), {});
  assert.equal(validateSignup({ ...validFields, username: "Ana!" }).username, "Use de 3 a 30 caracteres: letras, números, ponto ou _.");
  assert.ok(validateSignup({ ...validFields, kind: "admin" }).kind);
  assert.equal(validateSignup({ ...validFields, birthDate: "1995-02-31" }).birthDate, "Informe uma data de nascimento válida.");
  assert.equal(validateSignup({ ...validFields, birthDate: "2999-01-01" }).birthDate, "A data de nascimento não pode estar no futuro.");
  assert.ok(validateSignup({ ...validFields, goals: [], interests: [], acceptedTerms: false }).goals);
  assert.ok(validateSignup({ ...validFields, goals: [], interests: [], acceptedTerms: false }).interests);
  assert.ok(validateSignup({ ...validFields, goals: [], interests: [], acceptedTerms: false }).acceptedTerms);
});

test("signup sends profile fields and onboarding details to the trusted auth provisioning trigger", async () => {
  let received;
  const client = {
    auth: {
      signUp: async options => {
        received = options;
        return { data: { user: { id: "user-1" }, session: null }, error: null };
      },
    },
  };

  const result = await createAccount(client, validFields, "https://fortalfy.example/");
  assert.equal(result.user.id, "user-1");
  assert.equal(received.email, validFields.email);
  assert.equal(received.options.emailRedirectTo, "https://fortalfy.example/");
  assert.deepEqual(received.options.data, {
    display_name: "Ana Fortalfy",
    username: "ana_fortalfy",
    kind: "cliente",
    city: "Fortaleza",
    birth_date: "1995-04-23",
    goals: ["forca"],
    interests: ["feed", "treinos"],
    accepted_terms: true,
  });
});

test("Google OAuth uses the official provider without collecting provider credentials", async () => {
  let received;
  await signInWithGoogle({
    auth: {
      signInWithOAuth: async options => {
        received = options;
        return { error: null };
      },
    },
  }, "https://fortalfy.example/");
  assert.deepEqual(received, {
    provider: "google",
    options: { redirectTo: "https://fortalfy.example/" },
  });
});

test("missing username availability RPC falls back only to the database uniqueness constraint", () => {
  assert.equal(isUsernameAvailabilityFunctionMissing({
    code: "PGRST202",
    message: "Could not find the function public.is_fortalfy_username_available",
  }), true);
  assert.equal(isUsernameAvailabilityFunctionMissing({
    code: "42883",
    message: "function public.is_fortalfy_username_available does not exist",
  }), true);
  assert.equal(isUsernameAvailabilityFunctionMissing({ code: "NETWORK_ERROR", message: "Offline" }), false);
  assert.equal(isUsernameAvailabilityFunctionMissing({ code: "PGRST202", message: "Could not find some other function" }), false);
});

test("signup recognizes Supabase's privacy response for an already registered email", () => {
  assert.equal(isExistingEmailSignup({
    user: { id: "user-1", identities: [] },
    session: null,
  }), true);
  assert.equal(isExistingEmailSignup({
    user: { id: "user-2", identities: [{ provider: "email" }] },
    session: null,
  }), false);
  assert.equal(isExistingEmailSignup({
    user: { id: "user-3", identities: [] },
    session: { access_token: "session" },
  }), false);
  assert.equal(isExistingEmailSignup(null), false);
});

test("auth service surfaces provider errors", async () => {
  await assert.rejects(
    signInWithGoogle({ auth: { signInWithOAuth: async () => ({ error: new Error("OAuth indisponível") }) } }, "https://fortalfy.example/"),
    /OAuth indisponível/,
  );
});

test("onboarding requires valid date, objective, interest, and explicit consent", () => {
  const onboarding = {
    birthDate: "1995-04-23",
    goals: ["forca"],
    interests: ["feed"],
    acceptedTerms: true,
  };
  assert.deepEqual(validateOnboarding(onboarding, new Date("2026-10-14T12:00:00")), {});
  assert.ok(validateOnboarding({ ...onboarding, interests: [] }).interests);
  assert.ok(validateOnboarding({ ...onboarding, acceptedTerms: false }).acceptedTerms);
});

test("onboarding reads only the signed-in user's private preference record", async () => {
  let filters;
  const client = {
    from(table) {
      assert.equal(table, "user_preferences");
      const query = {
        select(fields) { assert.equal(fields, "birth_date,goals,interests,accepted_terms_at,onboarding_completed"); return this; },
        eq(column, value) { filters = [column, value]; return this; },
        single: async () => ({ data: { onboarding_completed: false }, error: null }),
      };
      return query;
    },
  };
  const result = await loadUserPreferences(client, "user-1");
  assert.deepEqual(filters, ["user_id", "user-1"]);
  assert.equal(result.onboarding_completed, false);
});

test("onboarding persists the required fields and reports database failures", async () => {
  let update;
  const client = {
    from() {
      return {
        update(value) { update = value; return this; },
        eq(column, value) { assert.deepEqual([column, value], ["user_id", "user-1"]); return this; },
        select() { return this; },
        single: async () => ({ data: { onboarding_completed: true }, error: null }),
      };
    },
  };
  const result = await saveOnboarding(client, "user-1", {
    birthDate: "1995-04-23", goals: ["forca"], interests: ["feed"], acceptedTerms: true,
  });
  assert.equal(update.birth_date, "1995-04-23");
  assert.deepEqual(update.goals, ["forca"]);
  assert.deepEqual(update.interests, ["feed"]);
  assert.equal(update.onboarding_completed, true);
  assert.equal(result.onboarding_completed, true);
  await assert.rejects(saveOnboarding(client, "user-1", {
    birthDate: "2999-01-01", goals: [], interests: [], acceptedTerms: false,
  }), /data de nascimento não pode estar no futuro/i);
});

test("isDemoUser correctly identifies demo and local guest users", () => {
  assert.equal(isDemoUser("demo-user-fortalfy"), true);
  assert.equal(isDemoUser("demo-1234"), true);
  assert.equal(isDemoUser("local-user"), true);
  assert.equal(isDemoUser(""), false);
  assert.equal(isDemoUser(null), false);
  assert.equal(isDemoUser("d3b07384-d113-494b-9c9e-5b1cf70c6395"), false);
});

test("loadUserPreferences rejects demo accounts instead of returning invented preferences", async () => {
  const client = {
    from() {
      throw new Error("Client should not be queried for demo users");
    },
  };
  await assert.rejects(loadUserPreferences(client, "demo-user-fortalfy"), /conta real/);
  await assert.rejects(loadUserPreferences(client, "local-visitor"), /conta real/);
});

test("loadUserPreferences handles missing row (PGRST116) gracefully by returning incomplete status", async () => {
  const client = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        single: async () => ({ data: null, error: { code: "PGRST116", message: "0 rows returned" } }),
      };
    },
  };
  const result = await loadUserPreferences(client, "user-new");
  assert.equal(result.onboarding_completed, false);
});

test("loadUserPreferences surfaces invalid UUID syntax errors", async () => {
  const client = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        single: async () => ({ data: null, error: { code: "22P02", message: 'invalid input syntax for type uuid: "demo-user-fortalfy"' } }),
      };
    },
  };
  await assert.rejects(loadUserPreferences(client, "user-malformed"), /invalid input syntax/);
});

test("saveOnboarding rejects demo users instead of persisting locally", async () => {
  const client = {
    from() {
      throw new Error("Client should not be queried for demo users");
    },
  };
  await assert.rejects(saveOnboarding(client, "demo-user-fortalfy", {
    birthDate: "1998-05-10", goals: ["forca"], interests: ["feed"], acceptedTerms: true,
  }), /conta real/);
});
