import { publicAsset } from "./assetPath.js";

export const MESSAGE_SOUND_ASSETS = Object.freeze({
  "push-recebida": "fortalfy-mensagem-push-recebida.mp3",
  "inapp-recebida": "fortalfy-mensagem-inapp-recebida.mp3",
  "inapp-enviada": "fortalfy-mensagem-inapp-enviada.mp3",
  notification: "fortalfy-notificacao-profissional.mp3",
});

const soundVolumes = Object.freeze({ "push-recebida": 0.36, "inapp-recebida": 0.17, "inapp-enviada": 0.12, notification: 0.3 });
const playedMessages = new Set();
const pendingMessages = new Set();
const audioPlayers = new Map();
let audioUnlockStarted = false;
const DEFAULT_MESSAGE_SOUND_PREFERENCES = Object.freeze({
  sound_enabled: true,
  messages_enabled: true,
  quiet_hours_start: "22:00",
  quiet_hours_end: "07:00",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo",
});

function getAudioPlayer(kind) {
  if (typeof Audio === "undefined" || !MESSAGE_SOUND_ASSETS[kind]) return null;
  let audio = audioPlayers.get(kind);
  if (!audio) {
    audio = new Audio(publicAsset(MESSAGE_SOUND_ASSETS[kind]));
    audio.preload = "auto";
    audioPlayers.set(kind, audio);
  }
  return audio;
}

// Mobile browsers require media playback to be initiated by a user gesture.
export function primeMessageSounds() {
  if (audioUnlockStarted || typeof Audio === "undefined") return;
  audioUnlockStarted = true;
  for (const kind of ["push-recebida", "inapp-recebida", "inapp-enviada"]) {
    const audio = getAudioPlayer(kind);
    if (!audio) continue;
    audio.muted = true;
    try {
      const playback = audio.play();
      playback.then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
      }).catch(() => {
        audio.muted = false;
        audioUnlockStarted = false;
      });
    } catch {
      audio.muted = false;
      audioUnlockStarted = false;
    }
  }
}

export async function playNotificationCue() {
  const audio = getAudioPlayer("notification");
  if (!audio) return false;
  try {
    audio.volume = soundVolumes.notification;
    audio.currentTime = 0;
    audio.muted = false;
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

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
  const effectivePreferences = preferences || DEFAULT_MESSAGE_SOUND_PREFERENCES;
  return effectivePreferences.sound_enabled !== false
    && effectivePreferences.messages_enabled !== false
    && !isWithinMessageQuietHours(effectivePreferences, now);
}

export async function playMessageSound(kind, { messageId, preferences } = {}) {
  if (!MESSAGE_SOUND_ASSETS[kind] || !messageId || !canPlayMessageSound(preferences)) return false;
  const key = `${kind}:${messageId}`;
  if (playedMessages.has(key) || pendingMessages.has(key)) return false;
  const audio = getAudioPlayer(kind);
  if (!audio) return false;
  pendingMessages.add(key);
  try {
    audio.volume = soundVolumes[kind];
    audio.currentTime = 0;
    audio.muted = false;
    await audio.play();
    playedMessages.add(key);
    if (playedMessages.size > 500) playedMessages.delete(playedMessages.values().next().value);
    return true;
  } catch {
    return false;
  } finally {
    pendingMessages.delete(key);
  }
}
