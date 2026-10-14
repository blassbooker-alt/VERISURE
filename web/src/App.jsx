import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useSearchParams } from "react-router-dom";
import {
  Activity, Apple, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Camera,
  Bell, Bookmark, Check, ChevronDown, ChevronRight,
  CircleHelp, Clock3, Dumbbell, Flame, Heart, HeartPulse, Home, MapPin, MessageCircle,
  ImagePlus, MoreHorizontal, PencilLine, Play, Plus, Search, Send, Share2, ShieldCheck,
  ShoppingBag, Sparkles, Star, Target, Timer, Trash2, Users, Utensils, Wallet, X,
} from "lucide-react";
import Dashboard from "./Dashboards.jsx";
import BottomNav from "./MobileNavigation.jsx";
import FortalShop from "./FortalShop.jsx";
import FortalfyStudio from "./FortalfyStudio.jsx";
import { shopProducts } from "./shopData.js";
import { courseList, gyms, profile, restaurants, workoutExercises } from "./data.js";

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
      <Link to="/shop" className="home-shop-feature"><div><span className="eyebrow">FORTALFY SHOP · NOVA COLEÇÃO</span><h2>Feito para o seu ritmo.</h2><p>Conheça ideias para acompanhar sua rotina.</p><span className="home-shop-link">Explorar a loja <ArrowRight size={15} /></span></div><div className="home-shop-products" aria-hidden="true"><img src={shopProducts[1].image} alt="" loading="lazy" /><img src={shopProducts[0].image} alt="" loading="lazy" /></div><span className="home-shop-icon"><ShoppingBag size={17} /></span></Link>
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

function FeedScreen({ notify, feedArts, profileDetails, profilePosts }) {
  const [liked, setLiked] = useState(false);
  const [following, setFollowing] = useState(false);
  const [filter, setFilter] = useState("Para você");
  return <Screen title="Stories" subtitle="MOMENTOS DA COMUNIDADE" className="feed-screen">
    <p className="screen-intro">Inspiração real, um treino de cada vez.</p>
    <StoriesRow notify={notify} />
    <div className="feed-filters">{["Para você", "Seguindo", "Perfis que sigo"].map(item => <button key={item} onClick={() => setFilter(item)} className={filter === item ? "selected" : ""}>{item}</button>)}</div>
    <Link className="composer-card" to="/profile?compose=1"><span className="avatar">{profileDetails.name.slice(0, 1).toUpperCase()}</span><span>No que você está pensando?</span><Plus size={19} /></Link>
    {profilePosts.map(post => <article className="feed-post profile-feed-post" key={post.id}>
      <div className="post-head"><div className="avatar">{profileDetails.avatar ? <img src={profileDetails.avatar} alt="" /> : profileDetails.name.slice(0, 1).toUpperCase()}</div><div className="post-author"><strong>{profileDetails.name}</strong><span>Publicação neste aparelho · {new Date(post.createdAt).toLocaleDateString("pt-BR")}</span></div><span className="created-art-label">LOCAL</span></div>
      <p className="post-copy">{post.text}</p>{post.image && <button className="profile-feed-image" onClick={() => notify("Foto da sua publicação.")}><img src={post.image} alt={post.imageAlt || "Foto adicionada à publicação"} loading="lazy" /></button>}
      <div className="profile-feed-disclosure">Visível somente neste navegador. Não foi enviado a um servidor ou à comunidade.</div>
    </article>)}
    {feedArts.map(art => <article className="feed-post created-art-post" key={art.id}>
      <div className="post-head"><div className="avatar"><Sparkles size={17} /></div><div className="post-author"><strong>Uma criação sua</strong><span>Arte local · desta sessão</span></div><span className="created-art-label">PRÉVIA</span></div>
      <p className="post-copy">{art.title}</p><div className="created-art-image"><img src={art.dataUrl} alt={`Arte criada no Fortalfy Studio: ${art.title}`} /></div>
      <div className="post-caption">{art.subtitle} <span>Compartilhamento simulado nesta sessão.</span></div>
    </article>)}
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

const PROFILE_STORAGE_KEY = "fortalfy.profile.local.v1";
const PROFILE_POSTS_STORAGE_KEY = "fortalfy.profile.posts.local.v1";
const makeDefaultProfile = () => ({
  name: profile.name,
  username: profile.handle.replace(/^@/, "").toLowerCase(),
  bio: "",
  goal: "",
  activity: "",
  city: profile.city,
  showCity: false,
  avatar: "",
  cover: "",
});

function loadLocalValue(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.error(`Não foi possível carregar os dados locais de ${key}.`, error);
    return fallback;
  }
}

