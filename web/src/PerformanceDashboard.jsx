import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowRight, CalendarDays, CheckCircle2, Clock3, Dumbbell, LoaderCircle, TrendingUp } from "lucide-react";
import { getMonday, loadTrainingPerformance, loadWeeklyPlans } from "./weeklyPlanService.js";

const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const addDays = (date, amount) => { const next = new Date(date); next.setDate(next.getDate() + amount); return next; };
const monthStart = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
const labelDate = value => new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

function Metric({ icon: Icon, label, value, hint }) {
  return <article className="performance-metric"><span className="performance-metric-icon"><Icon size={17} /></span><span className="performance-metric-label">{label}</span><strong>{value}</strong><small>{hint}</small></article>;
}

export default function PerformanceDashboard({ client, session }) {
  const userId = session?.user?.id;
  const today = new Date();
  const todayKey = dateKey(today);
  const weekStart = getMonday(today);
  const historyStartDate = new Date(today.getFullYear(), today.getMonth() - 11, 1);
  const historyStart = dateKey(historyStartDate);
  const [sessions, setSessions] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!userId || userId.startsWith("demo-") || userId.startsWith("local-") || !client) {
      setSessions([]);
      setPlans([]);
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    setError("");
    Promise.all([
      loadTrainingPerformance(client, userId, historyStart, todayKey),
      loadWeeklyPlans(client, userId, "personal"),
    ]).then(([training, trainingPlans]) => {
      if (!active) return;
      setSessions(training);
      setPlans(trainingPlans);
    }).catch(reason => {
      console.error("Falha ao carregar o desempenho de treinos.", reason);
      if (active) setError(reason.message || "Não foi possível carregar seu desempenho.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client, userId, todayKey, historyStart]);

  const currentPlan = plans.find(plan => plan.week_start === weekStart);
  const plannedCount = currentPlan?.days?.filter(day => !day.is_rest_day && day.exercises?.length).length || 0;
  const thisWeek = sessions.filter(item => item.scheduled_date >= weekStart && item.scheduled_date <= todayKey);
  const completedWeek = thisWeek.filter(item => item.status === "completed");
  const completedMonth = sessions.filter(item => item.status === "completed" && item.scheduled_date >= monthStart(today));
  const durationMinutes = completedWeek.reduce((sum, item) => sum + (item.duration_minutes || 0), 0);
  const weeklyPercent = plannedCount ? Math.min(100, Math.round(completedWeek.filter(item => item.plan_id === currentPlan.id && item.plan_version === currentPlan.version).length / plannedCount * 100)) : null;

  const weekBars = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const day = addDays(new Date(`${weekStart}T12:00:00`), index);
    const key = dateKey(day);
    const count = sessions.filter(item => item.scheduled_date === key && item.status === "completed").length;
    return { key, label: day.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""), count, today: key === todayKey };
  }), [sessions, weekStart, todayKey]);

  const monthBars = useMemo(() => Array.from({ length: 5 }, (_, index) => {
    const start = addDays(new Date(`${monthStart(today)}T12:00:00`), index * 7);
    const end = addDays(start, 6);
    const count = sessions.filter(item => item.status === "completed" && item.scheduled_date >= dateKey(start) && item.scheduled_date <= dateKey(end)).length;
    return { label: `Sem. ${index + 1}`, count };
  }).filter((_, index) => index === 0 || addDays(new Date(`${monthStart(today)}T12:00:00`), index * 7).getMonth() === today.getMonth()), [sessions, todayKey]);

  const loadHistory = useMemo(() => {
    const byExercise = new Map();
    sessions.filter(item => item.status === "completed").forEach(item => item.exercises.forEach(exercise => {
      exercise.sets.filter(set => set.completed && set.actual_load !== null).forEach(set => {
        const name = exercise.prescription?.name || "Exercício";
        const values = byExercise.get(name) || [];
        values.push({ date: item.scheduled_date, load: Number(set.actual_load), unit: set.load_unit });
        byExercise.set(name, values);
      });
    }));
    return [...byExercise.entries()].map(([name, values]) => {
      values.sort((a, b) => a.date.localeCompare(b.date));
      return { name, first: values[0], latest: values.at(-1), count: values.length };
    }).slice(0, 6);
  }, [sessions]);

  const maxWeek = Math.max(1, ...weekBars.map(item => item.count));
  const maxMonth = Math.max(1, ...monthBars.map(item => item.count));
  return <div className="performance-dashboard">
    <section className="performance-hero"><div><span className="eyebrow">DADOS DAS SUAS SESSÕES</span><h2>A evolução começa com consistência.</h2><p>Veja seus treinos concluídos e o que foi registrado ao longo do tempo.</p></div><Link className="button lime-button" to="/workout">Abrir meus treinos <ArrowRight size={16} /></Link></section>
    {!userId && <section className="weekly-empty"><span className="weekly-empty-icon"><Activity size={22} /></span><h2>Entre para acompanhar seu desempenho</h2><p>Histórico de sessões e cargas fica associado à sua conta.</p><Link className="button primary" to="/profile">Entrar na conta <ArrowRight size={16} /></Link></section>}
    {loading && <p className="social-inline-status" role="status"><LoaderCircle className="spin" size={17} /> Carregando seus registros de treino…</p>}
    {error && <p className="social-inline-error" role="alert">{error}</p>}
    {userId && !loading && !error && <>
      <section className="performance-metrics" aria-label="Resumo semanal">
        <Metric icon={CheckCircle2} label="Concluídos na semana" value={completedWeek.length} hint={`${completedMonth.length} no mês`} />
        <Metric icon={CalendarDays} label="Planejamento cumprido" value={weeklyPercent === null ? "—" : `${weeklyPercent}%`} hint={plannedCount ? `${completedWeek.filter(item => item.plan_id === currentPlan.id && item.plan_version === currentPlan.version).length} de ${plannedCount} sessões prescritas` : "Sem plano publicado nesta semana"} />
        <Metric icon={Clock3} label="Tempo registrado" value={`${durationMinutes} min`} hint="Sessões concluídas nesta semana" />
      </section>
      <section className="performance-chart-grid">
        <article className="performance-chart-card"><div className="performance-chart-heading"><div><span className="eyebrow">FREQUÊNCIA</span><h3>Esta semana</h3></div><span className="chart-period">{labelDate(weekStart)} – {labelDate(todayKey)}</span></div>
          <div className="performance-bars" role="img" aria-label="Treinos concluídos por dia nesta semana">{weekBars.map(item => <div className="performance-bar-column" key={item.key}><span className="performance-bar-value">{item.count || ""}</span><span className={`performance-bar ${item.today ? "today" : ""}`} style={{ "--bar-height": `${Math.max(7, item.count / maxWeek * 100)}%` }} /><small>{item.label}</small></div>)}</div>
        </article>
        <article className="performance-chart-card"><div className="performance-chart-heading"><div><span className="eyebrow">TENDÊNCIA</span><h3>Este mês</h3></div><span className="chart-period">{completedMonth.length} concluídos</span></div>
          <div className="performance-month-bars" role="img" aria-label="Treinos concluídos por semana neste mês">{monthBars.map(item => <div className="performance-month-column" key={item.label}><span>{item.count || "0"}</span><i style={{ "--bar-height": `${Math.max(7, item.count / maxMonth * 100)}%` }} /><small>{item.label}</small></div>)}</div>
        </article>
      </section>
      <section className="performance-chart-card performance-load-card"><div className="performance-chart-heading"><div><span className="eyebrow">CARGAS REGISTRADAS</span><h3>Evolução por exercício</h3></div><TrendingUp size={18} /></div>
        {loadHistory.length ? <div className="performance-load-list">{loadHistory.map(item => <article key={item.name}><span className="performance-load-icon"><Dumbbell size={16} /></span><div><strong>{item.name}</strong><small>{item.count} séries com carga registrada</small></div><span className="performance-load-values"><small>{item.first.load} {item.first.unit}</small><b>{item.latest.load} {item.latest.unit}</b></span></article>)}</div> : <p className="performance-note">As cargas aparecem aqui quando você as registra durante uma sessão concluída.</p>}
      </section>
      <section className="performance-chart-card"><div className="performance-chart-heading"><div><span className="eyebrow">HISTÓRICO</span><h3>Sessões recentes</h3></div><Link className="text-link" to="/workout">Agenda <ArrowRight size={14} /></Link></div>
        {sessions.length ? <div className="performance-session-list">{sessions.slice(0, 8).map(item => <article key={item.id}><span className={`performance-session-status ${item.status}`}><Dumbbell size={15} /></span><div><strong>{item.exercises.map(exercise => exercise.prescription?.name).filter(Boolean).slice(0, 2).join(", ") || "Sessão de treino"}</strong><small>{labelDate(item.scheduled_date)} · {item.status === "completed" ? "Concluído" : item.status === "in_progress" ? "Em andamento" : item.status === "paused" ? "Pausado" : item.status}</small></div><span>{item.duration_minutes ? `${item.duration_minutes} min` : "—"}</span></article>)}</div> : <div className="weekly-empty performance-inline-empty"><span className="weekly-empty-icon"><Dumbbell size={22} /></span><h3>Sua evolução começa no primeiro treino</h3><p>Quando concluir uma sessão e salvar seus registros, eles aparecerão aqui.</p><Link className="button subtle" to="/workout">Consultar agenda <ArrowRight size={15} /></Link></div>}
      </section>
      <p className="performance-note">A frequência mostra apenas sessões registradas no app. A falta de registro não significa que você deixou de treinar. Peso e medidas só serão exibidos quando houver registros voluntários válidos.</p>
    </>}
  </div>;
}
