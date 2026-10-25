import { mapProfile, signMedia } from "./socialService.js";
import { createSecureId } from "./secureId.js";

export const PROFESSIONAL_CATEGORIES = [
  { id: "empresa", label: "Empresa", description: "Apresente sua empresa, serviços e portfólio. A equipe revisará seus dados antes de qualquer aprovação." },
  { id: "marca", label: "Loja ou marca parceira", description: "Mostre produtos, catálogo e canais comerciais para análise." },
  { id: "vendedor", label: "Vendedor Fortalfy Shop", description: "Solicite análise para habilitar uma operação de vendas." },
  { id: "restaurante", label: "Restaurante ou negócio de alimentação", description: "Apresente o estabelecimento, cardápio e informações de atendimento." },
  { id: "nutricionista", label: "Nutricionista", description: "Apresente seus dados profissionais e registro para revisão manual." },
  { id: "personal", label: "Personal trainer", description: "Apresente sua atuação, registro ou certificações para revisão." },
  { id: "academia", label: "Academia ou estúdio", description: "Cadastre a empresa, endereço, equipe e estrutura para revisão como parceiro Fortalfy." },
  { id: "influenciador", label: "Fortalfy Creator / Influenciador", description: "Candidate-se ao perfil oficial. A aprovação exige análise manual e o mínimo de audiência definido pela Fortalfy. Se ainda não atingir, você pode continuar como creator da comunidade pela conta comum, sem selo oficial." },
];

const COMMON_FIELDS = [
  { id: "displayName", label: "Nome público", required: true, maxLength: 120 },
  { id: "contactEmail", label: "E-mail profissional", type: "email", required: true, maxLength: 254 },
  { id: "phone", label: "Telefone profissional", type: "tel", required: true, maxLength: 40 },
  { id: "city", label: "Cidade e estado", required: true, maxLength: 120 },
  { id: "addressCountry", label: "País do endereço", required: true, maxLength: 80 },
  { id: "addressState", label: "Estado / UF", required: true, maxLength: 80 },
  { id: "addressCity", label: "Cidade", required: true, maxLength: 120 },
  { id: "addressNeighborhood", label: "Bairro", required: true, maxLength: 120 },
  { id: "addressStreet", label: "Logradouro", required: true, maxLength: 180 },
  { id: "addressNumber", label: "Número", required: true, maxLength: 30 },
  { id: "addressPostalCode", label: "CEP", required: true, maxLength: 12 },
  { id: "addressComplement", label: "Complemento (opcional)", maxLength: 120 },
  { id: "addressType", label: "Tipo de endereço", type: "select", options: ["residencial", "comercial", "atendimento", "sede"], required: true, maxLength: 30 },
  { id: "website", label: "Site oficial (opcional)", type: "url", maxLength: 2048 },
  { id: "description", label: "Apresentação", type: "textarea", required: true, maxLength: 2000 },
];

