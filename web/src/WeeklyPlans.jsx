import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Apple, ArrowRight, Check, CheckCircle2, CircleAlert, Dumbbell, LoaderCircle, Plus, RefreshCw, Utensils } from "lucide-react";
import {
  confirmWeeklyPlan, createNutritionDays, createTrainingDays, formatWeekTitle, getMonday,
  loadPlansForClient, loadWeeklyPlans, MEALS, saveWeeklyPlan, setTrainingDayCompleted,
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
  const toggleDay = async index => {
    setBusy(true);
    try {
      await setTrainingDayCompleted(client, userId, plan.id, index, !completed.has(index));
      await onChanged();
    } catch (error) {
      console.error("Falha ao atualizar o progresso semanal do treino.", error);
      notify(inputError(error));
    } finally {
      setBusy(false);
    }
  };
  const completedCount = completed.size;
  return <article className="weekly-plan-card">
    <div className="weekly-plan-title"><div><span className="eyebrow">PLANO DO PERSONAL</span><h2>{plan.title}</h2><p>Profissional: {plan.professional?.display_name || "Personal vinculado a sua conta"}</p></div><span className={`weekly-status ${plan.confirmed_at ? "confirmed" : "pending"}`}>{plan.confirmed_at ? <><CheckCircle2 size={15} /> Confirmado</> : "Pendente de confirmacao"}</span></div>
    {!plan.confirmed_at && <button className="button primary wide-button" type="button" onClick={confirm} disabled={busy}><Check size={17} /> {busy ? "Confirmando…" : "Confirmar Plano da Semana"}</button>}
    <div className="weekly-progress"><div><strong>Progresso da semana</strong><span>{completedCount} de 7 dias concluidos</span></div><div className="weekly-progress-track"><span style={{ width: `${completedCount / 7 * 100}%` }} /></div></div>
    <div className="weekly-day-list">{plan.days.map((day, index) => <details className="weekly-day" key={`${plan.id}-${index}`} open={index === 0}>
      <summary><span className={`weekly-day-check ${completed.has(index) ? "done" : ""}`}>{completed.has(index) && <Check size={14} />}</span><span><strong>{WEEKDAYS[index]}</strong><small>{day.workout_name}</small></span><span className="weekly-day-count">{day.exercises.length} exercicios</span></summary>
      <div className="weekly-day-content">
        {day.notes && <p className="weekly-coach-note">{day.notes}</p>}
        {day.exercises.map((exercise, exerciseIndex) => <article className="weekly-exercise" key={`${exercise.name}-${exerciseIndex}`}>
          <h4>{exercise.name}</h4><p>{exercise.description}</p>
          <div className="weekly-exercise-specs"><span>{exercise.sets} series</span><span>{exercise.reps} repeticoes</span><span>Carga: {exercise.load}</span><span>Descanso: {exercise.rest}</span></div>
          {/\.mp4(?:$|\?)/i.test(exercise.video_url) ? <video className="weekly-exercise-video" controls preload="metadata" src={exercise.video_url}>Seu navegador nao reproduz este video.</video> : <a className="text-link weekly-video-link" href={exercise.video_url} target="_blank" rel="noreferrer">Assistir video explicativo <ArrowRight size={14} /></a>}
        </article>)}
        {plan.confirmed_at && <button type="button" className={`button ${completed.has(index) ? "subtle" : "primary"} small-button`} onClick={() => toggleDay(index)} disabled={busy}>{completed.has(index) ? "Desmarcar como concluido" : "Marcar dia como concluido"}</button>}
      </div>
    </details>)}</div>
    {plan.confirmed_at && <p className="weekly-confirmed-note">Confirmado em {new Date(plan.confirmed_at).toLocaleString("pt-BR")}.</p>}
  </article>;
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

  if (!userId) return <section className="weekly-empty"><CircleAlert size={22} /><h2>Entre para acessar seu plano</h2><p>Planos semanais sao privados e aparecem somente na conta do cliente.</p><Link className="button primary" to="/profile">Entrar na conta <ArrowRight size={16} /></Link></section>;
  return <section className="weekly-client-area">
    <PlanNotice error={error} loading={loading} retry={reload} />
    {!loading && !error && plans.length === 0 && <div className="weekly-empty"><span className="weekly-empty-icon">{kind === "personal" ? <Dumbbell size={24} /> : <Utensils size={24} />}</span><h2>Nenhum plano semanal disponivel</h2><p>Quando seu profissional enviar um plano real, ele aparecera aqui para voce revisar e confirmar.</p></div>}
    {!loading && !error && selectedPlan && <><PlanHistory plans={plans} selectedId={selectedPlan.id} onSelect={setSelectedId} />
      {kind === "personal" ? <TrainingPlanCard plan={selectedPlan} client={client} userId={userId} onChanged={reload} notify={notify} /> : <NutritionPlanCard plan={selectedPlan} client={client} onChanged={reload} notify={notify} />}
    </>}
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
    loadPlansForClient(client, professionalId, clientId, kind)
      .then(plan => {
        if (!active) return;
        if (!plan) {
          resetForm();
          return;
        }
        setSavedPlan(plan);
        if (kind === "personal") setTrainingDays(plan.days);
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
  }, [client, professionalId, clientId, kind]);

  const save = async event => {
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
        dailyCalories,
        restaurants,
      });
      setSavedPlan(plan);
      notify("Plano semanal salvo e enviado ao cliente.");
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

  if (!contacts.length) return <div className="weekly-empty"><UsersIcon /><h3>Nenhum cliente com agendamento real</h3><p>O plano pode ser enviado aos clientes vinculados a um agendamento real da sua conta.</p></div>;
  return <section className="weekly-manager">
    <div className="weekly-manager-heading"><div><span className="eyebrow">{kind === "personal" ? "PRESCRICAO DE TREINO" : "ACOMPANHAMENTO NUTRICIONAL"}</span><h2>Plano da semana</h2><p>{formatWeekTitle(getMonday())}</p></div><span className="weekly-client-count">{contacts.length} {contacts.length === 1 ? "cliente" : "clientes"}</span></div>
    <label className="weekly-history-select">Cliente com agendamento
      <select value={clientId} onChange={event => setClientId(event.target.value)}>{contacts.map(customer => <option key={customer.id} value={customer.id}>{customer.name}{customer.username ? ` · @${customer.username}` : ""}</option>)}</select>
    </label>
    {loading && <p className="social-inline-status" role="status"><LoaderCircle className="spin" size={17} /> Carregando plano salvo…</p>}
    {savedPlan?.confirmed_at && <p className="weekly-confirmed-banner"><CheckCircle2 size={16} /> O cliente confirmou este plano em {new Date(savedPlan.confirmed_at).toLocaleString("pt-BR")}.</p>}
    {error && <p className="social-inline-error" role="alert">{error}</p>}
    <form onSubmit={save}>
      {kind === "personal" ? <div className="weekly-editor-days">{trainingDays.map((day, dayIndex) => <details className="weekly-editor-day" key={day.day} open={dayIndex === 0}>
        <summary>{WEEKDAYS[dayIndex]} · {day.workout_name || "Treino nao informado"}</summary>
        <div className="weekly-editor-day-body"><label>Nome do treino<input value={day.workout_name} onChange={event => updateTrainingDay(dayIndex, "workout_name", event.target.value)} maxLength={120} required /></label><label>Observacoes do personal<textarea value={day.notes} onChange={event => updateTrainingDay(dayIndex, "notes", event.target.value)} maxLength={1000} rows={2} /></label>
          {day.exercises.map((exercise, exerciseIndex) => <fieldset className="weekly-exercise-editor" key={exerciseIndex}><legend>Exercicio {exerciseIndex + 1}</legend>
            <label>Nome<input value={exercise.name} onChange={event => updateExercise(dayIndex, exerciseIndex, "name", event.target.value)} required maxLength={120} /></label>
            <label>Descricao e orientacao<textarea value={exercise.description} onChange={event => updateExercise(dayIndex, exerciseIndex, "description", event.target.value)} required maxLength={1000} rows={3} /></label>
            <div className="weekly-field-row"><label>Series<input value={exercise.sets} onChange={event => updateExercise(dayIndex, exerciseIndex, "sets", event.target.value)} required maxLength={40} /></label><label>Repeticoes<input value={exercise.reps} onChange={event => updateExercise(dayIndex, exerciseIndex, "reps", event.target.value)} required maxLength={40} /></label></div>
            <div className="weekly-field-row"><label>Carga recomendada<input value={exercise.load} onChange={event => updateExercise(dayIndex, exerciseIndex, "load", event.target.value)} required maxLength={100} /></label><label>Descanso<input value={exercise.rest} onChange={event => updateExercise(dayIndex, exerciseIndex, "rest", event.target.value)} required maxLength={40} /></label></div>
            <label>Video explicativo (HTTPS)<input type="url" value={exercise.video_url} onChange={event => updateExercise(dayIndex, exerciseIndex, "video_url", event.target.value)} placeholder="https://…" required /></label>
            {day.exercises.length > 1 && <button type="button" className="text-button" onClick={() => setTrainingDays(current => current.map((item, index) => index === dayIndex ? { ...item, exercises: item.exercises.filter((_, itemIndex) => itemIndex !== exerciseIndex) } : item))}>Remover exercicio</button>}
          </fieldset>)}
          <button className="button subtle small-button" type="button" onClick={() => setTrainingDays(current => current.map((item, index) => index === dayIndex ? { ...item, exercises: [...item.exercises, { name: "", description: "", sets: "", reps: "", load: "", rest: "", video_url: "" }] } : item))}><Plus size={15} /> Adicionar exercicio</button>
        </div>
      </details>)}</div> : <><label className="weekly-goal-input">Meta calorica diaria (kcal)<input type="number" value={dailyCalories} onChange={event => setDailyCalories(event.target.value)} min="500" max="10000" required /><small>Meta semanal: {dailyCalories ? (Number(dailyCalories) * 7).toLocaleString("pt-BR") : "—"} kcal</small></label>
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
      <button type="submit" className="button primary wide-button weekly-save-button" disabled={saving || loading}>{saving ? "Salvando plano…" : "Salvar e enviar plano ao cliente"}</button>
      <p className="reference-disclosure">O plano so e enviado apos preencher todos os campos obrigatorios. A confirmacao do cliente fica registrada no sistema.</p>
    </form>
  </section>;
}

function UsersIcon() {
  return <Dumbbell size={22} aria-hidden="true" />;
}
