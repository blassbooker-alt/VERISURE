import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity, Apple, ArrowDownRight, ArrowUpRight, Bell, CalendarDays, Check,
  ChevronDown, CircleHelp, ClipboardList, Dumbbell, HeartPulse, LayoutDashboard,
  LogOut, Plus, Search, Settings, Sparkles, Users, Utensils,
} from "lucide-react";
import { clients, restaurants } from "./data.js";

const trainerSections = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "clients", label: "Meus clientes", icon: Users },
  { id: "routine", label: "Rotina semanal", icon: CalendarDays },
];
const nutritionSections = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "clients", label: "Meus clientes", icon: Users },
  { id: "routine", label: "Plano alimentar", icon: Utensils },
  { id: "curation", label: "Food curado", icon: Apple },
];

function Metric({ label, value, note, icon: Icon, tone = "green" }) {
  return (
    <article className="dash-metric">
      <div className={`dash-metric-icon ${tone}`}><Icon size={19} /></div>
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{note}</span>
    </article>
  );
}

function ClientTable({ search, setSearch, onSelect, nutrition }) {
  const filtered = clients.filter(client => client.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <section className="dash-panel">
      <div className="dash-panel-head">
        <div><h2>Clientes</h2><p>Acompanhe o progresso e a rotina de cada pessoa.</p></div>
        <label className="dash-search"><Search size={17} /><input aria-label="Buscar clientes" placeholder="Buscar clientes" value={search} onChange={event => setSearch(event.target.value)} /></label>
      </div>
      <div className="dash-table-wrap">
        <table className="dash-table">
          <thead><tr><th>Cliente</th><th>Objetivo</th><th>{nutrition ? "Meta diária" : "Peso atual"}</th><th>Aderência</th><th>Última atividade</th><th>Status</th></tr></thead>
          <tbody>
            {filtered.map(client => <tr key={client.name} onClick={() => onSelect(client)} tabIndex="0" onKeyDown={event => event.key === "Enter" && onSelect(client)}>
              <td><div className="dash-person"><span>{client.initials}</span><strong>{client.name}</strong></div></td>
              <td>{client.goal}</td><td>{nutrition ? "2.100 kcal" : client.weight}</td>
              <td><div className="dash-adherence"><span><i style={{ width: `${client.adherence}%` }} /></span>{client.adherence}%</div></td>
              <td>{client.last}</td><td><b className={`status-pill ${client.status === "Em dia" ? "ok" : "attention"}`}>{client.status}</b></td>
            </tr>)}
          </tbody>
        </table>
        {!filtered.length && <div className="dash-empty">Nenhum cliente encontrado. Tente outro nome.</div>}
      </div>
    </section>
  );
}

