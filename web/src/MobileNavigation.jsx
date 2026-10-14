import { Activity, Home, ShoppingBag, Utensils, Users, Wallet } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const primaryTabs = [
  { to: "/home", label: "Início", icon: Home },
  { to: "/feed", label: "Feed", icon: Users },
  { to: "/food", label: "Food", icon: Utensils },
  { to: "/pass", label: "Pass", icon: Wallet },
  { to: "/shop", label: "Loja", icon: ShoppingBag },
  { to: "/profile", label: "Perfil", icon: Activity },
];

export default function BottomNav() {
  const location = useLocation();
  const active = ["/feed", "/reels", "/people", "/messages"].includes(location.pathname)
    ? "/feed"
    : location.pathname.startsWith("/shop") || location.pathname === "/studio"
    ? "/shop"
    : primaryTabs.find(tab => location.pathname === tab.to)?.to;
  if (location.pathname.startsWith("/trainer") || location.pathname.startsWith("/nutritionist")) return null;
  return <nav className="bottom-nav" aria-label="Navegação principal">{primaryTabs.map(({ to, label, icon: Icon }) =>
    <Link key={to} to={to} className={`bottom-nav-item ${active === to ? "active" : ""}`} aria-current={active === to ? "page" : undefined}>
      <Icon size={21} strokeWidth={active === to ? 2.5 : 1.8} /><span>{label}</span>
    </Link>)}</nav>;
}
