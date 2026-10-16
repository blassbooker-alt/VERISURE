import { useState } from "react";
import { ArrowRight, ShoppingBag, Sparkles, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import Brand from "./Brand.jsx";
import BottomNav, { NavigationDrawer } from "./MobileNavigation.jsx";
import { fortalfyAsset } from "./assetPath.js";

function ShopDialog({ onClose, onClear, itemCount }) {
  return <div className="modal-scrim shop-scrim" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="modal-card shop-dialog" role="dialog" aria-modal="true" aria-label="Seu carrinho">
      <div className="modal-header"><div><span className="eyebrow">FORTALFY SHOP</span><h2>Seu carrinho</h2></div><button className="icon-button" aria-label="Fechar janela" onClick={onClose}>×</button></div>
      {itemCount > 0
        ? <div className="shop-cart-empty"><span><ShoppingBag size={25} /></span><h3>Os itens antigos não estão disponíveis.</h3><p>O catálogo anterior não confirmava estoque ou vendedores. Nenhum desses itens pode ser comprado agora.</p><button className="button subtle wide-button" onClick={onClear}><Trash2 size={16} /> Remover {itemCount} {itemCount === 1 ? "item" : "itens"} antigos</button></div>
        : <div className="shop-cart-empty"><span><ShoppingBag size={25} /></span><h3>Seu carrinho está vazio.</h3><p>O carrinho será habilitado quando houver produtos oficiais disponíveis.</p><button className="button primary" onClick={onClose}>Voltar à loja <ArrowRight size={16} /></button></div>}
    </section>
  </div>;
}

export default function FortalShop({ cart, setCart, initialDialog = "", notify }) {
  const [dialog, setDialog] = useState(initialDialog);
  const itemCount = cart.reduce((total, line) => total + line.quantity, 0);
  const clearLegacyCart = () => {
    if (!itemCount || !window.confirm("Remover os itens do catálogo antigo salvos no carrinho?")) return;
    setCart([]);
    setDialog("");
    notify("Itens antigos removidos do carrinho.");
  };

  return <div className="app-screen shop-screen">
    <header className="mobile-header shop-header">
      <NavigationDrawer />
      <Link to="/home" aria-label="Fortalfy, página inicial"><Brand /></Link>
      <div className="shop-header-actions"><Link className="button subtle small-button shop-history-button" to="/studio">Studio</Link><button className="shop-bag-button" aria-label={`Abrir carrinho, ${itemCount} itens antigos`} onClick={() => setDialog("cart")}><ShoppingBag size={20} /><span className="shop-cart-count" aria-label={`${itemCount} itens antigos no carrinho`}>{itemCount}</span></button></div>
    </header>
    <main className="screen-content shop-content">
      <div className="shop-title-row"><div><span className="eyebrow">FORTALFY SHOP</span><h1>Bem-estar no<br />seu ritmo.</h1></div></div>
      <p className="shop-intro">A loja só anuncia produtos após confirmar vendedor, preço e disponibilidade.</p>
      <section className="shop-editorial">
        <img className="shop-editorial-banner" src={fortalfyAsset("publicidade", "banner-app-papagaio-b.jpg")} alt="" aria-hidden="true" />
        <div className="shop-editorial-copy"><span className="shop-editorial-label"><Sparkles size={13} /> FORTALFY SHOP</span><h2>Um catálogo confiável começa com informações reais.</h2><p>Nenhum produto, preço, desconto ou estoque é anunciado sem confirmação do vendedor.</p></div>
      </section>
      <div className="shop-trust-row"><span><ShoppingBag size={15} /> Sem produtos publicados</span><span><Sparkles size={15} /> Estoque não anunciado</span><span><ShoppingBag size={15} /> Pagamento desativado</span></div>
      <section className="empty-state shop-empty"><ShoppingBag size={25} /><h2>Nenhum produto oficial disponível</h2><p>O catálogo será exibido quando houver produtos cadastrados com preço e disponibilidade confirmados. Não há itens demonstrativos à venda.</p><Link to="/home" className="button subtle">Voltar ao início <ArrowRight size={16} /></Link></section>
      <section className="shop-studio-cta"><div className="shop-studio-icon"><Sparkles size={20} /></div><div><span className="eyebrow">FORTALFY STUDIO</span><h2>Suas ideias merecem virar arte.</h2><p>Crie imagens originais para sua rotina e compartilhe no Feed.</p></div><Link to="/studio" className="button lime-button">Abrir Studio <ArrowRight size={16} /></Link></section>
    </main>
    <BottomNav />
    {dialog === "cart" && <ShopDialog onClose={() => setDialog("")} onClear={clearLegacyCart} itemCount={itemCount} />}
  </div>;
}
