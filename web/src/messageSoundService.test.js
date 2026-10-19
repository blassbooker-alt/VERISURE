import test from "node:test";
import assert from "node:assert/strict";
import { canPlayMessageSound, isWithinMessageQuietHours, MESSAGE_SOUND_ASSETS } from "./messageSoundService.js";

const base = { sound_enabled: true, messages_enabled: true, quiet_hours_start: "22:00", quiet_hours_end: "07:00", timezone: "America/Sao_Paulo" };

test("message sound files are mapped to the supplied Fortalfy MP3s", () => {
  assert.equal(MESSAGE_SOUND_ASSETS["push-recebida"], "fortalfy-mensagem-push-recebida.mp3");
  assert.equal(MESSAGE_SOUND_ASSETS["inapp-recebida"], "fortalfy-mensagem-inapp-recebida.mp3");
  assert.equal(MESSAGE_SOUND_ASSETS["inapp-enviada"], "fortalfy-mensagem-inapp-enviada.mp3");
});

test("quiet hours cover the overnight interval and exclude its end", () => {
  assert.equal(isWithinMessageQuietHours(base, new Date("2026-10-18T01:00:00Z")), true); // 22:00 in São Paulo
  assert.equal(isWithinMessageQuietHours(base, new Date("2026-10-18T10:00:00Z")), false); // 07:00 in São Paulo
});

test("quiet hours support daytime intervals and equal endpoints disable the interval", () => {
  const daytime = { ...base, quiet_hours_start: "09:00", quiet_hours_end: "17:00" };
  assert.equal(isWithinMessageQuietHours(daytime, new Date("2026-10-18T15:00:00Z")), true);
  assert.equal(isWithinMessageQuietHours({ ...base, quiet_hours_start: "07:00", quiet_hours_end: "07:00" }, new Date("2026-10-18T15:00:00Z")), false);
});

test("sound and message preferences gate audio and invalid time zones fail silent", () => {
  const daytime = new Date("2026-10-18T15:00:00Z");
  assert.equal(canPlayMessageSound(base, daytime), true);
  assert.equal(canPlayMessageSound({ ...base, sound_enabled: false }, daytime), false);
  assert.equal(canPlayMessageSound({ ...base, messages_enabled: false }, daytime), false);
  assert.equal(canPlayMessageSound({ ...base, timezone: "Bad/Zone" }, daytime), false);
});
