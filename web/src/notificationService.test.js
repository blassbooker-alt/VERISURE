import assert from "node:assert/strict";
import test from "node:test";
import { markConversationNotificationsRead, NOTIFICATION_PREFERENCES_DEFAULTS, notificationErrorMessage, notificationFromRow } from "./notificationService.js";

test("notification rows map persisted read state, destination, and grouped count", () => {
  const notification = notificationFromRow({
    id: "notice-1", type: "social.like", title: "Nova curtida", body: "Três pessoas curtiram sua publicação.",
    created_at: "2026-10-18T12:00:00.000Z", read_at: null, target_route: "/feed?post=post-1",
    priority: "low", group_count: 3,
  });
  assert.equal(notification.id, "notice-1");
  assert.equal(notification.message, "Três pessoas curtiram sua publicação.");
  assert.equal(notification.targetRoute, "/feed?post=post-1");
  assert.equal(notification.groupCount, 3);
  assert.equal(notification.read, false);
});

test("notification rows preserve Brazilian Portuguese copy and user names exactly", () => {
  const samples = [
    ["Nova mensagem", "Você recebeu uma nova mensagem."],
    ["João D’Ávila comentou na sua publicação.", "Você recebeu um novo comentário."],
    ["François Çelik começou a seguir você.", "Você tem um novo seguidor na Fortalfy."],
    ["Nova conexão", "Você tem uma nova conexão na Fortalfy."],
  ];
  for (const [title, body] of samples) {
    const notification = notificationFromRow({
      id: title, type: "social.activity", title, body,
      created_at: "2026-10-19T12:00:00.000Z", read_at: null,
      target_route: "/notifications", priority: "normal", group_count: 1,
    });
    assert.equal(notification.title, title);
    assert.equal(notification.message, body);
  }
  const accentedWords = "Você Publicação Comentário Começou Conexão Notificação Coração Ação Informação Usuário";
  assert.match(accentedWords, /Você.*Publicação.*Comentário.*Começou.*Conexão.*Notificação.*Coração.*Ação.*Informação.*Usuário/);
});

test("notification preferences default social activity on, while reminders and promotions stay off", () => {
  assert.equal(NOTIFICATION_PREFERENCES_DEFAULTS.likes_enabled, true);
  assert.equal(NOTIFICATION_PREFERENCES_DEFAULTS.messages_enabled, true);
  assert.equal(NOTIFICATION_PREFERENCES_DEFAULTS.workout_reminders_enabled, false);
  assert.equal(NOTIFICATION_PREFERENCES_DEFAULTS.marketing_enabled, false);
  assert.equal(NOTIFICATION_PREFERENCES_DEFAULTS.message_preview_mode, "sender_only");
  assert.equal(NOTIFICATION_PREFERENCES_DEFAULTS.quiet_hours_start, "22:00");
});

test("reading a conversation only marks that recipient's matching message notices read", async () => {
  const calls = [];
  const response = { data: [{ id: "notice-1" }], error: null };
  const query = {
    update(value) { calls.push(["update", value]); return this; },
    eq(column, value) { calls.push(["eq", column, value]); return this; },
    is(column, value) { calls.push(["is", column, value]); return this; },
    select(columns) { calls.push(["select", columns]); return Promise.resolve(response); },
  };
  const client = { from(table) { calls.push(["from", table]); return query; } };
  assert.deepEqual(await markConversationNotificationsRead(client, "user-1", "conversation-1"), ["notice-1"]);
  assert.deepEqual(calls.filter(([method]) => method === "eq"), [
    ["eq", "recipient_user_id", "user-1"],
    ["eq", "type", "chat.message"],
    ["eq", "target_entity_id", "conversation-1"],
  ]);
});

test("missing notification schema gives a direct Supabase migration instruction", () => {
  assert.match(notificationErrorMessage({ code: "PGRST205" }), /FORTALFY_NOTIFICATIONS_V1\.sql/);
  assert.match(notificationErrorMessage({ code: "PGRST204", message: "message_preview_mode missing" }), /FORTALFY_NOTIFICATIONS_V1_5_MESSAGE_PRIVACY\.sql/);
});
