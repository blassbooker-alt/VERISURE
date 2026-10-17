import { mapProfile, signMedia } from "./socialService.js";
import { createSecureId } from "./secureId.js";

export const PROFESSIONAL_CATEGORIES = [
  { id: "empresa", label: "Empresa", description: "Apresente sua empresa, serviços e portfólio." },
  { id: "marca", label: "Marca", description: "Mostre produtos, coleções e campanhas." },
  { id: "vendedor", label: "Vendedor Fortalfy Shop", description: "Prepare seu catálogo e solicite acesso à operação de vendas." },
  { id: "restaurante", label: "Restaurante", description: "Apresente seu estabelecimento e cardápio." },
  { id: "nutricionista", label: "Nutricionista", description: "Divulgue sua atuação após análise das credenciais." },
  { id: "personal", label: "Personal trainer", description: "Apresente seus serviços e acompanhamento." },
  { id: "influenciador", label: "Influenciador fitness", description: "Conecte seu conteúdo esportivo a marcas e parceiros." },
];

const COMMON_FIELDS = [
  { id: "displayName", label: "Nome público", required: true, maxLength: 120 },
  { id: "contactEmail", label: "E-mail profissional", type: "email", required: true, maxLength: 254 },
  { id: "phone", label: "Telefone profissional", type: "tel", required: true, maxLength: 40 },
  { id: "city", label: "Cidade e estado", required: true, maxLength: 120 },
  { id: "website", label: "Site oficial (opcional)", type: "url", maxLength: 2048 },
  { id: "description", label: "Apresentação", type: "textarea", required: true, maxLength: 2000 },
];

const CATEGORY_FIELDS = {
  empresa: [
    { id: "legalName", label: "Razão social (opcional)", maxLength: 180 },
    { id: "businessId", label: "CNPJ ou identificação empresarial (opcional)", maxLength: 32 },
    { id: "category", label: "Área de atuação", required: true, maxLength: 100 },
    { id: "address", label: "Endereço comercial (opcional)", maxLength: 300 },
    { id: "services", label: "Serviços oferecidos (opcional)", type: "textarea", maxLength: 1200 },
  ],
  marca: [
    { id: "businessId", label: "CNPJ ou identificação empresarial (opcional)", maxLength: 32 },
    { id: "category", label: "Categoria de produtos", required: true, maxLength: 100 },
    { id: "country", label: "País de operação", required: true, maxLength: 80 },
  ],
  vendedor: [
    { id: "businessId", label: "CPF/CNPJ (opcional nesta etapa)", maxLength: 32 },
    { id: "category", label: "Categoria de produtos", required: true, maxLength: 100 },
    { id: "shippingPolicy", label: "Política de envio (opcional)", type: "textarea", maxLength: 1200 },
    { id: "returnPolicy", label: "Política de troca e devolução (opcional)", type: "textarea", maxLength: 1200 },
  ],
  restaurante: [
    { id: "businessId", label: "CNPJ ou identificação empresarial (opcional)", maxLength: 32 },
    { id: "cuisine", label: "Categoria culinária", required: true, maxLength: 100 },
    { id: "address", label: "Endereço do estabelecimento", required: true, maxLength: 300 },
    { id: "serviceModes", label: "Modalidades (entrega, retirada, salão)", maxLength: 200 },
  ],
  nutricionista: [
    { id: "registrationNumber", label: "Número do CRN", required: true, maxLength: 40 },
    { id: "registrationRegion", label: "Região do CRN", required: true, maxLength: 12 },
    { id: "specialties", label: "Especialidades", required: true, maxLength: 300 },
    { id: "serviceModes", label: "Modalidades (online/presencial)", required: true, maxLength: 100 },
  ],
  personal: [
    { id: "registrationNumber", label: "Número do CREF (quando aplicável)", required: true, maxLength: 40 },
    { id: "specialties", label: "Especialidades", required: true, maxLength: 300 },
    { id: "serviceModes", label: "Modalidades (online/presencial)", required: true, maxLength: 100 },
  ],
  influenciador: [
    { id: "fitnessNiches", label: "Nichos fitness e esportivos", required: true, maxLength: 300 },
    { id: "socialLinks", label: "Links oficiais de redes sociais", type: "textarea", required: true, maxLength: 2048 },
    { id: "declaredFollowers", label: "Seguidores declarados por rede (opcional)", type: "textarea", maxLength: 500 },
    { id: "portfolio", label: "Portfólio e formatos comerciais (opcional)", type: "textarea", maxLength: 1200 },
  ],
};

