import { Activity, Bell, BookOpen, Brush, Building2, Clapperboard, Dumbbell, Home, Menu, MessageCircle, ShoppingBag, ShoppingCart, Sparkles, Utensils, Wallet, X, Ticket, UserRound, Users, Settings2, Compass, Radio } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const primaryTabs = [
  { to: "/home", label: "Início", icon: Home },
  { to: "/workout", label: "Treinos", icon: Dumbbell },
  { to: "/feed", label: "Comunidade", icon: Users },
  { to: "/shop", label: "Loja", icon: ShoppingBag },
  { to: "/profile", label: "Perfil", icon: UserRound },
];

const navigationGroups = [
  { title: "Principal", items: [
    { to: "/home", label: "Início", detail: "Seu resumo e próximo passo", icon: Home },
    { to: "/workout", label: "Treinos", detail: "Registre suas atividades", icon: Dumbbell },
    { to: "/progress", label: "Meu progresso", detail: "Histórico de atividades", icon: Activity },
  ] },
  { title: "Comunidade", items: [
    { to: "/feed", label: "Feed", detail: "Publicações da comunidade", icon: Users },
    { to: "/reels", label: "FortalReels", detail: "Vídeos da comunidade", icon: Clapperboard },
    { to: "/people", label: "Pessoas", detail: "Encontre perfis", icon: Compass },
    { to: "/messages", label: "Mensagens", detail: "Conversas privadas", icon: MessageCircle },
    { to: "/live", label: "Ao vivo", detail: "Aulas e transmissões", icon: Radio },
  ] },
  { title: "Saúde e rotina", items: [
    { to: "/nutrition", label: "Diário alimentar", detail: "Registre suas refeições", icon: Utensils },
    { to: "/food", label: "FortalFood", detail: "Cardápios de parceiros", icon: ShoppingBag },
  ] },
  { title: "Explorar", items: [
    { to: "/pass", label: "FortalPass", detail: "Academias e profissionais", icon: Ticket },
    { to: "/partner/gym", label: "Academias parceiras", detail: "Unidades aprovadas", icon: Building2 },
    { to: "/partner/personal", label: "Personal trainers", detail: "Profissionais aprovados", icon: Dumbbell },
    { to: "/partner/nutritionist", label: "Nutricionistas", detail: "Profissionais aprovados", icon: Utensils },
    { to: "/creator", label: "FortalCreator", detail: "Programa de criadores", icon: Clapperboard },
    { to: "/campaigns", label: "Campanhas", detail: "Conteúdo visual oficial", icon: Sparkles },
    { to: "/academy", label: "Academia Fortalfy", detail: "Conteúdos e cursos", icon: BookOpen },
    { to: "/studio", label: "Fortalfy Studio", detail: "Criação de artes", icon: Brush },
  ] },
  { title: "Loja", items: [
    { to: "/shop", label: "FortalShop", detail: "Produtos de parceiros", icon: ShoppingBag },
    { to: "/cart", label: "Minha sacola", detail: "Itens selecionados", icon: ShoppingCart },
  ] },
  { title: "Conta", items: [
    { to: "/profile", label: "Meu perfil", detail: "Dados e publicações", icon: UserRound },
    { to: "/notifications", label: "Notificações", detail: "Atualizações da conta", icon: Bell },
    { to: "/settings/notifications", label: "Preferências de notificação", detail: "Escolha o que receber", icon: Bell },
    { to: "/settings", label: "Configurações", detail: "Aparência e acessibilidade", icon: Settings2 },
  ] },
  { title: "Profissional", items: [
    { to: "/earnings", label: "Rendimentos", detail: "Informações financeiras", icon: Wallet },
    { to: "/trainer", label: "Painel do personal", detail: "Agendamentos profissionais", icon: Dumbbell },
    { to: "/nutritionist", label: "Painel do nutricionista", detail: "Agendamentos profissionais", icon: Utensils },
    { to: "/professional", label: "Área profissional", detail: "Serviços profissionais", icon: Building2 },
    { to: "/partner/manage", label: "Gestão de parceiros", detail: "Cadastros e estabelecimentos", icon: Building2 },
  ] },
];