function WeeklyPlan({ nutrition, notify }) {
  const [day, setDay] = useState("Segunda");
  const [template, setTemplate] = useState("");
  const [items, setItems] = useState(nutrition
    ? ["Aveia, iogurte e frutas", "Frango, arroz e legumes", "Iogurte com castanhas", "Omelete com salada"]
    : ["Supino reto · 4 × 12", "Remada baixa · 3 × 12", "Prancha · 3 × 45 s"]);
  const [draft, setDraft] = useState("");
  const weekdays = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
  const add = () => {
    if (!draft.trim()) { notify("Escreva um item antes de adicionar."); return; }
    setItems(current => [...current, draft.trim()]);
    setDraft("");
  };
  return (
    <section className="dash-panel">
      <div className="dash-panel-head">
        <div><h2>{nutrition ? "Plano alimentar semanal" : "Criar rotina semanal"}</h2><p>{nutrition ? "Organize refeições, metas e hidratação do cliente." : "Monte uma programação clara, progressiva e fácil de acompanhar."}</p></div>
        <button className="button primary small-button" onClick={() => notify(nutrition ? "Plano salvo nesta visualização." : "Rotina salva nesta visualização.")}><Check size={16} /> Salvar plano</button>
      </div>
      <div className="weekday-scroll">{weekdays.map(name => <button key={name} className={`weekday ${day === name ? "selected" : ""}`} onClick={() => setDay(name)}>{name.slice(0, 3)}</button>)}</div>
      {!nutrition && <div className="template-row"><span>Modelos salvos</span>{["Ciclo Hipertrofia", "Ciclo Emagrecimento", "Ciclo Força"].map(name => <button key={name} className={template === name ? "selected" : ""} onClick={() => { setTemplate(name); setItems(name === "Ciclo Força" ? ["Agachamento livre · 4 × 8", "Levantamento terra · 4 × 6", "Desenvolvimento · 3 × 10"] : name === "Ciclo Emagrecimento" ? ["Circuito funcional · 4 voltas", "Caminhada inclinada · 20 min", "Mobilidade · 10 min"] : ["Supino reto · 4 × 12", "Remada curvada · 4 × 10", "Agachamento · 4 × 10"]); }}>{name}</button>)}</div>}
      {nutrition && <div className="macro-editor">
        <label>Meta diária<input type="number" defaultValue="2100" aria-label="Meta diária em quilocalorias" /></label>
        <label>Proteína<input type="text" defaultValue="35% · 183 g" aria-label="Meta de proteína" /></label>
        <label>Carboidrato<input type="text" defaultValue="40% · 210 g" aria-label="Meta de carboidrato" /></label>
        <label>Gordura<input type="text" defaultValue="25% · 58 g" aria-label="Meta de gordura" /></label>
      </div>}
      <div className="plan-day-title"><div><span className="day-dot" /><strong>{day}</strong></div><span>{nutrition ? "2.100 kcal planejadas" : "Treino · Grupo muscular"}</span></div>
      <div className="plan-list">{items.map((item, index) => <div className="plan-item" key={`${day}-${item}-${index}`}>
        <span className="plan-number">{String(index + 1).padStart(2, "0")}</span><div><strong>{item}</strong><small>{nutrition ? ["Café da manhã", "Almoço", "Lanche", "Jantar"][index % 4] : "3–4 séries · 60 s de descanso"}</small></div><button className="icon-button" aria-label={`Remover ${item}`} onClick={() => setItems(current => current.filter((_, itemIndex) => itemIndex !== index))}>×</button>
      </div>)}</div>
      <div className="add-plan-row"><input value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => event.key === "Enter" && add()} placeholder={nutrition ? "Adicionar refeição, observação ou hidratação" : "Adicionar exercício, séries e repetições"} aria-label={nutrition ? "Nova refeição" : "Novo exercício"} /><button className="button subtle" onClick={add}><Plus size={17} /> Adicionar</button></div>
      <label className="note-field">{nutrition ? "Observações para o cliente" : "Observações e substituições"}<textarea placeholder={nutrition ? "Preferências, restrições e orientações para a semana…" : "Anote alternativas e orientações para a semana…"} /></label>
      {nutrition && <label className="toggle-line"><input type="checkbox" disabled /> Notificações ao cliente indisponíveis nesta visualização</label>}
    </section>
  );
}

