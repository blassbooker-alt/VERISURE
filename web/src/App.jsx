import { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useParams, useSearchParams } from "react-router-dom";
import {
  Activity, Apple, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Camera,
  Bell, Bookmark, Check, ChevronDown, ChevronRight,
  CircleHelp, Clock3, Dumbbell, Flame, Heart, HeartPulse, Home, Lock, MapPin, MessageCircle,
  ImagePlus, PencilLine, Play, Plus, Search, Send, Share2, ShieldCheck,
  ShoppingBag, Sparkles, Star, Target, Timer, Trash2, Users, Utensils, Wallet, X,
} from "lucide-react";
import Dashboard from "./Dashboards.jsx";
import Brand from "./Brand.jsx";
import BottomNav from "./MobileNavigation.jsx";
import FortalShop from "./FortalShop.jsx";
import FortalfyStudio from "./FortalfyStudio.jsx";
import StoryExperience from "./Stories.jsx";
import { OnboardingGate, SocialFeed, SocialMessages, SocialPeople, SocialProfile } from "./SocialScreens.jsx";
import { getErrorMessage, isDemoUser, loadProfile } from "./socialService.js";
import {
  loadApprovedPartners, loadOwnPartnerListing, openStreetMapUrl,
  orderPartnersByDistance, savePartnerListing,
} from "./partnerService.js";
import { fortalfyAsset } from "./assetPath.js";
import { isSupabaseConfigured, supabase } from "./supabaseClient.js";
import splashVideo from "../../assets/splash_fortalfy_v3.mp4";
import { shopOffers, shopProducts } from "./shopData.js";
import { courseList, gyms, profile } from "./data.js";
import { localDateKey, mealsForDate, normalizeMealEntries, sumMealCalories } from "./appLogic.js";
import { loadAvailableFoodMenu } from "./foodService.js";

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

function SharePublication({ isShared = false, onShare, notify }) {
  return <button type="button" className={isShared ? "shared" : ""} aria-pressed={isShared} onClick={() => {
    const nextShared = !isShared;
    if (onShare(nextShared)) notify(nextShared ? "Publicação compartilhada no seu perfil." : "Publicação removida de Compartilhados no seu perfil.");
  }}><Share2 size={17} /> {isShared ? "No seu perfil" : "Compartilhar"}</button>;
}

function CommentAvatar({ name, image }) {
  return <span className="comment-avatar">
    {image ? <img src={image} alt="" /> : name.trim().slice(0, 1).toUpperCase()}
  </span>;
}

function CommentThread({ comments = [], userName, userAvatar = "", onAdd, onToggleLike, open, onToggle, notify, labelId }) {
  const [draft, setDraft] = useState("");
  const submit = event => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || text.length > 500) {
      notify(text ? "O comentário pode ter no máximo 500 caracteres." : "Escreva um comentário antes de enviar.");
      return;
    }
    if (onAdd(text)) setDraft("");
  };
  return <div className="social-comment">
    <button type="button" onClick={onToggle}><MessageCircle size={17} /> Comentar{comments.length ? ` · ${comments.length}` : ""}</button>
    {open && <div className="comment-composer">
      <CommentAvatar name={userName} image={userAvatar} />
      <form className="profile-comment-form" onSubmit={submit}>
        <label className="sr-only" htmlFor={labelId}>Escreva um comentário</label>
        <input id={labelId} value={draft} onChange={event => setDraft(event.target.value)} maxLength={500} placeholder="Escreva um comentário..." />
        <button className="button primary small-button" type="submit" aria-label="Enviar comentário"><Send size={16} /></button>
      </form>
    </div>}
    {!!comments.length && <div className="profile-comment-list" aria-label="Comentários">{comments.map((comment, index) => {
      const author = comment.author || userName;
      const liked = Boolean(comment.likedByMe);
      const likes = Math.max(0, Number(comment.likes) || 0);
      const date = new Date(comment.createdAt);
      return <article className="comment-item" key={comment.id || `${labelId}-${index}`}>
        <CommentAvatar name={author} image={comment.avatar || (author === userName ? userAvatar : "")} />
        <div className="comment-item-content">
          <div className="comment-bubble"><strong>{author}</strong><p>{comment.text}</p></div>
          <div className="comment-meta">
            <button type="button" className={liked ? "comment-liked" : ""} aria-pressed={liked} onClick={() => onToggleLike(index)}>{liked ? "Curtido" : "Curtir"}</button>
            <time dateTime={comment.createdAt}>{Number.isNaN(date.getTime()) ? "agora" : date.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
            {likes > 0 && <span className="comment-like-count"><Heart size={12} fill="currentColor" /> {likes}</span>}
          </div>
        </div>
      </article>;
    })}</div>}
  </div>;
}

