import test from "node:test";
import assert from "node:assert/strict";
import { validateSignup } from "./authService.js";

const signupFields = username => ({
  name: "Pessoa Fortalfy",
  username,
  kind: "cliente",
  birthDate: "1990-01-01",
  acceptedTerms: true,
  goals: ["forca"],
  interests: ["feed"],
});

test("signup accepts usernames with dots and underscores up to 30 characters", () => {
  assert.deepEqual(validateSignup(signupFields("leblon.fit_2030"), new Date(2024, 0, 1)), {});
  assert.deepEqual(validateSignup(signupFields("a".repeat(30)), new Date(2024, 0, 1)), {});
});

test("signup rejects usernames outside the allowed length and character set", () => {
  assert.ok(validateSignup(signupFields("ab"), new Date(2024, 0, 1)).username);
  assert.ok(validateSignup(signupFields("a".repeat(31)), new Date(2024, 0, 1)).username);
  assert.ok(validateSignup(signupFields("name with spaces"), new Date(2024, 0, 1)).username);
});