function Overview({ nutrition, notify, setSection }) {
  return <>
    <div className="dash-welcome"><div><span className="dash-eyebrow">{nutrition ? "CONSULTÓRIO DIGITAL" : "ESTÚDIO DIGITAL"}</span><h1>Bom dia, {nutrition ? "Dra. Ana" : "Coach Pedro"} <span>✳</span></h1><p>Uma visão clara para cuidar melhor de cada jornada.</p></div><button className="button primary" onClick={() => setSection(nutrition ? "routine" : "routine")}><Plus size={18} /> {nutrition ? "Novo plano" : "Criar rotina"}</button></div>
    <div className="dash-metrics">
      <Metric label={nutrition ? "Clientes ativos" : "Clientes ativos"} value={nutrition ? "24" : "18"} note="↑ 3 neste mês" icon={Users} />
      <Metric label={nutrition ? "Refeições registradas" : "Treinos concluídos hoje"} value={nutrition ? "46" : "32"} note="↑ 12% em relação à semana passada" icon={nutrition ? Apple : Dumbbell} />
      <Metric label={nutrition ? "Aderência às metas" : "Aderência média"} value={nutrition ? "84%" : "87%"} note="Nos últimos 7 dias" icon={Activity} tone="lime" />
      <Metric label="Precisam de atenção" value="3" note="Acompanhe com uma mensagem" icon={HeartPulse} tone="amber" />
    </div>
    <div className="dash-grid">
      <section className="dash-panel activity-panel"><div className="dash-panel-head"><div><h2>Atividade da semana</h2><p>Participação dos clientes nos últimos 7 dias</p></div><button className="period-button">Esta semana <ChevronDown size={15} /></button></div>
        <div className="chart-legend"><span><i /> {nutrition ? "Metas registradas" : "Treinos concluídos"}</span><span>Últimos 7 dias</span></div>
        <div className="bar-chart" aria-label="Gráfico de atividade da semana">{[55, 75, 62, 90, 72, 84, 65].map((value, index) => <div className="bar-column" key={index}><span>{value}%</span><i style={{ height: `${value}%` }} /><small>{["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"][index]}</small></div>)}</div>
      </section>
      <section className="dash-panel attention-panel"><div className="dash-panel-head"><div><h2>Seu cuidado faz diferença</h2><p>Pessoas que podem precisar de acompanhamento.</p></div></div>
        {clients.filter(client => client.status === "Atenção").map(client => <div className="attention-row" key={client.name}><span className="dash-avatar">{client.initials}</span><div><strong>{client.name}</strong><small>{nutrition ? "Meta alimentar abaixo do esperado" : "Último treino há 2 dias"}</small></div><button className="button subtle small-button" onClick={() => notify(`Lembrete preparado para ${client.name}.`)}>Ver perfil</button></div>)}
        <div className="attention-tip"><CircleHelp size={16} /><span>Um lembrete gentil pode ajudar a retomar a rotina.</span></div>
      </section>
    </div>
    <div className="dash-section-heading"><div><h2>Atividade recente</h2><p>O que aconteceu com seus clientes hoje.</p></div><button className="text-button" onClick={() => setSection("clients")}>Ver todos</button></div>
    <div className="recent-list">{[
      ["MC", "Mariana Costa", nutrition ? "Registrou almoço · 12:42" : "Concluiu treino de peito · 06:58", "Agora"],
      ["CR", "Camila Rocha", nutrition ? "Meta de água concluída · 11:30" : "Iniciou treino de pernas · 07:15", "Há 18 min"],
      ["RL", "Rafael Lima", nutrition ? "Plano alimentar atualizado" : "Nova avaliação agendada", "Há 1 h"],
    ].map(row => <div className="recent-row" key={row[1]}><span className="dash-avatar">{row[0]}</span><div><strong>{row[1]}</strong><small>{row[2]}</small></div><time>{row[3]}</time></div>)}</div>
  </>;
}

function ClientProfile({ client, nutrition, notify }) {
  return <div className="client-profile">
    <section className="dash-panel client-cover"><span className="dash-avatar large">{client.initials}</span><div><span className="status-pill ok">Acompanhamento ativo</span><h2>{client.name}</h2><p>{client.goal} · {client.weight}</p></div><button className="button subtle" onClick={() => notify(`Mensagem para ${client.name} preparada.`)}>Enviar mensagem</button></section>
    <div className="dash-metrics compact">
      <Metric label={nutrition ? "Meta diária" : "Peso atual"} value={nutrition ? "2.100 kcal" : client.weight} note={nutrition ? "Meta nutricional" : "−4 kg nos últimos 30 dias"} icon={nutrition ? Apple : Activity} />
      <Metric label="Aderência no mês" value={`${client.adherence}%`} note="Evolução consistente" icon={HeartPulse} tone="lime" />
      <Metric label={nutrition ? "Refeições registradas" : "Treinos no mês"} value={nutrition ? "52" : "17 / 20"} note="Última atividade: hoje" icon={nutrition ? Utensils : Dumbbell} />
    </div>
    <section className="dash-panel"><div className="dash-panel-head"><div><h2>{nutrition ? "Resumo nutricional" : "Evolução e treinos"}</h2><p>Informações recentes para orientar o próximo passo.</p></div></div>
      <div className="client-insights"><div><span>Última atividade</span><strong>{client.last}</strong></div><div><span>Objetivo atual</span><strong>{client.goal}</strong></div><div><span>Próxima avaliação</span><strong>18 de outubro · 09:00</strong></div></div>
      {nutrition && <div className="macro-bars">{[["Proteína", 72], ["Carboidratos", 64], ["Hidratação", 48]].map(([name, val]) => <div key={name}><span>{name}</span><b>{val}%</b><i><em style={{ width: `${val}%` }} /></i></div>)}</div>}
    </section>
    <section className="dash-panel"><div className="dash-panel-head"><div><h2>Observações profissionais</h2><p>Registre pontos importantes para o acompanhamento.</p></div></div><textarea className="observation-box" defaultValue={nutrition ? "Boa consistência durante a semana. Conversar sobre opções práticas para o jantar." : "Boa evolução de carga. Reforçar a recuperação entre as sessões."} /><button className="button primary small-button mt-4" onClick={() => notify("Observação salva nesta visualização.")}><Check size={16} /> Salvar observação</button></section>
  </div>;
}

