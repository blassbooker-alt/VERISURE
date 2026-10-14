import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Heart, Minus, Plus, Search, ShieldCheck, ShoppingBag, Sparkles, Tag, Truck, X } from "lucide-react";
import { Link } from "react-router-dom";
import Brand from "./Brand.jsx";
import BottomNav from "./MobileNavigation.jsx";
import { shopProducts } from "./shopData.js";

const money = value => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ShopDialog({ title, children, onClose }) {
  return <div className="modal-scrim shop-scrim" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="modal-card shop-dialog" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-header"><div><span className="eyebrow">FORTALFY SHOP · PRÉVIA</span><h2>{title}</h2></div><button className="icon-button" aria-label="Fechar janela" onClick={onClose}><X size={20} /></button></div>
      {children}
    </section>
  </div>;
}

function CartBadge({ count }) {
  return <span className="shop-cart-count" aria-label={`${count} ${count === 1 ? "item" : "itens"} no carrinho`}>{count}</span>;
}

export default function FortalShop({ cart, setCart, orders, setOrders, notify }) {
  const [category, setCategory] = useState("Tudo");
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedShade, setSelectedShade] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [dialog, setDialog] = useState("");
  const [coupon, setCoupon] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [delivery, setDelivery] = useState("Entrega a confirmar");
  const [confirmedOrder, setConfirmedOrder] = useState(null);
  const categoryOptions = ["Tudo", ...new Set(shopProducts.map(product => product.category))];
  const visibleProducts = useMemo(() => shopProducts.filter(product => {
    const matchesCategory = category === "Tudo" || product.category === category;
    const matchesSearch = `${product.name} ${product.category} ${product.description}`.toLowerCase().includes(search.trim().toLowerCase());
    return matchesCategory && matchesSearch;
  }), [category, search]);
  const itemCount = cart.reduce((total, line) => total + line.quantity, 0);
  const subtotal = cart.reduce((total, line) => total + shopProducts.find(product => product.id === line.id).price * line.quantity, 0);
  const discount = couponApplied ? subtotal * 0.1 : 0;
  const simulatedDelivery = delivery === "Retirada a confirmar" ? 0 : 14.9;
  const total = Math.max(0, subtotal - discount) + (cart.length ? simulatedDelivery : 0);

  const addToCart = (product, shade = product.shades[0], size = product.sizes[0] || "") => {
    const key = `${product.id}|${shade}|${size}`;
    setCart(current => {
      const existingLine = current.find(line => line.key === key);
      return existingLine
        ? current.map(line => line.key === key ? { ...line, quantity: line.quantity + 1 } : line)
        : [...current, { key, id: product.id, shade, size, quantity: 1 }];
    });
    notify(`${product.name} adicionado ao carrinho.`);
    setSelectedProduct(null);
  };
  const updateQuantity = (key, amount) => setCart(current => current
    .map(line => line.key === key ? { ...line, quantity: line.quantity + amount } : line)
    .filter(line => line.quantity > 0));
  const openProduct = product => {
    setSelectedProduct(product);
    setSelectedShade(product.shades[0]);
    setSelectedSize(product.sizes[0] || "");
  };
  const applyCoupon = event => {
    event.preventDefault();
    if (coupon.trim().toUpperCase() === "FORTALFY10") {
      setCouponApplied(true);
      notify("Cupom de demonstração aplicado ao total ilustrativo.");
    } else {
      setCouponApplied(false);
      notify("Cupom não reconhecido. Use FORTALFY10 para testar a prévia.");
    }
  };
  const placeOrder = () => {
    const order = {
      id: `FRT-${String(Date.now()).slice(-7)}`,
      createdAt: new Date().toLocaleDateString("pt-BR"),
      lines: cart.map(line => ({ ...line, name: shopProducts.find(product => product.id === line.id).name })),
      total,
      delivery,
    };
    setOrders(current => [order, ...current]);
    setConfirmedOrder(order);
    setCart([]);
    setCoupon("");
    setCouponApplied(false);
    setDialog("order-confirmed");
  };
  const toggleFavorite = productId => setFavorites(current => current.includes(productId)
    ? current.filter(id => id !== productId)
    : [...current, productId]);

  return <div className="app-screen shop-screen">
    <header className="mobile-header shop-header">
      <Link to="/home" aria-label="Fortalfy, página inicial"><Brand /></Link>
      <div className="shop-header-actions"><Link className="button subtle small-button shop-history-button" to="/studio">Studio</Link><button className="shop-bag-button" aria-label={`Abrir carrinho, ${itemCount} itens`} onClick={() => setDialog("cart")}><ShoppingBag size={20} /><CartBadge count={itemCount} /></button></div>
    </header>
    <main className="screen-content shop-content">
      <div className="shop-title-row"><div><span className="eyebrow">FORTALFY SHOP · MOVIMENTO & BEM-ESTAR</span><h1>Feito para<br />o seu ritmo.</h1></div><button className="shop-orders-link" onClick={() => setDialog("orders")}><span><ShoppingBag size={17} /></span>Meus pedidos</button></div>
      <p className="shop-intro">Uma seleção de ideias para acompanhar a sua rotina.</p>
      <section className="shop-editorial">
        <div className="shop-editorial-copy"><span className="shop-editorial-label"><Sparkles size={13} /> CURADORIA FORTALFY</span><h2>O próximo passo<br />começa com você.</h2><p>Itens pensados para deixar sua rotina mais leve.</p><button className="button lime-button small-button" onClick={() => document.getElementById("shop-catalog")?.scrollIntoView({ behavior: "smooth" })}>Explorar coleção <ArrowRight size={15} /></button></div>
        <div className="shop-editorial-art" aria-hidden="true"><img src={shopProducts[1].image} className="editorial-bottle" alt="" /><img src={shopProducts[0].image} className="editorial-shirt" alt="" /></div>
        <span className="shop-editorial-glow" aria-hidden="true" />
      </section>
      <div className="shop-trust-row"><span><ShieldCheck size={15} /> Fotos de referência</span><span><Truck size={15} /> Entrega a confirmar</span><span><Tag size={15} /> Pagamento não conectado</span></div>
      <div className="shop-catalog-heading" id="shop-catalog"><div><span className="eyebrow">ESCOLHA COM CALMA</span><h2>Para sua jornada</h2></div><button className="shop-orders-link" onClick={() => setDialog("orders")}>Pedidos <ArrowRight size={14} /></button></div>
      <label className="search-field shop-search"><Search size={19} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar roupas, acessórios e kits" aria-label="Buscar produtos da FortalShop" /><button aria-label="Limpar busca" onClick={() => setSearch("")}>{search && <X size={17} />}</button></label>
      <div className="chip-row shop-categories" aria-label="Filtrar produtos">{categoryOptions.map(item => <button key={item} onClick={() => setCategory(item)} className={`filter-chip ${item === category ? "active" : ""}`}>{item}</button>)}</div>
      <section className="shop-product-grid" aria-label="Produtos">
        {visibleProducts.map(product => <article className="shop-product-card" key={product.id}>
          <button className="shop-product-visual" aria-label={`Ver ${product.name}`} onClick={() => openProduct(product)}>
            <img src={product.image} alt={product.imageAlt} loading="lazy" />
            <span className="shop-product-tag">{product.tag}</span>
            <span className="shop-photo-label">FOTO ILUSTRATIVA</span>
          </button>
          <button className={`shop-favorite ${favorites.includes(product.id) ? "is-favorite" : ""}`} aria-label={favorites.includes(product.id) ? "Remover dos favoritos" : "Salvar nos favoritos"} aria-pressed={favorites.includes(product.id)} onClick={() => toggleFavorite(product.id)}><Heart size={17} fill={favorites.includes(product.id) ? "currentColor" : "none"} /></button>
          <div className="shop-product-info"><span className="shop-product-category">{product.category}</span><button className="shop-product-name" onClick={() => openProduct(product)}>{product.name}</button><p>{product.description}</p><div className="shop-price-line"><strong>{money(product.price)}</strong>{product.compareAt && <del>{money(product.compareAt)}</del>}</div>
            <button className="button primary shop-add-button" onClick={() => product.sizes.length ? openProduct(product) : addToCart(product)}>{product.sizes.length ? "Escolher opções" : <><Plus size={16} /> Adicionar</>}</button>
          </div>
        </article>)}
        {!visibleProducts.length && <div className="empty-state shop-empty"><Search size={25} /><h3>Nenhum item encontrado</h3><p>Experimente outro termo ou categoria.</p><button className="button subtle" onClick={() => { setSearch(""); setCategory("Tudo"); }}>Limpar filtros</button></div>}
      </section>
      <section className="shop-studio-cta"><div className="shop-studio-icon"><Sparkles size={20} /></div><div><span className="eyebrow">FORTALFY STUDIO</span><h2>Suas ideias merecem virar arte.</h2><p>Crie imagens originais para sua rotina e compartilhe no Feed.</p></div><Link to="/studio" className="button lime-button">Abrir Studio <ArrowRight size={16} /></Link></section>
      <p className="shop-disclaimer">Prévia de catálogo: as fotos são referências de produtos genéricos e não retratam itens oficiais da Fortalfy. Produtos, marcas, preços, estoque, prazo de entrega, retirada e condições comerciais ainda não foram confirmados. Os pedidos e descontos ficam apenas neste dispositivo. Nenhum pagamento é cobrado ou processado.</p>
    </main>
    <BottomNav />

    {selectedProduct && <ShopDialog title={selectedProduct.name} onClose={() => setSelectedProduct(null)}>
      <div className="shop-product-detail">
        <div className="shop-detail-image-wrap"><img src={selectedProduct.image} alt={selectedProduct.imageAlt} /><span>FOTO DE REFERÊNCIA · ITEM NÃO CONFIRMADO</span></div>
        <span className="shop-product-category">{selectedProduct.category} · {selectedProduct.official ? "Conceito Fortalfy" : "Seleção de bem-estar"}</span>
        <p className="modal-description">{selectedProduct.detail}</p>
        <div className="shop-price-line detail-price"><strong>{money(selectedProduct.price)}</strong>{selectedProduct.compareAt && <del>{money(selectedProduct.compareAt)}</del>}</div>
        {selectedProduct.shades.length > 1 && <div className="shop-option-group"><strong>Cor <span>{selectedShade}</span></strong><div className="shop-option-list">{selectedProduct.shades.map(shade => <button key={shade} className={selectedShade === shade ? "selected" : ""} onClick={() => setSelectedShade(shade)}>{shade}</button>)}</div></div>}
        {!!selectedProduct.sizes.length && <div className="shop-option-group"><strong>Tamanho <span>{selectedSize || "Selecione"}</span></strong><div className="shop-option-list">{selectedProduct.sizes.map(size => <button key={size} className={selectedSize === size ? "selected" : ""} onClick={() => setSelectedSize(size)}>{size}</button>)}</div></div>}
        <ul className="shop-spec-list">{selectedProduct.specs.map(spec => <li key={spec}><Check size={15} /> {spec}</li>)}</ul>
        <button className="button primary wide-button" disabled={!!selectedProduct.sizes.length && !selectedSize} onClick={() => addToCart(selectedProduct, selectedShade, selectedSize)}><Plus size={17} /> Adicionar ao carrinho · {money(selectedProduct.price)}</button>
      </div>
    </ShopDialog>}

    {dialog === "cart" && <ShopDialog title="Seu carrinho" onClose={() => setDialog("")}>
      {cart.length ? <><div className="shop-cart-list">{cart.map(line => {
        const product = shopProducts.find(item => item.id === line.id);
        return <article className="shop-cart-item" key={line.key}><img src={product.image} alt={product.imageAlt} loading="lazy" /><div className="shop-cart-item-copy"><strong>{product.name}</strong><small>{[line.shade, line.size].filter(Boolean).join(" · ")}</small><strong>{money(product.price * line.quantity)}</strong><div className="shop-quantity-control"><button aria-label={`Remover uma unidade de ${product.name}`} onClick={() => updateQuantity(line.key, -1)}><Minus size={14} /></button><span>{line.quantity}</span><button aria-label={`Adicionar uma unidade de ${product.name}`} onClick={() => updateQuantity(line.key, 1)}><Plus size={14} /></button></div></div></article>;
      })}</div>
        <form className="shop-coupon-form" onSubmit={applyCoupon}><label htmlFor="shop-coupon">Cupom demonstrativo</label><div><input id="shop-coupon" value={coupon} onChange={event => setCoupon(event.target.value)} placeholder="FORTALFY10" /><button className="button subtle small-button" type="submit">{couponApplied ? "Aplicado" : "Aplicar"}</button></div>{couponApplied && <small>10% de desconto ilustrativo aplicado.</small>}</form>
        <fieldset className="shop-delivery"><legend>Opção a confirmar</legend>{["Entrega a confirmar", "Retirada a confirmar"].map(option => <label key={option}><input type="radio" name="delivery" checked={delivery === option} onChange={() => setDelivery(option)} /><span>{option}</span><small>{option.startsWith("Entrega") ? money(14.9) : "Sem custo ilustrativo"}</small></label>)}</fieldset>
        <div className="shop-totals"><span>Subtotal <strong>{money(subtotal)}</strong></span>{couponApplied && <span>Desconto ilustrativo <strong>−{money(discount)}</strong></span>}<span>Entrega ilustrativa <strong>{money(simulatedDelivery)}</strong></span><span className="shop-total-line">Total de demonstração <strong>{money(total)}</strong></span></div>
        <button className="button primary wide-button" onClick={() => setDialog("checkout")}>Continuar <ArrowRight size={17} /></button>
        <p className="shop-disclaimer">Apenas uma prévia: não informe dados de cartão. O checkout não solicita pagamento nem cria um pedido real.</p>
      </> : <div className="shop-cart-empty"><span><ShoppingBag size={25} /></span><h3>Seu carrinho está esperando.</h3><p>Explore os itens da coleção e adicione os seus favoritos.</p><button className="button primary" onClick={() => setDialog("")}>Voltar à loja <ArrowRight size={16} /></button></div>}
    </ShopDialog>}

    {dialog === "checkout" && <ShopDialog title="Revisar prévia do pedido" onClose={() => setDialog("")}>
      <div className="shop-checkout-note"><ShieldCheck size={20} /><span><strong>Nenhum dado financeiro será pedido.</strong><small>Esta confirmação serve apenas para testar o fluxo de compra. Não há cobrança, estoque ou entrega conectados.</small></span></div>
      <div className="shop-checkout-lines">{cart.map(line => {
        const product = shopProducts.find(item => item.id === line.id);
        return <div key={line.key}><span>{line.quantity} × {product.name}<small>{[line.shade, line.size].filter(Boolean).join(" · ")}</small></span><strong>{money(product.price * line.quantity)}</strong></div>;
      })}</div>
      <div className="shop-totals"><span>Opção de entrega <strong>{delivery}</strong></span><span className="shop-total-line">Total ilustrativo <strong>{money(total)}</strong></span></div>
      <button className="button primary wide-button" onClick={placeOrder}>Confirmar prévia · sem cobrança <Check size={17} /></button>
      <button className="button subtle wide-button shop-return-button" onClick={() => setDialog("cart")}><ArrowLeft size={16} /> Voltar ao carrinho</button>
    </ShopDialog>}

    {dialog === "order-confirmed" && confirmedOrder && <ShopDialog title="Prévia confirmada" onClose={() => setDialog("")}>
      <div className="shop-order-confirmation"><span><Check size={26} /></span><h3>Prévia local registrada</h3><p>Referência local <strong>{confirmedOrder.id}</strong> · {confirmedOrder.createdAt}</p><p>Esta prévia não foi transmitida a uma loja. Nenhum pagamento, envio ou reserva foi realizado.</p><button className="button primary wide-button" onClick={() => setDialog("orders")}>Ver pedidos locais <ArrowRight size={17} /></button></div>
    </ShopDialog>}

    {dialog === "orders" && <ShopDialog title="Meus pedidos" onClose={() => setDialog("")}>
      {orders.length ? <div className="shop-orders-list">{orders.map(order => <article key={order.id}><div><span className="shop-order-badge"><Check size={13} /> PRÉVIA LOCAL</span><strong>{order.id}</strong><small>{order.createdAt} · {order.lines.reduce((count, line) => count + line.quantity, 0)} itens</small></div><strong>{money(order.total)}</strong><p>{order.lines.map(line => `${line.quantity}× ${line.name}`).join(" · ")}</p></article>)}</div> : <div className="shop-cart-empty"><span><ShoppingBag size={25} /></span><h3>Nenhum pedido por aqui.</h3><p>Os pedidos locais aparecerão aqui neste dispositivo.</p><button className="button subtle" onClick={() => setDialog("")}>Entendi</button></div>}
      <p className="shop-disclaimer">Histórico de prévias salvo neste dispositivo. Nenhum pedido real ou pagamento foi realizado.</p>
    </ShopDialog>}
  </div>;
}
