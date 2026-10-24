import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import SponsoredCreative from "./SponsoredCreative.jsx";
import {
  ArrowRight, BriefcaseBusiness, CheckCircle2, CircleAlert, Dumbbell, ExternalLink, LoaderCircle,
  Store, Tags, Utensils, UserRound, Users,
} from "lucide-react";
import {
  createProfessionalDocumentUrl, loadProfessionalApplicationDocuments, loadProfessionalApplications,
  loadProfessionalApplicationsForReview, PROFESSIONAL_CATEGORIES, professionalFieldsFor,
  professionalStatusLabel, recordCreatorReviewEvidence, removeProfessionalApplicationDocument, reviewProfessionalApplication,
  saveProfessionalApplication, submitProfessionalApplication, uploadProfessionalApplicationDocument,
  validateProfessionalApplication,
} from "./professionalService.js";
import {
  acceptFreeBusinessRegistration, loadAdminCommercialData, loadPartnerCommercialState,
  reviewCommercialBusiness, reviewCommercialItem, reviewCommercialReport, saveDiscountRule, setDiscountItemEligibility,
  setPartnerDiscountEnrollment,
} from "./commercialService.js";

const CATEGORY_ICONS = {
  empresa: BriefcaseBusiness,
  academia: Dumbbell,
  marca: Tags,
  vendedor: Store,
  restaurante: Utensils,
  nutricionista: UserRound,
  personal: Dumbbell,
  influenciador: Users,
};

function categoryFor(id) {
  return PROFESSIONAL_CATEGORIES.find(category => category.id === id);
}

function ApplicationStatus({ application }) {
  if (!application) return null;
  const note = application.reviewer_note;
  const received = Boolean(application.submitted_at);
  const decided = ["approved", "rejected", "suspended"].includes(application.status);
  const steps = [
    { label: "Cadastro enviado", complete: received },
    { label: application.status === "correction_required" ? "Correção solicitada" : "Em análise", complete: received && !decided },
    { label: "Decisão", complete: decided },
    { label: "Selo liberado", complete: application.status === "approved" },
  ];
  return <div className={`professional-application-status status-${application.status}`} role="status">
    {application.status === "approved" ? <CheckCircle2 size={18} /> : <CircleAlert size={18} />}
    <div>
      <strong>{professionalStatusLabel(application.status)}</strong>
      <p>{application.status === "approved"
        ? "Seu perfil profissional foi aprovado pela equipe. A verificação de credenciais só é exibida quando confirmada pela revisão."
        : application.status === "under_review"
          ? "A equipe analisará as informações. Seu perfil profissional não será publicado antes da aprovação."
          : application.status === "suspended"
            ? "O acesso profissional está suspenso. Entre em contato com o suporte Fortalfy para obter orientações."
            : application.status === "rejected"
                ? "Esta solicitação não foi aprovada. Corrija os dados e documentos e você poderá reenviá-la para análise."
              : application.status === "correction_required"
                ? "Revise os dados solicitados e envie a candidatura novamente."
                : "Salve seu cadastro e envie-o para análise quando estiver pronto."}</p>
      {note && <small>Observação da equipe: {note}</small>}
      {application.submitted_at && <small>Protocolo {application.id} · enviado em {new Date(application.submitted_at).toLocaleString("pt-BR")}{application.sla_due_at ? ` · prazo-alvo ${new Date(application.sla_due_at).toLocaleString("pt-BR")}` : ""}. A meta é 24 horas úteis após o envio completo; feriados e validações externas podem estender a análise.</small>}
      {application.current_revision > 1 && <small>Reenvio · versão {application.current_revision}</small>}
      {received && <ol className="professional-status-timeline">{steps.map((item, index) => <li key={item.label} className={item.complete ? "complete" : ""}><span>{index + 1}</span>{item.label}</li>)}</ol>}
    </div>
  </div>;
}

function ApplicationField({ field, value, onChange, disabled = false }) {
  const props = {
    id: `professional-${field.id}`,
    value: value || "",
    onChange: event => onChange(field.id, event.target.value),
    maxLength: field.maxLength,
    required: Boolean(field.required),
    disabled,
    autoComplete: field.type === "email" ? "email" : field.type === "tel" ? "tel" : "off",
  };
  return <label className="professional-form-field" htmlFor={props.id}>
    {field.label}{field.required && <span aria-hidden="true"> *</span>}
    {field.type === "select"
      ? <select {...props}><option value="">Selecione</option>{field.options.map(option => <option key={option} value={option}>{option}</option>)}</select>
      : field.type === "textarea"
      ? <textarea {...props} rows={field.id === "description" ? 4 : 3} />
      : <input {...props} type={field.type || "text"} />}
  </label>;
}

