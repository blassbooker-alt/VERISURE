import { publicAsset } from "./assetPath.js";
import { isWithinMessageQuietHours, playNotificationCue } from "./messageSoundService.js";

export const NOTIFICATION_PREFERENCES_DEFAULTS = Object.freeze({
  likes_enabled: true,
  comments_enabled: true,
  mentions_enabled: true,
  messages_enabled: true,
  message_preview_mode: "sender_only",
  workout_reminders_enabled: false,
  partner_updates_enabled: true,
  shop_updates_enabled: true,
  marketing_enabled: false,
  sound_enabled: true,
  vibration_enabled: true,
  quiet_hours_start: "22:00",
  quiet_hours_end: "07:00",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo",
});

const playedNotificationSounds = new Set();
const pendingNotificationSounds = new Set();
const notificationPreferenceByType = Object.freeze({
  post_like: "likes_enabled", "social.like": "likes_enabled",
  post_comment: "comments_enabled", "social.comment": "comments_enabled", "social.reply": "comments_enabled",
  "social.mention": "mentions_enabled",
  message: "messages_enabled", nutritionist_message: "messages_enabled", personal_message: "messages_enabled", "chat.message": "messages_enabled",
  workout_reminder: "workout_reminders_enabled", "workout.schedule_changed": "workout_reminders_enabled",
  shop: "shop_updates_enabled", product_delivery: "shop_updates_enabled", food_delivery: "shop_updates_enabled", "shop.order_update": "shop_updates_enabled",
  official_promotion: "marketing_enabled",
  "partner.request_accepted": "partner_updates_enabled", "professional.approved": "partner_updates_enabled", "professional.review_update": "partner_updates_enabled",
});

const BASE64_URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function notificationErrorMessage(error, fallback = "Não foi possível concluir esta ação.") {
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  if (code === "PGRST204" && /message_preview_mode/i.test(message)) return "Aplique a migra\u00e7\u00e3o FORTALFY_NOTIFICATIONS_V1_5_MESSAGE_PRIVACY.sql no Supabase.";
  if (["PGRST205", "42P01", "42883"].includes(code) || /could not find the table|relation .* does not exist|function .* does not exist/i.test(message)) {
    return "A central de notificações ainda não foi configurada no Supabase. Aplique FORTALFY_NOTIFICATIONS_V1.sql e publique a função fortalfy-push-worker.";
  }
  return message || fallback;
}

function decodeBase64Url(value) {
  const normalized = value.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const bytes = [];
  let buffer = 0;
  let bits = 0;
  for (const char of normalized) {
    const index = BASE64_URL_ALPHABET.indexOf(char);
    if (index < 0) throw new Error("A chave pública VAPID não está em formato válido.");
    buffer = (buffer << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 255);
    }
  }
  return new Uint8Array(bytes);
}

export function notificationFromRow(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.body,
    createdAt: row.created_at,
    read: Boolean(row.read_at),
    readAt: row.read_at,
    targetRoute: row.target_route,
    priority: row.priority,
    groupCount: row.group_count || 1,
  };
}

