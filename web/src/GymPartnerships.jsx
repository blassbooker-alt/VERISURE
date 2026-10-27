import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BadgeCheck, Building2, CalendarDays, Check, CircleAlert, ExternalLink, LoaderCircle, MapPin, Megaphone, Plus, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { loadApprovedPartners } from "./partnerService.js";
import { loadGymPartnershipAdmin, loadPublicGymPartnerships, normalizeList, validateCampaign, validateEvent, validatePartnership } from "./gymPartnershipService.js";
import "./GymPartnerships.css";

const EMPTY_PARTNERSHIP = {
  id: "", profile_id: "", commercial_name: "", partnership_type: "", city: "", neighborhood: "",
  public_description: "", authorized_actions: "", image_url: "", gallery_urls: "", link_url: "",
  status: "negotiation", publication_status: "draft", public_authorized: false,
  brand_use_authorized: false, image_use_authorized: false, starts_on: "", ends_on: "",
  relationship_owner: "", internal_notes: "",
};
const EMPTY_EVENT = { id: "", partnership_id: "", title: "", image_url: "", starts_at: "", venue: "", description: "", status: "scheduled", publication_status: "draft", participation_info: "", registration_url: "" };
const EMPTY_CAMPAIGN = { id: "", partnership_id: "", title: "", image_url: "", brand_name: "", description: "", starts_on: "", ends_on: "", conditions: "", status: "draft" };
const STATUS_LABELS = { negotiation: "Em negociação", awaiting_approval: "Aguardando aprovação", active: "Ativa", suspended: "Suspensa", ended: "Encerrada" };
const EVENT_STATUS = { scheduled: "Programado", realized: "Realizado", cancelled: "Cancelado" };
const toLocalDateTimeInput = value => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

function PartnershipHero() {
  return <header className="gym-partnership-hero">
    <img src="/assets/visual-pack/fortalfy-pack-gym-interior.jpg" alt="Academia moderna com áreas de treino e equipamentos" />
    <div className="gym-partnership-hero-shade" />
    <div className="gym-partnership-hero-copy"><span className="eyebrow">PARCERIAS ESTRATÉGICAS</span><h2>Academias Parceiras <em>Fortalfy</em></h2><p>Marcas que se conectam à Fortalfy para fortalecer o universo fitness, promover experiências e criar oportunidades em conjunto.</p>
      <nav aria-label="Ações das academias parceiras"><a className="button lime-button" href="#academias"><Building2 size={15} /> Explorar academias parceiras</a><a className="button subtle" href="#eventos"><CalendarDays size={15} /> Conhecer ações e eventos</a><Link className="button subtle" to="/professional?category=academia"><Users size={15} /> Quero ser parceiro</Link></nav>
    </div>
    <div className="gym-partnership-hero-tag"><span>Juntos por</span><strong>mais pessoas<br />fortes.</strong><i /></div>
  </header>;
}

function TrustNote() {
  return <p className="gym-partnership-trust"><ShieldCheck size={15} /> A vitrine exibe somente parcerias ativas, aprovadas e autorizadas para divulgação.</p>;
}

function EmptySection({ icon: Icon = Building2, title, children }) {
  return <div className="gym-partnership-empty"><span><Icon size={24} /></span><h3>{title}</h3><p>{children}</p><Link to="/professional?category=academia" className="button lime-button">Quero ser parceiro <ArrowRight size={15} /></Link></div>;
}

