import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import {
  Activity, Apple, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight,
  Bell, Bookmark, Check, ChevronDown, ChevronRight,
  CircleHelp, Clock3, Dumbbell, Flame, Heart, HeartPulse, Home, MapPin, MessageCircle,
  MoreHorizontal, Play, Plus, Search, Send, Share2, ShieldCheck,
  ShoppingBag, Sparkles, Star, Timer, Users, Utensils, Wallet, X,
} from "lucide-react";
import Dashboard from "./Dashboards.jsx";
import { courseList, gyms, profile, restaurants, workoutExercises } from "./data.js";

const primaryTabs = [
  { to: "/home", label: "Início", icon: Home },
  { to: "/feed", label: "Feed", icon: Users },
  { to: "/food", label: "Food", icon: Utensils },
  { to: "/pass", label: "Pass", icon: Wallet },
  { to: "/profile", label: "Perfil", icon: Activity },
];

function Brand({ light = false }) {
  return <span className={`logo-mark ${light ? "light" : ""}`}>fortal<span>fy</span></span>;
}

function Toast({ message, onClose }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(onClose, 3200);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);
  if (!message) return null;
  return <div className="toast-message" role="status"><Check size={17} />{message}<button aria-label="Fechar aviso" onClick={onClose}><X size={16} /></button></div>;
}

