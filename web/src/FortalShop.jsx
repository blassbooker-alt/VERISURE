import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, ArrowLeft, ArrowRight, Check, ChevronRight, Minus, Plus, Search, ShoppingBag, Sparkles, Trash2, X, ZoomIn } from "lucide-react";
import { Link } from "react-router-dom";
import Brand from "./Brand.jsx";
import BottomNav, { NavigationDrawer } from "./MobileNavigation.jsx";
import { demoShopProducts, filterShopProducts, getShopDepartment } from "./shopData.js";
import { addShopCartItem, getShopCartLineKey, getShopCartOptionsLabel, getShopCartProduct, getShopCartSummary, removeShopCartItem, updateShopCartQuantity } from "./shopCartService.js";
import { brandCampaignAsset } from "./assetPath.js";
import { loadMarketplaceProducts } from "./partnerStoreService.js";

const formatPrice = value => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
function ShopDialog({ product, onClose, onAddToCart }) {
  const [selectedOption, setSelectedOption] = useState(product?.variation?.values[0] || "");
  const [quantity, setQuantity] = useState(1);
  const [imageZoomOpen, setImageZoomOpen] = useState(false);
  const [activeImage, setActiveImage] = useState(product?.image || "");
  useEffect(() => {
    if (!imageZoomOpen) return undefined;
    const closeOnEscape = event => event.key === "Escape" && setImageZoomOpen(false);
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [imageZoomOpen]);
  if (!product) return null;
  const addToCart = () => onAddToCart(product, product.variation ? { [product.variation.name]: selectedOption } : {}, quantity);

  return <div className="modal-scrim shop-scrim" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="modal-card shop-dialog shop-product-dialog" role="dialog" aria-modal="true" aria-label={`Produto ${product.name}`}>
      <div className="shop-detail-topbar"><span className="eyebrow">{product.isDemo ? "VITRINE DEMONSTRATIVA" : "LOJA PARCEIRA · PRODUTO PUBLICADO"}</span><button className="icon-button" aria-label="Fechar produto" onClick={onClose}><X size={18} /></button></div>
      <div className="shop-product-detail-layout">
        <div className="shop-detail-gallery"><button type="button" className="shop-dialog-image-trigger" onClick={() => setImageZoomOpen(true)} aria-label={`Ampliar imagem de ${product.name}`}><img className="shop-dialog-image" src={activeImage || product.image} alt={product.imageAlt} /><span><ZoomIn size={17} /> Ampliar foto</span></button>{product.gallery?.length > 1 && <div className="shop-gallery-thumbnails" aria-label="Fotos do produto">{product.gallery.map((image, index) => <button type="button" key={image} className={activeImage === image ? "is-active" : ""} aria-label={`Ver foto ${index + 1}`} aria-pressed={activeImage === image} onClick={() => setActiveImage(image)}><img src={image} alt="" /></button>)}</div>}<span className="shop-image-caption">Fotos da coleção demonstrativa FortalShop</span></div>
        <div className="shop-detail-information">
          <span className="shop-detail-category">{getShopDepartment(product)} <span>·</span> {product.isDemo ? "Demonstração" : "Loja parceira"}</span>
          <h2>{product.name}</h2>
          <div className="shop-detail-price-block"><span>{product.isDemo ? "Preço ilustrativo" : "Preço publicado pela loja"}</span><strong>{formatPrice(product.price)}</strong><small>{product.isDemo ? "Valor apenas para demonstração. Não é uma oferta de venda." : "Confirme preço e disponibilidade diretamente com o vendedor."}</small></div>
          {product.variation && <fieldset className="shop-variation-picker"><legend>{product.variation.name}<span>{selectedOption}</span></legend><div>{product.variation.values.map(value => <button type="button" key={value} className={selectedOption === value ? "is-selected" : ""} aria-pressed={selectedOption === value} onClick={() => setSelectedOption(value)}>{value}</button>)}</div></fieldset>}
          <div className="shop-detail-quantity"><strong>Quantidade</strong><div className="shop-quantity-control"><button type="button" onClick={() => setQuantity(current => Math.max(1, current - 1))} disabled={quantity <= 1} aria-label="Diminuir quantidade"><Minus size={15} /></button><span aria-live="polite">{quantity}</span><button type="button" onClick={() => setQuantity(current => current + 1)} aria-label="Aumentar quantidade"><Plus size={15} /></button></div></div>
          <div className="shop-detail-actions"><button className="button primary" onClick={addToCart}><ShoppingBag size={17} /> {product.isDemo ? "Adicionar à sacola de demonstração" : "Adicionar à sacola"}</button><button className="button subtle" onClick={onClose}>Continuar explorando</button></div>
          <div className="shop-detail-notice"><ShoppingBag size={16} /><span><strong>{product.isDemo ? "Produto de demonstração" : "Produto publicado por loja parceira"}</strong><small>{product.isDemo ? "Vitrine, produto e preço são ilustrativos. Nenhum pedido real será feito." : "A sacola é apenas uma lista local. Checkout, pedidos e pagamentos ainda não estão habilitados."}</small></span></div>
          <div className="shop-detail-description"><h3>Sobre este produto</h3><p>{product.detail}</p><ul>{product.specs.map(spec => <li key={spec}>{spec}</li>)}</ul></div>
        </div>
      </div>
      {imageZoomOpen && <div className="shop-image-zoom" role="presentation" onMouseDown={event => event.target === event.currentTarget && setImageZoomOpen(false)}><section role="dialog" aria-modal="true" aria-label={`Imagem ampliada: ${product.name}`}><button type="button" aria-label="Fechar imagem ampliada" onClick={() => setImageZoomOpen(false)}><X size={21} /></button><img src={activeImage || product.image} alt={product.imageAlt} /><p>{product.name} · {getShopDepartment(product)}</p></section></div>}
    </section>
  </div>;
}

function ShopCartDialog({ cart, onClose, onQuantityChange, onRemove, onContinue, onCheckout }) {
  const summary = getShopCartSummary(cart);
  const lines = cart.map(line => ({ line, product: getShopCartProduct(line) }));
  const demoOnlyCart = lines.length > 0 && lines.every(({ product }) => product?.isDemo);

  return <div className="modal-scrim shop-scrim" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="modal-card shop-dialog shop-cart-dialog" role="dialog" aria-modal="true" aria-label="Sacola de compras FortalShop">
      <div className="shop-cart-heading"><div><span className="eyebrow">FORTALFY SHOP</span><h2>Sacola de compras <span>{summary.itemCount}</span></h2></div><button className="icon-button" aria-label="Fechar sacola" onClick={onClose}><X size={18} /></button></div>
      {cart.length === 0 && <div className="shop-cart-empty"><span><ShoppingBag size={25} /></span><h3>Sua sacola está vazia</h3><p>Encontre produtos para acompanhar sua rotina de treino.</p><button className="button primary" onClick={onContinue}>Explorar produtos <ArrowRight size={16} /></button></div>}
      {cart.length > 0 && <>
        <div className="shop-cart-items">{lines.map(({ line, product }) => {
          const lineKey = getShopCartLineKey(line);
          if (!product) {
            return <article className="shop-cart-item shop-cart-unavailable" key={lineKey}><div><strong>Item indisponível</strong><small>Este produto não está mais publicado por uma loja parceira.</small></div><button type="button" className="shop-remove-item" onClick={() => onRemove(lineKey)}><Trash2 size={15} /> Remover</button></article>;
          }
          const optionsLabel = getShopCartOptionsLabel(line);
          return <article className="shop-cart-item" key={lineKey}>
            <img src={product.image} alt={product.imageAlt} />
            <div className="shop-cart-item-copy"><span>{product.isDemo ? "DEMONSTRAÇÃO · PREÇO ILUSTRATIVO" : getShopDepartment(product)}</span><strong>{product.name}</strong>{optionsLabel && <small>{product.variation?.name}: {optionsLabel}</small>}<b>{formatPrice(product.price)}</b><div className="shop-quantity-control"><button type="button" disabled={line.quantity <= 1} onClick={() => onQuantityChange(lineKey, line.quantity - 1)} aria-label={`Diminuir quantidade de ${product.name}`}><Minus size={14} /></button><span aria-live="polite">{line.quantity}</span><button type="button" onClick={() => onQuantityChange(lineKey, line.quantity + 1)} aria-label={`Aumentar quantidade de ${product.name}`}><Plus size={14} /></button></div><button type="button" className="shop-remove-item" onClick={() => onRemove(lineKey)}><Trash2 size={14} /> Remover</button></div>
          </article>;
        })}</div>
        {summary.itemCount > 0
          ? <aside className="shop-cart-summary"><div><span>{demoOnlyCart ? "Total ilustrativo" : "Subtotal de referência"}</span><strong>{formatPrice(summary.subtotal)}</strong></div><p>{demoOnlyCart ? "Checkout de teste: nenhum pagamento ou pedido real será criado." : "Checkout real indisponível. Produtos reais não podem ser misturados com itens demonstrativos."}</p>{demoOnlyCart ? <button type="button" className="button primary wide-button shop-demo-checkout-button" onClick={onCheckout}><Check size={16} /> Ir para checkout de teste</button> : <button type="button" className="button subtle wide-button shop-checkout-disabled" disabled title="Checkout real indisponível"><Check size={16} /> Checkout real indisponível</button>}<button type="button" className="shop-continue-link" onClick={onContinue}><ArrowLeft size={15} /> Continuar comprando</button></aside>
          : <p className="shop-cart-legacy-notice">Remova os itens antigos para continuar usando a sacola.</p>}
      </>}
    </section>
  </div>;
}

function ShopDemoCheckout({ cart, onClose, onComplete }) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [method, setMethod] = useState("Pix demonstrativo");
  const summary = getShopCartSummary(cart);
  const submit = event => {
    event.preventDefault();
    onComplete({ code: `DEMO-${Date.now().toString().slice(-8)}`, name: name.trim(), city: city.trim(), method, itemCount: summary.itemCount, total: summary.subtotal, items: cart.map(line => getShopCartProduct(line)?.name).filter(Boolean) });
  };
  return <div className="modal-scrim shop-scrim" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="modal-card shop-dialog shop-demo-checkout" role="dialog" aria-modal="true" aria-labelledby="shop-demo-checkout-title">
      <div className="shop-cart-heading"><div><span className="eyebrow">AMBIENTE DE TESTE · SEM COBRANÇA</span><h2 id="shop-demo-checkout-title">Finalizar demonstração</h2></div><button className="icon-button" aria-label="Fechar checkout demonstrativo" onClick={onClose}><X size={18} /></button></div>
      <form onSubmit={submit}>
        <label>Nome para o pedido de teste<input required maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: Alex Silva" autoComplete="name" /></label>
        <label>Cidade para simular a entrega<input required maxLength={80} value={city} onChange={event => setCity(event.target.value)} placeholder="Ex.: Fortaleza" autoComplete="address-level2" /></label>
        <label>Forma de pagamento demonstrativa<select value={method} onChange={event => setMethod(event.target.value)}><option>Pix demonstrativo</option><option>Cartão demonstrativo</option><option>Retirada demonstrativa</option></select></label>
        <div className="shop-demo-checkout-total"><span>{summary.itemCount} {summary.itemCount === 1 ? "item" : "itens"} · total ilustrativo</span><strong>{formatPrice(summary.subtotal)}</strong></div>
        <p>Este fluxo serve para apresentação. Os dados ficam apenas nesta sessão: não são enviados, salvos como pedido nem usados para cobrar.</p>
        <button className="button primary wide-button" type="submit"><Check size={16} /> Confirmar pedido de teste</button>
      </form>
    </section>
  </div>;
}