function AcademyCard({ partnership }) {
  const cover = partnership.image_url || partnership.gallery_urls?.[0];
  return <article className="gym-partnership-card">
    <Link className="gym-partnership-card-image" to={`/partner/gym/${partnership.id}`} aria-label={`Conhecer parceria com ${partnership.commercial_name}`}>
      {cover ? <img src={cover} alt={`Imagem autorizada de ${partnership.commercial_name}`} loading="lazy" /> : <div className="gym-partnership-image-placeholder"><Building2 size={31} /></div>}
      <span className="gym-active-pill"><Check size={12} /> Parceria ativa</span>
    </Link>
    <div className="gym-partnership-card-body"><div className="gym-partnership-card-heading"><h3>{partnership.commercial_name}</h3><BadgeCheck size={17} aria-label="Parceria oficial Fortalfy" /></div>
      <p className="gym-partnership-location">{[partnership.neighborhood, partnership.city].filter(Boolean).join(" · ") || "Localização não informada"}</p>
      {!!partnership.partnership_type && <span className="gym-partnership-type">{partnership.partnership_type}</span>}
      <p className="gym-partnership-description">{partnership.public_description || "Parceria institucional com ações divulgadas conforme autorização vigente."}</p>
      {!!partnership.authorized_actions?.length && <div className="gym-partnership-tags">{partnership.authorized_actions.slice(0, 3).map(action => <span key={action}>{action}</span>)}</div>}
      <div className="gym-partnership-card-actions"><Link className="button lime-button" to={`/partner/gym/${partnership.id}`}>Conhecer parceria <ArrowRight size={14} /></Link></div>
    </div>
  </article>;
}

function EventCard({ event }) {
  const eventDate = new Date(event.starts_at);
  const formattedDate = Number.isNaN(eventDate.getTime()) ? "Data não informada" : new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(eventDate);
  return <article className="gym-partnership-event-card">
    {event.image_url ? <img className="gym-partnership-event-image" src={event.image_url} alt={`Divulgação autorizada: ${event.title}`} loading="lazy" /> : <div className="gym-partnership-event-placeholder"><CalendarDays size={24} /></div>}
    <div className="gym-partnership-event-body"><span className={`gym-event-status ${event.status}`}>{EVENT_STATUS[event.status] || event.status}</span><h3>{event.title}</h3><p className="gym-event-host"><Building2 size={14} /> {event.academy_name}</p><p><CalendarDays size={14} /> {formattedDate}</p>{event.venue && <p><MapPin size={14} /> {event.venue}{event.city ? ` · ${event.city}` : ""}</p>}{event.description && <p className="gym-event-description">{event.description}</p>}{event.participation_info && <p className="gym-event-participation">{event.participation_info}</p>}{event.registration_url && <a className="button lime-button" href={event.registration_url} target="_blank" rel="noreferrer">Informações de participação <ExternalLink size={14} /></a>}</div>
  </article>;
}

