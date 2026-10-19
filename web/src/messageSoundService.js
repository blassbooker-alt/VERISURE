import { publicAsset } from "./assetPath.js";

export const MESSAGE_SOUND_ASSETS = Object.freeze({
  "push-recebida": "fortalfy-mensagem-push-recebida.mp3",
  "inapp-recebida": "fortalfy-mensagem-inapp-recebida.mp3",
  "inapp-enviada": "fortalfy-mensagem-inapp-enviada.mp3",
});

const soundVolumes = Object.freeze({ "push-recebida": 0.36, "inapp-recebida": 0.17, "inapp-enviada": 0.12 });
const playedMessages = new Set();

function localMinuteOfDay(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone || "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find(part => part.type === "hour")?.value);
  const minute = Number(parts.find(part => part.type === "minute")?.value);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) throw new RangeError("Invalid local time");
  return hour * 60 + minute;
}

function parseMinute(value, fallback) {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(value || fallback));
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
}

export function isWithinMessageQuietHours(preferences, now = new Date()) {
  const start = parseMinute(preferences?.quiet_hours_start, "22:00");
  const end = parseMinute(preferences?.quiet_hours_end, "07:00");
  if (start === null || end === null || start === end) return false;
  try {
    const current = localMinuteOfDay(now, preferences?.timezone);
    return start < end ? current >= start && current < end : current >= start || current < end;
  } catch {
    return true;
  }
}

export function canPlayMessageSound(preferences, now = new Date()) {
  return Boolean(preferences)
    && preferences.sound_enabled !== false
    && preferences.messages_enabled !== false
    && !isWithinMessageQuietHours(preferences, now);
}

export async function playMessageSound(kind, { messageId, preferences } = {}) {
  if (!MESSAGE_SOUND_ASSETS[kind] || !messageId || !canPlayMessageSound(preferences)) return false;
  const key = `${kind}:${messageId}`;
  if (playedMessages.has(key)) return false;
  playedMessages.add(key);
  if (playedMessages.size > 500) playedMessages.delete(playedMessages.values().next().value);
  if (typeof Audio === "undefined") return false;
  try {
    const audio = new Audio(publicAsset(MESSAGE_SOUND_ASSETS[kind]));
    audio.volume = soundVolumes[kind];
    await audio.play();
    return true;
  } catch {
    return false;
  }
}
