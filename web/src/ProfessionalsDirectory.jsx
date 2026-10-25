import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Apple, ArrowRight, BadgeCheck, Building2, Calendar, Dumbbell, LoaderCircle,
  MapPin, Search, Sparkles, UserMinus, UserPlus, Users,
} from "lucide-react";
import { cancelFollowRequest, getErrorMessage, isDemoUser, loadFollowStates, setFollow as persistFollow } from "./socialService.js";
import { loadApprovedPartners } from "./partnerService.js";
import { loadPublicProfessionalDirectory } from "./professionalService.js";

const KINDS = [
  { id: "nutricionista", label: "Nutricionistas", icon: Apple },
  { id: "personal", label: "Personal trainers", icon: Dumbbell },
  { id: "academia", label: "Academias", icon: Building2 },
];

function KindLabel({ kind }) {
  return KINDS.find(item => item.id === kind)?.label || "Profissional Fortalfy";
}

export default function ProfessionalsDirectory({ client, session, configured, notify }) {
  const userId = session?.user?.id || "";
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [kind, setKind] = useState("");
  const [sort, setSort] = useState("recent");
  const [professionals, setProfessionals] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [bookingIds, setBookingIds] = useState([]);
  const [followStates, setFollowStates] = useState({});
  const [followBusyId, setFollowBusyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    loadApprovedPartners(client).then(partners => {
      if (active) setBookingIds(partners.map(partner => partner.profileId));
    }).catch(failure => {
      console.warn("Não foi possível carregar os links de agendamento dos parceiros.", failure);
    });
    return () => { active = false; };
  }, [client]);

  useEffect(() => {
    if (!client || !configured) {
      setProfessionals([]);
      setTotal(0);
      setHasMore(false);
      setLoading(false);
      return undefined;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const result = await loadPublicProfessionalDirectory(client, { limit: 24, kind, search, city });
        if (!active) return;
        setProfessionals(result.professionals);
        setTotal(result.total);
        setHasMore(result.hasMore);
        if (userId && result.professionals.length && !isDemoUser(userId)) {
          try {
            setFollowStates(await loadFollowStates(client, userId, result.professionals.map(person => person.id)));
          } catch (failure) {
            console.warn("Não foi possível carregar os seguimentos dos profissionais.", failure);
          }
        } else {
          setFollowStates({});
        }
      } catch (failure) {
        if (!active) return;
        console.error("Falha ao carregar o diretório de profissionais.", failure);
        setError(getErrorMessage(failure, "Não foi possível carregar os profissionais."));
      } finally {
        if (active) setLoading(false);
      }
    }, 220);
    return () => { active = false; window.clearTimeout(timer); };
  }, [client, configured, userId, kind, search, city]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const result = await loadPublicProfessionalDirectory(client, {
        limit: 24, offset: professionals.length, kind, search, city,
      });
      setProfessionals(current => [...current, ...result.professionals]);
      setHasMore(result.hasMore);
      if (userId && !isDemoUser(userId) && result.professionals.length) {
        const states = await loadFollowStates(client, userId, result.professionals.map(person => person.id));
        setFollowStates(current => ({ ...current, ...states }));
      }
    } catch (failure) {
      notify?.(getErrorMessage(failure, "Não foi possível carregar mais profissionais."));
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleFollow = async person => {
    if (!userId || isDemoUser(userId) || userId === person.id || followBusyId) return;
    const current = followStates[person.id] || { isFollowing: false, requestStatus: "" };
    setFollowBusyId(person.id);
    try {
      let result;
      if (current.requestStatus === "pending") {
        await cancelFollowRequest(client, userId, person.id);
        result = "not-following";
      } else {
        result = await persistFollow(client, userId, person.id, !current.isFollowing, person.isPrivate);
      }
      setFollowStates(states => ({ ...states, [person.id]: {
        isFollowing: result === "following",
        requestStatus: result === "requested" ? "pending" : "",
      } }));
      window.dispatchEvent(new CustomEvent("fortalfy:follow-state", { detail: {
        followerId: userId, followedId: person.id, isFollowing: result === "following",
        requestStatus: result === "requested" ? "pending" : "",
      } }));
      notify?.(result === "requested" ? "Solicitação de seguimento enviada."
        : result === "following" ? "Você começou a seguir este perfil." : "Você deixou de seguir este perfil.");
    } catch (failure) {
      notify?.(getErrorMessage(failure, "Não foi possível atualizar o seguimento."));
    } finally {
      setFollowBusyId("");
    }
  };

  const displayedProfessionals = useMemo(() => [...professionals].sort((first, second) => sort === "name"
    ? first.name.localeCompare(second.name, "pt-BR")
    : new Date(second.updatedAt || 0) - new Date(first.updatedAt || 0)), [professionals, sort]);
  const counts = Object.fromEntries(KINDS.map(item => [item.id, professionals.filter(person => person.kind === item.id).length]));
  const resetFilters = () => { setSearch(""); setCity(""); setKind(""); setSort("recent"); };

  return <section className="professional-directory" aria-label="Diretório de profissionais">
    <header className="professional-directory-heading">
      <div><span className="eyebrow">CONECTE-SE COM ESPECIALISTAS</span><h2>Encontre seu profissional</h2><p>Profissionais aprovados para ajudar você a evoluir.</p></div>
      <Users size={29} aria-hidden="true" />
    </header>

    <label className="professional-directory-search"><Search size={17} /><span className="sr-only">Buscar profissionais</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Pesquise por nome, especialidade ou cidade..." type="search" autoComplete="off" /></label>

    <div className="professional-directory-tabs" role="group" aria-label="Filtrar por especialidade">
      <button type="button" className={!kind ? "active" : ""} aria-pressed={!kind} onClick={() => setKind("")}>Todos</button>
      {KINDS.map(item => <button type="button" key={item.id} className={kind === item.id ? "active" : ""} aria-pressed={kind === item.id} onClick={() => setKind(kind === item.id ? "" : item.id)}>{item.label}</button>)}
    </div>

    <div className="professional-directory-layout">
      <aside className="professional-directory-filters" aria-label="Filtros">
        <header><h3>Filtros</h3><button type="button" onClick={resetFilters}>Limpar filtros</button></header>
        <fieldset><legend>Tipo de profissional</legend>{KINDS.map(item => <label key={item.id}><input type="checkbox" checked={!kind || kind === item.id} onChange={() => setKind(kind === item.id ? "" : item.id)} /><span>{item.label}</span></label>)}</fieldset>
        <label className="professional-directory-city">Cidade ou região<input value={city} onChange={event => setCity(event.target.value)} placeholder="Digite sua cidade..." /></label>
        <label className="professional-directory-sort">Ordenar por<select value={sort} onChange={event => setSort(event.target.value)}><option value="recent">Mais recentes</option><option value="name">Nome A–Z</option></select></label>
        <p className="professional-directory-disclosure"><BadgeCheck size={14} /> Só aparecem profissionais aprovados pela equipe Fortalfy.</p>
      </aside>

      <main className="professional-directory-results" aria-live="polite">
        <header><div><h3>{loading ? "Buscando profissionais..." : `${total} profissionais encontrados`}</h3><p>Perfis profissionais aprovados pela Fortalfy</p></div><label>Ordenação<select value={sort} onChange={event => setSort(event.target.value)}><option value="recent">Mais recentes</option><option value="name">Nome A–Z</option></select></label></header>
        {error && <p className="social-inline-error" role="alert">{error}</p>}
        {loading && !professionals.length && <p className="social-inline-status"><LoaderCircle className="spin" size={17} /> Carregando profissionais aprovados...</p>}
        {!loading && !error && !professionals.length && <div className="professional-directory-empty"><Users size={25} /><h3>Nenhum profissional aprovado encontrado</h3><p>Tente outra busca ou especialidade. Os perfis aparecem aqui após a aprovação do cadastro.</p></div>}
        {displayedProfessionals.map(person => {
          const follow = followStates[person.id] || { isFollowing: false, requestStatus: "" };
          const canBook = bookingIds.includes(person.id) && ["personal", "nutricionista"].includes(person.kind);
          const Icon = KINDS.find(item => item.id === person.kind)?.icon || Users;
          return <article className="professional-result-card" key={person.applicationId}>
            <Link className="professional-result-avatar" to={`/profile/${person.id}`} aria-label={`Ver perfil de ${person.name}`}>{person.avatar ? <img src={person.avatar} alt="" loading="lazy" /> : <span>{person.name.slice(0, 1).toUpperCase()}</span>}<small><i /> Aprovado</small></Link>
            <div className="professional-result-info"><div className="professional-result-title"><h4>{person.name}</h4><BadgeCheck size={15} aria-label="Cadastro profissional aprovado" /></div><span className="professional-result-kind"><Icon size={13} /> <KindLabel kind={person.kind} />{person.username ? ` · @${person.username}` : ""}</span>{person.city && <span className="professional-result-city"><MapPin size={13} /> {person.city}</span>}{person.description && <p>{person.description}</p>}</div>
            <div className="professional-result-actions">
              {userId !== person.id && !isDemoUser(userId) && <button type="button" className={`professional-follow-button${follow.isFollowing ? " is-following" : ""}`} onClick={() => toggleFollow(person)} disabled={followBusyId === person.id}>{follow.requestStatus === "pending" ? "Solicitado" : follow.isFollowing ? <><UserMinus size={14} /> Seguindo</> : <><UserPlus size={14} /> Seguir</>}</button>}
              {canBook && <Link className="professional-book-button" to={`/hire/${person.kind === "personal" ? "personal" : "nutritionist"}?partner=${encodeURIComponent(person.id)}`}><Calendar size={14} /> Agendar consulta</Link>}
              <Link className="professional-profile-button" to={`/profile/${person.id}`}>Ver perfil <ArrowRight size={14} /></Link>
            </div>
          </article>;
        })}
        {hasMore && <button className="professional-load-more" type="button" onClick={loadMore} disabled={loadingMore}>{loadingMore ? "Carregando..." : "Carregar mais profissionais"}</button>}
      </main>

      <aside className="professional-directory-rail">
        <section><header><h3>Profissionais recomendados</h3><button type="button" onClick={resetFilters}>Ver todos <ArrowRight size={12} /></button></header>
          {displayedProfessionals.slice(0, 3).map(person => <Link className="professional-mini-card" key={person.applicationId} to={`/profile/${person.id}`}><span>{person.avatar ? <img src={person.avatar} alt="" loading="lazy" /> : person.name.slice(0, 1).toUpperCase()}</span><span><strong>{person.name}</strong><small>{KindLabel({ kind: person.kind })}</small></span><BadgeCheck size={13} aria-label="Aprovado" /></Link>)}
          {!displayedProfessionals.length && <p className="professional-rail-empty">Os profissionais aprovados aparecerão aqui.</p>}
        </section>
        <section className="professional-category-rail"><h3>Categorias para explorar</h3><div>{KINDS.map(item => { const Icon = item.icon; return <button type="button" key={item.id} onClick={() => setKind(item.id)}><Icon size={16} /><span>{item.label}<small>{counts[item.id] || 0} carregados nesta busca</small></span></button>; })}</div></section>
        <section className="professional-join-rail"><Sparkles size={21} /><h3>É profissional?</h3><p>Cadastre seu perfil para fazer parte da rede Fortalfy.</p><Link to="/professional">Cadastrar perfil <ArrowRight size={14} /></Link></section>
      </aside>
    </div>
  </section>;
}
