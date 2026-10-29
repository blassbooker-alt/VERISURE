import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  Apple, ArrowRight, BadgeCheck, CalendarDays, CheckCircle2, CircleAlert,
  Search, ShieldCheck, SlidersHorizontal, Sparkles, UserRound,
  Utensils, X,
} from "lucide-react";
import { getErrorMessage } from "./socialService.js";
import { loadApprovedPartners } from "./partnerService.js";

const DEMO_PROFILES = [
  { id: "nutritionist-demo-01", name: "Mariana Costa", image: "nutritionist-demo-01.jpg", specialty: "Nutrição esportiva", tags: ["Nutrição esportiva", "Performance", "Hábitos saudáveis"], bio: "Exemplo de apresentação profissional para quem busca alinhar alimentação, rotina de treinos e bem-estar.", approach: "Um plano alimentar individualizado considera preferências, horários e objetivos definidos em consulta.", audience: "Pessoas fisicamente ativas e quem deseja organizar a alimentação em torno da rotina de exercícios.", consultation: "Entrevista inicial, compreensão da rotina e definição conjunta dos próximos passos." },
  { id: "nutritionist-demo-02", name: "Gabriel Souza", image: "nutritionist-demo-05.jpg", specialty: "Nutrição clínica", tags: ["Nutrição clínica", "Saúde digestiva", "Educação alimentar"], bio: "Exemplo de apresentação profissional com foco em cuidado nutricional individual e escolhas sustentáveis no dia a dia.", approach: "A consulta reúne histórico, rotina alimentar, preferências e metas para orientar um acompanhamento personalizado.", audience: "Pessoas que procuram melhorar a organização alimentar e construir hábitos consistentes.", consultation: "Escuta inicial, levantamento de necessidades e proposta de acompanhamento a ser definida pelo profissional." },
  { id: "nutritionist-demo-03", name: "Juliana Ferreira", image: "nutritionist-demo-03.jpg", specialty: "Saúde da mulher", tags: ["Saúde da mulher", "Nutrição clínica", "Comportamento alimentar"], bio: "Exemplo de apresentação profissional voltada a um cuidado acolhedor, individualizado e atento às diferentes rotinas.", approach: "O acompanhamento parte das necessidades e do contexto de cada pessoa, com metas possíveis e revisadas em consulta.", audience: "Mulheres que desejam conversar sobre alimentação, rotina e construção de hábitos saudáveis.", consultation: "Conversa inicial sobre objetivos e rotina, seguida de orientações personalizadas após avaliação profissional." },
  { id: "nutritionist-demo-04", name: "Rafael Mendes", image: "nutritionist-demo-06.jpg", specialty: "Nutrição esportiva", tags: ["Nutrição esportiva", "Composição corporal", "Performance"], bio: "Exemplo de apresentação profissional para demonstrar como conectar alimentação, prática esportiva e objetivos individuais.", approach: "Estratégias são definidas com base na rotina, nas preferências e nas necessidades avaliadas pelo profissional.", audience: "Praticantes de atividade física que buscam mais consistência na rotina alimentar.", consultation: "Avaliação da rotina e dos objetivos; plano e frequência de acompanhamento definidos após a consulta." },
  { id: "nutritionist-demo-05", name: "Camila Ribeiro", image: "nutritionist-demo-04.jpg", specialty: "Nutrição clínica", tags: ["Nutrição clínica", "Saúde da mulher", "Educação alimentar"], bio: "Exemplo de apresentação profissional que valoriza orientação clara e mudanças alimentares compatíveis com a vida real.", approach: "O cuidado considera preferências, cultura alimentar, disponibilidade e objetivos estabelecidos em conjunto.", audience: "Pessoas que buscam orientação individual para organizar a alimentação e cuidar da saúde.", consultation: "Levantamento de hábitos e necessidades, com recomendações elaboradas após avaliação individual." },
  { id: "nutritionist-demo-06", name: "Bruno Vieira", image: "nutritionist-demo-02.jpg", specialty: "Comportamento alimentar", tags: ["Comportamento alimentar", "Nutrição clínica", "Hábitos saudáveis"], bio: "Exemplo de apresentação profissional com atenção à relação com a comida e à construção gradual de hábitos.", approach: "A conversa considera rotina, preferências e desafios, sem prometer resultados ou soluções iguais para todos.", audience: "Pessoas que desejam compreender melhor seus hábitos e estabelecer uma rotina alimentar mais consciente.", consultation: "Acolhimento, definição das prioridades e orientações individualizadas após avaliação profissional." },
];

const SPECIALTIES = ["Nutrição esportiva", "Nutrição clínica", "Saúde da mulher", "Comportamento alimentar", "Educação alimentar"];

