import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Apple, ArrowDown, ArrowRight, ArrowUp, CalendarDays, Check, CheckCircle2, CircleAlert, Copy, Dumbbell, LoaderCircle, Pause, Play, Plus, RefreshCw, Timer, Utensils } from "lucide-react";
import {
  confirmWeeklyPlan, createNutritionDays, createTrainingDays, dateAtOffset, formatWeekTitle, getMonday,
  loadPlansForClient, loadTrainingSessionForDay, loadWeeklyPlans, MEALS, publishWeeklyTrainingPlan,
  saveTrainingSet, saveWeeklyPlan, setTrainingDayCompleted, startTrainingSession, updateTrainingSession,
  validateNutritionPlan, validateTrainingPlan, WEEKDAYS,
} from "./weeklyPlanService.js";

const inputError = error => error?.message || "Nao foi possivel carregar os planos.";
const formatDate = date => new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
const formatMacros = meal => [
  meal.protein_g ? `${meal.protein_g} g proteina` : "",
  meal.carbohydrates_g ? `${meal.carbohydrates_g} g carboidratos` : "",
  meal.fat_g ? `${meal.fat_g} g gordura` : "",
].filter(Boolean).join(" · ");

function PlanNotice({ error, loading, retry }) {
  if (loading) return <p className="social-inline-status" role="status"><LoaderCircle className="spin" size={17} /> Carregando planos da sua conta…</p>;
  if (!error) return null;
  return <div className="social-inline-error" role="alert"><CircleAlert size={17} />{error}{retry && <button className="button subtle small-button" onClick={retry}>Tentar novamente</button>}</div>;
}

function PlanHistory({ plans, selectedId, onSelect }) {
  if (plans.length < 2) return null;
  return <label className="weekly-history-select">Plano e historico
    <select value={selectedId} onChange={event => onSelect(event.target.value)}>
      {plans.map(plan => <option key={plan.id} value={plan.id}>{plan.title} · {plan.confirmed_at ? "Confirmado" : "Pendente"}</option>)}
    </select>
  </label>;
}

function TrainingPlanCard({ plan, client, userId, onChanged, notify }) {
  const completed = new Set(plan.completedDays || []);
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try {
      await confirmWeeklyPlan(client, plan.id, "personal");
      await onChanged();
      notify("Plano de treino confirmado. Seu personal ja pode ver a confirmacao.");
    } catch (error) {
      console.error("Falha ao confirmar o plano semanal de treino.", error);
      notify(inputError(error));
    } finally {
      setBusy(false);
    }
  };
  const markDayComplete = async index => {
    setBusy(true);
    try {
      await setTrainingDayCompleted(client, userId, plan.id, index, true);
      await onChanged();
    } catch (error) {
      console.error("Falha ao atualizar o progresso semanal do treino.", error);
      notify(inputError(error));
    } finally {
      setBusy(false);
    }
  };
  const plannedDays = plan.days.filter(day => !day.is_rest_day && day.exercises?.length).length;
  const completedCount = plan.days.reduce((count, day, index) => count + (!day.is_rest_day && completed.has(index) ? 1 : 0), 0);
  return <article className="weekly-plan-card">
    <div className="weekly-plan-title"><div><span className="eyebrow">PLANO DO PERSONAL</span><h2>{plan.title}</h2><p>Profissional: {plan.professional?.display_name || "Personal vinculado a sua conta"}</p></div><span className={`weekly-status ${plan.confirmed_at ? "confirmed" : "pending"}`}>{plan.confirmed_at ? <><CheckCircle2 size={15} /> Confirmado</> : "Pendente de confirmacao"}</span></div>
    {!plan.confirmed_at && <button className="button primary wide-button" type="button" onClick={confirm} disabled={busy}><Check size={17} /> {busy ? "Confirmando…" : "Confirmar Plano da Semana"}</button>}
    {plan.goal && <p className="weekly-goal-callout">Objetivo: {plan.goal}</p>}
    {plan.warmup && <p className="weekly-coach-note">Preparação: {plan.warmup}</p>}
    <div className="weekly-progress"><div><strong>Progresso da semana</strong><span>{completedCount} de {plannedDays} sessões concluídas</span></div><div className="weekly-progress-track"><span style={{ width: `${plannedDays ? completedCount / plannedDays * 100 : 0}%` }} /></div></div>
    <div className="weekly-day-list">{plan.days.map((day, index) => <details className="weekly-day" key={`${plan.id}-${index}`} open={index === 0}>
      <summary><span className={`weekly-day-check ${completed.has(index) ? "done" : ""}`}>{completed.has(index) && <Check size={14} />}</span><span><strong>{WEEKDAYS[index]}</strong><small>{day.workout_name}</small></span><span className="weekly-day-count">{day.exercises.length} exercicios</span></summary>
      <div className="weekly-day-content">
        {day.notes && <p className="weekly-coach-note">{day.notes}</p>}
        {day.is_rest_day ? <p className="weekly-rest-day"><CheckCircle2 size={16} /> Dia de descanso programado pelo personal.</p> : day.exercises.map((exercise, exerciseIndex) => <article className="weekly-exercise" key={`${exercise.name}-${exerciseIndex}`}>
          <h4>{exercise.name}</h4>{exercise.muscle_group && <span className="weekly-exercise-muscle">{exercise.muscle_group}</span>}
          {exercise.description && <p>{exercise.description}</p>}
          {exercise.equipment && <p className="weekly-exercise-equipment">Equipamento: {exercise.equipment}</p>}
          <div className="weekly-exercise-specs">{exercise.sets && <span>{exercise.sets} séries</span>}{exercise.reps && <span>{exercise.reps} repetições</span>}{exercise.load && <span>Carga recomendada: {exercise.load} {exercise.load_unit || "kg"}</span>}{exercise.rest && <span>Descanso: {exercise.rest}</span>}{exercise.tempo && <span>Ritmo: {exercise.tempo}</span>}{exercise.duration && <span>Duração: {exercise.duration}</span>}{exercise.distance && <span>Distância: {exercise.distance}</span>}</div>
          {exercise.notes && <p className="weekly-coach-note">{exercise.notes}</p>}
          {exercise.video_url && (/\.mp4(?:$|\?)/i.test(exercise.video_url) ? <video className="weekly-exercise-video" controls preload="metadata" src={exercise.video_url}>Este navegador não reproduz o vídeo. Consulte as instruções acima.</video> : <a className="text-link weekly-video-link" href={exercise.video_url} target="_blank" rel="noreferrer">Ver demonstração do exercício <ArrowRight size={14} /></a>)}
        </article>)}
        {!day.is_rest_day && plan.confirmed_at && <TrainingSessionControls plan={plan} day={day} dayIndex={index} client={client} userId={userId} notify={notify} onCompleted={() => markDayComplete(index)} />}
      </div>
    </details>)}</div>
    {plan.confirmed_at && <p className="weekly-confirmed-note">Confirmado em {new Date(plan.confirmed_at).toLocaleString("pt-BR")}.</p>}
  </article>;
}

