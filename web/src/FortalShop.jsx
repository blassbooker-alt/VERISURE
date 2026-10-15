import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Heart, Minus, Plus, Search, ShieldCheck, ShoppingBag, Sparkles, X } from "lucide-react";
import { Link } from "react-router-dom";
import Brand from "./Brand.jsx";
import BottomNav from "./MobileNavigation.jsx";
import { shopOffers, shopProducts } from "./shopData.js";
import { fortalfyAsset } from "./assetPath.js";

const money = value => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ShopDialog({ title, children, onClose }) {
  return <div className="modal-scrim shop-scrim" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="modal-card shop-dialog" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-header"><div><span className="eyebrow">FORTALFY SHOP</span><h2>{title}</h2></div><button className="icon-button" aria-label="Fechar janela" onClick={onClose}><X size={20} /></button></div>
      {children}
    </section>
  </div>;
}

function CartBadge({ count }) {
  return <span className="shop-cart-count" aria-label={`${count} ${count === 1 ? "item" : "itens"} no carrinho`}>{count}</span>;
}

function productOptions(product) {
  if (product.options?.length) return product.options;
  return [
    ...(product.shades?.length ? [{ label: "Cor", values: product.shades }] : []),
    ...(product.sizes?.length ? [{ label: "Tamanho", values: product.sizes }] : []),
  ];
}

function cartOptionsLabel(line) {
  return [
    ...Object.entries(line.options || {}).map(([label, value]) => `${label}: ${value}`),
    ...(line.shade ? [`Cor: ${line.shade}`] : []),
    ...(line.size ? [`Tamanho: ${line.size}`] : []),
  ].join(" · ");
}

