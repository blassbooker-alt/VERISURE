import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight, BriefcaseBusiness, CheckCircle2, CircleAlert, Dumbbell, ExternalLink, LoaderCircle,
  Store, Tags, Utensils, UserRound, Users,
} from "lucide-react";
import {
  createProfessionalDocumentUrl, loadProfessionalApplicationDocuments, loadProfessionalApplications,
  loadProfessionalApplicationsForReview, PROFESSIONAL_CATEGORIES, professionalFieldsFor,
  professionalStatusLabel, removeProfessionalApplicationDocument, reviewProfessionalApplication,
  saveProfessionalApplication, submitProfessionalApplication, uploadProfessionalApplicationDocument,
  validateProfessionalApplication,
} from "./professionalService.js";

const CATEGORY_ICONS = {
  empresa: BriefcaseBusiness,
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
    {field.type === "textarea"
      ? <textarea {...props} rows={field.id === "description" ? 4 : 3} />
      : <input {...props} type={field.type || "text"} />}
  </label>;
}

function ReviewApplication({ client, application, busyId, onReview, note, onNoteChange }) {
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState("");
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
    <label className="professional-form-field">Observação para o solicitante<textarea rows={2} maxLength={2000} value={note} onChange={event => onNoteChange(event.target.value)} /></label>
    <div className="professional-review-actions">
      <button type="button" className="button primary small-button" disabled={busyId === application.id} onClick={() => onReview(application, "approved")}>Aprovar</button>
      <button type="button" className="button subtle small-button" disabled={busyId === application.id} onClick={() => onReview(application, "correction_required")}>Solicitar correção</button>
      <button type="button" className="button subtle small-button" disabled={busyId === application.id} onClick={() => onReview(application, "rejected")}>Reprovar</button>
    </div>
  </article>;
}

function AdminReview({ client, applications, onRefresh, notify }) {
  const [notes, setNotes] = useState({});
  const [busyId, setBusyId] = useState("");
  const pending = applications.filter(application => application.status === "under_review");
  const review = async (application, status) => {
    setBusyId(application.id);
    try {
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
    if (["nutricionista", "personal", "vendedor"].includes(selectedCategory) && !documents.length) {
      setFormError("Anexe ao menos um documento de comprovação antes de enviar o cadastro.");
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
    {admin && <>{reviewError && <div className="professional-error" role="alert">{reviewError}</div>}<AdminReview client={client} applications={reviewApplications} onRefresh={refreshReviewApplications} notify={notify} /></>}
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
              .map(field => <ApplicationField key={field.id} field={field} value={form[field.id]} disabled={["under_review", "suspended"].includes(selectedApplication?.status)} onChange={(id, value) => setForm(current => ({ ...current, [id]: value }))} />)}</div>
            : <div className="professional-review-preview"><h3>Revise antes de enviar</h3><dl>{fields.map(field => <div key={field.id}><dt>{field.label}</dt><dd>{form[field.id] || "Não informado"}</dd></div>)}</dl><p>Os dados identificáveis e credenciais ficam privados para análise. Apenas nome, apresentação, cidade e site poderão ser publicados depois da aprovação.</p></div>}
          {step === 1 && <section className="professional-document-upload">
            <div><strong>Documentos para análise</strong><p>Arquivos privados, acessíveis apenas ao titular e à equipe autorizada. PDF, JPG ou PNG, até 10 MB.</p></div>
            <label>Tipo de documento<select value={documentKind} onChange={event => setDocumentKind(event.target.value)}><option value="professional_credential">Credencial profissional</option><option value="business_identity">Identificação empresarial</option><option value="other">Outro documento</option></select></label>
            <label className="button subtle small-button professional-document-picker">{uploadingDocument ? "Enviando…" : documentsLoading ? "Carregando documentos…" : "Anexar documento"}<input type="file" accept="application/pdf,image/jpeg,image/png" onChange={uploadDocument} disabled={uploadingDocument || documentsLoading || ["under_review", "approved", "suspended"].includes(selectedApplication?.status)} /></label>
            {documentsError && <p className="professional-error" role="alert">{documentsError}</p>}
            {documents.map(document => <div className="professional-document-item" key={document.id}><span>{document.file_name}<small>{document.document_kind} · {Math.ceil(document.size_bytes / 1024)} KB</small></span>{!["under_review", "approved", "suspended", "rejected"].includes(selectedApplication?.status) && <button type="button" disabled={uploadingDocument} onClick={() => removeDocument(document)}>Remover</button>}</div>)}
            {["nutricionista", "personal", "vendedor"].includes(selectedCategory) && documents.length === 0 && <small className="professional-required-document">Este tipo de cadastro exige ao menos um documento antes do envio.</small>}
          </section>}
          {formError && <p className="professional-error" role="alert">{formError}</p>}
          <footer className="professional-form-actions">
            <button type="button" className="button subtle" disabled={saving || step === 0 || selectedApplication?.status === "under_review"} onClick={() => moveStep(-1)}>Voltar</button>
            {step < 2
              ? <button type="button" className="button primary" disabled={saving || uploadingDocument || ["under_review", "suspended"].includes(selectedApplication?.status)} onClick={() => moveStep(1)}>{saving ? "Salvando…" : "Salvar e continuar"} <ArrowRight size={16} /></button>
              : <button type="submit" className="button primary" disabled={saving || documentsLoading || uploadingDocument || ["under_review", "approved", "suspended"].includes(selectedApplication?.status)}>{saving ? "Enviando…" : ["correction_required", "rejected"].includes(selectedApplication?.status) ? "Reenviar para análise" : "Enviar para análise"} <ArrowRight size={16} /></button>}
          </footer>
        </form>
      </section>}
      <p className="professional-portal-safety">Não solicitamos senhas de redes sociais nem dados bancários. CRN/CREF e documentos são revisados pela equipe; nenhum selo é concedido automaticamente.</p>
    </>}
  </main>;
}