function localDate(value) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function plannedSetCount(exercise) {
  const match = String(exercise.sets || "").match(/\d+/);
  return Math.min(20, Math.max(1, Number(match?.[0] || 1)));
}

function TrainingExerciseLogger({ client, exercise, disabled }) {
  const count = plannedSetCount(exercise.prescription);
  const existing = exercise.sets || [];
  const [rows, setRows] = useState(() => Array.from({ length: count }, (_, index) => {
    const entry = existing.find(item => item.set_number === index + 1);
    return entry ? { ...entry, actual_load: entry.actual_load == null ? "" : String(entry.actual_load), actual_reps: entry.actual_reps == null ? "" : String(entry.actual_reps) }
      : { set_number: index + 1, actual_load: "", actual_reps: "", actual_duration_minutes: "", actual_distance: "", distance_unit: "km", load_unit: exercise.prescription.load_unit || "kg", rpe: "", notes: "", completed: false };
  }));
  const [savingSet, setSavingSet] = useState(null);
  const [error, setError] = useState("");
  const update = (index, field, value) => setRows(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  const save = async index => {
    setSavingSet(index); setError("");
    try {
      const saved = await saveTrainingSet(client, exercise.id, { ...rows[index], completed: true });
      setRows(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...saved, actual_load: saved.actual_load == null ? "" : String(saved.actual_load), actual_reps: saved.actual_reps == null ? "" : String(saved.actual_reps), actual_duration_minutes: saved.actual_duration_minutes == null ? "" : String(saved.actual_duration_minutes), actual_distance: saved.actual_distance == null ? "" : String(saved.actual_distance) } : row));
    } catch (failure) {
      console.error("Falha ao registrar a série do exercício.", failure);
      setError(failure.message || "Não foi possível salvar esta série.");
    } finally { setSavingSet(null); }
  };
  return <section className="training-execution-exercise">
    <div className="training-execution-title"><div><strong>{exercise.prescription.name}</strong><small>{exercise.prescription.sets || "Conforme duração/distância"}{exercise.prescription.reps ? ` · ${exercise.prescription.reps} repetições` : ""}</small></div>{exercise.prescription.load && <span>Carga recomendada: {exercise.prescription.load} {exercise.prescription.load_unit || "kg"}</span>}</div>
    {rows.map((row, index) => <div className="training-set-row" key={row.set_number}>
      <span className={`training-set-number ${row.completed ? "done" : ""}`}>{row.completed ? <Check size={14} /> : `S${row.set_number}`}</span>
      {exercise.prescription.load?.trim?.() && <label>Carga real<input type="number" min="0" step="0.1" value={row.actual_load} onChange={event => update(index, "actual_load", event.target.value)} disabled={disabled || row.completed} placeholder="0" /></label>}
      {exercise.prescription.load?.trim?.() && <label>Unidade<select value={row.load_unit} onChange={event => update(index, "load_unit", event.target.value)} disabled={disabled || row.completed}><option value="kg">kg</option><option value="lb">lb</option><option value="bodyweight">Peso corporal</option><option value="none">Sem carga</option></select></label>}
      {exercise.prescription.reps && <label>Repetições<input type="number" min="0" max="10000" step="1" value={row.actual_reps} onChange={event => update(index, "actual_reps", event.target.value)} disabled={disabled || row.completed} placeholder="0" /></label>}
      {exercise.prescription.duration && <label>Duração real (min)<input type="number" min="0" max="1440" step="1" value={row.actual_duration_minutes} onChange={event => update(index, "actual_duration_minutes", event.target.value)} disabled={disabled || row.completed} placeholder="0" /></label>}
      {exercise.prescription.distance && <label>Distância real<input type="number" min="0" step="0.01" value={row.actual_distance} onChange={event => update(index, "actual_distance", event.target.value)} disabled={disabled || row.completed} placeholder="0" /></label>}
      {exercise.prescription.distance && <label>Unidade<select value={row.distance_unit} onChange={event => update(index, "distance_unit", event.target.value)} disabled={disabled || row.completed}><option value="km">km</option><option value="m">m</option><option value="mi">mi</option></select></label>}
      <label>Esforço (1–10)<input type="number" min="1" max="10" step="0.5" value={row.rpe || ""} onChange={event => update(index, "rpe", event.target.value)} disabled={disabled || row.completed} placeholder="Opcional" /></label>
      <label className="training-set-notes">Observações<input value={row.notes || ""} maxLength={1000} onChange={event => update(index, "notes", event.target.value)} disabled={disabled || row.completed} placeholder="Opcional" /></label>
      <button type="button" className={`button ${row.completed ? "subtle" : "primary"} small-button`} onClick={() => save(index)} disabled={disabled || Boolean(savingSet) || row.completed}>{savingSet === index ? "Salvando…" : row.completed ? "Registrada" : "Concluir série"}</button>
    </div>)}
    {error && <p className="social-inline-error" role="alert">{error}</p>}
  </section>;
}

