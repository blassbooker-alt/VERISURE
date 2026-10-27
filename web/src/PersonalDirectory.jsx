import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, BadgeCheck, CalendarDays, CheckCircle2, CircleAlert, Clock3,
  Dumbbell, Search, ShieldCheck, SlidersHorizontal, Sparkles, UserRound, X,
} from "lucide-react";
import { getErrorMessage } from "./socialService.js";
import { loadApprovedPartners } from "./partnerService.js";

const DEMO_PROFILES = [
  { id: "personal-demo-01", name: "Lucas Ferreira", image: "fortalfy_personal_01.jpg", focus: "Musculação e emagrecimento", tags: ["Musculação", "Emagrecimento", "Condicionamento"], bio: "Uma apresentação profissional pode explicar como o treino é adaptado à rotina e aos objetivos de cada aluno.", method: "Avaliação inicial, definição de objetivos e progressão de exercícios acompanhada ao longo do tempo.", audience: "Pessoas que buscam orientação individual para começar ou manter uma rotina de treinos.", flow: "Conversa sobre objetivos, avaliação presencial e elaboração de uma proposta de acompanhamento." },
  { id: "personal-demo-02", name: "Ana Martins", image: "fortalfy_personal_02.jpg", focus: "Treinamento funcional", tags: ["Funcional", "Força", "Condicionamento"], bio: "Perfil de exemplo para apresentar uma profissional de treino funcional com acompanhamento próximo e progressivo.", method: "Sessões planejadas de acordo com a experiência, o ritmo e os objetivos definidos com o aluno.", audience: "Pessoas interessadas em desenvolver força, mobilidade e condicionamento com orientação.", flow: "Alinhamento de expectativas, avaliação de movimento e plano de treino individualizado." },
  { id: "personal-demo-03", name: "Rafael Mendes", image: "fortalfy_personal_03.jpg", focus: "Força e condicionamento", tags: ["Força", "Musculação", "Condicionamento"], bio: "Exemplo de como apresentar a experiência de acompanhamento e o planejamento de treinos individuais.", method: "Treinos organizados em etapas, com ajustes conforme a evolução e a disponibilidade do aluno.", audience: "Quem deseja criar consistência e evoluir com um plano estruturado.", flow: "Entrevista inicial, avaliação e construção conjunta da rotina de treino." },
  { id: "personal-demo-04", name: "Camila Rocha", image: "fortalfy_personal_04.jpg", focus: "Condicionamento e força", tags: ["Condicionamento", "Treino funcional", "Mobilidade"], bio: "Perfil ilustrativo de uma personal trainer que prioriza acompanhamento atencioso e metas realistas.", method: "Combinação de exercícios de força e condicionamento, respeitando o nível e as preferências de cada pessoa.", audience: "Pessoas que preferem orientação próxima para manter a regularidade nos treinos.", flow: "Conversa sobre histórico e objetivos, seguida de avaliação e planejamento das sessões." },
  { id: "personal-demo-05", name: "Bruno Almeida", image: "fortalfy_personal_05.jpg", focus: "Musculação e performance", tags: ["Musculação", "Performance", "Força"], bio: "Exemplo de apresentação para um profissional focado em planejamento e progressão de treino.", method: "Acompanhamento periódico para revisar execução, carga e adequação do plano de exercícios.", audience: "Praticantes que desejam estruturar melhor a rotina de musculação.", flow: "Avaliação do momento atual, definição das prioridades e acompanhamento combinado." },
  { id: "personal-demo-06", name: "Juliana Costa", image: "fortalfy_personal_06.jpg", focus: "Treinamento personalizado", tags: ["Treino personalizado", "Musculação", "Bem-estar"], bio: "Perfil demonstrativo para mostrar como experiência, áreas de atuação e metodologia podem aparecer no app.", method: "Plano ajustado à rotina, com orientações e revisões durante o acompanhamento.", audience: "Pessoas que buscam apoio para treinar com mais segurança e consistência.", flow: "Conversa inicial, avaliação individual e escolha do formato de acompanhamento." },
  { id: "personal-demo-07", name: "Pedro Nascimento", image: "fortalfy_personal_07.jpg", focus: "Hipertrofia e força", tags: ["Hipertrofia", "Força", "Musculação"], bio: "Exemplo de perfil para apresentar um acompanhamento direcionado a objetivos de força e hipertrofia.", method: "Planejamento progressivo com atenção à execução e às condições individuais do aluno.", audience: "Pessoas que praticam musculação e procuram orientação personalizada.", flow: "Avaliação dos objetivos, alinhamento de disponibilidade e planejamento do treino." },
  { id: "personal-demo-08", name: "Mariana Alves", image: "fortalfy_personal_08.jpg", focus: "Condicionamento e emagrecimento", tags: ["Condicionamento", "Emagrecimento", "Treino funcional"], bio: "Perfil ilustrativo de acompanhamento individual que pode ser personalizado pelo próprio profissional.", method: "Rotina de exercícios construída em etapas e ajustada conforme as respostas ao treino.", audience: "Quem quer desenvolver uma rotina ativa com orientação e metas possíveis.", flow: "Entrevista, avaliação e proposta de plano compatível com os objetivos do aluno." },
  { id: "personal-demo-09", name: "Diego Santos", image: "fortalfy_personal_09.jpg", focus: "Treinamento funcional e força", tags: ["Funcional", "Força", "Mobilidade"], bio: "Demonstração de um perfil profissional com foco em treino orientado e acompanhamento contínuo.", method: "Exercícios escolhidos conforme o nível de experiência, com progressão gradual e revisões.", audience: "Pessoas interessadas em melhorar força e condicionamento com orientação individual.", flow: "Conversa inicial, avaliação de movimento e definição do formato das sessões." },
  { id: "personal-demo-10", name: "Marcos Oliveira", image: "fortalfy_personal_10.jpg", focus: "Musculação e condicionamento", tags: ["Musculação", "Condicionamento", "Treino personalizado"], bio: "Perfil de exemplo para apresentar a metodologia, o público atendido e as próximas etapas de contato.", method: "Treinos planejados com metas claras e ajustes alinhados entre profissional e aluno.", audience: "Pessoas que desejam acompanhamento estruturado para a rotina de exercícios.", flow: "Entendimento dos objetivos, avaliação e apresentação de uma proposta personalizada." },
];