function DemoProfileCard({ person, onOpen }) {
  return <article className="nutritionist-card nutritionist-card-demo">
    <div className="nutritionist-card-photo"><img src={`./assets/nutritionists/${person.image}`} alt={`Foto ilustrativa do perfil de ${person.name}`} loading="lazy" decoding="async" /></div>
    <div className="nutritionist-card-main">
      <div className="nutritionist-card-name"><h3>{person.name}</h3><span className="nutritionist-demo-verification-mark" role="img" aria-label="Ícone ilustrativo de verificação; perfil demonstrativo não verificado" title="Ícone ilustrativo. Este perfil de demonstração ainda não foi verificado pela Fortalfy."><BadgeCheck size={16} /></span></div>
      <p className="nutritionist-specialty"><Apple size={14} /> {person.specialty}</p>
      <p className="nutritionist-bio">{person.bio}</p>
      <div className="nutritionist-tags">{person.tags.slice(0, 3).map(tag => <span key={tag}>{tag}</span>)}</div>
      <p className="nutritionist-demo-detail"><strong>Abordagem:</strong> {person.approach}</p>
      <p className="nutritionist-credential-note"><ShieldCheck size={14} /> Cadastro, formação e CRN não verificados</p>
    </div>
    <div className="nutritionist-card-actions"><button type="button" className="button subtle" onClick={() => onOpen(person)}>Ver perfil de exemplo <ArrowRight size={15} /></button><button type="button" className="button primary" disabled title="Disponível após cadastro real e aprovação">Agendamento indisponível</button></div>
  </article>;
}

function ApprovedNutritionistCard({ partner }) {
  const tags = partner.modalities?.filter(Boolean) || [];
  return <article className="nutritionist-card nutritionist-card-approved">
    <Link className="nutritionist-card-photo" to={`/partner/nutritionist/${partner.profileId}`} aria-label={`Ver perfil de ${partner.name}`}>
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
    <div className="nutritionist-card-actions"><Link className="button subtle" to={`/partner/nutritionist/${partner.profileId}`}>Ver perfil <ArrowRight size={15} /></Link><Link className="button primary" to={`/hire/nutritionist?partner=${encodeURIComponent(partner.profileId)}`}><CalendarDays size={15} /> Solicitar atendimento</Link></div>
  </article>;
}

function DemoProfileDialog({ person, onClose }) {
  useEffect(() => {
    if (!person) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = event => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", closeOnEscape); };
  }, [person, onClose]);
  if (!person) return null;
  return createPortal(<div className="nutritionist-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="nutritionist-dialog" role="dialog" aria-modal="true" aria-labelledby="nutritionist-dialog-title">
      <button type="button" className="nutritionist-dialog-close" onClick={onClose} aria-label="Fechar perfil"><X size={19} /></button>
      <div className="nutritionist-dialog-hero"><img src={`./assets/nutritionists/${person.image}`} alt={`Foto ilustrativa de ${person.name}`} /><div><span className="nutritionist-demo-pill">PERFIL DE DEMONSTRAÇÃO</span><h2 id="nutritionist-dialog-title">{person.name}</h2><p><Apple size={15} /> {person.specialty}</p></div></div>
      <div className="nutritionist-dialog-content"><div className="nutritionist-dialog-disclosure"><CircleAlert size={17} /><p>Perfil demonstrativo criado com foto e conteúdo ilustrativos. Não corresponde a uma pessoa cadastrada ou validada pela Fortalfy e não oferece atendimento.</p></div>
        <section><h3>Apresentação</h3><p>{person.bio}</p></section>
        <section><h3>Áreas de atuação do exemplo</h3><div className="nutritionist-tags">{person.tags.map(tag => <span key={tag}>{tag}</span>)}</div></section>
        <section><h3>Como seria o acompanhamento</h3><p>{person.approach}</p></section>
        <section><h3>Para quem é este exemplo</h3><p>{person.audience}</p></section>
        <section><h3>Etapas da consulta</h3><p>{person.consultation}</p></section>
        <section className="nutritionist-profile-facts"><h3>Dados para completar no cadastro real</h3><p><strong>Formação acadêmica</strong><span>Informada pelo profissional e conferida pela equipe</span></p><p><strong>Registro CRN</strong><span>Obrigatório para validação profissional</span></p><p><strong>Atendimento e local</strong><span>Modalidades e endereço definidos pelo profissional</span></p><p><strong>Agenda e valores</strong><span>Configurados pelo profissional após aprovação</span></p></section>
      </div>
      <footer><button type="button" className="button subtle" onClick={onClose}>Voltar à lista</button><button type="button" className="button primary" disabled>Agendamento indisponível</button></footer>
    </section>
  </div>, document.body);
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