export function NavigationDrawer({ desktopOpen = false, onDesktopOpenChange }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktop, setDesktop] = useState(() => window.matchMedia("(min-width: 1024px)").matches);
  const location = useLocation();
  const triggerRef = useRef(null);
  const drawerRef = useRef(null);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  const open = desktop ? desktopOpen : mobileOpen;

  useEffect(() => {
    if (!open || desktop) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = event => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, desktop]);

  const active = path => location.pathname === path || (path !== "/" && location.pathname.startsWith(`${path}/`));
  const close = () => desktop ? onDesktopOpenChange?.(false) : setMobileOpen(false);
  const drawer = open && !desktop && createPortal(<div className="drawer-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setMobileOpen(false)}>
    <aside ref={drawerRef} id="fortalfy-navigation-drawer" className="navigation-drawer" role="dialog" aria-modal="true" aria-label="Menu principal">
      <div className="drawer-heading"><div><span className="eyebrow">FORTALFY</span><h2>Seu espaço</h2></div><button className="icon-button" type="button" aria-label="Fechar menu" onClick={close}><X size={19} /></button></div>
      <nav className="drawer-desktop-content" aria-label="Áreas do Fortalfy">
        {navigationGroups.map(group => <section className="drawer-group" key={group.title} aria-label={group.title}>
          <h3>{group.title}</h3>
          <div>{group.items.map(({ to, label, detail, icon: Icon }) => <Link key={to} to={to} className={active(to) ? "active" : ""} aria-current={active(to) ? "page" : undefined} onClick={close}><Icon size={17} /><span><strong>{label}</strong><small>{detail}</small></span></Link>)}</div>
        </section>)}
      </nav>
    </aside>
  </div>, document.body);

  return <>
    <button ref={triggerRef} className={`icon-button drawer-trigger${desktop && open ? " is-open" : ""}`} type="button" aria-label={desktop && open ? "Fechar menu de navegação" : "Abrir menu de navegação"} aria-expanded={open} aria-controls={desktop ? "fortalfy-desktop-navigation" : "fortalfy-navigation-drawer"} onClick={() => desktop ? onDesktopOpenChange?.(!open) : setMobileOpen(true)}>
      {desktop && open ? <X size={21} /> : <Menu size={21} />}
    </button>
    {drawer}
  </>;
}

export default function BottomNav({ desktopExpanded = false, onNotificationsOpen }) {
  const [desktop, setDesktop] = useState(() => window.matchMedia("(min-width: 1024px)").matches);
  const location = useLocation();
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);
  const expanded = desktop && desktopExpanded;
  const communityRoutes = ["/feed", "/reels", "/people", "/messages", "/live"];
  const active = location.pathname === "/home" ? "/home"
    : ["/workout", "/progress", "/trainer"].includes(location.pathname) ? "/workout"
    : communityRoutes.includes(location.pathname) ? "/feed"
    : ["/shop", "/cart", "/studio"].includes(location.pathname) ? "/shop"
    : location.pathname.startsWith("/profile") ? "/profile"
    : undefined;
  if (location.pathname === "/reels") return null;
  const activeIndex = primaryTabs.findIndex(tab => tab.to === active);
  return <nav id="fortalfy-desktop-navigation" className={`bottom-nav${expanded ? " desktop-nav-expanded" : ""}`} aria-label="Navegação principal">
    {activeIndex >= 0 && <span
      className="bottom-nav-indicator"
      aria-hidden="true"
      style={{ "--nav-active-offset": `calc(${10 + activeIndex * 20}% - 22px)` }}
    ><span /></span>}
    {(expanded ? navigationGroups.flatMap(group => [{ groupTitle: group.title }, ...group.items]) : primaryTabs).map(item => {
      if (item.groupTitle) return <h2 className="desktop-nav-group-title" key={item.groupTitle}>{item.groupTitle}</h2>;
      const { to, label, icon: Icon } = item;
      return (
      <Link key={`${to}-${label}`} to={to} className={`bottom-nav-item ${active === to && label !== "Criar" ? "active" : ""}${label === "Criar" ? " bottom-nav-create" : ""}`} aria-current={active === to && label !== "Criar" ? "page" : undefined} aria-label={label === "Criar" ? "Criar publicação" : undefined}>
        <span className="bottom-nav-icon"><Icon size={21} strokeWidth={active === to ? 2.5 : 1.8} /></span><span>{label}</span>
      </Link>);
    })}
    {expanded && <button className="bottom-nav-item desktop-nav-notifications" type="button" onClick={onNotificationsOpen}><span className="bottom-nav-icon"><Bell size={20} /></span><span>Notificações</span></button>}
  </nav>;
}