const FOCUSES = [...new Set(DEMO_PROFILES.flatMap(person => person.tags))];

function DemoPersonalCard({ person, onOpen }) {
  return <article className="nutritionist-card nutritionist-card-demo">
    <div className="nutritionist-card-photo"><img src={`./assets/personal-trainers/${person.image}`} alt={`Foto ilustrativa do perfil de ${person.name}`} loading="lazy" decoding="async" /></div>
    <div className="nutritionist-card-main">
      <div className="nutritionist-card-name"><h3>{person.name}</h3><span className="nutritionist-demo-verification-mark" role="img" aria-label="Ícone ilustrativo; perfil demonstrativo não verificado" title="Ícone ilustrativo. Este perfil ainda não foi verificado pela Fortalfy."><BadgeCheck size={16} /></span></div>
      <p className="nutritionist-specialty"><Dumbbell size={14} /> {person.focus}</p>
      <p className="nutritionist-bio">{person.bio}</p>
      <div className="nutritionist-tags">{person.tags.slice(0, 3).map(tag => <span key={tag}>{tag}</span>)}</div>
      <p className="nutritionist-demo-detail"><strong>Metodologia:</strong> {person.method}</p>
      <p className="nutritionist-credential-note"><ShieldCheck size={14} /> Cadastro e registro profissional não verificados</p>
    </div>
    <div className="nutritionist-card-actions"><button type="button" className="button subtle" onClick={() => onOpen(person)}>Ver perfil de exemplo <ArrowRight size={15} /></button><button type="button" className="button primary" disabled title="Disponível após cadastro real e aprovação">Agendamento indisponível</button></div>
  </article>;
}

