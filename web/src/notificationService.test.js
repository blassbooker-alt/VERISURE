import assert from "node:assert/strict";
import test from "node:test";
import { NOTIFICATION_PREFERENCES_DEFAULTS, notificationErrorMessage, notificationFromRow } from "./notificationService.js";

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

test("notification preferences default to opt-in for activity and opt-out for promotions", () => {
  assert.equal(NOTIFICATION_PREFERENCES_DEFAULTS.likes_enabled, true);
  assert.equal(NOTIFICATION_PREFERENCES_DEFAULTS.messages_enabled, true);
  assert.equal(NOTIFICATION_PREFERENCES_DEFAULTS.marketing_enabled, false);
  assert.equal(NOTIFICATION_PREFERENCES_DEFAULTS.quiet_hours_start, "22:00");
});

test("missing notification schema gives a direct Supabase migration instruction", () => {
  assert.match(notificationErrorMessage({ code: "PGRST205" }), /FORTALFY_NOTIFICATIONS_V1\.sql/);
});
