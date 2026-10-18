import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, CircleAlert, Dumbbell, LoaderCircle, RefreshCw, Users } from "lucide-react";
import Brand from "./Brand.jsx";
import { loadProfessionalBookings } from "./professionalService.js";
import { WeeklyPlanManager } from "./WeeklyPlans.jsx";
import { loadProfessionalTrainingPerformance } from "./weeklyPlanService.js";

function AccessState({ title, message, action, to = "/feed", onRetry }) {
  return <main className="professional-login">
    <section className="login-brand"><Link to="/home" aria-label="Fortalfy, página inicial"><Brand light /></Link><div><span className="dash-eyebrow">FORTALFY PROFISSIONAIS</span><h1>{title}</h1><p>{message}</p></div></section>
    <section className="login-form-wrap"><div className="login-form"><Link to="/home" aria-label="Fortalfy, página inicial"><Brand /></Link>
      <span className="verified-label">CONTA PROFISSIONAL</span><h2>Seu espaço de trabalho</h2><p>Agendamentos e dados de clientes só aparecem quando estão vinculados à sua conta.</p>
      {onRetry && <button type="button" className="button subtle wide-button" onClick={onRetry}><RefreshCw size={16} /> Tentar novamente</button>}
      <Link className="button primary wide-button" to={to}>{action || "Entrar ou criar conta"} <ArrowRight size={16} /></Link>
      <Link className="text-button back-app" to="/home">Voltar ao Fortalfy</Link>
    </div></section>
  </main>;
}

function bookingStatus(status) {
  return ({
    solicitada: "Solicitada",
    confirmada: "Confirmada",
    recusada: "Recusada",
    concluida: "Concluída",
    cancelada: "Cancelada",
  })[status] || "Status não informado";
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Data não informada"
    : date.toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" });
}

