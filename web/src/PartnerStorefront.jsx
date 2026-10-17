import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Building2, ExternalLink, ImagePlus, LoaderCircle, MapPin, PackagePlus, Pencil, Save, Store, Trash2, X, ArrowUpRight, Dumbbell, HeartPulse, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { deleteStoreProduct, loadStorefront, saveStoreProduct } from "./partnerStoreService.js";
import { getErrorMessage } from "./socialService.js";

const emptyFields = { name: "", category: "", description: "", price: "", isLaunch: false, isActive: true };
const formatPrice = value => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
const officialShowcase = [
  { title: "Comunidade", description: "Conecte-se com pessoas que também estão construindo uma rotina mais saudável.", image: "/assets/fortalfy/publicidade/banner-comunidade.jpg", href: "/feed", icon: UsersRound },
  { title: "Movimento", description: "Descubra conteúdos e ferramentas para acompanhar sua jornada de atividade física.", image: "/assets/fortalfy/treino/07-treino-forca.jpg", href: "/workout", icon: Dumbbell },
  { title: "Bem-estar", description: "Explore recursos do app pensados para apoiar seu cuidado no dia a dia.", image: "/assets/fortalfy/publicidade/05-inicio-bem-estar.jpg", href: "/home", icon: HeartPulse },
];

function StoreProductForm({ client, profile, userId, product, onSaved, onCancel, notify }) {
  const [fields, setFields] = useState(product ? {
    name: product.name,
    category: product.category,
    description: product.description,
    price: String(product.price),
    isLaunch: product.is_launch,
    isActive: product.is_active,
  } : emptyFields);
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState(product?.image || "");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!imageFile) return undefined;
    const url = URL.createObjectURL(imageFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const submit = async event => {
    event.preventDefault();
    setBusy(true);
    try {
      const saved = await saveStoreProduct(client, profile, userId, { ...fields, imageFile }, product);
      await onSaved(saved);
      notify(product ? "Produto atualizado na vitrine." : "Produto publicado na vitrine.");
    } catch (failure) {
      console.error("Falha ao salvar produto da vitrine.", failure);
      notify(getErrorMessage(failure, "Não foi possível salvar o produto."));
    } finally {
      setBusy(false);
    }
  };

  return <form className="partner-product-form" onSubmit={submit}>
    <div className="partner-product-form-heading"><div><span className="eyebrow">{product ? "EDITAR PRODUTO" : "NOVO PRODUTO"}</span><h3>Dados da vitrine</h3></div><button type="button" className="icon-button" aria-label="Fechar formulário" onClick={onCancel}><X size={17} /></button></div>
    <label>Nome do produto<input value={fields.name} maxLength={120} onChange={event => setFields(current => ({ ...current, name: event.target.value }))} required /></label>
    <div className="partner-product-form-row">
      <label>Categoria<input value={fields.category} maxLength={60} onChange={event => setFields(current => ({ ...current, category: event.target.value }))} required /></label>
      <label>Preço informado pela loja (R$)<input value={fields.price} type="number" min="0.01" step="0.01" onChange={event => setFields(current => ({ ...current, price: event.target.value }))} required /></label>
    </div>
    <label>Descrição<textarea value={fields.description} maxLength={1200} rows={3} onChange={event => setFields(current => ({ ...current, description: event.target.value }))} /></label>
    <div className="partner-product-image-field">
      {preview && <img src={preview} alt="Prévia do produto" />}
      <div><strong>Foto do produto</strong><small>JPG, PNG ou WebP · até 5 MB</small><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setImageFile(event.target.files?.[0] || null)} required={!product} /></div>
    </div>
    <label className="partner-product-checkbox"><input type="checkbox" checked={fields.isLaunch} onChange={event => setFields(current => ({ ...current, isLaunch: event.target.checked }))} /> Destacar como lançamento</label>
    <label className="partner-product-checkbox"><input type="checkbox" checked={fields.isActive} onChange={event => setFields(current => ({ ...current, isActive: event.target.checked }))} /> Exibir produto na vitrine</label>
    <p className="partner-store-disclaimer">Este preço é informado pela loja. A FortalShop não processa pagamentos nem confirma estoque ou entrega.</p>
    <div className="partner-product-form-actions"><button type="button" className="button subtle small-button" onClick={onCancel} disabled={busy}>Cancelar</button><button className="button primary small-button" disabled={busy}>{busy ? <LoaderCircle size={15} className="spin" /> : <Save size={15} />}{busy ? "Salvando…" : "Salvar produto"}</button></div>
  </form>;
}

