import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const jsonHeaders = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function response(body: unknown, status: number, origin: string | null, allowedOrigins: string[]) {
  const headers = new Headers(jsonHeaders);
  if (origin && allowedOrigins.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
    headers.set("Access-Control-Allow-Headers", "authorization, apikey, content-type, x-client-info, x-supabase-api-version, idempotency-key");
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  }
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async request => {
  const origin = request.headers.get("origin");
  const allowedOrigins = (Deno.env.get("FORTALFY_ALLOWED_ORIGINS") || "")
    .split(",").map(value => value.trim()).filter(Boolean);
  if (!origin || !allowedOrigins.includes(origin)) return response({ error: "Origem não autorizada." }, 403, origin, allowedOrigins);
  if (request.method === "OPTIONS") return response({}, 200, origin, allowedOrigins);
  if (request.method !== "POST") return response({ error: "Método não permitido." }, 405, origin, allowedOrigins);

  const accessToken = Deno.env.get("MERCADO_PAGO_TEST_ACCESS_TOKEN") || "";
  const webhookSecret = Deno.env.get("MERCADO_PAGO_TEST_WEBHOOK_SECRET") || "";
  const appUrl = Deno.env.get("FORTALFY_APP_URL") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!accessToken.startsWith("TEST-") || !webhookSecret || !appUrl || !supabaseUrl || !anonKey || !serviceRoleKey) {
    return response({ error: "Checkout de teste ainda não configurado no servidor." }, 503, origin, allowedOrigins);
  }

  const authorization = request.headers.get("authorization") || "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer) return response({ error: "Entre na sua conta para continuar." }, 401, origin, allowedOrigins);

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(bearer);
  if (authError || !authData.user) return response({ error: "Sua sessão expirou. Entre novamente." }, 401, origin, allowedOrigins);

  let body: { idempotencyKey?: string; items?: Array<{ id?: string; quantity?: number }> };
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 16000) {
      return response({ error: "Carrinho muito grande." }, 413, origin, allowedOrigins);
    }
    body = JSON.parse(rawBody);
  } catch {
    return response({ error: "Não foi possível ler o carrinho enviado." }, 400, origin, allowedOrigins);
  }
  if (!body || !uuidPattern.test(body.idempotencyKey || "") || !Array.isArray(body.items)
      || body.items.length < 1 || body.items.length > 20
      || body.items.some(item => !item || typeof item.id !== "string"
        || !/^[a-z0-9_-]{3,80}$/.test(item.id)
        || !Number.isInteger(item.quantity) || item.quantity! < 1 || item.quantity! > 20)) {
    return response({ error: "Carrinho de demonstração inválido." }, 400, origin, allowedOrigins);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: order, error: orderError } = await serviceClient.rpc("create_mp_sandbox_shop_order", {
    p_customer_id: authData.user.id,
    p_idempotency_key: body.idempotencyKey,
    p_items: body.items.map(item => ({ product_id: item.id, quantity: item.quantity })),
  });
  if (orderError || !order?.order_id || !Array.isArray(order.items) || !order.items.length) {
    console.error("Sandbox order creation failed.", orderError?.code || "invalid_order");
    return response({ error: "Não foi possível criar o pedido de teste. Atualize o catálogo e tente novamente." }, 409, origin, allowedOrigins);
  }

  let appBase: URL;
  try {
    appBase = new URL(appUrl);
  } catch {
    return response({ error: "URL de retorno do app inválida." }, 503, origin, allowedOrigins);
  }
  const backUrl = new URL(appBase);
  backUrl.hash = `/shop?order=${encodeURIComponent(order.order_id)}`;
  const preferencePayload = {
    items: order.items,
    external_reference: order.order_id,
    notification_url: `${supabaseUrl}/functions/v1/mercado-pago-sandbox-webhook`,
    back_urls: {
      success: backUrl.toString(),
      pending: backUrl.toString(),
      failure: backUrl.toString(),
    },
    metadata: { fortalfy_sandbox: true, order_id: order.order_id },
    expires: true,
    expiration_date_from: new Date().toISOString(),
    expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    statement_descriptor: "FORTALFY TESTE",
  };
  const preferenceResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": order.order_id,
    },
    body: JSON.stringify(preferencePayload),
  });
  if (!preferenceResponse.ok) {
    console.error("Mercado Pago sandbox preference failed.", preferenceResponse.status);
    return response({ error: "O Mercado Pago não conseguiu iniciar o checkout de teste." }, 502, origin, allowedOrigins);
  }
  const preference = await preferenceResponse.json();
  const sandboxUrl = preference.sandbox_init_point;
  if (!preference.id || typeof sandboxUrl !== "string" || !/^https:\/\/([a-z0-9-]+\.)*mercadopago\.com(\.br)?([/:?#]|$)/i.test(sandboxUrl)) {
    console.error("Mercado Pago did not return a valid sandbox checkout URL.");
    return response({ error: "O Mercado Pago não retornou um checkout de teste válido." }, 502, origin, allowedOrigins);
  }

  const { error: saveError } = await serviceClient.rpc("set_mp_sandbox_shop_preference", {
    p_order_id: order.order_id,
    p_customer_id: authData.user.id,
    p_preference_id: String(preference.id),
    p_checkout_url: sandboxUrl,
  });
  if (saveError) {
    console.error("Could not persist sandbox preference.", saveError.code || "database_error");
    return response({ error: "O checkout de teste foi iniciado, mas não foi possível vincular o pedido." }, 502, origin, allowedOrigins);
  }

  return response({
    orderId: order.order_id,
    total: order.total,
    currency: "BRL",
    sandbox: true,
    checkoutUrl: sandboxUrl,
  }, 200, origin, allowedOrigins);
});
