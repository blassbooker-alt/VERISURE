import { Activity, ArrowRight, Bell, BookOpen, Brush, Building2, Clapperboard, Dumbbell, Home, Menu, MessageCircle, Plus, ShoppingBag, ShoppingCart, Utensils, Wallet, X, Ticket, UserRound, Users, Settings2, Compass, Radio } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const primaryTabs = [
  { to: "/home", label: "Início", icon: Home },
  { to: "/feed", label: "Feed", icon: Users },
  { to: "/food", label: "Food", icon: Utensils },
  { to: "/shop", label: "Loja", icon: ShoppingBag },
  { to: "/profile", label: "Perfil", icon: UserRound },
];

const drawerItems = [
  { to: "/reels", label: "FortalReels", detail: "Vídeos verticais fitness", icon: Clapperboard, image: "/assets/search-bars/fortalreels_barra.png", theme: "reels" },
  { to: "/pass", label: "FortalPass", detail: "Academias e modalidades", icon: Ticket, image: "/assets/search-bars/fortalpass_barra.png", theme: "pass" },
  { to: "/shop", label: "FortalShop", detail: "Produtos oficiais", icon: ShoppingBag, image: "/assets/search-bars/fortalshop_barra.png", theme: "shop" },
  { to: "/nutrition", label: "Nutricionista", detail: "Plano alimentar semanal", icon: Utensils, image: "/assets/search-bars/nutricionista_barra.png", theme: "food" },
  { to: "/workout", label: "Personal", detail: "Treino semanal", icon: Dumbbell, image: "/assets/search-bars/personal_barra.png", theme: "training" },
  { to: "/progress", label: "Meu desempenho", detail: "Evolução e histórico de treinos", icon: Activity, image: "/assets/search-bars/personal_barra.png", theme: "training" },
  { to: "/creator", label: "FortalCreator", detail: "Programa de criadores", icon: Clapperboard, image: "/assets/search-bars/fortalreels_barra.png", theme: "reels" },
  { to: "/messages", label: "Chat", detail: "Conversas privadas", icon: MessageCircle, image: "/assets/search-bars/chat_barra.png", theme: "community" },
  { to: "/earnings", label: "Rendimentos", detail: "Informações financeiras", icon: Wallet, image: "/assets/search-bars/meus_rendimentos_barra.png", theme: "earnings" },
  { to: "/settings", label: "Configurações", detail: "Aparência do aplicativo", icon: Settings2, image: "/assets/search-bars/personal_barra.png", theme: "settings" },
];