function SplashScreen({ onClose }) {
  return <div className="app-splash" role="status" aria-label="Fortalfy iniciando">
    <video className="app-splash-video" src={splashVideo} autoPlay muted playsInline preload="auto" onEnded={onClose} onError={onClose} aria-hidden="true" />
    <div className="app-splash-brand"><Brand light /><span>SEU BEM-ESTAR, NO SEU RITMO</span></div>
    <button className="app-splash-skip" onClick={onClose}>Entrar no app <ArrowRight size={15} /></button>
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

function HomeScreen({ activity, onActivity, session, profile: accountProfile }) {
  const metadata = session?.user?.user_metadata || {};
  const displayName = accountProfile?.display_name || metadata.display_name || metadata.full_name || metadata.name || "";
  const firstName = displayName.trim().split(/\s+/)[0];
  return <Screen className="home-screen">
    <section className="home-hero">
      <img className="home-hero-image" src={fortalfyAsset("publicidade", "05-inicio-bem-estar.jpg")} alt="" aria-hidden="true" />
      <div className="home-hero-top"><span className="location-label">FORTALFY · BEM-ESTAR</span><span className="status-live">NO SEU RITMO</span></div>
      <div className="home-hello"><p>{firstName ? `Olá, ${firstName}` : "Bem-vindo(a) ao Fortalfy"}</p><h1>Seu bem-estar<br />no seu ritmo.</h1><span className="hero-copy">Acesse sua comunidade, seus registros e parceiros.</span></div>
      <div className="hero-activity">
        <div className="activity-icon"><Dumbbell size={20} /></div>
        <div className="activity-text"><span>SEUS REGISTROS NESTE APARELHO</span><strong>{activity.workoutsLogged} {activity.workoutsLogged === 1 ? "treino registrado" : "treinos registrados"}</strong><small>Os registros de rotina não são sincronizados com uma conta.</small></div>
        <Link to="/workout" className="circle-arrow" aria-label="Abrir registros de treino"><ArrowRight size={19} /></Link>
      </div>
    </section>
    <div className="screen-inner home-inner">
      <SectionTitle title="Acesso rápido" />
      <div className="quick-grid">
        <Link to="/feed" className="quick-tile"><span className="quick-icon mint"><Users size={19} /></span><strong>Comunidade</strong><small>Publicações e perfis reais</small><ArrowUpRight size={16} className="quick-arrow" /></Link>
        <Link to="/pass" className="quick-tile"><span className="quick-icon pink"><MapPin size={19} /></span><strong>Parceiros</strong><small>Locais e profissionais aprovados</small><ArrowUpRight size={16} className="quick-arrow" /></Link>
        <Link to="/food" className="quick-tile"><span className="quick-icon yellow"><Utensils size={19} /></span><strong>FortalFood</strong><small>Cardápios publicados por restaurantes</small><ArrowUpRight size={16} className="quick-arrow" /></Link>
        <Link to="/shop" className="quick-tile"><span className="quick-icon blue"><ShoppingBag size={19} /></span><strong>Loja</strong><small>Conheça os produtos Fortalfy</small><ArrowUpRight size={16} className="quick-arrow" /></Link>
      </div>
      <section className="performance-card">
        <div className="section-title-row"><div><span className="eyebrow">SEU RITMO CONTA</span><h2>Registros da rotina</h2></div></div>
        <div className="performance-stats"><span><strong>{activity.workoutsLogged}</strong> treinos registrados</span><span><strong>{activity.mealsLogged}</strong> refeições registradas</span></div>
        <div className="home-local-actions"><Link to="/workout" className="performance-link">Abrir treinos <ArrowRight size={16} /></Link><Link to="/nutrition" className="performance-link">Abrir diário alimentar <ArrowRight size={16} /></Link></div>
      </section>
      <p className="reference-disclosure">Treinos e refeições são armazenados somente neste aparelho; ainda não há sincronização desses registros com sua conta.</p>
      <div className="home-water-action"><button className="button subtle" onClick={() => onActivity("water")}><HeartPulse size={18} /> Registrar 250 ml de água</button><span>{(activity.waterMl / 1000).toFixed(1).replace(".", ",")} L registrados neste aparelho</span></div>
    </div>
  </Screen>;
}

function FeedScreen({ notify, feedArts, profileDetails, profilePosts, savePosts, saveFeedComments, feedComments, shareToProfile }) {
  const [liked, setLiked] = useState(false);
  const [commentingPostId, setCommentingPostId] = useState("");
  const toggleFeedCommentLike = (postId, index) => {
    const comments = [...(feedComments[postId] || [])];
    const comment = comments[index];
    if (!comment) return;
    const liked = Boolean(comment.likedByMe);
    comments[index] = { ...comment, likedByMe: !liked, likes: Math.max(0, (Number(comment.likes) || 0) + (liked ? -1 : 1)) };
    saveFeedComments({ ...feedComments, [postId]: comments });
  };
  const createComment = text => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, author: profileDetails.name, text, createdAt: new Date().toISOString(), likes: 0, likedByMe: false });
  const addFeedComment = (postId, text) => {
    const next = [...(feedComments[postId] || []), createComment(text)];
    if (!saveFeedComments({ ...feedComments, [postId]: next })) return false;
    notify("Comentário salvo no app neste aparelho.");
    return true;
  };
  const shareDemo = (sourceId, author, text, image = "") => shared => shareToProfile({
    sourceId,
    author,
    text,
    image,
    imageAlt: author === "Studio Viva" ? "Espaço de treino funcional" : "",
  }, shared);
  return <Screen title="Stories" subtitle="INSPIRAÇÃO REAL, UM TREINO DE CADA VEZ" className="feed-screen">
    <StoryExperience user={profileDetails} notify={notify} />
    <Link className="composer-card" to="/profile?compose=1"><span className="avatar">{profileDetails.name.slice(0, 1).toUpperCase()}</span><span>No que você está pensando?</span><Plus size={19} /></Link>
    {profilePosts.map(post => <article className="feed-post profile-feed-post" key={post.id}>
      <div className="post-head"><div className="avatar">{profileDetails.avatar ? <img src={profileDetails.avatar} alt="" /> : profileDetails.name.slice(0, 1).toUpperCase()}</div><div className="post-author"><strong>{post.sharedFrom ? `${profileDetails.name} compartilhou` : profileDetails.name}</strong><span>{post.sharedFrom ? `De ${post.sharedFrom} · ${new Date(post.createdAt).toLocaleDateString("pt-BR")}` : `Publicação neste aparelho · ${new Date(post.createdAt).toLocaleDateString("pt-BR")}`}</span></div><span className="created-art-label">{post.sharedFrom ? "COMPARTILHADO" : "LOCAL"}</span></div>
      <p className="post-copy">{post.text}</p>{post.image && <button className="profile-feed-image" onClick={() => notify("Foto da sua publicação.")}><img src={post.image} alt={post.imageAlt || "Foto adicionada à publicação"} loading="lazy" /></button>}
      <div className="post-actions"><CommentThread comments={post.comments || []} userName={profileDetails.name} userAvatar={profileDetails.avatar} onToggleLike={index => { const next = profilePosts.map(item => item.id === post.id ? { ...item, comments: item.comments.map((comment, itemIndex) => itemIndex === index ? { ...comment, likedByMe: !comment.likedByMe, likes: Math.max(0, (Number(comment.likes) || 0) + (comment.likedByMe ? -1 : 1)) } : comment) } : item); savePosts(next); }} open={commentingPostId === post.id} onToggle={() => setCommentingPostId(current => current === post.id ? "" : post.id)} onAdd={text => { const next = profilePosts.map(item => item.id === post.id ? { ...item, comments: [...(item.comments || []), createComment(text)] } : item); if (!savePosts(next)) return false; notify("Comentário salvo no app neste aparelho."); return true; }} notify={notify} labelId={`feed-comment-${post.id}`} /><SharePublication isShared={!!post.shared} notify={notify} onShare={shared => post.sharedFrom ? savePosts(profilePosts.filter(item => item.id !== post.id)) : savePosts(profilePosts.map(item => item.id === post.id ? { ...item, shared } : item))} /></div>
      {commentingPostId === post.id && <div className="feed-comment-disclosure">Seu comentário fica salvo junto desta publicação neste aparelho.</div>}
    </article>)}
    {feedArts.map(art => <article className="feed-post created-art-post" key={art.id}>
      <div className="post-head"><div className="avatar"><Sparkles size={17} /></div><div className="post-author"><strong>Uma criação sua</strong><span>Arte local · desta sessão</span></div><span className="created-art-label">PRÉVIA</span></div>
      <p className="post-copy">{art.title}</p><div className="created-art-image"><img src={art.dataUrl} alt={`Arte criada no Fortalfy Studio: ${art.title}`} /></div>
      <div className="post-caption">{art.subtitle}</div>
      <div className="post-actions"><CommentThread comments={feedComments[`art:${art.id}`] || []} userName={profileDetails.name} userAvatar={profileDetails.avatar} onToggleLike={index => toggleFeedCommentLike(`art:${art.id}`, index)} open={commentingPostId === `art:${art.id}`} onToggle={() => setCommentingPostId(current => current === `art:${art.id}` ? "" : `art:${art.id}`)} onAdd={text => addFeedComment(`art:${art.id}`, text)} notify={notify} labelId={`feed-comment-art-${art.id}`} /><SharePublication isShared={profilePosts.some(post => post.sharedFromId === `art:${art.id}`)} notify={notify} onShare={shareDemo(`art:${art.id}`, "Sua criação no Fortalfy Studio", `${art.title}\n${art.subtitle}`, art.dataUrl)} /></div>
      {commentingPostId === `art:${art.id}` && <div className="feed-comment-disclosure">Seu comentário fica salvo neste aparelho.</div>}
    </article>)}
    <article className="feed-post">
      <div className="post-head"><div className="avatar studio"><img src={fortalfyAsset("publicidade", "banner-comunidade.jpg")} alt="" /></div><div className="post-author"><strong>Studio Viva</strong><span>Comunidade Fortalfy · Meireles</span></div><span className="created-art-label">COMUNIDADE</span></div>
      <p className="post-copy">Sua próxima conquista começa com um treino. 💚</p>
      <div className="post-image"><PhotoCard image="./assets/pass-demo-gym-ironfit.jpg" alt="Espaço de treino funcional" /><span className="post-image-label">MOVIMENTO É PARA TODO MUNDO</span></div>
      <div className="post-caption">Treino funcional de força + mobilidade. <Link className="inline-link" to="/pass">Conheça o Fortalfy Pass.</Link></div>
      <div className="post-tags">#Fortalfy #TreinoComPropósito #Fortaleza</div>
      <div className="post-actions"><button onClick={() => setLiked(value => !value)} className={liked ? "liked" : ""}><Heart size={19} fill={liked ? "currentColor" : "none"} /> {liked ? "Curtido" : "Curtir"}</button><CommentThread comments={feedComments["demo:studio-viva"] || []} userName={profileDetails.name} userAvatar={profileDetails.avatar} onToggleLike={index => toggleFeedCommentLike("demo:studio-viva", index)} open={commentingPostId === "demo:studio-viva"} onToggle={() => setCommentingPostId(current => current === "demo:studio-viva" ? "" : "demo:studio-viva")} onAdd={text => addFeedComment("demo:studio-viva", text)} notify={notify} labelId="feed-comment-studio-viva" /><SharePublication isShared={profilePosts.some(post => post.sharedFromId === "demo:studio-viva")} notify={notify} onShare={shareDemo("demo:studio-viva", "Studio Viva", "Sua próxima conquista começa com um treino. Treino funcional de força + mobilidade.", "./assets/pass-demo-gym-ironfit.jpg")} /><button aria-label="Salvar publicação" onClick={() => notify("Publicação salva nos favoritos.")}><Bookmark size={19} /></button></div>
    </article>
    <article className="feed-post second-post"><div className="post-head"><div className="avatar"><img src="./assets/stories/avatar-mariana.jpg" alt="" /></div><div className="post-author"><strong>Mariana Costa</strong><span>Comunidade Fortalfy · Aldeota</span></div><span className="created-art-label">COMUNIDADE</span></div><p className="post-copy">12 dias cuidando de mim. O melhor resultado é a energia que voltou. ✨</p><div className="streak-note"><Flame size={20} /> <strong>12 dias de constância</strong> <span>Uma rotina possível, no seu ritmo.</span></div><div className="post-actions"><button onClick={() => notify("Publicação curtida.")}><Heart size={19} /> Curtir</button><CommentThread comments={feedComments["demo:mariana"] || []} userName={profileDetails.name} userAvatar={profileDetails.avatar} onToggleLike={index => toggleFeedCommentLike("demo:mariana", index)} open={commentingPostId === "demo:mariana"} onToggle={() => setCommentingPostId(current => current === "demo:mariana" ? "" : "demo:mariana")} onAdd={text => addFeedComment("demo:mariana", text)} notify={notify} labelId="feed-comment-mariana" /><SharePublication isShared={profilePosts.some(post => post.sharedFromId === "demo:mariana")} notify={notify} onShare={shareDemo("demo:mariana", "Mariana Costa", "12 dias cuidando de mim. O melhor resultado é a energia que voltou.", "./assets/stories/avatar-mariana.jpg")} /><button aria-label="Salvar publicação" onClick={() => notify("Publicação salva nos favoritos.")}><Bookmark size={19} /></button></div></article>
  </Screen>;
}