const CATEGORY_FIELDS = {
  empresa: [
    { id: "legalName", label: "Razão social", required: true, maxLength: 180 },
    { id: "businessId", label: "CNPJ da empresa", required: true, maxLength: 18 },
    { id: "representativeName", label: "Nome do representante legal", required: true, maxLength: 180 },
    { id: "representativeDocument", label: "CPF do representante (privado)", required: true, maxLength: 14 },
    { id: "category", label: "Área de atuação", required: true, maxLength: 100 },
    { id: "address", label: "Endereço comercial (opcional)", maxLength: 300 },
    { id: "services", label: "Serviços oferecidos (opcional)", type: "textarea", maxLength: 1200 },
  ],
  marca: [
    { id: "legalName", label: "Razão social", required: true, maxLength: 180 },
    { id: "businessId", label: "CNPJ da empresa", required: true, maxLength: 18 },
    { id: "representativeName", label: "Nome do representante legal", required: true, maxLength: 180 },
    { id: "representativeDocument", label: "CPF do representante (privado)", required: true, maxLength: 14 },
    { id: "category", label: "Categoria de produtos", required: true, maxLength: 100 },
    { id: "country", label: "País de operação", required: true, maxLength: 80 },
  ],
  vendedor: [
    { id: "legalName", label: "Razão social", required: true, maxLength: 180 },
    { id: "businessId", label: "CNPJ da empresa", required: true, maxLength: 18 },
    { id: "representativeName", label: "Nome do representante legal", required: true, maxLength: 180 },
    { id: "representativeDocument", label: "CPF do representante (privado)", required: true, maxLength: 14 },
    { id: "category", label: "Categoria de produtos", required: true, maxLength: 100 },
    { id: "shippingPolicy", label: "Política de envio (opcional)", type: "textarea", maxLength: 1200 },
    { id: "returnPolicy", label: "Política de troca e devolução (opcional)", type: "textarea", maxLength: 1200 },
  ],
  restaurante: [
    { id: "legalName", label: "Razão social", required: true, maxLength: 180 },
    { id: "businessId", label: "CNPJ do estabelecimento", required: true, maxLength: 18 },
    { id: "representativeName", label: "Nome do representante legal", required: true, maxLength: 180 },
    { id: "representativeDocument", label: "CPF do representante (privado)", required: true, maxLength: 14 },
    { id: "cuisine", label: "Categoria culinária", required: true, maxLength: 100 },
    { id: "serviceModes", label: "Modalidades (entrega, retirada, salão)", maxLength: 200 },
  ],
  nutricionista: [
    { id: "legalName", label: "Nome civil", required: true, maxLength: 180 },
    { id: "personDocument", label: "CPF (somente para análise privada)", required: true, maxLength: 14 },
    { id: "registrationNumber", label: "Número do CRN", required: true, maxLength: 40 },
    { id: "registrationRegion", label: "Região do CRN", required: true, maxLength: 12 },
    { id: "specialties", label: "Especialidades", required: true, maxLength: 300 },
    { id: "serviceModes", label: "Modalidades (online/presencial)", required: true, maxLength: 100 },
  ],
  personal: [
    { id: "legalName", label: "Nome civil", required: true, maxLength: 180 },
    { id: "personDocument", label: "CPF (somente para análise privada)", required: true, maxLength: 14 },
    { id: "registrationNumber", label: "Número do CREF (quando aplicável)", required: true, maxLength: 40 },
    { id: "specialties", label: "Especialidades", required: true, maxLength: 300 },
    { id: "serviceModes", label: "Modalidades (online/presencial)", required: true, maxLength: 100 },
  ],
  influenciador: [
    { id: "legalName", label: "Nome civil", required: true, maxLength: 180 },
    { id: "personDocument", label: "CPF do titular (somente para análise privada)", required: true, maxLength: 14 },
    { id: "birthDate", label: "Data de nascimento", type: "date", required: true, maxLength: 10 },
    { id: "country", label: "País de atuação", required: true, maxLength: 80 },
    { id: "fitnessNiches", label: "Nicho principal", required: true, maxLength: 300 },
    { id: "socialLinks", label: "Links oficiais de redes sociais", type: "textarea", required: true, maxLength: 2048 },
    { id: "declaredFollowers", label: "Seguidores declarados por rede (serão conferidos manualmente)", type: "textarea", required: true, maxLength: 500 },
    { id: "averageViews", label: "Média aproximada de visualizações", maxLength: 80 },
    { id: "portfolio", label: "Portfólio e trabalhos anteriores", type: "textarea", maxLength: 1200 },
  ],
  academia: [
    { id: "legalName", label: "Razão social", required: true, maxLength: 180 },
    { id: "businessId", label: "CNPJ da academia ou estúdio", required: true, maxLength: 18 },
    { id: "representativeName", label: "Nome do representante legal", required: true, maxLength: 180 },
    { id: "representativeDocument", label: "CPF do representante (privado)", required: true, maxLength: 14 },
    { id: "category", label: "Modalidades e estrutura", required: true, maxLength: 300 },
    { id: "services", label: "Serviços oferecidos", type: "textarea", required: true, maxLength: 1200 },
    { id: "operatingHours", label: "Horário de funcionamento", required: true, maxLength: 180 },
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

export async function loadPublicProfessionalDirectory(client, { offset = 0, limit = 24, kind = "", search = "", city = "" } = {}) {
  if (!client) throw new Error("O diretório profissional está indisponível.");
  const kinds = ["cliente", "personal", "nutricionista", "academia", "restaurante", "marca", "empresa", "vendedor", "influenciador"];
  if (kind && !kinds.includes(kind)) throw new Error("Especialidade inválida.");
  let query = client.from("profiles")
    .select("id,display_name,username,bio,city,avatar_path,kind,verified_at,partner_approved_at,is_private,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);
  const safeTerm = String(search).trim().replace(/[,%()\\_*]/g, " ").replace(/\s+/g, " ").slice(0, 80);
  if (kind) query = query.eq("kind", kind);
  if (safeTerm) query = query.or(`display_name.ilike.%${safeTerm}%,username.ilike.%${safeTerm}%,bio.ilike.%${safeTerm}%,city.ilike.%${safeTerm}%`);
  const safeCity = String(city).trim().replace(/[%_]/g, " ").slice(0, 80);
  if (safeCity) query = query.ilike("city", `%${safeCity}%`);
  const { data, error, count } = await query;
  if (error) throw error;

  const profileIds = [...new Set((data || []).map(row => row.id).filter(Boolean))];
  let approvedProfiles = [];
  if (profileIds.length) {
    const result = await client.from("professional_profile_public")
      .select("application_id,profile_id,kind,public_data,updated_at")
      .in("profile_id", profileIds);
    if (result.error) throw result.error;
    approvedProfiles = result.data || [];
  }
  const approvedByProfile = new Map();
  approvedProfiles.forEach(row => {
    if (!approvedByProfile.has(row.profile_id)) approvedByProfile.set(row.profile_id, row);
  });
  const professionals = await Promise.all((data || []).map(async row => {
    const profile = mapProfile(row);
    const approval = approvedByProfile.get(row.id);
    const publicData = approval?.public_data || {};
    return {
      id: row.id,
      applicationId: row.id,
      name: (approval && publicData.displayName) || profile?.name || "Pessoa Fortalfy",
      username: profile?.username || "",
      city: publicData.city || profile?.city || "",
      description: publicData.description || profile?.bio || "",
      avatar: await signMedia(client, profile?.avatar || ""),
      verified: Boolean(approval),
      isPrivate: profile ? Boolean(profile.isPrivate) : true,
      kind: approval?.kind || profile?.kind || "cliente",
      website: publicData.website || "",
      updatedAt: row.created_at || approval?.updated_at || "",
    };
  }));
  return {
    professionals,
    total: count ?? offset + professionals.length,
    hasMore: count == null ? professionals.length === limit : offset + professionals.length < count,
  };
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

function validCpf(value) {
  const cpf = String(value || "").replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = length => {
    const sum = cpf.slice(0, length).split("").reduce((total, number, index) => total + Number(number) * (length + 1 - index), 0);
    const result = (sum * 10) % 11;
    return result === 10 ? 0 : result;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

function validCnpj(value) {
  const cnpj = String(value || "").replace(/\D/g, "");
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calculate = length => {
    const weights = length === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    const sum = cnpj.slice(0, length).split("").reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return calculate(12) === Number(cnpj[12]) && calculate(13) === Number(cnpj[13]);
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
  if (!allowIncomplete && ["nutricionista", "personal", "influenciador"].includes(categoryId) && !validCpf(values.personDocument)) {
    errors.personDocument = "Informe um CPF válido para a análise privada.";
  }
  if (!allowIncomplete && ["empresa", "marca", "vendedor", "restaurante", "academia"].includes(categoryId)) {
    if (!validCnpj(values.businessId)) errors.businessId = "Informe um CNPJ válido da empresa.";
    if (!validCpf(values.representativeDocument)) errors.representativeDocument = "Informe um CPF válido para o representante legal.";
  }
  if (values.addressPostalCode && !/^[\d\s-]{5,12}$/.test(values.addressPostalCode)) {
    errors.addressPostalCode = "Informe um CEP válido.";
  }
  if (categoryId === "influenciador" && values.birthDate) {
    const date = new Date(`${values.birthDate}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== values.birthDate || date > new Date()) {
      errors.birthDate = "Informe uma data de nascimento válida.";
    } else {
      const age = new Date().getUTCFullYear() - date.getUTCFullYear();
      const beforeBirthday = new Date().getUTCMonth() < date.getUTCMonth()
        || (new Date().getUTCMonth() === date.getUTCMonth() && new Date().getUTCDate() < date.getUTCDate());
      if (age - Number(beforeBirthday) < 18) errors.birthDate = "A candidatura oficial está disponível apenas para maiores de 18 anos.";
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

function isMissingOptionalApplicationColumn(error) {
  return ["42703", "PGRST204"].includes(error?.code)
    && /professional_applications\.(sla_due_at|reviewed_at|approved_at|rejected_at|current_revision)/i.test(error.message || "");
}

export async function loadProfessionalApplications(client, ownerId) {
  if (!client || !ownerId) throw new Error("Entre em uma conta Fortalfy para carregar seu cadastro profissional.");
  const columns = "id,kind,status,private_data,public_data,reviewer_note,submitted_at,sla_due_at,reviewed_at,approved_at,rejected_at,current_revision,updated_at";
  let result = await client.from("professional_applications")
    .select(columns)
    .eq("profile_id", ownerId)
    .order("updated_at", { ascending: false });
  if (isMissingOptionalApplicationColumn(result.error)) {
    result = await client.from("professional_applications")
      .select("id,kind,status,private_data,public_data,reviewer_note,submitted_at,updated_at")
      .eq("profile_id", ownerId)
      .order("updated_at", { ascending: false });
  }
  if (result.error) throw result.error;
  return result.data || [];
}

export async function loadProfessionalApplicationsForReview(client) {
  if (!client) throw new Error("A conexão com o Supabase não está configurada.");
  const columns = "id,profile_id,kind,status,private_data,public_data,reviewer_note,submitted_at,sla_due_at,reviewed_at,approved_at,rejected_at,current_revision,updated_at";
  let result = await client.from("professional_applications")
    .select(columns)
    .neq("status", "draft")
    .order("submitted_at", { ascending: true });
  if (isMissingOptionalApplicationColumn(result.error)) {
    result = await client.from("professional_applications")
      .select("id,profile_id,kind,status,private_data,public_data,reviewer_note,submitted_at,updated_at")
      .neq("status", "draft")
      .order("submitted_at", { ascending: true });
  }
  if (result.error) throw result.error;
  return result.data || [];
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

export async function recordCreatorReviewEvidence(client, applicationId, evidence) {
  if (!client || !applicationId) throw new Error("Não foi possível localizar a candidatura Creator.");
  const { data, error } = await client.rpc("record_fortalfy_creator_evidence", {
    p_application_id: applicationId,
    p_observed_followers: evidence.observedFollowers,
    p_ownership_confirmed: Boolean(evidence.ownershipConfirmed),
    p_validation_method: evidence.validationMethod,
    p_evidence_note: String(evidence.evidenceNote || "").trim(),
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
  const { error: auditError } = await client.rpc("record_fortalfy_professional_document_access", { p_storage_path: storagePath });
  if (auditError) throw auditError;
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