function ApprovedPersonalCard({ partner }) {
  const tags = partner.modalities?.filter(Boolean) || [];
  return <article className="nutritionist-card nutritionist-card-approved">
    <Link className="nutritionist-card-photo" to={`/profile/${partner.profileId}`} aria-label={`Ver perfil de ${partner.name}`}>
      {partner.avatar ? <img src={partner.avatar} alt={`Foto de ${partner.name}`} loading="lazy" decoding="async" /> : <span className="nutritionist-avatar-fallback"><UserRound size={26} /></span>}
      <span className="nutritionist-approved-photo-label"><BadgeCheck size={13} /> APROVADO</span>
    </Link>
    <div className="nutritionist-card-main">
      <div className="nutritionist-card-name"><h3>{partner.name}</h3><span className="nutritionist-verified-label"><BadgeCheck size={15} /> Verificado</span></div>
      <p className="nutritionist-specialty"><Dumbbell size={14} /> Personal trainer{partner.city ? ` · ${partner.city}` : ""}</p>
      <p className="nutritionist-bio">{partner.bio || "Acesse o perfil para consultar as informações profissionais cadastradas."}</p>
      {tags.length > 0 && <div className="nutritionist-tags">{tags.slice(0, 3).map(tag => <span key={tag}>{tag}</span>)}</div>}
      <p className="nutritionist-credential-note"><ShieldCheck size={14} /> Cadastro profissional aprovado pela equipe Fortalfy</p>
    </div>
    <div className="nutritionist-card-actions"><Link className="button subtle" to={`/profile/${partner.profileId}`}>Ver perfil <ArrowRight size={15} /></Link><Link className="button primary" to={`/hire/personal?partner=${encodeURIComponent(partner.profileId)}`}><CalendarDays size={15} /> Solicitar treino</Link></div>
  </article>;
}

