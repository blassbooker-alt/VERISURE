import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Activity, Apple, ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, Camera,
  Bell, Bookmark, CalendarDays, Check, ChevronDown, ChevronRight, CircleAlert, Download,
  CircleHelp, Clock3, Dumbbell, Flame, Heart, Home, Info, Lock, MapPin, MessageCircle,
  ImagePlus, PencilLine, Play, Plus, Search, Send, Share2, ShieldCheck,
  Globe2, Phone, ShoppingBag, SlidersHorizontal, Sparkles, Star, Target, Ticket, Timer, Trash2, UserMinus, UserPlus, Users, Utensils, Wallet, X,
} from "lucide-react";
const Dashboard = lazy(() => import("./Dashboards.jsx"));
const ProfessionalPortal = lazy(() => import("./ProfessionalPortal.jsx"));
const BenefitsTerms = lazy(() => import("./BenefitsTerms.jsx"));
const GymCheckInPage = lazy(() => import("./GymAccess.jsx").then(module => ({ default: module.GymCheckInPage })));
const GymPartnerCheckinsPage = lazy(() => import("./GymAccess.jsx").then(module => ({ default: module.GymPartnerCheckinsPage })));
const GymPlateAdminPage = lazy(() => import("./GymAccess.jsx").then(module => ({ default: module.GymPlateAdminPage })));
import Brand from "./Brand.jsx";
import CreatorGallery from "./CreatorGallery.jsx";
import SponsoredCreative from "./SponsoredCreative.jsx";
import { credibilityPackAsset } from "./assetPath.js";
import BottomNav, { NavigationDrawer } from "./MobileNavigation.jsx";
const FortalShop = lazy(() => import("./FortalShop.jsx"));
const FortalfyStudio = lazy(() => import("./FortalfyStudio.jsx"));
const FortalCreator = lazy(() => import("./FortalCreator.jsx"));
const PerformanceDashboard = lazy(() => import("./PerformanceDashboard.jsx"));
const ThemeSettings = lazy(() => import("./ThemeSettings.jsx"));
const AccessibilitySettings = lazy(() => import("./AccessibilitySettings.jsx"));
const NotificationSettings = lazy(() => import("./NotificationSettings.jsx"));
const StoryExperience = lazy(() => import("./Stories.jsx"));
const WeeklyClientPlan = lazy(() => import("./WeeklyPlans.jsx").then(module => ({ default: module.WeeklyClientPlan })));
const OnboardingGate = lazy(() => import("./SocialScreens.jsx").then(module => ({ default: module.OnboardingGate })));
const SocialFeed = lazy(() => import("./SocialScreens.jsx").then(module => ({ default: module.SocialFeed })));
const SocialMessages = lazy(() => import("./SocialScreens.jsx").then(module => ({ default: module.SocialMessages })));
const ProfessionalsDirectory = lazy(() => import("./ProfessionalsDirectory.jsx"));
const NutritionistDirectory = lazy(() => import("./NutritionistDirectory.jsx"));
const PersonalDirectory = lazy(() => import("./PersonalDirectory.jsx"));
const SocialProfile = lazy(() => import("./SocialScreens.jsx").then(module => ({ default: module.SocialProfile })));
import {
  cancelFollowRequest, getErrorMessage, isDemoUser, loadFollowStates, loadProfile,
  setFollow as persistFollow,
} from "./socialService.js";
import { loadAccountActivity, recordAccountActivity } from "./activityService.js";
import {
  loadApprovedPartners, loadOwnPartnerListing, openStreetMapUrl,
  orderPartnersByDistance, savePartnerListing,
} from "./partnerService.js";
import { adPackAsset, brandCampaignAsset, fortalfyAsset, visualPackAsset } from "./assetPath.js";
import { isSupabaseConfigured, supabase } from "./supabaseClient.js";
import { gyms, profile } from "./data.js";
import { localDateKey, mealsForDate, normalizeMealEntries, sumMealCalories } from "./appLogic.js";
import { loadAvailableFoodMenu } from "./foodService.js";
import { loadCreatorCourses, loadCreatorLives, loadMyCreatorLiveRegistrations, loadPublicCreatorLiveCatalog, registerCreatorLive } from "./creatorProgramService.js";
import { applyThemePreference, getAccountThemePreference, readThemePreference, saveThemePreference } from "./themeService.js";
import {
  applyAccessibilityPreferences, DEFAULT_ACCESSIBILITY_PREFERENCES, getAccountAccessibilityPreferences,
  normalizeAccessibilityPreferences, readAccessibilityPreferences, saveAccessibilityPreferences,
} from "./accessibilityService.js";
import { loadNotificationPreferences, loadNotifications, markAllNotificationsRead as markAllRemoteNotificationsRead, markConversationNotificationsRead, markNotificationRead as markRemoteNotificationRead, notificationErrorMessage, notificationFromRow, playNotificationSound } from "./notificationService.js";
import { installInterfaceSoundInteractions } from "./uiSoundService.js";

function Toast({ message, onClose }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(onClose, 3200);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);
  if (!message) return null;
  return <div className="toast-message" role="status"><Check size={17} />{message}<button aria-label="Fechar aviso" onClick={onClose}><X size={16} /></button></div>;
}

const NOTIFICATIONS_STORAGE_KEY = "fortalfy.notifications.local.v1";
const APP_NOTIFICATION_TYPES = new Set([
  "post_like", "post_comment", "post_share", "message", "workout_reminder",
  "nutritionist_message", "personal_message", "shop", "product_delivery",
  "food_delivery", "official_promotion", "social.like", "social.comment", "social.reply",
  "social.mention", "social.follow", "chat.message", "workout.schedule_changed",
  "partner.request_accepted", "professional.approved", "professional.review_update",
  "shop.order_update", "account.security", "system.important",
]);
const APP_NOTIFICATION_LABELS = {
  post_like: "Curtida", post_comment: "Comentário", post_share: "Compartilhamento",
  message: "Mensagem", workout_reminder: "Lembrete de treino",
  nutritionist_message: "Nutricionista", personal_message: "Personal",
  shop: "FortalShop", product_delivery: "Entrega de produto", food_delivery: "Entrega de comida",
  official_promotion: "Promoção oficial", "social.like": "Curtida", "social.comment": "Comentário",
  "social.reply": "Resposta", "social.mention": "Menção", "social.follow": "Novo seguidor",
  "chat.message": "Mensagem", "workout.schedule_changed": "Agendamento",
  "partner.request_accepted": "FortalPass", "professional.approved": "Cadastro profissional",
  "professional.review_update": "Cadastro profissional", "shop.order_update": "Pedido da loja",
  "account.security": "Segurança", "system.important": "Aviso importante",
};
const NotificationContext = createContext({ open: () => {}, unreadCount: 0, push: () => {} });
const InstallAppContext = createContext({ isAppInstalled: false, startInstall: () => {} });

