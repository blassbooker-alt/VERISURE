import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Apple, ArrowRight, BadgeCheck, CalendarDays, CheckCircle2, CircleAlert,
  Search, ShieldCheck, SlidersHorizontal, Sparkles, UserRound,
  Utensils, X,
} from "lucide-react";
import { getErrorMessage } from "./socialService.js";
import { loadApprovedPartners } from "./partnerService.js";

const DEMO_PROFILES = [
  { id: "nutritionist-demo-01", name: "Mariana Costa", image: "nutritionist-demo-01.jpg", specialty: "Nutrição esportiva", tags: ["Nutrição esportiva", "Performance", "Hábitos saudáveis"], bio: "Exemplo de apresentação: acompanhamento alimentar adaptado à rotina, às preferências e aos objetivos de cada pessoa." },
  { id: "nutritionist-demo-02", name: "Gabriel Souza", image: "nutritionist-demo-05.jpg", specialty: "Nutrição clínica", tags: ["Nutrição clínica", "Saúde digestiva", "Educação alimentar"], bio: "Exemplo de apresentação: orientação nutricional com foco em escolhas sustentáveis e cuidado individualizado." },
  { id: "nutritionist-demo-03", name: "Juliana Ferreira", image: "nutritionist-demo-03.jpg", specialty: "Saúde da mulher", tags: ["Saúde da mulher", "Nutrição clínica", "Comportamento alimentar"], bio: "Exemplo de apresentação: espaço para explicar a abordagem profissional e como ela acompanha cada objetivo." },
  { id: "nutritionist-demo-04", name: "Rafael Mendes", image: "nutritionist-demo-06.jpg", specialty: "Nutrição esportiva", tags: ["Nutrição esportiva", "Composição corporal", "Performance"], bio: "Exemplo de apresentação: plano de acompanhamento pensado para integrar alimentação, treino e vida real." },
  { id: "nutritionist-demo-05", name: "Camila Ribeiro", image: "nutritionist-demo-04.jpg", specialty: "Nutrição clínica", tags: ["Nutrição clínica", "Saúde da mulher", "Educação alimentar"], bio: "Exemplo de apresentação: descrição do atendimento, dos temas de atuação e da forma de acompanhamento." },
  { id: "nutritionist-demo-06", name: "Bruno Vieira", image: "nutritionist-demo-02.jpg", specialty: "Comportamento alimentar", tags: ["Comportamento alimentar", "Nutrição clínica", "Hábitos saudáveis"], bio: "Exemplo de apresentação: abordagem acolhedora para apoiar mudanças graduais e hábitos consistentes." },
];

const SPECIALTIES = ["Nutrição esportiva", "Nutrição clínica", "Saúde da mulher", "Comportamento alimentar", "Educação alimentar"];

function DemoProfileCard({ person, onOpen }) {
  return <article className="nutritionist-card nutritionist-card-demo">
    <div className="nutritionist-card-photo"><img src={`./assets/nutritionists/${person.image}`} alt={`Foto ilustrativa do perfil de ${person.name}`} loading="lazy" decoding="async" /><span>DEMONSTRAÇÃO</span></div>
    <div className="nutritionist-card-main">
      <div className="nutritionist-card-name"><h3>{person.name}</h3><span className="nutritionist-demo-pill">Perfil de exemplo</span></div>
      <p className="nutritionist-specialty"><Apple size={14} /> {person.specialty}</p>
      <p className="nutritionist-bio">{person.bio}</p>
      <div className="nutritionist-tags">{person.tags.slice(0, 3).map(tag => <span key={tag}>{tag}</span>)}</div>
      <p className="nutritionist-credential-note"><ShieldCheck size={14} /> Cadastro, formação e CRN não verificados</p>
    </div>
    <div className="nutritionist-card-actions"><button type="button" className="button subtle" onClick={() => onOpen(person)}>Ver perfil de exemplo <ArrowRight size={15} /></button><button type="button" className="button primary" disabled title="Disponível após cadastro real e aprovação">Agendamento indisponível</button></div>
  </article>;
}