const ALLOWED_CATEGORIES = new Set(PROFESSIONAL_CATEGORIES.map(category => category.id));
const PROFESSIONAL_STATUS_LABELS = {
  draft: "Cadastro incompleto",
  under_review: "Em análise",
  approved: "Aprovado",
  correction_required: "Correções solicitadas",
  rejected: "Reprovado",
  suspended: "Suspenso",
};
const LINK_TYPES = new Set(["social", "official", "booking", "menu", "portfolio", "catalog", "contact", "other"]);

export function professionalFieldsFor(categoryId) {
  if (!ALLOWED_CATEGORIES.has(categoryId)) return [];
  return [...COMMON_FIELDS, ...CATEGORY_FIELDS[categoryId]];
}

export function professionalStatusLabel(status) {
  return PROFESSIONAL_STATUS_LABELS[status] || "Status não informado";
}

export function normalizeExternalUrl(value) {
  const input = String(value || "").trim();
  if (!input || input.length > 2048) return "";
  try {
    const parsed = new URL(input);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || !parsed.hostname.includes(".")) return "";
    return parsed.href;
  } catch {
    return "";
  }
}

export function validateProfessionalApplication(categoryId, values, { allowIncomplete = false } = {}) {
  const errors = {};
  if (!ALLOWED_CATEGORIES.has(categoryId)) return { category: "Selecione uma categoria profissional válida." };
  for (const field of professionalFieldsFor(categoryId)) {
    const value = String(values[field.id] || "").trim();
    if (field.required && !allowIncomplete && !value) errors[field.id] = `Preencha o campo “${field.label}”.`;
    if (value.length > (field.maxLength || 2000)) errors[field.id] = `O campo “${field.label}” excede o limite permitido.`;
    if (field.type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      errors[field.id] = "Informe um e-mail profissional válido.";
    }
    if (field.type === "url" && value && !normalizeExternalUrl(value)) {
      errors[field.id] = "Informe um endereço HTTPS válido.";
    }
  }
  if (categoryId === "influenciador" && String(values.socialLinks || "").trim()) {
    const links = String(values.socialLinks).split(/\r?\n/).map(value => value.trim()).filter(Boolean);
    if (links.some(value => !normalizeExternalUrl(value))) {
      errors.socialLinks = "Informe um link HTTPS válido em cada linha; não envie senhas das redes sociais.";
    }
  }
  return errors;
}

export function validateProfileLinks(links) {
  if (!Array.isArray(links) || links.length > 8) return "Cada perfil pode cadastrar até oito links.";
  for (const [index, link] of links.entries()) {
    if (typeof link.label !== "string" || !link.label.trim() || link.label.trim().length > 80) {
      return `Informe um nome válido para o link ${index + 1} (até 80 caracteres).`;
    }
    if (!normalizeExternalUrl(link.url)) {
      return `O endereço do link ${index + 1} precisa ser uma URL HTTPS válida.`;
    }
    if (!LINK_TYPES.has(link.type)) return `Selecione um tipo válido para o link ${index + 1}.`;
  }
  return "";
}