function NotificationCenter({ notifications, onClose, onRead, onReadAll, onClear, onNavigate, loading = false, error = "", onRetry, page = false }) {
  const [filter, setFilter] = useState("all");
  useEffect(() => {
    const closeOnEscape = event => event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const filteredNotifications = notifications.filter(item => {
    if (filter === "unread") return !item.read;
    if (filter === "social") return item.type.startsWith("social.") || item.type.startsWith("post_");
    if (filter === "messages") return item.type === "chat.message" || item.type === "message";
    if (filter === "training") return item.type.startsWith("workout.") || item.type === "workout_reminder";
    if (filter === "account") return ["shop.order_update", "shop", "product_delivery", "food_delivery", "professional.approved", "professional.review_update", "partner.request_accepted", "account.security", "system.important"].includes(item.type);
    return true;
  });
  const filters = [["all", "Todas"], ["unread", "Não lidas"], ["social", "Comunidade"], ["messages", "Mensagens"], ["training", "Treinos"], ["account", "Conta e pedidos"]];
  return <div className={page ? "notification-center-page" : "notification-center-scrim"} role={page ? undefined : "presentation"} onMouseDown={event => !page && event.target === event.currentTarget && onClose()}>
    <section className={`notification-center${page ? " notification-center-full-page" : ""}`} role={page ? "region" : "dialog"} aria-modal={page ? undefined : "true"} aria-labelledby="notification-center-title">
      <header><div><span className="eyebrow">FORTALFY</span><h2 id="notification-center-title">Notificações</h2><p>Avisos recentes deste app e aparelho.</p>{!page && <button type="button" className="notification-full-page-link" onClick={() => { onClose(); onNavigate?.("/notifications"); }}>Abrir central completa <ArrowRight size={14} /></button>}</div><button className="icon-button" aria-label="Fechar notificações" onClick={onClose}><X size={19} /></button></header>
      {!!notifications.length && <><div className="notification-center-filters" role="group" aria-label="Filtrar avisos">{filters.map(([key, label]) => <button key={key} type="button" className={filter === key ? "is-active" : ""} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div><div className="notification-center-actions"><button type="button" onClick={onReadAll}>Marcar todas como lidas</button>{onClear && <button type="button" onClick={onClear}>Limpar avisos locais</button>}</div></>}
      {loading && <div className="notification-loading" role="status">Carregando notificações…</div>}
      {error && <div className="notification-load-error" role="alert">{error}{onRetry && <button type="button" onClick={onRetry}>Tentar novamente</button>}</div>}
      {!loading && !error && !notifications.length ? <div className="notification-center-empty"><Bell size={24} /><strong>Tudo em dia</strong><span>Os avisos importantes do app aparecerão aqui.</span></div> : !loading && !error && !filteredNotifications.length ? <div className="notification-center-empty"><Bell size={24} /><strong>Nenhum aviso nesta categoria</strong><span>Escolha outra categoria para continuar.</span></div> : <ol className="notification-center-list">{[...filteredNotifications].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()).map(item => <li key={item.id} className={item.read ? "is-read" : "is-unread"}>
        <span className="notification-center-icon"><Bell size={16} /></span><button className="notification-content-button" type="button" onClick={() => { onRead(item.id); onNavigate?.(item.targetRoute || "/home"); onClose(); }}><strong>{item.title}</strong><p>{item.message}</p><small>{APP_NOTIFICATION_LABELS[item.type] || "Fortalfy"}{item.groupCount > 1 ? ` · ${item.groupCount} atividades` : ""}</small><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</time></button>
        {!item.read && <button type="button" aria-label="Marcar como lida" onClick={() => onRead(item.id)}><span /></button>}
      </li>)}</ol>}
      <p className="notification-center-note">Push fora do app requer permissão e suporte do navegador. Preferências e avisos persistidos ficam associados à sua conta Fortalfy.</p>
    </section>
  </div>;
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


function InstallHelpDialog({ onClose }) {
  return <div className="install-help-scrim" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="install-help-card" role="dialog" aria-modal="true" aria-labelledby="install-help-title">
      <button type="button" className="install-help-close" aria-label="Fechar instru&ccedil;&otilde;es" onClick={onClose}><X size={19} /></button>
      <span className="install-help-icon"><Download size={22} /></span>
      <span className="eyebrow">FORTALFY NO SEU CELULAR</span>
      <h2 id="install-help-title">Adicione o app &agrave; sua tela inicial</h2>
      <p>Instale a Fortalfy para abrir em tela cheia e acessar mais r&aacute;pido.</p>
      <ol><li><strong>iPhone ou iPad:</strong> toque em <b>Compartilhar</b> no Safari e escolha <b>Adicionar &agrave; Tela de In&iacute;cio</b>.</li><li><strong>Android:</strong> abra o menu <b>&#8942;</b> do navegador e toque em <b>Instalar app</b> ou <b>Adicionar &agrave; tela inicial</b>.</li></ol>
      <button type="button" className="button primary install-help-done" onClick={onClose}>Entendi</button>
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

function MobileHeader({ location = "", action, onNotificationsOpen, notificationCount = 0, desktopMenuOpen, onDesktopMenuOpenChange, hideNavigation = false }) {
  return <header className={`mobile-header${hideNavigation ? " compact-mobile-header" : ""}`}><NavigationDrawer desktopOpen={desktopMenuOpen} onDesktopOpenChange={onDesktopMenuOpenChange} /><Link to="/home" aria-label="Fortalfy, página inicial"><Brand /></Link>
    {location && <button type="button" className="location-chip" onClick={action} aria-label={location ? `Alterar região: ${location}` : "Definir região"}><MapPin size={15} /><span>{location}</span><ChevronDown size={14} /></button>}
    {hideNavigation && <Link to="/people" className="feed-header-search icon-button" aria-label="Encontrar pessoas"><Search size={19} /></Link>}
    <button className="icon-button notification-bell" aria-label={notificationCount ? `Notificações, ${notificationCount} não lidas` : "Notificações"} onClick={onNotificationsOpen}><Bell size={20} />{notificationCount > 0 && <span className="notification-bell-count">{notificationCount > 9 ? "9+" : notificationCount}</span>}</button>
  </header>;
}

function readDesktopNavigationPreference() {
  try { return window.localStorage.getItem("fortalfy.desktop-nav-expanded") !== "false"; }
  catch { return true; }
}

function Screen({ children, title, subtitle, location = false, className = "", action, immersive = false, compactHeader = false }) {
  const notifications = useContext(NotificationContext);
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(() => window.matchMedia("(min-width: 1024px)").matches && readDesktopNavigationPreference());
  useEffect(() => {
    const desktopBreakpoint = window.matchMedia("(min-width: 1024px)");
    const syncNavigationWithViewport = () => setDesktopMenuOpen(desktopBreakpoint.matches && readDesktopNavigationPreference());
    desktopBreakpoint.addEventListener?.("change", syncNavigationWithViewport);
    return () => desktopBreakpoint.removeEventListener?.("change", syncNavigationWithViewport);
  }, [compactHeader]);
  return <div className={`app-screen${immersive ? " immersive-screen" : ""}${desktopMenuOpen ? " navigation-expanded" : ""}`}>
    {!immersive && <MobileHeader location={location === true ? "" : location} action={action} onNotificationsOpen={notifications.open} notificationCount={notifications.unreadCount} desktopMenuOpen={desktopMenuOpen} onDesktopMenuOpenChange={value => { setDesktopMenuOpen(value); try { window.localStorage.setItem("fortalfy.desktop-nav-expanded", String(value)); } catch { /* Keep the navigation usable when storage is blocked. */ } }} hideNavigation={compactHeader} />}
    <main className={`screen-content ${className}`}>
      {title && !immersive && <div className="screen-heading"><div>{subtitle && <span className="eyebrow">{subtitle}</span>}<h1>{title}</h1></div></div>}
      {children}
    </main>
    {!immersive && <BottomNav desktopExpanded={desktopMenuOpen} onNotificationsOpen={notifications.open} />}
  </div>;
}

function PublicLanding() {
  const journeys = [
    { title: "Movimento", detail: "Treino", image: "fortalfy-pack-training-card.jpg", alt: "Pessoa treinando em um estúdio claro e acolhedor", to: "/workout", icon: Dumbbell },
    { title: "Profissionais", detail: "Acompanhamento", image: "fortalfy-pack-professional-consultation.jpg", alt: "Profissional conversa com uma aluna em um ambiente iluminado", to: "/pass", icon: BadgeCheck },
    { title: "Alimentação", detail: "Rotina", image: "fortalfy-pack-food-breakfast.jpg", alt: "Café da manhã colorido preparado com frutas e alimentos frescos", to: "/food", icon: Utensils },
  ];
  const experiences = [
    { title: "Movimento", description: "Encontre uma forma de se movimentar que combine com seu momento.", image: "fortalfy-pack-training-pilates.jpg", alt: "Pessoa praticando pilates em um estúdio de luz natural", to: "/workout", label: "TREINO" },
    { title: "Profissionais", description: "Conheça academias e parceiros com cadastro aprovado.", image: "fortalfy-pack-professional-team.jpg", alt: "Profissionais de bem-estar em um espaço de atendimento", to: "/pass", label: "FORTALPASS" },
    { title: "Alimentação", description: "Descubra opções e cardápios compartilhados por parceiros.", image: "fortalfy-pack-food-card.jpg", alt: "Refeição equilibrada com vegetais frescos e proteínas", to: "/food", label: "FORTALFOOD" },
    { title: "Comunidade", description: "Inspire-se, compartilhe experiências e siga no seu próprio ritmo.", image: "fortalfy-pack-community-card.jpg", alt: "Grupo diverso compartilhando um momento de bem-estar", to: "/feed", label: "FORTALFY COMUNIDADE" },
  ];
  const scrollToSection = (event, sectionId) => {
    event.preventDefault();
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  };
  return <main className="public-landing">
    <header className="public-header">
      <Link to="/" aria-label="Fortalfy, página inicial"><Brand /></Link>
      <nav aria-label="Navegação institucional">
        <a href="#jornada" onClick={event => scrollToSection(event, "jornada")}>Como funciona</a>
        <a href="#profissionais" onClick={event => scrollToSection(event, "profissionais")}>Profissionais</a>
        <a href="#experiencias" onClick={event => scrollToSection(event, "experiencias")}>Experiências</a>
      </nav>
      <div className="public-header-actions">
        <Link to="/feed" className="public-login-link">Entrar</Link>
        <Link to="/feed" className="button primary public-header-start">Começar agora <ArrowRight size={16} /></Link>
      </div>
    </header>
    <section className="public-hero" aria-labelledby="public-hero-title">
      <img className="public-hero-image" src={visualPackAsset("fortalfy-pack-hero-training.jpg")} alt="Mulher se exercita em um estúdio claro, com espaço aberto e luz natural" fetchpriority="high" decoding="async" />
      <div className="public-hero-copy">
        <span className="public-hero-kicker"><Activity size={15} /> BEM-ESTAR, NO SEU RITMO</span>
        <h1 id="public-hero-title">Seu bem-estar começa <span>no próximo passo.</span></h1>
        <p>Treine, encontre profissionais, cuide da alimentação e acompanhe sua evolução em uma experiência feita para o seu ritmo.</p>
        <div className="public-hero-actions">
          <Link to="/feed" className="button primary">Começar agora <ArrowRight size={17} /></Link>
          <Link to="/pass" className="button subtle">Encontrar um profissional</Link>
        </div>
        <div className="public-value-points"><ShieldCheck size={17} /><span>Treino, alimentação e comunidade em um só lugar.</span></div>
      </div>
      <div className="public-hero-photo-note"><span aria-hidden="true" /><span>Um começo possível, do seu jeito.</span></div>
    </section>
    <section className="public-how-section" id="jornada" aria-labelledby="public-journey-title">
      <div className="public-section-heading">
        <span className="eyebrow">UM PASSO DE CADA VEZ</span>
        <h2 id="public-journey-title">Cuidado que cabe na sua vida.</h2>
        <p>Escolha por onde começar. O resto pode vir no seu tempo.</p>
      </div>
      <div className="public-benefit-grid">
        {journeys.map(({ title, detail, image, alt, to, icon: Icon }, index) => <Link to={to} className="public-benefit-card" key={title}>
          <img src={visualPackAsset(image)} alt={alt} loading="lazy" decoding="async" />
          <span className="public-benefit-number">0{index + 1}</span>
          <span className="public-benefit-copy"><Icon size={17} /><small>{detail}</small><strong>{title}</strong><ArrowUpRight size={17} aria-hidden="true" /></span>
        </Link>)}
      </div>
    </section>
    <section className="public-professional-section" id="profissionais" aria-labelledby="public-professional-title">
      <div className="public-professional-photo">
        <img src={visualPackAsset("fortalfy-pack-professional-coaching.jpg")} alt="Profissional orienta uma aluna durante um treino em um estúdio iluminado" loading="lazy" decoding="async" />
        <span><BadgeCheck size={16} /> Cadastro de parceiros analisado</span>
      </div>
      <div className="public-professional-copy">
        <span className="eyebrow">CONFIANÇA EM PRIMEIRO LUGAR</span>
        <h2 id="public-professional-title">Encontre apoio para seguir no seu ritmo.</h2>
        <p>Explore academias, estúdios e profissionais parceiros. A Fortalfy analisa os cadastros antes de apresentar parceiros na plataforma.</p>
        <Link to="/pass" className="public-professional-link">Encontrar um profissional <ArrowRight size={17} /></Link>
      </div>
    </section>
    <section className="public-experiences-section" id="experiencias" aria-labelledby="public-experiences-title">
      <div className="public-section-heading public-section-heading-left">
        <span className="eyebrow">FORTALFY, POR INTEIRO</span>
        <h2 id="public-experiences-title">Tudo se conecta. Você escolhe o caminho.</h2>
        <p>Recursos para acompanhar uma rotina de bem-estar mais simples e possível.</p>
      </div>
      <div className="public-experience-grid">{experiences.map(item => <Link to={item.to} className="public-experience-card" key={item.title}>
        <img src={visualPackAsset(item.image)} alt={item.alt} loading="lazy" decoding="async" />
        <span><small>{item.label}</small><strong>{item.title}</strong><span>{item.description}</span><i aria-hidden="true"><ArrowUpRight size={17} /></i></span>
      </Link>)}</div>
    </section>
    <section className="public-final-cta" id="sobre" aria-labelledby="public-final-title">
      <img src={visualPackAsset("fortalfy-pack-outdoor-wellness.jpg")} alt="Pessoas se movimentam juntas ao ar livre em um parque ao fim da tarde" loading="lazy" decoding="async" />
      <div className="public-final-copy">
        <span className="eyebrow">NO SEU TEMPO. DO SEU JEITO.</span>
        <h2 id="public-final-title">Seu próximo passo começa agora.</h2>
        <p>Pequenos passos também fazem parte de uma jornada.</p>
        <div className="public-hero-actions">
          <Link to="/feed" className="button primary">Começar agora <ArrowRight size={17} /></Link>
          <Link to="/pass" className="public-final-link">Encontrar um profissional</Link>
        </div>
      </div>
    </section>
    <footer className="public-footer">
      <Link to="/" aria-label="Fortalfy, início"><Brand /></Link>
      <span>Seu bem-estar, no seu ritmo.</span>
      <nav aria-label="Links institucionais"><Link to="/benefits-terms">Termos e benefícios</Link><a href="mailto:fortalfy@gmail.com">Suporte</a></nav>
      <small>© {new Date().getFullYear()} Fortalfy</small>
    </footer>
  </main>;
}
function SectionTitle({ title, action, to }) {
  return <div className="section-title-row"><h2>{title}</h2>{action && <Link to={to || "/pass"} className="text-link">{action}<ArrowRight size={15} /></Link>}</div>;
}

function PhotoCard({ image, alt, className = "" }) {
  return <img className={`photo-card ${className}`} src={image} alt={alt} loading="lazy" />;
}

const HOME_BRAND_CAMPAIGNS = [
  ["fortalfy_gym_01_treino.jpg", "Treino de for\u00e7a"],
  ["fortalfy_gym_02_whey.jpg", "Whey para sua rotina"],
  ["fortalfy_gym_03_pre_treino.jpg", "Ligue o modo treino"],
  ["fortalfy_gym_04_forca.jpg", "For\u00e7a e controle"],
  ["fortalfy_gym_05_creatina.jpg", "Creatina e consist\u00eancia"],
  ["fortalfy_gym_06_shaker.jpg", "Shaker Fortalfy"],
  ["fortalfy_gym_07_legday.jpg", "Dia de perna"],
  ["fortalfy_gym_08_whey_shake.jpg", "Recupera\u00e7\u00e3o com whey"],
  ["fortalfy_gym_09_motivacao.jpg", "Const\u00e2ncia todos os dias"],
  ["fortalfy_gym_10_barras.jpg", "Carga, foco e repeti\u00e7\u00f5es"],
  ["fortalfy_gym_11_superiores.jpg", "Treino com prop\u00f3sito"],
  ["fortalfy_gym_12_pos_treino.jpg", "Recupere depois do treino"],
  ["fortalfy_gym_13_acessorios.jpg", "Acess\u00f3rios para treinar"],
  ["fortalfy_gym_14_hiit.jpg", "Intensidade no seu ritmo"],
  ["fortalfy_gym_15_whey_bancada.jpg", "Nutri\u00e7\u00e3o faz parte do treino"],
  ["fortalfy_gym_16_creatina_rotina.jpg", "Rotina forte, foco forte"],
  ["fortalfy_gym_17_musculacao.jpg", "Cada repeti\u00e7\u00e3o conta"],
  ["fortalfy_gym_18_cafeina.jpg", "Pr\u00e9-treino Fortalfy"],
  ["fortalfy_gym_19_constancia.jpg", "Const\u00e2ncia vence"],
  ["fortalfy_gym_20_manifesto.jpg", "Manifesto Fortalfy"]
].map(([filename, title], index) => ({ image: brandCampaignAsset(filename), title, number: String(index + 1).padStart(2, "0") }));

function HomeScreen({ activity, session, profile: accountProfile, activityError }) {
  const metadata = session?.user?.user_metadata || {};
  const displayName = accountProfile?.display_name || metadata.display_name || metadata.full_name || metadata.name || "";
  const firstName = displayName.trim().split(/\s+/)[0];
  const isSignedIn = Boolean(session?.user?.id);
  const today = new Date();
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  const workoutsThisWeek = activity.workoutEntries.filter(entry => {
    const date = new Date(`${entry.date}T00:00:00`);
    return Number.isFinite(date.getTime()) && date >= monday && date <= today;
  }).length;
  const nextStep = !isSignedIn
    ? { label: "Entrar ou criar conta", title: "Tenha seu espaço na comunidade.", description: "Acesse sua conta para organizar seus registros e preferências.", to: "/profile", icon: UserPlus }
    : activityError
      ? { label: "Abrir treinos", title: "Seu resumo está temporariamente indisponível.", description: "Você ainda pode consultar seus registros enquanto os dados são atualizados.", to: "/workout", icon: Dumbbell }
      : !activity.workoutsLogged
        ? { label: "Registrar treino", title: "Comece pelo que já faz parte da sua rotina.", description: "Registre uma atividade que você realizou. A Fortalfy não prescreve treinos.", to: "/workout", icon: Dumbbell }
        : !activity.mealsLogged
          ? { label: "Registrar refeição", title: "Acompanhe sua alimentação no seu ritmo.", description: "Adicione uma refeição ao diário quando fizer sentido para você.", to: "/nutrition", icon: Utensils }
          : { label: "Encontrar profissionais", title: "Encontre apoio para sua rotina.", description: "Conheça academias e profissionais com cadastro aprovado no FortalPass.", to: "/pass", icon: MapPin };
  const featured = [
    { campaign: HOME_BRAND_CAMPAIGNS[0], category: "TREINOS", title: "Registrar atividade", to: "/workout" },
    { campaign: HOME_BRAND_CAMPAIGNS[12], category: "COMUNIDADE", title: "Abrir o Feed", to: "/feed" },
    { campaign: HOME_BRAND_CAMPAIGNS[19], category: "CRIADORES", title: "Conhecer o FortalCreator", to: "/creator" },
  ];
  return <Screen className="home-screen">
    <Link to="/pass" className="home-hero-art" aria-label="Seu próximo nível começa hoje. Explorar a Fortalfy e conhecer parceiros."><img src={adPackAsset("01-home-hero.png")} alt="Seu próximo nível começa hoje. Campanha institucional Fortalfy com atleta treinando em uma academia." fetchpriority="high" decoding="async" /></Link>{/* Hero art includes its own logo, message and CTA. */}
    <div className="screen-inner home-inner">
      <section className="home-next-step" id="home-next-step" aria-labelledby="home-next-step-title"><div className="home-next-step-icon"><nextStep.icon size={23} aria-hidden="true" /></div><div className="home-next-step-copy"><span className="eyebrow">SEU PRÓXIMO PASSO</span><h2 id="home-next-step-title">{nextStep.title}</h2><p>{nextStep.description}</p></div><Link to={nextStep.to} className="button primary home-next-step-action">{nextStep.label} <ArrowRight size={16} /></Link></section>
      <section className="home-performance" aria-labelledby="home-performance-title"><div className="home-section-heading"><span className="eyebrow">SEU DESEMPENHO</span><h2 id="home-performance-title">Sua evolução em números</h2><p>{activity.workoutsLogged || activity.mealsLogged ? "Resumo dos registros da sua conta." : "Comece seu primeiro treino para acompanhar sua evolução."}</p></div><div className="home-performance-metrics"><div><strong>{workoutsThisWeek}</strong><span>treinos nesta semana</span></div><div><strong>{activity.workoutsLogged}</strong><span>treinos registrados</span></div><div><strong>{activity.mealsLogged}</strong><span>refeições registradas</span></div></div>{activityError && <p className="home-data-status" role="status">{activityError}</p>}</section>
      <SponsoredCreative image="02-home-native-card.png" alt="Fortalfy em destaque: uma rotina que acompanha seu ritmo." to="/creator" className="home-native-creative" />
      <section className="home-shortcuts" aria-labelledby="home-shortcuts-title"><div className="home-section-heading"><span className="eyebrow">ACESSO RÁPIDO</span><h2 id="home-shortcuts-title">Sua rotina</h2></div><div className="home-shortcut-grid"><Link to="/workout" className="home-shortcut"><Dumbbell size={24} /><strong>Treinos</strong><span>Registre sua atividade</span><ArrowUpRight size={17} /></Link><Link to="/progress" className="home-shortcut"><Activity size={24} /><strong>Meu progresso</strong><span>Acompanhe seus registros</span><ArrowUpRight size={17} /></Link><Link to="/feed" className="home-shortcut"><Users size={24} /><strong>Comunidade</strong><span>Converse e compartilhe</span><ArrowUpRight size={17} /></Link><Link to="/nutrition" className="home-shortcut"><Utensils size={24} /><strong>Nutrição</strong><span>Abra seu diário alimentar</span><ArrowUpRight size={17} /></Link></div></section>
      <section className="home-featured" aria-labelledby="home-featured-title"><div className="home-section-heading"><span className="eyebrow">EXPLORE EM DESTAQUE</span><h2 id="home-featured-title">Acesse outras áreas</h2><p>Treino, comunidade e criação de conteúdo, em seus espaços próprios.</p></div><div className="home-featured-grid">{featured.map(({ campaign: { image }, category, title, to }) => <Link key={category} to={to} className="home-featured-card"><img src={image} alt="" loading="lazy" decoding="async" /><span className="home-featured-label">{category}</span><strong>{title}</strong><span className="home-featured-arrow"><ArrowUpRight size={18} /></span></Link>)}</div><Link to="/campaigns" className="home-inline-link">Ver campanhas oficiais <ArrowRight size={15} /></Link></section>
    </div>
  </Screen>;
}

function CampaignsScreen() {
  return <Screen title="Campanhas oficiais" subtitle="FORTALFY EM MOVIMENTO" className="campaigns-screen"><SponsoredCreative image="04-campaigns-cover.png" alt="Campanhas Fortalfy em movimento: treino, performance e rotina." to="/campaigns" className="campaigns-cover-creative" /><CreatorGallery
    className="campaigns-gallery"
    galleryId="campaigns-gallery-title"
    eyebrow="CAMPANHAS FORTALFY"
    title="Treino, performance e rotina"
    description="Explore as campanhas visuais oficiais da Fortalfy. Arraste para navegar e selecione uma imagem para ampliar."
    context="CAMPANHA FORTALFY"
    disclosure="As imagens são editoriais e não confirmam disponibilidade de produtos, serviços ou parceiros na plataforma."
    images={HOME_BRAND_CAMPAIGNS.map(({ image, title, number }) => ({ src: image, alt: `${title}: campanha visual Fortalfy`, title, description: `Campanha Fortalfy · ${number} de 20` }))}
  /></Screen>;
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
  const [activeFilter, setActiveFilter] = useState("all");
  const [sort, setSort] = useState("recommended");
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
  const filters = [
    { id: "all", label: "Todos" },
    { id: "protein", label: "Com proteína declarada", visible: items.some(item => item.nutrition?.protein_g != null) },
    { id: "no-added-sugar", label: "Sem açúcar adicionado declarado", visible: items.some(item => item.nutrition?.sugars_added_g === 0) },
    { id: "ingredients", label: "Ingredientes informados", visible: items.some(item => item.ingredients.length > 0) },
    { id: "nutrition", label: "Com tabela nutricional", visible: items.some(item => item.nutrition) },
  ].filter(filter => filter.id === "all" || filter.visible);
  const matchingItems = items.filter(item => {
    const matchesSearch = `${item.name} ${item.description} ${item.restaurant.name} ${item.ingredients.join(" ")}`
      .toLocaleLowerCase("pt-BR").includes(normalizedSearch);
    if (!matchesSearch) return false;
    if (activeFilter === "protein") return item.nutrition?.protein_g != null;
    if (activeFilter === "no-added-sugar") return item.nutrition?.sugars_added_g === 0;
    if (activeFilter === "ingredients") return item.ingredients.length > 0;
    if (activeFilter === "nutrition") return Boolean(item.nutrition);
    return true;
  });
  const visible = [...matchingItems].sort((left, right) => {
    if (sort === "price-ascending") return left.price - right.price;
    if (sort === "protein-descending") return (right.nutrition?.protein_g ?? -1) - (left.nutrition?.protein_g ?? -1);
    return 0;
  });
  const formatPrice = price => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);
  const formatNutrient = (value, unit) => value == null ? "Não informado" : `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value)} ${unit}`;
  const restaurantsCount = new Set(items.map(item => item.restaurant.id)).size;
  const nutritionLabels = [
    ["Energia", "energy_kcal", "kcal"],
    ["Proteínas", "protein_g", "g"],
    ["Carboidratos", "carbohydrates_g", "g"],
    ["Açúcares totais", "sugars_total_g", "g"],
    ["Açúcares adicionados", "sugars_added_g", "g"],
    ["Gorduras totais", "fat_total_g", "g"],
    ["Gorduras saturadas", "fat_saturated_g", "g"],
    ["Gorduras trans", "fat_trans_g", "g"],
    ["Fibras", "fiber_g", "g"],
    ["Sódio", "sodium_mg", "mg"],
    ["Sal", "salt_g", "g"],
  ];
  return <Screen title="FortalFood" subtitle="CARDÁPIOS DOS RESTAURANTES" className="food-screen">
    <section className="food-promo"><img src={visualPackAsset("fortalfy-pack-food-card.jpg")} alt="" aria-hidden="true" /><div className="food-promo-copy"><span className="eyebrow">FORTALFOOD · COMIDA DE VERDADE</span><h2>Seu ritmo também se alimenta.</h2><p>Descubra pratos, ingredientes e escolhas que combinam com sua rotina.</p><button type="button" className="food-promo-cta" onClick={() => document.getElementById("food-menu")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Explorar cardápios <ArrowRight size={15} /></button></div><div className="food-promo-mark" aria-hidden="true"><Utensils size={40} /></div></section>
    <section className="food-demo-ads" aria-label="Anúncios demonstrativos FortalFood">
      <div className="food-demo-ads-heading"><div><span className="eyebrow">ESPAÇO PARA PARCEIROS</span><h2>Ideias para cada momento</h2></div><span>Anúncios demonstrativos</span></div>
      <div className="food-demo-ad-grid">{[
        ["fortalfy-pack-food-breakfast.jpg", "Comece bem o seu dia", "Inspiração para um café da manhã com mais cor."],
        ["fortalfy-pack-food-smoothie.jpg", "Uma pausa refrescante", "Descubra combinações para sua rotina."],
        ["fortalfy-pack-food-dinner.jpg", "Feche o dia no seu ritmo", "Explore ideias para uma refeição tranquila."],
      ].map(([image, title, description]) => <article className="food-demo-ad" key={image}>
        <img src={visualPackAsset(image)} alt="" loading="lazy" />
        <div><span>ANÚNCIO DEMONSTRATIVO</span><h3>{title}</h3><p>{description}</p><button type="button" onClick={() => document.getElementById("food-menu")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Conhecer o FortalFood <ArrowRight size={14} /></button></div>
      </article>)}</div>
      <p className="food-demo-disclosure">Peças ilustrativas para demonstração. Não representam ofertas, restaurantes ou produtos disponíveis.</p>
    </section>
    {needsLogin && <section className="food-visual-preview" aria-label="Inspiração para sua rotina alimentar"><div><span className="eyebrow">INSPIRAÇÃO PARA SUA ROTINA</span><h2>Comida de verdade, ideias para o dia a dia.</h2><p>Crie sua conta para consultar cardápios e informações publicados pelos parceiros.</p></div><div className="food-preview-gallery"><img src={visualPackAsset("fortalfy-pack-food-breakfast.jpg")} alt="Inspiração de café da manhã" loading="lazy" /><img src={visualPackAsset("fortalfy-pack-food-smoothie.jpg")} alt="Vitamina de frutas e folhas" loading="lazy" /><img src={visualPackAsset("fortalfy-pack-food-dinner.jpg")} alt="Inspiração para jantar" loading="lazy" /></div><Link className="button primary" to="/feed">Entrar ou criar conta <ArrowRight size={16} /></Link></section>}
    <div className="food-marketplace-intro"><div><span className="eyebrow">ESCOLHAS PARA SUA ROTINA</span><h2>Comer bem, do seu jeito.</h2><p>Pratos dos restaurantes parceiros Fortalfy.</p></div><div className="food-marketplace-count"><strong>{loading || needsLogin || error ? "—" : items.length}</strong><span>pratos disponíveis</span><small>{loading ? "Carregando parceiros" : needsLogin ? "Entre para consultar o cardápio" : error ? "Não foi possível consultar agora" : `${restaurantsCount} ${restaurantsCount === 1 ? "restaurante" : "restaurantes"} parceiros`}</small></div></div>
    <label className="search-field food-search-field"><Search size={19} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Busque um prato, ingrediente ou restaurante" aria-label="Buscar pratos, ingredientes ou restaurantes" /><button type="button" aria-label="Limpar busca" onClick={() => setSearch("")}>{search && <X size={17} />}</button></label>
    <div className="food-discovery-controls"><div className="food-filter-row" role="group" aria-label="Filtrar pratos">{filters.map(filter => <button type="button" key={filter.id} className={`food-filter-chip${activeFilter === filter.id ? " active" : ""}`} aria-pressed={activeFilter === filter.id} onClick={() => setActiveFilter(filter.id)}>{filter.label}</button>)}</div><label className="food-sort-control">Ordenar por<select aria-label="Ordenar pratos" value={sort} onChange={event => setSort(event.target.value)}><option value="recommended">Recomendados</option><option value="price-ascending">Menor preço</option>{items.some(item => item.nutrition?.protein_g != null) && <option value="protein-descending">Mais proteína declarada</option>}</select></label></div>
    <section className="food-data-explainer"><Info size={17} /><p><strong>Transparência no prato:</strong> ingredientes, açúcares, sódio, sal e gorduras aparecem quando informados pelo restaurante. Açúcar total e adicionado são dados distintos; óleos aparecem na lista de ingredientes quando declarados.</p></section>
    <div className="food-menu-heading" id="food-menu"><div><span className="eyebrow">CARDÁPIO DE PARCEIROS</span><h2>Pratos para descobrir {(loading || needsLogin || error) ? "" : <span>{visible.length}</span>}</h2></div></div>
    {loading && <p className="food-status" role="status">Carregando cardápios…</p>}
    {needsLogin && <div className="empty-state"><Lock size={24} /><h3>Entre para acessar os cardápios</h3><p>Os cardápios são carregados da plataforma e exigem uma conta autenticada.</p><Link className="button primary" to="/feed">Entrar ou criar conta <ArrowRight size={16} /></Link></div>}
    {error && <div className="social-inline-error" role="alert">{error}</div>}
    {!loading && !error && !needsLogin && visible.length > 0 && <SponsoredCreative image="09-nutrition-food.png" alt="Parceiro em destaque FortalFood com opções para acompanhar a rotina." label="Parceiro em destaque" to="/food" className="fortalfood-creative" />}
    {!loading && !error && !needsLogin && <div className="food-card-list">{visible.map(item => <article className="food-card" key={item.id}>
      <button type="button" className="food-card-image" onClick={() => setMenu(item)} aria-label={`Ver detalhes de ${item.name}`}>{item.image ? <img className="food-item-image" src={item.image} alt="" loading="lazy" /> : <div className="food-item-placeholder" aria-hidden="true"><Utensils size={28} /></div>}<span className="food-card-image-label">CARDÁPIO PARCEIRO</span>{item.nutrition?.status === "verified" && <span className="food-verified-pill"><BadgeCheck size={13} /> Nutrição verificada</span>}</button>
      <div className="food-card-body"><div className="food-card-heading"><div><span className="food-restaurant-label">{item.restaurant.name}{item.restaurant.city ? ` · ${item.restaurant.city}` : ""}</span><h3>{item.name}</h3></div></div>
        <p className="food-item-description">{item.description}</p>
        <div className="food-card-facts">{item.portionLabel && <span>{item.portionLabel}</span>}{item.nutrition?.energy_kcal != null && <span>{formatNutrient(item.nutrition.energy_kcal, "kcal")}</span>}{item.nutrition?.protein_g != null && <span>{formatNutrient(item.nutrition.protein_g, "proteína")}</span>}</div>
        <div className="food-card-footer"><div><span>Preço do parceiro</span><strong>{formatPrice(item.price)}</strong></div><button type="button" className="button primary small-button" onClick={() => setMenu(item)}>Ver prato <ArrowRight size={15} /></button></div>
      </div>
    </article>)}
    {!visible.length && <div className="empty-state"><Search size={24} /><h3>{items.length ? "Nenhum prato encontrado" : "Nenhum cardápio disponível"}</h3><p>{items.length ? "Tente outro termo ou remova o filtro selecionado." : "Os restaurantes aprovados ainda não publicaram pratos disponíveis."}</p>{(search || activeFilter !== "all") && <button className="button subtle" onClick={() => { setSearch(""); setActiveFilter("all"); }}>Limpar busca e filtros</button>}</div>}
    </div>}
    {menu && <Modal title={menu.name} onClose={() => setMenu(null)}><div className="food-detail-layout">{menu.image && <img className="food-detail-image" src={menu.image} alt={menu.name} />}<div className="food-detail-restaurant"><span className="eyebrow">RESTAURANTE PARCEIRO</span><strong>{menu.restaurant.name}</strong>{menu.restaurant.city && <span>{menu.restaurant.city}</span>}</div><p className="food-detail-description">{menu.description}</p><div className="food-detail-price"><span>Preço informado pelo restaurante</span><strong>{formatPrice(menu.price)}</strong>{menu.portionLabel && <small>Porção: {menu.portionLabel}</small>}</div>
      <section className="food-detail-section"><h3>Ingredientes e preparo</h3>{menu.ingredients.length > 0 ? <><ul className="food-ingredient-list">{menu.ingredients.map((ingredient, index) => <li key={`${ingredient}-${index}`}>{ingredient}</li>)}</ul><p className="food-nutrition-context">Óleos e gorduras usados no preparo aparecem aqui quando declarados pelo restaurante.</p></> : <p className="food-nutrition-context">Ingredientes e óleos usados no preparo ainda não foram informados. Consulte o restaurante antes de escolher.</p>}</section>
      {menu.allergens.length > 0 && <section className="food-allergen-notice"><strong>Alergênicos declarados pelo restaurante</strong><span>{menu.allergens.join(", ")}</span></section>}
      {menu.nutrition ? <section className="food-detail-section"><div className="food-nutrition-heading"><h3>Informação nutricional</h3>{menu.nutrition.status === "verified" && <span><BadgeCheck size={14} /> Verificada</span>}</div><p className="food-nutrition-context">Valores por porção quando informados pelo parceiro. Açúcares totais e adicionados, sódio e sal são dados separados. {menu.nutrition.status === "verified" ? "Dados verificados pela Fortalfy." : "Dados fornecidos pelo restaurante e ainda não verificados pela Fortalfy."}</p><div className="food-nutrition-grid">{nutritionLabels.filter(([, key]) => menu.nutrition[key] != null).map(([label, key, unit]) => <div key={key}><span>{label}</span><strong>{formatNutrient(menu.nutrition[key], unit)}</strong></div>)}</div>{menu.nutrition.sourceName && <small className="food-nutrition-source">Fonte: {menu.nutrition.sourceName}{menu.nutrition.sourceDate ? ` · ${menu.nutrition.sourceDate}` : ""}</small>}</section> : <p className="food-order-disclosure">A tabela nutricional não foi informada. Consulte o restaurante sobre açúcar, sal, sódio e gorduras.</p>}
      <p className="food-order-disclosure">O app ainda não recebe pedidos nem processa pagamentos. Confirme disponibilidade, entrega e composição diretamente com o restaurante.</p><Link className="button primary wide-button" to={`/profile/${menu.restaurant.id}`} onClick={() => setMenu(null)}>Ver perfil do restaurante <ArrowRight size={16} /></Link></div></Modal>}
  </Screen>;
}

function PassScreen() {
  const [showPlan, setShowPlan] = useState(false);
  const [planConfirmed, setPlanConfirmed] = useState(false);
  return <Screen title="Seu treino, mais perto de você." subtitle="FORTALFY PASS" location className="pass-screen">
    <div className="pass-hero"><PhotoCard image={visualPackAsset("fortalfy-pack-gym-interior.jpg")} alt="Academia ampla e iluminada" /><div className="pass-hero-overlay"><span>FORTALPASS OFICIAL</span><h2>Movimento que<br />combina com você.</h2><p>Acesse as melhores academias e studios credenciados de Fortaleza em um só passe.</p><Link to="/partner/gym" className="button lime-button">Explorar academias <ArrowRight size={16} /></Link></div></div>
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
    && typeof line.id === "string"
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

function WorkoutScreen({ notify, onActivity, activity, client, session, activityStatus, activityError }) {
  const [name, setName] = useState("");
  const [minutes, setMinutes] = useState("");
  const [error, setError] = useState("");
  const saveWorkout = async event => {
    event.preventDefault();
    const workoutName = name.trim();
    const duration = Number(minutes);
    if (!workoutName || workoutName.length > 60 || !Number.isInteger(duration) || duration < 1 || duration > 600) {
      setError("Informe o tipo de treino e uma duração entre 1 e 600 minutos.");
      return;
    }
    const saved = await onActivity("workout", {
      id: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      name: workoutName,
      minutes: duration,
      date: localDateKey(),
    });
    if (!saved) return;
    setName("");
    setMinutes("");
    setError("");
    notify("Treino registrado.");
  };
  return <Screen title="Treinos" subtitle="PLANOS E REGISTROS DE TREINO" className="workout-screen">
    <Link to="/home" className="back-link"><ArrowLeft size={17} /> Voltar</Link>
    <PartnerDiscoverySection client={client} session={session} kind="personal" notify={notify} />
    <WeeklyClientPlan client={client} session={session} kind="personal" notify={notify} />
    <section className="workout-progress-card"><div><span className="eyebrow">SEUS REGISTROS</span><h2>{activity.workoutsLogged} {activity.workoutsLogged === 1 ? "treino registrado" : "treinos registrados"}</h2><p>O Fortalfy não prescreve treinos nem lê sensores nesta tela.</p></div></section>
    <p className={`activity-sync-notice${activityError ? " has-error" : ""}`} role={activityError ? "alert" : undefined}>{activityError || activityStatus}</p>
    <form className="meal-entry-form" onSubmit={saveWorkout}><h2>Registrar treino realizado</h2><label>Tipo ou nome do treino<input required maxLength={60} value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: musculação, caminhada" /></label><label>Duração em minutos<input required type="number" min="1" max="600" step="1" value={minutes} onChange={event => setMinutes(event.target.value)} placeholder="Ex.: 45" /></label>{error && <p className="social-inline-error" role="alert">{error}</p>}<button className="button primary wide-button" type="submit">Salvar registro</button></form>
    <SectionTitle title="Histórico registrado" />
    {activity.workoutEntries.length ? <div className="exercise-list">{[...activity.workoutEntries].reverse().map(entry => <article className="exercise-card" key={entry.id}><span className="exercise-thumb"><Dumbbell size={22} /></span><div className="exercise-details"><h3>{entry.name}</h3><p>{entry.minutes} min · {entry.date}</p></div></article>)}</div> : <div className="empty-state"><Dumbbell size={24} /><h3>Nenhum treino registrado</h3><p>Seus treinos aparecerão aqui depois que você os registrar.</p></div>}
  </Screen>;
}

function NutritionScreen({ notify, onActivity, activity, client, session, activityStatus, activityError }) {
  const [addingMeal, setAddingMeal] = useState(false);
  const [editingMeal, setEditingMeal] = useState(null);
  const [selectedDate, setSelectedDate] = useState(localDateKey());
  const [mealName, setMealName] = useState("");
  const [mealCalories, setMealCalories] = useState("");
  const [mealType, setMealType] = useState("breakfast");
  const [mealTime, setMealTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [mealPortion, setMealPortion] = useState("");
  const [mealProtein, setMealProtein] = useState("");
  const [mealCarbs, setMealCarbs] = useState("");
  const [mealFat, setMealFat] = useState("");
  const [foodGroup, setFoodGroup] = useState("other");
  const todayKey = localDateKey();
  const todaysMeals = mealsForDate(activity.mealEntries, selectedDate);
  const calories = sumMealCalories(todaysMeals);
  const selectedDateObj = new Date(`${selectedDate}T12:00:00`);
  const selectedDateLabel = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(selectedDateObj);
  const previousDate = new Date(selectedDateObj); previousDate.setDate(previousDate.getDate() - 1);
  const nextDate = new Date(selectedDateObj); nextDate.setDate(nextDate.getDate() + 1);
  const dateOffset = date => localDateKey(date);
  const previousKey = dateOffset(previousDate);
  const nextKey = dateOffset(nextDate);
  const weekStart = new Date(selectedDateObj); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekly = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart); day.setDate(day.getDate() + index);
    const key = dateOffset(day);
    const records = mealsForDate(activity.mealEntries, key);
    return { key, label: new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(day).replace(".", ""), calories: sumMealCalories(records), count: records.length };
  });
  const weekMax = Math.max(1, ...weekly.map(day => day.calories));
  const macros = [
    { key: "protein", label: "Proteínas", color: "protein", unit: "g" },
    { key: "carbs", label: "Carboidratos", color: "carbs", unit: "g" },
    { key: "fat", label: "Gorduras", color: "fat", unit: "g" },
  ].map(item => ({ ...item, value: todaysMeals.reduce((sum, meal) => sum + (meal[item.key] ?? 0), 0), known: todaysMeals.some(meal => meal[item.key] != null) }));
  const macroEnergy = macros.reduce((sum, item) => sum + (item.known ? item.value * (item.key === "fat" ? 9 : 4) : 0), 0);
  const macrosWithShare = macros.map(item => ({
    ...item,
    share: macroEnergy && item.known ? Math.round(item.value * (item.key === "fat" ? 9 : 4) / macroEnergy * 100) : null,
  }));
  const proteinShare = macroEnergy ? macros[0].value * 4 / macroEnergy * 100 : 0;
  const carbShare = macroEnergy ? (macros[0].value * 4 + macros[1].value * 4) / macroEnergy * 100 : proteinShare;
  const distributionStyle = { background: macroEnergy
    ? `conic-gradient(#c8f52e 0 ${proteinShare}%, #54bd78 ${proteinShare}% ${carbShare}%, #a3c66c ${carbShare}% 100%)`
    : "#203629" };
  const mealGroups = [
    { key: "breakfast", title: "Café da manhã", icon: "☼", image: "pan-ca-proteica.jpg", imageAlt: "Panquecas com frutas para inspirar o café da manhã" },
    { key: "lunch", title: "Almoço", icon: "◒", image: "frango-grelhado.jpg", imageAlt: "Prato de frango grelhado para inspirar o almoço" },
    { key: "snack", title: "Lanche", icon: "✳", image: "snack-frutas-castanhas.jpg", imageAlt: "Frutas e castanhas para inspirar um lanche" },
    { key: "dinner", title: "Jantar", icon: "☾", image: "bowl-salmao.jpg", imageAlt: "Bowl de salmão para inspirar o jantar" },
    ...(todaysMeals.some(meal => meal.mealType === "other") ? [{ key: "other", title: "Outros registros", icon: "•", image: "marmita-low-carb.jpg", imageAlt: "Refeição equilibrada para inspirar outros registros" }] : []),
  ];
  const resetMealForm = () => { setMealName(""); setMealCalories(""); setMealPortion(""); setMealProtein(""); setMealCarbs(""); setMealFat(""); setFoodGroup("other"); setEditingMeal(null); };
  const openMealForm = (type = "breakfast", meal = null) => {
    setMealType(meal?.mealType && meal.mealType !== "other" ? meal.mealType : type);
    setMealName(meal?.name || ""); setMealCalories(meal ? String(meal.calories) : "");
    setMealTime(meal?.time || new Date().toTimeString().slice(0, 5)); setMealPortion(meal?.portion || "");
    setMealProtein(meal?.protein == null ? "" : String(meal.protein)); setMealCarbs(meal?.carbs == null ? "" : String(meal.carbs));
    setMealFat(meal?.fat == null ? "" : String(meal.fat)); setFoodGroup(meal?.foodGroup || "other");
    setEditingMeal(meal); setAddingMeal(true);
  };
  const registerMeal = async event => {
    event.preventDefault();
    const name = mealName.trim();
    const parsedCalories = Number(mealCalories);
    if (!name || mealCalories === "" || !Number.isInteger(parsedCalories) || parsedCalories < 0 || parsedCalories > 10000) return;
    const optionalMacro = value => value === "" ? null : Number(value);
    const detail = { id: editingMeal?.id || window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`, name, calories: parsedCalories, date: selectedDate, mealType, time: mealTime, portion: mealPortion.trim(), protein: optionalMacro(mealProtein), carbs: optionalMacro(mealCarbs), fat: optionalMacro(mealFat), foodGroup };
    if ([detail.protein, detail.carbs, detail.fat].some(value => value != null && (!Number.isFinite(value) || value < 0 || value > 1000))) return;
    const saved = await onActivity(editingMeal ? "updateMeal" : "meal", detail);
    if (!saved) return;
    resetMealForm();
    setAddingMeal(false);
    notify(editingMeal ? "Alimento atualizado no diário." : "Alimento adicionado ao diário.");
  };
  return <Screen title="Diário alimentar" subtitle="Acompanhe sua alimentação e seus objetivos diários." className="nutrition-screen">
    <section className="nutrition-toolbar">
      <div className="nutrition-date-picker">
        <button type="button" aria-label="Dia anterior" disabled={previousKey < localDateKey(new Date(Date.now() - 29 * 86400000))} onClick={() => setSelectedDate(previousKey)}><ArrowLeft size={16} /></button>
        <CalendarDays size={17} />
        <span className="nutrition-date-label">{selectedDate === todayKey ? "Hoje, " : ""}{new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" }).format(selectedDateObj)}</span>
        <input className="nutrition-date-input" aria-label="Selecionar data do diário" type="date" min={localDateKey(new Date(Date.now() - 29 * 86400000))} max={todayKey} value={selectedDate} onChange={event => event.target.value && setSelectedDate(event.target.value)} />
        <button type="button" aria-label="Próximo dia" disabled={selectedDate >= todayKey} onClick={() => setSelectedDate(nextKey)}><ArrowRight size={16} /></button>
      </div>
      <button className="button primary nutrition-add-main" onClick={() => addingMeal ? (setAddingMeal(false), resetMealForm()) : openMealForm()}><Plus size={17} /> Adicionar alimento</button>
    </section>
    <section className="nutrition-dashboard-grid">
      <div className="nutrition-primary-column">
        <div className="nutrition-date-heading"><div><span className="eyebrow">RESUMO DO DIA</span><h2>{selectedDateLabel}</h2></div><span className="nutrition-record-count">{todaysMeals.length} {todaysMeals.length === 1 ? "registro" : "registros"}</span></div>
        <div className="nutrition-overview-card"><div className={`nutrition-calorie-ring${calories ? " has-calories" : ""}`}><div><strong>{calories.toLocaleString("pt-BR")}</strong><span>kcal</span><small>registradas</small></div></div><div className="nutrition-overview-copy"><span className="eyebrow">ENERGIA REGISTRADA</span><strong>{calories.toLocaleString("pt-BR")} kcal</strong><p>Soma dos valores informados nos alimentos deste dia.</p><span className="nutrition-no-goal"><Target size={14} /> Meta diária não configurada</span></div><div className="nutrition-macro-cards">{macrosWithShare.map(item => <article className="nutrition-macro-card" key={item.key}><span className={`nutrition-macro-dot ${item.color}`} /><span>{item.label}</span><strong>{item.known ? `${Number(item.value.toFixed(1)).toLocaleString("pt-BR")} ${item.unit}` : "—"}</strong><div className="nutrition-macro-track" aria-hidden="true"><i className={item.color} style={{ width: `${item.share ?? 0}%` }} /></div><small>{item.share == null ? "sem dados informados" : `${item.share}% das macros registradas`}</small></article>)}</div></div>
        <div className="nutrition-meals-heading"><div><span className="eyebrow">ACOMPANHAMENTO</span><h2>Suas refeições do dia</h2></div><span>{todaysMeals.length} alimentos</span></div>
        <div className="nutrition-meal-grid">{mealGroups.map((group, index) => {
          const entries = todaysMeals.filter(meal => meal.mealType === group.key).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
          const groupCalories = sumMealCalories(entries);
          return <section className="nutrition-meal-card" key={group.key}><header><span className={`nutrition-meal-icon nutrition-meal-${index}`}>{group.icon}</span><div><h3>{group.title}</h3><small>{entries.length ? entries.map(meal => meal.time).filter(Boolean).join(" · ") || "Horário não informado" : "Sem registros"}</small></div><strong>{entries.length ? `${groupCalories.toLocaleString("pt-BR")} kcal` : "—"}</strong></header><figure className="nutrition-meal-photo"><img src={fortalfyAsset("food", group.image)} alt={group.imageAlt} loading="lazy" decoding="async" /><figcaption>Imagem ilustrativa</figcaption></figure>{entries.length ? <div className="nutrition-food-list">{entries.map(meal => <article className="nutrition-food-row" key={meal.id}><div className="nutrition-food-copy"><strong>{meal.name}</strong><small>{meal.portion || "Porção não informada"}{meal.time ? ` · ${meal.time}` : ""}</small><span>{meal.calories.toLocaleString("pt-BR")} kcal{meal.protein != null ? ` · ${meal.protein} g proteína` : ""}</span></div><button type="button" className="nutrition-edit-action" aria-label={`Editar ${meal.name}`} onClick={() => openMealForm(group.key, meal)}><PencilLine size={15} /></button><button type="button" className="nutrition-delete-action" aria-label={`Remover ${meal.name}`} onClick={() => onActivity("removeMeal", meal.id)}><Trash2 size={15} /></button></article>)}</div> : <div className="nutrition-meal-empty"><span className="nutrition-empty-icon"><Utensils size={19} /></span><span>{group.title === "Café da manhã" ? "Registre sua primeira refeição" : "Adicione alimentos consumidos"}</span></div>}<button type="button" className="nutrition-add-food" onClick={() => openMealForm(group.key)}><Plus size={14} /> Adicionar alimento</button></section>;
        })}</div>
        {addingMeal && <form className="meal-entry-form nutrition-entry-form" onSubmit={registerMeal}><div className="nutrition-form-heading"><div><span className="eyebrow">REGISTRO DO DIA</span><h2>{editingMeal ? "Editar alimento" : "Adicionar alimento"}</h2></div><button type="button" aria-label="Fechar formulário" onClick={() => { setAddingMeal(false); resetMealForm(); }}><X size={18} /></button></div><div className="nutrition-form-fields"><label>Alimento<input required maxLength={60} value={mealName} onChange={event => setMealName(event.target.value)} placeholder="Ex.: arroz integral" /></label><label>Refeição<select value={mealType} onChange={event => setMealType(event.target.value)}><option value="breakfast">Café da manhã</option><option value="lunch">Almoço</option><option value="snack">Lanche</option><option value="dinner">Jantar</option></select></label><label>Porção ou quantidade<input maxLength={40} value={mealPortion} onChange={event => setMealPortion(event.target.value)} placeholder="Ex.: 1 xícara (160 g)" /></label><label>Horário<input type="time" value={mealTime} onChange={event => setMealTime(event.target.value)} /></label><label>Calorias (kcal)<input required type="number" min="0" max="10000" step="1" value={mealCalories} onChange={event => setMealCalories(event.target.value)} placeholder="Informe o rótulo ou fonte" /></label><label>Proteínas (g)<input type="number" min="0" max="1000" step="0.1" value={mealProtein} onChange={event => setMealProtein(event.target.value)} placeholder="Opcional" /></label><label>Carboidratos (g)<input type="number" min="0" max="1000" step="0.1" value={mealCarbs} onChange={event => setMealCarbs(event.target.value)} placeholder="Opcional" /></label><label>Gorduras (g)<input type="number" min="0" max="1000" step="0.1" value={mealFat} onChange={event => setMealFat(event.target.value)} placeholder="Opcional" /></label><label>Grupo alimentar<select value={foodGroup} onChange={event => setFoodGroup(event.target.value)}><option value="other">Outro</option><option value="fruit">Fruta</option><option value="vegetable">Vegetal</option></select></label></div><p className="nutrition-form-note">Use as informações do rótulo ou de uma fonte confiável. Os valores não são estimados pelo aplicativo. <Link to="/food">Consultar cardápios publicados no FortalFood</Link></p><button className="button primary wide-button" type="submit">{editingMeal ? "Salvar alterações" : "Salvar alimento"}</button></form>}
      </div>
      <aside className="nutrition-side-column"><section className="nutrition-side-card nutrition-distribution-card"><span className="eyebrow">DISTRIBUIÇÃO</span><h3>Resumo nutricional</h3><div className="nutrition-distribution"><div className="nutrition-distribution-ring" style={distributionStyle}><span>{calories.toLocaleString("pt-BR")}<small>kcal</small></span></div><div className="nutrition-legend">{macros.map(item => <span key={item.key}><i className={item.color} />{item.label}<b>{item.known ? `${Number(item.value.toFixed(1)).toLocaleString("pt-BR")} g` : "—"}</b></span>)}</div></div><p>{macros.some(item => item.known) ? "Totais conforme os dados preenchidos por você." : "Registre os macronutrientes para acompanhar a distribuição."}</p></section>
        <section className="nutrition-side-card"><span className="eyebrow">ACOMPANHAMENTO</span><h3>Metas do dia</h3><div className="nutrition-goal-row"><span><Apple size={16} /> Frutas</span><strong>{todaysMeals.filter(meal => meal.foodGroup === "fruit").length} registradas</strong></div><div className="nutrition-goal-row"><span><Activity size={16} /> Vegetais</span><strong>{todaysMeals.filter(meal => meal.foodGroup === "vegetable").length} registrados</strong></div><div className="nutrition-goal-row"><span><Flame size={16} /> Proteína</span><strong>{macros[0].known ? `${Number(macros[0].value.toFixed(1)).toLocaleString("pt-BR")} g` : "Sem dados"}</strong></div><p>Defina seus objetivos no perfil para acompanhar o progresso.</p></section>
        <section className="nutrition-side-card nutrition-tip-card"><span className="nutrition-tip-icon"><Sparkles size={16} /></span><div><span className="eyebrow">LEMBRETE</span><h3>Registre com precisão</h3><p>Confira a porção e os dados nutricionais na embalagem ou na fonte consultada.</p></div></section>
        <section className="nutrition-side-card nutrition-week-card"><header><div><span className="eyebrow">SEUS REGISTROS</span><h3>Consumo semanal</h3></div><small>kcal</small></header><div className="nutrition-week-chart">{weekly.map(day => <div className={`nutrition-week-day${day.count ? " has-records" : ""}`} key={day.key} title={day.count ? `${day.calories.toLocaleString("pt-BR")} kcal · ${day.count} registros` : "Sem registros"}><div className="nutrition-week-bar-track"><i style={{ height: day.count ? `${Math.max(5, day.calories / weekMax * 100)}%` : "0%" }} /></div><strong>{day.count ? day.calories.toLocaleString("pt-BR") : "—"}</strong><small>{day.label}</small></div>)}</div><p>Sem registro não significa consumo zero.</p></section>
        <Link to="/food" className="nutrition-curation"><span className="quick-icon mint"><Utensils size={18} /></span><span><small>FORTALFOOD</small><strong>Cardápios de restaurantes aprovados</strong><small>Consulte porções e dados declarados.</small></span><ArrowRight size={18} /></Link>
      </aside>
    </section>
    <p className={`activity-sync-notice${activityError ? " has-error" : ""}`} role={activityError ? "alert" : undefined}>{activityError || activityStatus}</p>
    <section className="nutrition-history-card"><header><div><span className="eyebrow">ÚLTIMOS 30 DIAS</span><h2>Histórico de refeições</h2></div><span>{activity.mealEntries.length} registros</span></header><div className="nutrition-history-list">{[...activity.mealEntries].filter(meal => meal.date !== selectedDate).sort((a, b) => `${b.date}${b.time || ""}`.localeCompare(`${a.date}${a.time || ""}`)).slice(0, 5).map(meal => <article key={meal.id}><span className="nutrition-history-date">{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(`${meal.date}T12:00:00`))}</span><div><strong>{meal.name}</strong><small>{meal.time || meal.mealType || "Registro alimentar"}</small></div><b>{meal.calories.toLocaleString("pt-BR")} kcal</b><button type="button" aria-label={`Ver registros de ${meal.date}`} onClick={() => setSelectedDate(meal.date)}><ArrowRight size={15} /></button></article>)}{activity.mealEntries.filter(meal => meal.date !== selectedDate).length === 0 && <p className="nutrition-history-empty">Registros de outros dias aparecerão aqui.</p>}</div></section>
    <p className="sr-only" aria-live="polite">{todaysMeals.length} registros em {selectedDateLabel}; {calories} quilocalorias informadas.</p>
    <details className="nutrition-related-features"><summary><span><strong>Acompanhamento profissional</strong><small>Nutricionistas e planos vinculados à sua conta</small></span><ChevronDown size={17} /></summary><PartnerDiscoverySection client={client} session={session} kind="nutricionista" notify={notify} /><WeeklyClientPlan client={client} session={session} kind="nutrition" notify={notify} /></details>
  </Screen>;
}

function ProgressScreen({ client, session }) {
  return <Screen title="Meu desempenho" subtitle="EVOLUÇÃO DOS SEUS TREINOS" className="progress-screen">
    <PerformanceDashboard client={client} session={session} />
  </Screen>;
}

function EarningsScreen({ session }) {
  return <Screen title="Rendimentos" subtitle="INFORMAÇÕES FINANCEIRAS REAIS" className="earnings-screen">
    <section className="weekly-empty earnings-empty"><span className="weekly-empty-icon"><Wallet size={24} /></span><h2>Nenhum rendimento disponível</h2><p>{session?.user?.id ? "A Fortalfy ainda não tem um provedor de pagamentos ativo nem registros de repasse nesta conta. Nenhum saldo ou transação é simulado." : "Entre em uma conta real para consultar informações financeiras quando esse serviço estiver disponível."}</p>{session?.user?.id ? <Link className="button subtle" to="/trainer">Ver área profissional <ArrowRight size={16} /></Link> : <Link className="button primary" to="/profile">Entrar na conta <ArrowRight size={16} /></Link>}<Link className="text-link" to="/progress">Ver meu desempenho <ArrowRight size={15} /></Link></section>
  </Screen>;
}

function AcademyScreen({ client }) {
  const [courses, setCourses] = useState([]);
  useEffect(() => { let active = true; loadCreatorCourses(client).then(data => { if (active) setCourses(data); }).catch(error => console.error("Não foi possível carregar cursos publicados.", error)); return () => { active = false; }; }, [client]);
  return <Screen title="Fortalfy Academy" subtitle="CURSOS E APRENDIZADO" className="academy-screen">
    <div className="academy-banner"><img className="academy-creator-art" src={credibilityPackAsset("27-academy-creator.png")} alt="Criador editando conteúdo de treino no computador" /><span className="academy-cap"><Play size={20} /></span><span className="eyebrow">FORTALFY ACADEMY</span><h2>Aprenda no seu ritmo.</h2><p>Cursos e aulas aparecerão aqui quando forem publicados por profissionais.</p></div>
    {courses.length > 0 && <><SponsoredCreative image="13-academy-course.png" alt="Academia Fortalfy: aprenda a criar melhor com conteúdo, edição e marca pessoal." label="Academia Fortalfy" to="/academy" className="academy-course-creative" /><div className="academy-course-list">{courses.map(course => <article className="dash-panel" key={course.id}><span className="eyebrow">CURSO PUBLICADO</span><h2>{course.title}</h2><p>{course.summary || "Descrição não informada pelo instrutor."}</p><p>{course.price_cents === 0 ? "Gratuito" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: course.currency || "BRL" }).format(course.price_cents / 100)}</p></article>)}</div></>}
    <div className="empty-state" hidden={courses.length > 0}><CircleHelp size={24} /><h3>Nenhum curso publicado</h3><p>A Academy ainda não possui cursos disponíveis. Não há aulas, preços ou certificados fictícios.</p><Link to="/pass" className="button subtle">Conhecer profissionais <ArrowRight size={16} /></Link></div>
  </Screen>;
}

const LIVE_TOPICS = [
  { label: "Treino", category: "treino", image: "fortalfy_live_online_04_functional_training.jpg", imageAlt: "Treinadora demonstra um exercício com kettlebell em uma aula transmitida", terms: ["treino", "exercício", "musculação", "corrida", "pilates", "yoga"] },
  { label: "Nutrição", category: "nutricao", image: "fortalfy_live_online_03_sports_nutrition.jpg", imageAlt: "Nutricionista apresenta uma refeição saudável durante uma transmissão", terms: ["nutrição", "nutri", "alimentação", "dieta"] },
  { label: "Emagrecimento", category: "emagrecimento", image: "fortalfy_live_09_interactive_class.jpg", imageAlt: "Instrutora conduz uma aula interativa com participantes da academia", terms: ["emagrecimento", "emagrecer", "peso"] },
  { label: "Hipertrofia", category: "hipertrofia", image: "fortalfy_live_03_coach_teaching_lift.jpg", imageAlt: "Treinador orienta uma aluna durante um levantamento com barra", terms: ["hipertrofia", "massa", "muscular", "força"] },
  { label: "Saúde e bem-estar", category: "saude_bem_estar", image: "fortalfy_live_05_athlete_interview.jpg", imageAlt: "Atleta conversa com uma entrevistadora após o treino", terms: ["saúde", "bem-estar", "mobilidade", "recuperação"] },
  { label: "Marketing fitness", category: "marketing_fitness", image: "fortalfy_live_online_05_academy_business.jpg", imageAlt: "Personal trainer grava conteúdo sobre gestão de academia", terms: ["marketing", "negócio", "conteúdo", "creator"] },
];
const LIVE_FILTERS = ["Todas", "Ao vivo agora", "Gratuitas", "Pagas", "Agendadas", "Minhas inscrições"];
const LIVE_DISCOVERY_CARDS = [
  { label: "NUTRIÇÃO", topic: "Nutrição", title: "Nutrição para sua rotina", image: "fortalfy_live_02_podcast_nutrition.jpg", imageAlt: "Podcast sobre nutrição com uma nutricionista e alimentos frescos" },
  { label: "TREINO", topic: "Treino", title: "Treino com orientação", image: "fortalfy_live_03_coach_teaching_lift.jpg", imageAlt: "Treinador orienta uma aluna durante um exercício com barra" },
  { label: "MARKETING", topic: "Marketing fitness", title: "Marketing fitness", image: "fortalfy_live_08_fitness_marketing.jpg", imageAlt: "Profissional grava uma conversa sobre marketing fitness" },
];
const liveCatalogAsset = filename => `${import.meta.env.BASE_URL}assets/live/catalog/${filename}`;
function liveTopicFor(event) {
  if (event?.category) {
    const exact = LIVE_TOPICS.find(topic => topic.category === event.category);
    if (exact) return exact;
  }
  const text = `${event.title || ""} ${event.description || ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return LIVE_TOPICS.find(topic => topic.terms.some(term => text.includes(term.normalize("NFD").replace(/[\u0300-\u036f]/g, "")))) || LIVE_TOPICS[0];
}
function liveDateLabel(value, options = { dateStyle: "full", timeStyle: "short" }) {
  return new Intl.DateTimeFormat("pt-BR", { ...options, timeZone: "America/Fortaleza" }).format(new Date(value));
}
function LiveScreen({ client, session, notify }) {
  const { liveId } = useParams();
  const navigate = useNavigate();
  const [lives, setLives] = useState([]);
  const [registrationIds, setRegistrationIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Todas");
  const [busyLiveId, setBusyLiveId] = useState("");
  const [feedback, setFeedback] = useState("");
  const profileId = session?.user?.id || "";

  const refreshCatalog = useCallback(async () => {
    if (!client) { setLives([]); setLoading(false); setLoadError("O catálogo de transmissões precisa da conexão com o Supabase."); return; }
    setLoading(true); setLoadError("");
    try {
      const [catalog, registrations] = await Promise.all([
        loadPublicCreatorLiveCatalog(client),
        profileId ? loadMyCreatorLiveRegistrations(client, profileId) : Promise.resolve([]),
      ]);
      setLives(catalog);
      setRegistrationIds(registrations.filter(item => item.status === "registered").map(item => item.live_id));
    } catch (error) {
      console.error("Não foi possível carregar o catálogo Fortalfy Live.", error);
      setLoadError(error.code === "PGRST205" ? "O catálogo Fortalfy Live ainda não foi habilitado neste Supabase. A migração de banco precisa ser aplicada para carregar e reservar transmissões." : "Não foi possível carregar as transmissões agora. Tente novamente em instantes.");
    } finally { setLoading(false); }
  }, [client, profileId]);
  useEffect(() => { refreshCatalog(); }, [refreshCatalog]);

  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
  const visibleLives = lives.filter(live => {
    const mine = registrationIds.includes(live.id);
    const topic = liveTopicFor(live);
    const matchesSearch = !normalizedSearch || `${live.title} ${live.description} ${topic.label} ${live.instructor?.display_name || ""}`.toLocaleLowerCase("pt-BR").includes(normalizedSearch);
    if (!matchesSearch) return false;
    if (filter === "Minhas inscrições") return mine;
    if (filter === "Ao vivo agora") return false; // Current schema has no server-confirmed live state.
    if (filter === "Pagas") return Number(live.price_cents) > 0;
    if (filter === "Agendadas") return new Date(live.starts_at) > new Date();
    if (filter === "Gratuitas") return live.access_mode === "public" && Number(live.price_cents) === 0;
    return true;
  });
  const selectedLive = liveId ? lives.find(item => item.id === liveId) : null;
  const featuredLive = lives[0] || null;

  async function joinLive(live) {
    if (!profileId) { setFeedback("Entre na sua conta Fortalfy para reservar sua participação."); return; }
    if (registrationIds.includes(live.id)) return;
    setBusyLiveId(live.id); setFeedback("");
    try {
      await registerCreatorLive(client, live.id);
      setRegistrationIds(current => current.includes(live.id) ? current : [...current, live.id]);
      setFeedback("Inscrição confirmada. A transmissão também está disponível em Minhas inscrições.");
      notify?.("Inscrição confirmada na Fortalfy Live.");
    } catch (error) {
      setFeedback(error.message?.includes("Authentication") ? "Entre na sua conta Fortalfy para se inscrever." : "Não foi possível confirmar a inscrição. Confira o status da transmissão e tente novamente.");
    } finally { setBusyLiveId(""); }
  }

  function liveImage(event) {
    const topic = event ? liveTopicFor(event) : LIVE_TOPICS[0];
    return event?.cover_url || liveCatalogAsset(topic.image);
  }
  function instructorName(event) {
    return event?.instructor?.display_name || (event?.instructor?.username ? `@${event.instructor.username}` : "Profissional Fortalfy");
  }
  const registrationButton = (live, detail = false) => {
    const registered = registrationIds.includes(live.id);
    const busy = busyLiveId === live.id;
    if (Number(live.price_cents) > 0) return <button type="button" className="button subtle live-register-button" disabled title="Checkout ainda não foi integrado com confirmação segura no servidor"><Lock size={14}/> Compra indisponível</button>;
    return <button type="button" className="button primary live-register-button" disabled={registered || busy || !client} onClick={event => { event.stopPropagation(); joinLive(live); }}>
      {registered ? <><Check size={15} /> Inscrito</> : busy ? "Confirmando…" : <><Ticket size={15} /> Participar grátis</>}
    </button>;
  };
  const eventCard = live => {
    const topic = liveTopicFor(live);
    return <article className="live-event-card" key={live.id}>
      <Link className="live-event-card-link" to={`/live/${live.id}`} aria-label={`Ver detalhes: ${live.title}`}>
        <div className="live-event-cover"><img src={liveImage(live)} alt={live.cover_url ? `Capa de ${live.title}` : `Imagem ilustrativa: ${topic.label}`} loading="lazy"/><span className="live-event-topic"><Dumbbell size={13}/>{topic.label}</span><span className={`live-event-access${Number(live.price_cents) > 0 ? " paid" : ""}`}>{Number(live.price_cents) > 0 ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(live.price_cents / 100) : "GRÁTIS"}</span></div>
        <div className="live-event-copy"><span className="live-event-kicker">FORTALFY LIVE · {topic.label.toUpperCase()}</span><h3>{live.title}</h3><p className="live-event-instructor">{live.instructor?.avatar ? <img src={live.instructor.avatar} alt="" loading="lazy"/> : <span className="live-instructor-initial">{instructorName(live).slice(0, 1).toUpperCase()}</span>}<span>com <strong>{instructorName(live)}</strong></span>{Boolean(live.instructor?.verified_at || live.instructor?.partner_approved_at) && <BadgeCheck size={14} aria-label="Perfil verificado"/>}</p>
          <div className="live-event-datetime"><span><CalendarDays size={14}/>{liveDateLabel(live.starts_at, { day: "2-digit", month: "2-digit", year: "numeric" })}</span><span><Clock3 size={14}/>{liveDateLabel(live.starts_at, { hour: "2-digit", minute: "2-digit" })}</span><span><Timer size={14}/>{live.duration_minutes || 60} min</span></div>
        </div>
      </Link>
      <div className="live-event-card-footer">{registrationButton(live)}<Link to={`/live/${live.id}`} className="live-more-link">Detalhes <ArrowRight size={14}/></Link></div>
    </article>;
  };

  return <Screen title="Fortalfy Live" subtitle="APRENDIZADO EM MOVIMENTO" className="live-screen">
    <section className="live-page-intro"><div><span className="eyebrow">TRANSMISSÕES</span><h1>Fortalfy <strong>Live</strong></h1><p>Aprenda ao vivo com especialistas do universo fitness.</p></div><label className="live-search"><Search size={16}/><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por tema ou profissional..." aria-label="Buscar transmissões"/></label></section>

    {liveId ? selectedLive ? <section className="live-detail-layout">
      <button className="live-back-button" onClick={() => navigate("/live")}><ArrowLeft size={16}/> Voltar para Fortalfy Live</button>
      <article className="live-detail-card"><div className="live-detail-cover"><img src={liveImage(selectedLive)} alt={selectedLive.cover_url ? `Capa de ${selectedLive.title}` : `Imagem ilustrativa: ${liveTopicFor(selectedLive).label}`}/>{!selectedLive.cover_url && <span>Imagem ilustrativa</span>}</div><div className="live-detail-body"><span className="live-event-kicker">{liveTopicFor(selectedLive).label.toUpperCase()} · TRANSMISSÃO AGENDADA</span><h2>{selectedLive.title}</h2><p className="live-detail-description">{selectedLive.description || "O profissional ainda não adicionou uma descrição para esta transmissão."}</p><div className="live-detail-professional">{selectedLive.instructor?.avatar ? <img src={selectedLive.instructor.avatar} alt={`Foto de ${instructorName(selectedLive)}`}/> : <span>{instructorName(selectedLive).slice(0, 1).toUpperCase()}</span>}<div><small>Conduzida por</small><Link to={`/profile/${selectedLive.instructor_id}`}>{instructorName(selectedLive)} <ArrowUpRight size={14}/></Link><p>{selectedLive.instructor?.bio || "Conheça o perfil do profissional e acompanhe outros conteúdos na Fortalfy."}</p></div></div><div className="live-detail-facts"><span><CalendarDays size={17}/><span><small>Data e horário</small><strong>{liveDateLabel(selectedLive.starts_at)}</strong></span></span><span><Timer size={17}/><span><small>Duração prevista</small><strong>{selectedLive.duration_minutes || 60} minutos</strong></span></span><span><Ticket size={17}/><span><small>Acesso</small><strong>{Number(selectedLive.price_cents) > 0 ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(selectedLive.price_cents / 100) : "Gratuito · inscrição pela Fortalfy"}</strong></span></span>{selectedLive.participant_limit && <span><Users size={17}/><span><small>Vagas</small><strong>Limite de {selectedLive.participant_limit} participantes</strong></span></span>}</div>{registrationButton(selectedLive, true)}<p className="live-access-note"><Lock size={14}/> A inscrição gratuita é validada pela sua conta e registrada no servidor. A compra paga e o player só serão habilitados quando pagamento e transmissão estiverem integrados.</p></div></article>
      <aside className="live-detail-support"><h3>Informações da transmissão</h3><p>{selectedLive.participant_information || "O link de acesso será disponibilizado quando a Fortalfy conectar um serviço de transmissão ao evento."}</p><p><strong>Cancelamento:</strong> {selectedLive.cancellation_policy || "Consulte o profissional responsável para orientações sobre cancelamento e reagendamento."}</p><p>Para dúvidas sobre a agenda, consulte o perfil do profissional responsável.</p></aside>
    </section> : <div className="live-empty-state"><CircleHelp size={26}/><h2>Transmissão não encontrada</h2><p>Ela pode ter sido encerrada, cancelada ou não estar publicada para o público.</p><button className="button subtle" onClick={() => navigate("/live")}>Voltar ao catálogo</button></div> : <>
      <section className={`live-feature${featuredLive ? " has-event" : ""}`}>
        <img src={featuredLive ? liveImage(featuredLive) : "/assets/live/fortalfy-live-oficial.png"} alt={featuredLive ? `Imagem ilustrativa: ${liveTopicFor(featuredLive).label}` : "Fortalfy Live: profissionais de treino e nutrição"} loading={featuredLive ? "lazy" : "eager"}/>
        <div className="live-feature-copy">{featuredLive ? <><span className="live-feature-badge"><span/> PRÓXIMA TRANSMISSÃO</span><h2>{featuredLive.title}</h2><p>com {instructorName(featuredLive)}</p><div className="live-feature-meta"><span><CalendarDays size={14}/>{liveDateLabel(featuredLive.starts_at, { day: "2-digit", month: "long" })}</span><span><Clock3 size={14}/>{liveDateLabel(featuredLive.starts_at, { hour: "2-digit", minute: "2-digit" })}</span><span className="live-feature-free">{Number(featuredLive.price_cents) > 0 ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(featuredLive.price_cents / 100) : "Gratuita"}</span></div><Link className="button primary" to={`/live/${featuredLive.id}`}>Ver transmissão <ArrowRight size={16}/></Link></> : <><span className="live-feature-badge"><span/> AGENDA FORTALFY</span><h2>Aprenda com especialistas Fortalfy</h2><p>Treino, nutrição e bem-estar ao vivo.</p><button type="button" className="button primary" onClick={() => document.getElementById("live-catalog")?.scrollIntoView({ behavior: "smooth" })}>Explorar transmissões <ArrowRight size={16}/></button></>}</div>
      </section>

      <nav className="live-filter-tabs" aria-label="Filtrar transmissões">{LIVE_FILTERS.map(item => <button type="button" key={item} className={filter === item ? "selected" : ""} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}{item === "Minhas inscrições" && profileId && <span>{registrationIds.length}</span>}</button>)}</nav>
      <section className="live-catalog-section" id="live-catalog"><div className="live-section-heading"><div><span className="eyebrow">AGENDA FORTALFY</span><h2>{filter === "Minhas inscrições" ? "Minhas inscrições" : filter === "Pagas" ? "Transmissões pagas" : filter === "Ao vivo agora" ? "Ao vivo agora" : "Próximas transmissões"}</h2><p>{filter === "Pagas" ? "A compra de acesso estará disponível quando o provedor de pagamento for configurado." : loading ? "Buscando transmissões publicadas…" : `${visibleLives.length} ${visibleLives.length === 1 ? "transmissão publicada" : "transmissões publicadas"}`}</p></div><button className="live-refresh-button" type="button" onClick={refreshCatalog} disabled={loading}><Activity size={15}/> Atualizar</button></div>
        {loadError && <div className="live-inline-state error" role="alert"><CircleAlert size={18}/><span>{loadError}</span><button onClick={refreshCatalog}>Tentar novamente</button></div>}
        {feedback && <div className="live-inline-state success" role="status"><Check size={18}/><span>{feedback}</span><button aria-label="Fechar" onClick={() => setFeedback("")}><X size={16}/></button></div>}
        {!loadError && loading && <div className="live-loading-grid" aria-label="Carregando transmissões">{[0, 1, 2].map(item => <div className="live-skeleton-card" key={item}/>)}</div>}
        {!loadError && !loading && visibleLives.length > 0 && <div className="live-event-grid">{visibleLives.map(eventCard)}</div>}
        {!loadError && !loading && !visibleLives.length && !(filter === "Todas" && !normalizedSearch) && <div className="live-empty-state"><div className="live-empty-icon">{filter === "Pagas" ? <Lock size={22}/> : filter === "Minhas inscrições" ? <Ticket size={22}/> : <CalendarDays size={22}/>}</div><h3>{filter === "Pagas" ? "Compras ainda não disponíveis" : filter === "Minhas inscrições" ? "Sua agenda começa com uma inscrição" : filter === "Ao vivo agora" ? "Nenhuma transmissão ao vivo confirmada" : "Nenhuma transmissão publicada para este filtro"}</h3><p>{filter === "Pagas" ? "A Fortalfy ainda não possui checkout integrado para lives. Nenhuma cobrança será iniciada até que o pagamento seja configurado e confirmado no servidor." : filter === "Minhas inscrições" ? "Quando você se inscrever em um encontro gratuito, ele ficará disponível aqui." : filter === "Ao vivo agora" ? "O catálogo atual não recebe confirmação de início de transmissão. A Fortalfy não exibirá um player ou status ao vivo sem essa integração." : normalizedSearch ? "Tente outro termo ou limpe a busca para ver a agenda publicada." : "Novos encontros aparecerão aqui depois que um profissional autorizado publicar a agenda."}</p>{filter === "Minhas inscrições" && <button type="button" className="button primary" onClick={() => setFilter("Todas")}>Explorar transmissões <ArrowRight size={15}/></button>}{filter === "Pagas" && <Link to="/pass" className="button subtle">Descobrir profissionais <ArrowRight size={15}/></Link>}</div>}
        {!loadError && !loading && !visibleLives.length && filter === "Todas" && !normalizedSearch && <div className="live-discovery-grid" aria-label="Descubra temas da Fortalfy Live">{LIVE_DISCOVERY_CARDS.map(card => <article className="live-discovery-card" key={card.label}><button type="button" className="live-discovery-card-link" onClick={() => { setSearch(card.topic); document.getElementById("live-catalog")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} aria-label={`Explorar tema ${card.topic}`}><div className="live-discovery-cover"><img src={liveCatalogAsset(card.image)} alt={card.imageAlt} loading="lazy"/><span>{card.label}</span></div><div className="live-discovery-copy"><h3>{card.title}</h3><p>Sem transmissões publicadas neste tema.</p></div><span className="live-discovery-cta">Explorar tema <ArrowRight size={14}/></span></button></article>)}</div>}
      </section>

      <section className="live-topics-section"><div className="live-section-heading"><div><span className="eyebrow">CONTEÚDO PARA SUA JORNADA</span><h2>Explore por tema</h2><p>Escolha um assunto para filtrar as transmissões publicadas.</p></div></div><div className="live-topic-grid">{LIVE_TOPICS.map(topic => <button key={topic.label} type="button" className="live-topic-card" onClick={() => { setSearch(topic.label); setFilter("Todas"); document.getElementById("live-catalog")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><img src={liveCatalogAsset(topic.image)} alt={topic.imageAlt} loading="lazy"/><span className="live-topic-overlay"/><span className="live-topic-title">{topic.label}<ArrowRight size={15}/></span></button>)}</div></section>
      <aside className="live-platform-note"><ShieldCheck size={18}/><p><strong>Participação segura.</strong> Inscrições são registradas pela conta Fortalfy. Pagamentos, acesso a players, chat e lembretes só serão habilitados após integrações e validações próprias.</p></aside>
    </>}
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

function LivePartnerCard({
  partner, appointment = false, session, followState, followBusy = false,
  followStateLoaded = false, followStateError = false, onToggleFollow, showWebsite = true,
}) {
  const mapUrl = openStreetMapUrl(partner);
  const phoneCandidate = partner.contactPhone?.replace(/[^\d+]/g, "") || "";
  const phoneLink = /\d/.test(phoneCandidate) ? phoneCandidate : "";
  const websiteUrl = /^https?:\/\//i.test(partner.websiteUrl || "") ? partner.websiteUrl : "";
  const openingHours = partner.openingHours && typeof partner.openingHours === "object" && !Array.isArray(partner.openingHours)
    ? Object.entries(partner.openingHours).filter(([, value]) => typeof value === "string" && value.trim()).slice(0, 2)
      .map(([day, value]) => `${day}: ${value}`)
    : [];
  const role = partner.kind === "personal" ? "personal" : partner.kind === "nutricionista" ? "nutritionist" : "";
  const kindLabel = partner.kind === "personal" ? "Personal trainer"
    : partner.kind === "nutricionista" ? "Nutricionista" : "Academia";
  const isOwn = session?.user?.id === partner.profileId;
  const isFollowing = Boolean(followState?.isFollowing);
  const requestPending = followState?.requestStatus === "pending";
  return <article className="gym-card partner-live-card">
    <Link to={`/profile/${partner.profileId}`} className="gym-card-image">
      {partner.avatar ? <img className="photo-card" src={partner.avatar} alt={`Perfil de ${partner.name}`} loading="lazy" /> : <div className="photo-card partner-image-placeholder" aria-hidden="true">{partner.name.slice(0, 1).toUpperCase()}</div>}
      <span>APROVADO PELA EQUIPE</span>
      <span className="gym-card-arrow" aria-hidden="true"><ArrowUpRight size={16} /></span>
    </Link>
    <div className="gym-card-body">
      <div className="gym-card-title"><h3>{partner.name}</h3><span className="rating">{kindLabel}</span></div>
      <p>{[partner.address, partner.city].filter(Boolean).join(" · ") || "Localização não informada"}{partner.distanceKm != null && ` · ${partner.distanceKm.toFixed(1)} km`}</p>
      {partner.bio && <p className="partner-live-bio">{partner.bio}</p>}
      {!!partner.modalities.length && <div className="gym-tags">{partner.modalities.slice(0, 4).map(item => <span key={item}>{item}</span>)}</div>}
      {!!openingHours.length && <p className="partner-live-hours"><Clock3 size={13} /> {openingHours.join(" · ")}</p>}
      <small className="partner-live-disclosure">Valores e horários são informados pelo parceiro quando disponíveis. O selo indica aprovação do cadastro pela equipe Fortalfy.</small>
      <div className="partner-card-actions">
        {session?.user?.id && !isDemoUser(session.user.id) && !isOwn && onToggleFollow && !followStateError && <button type="button" className={`button small-button ${isFollowing ? "subtle" : "primary"}`} aria-pressed={isFollowing} onClick={() => onToggleFollow(partner)} disabled={followBusy || !followStateLoaded}>
          {!followStateLoaded ? "Carregando…" : requestPending ? "Cancelar solicitação" : isFollowing ? <><UserMinus size={15} /> Seguindo</> : <><UserPlus size={15} /> Seguir</>}
        </button>}
        {!session?.user?.id && <Link className="button subtle small-button" to="/profile">Entrar para seguir <ArrowRight size={15} /></Link>}
        <Link className="button subtle small-button" to={`/profile/${partner.profileId}`}>Ver perfil <ArrowRight size={15} /></Link>
        <Link className="button subtle small-button" to={`/messages?to=${encodeURIComponent(partner.profileId)}`}><MessageCircle size={15} /> Mensagem</Link>
        {phoneLink && <a className="button subtle small-button" href={`tel:${phoneLink}`}><Phone size={15} /> Ligar</a>}
        {showWebsite && websiteUrl && <a className="button subtle small-button" href={websiteUrl} target="_blank" rel="noreferrer"><Globe2 size={15} /> Site</a>}
        {mapUrl && <a className="button subtle small-button" href={mapUrl} target="_blank" rel="noreferrer">Mapa <ArrowUpRight size={15} /></a>}
        {appointment && role && <Link className="button primary small-button" to={`/hire/${role}?partner=${partner.profileId}`}><CalendarDays size={15} /> Solicitar atendimento</Link>}
      </div>
    </div>
  </article>;
}

function PartnerDiscoverySection({ client, session, kind, notify }) {
  const [partners, setPartners] = useState([]);
  const [followStates, setFollowStates] = useState({});
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [followStateLoaded, setFollowStateLoaded] = useState(false);
  const [followBusyId, setFollowBusyId] = useState("");
  const [error, setError] = useState("");
  const [followError, setFollowError] = useState("");
  const [locationError, setLocationError] = useState("");
  const [retry, setRetry] = useState(0);
  const userId = session?.user?.id;
  const kindLabel = kind === "nutricionista" ? "nutricionistas" : "personais";

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFollowStateLoaded(false);
    setFollowStates({});
    setError("");
    setFollowError("");
    loadApprovedPartners(client, { kind })
      .then(async items => {
        if (!active) return;
        setPartners(items);
        if (!userId || isDemoUser(userId) || !items.length) {
          setFollowStateLoaded(true);
          return;
        }
        try {
          const states = await loadFollowStates(client, userId, items.map(item => item.profileId));
          if (active) setFollowStates(states);
        } catch (failure) {
          console.error("Falha ao carregar seguimentos dos parceiros.", failure);
          if (active) setFollowError(getErrorMessage(failure, "Não foi possível carregar o estado dos seguimentos."));
        } finally {
          if (active) setFollowStateLoaded(true);
        }
      })
      .catch(failure => {
        if (!active) return;
        console.error("Falha ao carregar profissionais aprovados.", failure);
        setError(getErrorMessage(failure, "Não foi possível carregar os profissionais."));
        setFollowStateLoaded(true);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client, kind, retry, userId]);

  const toggleFollow = async partner => {
    if (!userId || isDemoUser(userId) || followBusyId) return;
    const current = followStates[partner.profileId] || { isFollowing: false, requestStatus: "" };
    setFollowBusyId(partner.profileId);
    try {
      let result;
      if (current.requestStatus === "pending") {
        await cancelFollowRequest(client, userId, partner.profileId);
        result = "not-following";
      } else {
        result = await persistFollow(client, userId, partner.profileId, !current.isFollowing, partner.isPrivate);
      }
      setFollowStates(states => ({
        ...states,
        [partner.profileId]: {
          isFollowing: result === "following",
          requestStatus: result === "requested" ? "pending" : "",
        },
      }));
      notify?.(result === "requested" ? "Solicitação de seguimento enviada."
        : result === "following" ? "Você começou a seguir este perfil." : "Você deixou de seguir este perfil.");
    } catch (failure) {
      console.error("Falha ao seguir parceiro.", failure);
      notify?.(getErrorMessage(failure, "Não foi possível atualizar o seguimento."));
    } finally {
      setFollowBusyId("");
    }
  };

  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const filtered = partners.filter(partner => [
    partner.name, partner.city, partner.address, partner.bio, ...partner.modalities,
  ].join(" ").toLocaleLowerCase("pt-BR").includes(normalizedQuery));
  const shown = orderPartnersByDistance(filtered, location);
  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Este navegador não oferece localização.");
      return;
    }
    navigator.geolocation.getCurrentPosition(position => {
      setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      setLocationError("");
    }, failure => {
      console.error("Não foi possível obter a localização autorizada.", failure);
      setLocationError(failure.code === failure.PERMISSION_DENIED
        ? "A permissão de localização foi negada. Você ainda pode buscar pela cidade."
        : "Não foi possível obter sua localização. Tente novamente.");
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
  };

  return <section className="partner-discovery" aria-labelledby={`discover-${kind}`}>
    <header className="partner-discovery-heading">
      <span className="eyebrow">PROFISSIONAIS APROVADOS</span>
      <h2 id={`discover-${kind}`}>Encontre {kindLabel}</h2>
      <p>Veja perfis cadastrados e aprovados. As informações exibidas são as fornecidas pelos profissionais.</p>
    </header>
    <div className="partner-discovery-controls">
      <label className="partner-search"><Search size={17} /><span className="sr-only">Buscar por nome, cidade, especialidade ou modalidade</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Nome, cidade, especialidade ou modalidade" /></label>
      <button type="button" className="button subtle small-button" onClick={requestLocation}><MapPin size={15} /> Buscar por proximidade</button>
    </div>
    {locationError && <p className="social-inline-error" role="alert">{locationError}</p>}
    {followError && <p className="social-inline-error" role="alert">{followError}</p>}
    {error && <div className="social-feed-error" role="alert"><CircleAlert size={17} /><span>{error}</span><button type="button" onClick={() => setRetry(value => value + 1)}>Tentar novamente</button></div>}
    {loading && <p className="social-inline-status" role="status">Carregando profissionais aprovados…</p>}
    {!loading && !error && !shown.length && <div className="empty-state"><Users size={24} /><h3>{query ? "Nenhum profissional encontrado" : `Ainda não há ${kindLabel} aprovados`}</h3><p>{query ? "Tente outro nome, cidade ou modalidade." : "Novos perfis reais aparecerão aqui após a aprovação pela equipe Fortalfy."}</p></div>}
    {kind === "personal" && shown.length > 0 && <SponsoredCreative image="08-workout-partner.png" alt="Profissional em destaque: encontre um personal trainer aprovado." label="Profissional em destaque" to={`/profile/${shown[0].profileId}`} className="workout-partner-creative" />}
    {shown.length > 0 && <div className="gym-cards partner-discovery-grid">{shown.map(partner => <LivePartnerCard key={partner.id} partner={partner} appointment session={session} followState={followStates[partner.profileId]} followBusy={followBusyId === partner.profileId} followStateLoaded={followStateLoaded} followStateError={Boolean(followError)} onToggleFollow={toggleFollow} />)}</div>}
    <div className="partner-discovery-footnote"><ShieldCheck size={15} /> Nenhum preço, avaliação ou horário é estimado quando o profissional não cadastrou esses dados.</div>
  </section>;
}

function LivePassScreen({ client, session, notify }) {
  const [partners, setPartners] = useState([]);
  const [filter, setFilter] = useState("academia");
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [modality, setModality] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem("fortalfy.pass.favorites.v1") || "[]"); } catch { return []; }
  });
  const [view, setView] = useState("list");
  const [catalogMode, setCatalogMode] = useState("demo");
  const [detailPartner, setDetailPartner] = useState(null);
  const [passTab, setPassTab] = useState("Academias");
  const [checkins, setCheckins] = useState([]);
  const [checkinUnits, setCheckinUnits] = useState({});
  const [selectedId, setSelectedId] = useState("");
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [locationError, setLocationError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    loadApprovedPartners(client)
      .then(data => { if (active) { setPartners(data); setError(""); } })
      .catch(failure => {
        if (!active) return;
        console.error("Falha ao carregar parceiros aprovados.", failure);
        setError(getErrorMessage(failure, "Não foi possível carregar parceiros."));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client, retry]);

  useEffect(() => {
    let active = true;
    const userId = session?.user?.id;
    if (!client || !userId) { setCheckins([]); setCheckinUnits({}); return () => { active = false; }; }
    client.from("fortalfy_gym_checkins")
      .select("id,unit_id,started_at,status")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(5)
      .then(async result => {
        if (result.error) throw result.error;
        const visits = result.data || [];
        const ids = [...new Set(visits.map(visit => visit.unit_id))];
        const units = ids.length ? await client.from("fortalfy_gym_units").select("id,unit_name").in("id", ids) : { data: [], error: null };
        if (units.error) throw units.error;
        if (active) {
          setCheckins(visits);
          setCheckinUnits(Object.fromEntries((units.data || []).map(unit => [unit.id, unit.unit_name])));
        }
      })
      .catch(failure => console.info("Histórico FortalPass indisponível para esta conta.", failure?.message));
    return () => { active = false; };
  }, [client, session?.user?.id]);

  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const demoNetworks = [
    { id: "demo-smart-fit", name: "Smart Fit", kind: "academia", address: "", city: "", bio: "Prévia de apresentação. Unidade e parceria FortalPass não confirmadas.", modalities: [], openingHours: {}, avatar: "/assets/visual-pack/fortalfy-pack-gym-interior.jpg", latitude: null, longitude: null, demo: true },
    { id: "demo-bluefit", name: "Bluefit", kind: "academia", address: "", city: "", bio: "Prévia de apresentação. Unidade e parceria FortalPass não confirmadas.", modalities: [], openingHours: {}, avatar: "/assets/visual-pack/fortalfy-pack-gym-group.jpg", latitude: null, longitude: null, demo: true },
    { id: "demo-bodytech", name: "Bodytech", kind: "academia", address: "", city: "", bio: "Prévia de apresentação. Unidade e parceria FortalPass não confirmadas.", modalities: [], openingHours: {}, avatar: "/assets/brand-campaign/fortalfy_gym_17_musculacao.jpg", latitude: null, longitude: null, demo: true },
  ];
  const catalog = catalogMode === "demo" ? demoNetworks : partners;
  const cities = [...new Set(catalog.map(partner => partner.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const modalities = [...new Set(catalog.flatMap(partner => partner.modalities || []).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const shown = orderPartnersByDistance(
    catalog.filter(partner => (filter === "todos" || partner.kind === filter)
      && (!city || partner.city === city)
      && (!modality || partner.modalities.includes(modality))
      && (!favoritesOnly || favorites.includes(partner.id))
      && (passTab !== "Favoritos" || favorites.includes(partner.id))
      && [partner.name, partner.city, partner.address, partner.bio, ...partner.modalities]
        .join(" ").toLocaleLowerCase("pt-BR").includes(normalizedQuery)),
    location,
  );
  const selected = shown.find(partner => partner.id === selectedId) || shown[0] || null;
  const toggleFavorite = partnerId => setFavorites(current => {
    const next = current.includes(partnerId) ? current.filter(id => id !== partnerId) : [...current, partnerId];
    try { localStorage.setItem("fortalfy.pass.favorites.v1", JSON.stringify(next)); } catch { /* Favoritos ficam disponíveis nesta sessão. */ }
    return next;
  });
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

  return <Screen title="FortalPass" subtitle="MOVIMENTO E CUIDADO PERTO DE VOCÊ" location className="pass-screen">
    <section className="pass-hero"><div><span className="eyebrow">{catalogMode === "demo" ? "FORTALPASS · PRÉVIA PARA O CLIENTE" : "FORTALPASS · REDE PARCEIRA"}</span><h2>Sua rede de academias</h2><p>{catalogMode === "demo" ? "Encontre espaços e explore os detalhes disponíveis." : "Conecte-se às academias parceiras, treine com mais praticidade e consulte os benefícios cadastrados."}</p><div className="pass-hero-stats"><span><strong>{catalogMode === "demo" ? demoNetworks.length : partners.filter(item => item.kind === "academia").length}</strong> {catalogMode === "demo" ? "redes para demonstração" : "academias parceiras"}</span><span><MapPin size={15}/> Busca por proximidade</span><span><ShieldCheck size={15}/> {catalogMode === "demo" ? "Prévia ilustrativa" : "Cadastros aprovados"}</span></div></div><Brand /></section>
    <div className="pass-marketplace-shell"><aside className="pass-filters-panel">
      <label className="pass-filter-label"><Search size={14}/><span>Buscar academias</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Nome, cidade, bairro..." /></label>
      <button type="button" className="pass-location-button" onClick={requestLocation}><MapPin size={15}/>{location ? "Localização ativada" : "Usar minha localização"}</button>
      {locationError && <p className="social-inline-error" role="alert">{locationError}</p>}
      <label className="pass-filter-label">Cidade<select value={city} onChange={event => setCity(event.target.value)}><option value="">Todas as cidades</option>{cities.map(item => <option key={item}>{item}</option>)}</select></label>
      <fieldset className="pass-checkbox-filters"><legend>Tipo de academia</legend>{[["academia", "Academias"], ["personal", "Personal trainers"], ["nutricionista", "Nutricionistas"], ["todos", "Todos os perfis"]].map(([value, label]) => <label key={value}><input type="radio" name="pass-kind" checked={filter === value} onChange={() => setFilter(value)}/>{label}</label>)}</fieldset>
      <label className="pass-filter-label">Modalidade<select value={modality} onChange={event => setModality(event.target.value)}><option value="">Todas as modalidades</option>{modalities.map(item => <option key={item}>{item}</option>)}</select></label>
      <div className="pass-sidebar-map"><strong>Mapa de parceiros</strong>{selected?.latitude != null && selected?.longitude != null ? <iframe title={`Localização de ${selected.name}`} src={`https://www.openstreetmap.org/export/embed.html?bbox=${selected.longitude - 0.012}%2C${selected.latitude - 0.008}%2C${selected.longitude + 0.012}%2C${selected.latitude + 0.008}&layer=mapnik&marker=${selected.latitude}%2C${selected.longitude}`} loading="lazy" referrerPolicy="no-referrer" /> : <p>O mapa será exibido para parceiros com coordenadas cadastradas.</p>}<button type="button" onClick={() => setView("map")}>Ver mapa <ArrowRight size={13}/></button></div>
      <fieldset className="pass-checkbox-filters"><legend>Horário de funcionamento</legend><span>Filtro de horários disponível quando informado pelo parceiro.</span></fieldset>
      <button type="button" className={`pass-favorite-filter ${favoritesOnly || passTab === "Favoritos" ? "active" : ""}`} aria-pressed={favoritesOnly} onClick={() => { setFavoritesOnly(value => !value); setPassTab("Academias"); }}><Heart size={15}/> Favoritos <span>{favorites.length}</span></button>
      <button type="button" className="button primary pass-apply-filters" onClick={() => setPassTab("Academias")}>Aplicar filtros</button>
    </aside><section className={`partner-discovery pass-discovery ${catalogMode === "demo" ? "is-demo" : ""}`}>
      <header className="partner-discovery-heading">
        <span className="eyebrow">REDE FORTALPASS</span>
        <h2>{passTab === "Planos" ? "Seu plano FortalPass" : passTab === "Check-ins" ? "Check-ins recentes" : passTab === "Favoritos" ? "Seus parceiros favoritos" : location ? "Academias próximas a você" : catalogMode === "demo" ? "Academias para conhecer o FortalPass" : "Academias parceiras FortalPass"}</h2>
        <p>{catalogMode === "demo" ? "Explore uma prévia da experiência de descoberta e dos detalhes de uma academia." : "Encontre parceiros aprovados e consulte as informações publicadas por cada cadastro."}</p>
      </header>
      <nav className="pass-tabs" aria-label="FortalPass">{["Academias", "Planos", "Check-ins", "Favoritos"].map(tab => <button type="button" key={tab} className={passTab === tab ? "active" : ""} onClick={() => { setPassTab(tab); if (tab === "Favoritos") { setFavoritesOnly(false); setFilter("todos"); } }}>{tab}{tab === "Favoritos" && favorites.length > 0 && <span>{favorites.length}</span>}</button>)}<button type="button" className="pass-map-toggle" onClick={() => setView(view === "map" ? "list" : "map")}><MapPin size={14}/>{view === "map" ? "Lista" : "Mapa"}</button></nav>
      <div className="pass-catalog-switch" role="group" aria-label="Tipo de catálogo"><button type="button" className={catalogMode === "demo" ? "active" : ""} aria-pressed={catalogMode === "demo"} onClick={() => { setCatalogMode("demo"); setDetailPartner(null); setCity(""); setModality(""); setSelectedId(""); }}>Prévia para o cliente</button><button type="button" className={catalogMode === "real" ? "active" : ""} aria-pressed={catalogMode === "real"} onClick={() => { setCatalogMode("real"); setDetailPartner(null); setCity(""); setModality(""); setSelectedId(""); }}>Parceiros cadastrados ({partners.length})</button></div>
      {catalogMode === "demo" && passTab === "Academias" && <div className="pass-demo-disclosure"><Info size={15}/><span>Marcas ilustrativas; sem parceria ou check-in ativo.</span></div>}
      <div className="partner-discovery-controls">
        <label className="partner-search"><Search size={17} /><span className="sr-only">Buscar academia ou profissional</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar nome, cidade ou modalidade" /></label>
        <button type="button" className="button subtle small-button" onClick={requestLocation}><MapPin size={15} /> {location ? "Localização ativa" : "Localização"}</button>
      </div>
      <details className="pass-mobile-filters"><summary><SlidersHorizontal size={14}/> Filtros <span>{[city, modality, favoritesOnly ? "Favoritos" : ""].filter(Boolean).length || ""}</span></summary><div className="pass-filter-row"><select aria-label="Cidade" value={city} onChange={event => setCity(event.target.value)}><option value="">Todas as cidades</option>{cities.map(item => <option key={item}>{item}</option>)}</select><select aria-label="Modalidade" value={modality} onChange={event => setModality(event.target.value)}><option value="">Todas as modalidades</option>{modalities.map(item => <option key={item}>{item}</option>)}</select><button type="button" className={favoritesOnly ? "active" : ""} aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(value => !value)}><Heart size={15}/> Favoritos ({favorites.length})</button></div></details>
      <div className="social-feed-toolbar">
      <div className="social-filter-tabs">
        {[["academia", "Academias"], ["personal", "Personal"], ["nutricionista", "Nutricionistas"], ["todos", "Todos"]].map(([value, label]) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>)}
      </div>
      </div>
      {locationError && <p className="social-inline-error" role="alert">{locationError}</p>}
      {catalogMode === "real" && error && <div className="social-feed-error" role="alert"><CircleAlert size={17} /><span>{error}</span><button type="button" onClick={() => setRetry(value => value + 1)}>Tentar novamente</button></div>}
      {catalogMode === "real" && loading && <p className="social-inline-status" role="status">Carregando parceiros aprovados…</p>}
      {!loading && !error && !shown.length && (passTab === "Academias" || passTab === "Favoritos") && <div className="empty-state"><MapPin size={24} /><h3>{query || passTab === "Favoritos" ? "Nenhum parceiro encontrado" : "Nenhum parceiro aprovado nesta categoria"}</h3><p>{query || passTab === "Favoritos" ? "Ajuste sua busca ou salve um parceiro para adicioná-lo aos favoritos." : "Parceiros reais aparecerão aqui após concluírem o cadastro e serem aprovados."}</p></div>}
      {passTab === "Planos" && <div className="pass-tab-empty"><Ticket size={23}/><strong>Planos FortalPass</strong><p>Planos e benefícios serão exibidos quando a oferta e a integração de assinatura estiverem configuradas.</p></div>}
      {passTab === "Check-ins" && <div className="pass-checkin-list">{checkins.length ? checkins.map(visit => <article key={visit.id}><span className="pass-checkin-icon"><Check size={15}/></span><div><strong>{checkinUnits[visit.unit_id] || "Unidade FortalPass"}</strong><small>{new Date(visit.started_at).toLocaleString("pt-BR")}</small></div><span>{visit.status === "completed" ? "Concluído" : "Em andamento"}</span></article>) : <div className="pass-tab-empty"><Clock3 size={23}/><strong>Nenhum check-in registrado</strong><p>Quando sua conta registrar acessos em unidades habilitadas, eles aparecerão aqui.</p></div>}</div>}
      {view === "map" && (passTab === "Academias" || passTab === "Favoritos") && <div className="pass-map-view">{selected?.latitude != null && selected?.longitude != null ? <iframe title={`Mapa de ${selected.name}`} src={`https://www.openstreetmap.org/export/embed.html?bbox=${selected.longitude - 0.012}%2C${selected.latitude - 0.008}%2C${selected.longitude + 0.012}%2C${selected.latitude + 0.008}&layer=mapnik&marker=${selected.latitude}%2C${selected.longitude}`} loading="lazy" referrerPolicy="no-referrer" /> : <div><MapPin size={22}/><strong>Mapa indisponível para este parceiro</strong><p>O cadastro ainda não tem coordenadas.</p></div>}{selected && <div className="pass-map-selection"><strong>{selected.name}</strong><span>{[selected.address, selected.city].filter(Boolean).join(" · ") || "Endereço não informado"}</span>{openStreetMapUrl(selected) && <a href={openStreetMapUrl(selected)} target="_blank" rel="noreferrer">Como chegar <ArrowUpRight size={14}/></a>}</div>}<div className="pass-map-partners">{shown.filter(partner => partner.latitude != null && partner.longitude != null).map(partner => <button type="button" key={partner.id} className={selected?.id === partner.id ? "active" : ""} onClick={() => setSelectedId(partner.id)}>{partner.name}</button>)}</div></div>}
      {shown.length > 0 && passTab === "Academias" && catalogMode === "real" && <SponsoredCreative image="05-fortalpass-partner.png" alt="Parceiro em destaque no FortalPass: encontre seu próximo passo perto de você." label="Parceiro aprovado em destaque" to={`/profile/${shown[0].profileId}`} className="fortalpass-partner-creative" />}
      {shown.length > 0 && view === "list" && (passTab === "Academias" || passTab === "Favoritos") && catalogMode === "demo" && <div className="pass-demo-network-list">{shown.map(network => <article className="pass-demo-network-card" key={network.id}><img src={network.avatar} alt="" loading="lazy"/><div><span>EXEMPLO · SEM PARCERIA</span><h3>{network.name}</h3><p>{network.bio}</p><button type="button" className="pass-demo-detail-link" onClick={() => setDetailPartner(network)}>Ver detalhes no Fortalfy <ArrowRight size={14}/></button></div><button type="button" className={`pass-listing-favorite ${favorites.includes(network.id) ? "active" : ""}`} aria-label={favorites.includes(network.id) ? `Remover ${network.name} dos favoritos` : `Adicionar ${network.name} aos favoritos`} aria-pressed={favorites.includes(network.id)} onClick={() => toggleFavorite(network.id)}><Heart size={16}/></button></article>)}</div>}
      {shown.length > 0 && view === "list" && (passTab === "Academias" || passTab === "Favoritos") && catalogMode === "real" && <div className="gym-cards partner-discovery-grid">{shown.map(partner => <div className="pass-listing-wrap" key={partner.id}><button type="button" className={`pass-listing-favorite ${favorites.includes(partner.id) ? "active" : ""}`} aria-label={favorites.includes(partner.id) ? `Remover ${partner.name} dos favoritos` : `Adicionar ${partner.name} aos favoritos`} aria-pressed={favorites.includes(partner.id)} onClick={() => toggleFavorite(partner.id)}><Heart size={16}/></button><LivePartnerCard partner={partner} appointment={partner.kind !== "academia"} session={session} showWebsite={false} /><button type="button" className="pass-real-detail-button" onClick={() => setDetailPartner(partner)}>Ver detalhes FortalPass <ArrowRight size={14}/></button></div>)}</div>}
      {detailPartner && (passTab === "Academias" || passTab === "Favoritos") && <section className="pass-academy-detail" aria-label={`Detalhes de ${detailPartner.name}`}><div className="pass-academy-detail-heading"><div><span className="eyebrow">{detailPartner.demo ? "PRÉVIA ILUSTRATIVA" : "PERFIL CADASTRADO NO FORTALFY"}</span><h3>{detailPartner.name}</h3></div><button type="button" className="pass-detail-close" onClick={() => setDetailPartner(null)} aria-label="Fechar detalhes">×</button></div>{detailPartner.avatar && <img src={detailPartner.avatar} alt={`Imagem de apresentação de ${detailPartner.name}`} loading="lazy"/>}<p>{detailPartner.demo ? "Esta marca é usada apenas para demonstrar a navegação. Não representa cadastro ou parceria ativa." : detailPartner.bio || "Informação não disponível."}</p><dl><div><dt>Endereço</dt><dd>{detailPartner.address || "Informação não disponível"}</dd></div><div><dt>Cidade</dt><dd>{detailPartner.city || "Informação não disponível"}</dd></div><div><dt>Horários</dt><dd>{Object.entries(detailPartner.openingHours || {}).filter(([, value]) => value).map(([day, value]) => `${day}: ${value}`).join(" · ") || "Informação não disponível"}</dd></div><div><dt>Modalidades</dt><dd>{detailPartner.modalities?.join(", ") || "Informação não disponível"}</dd></div><div><dt>Avaliações</dt><dd>Informação não disponível</dd></div><div><dt>Planos aceitos</dt><dd>Informação não disponível</dd></div></dl><div className="pass-detail-actions"><button type="button" className="button subtle small-button" onClick={() => toggleFavorite(detailPartner.id)}><Heart size={15}/>{favorites.includes(detailPartner.id) ? "Remover dos favoritos" : "Favoritar"}</button>{detailPartner.demo ? <p>Check-in indisponível: rede demonstrativa sem unidade ou contrato FortalPass cadastrado.</p> : <p>Check-in disponível após vincular esta academia a uma unidade ativa, placa oficial e regras de acesso no FortalPass.</p>}</div></section>}
      <div className="partner-discovery-footnote"><ShieldCheck size={15} /> Não exibimos preços, avaliações ou disponibilidade que não tenham sido informados pelo parceiro.</div>
    </section>
    <aside className="pass-account-panel"><section><div className="pass-account-panel-title"><span className="eyebrow">MEU FORTALPASS</span><button type="button" aria-label="Ver detalhes do plano" onClick={() => setPassTab("Planos")}><ArrowUpRight size={15}/></button></div><h3>Plano FortalPass</h3><div className="pass-account-status"><ShieldCheck size={17}/><span><strong>{session?.user ? "Nenhum plano ativo" : "Entre na sua conta"}</strong><small>{session?.user ? "Assinaturas ainda não estão configuradas." : "Acesse sua conta para consultar seus dados."}</small></span></div>{!session?.user && <Link className="button primary pass-login-link" to="/profile">Entrar <ArrowRight size={14}/></Link>}<div className="pass-account-meter"><span>Check-ins no histórico</span><strong>{session?.user ? checkins.length : "—"}</strong></div><button type="button" className="pass-see-history" onClick={() => setPassTab("Check-ins")}>Ver check-ins <ArrowRight size={13}/></button></section><section className="pass-account-recent"><div className="pass-account-panel-title"><h3>Check-ins recentes</h3><button type="button" onClick={() => setPassTab("Check-ins")}>Ver todos <ArrowRight size={13}/></button></div>{!session?.user ? <p>Entre para consultar seu histórico.</p> : checkins.length ? checkins.slice(0, 3).map(visit => <div className="pass-recent-checkin" key={visit.id}><span className="pass-recent-thumb"><Dumbbell size={16}/></span><span><strong>{checkinUnits[visit.unit_id] || "Unidade FortalPass"}</strong><small>{new Date(visit.started_at).toLocaleDateString("pt-BR")}</small><em>{visit.status === "completed" ? "Finalizado" : "Em andamento"}</em></span></div>) : <p>Nenhum check-in registrado nesta conta.</p>}</section><section className="pass-account-help"><h3>Benefícios FortalPass</h3><p>Os benefícios aparecerão quando houver uma oferta ativa e aprovada.</p><button type="button" onClick={() => setPassTab("Planos")}>Consultar planos <ArrowRight size={14}/></button></section></aside></div>
    <nav className="partner-discovery-shortcuts" aria-label="Atalhos de cuidado">
      <Link to="/nutrition"><Utensils size={17} /><span><strong>Nutricionista</strong><small>Perfis e planos alimentares</small></span><ArrowRight size={16} /></Link>
      <Link to="/workout"><Dumbbell size={17} /><span><strong>Personal</strong><small>Profissionais e seus treinos</small></span><ArrowRight size={16} /></Link>
      <Link to="/messages"><MessageCircle size={17} /><span><strong>Mensagens</strong><small>Conversas da sua conta</small></span><ArrowRight size={16} /></Link>
    </nav>
    <section className="partner-cta"><div><span className="eyebrow">VOCÊ É UM PARCEIRO?</span><h2>Cadastre seu perfil real</h2><p>Seu cadastro ficará oculto ao público até a aprovação da equipe.</p></div><Link to="/professional" className="button lime-button">Acessar área profissional <ArrowRight size={17} /></Link></section>
    {session?.user?.app_metadata?.role === "admin" && <section className="partner-cta"><div><span className="eyebrow">OPERAÇÃO FORTALFY</span><h2>Placas oficiais das unidades</h2><p>Cadastre unidades, gere QR fixo e acompanhe instalação e tentativas no servidor.</p></div><Link to="/admin/gym-plates" className="button lime-button">Administrar placas <ArrowRight size={17} /></Link></section>}
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
    {session?.user?.id && profile?.kind === "academia" && <section className="partner-cta"><div><span className="eyebrow">OPERAÇÃO DA ACADEMIA</span><h2>Acessos FortalPass</h2><p>Consulte os registros operacionais vinculados às suas unidades.</p></div><Link to="/partner/checkins" className="button lime-button">Ver acessos <ArrowRight size={16} /></Link></section>}
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

function hasInvalidAuthCallback() {
  const hash = window.location.hash.replace(/^#/, "");
  const candidates = [window.location.search, hash, hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : ""];
  return candidates.some(value => {
    const params = new URLSearchParams(value.replace(/^\?/, ""));
    return Boolean(params.get("error") || params.get("error_code"));
  });
}

function hasPasswordRecoveryCallback() {
  const hash = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(hash.replace(/^\//, ""));
  return params.get("type") === "recovery";
}

function AppContent() {
  const [toast, setToast] = useState("");
  const installPromptRef = useRef(null);
  const [installHelpOpen, setInstallHelpOpen] = useState(false);
  const [isAppInstalled, setIsAppInstalled] = useState(() => window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [notificationPreferences, setNotificationPreferences] = useState(null);
  useEffect(() => installInterfaceSoundInteractions(document), []);
  useEffect(() => {
    const onBeforeInstallPrompt = event => { event.preventDefault(); installPromptRef.current = event; };
    const onAppInstalled = () => { installPromptRef.current = null; setIsAppInstalled(true); setInstallHelpOpen(false); };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt); window.removeEventListener("appinstalled", onAppInstalled); };
  }, []);
  const startInstall = async () => {
    const prompt = installPromptRef.current;
    if (!prompt) { setInstallHelpOpen(true); return; }
    installPromptRef.current = null;
    try { await prompt.prompt(); const choice = await prompt.userChoice; if (choice?.outcome === "accepted") setIsAppInstalled(true); }
    catch { setInstallHelpOpen(true); }
  };

  const [liveNotification, setLiveNotification] = useState(null);
  const [notifications, setNotifications] = useState(() => {
    const saved = loadLocalValue(NOTIFICATIONS_STORAGE_KEY, []);
    return Array.isArray(saved) ? saved.filter(item => item && APP_NOTIFICATION_TYPES.has(item.type) && typeof item.id === "string" && typeof item.message === "string" && typeof item.createdAt === "string").slice(-50) : [];
  });
  const [authSession, setAuthSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [themePreference, setThemePreference] = useState(() => readThemePreference());
  const [accessibilityPreferences, setAccessibilityPreferences] = useState(() => readAccessibilityPreferences());
  const accessibilityPreferencesRef = useRef(accessibilityPreferences);
  const accessibilitySaveQueue = useRef(Promise.resolve());
  const [socialProfile, setSocialProfile] = useState(null);
  const [socialProfileError, setSocialProfileError] = useState("");
  const [passwordRecovery, setPasswordRecovery] = useState(() => hasPasswordRecoveryCallback());
  const [invalidAuthCallback, setInvalidAuthCallback] = useState(() => hasInvalidAuthCallback());
  const [activity, setActivity] = useState(() => normalizeActivity(loadLocalValue(ACTIVITY_STORAGE_KEY, null)));
  const [activityOwnerId, setActivityOwnerId] = useState(null);
  const [activityError, setActivityError] = useState("");
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
  const navigate = useNavigate();
  useEffect(() => {
    const publicDescription = "Descubra academias e profissionais aprovados, explore conteúdos de bem-estar e acompanhe sua rotina com a Fortalfy.";
    const routeTitles = [
      ["/home", "Início"], ["/feed", "Feed"], ["/reels", "FortalReels"], ["/people", "Pessoas"],
      ["/messages", "Mensagens"], ["/food", "FortalFood"], ["/pass", "FortalPass"], ["/profile", "Perfil"],
      ["/workout", "Treinos"], ["/nutrition", "Diário alimentar"], ["/progress", "Meu desempenho"],
      ["/earnings", "Rendimentos"], ["/academy", "Fortalfy Academy"], ["/live", "Fortalfy Live"],
      ["/shop", "FortalShop"], ["/professional", "Área profissional"], ["/partner", "Parceiros"],
      ["/settings", "Configurações"], ["/notifications", "Notificações"],
    ];
    const match = routeTitles.find(([path]) => location.pathname === path || location.pathname.startsWith(`${path}/`));
    const title = location.pathname === "/" ? "Fortalfy — bem-estar no seu ritmo" : `${match?.[1] || "Fortalfy"} | Fortalfy`;
    document.title = title;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = location.pathname === "/" ? publicDescription : "Acesse sua experiência Fortalfy com informações e recursos disponíveis para sua conta.";
    const robots = document.querySelector('meta[name="robots"]');
    if (robots) robots.content = location.pathname === "/" ? "index,follow" : "noindex,nofollow";
    for (const [selector, content] of [
      ['meta[property="og:title"]', title],
      ['meta[property="og:description"]', description?.content || publicDescription],
      ['meta[name="twitter:title"]', title],
      ['meta[name="twitter:description"]', description?.content || publicDescription],
    ]) {
      const tag = document.querySelector(selector);
      if (tag) tag.content = content;
    }
  }, [location.pathname]);
  const notificationViewRef = useRef({ pathname: location.pathname, search: location.search, preferences: notificationPreferences });
  notificationViewRef.current = { pathname: location.pathname, search: location.search, preferences: notificationPreferences };
  const openNotificationTarget = route => {
    const safeRoute = typeof route === "string" && route.startsWith("/") && !route.startsWith("//") ? route : "/home";
    navigate(safeRoute);
  };
  useEffect(() => {
    if (passwordRecovery && location.pathname !== "/profile") {
      navigate("/profile", { replace: true });
    }
  }, [passwordRecovery, location.pathname, navigate]);
  useEffect(() => {
    if (!invalidAuthCallback || location.search.includes("authError=expired")) return;
    window.location.hash = "/profile?authError=expired";
  }, [invalidAuthCallback, location.search]);
  const notify = useCallback(message => {
    const text = String(message || "").trim();
    if (text) setToast(text);
  }, []);
  const pushNotification = useCallback(({ type, title, message } = {}) => {
    if (authSession?.user?.id && !isDemoUser(authSession.user.id)) return;
    const text = String(message || "").trim();
    if (!APP_NOTIFICATION_TYPES.has(type) || !text) return;
    setNotifications(current => [...current, {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      title: String(title || APP_NOTIFICATION_LABELS[type]).trim(),
      message: text,
      createdAt: new Date().toISOString(),
      read: false,
    }].slice(-50));
  }, [authSession?.user?.id]);
  const accountUserId = authSession?.user?.id && !isDemoUser(authSession.user.id) ? authSession.user.id : null;
  const requestedAuthReturn = new URLSearchParams(window.location.search).get("fortalfy_return") || "";
  const authReturnPath = requestedAuthReturn.startsWith("/") && !requestedAuthReturn.startsWith("//") ? requestedAuthReturn : "/home";
  const unreadNotificationCount = notifications.reduce((count, item) => count + (item.read ? 0 : 1), 0);
  const refreshNotifications = useCallback(async () => {
    if (!supabase || !accountUserId) return;
    setNotificationLoading(true);
    setNotificationError("");
    try {
      const [rows, preferences] = await Promise.all([
        loadNotifications(supabase, accountUserId),
        loadNotificationPreferences(supabase, accountUserId),
      ]);
      setNotifications(rows);
      setNotificationPreferences(preferences);
    } catch (error) {
      setNotificationError(notificationErrorMessage(error, "Não foi possível carregar seus avisos."));
    } finally {
      setNotificationLoading(false);
    }
  }, [accountUserId]);
  const markNotificationRead = id => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.ready
      .then(registration => registration.active?.postMessage({ type: "FORTALFY_NOTIFICATION_READ", id }))
      .catch(() => {});
    if (accountUserId) {
      markRemoteNotificationRead(supabase, id).then(() => setNotifications(current => current.map(item => item.id === id ? { ...item, read: true } : item))).catch(error => setNotificationError(error.message || "Não foi possível atualizar este aviso."));
      return;
    }
    setNotifications(current => current.map(item => item.id === id ? { ...item, read: true } : item));
  };
  const markAllNotificationsRead = () => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.ready
      .then(registration => registration.active?.postMessage({ type: "FORTALFY_NOTIFICATION_READ" }))
      .catch(() => {});
    if (accountUserId) {
      markAllRemoteNotificationsRead(supabase, accountUserId).then(() => setNotifications(current => current.map(item => ({ ...item, read: true })))).catch(error => setNotificationError(error.message || "Não foi possível atualizar os avisos."));
      return;
    }
    setNotifications(current => current.map(item => ({ ...item, read: true })));
  };
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const notificationId = params.get("notificationId");
    if (!authReady || !accountUserId || !notificationId || !/^[a-zA-Z0-9-]{1,80}$/.test(notificationId)) return;
    markNotificationRead(notificationId);
    params.delete("notificationId");
    const remainingQuery = params.toString();
    navigate(`${location.pathname}${remainingQuery ? `?${remainingQuery}` : ""}`, { replace: true });
  }, [accountUserId, authReady, location.pathname, location.search, navigate]);
  useEffect(() => {
    if (!accountUserId || location.pathname !== "/messages") return;
    const conversationId = new URLSearchParams(location.search).get("conversation");
    if (!conversationId || !/^[a-zA-Z0-9-]{1,80}$/.test(conversationId)) return;
    let active = true;
    markConversationNotificationsRead(supabase, accountUserId, conversationId)
      .then(ids => {
        if (!active || !ids.length) return;
        setNotifications(current => current.map(item => ids.includes(item.id) ? { ...item, read: true } : item));
        for (const id of ids) {
          if ("serviceWorker" in navigator) void navigator.serviceWorker.ready
            .then(registration => registration.active?.postMessage({ type: "FORTALFY_NOTIFICATION_READ", id }))
            .catch(() => {});
        }
      })
      .catch(error => console.warn("Could not mark conversation notifications as read.", error?.code || "database_error"));
    return () => { active = false; };
  }, [accountUserId, location.pathname, location.search]);
  const clearNotifications = () => setNotifications([]);

  useEffect(() => {
    if (accountUserId) return;
    try {
      window.localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));
    } catch (error) {
      console.error("Não foi possível salvar as notificações neste aparelho.", error);
    }
  }, [notifications, accountUserId]);

  useEffect(() => {
    try {
      window.sessionStorage.removeItem("fortalfy_demo_session");
    } catch {
      // ignore
    }
  }, []);
  useEffect(() => {
    if (!authReady) return undefined;
    if (!accountUserId) {
      setNotificationPreferences(null);
      setNotificationError("");
      setNotifications(() => {
        const saved = loadLocalValue(NOTIFICATIONS_STORAGE_KEY, []);
        return Array.isArray(saved) ? saved.filter(item => item && APP_NOTIFICATION_TYPES.has(item.type)) : [];
      });
      return undefined;
    }
    let active = true;
    setNotifications([]);
    setNotificationLoading(true);
    const areSameNotifications = (left, right) => left.length === right.length && left.every((item, index) => {
      const next = right[index];
      return item.id === next.id && item.read === next.read && item.groupCount === next.groupCount
        && item.createdAt === next.createdAt && item.message === next.message;
    });
    const mergeFetchedNotifications = (current, rows) => {
      const fetchedIds = new Set(rows.map(item => item.id));
      const recentRealtime = current.filter(item => !fetchedIds.has(item.id)
        && Date.now() - new Date(item.createdAt).getTime() < 60000);
      const merged = [...recentRealtime, ...rows].slice(0, 60);
      return areSameNotifications(current, merged) ? current : merged;
    };
    const syncNotifications = async () => {
      try {
        const rows = await loadNotifications(supabase, accountUserId);
        if (active) setNotifications(current => mergeFetchedNotifications(current, rows));
      } catch (error) {
        if (active) setNotificationError(notificationErrorMessage(error, "Falha ao atualizar avisos."));
      }
    };
    Promise.all([loadNotifications(supabase, accountUserId), loadNotificationPreferences(supabase, accountUserId)])
      .then(([rows, preferences]) => {
        if (!active) return;
        setNotifications(current => mergeFetchedNotifications(current, rows));
        setNotificationPreferences(preferences);
        setNotificationError("");
      })
      .catch(error => { if (active) setNotificationError(notificationErrorMessage(error, "Não foi possível carregar seus avisos.")); })
      .finally(() => { if (active) setNotificationLoading(false); });
    const channel = supabase?.channel(`fortalfy-notifications-${accountUserId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "fortalfy_notifications", filter: `recipient_user_id=eq.${accountUserId}` }, payload => {
        const item = notificationFromRow(payload.new);
        setNotifications(current => [item, ...current.filter(entry => entry.id !== item.id)].slice(0, 60));
        const targetParams = new URLSearchParams(item.targetRoute?.split("?")[1] || "");
        const currentParams = new URLSearchParams(notificationViewRef.current.search);
        const sameActiveConversation = item.type === "chat.message" && notificationViewRef.current.pathname === "/messages"
          && targetParams.get("conversation") && targetParams.get("conversation") === currentParams.get("conversation");
        if (!sameActiveConversation) setLiveNotification(item);
        if (!sameActiveConversation && document.visibilityState === "visible") {
          void playNotificationSound(notificationViewRef.current.preferences, { notificationId: item.id, type: item.type });
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "fortalfy_notifications", filter: `recipient_user_id=eq.${accountUserId}` }, payload => {
        const item = notificationFromRow(payload.new);
        setNotifications(current => current.map(entry => entry.id === item.id ? item : entry));
      })
      .subscribe(status => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("Canal de notificações desconectado; a sincronização periódica continuará ativa.");
        }
        if (status === "SUBSCRIBED") void syncNotifications();
      });
    const poll = window.setInterval(() => { if (document.visibilityState === "visible") void syncNotifications(); }, 15000);
    const refreshOnFocus = () => { if (document.visibilityState === "visible") void syncNotifications(); };
    document.addEventListener("visibilitychange", refreshOnFocus);
    return () => {
      active = false;
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", refreshOnFocus);
      if (channel) supabase.removeChannel(channel);
    };
  }, [accountUserId, authReady]);
  useEffect(() => {
    if (!authReady) return;
    setThemePreference(accountUserId ? getAccountThemePreference(authSession?.user) : readThemePreference());
  }, [accountUserId, authReady, authSession?.user?.user_metadata]);
  useEffect(() => {
    if (!authReady) return;
    const preferences = accountUserId
      ? getAccountAccessibilityPreferences(authSession?.user)
      : readAccessibilityPreferences();
    accessibilityPreferencesRef.current = preferences;
    setAccessibilityPreferences(preferences);
  }, [accountUserId, authReady]);
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const update = () => applyAccessibilityPreferences(accessibilityPreferences, media?.matches ?? false);
    update();
    if (!media) return undefined;
    if (media.addEventListener) media.addEventListener("change", update);
    else media.addListener?.(update);
    return () => {
      if (media.removeEventListener) media.removeEventListener("change", update);
      else media.removeListener?.(update);
    };
  }, [accessibilityPreferences]);
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    applyThemePreference("dark", media?.matches ?? true);
  }, []);
  const changeThemePreference = async preference => {
    setThemePreference(preference);
    try {
      const result = await saveThemePreference(supabase, accountUserId, preference);
      notify(result.synced ? `Tema ${preference === "system" ? "automático" : preference === "light" ? "claro" : "escuro"} ativado e salvo na sua conta.` : `Tema ${preference === "system" ? "automático" : preference === "light" ? "claro" : "escuro"} ativado neste aparelho.`);
    } catch (error) {
      console.error("Não foi possível sincronizar a preferência de aparência.", error);
      notify(error.localSaved ? "Tema ativado e salvo neste aparelho. A sincronização será tentada novamente ao entrar na conta." : "Tema alterado nesta sessão, mas não foi possível salvar a preferência. Verifique o espaço disponível no navegador e sua conexão.");
    }
  };
  const changeAccessibilityPreferences = patch => {
    const preferences = normalizeAccessibilityPreferences({ ...accessibilityPreferencesRef.current, ...patch });
    accessibilityPreferencesRef.current = preferences;
    setAccessibilityPreferences(preferences);
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    applyAccessibilityPreferences(preferences, motion);
    const userId = accountUserId;
    const save = accessibilitySaveQueue.current.catch(() => {}).then(
      () => saveAccessibilityPreferences(supabase, userId, preferences),
    );
    accessibilitySaveQueue.current = save.catch(() => {});
    return save.then(result => {
      notify(result.synced
        ? "Preferências de acessibilidade salvas na sua conta."
        : "Preferências de acessibilidade salvas neste aparelho.");
      return result;
    }).catch(error => {
      console.error("Não foi possível sincronizar as preferências de acessibilidade.", error);
      notify(error.localSaved
        ? "Acessibilidade atualizada e salva neste aparelho. A sincronização será tentada novamente quando possível."
        : "Acessibilidade atualizada nesta sessão, mas não foi possível salvá-la. Verifique o espaço disponível e sua conexão.");
      throw error;
    });
  };
  useEffect(() => {
    if (!authReady) return undefined;
    if (!accountUserId) {
      setActivityOwnerId(null);
      setActivityError("");
      setActivity(normalizeActivity(loadLocalValue(ACTIVITY_STORAGE_KEY, null)));
      return undefined;
    }
    let active = true;
    setActivityOwnerId("");
    setActivityError("");
    setActivity(normalizeActivity(null));
    loadAccountActivity(supabase)
      .then(data => {
        if (!active) return;
        setActivity(normalizeActivity(data));
        setActivityOwnerId(accountUserId);
      })
      .catch(error => {
        if (!active) return;
        console.error("Não foi possível carregar a atividade da conta.", error);
        const message = getErrorMessage(error, "Não foi possível carregar seus registros da conta.");
        setActivityError(message);
        setActivityOwnerId(accountUserId);
        notify(message);
      });
    return () => { active = false; };
  }, [accountUserId, authReady]);
  const activityStatus = accountUserId
    ? activityOwnerId === accountUserId ? "Sincronizado com sua conta." : "Carregando registros da sua conta…"
    : "Salvo neste navegador; não sincroniza com sua conta.";

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
    if (!supabase) {
      setAuthReady(true);
      return undefined;
    }
    let active = true;
    // A sessão deve liberar a interface mesmo quando o armazenamento local
    // ou a rede móvel atrasar a inicialização do cliente Supabase.
    const sessionFallback = window.setTimeout(() => {
      if (active) setAuthReady(true);
    }, 3500);
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      window.clearTimeout(sessionFallback);
      if (error) {
        console.error("Não foi possível recuperar a sessão do Supabase.", error);
        notify(getErrorMessage(error, "Não foi possível recuperar sua sessão."));
        setAuthReady(true);
        return;
      }
      if (data.session) setAuthSession(data.session);
      setAuthReady(true);
    }).catch(error => {
      if (!active) return;
      window.clearTimeout(sessionFallback);
      console.error("Falha ao recuperar a sessão do Supabase.", error);
      notify(getErrorMessage(error, "Não foi possível recuperar sua sessão."));
      setAuthReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setAuthSession(session);
      setAuthReady(true);
      if (event === "PASSWORD_RECOVERY") {
        setPasswordRecovery(true);
        navigate("/profile", { replace: true });
      }
      if (!session) setSocialProfile(null);
    });
    return () => {
      active = false;
      window.clearTimeout(sessionFallback);
      subscription.unsubscribe();
    };
  }, [navigate]);
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
  const updateLocalActivity = (current, kind, detail) => {
    if (kind === "water") return normalizeActivity({ ...current, waterMl: current.waterMl + 250 });
    if (kind === "workout") return normalizeActivity({
      ...current,
      workoutsLogged: current.workoutsLogged + 1,
      workoutEntries: [...current.workoutEntries, detail],
    });
    if (kind === "meal") return normalizeActivity({ ...current, mealEntries: [...current.mealEntries, detail] });
    if (kind === "updateMeal") return normalizeActivity({ ...current, mealEntries: current.mealEntries.map(meal => meal.id === detail.id ? detail : meal) });
    if (kind === "removeMeal") return normalizeActivity({ ...current, mealEntries: current.mealEntries.filter(meal => meal.id !== detail) });
    return current;
  };
  const updateActivity = async (kind, detail) => {
    const userId = authSession?.user?.id;
    if (userId && !isDemoUser(userId)) {
      if (activityOwnerId !== userId) {
        notify("Aguarde a sincronização dos seus registros antes de salvar.");
        return false;
      }
      setActivityError("");
      try {
        const updated = await recordAccountActivity(supabase, kind, detail ?? null);
        setActivity(normalizeActivity(updated));
        const savedMeal = kind === "meal" ? updated.mealEntries?.find(entry => entry.id === detail?.id) : null;
        const nutritionFieldsMissing = savedMeal && (savedMeal.mealType !== detail.mealType
          || savedMeal.time !== detail.time || savedMeal.portion !== detail.portion
          || savedMeal.foodGroup !== detail.foodGroup || ["protein", "carbs", "fat"].some(key => detail[key] != null && savedMeal[key] == null));
        setActivityError(nutritionFieldsMissing
          ? "O registro básico foi salvo, mas o Supabase ainda não conserva porções e nutrientes. Aplique FORTALFY_ACTIVITY_NUTRITION_V2.sql para ativar esses campos."
          : "");
        return true;
      } catch (error) {
        if (kind === 'updateMeal' && /unsupported activity type/i.test(String(error?.message || ''))) {
          const message = 'A edi\u00e7\u00e3o de alimentos ainda n\u00e3o est\u00e1 ativada no Supabase. Aplique FORTALFY_ACTIVITY_NUTRITION_V2.sql.';
          setActivityError(message);
          notify(message);
          return false;
        }
        console.error("Não foi possível sincronizar os registros com a conta.", error);
        const message = getErrorMessage(error, "Não foi possível salvar na sua conta. Tente novamente.");
        setActivityError(message);
        notify(message);
        return false;
      }
    }
    setActivity(current => updateLocalActivity(current, kind, detail));
    return true;
  };
  useEffect(() => {
    const listener = event => notify(event.detail);
    window.addEventListener("fortalfy-toast", listener);
    return () => window.removeEventListener("fortalfy-toast", listener);
  }, [notify]);
  useEffect(() => {
    const listener = event => pushNotification(event.detail);
    window.addEventListener("fortalfy-notification", listener);
    return () => window.removeEventListener("fortalfy-notification", listener);
  }, [pushNotification]);
  useEffect(() => {
    if (!liveNotification) return undefined;
    const timer = window.setTimeout(() => setLiveNotification(null), 6000);
    return () => window.clearTimeout(timer);
  }, [liveNotification]);
  useEffect(() => {
    const listener = event => {
      if (event.data?.type === "FORTALFY_PUSH_NOTIFICATION") {
        if (event.data.soundEnabled !== false) {
          const targetParams = new URLSearchParams(event.data.route?.split("?")[1] || "");
          const currentParams = new URLSearchParams(location.search);
          const sameActiveConversation = event.data.notificationType === "chat.message" && location.pathname === "/messages"
            && targetParams.get("conversation") && targetParams.get("conversation") === currentParams.get("conversation");
          if (!sameActiveConversation) void playNotificationSound(notificationPreferences, { notificationId: event.data.id, type: event.data.notificationType });
        }
        return;
      }
      if (event.data?.type !== "FORTALFY_NOTIFICATION_OPEN") return;
      const route = event.data.route;
      if (event.data.id && accountUserId) markNotificationRead(event.data.id);
      openNotificationTarget(route);
    };
    navigator.serviceWorker?.addEventListener("message", listener);
    return () => navigator.serviceWorker?.removeEventListener("message", listener);
  }, [accountUserId, location.pathname, location.search, notificationPreferences]);
  useEffect(() => {
    if (!authReady || accountUserId) return;
    try {
      window.localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(activity));
    } catch (error) {
      console.error("Não foi possível persistir os registros de rotina neste dispositivo.", error);
      setToast("O registro está visível, mas não pôde ser salvo neste navegador.");
    }
  }, [activity, accountUserId, authReady]);
  useEffect(() => {
    try {
      window.localStorage.setItem(SHOP_CART_STORAGE_KEY, JSON.stringify(shopCart));
    } catch (error) {
      console.error("Não foi possível persistir a sacola da FortalShop neste dispositivo.", error);
      setToast("A sacola está visível, mas não pôde ser salva neste navegador.");
    }
  }, [shopCart]);
  const mobilePaths = ["/home", "/feed", "/reels", "/people", "/messages", "/food", "/pass", "/profile", "/workout", "/nutrition", "/curated", "/progress", "/earnings", "/academy", "/live", "/creator", "/partner/gym", "/partner/nutritionist", "/partner/checkins", "/shop", "/cart", "/studio", "/admin/gym-plates", "/settings", "/settings/notifications", "/notifications"];
  const mobile = mobilePaths.includes(location.pathname) || location.pathname.startsWith("/hire/") || location.pathname.startsWith("/checkin/");
  const immersiveReels = location.pathname === "/reels" && Boolean(authSession?.user?.id);
  return <Suspense fallback={<div className="app-loading" role="status">Carregando Fortalfy…</div>}><div className={`${mobile ? "mobile-app" : "professional-root"}${immersiveReels ? " reels-app" : ""}`}>
    <InstallAppContext.Provider value={{ isAppInstalled, startInstall }}>
    <NotificationContext.Provider value={{ open: () => setNotificationCenterOpen(true), unreadCount: unreadNotificationCount, push: pushNotification }}>
    <Routes>
      <Route path="/" element={authSession?.user?.id ? <Navigate to={authReturnPath} replace /> : <PublicLanding />} />
      <Route path="/home" element={<HomeScreen activity={activity} session={authSession} profile={socialProfile} activityError={activityError} />} />
      <Route path="/campaigns" element={<CampaignsScreen />} />
      <Route path="/benefits-terms" element={<BenefitsTerms client={supabase} session={authSession} notify={notify} />} />
      <Route path="/feed" element={<Screen compactHeader className="feed-screen community-feed-screen">{authSession?.user?.id && socialProfile && <StoryExperience client={supabase} configured={isSupabaseConfigured} session={authSession} user={socialProfile} notify={notify} />}<SocialFeed client={supabase} configured={isSupabaseConfigured} session={authSession} authReady={authReady} profile={socialProfile} profileError={socialProfileError} feedArts={feedArts} notify={notify} recovery={passwordRecovery} onRecovered={() => setPasswordRecovery(false)} onRetryProfile={retrySocialProfile} /></Screen>} />
      <Route path="/reels" element={<Screen title="FortalReels" subtitle="VÍDEOS VERTICAIS" immersive={immersiveReels} className="reels-screen">{!authSession?.user?.id && <section className="reel-preview-feature"><img src={visualPackAsset("fortalfy-pack-reels-training.jpg")} alt="Pessoa praticando mobilidade em um espaço iluminado" loading="lazy" /><div><span className="eyebrow">FORTALREELS · INSPIRAÇÃO EM MOVIMENTO</span><h2>Ideias rápidas para manter seu ritmo.</h2><p>Vídeos de treino, mobilidade e bem-estar publicados pela comunidade.</p><Link to="/feed" className="button primary">Entrar para explorar <ArrowRight size={16} /></Link></div></section>}<SocialFeed client={supabase} configured={isSupabaseConfigured} session={authSession} profile={socialProfile} profileError={socialProfileError} notify={notify} recovery={passwordRecovery} onRecovered={() => setPasswordRecovery(false)} onRetryProfile={retrySocialProfile} mediaType="video" /></Screen>} />
      <Route path="/people" element={<Screen title="Pessoas" subtitle="COMUNIDADE FORTALFY" className="feed-screen people-screen"><ProfessionalsDirectory client={supabase} configured={isSupabaseConfigured} session={authSession} notify={notify} /></Screen>} />
      <Route path="/messages" element={<Screen title="Mensagens" subtitle="CONVERSAS PRIVADAS" className="feed-screen messages-screen"><SocialMessages client={supabase} configured={isSupabaseConfigured} session={authSession} notify={notify} onNotification={pushNotification} messagePreferences={notificationPreferences} /></Screen>} />
      <Route path="/creator" element={<Screen title="FortalCreator" subtitle="PROGRAMA DE CRIADORES" className="creator-screen"><FortalCreator session={authSession} client={supabase} notify={notify} /></Screen>} />
      <Route path="/cre" element={<Navigate to="/creator" replace />} />
      <Route path="/food" element={<FoodScreen client={supabase} configured={isSupabaseConfigured} session={authSession} />} />
      <Route path="/pass" element={<LivePassScreen client={supabase} session={authSession} notify={notify} />} />
      <Route path="/checkin/:publicId" element={<Screen title="Validar presença" subtitle="FORTALPASS · ACESSO SEGURO" className="gym-access-screen"><GymCheckInPage client={supabase} session={authSession} /></Screen>} />
      <Route path="/partner/checkins" element={<Screen title="Acessos FortalPass" subtitle="PAINEL DA ACADEMIA" className="gym-admin-screen"><GymPartnerCheckinsPage client={supabase} session={authSession} /></Screen>} />
      <Route path="/admin/gym-plates" element={<Screen title="Placas oficiais" subtitle="ADMINISTRAÇÃO FORTALFY" className="gym-admin-screen"><GymPlateAdminPage client={supabase} session={authSession} /></Screen>} />
      <Route path="/profile" element={<Screen title="Meu perfil" subtitle="SUA JORNADA NA COMUNIDADE" className="social-profile-screen"><SocialProfile client={supabase} session={authSession} profile={socialProfile} profileError={socialProfileError} configured={isSupabaseConfigured} notify={notify} onProfileUpdated={refreshSocialProfile} recovery={passwordRecovery} onRecovered={() => setPasswordRecovery(false)} onRetryProfile={retrySocialProfile} onSignOut={handleSignOut} /></Screen>} />
      <Route path="/profile/:profileId" element={<Screen title="Perfil" subtitle="COMUNIDADE FORTALFY" className="social-profile-screen"><SocialProfile client={supabase} session={authSession} profile={socialProfile} profileError={socialProfileError} configured={isSupabaseConfigured} notify={notify} onProfileUpdated={refreshSocialProfile} recovery={passwordRecovery} onRecovered={() => setPasswordRecovery(false)} onRetryProfile={retrySocialProfile} onSignOut={handleSignOut} /></Screen>} />
      <Route path="/profile/local" element={<Navigate to="/profile" replace />} />
      <Route path="/workout" element={<WorkoutScreen notify={notify} onActivity={updateActivity} activity={activity} client={supabase} session={authSession} activityStatus={activityStatus} activityError={activityError} />} />
      <Route path="/nutrition" element={<NutritionScreen notify={notify} onActivity={updateActivity} activity={activity} client={supabase} session={authSession} activityStatus={activityStatus} activityError={activityError} />} />
      <Route path="/curated" element={<Navigate to="/food" replace />} />
      <Route path="/progress" element={<ProgressScreen client={supabase} session={authSession} />} />
      <Route path="/earnings" element={<EarningsScreen session={authSession} />} />
      <Route path="/academy" element={<AcademyScreen client={supabase} />} />
      <Route path="/live" element={<LiveScreen client={supabase} session={authSession} notify={notify} />} />
      <Route path="/live/:liveId" element={<LiveScreen client={supabase} session={authSession} notify={notify} />} />
      <Route path="/stories" element={authSession?.user?.id && socialProfile
        ? <Screen title="Stories" subtitle="MOMENTOS DA COMUNIDADE" className="feed-screen stories-screen"><StoryExperience client={supabase} configured={isSupabaseConfigured} session={authSession} user={socialProfile} notify={notify} /></Screen>
        : <Navigate to="/feed" replace />} />
      <Route path="/gyms" element={<Navigate to="/pass" replace />} />
      <Route path="/courses" element={<Navigate to="/academy" replace />} />
      <Route path="/academy/:courseId" element={<Navigate to="/academy" replace />} />
      <Route path="/restaurants" element={<Navigate to="/food" replace />} />
      <Route path="/results" element={<Navigate to="/progress" replace />} />
      <Route path="/settings" element={<Screen className="settings-screen" title="Configurações" subtitle="SUA EXPERIÊNCIA FORTALFY"><ThemeSettings value={themePreference} onChange={changeThemePreference} /><AccessibilitySettings preferences={accessibilityPreferences} onChange={changeAccessibilityPreferences} onReset={() => changeAccessibilityPreferences(DEFAULT_ACCESSIBILITY_PREFERENCES)} /><Link className="button subtle notification-settings-link" to="/settings/notifications"><Bell size={17} /> Preferências de notificação <ArrowRight size={16} /></Link>{!isAppInstalled && <section className="install-settings-card"><span className="install-settings-icon"><Download size={20} /></span><div className="install-settings-copy"><h2>Baixe o app Fortalfy</h2><p>Tenha acesso rápido à Fortalfy direto pela tela inicial do seu celular.</p></div><button type="button" className="button primary install-settings-button" onClick={startInstall}>Baixar app <ArrowRight size={16} /></button></section>}</Screen>} />
      <Route path="/settings/notifications" element={<Screen className="settings-screen notification-settings-screen" title="Notificações" subtitle="SUA EXPERIÊNCIA FORTALFY"><NotificationSettings client={supabase} userId={accountUserId} /></Screen>} />
      <Route path="/notifications" element={<Screen className="notification-screen"><NotificationCenter page notifications={notifications} loading={notificationLoading} error={notificationError} onRetry={refreshNotifications} onClose={() => navigate(-1)} onRead={markNotificationRead} onReadAll={markAllNotificationsRead} onNavigate={openNotificationTarget} /></Screen>} />
      <Route path="/partner/manage" element={<PartnerListingManager client={supabase} session={authSession} profile={socialProfile} notify={notify} />} />
      <Route path="/professional" element={<ProfessionalPortal client={supabase} session={authSession} profile={socialProfile} notify={notify} />} />
      <Route path="/professional/manage" element={<ProfessionalPortal client={supabase} session={authSession} profile={socialProfile} notify={notify} />} />
      <Route path="/partner/nutritionist" element={<Screen title="Encontre seu nutricionista" subtitle="PROFISSIONAIS E CADASTROS APROVADOS" className="nutritionist-discovery-screen"><NutritionistDirectory client={supabase} /></Screen>} />
      <Route path="/partner/personal" element={<Screen title="Encontre seu personal" subtitle="PROFISSIONAIS E CADASTROS APROVADOS" className="nutritionist-discovery-screen personal-discovery-screen"><PersonalDirectory client={supabase} /></Screen>} />
      <Route path="/partner/:type" element={<LivePartnerScreen client={supabase} />} />
      <Route path="/hire/:role" element={<LiveHiringScreen key={location.pathname} client={supabase} session={authSession} notify={notify} />} />
      <Route path="/shop" element={<FortalShop client={supabase} cart={shopCart} setCart={setShopCart} notify={notify} />} />
      <Route path="/cart" element={<FortalShop client={supabase} cart={shopCart} setCart={setShopCart} initialDialog="cart" notify={notify} />} />
      <Route path="/studio" element={<FortalfyStudio artwork={studioArtwork} setArtwork={setStudioArtwork} savedArts={savedArts} setSavedArts={setSavedArts} setFeedArts={setFeedArts} notify={notify} />} />
      <Route path="/trainer" element={<Dashboard key="trainer" role="trainer" client={supabase} configured={isSupabaseConfigured} session={authSession} profile={socialProfile} profileError={socialProfileError} onRetryProfile={retrySocialProfile} />} />
      <Route path="/nutritionist" element={<Dashboard key="nutritionist" role="nutritionist" client={supabase} configured={isSupabaseConfigured} session={authSession} profile={socialProfile} profileError={socialProfileError} onRetryProfile={retrySocialProfile} />} />
      <Route path="*" element={<Screen title="Página não encontrada" subtitle="FORTALFY"><div className="empty-state"><CircleHelp size={24} /><h3>Este endereço não existe</h3><p>Escolha uma área disponível para continuar.</p><Link className="button subtle" to="/home">Voltar ao início <ArrowRight size={16} /></Link></div></Screen>} />
    </Routes>
    {notificationCenterOpen && <NotificationCenter notifications={notifications} loading={notificationLoading} error={notificationError} onRetry={refreshNotifications} onClose={() => setNotificationCenterOpen(false)} onRead={markNotificationRead} onReadAll={markAllNotificationsRead} onClear={accountUserId ? null : clearNotifications} onNavigate={openNotificationTarget} />}
    </NotificationContext.Provider>
    </InstallAppContext.Provider>
    {installHelpOpen && <InstallHelpDialog onClose={() => setInstallHelpOpen(false)} />}
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
    {liveNotification && <aside className="notification-live-toast" role="status"><span className="notification-live-icon"><Bell size={16} /></span><button type="button" className="notification-live-content" onClick={() => { markNotificationRead(liveNotification.id); openNotificationTarget(liveNotification.targetRoute); setLiveNotification(null); }}><strong>{liveNotification.title}</strong><span>{liveNotification.message}</span></button><button type="button" className="icon-button" aria-label="Dispensar notificação" onClick={() => setLiveNotification(null)}><X size={16} /></button></aside>}
  </div></Suspense>;
}

export default function App() {
  return <AppContent />;
}
