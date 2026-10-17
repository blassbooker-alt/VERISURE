import assert from "node:assert/strict";
import test from "node:test";
import { buildPlateUrl, getCheckinFailureMessage } from "./gymAccessService.js";

test("builds stable QR and NFC links for the same plate and deployment base path", () => {
  const origin = "https://fortalfy.example/app/";
  const publicId = "5c1dbd68-65f0-4c71-a100-2e9ba569a529";

  assert.equal(
    buildPlateUrl(origin, publicId, "qr"),
    "https://fortalfy.example/app/#/checkin/5c1dbd68-65f0-4c71-a100-2e9ba569a529?via=qr",
  );
  assert.equal(
    buildPlateUrl(origin, publicId, "nfc"),
    "https://fortalfy.example/app/#/checkin/5c1dbd68-65f0-4c71-a100-2e9ba569a529?via=nfc",
  );
});

test("refuses insecure production URLs and unsupported access methods", () => {
  assert.throws(() => buildPlateUrl("http://fortalfy.example/app/", "plate-id", "qr"), /HTTPS válido/);
  assert.throws(() => buildPlateUrl("https://fortalfy.example/", "plate-id", "button"), /obrigatórios/);
  assert.equal(
    buildPlateUrl("http://localhost:5173/app/", "plate-id", "qr"),
    "http://localhost:5173/app/#/checkin/plate-id?via=qr",
  );
});

test("returns clear server denial messages without success-shaped fallbacks", () => {
  assert.match(getCheckinFailureMessage("no_eligible_membership"), /assinatura FortalPass elegível/);
  assert.match(getCheckinFailureMessage("no_active_gym_contract"), /contrato de acesso vigente/);
  assert.match(getCheckinFailureMessage("daily_access_already_recorded"), /já registrou um acesso/);
  assert.match(getCheckinFailureMessage("unknown_reason"), /servidor não autorizou/);
});
