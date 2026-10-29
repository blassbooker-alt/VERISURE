const REQUEST_FIELDS = Object.freeze([
  "business_goals",
  "products_or_services",
  "promotion_interest",
  "marketing_interest",
  "commercial_interest",
  "additional_information",
]);

export const PARTNERSHIP_REQUEST_STATUSES = Object.freeze({
  draft: "Rascunho",
  under_review: "Em análise pela Fortalfy",
  correction_required: "Ajustes solicitados",
  approved: "Parceria aprovada",
  rejected: "Solicitação não aprovada",
});

export function validatePartnershipRequest(request) {
  const value = request && typeof request === "object" && !Array.isArray(request) ? request : {};
  const errors = {};
  const goals = String(value.business_goals || "").trim();
  const offer = String(value.products_or_services || "").trim();
  const additional = String(value.additional_information || "").trim();
  if (goals.length < 10) errors.business_goals = "Descreva os objetivos da sua empresa em pelo menos 10 caracteres.";
  if (goals.length > 1200) errors.business_goals = "Os objetivos devem ter no máximo 1.200 caracteres.";
  if (offer.length < 10) errors.products_or_services = "Descreva os produtos ou serviços em pelo menos 10 caracteres.";
  if (offer.length > 1200) errors.products_or_services = "A descrição deve ter no máximo 1.200 caracteres.";
  if (additional.length > 2000) errors.additional_information = "As informações adicionais devem ter no máximo 2.000 caracteres.";
  for (const field of ["promotion_interest", "marketing_interest", "commercial_interest"]) {
    if (typeof value[field] !== "boolean") errors[field] = "Informe se há interesse nesta modalidade.";
  }
  return errors;
}

function normalizedRequest(request) {
  return Object.fromEntries(REQUEST_FIELDS.map(field => [
    field,
    typeof request[field] === "boolean" ? request[field] : String(request[field] || "").trim(),
  ]));
}

export async function loadOwnPartnershipRequest(client, applicationId) {
  if (!client || !applicationId) return null;
  const { data, error } = await client.from("professional_partnership_requests")
    .select("id,application_id,profile_id,status,request_data,reviewer_note,submitted_at,reviewed_at,updated_at")
    .eq("application_id", applicationId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function savePartnershipRequest(client, profileId, applicationId, request) {
  if (!client || !profileId || !applicationId) throw new Error("Salve seu cadastro Fortalfy antes de registrar o interesse em parceria.");
  const errors = validatePartnershipRequest(request);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  const { data, error } = await client.rpc("save_fortalfy_partnership_request", {
    p_application_id: applicationId,
    p_request_data: normalizedRequest(request),
  });
  if (error) throw error;
  return data;
}

export async function submitPartnershipRequest(client, requestId) {
  if (!client || !requestId) throw new Error("Salve sua solicitação antes de enviá-la para análise.");
  const { data, error } = await client.rpc("submit_fortalfy_partnership_request", { p_request_id: requestId });
  if (error) throw error;
  return data;
}

export async function loadPartnershipRequestsForReview(client) {
  if (!client) throw new Error("A conexão com o Supabase não está configurada.");
  const { data, error } = await client.from("professional_partnership_requests")
    .select("id,application_id,profile_id,status,request_data,reviewer_note,submitted_at,reviewed_at,updated_at,application:professional_applications!professional_partnership_requests_application_id_fkey(kind,private_data)")
    .neq("status", "draft")
    .order("submitted_at", { ascending: true })
    .limit(200);
  if (error) throw error;
  return data || [];
}

export async function reviewPartnershipRequest(client, requestId, status, reviewerNote) {
  if (!client || !requestId) throw new Error("Não foi possível localizar a solicitação de parceria.");
  if (!["approved", "correction_required", "rejected"].includes(status)) throw new Error("Decisão de parceria inválida.");
  if (String(reviewerNote || "").trim().length < 3) throw new Error("Informe o motivo da decisão.");
  const { data, error } = await client.rpc("review_fortalfy_partnership_request", {
    p_request_id: requestId,
    p_status: status,
    p_reviewer_note: String(reviewerNote).trim(),
  });
  if (error) throw error;
  return data;
}