function compressProfileImage(file, maximumBytes = 650000) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Selecione um arquivo de imagem válido."));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error("A imagem deve ter no máximo 8 MB."));
      return;
    }
    const source = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(source);
      const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Este navegador não conseguiu processar a imagem."));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      let quality = 0.82;
      let result = canvas.toDataURL("image/jpeg", quality);
      while (result.length * 0.75 > maximumBytes && quality > 0.4) {
        quality -= 0.1;
        result = canvas.toDataURL("image/jpeg", quality);
      }
      if (result.length * 0.75 > maximumBytes) {
        reject(new Error("A imagem não pôde ser reduzida o suficiente. Escolha uma imagem menor."));
        return;
      }
      resolve(result);
    };
    image.onerror = () => {
      URL.revokeObjectURL(source);
      reject(new Error("Não foi possível abrir essa imagem."));
    };
    image.src = source;
  });
}

function ProfileAvatar({ user, className = "" }) {
  return <span className={`profile-avatar ${className}`}>
    {user.avatar ? <img src={user.avatar} alt={`Foto de perfil de ${user.name}`} /> : user.name.trim().slice(0, 1).toUpperCase()}
  </span>;
}

function ProfileScreen({ notify, user, setUser, posts, setPosts }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") === "compartilhados" ? "Compartilhados" : searchParams.get("tab") === "fotos" ? "Fotos" : "Publicações");
  const [editOpen, setEditOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [commentingPostId, setCommentingPostId] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(user);
  const [postDraft, setPostDraft] = useState({ text: "", image: "" });
  const [postImageBusy, setPostImageBusy] = useState(false);

  useEffect(() => {
    if (searchParams.get("compose") !== "1") return;
    setComposeOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("compose");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const updatePosts = nextPosts => {
    try {
      window.localStorage.setItem(PROFILE_POSTS_STORAGE_KEY, JSON.stringify(nextPosts));
      setPosts(nextPosts);
      return true;
    } catch (error) {
      console.error("Não foi possível salvar as publicações neste aparelho.", error);
      notify("Não foi possível salvar neste aparelho. Libere espaço e tente novamente; o conteúdo atual continua aberto.");
      return false;
    }
  };
  const closeEditor = () => {
    if (JSON.stringify(draft) !== JSON.stringify(user) && !window.confirm("Descartar as alterações do perfil que ainda não foram salvas?")) return;
    setDraft(user);
    setEditOpen(false);
  };
  const saveProfile = event => {
    event.preventDefault();
    const cleaned = { ...draft, name: draft.name.trim(), username: draft.username.trim().replace(/^@/, "").toLowerCase(), bio: draft.bio.trim(), goal: draft.goal.trim(), activity: draft.activity.trim(), city: draft.city.trim() };
    if (cleaned.name.length < 2 || cleaned.name.length > 50) {
      notify("O nome deve ter entre 2 e 50 caracteres.");
      return;
    }
    if (!/^[a-z0-9._]{3,24}$/.test(cleaned.username)) {
      notify("O nome de usuário deve ter de 3 a 24 caracteres: letras, números, ponto ou sublinhado.");
      return;
    }
    if (cleaned.bio.length > 180) {
      notify("A biografia pode ter no máximo 180 caracteres.");
      return;
    }
    setSaving(true);
    try {
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(cleaned));
      setUser(cleaned);
      setDraft(cleaned);
      setEditOpen(false);
      notify("Perfil salvo neste aparelho.");
    } catch (error) {
      console.error("Não foi possível salvar o perfil neste aparelho.", error);
      notify("Não foi possível salvar o perfil. Libere espaço no navegador e tente novamente; suas alterações continuam no formulário.");
    } finally {
      setSaving(false);
    }
  };
  const handleImageFile = async (event, field) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const image = await compressProfileImage(file, 650000);
      setDraft(current => ({ ...current, [field]: image }));
    } catch (error) {
      notify(error.message);
    } finally {
      event.target.value = "";
    }
  };
  const publishPost = event => {
    event.preventDefault();
    const text = postDraft.text.trim();
    if (!text && !postDraft.image) {
      notify("Escreva uma mensagem ou adicione uma foto antes de publicar.");
      return;
    }
    if (text.length > 1200) {
      notify("A publicação pode ter no máximo 1.200 caracteres.");
      return;
    }
    const post = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text, image: postDraft.image, imageAlt: postDraft.image ? "Foto adicionada à publicação" : "", createdAt: new Date().toISOString(), shared: false, liked: false, comments: [] };
    if (updatePosts([post, ...posts])) {
      setPostDraft({ text: "", image: "" });
      setComposeOpen(false);
      notify("Publicação salva neste aparelho. Ela ainda não foi enviada à comunidade.");
    }
  };
  const updatePost = (postId, transform) => updatePosts(posts.map(post => post.id === postId ? transform(post) : post));
  const selectedPosts = tab === "Compartilhados"
    ? posts.filter(post => post.shared)
    : tab === "Fotos"
      ? posts.filter(post => post.image)
      : posts;
  const chooseTab = label => {
    setTab(label);
    const value = label === "Compartilhados" ? "compartilhados" : label === "Fotos" ? "fotos" : "";
    setSearchParams(value ? { tab: value } : {}, { replace: true });
  };
  const postLabels = tab === "Fotos"
    ? { title: "Sua galeria começa com uma foto", description: "Adicione uma foto a uma publicação para encontrá-la nesta galeria." }
    : tab === "Compartilhados"
      ? { title: "Nada compartilhado por enquanto", description: "As publicações que você marcar para compartilhar aparecerão aqui." }
      : { title: "Cada conquista conta.", description: "Compartilhe sua evolução com a comunidade. Suas publicações ficam somente neste aparelho até que uma integração de conta esteja disponível." };

  return <Screen title="Meu perfil" subtitle="SUA JORNADA, SUAS CONQUISTAS" className="profile-screen" action={() => notify("A central de notificações ainda não está conectada a uma conta. Nenhuma notificação foi carregada.")}>
    <section className="profile-identity-card">
      <div className={`profile-cover ${user.cover ? "has-cover" : ""}`} style={user.cover ? { backgroundImage: `linear-gradient(90deg, #0b3024b8, #0b302433), url("${user.cover}")` } : undefined}>
        <span className="profile-account-note"><ShieldCheck size={14} /> PERFIL NESTE APARELHO</span>
      </div>
      <div className="profile-identity-body">
        <ProfileAvatar user={user} className="profile-avatar-large" />
        <button className="button subtle small-button profile-edit-button" onClick={() => { setDraft(user); setEditOpen(true); }}><PencilLine size={15} /> Editar perfil</button>
        <div className="profile-identity-copy"><h2>{user.name}</h2><span className="profile-handle">@{user.username}{user.showCity && user.city ? ` · ${user.city}` : ""}</span>
          <p>{user.bio || "Bem-estar no seu ritmo. Adicione uma bio para contar um pouco sobre você."}</p>
          <div className="profile-detail-chips">{user.goal && <span><Target size={13} /> {user.goal}</span>}{user.activity && <span><Activity size={13} /> {user.activity}</span>}</div>
        </div>
        <div className="profile-metrics" aria-label="Resumo do perfil">
          <div><strong>{posts.length}</strong><span>Publicações<br /><small>neste aparelho</small></span></div>
          <div><strong>—</strong><span>Seguidores<br /><small>conta não conectada</small></span></div>
          <div><strong>—</strong><span>Seguindo<br /><small>conta não conectada</small></span></div>
        </div>
      </div>
      <p className="profile-local-notice"><ShieldCheck size={14} /> Sem conta ou servidor conectado: alterações, fotos e publicações são armazenadas apenas neste navegador. Nenhum selo de verificação é aplicado.</p>
    </section>

    <section className="profile-evolution-entry">
      <span className="profile-section-icon"><Activity size={18} /></span>
      <div><span className="eyebrow">SUA JORNADA</span><h2>Minha evolução</h2><p>Consulte atividades e registros disponíveis no app. Os dados ficam neste aparelho.</p></div>
      <Link to="/progress" className="button subtle small-button">Ver registros <ArrowRight size={15} /></Link>
    </section>

    <section className="profile-content-section">
      <div className="profile-content-heading"><div><span className="eyebrow">SEU ESPAÇO</span><h2>Conteúdo</h2></div><button className="button primary small-button" onClick={() => setComposeOpen(true)}><Plus size={16} /> Criar publicação</button></div>
      <div className="profile-tabs" role="tablist" aria-label="Conteúdo do perfil">{["Publicações", "Compartilhados", "Fotos"].map(label => <button role="tab" aria-selected={tab === label} key={label} onClick={() => chooseTab(label)} className={tab === label ? "active" : ""}>{label}{label === "Publicações" && <span>{posts.length}</span>}</button>)}</div>
      {tab === "Fotos" && selectedPosts.length > 0
        ? <div className="profile-photo-grid">{selectedPosts.map(post => <button key={post.id} aria-label={`Abrir foto publicada em ${new Date(post.createdAt).toLocaleDateString("pt-BR")}`} onClick={() => setLightbox(post)}><img src={post.image} alt={post.imageAlt || "Foto publicada"} loading="lazy" /><span>{new Date(post.createdAt).toLocaleDateString("pt-BR")}</span></button>)}</div>
        : selectedPosts.length === 0
          ? <div className="profile-empty"><span className="empty-icon">{tab === "Fotos" ? <Camera size={22} /> : tab === "Compartilhados" ? <Share2 size={22} /> : <Sparkles size={22} />}</span><h3>{postLabels.title}</h3><p>{postLabels.description}</p>{tab !== "Compartilhados" && <button className="button primary" onClick={() => setComposeOpen(true)}><Plus size={16} /> {tab === "Fotos" ? "Publicar uma foto" : "Criar publicação"}</button>}</div>
          : <div className="profile-post-list">{selectedPosts.map(post => <article className="profile-post-card" key={post.id}>
            <div className="profile-post-head"><ProfileAvatar user={user} /><span><strong>{user.name}</strong><small>{new Date(post.createdAt).toLocaleString("pt-BR")} · Somente neste aparelho</small></span><button className="icon-button profile-delete-button" aria-label="Excluir sua publicação" onClick={() => { if (window.confirm("Excluir esta publicação salva neste aparelho?")) updatePosts(posts.filter(item => item.id !== post.id)); }}><Trash2 size={17} /></button></div>
            {post.text && <p className="profile-post-text">{post.text}</p>}
            {post.image && <button className="profile-post-image" onClick={() => setLightbox(post)}><img src={post.image} alt={post.imageAlt || "Foto adicionada à publicação"} loading="lazy" /></button>}
            <div className="profile-post-actions"><button className={post.liked ? "liked" : ""} aria-pressed={!!post.liked} onClick={() => updatePost(post.id, item => ({ ...item, liked: !item.liked }))}><Heart size={17} fill={post.liked ? "currentColor" : "none"} /> {post.liked ? "Curtido por você" : "Curtir"}</button><button onClick={() => { setCommentingPostId(commentingPostId === post.id ? "" : post.id); setCommentDraft(""); }}><MessageCircle size={17} /> Comentar{post.comments?.length ? ` · ${post.comments.length}` : ""}</button><button className={post.shared ? "shared" : ""} onClick={() => { updatePost(post.id, item => ({ ...item, shared: !item.shared })); notify(post.shared ? "Publicação removida da aba Compartilhados." : "Publicação marcada na aba Compartilhados deste aparelho."); }}><Share2 size={17} /> {post.shared ? "Compartilhado" : "Compartilhar"}</button></div>
            {commentingPostId === post.id && <form className="profile-comment-form" onSubmit={event => { event.preventDefault(); const text = commentDraft.trim(); if (!text || text.length > 500) { notify(text ? "O comentário pode ter no máximo 500 caracteres." : "Escreva um comentário antes de enviar."); return; } if (updatePosts(posts.map(item => item.id === post.id ? { ...item, comments: [...(item.comments || []), { text, createdAt: new Date().toISOString() }] } : item))) { setCommentDraft(""); setCommentingPostId(""); notify("Comentário salvo neste aparelho."); } }}><label className="sr-only" htmlFor={`profile-comment-${post.id}`}>Escreva um comentário</label><input id={`profile-comment-${post.id}`} value={commentDraft} onChange={event => setCommentDraft(event.target.value)} maxLength={500} placeholder="Escreva um comentário..." /><button className="button primary small-button" type="submit"><Send size={14} /> Enviar</button></form>}
            {!!post.comments?.length && <div className="profile-comment-list">{post.comments.map((comment, index) => <p key={`${post.id}-comment-${index}`}><strong>{user.name}</strong> {comment.text} <small>{new Date(comment.createdAt).toLocaleDateString("pt-BR")}</small></p>)}</div>}
            <p className="profile-post-disclosure">Curtidas e comentários são registros locais e não são enviados a outras pessoas.</p>
          </article>)}</div>}
    </section>

    <div className="professional-entry"><div><span className="eyebrow">É PROFISSIONAL DE BEM-ESTAR?</span><h3>Seu trabalho merece ser visto.</h3><p>Conheça o espaço profissional Fortalfy.</p></div><div><Link to="/trainer" className="button subtle small-button">Coach Pedro</Link><Link to="/nutritionist" className="button primary small-button">Dra. Ana</Link></div></div>
    <div className="profile-creative-entry"><div><span className="eyebrow">FERRAMENTAS PARA SUA JORNADA</span><h3>Mais imagens. Mais inspiração.</h3><p>Explore a coleção ou crie artes originais para o Feed.</p></div><div><Link to="/shop" className="button subtle small-button"><ShoppingBag size={15} /> FortalShop</Link><Link to="/studio" className="button primary small-button"><Sparkles size={15} /> Abrir Studio</Link></div></div>

    {editOpen && <Modal title="Editar perfil" onClose={closeEditor}><form className="profile-edit-form" onSubmit={saveProfile}>
      <div className="profile-image-edit">
        <label className="profile-cover-edit" style={draft.cover ? { backgroundImage: `linear-gradient(#082d2080,#082d2040),url("${draft.cover}")` } : undefined}><input type="file" accept="image/*" onChange={event => handleImageFile(event, "cover")} /><Camera size={16} /> Adicionar capa</label>
        <label className="profile-avatar-edit"><input type="file" accept="image/*" onChange={event => handleImageFile(event, "avatar")} />{draft.avatar ? <img src={draft.avatar} alt="Prévia da foto de perfil" /> : <ProfileAvatar user={draft} />}<span><Camera size={13} /></span></label>
      </div>
      <label className="profile-field">Nome de exibição<input autoComplete="name" value={draft.name} maxLength={50} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} required /></label>
      <label className="profile-field">Nome de usuário<input autoComplete="username" value={draft.username} maxLength={24} onChange={event => setDraft(current => ({ ...current, username: event.target.value.replace(/^@/, "") }))} required /><small>Disponibilidade global não pode ser verificada sem serviço de contas.</small></label>
      <label className="profile-field">Biografia<textarea value={draft.bio} maxLength={180} rows={3} onChange={event => setDraft(current => ({ ...current, bio: event.target.value }))} placeholder="Conte um pouco sobre você." /><small>{draft.bio.length}/180 caracteres</small></label>
      <div className="profile-form-row"><label className="profile-field">Seu objetivo<input value={draft.goal} maxLength={60} onChange={event => setDraft(current => ({ ...current, goal: event.target.value }))} placeholder="Ex.: mais disposição" /></label><label className="profile-field">Atividade preferida<input value={draft.activity} maxLength={40} onChange={event => setDraft(current => ({ ...current, activity: event.target.value }))} placeholder="Ex.: musculação" /></label></div>
      <label className="profile-field">Cidade (opcional)<input value={draft.city} maxLength={70} onChange={event => setDraft(current => ({ ...current, city: event.target.value }))} /></label>
      <label className="profile-privacy-toggle"><input type="checkbox" checked={draft.showCity} onChange={event => setDraft(current => ({ ...current, showCity: event.target.checked }))} /> Mostrar minha cidade neste perfil local</label>
      <p className="profile-local-notice"><ShieldCheck size={14} /> Alterações e imagens são guardadas apenas neste navegador; não há autenticação, envio de arquivos ou banco de dados conectados.</p>
      <div className="profile-edit-actions"><button className="button subtle" type="button" onClick={closeEditor}>Cancelar</button><button className="button primary" type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar perfil"} <Check size={16} /></button></div>
    </form></Modal>}

    {composeOpen && <Modal title="Criar publicação" onClose={() => { if ((postDraft.text.trim() || postDraft.image) && !window.confirm("Descartar sua publicação ainda não salva?")) return; setComposeOpen(false); setPostDraft({ text: "", image: "" }); }}><form className="profile-compose-form" onSubmit={publishPost}>
      <div className="profile-compose-author"><ProfileAvatar user={user} /><span><strong>{user.name}</strong><small>Rascunho salvo somente neste aparelho</small></span></div>
      <label className="sr-only" htmlFor="profile-post-text">Texto da publicação</label><textarea id="profile-post-text" autoFocus value={postDraft.text} maxLength={1200} rows={5} onChange={event => setPostDraft(current => ({ ...current, text: event.target.value }))} placeholder="Compartilhe uma conquista, um pensamento ou um momento da sua rotina..." />
      {postDraft.image && <div className="profile-compose-preview"><img src={postDraft.image} alt="Prévia da foto da publicação" /><button type="button" aria-label="Remover foto" onClick={() => setPostDraft(current => ({ ...current, image: "" }))}><X size={17} /></button></div>}
      <div className="profile-compose-tools"><label className="button subtle small-button"><ImagePlus size={16} /> {postImageBusy ? "Preparando..." : "Adicionar foto"}<input type="file" accept="image/*" disabled={postImageBusy} onChange={async event => { const file = event.target.files?.[0]; if (!file) return; setPostImageBusy(true); try { const image = await compressProfileImage(file, 900000); setPostDraft(current => ({ ...current, image })); } catch (error) { notify(error.message); } finally { setPostImageBusy(false); event.target.value = ""; } }} /></label><span>{postDraft.text.length}/1.200</span><button className="button primary small-button" type="submit" disabled={postImageBusy}><Send size={15} /> Publicar</button></div>
      <p className="profile-post-disclosure">Esta ação salva a publicação somente neste aparelho. Ela não é enviada ao Feed público e não fica visível para outras contas.</p>
    </form></Modal>}

    {lightbox && <Modal title="Foto da publicação" onClose={() => setLightbox(null)}><img className="profile-lightbox-image" src={lightbox.image} alt={lightbox.imageAlt || "Foto publicada"} /><p className="profile-post-disclosure">{lightbox.text}</p></Modal>}
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
  const [shopCart, setShopCart] = useState([]);
  const [shopOrders, setShopOrders] = useState([]);
  const [savedArts, setSavedArts] = useState([]);
  const [studioArtwork, setStudioArtwork] = useState(null);
  const [feedArts, setFeedArts] = useState([]);
  const [profileDetails, setProfileDetails] = useState(() => ({ ...makeDefaultProfile(), ...loadLocalValue(PROFILE_STORAGE_KEY, {}) }));
  const [profilePosts, setProfilePosts] = useState(() => {
    const saved = loadLocalValue(PROFILE_POSTS_STORAGE_KEY, []);
    return Array.isArray(saved) ? saved : [];
  });
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
  const mobilePaths = ["/home", "/feed", "/food", "/pass", "/profile", "/workout", "/nutrition", "/curated", "/progress", "/academy", "/live", "/partner/gym", "/shop", "/studio"];
  const mobile = mobilePaths.includes(location.pathname);
  return <div className={mobile ? "mobile-app" : "professional-root"}>
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/home" element={<HomeScreen notify={notify} activity={activity} onActivity={updateActivity} />} />
      <Route path="/feed" element={<FeedScreen notify={notify} feedArts={feedArts} profileDetails={profileDetails} profilePosts={profilePosts} />} />
      <Route path="/food" element={<FoodScreen notify={notify} />} />
      <Route path="/pass" element={<PassScreen />} />
      <Route path="/profile" element={<ProfileScreen notify={notify} user={profileDetails} setUser={setProfileDetails} posts={profilePosts} setPosts={setProfilePosts} />} />
      <Route path="/workout" element={<WorkoutScreen notify={notify} onActivity={updateActivity} />} />
      <Route path="/nutrition" element={<NutritionScreen notify={notify} onActivity={updateActivity} activity={activity} />} />
      <Route path="/curated" element={<CuratedScreen notify={notify} />} />
      <Route path="/progress" element={<ProgressScreen notify={notify} activity={activity} />} />
      <Route path="/academy" element={<AcademyScreen />} />
      <Route path="/live" element={<LiveScreen notify={notify} />} />
      <Route path="/partner/:type" element={<PartnerScreen notify={notify} />} />
      <Route path="/shop" element={<FortalShop cart={shopCart} setCart={setShopCart} orders={shopOrders} setOrders={setShopOrders} notify={notify} />} />
      <Route path="/studio" element={<FortalfyStudio artwork={studioArtwork} setArtwork={setStudioArtwork} savedArts={savedArts} setSavedArts={setSavedArts} setFeedArts={setFeedArts} notify={notify} />} />
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