export default function PartnerStorefront({ client, profile, userId, isOwn, notify }) {
  const [storefront, setStorefront] = useState({ listing: null, products: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const isGym = profile.kind === "academia";
  const isOfficialBrand = !isGym && profile.username?.toLowerCase() === "fortalfy";

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      setStorefront(await loadStorefront(client, profile.id));
    } catch (failure) {
      console.error("Falha ao carregar a vitrine comercial.", failure);
      setError(getErrorMessage(failure, "Não foi possível carregar a vitrine."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, [client, profile.id]);

  const remove = async product => {
    if (!window.confirm(`Remover "${product.name}" da vitrine?`)) return;
    try {
      await deleteStoreProduct(client, profile, userId, product);
      setStorefront(current => ({ ...current, products: current.products.filter(item => item.id !== product.id) }));
      notify("Produto removido da vitrine.");
    } catch (failure) {
      console.error("Falha ao remover produto da vitrine.", failure);
      notify(getErrorMessage(failure, "Não foi possível remover o produto."));
    }
  };

  const saveProduct = saved => {
    return refresh().then(() => setEditing(null));
  };

  return <section className="partner-storefront">
    {isOfficialBrand && <section className="partner-store-brand-showcase" aria-labelledby="partner-store-brand-title">
      <img className="partner-store-brand-hero-image" src="/assets/fortalfy/publicidade/banner-app-papagaio-a.jpg" alt="Campanha visual da Fortalfy com o mascote da marca" />
      <div className="partner-store-brand-hero-shade" />
      <div className="partner-store-brand-hero-content">
        <span className="partner-store-brand-kicker"><Store size={14} /> VITRINE OFICIAL FORTALFY</span>
        <h2 id="partner-store-brand-title">Seu bem-estar,<br />no seu ritmo.</h2>
        <p>Uma plataforma para conectar movimento, comunidade e cuidado em um só lugar.</p>
        <div className="partner-store-brand-hero-actions">
          <Link className="button primary small-button" to="/feed">Conhecer a comunidade <ArrowUpRight size={15} /></Link>
          <Link className="partner-store-brand-secondary-action" to="/home">Explorar o app <ArrowUpRight size={14} /></Link>
        </div>
      </div>
      <span className="partner-store-brand-mark"><img src="/assets/fortalfy-official-logo.png" alt="Símbolo Fortalfy" /></span>
    </section>}
    <header className="partner-storefront-heading"><div><span className="eyebrow">{isGym ? "ECOSSISTEMA DA ACADEMIA" : "LOJA OFICIAL"}</span><h2>{isGym ? "Conheça nossa academia" : "Conheça nossa marca"}</h2><p>Informações e produtos cadastrados por este parceiro.</p></div>{profile.partnerApproved && <span className="partner-store-approved"><BadgeCheck size={15} /> Parceiro aprovado</span>}</header>
    <div className="partner-store-about">
      <span className="partner-store-about-icon">{isGym ? <Building2 size={22} /> : <Store size={22} />}</span>
      <div><h3>{profile.name}</h3><p>{profile.bio || (isGym ? "Conheça a estrutura, os serviços e as novidades da academia." : "Conheça a história, os valores e as novidades da marca.")}</p>
        {profile.city && <span className="partner-store-meta"><MapPin size={14} />{profile.city}</span>}
        {storefront.listing?.address && <span className="partner-store-meta"><MapPin size={14} />{storefront.listing.address}</span>}
        {storefront.listing?.website_url && <a className="partner-store-meta partner-store-website" href={storefront.listing.website_url} target="_blank" rel="noreferrer"><ExternalLink size={14} />Acessar site oficial</a>}
      </div>
    </div>
    <div className="partner-store-products-heading"><div><span className="eyebrow">VITRINE</span><h3>{isGym ? "Produtos e novidades" : "Produtos e lançamentos"}</h3></div>{isOwn && !editing && <button className="button primary small-button" onClick={() => setEditing({ product: null })}><PackagePlus size={15} /> Cadastrar produto</button>}</div>
    {isOwn && !profile.partnerApproved && <p className="partner-store-disclaimer">Sua vitrine ficará visível para o público após a aprovação do perfil de parceiro.</p>}
    {isOfficialBrand && <section className="partner-store-brand-pillars" aria-label="Conheça o Fortalfy">
      {officialShowcase.map(({ title, description, image, href, icon: Icon }) => <Link className="partner-store-brand-pillar" to={href} key={title}>
        <img src={image} alt="" loading="lazy" />
        <span className="partner-store-brand-pillar-shade" />
        <span className="partner-store-brand-pillar-copy"><span className="partner-store-brand-pillar-icon"><Icon size={16} /></span><strong>{title}</strong><small>{description}</small><span className="partner-store-brand-pillar-link">Explorar <ArrowUpRight size={13} /></span></span>
      </Link>)}
    </section>}
    {editing && <StoreProductForm key={editing.product?.id || "new"} client={client} profile={profile} userId={userId} product={editing.product} onSaved={saveProduct} onCancel={() => setEditing(null)} notify={notify} />}
    {loading ? <p className="social-inline-status"><LoaderCircle className="spin" size={17} /> Carregando vitrine…</p>
      : error ? <div className="social-feed-error" role="alert">{error}<button onClick={refresh}>Tentar novamente</button></div>
        : storefront.products.filter(product => isOwn || product.is_active).length
          ? <div className="partner-store-products-grid">{storefront.products.filter(product => isOwn || product.is_active).map(product => <article className="partner-store-product" key={product.id}>
            <div className="partner-store-product-image"><img src={product.image} alt={product.name} />{product.is_launch && <span>Lançamento</span>}{isOwn && !product.is_active && <span className="partner-product-inactive">Oculto</span>}</div>
            <div className="partner-store-product-info"><span>{product.category}</span><h4>{product.name}</h4>{product.description && <p>{product.description}</p>}<strong>{formatPrice(product.price)}</strong><small>Preço informado pela loja · confirme disponibilidade</small>
              {isOwn && <div className="partner-store-product-actions"><button className="button subtle small-button" onClick={() => setEditing({ product })}><Pencil size={14} /> Editar</button><button className="button subtle small-button" onClick={() => remove(product)}><Trash2 size={14} /> Remover</button></div>}
            </div>
          </article>)}</div>
          : <div className="partner-store-empty"><ImagePlus size={24} /><h3>A vitrine ainda não tem produtos</h3><p>{isOwn ? "Cadastre produtos reais da sua loja para que apareçam aqui após a aprovação do perfil." : "Os produtos cadastrados por este parceiro aparecerão aqui."}</p>{isOwn && !editing && <button className="button subtle small-button" onClick={() => setEditing({ product: null })}><PackagePlus size={15} /> Cadastrar primeiro produto</button>}</div>}
    <p className="partner-store-disclaimer">Os produtos e preços são informados pelos parceiros. A FortalShop não confirma estoque, não processa pagamentos e não promete entrega.</p>
  </section>;
}