function DemoPersonalDialog({ person, onClose }) {
  useEffect(() => {
    if (!person) return undefined;
    const closeOnEscape = event => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [person, onClose]);
  if (!person) return null;
  return <div className="nutritionist-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="nutritionist-dialog" role="dialog" aria-modal="true" aria-labelledby="personal-dialog-title">
      <button type="button" className="nutritionist-dialog-close" onClick={onClose} aria-label="Fechar perfil"><X size={19} /></button>
      <div className="nutritionist-dialog-hero"><img src={`./assets/personal-trainers/${person.image}`} alt={`Foto ilustrativa de ${person.name}`} /><div><span className="nutritionist-demo-pill">PERFIL DE DEMONSTRAÇÃO</span><h2 id="personal-dialog-title">{person.name}</h2><p><Dumbbell size={15} /> {person.focus}</p></div></div>
      <div className="nutritionist-dialog-content"><div className="nutritionist-dialog-disclosure"><CircleAlert size={17} /><p>Este perfil usa foto e conteúdo ilustrativos. Não corresponde a um profissional cadastrado ou validado pela Fortalfy e não oferece atendimento.</p></div>
        <section><h3>Apresentação</h3><p>{person.bio}</p></section>
        <section><h3>Áreas de atuação do exemplo</h3><div className="nutritionist-tags">{person.tags.map(tag => <span key={tag}>{tag}</span>)}</div></section>
        <section><h3>Metodologia de acompanhamento</h3><p>{person.method}</p></section>
        <section><h3>Para quem é este exemplo</h3><p>{person.audience}</p></section>
        <section><h3>Etapas iniciais</h3><p>{person.flow}</p></section>
        <section className="nutritionist-profile-facts"><h3>Dados que serão informados no cadastro real</h3><p><strong>Formação e certificações</strong><span>Informadas pelo profissional e analisadas pela equipe</span></p><p><strong>Registro profissional</strong><span>Informado e conferido antes da aprovação</span></p><p><strong>Modalidade e local</strong><span>Definidos pelo profissional no cadastro</span></p><p><strong>Agenda e valores</strong><span>Configurados pelo profissional após aprovação</span></p></section>
      </div>
      <footer><button type="button" className="button subtle" onClick={onClose}>Voltar à lista</button><button type="button" className="button primary" disabled>Agendamento indisponível</button></footer>
    </section>
  </div>;
}

export default function PersonalDirectory({ client }) {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [focus, setFocus] = useState("");
  const [mode, setMode] = useState("todos");
  const [sort, setSort] = useState("relevance");
  const [selectedDemo, setSelectedDemo] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    let active = true;
    loadApprovedPartners(client, { kind: "personal" }).then(data => { if (active) setPartners(data); })
      .catch(failure => { if (active) setError(getErrorMessage(failure, "Não foi possível carregar os personais aprovados.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client]);

  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
  const filteredDemo = useMemo(() => DEMO_PROFILES.filter(person => {
    const matchesSearch = !normalizedSearch || [person.name, person.focus, ...person.tags, person.bio].join(" ").toLocaleLowerCase("pt-BR").includes(normalizedSearch);
    return matchesSearch && (!focus || person.tags.includes(focus)) && !city.trim() && mode === "todos";
  }).sort((first, second) => sort === "name" ? first.name.localeCompare(second.name, "pt-BR") : 0), [normalizedSearch, focus, city, mode, sort]);
  const filteredPartners = useMemo(() => partners.filter(person => {
    const text = [person.name, person.city, person.address, person.bio, ...(person.modalities || [])].join(" ").toLocaleLowerCase("pt-BR");
    const matchesSearch = !normalizedSearch || text.includes(normalizedSearch);
    const matchesCity = !city.trim() || [person.city, person.address].join(" ").toLocaleLowerCase("pt-BR").includes(city.trim().toLocaleLowerCase("pt-BR"));
    const matchesFocus = !focus || (person.modalities || []).some(item => item.toLocaleLowerCase("pt-BR").includes(focus.toLocaleLowerCase("pt-BR")));
    const modalities = (person.modalities || []).join(" ").toLocaleLowerCase("pt-BR");
    const matchesMode = mode === "todos" || modalities.includes(mode);
    return matchesSearch && matchesCity && matchesFocus && matchesMode;
  }).sort((first, second) => sort === "name" ? first.name.localeCompare(second.name, "pt-BR") : 0), [partners, normalizedSearch, city, focus, mode, sort]);
  const clearFilters = () => { setSearch(""); setCity(""); setFocus(""); setMode("todos"); setSort("relevance"); };

  return <div className="nutritionist-directory personal-directory">
    <section className="nutritionist-hero"><div className="nutritionist-hero-copy"><span className="eyebrow"><Dumbbell size={14} /> TREINO · PROFISSIONAIS</span><h1>Encontre seu <em>personal</em></h1><p>Conheça profissionais aprovados e encontre um acompanhamento que combine com seus objetivos.</p><div className="nutritionist-trust-points"><span><ShieldCheck size={15} /> Cadastro analisado</span><span><CalendarDays size={15} /> Solicitação pelo app</span><span><CheckCircle2 size={15} /> Perfis transparentes</span></div></div><div className="nutritionist-hero-photo" aria-hidden="true"><img src="./assets/personal-trainers/fortalfy_personal_02.jpg" alt="" /></div><div className="nutritionist-hero-aside"><span>Treino com propósito.<br />Evolua no seu ritmo.</span><Sparkles size={19} /></div></section>

    <label className="nutritionist-search"><Search size={18} /><span className="sr-only">Buscar personal trainers</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome, modalidade ou cidade..." /><button type="button" onClick={() => setShowFilters(value => !value)} aria-expanded={showFilters}><SlidersHorizontal size={15} /> Filtros</button></label>
    <div className="nutritionist-quick-filters" role="group" aria-label="Modalidade de atendimento">{[["todos", "Todos"], ["online", "Online"], ["presencial", "Presencial"]].map(([value, label]) => <button type="button" key={value} className={mode === value ? "active" : ""} aria-pressed={mode === value} onClick={() => setMode(value)}>{label}</button>)}</div>

    <div className="nutritionist-directory-layout">
      <aside className={`nutritionist-filter-panel${showFilters ? " is-open" : ""}`}>
        <header><h2>Refinar busca</h2><button type="button" onClick={clearFilters}>Limpar</button></header>
        <label>Área de atuação<select value={focus} onChange={event => setFocus(event.target.value)}><option value="">Todas as modalidades</option>{FOCUSES.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
        <label>Cidade<input value={city} onChange={event => setCity(event.target.value)} placeholder="Digite a cidade" /></label>
        <div className="nutritionist-filter-note"><ShieldCheck size={16} /><p>O selo oficial aparece apenas em cadastros completos e aprovados pela equipe Fortalfy.</p></div>
        <button type="button" className="button primary nutritionist-apply-filter" onClick={() => setShowFilters(false)}>Aplicar filtros</button>
      </aside>

      <section className="nutritionist-results" aria-live="polite">
        <header className="nutritionist-results-heading"><div><span className="eyebrow">PROFISSIONAIS DA FORTALFY</span><h2>Personais para conhecer</h2><p>{loading ? "Carregando perfis aprovados…" : `${filteredPartners.length} profissionais aprovados`} · {filteredDemo.length} perfis de exemplo</p></div><label>Ordenar por<select value={sort} onChange={event => setSort(event.target.value)}><option value="relevance">Mais relevantes</option><option value="name">Nome A–Z</option></select></label></header>
        {error && <p className="nutritionist-load-error" role="alert"><CircleAlert size={16} />{error}</p>}
        {filteredPartners.length > 0 && <><div className="nutritionist-list-heading"><h3>Perfis aprovados</h3><span>{filteredPartners.length} encontrados</span></div><div className="nutritionist-card-list">{filteredPartners.map(person => <ApprovedPersonalCard key={person.id} partner={person} />)}</div></>}
        {!loading && !error && partners.length === 0 && <div className="nutritionist-empty-approved"><ShieldCheck size={18} /><span><strong>Ainda não há personais aprovados.</strong><small>Os perfis abaixo são exemplos visuais e não oferecem atendimento.</small></span></div>}
        <div className="nutritionist-list-heading nutritionist-demo-heading"><div><h3>Perfis de exemplo</h3><p>Veja como apresentação, metodologia e áreas de atuação aparecem no app.</p></div><span>Não são profissionais cadastrados</span></div>
        {filteredDemo.length > 0 ? <div className="nutritionist-card-list">{filteredDemo.map(person => <DemoPersonalCard key={person.id} person={person} onOpen={setSelectedDemo} />)}</div> : <div className="nutritionist-no-results"><Search size={19} /><strong>Nenhum perfil combina com esses filtros</strong><button type="button" onClick={clearFilters}>Limpar busca</button></div>}
        <p className="nutritionist-disclaimer"><ShieldCheck size={14} /> Fotos, nomes e informações dos exemplos são ilustrativos. Não representam cadastro, credencial, avaliação ou disponibilidade reais.</p>
      </section>

      <aside className="nutritionist-info-rail"><section className="nutritionist-next-card"><span className="eyebrow">COMO FUNCIONA</span><h2>Treine com orientação</h2><ol><li><span>1</span><div><strong>Explore os perfis</strong><small>Compare modalidades e metodologias.</small></div></li><li><span>2</span><div><strong>Confira a verificação</strong><small>O selo indica cadastro analisado pela Fortalfy.</small></div></li><li><span>3</span><div><strong>Solicite um treino</strong><small>O contato fica disponível nos perfis aprovados.</small></div></li></ol></section><section className="nutritionist-join-card"><span className="nutritionist-join-icon"><Dumbbell size={19} /></span><h2>É personal trainer?</h2><p>Complete seu cadastro profissional para análise e publicação do perfil.</p><Link to="/professional">Acessar cadastro profissional <ArrowRight size={15} /></Link></section><section className="nutritionist-privacy-card"><Clock3 size={17} /><p>Agenda, modalidades e valores aparecem somente quando informados pelo profissional aprovado.</p></section></aside>
    </div>
    <DemoPersonalDialog person={selectedDemo} onClose={() => setSelectedDemo(null)} />
  </div>;
}
