import test from "node:test";
import assert from "node:assert/strict";
import { createSecureId } from "../src/secureId.js";

test("createSecureId uses the native secure UUID generator when available", () => {
  assert.equal(createSecureId({ randomUUID: () => "native-id" }), "native-id");
});

test("createSecureId creates an RFC 4122 version 4 UUID using secure random bytes", () => {
  const cryptoApi = {
    getRandomValues: bytes => bytes.fill(0),
  };

  assert.equal(createSecureId(cryptoApi), "00000000-0000-4000-8000-000000000000");
});

test("createSecureId rejects environments without a secure random generator", () => {
  assert.throws(() => createSecureId({}), /geração segura/);
});