export async function loadNotifications(client, userId, limit = 60) {
  if (!client || !userId) return [];
  const { data, error } = await client.from("fortalfy_notifications")
    .select("id,type,title,body,created_at,read_at,target_route,priority,group_count")
    .eq("recipient_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map(notificationFromRow);
}

export async function markNotificationRead(client, notificationId) {
  if (!client || !notificationId) return;
  const { error } = await client.from("fortalfy_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .is("read_at", null);
  if (error) throw error;
}

export async function markAllNotificationsRead(client, userId) {
  if (!client || !userId) return;
  const { error } = await client.from("fortalfy_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_user_id", userId)
    .is("read_at", null);
  if (error) throw error;
}

export async function markConversationNotificationsRead(client, userId, conversationId) {
  if (!client || !userId || !conversationId) return [];
  const { data, error } = await client.from("fortalfy_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_user_id", userId)
    .eq("type", "chat.message")
    .eq("target_entity_id", conversationId)
    .is("read_at", null)
    .select("id");
  if (error) throw error;
  return (data || []).map(row => row.id);
}

export async function loadNotificationPreferences(client, userId) {
  if (!client || !userId) return { ...NOTIFICATION_PREFERENCES_DEFAULTS };
  const { data, error } = await client.from("fortalfy_notification_preferences")
    .select("likes_enabled,comments_enabled,mentions_enabled,messages_enabled,message_preview_mode,workout_reminders_enabled,partner_updates_enabled,shop_updates_enabled,marketing_enabled,sound_enabled,vibration_enabled,quiet_hours_start,quiet_hours_end,timezone")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return { ...NOTIFICATION_PREFERENCES_DEFAULTS, ...(data || {}) };
}

export async function saveNotificationPreferences(client, userId, preferences) {
  if (!client || !userId) throw new Error("Entre na sua conta para salvar as preferências.");
  const { error } = await client.from("fortalfy_notification_preferences").upsert({
    user_id: userId,
    ...preferences,
    timezone: preferences.timezone || NOTIFICATION_PREFERENCES_DEFAULTS.timezone,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) throw error;
}

function pushPlatform() {
  const userAgent = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/i.test(userAgent)
    || (/Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1);
  return isIos ? "ios_pwa" : /Android/i.test(userAgent) ? "android_pwa" : "web";
}

async function registerPushSubscription(client, userId, subscription) {
  if (!client || !userId) throw new Error("Entre na sua conta para ativar as notifica\u00e7\u00f5es.");
  const { error } = await client.rpc("register_fortal_push_subscription", {
    p_subscription: subscription.toJSON(),
    p_platform: pushPlatform(),
    p_device_name: navigator.userAgent.slice(0, 160),
  });
  if (error) throw error;
}

export async function syncWebPushSubscription(client, userId) {
  if (!client || !userId || !("serviceWorker" in navigator) || !("PushManager" in window)) return { active: false };
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return { active: false };
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription || typeof Notification === "undefined" || Notification.permission !== "granted") return { active: false };
  await registerPushSubscription(client, userId, subscription);
  return { active: true, subscription };
}

export async function enableWebPush(client, userId) {
  if (!client || !userId) throw new Error("Entre na sua conta para ativar as notificações.");
  const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  const isInstalled = navigator.standalone === true || window.matchMedia?.("(display-mode: standalone)").matches;
  if (isIos && !isInstalled) return { supported: false, permission: typeof Notification === "undefined" ? "unsupported" : Notification.permission, reason: "ios-install-required" };
  if (!window.isSecureContext || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return { supported: false, permission: "unsupported" };
  }

  const vapidPublicKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY;
  if (!vapidPublicKey) throw new Error("O serviço de notificações ainda não foi configurado.");

  let permission = Notification.permission;
  if (permission !== "granted") permission = await Notification.requestPermission();
  if (permission !== "granted") return { supported: true, permission };

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription()
    || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeBase64Url(vapidPublicKey) });
  try {
    await registerPushSubscription(client, userId, subscription);
  } catch (error) {
    await subscription.unsubscribe().catch(() => {});
    throw error;
  }
  return { supported: true, permission, subscription };
}

export async function disableWebPush(client) {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager?.getSubscription();
  if (!subscription) return;
  const { error } = await client?.rpc("revoke_fortal_push_subscription", { p_endpoint: subscription.endpoint }) || {};
  if (error) throw error;
  await subscription.unsubscribe();
}

export async function sendTestNotification() {
  if (typeof Notification === "undefined" || !("serviceWorker" in navigator)) {
    throw new Error("Este navegador não oferece notificações do sistema.");
  }
  if (Notification.permission !== "granted") {
    throw new Error("Ative as notificações deste site nas configurações do navegador e tente novamente.");
  }
  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification("Fortalfy · teste de notificação", {
    body: "Tudo certo! As notificações do Fortalfy aparecem na barra do seu telefone.",
    icon: publicAsset("assets/fortalfy-icon-192.png"),
    badge: publicAsset("assets/fortalfy-notification-badge.svg"),
    tag: "fortalfy-notification-test",
    renotify: true,
    data: { route: "/settings/notifications", test: true },
  });
}

export async function playNotificationSound(preferences, { preview = false, notificationId, type } = {}) {
  const effectivePreferences = preferences || NOTIFICATION_PREFERENCES_DEFAULTS;
  if (effectivePreferences.sound_enabled === false) return false;
  const categoryPreference = notificationPreferenceByType[type];
  if (!preview && categoryPreference && effectivePreferences[categoryPreference] === false) return false;
  if (!preview && isWithinMessageQuietHours(effectivePreferences)) return false;
  const key = notificationId ? String(notificationId) : "";
  if (key && (playedNotificationSounds.has(key) || pendingNotificationSounds.has(key))) return false;
  if (key) pendingNotificationSounds.add(key);
  try {
    const played = await playNotificationCue();
    if (played && key) {
      playedNotificationSounds.add(key);
      if (playedNotificationSounds.size > 500) playedNotificationSounds.delete(playedNotificationSounds.values().next().value);
    }
    return played;
  } finally {
    if (key) pendingNotificationSounds.delete(key);
  }
}