function Modal({ title, children, onClose }) {
  useEffect(() => {
    const closeOnEscape = event => event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  return <div className="modal-scrim" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="modal-card" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-header"><div><span className="eyebrow">FORTALFY</span><h2>{title}</h2></div><button className="icon-button" aria-label="Fechar janela" onClick={onClose}><X size={20} /></button></div>
      {children}
    </section>
  </div>;
}

function BottomNav() {
  const location = useLocation();
  const active = primaryTabs.find(tab => location.pathname === tab.to)?.to;
  if (location.pathname.startsWith("/trainer") || location.pathname.startsWith("/nutritionist")) return null;
  return <nav className="bottom-nav" aria-label="Navegação principal">{primaryTabs.map(({ to, label, icon: Icon }) =>
    <Link key={to} to={to} className={`bottom-nav-item ${active === to ? "active" : ""}`} aria-current={active === to ? "page" : undefined}>
      <Icon size={21} strokeWidth={active === to ? 2.5 : 1.8} /><span>{label}</span>
    </Link>)}</nav>;
}

function MobileHeader({ location = false, action }) {
  return <header className="mobile-header"><Link to="/home" aria-label="Fortalfy, página inicial"><Brand /></Link>
    {location && <button className="location-chip" onClick={action}><MapPin size={15} /><span>Aldeota, Fortaleza</span><ChevronDown size={14} /></button>}
    {!location && <button className="icon-button" aria-label="Notificações" onClick={action}><Bell size={20} /></button>}
  </header>;
}

function Screen({ children, title, subtitle, location = false, className = "", action }) {
  return <div className="app-screen">
    <MobileHeader location={location} action={action} />
    <main className={`screen-content ${className}`}>
      {title && <div className="screen-heading"><div>{subtitle && <span className="eyebrow">{subtitle}</span>}<h1>{title}</h1></div></div>}
      {children}
    </main>
    <BottomNav />
  </div>;
}

function SectionTitle({ title, action, to }) {
  return <div className="section-title-row"><h2>{title}</h2>{action && <Link to={to || "/pass"} className="text-link">{action}<ArrowRight size={15} /></Link>}</div>;
}

function PhotoCard({ image, alt, className = "" }) {
  return <img className={`photo-card ${className}`} src={image} alt={alt} loading="lazy" />;
}

function HomeScreen({ notify, activity, onActivity }) {
  const hydrationPercent = Math.min(100, Math.round(activity.waterMl / 2500 * 100));
  const score = Math.round((activity.trainingPercent + activity.nutritionPercent + hydrationPercent + activity.recoveryPercent) / 4);
  const scoreTone = score >= 80 ? "good" : score >= 60 ? "attention" : "review";
  const scoreMessage = score >= 80 ? "Tudo alinhado com a sua rotina" : score >= 60 ? "Atenção à hidratação e constância" : "Vale rever sua rotina com sua equipe";
  return <Screen className="home-screen">
    <section className="home-hero">
      <div className="home-hero-top"><span className="location-label"><MapPin size={14} /> Aldeota · Fortaleza</span><span className="status-live"><i /> EM MOVIMENTO</span></div>
      <div className="home-hello"><p>Bom dia, {profile.name} <span>☀️</span></p><h1>Seu bem-estar<br />começa com você.</h1><span className="hero-copy">Uma pequena escolha de cada vez.</span></div>
      <div className="hero-activity">
        <div className="activity-icon"><Dumbbell size={20} /></div>
        <div className="activity-text"><span>PARA A SUA ROTINA</span><strong>Treino de peito</strong><small>{activity.trainingPercent}% de constância registrada</small></div>
        <Link to="/workout" className="circle-arrow" aria-label="Abrir treino"><ArrowRight size={19} /></Link>
        <div className="activity-progress"><i style={{ width: `${activity.trainingPercent}%` }} /></div>
      </div>
    </section>
    <div className="screen-inner home-inner">
      <div className="quick-grid">
        <Link to="/workout" className="quick-tile"><span className="quick-icon mint"><Dumbbell size={19} /></span><strong>Treino do dia</strong><small>Peito · adapte ao seu ritmo</small><ArrowUpRight size={16} className="quick-arrow" /></Link>
        <button className="quick-tile" onClick={() => notify("Convites para família ainda não estão disponíveis.")}><span className="quick-icon pink"><Users size={19} /></span><strong>Rede de apoio</strong><small>Convide pessoas quando o recurso estiver disponível</small><ArrowUpRight size={16} className="quick-arrow" /></button>
        <Link to="/progress" className="quick-tile"><span className="quick-icon yellow"><Activity size={19} /></span><strong>Seu movimento</strong><small>Conecte um dispositivo para registrar passos e sono</small><ArrowUpRight size={16} className="quick-arrow" /></Link>
        <button className="quick-tile" onClick={() => { onActivity("water"); notify("Hidratação registrada. Mais um passo para sua meta."); }}><span className="quick-icon blue"><HeartPulseIcon /></span><strong>Um lembrete gentil</strong><small>Hidratação · {(activity.waterMl / 1000).toFixed(1).replace(".", ",")} L de 2,5 L</small><ArrowUpRight size={16} className="quick-arrow" /></button>
      </div>
      <section className="performance-card">
        <div className="section-title-row"><div><span className="eyebrow">SEU RITMO CONTA</span><h2>Uma semana de cada vez.</h2></div><span className={`score-mark ${scoreTone}`}>{score}<span>%</span></span></div>
        <div className="score-track" role="progressbar" aria-label="Pontuação de consistência da rotina" aria-valuemin="0" aria-valuemax="100" aria-valuenow={score}><i className={scoreTone} style={{ width: `${score}%` }} /></div>
        <div className="performance-stats"><span><strong>{Math.round(activity.trainingPercent / 5)} de 20</strong> treinos concluídos</span><span><strong>{Math.round(activity.nutritionPercent / 100 * 30)} de 30</strong> dias alinhados</span><span className={`score-state ${scoreTone}`}><i /> {scoreMessage}</span></div>
        <Link to="/progress" className="performance-link">Ver minha evolução <ArrowRight size={16} /></Link>
      </section>
      <p className="reference-disclosure">O score considera os registros desta tela e não substitui avaliação profissional.</p>
      <section className="gym-highlight">
        <div className="gym-highlight-img"><PhotoCard image={gyms[0].image} alt="Interior de um espaço de treino" /><span className="verified-pill"><MapPin size={15} /> Aldeota · Fortaleza</span></div>
        <div className="gym-highlight-copy"><span className="eyebrow">SUA COMUNIDADE TREINA PERTO</span><h2>Viva Fitness</h2><p>Um espaço para conhecer novas possibilidades de movimento.</p><small className="reference-disclosure">Parceiros, avaliações e ofertas oficiais serão exibidos após confirmação.</small><Link className="button light-button" to="/partner/gym">Explorar academia <ArrowRight size={16} /></Link></div>
      </section>
      <section className="quick-actions"><SectionTitle title="Seu próximo passo" /><div className="action-row"><button onClick={() => notify("Hidratação registrada: +250 ml. Bom trabalho.")}><span className="quick-icon blue"><Plus size={18} /></span>Registrar água</button><Link to="/workout"><span className="quick-icon mint"><Play size={18} /></span>Iniciar treino</Link><Link to="/nutrition"><span className="quick-icon yellow"><Apple size={18} /></span>Registrar refeição</Link></div></section>
    </div>
  </Screen>;
}

function HeartPulseIcon() { return <Activity size={19} />; }

function StoriesRow({ notify }) {
  return <div className="stories-row" aria-label="Stories da comunidade">
    <button className="story-item own-story" onClick={() => notify("Escolha uma foto ou vídeo para compartilhar seu momento.")}><span className="story-ring own"><span className="story-avatar">L</span><i><Plus size={13} /></i></span><span>Seu story</span></button>
    {["Studio Viva", "Mariana", "Coach Pedro", "Camila", "Viva Fit"].map((name, index) => <button className="story-item" key={name} onClick={() => notify(`Momentos recentes de ${name}.`)}><span className={`story-ring ring-${index}`}><span className="story-avatar">{name.split(" ").map(w => w[0]).join("").slice(0, 2)}</span></span><span>{name}</span></button>)}
  </div>;
}

function FeedScreen({ notify }) {
  const [liked, setLiked] = useState(false);
  const [following, setFollowing] = useState(false);
  const [filter, setFilter] = useState("Para você");
  return <Screen title="Stories" subtitle="MOMENTOS DA COMUNIDADE" className="feed-screen">
    <p className="screen-intro">Inspiração real, um treino de cada vez.</p>
    <StoriesRow notify={notify} />
    <div className="feed-filters">{["Para você", "Seguindo", "Perfis que sigo"].map(item => <button key={item} onClick={() => setFilter(item)} className={filter === item ? "selected" : ""}>{item}</button>)}</div>
    <button className="composer-card" onClick={() => notify("O espaço para sua próxima conquista está pronto.")}><span className="avatar">L</span><span>No que você está pensando?</span><Plus size={19} /></button>
    <article className="feed-post">
      <div className="post-head"><div className="avatar studio">SV</div><div className="post-author"><strong>Studio Viva</strong><span>Aldeota, Fortaleza · há 32 min</span></div><button className="icon-button" aria-label="Mais opções" onClick={() => notify("Opções da publicação.")}><MoreHorizontal size={20} /></button></div>
      <p className="post-copy">Sua próxima conquista começa com um treino. 💚</p>
      <div className="post-image"><PhotoCard image="./assets/pass-demo-gym-ironfit.jpg" alt="Espaço de treino funcional" /><span className="post-image-label">MOVIMENTO É PARA TODO MUNDO</span></div>
      <div className="post-caption">Treino funcional de força + mobilidade. <button className="inline-link" onClick={() => notify("Aula experimental adicionada à sua lista.")}>Agende sua aula experimental.</button></div>
      <div className="post-tags">#Fortalfy #TreinoComPropósito #Fortaleza</div>
      <div className="post-actions"><button onClick={() => setLiked(value => !value)} className={liked ? "liked" : ""}><Heart size={19} fill={liked ? "currentColor" : "none"} /> {liked ? 129 : 128}</button><button onClick={() => notify("Comentários da comunidade carregados.")}><MessageCircle size={19} /> 18</button><button onClick={() => notify("Link da publicação copiado.")}><Share2 size={19} /> Compartilhar</button><button aria-label="Salvar publicação" onClick={() => notify("Publicação salva nos seus favoritos.")}><Bookmark size={19} /></button></div>
    </article>
    <article className="feed-post second-post"><div className="post-head"><div className="avatar">MC</div><div className="post-author"><strong>Mariana Costa</strong><span>Hoje, 06:58 · Viva Fitness</span></div><button className="follow-link" onClick={() => setFollowing(value => !value)}>{following ? "Seguindo" : "Seguir"}</button></div><p className="post-copy">12 dias cuidando de mim. O melhor resultado é a energia que voltou. ✨</p><div className="streak-note"><Flame size={20} /> <strong>12 dias de constância</strong> <span>Uma rotina possível, no seu ritmo.</span></div><div className="post-actions"><button onClick={() => notify("Você curtiu a conquista da Mariana.")}><Heart size={19} /> 86</button><button onClick={() => notify("Comentários da comunidade carregados.")}><MessageCircle size={19} /> 12</button><button onClick={() => notify("Link da conquista copiado.")}><Share2 size={19} /></button><button aria-label="Salvar publicação"><Bookmark size={19} /></button></div></article>
  </Screen>;
}

function FoodScreen({ notify }) {
  const [category, setCategory] = useState("Tudo");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState({});
  const [menu, setMenu] = useState(null);
  const [showCart, setShowCart] = useState(false);
  const categories = ["Tudo", "Marmitas fitness", "Refeições saudáveis", "Proteínas"];
  const visible = useMemo(() => restaurants.filter((restaurant, index) => {
    const matchesSearch = `${restaurant.name} ${restaurant.dish}`.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "Tudo"
      || (category === "Marmitas fitness" && index < 2)
      || (category === "Refeições saudáveis" && index !== 0)
      || (category === "Proteínas" && restaurant.protein >= 35);
    return matchesSearch && matchesCategory;
  }), [category, search]);
  const totalCount = Object.values(cart).reduce((sum, count) => sum + count, 0);
  const addItem = name => setCart(current => ({ ...current, [name]: (current[name] || 0) + 1 }));
  return <Screen title="Food" subtitle="COMER BEM, DO SEU JEITO" location action={() => notify("Escolha um endereço para entrega.")} className="food-screen">
    <button className="delivery-card" onClick={() => notify("Endereço de entrega: Aldeota, Fortaleza.")}><span className="quick-icon blue"><MapPin size={18} /></span><span><small>ENTREGAR EM</small><strong>Aldeota, Fortaleza <ChevronDown size={14} /></strong></span><ChevronRight size={18} /></button>
    <p className="reference-disclosure">Cardápios, valores e disponibilidade devem ser confirmados com cada estabelecimento.</p>
    <label className="search-field"><Search size={19} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar restaurantes, pratos e refeições" aria-label="Buscar restaurantes, pratos e refeições" /><button aria-label="Limpar busca" onClick={() => setSearch("")}>{search && <X size={17} />}</button></label>
    <div className="chip-row">{categories.map(item => <button key={item} onClick={() => setCategory(item)} className={`filter-chip ${item === category ? "active" : ""}`}>{item}</button>)}</div>
    <section className="food-promo"><span className="eyebrow">BEM-ESTAR QUE CABE NO DIA</span><h2>Mais cor no seu prato.</h2><p>Escolhas gostosas, práticas e cheias de energia.</p><div className="promo-food-icons"><span>🥑</span><span>🥗</span><span>🥦</span></div></section>
    <SectionTitle title="Perto de você" action="Ver todos" />
    <div className="food-card-list">{visible.map((restaurant, index) => <article className="food-card" key={restaurant.name}>
      <div className="food-card-image"><PhotoCard image={restaurant.image} alt={restaurant.dish} /><span>{index === 0 ? "MAIS PEDIDO" : restaurant.tag.toUpperCase()}</span></div>
      <div className="food-card-body"><div className="food-card-heading"><div><h3>{restaurant.name}</h3><span>{restaurant.dish} · {restaurant.kcal} kcal</span></div></div>
        <p><Clock3 size={14} /> Tempo e preço a confirmar</p>
        <div className="nutrition-tags"><span>{restaurant.protein} g proteína</span><span>Preparado com cuidado</span></div>
        <button className="button primary wide-button" onClick={() => setMenu(restaurant)}>Ver cardápio <ArrowRight size={17} /></button>
      </div>
    </article>)}
    {!visible.length && <div className="empty-state"><Search size={24} /><h3>Não encontramos esse prato</h3><p>Tente buscar por outro restaurante ou refeição.</p><button className="button subtle" onClick={() => setSearch("")}>Limpar busca</button></div>}
    </div>
    <section className="food-daily"><div><span className="eyebrow">PARA A SUA ROTINA</span><h2>Seu diário alimentar acompanha você.</h2><p>Veja como suas escolhas se conectam às metas definidas com sua profissional.</p></div><Link to="/nutrition" className="button light-button">Abrir meu diário <ArrowRight size={16} /></Link></section>
    {totalCount > 0 && <div className="cart-toast"><ShoppingBag size={18} /><span>{totalCount} {totalCount === 1 ? "item" : "itens"} na sacola</span><button onClick={() => setShowCart(true)}>Ver sacola <ArrowRight size={16} /></button></div>}
    {menu && <Modal title={`Cardápio · ${menu.name}`} onClose={() => setMenu(null)}><div className="menu-item-modal"><PhotoCard image={menu.image} alt={menu.dish} /><div><span className="eyebrow">SUGESTÃO DO DIA</span><h3>{menu.dish}</h3><p>{menu.kcal} kcal · {menu.protein} g de proteína · {menu.tag}</p><strong>Preço a confirmar</strong></div></div><button className="button primary wide-button" onClick={() => { addItem(menu.name); notify(`${menu.dish} adicionado à sacola desta tela.`); setMenu(null); }}>Adicionar à sacola <Plus size={17} /></button></Modal>}
    {showCart && <Modal title="Sua sacola" onClose={() => setShowCart(false)}><div className="cart-modal-lines">{Object.entries(cart).map(([name, count]) => { const restaurant = restaurants.find(item => item.name === name); return <div className="cart-modal-line" key={name}><span>{count} × {restaurant.dish}<small>{restaurant.name}</small></span><strong>Valor a confirmar</strong></div>; })}</div><div className="cart-modal-total"><span>Disponibilidade e valores</span><strong>A confirmar</strong></div><button className="button primary wide-button" onClick={() => { setCart({}); setShowCart(false); notify("Itens organizados nesta tela. Nenhum pedido foi enviado ou cobrado."); }}>Concluir nesta tela <ArrowRight size={17} /></button><p className="simulation-note">Os itens não são enviados a restaurantes e nenhuma cobrança é realizada.</p></Modal>}
  </Screen>;
}

function PassScreen() {
  const [showPlan, setShowPlan] = useState(false);
  const [planConfirmed, setPlanConfirmed] = useState(false);
  return <Screen title="Seu treino, mais perto de você." subtitle="FORTALFY PASS" location className="pass-screen">
    <div className="pass-hero"><PhotoCard image="./assets/pass-hero-gym.jpg" alt="Academia iluminada, pronta para o seu treino" /><div className="pass-hero-overlay"><span>ALDEOTA · FORTALEZA</span><h2>Movimento que<br />combina com você.</h2><p>Encontre academias e aulas pertinho de casa.</p><Link to="/partner/gym" className="button lime-button">Explorar academias <ArrowRight size={16} /></Link></div></div>
    <div className="pass-intro"><span className="verified-pill"><ShieldCheck size={15} /> Seu cuidado em boa companhia</span><p>Experiências e profissionais para acompanhar sua rotina — no seu ritmo.</p></div>
    <SectionTitle title="Academias por perto" action="Ver mapa" to="/partner/gym" />
    <div className="gym-cards">{gyms.map((gym, index) => <GymCard gym={gym} key={gym.name} index={index} />)}</div>
    <p className="reference-disclosure">Espaços, avaliações, selos e valores só serão oficiais após confirmação dos parceiros.</p>
    <section className="professional-care"><div><span className="eyebrow">CUIDADO PROFISSIONAL</span><h2>Gente boa ao seu lado.</h2><p>Acompanhamento próximo para tornar sua rotina mais leve.</p></div>
      <div className="pro-card-list"><Link to="/trainer" className="pro-card"><span className="pro-avatar trainer-avatar">CP</span><div><span>PERSONAL TRAINER</span><strong>Coach Pedro</strong><small>Treino e movimento · conhecer painel</small></div><ArrowRight size={18} /></Link><Link to="/nutritionist" className="pro-card"><span className="pro-avatar nutrition-avatar">DA</span><div><span>NUTRICIONISTA</span><strong>Dra. Ana</strong><small>Orientação alimentar · conhecer painel</small></div><ArrowRight size={18} /></Link></div>
      <p className="reference-disclosure">Perfis e credenciais apresentados não representam profissionais validados pela equipe.</p>
    </section>
    <section className="pass-plan"><div><span className="eyebrow">FORTALFY PASS</span><h2>Mais espaços para<br />o seu movimento.</h2><p>Descubra novas possibilidades para cuidar de você.</p><ul><li><Check size={16} /> Espaços e aulas para descobrir</li><li><Check size={16} /> Modalidades para diferentes rotinas</li><li><Check size={16} /> Novas opções em breve</li></ul></div><div className="pass-price-card"><span>PLANOS E VALORES</span><strong>Em breve</strong><small>Consulte as condições quando os parceiros estiverem conectados.</small><button className="button lime-button wide-button" onClick={() => setShowPlan(true)}>{planConfirmed ? "Interesse anotado" : "Conhecer o Pass"} <ArrowRight size={16} /></button><small>Esta ação não cria assinatura nem realiza pagamento.</small></div></section>
    {showPlan && <Modal title="Conheça o Fortalfy Pass" onClose={() => setShowPlan(false)}><div className="plan-confirmation"><span className="quick-icon mint"><ShieldCheck size={21} /></span><h3>Descubra novos espaços e modalidades</h3><p>Planos, preços e contratações estarão disponíveis quando os parceiros estiverem confirmados. Esta ação não cria assinatura.</p></div><button className="button primary wide-button" onClick={() => { setPlanConfirmed(true); setShowPlan(false); window.dispatchEvent(new CustomEvent("fortalfy-toast", { detail: "Informações do Pass salvas nesta visualização. Nenhuma cobrança foi realizada." })); }}>Entendi <Check size={17} /></button></Modal>}
  </Screen>;
}

function GymCard({ gym, index }) {
  return <article className="gym-card"><Link to="/partner/gym" className="gym-card-image"><PhotoCard image={gym.image} alt={`Espaço de treino em Fortaleza`} /><span>{index === 0 ? "PERTO DE VOCÊ" : "AULAS E MOVIMENTO"}</span><button aria-label={`Abrir ${gym.name}`}><ArrowUpRight size={16} /></button></Link><div className="gym-card-body"><div className="gym-card-title"><h3>{gym.name}</h3><span className="rating"><MapPin size={14} /> Aldeota</span></div><p>Horários e disponibilidade a confirmar</p><div className="gym-tags">{gym.tags.slice(0, 2).map(tag => <span key={tag}>{tag}</span>)}</div><span className="gym-price">Valores sob consulta</span></div></article>;
}

function ProfileScreen({ notify }) {
  const [tab, setTab] = useState("Publicações");
  return <Screen title="Meu perfil" subtitle="SUA JORNADA, SUAS CONQUISTAS" className="profile-screen">
    <section className="founder-banner"><div className="founder-portrait"><img src="./assets/fortalfy-pedro-founder.svg" alt="Ilustração original da Fortalfy" /></div><div><span>FORTALFY · FEITO EM FORTALEZA</span><h2>Fortalfy</h2><p>Bem-estar no seu ritmo.</p></div><span className="founder-tag">Uma rotina mais leve começa com o que é possível hoje.</span></section>
    <section className="profile-card"><div className="profile-avatar">L</div><div className="profile-main"><div className="profile-name-row"><div><h2>Leblonjr</h2><span>@Leblonjr · Fortaleza</span></div><button className="button subtle small-button" onClick={() => notify("A edição do perfil ainda não está disponível.")}>Editar perfil</button></div><p>Fitness · Saúde · Evolução. Construindo uma rotina mais leve, um dia de cada vez. 💚</p><div className="profile-stats"><span><strong>12</strong> dias de constância</span><span><strong>17</strong> treinos no mês</span><span><strong>21</strong> dias alinhados</span></div></div></section>
    <div className="profile-tabs">{["Publicações", "Compartilhados", "Fotos"].map(label => <button key={label} onClick={() => setTab(label)} className={tab === label ? "active" : ""}>{label}</button>)}</div>
    <div className="profile-empty"><span className="empty-icon"><Sparkles size={24} /></span><h3>Sua próxima conquista merece ser compartilhada.</h3><p>Quando publicar, seus momentos de evolução vão aparecer por aqui.</p><Link to="/feed" className="button primary">Ir para o Feed <ArrowRight size={16} /></Link></div>
    <div className="professional-entry"><div><span className="eyebrow">É PROFISSIONAL DE BEM-ESTAR?</span><h3>Seu trabalho merece ser visto.</h3><p>Conheça o espaço profissional Fortalfy.</p></div><div><Link to="/trainer" className="button subtle small-button">Coach Pedro</Link><Link to="/nutritionist" className="button primary small-button">Dra. Ana</Link></div></div>
  </Screen>;
}

function WorkoutScreen({ notify, onActivity }) {
  const [done, setDone] = useState([]);
  const [restLeft, setRestLeft] = useState(0);
  const [completed, setCompleted] = useState(false);
  const toggle = name => setDone(current => current.includes(name) ? current.filter(item => item !== name) : [...current, name]);
  useEffect(() => {
    if (restLeft <= 0) return undefined;
    const timer = window.setTimeout(() => setRestLeft(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [restLeft]);
  return <Screen title="Treino do Dia" subtitle="PEITO COM COACH PEDRO" className="workout-screen">
    <Link to="/home" className="back-link"><ArrowLeft size={17} /> Voltar</Link>
    <div className="workout-stats"><div><HeartPulse size={18} /><span><strong>—</strong> bpm</span></div><div><Activity size={18} /><span><strong>—</strong> passos</span></div><div><Timer size={18} /><span><strong>18</strong> min planejados</span></div></div>
    <p className="reference-disclosure">Frequência cardíaca e passos só aparecem após conectar uma fonte de dados compatível.</p>
    <section className="workout-progress-card"><div><span className="eyebrow">BOM TE VER EM MOVIMENTO</span><h2>Seu treino está fluindo.</h2><p>{done.length} de {workoutExercises.length} exercícios concluídos</p></div><strong>{Math.round(done.length / workoutExercises.length * 100)}<small>%</small></strong><div className="score-track"><i style={{ width: `${done.length / workoutExercises.length * 100}%` }} /></div></section>
    <SectionTitle title="Sua sequência de hoje" />
    <div className="exercise-list">{workoutExercises.map((item, index) => <article className={`exercise-card ${done.includes(item.name) ? "exercise-done" : ""}`} key={item.name}><button className="exercise-check" aria-label={`${done.includes(item.name) ? "Desmarcar" : "Concluir"} ${item.name}`} onClick={() => toggle(item.name)}>{done.includes(item.name) && <Check size={17} />}</button><span className="exercise-thumb"><Dumbbell size={22} /></span><div className="exercise-details"><span>EXERCÍCIO {String(index + 1).padStart(2, "0")}</span><h3>{item.name}</h3><p>{item.details} · {item.load}</p><label className="exercise-note">Anotação rápida<input placeholder="Carga ou observação" aria-label={`Anotação: ${item.name}`} /></label></div><button className="play-button" aria-label={`Ver vídeo de ${item.name}`} onClick={() => notify(`Vídeo de orientação: ${item.name}.`)}><Play size={17} /></button></article>)}</div>
    <div className="workout-actions"><button className="button subtle wide-button" onClick={() => setRestLeft(60)}><Timer size={17} /> {restLeft > 0 ? `Descanso · ${restLeft} s` : "Iniciar descanso · 60 s"}</button><button className="button primary wide-button" onClick={() => { if (!completed) onActivity("workout"); setCompleted(true); notify("Treino registrado nesta visualização."); }}>Finalizar treino <ArrowRight size={17} /></button></div>
    {completed && <div className="success-banner"><span><Check size={20} /></span><div><strong>Treino concluído. Você apareceu por você.</strong><small>18 min · Seu progresso foi atualizado nesta tela.</small></div><button aria-label="Fechar confirmação" onClick={() => setCompleted(false)}><X size={17} /></button></div>}
  </Screen>;
}

function NutritionScreen({ notify, onActivity, activity }) {
  const [logged, setLogged] = useState(0);
  const calories = 1700 + (activity.mealsLogged + logged) * 120;
  const caloriePercent = Math.min(100, Math.round(calories / 2100 * 100));
  const today = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const meals = [["Café da manhã", "320 kcal", "Concluído"], ["Almoço", "780 kcal", "Concluído"], ["Lanche", "250 kcal", "Registrado"], ["Jantar", "Pendente", "Planejado"], ...Array.from({ length: logged }, (_, index) => [`Refeição registrada ${index + 1}`, "120 kcal", "Registrado"])];
  return <Screen title="Nutrição Hoje" subtitle={`${today.toLocaleUpperCase()} · SUA ROTINA`} className="nutrition-screen">
    <div className="nutrition-summary"><div className="nutrition-donut" style={{ background: `conic-gradient(#497e52 0 35%, #bada81 35% 75%, #ecd990 75% 100%)` }}><div><strong>{calories.toLocaleString("pt-BR")}</strong><span>de 2.100 kcal</span><small>{caloriePercent}% da meta</small></div></div><div className="macro-details"><span className="eyebrow">SEU EQUILÍBRIO HOJE</span>{[["Proteína", "183 g", "35%", "protein"], ["Carboidrato", "210 g", "40%", "carb"], ["Gordura", "58 g", "25%", "fat"]].map(row => <div className="macro-row" key={row[0]}><i className={row[3]} /><span>{row[0]}</span><strong>{row[1]}</strong><small>{row[2]}</small></div>)}<Link to="/progress" className="text-link">Ver metas e evolução <ArrowRight size={15} /></Link></div></div>
    <div className="nutrition-note"><span className="quick-icon mint"><Sparkles size={18} /></span><span><strong>Consistência, não perfeição.</strong><small>Você segue construindo um ritmo que funciona para a sua vida.</small></span></div>
    <SectionTitle title="Seu diário" />
    <div className="meal-list">{meals.map((meal, index) => <div className="meal-row" key={meal[0]}><span className={`meal-icon meal-${index}`}>{["☀", "◒", "✳", "☾"][index]}</span><div><strong>{meal[0]}</strong><small>{meal[1]} · {meal[2]}</small></div>{index < 3 && <Check size={18} className="meal-check" />}</div>)}</div>
    <Link to="/curated" className="nutrition-curation"><span className="nutritionist-avatar">DA</span><span><small>FOOD CURADO</small><strong>Veja opções de referência para sua rotina.</strong><small>Planos reais exigem acompanhamento profissional.</small></span><ArrowRight size={18} /></Link>
    <button className="button primary wide-button mt-5" onClick={() => { setLogged(count => count + 1); onActivity("meal"); notify("Refeição registrada no diário. Seus totais foram atualizados."); }}><Plus size={18} /> Registrar refeição</button>
    {logged.length > 0 && <p className="sr-only" aria-live="polite">{logged.length} refeição registrada.</p>}
  </Screen>;
}

function CuratedScreen({ notify }) {
  const [ordered, setOrdered] = useState([]);
  return <Screen title="Food curado pela sua Nutri" subtitle="SUAS OPÇÕES, COM INTENÇÃO" className="curated-screen">
    <div className="curator-card"><span className="nutritionist-avatar">DA</span><div><strong>Dra. Ana</strong><small>Nutricionista · perfil de apresentação</small></div><span className="protein-badge">35% proteína</span></div>
    <p className="screen-intro">Opções de apresentação. Planos alimentares reais dependem de avaliação e acompanhamento profissional.</p>
    <div className="curated-list">{restaurants.map(restaurant => <article className="curated-card" key={restaurant.name}><PhotoCard image={restaurant.image} alt={restaurant.dish} /><div className="curated-card-body"><span className="approved-pill"><ShieldCheck size={14} /> Opção de referência</span><h3>{restaurant.name}</h3><p>{restaurant.dish} · {restaurant.kcal} kcal</p><div className="macro-chip-row"><span>{restaurant.protein} g proteína</span><span>{restaurant.tag}</span></div><div className="curated-price"><strong>Preço a confirmar</strong><button className="button lime-button small-button" onClick={() => { setOrdered(current => [...current, restaurant.name]); notify("Opção salva nesta tela. Nenhum pedido foi feito."); }}>{ordered.includes(restaurant.name) ? <><Check size={15} /> Salvo</> : <>Salvar opção <ArrowRight size={15} /></>}</button></div></div></article>)}</div>
    <div className="simulation-note"><CircleHelp size={16} /><span>Ao escolher uma opção, ela é registrada no seu diário. Esta experiência não realiza cobrança.</span></div>
  </Screen>;
}

function ProgressScreen({ notify, activity }) {
  return <Screen title="Minha Evolução" subtitle="PEQUENOS PASSOS, GRANDES MUDANÇAS" className="progress-screen">
    <p className="reference-disclosure">As medições exibidas são exemplos de apresentação. Registre dados pessoais para acompanhar sua evolução.</p>
    <div className="progress-filter"><span>Seu acompanhamento</span><button onClick={() => notify("Período selecionado: últimos 30 dias.")}>Últimos 30 dias <ChevronDown size={15} /></button></div>
    <section className="weight-card"><div><span className="eyebrow">PESO ACOMPANHADO</span><div className="weight-values"><strong>80<small> kg</small></strong><span className="weight-change"><ArrowDownRight size={17} /> 4 kg em 30 dias</span></div><p>Uma trajetória consistente, construída dia após dia.</p></div><svg className="weight-chart" viewBox="0 0 320 120" role="img" aria-label="Gráfico de evolução de 84 para 80 quilos"><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#BFFF00" stopOpacity=".3" /><stop offset="100%" stopColor="#BFFF00" stopOpacity="0" /></linearGradient></defs><path d="M0 20 C34 26 45 35 72 40 S113 44 143 57 S180 63 205 77 S250 80 276 94 S304 97 320 105 V120 H0 Z" fill="url(#chartFill)" /><path d="M0 20 C34 26 45 35 72 40 S113 44 143 57 S180 63 205 77 S250 80 276 94 S304 97 320 105" fill="none" stroke="#BFFF00" strokeWidth="4" strokeLinecap="round" /></svg><div className="chart-labels"><span>30 dias atrás · 84 kg</span><span>Hoje · 80 kg</span></div></section>
    <div className="measurement-grid"><div className="measurement-card"><span>Peito</span><strong>102 cm</strong><small>−2 cm no período</small></div><div className="measurement-card"><span>Cintura</span><strong>88 cm</strong><small>−4 cm no período</small></div></div>
    <div className="streak-card"><span className="streak-icon"><Flame size={22} /></span><div><span>SEU MELHOR RITMO</span><strong>12 dias seguidos</strong><small>Um passo de cada vez já é evolução.</small></div><span className="streak-rank">TOP 5%<small>Aldeota</small></span></div>
    <SectionTitle title="Seu cuidado em números" />
    <div className="adherence-card"><div><span><Dumbbell size={17} /> Treinos</span><strong>{Math.round(activity.trainingPercent / 5)} / 20 <small>{activity.trainingPercent}%</small></strong><i><b style={{ width: `${activity.trainingPercent}%` }} /></i></div><div><span><Apple size={17} /> Alimentação</span><strong>{Math.round(activity.nutritionPercent / 100 * 30)} / 30 dias <small>{activity.nutritionPercent}%</small></strong><i><b style={{ width: `${activity.nutritionPercent}%` }} /></i></div></div>
    <button className="button primary wide-button mt-5" onClick={() => notify("Seu resumo de evolução está pronto para compartilhar.")}><Share2 size={17} /> Compartilhar evolução</button>
  </Screen>;
}

function AcademyScreen() {
  const [tab, setTab] = useState("Todos");
  const [course, setCourse] = useState(null);
  const visibleCourses = courseList.filter(item => tab === "Todos" || item.category === tab);
  return <Screen title="Fortalfy Academy" subtitle="CURSOS ONLINE" className="academy-screen">
    <div className="academy-banner"><span className="academy-cap">✳</span><span className="eyebrow">APRENDA NO SEU RITMO</span><h2>Conhecimento que<br />acompanha sua jornada.</h2><p>Conteúdos para apoiar sua rotina e seu bem-estar.</p><div className="academy-proof"><span><Sparkles size={14} /> Novos conteúdos em preparação</span></div></div>
    <p className="reference-disclosure">Cursos, professores, avaliações e valores serão confirmados antes da abertura das inscrições.</p>
    <div className="chip-row academy-tabs">{["Todos", "Treino", "Nutrição", "Rotina"].map(item => <button key={item} className={`filter-chip ${tab === item ? "active" : ""}`} onClick={() => setTab(item)}>{item}</button>)}</div>
    <section className="featured-course"><span className="eyebrow">CONTEÚDO EM PREPARAÇÃO</span><h2>Como Criar um Ciclo<br />de Treino Perfeito</h2><p>Orientações para organizar sua rotina de movimento.</p><div className="course-bottom"><strong>Em breve</strong><button className="button lime-button" onClick={() => setCourse({ title: "Como Criar um Ciclo de Treino Perfeito", lessons: "Conteúdo em preparação", price: "" })}>Ver detalhes <ArrowRight size={16} /></button></div></section>
    <div className="section-title-row"><h2>Continue aprendendo</h2><button className="text-link" onClick={() => notify("Seu certificado ficará disponível ao concluir um curso.")}>Meus certificados <ArrowRight size={15} /></button></div>
    <div className="academy-course-list">{visibleCourses.map(item => <article className="academy-course-card" key={item.title}><PhotoCard image={item.image} alt="" /><div><span className="eyebrow">FORTALFY ACADEMY</span><h3>{item.title}</h3><p>{item.subtitle}</p><small>Conteúdo em preparação</small><div><strong>Em breve</strong><button className="text-link" onClick={() => setCourse(item)}>Ver detalhes <ArrowRight size={15} /></button></div></div></article>)}</div>
    {course && <Modal title={course.title} onClose={() => setCourse(null)}><div className="course-player"><Play size={34} /><span>CONTEÚDO EM PREPARAÇÃO</span></div><p className="modal-description">A programação, os professores e os valores serão divulgados quando os cursos estiverem disponíveis.</p><button className="button primary wide-button" onClick={() => setCourse(null)}>Entendi</button></Modal>}
  </Screen>;
}

function LiveScreen({ notify }) {
  const [joined, setJoined] = useState(false);
  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState([["João", "Como contar proteína no dia a dia?"], ["Mariana", "Quantas refeições devo fazer?"], ["Camila", "Adorei essa dica! 💚"]]);
  const sendMessage = event => {
    event.preventDefault();
    if (!message.trim()) return;
    if (!joined) {
      notify("Entre na live para participar da conversa.");
      return;
    }
    setChatMessages(current => [...current, ["Você", message.trim()]]);
    setMessage("");
  };
  return <Screen className="live-screen">
    <div className="live-header"><Link to="/home" aria-label="Voltar para início"><Brand light /></Link><span>FORTALFY LIVE</span><span className="live-now-badge">EM BREVE</span></div>
    <main className="live-content">
      <div className="live-eyebrow"><Sparkles size={14} /> PROGRAMAÇÃO DE BEM-ESTAR</div>
      <div className="live-visual"><PhotoCard image="./assets/pass-demo-gym-nextfit.jpg" alt="Imagem de referência de uma aula de movimento" /><div className="live-visual-overlay"><span>FORTALFY LIVE</span><h1>Uma rotina melhor começa com o que é possível hoje.</h1><span className="live-teacher"><span className="nutritionist-avatar">DA</span> Profissional convidada</span></div><span className="viewer-count"><Sparkles size={15} /> Aula em preparação</span></div>
      <p className="reference-disclosure">A transmissão, a programação e os profissionais serão confirmados antes da abertura das aulas.</p>
      <div className="live-title-row"><div><span className="eyebrow">SAÚDE E ROTINA</span><h2>Como construir uma rotina mais leve</h2><p>Conteúdo em preparação · sem cobrança.</p></div></div>
      <section className="live-chat"><div className="section-title-row"><h3>Conversa da aula</h3><span>Prévia nesta tela</span></div>{chatMessages.slice(-4).map((msg, index) => <div className="chat-message" key={`${msg[0]}-${index}`}><span className="chat-avatar">{msg[0][0]}</span><p><strong>{msg[0]}</strong>{msg[1]}</p></div>)}<form className="chat-input" onSubmit={sendMessage}><input value={message} onChange={event => setMessage(event.target.value)} placeholder="Enviar mensagem" aria-label="Mensagem para a live" /><button type="submit" aria-label="Enviar mensagem"><Send size={16} /></button></form><small className="live-chat-note">As mensagens ficam nesta tela e não são enviadas a outras pessoas.</small></section>
      <button className="button lime-button wide-button live-join" onClick={() => { setJoined(true); notify("Sua participação foi anotada nesta tela. Nenhuma cobrança foi realizada."); }}>{joined ? <><Check size={18} /> Interesse anotado</> : <>Quero saber mais <ArrowRight size={18} /></>}</button>
      <section className="upcoming-lives"><SectionTitle title="Próximas lives" /><div className="upcoming-live"><span className="live-calendar"><Sparkles size={16} /></span><div><strong>Novos encontros em breve</strong><small>Programação e horários serão divulgados aqui.</small></div></div></section>
    </main>
    <BottomNav />
  </Screen>;
}

function PartnerScreen({ notify }) {
  const gym = gyms[0];
  const [tab, setTab] = useState("Visão geral");
  return <Screen title={gym.name} subtitle="DETALHES DO ESPAÇO" className="partner-screen">
    <Link to="/pass" className="back-link"><ArrowLeft size={17} /> Voltar ao Pass</Link>
    <div className="partner-gallery"><PhotoCard image={gym.image} alt="Espaço de treino em Fortaleza" /><div><PhotoCard image="./assets/pass-demo-gym-nextfit.jpg" alt="Área de treino" /><PhotoCard image="./assets/pass-strength-space.svg" alt="Equipamentos de musculação" /></div><span className="verified-pill"><MapPin size={16} /> INFORMAÇÕES A CONFIRMAR</span></div>
    <section className="partner-summary"><div><span className="verified-pill"><ShieldCheck size={15} /> Detalhes em atualização</span><h2>{gym.name}</h2><p>Consulte endereço, horários e disponibilidade diretamente com o estabelecimento.</p></div><button className="button primary" onClick={() => notify("Este espaço ainda não recebe solicitações pelo Fortalfy.")}>Ver disponibilidade <ArrowRight size={16} /></button></section>
    <div className="partner-tabs">{["Visão geral", "Modalidades", "Avaliações"].map(item => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</div>
    <div className="partner-info-grid"><section className="dash-panel"><h3>{tab === "Avaliações" ? "Opiniões da comunidade" : tab === "Modalidades" ? "Encontre seu movimento" : "Sobre o espaço"}</h3><p>{tab === "Avaliações" ? "As avaliações serão exibidas quando estiverem disponíveis e validadas." : tab === "Modalidades" ? "Modalidades, equipe e estrutura serão confirmadas diretamente com o estabelecimento." : "Este perfil será atualizado quando os dados do estabelecimento forem confirmados."}</p><div className="gym-tags">{gym.tags.map(tag => <span key={tag}>{tag}</span>)}</div></section><section className="dash-panel"><h3>Informações</h3><div className="partner-detail-line"><MapPin size={17} /><span><strong>Fortaleza · Ceará</strong><small>Endereço a confirmar</small></span></div><div className="partner-detail-line"><Clock3 size={17} /><span><strong>Horários a confirmar</strong><small>Consulte o estabelecimento</small></span></div><div className="partner-detail-line"><Wallet size={17} /><span><strong>Valores sob consulta</strong><small>Planos e condições ainda não disponíveis</small></span></div></section></div>
    <section className="partner-cta"><div><span className="eyebrow">SEU PRÓXIMO PASSO</span><h2>Quer conhecer de perto?</h2><p>O contato ficará disponível após a confirmação do estabelecimento.</p></div><button className="button lime-button" onClick={() => notify("Nenhuma solicitação foi enviada. O contato estará disponível quando o espaço estiver conectado.")}>Contato em breve <ArrowRight size={17} /></button></section>
  </Screen>;
}

function AppContent() {
  const [toast, setToast] = useState("");
  const [activity, setActivity] = useState({ trainingPercent: 85, nutritionPercent: 70, waterMl: 1200, recoveryPercent: 80, mealsLogged: 0 });
  const location = useLocation();
  const notify = message => setToast(message);
  const updateActivity = kind => setActivity(current => {
    if (kind === "water") return { ...current, waterMl: Math.min(2500, current.waterMl + 250) };
    if (kind === "workout") return { ...current, trainingPercent: Math.min(100, current.trainingPercent + 5) };
    if (kind === "meal") return { ...current, nutritionPercent: Math.min(100, current.nutritionPercent + 5), mealsLogged: current.mealsLogged + 1 };
    return current;
  });
  useEffect(() => {
    const listener = event => setToast(event.detail);
    window.addEventListener("fortalfy-toast", listener);
    return () => window.removeEventListener("fortalfy-toast", listener);
  }, []);
  const mobilePaths = ["/home", "/feed", "/food", "/pass", "/profile", "/workout", "/nutrition", "/curated", "/progress", "/academy", "/live", "/partner/gym"];
  const mobile = mobilePaths.includes(location.pathname);
  return <div className={mobile ? "mobile-app" : "professional-root"}>
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/home" element={<HomeScreen notify={notify} activity={activity} onActivity={updateActivity} />} />
      <Route path="/feed" element={<FeedScreen notify={notify} />} />
      <Route path="/food" element={<FoodScreen notify={notify} />} />
      <Route path="/pass" element={<PassScreen />} />
      <Route path="/profile" element={<ProfileScreen notify={notify} />} />
      <Route path="/workout" element={<WorkoutScreen notify={notify} onActivity={updateActivity} />} />
      <Route path="/nutrition" element={<NutritionScreen notify={notify} onActivity={updateActivity} activity={activity} />} />
      <Route path="/curated" element={<CuratedScreen notify={notify} />} />
      <Route path="/progress" element={<ProgressScreen notify={notify} activity={activity} />} />
      <Route path="/academy" element={<AcademyScreen />} />
      <Route path="/live" element={<LiveScreen notify={notify} />} />
      <Route path="/partner/:type" element={<PartnerScreen notify={notify} />} />
      <Route path="/trainer" element={<Dashboard key="trainer" role="trainer" notify={notify} />} />
      <Route path="/nutritionist" element={<Dashboard key="nutritionist" role="nutritionist" notify={notify} />} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
    <Toast message={toast} onClose={() => setToast("")} />
  </div>;
}

export default function App() {
  return <AppContent />;
}