function FoodScreen({ client, configured, session }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [search, setSearch] = useState("");
  const [menu, setMenu] = useState(null);
  useEffect(() => {
    let active = true;
    setError("");
    setNeedsLogin(false);
    if (!session?.user?.id) {
      setItems([]);
      setNeedsLogin(true);
      setLoading(false);
      return () => { active = false; };
    }
    if (!configured || !client) {
      setItems([]);
      setError("O FortalFood precisa da conexão configurada com o Supabase.");
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    loadAvailableFoodMenu(client)
      .then(result => { if (active) setItems(result); })
      .catch(reason => { if (active) setError(getErrorMessage(reason, "Não foi possível carregar os cardápios.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client, configured, session?.user?.id]);
  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
  const visible = items.filter(item => `${item.name} ${item.description} ${item.restaurant.name}`.toLocaleLowerCase("pt-BR").includes(normalizedSearch));
  const formatPrice = price => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);
  return <Screen title="FortalFood" subtitle="CARDÁPIOS DOS RESTAURANTES" className="food-screen">
    <section className="food-promo"><img src={fortalfyAsset("publicidade", "banner-fortalfood.jpg")} alt="" aria-hidden="true" /><div><span className="eyebrow">FORTALFOOD</span><h2>Cardápios publicados por restaurantes.</h2><p>Consulte os itens e valores cadastrados pelos parceiros.</p></div></section>
    <label className="search-field"><Search size={19} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar restaurantes e itens" aria-label="Buscar restaurantes e itens" /><button aria-label="Limpar busca" onClick={() => setSearch("")}>{search && <X size={17} />}</button></label>
    <SectionTitle title="Itens disponíveis" />
    {loading && <p className="food-status" role="status">Carregando cardápios…</p>}
    {needsLogin && <div className="empty-state"><Lock size={24} /><h3>Entre para acessar os cardápios</h3><p>Os cardápios são carregados da plataforma e exigem uma conta autenticada.</p><Link className="button primary" to="/feed">Entrar ou criar conta <ArrowRight size={16} /></Link></div>}
    {error && <div className="social-inline-error" role="alert">{error}</div>}
    {!loading && !error && !needsLogin && <div className="food-card-list">{visible.map(item => <article className="food-card" key={item.id}>
      <div className="food-card-image">{item.image ? <img className="food-item-image" src={item.image} alt={item.name} loading="lazy" /> : <div className="food-item-placeholder" aria-label="Sem imagem cadastrada"><Utensils size={28} /></div>}<span>DISPONÍVEL</span></div>
      <div className="food-card-body"><div className="food-card-heading"><div><h3>{item.name}</h3><span>{item.restaurant.name}{item.restaurant.city ? ` · ${item.restaurant.city}` : ""}</span></div></div>
        <p className="food-item-description">{item.description}</p>
        {item.portionLabel && <p>Porção: <strong>{item.portionLabel}</strong></p>}
        <div className="food-card-footer"><strong>{formatPrice(item.price)}</strong><div><button className="button subtle small-button" onClick={() => setMenu(item)}>Detalhes</button><Link className="button primary small-button" to={`/profile/${item.restaurant.id}`}>Restaurante <ArrowRight size={15} /></Link></div></div>
      </div>
    </article>)}
    {!visible.length && <div className="empty-state"><Search size={24} /><h3>{items.length ? "Nenhum item encontrado" : "Nenhum cardápio disponível"}</h3><p>{items.length ? "Tente buscar por outro restaurante ou item." : "Os restaurantes aprovados ainda não publicaram itens disponíveis."}</p>{search && <button className="button subtle" onClick={() => setSearch("")}>Limpar busca</button>}</div>}
    </div>}
    {menu && <Modal title={menu.name} onClose={() => setMenu(null)}><p>{menu.description}</p><p><strong>{formatPrice(menu.price)}</strong> · {menu.restaurant.name}</p>{menu.portionLabel && <p>Porção: {menu.portionLabel}</p>}{menu.allergens.length > 0 && <p>Alergênicos informados pelo restaurante: {menu.allergens.join(", ")}</p>}<p className="food-order-disclosure">A solicitação e o pagamento de pedidos ainda não estão disponíveis no aplicativo.</p><Link className="button primary wide-button" to={`/profile/${menu.restaurant.id}`} onClick={() => setMenu(null)}>Ver perfil do restaurante <ArrowRight size={16} /></Link></Modal>}
  </Screen>;
}

function PassScreen() {
  const [showPlan, setShowPlan] = useState(false);
  const [planConfirmed, setPlanConfirmed] = useState(false);
  return <Screen title="Seu treino, mais perto de você." subtitle="FORTALFY PASS" location className="pass-screen">
    <div className="pass-hero"><PhotoCard image={gyms[0].image} alt="Rede de academias credenciadas FortalPass" /><div className="pass-hero-overlay"><span>FORTALPASS OFICIAL</span><h2>Movimento que<br />combina com você.</h2><p>Acesse as melhores academias e studios credenciados de Fortaleza em um só passe.</p><Link to="/partner/gym" className="button lime-button">Explorar academias <ArrowRight size={16} /></Link></div></div>
    <div className="pass-intro"><span className="verified-pill"><ShieldCheck size={15} /> Seu cuidado em boa companhia</span><p>Experiências e profissionais para acompanhar sua rotina — no seu ritmo.</p></div>
    <SectionTitle title="Academias por perto" action="Ver mapa" to="/partner/gym" />
    <div className="gym-cards">{gyms.map((gym, index) => <GymCard gym={gym} key={gym.name} index={index} />)}</div>
    <section className="professional-care"><div><span className="eyebrow">CUIDADO PROFISSIONAL</span><h2>Gente boa ao seu lado.</h2><p>Acompanhamento próximo para tornar sua rotina mais leve.</p></div>
      <div className="pro-card-list"><Link to="/hire/personal" className="pro-card"><span className="pro-avatar trainer-avatar"><img src="./assets/stories/avatar-pedro.jpg" alt="" loading="lazy" /></span><div><span>PERSONAL TRAINER</span><strong>Coach Pedro</strong><small>Conhecer perfil e solicitar horário</small></div><ArrowRight size={18} /></Link><Link to="/hire/nutritionist" className="pro-card"><span className="pro-avatar nutrition-avatar"><img src="./assets/stories/avatar-camila.jpg" alt="" loading="lazy" /></span><div><span>NUTRICIONISTA</span><strong>Dra. Ana</strong><small>Conhecer perfil e solicitar horário</small></div><ArrowRight size={18} /></Link></div>
    </section>
    <section className="pass-plan"><div><span className="eyebrow">FORTALFY PASS</span><h2>Mais espaços para<br />o seu movimento.</h2><p>Descubra novas possibilidades para cuidar de você.</p><ul><li><Check size={16} /> Espaços e aulas para descobrir</li><li><Check size={16} /> Modalidades para diferentes rotinas</li><li><Check size={16} /> Check-in digital sem burocracia</li></ul></div><div className="pass-price-card"><img className="pass-membership-campaign" src={fortalfyAsset("publicidade", "06-assinatura-fortalpass.jpg")} alt="Assinatura FortalPass" loading="lazy" /><span>ASSINATURA FORTALPASS</span><strong>Planos Oficiais</strong><small>Acesso ilimitado às academias da rede credenciada.</small><button className="button lime-button wide-button" onClick={() => setShowPlan(true)}>{planConfirmed ? "Plano selecionado" : "Conhecer o Pass"} <ArrowRight size={16} /></button></div></section>
    {showPlan && <Modal title="Fortalfy Pass Oficial" onClose={() => setShowPlan(false)}><div className="plan-confirmation"><span className="quick-icon mint"><ShieldCheck size={21} /></span><h3>Acesso completo à rede credenciada</h3><p>Musculação, funcional, natação e yoga com check-in digital no aplicativo Fortalfy.</p></div><button className="button primary wide-button" onClick={() => { setPlanConfirmed(true); setShowPlan(false); window.dispatchEvent(new CustomEvent("fortalfy-toast", { detail: "Plano FortalPass selecionado com sucesso!" })); }}>Confirmar Seleção <Check size={17} /></button></Modal>}
  </Screen>;
}

const HIRING_REQUESTS_STORAGE_KEY = "fortalfy.professional.requests.local.v1";

function HiringScreen({ notify }) {
  const { role } = useParams();
  const nutritionist = role === "nutritionist";
  const professional = nutritionist
    ? { name: "Dra. Ana", title: "Nutricionista", avatar: "./assets/stories/avatar-camila.jpg", services: ["Consulta inicial", "Consulta de retorno", "Orientação alimentar"] }
    : { name: "Coach Pedro", title: "Personal trainer", avatar: "./assets/stories/avatar-pedro.jpg", services: ["Avaliação inicial", "Treino individual", "Consultoria de treino"] };
  const [requests, setRequests] = useState(() => {
    const saved = loadLocalValue(HIRING_REQUESTS_STORAGE_KEY, []);
    return Array.isArray(saved) ? saved.filter(request => request && typeof request.id === "string" && typeof request.name === "string") : [];
  });
  const [name, setName] = useState("");
  const [service, setService] = useState(professional.services[0]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  const submitRequest = event => {
    event.preventDefault();
    const request = {
      id: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      role,
      professional: professional.name,
      name: name.trim(),
      service,
      date,
      time,
      note: note.trim(),
      status: "Pedido local — não enviado",
    };
    const nextRequests = [request, ...requests];
    try {
      window.localStorage.setItem(HIRING_REQUESTS_STORAGE_KEY, JSON.stringify(nextRequests));
    } catch (storageError) {
      console.error("Não foi possível salvar a solicitação profissional neste dispositivo.", storageError);
      setError("Não foi possível salvar no navegador. Verifique o espaço disponível e tente novamente.");
      return;
    }
    setRequests(nextRequests);
    setName("");
    setDate("");
    setTime("");
    setNote("");
    setError("");
    notify("Pedido salvo neste dispositivo. O profissional não foi contatado e o horário não está confirmado.");
  };

  const removeRequest = id => {
    const nextRequests = requests.filter(request => request.id !== id);
    try {
      window.localStorage.setItem(HIRING_REQUESTS_STORAGE_KEY, JSON.stringify(nextRequests));
    } catch (storageError) {
      console.error("Não foi possível atualizar as solicitações locais.", storageError);
      setError("Não foi possível remover o pedido salvo neste navegador.");
      return;
    }
    setRequests(nextRequests);
  };

  if (!["personal", "nutritionist"].includes(role)) return <Navigate to="/pass" replace />;

  return <Screen title="Cuidado profissional" subtitle="PERFIL E SOLICITAÇÃO" className="hiring-screen">
    <Link to="/pass" className="back-link"><ArrowLeft size={17} /> Voltar ao Pass</Link>
    <section className="hiring-profile"><img src={professional.avatar} alt="" /><div><span className="eyebrow">{professional.title.toUpperCase()}</span><h2>{professional.name}</h2><p>Especialista credenciado da rede Fortalfy · Fortaleza, CE</p></div></section>
    <form className="hiring-form" onSubmit={submitRequest}>
      <h3>Solicitar um horário</h3>
      <label>Seu nome<input required maxLength={80} autoComplete="name" value={name} onChange={event => setName(event.target.value)} placeholder="Como podemos chamar você?" /></label>
      <label>Serviço<select value={service} onChange={event => setService(event.target.value)}>{professional.services.map(item => <option key={item}>{item}</option>)}</select></label>
      <div className="hiring-form-row"><label>Data preferida<input required type="date" min={today} value={date} onChange={event => setDate(event.target.value)} /></label><label>Período<select required value={time} onChange={event => setTime(event.target.value)}><option value="">Escolha</option><option>Manhã</option><option>Tarde</option><option>Noite</option></select></label></div>
      <label>Observação opcional<textarea maxLength={240} rows={3} value={note} onChange={event => setNote(event.target.value)} placeholder="Conte brevemente o que você procura." /></label>
      {error && <p className="hiring-error" role="alert">{error}</p>}
      <button className="button primary wide-button" type="submit">Confirmar solicitação <ArrowRight size={17} /></button>
    </form>
    <section className="hiring-requests"><h3>Solicitações registradas</h3>{requests.filter(request => request.role === role).length ? requests.filter(request => request.role === role).map(request => <article className="hiring-request" key={request.id}><div><strong>{request.service} · {request.professional}</strong><span>{request.name} · {request.date} · {request.time}</span><small>Agendado</small></div><button type="button" className="icon-button" aria-label={`Remover pedido de ${request.service}`} onClick={() => removeRequest(request.id)}><Trash2 size={16} /></button></article>) : <p>Nenhuma solicitação para este perfil.</p>}</section>
  </Screen>;
}

function GymCard({ gym }) {
  return <article className="gym-card"><Link to="/partner/gym" className="gym-card-image"><PhotoCard image={gym.image} alt={`Academia ${gym.name}`} /><span>CREDENCIADA</span><button aria-label={`Abrir ${gym.name}`}><ArrowUpRight size={16} /></button></Link><div className="gym-card-body"><div className="gym-card-title"><h3>{gym.name}</h3><span className="rating"><MapPin size={14} /> Aldeota · Fortaleza</span></div><p>Check-in digital liberado com FortalPass</p><div className="gym-tags">{gym.tags.slice(0, 2).map(tag => <span key={tag}>{tag}</span>)}</div><span className="gym-price">Planos no FortalPass</span></div></article>;
}

const PROFILE_STORAGE_KEY = "fortalfy.profile.local.v1";
const PROFILE_POSTS_STORAGE_KEY = "fortalfy.profile.posts.local.v1";
const PROFILE_FEED_COMMENTS_STORAGE_KEY = "fortalfy.profile.feed-comments.local.v1";
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

const ACTIVITY_STORAGE_KEY = "fortalfy.activity.local.v1";
const SHOP_CART_STORAGE_KEY = "fortalfy.shop.cart.local.v1";

function normalizeActivity(value) {
  const mealEntries = normalizeMealEntries(value?.mealEntries);
  const workoutsLogged = Number.isInteger(value?.workoutsLogged) && value.workoutsLogged > 0 ? Math.min(1000000, value.workoutsLogged) : 0;
  const waterMl = Number.isFinite(value?.waterMl) ? Math.min(10000000, Math.max(0, Math.floor(value.waterMl))) : 0;
  const workoutEntries = (Array.isArray(value?.workoutEntries) ? value.workoutEntries : [])
    .filter(entry => entry && typeof entry.id === "string" && typeof entry.name === "string"
      && entry.name.trim().length > 0 && entry.name.length <= 60
      && Number.isInteger(entry.minutes) && entry.minutes > 0 && entry.minutes <= 600
      && typeof entry.date === "string")
    .slice(-100);
  return {
    trainingPercent: Math.min(100, Math.round(workoutsLogged / 20 * 100)),
    nutritionPercent: Math.min(100, Math.round(mealEntries.length / 30 * 100)),
    waterMl,
    recoveryPercent: 0,
    workoutsLogged,
    workoutEntries,
    mealsLogged: mealEntries.length,
    mealEntries,
  };
}

function loadShopCart() {
  const saved = loadLocalValue(SHOP_CART_STORAGE_KEY, []);
  if (!Array.isArray(saved)) return [];
  return saved.filter(line => line
    && shopProducts.some(product => product.id === line.id)
    && ((line.options && typeof line.options === "object" && !Array.isArray(line.options)
      && Object.values(line.options).every(value => typeof value === "string"))
      || (typeof line.shade === "string" && typeof line.size === "string"))
    && Number.isInteger(line.quantity)
    && line.quantity > 0);
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

function ProfileScreen({ notify, user, setUser, posts, savePosts }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") === "compartilhados" ? "Compartilhados" : searchParams.get("tab") === "fotos" ? "Fotos" : "Publicações");
  const [editOpen, setEditOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [commentingPostId, setCommentingPostId] = useState("");
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
    if (savePosts([post, ...posts])) {
      setPostDraft({ text: "", image: "" });
      setComposeOpen(false);
      notify("Publicação salva neste aparelho. Ela ainda não foi enviada à comunidade.");
    }
  };
  const updatePost = (postId, transform) => savePosts(posts.map(post => post.id === postId ? transform(post) : post));
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
            <div className="profile-post-head"><ProfileAvatar user={user} /><span><strong>{post.sharedFrom ? `${user.name} compartilhou` : user.name}</strong><small>{post.sharedFrom ? `De ${post.sharedFrom} · compartilhado no seu perfil` : `${new Date(post.createdAt).toLocaleString("pt-BR")} · Somente neste aparelho`}</small></span><button className="icon-button profile-delete-button" aria-label={post.sharedFrom ? "Remover compartilhamento do perfil" : "Excluir sua publicação"} onClick={() => { if (window.confirm(post.sharedFrom ? "Remover este compartilhamento do seu perfil?" : "Excluir esta publicação salva neste aparelho?")) savePosts(posts.filter(item => item.id !== post.id)); }}><Trash2 size={17} /></button></div>
            {post.text && <p className="profile-post-text">{post.text}</p>}
            {post.image && <button className="profile-post-image" onClick={() => setLightbox(post)}><img src={post.image} alt={post.imageAlt || "Foto adicionada à publicação"} loading="lazy" /></button>}
            <div className="profile-post-actions"><button className={post.liked ? "liked" : ""} aria-pressed={!!post.liked} onClick={() => updatePost(post.id, item => ({ ...item, liked: !item.liked }))}><Heart size={17} fill={post.liked ? "currentColor" : "none"} /> {post.liked ? "Curtido por você" : "Curtir"}</button><CommentThread comments={post.comments || []} userName={user.name} userAvatar={user.avatar} onToggleLike={index => updatePost(post.id, item => { const comments = (item.comments || []).map((comment, itemIndex) => itemIndex === index ? { ...comment, likedByMe: !comment.likedByMe, likes: Math.max(0, (Number(comment.likes) || 0) + (comment.likedByMe ? -1 : 1)) } : comment); return { ...item, comments }; })} open={commentingPostId === post.id} onToggle={() => setCommentingPostId(current => current === post.id ? "" : post.id)} onAdd={text => { const saved = updatePost(post.id, item => ({ ...item, comments: [...(item.comments || []), { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, author: user.name, text, createdAt: new Date().toISOString(), likes: 0, likedByMe: false }] })); if (saved) notify("Comentário salvo no app neste aparelho."); return saved; }} notify={notify} labelId={`profile-comment-${post.id}`} /><SharePublication isShared={!!post.shared} notify={notify} onShare={shared => post.sharedFromId ? savePosts(posts.filter(item => item.id !== post.id)) : updatePost(post.id, item => ({ ...item, shared }))} /></div>
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

function WorkoutScreen({ notify, onActivity, activity }) {
  const [name, setName] = useState("");
  const [minutes, setMinutes] = useState("");
  const [error, setError] = useState("");
  const saveWorkout = event => {
    event.preventDefault();
    const workoutName = name.trim();
    const duration = Number(minutes);
    if (!workoutName || workoutName.length > 60 || !Number.isInteger(duration) || duration < 1 || duration > 600) {
      setError("Informe o tipo de treino e uma duração entre 1 e 600 minutos.");
      return;
    }
    onActivity("workout", {
      id: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      name: workoutName,
      minutes: duration,
      date: localDateKey(),
    });
    setName("");
    setMinutes("");
    setError("");
    notify("Treino registrado neste aparelho.");
  };
  return <Screen title="Treinos" subtitle="SEUS REGISTROS" className="workout-screen">
    <Link to="/home" className="back-link"><ArrowLeft size={17} /> Voltar</Link>
    <section className="workout-progress-card"><div><span className="eyebrow">REGISTROS NESTE APARELHO</span><h2>{activity.workoutsLogged} {activity.workoutsLogged === 1 ? "treino registrado" : "treinos registrados"}</h2><p>O Fortalfy não prescreve treinos nem lê sensores nesta tela.</p></div></section>
    <p className="reference-disclosure">Seus registros ficam neste navegador e não são sincronizados com sua conta ou com dispositivos.</p>
    <form className="meal-entry-form" onSubmit={saveWorkout}><h2>Registrar treino realizado</h2><label>Tipo ou nome do treino<input required maxLength={60} value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: musculação, caminhada" /></label><label>Duração em minutos<input required type="number" min="1" max="600" step="1" value={minutes} onChange={event => setMinutes(event.target.value)} placeholder="Ex.: 45" /></label>{error && <p className="social-inline-error" role="alert">{error}</p>}<button className="button primary wide-button" type="submit">Salvar registro</button></form>
    <SectionTitle title="Histórico registrado" />
    {activity.workoutEntries.length ? <div className="exercise-list">{[...activity.workoutEntries].reverse().map(entry => <article className="exercise-card" key={entry.id}><span className="exercise-thumb"><Dumbbell size={22} /></span><div className="exercise-details"><h3>{entry.name}</h3><p>{entry.minutes} min · {entry.date}</p></div></article>)}</div> : <div className="empty-state"><Dumbbell size={24} /><h3>Nenhum treino registrado</h3><p>Seus treinos aparecerão aqui depois que você os registrar.</p></div>}
  </Screen>;
}

function NutritionScreen({ notify, onActivity, activity }) {
  const [addingMeal, setAddingMeal] = useState(false);
  const [mealName, setMealName] = useState("");
  const [mealCalories, setMealCalories] = useState("");
  const todayKey = localDateKey();
  const todaysMeals = mealsForDate(activity.mealEntries, todayKey);
  const calories = sumMealCalories(todaysMeals);
  const today = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const registerMeal = event => {
    event.preventDefault();
    const name = mealName.trim();
    const parsedCalories = Number(mealCalories);
    if (!name || mealCalories === "" || !Number.isInteger(parsedCalories) || parsedCalories < 0 || parsedCalories > 10000) return;
    onActivity("meal", { id: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`, name, calories: parsedCalories, date: todayKey });
    setMealName("");
    setMealCalories("");
    setAddingMeal(false);
    notify("Refeição adicionada ao diário neste dispositivo.");
  };
  return <Screen title="Nutrição Hoje" subtitle={`${today.toLocaleUpperCase()} · SUA ROTINA`} className="nutrition-screen">
    <div className="nutrition-summary"><div className="nutrition-donut"><div><strong>{calories.toLocaleString("pt-BR")}</strong><span>kcal informadas</span><small>hoje neste aparelho</small></div></div><div className="macro-details"><span className="eyebrow">METAS NUTRICIONAIS</span><p className="nutrition-unset">Nenhuma meta ou macro foi configurado. Dados nutricionais só aparecerão quando forem informados por você ou por um profissional.</p><Link to="/progress" className="text-link">Ver registros de evolução <ArrowRight size={15} /></Link></div></div>
    <p className="reference-disclosure">O total soma apenas as calorias digitadas por você; o app não estima calorias nem recomenda metas clínicas.</p>
    <div className="nutrition-note"><span className="quick-icon mint"><Sparkles size={18} /></span><span><strong>Consistência, não perfeição.</strong><small>Seus registros ficam neste dispositivo e podem ser apagados ao limpar os dados do navegador.</small></span></div>
    <SectionTitle title="Seu diário" />
    <div className="meal-list">{todaysMeals.length ? todaysMeals.map((meal, index) => <div className="meal-row" key={meal.id}><span className={`meal-icon meal-${index % 4}`}>{["☀", "◒", "✳", "☾"][index % 4]}</span><div><strong>{meal.name}</strong><small>{meal.calories.toLocaleString("pt-BR")} kcal · Registrado neste dispositivo</small></div><button className="meal-remove-button" aria-label={`Remover ${meal.name} do diário`} onClick={() => onActivity("removeMeal", meal.id)}><Trash2 size={16} /></button></div>) : <div className="empty-state"><Utensils size={24} /><h3>Nenhuma refeição registrada</h3><p>Adicione o que você consumiu para acompanhar suas calorias.</p></div>}</div>
    <Link to="/food" className="nutrition-curation"><span className="quick-icon mint"><Utensils size={18} /></span><span><small>FORTALFOOD</small><strong>Consulte cardápios publicados por restaurantes aprovados.</strong><small>Informações e disponibilidade são cadastradas pelos parceiros.</small></span><ArrowRight size={18} /></Link>
    <button className="button primary wide-button mt-5" onClick={() => setAddingMeal(value => !value)}><Plus size={18} /> {addingMeal ? "Cancelar registro" : "Registrar refeição"}</button>
    {addingMeal && <form className="meal-entry-form" onSubmit={registerMeal}><label>Nome da refeição<input required maxLength={60} value={mealName} onChange={event => setMealName(event.target.value)} placeholder="Ex.: almoço" /></label><label>Calorias (kcal)<input required type="number" min="0" max="10000" step="1" value={mealCalories} onChange={event => setMealCalories(event.target.value)} placeholder="Ex.: 520" /></label><button className="button primary wide-button" type="submit">Salvar refeição</button></form>}
    <p className="sr-only" aria-live="polite">{todaysMeals.length} {todaysMeals.length === 1 ? "refeição registrada hoje" : "refeições registradas hoje"}; {calories} quilocalorias no diário.</p>
  </Screen>;
}

function ProgressScreen({ activity }) {
  const meals = [...activity.mealEntries].sort((left, right) => right.date.localeCompare(left.date)).slice(0, 5);
  const workouts = [...activity.workoutEntries].reverse().slice(0, 5);
  return <Screen title="Meus registros" subtitle="DADOS INFORMADOS POR VOCÊ" className="progress-screen">
    <section className="performance-card progress-summary">
      <div className="section-title-row"><div><span className="eyebrow">NESTE APARELHO</span><h2>Resumo da rotina</h2></div></div>
      <div className="performance-stats"><span><strong>{activity.workoutsLogged}</strong> treinos registrados</span><span><strong>{activity.mealsLogged}</strong> refeições registradas</span><span><strong>{activity.waterMl.toLocaleString("pt-BR")} ml</strong> de água registrados</span></div>
    </section>
    <p className="reference-disclosure">Esses dados ficam neste navegador e não são sincronizados com sua conta. Peso, medidas, sono e atividade de sensores não estão conectados.</p>
    <SectionTitle title="Treinos recentes" action="Registrar treino" to="/workout" />
    {workouts.length ? <div className="exercise-list">{workouts.map(entry => <article className="exercise-card" key={entry.id}><span className="exercise-thumb"><Dumbbell size={22} /></span><div className="exercise-details"><h3>{entry.name}</h3><p>{entry.minutes} min · {entry.date}</p></div></article>)}</div> : <div className="empty-state"><Dumbbell size={24} /><h3>Nenhum treino registrado</h3><Link className="button subtle" to="/workout">Registrar treino</Link></div>}
    <SectionTitle title="Refeições recentes" action="Abrir diário" to="/nutrition" />
    {meals.length ? <div className="meal-list">{meals.map(meal => <div className="meal-row" key={meal.id}><span className="meal-icon"><Utensils size={17} /></span><div><strong>{meal.name}</strong><small>{meal.calories.toLocaleString("pt-BR")} kcal · {meal.date}</small></div></div>)}</div> : <div className="empty-state"><Utensils size={24} /><h3>Nenhuma refeição registrada</h3><Link className="button subtle" to="/nutrition">Abrir diário</Link></div>}
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
    <div className="partner-gallery"><PhotoCard image={gym.image} alt="Espaço de treino em Fortaleza" /><div><PhotoCard image="./assets/pass-demo-gym-nextfit.jpg" alt="Área de treino" /><PhotoCard image="./assets/pass-strength-space.svg" alt="Equipamentos de musculação" /></div><span className="verified-pill"><MapPin size={16} /> ACADEMIA CREDENCIADA</span></div>
    <section className="partner-summary"><div><span className="verified-pill"><ShieldCheck size={15} /> Credenciada FortalPass</span><h2>{gym.name}</h2><p>Infraestrutura completa para musculação, cardio e treinos funcionais em Fortaleza.</p></div><button className="button primary" onClick={() => notify("Check-in FortalPass liberado para esta unidade.")}>Fazer Check-in <ArrowRight size={16} /></button></section>
    <div className="partner-tabs">{["Visão geral", "Modalidades", "Avaliações"].map(item => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</div>
    <div className="partner-info-grid"><section className="dash-panel"><h3>{tab === "Avaliações" ? "Opiniões da comunidade" : tab === "Modalidades" ? "Encontre seu movimento" : "Sobre o espaço"}</h3><p>{tab === "Avaliações" ? "Excelente estrutura, equipamentos modernos e profissionais dedicados." : tab === "Modalidades" ? "Musculação completa, aulas coletivas, esteiras e área de peso livre." : "Espaço premium com vestiários climatizados e acompanhamento na musculação."}</p><div className="gym-tags">{gym.tags.map(tag => <span key={tag}>{tag}</span>)}</div></section><section className="dash-panel"><h3>Informações</h3><div className="partner-detail-line"><MapPin size={17} /><span><strong>Aldeota · Fortaleza</strong><small>Av. Santos Dumont, Fortaleza - CE</small></span></div><div className="partner-detail-line"><Clock3 size={17} /><span><strong>Horários de funcionamento</strong><small>Seg a Sex 05:30 às 22:00 · Sáb 08:00 às 14:00</small></span></div><div className="partner-detail-line"><Wallet size={17} /><span><strong>Acesso FortalPass</strong><small>Check-in digital ilimitado</small></span></div></section></div>
    <section className="partner-cta"><div><span className="eyebrow">SEU PRÓXIMO PASSO</span><h2>Quer treinar hoje?</h2><p>Faça seu check-in pelo app e aproveite todos os espaços disponíveis.</p></div><button className="button lime-button" onClick={() => notify("Check-in realizado! Bom treino.")}>Check-in agora <ArrowRight size={17} /></button></section>
  </Screen>;
}

function LivePartnerCard({ partner, appointment = false }) {
  const mapUrl = openStreetMapUrl(partner);
  const role = partner.kind === "personal" ? "personal" : partner.kind === "nutricionista" ? "nutritionist" : "";
  return <article className="gym-card">
    <Link to={`/partner/${partner.profileId}`} className="gym-card-image">
      {partner.avatar ? <img className="photo-card" src={partner.avatar} alt="" loading="lazy" /> : <div className="photo-card partner-image-placeholder">{partner.name.slice(0, 1).toUpperCase()}</div>}
      <span>APROVADO</span>
      <span className="gym-card-arrow" aria-hidden="true"><ArrowUpRight size={16} /></span>
    </Link>
    <div className="gym-card-body">
      <div className="gym-card-title"><h3>{partner.name}</h3><span className="rating">{partner.kind}</span></div>
      <p>{partner.address}{partner.city ? ` · ${partner.city}` : ""}</p>
      {partner.distanceKm != null && <p>{partner.distanceKm.toFixed(1)} km de você</p>}
      {!!partner.modalities.length && <div className="gym-tags">{partner.modalities.slice(0, 3).map(item => <span key={item}>{item}</span>)}</div>}
      <div className="partner-card-actions">
        {mapUrl && <a className="button subtle small-button" href={mapUrl} target="_blank" rel="noreferrer">Abrir no OpenStreetMap <ArrowUpRight size={15} /></a>}
        {appointment && role && <Link className="button primary small-button" to={`/hire/${role}?partner=${partner.profileId}`}>Solicitar horário <ArrowRight size={15} /></Link>}
      </div>
    </div>
  </article>;
}

function LivePassScreen({ client }) {
  const [partners, setPartners] = useState([]);
  const [filter, setFilter] = useState("academia");
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [locationError, setLocationError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadApprovedPartners(client)
      .then(data => { if (active) { setPartners(data); setError(""); } })
      .catch(failure => {
        if (!active) return;
        console.error("Falha ao carregar parceiros aprovados.", failure);
        setError(getErrorMessage(failure, "Não foi possível carregar parceiros."));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client]);

  const shown = orderPartnersByDistance(
    partners.filter(partner => filter === "todos" || partner.kind === filter),
    location,
  );
  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Este navegador não oferece localização.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      position => {
        setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocationError("");
      },
      failure => {
        console.error("Não foi possível obter a localização autorizada.", failure);
        setLocationError(failure.code === failure.PERMISSION_DENIED
          ? "A permissão de localização foi negada. Você ainda pode abrir cada endereço no mapa."
          : "Não foi possível obter sua localização. Tente novamente ou abra um endereço no mapa.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };

  return <Screen title="Parceiros próximos" subtitle="FORTALFY PASS" className="pass-screen">
    <section className="pass-intro"><span className="verified-pill"><ShieldCheck size={15} /> Somente perfis aprovados</span><p>Os endereços e coordenadas são cadastrados pelos próprios parceiros. Nenhum local é inventado.</p></section>
    <div className="social-feed-toolbar">
      <div className="social-filter-tabs">
        {[["academia", "Academias"], ["personal", "Personal"], ["nutricionista", "Nutricionistas"], ["todos", "Todos"]].map(([value, label]) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>)}
      </div>
      <button className="button subtle small-button" onClick={requestLocation}><MapPin size={15} /> Usar minha localização</button>
    </div>
    {locationError && <p className="social-inline-error" role="alert">{locationError}</p>}
    {error && <div className="social-feed-error" role="alert"><CircleAlert size={17} /><span>{error}</span><button onClick={() => window.location.reload()}>Tentar novamente</button></div>}
    {loading && <p className="social-inline-status">Carregando parceiros aprovados…</p>}
    {!loading && !error && !shown.length && <div className="empty-state"><MapPin size={24} /><h3>Nenhum parceiro aprovado nesta categoria</h3><p>Parceiros reais aparecerão aqui após concluírem o cadastro e serem aprovados.</p></div>}
    <div className="gym-cards">{shown.map(partner => <LivePartnerCard key={partner.id} partner={partner} appointment />)}</div>
    <section className="partner-cta"><div><span className="eyebrow">VOCÊ É UM PARCEIRO?</span><h2>Cadastre seu perfil real</h2><p>Seu cadastro ficará oculto ao público até a aprovação da equipe.</p></div><Link to="/partner/manage" className="button lime-button">Gerenciar cadastro <ArrowRight size={17} /></Link></section>
  </Screen>;
}

function PartnerListingManager({ client, session, profile, notify }) {
  const [fields, setFields] = useState({ address: "", latitude: "", longitude: "", modalities: "", websiteUrl: "", contactPhone: "" });
  const [loading, setLoading] = useState(Boolean(session?.user?.id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const partnerAccount = ["personal", "nutricionista", "academia"].includes(profile?.kind);

  useEffect(() => {
    if (!client || !session?.user?.id || !partnerAccount) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    loadOwnPartnerListing(client, session.user.id).then(listing => {
      if (!active || !listing) return;
      setFields({
        address: listing.address,
        latitude: String(listing.latitude),
        longitude: String(listing.longitude),
        modalities: listing.modalities.join(", "),
        websiteUrl: listing.websiteUrl,
        contactPhone: listing.contactPhone,
      });
      setSaved(true);
    }).catch(failure => {
      if (!active) return;
      console.error("Falha ao carregar o cadastro do parceiro.", failure);
      setError(getErrorMessage(failure, "Não foi possível carregar seu cadastro."));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client, session?.user?.id, partnerAccount]);

  const submit = async event => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await savePartnerListing(client, session.user.id, {
        ...fields,
        modalities: fields.modalities.split(","),
      });
      setSaved(true);
      notify("Cadastro salvo. Ele ficará oculto até a aprovação da equipe.");
    } catch (failure) {
      console.error("Falha ao salvar o cadastro do parceiro.", failure);
      setError(getErrorMessage(failure, "Não foi possível salvar o cadastro."));
    } finally {
      setSaving(false);
    }
  };

  return <Screen title="Cadastro de parceiro" subtitle="DADOS REAIS E VERIFICÁVEIS">
    <Link to="/pass" className="back-link"><ArrowLeft size={17} /> Voltar à descoberta</Link>
    {!session?.user?.id ? <section className="dash-panel"><h2>Entre com uma conta de parceiro</h2><p>Faça login ou crie uma conta do tipo academia, personal trainer ou nutricionista.</p><Link to="/profile" className="button primary">Entrar ou criar conta <ArrowRight size={16} /></Link></section>
      : !partnerAccount ? <section className="dash-panel"><h2>Esta conta não é de parceiro</h2><p>O cadastro exige uma conta de academia, personal trainer ou nutricionista. O tipo de conta não pode ser alterado depois.</p></section>
        : loading ? <p className="social-inline-status">Carregando seu cadastro…</p> : <form className="hiring-form" onSubmit={submit}>
          <p>Informe o endereço e as coordenadas exatas. O perfil só aparece na descoberta depois da aprovação.</p>
          <label>Endereço completo<input required maxLength={300} value={fields.address} onChange={event => setFields(current => ({ ...current, address: event.target.value }))} /></label>
          <div className="hiring-form-row"><label>Latitude<input required type="number" step="any" min="-90" max="90" value={fields.latitude} onChange={event => setFields(current => ({ ...current, latitude: event.target.value }))} /></label><label>Longitude<input required type="number" step="any" min="-180" max="180" value={fields.longitude} onChange={event => setFields(current => ({ ...current, longitude: event.target.value }))} /></label></div>
          <label>Modalidades ou serviços<input maxLength={500} value={fields.modalities} onChange={event => setFields(current => ({ ...current, modalities: event.target.value }))} placeholder="Separe por vírgulas" /></label>
          <label>Site (opcional)<input type="url" maxLength={500} value={fields.websiteUrl} onChange={event => setFields(current => ({ ...current, websiteUrl: event.target.value }))} /></label>
          <label>Telefone (opcional)<input type="tel" maxLength={40} value={fields.contactPhone} onChange={event => setFields(current => ({ ...current, contactPhone: event.target.value }))} /></label>
          {error && <p className="hiring-error" role="alert">{error}</p>}
          {saved && <p className="social-inline-status">Cadastro salvo. Aprovação: {profile?.verified ? "aprovado" : "aguardando equipe"}.</p>}
          <button className="button primary wide-button" type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar cadastro real"}</button>
        </form>}
  </Screen>;
}

function LiveHiringScreen({ client, session, notify }) {
  const { role } = useParams();
  const [searchParams] = useSearchParams();
  const kind = role === "personal" ? "personal" : role === "nutritionist" ? "nutricionista" : "";
  const [partners, setPartners] = useState([]);
  const [selectedId, setSelectedId] = useState(searchParams.get("partner") || "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [modality, setModality] = useState("presencial");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    loadApprovedPartners(client, { kind })
      .then(data => { if (active) setPartners(data); })
      .catch(failure => {
        if (!active) return;
        console.error("Falha ao carregar profissionais aprovados.", failure);
        setError(getErrorMessage(failure, "Não foi possível carregar os profissionais."));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client, kind]);

  const selected = partners.find(partner => partner.profileId === selectedId);
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const submit = async event => {
    event.preventDefault();
    if (!session?.user?.id) {
      setError("Entre na sua conta para enviar uma solicitação real.");
      return;
    }
    if (!selected || !date || !time) {
      setError("Escolha um profissional, uma data e um horário.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const startsAt = new Date(`${date}T${time}`).toISOString();
      const { error: bookingError } = await client.from("bookings").insert({
        customer_id: session.user.id,
        professional_id: selected.profileId,
        starts_at: startsAt,
        modality,
        note: note.trim() || null,
      });
      if (bookingError) throw bookingError;
      setDate("");
      setTime("");
      setNote("");
      notify("Solicitação enviada ao profissional. O horário só estará confirmado após resposta.");
    } catch (failure) {
      console.error("Falha ao enviar a solicitação de atendimento.", failure);
      setError(getErrorMessage(failure, "Não foi possível enviar a solicitação."));
    } finally {
      setBusy(false);
    }
  };

  return <Screen title="Agendar atendimento" subtitle="PROFISSIONAIS APROVADOS" className="hiring-screen">
    <Link to="/pass" className="back-link"><ArrowLeft size={17} /> Voltar à descoberta</Link>
    {loading && <p className="social-inline-status">Carregando profissionais…</p>}
    {error && <p className="hiring-error" role="alert">{error}</p>}
    {!loading && !partners.length && <div className="empty-state"><Users size={24} /><h3>Nenhum profissional aprovado</h3><p>Os profissionais reais aparecerão após concluírem o cadastro e receberem aprovação.</p></div>}
    {!!partners.length && <form className="hiring-form" onSubmit={submit}>
      <label>Profissional<select value={selectedId} onChange={event => setSelectedId(event.target.value)} required><option value="">Selecione</option>{partners.map(partner => <option key={partner.profileId} value={partner.profileId}>{partner.name}{partner.city ? ` · ${partner.city}` : ""}</option>)}</select></label>
      {selected && <LivePartnerCard partner={selected} />}
      <div className="hiring-form-row"><label>Data preferida<input required type="date" min={today} value={date} onChange={event => setDate(event.target.value)} /></label><label>Horário preferido<input required type="time" value={time} onChange={event => setTime(event.target.value)} /></label></div>
      <label>Modalidade<select value={modality} onChange={event => setModality(event.target.value)}><option value="presencial">Presencial</option><option value="online">Online</option></select></label>
      <label>Observação opcional<textarea maxLength={2000} rows={3} value={note} onChange={event => setNote(event.target.value)} /></label>
      {!session?.user?.id && <p>Entre com sua conta para enviar a solicitação.</p>}
      <button className="button primary wide-button" type="submit" disabled={busy}>{busy ? "Enviando…" : "Enviar solicitação real"}</button>
    </form>}
  </Screen>;
}

function LivePartnerScreen({ client }) {
  const { type } = useParams();
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isList = ["gym", "personal", "nutritionist"].includes(type);
  const kind = type === "gym" ? "academia" : type === "personal" ? "personal" : type === "nutritionist" ? "nutricionista" : "";

  useEffect(() => {
    let active = true;
    loadApprovedPartners(client, { kind })
      .then(data => { if (active) setPartners(data); })
      .catch(failure => {
        if (!active) return;
        console.error("Falha ao carregar o parceiro.", failure);
        setError(getErrorMessage(failure, "Não foi possível carregar este parceiro."));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client, kind]);

  const listing = isList ? null : partners.find(partner => partner.profileId === type);
  const items = isList ? partners : listing ? [listing] : [];
  return <Screen title={listing?.name || (isList ? "Parceiros aprovados" : "Parceiro não encontrado")} subtitle="PERFIL PÚBLICO" className="partner-screen">
    <Link to="/pass" className="back-link"><ArrowLeft size={17} /> Voltar à descoberta</Link>
    {loading && <p className="social-inline-status">Carregando dados verificados…</p>}
    {error && <p className="social-inline-error" role="alert">{error}</p>}
    {!loading && !error && !items.length && <div className="empty-state"><MapPin size={24} /><h3>Nenhum perfil público disponível</h3><p>Este parceiro ainda não existe ou não recebeu aprovação.</p></div>}
    {listing && <section className="partner-summary"><div><span className="verified-pill"><ShieldCheck size={15} /> Aprovado pela equipe</span><h2>{listing.name}</h2><p>{listing.bio}</p></div><LivePartnerCard partner={listing} appointment /></section>}
    {isList && <div className="gym-cards">{items.map(partner => <LivePartnerCard key={partner.id} partner={partner} appointment />)}</div>}
  </Screen>;
}

function AppContent() {
  const [toast, setToast] = useState("");
  const [authSession, setAuthSession] = useState(null);
  const [socialProfile, setSocialProfile] = useState(null);
  const [socialProfileError, setSocialProfileError] = useState("");
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [activity, setActivity] = useState(() => normalizeActivity(loadLocalValue(ACTIVITY_STORAGE_KEY, null)));
  const [shopCart, setShopCart] = useState(loadShopCart);
  const [savedArts, setSavedArts] = useState([]);
  const [studioArtwork, setStudioArtwork] = useState(null);
  const [feedArts, setFeedArts] = useState([]);
  const [profileDetails, setProfileDetails] = useState(() => ({ ...makeDefaultProfile(), ...loadLocalValue(PROFILE_STORAGE_KEY, {}) }));
  const [profilePosts, setProfilePosts] = useState(() => {
    const saved = loadLocalValue(PROFILE_POSTS_STORAGE_KEY, []);
    return Array.isArray(saved) ? saved : [];
  });
  const [feedComments, setFeedComments] = useState(() => {
    const saved = loadLocalValue(PROFILE_FEED_COMMENTS_STORAGE_KEY, {});
    return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  });
  const location = useLocation();
  const notify = message => setToast(message);

  useEffect(() => {
    try {
      window.sessionStorage.removeItem("fortalfy_demo_session");
    } catch {
      // ignore
    }
  }, []);

  const handleSignOut = async () => {
    try {
      window.sessionStorage.removeItem("fortalfy_demo_session");
      if (supabase) await supabase.auth.signOut();
    } catch {
      // ignore
    }
    setAuthSession(null);
    setSocialProfile(null);
    setToast("Você saiu da conta.");
  };

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        console.error("Não foi possível recuperar a sessão do Supabase.", error);
        notify(getErrorMessage(error, "Não foi possível recuperar sua sessão."));
        return;
      }
      if (data.session) setAuthSession(data.session);
    }).catch(error => {
      if (!active) return;
      console.error("Falha ao recuperar a sessão do Supabase.", error);
      notify(getErrorMessage(error, "Não foi possível recuperar sua sessão."));
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setAuthSession(session);
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      if (!session) setSocialProfile(null);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    const userId = authSession?.user?.id;
    if (!userId) {
      setSocialProfile(null);
      setSocialProfileError("");
      return undefined;
    }
    if (isDemoUser(userId)) {
      setAuthSession(null);
      setSocialProfile(null);
      setSocialProfileError("");
      return undefined;
    }
    if (!supabase) return undefined;
    let active = true;
    loadProfile(supabase, userId)
      .then(profile => {
        if (!active) return;
        setSocialProfile(profile);
        setSocialProfileError("");
      })
      .catch(error => {
        if (!active) return;
        console.error("Não foi possível carregar o perfil da conta.", error);
        const message = getErrorMessage(error, "Não foi possível carregar o perfil da conta.");
        setSocialProfileError(message);
        setToast(message);
      });
    return () => { active = false; };
  }, [authSession?.user?.id]);
  const refreshSocialProfile = async () => {
    if (!supabase || !authSession?.user?.id) return;
    try {
      const updated = await loadProfile(supabase, authSession.user.id);
      setSocialProfile(updated);
      setSocialProfileError("");
      return updated;
    } catch (error) {
      console.error("Não foi possível atualizar o perfil da conta.", error);
      const message = getErrorMessage(error, "Não foi possível carregar o perfil da conta.");
      setSocialProfileError(message);
      throw error;
    }
  };
  const retrySocialProfile = async () => {
    try {
      await refreshSocialProfile();
    } catch {
      // refreshSocialProfile reports the failure in the visible profile state.
    }
  };
  const savePosts = nextPosts => {
    try {
      window.localStorage.setItem(PROFILE_POSTS_STORAGE_KEY, JSON.stringify(nextPosts));
      setProfilePosts(nextPosts);
      return true;
    } catch (error) {
      console.error("Não foi possível salvar as publicações neste aparelho.", error);
      notify("Não foi possível salvar neste aparelho. Libere espaço e tente novamente; o conteúdo atual continua aberto.");
      return false;
    }
  };
  const saveFeedComments = nextComments => {
    try {
      window.localStorage.setItem(PROFILE_FEED_COMMENTS_STORAGE_KEY, JSON.stringify(nextComments));
      setFeedComments(nextComments);
      return true;
    } catch (error) {
      console.error("Não foi possível salvar comentários neste aparelho.", error);
      notify("Não foi possível salvar o comentário neste aparelho. Libere espaço e tente novamente.");
      return false;
    }
  };
  const shareToProfile = (source, shared) => {
    const sharedFromId = source.sourceId;
    const existing = profilePosts.find(post => post.sharedFromId === sharedFromId);
    if (shared && existing) return true;
    if (!shared) return savePosts(profilePosts.filter(post => post.sharedFromId !== sharedFromId));
    const sharedPost = {
      id: `shared:${sharedFromId}`,
      sharedFromId,
      sharedFrom: source.author,
      text: source.text,
      image: source.image || "",
      imageAlt: source.imageAlt || "",
      createdAt: new Date().toISOString(),
      shared: true,
      liked: false,
      comments: feedComments[sharedFromId] || [],
    };
    return savePosts([sharedPost, ...profilePosts]);
  };
  const updateActivity = (kind, detail) => setActivity(current => {
    if (kind === "water") return normalizeActivity({ ...current, waterMl: current.waterMl + 250 });
    if (kind === "workout") return normalizeActivity({
      ...current,
      workoutsLogged: current.workoutsLogged + 1,
      workoutEntries: [...current.workoutEntries, detail],
    });
    if (kind === "meal") return normalizeActivity({ ...current, mealEntries: [...current.mealEntries, detail] });
    if (kind === "removeMeal") return normalizeActivity({ ...current, mealEntries: current.mealEntries.filter(meal => meal.id !== detail) });
    return current;
  });
  useEffect(() => {
    const listener = event => setToast(event.detail);
    window.addEventListener("fortalfy-toast", listener);
    return () => window.removeEventListener("fortalfy-toast", listener);
  }, []);
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setShowSplash(false), reducedMotion ? 900 : 6500);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(activity));
    } catch (error) {
      console.error("Não foi possível persistir os registros de rotina neste dispositivo.", error);
      setToast("O registro está visível, mas não pôde ser salvo neste navegador.");
    }
  }, [activity]);
  useEffect(() => {
    try {
      window.localStorage.setItem(SHOP_CART_STORAGE_KEY, JSON.stringify(shopCart));
    } catch (error) {
      console.error("Não foi possível persistir a sacola da FortalShop neste dispositivo.", error);
      setToast("A sacola está visível, mas não pôde ser salva neste navegador.");
    }
  }, [shopCart]);
  const mobilePaths = ["/home", "/feed", "/reels", "/people", "/messages", "/food", "/pass", "/profile", "/workout", "/nutrition", "/curated", "/progress", "/academy", "/live", "/partner/gym", "/shop", "/studio"];
  const mobile = mobilePaths.includes(location.pathname) || location.pathname.startsWith("/hire/");
  return <div className={mobile ? "mobile-app" : "professional-root"}>
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/home" element={<HomeScreen activity={activity} onActivity={updateActivity} session={authSession} profile={socialProfile} />} />
      <Route path="/feed" element={<Screen title="Comunidade" subtitle="BEM-ESTAR EM CONEXÃO" className="feed-screen"><section className="community-promo"><img src={fortalfyAsset("publicidade", "04-feed-comunidade.jpg")} alt="" aria-hidden="true" /><div><span className="eyebrow">COMUNIDADE FORTALFY</span><h2>Seu bem-estar também se constrói junto.</h2><p>Conteúdo real aparece quando publicado por pessoas da comunidade.</p></div></section>{authSession?.user?.id && socialProfile && <StoryExperience user={socialProfile} notify={notify} />}<SocialFeed client={supabase} configured={isSupabaseConfigured} session={authSession} profile={socialProfile} profileError={socialProfileError} feedArts={feedArts} notify={notify} recovery={passwordRecovery} onRecovered={() => setPasswordRecovery(false)} onRetryProfile={retrySocialProfile} /></Screen>} />
      <Route path="/reels" element={<Screen title="Reels" subtitle="VÍDEOS DA COMUNIDADE" className="feed-screen reels-screen"><SocialFeed client={supabase} configured={isSupabaseConfigured} session={authSession} profile={socialProfile} profileError={socialProfileError} notify={notify} recovery={passwordRecovery} onRecovered={() => setPasswordRecovery(false)} onRetryProfile={retrySocialProfile} mediaType="video" /></Screen>} />
      <Route path="/people" element={<Screen title="Pessoas" subtitle="DESCUBRA A COMUNIDADE" className="feed-screen people-screen"><SocialPeople client={supabase} configured={isSupabaseConfigured} session={authSession} notify={notify} /></Screen>} />
      <Route path="/messages" element={<Screen title="Mensagens" subtitle="CONVERSAS PRIVADAS" className="feed-screen messages-screen"><SocialMessages client={supabase} configured={isSupabaseConfigured} session={authSession} notify={notify} /></Screen>} />
      <Route path="/food" element={<FoodScreen client={supabase} configured={isSupabaseConfigured} session={authSession} />} />
      <Route path="/pass" element={<LivePassScreen client={supabase} />} />
      <Route path="/profile" element={<Screen title="Meu perfil" subtitle="SUA JORNADA NA COMUNIDADE"><SocialProfile client={supabase} session={authSession} profile={socialProfile} profileError={socialProfileError} configured={isSupabaseConfigured} notify={notify} onProfileUpdated={refreshSocialProfile} recovery={passwordRecovery} onRecovered={() => setPasswordRecovery(false)} onRetryProfile={retrySocialProfile} onSignOut={handleSignOut} /></Screen>} />
      <Route path="/profile/:profileId" element={<Screen title="Perfil" subtitle="COMUNIDADE FORTALFY"><SocialProfile client={supabase} session={authSession} profile={socialProfile} profileError={socialProfileError} configured={isSupabaseConfigured} notify={notify} onProfileUpdated={refreshSocialProfile} recovery={passwordRecovery} onRecovered={() => setPasswordRecovery(false)} onRetryProfile={retrySocialProfile} onSignOut={handleSignOut} /></Screen>} />
      <Route path="/profile/local" element={<Navigate to="/profile" replace />} />
      <Route path="/workout" element={<WorkoutScreen notify={notify} onActivity={updateActivity} activity={activity} />} />
      <Route path="/nutrition" element={<NutritionScreen notify={notify} onActivity={updateActivity} activity={activity} />} />
      <Route path="/curated" element={<Navigate to="/food" replace />} />
      <Route path="/progress" element={<ProgressScreen activity={activity} />} />
      <Route path="/academy" element={<AcademyScreen />} />
      <Route path="/live" element={<LiveScreen notify={notify} />} />
      <Route path="/partner/manage" element={<PartnerListingManager client={supabase} session={authSession} profile={socialProfile} notify={notify} />} />
      <Route path="/partner/:type" element={<LivePartnerScreen client={supabase} />} />
      <Route path="/hire/:role" element={<LiveHiringScreen key={location.pathname} client={supabase} session={authSession} notify={notify} />} />
      <Route path="/shop" element={<FortalShop cart={shopCart} setCart={setShopCart} notify={notify} />} />
      <Route path="/studio" element={<FortalfyStudio artwork={studioArtwork} setArtwork={setStudioArtwork} savedArts={savedArts} setSavedArts={setSavedArts} setFeedArts={setFeedArts} notify={notify} />} />
      <Route path="/trainer" element={<Dashboard key="trainer" role="trainer" notify={notify} />} />
      <Route path="/nutritionist" element={<Dashboard key="nutritionist" role="nutritionist" notify={notify} />} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
    {supabase && authSession?.user?.id && !isDemoUser(authSession.user.id) && (
      <OnboardingGate
        client={supabase}
        userId={authSession.user.id}
        configured={isSupabaseConfigured}
        notify={notify}
        onSignOut={handleSignOut}
      />
    )}
    <Toast message={toast} onClose={() => setToast("")} />
    {showSplash && <SplashScreen onClose={() => setShowSplash(false)} />}
  </div>;
}

export default function App() {
  return <AppContent />;
}