export default function Dashboard({ role, notify }) {
  const nutrition = role === "nutritionist";
  const [section, setSection] = useState("overview");
  const [search, setSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState(clients[0].name);
  const [showClientProfile, setShowClientProfile] = useState(false);
  const [restaurantSelection, setRestaurantSelection] = useState(() => new Set([restaurants[0].name, restaurants[1].name]));
  const [showLogin, setShowLogin] = useState(true);
  const sections = nutrition ? nutritionSections : trainerSections;
  const title = nutrition ? "Dra. Ana" : "Coach Pedro";
  const subtitle = nutrition ? "Nutricionista" : "Personal trainer";
  const visibleClients = useMemo(() => clients, []);
  const selectedClient = visibleClients.find(client => client.name === selectedClientId) || visibleClients[0];

  if (showLogin) return <main className="professional-login">
    <section className="login-brand"><a className="logo-mark light" href="#/home">fortal<span>fy</span></a><div><span className="dash-eyebrow">FORTALFY PROFISSIONAIS</span><h1>Mais presença no cuidado. Mais clareza em cada jornada.</h1><p>Um espaço de trabalho feito para profissionais que acompanham pessoas de verdade.</p></div><small>Fortaleza · Aldeota</small></section>
    <section className="login-form-wrap"><div className="login-form"><a className="logo-mark" href="#/home">fortal<span>fy</span></a><span className="verified-label">ESPAÇO PROFISSIONAL</span><h2>{nutrition ? "Olá, Dra. Ana" : "Olá, Coach Pedro"}</h2><p>Conheça as ferramentas para acompanhar rotinas e organizar planos.</p><button type="button" className="button primary wide-button" onClick={() => setShowLogin(false)}>Conhecer o painel <ArrowUpRight size={17} /></button><small className="login-note">Esta visualização não exige conta e não acessa dados reais de clientes.</small><button type="button" className="text-button back-app" onClick={() => window.location.hash = "#/home"}>Voltar ao Fortalfy</button></div></section>
  </main>;

  return <div className="professional-app">
    <aside className="dash-sidebar">
      <a className="logo-mark" href="#/home">fortal<span>fy</span></a><span className="sidebar-caption">ESPAÇO PROFISSIONAL</span>
      <div className="sidebar-profile"><span className="coach-avatar"><img src={nutrition ? "./assets/stories/avatar-camila.jpg" : "./assets/stories/avatar-pedro.jpg"} alt="" /></span><div><strong>{title}</strong><small>{nutrition ? "Nutricionista" : "Personal trainer"}</small></div><span className="verify-dot"><Check size={11} /></span></div>
      <nav aria-label="Menu profissional">{sections.map(item => <button key={item.id} className={`dash-nav-item ${section === item.id ? "current" : ""}`} onClick={() => { setSection(item.id); setShowClientProfile(false); }}><item.icon size={18} />{item.label}</button>)}<Link to="/studio" className="dash-nav-item"><Sparkles size={18} />Studio criativo</Link></nav>
      <div className="sidebar-bottom"><button className="dash-nav-item" onClick={() => notify("A central de ajuda ainda não está conectada.")}><CircleHelp size={18} />Ajuda e suporte</button><button className="dash-nav-item" onClick={() => notify("As configurações ainda não estão disponíveis.")}><Settings size={18} />Configurações</button><div className="sidebar-location">Espaço profissional <span>Fortaleza, CE</span></div><button className="dash-nav-item" onClick={() => setShowLogin(true)}><LogOut size={18} />Sair do painel</button></div>
    </aside>
    <main className="dash-main">
      <header className="dash-topbar"><div><span className="crumb">Fortalfy <span>/</span> {sections.find(item => item.id === section)?.label || "Cliente"}</span></div><div className="topbar-actions"><button className="icon-button notification-button" aria-label="Notificações" onClick={() => notify("Notificações indisponíveis nesta visualização.")}><Bell size={19} /><i /></button><button className="topbar-user" onClick={() => setShowLogin(true)}><span className="coach-avatar small-avatar"><img src={nutrition ? "./assets/stories/avatar-camila.jpg" : "./assets/stories/avatar-pedro.jpg"} alt="" /></span><span>{title}<small>{subtitle}</small></span><ChevronDown size={15} /></button></div></header>
      <div className="dash-content">
        <div className="dashboard-note">Dados e atividades deste espaço são ilustrativos. Salvar não envia alterações nem notificações.</div>
        {showClientProfile ? <><button className="back-link" onClick={() => setShowClientProfile(false)}>← Voltar para clientes</button><ClientProfile client={selectedClient} nutrition={nutrition} notify={notify} /></> :
          section === "overview" ? <Overview nutrition={nutrition} notify={notify} setSection={setSection} /> :
          section === "clients" ? <><div className="dash-welcome"><div><span className="dash-eyebrow">ACOMPANHAMENTO</span><h1>Seus clientes</h1><p>Presença e constância fazem diferença todos os dias.</p></div><button className="button primary" onClick={() => notify("Convites para clientes ainda não estão disponíveis.")}><Plus size={18} /> Convidar cliente</button></div><div className="dash-metrics compact"><Metric label="Clientes ativos" value={visibleClients.length + 15} note="Acompanhamento personalizado" icon={Users} /><Metric label="Aderência média" value="87%" note="Últimos 30 dias" icon={Activity} tone="lime" /><Metric label="Avaliações próximas" value="4" note="Nos próximos 7 dias" icon={CalendarDays} tone="amber" /></div><ClientTable search={search} setSearch={setSearch} onSelect={client => { setSelectedClientId(client.name); setShowClientProfile(true); }} nutrition={nutrition} /></> :
          section === "routine" ? <><div className="dash-welcome"><div><span className="dash-eyebrow">{nutrition ? "NUTRIÇÃO PERSONALIZADA" : "TREINO PERSONALIZADO"}</span><h1>{nutrition ? "Plano alimentar" : "Rotina semanal"}</h1><p>Planeje, acompanhe e ajuste de acordo com a evolução.</p></div><select className="select-client" aria-label="Selecionar cliente" value={selectedClientId} onChange={event => setSelectedClientId(event.target.value)}>{visibleClients.map(client => <option key={client.name} value={client.name}>{client.name}</option>)}</select></div><WeeklyPlan nutrition={nutrition} notify={notify} /></> :
          section === "curation" ? <><div className="dash-welcome"><div><span className="dash-eyebrow">FORTALFY FOOD</span><h1>Food curado pela nutri</h1><p>Escolha opções compatíveis com o plano alimentar de {selectedClient.name}.</p></div><button className="button primary" onClick={() => notify("Curadoria salva nesta visualização.")}><Check size={18} /> Salvar curadoria</button></div><section className="dash-panel"><div className="dash-panel-head"><div><h2>Restaurantes e pratos</h2><p>Libere apenas as opções adequadas à rotina nutricional.</p></div><span className="verified-label"><Check size={14} /> 2 selecionadas</span></div><div className="curation-list">{restaurants.map(restaurant => <label className="curation-card" key={restaurant.name}><input type="checkbox" checked={restaurantSelection.has(restaurant.name)} onChange={() => setRestaurantSelection(current => { const next = new Set(current); next.has(restaurant.name) ? next.delete(restaurant.name) : next.add(restaurant.name); return next; })} /><img src={restaurant.image} alt="" /><div><strong>{restaurant.name}</strong><span>{restaurant.dish} · {restaurant.kcal} kcal</span><small>{restaurant.protein} g proteína · {restaurant.tag}</small><textarea placeholder="Observação para esta opção" aria-label={`Observação para ${restaurant.name}`} /></div><b className="approved-status">{restaurantSelection.has(restaurant.name) ? "Selecionada" : "Não selecionada"}</b></label>)}</div></section></> : null}
      </div>
    </main>
  </div>;
}