function TrainingSessionControls({ plan, day, dayIndex, client, userId, notify, onCompleted }) {
  const scheduledDate = localDate(dateAtOffset(plan.week_start, dayIndex));
  const [trainingSession, setTrainingSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [restTarget, setRestTarget] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [sessionNotes, setSessionNotes] = useState("");
  const restStorageKey = trainingSession?.id ? `fortalfy.training.restUntil.${trainingSession.id}` : "";
  const reload = async () => {
    setLoading(true); setError("");
    try { setTrainingSession(await loadTrainingSessionForDay(client, userId, plan.id, dayIndex, scheduledDate)); }
    catch (failure) { console.error("Falha ao carregar a sessão de treino.", failure); setError(failure.message || "Não foi possível consultar esta sessão."); }
    finally { setLoading(false); }
  };
  useEffect(() => { let active = true; loadTrainingSessionForDay(client, userId, plan.id, dayIndex, scheduledDate).then(value => { if (active) setTrainingSession(value); }).catch(failure => { if (active) setError(failure.message || "Não foi possível consultar esta sessão."); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [client, userId, plan.id, dayIndex, scheduledDate]);
  useEffect(() => { setSessionNotes(trainingSession?.client_notes || ""); }, [trainingSession?.id]);
  useEffect(() => {
    if (!restStorageKey) return;
    try { const saved = Number(window.localStorage.getItem(restStorageKey)); if (saved > Date.now()) setRestTarget(saved); }
    catch (failure) { console.error("Não foi possível restaurar o cronômetro de descanso.", failure); }
  }, [restStorageKey]);
  useEffect(() => { if (!['in_progress', 'paused'].includes(trainingSession?.status)) return undefined; const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, [trainingSession?.status]);
  useEffect(() => { if (!restTarget) return undefined; const timer = window.setInterval(() => { const current = Date.now(); setNow(current); if (current >= restTarget) setRestTarget(0); }, 250); return () => window.clearInterval(timer); }, [restTarget]);
  useEffect(() => {
    if (!restStorageKey) return;
    try { if (restTarget) window.localStorage.setItem(restStorageKey, String(restTarget)); else window.localStorage.removeItem(restStorageKey); }
    catch (failure) { console.error("Não foi possível salvar o cronômetro de descanso.", failure); }
  }, [restStorageKey, restTarget]);
  const start = async () => {
    setBusy(true); setError("");
    try { await startTrainingSession(client, plan.id, dayIndex, scheduledDate); await reload(); notify("Treino iniciado. Registre cada série realizada."); }
    catch (failure) { console.error("Falha ao iniciar o treino.", failure); setError(failure.message || "Não foi possível iniciar o treino."); }
    finally { setBusy(false); }
  };
  const changeStatus = async status => {
    if (!trainingSession) return;
    setBusy(true); setError("");
    try {
      const updated = await updateTrainingSession(client, userId, trainingSession.id, { status });
      setTrainingSession(current => ({ ...current, ...updated }));
      if (status === "completed") { setRestTarget(0); await onCompleted?.(); notify("Treino concluído e resultados salvos."); }
    } catch (failure) { console.error("Falha ao atualizar a sessão de treino.", failure); setError(failure.message || "Não foi possível atualizar a sessão."); }
    finally { setBusy(false); }
  };
  const saveNotes = async () => {
    if (!trainingSession) return;
    setBusy(true); setError("");
    try { const updated = await updateTrainingSession(client, userId, trainingSession.id, { client_notes: sessionNotes }); setTrainingSession(current => ({ ...current, ...updated })); notify("Observações da sessão salvas."); }
    catch (failure) { setError(failure.message || "Não foi possível salvar as observações."); }
    finally { setBusy(false); }
  };
  const remaining = restTarget ? Math.max(0, Math.ceil((restTarget - now) / 1000)) : 0;
  const activePauseSeconds = trainingSession?.status === "paused" && trainingSession.pause_started_at
    ? Math.max(0, Math.floor((now - new Date(trainingSession.pause_started_at).getTime()) / 1000)) : 0;
  const elapsed = trainingSession?.started_at
    ? Math.max(0, Math.floor((now - new Date(trainingSession.started_at).getTime()) / 1000) - (trainingSession.paused_seconds || 0) - activePauseSeconds)
    : 0;
  const sessionExercises = trainingSession?.exercises || [];
  const restSeconds = Number.parseInt(String(day.exercises?.[0]?.rest || "").match(/\d+/)?.[0] || "0", 10);
  return <div className="training-session-launcher">
    {!trainingSession && !loading && <button type="button" className="button lime-button small-button" onClick={start} disabled={busy}><Play size={15} /> {busy ? "Iniciando…" : "Iniciar treino"}</button>}
    {loading && <span className="training-session-loading"><LoaderCircle className="spin" size={15} /> Verificando sessão…</span>}
    {trainingSession && <section className="training-session-panel">
      <div className="training-session-heading"><div><span className="eyebrow">{trainingSession.status === "completed" ? "SESSÃO CONCLUÍDA" : trainingSession.status === "paused" ? "SESSÃO PAUSADA" : "SESSÃO EM ANDAMENTO"}</span><strong>{day.workout_name}</strong><small className="training-session-elapsed">Tempo: {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</small></div><span>{formatDate(scheduledDate)}</span></div>
      {plan.warmup && <p className="weekly-coach-note">Aquecimento: {plan.warmup}</p>}
      {day.notes && <p className="weekly-coach-note">Orientação do personal: {day.notes}</p>}
      {sessionExercises.map(exercise => <TrainingExerciseLogger key={exercise.id} client={client} exercise={exercise} disabled={trainingSession.status !== "in_progress"} />)}
      {trainingSession.status !== "completed" && <div className="training-session-client-notes"><label>Esforço, desconforto ou observações<textarea value={sessionNotes} maxLength={2000} rows={2} onChange={event => setSessionNotes(event.target.value)} disabled={trainingSession.status === "paused"} placeholder="Registre como a sessão foi percebida" /></label><button type="button" className="button subtle small-button" onClick={saveNotes} disabled={busy || trainingSession.status === "paused"}>Salvar observação</button></div>}
      {trainingSession.status === "in_progress" && <div className="training-session-actions"><button type="button" className="button subtle small-button" onClick={() => setRestTarget(Date.now() + Math.max(1, restSeconds) * 1000)}><Timer size={15} /> {remaining ? `Descanso ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}` : `Iniciar descanso (${restSeconds || 60}s)`}</button><button type="button" className="button subtle small-button" onClick={() => changeStatus("paused")} disabled={busy}><Pause size={15} /> Pausar</button><button type="button" className="button lime-button small-button" onClick={() => changeStatus("completed")} disabled={busy}><Check size={15} /> Finalizar treino</button></div>}
      {trainingSession.status === "paused" && <button type="button" className="button primary small-button" onClick={() => changeStatus("in_progress")} disabled={busy}><Play size={15} /> Retomar sessão</button>}
      {trainingSession.status === "completed" && <p className="weekly-confirmed-note">Concluído em {trainingSession.completed_at ? new Date(trainingSession.completed_at).toLocaleString("pt-BR") : "—"} · {trainingSession.duration_minutes || "—"} min</p>}
    </section>}
    {error && <p className="social-inline-error training-session-error" role="alert">{error}<button type="button" className="text-button" onClick={reload}>Tentar novamente</button></p>}
  </div>;
}

function TrainingPlanDayFocus({ plan, dayIndex, client, userId, onChanged, notify }) {
  const [busy, setBusy] = useState(false);
  if (!plan) return <div className="weekly-empty"><span className="weekly-empty-icon"><CalendarDays size={22} /></span><h3>Aguardando prescrição</h3><p>Seu personal ainda não publicou um treino para esta data. Nenhuma ficha foi criada automaticamente.</p></div>;
  const day = plan.days?.[dayIndex];
  if (!day) return null;
  const confirm = async () => {
    setBusy(true);
    try { await confirmWeeklyPlan(client, plan.id, "personal"); await onChanged(); notify("Plano confirmado. Você já pode iniciar as sessões publicadas."); }
    catch (error) { console.error("Falha ao confirmar o plano semanal de treino.", error); notify(inputError(error)); }
    finally { setBusy(false); }
  };
  const markCompleted = async () => {
    try { await setTrainingDayCompleted(client, userId, plan.id, dayIndex, true); }
    catch (error) { if (error.code !== "23505") console.error("Falha ao atualizar o progresso do calendário.", error); }
    await onChanged();
  };
  return <article className="weekly-plan-card training-day-focus">
    <div className="weekly-plan-title"><div><span className="eyebrow">{WEEKDAYS[dayIndex]} · {formatDate(plan.week_start)}</span><h2>{day.is_rest_day ? "Dia de descanso" : day.workout_name}</h2><p>Personal: {plan.professional?.display_name || "Profissional vinculado"}</p></div><span className={`weekly-status ${plan.confirmed_at ? "confirmed" : "pending"}`}>{plan.confirmed_at ? "Confirmado" : "Aguardando confirmação"}</span></div>
    {plan.goal && <p className="weekly-goal-callout">Objetivo: {plan.goal}</p>}
    {day.is_rest_day ? <p className="weekly-rest-day"><CheckCircle2 size={16} /> Este dia foi reservado como descanso pelo seu personal.</p> : <>
      {plan.warmup && <p className="weekly-coach-note">Aquecimento: {plan.warmup}</p>}
      {day.notes && <p className="weekly-coach-note">Orientação do personal: {day.notes}</p>}
      {day.exercises.map((exercise, index) => <article className="weekly-exercise" key={`${exercise.name}-${index}`}><h4>{exercise.name}</h4>
        {exercise.muscle_group && <span className="weekly-exercise-muscle">{exercise.muscle_group}</span>}
        {exercise.description && <p>{exercise.description}</p>}
        {exercise.equipment && <p className="weekly-exercise-equipment">Equipamento: {exercise.equipment}</p>}
        <div className="weekly-exercise-specs">{exercise.sets && <span>{exercise.sets} séries</span>}{exercise.reps && <span>{exercise.reps} repetições</span>}{exercise.load && <span>Carga recomendada: {exercise.load} {exercise.load_unit || "kg"}</span>}{exercise.rest && <span>Descanso: {exercise.rest}</span>}{exercise.tempo && <span>Ritmo: {exercise.tempo}</span>}{exercise.duration && <span>Duração: {exercise.duration}</span>}{exercise.distance && <span>Distância: {exercise.distance}</span>}</div>
        {exercise.notes && <p className="weekly-coach-note">{exercise.notes}</p>}
        {exercise.video_url && (/\.mp4(?:$|\?)/i.test(exercise.video_url) ? <video className="weekly-exercise-video" controls preload="metadata" src={exercise.video_url}>Consulte as instruções escritas caso o vídeo não carregue.</video> : <a className="text-link weekly-video-link" href={exercise.video_url} target="_blank" rel="noreferrer">Ver demonstração do exercício <ArrowRight size={14} /></a>)}
      </article>)}
      {!plan.confirmed_at && <button type="button" className="button primary wide-button" onClick={confirm} disabled={busy}><Check size={16} /> {busy ? "Confirmando…" : "Confirmar plano"}</button>}
      {plan.confirmed_at && <TrainingSessionControls plan={plan} day={day} dayIndex={dayIndex} client={client} userId={userId} notify={notify} onCompleted={markCompleted} />}
      <p className="training-safety-note">Interrompa a atividade se sentir dor aguda, tontura ou outro sintoma preocupante e busque orientação apropriada.</p>
    </>}
  </article>;
}

function TrainingMonthCalendar({ plans, selectedDate, onSelect }) {
  const selected = new Date(`${selectedDate}T12:00:00`);
  const firstDay = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const daysInMonth = new Date(selected.getFullYear(), selected.getMonth() + 1, 0).getDate();
  const offset = (firstDay.getDay() + 6) % 7;
  const cells = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
  const planByWeek = new Map(plans.map(plan => [plan.week_start, plan]));
  return <div className="training-month-calendar">
    <div className="training-calendar-weekdays">{"Seg Ter Qua Qui Sex Sáb Dom".split(" ").map(day => <span key={day}>{day}</span>)}</div>
    <div className="training-calendar-days">{cells.map((day, index) => {
      if (!day) return <span className="training-calendar-blank" key={`blank-${index}`} />;
      const date = new Date(selected.getFullYear(), selected.getMonth(), day);
      const dateValue = localDate(date);
      const plan = planByWeek.get(getMonday(date));
      const dayIndex = (date.getDay() + 6) % 7;
      const planned = plan?.days?.[dayIndex];
      const isSelected = dateValue === selectedDate;
      return <button type="button" key={dateValue} className={`training-calendar-day ${isSelected ? "selected" : ""} ${planned ? "planned" : ""} ${plan?.completedDays?.includes(dayIndex) ? "completed" : ""}`} onClick={() => onSelect(dateValue)}>
        <strong>{day}</strong>{planned && <small>{planned.is_rest_day ? "Descanso" : planned.workout_name}</small>}
      </button>;
    })}</div>
    <p className="training-calendar-legend"><span className="legend-planned" /> Plano publicado <span className="legend-completed" /> Sessão marcada como concluída</p>
  </div>;
}

function NutritionPlanCard({ plan, client, onChanged, notify }) {
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try {
      await confirmWeeklyPlan(client, plan.id, "nutrition");
      await onChanged();
      notify("Plano alimentar confirmado. Sua nutricionista ja pode ver a confirmacao.");
    } catch (error) {
      console.error("Falha ao confirmar o plano semanal de nutricao.", error);
      notify(inputError(error));
    } finally {
      setBusy(false);
    }
  };
  return <article className="weekly-plan-card">
    <div className="weekly-plan-title"><div><span className="eyebrow">PLANO DA NUTRICIONISTA</span><h2>{plan.title}</h2><p>Profissional: {plan.professional?.display_name || "Nutricionista vinculada a sua conta"}</p></div><span className={`weekly-status ${plan.confirmed_at ? "confirmed" : "pending"}`}>{plan.confirmed_at ? <><CheckCircle2 size={15} /> Confirmado</> : "Pendente de confirmacao"}</span></div>
    {!plan.confirmed_at && <button className="button primary wide-button" type="button" onClick={confirm} disabled={busy}><Check size={17} /> {busy ? "Confirmando…" : "Confirmar Plano da Semana"}</button>}
    <div className="weekly-calorie-goal"><Apple size={20} /><span><strong>{Number(plan.daily_calorie_goal).toLocaleString("pt-BR")} kcal por dia</strong><small>{(Number(plan.daily_calorie_goal) * 7).toLocaleString("pt-BR")} kcal na meta semanal</small></span></div>
    <div className="weekly-day-list">{plan.days.map((day, index) => <details className="weekly-day" key={`${plan.id}-${index}`} open={index === 0}>
      <summary><span className="weekly-day-check"><Utensils size={14} /></span><span><strong>{WEEKDAYS[index]}</strong><small>Cardapio planejado pela nutricionista</small></span></summary>
      <div className="weekly-day-content weekly-meal-grid">{MEALS.map(([key, label]) => {
        const meal = day[key];
        const macros = formatMacros(meal);
        return <article className="weekly-meal-card" key={key}><div><h4>{label}</h4><strong>{Number(meal.calories).toLocaleString("pt-BR")} kcal</strong></div><p>{meal.description}</p>{macros && <small>{macros}</small>}</article>;
      })}</div>
    </details>)}</div>
    <section className="weekly-restaurants"><h3>Restaurantes recomendados</h3>{plan.restaurants.map((item, index) => <article className="weekly-restaurant" key={`${item.name}-${index}`}><div><strong>{item.name}</strong><span>{item.address}</span><p>Pratos sugeridos: {item.dishes}</p></div><small>{item.price_range}</small></article>)}</section>
    {plan.confirmed_at && <p className="weekly-confirmed-note">Confirmado em {new Date(plan.confirmed_at).toLocaleString("pt-BR")}.</p>}
  </article>;
}

export function WeeklyClientPlan({ client, session, kind, notify }) {
  const userId = session?.user?.id;
  const [plans, setPlans] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [trainingView, setTrainingView] = useState("week");
  const [selectedDate, setSelectedDate] = useState(() => localDate(new Date()));
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState("");
  const selectedPlan = plans.find(plan => plan.id === selectedId) || plans[0];
  const reload = async () => {
    if (!client || !userId) return;
    setLoading(true);
    setError("");
    try {
      const result = await loadWeeklyPlans(client, userId, kind);
      setPlans(result);
      setSelectedId(current => result.some(plan => plan.id === current) ? current : result[0]?.id || "");
    } catch (failure) {
      console.error("Falha ao carregar planos semanais do cliente.", failure);
      setError(inputError(failure));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { reload(); }, [client, userId, kind]);
  const datePlan = kind === "personal" && plans.find(plan => plan.week_start === getMonday(new Date(`${selectedDate}T12:00:00`)));
  const dateIndex = (new Date(`${selectedDate}T12:00:00`).getDay() + 6) % 7;

  if (!userId) return <section className="weekly-empty"><CircleAlert size={22} /><h2>Entre para acessar seu plano</h2><p>Planos semanais sao privados e aparecem somente na conta do cliente.</p><Link className="button primary" to="/profile">Entrar na conta <ArrowRight size={16} /></Link></section>;
  return <section className="weekly-client-area">
    <PlanNotice error={error} loading={loading} retry={reload} />
    {!loading && !error && plans.length === 0 && <div className="weekly-empty"><span className="weekly-empty-icon">{kind === "personal" ? <Dumbbell size={24} /> : <Utensils size={24} />}</span><h2>Nenhum plano semanal disponivel</h2><p>Quando seu profissional enviar um plano real, ele aparecera aqui para voce revisar e confirmar.</p></div>}
    {!loading && !error && selectedPlan && kind === "personal" && <div className="training-view-tabs" role="tablist" aria-label="Visualização da agenda de treinos">
      {[ ["day", "Dia"], ["week", "Semana"], ["month", "Mês"] ].map(([value, label]) => <button type="button" role="tab" aria-selected={trainingView === value} className={trainingView === value ? "active" : ""} key={value} onClick={() => setTrainingView(value)}>{label}</button>)}
    </div>}
    {!loading && !error && selectedPlan && kind === "personal" && trainingView === "week" && <><PlanHistory plans={plans} selectedId={selectedPlan.id} onSelect={setSelectedId} /><TrainingPlanCard plan={selectedPlan} client={client} userId={userId} onChanged={reload} notify={notify} /></>}
    {!loading && !error && selectedPlan && kind === "personal" && trainingView === "day" && <div className="training-calendar-view"><label>Escolha a data<input type="date" value={selectedDate} onChange={event => event.target.value && setSelectedDate(event.target.value)} /></label><TrainingPlanDayFocus plan={datePlan} dayIndex={dateIndex} client={client} userId={userId} onChanged={reload} notify={notify} /></div>}
    {!loading && !error && selectedPlan && kind === "personal" && trainingView === "month" && <div className="training-calendar-view"><label>Mês<input type="month" value={selectedDate.slice(0, 7)} onChange={event => event.target.value && setSelectedDate(`${event.target.value}-01`)} /></label><TrainingMonthCalendar plans={plans} selectedDate={selectedDate} onSelect={setSelectedDate} /><TrainingPlanDayFocus plan={datePlan} dayIndex={dateIndex} client={client} userId={userId} onChanged={reload} notify={notify} /></div>}
    {!loading && !error && selectedPlan && kind !== "personal" && <><PlanHistory plans={plans} selectedId={selectedPlan.id} onSelect={setSelectedId} /><NutritionPlanCard plan={selectedPlan} client={client} onChanged={reload} notify={notify} /></>}
  </section>;
}

function emptyRestaurants() {
  return [{ name: "", address: "", dishes: "", price_range: "" }];
}

export function WeeklyPlanManager({ client, professionalId, kind, bookings, notify }) {
  const contacts = useMemo(() => {
    const seen = new Set();
    return bookings
      .filter(booking => ["solicitada", "confirmada", "concluida"].includes(booking.status))
      .map(booking => booking.customer)
      .filter(customer => customer?.id && !seen.has(customer.id) && seen.add(customer.id));
  }, [bookings]);
  const [clientId, setClientId] = useState("");
  const [trainingDays, setTrainingDays] = useState(createTrainingDays);
  const [nutritionDays, setNutritionDays] = useState(createNutritionDays);
  const [trainingGoal, setTrainingGoal] = useState("");
  const [trainingWarmup, setTrainingWarmup] = useState("");
  const [weekStart, setWeekStart] = useState(getMonday());
  const [dailyCalories, setDailyCalories] = useState("");
  const [restaurants, setRestaurants] = useState(emptyRestaurants);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedPlan, setSavedPlan] = useState(null);

  useEffect(() => {
    if (!contacts.some(customer => customer.id === clientId)) setClientId(contacts[0]?.id || "");
  }, [contacts, clientId]);

  const resetForm = () => {
    setTrainingDays(createTrainingDays());
    setNutritionDays(createNutritionDays());
    setTrainingGoal("");
    setTrainingWarmup("");
    setDailyCalories("");
    setRestaurants(emptyRestaurants());
    setSavedPlan(null);
  };

  useEffect(() => {
    if (!clientId || !professionalId) {
      resetForm();
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError("");
    loadPlansForClient(client, professionalId, clientId, kind, weekStart)
      .then(plan => {
        if (!active) return;
        if (!plan) {
          resetForm();
          return;
        }
        setSavedPlan(plan);
        if (kind === "personal") {
          setTrainingDays(plan.days);
          setTrainingGoal(plan.goal || "");
          setTrainingWarmup(plan.warmup || "");
        }
        else {
          setNutritionDays(plan.days);
          setDailyCalories(String(plan.daily_calorie_goal));
          setRestaurants(plan.restaurants);
        }
      })
      .catch(failure => {
        if (!active) return;
        console.error("Falha ao carregar o plano semanal do cliente.", failure);
        setError(inputError(failure));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client, professionalId, clientId, kind, weekStart]);

  const save = async (event, publish = false) => {
    event.preventDefault();
    const validation = kind === "personal"
      ? validateTrainingPlan(trainingDays)
      : validateNutritionPlan(dailyCalories, nutritionDays, restaurants);
    if (validation) {
      setError(validation);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const plan = await saveWeeklyPlan(client, professionalId, clientId, kind, {
        days: kind === "personal" ? trainingDays : nutritionDays,
        weekStart,
        goal: trainingGoal,
        warmup: trainingWarmup,
        dailyCalories,
        restaurants,
      });
      if (kind === "personal") {
        if (publish) {
          const publishedAt = await publishWeeklyTrainingPlan(client, plan.id);
          setSavedPlan({ ...plan, status: "published", published_at: publishedAt });
          notify("Plano publicado para o cliente.");
        } else {
          setSavedPlan({ ...plan, status: "draft" });
          notify("Rascunho salvo. O cliente ainda não consegue visualizar este plano.");
        }
      } else {
        setSavedPlan(plan);
        notify("Plano semanal salvo e enviado ao cliente.");
      }
    } catch (failure) {
      console.error("Falha ao salvar o plano semanal.", failure);
      setError(inputError(failure));
    } finally {
      setSaving(false);
    }
  };

  const updateTrainingDay = (dayIndex, field, value) => setTrainingDays(current => current.map((day, index) => index === dayIndex ? { ...day, [field]: value } : day));
  const updateExercise = (dayIndex, exerciseIndex, field, value) => setTrainingDays(current => current.map((day, index) => index === dayIndex ? {
    ...day,
    exercises: day.exercises.map((exercise, itemIndex) => itemIndex === exerciseIndex ? { ...exercise, [field]: value } : exercise),
  } : day));
  const updateMeal = (dayIndex, mealKey, field, value) => setNutritionDays(current => current.map((day, index) => index === dayIndex ? {
    ...day,
    [mealKey]: { ...day[mealKey], [field]: value },
  } : day));
  const setRestDay = (dayIndex, isRestDay) => setTrainingDays(current => current.map((day, index) => index === dayIndex ? {
    ...day,
    is_rest_day: isRestDay,
    workout_name: isRestDay ? "Descanso" : "",
    exercises: isRestDay ? [] : [{ name: "", muscle_group: "", equipment: "", description: "", sets: "", reps: "", load: "", load_unit: "kg", rest: "", tempo: "", duration: "", distance: "", notes: "", video_url: "" }],
  } : day));
  const duplicateTrainingDay = dayIndex => setTrainingDays(current => current.map((day, index) => index === dayIndex + 1 ? {
    ...day,
    is_rest_day: current[dayIndex].is_rest_day,
    workout_name: current[dayIndex].workout_name,
    notes: current[dayIndex].notes,
    exercises: current[dayIndex].exercises.map(exercise => ({ ...exercise })),
  } : day));
  const reorderExercise = (dayIndex, exerciseIndex, offset) => setTrainingDays(current => current.map((day, index) => {
    if (index !== dayIndex) return day;
    const target = exerciseIndex + offset;
    if (target < 0 || target >= day.exercises.length) return day;
    const exercises = [...day.exercises];
    [exercises[exerciseIndex], exercises[target]] = [exercises[target], exercises[exerciseIndex]];
    return { ...day, exercises };
  }));

  if (!contacts.length) return <div className="weekly-empty"><UsersIcon /><h3>Nenhum cliente com agendamento real</h3><p>O plano pode ser enviado aos clientes vinculados a um agendamento real da sua conta.</p></div>;
  return <section className="weekly-manager">
    <div className="weekly-manager-heading"><div><span className="eyebrow">{kind === "personal" ? "PRESCRIÇÃO DE TREINO" : "ACOMPANHAMENTO NUTRICIONAL"}</span><h2>Plano da semana</h2><p>{formatWeekTitle(weekStart)}</p></div><span className="weekly-client-count">{contacts.length} {contacts.length === 1 ? "cliente" : "clientes"}</span></div>
    {kind === "personal" && <label className="weekly-history-select">Semana de início<input type="date" value={weekStart} onChange={event => event.target.value && setWeekStart(getMonday(new Date(`${event.target.value}T12:00:00`)))} /></label>}
    <label className="weekly-history-select">Cliente com agendamento
      <select value={clientId} onChange={event => setClientId(event.target.value)}>{contacts.map(customer => <option key={customer.id} value={customer.id}>{customer.name}{customer.username ? ` · @${customer.username}` : ""}</option>)}</select>
    </label>
    {loading && <p className="social-inline-status" role="status"><LoaderCircle className="spin" size={17} /> Carregando plano salvo…</p>}
    {savedPlan?.confirmed_at && <p className="weekly-confirmed-banner"><CheckCircle2 size={16} /> O cliente confirmou este plano em {new Date(savedPlan.confirmed_at).toLocaleString("pt-BR")}.</p>}
    {kind === "personal" && savedPlan && <p className={`weekly-plan-state ${savedPlan.status === "published" ? "published" : "draft"}`}>{savedPlan.status === "published" ? "Publicado para o cliente" : `Rascunho · versão ${savedPlan.version || 1} ainda não visível para o cliente`}</p>}
    {error && <p className="social-inline-error" role="alert">{error}</p>}
    <form onSubmit={event => save(event, kind === "personal" && event.nativeEvent.submitter?.value === "publish")}>
      {kind === "personal" ? <>
        <label className="weekly-goal-input">Objetivo do planejamento<input value={trainingGoal} onChange={event => setTrainingGoal(event.target.value)} maxLength={240} placeholder="Ex.: condicionamento e força" /></label>
        <label className="weekly-goal-input">Aquecimento e preparação<textarea value={trainingWarmup} onChange={event => setTrainingWarmup(event.target.value)} maxLength={1000} rows={2} placeholder="Orientação definida pelo personal (opcional)" /></label>
        <div className="weekly-editor-days">{trainingDays.map((day, dayIndex) => <details className="weekly-editor-day" key={day.day} open={dayIndex === 0}>
          <summary>{WEEKDAYS[dayIndex]} · {day.is_rest_day ? "Descanso" : day.workout_name || "Treino não informado"}</summary>
          <div className="weekly-editor-day-body">
            <label className="weekly-rest-toggle"><input type="checkbox" checked={Boolean(day.is_rest_day)} onChange={event => setRestDay(dayIndex, event.target.checked)} /> Dia de descanso</label>
            {!day.is_rest_day && <><label>Nome da sessão<input value={day.workout_name} onChange={event => updateTrainingDay(dayIndex, "workout_name", event.target.value)} maxLength={120} required /></label><label>Observações do personal<textarea value={day.notes} onChange={event => updateTrainingDay(dayIndex, "notes", event.target.value)} maxLength={1000} rows={2} /></label>
              {day.exercises.map((exercise, exerciseIndex) => <fieldset className="weekly-exercise-editor" key={exerciseIndex}><legend>Exercício {exerciseIndex + 1}</legend>
                <label>Nome<input value={exercise.name} onChange={event => updateExercise(dayIndex, exerciseIndex, "name", event.target.value)} required maxLength={120} /></label>
                <div className="weekly-field-row"><label>Grupo muscular<input value={exercise.muscle_group || ""} onChange={event => updateExercise(dayIndex, exerciseIndex, "muscle_group", event.target.value)} maxLength={80} placeholder="Ex.: pernas" /></label><label>Equipamento<input value={exercise.equipment || ""} onChange={event => updateExercise(dayIndex, exerciseIndex, "equipment", event.target.value)} maxLength={120} placeholder="Ex.: halteres" /></label></div>
                <label>Instruções de execução<textarea value={exercise.description || ""} onChange={event => updateExercise(dayIndex, exerciseIndex, "description", event.target.value)} maxLength={1000} rows={3} placeholder="Orientações técnicas do profissional" /></label>
                <div className="weekly-field-row"><label>Séries<input value={exercise.sets || ""} onChange={event => updateExercise(dayIndex, exerciseIndex, "sets", event.target.value)} maxLength={40} placeholder="Ex.: 3" /></label><label>Repetições<input value={exercise.reps || ""} onChange={event => updateExercise(dayIndex, exerciseIndex, "reps", event.target.value)} maxLength={40} placeholder="Ex.: 8–12" /></label></div>
                <div className="weekly-field-row"><label>Carga recomendada<input value={exercise.load || ""} onChange={event => updateExercise(dayIndex, exerciseIndex, "load", event.target.value)} maxLength={100} placeholder="Opcional" /></label><label>Unidade da carga<select value={exercise.load_unit || "kg"} onChange={event => updateExercise(dayIndex, exerciseIndex, "load_unit", event.target.value)}><option value="kg">kg</option><option value="lb">lb</option><option value="bodyweight">Peso corporal</option><option value="none">Sem carga</option></select></label></div>
                <div className="weekly-field-row"><label>Descanso<input value={exercise.rest || ""} onChange={event => updateExercise(dayIndex, exerciseIndex, "rest", event.target.value)} maxLength={40} placeholder="Ex.: 90 s" /></label><label>Ritmo / tempo<input value={exercise.tempo || ""} onChange={event => updateExercise(dayIndex, exerciseIndex, "tempo", event.target.value)} maxLength={40} placeholder="Opcional" /></label></div>
                <div className="weekly-field-row"><label>Duração<input value={exercise.duration || ""} onChange={event => updateExercise(dayIndex, exerciseIndex, "duration", event.target.value)} maxLength={40} placeholder="Ex.: 20 min" /></label><label>Distância<input value={exercise.distance || ""} onChange={event => updateExercise(dayIndex, exerciseIndex, "distance", event.target.value)} maxLength={40} placeholder="Ex.: 5 km" /></label></div>
                <label>Observações e adaptações<textarea value={exercise.notes || ""} onChange={event => updateExercise(dayIndex, exerciseIndex, "notes", event.target.value)} maxLength={1000} rows={2} /></label>
                <label>Vídeo demonstrativo (opcional, HTTPS)<input type="url" value={exercise.video_url || ""} onChange={event => updateExercise(dayIndex, exerciseIndex, "video_url", event.target.value)} placeholder="https://" /></label>
                <div className="weekly-exercise-editor-actions">{exerciseIndex > 0 && <button type="button" className="button subtle small-button" onClick={() => reorderExercise(dayIndex, exerciseIndex, -1)} aria-label="Mover exercício para cima"><ArrowUp size={14} /></button>}{exerciseIndex < day.exercises.length - 1 && <button type="button" className="button subtle small-button" onClick={() => reorderExercise(dayIndex, exerciseIndex, 1)} aria-label="Mover exercício para baixo"><ArrowDown size={14} /></button>}{day.exercises.length > 1 && <button type="button" className="text-button" onClick={() => setTrainingDays(current => current.map((item, index) => index === dayIndex ? { ...item, exercises: item.exercises.filter((_, itemIndex) => itemIndex !== exerciseIndex) } : item))}>Remover exercício</button>}</div>
              </fieldset>)}
              <div className="weekly-training-day-actions"><button className="button subtle small-button" type="button" onClick={() => setTrainingDays(current => current.map((item, index) => index === dayIndex ? { ...item, exercises: [...item.exercises, { name: "", muscle_group: "", equipment: "", description: "", sets: "", reps: "", load: "", load_unit: "kg", rest: "", tempo: "", duration: "", distance: "", notes: "", video_url: "" }] } : item))}><Plus size={15} /> Adicionar exercício</button>{dayIndex < 6 && <button className="button subtle small-button" type="button" onClick={() => duplicateTrainingDay(dayIndex)}><Copy size={14} /> Duplicar para o próximo dia</button>}</div>
            </>}
          </div>
        </details>)}</div>
      </> : <><label className="weekly-goal-input">Meta calórica diária (kcal)<input type="number" value={dailyCalories} onChange={event => setDailyCalories(event.target.value)} min="500" max="10000" required /><small>Meta semanal: {dailyCalories ? (Number(dailyCalories) * 7).toLocaleString("pt-BR") : "—"} kcal</small></label>
        <div className="weekly-editor-days">{nutritionDays.map((day, dayIndex) => <details className="weekly-editor-day" key={day.day} open={dayIndex === 0}>
          <summary>{WEEKDAYS[dayIndex]} · Cardapio diario</summary>
          <div className="weekly-editor-day-body">{MEALS.map(([mealKey, mealLabel]) => <fieldset className="weekly-meal-editor" key={mealKey}><legend>{mealLabel}</legend>
            <label>Refeicao e porcoes<textarea value={day[mealKey].description} onChange={event => updateMeal(dayIndex, mealKey, "description", event.target.value)} required maxLength={1500} rows={2} /></label>
            <label>Calorias (kcal)<input type="number" min="0" max="10000" value={day[mealKey].calories} onChange={event => updateMeal(dayIndex, mealKey, "calories", event.target.value)} required /></label>
            <div className="weekly-field-row"><label>Proteina (g)<input type="number" min="0" step="0.1" value={day[mealKey].protein_g} onChange={event => updateMeal(dayIndex, mealKey, "protein_g", event.target.value)} /></label><label>Carboidrato (g)<input type="number" min="0" step="0.1" value={day[mealKey].carbohydrates_g} onChange={event => updateMeal(dayIndex, mealKey, "carbohydrates_g", event.target.value)} /></label><label>Gordura (g)<input type="number" min="0" step="0.1" value={day[mealKey].fat_g} onChange={event => updateMeal(dayIndex, mealKey, "fat_g", event.target.value)} /></label></div>
          </fieldset>)}</div>
        </details>)}</div>
        <section className="weekly-restaurant-editor"><div className="weekly-manager-heading"><div><h3>Restaurantes recomendados</h3><p>Informe apenas locais e pratos verificados por voce.</p></div><button type="button" className="button subtle small-button" onClick={() => setRestaurants(current => [...current, { name: "", address: "", dishes: "", price_range: "" }])}><Plus size={15} /> Adicionar</button></div>
          {restaurants.map((restaurant, index) => <fieldset className="weekly-meal-editor" key={index}><legend>Restaurante {index + 1}</legend><label>Nome<input value={restaurant.name} onChange={event => setRestaurants(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} required maxLength={120} /></label><label>Endereco / bairro<input value={restaurant.address} onChange={event => setRestaurants(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, address: event.target.value } : item))} required maxLength={300} /></label><label>Pratos sugeridos<input value={restaurant.dishes} onChange={event => setRestaurants(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, dishes: event.target.value } : item))} required maxLength={500} /></label><label>Faixa de preco<input value={restaurant.price_range} onChange={event => setRestaurants(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, price_range: event.target.value } : item))} required maxLength={80} /></label>{restaurants.length > 1 && <button type="button" className="text-button" onClick={() => setRestaurants(current => current.filter((_, itemIndex) => itemIndex !== index))}>Remover restaurante</button>}</fieldset>)}
        </section>
      </>}
      {kind === "personal" ? <div className="weekly-plan-submit-actions"><button type="submit" className="button subtle wide-button" value="draft" disabled={saving || loading}>{saving ? "Salvando…" : "Salvar rascunho"}</button><button type="submit" className="button lime-button wide-button" value="publish" disabled={saving || loading}>{saving ? "Publicando…" : "Publicar para o cliente"}</button></div> : <button type="submit" className="button primary wide-button weekly-save-button" disabled={saving || loading}>{saving ? "Salvando plano…" : "Salvar e enviar plano ao cliente"}</button>}
      <p className="reference-disclosure">{kind === "personal" ? "Rascunhos não aparecem para o cliente. Ao publicar uma revisão, o histórico já concluído permanece preservado." : "O plano só é enviado após preencher os campos obrigatórios. A confirmação do cliente fica registrada no sistema."}</p>
    </form>
  </section>;
}

function UsersIcon() {
  return <Dumbbell size={22} aria-hidden="true" />;
}