export default function Dashboard({ role, client, configured, session, profile, profileError = "", onRetryProfile }) {
  const nutrition = role === "nutritionist";
  const expectedKind = nutrition ? "nutricionista" : "personal";
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [trainingRetry, setTrainingRetry] = useState(0);
  const [trainingSessions, setTrainingSessions] = useState([]);
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [trainingError, setTrainingError] = useState("");
  const userId = session?.user?.id;
  const name = profile?.name || session?.user?.user_metadata?.display_name || "";
  const activeBookings = useMemo(() => bookings.filter(item => ["solicitada", "confirmada"].includes(item.status)), [bookings]);
  const linkedClients = useMemo(() => {
    const seen = new Set();
    return bookings.filter(item => ["solicitada", "confirmada", "concluida"].includes(item.status))
      .map(item => item.customer).filter(customer => customer?.id && !seen.has(customer.id) && seen.add(customer.id));
  }, [bookings]);

  useEffect(() => {
    let active = true;
    if (!configured || !client || !userId || profile?.kind !== expectedKind || !profile?.partnerApproved) {
      setBookings([]);
      setLoading(false);
      setError("");
      return () => { active = false; };
    }

    setLoading(true);
    setError("");
    loadProfessionalBookings(client, userId)
      .then(result => { if (active) setBookings(result); })
      .catch(reason => {
        console.error("Falha ao carregar os agendamentos profissionais.", reason);
        if (active) setError(reason.message || "Não foi possível carregar os agendamentos.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client, configured, expectedKind, profile?.kind, profile?.partnerApproved, retry, userId]);

  useEffect(() => {
    let active = true;
    if (nutrition || !client || !userId || !linkedClients.length) {
      setTrainingSessions([]); setTrainingLoading(false); setTrainingError("");
      return () => { active = false; };
    }
    const today = new Date();
    const start = new Date(today); start.setDate(start.getDate() - 90);
    const key = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    setTrainingLoading(true); setTrainingError("");
    loadProfessionalTrainingPerformance(client, userId, linkedClients.map(item => item.id), key(start), key(today))
      .then(data => { if (active) setTrainingSessions(data); })
      .catch(reason => {
        console.error("Falha ao carregar registros de treino dos clientes.", reason);
        if (active) setTrainingError(reason.message || "Não foi possível carregar os registros de treino.");
      })
      .finally(() => { if (active) setTrainingLoading(false); });
    return () => { active = false; };
  }, [client, linkedClients, nutrition, trainingRetry, userId]);

  const refreshTraining = () => setTrainingRetry(value => value + 1);

  if (!configured || !client) {
    return <AccessState title="Painel profissional" message="O painel precisa da conexão existente com o Supabase para consultar dados reais." action="Abrir a comunidade" />;
  }
  if (!userId) {
    return <AccessState title="Acompanhe clientes reais" message="Entre na sua conta Fortalfy para acessar o espaço profissional." />;
  }
  if (profileError) {
    return <AccessState title="Não foi possível validar seu perfil" message={profileError} action="Recarregar perfil" onRetry={onRetryProfile} />;
  }
  if (!profile) {
    return <AccessState title="Carregando seu perfil" message="Aguarde enquanto verificamos as permissões da sua conta." action="Voltar ao início" to="/home" />;
  }
  if (profile.kind !== expectedKind) {
    return <AccessState title="Acesso profissional necessário" message={`Este painel é exclusivo para contas do tipo ${nutrition ? "nutricionista" : "personal trainer"}. Nenhum dado de cliente foi carregado.`} action="Ver meu perfil" to="/profile" />;
  }
  if (!profile.partnerApproved) {
    return <AccessState title="Validação profissional pendente" message="O painel será liberado após a equipe validar seu cadastro profissional." action="Gerenciar cadastro profissional" to="/partner/manage" />;
  }

  return <div className="professional-app">
    <aside className="dash-sidebar">
      <Link to="/home" aria-label="Fortalfy, página inicial"><Brand /></Link>
      <span className="sidebar-caption">ESPAÇO PROFISSIONAL</span>
      <div className="sidebar-profile"><span className="coach-avatar">{name.trim().slice(0, 1).toUpperCase()}</span><div><strong>{name || "Profissional"}</strong><small>{nutrition ? "Nutricionista" : "Personal trainer"}</small></div></div>
      <nav aria-label="Menu profissional"><Link className="dash-nav-item current" to={nutrition ? "/nutritionist" : "/trainer"}><CalendarDays size={18} />Agendamentos</Link><Link className="dash-nav-item" to="/messages"><Users size={18} />Mensagens</Link></nav>
    </aside>
    <main className="dash-main">
      <div className="dash-welcome"><div><span className="dash-eyebrow">{nutrition ? "CONSULTÓRIO DIGITAL" : "ESTÚDIO DIGITAL"}</span><h1>Olá, {name || "profissional"}</h1><p>Visão dos agendamentos vinculados à sua conta Fortalfy.</p></div><Link className="button subtle" to="/partner/manage">Meu cadastro <ArrowRight size={16} /></Link></div>
      <div className="dash-metrics">
        <article className="dash-metric"><div className="dash-metric-icon green"><CalendarDays size={19} /></div><p>Agendamentos</p><strong>{bookings.length}</strong><span>Registros do Supabase</span></article>
        <article className="dash-metric"><div className="dash-metric-icon lime"><Users size={19} /></div><p>Ativos</p><strong>{activeBookings.length}</strong><span>Solicitados ou confirmados</span></article>
      </div>
      <section className="dash-panel">
        <div className="dash-panel-head"><div><h2>Agendamentos</h2><p>Dados reais associados ao seu perfil profissional.</p></div><button className="button subtle small-button" onClick={() => setRetry(value => value + 1)} disabled={loading}><RefreshCw size={15} /> Atualizar</button></div>
        {loading && <p className="social-inline-status" role="status"><LoaderCircle className="story-spinner" size={16} /> Carregando agendamentos…</p>}
        {error && <div className="social-inline-error" role="alert"><CircleAlert size={16} /> {error}<button className="button subtle small-button" onClick={() => setRetry(value => value + 1)}>Tentar novamente</button></div>}
        {!loading && !error && bookings.length === 0 && <div className="dash-empty">Ainda não há agendamentos vinculados a este perfil.</div>}
        {!loading && !error && bookings.length > 0 && <div className="dash-table-wrap"><table className="dash-table"><thead><tr><th>Cliente</th><th>Data</th><th>Modalidade</th><th>Status</th><th>Perfil</th></tr></thead><tbody>{bookings.map(item => <tr key={item.id}><td><div className="dash-person">{item.customer.avatar && <img src={item.customer.avatar} alt="" />}<strong>{item.customer.name}</strong></div></td><td>{formatDate(item.startsAt)}</td><td>{item.modality === "online" ? "Online" : item.modality === "presencial" ? "Presencial" : "Não informada"}</td><td>{bookingStatus(item.status)}</td><td><Link className="text-link" to={`/profile/${item.customer.id}`}>Ver perfil</Link></td></tr>)}</tbody></table></div>}
      </section>
      {!nutrition && <section className="dash-panel training-client-monitor">
        <div className="dash-panel-head"><div><h2><Dumbbell size={18} /> Execução dos treinos</h2><p>Registros feitos pelos clientes vinculados nos últimos 90 dias.</p></div><button className="button subtle small-button" onClick={refreshTraining} disabled={trainingLoading}><RefreshCw size={15} /> Atualizar</button></div>
        {trainingLoading && <p className="social-inline-status" role="status"><LoaderCircle className="spin" size={16} /> Carregando sessões registradas…</p>}
        {trainingError && <div className="social-inline-error" role="alert">{trainingError}<button className="button subtle small-button" onClick={refreshTraining}>Tentar novamente</button></div>}
        {!trainingLoading && !trainingError && !trainingSessions.length && <div className="dash-empty">Ainda não há sessões registradas. A ausência de registro não indica que o cliente deixou de treinar.</div>}
        {!trainingLoading && !trainingError && trainingSessions.length > 0 && <div className="training-client-session-list">{trainingSessions.map(item => {
          const customer = linkedClients.find(person => person.id === item.client_id);
          const finishedSets = item.exercises.flatMap(exercise => exercise.sets).filter(set => set.completed).length;
          return <article key={item.id}><div className="training-client-session-head"><span className="performance-session-status"><Dumbbell size={14} /></span><div><strong>{customer?.name || "Cliente vinculado"}</strong><small>{new Date(`${item.scheduled_date}T12:00:00`).toLocaleDateString("pt-BR", { dateStyle: "medium" })} · {item.status === "completed" ? "Concluído" : item.status === "in_progress" ? "Em andamento" : item.status === "paused" ? "Pausado" : item.status}</small></div><span>{item.duration_minutes ? `${item.duration_minutes} min` : "—"}</span></div>
            <div className="training-client-session-details">{item.exercises.map(exercise => <div key={exercise.id}><strong>{exercise.prescription.name}</strong><span>{exercise.sets.filter(set => set.completed).map(set => `S${set.set_number}: ${set.actual_load ?? "—"} ${set.load_unit}, ${set.actual_reps ?? "—"} reps`).join(" · ") || "Sem séries registradas"}</span></div>)}</div>
            <small className="training-client-session-count">{finishedSets} séries concluídas registradas{item.client_notes ? ` · Observação: ${item.client_notes}` : ""}</small>
          </article>;
        })}</div>}
      </section>}
      {!loading && !error && <section className="dash-panel weekly-professional-panel">
        <WeeklyPlanManager client={client} professionalId={userId} kind={nutrition ? "nutritionist" : "personal"} bookings={bookings} notify={message => window.dispatchEvent(new CustomEvent("fortalfy-toast", { detail: message }))} />
      </section>}
    </main>
  </div>;
}
