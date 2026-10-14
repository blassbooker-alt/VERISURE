import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Heart, LoaderCircle, Minus, Plus, Search, ShieldCheck, ShoppingBag, Sparkles, X } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import Brand from "./Brand.jsx";
import BottomNav from "./MobileNavigation.jsx";
import { shopOffers, shopProducts } from "./shopData.js";
import { fortalfyAsset } from "./assetPath.js";
import { buildSandboxCartItems } from "./shopCheckout.js";

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

const orderStatusLabels = {
  awaiting_payment: "Aguardando confirmação do Mercado Pago",
  approved: "Pagamento de teste aprovado",
  cancelled: "Pedido de teste cancelado",
  refunded: "Pagamento de teste reembolsado",
};

export default function FortalShop({ cart, setCart, orders, notify, client, session }) {
  const [category, setCategory] = useState("Tudo");
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedShade, setSelectedShade] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [dialog, setDialog] = useState("");
  const [favorites, setFavorites] = useState([]);
  const [products, setProducts] = useState(shopProducts);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutIdempotencyKey, setCheckoutIdempotencyKey] = useState("");
  const [serverOrders, setServerOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [searchParams] = useSearchParams();
  const orderIdFromUrl = searchParams.get("order");
  const categoryOptions = ["Tudo", ...new Set(products.map(product => product.category))];
  const visibleProducts = useMemo(() => products.filter(product => {
    const matchesCategory = category === "Tudo" || product.category === category;
    const matchesSearch = `${product.name} ${product.category} ${product.description}`.toLowerCase().includes(search.trim().toLowerCase());
    return matchesCategory && matchesSearch;
  }), [products, category, search]);
  const itemCount = cart.reduce((total, line) => total + line.quantity, 0);
  const subtotal = cart.reduce((total, line) => total + (products.find(product => product.id === line.id)?.price || 0) * line.quantity, 0);

  useEffect(() => {
    if (!client) return undefined;
    let active = true;
    client.from("shop_products")
      .select("id,name,category,price,asset_category,asset_filename")
      .eq("active", true)
      .eq("is_demo", true)
      .order("name")
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error("Não foi possível carregar o catálogo de demonstração do FortalShop.", error);
          setCatalogError("Não foi possível carregar os preços de demonstração do servidor. O checkout fica bloqueado até o catálogo estar disponível.");
          return;
        }
        const merged = (data || []).map(row => {
          const fallback = shopProducts.find(product => product.id === row.id);
          if (!fallback) return null;
          return {
            ...fallback,
            name: row.name,
            category: row.category,
            price: Number(row.price),
            image: fortalfyAsset(row.asset_category, row.asset_filename),
          };
        }).filter(Boolean);
        if (!merged.length) {
          setCatalogError("O catálogo sandbox está vazio. Aplique a migração FortalShop antes de continuar.");
          return;
        }
        setProducts(merged);
        setCatalogLoaded(true);
        setCatalogError("");
      });
    return () => { active = false; };
  }, [client]);

  const loadServerOrders = async () => {
    if (!client || !session?.user?.id) return;
    setOrdersLoading(true);
    const { data, error } = await client.from("shop_orders")
      .select("id,status,payment_status,total,currency,created_at,shop_order_items(product_name_snapshot,quantity)")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) {
      console.error("Não foi possível carregar os pedidos de demonstração.", error);
      setOrdersError("Não foi possível carregar seus pedidos sandbox. Tente atualizar.");
      setOrdersLoading(false);
      return;
    }
    setServerOrders(data || []);
    setOrdersError("");
    setOrdersLoading(false);
  };

  useEffect(() => {
    if (!client || !session?.user?.id) {
      setServerOrders([]);
      return;
    }
    loadServerOrders();
  }, [client, session?.user?.id]);

  useEffect(() => {
    if (!orderIdFromUrl || !session?.user?.id) return;
    setDialog("orders");
    loadServerOrders();
  }, [orderIdFromUrl, session?.user?.id]);

  const startSandboxCheckout = async () => {
    setCheckoutError("");
    if (!session?.access_token) {
      setCheckoutError("Entre na sua conta Fortalfy para iniciar o checkout de teste.");
      return;
    }
    if (!client || !catalogLoaded || !cart.length) {
      setCheckoutError("O checkout só fica disponível com catálogo carregado e itens no carrinho.");
      return;
    }
    let items;
    try {
      items = buildSandboxCartItems(cart, products);
    } catch (error) {
      setCheckoutError(error.message);
      return;
    }
    setCheckoutLoading(true);
    try {
      const idempotencyKey = checkoutIdempotencyKey || crypto.randomUUID();
      setCheckoutIdempotencyKey(idempotencyKey);
      const { data, error } = await client.functions.invoke("create-shop-sandbox-checkout", {
        body: { idempotencyKey, items },
      });
      if (error) throw error;
      const checkoutUrl = new URL(data?.checkoutUrl || "");
      if (!data?.sandbox || !/^https:$/.test(checkoutUrl.protocol)
          || !/(^|\.)mercadopago\.com(\.br)?$/i.test(checkoutUrl.hostname)) {
        throw new Error("O servidor não retornou um link de checkout sandbox válido.");
      }
      setCheckoutIdempotencyKey("");
      window.location.assign(checkoutUrl.toString());
    } catch (error) {
      console.error("Não foi possível iniciar o checkout Mercado Pago sandbox.", error);
      setCheckoutError(error?.message || "Falha ao iniciar o checkout de teste. Tente novamente.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const addToCart = (product, shade = product.shades[0], size = product.sizes[0] || "") => {
    const selectedShade = shade || "";
    const key = `${product.id}|${selectedShade}|${size}`;
    setCheckoutIdempotencyKey("");
    setCart(current => {
      const existingLine = current.find(line => line.key === key);
      if (existingLine?.quantity >= 20) {
        notify("O limite de teste é 20 unidades por produto.");
        return current;
      }
      return existingLine
        ? current.map(line => line.key === key ? { ...line, quantity: line.quantity + 1 } : line)
        : [...current, { key, id: product.id, shade: selectedShade, size, quantity: 1 }];
    });
    notify(`${product.name} adicionado ao carrinho.`);
    setSelectedProduct(null);
  };
  const updateQuantity = (key, amount) => {
    setCheckoutIdempotencyKey("");
    setCart(current => current
      .map(line => line.key === key ? { ...line, quantity: Math.min(20, line.quantity + amount) } : line)
      .filter(line => line.quantity > 0));
  };
  const openProduct = product => {
    setSelectedProduct(product);
    setSelectedShade(product.shades[0] || "");
    setSelectedSize(product.sizes[0] || "");
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
      <div className="shop-title-row"><div><span className="eyebrow">FORTALFY SHOP · CATÁLOGO DE DEMONSTRAÇÃO</span><h1>Feito para<br />o seu ritmo.</h1></div><button className="shop-orders-link" onClick={() => setDialog("orders")}><span><ShoppingBag size={17} /></span>Prévias locais</button></div>
      <p className="shop-intro">Uma seleção de ideias para acompanhar a sua rotina.</p>
      <section className="shop-editorial">
        <img className="shop-editorial-banner" src={fortalfyAsset("publicidade", "01-fortalshop-oferta-relampago.jpg")} alt="" aria-hidden="true" />
        <div className="shop-editorial-copy"><span className="shop-editorial-label"><Sparkles size={13} /> CURADORIA FORTALFY</span><h2>O próximo passo<br />começa com você.</h2><p>Itens pensados para deixar sua rotina mais leve.</p><button className="button lime-button small-button" onClick={() => document.getElementById("shop-catalog")?.scrollIntoView({ behavior: "smooth" })}>Explorar coleção <ArrowRight size={15} /></button></div>
        <div className="shop-editorial-art" aria-hidden="true"><img src={products[1]?.image} className="editorial-bottle" alt="" /><img src={products[0]?.image} className="editorial-shirt" alt="" /></div>
        <span className="shop-editorial-glow" aria-hidden="true" />
      </section>
      <div className="shop-trust-row"><span><ShieldCheck size={15} /> Fotos de referência</span><span><ShoppingBag size={15} /> Catálogo sandbox</span><span><ShieldCheck size={15} /> Mercado Pago de teste</span></div>
      <div className="shop-campaign-grid" aria-label="Campanhas demonstrativas"><img src={fortalfyAsset("publicidade", "banner-nova-colecao.jpg")} alt="Campanha demonstrativa da nova coleção" loading="lazy" /><img src={fortalfyAsset("publicidade", "banner-kit-treino.jpg")} alt="Campanha demonstrativa de kit de treino" loading="lazy" /></div>
      <section className="shop-offers-grid" aria-label="Sugestões demonstrativas">{shopOffers.map(offer => <button className="shop-offer-card" type="button" key={offer.id} onClick={() => { const product = products.find(item => item.id === offer.productId); if (product) openProduct(product); }}><img src={offer.image} alt="" loading="lazy" /><span>{offer.title} · demonstração</span></button>)}</section>
      <img className="shop-recovery-campaign" src={fortalfyAsset("publicidade", "banner-recovery.jpg")} alt="Campanha demonstrativa da linha de recovery" loading="lazy" />
      <div className="shop-catalog-heading" id="shop-catalog"><div><span className="eyebrow">ESCOLHA COM CALMA</span><h2>Para sua jornada</h2></div><button className="shop-orders-link" onClick={() => setDialog("orders")}>Pedidos <ArrowRight size={14} /></button></div>
      <label className="search-field shop-search"><Search size={19} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar roupas, acessórios e kits" aria-label="Buscar produtos da FortalShop" /><button aria-label="Limpar busca" onClick={() => setSearch("")}>{search && <X size={17} />}</button></label>
      {catalogError && <p className="shop-disclaimer" role="alert">{catalogError}</p>}
      <div className="chip-row shop-categories" aria-label="Filtrar produtos">{categoryOptions.map(item => <button key={item} onClick={() => setCategory(item)} className={`filter-chip ${item === category ? "active" : ""}`}>{item}</button>)}</div>
      <section className="shop-product-grid" aria-label="Produtos">
        {visibleProducts.map(product => <article className="shop-product-card" key={product.id}>
          <button className="shop-product-visual" aria-label={`Ver ${product.name}`} onClick={() => openProduct(product)}>
            <img src={product.image} alt={product.imageAlt} loading="lazy" />
            <span className="shop-product-tag">{product.tag}</span>
            <span className="shop-photo-label">FOTO ILUSTRATIVA</span>
          </button>
          <button className={`shop-favorite ${favorites.includes(product.id) ? "is-favorite" : ""}`} aria-label={favorites.includes(product.id) ? "Remover dos favoritos" : "Salvar nos favoritos"} aria-pressed={favorites.includes(product.id)} onClick={() => toggleFavorite(product.id)}><Heart size={17} fill={favorites.includes(product.id) ? "currentColor" : "none"} /></button>
          <div className="shop-product-info"><span className="shop-product-category">{product.category}</span><button className="shop-product-name" onClick={() => openProduct(product)}>{product.name}</button><p>{product.description}</p><small className="shop-demo-price">Preço sugerido pelo proprietário · sandbox</small><div className="shop-price-line"><strong>{money(product.price)}</strong>{product.compareAt && <del>{money(product.compareAt)}</del>}</div>
            <button className="button primary shop-add-button" onClick={() => product.sizes.length ? openProduct(product) : addToCart(product)}>{product.sizes.length ? "Escolher opções" : <><Plus size={16} /> Adicionar</>}</button>
          </div>
        </article>)}
        {!visibleProducts.length && <div className="empty-state shop-empty"><Search size={25} /><h3>Nenhum item encontrado</h3><p>Experimente outro termo ou categoria.</p><button className="button subtle" onClick={() => { setSearch(""); setCategory("Tudo"); }}>Limpar filtros</button></div>}
      </section>
      <section className="shop-studio-cta"><div className="shop-studio-icon"><Sparkles size={20} /></div><div><span className="eyebrow">FORTALFY STUDIO</span><h2>Suas ideias merecem virar arte.</h2><p>Crie imagens originais para sua rotina e compartilhe no Feed.</p></div><Link to="/studio" className="button lime-button">Abrir Studio <ArrowRight size={16} /></Link></section>
      <p className="shop-disclaimer">Catálogo e preços sugeridos fornecidos pelo proprietário, importados apenas para testes. Não representam estoque, disponibilidade, envio ou oferta comercial. O checkout só aceita credenciais TEST do Mercado Pago; nenhuma compra real será processada.</p>
    </main>
    <BottomNav />

    {selectedProduct && <ShopDialog title={selectedProduct.name} onClose={() => setSelectedProduct(null)}>
      <div className="shop-product-detail">
        <div className="shop-detail-image-wrap"><img src={selectedProduct.image} alt={selectedProduct.imageAlt} /><span>FOTO DE REFERÊNCIA · ITEM NÃO CONFIRMADO</span></div>
        <span className="shop-product-category">{selectedProduct.category} · {selectedProduct.official ? "Conceito Fortalfy" : "Seleção de bem-estar"}</span>
        <p className="modal-description">{selectedProduct.detail}</p>
        <small className="shop-demo-price">Preço sugerido · demonstração sandbox, não é oferta de venda</small>
        <div className="shop-price-line detail-price"><strong>{money(selectedProduct.price)}</strong>{selectedProduct.compareAt && <del>{money(selectedProduct.compareAt)}</del>}</div>
        {selectedProduct.shades.length > 1 && <div className="shop-option-group"><strong>Cor <span>{selectedShade}</span></strong><div className="shop-option-list">{selectedProduct.shades.map(shade => <button key={shade} className={selectedShade === shade ? "selected" : ""} onClick={() => setSelectedShade(shade)}>{shade}</button>)}</div></div>}
        {!!selectedProduct.sizes.length && <div className="shop-option-group"><strong>Tamanho <span>{selectedSize || "Selecione"}</span></strong><div className="shop-option-list">{selectedProduct.sizes.map(size => <button key={size} className={selectedSize === size ? "selected" : ""} onClick={() => setSelectedSize(size)}>{size}</button>)}</div></div>}
        <ul className="shop-spec-list">{selectedProduct.specs.map(spec => <li key={spec}><Check size={15} /> {spec}</li>)}</ul>
        <button className="button primary wide-button" disabled={!!selectedProduct.sizes.length && !selectedSize} onClick={() => addToCart(selectedProduct, selectedShade, selectedSize)}><Plus size={17} /> Adicionar ao carrinho · {money(selectedProduct.price)}</button>
      </div>
    </ShopDialog>}

    {dialog === "cart" && <ShopDialog title="Seu carrinho" onClose={() => setDialog("")}>
      {cart.length ? <><div className="shop-cart-list">{cart.map(line => {
        const product = products.find(item => item.id === line.id);
        return product && <article className="shop-cart-item" key={line.key}><img src={product.image} alt={product.imageAlt} loading="lazy" /><div className="shop-cart-item-copy"><strong>{product.name}</strong><small>{[line.shade, line.size].filter(Boolean).join(" · ")}</small><strong>{money(product.price * line.quantity)}</strong><div className="shop-quantity-control"><button aria-label={`Remover uma unidade de ${product.name}`} onClick={() => updateQuantity(line.key, -1)}><Minus size={14} /></button><span>{line.quantity}</span><button aria-label={`Adicionar uma unidade de ${product.name}`} disabled={line.quantity >= 20} onClick={() => updateQuantity(line.key, 1)}><Plus size={14} /></button></div></div></article>;
      })}</div>
        <div className="shop-totals"><span>Total baseado no catálogo de teste <strong>{money(subtotal)}</strong></span><span className="shop-total-line">Total sandbox <strong>{money(subtotal)}</strong></span></div>
        <button className="button primary wide-button" onClick={() => { setCheckoutError(""); setDialog("checkout"); }}>Continuar para teste <ArrowRight size={17} /></button>
        <p className="shop-disclaimer">O Mercado Pago abre ambiente de teste. Use somente comprador e cartão de teste emitidos pelo Mercado Pago; não informe dados reais.</p>
      </> : <div className="shop-cart-empty"><span><ShoppingBag size={25} /></span><h3>Seu carrinho está esperando.</h3><p>Explore os itens da coleção e adicione os seus favoritos.</p><button className="button primary" onClick={() => setDialog("")}>Voltar à loja <ArrowRight size={16} /></button></div>}
    </ShopDialog>}

    {dialog === "checkout" && <ShopDialog title="Checkout Mercado Pago · sandbox" onClose={() => setDialog("")}>
      <div className="shop-checkout-note"><ShieldCheck size={20} /><span><strong>Somente transação de teste.</strong><small>Valores sugeridos do catálogo demonstrativo. Não há estoque ou envio confirmado e nenhuma cobrança real será processada.</small></span></div>
      <div className="shop-checkout-lines">{cart.map(line => {
        const product = products.find(item => item.id === line.id);
        return product && <div key={line.key}><span>{line.quantity} × {product.name}<small>{[line.shade, line.size].filter(Boolean).join(" · ")}</small></span><strong>{money(product.price * line.quantity)}</strong></div>;
      })}</div>
      <div className="shop-totals"><span>Frete <strong>Não configurado · não incluído</strong></span><span className="shop-total-line">Total sandbox <strong>{money(subtotal)}</strong></span></div>
      {checkoutError && <p className="shop-disclaimer" role="alert">{checkoutError}</p>}
      {!session?.user && <Link className="button primary wide-button" to="/profile">Entrar para iniciar o teste</Link>}
      <button className="button primary wide-button" disabled={checkoutLoading || !session?.user || !catalogLoaded || !!catalogError} onClick={startSandboxCheckout}>
        {checkoutLoading ? <><LoaderCircle size={17} className="spin" /> Conectando ao Mercado Pago de teste…</> : "Abrir checkout de teste"}
      </button>
      {!catalogLoaded && <p className="shop-disclaimer">Para ativar o checkout: aplicar a migração, configurar secrets TEST e publicar as Edge Functions.</p>}
      <button className="button subtle wide-button shop-return-button" onClick={() => setDialog("cart")}><ArrowLeft size={16} /> Voltar ao carrinho</button>
    </ShopDialog>}

    {dialog === "orders" && <ShopDialog title="Pedidos de teste" onClose={() => setDialog("")}>
      {ordersError && <p className="shop-disclaimer" role="alert">{ordersError}</p>}
      {orderIdFromUrl && !session?.user && <p className="shop-disclaimer" role="status">Entre na sua conta para consultar o estado do pedido de teste.</p>}
      {serverOrders.length > 0 && <button className="button subtle wide-button" onClick={loadServerOrders}>Atualizar status pelo servidor</button>}
      {serverOrders.length > 0 && <div className="shop-orders-list">{serverOrders.map(order => <article key={order.id} className={order.id === orderIdFromUrl ? "shop-order-current" : ""}><div><span className="shop-order-badge"><Check size={13} /> MERCADO PAGO · TESTE</span><strong>{orderStatusLabels[order.status] || order.status}</strong><small>{new Date(order.created_at).toLocaleString("pt-BR")} · {order.shop_order_items.reduce((count, line) => count + line.quantity, 0)} itens</small></div><strong>{money(Number(order.total))}</strong><p>{order.shop_order_items.map(line => `${line.quantity}× ${line.product_name_snapshot}`).join(" · ")}</p><small>Status pagamento: {order.payment_status}</small></article>)}</div>}
      {ordersError && <button className="button subtle wide-button" onClick={loadServerOrders}>Tentar novamente</button>}
      {!serverOrders.length && ordersLoading && <p className="shop-disclaimer" role="status">Carregando seus pedidos sandbox…</p>}
      {!serverOrders.length && !ordersLoading && !ordersError && <div className="shop-cart-empty"><span><ShoppingBag size={25} /></span><h3>{orders.length ? "Prévia local antiga" : "Nenhum pedido sandbox ainda."}</h3><p>{orders.length ? "Pedidos guardados em versões anteriores não são pedidos comerciais." : "Pedidos de teste aparecem aqui após a confirmação do checkout."}</p></div>}
      {orders.length > 0 && <p className="shop-disclaimer">Existem {orders.length} registros locais antigos. Eles não são pedidos comerciais nem pagamentos.</p>}
      <p className="shop-disclaimer">Um retorno do checkout não confirma pagamento. O status só muda quando o servidor valida a notificação assinada do Mercado Pago.</p>
    </ShopDialog>}
  </div>;
}