function ShopDemoOrderConfirmation({ order, onClose }) {
  if (!order) return null;
  return <div className="modal-scrim shop-scrim" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="modal-card shop-dialog shop-order-confirmation" role="dialog" aria-modal="true" aria-labelledby="shop-demo-order-title">
      <span><Check size={26} /></span><span className="eyebrow">SIMULAÇÃO CONCLUÍDA</span><h3 id="shop-demo-order-title">Pedido de teste confirmado</h3>
      <p>O fluxo de compra funcionou. Nenhum pagamento foi processado e nenhum pedido real foi enviado à loja.</p>
      <div className="shop-demo-receipt"><div><span>Referência</span><strong>{order.code}</strong></div><div><span>Cliente de demonstração</span><strong>{order.name}</strong></div><div><span>Entrega simulada</span><strong>{order.city}</strong></div><div><span>Pagamento</span><strong>{order.method}</strong></div><div><span>Itens</span><strong>{order.items.join(", ")}</strong></div><div><span>Total ilustrativo</span><strong>{formatPrice(order.total)}</strong></div></div>
      <button className="button primary wide-button" onClick={onClose}>Voltar à FortalShop</button>
    </section>
  </div>;
}

export default function FortalShop({ client, cart, setCart, initialDialog = "", notify }) {
  const [dialog, setDialog] = useState(initialDialog);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todas");
  const [sort, setSort] = useState("recommended");
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [marketplaceProducts, setMarketplaceProducts] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [demoCheckoutOpen, setDemoCheckoutOpen] = useState(false);
  const [demoOrder, setDemoOrder] = useState(null);
  useEffect(() => setDialog(initialDialog), [initialDialog]);
  useEffect(() => {
    let active = true;
    setCatalogLoading(true);
    loadMarketplaceProducts(client).then(products => {
      if (active) { setMarketplaceProducts(products); setCatalogError(""); }
    }).catch(error => {
      console.error("Não foi possível carregar os produtos publicados por parceiros.", error);
      if (active) { setMarketplaceProducts([]); setCatalogError("Não foi possível carregar as lojas parceiras agora. Tente novamente em instantes."); }
    }).finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, [client, catalogRevision]);
  const categories = useMemo(() => ["Todas", ...new Set(demoShopProducts.map(getShopDepartment))], []);
  const visibleProducts = useMemo(() => filterShopProducts(demoShopProducts, { search, category, sort }), [category, search, sort]);
  const searchSuggestions = useMemo(() => search.trim()
    ? filterShopProducts(demoShopProducts, { search }).slice(0, 5)
    : [], [search]);
  const { itemCount, subtotal } = getShopCartSummary(cart);
  const selectCategory = nextCategory => {
    setCategory(nextCategory);
    document.getElementById("shop-products")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const selectSearchSuggestion = product => {
    setSearch(product.name);
    setSearchFocused(false);
    setSelectedProduct(product);
  };
  const handleSearchKeyDown = event => {
    if (event.key === "Escape") {
      setSearchFocused(false);
      return;
    }
    if (!searchSuggestions.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestion(index => Math.min(index + 1, searchSuggestions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestion(index => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && searchFocused) {
      event.preventDefault();
      selectSearchSuggestion(searchSuggestions[activeSuggestion]);
    }
  };
  const addToCart = (product, options, quantity) => {
    setCart(current => addShopCartItem(current, product, options, quantity));
    setSelectedProduct(null);
    setDialog("cart");
    notify(`${quantity} ${quantity === 1 ? "unidade adicionada" : "unidades adicionadas"} à sacola.`);
  };
  const updateCartQuantity = (lineKey, quantity) => {
    setCart(current => updateShopCartQuantity(current, lineKey, quantity));
  };
  const removeCartItem = lineKey => {
    setCart(current => removeShopCartItem(current, lineKey));
    notify("Produto removido da sacola.");
  };
  const completeDemoOrder = order => {
    setDemoOrder(order);
    setDemoCheckoutOpen(false);
    setDialog("");
    setCart([]);
  };

  return <div className="app-screen shop-screen">
    <header className="mobile-header shop-header">
      <NavigationDrawer />
      <Link to="/home" aria-label="Fortalfy, página inicial"><Brand /></Link>
      <div className="shop-header-actions"><Link className="button subtle small-button shop-history-button" to="/studio">Studio</Link><button className="shop-bag-button" aria-label="Abrir sacola de compras" onClick={() => setDialog("cart")}><ShoppingBag size={20} />{itemCount > 0 && <span className="shop-cart-count" aria-label={`${itemCount} itens na sacola`}>{itemCount}</span>}</button></div>
    </header>
    <main className="screen-content shop-content">
      <section className="shop-search-panel" aria-label="Buscar produtos">
        <label className="shop-search-label" htmlFor="shop-search-input">O que você procura?</label>
        <div className="shop-search-area" onBlur={event => {
          if (!event.currentTarget.contains(event.relatedTarget)) setSearchFocused(false);
        }}>
          <label className="shop-search" htmlFor="shop-search-input"><Search size={19} aria-hidden="true" /><input id="shop-search-input" type="search" value={search} onFocus={() => setSearchFocused(true)} onChange={event => { setSearch(event.target.value); setActiveSuggestion(0); }} onKeyDown={handleSearchKeyDown} placeholder="Busque por produto, categoria ou código" autoComplete="off" aria-label="Buscar produtos por nome, categoria ou código" aria-controls={searchSuggestions.length ? "shop-search-suggestions" : undefined} aria-activedescendant={searchFocused && searchSuggestions.length ? `shop-suggestion-${searchSuggestions[activeSuggestion]?.id}` : undefined} aria-expanded={searchFocused && searchSuggestions.length > 0} role="combobox" aria-autocomplete="list" />{search && <button className="shop-search-clear" type="button" onClick={() => { setSearch(""); setActiveSuggestion(0); }} aria-label="Limpar busca"><X size={17} /></button>}</label>
          {searchFocused && searchSuggestions.length > 0 && <div className="shop-search-suggestions" id="shop-search-suggestions" role="listbox" aria-label="Sugestões de produtos">{searchSuggestions.map((product, index) => <button key={product.id} id={`shop-suggestion-${product.id}`} type="button" role="option" aria-selected={activeSuggestion === index} onMouseDown={event => event.preventDefault()} onClick={() => selectSearchSuggestion(product)}><img src={product.image} alt="" /><span><strong>{product.name}</strong><small>FortalShop · {getShopDepartment(product)}</small></span><ChevronRight size={16} /></button>)}</div>}
        </div>
      </section>
      <div className="shop-demo-banner"><span><Check size={15} /></span><p><strong>Vitrine de apresentação</strong> · produtos, preços e disponibilidade são demonstrativos. A sacola conclui apenas uma compra simulada.</p><span className="shop-demo-banner-count">30 itens</span></div>
      <section className="shop-editorial" aria-label="Destaque FortalShop">
        <img className="shop-editorial-banner" src={brandCampaignAsset("fortalfy_gym_15_whey_bancada.jpg")} alt="" />
        <div className="shop-editorial-copy"><span className="shop-editorial-label"><Sparkles size={13} /> FORTALFY SHOP</span><h1>Seu próximo treino começa aqui.</h1><p>Vestuário, acessórios e nutrição para acompanhar seu ritmo.</p><button className="button lime-button" onClick={() => selectCategory("Todas")}>Explorar produtos <ArrowRight size={15} /></button></div>
      </section>
      <section className="shop-departments" aria-label="Explore por departamento">
        <div className="shop-section-heading"><div><span className="eyebrow">ENCONTRE SEU RITMO</span><h2>Explore por categoria</h2></div><span>{categories.length - 1} departamentos</span></div>
        <div className="shop-department-grid">{categories.slice(1).map(department => {
          const product = demoShopProducts.find(item => getShopDepartment(item) === department);
          const count = demoShopProducts.filter(item => getShopDepartment(item) === department).length;
          return <button key={department} type="button" className={`shop-department-card${category === department ? " is-active" : ""}`} onClick={() => selectCategory(department)} aria-pressed={category === department}><img src={product.image} alt="" /><span><strong>{department}</strong><small>{count} produtos</small></span><ChevronRight size={17} /></button>;
        })}</div>
      </section>
      <section className="shop-catalog" id="shop-products" aria-label="Catálogo FortalShop">
        <div className="shop-catalog-heading"><div><span className="eyebrow">CATÁLOGO DE DEMONSTRAÇÃO</span><h2>Produtos para sua rotina</h2><p>Explore a coleção de acessórios, nutrição e vestuário FortalShop.</p></div><span className="shop-catalog-count">{visibleProducts.length} {visibleProducts.length === 1 ? "produto" : "produtos"}</span></div>
        <div className="shop-catalog-toolbar">
          <div className="shop-categories" role="group" aria-label="Filtrar produtos por categoria">{categories.map(item => <button type="button" key={item} className={`shop-category-chip${category === item ? " is-active" : ""}`} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div>
          <label className="shop-sort"><ArrowDownUp size={16} aria-hidden="true" /><span>Ordenar:</span><select aria-label="Ordenar produtos" value={sort} onChange={event => setSort(event.target.value)}><option value="recommended">Recomendados</option><option value="price-asc">Menor preço</option><option value="price-desc">Maior preço</option><option value="name">Nome (A–Z)</option></select></label>
        </div>
        <p className="shop-catalog-disclaimer"><ShoppingBag size={16} aria-hidden="true" /><span>Catálogo demonstrativo: nomes, valores e disponibilidade são ilustrativos. Use a sacola para experimentar o fluxo de compra de teste; nenhum pedido ou pagamento real será realizado.</span></p>
        <div className="shop-product-grid">
          {visibleProducts.map(product => <article className="shop-product-card" key={product.id}>
            <button className="shop-product-visual" onClick={() => setSelectedProduct(product)} aria-label={`Ver detalhes de ${product.name}`}><img src={product.image} alt={product.imageAlt} loading="lazy" /><span className="shop-product-tag">{getShopDepartment(product)}</span></button>
            <div className="shop-product-info"><span className="shop-product-category">Coleção FortalShop · {getShopDepartment(product)}</span><button className="shop-product-name" onClick={() => setSelectedProduct(product)}>{product.name}</button><span className="shop-demo-price">Preço ilustrativo</span><div className="shop-price-line"><strong>{formatPrice(product.price)}</strong></div><button className="button subtle shop-add-button" onClick={() => setSelectedProduct(product)}>Ver produto <ChevronRight size={15} /></button></div>
          </article>)}
          {!visibleProducts.length && <div className="empty-state shop-empty"><Search size={24} /><h2>Nenhum produto encontrado</h2><p>Tente buscar outro nome ou selecione outra categoria.</p><button className="button subtle" onClick={() => { setSearch(""); setCategory("Todas"); }}>Limpar filtros</button></div>}
        </div>
      </section>
      {marketplaceProducts.length > 0 && <section className="shop-live-marketplace" aria-label="Produtos publicados por lojas parceiras"><div className="shop-catalog-heading"><div><span className="eyebrow">MARKETPLACE</span><h2>Lojas parceiras</h2><p>Produtos reais publicados por vendedores na plataforma.</p></div><span className="shop-catalog-count">{marketplaceProducts.length} publicados</span></div><div className="shop-product-grid">{marketplaceProducts.map(product => <article className="shop-product-card" key={`partner-${product.id}`}><button className="shop-product-visual" onClick={() => setSelectedProduct(product)} aria-label={`Ver detalhes de ${product.name}`}><img src={product.image} alt={product.imageAlt} loading="lazy" /><span className="shop-product-tag">{getShopDepartment(product)}</span></button><div className="shop-product-info"><span className="shop-product-category">Loja parceira · {getShopDepartment(product)}</span><button className="shop-product-name" onClick={() => setSelectedProduct(product)}>{product.name}</button><span className="shop-demo-price">Preço publicado pela loja</span><div className="shop-price-line"><strong>{formatPrice(product.price)}</strong></div><button className="button subtle shop-add-button" onClick={() => setSelectedProduct(product)}>Ver produto <ChevronRight size={15} /></button></div></article>)}</div></section>}
      <section className="shop-studio-cta"><div className="shop-studio-icon"><Sparkles size={20} /></div><div><span className="eyebrow">FORTALFY STUDIO</span><h2>Suas ideias merecem virar arte.</h2><p>Crie imagens originais para sua rotina e compartilhe no Feed.</p></div><Link to="/studio" className="button lime-button">Abrir Studio <ArrowRight size={16} /></Link></section>
    </main>
    <BottomNav />
    {selectedProduct && <ShopDialog key={selectedProduct.id} product={selectedProduct} onClose={() => setSelectedProduct(null)} onAddToCart={addToCart} />}
    {dialog === "cart" && <ShopCartDialog cart={cart} onClose={() => setDialog("")} onQuantityChange={updateCartQuantity} onRemove={removeCartItem} onContinue={() => setDialog("")} onCheckout={() => { setDialog(""); setDemoCheckoutOpen(true); }} />}
    {demoCheckoutOpen && <ShopDemoCheckout cart={cart} onClose={() => setDemoCheckoutOpen(false)} onComplete={completeDemoOrder} />}
    {demoOrder && <ShopDemoOrderConfirmation order={demoOrder} onClose={() => setDemoOrder(null)} />}
  </div>;
}