export async function loadProfessionalBookings(client, professionalId) {
  if (!client) throw new Error("A conexão com o Supabase não está configurada.");
  if (!professionalId || professionalId.startsWith("demo-") || professionalId.startsWith("local-")) {
    throw new Error("Entre com uma conta profissional real para consultar os agendamentos.");
  }

  const { data, error } = await client.from("bookings").select(`
    id,customer_id,professional_id,starts_at,modality,status,created_at,
    customer:profiles!bookings_customer_id_fkey(id,display_name,username,avatar_path,kind,verified_at,partner_approved_at,is_private)
  `)
    .eq("professional_id", professionalId)
    .order("starts_at", { ascending: true })
    .limit(100);
  if (error) throw error;

  return Promise.all((data || []).map(async row => {
    const customer = mapProfile(row.customer);
    if (!customer) throw new Error("Um agendamento não possui um perfil de cliente válido.");
    return {
      id: row.id,
      customer: { ...customer, avatar: await signMedia(client, customer.avatar) },
      startsAt: row.starts_at,
      modality: row.modality,
      status: row.status,
      createdAt: row.created_at,
    };
  }));
}

export async function loadProfessionalApplications(client, ownerId) {
  if (!client || !ownerId) throw new Error("Entre em uma conta Fortalfy para carregar seu cadastro profissional.");
  const { data, error } = await client.from("professional_applications")
    .select("id,kind,status,private_data,public_data,reviewer_note,submitted_at,updated_at")
    .eq("profile_id", ownerId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function loadProfessionalApplicationsForReview(client) {
  if (!client) throw new Error("A conexão com o Supabase não está configurada.");
  const { data, error } = await client.from("professional_applications")
    .select("id,profile_id,kind,status,private_data,public_data,reviewer_note,submitted_at,updated_at")
    .neq("status", "draft")
    .order("submitted_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function loadApprovedProfessionalProfiles(client, profileId) {
  if (!client || !profileId) return [];
  const { data, error } = await client.from("professional_profile_public")
    .select("application_id,kind,public_data,updated_at")
    .eq("profile_id", profileId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveProfessionalApplication(client, ownerId, categoryId, privateData) {
  if (!client || !ownerId) throw new Error("Entre em uma conta Fortalfy para salvar seu cadastro profissional.");
  if (!ALLOWED_CATEGORIES.has(categoryId)) throw new Error("Selecione uma categoria profissional válida.");
  const errors = validateProfessionalApplication(categoryId, privateData, { allowIncomplete: true });
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);

  const publicData = Object.fromEntries(
    ["displayName", "description", "city", "website"].map(key => [key, String(privateData[key] || "").trim()]),
  );
  const { data, error } = await client.from("professional_applications").upsert({
    profile_id: ownerId,
    kind: categoryId,
    private_data: privateData,
    public_data: publicData,
  }, { onConflict: "profile_id,kind" })
    .select("id,kind,status,private_data,public_data,reviewer_note,submitted_at,updated_at")
    .single();
  if (error) throw error;
  return data;
}

export async function submitProfessionalApplication(client, applicationId) {
  if (!client || !applicationId) throw new Error("Salve seu cadastro profissional antes de enviá-lo para análise.");
  const { data, error } = await client.rpc("submit_fortalfy_professional_application", { p_application_id: applicationId });
  if (error) throw error;
  return data;
}

export async function reviewProfessionalApplication(client, applicationId, status, reviewerNote = "") {
  if (!client || !applicationId) throw new Error("Não foi possível localizar a candidatura profissional.");
  const { data, error } = await client.rpc("review_fortalfy_professional_application", {
    p_application_id: applicationId,
    p_status: status,
    p_reviewer_note: reviewerNote.trim(),
  });
  if (error) throw error;
  return data;
}

export async function loadProfessionalApplicationDocuments(client, applicationId) {
  if (!client || !applicationId) return [];
  const { data, error } = await client.from("professional_application_documents")
    .select("id,application_id,document_kind,file_name,mime_type,size_bytes,storage_path,created_at")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function uploadProfessionalApplicationDocument(client, application, ownerId, file, documentKind) {
  if (!client || !application?.id || !ownerId) throw new Error("Salve o rascunho antes de enviar um documento.");
  const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
  if (!allowedTypes.has(file?.type)) throw new Error("Envie um documento PDF, JPG ou PNG.");
  if (file.size <= 0 || file.size > 10 * 1024 * 1024) throw new Error("O documento deve ter até 10 MB.");
  if (!["professional_credential", "business_identity", "other"].includes(documentKind)) {
    throw new Error("Selecione uma categoria de documento válida.");
  }
  const extension = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
  const path = `${ownerId}/${application.id}/${createSecureId()}.${extension}`;
  const { error: uploadError } = await client.storage.from("professional-documents").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) throw uploadError;
  const safeName = String(file.name || `documento.${extension}`).replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 180) || `documento.${extension}`;
  const { data, error } = await client.from("professional_application_documents")
    .insert({
      application_id: application.id,
      profile_id: ownerId,
      document_kind: documentKind,
      file_name: safeName,
      mime_type: file.type,
      size_bytes: file.size,
      storage_path: path,
    })
    .select("id,application_id,document_kind,file_name,mime_type,size_bytes,storage_path,created_at")
    .single();
  if (error) {
    const { error: cleanupError } = await client.storage.from("professional-documents").remove([path]);
    if (cleanupError) console.error("Não foi possível limpar o documento enviado sem cadastro.", cleanupError);
    throw error;
  }
  return data;
}

export async function removeProfessionalApplicationDocument(client, document) {
  if (!client || !document?.id || !document.storage_path) throw new Error("Não foi possível localizar o documento.");
  const { error: rowError } = await client.from("professional_application_documents").delete().eq("id", document.id);
  if (rowError) throw rowError;
  const { error: storageError } = await client.storage.from("professional-documents").remove([document.storage_path]);
  if (storageError) {
    console.error("O documento foi removido do cadastro, mas o arquivo privado não foi limpo.", storageError);
    throw new Error("O cadastro foi removido, mas a cópia privada do arquivo não pôde ser apagada. Solicite suporte.");
  }
}

export async function createProfessionalDocumentUrl(client, storagePath) {
  if (!client || !storagePath) throw new Error("Documento indisponível.");
  const { data, error } = await client.storage.from("professional-documents").createSignedUrl(storagePath, 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function loadProfileLinks(client, profileId, { owner = false } = {}) {
  if (!client || !profileId) throw new Error("Não foi possível carregar os links deste perfil.");
  let query = client.from("professional_profile_links")
    .select("id,label,url,link_type,sort_order,is_public,validation_status")
    .eq("profile_id", profileId)
    .order("sort_order", { ascending: true });
  if (!owner) query = query.eq("is_public", true);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function saveProfileLinks(client, profileId, links) {
  if (!client || !profileId) throw new Error("Entre em uma conta Fortalfy para gerenciar os links.");
  const validationError = validateProfileLinks(links);
  if (validationError) throw new Error(validationError);
  const payload = links.map(link => ({
    label: link.label.trim(),
    url: normalizeExternalUrl(link.url),
    link_type: link.type,
    is_public: link.isPublic !== false,
  }));
  const { data, error } = await client.rpc("save_fortalfy_profile_links", { p_links: payload });
  if (error) throw error;
  return data || [];
}

export async function saveSocialProfile(client, profile, links) {
  if (!client || !profile?.id) throw new Error("Entre em uma conta Fortalfy para atualizar seu perfil.");
  const validationError = validateProfileLinks(links);
  if (validationError) throw new Error(validationError);
  const { error } = await client.rpc("update_fortalfy_profile_with_links", {
    p_display_name: profile.name,
    p_username: profile.username || null,
    p_bio: profile.bio || "",
    p_city: profile.city || null,
    p_is_private: Boolean(profile.isPrivate),
    p_links: links.map(link => ({
      label: link.label.trim(),
      url: normalizeExternalUrl(link.url),
      link_type: link.type,
      is_public: link.isPublic !== false,
    })),
  });
  if (error) throw error;
}
