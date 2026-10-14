import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const encoder = new TextEncoder();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i++) mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return mismatch === 0;
}

async function verifySignature(secret: string, signature: string, requestId: string, dataId: string) {
  const parts = Object.fromEntries(signature.split(",").map(part => {
    const [key, ...value] = part.trim().split("=");
    return [key, value.join("=")];
  }));
  if (!parts.ts || !parts.v1 || !/^\d+$/.test(parts.ts)) return false;
  const timestamp = Number(parts.ts);
  if (Math.abs(Date.now() - timestamp * 1000) > 5 * 60 * 1000) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(manifest)));
  const expected = [...digest].map(value => value.toString(16).padStart(2, "0")).join("");
  return constantTimeEqual(expected, parts.v1.toLowerCase());
}

Deno.serve(async request => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const accessToken = Deno.env.get("MERCADO_PAGO_TEST_ACCESS_TOKEN") || "";
  const webhookSecret = Deno.env.get("MERCADO_PAGO_TEST_WEBHOOK_SECRET") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!accessToken.startsWith("TEST-") || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
    return json({ error: "Sandbox webhook is not configured" }, 503);
  }

  const url = new URL(request.url);
  let body: { type?: string; data?: { id?: string } } = {};
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 32000) {
      return json({ error: "Webhook body too large" }, 413);
    }
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid webhook body" }, 400);
  }
  const type = url.searchParams.get("type") || body.type;
  if (type !== "payment") return json({ received: true });
  const paymentId = url.searchParams.get("data.id") || body.data?.id;
  const signature = request.headers.get("x-signature") || "";
  const requestId = request.headers.get("x-request-id") || "";
  if (!paymentId || !/^\d+$/.test(String(paymentId)) || !signature || !requestId) {
    return json({ error: "Missing signed payment identifiers" }, 400);
  }
  if (!await verifySignature(webhookSecret, signature, requestId, String(paymentId))) {
    return json({ error: "Invalid webhook signature" }, 401);
  }

  const providerResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(String(paymentId))}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!providerResponse.ok) {
    console.error("Mercado Pago sandbox payment lookup failed.", providerResponse.status);
    return json({ error: "Could not verify sandbox payment" }, 502);
  }
  const payment = await providerResponse.json();
  const orderId = String(payment.external_reference || "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)
      || payment.currency_id !== "BRL" || !Number.isFinite(payment.transaction_amount)) {
    return json({ error: "Payment does not match a Fortalfy sandbox order" }, 422);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: order, error: orderError } = await serviceClient.from("shop_orders")
    .select("id,total,test_mode,preference_id")
    .eq("id", orderId)
    .single();
  if (orderError || !order?.test_mode || Math.abs(Number(order.total) - payment.transaction_amount) > 0.01) {
    console.error("Sandbox payment did not match a stored order.", orderError?.code || "order_mismatch");
    return json({ error: "Payment does not match a Fortalfy sandbox order" }, 422);
  }
  if (payment.preference_id && order.preference_id && payment.preference_id !== order.preference_id) {
    return json({ error: "Payment preference does not match the order" }, 422);
  }

  const statusMap: Record<string, string> = {
    approved: "approved",
    pending: "pending",
    in_process: "pending",
    authorized: "pending",
    rejected: "rejected",
    cancelled: "cancelled",
    refunded: "refunded",
    charged_back: "refunded",
  };
  const paymentStatus = statusMap[payment.status];
  if (!paymentStatus) return json({ error: "Unsupported payment status" }, 422);
  const { error: recordError } = await serviceClient.rpc("record_mp_sandbox_shop_payment", {
    p_order_id: orderId,
    p_payment_id: String(payment.id),
    p_status: paymentStatus,
    p_amount: payment.transaction_amount,
    p_currency: payment.currency_id,
    p_payload: {
      id: String(payment.id),
      status: payment.status,
      status_detail: payment.status_detail || null,
      transaction_amount: payment.transaction_amount,
      currency_id: payment.currency_id,
      external_reference: payment.external_reference,
    },
  });
  if (recordError) {
    console.error("Sandbox payment status could not be stored.", recordError.code || "database_error");
    return json({ error: "Could not persist sandbox payment status" }, 500);
  }
  return json({ received: true });
});
