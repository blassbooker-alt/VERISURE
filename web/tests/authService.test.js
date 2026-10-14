import test from "node:test";
import assert from "node:assert/strict";
import {
  createAccount, loadUserPreferences, saveOnboarding, signInWithGoogle,
  validateOnboarding, validateSignup,
} from "../src/authService.js";

const validFields = {
  name: "Ana Fortalfy",
  username: "ana_fortalfy",
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
  assert.equal(validateSignup({ ...validFields, username: "Ana!" }).username, "Use de 3 a 24 caracteres: letras, números ou _.");
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