function ApprovedNutritionistCard({ partner }) {
  const tags = partner.modalities?.filter(Boolean) || [];
  return <article className="nutritionist-card nutritionist-card-approved">
    <Link className="nutritionist-card-photo" to={`/profile/${partner.profileId}`} aria-label={`Ver perfil de ${partner.name}`}>
      {partner.avatar ? <img src={partner.avatar} alt={`Foto de ${partner.name}`} loading="lazy" decoding="async" /> : <span className="nutritionist-avatar-fallback"><UserRound size={26} /></span>}
      <span className="nutritionist-approved-photo-label"><BadgeCheck size={13} /> APROVADO</span>
    </Link>
    <div className="nutritionist-card-main">
      <div className="nutritionist-card-name"><h3>{partner.name}</h3><span className="nutritionist-verified-label"><BadgeCheck size={15} /> Verificado</span></div>
      <p className="nutritionist-specialty"><Apple size={14} /> Nutricionista{partner.city ? ` · ${partner.city}` : ""}</p>
      <p className="nutritionist-bio">{partner.bio || "Consulte o perfil para ver as informações profissionais cadastradas."}</p>
      {tags.length > 0 && <div className="nutritionist-tags">{tags.slice(0, 3).map(tag => <span key={tag}>{tag}</span>)}</div>}
      <p className="nutritionist-credential-note"><ShieldCheck size={14} /> Cadastro profissional aprovado pela equipe Fortalfy</p>
    </div>
    <div className="nutritionist-card-actions"><Link className="button subtle" to={`/profile/${partner.profileId}`}>Ver perfil <ArrowRight size={15} /></Link><Link className="button primary" to={`/hire/nutritionist?partner=${encodeURIComponent(partner.profileId)}`}><CalendarDays size={15} /> Solicitar atendimento</Link></div>
  </article>;
}