export default function FortalShop({ cart, setCart, notify }) {
  const [category, setCategory] = useState("Tudo");
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [dialog, setDialog] = useState("");
  const [favorites, setFavorites] = useState([]);
  const products = shopProducts;
  const categoryOptions = ["Tudo", ...new Set(products.map(product => product.category.split(" · ")[0]))];
  const visibleProducts = useMemo(() => products.filter(product => {
    const matchesCategory = category === "Tudo" || product.category.startsWith(category);
    const matchesSearch = `${product.name} ${product.category} ${product.description} ${product.sku || ""}`.toLowerCase().includes(search.trim().toLowerCase());
    return matchesCategory && matchesSearch;
  }), [products, category, search]);
  const itemCount = cart.reduce((total, line) => total + line.quantity, 0);
  const subtotal = cart.reduce((total, line) => total + (products.find(product => product.id === line.id)?.price || 0) * line.quantity, 0);

  const addToCart = (product, options = {}) => {
    const selections = Object.fromEntries(productOptions(product).map(option => [
      option.label,
      options[option.label] || option.values[0],
    ]));
    const key = `${product.id}|${JSON.stringify(Object.entries(selections).sort(([left], [right]) => left.localeCompare(right)))}`;
    setCart(current => {
      const existingLine = current.find(line => line.key === key);
      if (product.stock != null && (existingLine?.quantity || 0) >= product.stock) {
        notify("A quantidade informada no catálogo foi atingida. Confirme disponibilidade com a loja.");
        return current;
      }
      return existingLine
        ? current.map(line => line.key === key ? { ...line, quantity: line.quantity + 1 } : line)
        : [...current, { key, id: product.id, options: selections, quantity: 1 }];
    });
    notify(`${product.name} adicionado ao carrinho.`);
    setSelectedProduct(null);
  };
  const updateQuantity = (key, amount) => {
    setCart(current => current
      .map(line => {
        if (line.key !== key) return line;
        const product = products.find(item => item.id === line.id);
        return { ...line, quantity: Math.min(product?.stock ?? Number.MAX_SAFE_INTEGER, line.quantity + amount) };
      })
      .filter(line => line.quantity > 0));
  };
  const openProduct = product => {
    setSelectedProduct(product);
    setSelectedOptions(Object.fromEntries(productOptions(product).map(option => [option.label, option.values[0]])));
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
      <div className="shop-title-row"><div><span className="eyebrow">FORTALFY SHOP</span><h1>Feito para<br />o seu ritmo.</h1></div></div>
      <p className="shop-intro">Explore produtos para acompanhar sua rotina de treino e bem-estar.</p>
      <section className="shop-editorial">
        <img className="shop-editorial-banner" src={fortalfyAsset("publicidade", "banner-app-papagaio-b.jpg")} alt="" aria-hidden="true" />
        <div className="shop-editorial-copy"><span className="shop-editorial-label"><Sparkles size={13} /> CATÁLOGO FORTALSHOP</span><h2>Seu próximo passo começa com você.</h2><p>Encontre itens para treinar, cuidar da recuperação e acompanhar sua evolução.</p><button className="button lime-button small-button" onClick={() => document.getElementById("shop-catalog")?.scrollIntoView({ behavior: "smooth" })}>Explorar produtos <ArrowRight size={15} /></button></div>
      </section>
      <div className="shop-trust-row"><span><ShieldCheck size={15} /> Itens do catálogo enviado</span><span><ShoppingBag size={15} /> Preços conforme catálogo</span><span><ShieldCheck size={15} /> Pagamento ainda indisponível</span></div>
      <div className="shop-catalog-heading"><div><span className="eyebrow">ENCONTRE O QUE PRECISA</span><h2>Explore por categoria</h2></div></div>
      <section className="shop-offers-grid" aria-label="Sugestões Fortalfy">{shopOffers.map(offer => <button className="shop-offer-card" type="button" key={offer.id} onClick={() => { const product = products.find(item => item.id === offer.productId); if (product) openProduct(product); }}><img src={offer.image} alt="" loading="lazy" /><span>{offer.title}</span></button>)}</section>
      <div className="shop-catalog-heading" id="shop-catalog"><div><span className="eyebrow">CATÁLOGO COMPLETO</span><h2>Produtos Fortalshop</h2></div><span className="shop-catalog-count">{products.length} itens</span></div>
      <label className="search-field shop-search"><Search size={19} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar roupas, suplementos, acessórios..." aria-label="Buscar produtos da FortalShop" /><button aria-label="Limpar busca" onClick={() => setSearch("")}>{search && <X size={17} />}</button></label>
      <div className="chip-row shop-categories" aria-label="Filtrar produtos">{categoryOptions.map(item => <button key={item} onClick={() => setCategory(item)} className={`filter-chip ${item === category ? "active" : ""}`}>{item}</button>)}</div>
      <section className="shop-product-grid" aria-label="Produtos">
        {visibleProducts.map(product => <article className="shop-product-card" key={product.id}>
          <button className="shop-product-visual" aria-label={`Ver ${product.name}`} onClick={() => openProduct(product)}>
            <img src={product.image} alt={product.imageAlt} loading="lazy" />
            <span className="shop-product-tag">{product.tag}</span>
          </button>
          <button className={`shop-favorite ${favorites.includes(product.id) ? "is-favorite" : ""}`} aria-label={favorites.includes(product.id) ? "Remover dos favoritos" : "Salvar nos favoritos"} aria-pressed={favorites.includes(product.id)} onClick={() => toggleFavorite(product.id)}><Heart size={17} fill={favorites.includes(product.id) ? "currentColor" : "none"} /></button>
          <div className="shop-product-info"><span className="shop-product-category">{product.category}</span><button className="shop-product-name" onClick={() => openProduct(product)}>{product.name}</button><p>{product.description}</p>{product.sku && <small className="shop-product-stock">SKU {product.sku} · {product.stock} un. informadas</small>}<div className="shop-price-line"><strong>{money(product.price)}</strong>{product.compareAt && <del>{money(product.compareAt)}</del>}</div>
            <button className="button primary shop-add-button" onClick={() => productOptions(product).length ? openProduct(product) : addToCart(product)}>{productOptions(product).length ? "Ver opções" : <><Plus size={16} /> Adicionar</>}</button>
          </div>
        </article>)}
        {!visibleProducts.length && <div className="empty-state shop-empty"><Search size={25} /><h3>Nenhum item encontrado</h3><p>Experimente outro termo ou categoria.</p><button className="button subtle" onClick={() => { setSearch(""); setCategory("Tudo"); }}>Limpar filtros</button></div>}
      </section>
      <section className="shop-studio-cta"><div className="shop-studio-icon"><Sparkles size={20} /></div><div><span className="eyebrow">FORTALFY STUDIO</span><h2>Suas ideias merecem virar arte.</h2><p>Crie imagens originais para sua rotina e compartilhe no Feed.</p></div><Link to="/studio" className="button lime-button">Abrir Studio <ArrowRight size={16} /></Link></section>
    </main>
    <BottomNav />

    {selectedProduct && <ShopDialog title={selectedProduct.name} onClose={() => setSelectedProduct(null)}>
      <div className="shop-product-detail">
        <div className="shop-detail-image-wrap"><img src={selectedProduct.image} alt={selectedProduct.imageAlt} /></div>
        <span className="shop-product-category">{selectedProduct.category}{selectedProduct.sku ? ` · SKU ${selectedProduct.sku}` : ""}</span>
        <p className="modal-description">{selectedProduct.detail}</p>
        <div className="shop-price-line detail-price"><strong>{money(selectedProduct.price)}</strong>{selectedProduct.compareAt && <del>{money(selectedProduct.compareAt)}</del>}</div>
        {productOptions(selectedProduct).map(option => <div className="shop-option-group" key={option.label}><strong>{option.label}<span>{selectedOptions[option.label]}</span></strong>{option.values.length > 1 && <div className="shop-option-list">{option.values.map(value => <button type="button" key={value} className={selectedOptions[option.label] === value ? "selected" : ""} onClick={() => setSelectedOptions(current => ({ ...current, [option.label]: value }))}>{value}</button>)}</div>}</div>)}
        <ul className="shop-spec-list">{selectedProduct.specs.map(spec => <li key={spec}><Check size={15} /> {spec}</li>)}</ul>
        <button className="button primary wide-button" onClick={() => addToCart(selectedProduct, selectedOptions)}><Plus size={17} /> Adicionar ao carrinho · {money(selectedProduct.price)}</button>
      </div>
    </ShopDialog>}

    {dialog === "cart" && <ShopDialog title="Seu carrinho" onClose={() => setDialog("")}>
      {cart.length ? <><div className="shop-cart-list">{cart.map(line => {
        const product = products.find(item => item.id === line.id);
        return product && <article className="shop-cart-item" key={line.key}><img src={product.image} alt={product.imageAlt} loading="lazy" /><div className="shop-cart-item-copy"><strong>{product.name}</strong><small>{cartOptionsLabel(line)}</small><strong>{money(product.price * line.quantity)}</strong><div className="shop-quantity-control"><button aria-label={`Remover uma unidade de ${product.name}`} onClick={() => updateQuantity(line.key, -1)}><Minus size={14} /></button><span>{line.quantity}</span><button aria-label={`Adicionar uma unidade de ${product.name}`} disabled={product.stock != null && line.quantity >= product.stock} onClick={() => updateQuantity(line.key, 1)}><Plus size={14} /></button></div></div></article>;
      })}</div>
        <div className="shop-totals"><span>Subtotal: <strong>{money(subtotal)}</strong></span><span className="shop-total-line">Total: <strong>{money(subtotal)}</strong></span></div>
        <button className="button primary wide-button" onClick={() => setDialog("checkout")}>Continuar <ArrowRight size={17} /></button>
        <p className="shop-disclaimer">O checkout está desativado. Nenhum pagamento será iniciado ou simulado.</p>
      </> : <div className="shop-cart-empty"><span><ShoppingBag size={25} /></span><h3>Seu carrinho está vazio.</h3><p>Explore os itens da coleção e adicione os seus favoritos.</p><button className="button primary" onClick={() => setDialog("")}>Voltar à loja <ArrowRight size={16} /></button></div>}
    </ShopDialog>}

    {dialog === "checkout" && <ShopDialog title="Pagamentos indisponíveis" onClose={() => setDialog("")}>
      <p className="shop-disclaimer" role="status">Pagamentos não estão habilitados neste momento. Nenhuma cobrança, pedido ou transação de teste será criada.</p>
      <button className="button subtle wide-button shop-return-button" onClick={() => setDialog("cart")}><ArrowLeft size={16} /> Voltar ao carrinho</button>
    </ShopDialog>}

  </div>;
}
