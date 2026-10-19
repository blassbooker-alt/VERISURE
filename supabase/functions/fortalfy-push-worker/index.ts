import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-fortal-worker-secret" };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

function constantTimeEqual(left: string, right: string) {
  if (!left || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response({ error: "Method not allowed" }, 405);
  const expectedSecret = Deno.env.get("FORTALFY_PUSH_WORKER_SECRET") || "";
  const receivedSecret = request.headers.get("x-fortal-worker-secret") || "";
  if (!constantTimeEqual(receivedSecret, expectedSecret)) return response({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const vapidPublicKey = Deno.env.get("WEB_PUSH_VAPID_PUBLIC_KEY") || "";
  const vapidPrivateKey = Deno.env.get("WEB_PUSH_VAPID_PRIVATE_KEY") || "";
  const contact = Deno.env.get("WEB_PUSH_CONTACT") || "mailto:fortalfy@gmail.com";
  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) return response({ error: "Push worker is not configured" }, 503);

  let batchSize = 100;
  try {
    const body = await request.json();
    if (Number.isInteger(body?.batchSize)) batchSize = Math.max(1, Math.min(100, body.batchSize));
  } catch { /* use the capped default */ }

  webpush.setVapidDetails(contact, vapidPublicKey, vapidPrivateKey);
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: notifications, error: claimError } = await admin.rpc("claim_fortal_notification_push_batch", { p_limit: batchSize });
  if (claimError) {
    console.error("Push queue claim failed.", claimError.code || "database_error");
    return response({ error: "Could not claim push notifications" }, 500);
  }

  let completed = 0;
  for (const notification of Array.isArray(notifications) ? notifications : []) {
    const results = [];
    const subscriptions = Array.isArray(notification.subscriptions) ? notification.subscriptions : [];
    for (const item of subscriptions) {
      try {
        const tag = String(notification.groupKey || notification.id).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
        await webpush.sendNotification(item.subscription, JSON.stringify({
          id: notification.id,
          title: String(notification.title || "Fortalfy").slice(0, 120),
          body: String(notification.body || "Você tem uma nova atualização.").slice(0, 240),
          route: notification.targetRoute,
          type: notification.notificationType,
          entityId: notification.entityId,
          soundEnabled: notification.soundEnabled !== false,
          tag,
          vibration: notification.vibration ? [120, 60, 120] : undefined,
        }), { TTL: 3600, urgency: notification.priority === "high" ? "high" : "normal", topic: tag.slice(0, 32) });
        results.push({ subscriptionId: item.id, outcome: "sent" });
      } catch (error) {
        const status = Number((error as { statusCode?: number })?.statusCode) || 0;
        const code = status === 404 || status === 410 ? "subscription_expired" : status ? `http_${status}` : "network_error";
        results.push({ subscriptionId: item.id, outcome: status === 404 || status === 410 ? "expired" : "failed", errorCode: code });
      }
    }
    if (subscriptions.length === 0) results.push({ outcome: "skipped", errorCode: "no_active_subscription" });
    const { error: finishError } = await admin.rpc("finish_fortal_notification_push", { p_notification_id: notification.id, p_results: results });
    if (finishError) {
      console.error("Push delivery receipt failed.", finishError.code || "database_error");
      return response({ error: "Could not record push delivery" }, 500);
    }
    completed++;
  }
  return response({ processed: completed });
});