function ReviewApplication({ client, application, busyId, onReview, note, onNoteChange, approved = false }) {
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState("");
  const [observedFollowers, setObservedFollowers] = useState('{"instagram":0,"tiktok":0,"youtube":0}');
  const [ownershipConfirmed, setOwnershipConfirmed] = useState(false);
  const [validationMethod, setValidationMethod] = useState("manual");
  const [evidenceNote, setEvidenceNote] = useState("");
  const category = categoryFor(application.kind);
  const values = application.private_data || {};
  useEffect(() => {
    let active = true;
    loadProfessionalApplicationDocuments(client, application.id).then(result => {
      if (active) setDocuments(result);
    }).catch(error => {
      if (!active) return;
      console.error("Falha ao carregar documentos privados para revisão.", error);
      setDocumentsError(error.message || "Não foi possível carregar os documentos.");
    });
    return () => { active = false; };
  }, [application.id, client]);

  const openDocument = async document => {
    try {
      const url = await createProfessionalDocumentUrl(client, document.storage_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Falha ao abrir documento profissional.", error);
      setDocumentsError(error.message || "Não foi possível abrir o documento.");
    }
  };

  return <article className="professional-review-card" key={application.id}>
    <div><span className="eyebrow">{category?.label || application.kind}</span><h3>{values.displayName || "Nome não informado"}</h3><p>{values.contactEmail || ""} · {values.city || ""}</p></div>
    <dl>{Object.entries(values).filter(([, value]) => value).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl>
    <div className="professional-review-documents"><strong>Documentos privados</strong>{documentsError && <p className="professional-error" role="alert">{documentsError}</p>}{documents.length === 0 && !documentsError && <small>Nenhum documento anexado.</small>}{documents.map(document => <button type="button" key={document.id} onClick={() => openDocument(document)}><ExternalLink size={14} />{document.file_name} · {document.document_kind}</button>)}</div>
    {application.kind === "influenciador" && <section className="professional-creator-evidence"><strong>Conferência do Creator oficial</strong><p>Informe contagens observadas por rede. A aprovação exige titularidade confirmada e o mínimo configurado no banco (padrão: 100.000 somados).</p><label className="professional-form-field">Contagens observadas (JSON por rede)<textarea rows={2} value={observedFollowers} onChange={event => setObservedFollowers(event.target.value)} /></label><label className="professional-form-field">Método<select value={validationMethod} onChange={event => setValidationMethod(event.target.value)}><option value="manual">Revisão manual</option></select></label><label className="professional-form-field">Registro da evidência<textarea rows={2} maxLength={2000} value={evidenceNote} onChange={event => setEvidenceNote(event.target.value)} placeholder="Links conferidos, data e observações da revisão" /></label><label className="social-auth-consent"><input type="checkbox" checked={ownershipConfirmed} onChange={event => setOwnershipConfirmed(event.target.checked)} /><span>Confirmei que o solicitante controla ou representa os perfis informados.</span></label></section>}
    <label className="professional-form-field">Motivo e resumo da decisão (obrigatório)<textarea rows={2} maxLength={2000} value={note} onChange={event => onNoteChange(event.target.value)} /></label>
    <div className="professional-review-actions">
      {approved
        ? <button type="button" className="button subtle small-button" disabled={busyId === application.id || note.trim().length < 3} onClick={() => onReview(application, "suspended")}>Suspender selo e acesso</button>
        : <><button type="button" className="button primary small-button" disabled={busyId === application.id || note.trim().length < 3 || (application.kind === "influenciador" && (!ownershipConfirmed || !evidenceNote.trim()))} onClick={() => onReview(application, "approved", application.kind === "influenciador" ? { observedFollowers, ownershipConfirmed, validationMethod, evidenceNote } : null)}>Aprovar</button><button type="button" className="button subtle small-button" disabled={busyId === application.id || note.trim().length < 3} onClick={() => onReview(application, "correction_required")}>Solicitar correção</button><button type="button" className="button subtle small-button" disabled={busyId === application.id || note.trim().length < 3} onClick={() => onReview(application, "rejected")}>Reprovar</button></>}
    </div>
  </article>;
}

function AdminReview({ client, applications, onRefresh, notify }) {
  const [notes, setNotes] = useState({});
  const [busyId, setBusyId] = useState("");
  const pending = applications.filter(application => application.status === "under_review");
  const approved = applications.filter(application => application.status === "approved");
  const review = async (application, status, creatorEvidence = null) => {
    setBusyId(application.id);
    try {
      if (status === "approved" && application.kind === "influenciador") {
        let observed;
        try { observed = JSON.parse(creatorEvidence.observedFollowers); }
        catch { throw new Error("Informe as contagens observadas em JSON válido por rede."); }
        await recordCreatorReviewEvidence(client, application.id, { ...creatorEvidence, observedFollowers: observed });
      }
      await reviewProfessionalApplication(client, application.id, status, notes[application.id] || "");
      notify(status === "approved" ? "Cadastro profissional aprovado." : "Revisão atualizada.");
      await onRefresh();
    } catch (error) {
      console.error("Falha ao revisar cadastro profissional.", error);
      notify(error.message || "Não foi possível atualizar a revisão.");
    } finally {
      setBusyId("");
    }
  };
  return <section className="professional-admin-review">
    <div className="professional-portal-heading"><div><span className="eyebrow">ADMINISTRAÇÃO</span><h2>Revisão de cadastros</h2><p>As candidaturas e os dados privados são carregados somente para administradores autorizados.</p></div></div>
    {pending.length === 0 && <p className="professional-empty">Não há cadastros aguardando análise.</p>}
    {pending.map(application => <ReviewApplication
      key={application.id}
      client={client}
      application={application}
      busyId={busyId}
      onReview={review}
      note={notes[application.id] || ""}
      onNoteChange={value => setNotes(current => ({ ...current, [application.id]: value }))}
    />)}
    {approved.length > 0 && <details className="professional-approved-review"><summary>Perfis aprovados ({approved.length})</summary>{approved.map(application => <ReviewApplication
      key={application.id}
      client={client}
      application={application}
      busyId={busyId}
      onReview={review}
      note={notes[application.id] || ""}
      onNoteChange={value => setNotes(current => ({ ...current, [application.id]: value }))}
      approved
    />)}</details>}
  </section>;
}

function CommercialAdmin({ client, notify }) {
  const [data, setData] = useState({ businesses: [], reports: [], commercialContent: [], schedule: [], suspiciousPrices: [], priceHistory: [], businessAudit: [], moderationAudit: [], ruleAudit: [], commercialContentAudit: [] });
  const [edits, setEdits] = useState({});
  const [reportNotes, setReportNotes] = useState({});
  const [contentNotes, setContentNotes] = useState({});
  const [ruleEdits, setRuleEdits] = useState({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const refresh = async () => {
    setError("");
    const result = await loadAdminCommercialData(client);
    setData(result);
    setEdits(Object.fromEntries(result.businesses.map(business => [business.profile_id, {
      status: business.status,
      advertisingEnabled: business.advertising_enabled,
      note: business.reviewer_note || "",
    }])));
    setRuleEdits(Object.fromEntries(result.schedule.map(rule => [`${rule.plan}:${rule.day_from}`, {
      ...rule,
      day_from: String(rule.day_from),
      day_to: String(rule.day_to),
      percent: String(rule.percent),
    }])));
  };

  useEffect(() => {
    let active = true;
    loadAdminCommercialData(client).then(result => {
      if (!active) return;
      setData(result);
      setEdits(Object.fromEntries(result.businesses.map(business => [business.profile_id, {
        status: business.status,
        advertisingEnabled: business.advertising_enabled,
        note: business.reviewer_note || "",
      }])));
      setRuleEdits(Object.fromEntries(result.schedule.map(rule => [`${rule.plan}:${rule.day_from}`, {
        ...rule,
        day_from: String(rule.day_from),
        day_to: String(rule.day_to),
        percent: String(rule.percent),
      }])));
    }).catch(failure => {
      if (active) setError(failure.message || "Não foi possível carregar a administração comercial.");
    });
    return () => { active = false; };
  }, [client]);

  const saveBusiness = async event => {
    event.preventDefault();
    const profileId = event.currentTarget.dataset.profileId;
    const edit = edits[profileId];
    if (!edit) return;
    setBusy(profileId);
    try {
      await reviewCommercialBusiness(client, profileId, edit.status, edit.advertisingEnabled, edit.note);
      await refresh();
      notify("Autorização comercial atualizada e registrada.");
    } catch (failure) {
      setError(failure.message || "Não foi possível atualizar a empresa.");
    } finally {
      setBusy("");
    }
  };

  const decideReport = async (report, status) => {
    setBusy(report.id);
    try {
      await reviewCommercialReport(client, report.id, status, reportNotes[report.id] || "");
      await refresh();
      notify("Decisão de moderação registrada.");
    } catch (failure) {
      setError(failure.message || "Não foi possível atualizar a denúncia.");
    } finally {
      setBusy("");
    }
  };

  const decideCommercialItem = async (item, status) => {
    const key = `${item.target_kind}:${item.target_id}`;
    setBusy(key);
    try {
      await reviewCommercialItem(client, item.target_kind, item.target_id, status, contentNotes[key] || "");
      await refresh();
      notify("Decisão sobre o conteúdo comercial registrada.");
    } catch (failure) {
      setError(failure.message || "Não foi possível moderar este conteúdo.");
    } finally {
      setBusy("");
    }
  };

  const saveRule = async key => {
    setBusy(key);
    try {
      const [plan, previousDayFrom] = key.split(":");
      await saveDiscountRule(client, { ...ruleEdits[key], plan }, Number(previousDayFrom));
      await refresh();
      notify("Regra de desconto atualizada. A alteração foi registrada no histórico.");
    } catch (failure) {
      setError(failure.message || "Não foi possível salvar a regra.");
    } finally {
      setBusy("");
    }
  };

  return <section className="professional-admin-review">
    <div className="professional-portal-heading"><div><span className="eyebrow">PUBLICIDADE E DESCONTOS</span><h2>Governança comercial</h2><p>Cadastro gratuito não libera anúncios automaticamente. Autorizações, denúncias e mudanças de regra ficam registradas no servidor.</p></div></div>
    {error && <p className="professional-error" role="alert">{error}</p>}
    <h3>Empresas e permissão de publicidade</h3>
    {!data.businesses.length && <p className="professional-empty">Nenhum cadastro comercial registrado.</p>}
    {data.businesses.map(business => {
      const edit = edits[business.profile_id] || {
        status: business.status,
        advertisingEnabled: business.advertising_enabled,
        note: business.reviewer_note || "",
      };
      return <form className="professional-review-card" key={business.profile_id} data-profile-id={business.profile_id} onSubmit={saveBusiness}>
        <div><span className="eyebrow">{business.category} · {business.profile_id}</span><h3>{business.display_name || "Nome comercial não informado"}</h3><p>@{business.username || "sem-username"} · Situação: {business.status}{business.advertising_enabled ? " · anúncios autorizados" : ""}</p></div>
        <div className="professional-fields-grid">
          <label className="professional-form-field">Revisão<select value={edit.status} onChange={event => setEdits(current => ({ ...current, [business.profile_id]: { ...edit, status: event.target.value, advertisingEnabled: event.target.value === "approved" && edit.advertisingEnabled } }))}>
            <option value="pending">Pendente</option><option value="approved">Aprovada</option><option value="rejected">Recusada</option><option value="suspended">Suspensa</option>
          </select></label>
          <label className="social-auth-consent"><input type="checkbox" checked={Boolean(edit.advertisingEnabled)} disabled={edit.status !== "approved"} onChange={event => setEdits(current => ({ ...current, [business.profile_id]: { ...edit, advertisingEnabled: event.target.checked } }))} /><span>Permitir publicidade comercial nos módulos habilitados</span></label>
        </div>
        <label className="professional-form-field">Registro da decisão<textarea rows={2} maxLength={2000} value={edit.note || ""} onChange={event => setEdits(current => ({ ...current, [business.profile_id]: { ...edit, note: event.target.value } }))} /></label>
        <button className="button primary small-button" disabled={busy === business.profile_id}>{busy === business.profile_id ? "Salvando…" : "Salvar revisão"}</button>
      </form>;
    })}
    <h3>Fila de revisão de anúncios e ofertas</h3>
    {!data.commercialContent.length && <p className="professional-empty">Nenhum conteúdo comercial aguardando ou em revisão.</p>}
    {data.commercialContent.map(item => {
      const key = `${item.target_kind}:${item.target_id}`;
      return <article className="professional-review-card" key={key}>
        <div><span className="eyebrow">{item.target_kind} · {item.profile_id} · {item.status}</span><h4>{item.display_name || "Empresa"}</h4><pre>{JSON.stringify(item.details, null, 2)}</pre>{item.reviewer_note && <small>Observação: {item.reviewer_note}</small>}</div>
        <label className="professional-form-field">Observação da moderação<textarea rows={2} maxLength={2000} value={contentNotes[key] || ""} onChange={event => setContentNotes(current => ({ ...current, [key]: event.target.value }))} /></label>
        <div className="professional-review-actions">
          {item.status !== "approved" && <button className="button primary small-button" type="button" disabled={busy === key} onClick={() => decideCommercialItem(item, "approved")}>Aprovar publicação</button>}
          {item.status !== "suspended" && <button className="button subtle small-button" type="button" disabled={busy === key} onClick={() => decideCommercialItem(item, "suspended")}>Suspender</button>}
          {item.status !== "rejected" && <button className="button subtle small-button" type="button" disabled={busy === key} onClick={() => decideCommercialItem(item, "rejected")}>Reprovar</button>}
        </div>
      </article>;
    })}
    <h3>Denúncias comerciais</h3>
    {!data.reports.length && <p className="professional-empty">Nenhuma denúncia comercial aberta.</p>}
    {data.reports.map(report => <article className="professional-review-card" key={report.id}>
      <div><span className="eyebrow">{report.target_kind} · {report.target_id} · {report.status}</span><p>{report.reason}</p><small>Denunciado em {new Date(report.created_at).toLocaleString("pt-BR")}</small></div>
      {report.status === "pending" && <>
        <label className="professional-form-field">Decisão<textarea rows={2} maxLength={2000} value={reportNotes[report.id] || ""} onChange={event => setReportNotes(current => ({ ...current, [report.id]: event.target.value }))} /></label>
        <div className="professional-review-actions"><button className="button primary small-button" type="button" disabled={busy === report.id} onClick={() => decideReport(report, "actioned")}>Aplicar medida</button><button className="button subtle small-button" type="button" disabled={busy === report.id} onClick={() => decideReport(report, "dismissed")}>Arquivar denúncia</button></div>
      </>}
      {report.decision_note && <small>Decisão registrada: {report.decision_note}</small>}
    </article>)}
    <h3>Faixas e percentuais globais</h3>
    <p>Fuso da operação: America/Fortaleza. A tabela pode ser editada, mas ainda não é aplicada a compras porque não há assinatura verificada e checkout ativo.</p>
    <div className="professional-fields-grid">{data.schedule.map(rule => {
      const key = `${rule.plan}:${rule.day_from}`;
      const edit = ruleEdits[key] || rule;
      return <form className="professional-review-card" key={key} onSubmit={event => { event.preventDefault(); saveRule(key); }}>
        <strong>Fortal {rule.plan}</strong>
        <div className="partner-product-form-row">
          <label>Dia inicial<input type="number" min="1" max="31" value={edit.day_from} onChange={event => setRuleEdits(current => ({ ...current, [key]: { ...edit, day_from: event.target.value } }))} /></label>
          <label>Dia final<input type="number" min="1" max="31" value={edit.day_to} onChange={event => setRuleEdits(current => ({ ...current, [key]: { ...edit, day_to: event.target.value } }))} /></label>
          <label>Percentual<input type="number" min="0" max={rule.plan === "start" ? "5" : rule.plan === "plus" ? "10" : "20"} step="0.01" value={edit.percent} onChange={event => setRuleEdits(current => ({ ...current, [key]: { ...edit, percent: event.target.value } }))} /></label>
        </div>
        <button className="button subtle small-button" disabled={busy === key}>{busy === key ? "Salvando…" : "Salvar regra"}</button>
      </form>;
    })}</div>
    <h3>Histórico de preços sinalizados</h3>
    {!data.suspiciousPrices.length && <p className="professional-empty">Nenhuma alteração de preço suspeita sinalizada.</p>}
    {data.suspiciousPrices.map(change => <article className="professional-review-card" key={change.id}><strong>{change.target_kind} · {change.target_id}</strong><p>{change.old_price == null ? "Preço inicial" : `${change.old_price} → ${change.new_price}`} · {new Date(change.changed_at).toLocaleString("pt-BR")}</p></article>)}
    <details><summary>Histórico de preços (últimas 200 alterações)</summary>{data.priceHistory.map(change => <p key={`price-${change.id}`}>{change.target_kind} · {change.target_id} · {change.old_price == null ? "cadastro inicial" : `${change.old_price} → ${change.new_price}`}{change.suspicious_increase ? " · sinalizada para revisão" : ""} · {new Date(change.changed_at).toLocaleString("pt-BR")}</p>)}</details>
    <details><summary>Trilha de revisão empresarial</summary>{data.businessAudit.map(entry => <p key={`business-audit-${entry.id}`}>{entry.action} · {entry.profile_id} · {new Date(entry.created_at).toLocaleString("pt-BR")} · {JSON.stringify(entry.new_values)}</p>)}</details>
    <details><summary>Histórico de decisões de moderação</summary>{data.moderationAudit.map(entry => <p key={`moderation-audit-${entry.id}`}>{entry.previous_status} → {entry.new_status} · {new Date(entry.changed_at).toLocaleString("pt-BR")} · {entry.decision_note || "sem observação"}</p>)}</details>
    <details><summary>Histórico de revisões de conteúdo comercial</summary>{data.commercialContentAudit.map(entry => <p key={`content-audit-${entry.id}`}>{entry.target_kind} · {entry.target_id} · {entry.action} · {entry.previous_status || "novo"} → {entry.new_status} · {new Date(entry.changed_at).toLocaleString("pt-BR")} · {entry.reviewer_note || "sem observação"}</p>)}</details>
    <details><summary>Histórico de alterações dos percentuais</summary>{data.ruleAudit.map(entry => <p key={`rule-audit-${entry.id}`}>Fortal {entry.plan}: dias {entry.old_day_from ?? "novo"}–{entry.old_day_to ?? "novo"} ({entry.old_percent ?? "—"}%) → dias {entry.day_from}–{entry.day_to} ({entry.new_percent}%) · {new Date(entry.changed_at).toLocaleString("pt-BR")}</p>)}</details>
  </section>;
}

function PartnerDiscountProgramPanel({ client, userId, category, notify }) {
  const [commercial, setCommercial] = useState({ business: null, enrollment: null, eligibility: [], priceHistory: [], schedule: [] });
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setError("");
    const [commercialState, storesResult, foodResult] = await Promise.all([
      loadPartnerCommercialState(client, userId),
      client.from("partner_store_products").select("id,name,price,is_active").eq("profile_id", userId),
      client.from("food_menu_items").select("id,name,price,available").eq("restaurant_id", userId),
    ]);
    if (storesResult.error) throw storesResult.error;
    if (foodResult.error) throw foodResult.error;
    setCommercial(commercialState);
    setItems([
      ...(storesResult.data || []).map(item => ({ ...item, targetKind: "store_product", active: item.is_active })),
      ...(foodResult.data || []).map(item => ({ ...item, targetKind: "food_menu_item", active: item.available })),
    ]);
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    refresh().catch(failure => {
      if (active) setError(failure.message || "Não foi possível carregar a participação comercial.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client, userId]);

  const enrollmentActive = Boolean(commercial.enrollment?.active
    && commercial.enrollment.terms_version === "fortalfy-partner-discounts-v1");
  const toggleEnrollment = async accepted => {
    setBusy(true);
    try {
      await setPartnerDiscountEnrollment(client, accepted);
      await refresh();
      notify(accepted ? "Adesão voluntária registrada." : "Adesão desativada para ofertas futuras.");
    } catch (failure) {
      setError(failure.message || "Não foi possível atualizar a participação.");
    } finally {
      setBusy(false);
    }
  };
  const toggleItem = async (item, enabled) => {
    setBusy(true);
    try {
      await setDiscountItemEligibility(client, item.targetKind, item.id, enabled);
      await refresh();
      notify(enabled ? "Item marcado como elegível." : "Item removido da participação.");
    } catch (failure) {
      setError(failure.message || "Não foi possível atualizar a elegibilidade.");
    } finally {
      setBusy(false);
    }
  };
  const acceptFreeTerms = async () => {
    setBusy(true);
    try {
      await acceptFreeBusinessRegistration(client, category);
      await refresh();
      notify("Aceite do cadastro gratuito registrado.");
    } catch (failure) {
      setError(failure.message || "Não foi possível registrar o aceite.");
    } finally {
      setBusy(false);
    }
  };

  return <section className="professional-application-editor">
    <header><div><span className="eyebrow">ADESÃO VOLUNTÁRIA</span><h2>Programa de descontos Fortalfy</h2><p>Não há cobrança de cadastro nem obrigação de participar.</p></div></header>
    {loading && <p className="professional-inline-status"><LoaderCircle size={16} className="spin" /> Carregando itens comerciais…</p>}
    {error && <p className="professional-error" role="alert">{error}</p>}
    {!loading && <p><strong>Permissão de publicidade:</strong> {commercial.business?.advertising_enabled ? "autorizada" : "aguardando aprovação administrativa"}</p>}
    {!loading && !commercial.business?.free_registration_accepted_at && <button type="button" className="button subtle small-button" disabled={busy || !client} onClick={acceptFreeTerms}>Aceitar as condições gratuitas do perfil comercial</button>}
    <label className="social-auth-consent">
      <input type="checkbox" checked={enrollmentActive} disabled={loading || busy || !commercial.business?.advertising_enabled || Boolean(error)} onChange={event => toggleEnrollment(event.target.checked)} />
      <span>Aceito voluntariamente os termos { "fortalfy-partner-discounts-v1" }: os descontos serão financiados pelo parceiro, incidem sobre o preço cadastrado na Fortalfy, não são cumulativos por padrão e só se aplicam a itens selecionados. Posso desativar futuras ofertas.</span>
    </label>
    {!enrollmentActive && <p>Cancelamentos/reembolsos de compras confirmadas seguirão os termos legais e comerciais do checkout quando ele existir. Nenhum desconto ou pedido é criado neste momento.</p>}
    {!!commercial.schedule.length && <details><summary>Ver faixas globais de desconto</summary><div className="table-scroll"><table><thead><tr><th>Dias do mês</th><th>Start</th><th>Plus</th><th>Master</th></tr></thead><tbody>{[[1, 10], [11, 20], [21, 25], [26, 31]].map(([from, to]) => <tr key={`${from}-${to}`}><td>{from}–{to}</td>{["start", "plus", "master"].map(plan => <td key={plan}>{commercial.schedule.find(rule => rule.plan === plan && Number(rule.day_from) === from)?.percent ?? "—"}%</td>)}</tr>)}</tbody></table></div></details>}
    {enrollmentActive && <div>{items.length === 0 && <p>Nenhum produto ou item de cardápio elegível foi encontrado nesta conta.</p>}
      <p>{commercial.enrollment?.included_conditions}</p><p>{commercial.enrollment?.cancellation_terms}</p>
      {items.map(item => {
        const eligible = commercial.eligibility.some(entry => entry.target_kind === item.targetKind && entry.target_id === item.id && entry.enabled);
        return <label className="social-auth-consent" key={`${item.targetKind}-${item.id}`}>
          <input type="checkbox" checked={eligible} disabled={busy || !item.active || Boolean(error)} onChange={event => toggleItem(item, event.target.checked)} />
          <span>{item.name} · {item.targetKind === "food_menu_item" ? "FortalFood" : "FortalShop"} · R$ {Number(item.price).toFixed(2)}{!item.active ? " · indisponível" : ""}</span>
        </label>;
      })}
      <p>Este painel guarda a adesão e a seleção. O sistema ainda não possui assinaturas pagas verificáveis nem checkout integrado para aplicar esses descontos a compras.</p>
    </div>}
  </section>;
}

export default function ProfessionalPortal({ client, session, profile, notify }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedCategory = searchParams.get("category") || "";
  const [applications, setApplications] = useState([]);
  const [reviewApplications, setReviewApplications] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState("");
  const [documentKind, setDocumentKind] = useState("professional_credential");
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(requestedCategory);
  const [form, setForm] = useState({});
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(Boolean(session?.user?.id));
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [formError, setFormError] = useState("");
  const [acceptedFreeBusinessTerms, setAcceptedFreeBusinessTerms] = useState(false);
  const [retry, setRetry] = useState(0);
  const userId = session?.user?.id || "";
  const admin = session?.user?.app_metadata?.role === "admin";
  const selectedApplication = applications.find(application => application.kind === selectedCategory);
  const fields = useMemo(() => professionalFieldsFor(selectedCategory), [selectedCategory]);
  const category = categoryFor(selectedCategory);

  useEffect(() => {
    if (!userId || !client) {
      setApplications([]);
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    setLoadError("");
    loadProfessionalApplications(client, userId).then(result => {
      if (!active) return;
      setApplications(result);
      const preferred = requestedCategory && result.some(item => item.kind === requestedCategory)
        ? requestedCategory
        : requestedCategory || result[0]?.kind || "";
      setSelectedCategory(preferred);
      const chosen = result.find(item => item.kind === preferred);
      setForm(chosen?.private_data || {});
    }).catch(error => {
      if (!active) return;
      console.error("Falha ao carregar cadastros profissionais.", error);
      setLoadError(error.message || "Não foi possível carregar seus cadastros profissionais.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client, retry, requestedCategory, userId]);

  useEffect(() => {
    if (!admin || !client) {
      setReviewApplications([]);
      return undefined;
    }
    let active = true;
    loadProfessionalApplicationsForReview(client).then(result => {
      if (active) {
        setReviewApplications(result);
        setReviewError("");
      }
    }).catch(error => {
      if (active) {
        console.error("Falha ao carregar a fila de revisão profissional.", error);
        setReviewError(error.message || "Não foi possível carregar a fila de revisão.");
      }
    });
    return () => { active = false; };
  }, [admin, client, retry]);

  const refreshReviewApplications = async () => {
    const result = await loadProfessionalApplicationsForReview(client);
    setReviewApplications(result);
  };

  useEffect(() => {
    const application = applications.find(item => item.kind === selectedCategory);
    setForm(application?.private_data || {
      displayName: profile?.name || session?.user?.user_metadata?.display_name || "",
      contactEmail: session?.user?.email || "",
      phone: profile?.phone || "",
      city: profile?.city || "",
    });
    setStep(0);
    setFormError("");
  }, [applications, profile?.city, profile?.name, profile?.phone, selectedCategory, session?.user?.email, session?.user?.user_metadata?.display_name]);

  useEffect(() => {
    if (!selectedApplication?.id || !client) {
      setDocuments([]);
      setDocumentsError("");
      setDocumentsLoading(false);
      return undefined;
    }
    let active = true;
    setDocuments([]);
    setDocumentsError("");
    setDocumentsLoading(true);
    loadProfessionalApplicationDocuments(client, selectedApplication.id).then(result => {
      if (active) setDocuments(result);
    }).catch(error => {
      if (!active) return;
      console.error("Falha ao carregar os documentos do cadastro profissional.", error);
      setDocumentsError(error.message || "Não foi possível carregar os documentos anexados.");
    }).finally(() => { if (active) setDocumentsLoading(false); });
    return () => { active = false; };
  }, [client, selectedApplication?.id]);

  const saveDraft = async () => {
    setFormError("");
    setSaving(true);
    try {
      const application = await saveProfessionalApplication(client, userId, selectedCategory, form);
      setApplications(current => [application, ...current.filter(item => item.id !== application.id)]);
      notify("Rascunho profissional salvo com segurança.");
      return application;
    } catch (error) {
      console.error("Falha ao salvar cadastro profissional.", error);
      setFormError(error.message || "Não foi possível salvar o cadastro.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const moveStep = async direction => {
    if (direction < 0) {
      setStep(current => Math.max(0, current - 1));
      return;
    }
    const currentFields = step === 0
      ? fields.filter(field => ["displayName", "contactEmail", "phone", "city"].includes(field.id))
      : fields.filter(field => !["displayName", "contactEmail", "phone", "city"].includes(field.id));
    const errors = validateProfessionalApplication(selectedCategory, form, { allowIncomplete: true });
    const invalidCurrentField = currentFields.find(field => errors[field.id]);
    if (invalidCurrentField) {
      setFormError(errors[invalidCurrentField.id]);
      return;
    }
    if (step < 2) {
      const saved = await saveDraft();
      if (saved) setStep(current => Math.min(2, current + 1));
    }
  };

  const submit = async event => {
    event.preventDefault();
    if (!acceptedFreeBusinessTerms) {
      setFormError("Confirme a veracidade e a titularidade das informações antes de enviar.");
      return;
    }
    if (!documents.length) {
      setFormError("Anexe ao menos um documento de identidade, registro profissional ou comprovação empresarial antes de enviar.");
      setStep(1);
      return;
    }
    const errors = validateProfessionalApplication(selectedCategory, form);
    if (Object.keys(errors).length) {
      setFormError(Object.values(errors)[0]);
      const firstInvalidIndex = fields.findIndex(field => errors[field.id]);
      setStep(firstInvalidIndex < 4 ? 0 : 1);
      return;
    }
    const saved = await saveDraft();
    if (!saved) return;
    setSaving(true);
    try {
      await acceptFreeBusinessRegistration(client, selectedCategory);
      await submitProfessionalApplication(client, saved.id);
      const refreshed = await loadProfessionalApplications(client, userId);
      setApplications(refreshed);
      notify("Cadastro enviado para análise. O perfil não receberá selo até a revisão da equipe.");
    } catch (error) {
      console.error("Falha ao enviar cadastro profissional para análise.", error);
      setFormError(error.message || "Não foi possível enviar o cadastro para análise.");
    } finally {
      setSaving(false);
    }
  };

  const uploadDocument = async event => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setDocumentsError("");
    setUploadingDocument(true);
    try {
      const application = selectedApplication || await saveDraft();
      if (!application) return;
      const document = await uploadProfessionalApplicationDocument(client, application, userId, file, documentKind);
      setDocuments(current => [...current, document]);
      notify("Documento enviado para análise privada.");
    } catch (error) {
      console.error("Falha ao enviar documento do cadastro profissional.", error);
      setDocumentsError(error.message || "Não foi possível enviar o documento.");
    } finally {
      setUploadingDocument(false);
    }
  };

  const removeDocument = async document => {
    setUploadingDocument(true);
    setDocumentsError("");
    try {
      await removeProfessionalApplicationDocument(client, document);
      setDocuments(current => current.filter(item => item.id !== document.id));
      notify("Documento removido.");
    } catch (error) {
      console.error("Falha ao remover documento do cadastro profissional.", error);
      setDocumentsError(error.message || "Não foi possível remover o documento.");
    } finally {
      setUploadingDocument(false);
    }
  };

  const chooseCategory = kind => {
    setSelectedCategory(kind);
    setAcceptedFreeBusinessTerms(false);
    setSearchParams({ category: kind }, { replace: true });
  };

  if (!userId) {
    return <main className="professional-entry-page">
      <header className="professional-entry-header">
        <Link to="/home" className="text-link">← Voltar à Fortalfy</Link>
        <span className="eyebrow">FORTALFY PROFISSIONAIS</span>
        <h1>Sua conta profissional começa aqui.</h1>
        <p>Conecte seu negócio, apresente seu trabalho e cresça dentro do ecossistema Fortalfy.</p>
      </header>
      <SponsoredCreative image="11-professional-b2b.png" alt="Fortalfy para negócios: anuncie sua marca na Fortalfy." label="Oportunidades para negócios" to="/professional" className="professional-b2b-creative" />
      <div className="professional-category-grid">
        {PROFESSIONAL_CATEGORIES.map(item => {
          const Icon = CATEGORY_ICONS[item.id] || BriefcaseBusiness;
          return <article className="professional-category-card" key={item.id}>
            <span className="professional-category-icon"><Icon size={22} /></span>
            <h2>{item.label}</h2><p>{item.description}</p>
            <Link className="button primary small-button" to={`/profile?professionalKind=${item.id}`}>Criar perfil <ArrowRight size={15} /></Link>
          </article>;
        })}
      </div>
      <footer className="professional-entry-footer"><Link to="/profile" className="button subtle">Entrar na minha conta</Link><Link to="/home" className="text-link">Voltar à Fortalfy</Link></footer>
    </main>;
  }

  return <main className="professional-portal">
    <header className="professional-portal-heading">
      <div><span className="eyebrow">FORTALFY PROFISSIONAIS</span><h1>Seu espaço profissional</h1><p>Use sua conta Fortalfy atual; cadastros profissionais não criam uma identidade de login duplicada.</p></div>
      <Link className="button subtle small-button" to="/profile">Meu perfil <ArrowRight size={15} /></Link>
    </header>
    {admin && <>{reviewError && <div className="professional-error" role="alert">{reviewError}</div>}<AdminReview client={client} applications={reviewApplications} onRefresh={refreshReviewApplications} notify={notify} /><CommercialAdmin client={client} notify={notify} /></>}
    {loading && <p className="professional-inline-status"><LoaderCircle size={17} className="spin" /> Carregando seus cadastros…</p>}
    {loadError && <div className="professional-error" role="alert">{loadError}<button type="button" onClick={() => setRetry(value => value + 1)}>Tentar novamente</button></div>}
    {!loading && !loadError && <>
      <section className="professional-applications-list">
        <div><h2>Perfis e solicitações</h2><p>Uma mesma conta pode manter mais de um perfil profissional.</p></div>
        <div className="professional-category-chips">{PROFESSIONAL_CATEGORIES.map(item => <button type="button" key={item.id} className={selectedCategory === item.id ? "active" : ""} onClick={() => chooseCategory(item.id)}>{item.label}{applications.some(app => app.kind === item.id) && <small>{professionalStatusLabel(applications.find(app => app.kind === item.id).status)}</small>}</button>)}</div>
      </section>
      {category && <section className="professional-application-editor">
        <header><div><span className="eyebrow">CADASTRO {category.label.toUpperCase()}</span><h2>{category.label}</h2><p>{category.description}</p></div><span className="professional-step-count">Etapa {step + 1} de 3</span></header>
        <div className="professional-progress"><span style={{ width: `${((step + 1) / 3) * 100}%` }} /></div>
        <ApplicationStatus application={selectedApplication} />
        {selectedApplication?.status === "under_review" && <p className="professional-readonly-note">Este cadastro está em análise e não pode ser editado agora.</p>}
        <form onSubmit={submit}>
          {step < 2
            ? <div className="professional-fields-grid">{fields
              .filter(field => step === 0
                ? ["displayName", "contactEmail", "phone", "city"].includes(field.id)
                : !["displayName", "contactEmail", "phone", "city"].includes(field.id))
              .map(field => <ApplicationField key={field.id} field={field} value={form[field.id]} disabled={["under_review", "approved", "suspended"].includes(selectedApplication?.status)} onChange={(id, value) => setForm(current => ({ ...current, [id]: value }))} />)}</div>
            : <div className="professional-review-preview"><h3>Revise antes de enviar</h3><dl>{fields.map(field => <div key={field.id}><dt>{field.label}</dt><dd>{form[field.id] || "Não informado"}</dd></div>)}</dl><p>Os dados identificáveis e credenciais ficam privados para análise. Apenas nome, apresentação, cidade e site poderão ser publicados depois da aprovação.</p></div>}
          {step === 1 && <section className="professional-document-upload">
            <div><strong>Documentos para análise</strong><p>Arquivos privados, acessíveis apenas ao titular e à equipe autorizada. PDF, JPG ou PNG, até 10 MB.</p></div>
            <label>Tipo de documento<select value={documentKind} onChange={event => setDocumentKind(event.target.value)}><option value="professional_credential">Credencial profissional</option><option value="business_identity">Identificação empresarial</option><option value="other">Outro documento</option></select></label>
            <label className="button subtle small-button professional-document-picker">{uploadingDocument ? "Enviando…" : documentsLoading ? "Carregando documentos…" : "Anexar documento"}<input type="file" accept="application/pdf,image/jpeg,image/png" onChange={uploadDocument} disabled={uploadingDocument || documentsLoading || ["under_review", "approved", "suspended"].includes(selectedApplication?.status)} /></label>
            {documentsError && <p className="professional-error" role="alert">{documentsError}</p>}
            {documents.map(document => <div className="professional-document-item" key={document.id}><span>{document.file_name}<small>{document.document_kind} · {Math.ceil(document.size_bytes / 1024)} KB</small></span>{!["under_review", "approved", "suspended", "rejected"].includes(selectedApplication?.status) && <button type="button" disabled={uploadingDocument} onClick={() => removeDocument(document)}>Remover</button>}</div>)}
            {documents.length === 0 && <small className="professional-required-document">O envio exige ao menos um documento de identidade, registro ou comprovação da atividade.</small>}
          </section>}
          {step === 2 && <label className="social-auth-consent">
            <input type="checkbox" checked={acceptedFreeBusinessTerms} onChange={event => setAcceptedFreeBusinessTerms(event.target.checked)} required />
            <span>Declaro que os dados são verdadeiros, atuais e meus ou da empresa que represento. Li as políticas aplicáveis e entendo que o envio inicia uma análise, sem garantir aprovação. CPF, documentos e endereço residencial ficam privados; o selo só aparece após aprovação.</span>
          </label>}
          {formError && <p className="professional-error" role="alert">{formError}</p>}
          <footer className="professional-form-actions">
            <button type="button" className="button subtle" disabled={saving || step === 0 || ["under_review", "approved", "suspended"].includes(selectedApplication?.status)} onClick={() => moveStep(-1)}>Voltar</button>
            {step < 2
              ? <button type="button" className="button primary" disabled={saving || uploadingDocument || ["under_review", "approved", "suspended"].includes(selectedApplication?.status)} onClick={() => moveStep(1)}>{saving ? "Salvando…" : "Salvar e continuar"} <ArrowRight size={16} /></button>
              : <button type="submit" className="button primary" disabled={saving || documentsLoading || uploadingDocument || ["under_review", "approved", "suspended"].includes(selectedApplication?.status)}>{saving ? "Enviando…" : ["correction_required", "rejected"].includes(selectedApplication?.status) ? "Reenviar para análise" : "Enviar para análise"} <ArrowRight size={16} /></button>}
          </footer>
        </form>
      </section>}
      {applications.length > 0 && <PartnerDiscountProgramPanel key={userId} client={client} userId={userId} category={selectedCategory || applications[0]?.kind} notify={notify} />}
      <p className="professional-portal-safety">Não solicitamos senhas de redes sociais nem dados bancários. CRN/CREF e documentos são revisados pela equipe; nenhum selo é concedido automaticamente.</p>
    </>}
  </main>;
}