export function NavigationDrawer({ onNotificationsOpen, desktopOpen = false, onDesktopOpenChange }) {
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
  const groupedItems = [
    { title: "Comunidade", items: [drawerItems[0], { to: "/people", label: "Pessoas", detail: "Encontre a comunidade", icon: Compass }, drawerItems[7]] },
    { title: "Bem-estar", items: [drawerItems[1], drawerItems[3], drawerItems[4], drawerItems[5]] },
    { title: "Descobrir", items: [drawerItems[6],
      { to: "/academy", label: "Academia Fortalfy", detail: "Conteúdos e cursos", icon: BookOpen },
      { to: "/live", label: "Ao vivo", detail: "Aulas e transmissões", icon: Radio },
      { to: "/studio", label: "Fortalfy Studio", detail: "Criação de artes", icon: Brush },
      { to: "/partner/gym", label: "Academias parceiras", detail: "Perfis aprovados", icon: Building2 },
      { to: "/partner/personal", label: "Personal trainers", detail: "Profissionais aprovados", icon: Dumbbell },
      { to: "/partner/nutritionist", label: "Nutricionistas", detail: "Profissionais aprovados", icon: Utensils },
    ] },
    { title: "Compras", items: [{ to: "/cart", label: "Minha sacola", detail: "Itens selecionados na loja", icon: ShoppingCart }] },
    { title: "Conta", items: [drawerItems[8], drawerItems[9]] },
  ];

  const drawer = open && !desktop && createPortal(<div className="drawer-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setMobileOpen(false)}>
    <aside ref={drawerRef} id="fortalfy-navigation-drawer" className="navigation-drawer" role="dialog" aria-modal="true" aria-label="Menu principal">
      <div className="drawer-heading"><div><span className="eyebrow">FORTALFY</span><h2>Seu espaço</h2></div><button className="icon-button" type="button" aria-label="Fechar menu" onClick={close}><X size={19} /></button></div>
      <nav className="drawer-mobile-links" aria-label="Menu principal">
        {drawerItems.map(({ to, label, detail, icon: Icon, image, theme }) => <Link key={to} to={to} className={`drawer-link drawer-link-${theme}`} style={{ "--drawer-image": `url("${image}")` }} onClick={close}>
          <span className="drawer-link-icon"><Icon size={19} /></span><span><strong>{label}</strong><small>{detail}</small></span>
        </Link>)}
      </nav>
      <div className="drawer-desktop-content">
        <nav className="drawer-primary-links" aria-label="Ações rápidas">
          <button type="button" onClick={() => { close(); onNotificationsOpen?.(); }}><Bell size={17} />Notificações</button>
        </nav>
        {groupedItems.map(group => <section className="drawer-group" key={group.title} aria-label={group.title}>
          <h3>{group.title}</h3>
          <nav aria-label={group.title}>{group.items.map(({ to, label, detail, icon: Icon }) => <Link key={to} to={to} className={active(to) ? "active" : ""} aria-current={active(to) ? "page" : undefined} onClick={close}><Icon size={17} /><span><strong>{label}</strong><small>{detail}</small></span></Link>)}</nav>
        </section>)}
        <Link to="/professional" className={`drawer-management-link${active("/professional") ? " active" : ""}`} aria-current={active("/professional") ? "page" : undefined} onClick={close}><Building2 size={17} /><span><strong>Área profissional</strong><small>Serviços para profissionais</small></span><ArrowRight size={15} /></Link>
        <Link to="/partner/manage" className={`drawer-management-link${active("/partner/manage") ? " active" : ""}`} aria-current={active("/partner/manage") ? "page" : undefined} onClick={close}><Wallet size={17} /><span><strong>Gestão de parceiros</strong><small>Cadastros e estabelecimentos</small></span><ArrowRight size={15} /></Link>
      </div>
      <Link to="/profile" className="drawer-account-link" onClick={close}>Meu perfil <ArrowRight size={15} /></Link>
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
  const feedMode = location.pathname === "/feed";
  const mobileTabs = feedMode ? [
    { to: "/home", label: "Início", icon: Home },
    { to: "/feed", label: "Feed", icon: Users },
    { to: "/feed?compose=1", label: "Criar", icon: Plus },
    { to: "/messages", label: "Mensagens", icon: MessageCircle },
    { to: "/profile", label: "Perfil", icon: UserRound },
  ] : primaryTabs;
  const active = feedMode ? "/feed" : ["/feed", "/reels", "/people", "/messages"].includes(location.pathname)
    ? "/feed"
    : location.pathname.startsWith("/shop") || location.pathname === "/studio"
    ? "/shop"
    : ["/pass", "/workout", "/nutrition", "/progress", "/earnings"].includes(location.pathname)
    ? "/home"
    : primaryTabs.find(tab => location.pathname === tab.to)?.to;
  if (location.pathname.startsWith("/trainer") || location.pathname.startsWith("/nutritionist")) return null;
  if (location.pathname === "/reels") return null;
  const desktopItems = [...primaryTabs, ...drawerItems,
    { to: "/people", label: "Pessoas", icon: Compass },
    { to: "/academy", label: "Academia Fortalfy", icon: BookOpen },
    { to: "/live", label: "Ao vivo", icon: Radio },
    { to: "/studio", label: "Fortalfy Studio", icon: Brush }, drawerItems[6],
    { to: "/partner/gym", label: "Academias parceiras", icon: Building2 },
    { to: "/partner/personal", label: "Personal trainers", icon: Dumbbell },
    { to: "/partner/nutritionist", label: "Nutricionistas", icon: Utensils },
    { to: "/cart", label: "Minha sacola", icon: ShoppingCart },
    { to: "/professional", label: "Área profissional", icon: Building2 },
    { to: "/partner/manage", label: "Gestão de parceiros", icon: Wallet },
  ].filter((item, index, all) => all.findIndex(other => other.to === item.to) === index);
  const activeIndex = (expanded ? desktopItems : mobileTabs).findIndex(tab => tab.to === active);
  return <nav id="fortalfy-desktop-navigation" className={`bottom-nav${expanded ? " desktop-nav-expanded" : ""}`} aria-label="Navegação principal">
    {activeIndex >= 0 && <span
      className="bottom-nav-indicator"
      aria-hidden="true"
      style={{ "--nav-active-offset": `calc(${10 + activeIndex * 20}% - 22px)` }}
    ><span /></span>}
    {(expanded ? desktopItems : mobileTabs).map(({ to, label, icon: Icon }) =>
      <Link key={`${to}-${label}`} to={to} className={`bottom-nav-item ${active === to && label !== "Criar" ? "active" : ""}${label === "Criar" ? " bottom-nav-create" : ""}`} aria-current={active === to && label !== "Criar" ? "page" : undefined} aria-label={label === "Criar" ? "Criar publicação" : undefined}>
        <span className="bottom-nav-icon"><Icon size={21} strokeWidth={active === to ? 2.5 : 1.8} /></span><span>{label}</span>
      </Link>)}
    {expanded && <button className="bottom-nav-item desktop-nav-notifications" type="button" onClick={onNotificationsOpen}><span className="bottom-nav-icon"><Bell size={20} /></span><span>Notificações</span></button>}
  </nav>;
}
