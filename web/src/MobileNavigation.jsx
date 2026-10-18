import { Activity, ArrowRight, Clapperboard, Dumbbell, Home, Menu, MessageCircle, ShoppingBag, Utensils, Wallet, X, Ticket, UserRound, Users, Settings2 } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
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
  { to: "/messages", label: "Chat", detail: "Conversas privadas", icon: MessageCircle, image: "/assets/search-bars/chat_barra.png", theme: "community" },
  { to: "/earnings", label: "Rendimentos", detail: "Informações financeiras", icon: Wallet, image: "/assets/search-bars/meus_rendimentos_barra.png", theme: "earnings" },
  { to: "/settings", label: "Configurações", detail: "Aparência do aplicativo", icon: Settings2, image: "/assets/search-bars/personal_barra.png", theme: "settings" },
];

export function NavigationDrawer() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = event => event.key === "Escape" && setOpen(false);
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const drawer = open && createPortal(<div className="drawer-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setOpen(false)}>
    <aside id="fortalfy-navigation-drawer" className="navigation-drawer" role="dialog" aria-modal="true" aria-label="Menu principal">
      <div className="drawer-heading"><div><span className="eyebrow">FORTALFY</span><h2>Seu espaço</h2></div><button className="icon-button" type="button" aria-label="Fechar menu" onClick={() => setOpen(false)}><X size={19} /></button></div>
      <nav aria-label="Menu principal">
        {drawerItems.map(({ to, label, detail, icon: Icon, image, theme }) => <Link key={to} to={to} className={`drawer-link drawer-link-${theme}`} style={{ "--drawer-image": `url("${image}")` }} onClick={() => setOpen(false)}>
          <span className="drawer-link-icon"><Icon size={19} /></span><span><strong>{label}</strong><small>{detail}</small></span>
        </Link>)}
      </nav>
      <Link to="/profile" className="drawer-account-link" onClick={() => setOpen(false)}>Meu perfil <ArrowRight size={15} /></Link>
    </aside>
  </div>, document.body);

  return <>
    <button className="icon-button drawer-trigger" type="button" aria-label="Abrir menu de navegação" aria-expanded={open} aria-controls="fortalfy-navigation-drawer" onClick={() => setOpen(true)}>
      <Menu size={21} />
    </button>
    {drawer}
  </>;
}

export default function BottomNav() {
  const location = useLocation();
  const active = ["/feed", "/reels", "/people", "/messages"].includes(location.pathname)
    ? "/feed"
    : location.pathname.startsWith("/shop") || location.pathname === "/studio"
    ? "/shop"
    : ["/pass", "/workout", "/nutrition", "/progress", "/earnings"].includes(location.pathname)
    ? "/home"
    : primaryTabs.find(tab => location.pathname === tab.to)?.to;
  const activeIndex = primaryTabs.findIndex(tab => tab.to === active);
  if (location.pathname.startsWith("/trainer") || location.pathname.startsWith("/nutritionist")) return null;
  if (location.pathname === "/reels") return null;
  return <nav className="bottom-nav" aria-label="Navegação principal">
    {activeIndex >= 0 && <span
      className="bottom-nav-indicator"
      aria-hidden="true"
      style={{ "--nav-active-offset": `calc(${10 + activeIndex * 20}% - 22px)` }}
    ><span /></span>}
    {primaryTabs.map(({ to, label, icon: Icon }) =>
      <Link key={to} to={to} className={`bottom-nav-item ${active === to ? "active" : ""}`} aria-current={active === to ? "page" : undefined}>
        <span className="bottom-nav-icon"><Icon size={21} strokeWidth={active === to ? 2.5 : 1.8} /></span><span>{label}</span>
      </Link>)}
  </nav>;
}
