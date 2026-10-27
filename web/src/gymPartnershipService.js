const PUBLIC_PARTNERSHIPS = "gym_partnerships_public";
const PUBLIC_EVENTS = "gym_partnership_events_public";
const PUBLIC_CAMPAIGNS = "gym_partnership_campaigns_public";

export async function loadPublicGymPartnerships(client) {
  if (!client) throw new Error("A vitrine de academias parceiras está indisponível.");
  const [partnerships, events, campaigns] = await Promise.all([
    client.from(PUBLIC_PARTNERSHIPS).select("*").order("commercial_name").limit(60),
    client.from(PUBLIC_EVENTS).select("*").order("starts_at", { ascending: true }).limit(30),
    client.from(PUBLIC_CAMPAIGNS).select("*").order("starts_on", { ascending: true }).limit(24),
  ]);
  const failure = partnerships.error || events.error || campaigns.error;
  if (failure) throw failure;
  return { partnerships: partnerships.data || [], events: events.data || [], campaigns: campaigns.data || [] };
}

export async function loadGymPartnershipAdmin(client) {
  if (!client) throw new Error("A administração de parcerias está indisponível.");
  const [partnerships, events, campaigns, notes, history] = await Promise.all([
    client.from("gym_partnerships").select("*").order("updated_at", { ascending: false }).limit(200),
    client.from("gym_partnership_events").select("*").order("starts_at", { ascending: false }).limit(250),
    client.from("gym_partnership_campaigns").select("*").order("updated_at", { ascending: false }).limit(250),
    client.from("gym_partnership_admin_notes").select("*"),
    client.from("gym_partnership_history").select("*").order("created_at", { ascending: false }).limit(500),
  ]);
  const failure = [partnerships, events, campaigns, notes, history].find(result => result.error)?.error;
  if (failure) throw failure;
  return {
    partnerships: partnerships.data || [], events: events.data || [], campaigns: campaigns.data || [],
    notes: Object.fromEntries((notes.data || []).map(note => [note.partnership_id, note])), history: history.data || [],
  };
}

export function normalizeList(value, max = 12) {
  return [...new Set(String(value || "").split(/\r?\n|,/).map(item => item.trim()).filter(Boolean))].slice(0, max);
}

export function validatePartnership(fields) {
  if (!fields.profile_id) return "Vincule a academia ao perfil aprovado correspondente.";
  if (String(fields.commercial_name || "").trim().length < 2) return "Informe o nome comercial da academia.";
  if (fields.publication_status === "published" && (fields.status !== "active" || !fields.public_authorized || !fields.brand_use_authorized || !fields.image_use_authorized)) {
    return "Para publicar, confirme status ativo e autorizações de divulgação, marca e imagem.";
  }
  if (fields.image_url && !isHttps(fields.image_url)) return "A imagem principal precisa usar um endereço HTTPS.";
  if (fields.link_url && !isHttps(fields.link_url)) return "O link público precisa usar HTTPS.";
  if (fields.gallery_urls.some(url => !isHttps(url))) return "Todas as fotos da galeria precisam usar HTTPS.";
  return "";
}

export function validateEvent(fields) {
  if (!fields.partnership_id) return "Selecione a parceria do evento.";
  if (String(fields.title || "").trim().length < 3) return "Informe o nome do evento.";
  if (!fields.starts_at) return "Informe a data e o horário reais do evento.";
  if (fields.image_url && !isHttps(fields.image_url)) return "A imagem do evento precisa usar HTTPS.";
  if (fields.registration_url && !isHttps(fields.registration_url)) return "O link de inscrição precisa usar HTTPS.";
  return "";
}

export function validateCampaign(fields) {
  if (!fields.partnership_id) return "Selecione a parceria da campanha.";
  if (String(fields.title || "").trim().length < 3) return "Informe o nome da campanha.";
  if (fields.image_url && !isHttps(fields.image_url)) return "A imagem da campanha precisa usar HTTPS.";
  return "";
}

const isHttps = value => {
  try { const url = new URL(String(value).trim()); return url.protocol === "https:" && !url.username && !url.password; }
  catch { return false; }
};