function DemoProfileDialog({ person, onClose }) {
  useEffect(() => {
    if (!person) return undefined;
    const closeOnEscape = event => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [person, onClose]);
  if (!person) return null;
  return <div className="nutritionist-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="nutritionist-dialog" role="dialog" aria-modal="true" aria-labelledby="nutritionist-dialog-title">
      <button type="button" className="nutritionist-dialog-close" onClick={onClose} aria-label="Fechar perfil"><X size={19} /></button>
      <div className="nutritionist-dialog-hero"><img src={`./assets/nutritionists/${person.image}`} alt={`Foto ilustrativa de ${person.name}`} /><div><span className="nutritionist-demo-pill">PERFIL DE DEMONSTRAÇÃO</span><h2 id="nutritionist-dialog-title">{person.name}</h2><p><Apple size={15} /> {person.specialty}</p></div></div>
      <div className="nutritionist-dialog-content"><div className="nutritionist-dialog-disclosure"><CircleAlert size={17} /><p>Este é um perfil ilustrativo. Nome, foto e texto são exemplos visuais e não representam uma profissional cadastrada ou validada pela Fortalfy.</p></div>
        <section><h3>Apresentação</h3><p>{person.bio}</p></section>
        <section><h3>Áreas de atuação</h3><div className="nutritionist-tags">{person.tags.map(tag => <span key={tag}>{tag}</span>)}</div></section>
        <section className="nutritionist-profile-facts"><h3>Informações profissionais</h3><p><strong>Formação</strong><span>A preencher no cadastro profissional</span></p><p><strong>Registro CRN</strong><span>Não informado · sem verificação</span></p><p><strong>Modalidade e local</strong><span>A definir pelo profissional</span></p><p><strong>Agenda e valores</strong><span>Indisponíveis neste perfil de exemplo</span></p></section>
      </div>
      <footer><button type="button" className="button subtle" onClick={onClose}>Voltar à lista</button><button type="button" className="button primary" disabled>Agendamento indisponível</button></footer>
    </section>
  </div>;
}

export default function NutritionistDirectory({ client }) {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [mode, setMode] = useState("todos");
  const [sort, setSort] = useState("relevance");
  const [selectedDemo, setSelectedDemo] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    let active = true;
    loadApprovedPartners(client, { kind: "nutricionista" }).then(data => { if (active) setPartners(data); })
      .catch(failure => { if (active) setError(getErrorMessage(failure, "Não foi possível carregar os nutricionistas aprovados.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client]);

  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
  const filteredDemo = useMemo(() => DEMO_PROFILES.filter(person => {
    const matchesSearch = !normalizedSearch || [person.name, person.specialty, ...person.tags, person.bio].join(" ").toLocaleLowerCase("pt-BR").includes(normalizedSearch);
    const matchesSpecialty = !specialty || person.tags.includes(specialty);
    const matchesCity = !city.trim();
    const matchesMode = mode === "todos";
    return matchesSearch && matchesSpecialty && matchesCity && matchesMode;
  }).sort((first, second) => sort === "name" ? first.name.localeCompare(second.name, "pt-BR") : 0), [normalizedSearch, specialty, city, mode, sort]);
  const filteredPartners = useMemo(() => partners.filter(person => {
    const matchesSearch = !normalizedSearch || [person.name, person.city, person.address, person.bio, ...(person.modalities || [])].join(" ").toLocaleLowerCase("pt-BR").includes(normalizedSearch);
    const matchesCity = !city.trim() || [person.city, person.address].join(" ").toLocaleLowerCase("pt-BR").includes(city.trim().toLocaleLowerCase("pt-BR"));
    const matchesSpecialty = !specialty || (person.modalities || []).some(item => item.toLocaleLowerCase("pt-BR").includes(specialty.toLocaleLowerCase("pt-BR")));
    const modes = (person.modalities || []).join(" ").toLocaleLowerCase("pt-BR");
    const matchesMode = mode === "todos" || modes.includes(mode);
    return matchesSearch && matchesCity && matchesSpecialty && matchesMode;
  }).sort((first, second) => sort === "name" ? first.name.localeCompare(second.name, "pt-BR") : 0), [partners, normalizedSearch, city, specialty, mode, sort]);
  const clearFilters = () => { setSearch(""); setCity(""); setSpecialty(""); setMode("todos"); setSort("relevance"); };

  return <div className="nutritionist-directory">
    <section className="nutritionist-hero"><div className="nutritionist-hero-copy"><span className="eyebrow"><Apple size={14} /> NUTRIÇÃO · PROFISSIONAIS</span><h1>Encontre seu <em>nutricionista</em></h1><p>Conheça profissionais aprovados e encontre o acompanhamento que combina com seus objetivos.</p><div className="nutritionist-trust-points"><span><ShieldCheck size={15} /> Cadastro revisado</span><span><CalendarDays size={15} /> Atendimento pelo app</span><span><CheckCircle2 size={15} /> Informações transparentes</span></div></div><div className="nutritionist-hero-photo" aria-hidden="true"><img src="./assets/nutritionists/nutritionist-demo-03.jpg" alt="" /></div><div className="nutritionist-hero-aside"><span>Bem-estar começa<br />com escolhas possíveis.</span><Sparkles size={19} /></div></section>

    <label className="nutritionist-search"><Search size={18} /><span className="sr-only">Buscar nutricionista</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome, especialidade ou cidade..." /><button type="button" onClick={() => setShowFilters(value => !value)} aria-expanded={showFilters}><SlidersHorizontal size={15} /> Filtros</button></label>
    <div className="nutritionist-quick-filters" role="group" aria-label="Modalidade de atendimento">{[["todos", "Todos"], ["online", "Online"], ["presencial", "Presencial"]].map(([value, label]) => <button type="button" key={value} className={mode === value ? "active" : ""} aria-pressed={mode === value} onClick={() => setMode(value)}>{label}</button>)}</div>

    <div className="nutritionist-directory-layout">
      <aside className={`nutritionist-filter-panel${showFilters ? " is-open" : ""}`}>
        <header><h2>Refinar busca</h2><button type="button" onClick={clearFilters}>Limpar</button></header>
        <label>Especialidade<select value={specialty} onChange={event => setSpecialty(event.target.value)}><option value="">Todas as áreas</option>{SPECIALTIES.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
        <label>Cidade<input value={city} onChange={event => setCity(event.target.value)} placeholder="Digite a cidade" /></label>
        <div className="nutritionist-filter-note"><ShieldCheck size={16} /><p>O selo de verificação só aparece em cadastros profissionais completos e aprovados pela equipe.</p></div>
        <button type="button" className="button primary nutritionist-apply-filter" onClick={() => setShowFilters(false)}>Aplicar filtros</button>
      </aside>

      <section className="nutritionist-results" aria-live="polite">
        <header className="nutritionist-results-heading"><div><span className="eyebrow">PROFISSIONAIS DA FORTALFY</span><h2>Nutricionistas para conhecer</h2><p>{loading ? "Carregando perfis aprovados…" : `${filteredPartners.length} profissionais aprovados`}{` · ${filteredDemo.length} exemplos visuais`}</p></div><label>Ordenar por<select value={sort} onChange={event => setSort(event.target.value)}><option value="relevance">Mais relevantes</option><option value="name">Nome A–Z</option></select></label></header>
        {error && <p className="nutritionist-load-error" role="alert"><CircleAlert size={16} />{error}</p>}
        {filteredPartners.length > 0 && <><div className="nutritionist-list-heading"><h3>Perfis aprovados</h3><span>{filteredPartners.length} encontrados</span></div><div className="nutritionist-card-list">{filteredPartners.map(person => <ApprovedNutritionistCard key={person.id} partner={person} />)}</div></>}
        {!loading && !error && partners.length === 0 && <div className="nutritionist-empty-approved"><ShieldCheck size={18} /><span><strong>Ainda não há nutricionistas aprovados.</strong><small>Os cartões abaixo são demonstrações visuais e não oferecem atendimento.</small></span></div>}
        <div className="nutritionist-list-heading nutritionist-demo-heading"><div><h3>Exemplos de perfil</h3><p>Veja como as informações profissionais serão organizadas.</p></div><span>Não são profissionais cadastrados</span></div>
        {filteredDemo.length > 0 ? <div className="nutritionist-card-list">{filteredDemo.map(person => <DemoProfileCard key={person.id} person={person} onOpen={setSelectedDemo} />)}</div> : <div className="nutritionist-no-results"><Search size={19} /><strong>Nenhum perfil combina com esses filtros</strong><button type="button" onClick={clearFilters}>Limpar busca</button></div>}
        <p className="nutritionist-disclaimer"><ShieldCheck size={14} /> Fotos e nomes de exemplo são ilustrativos. Não representam cadastro real, credencial, avaliação ou disponibilidade.</p>
      </section>

      <aside className="nutritionist-info-rail"><section className="nutritionist-next-card"><span className="eyebrow">COMO FUNCIONA</span><h2>Escolha com confiança</h2><ol><li><span>1</span><div><strong>Explore os perfis</strong><small>Compare áreas de atuação e apresentação.</small></div></li><li><span>2</span><div><strong>Confira os dados</strong><small>O selo só aparece após a análise profissional.</small></div></li><li><span>3</span><div><strong>Solicite atendimento</strong><small>Agendamento disponível em perfis aprovados.</small></div></li></ol></section><section className="nutritionist-join-card"><span className="nutritionist-join-icon"><Utensils size={19} /></span><h2>É nutricionista?</h2><p>Complete seu cadastro profissional para análise e publicação do perfil.</p><Link to="/professional">Acessar cadastro profissional <ArrowRight size={15} /></Link></section><section className="nutritionist-privacy-card"><ShieldCheck size={17} /><p>Informações de clientes e profissionais são tratadas com privacidade. Nenhum dado de saúde é exibido nos perfis públicos.</p></section></aside>
    </div>
    <DemoProfileDialog person={selectedDemo} onClose={() => setSelectedDemo(null)} />
  </div>;
}
