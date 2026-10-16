import { ArrowRight, Clapperboard, Dumbbell, Home, Menu, MessageCircle, ShoppingBag, Utensils, Wallet, X, Ticket, UserRound, Users } from "lucide-react";
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
  { to: "/reels", label: "FortalReels", detail: "Vídeos verticais fitness", icon: Clapperboard },
  { to: "/pass", label: "Fortalpass", detail: "Academias e modalidades", icon: Ticket },
  { to: "/shop", label: "Fortalshop", detail: "Produtos oficiais", icon: ShoppingBag },
  { to: "/nutrition", label: "Nutricionista", detail: "Plano alimentar semanal", icon: Utensils },
  { to: "/workout", label: "Personal", detail: "Treino semanal", icon: Dumbbell },
  { to: "/messages", label: "Chat", detail: "Conversas privadas", icon: MessageCircle },
  { to: "/earnings", label: "Meus Rendimentos", detail: "Resumo financeiro", icon: Wallet },
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
        {drawerItems.map(({ to, label, detail, icon: Icon }) => <Link key={to} to={to} className="drawer-link" onClick={() => setOpen(false)}>
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
  if (location.pathname.startsWith("/trainer") || location.pathname.startsWith("/nutritionist")) return null;
  if (location.pathname === "/reels") return null;
  return <nav className="bottom-nav" aria-label="Navegação principal">{primaryTabs.map(({ to, label, icon: Icon }) =>
    <Link key={to} to={to} className={`bottom-nav-item ${active === to ? "active" : ""}`} aria-current={active === to ? "page" : undefined}>
      <Icon size={21} strokeWidth={active === to ? 2.5 : 1.8} /><span>{label}</span>
    </Link>)}</nav>;
}