function CampaignCard({ campaign }) {
  return <article className="gym-partnership-campaign-card">{campaign.image_url ? <img src={campaign.image_url} alt={`Imagem autorizada da campanha ${campaign.title}`} loading="lazy" /> : <div className="gym-partnership-campaign-placeholder"><Megaphone size={26} /></div>}<div><span className="eyebrow">{campaign.brand_name || campaign.academy_name}</span><h3>{campaign.title}</h3><p>{campaign.description}</p>{campaign.conditions && <small>{campaign.conditions}</small>}<span className="gym-campaign-dates">{[campaign.starts_on, campaign.ends_on].filter(Boolean).map(value => new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR")).join(" – ") || "Período não informado"}</span></div></article>;
}

function AcademyDetail({ partnership, events, campaigns }) {
  const photos = [...new Set([partnership.image_url, ...(partnership.gallery_urls || [])].filter(Boolean))];
  const academyEvents = events.filter(event => event.partnership_id === partnership.id);
  const academyCampaigns = campaigns.filter(campaign => campaign.partnership_id === partnership.id);
  return <main className="gym-partnership-detail">
    <Link className="gym-partnership-back" to="/partner/gym"><ArrowLeft size={16} /> Todas as academias parceiras</Link>
    <header className="gym-detail-heading"><div><span className="eyebrow">PARCERIA OFICIAL FORTALFY</span><h2>{partnership.commercial_name}</h2><p>{[partnership.neighborhood, partnership.city].filter(Boolean).join(" · ")}</p></div><span className="gym-active-pill"><Check size={12} /> Parceria ativa</span></header>
    {!!photos.length && <div className={`gym-partnership-gallery ${photos.length === 1 ? "single" : ""}`}>{photos.slice(0, 8).map((photo, index) => <img key={photo} src={photo} alt={`${partnership.commercial_name} · foto autorizada ${index + 1}`} loading={index > 2 ? "lazy" : "eager"} />)}</div>}
    <div className="gym-detail-columns"><section className="gym-detail-panel"><span className="eyebrow">SOBRE A PARCERIA</span>{partnership.partnership_type && <strong className="gym-partnership-type">{partnership.partnership_type}</strong>}<p>{partnership.public_description}</p>{partnership.link_url && <a className="gym-detail-external-link" href={partnership.link_url} target="_blank" rel="noreferrer">Mais informações <ExternalLink size={14} /></a>}</section><section className="gym-detail-panel"><span className="eyebrow">AÇÕES AUTORIZADAS</span>{partnership.authorized_actions?.length ? <ul>{partnership.authorized_actions.map(action => <li key={action}><Check size={14} /> {action}</li>)}</ul> : <p>As ações conjuntas serão divulgadas conforme forem acordadas e autorizadas.</p>}</section></div>
    {academyEvents.length > 0 && <section className="gym-partnership-section"><div className="gym-partnership-section-title"><div><span className="eyebrow">AGENDA DA PARCERIA</span><h2>Eventos e experiências</h2></div><span>{academyEvents.length} publicados</span></div><div className="gym-events-grid">{academyEvents.map(event => <EventCard event={event} key={event.id} />)}</div></section>}
    {academyCampaigns.length > 0 && <section className="gym-partnership-section"><div className="gym-partnership-section-title"><div><span className="eyebrow">AÇÕES COMERCIAIS</span><h2>Campanhas e produtos</h2></div></div><div className="gym-campaigns-grid">{academyCampaigns.map(campaign => <CampaignCard campaign={campaign} key={campaign.id} />)}</div></section>}
    <TrustNote />
  </main>;
}

function PartnershipAdmin({ client, session, notify }) {
  const [partners, setPartners] = useState([]);
  const [data, setData] = useState({ partnerships: [], events: [], campaigns: [], notes: {}, history: [] });
  const [fields, setFields] = useState(EMPTY_PARTNERSHIP);
  const [eventFields, setEventFields] = useState(EMPTY_EVENT);
  const [campaignFields, setCampaignFields] = useState(EMPTY_CAMPAIGN);
  const [tab, setTab] = useState("partnerships");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const userId = session?.user?.id;
  const refresh = async () => {
    setLoading(true); setError("");
    try {
      const [adminData, approvedAcademies] = await Promise.all([loadGymPartnershipAdmin(client), loadApprovedPartners(client, { kind: "academia" })]);
      setData(adminData); setPartners(approvedAcademies.filter(partner => !partner.isPrivate));
    } catch (failure) { setError(failure.message || "Não foi possível abrir a gestão de parcerias."); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (userId && session?.user?.app_metadata?.role === "admin") refresh(); else setLoading(false); }, [client, userId]);

  const pickPartnership = partnership => {
    if (!partnership) { setFields({ ...EMPTY_PARTNERSHIP, profile_id: partners[0]?.profileId || "" }); return; }
    const note = data.notes[partnership.id] || {};
    setFields({ ...EMPTY_PARTNERSHIP, ...partnership, authorized_actions: (partnership.authorized_actions || []).join("\n"), gallery_urls: (partnership.gallery_urls || []).join("\n"), starts_on: partnership.starts_on || "", ends_on: partnership.ends_on || "", relationship_owner: note.relationship_owner || "", internal_notes: note.internal_notes || "" });
  };
  const partnershipSaved = data.partnerships.find(item => item.id === fields.id);
  const savePartnership = async event => {
    event.preventDefault();
    const payload = { ...fields, commercial_name: fields.commercial_name.trim(), partnership_type: fields.partnership_type.trim(), city: fields.city.trim(), neighborhood: fields.neighborhood.trim(), public_description: fields.public_description.trim(), authorized_actions: normalizeList(fields.authorized_actions, 20), image_url: fields.image_url.trim(), gallery_urls: normalizeList(fields.gallery_urls), link_url: fields.link_url.trim(), starts_on: fields.starts_on || null, ends_on: fields.ends_on || null, created_by: fields.id ? undefined : userId, updated_by: userId };
    const validation = validatePartnership(payload); if (validation) { setError(validation); return; }
    setSaving(true); setError("");
    try {
      const { relationship_owner, internal_notes, ...row } = payload;
      delete row.id; if (fields.id) row.id = fields.id;
      const { data: saved, error: saveError } = await client.from("gym_partnerships").upsert(row).select().single();
      if (saveError) throw saveError;
      const { error: noteError } = await client.from("gym_partnership_admin_notes").upsert({ partnership_id: saved.id, relationship_owner: relationship_owner.trim(), internal_notes: internal_notes.trim(), updated_at: new Date().toISOString() }, { onConflict: "partnership_id" });
      if (noteError) throw noteError;
      await refresh(); setFields(current => ({ ...current, ...saved, authorized_actions: saved.authorized_actions.join("\n"), gallery_urls: saved.gallery_urls.join("\n"), relationship_owner: relationship_owner.trim(), internal_notes: internal_notes.trim() })); notify("Parceria e histórico administrativo salvos.");
    } catch (failure) { setError(failure.message || "Não foi possível salvar a parceria."); }
    finally { setSaving(false); }
  };
  const partnershipOptions = useMemo(() => data.partnerships.map(item => ({ id: item.id, name: item.commercial_name })), [data.partnerships]);
  const saveEvent = async event => {
    event.preventDefault();
    const payload = { ...eventFields, title: eventFields.title.trim(), image_url: eventFields.image_url.trim(), venue: eventFields.venue.trim(), description: eventFields.description.trim(), participation_info: eventFields.participation_info.trim(), registration_url: eventFields.registration_url.trim(), starts_at: new Date(eventFields.starts_at).toISOString() };
    const validation = validateEvent(payload); if (validation) { setError(validation); return; }
    setSaving(true); setError("");
    try { const { id, ...row } = payload; const result = await client.from("gym_partnership_events").upsert(id ? { ...row, id } : row).select().single(); if (result.error) throw result.error; await refresh(); setEventFields({ ...EMPTY_EVENT, partnership_id: payload.partnership_id }); notify("Evento salvo. A visibilidade pública depende da parceria autorizada."); }
    catch (failure) { setError(failure.message || "Não foi possível salvar o evento."); } finally { setSaving(false); }
  };
  const saveCampaign = async event => {
    event.preventDefault();
    const payload = { ...campaignFields, title: campaignFields.title.trim(), image_url: campaignFields.image_url.trim(), brand_name: campaignFields.brand_name.trim(), description: campaignFields.description.trim(), conditions: campaignFields.conditions.trim(), starts_on: campaignFields.starts_on || null, ends_on: campaignFields.ends_on || null };
    const validation = validateCampaign(payload); if (validation) { setError(validation); return; }
    setSaving(true); setError("");
    try { const { id, ...row } = payload; const result = await client.from("gym_partnership_campaigns").upsert(id ? { ...row, id } : row).select().single(); if (result.error) throw result.error; await refresh(); setCampaignFields({ ...EMPTY_CAMPAIGN, partnership_id: payload.partnership_id }); notify("Campanha salva. Ofertas só aparecem conforme o período e disponibilidade cadastrados."); }
    catch (failure) { setError(failure.message || "Não foi possível salvar a campanha."); } finally { setSaving(false); }
  };

  if (session?.user?.app_metadata?.role !== "admin") return <div className="gym-admin-no-access"><ShieldCheck size={22} /><h2>Acesso restrito</h2><p>Somente a equipe autorizada da Fortalfy pode administrar parcerias.</p><Link className="button subtle" to="/partner/gym">Voltar à vitrine</Link></div>;
  return <section className="gym-partnership-admin">
    <header className="gym-admin-heading"><div><span className="eyebrow">OPERAÇÃO FORTALFY</span><h2>Gestão de parcerias</h2><p>Cadastro comercial independente da aprovação de perfil. A publicação exige autorização de marca, imagem e divulgação.</p></div><button type="button" className="button subtle small-button" onClick={refresh} disabled={loading}><RefreshCw size={14} /> Atualizar</button></header>
    <nav className="gym-admin-tabs" aria-label="Gestão da vitrine">{[["partnerships", "Parcerias"], ["events", "Eventos"], ["campaigns", "Campanhas"]].map(([key,label]) => <button type="button" key={key} className={tab === key ? "active" : ""} onClick={() => { setTab(key); setError(""); }}>{label}</button>)}</nav>
    {error && <p className="gym-admin-error" role="alert"><CircleAlert size={16} /> {error}</p>}
    {loading ? <p className="gym-admin-loading"><LoaderCircle className="spin" size={17} /> Carregando registros do banco…</p> : <>
      {tab === "partnerships" && <div className="gym-admin-grid"><aside className="gym-admin-list"><div className="gym-admin-list-head"><strong>{data.partnerships.length} registros</strong><button type="button" className="button lime-button small-button" onClick={() => pickPartnership(null)}><Plus size={14} /> Nova parceria</button></div>{data.partnerships.map(item => <button type="button" className={`gym-admin-record ${fields.id === item.id ? "active" : ""}`} key={item.id} onClick={() => pickPartnership(item)}><strong>{item.commercial_name}</strong><span>{STATUS_LABELS[item.status]} · {item.publication_status === "published" ? "Publicada" : "Rascunho"}</span></button>)}{data.partnerships.length === 0 && <p className="gym-admin-help">Ainda não existem registros de parceria.</p>}</aside>
        <form className="gym-admin-form" onSubmit={savePartnership}><div className="gym-admin-form-heading"><h3>{fields.id ? "Editar parceria" : "Nova parceria"}</h3>{fields.id && <span>Atualizada em {new Date(partnershipSaved?.updated_at || Date.now()).toLocaleDateString("pt-BR")}</span>}</div>
          <label>Academia com perfil aprovado<select required value={fields.profile_id} onChange={event => setFields(current => ({ ...current, profile_id: event.target.value }))}><option value="">Selecione</option>{partners.map(partner => <option key={partner.profileId} value={partner.profileId}>{partner.name}{partner.city ? ` · ${partner.city}` : ""}</option>)}</select></label>{partners.length === 0 && <p className="gym-admin-help">Nenhum perfil de academia aprovado disponível para vincular. O cadastro de perfil e a parceria comercial são revisões distintas.</p>}
          <label>Nome comercial<input required maxLength={160} value={fields.commercial_name} onChange={event => setFields(current => ({ ...current, commercial_name: event.target.value }))} /></label><label>Tipo de parceria<input maxLength={160} value={fields.partnership_type} onChange={event => setFields(current => ({ ...current, partnership_type: event.target.value }))} placeholder="Ex.: institucional, campanha, evento" /></label>
          <div className="gym-admin-row"><label>Cidade<input maxLength={120} value={fields.city} onChange={event => setFields(current => ({ ...current, city: event.target.value }))} /></label><label>Bairro<input maxLength={120} value={fields.neighborhood} onChange={event => setFields(current => ({ ...current, neighborhood: event.target.value }))} /></label></div>
          <label>Apresentação pública<textarea rows={3} maxLength={3000} value={fields.public_description} onChange={event => setFields(current => ({ ...current, public_description: event.target.value }))} /></label><label>Ações acordadas e autorizadas <small>Uma por linha. Não inclua ações ainda não confirmadas.</small><textarea rows={3} value={fields.authorized_actions} onChange={event => setFields(current => ({ ...current, authorized_actions: event.target.value }))} /></label>
          <label>Imagem principal autorizada (HTTPS)<input type="url" value={fields.image_url} onChange={event => setFields(current => ({ ...current, image_url: event.target.value }))} /></label><label>Galeria de imagens autorizadas <small>Um endereço HTTPS por linha (até 12).</small><textarea rows={3} value={fields.gallery_urls} onChange={event => setFields(current => ({ ...current, gallery_urls: event.target.value }))} /></label><label>Link público institucional (HTTPS)<input type="url" value={fields.link_url} onChange={event => setFields(current => ({ ...current, link_url: event.target.value }))} /></label>
          <div className="gym-admin-row"><label>Início<input type="date" value={fields.starts_on || ""} onChange={event => setFields(current => ({ ...current, starts_on: event.target.value }))} /></label><label>Término<input type="date" value={fields.ends_on || ""} onChange={event => setFields(current => ({ ...current, ends_on: event.target.value }))} /></label></div>
          <div className="gym-admin-row"><label>Status interno<select value={fields.status} onChange={event => setFields(current => ({ ...current, status: event.target.value }))}><option value="negotiation">Em negociação</option><option value="awaiting_approval">Aguardando aprovação</option><option value="active">Ativa</option><option value="suspended">Suspensa</option><option value="ended">Encerrada</option></select></label><label>Publicação<select value={fields.publication_status} onChange={event => setFields(current => ({ ...current, publication_status: event.target.value }))}><option value="draft">Rascunho / não publicada</option><option value="published">Publicada</option></select></label></div>
          <fieldset className="gym-admin-consents"><legend>Autorizações registradas</legend>{[["public_authorized", "Divulgação da parceria autorizada"], ["brand_use_authorized", "Uso da marca acordado"], ["image_use_authorized", "Uso das imagens autorizado"]].map(([key,label]) => <label key={key}><input type="checkbox" checked={Boolean(fields[key])} onChange={event => setFields(current => ({ ...current, [key]: event.target.checked }))} /> {label}</label>)}</fieldset>
          <label>Responsável pelo relacionamento<input maxLength={160} value={fields.relationship_owner} onChange={event => setFields(current => ({ ...current, relationship_owner: event.target.value }))} /></label><label>Notas internas<textarea rows={3} maxLength={4000} value={fields.internal_notes} onChange={event => setFields(current => ({ ...current, internal_notes: event.target.value }))} /></label>
          {fields.id && <section className="gym-admin-history"><strong>Histórico de alterações</strong>{data.history.filter(item => item.partnership_id === fields.id).slice(0, 8).map(item => <p key={item.id}>{new Date(item.created_at).toLocaleString("pt-BR")} · {item.action} · {item.old_state?.status || "—"} → {item.new_state?.status || "—"}</p>)}</section>}
          <button type="submit" className="button lime-button" disabled={saving || !partners.length}>{saving ? "Salvando…" : "Salvar parceria"} <Check size={15} /></button>
        </form></div>}
      {tab === "events" && <section className="gym-admin-secondary"><div className="gym-admin-record-list"><h3>Eventos cadastrados</h3>{data.events.map(item => <button type="button" key={item.id} onClick={() => setEventFields({ ...EMPTY_EVENT, ...item, starts_at: item.starts_at ? toLocalDateTimeInput(item.starts_at) : "" })}><strong>{item.title}</strong><span>{EVENT_STATUS[item.status]} · {item.publication_status === "published" ? "Publicado" : "Rascunho"}</span></button>)}</div><form className="gym-admin-form" onSubmit={saveEvent}><h3>{eventFields.id ? "Editar evento" : "Cadastrar evento"}</h3><label>Academia parceira<select required value={eventFields.partnership_id} onChange={event => setEventFields(current => ({ ...current, partnership_id: event.target.value }))}><option value="">Selecione uma parceria</option>{partnershipOptions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Nome do evento<input required maxLength={160} value={eventFields.title} onChange={event => setEventFields(current => ({ ...current, title: event.target.value }))} /></label><label>Imagem autorizada (HTTPS)<input type="url" value={eventFields.image_url} onChange={event => setEventFields(current => ({ ...current, image_url: event.target.value }))} /></label><label>Data e horário<input required type="datetime-local" value={eventFields.starts_at} onChange={event => setEventFields(current => ({ ...current, starts_at: event.target.value }))} /></label><label>Local<input maxLength={300} value={eventFields.venue} onChange={event => setEventFields(current => ({ ...current, venue: event.target.value }))} /></label><label>Descrição<textarea rows={3} maxLength={3000} value={eventFields.description} onChange={event => setEventFields(current => ({ ...current, description: event.target.value }))} /></label><label>Informações de participação<textarea rows={2} maxLength={1600} value={eventFields.participation_info} onChange={event => setEventFields(current => ({ ...current, participation_info: event.target.value }))} /></label><label>Link de inscrição, se configurado (HTTPS)<input type="url" value={eventFields.registration_url} onChange={event => setEventFields(current => ({ ...current, registration_url: event.target.value }))} /></label><div className="gym-admin-row"><label>Status<select value={eventFields.status} onChange={event => setEventFields(current => ({ ...current, status: event.target.value }))}><option value="scheduled">Programado</option><option value="realized">Realizado</option><option value="cancelled">Cancelado</option></select></label><label>Publicação<select value={eventFields.publication_status} onChange={event => setEventFields(current => ({ ...current, publication_status: event.target.value }))}><option value="draft">Rascunho</option><option value="published">Publicado</option></select></label></div><button type="submit" className="button lime-button" disabled={saving || !partnershipOptions.length}>{saving ? "Salvando…" : "Salvar evento"} <Check size={15} /></button></form></section>}
      {tab === "campaigns" && <section className="gym-admin-secondary"><div className="gym-admin-record-list"><h3>Campanhas cadastradas</h3>{data.campaigns.map(item => <button type="button" key={item.id} onClick={() => setCampaignFields({ ...EMPTY_CAMPAIGN, ...item, starts_on: item.starts_on || "", ends_on: item.ends_on || "" })}><strong>{item.title}</strong><span>{item.status === "published" ? "Publicada" : item.status === "ended" ? "Encerrada" : "Rascunho"}</span></button>)}</div><form className="gym-admin-form" onSubmit={saveCampaign}><h3>{campaignFields.id ? "Editar campanha" : "Cadastrar campanha"}</h3><label>Academia parceira<select required value={campaignFields.partnership_id} onChange={event => setCampaignFields(current => ({ ...current, partnership_id: event.target.value }))}><option value="">Selecione uma parceria</option>{partnershipOptions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Nome da ação/campanha<input required maxLength={160} value={campaignFields.title} onChange={event => setCampaignFields(current => ({ ...current, title: event.target.value }))} /></label><label>Imagem autorizada (HTTPS)<input type="url" value={campaignFields.image_url} onChange={event => setCampaignFields(current => ({ ...current, image_url: event.target.value }))} /></label><label>Marca ou empresa responsável<input maxLength={160} value={campaignFields.brand_name} onChange={event => setCampaignFields(current => ({ ...current, brand_name: event.target.value }))} /></label><label>Descrição<textarea rows={3} maxLength={3000} value={campaignFields.description} onChange={event => setCampaignFields(current => ({ ...current, description: event.target.value }))} /></label><div className="gym-admin-row"><label>Início<input type="date" value={campaignFields.starts_on} onChange={event => setCampaignFields(current => ({ ...current, starts_on: event.target.value }))} /></label><label>Término<input type="date" value={campaignFields.ends_on} onChange={event => setCampaignFields(current => ({ ...current, ends_on: event.target.value }))} /></label></div><label>Condições e disponibilidade reais<textarea rows={2} maxLength={1600} value={campaignFields.conditions} onChange={event => setCampaignFields(current => ({ ...current, conditions: event.target.value }))} /></label><label>Status<select value={campaignFields.status} onChange={event => setCampaignFields(current => ({ ...current, status: event.target.value }))}><option value="draft">Rascunho</option><option value="published">Publicada</option><option value="ended">Encerrada</option></select></label><button type="submit" className="button lime-button" disabled={saving || !partnershipOptions.length}>{saving ? "Salvando…" : "Salvar campanha"} <Check size={15} /></button></form></section>}
    </>}
  </section>;
}

export default function GymPartnershipsPage({ client, session, notify, partnershipId = "", admin = false }) {
  const [data, setData] = useState({ partnerships: [], events: [], campaigns: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let mounted = true;
    setLoading(true); setError("");
    loadPublicGymPartnerships(client).then(result => { if (mounted) setData(result); }).catch(failure => { if (mounted) setError(failure.message || "Não foi possível carregar as academias parceiras."); }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [client, retry]);
  const search = query.trim().toLocaleLowerCase("pt-BR");
  const partnerships = useMemo(() => data.partnerships.filter(item => [item.commercial_name,item.city,item.neighborhood,item.partnership_type,...(item.authorized_actions || [])].join(" ").toLocaleLowerCase("pt-BR").includes(search)), [data.partnerships, search]);
  const selected = partnershipId ? data.partnerships.find(item => item.id === partnershipId) : null;
  if (admin) return <PartnershipAdmin client={client} session={session} notify={notify} />;
  return <div className="gym-partnership-page"><PartnershipHero />
    {session?.user?.app_metadata?.role === "admin" && <Link className="gym-admin-shortcut" to="/admin/gym-partnerships"><ShieldCheck size={15} /> Administrar parcerias</Link>}
    {selected ? <AcademyDetail partnership={selected} events={data.events} campaigns={data.campaigns} /> : partnershipId && loading ? <p className="gym-partnership-loading" role="status"><LoaderCircle size={18} className="spin" /> Consultando parceria autorizada…</p> : partnershipId ? <div className="gym-partnership-empty"><CircleAlert size={24} /><h3>Esta parceria não está disponível</h3><p>O estabelecimento não possui uma parceria pública ativa neste momento.</p><Link className="button subtle" to="/partner/gym">Voltar à vitrine</Link></div> : <>
      <section id="academias" className="gym-partnership-section gym-academies-section"><div className="gym-partnership-section-title"><div><span className="eyebrow">REDE FORTALFY</span><h2>Academias parceiras</h2><p>Conheça quem faz parte da nossa rede de parcerias.</p></div><div className="gym-partnership-search"><span className="sr-only">Buscar academias parceiras</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar academia, cidade ou ação…" /></div></div><TrustNote />
        {error && <div className="gym-partnership-load-error" role="alert"><CircleAlert size={18} /><span>Não foi possível carregar a vitrine. Tente novamente.</span><button type="button" className="button subtle small-button" onClick={() => setRetry(value => value + 1)}>Tentar novamente</button></div>}
        {loading && <p className="gym-partnership-loading" role="status"><LoaderCircle size={18} className="spin" /> Consultando parcerias autorizadas…</p>}
        {!loading && !error && partnerships.length > 0 && <div className="gym-partnership-card-grid">{partnerships.map(item => <AcademyCard partnership={item} key={item.id} />)}</div>}
        {!loading && !error && data.partnerships.length === 0 && <EmptySection title="Estamos construindo nossa rede de academias parceiras.">Em breve, você poderá conhecer os estabelecimentos que se unem à Fortalfy para promover experiências, eventos e oportunidades no universo fitness.</EmptySection>}
        {!loading && !error && data.partnerships.length > 0 && partnerships.length === 0 && <div className="gym-partnership-filter-empty"><Building2 size={21} /><p>Nenhuma parceria corresponde a essa busca.</p></div>}
      </section>
      <section id="eventos" className="gym-partnership-section"><div className="gym-partnership-section-title"><div><span className="eyebrow">AGENDA FORTALFY</span><h2>Eventos e experiências</h2><p>Ações e encontros publicados pelas academias parceiras.</p></div></div>{loading ? <p className="gym-partnership-loading"><LoaderCircle size={18} className="spin" /> Consultando agenda…</p> : data.events.length ? <div className="gym-events-grid">{data.events.map(event => <EventCard event={event} key={event.id} />)}</div> : <EmptySection icon={CalendarDays} title="Novas experiências em preparação.">Eventos serão divulgados quando a data, a academia anfitriã e as informações de participação estiverem confirmadas.</EmptySection>}</section>
      <section id="campanhas" className="gym-partnership-section"><div className="gym-partnership-section-title"><div><span className="eyebrow">AÇÕES E MARCAS</span><h2>Campanhas e produtos</h2><p>Divulgação autorizada de roupas, acessórios e produtos esportivos.</p></div></div>{loading ? <p className="gym-partnership-loading"><LoaderCircle size={18} className="spin" /> Consultando campanhas…</p> : data.campaigns.length ? <div className="gym-campaigns-grid">{data.campaigns.map(campaign => <CampaignCard campaign={campaign} key={campaign.id} />)}</div> : <div className="gym-partnership-campaign-empty"><Megaphone size={20} /><p>Campanhas e produtos aparecem aqui quando houver uma ação vigente e autorizada.</p></div>}</section>
      <section className="gym-partnership-join"><div><span className="eyebrow">SEJA PARCEIRO</span><h2>Sua academia também pode fazer parte.</h2><p>Converse com a Fortalfy sobre oportunidades comerciais e institucionais.</p></div><Link className="button lime-button" to="/professional?category=academia">Quero ser parceiro <ArrowRight size={15} /></Link></section>
    </>}
  </div>;
}

export function GymPartnershipDetailPage(props) {
  const { partnershipId = "" } = useParams();
  return <GymPartnershipsPage {...props} partnershipId={partnershipId} />;
}

export function GymPartnershipAdminPage(props) {
  return <GymPartnershipsPage {...props} admin />;
}

