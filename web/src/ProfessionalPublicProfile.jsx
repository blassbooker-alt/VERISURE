import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BadgeCheck, CalendarDays, Clock3, Dumbbell, Apple, Globe2, Heart, MapPin, MessageCircle, Share2, ShieldCheck, Star, UserRound } from "lucide-react";
import { getErrorMessage } from "./socialService.js";
import { loadApprovedPartnerProfile } from "./partnerService.js";

const KIND_LABELS = { personal: "Personal trainer", nutricionista: "Nutricionista" };
const FAVORITES_KEY = "fortalfy.professional-profile-favorites.v1";

function sectionValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function ProfessionalProfileContent({ partner }) {
  const [favorite, setFavorite] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  useEffect(() => {
    try {
      const favorites = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
      setFavorite(Array.isArray(favorites) && favorites.includes(partner.profileId));
    } catch { setFavorite(false); }
  }, [partner.profileId]);
  const toggleFavorite = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
      const favorites = Array.isArray(saved) ? saved : [];
      const next = favorite ? favorites.filter(id => id !== partner.profileId) : [...new Set([...favorites, partner.profileId])];
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      setFavorite(!favorite);
    } catch { setShareMessage("Não foi possível salvar o favorito neste aparelho."); }
  };
  const shareProfile = async () => {
    const shareData = { title: `Perfil de ${partner.name} · Fortalfy`, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(shareData.url); setShareMessage("Link do perfil copiado."); }
    } catch (failure) {
      if (failure?.name !== "AbortError") setShareMessage("Não foi possível compartilhar o perfil neste navegador.");
    }
  };
  const isNutritionist = partner.kind === "nutricionista";
  const backPath = isNutritionist ? "/partner/nutritionist" : "/partner/personal";
  const specialties = [...new Set((partner.modalities || []).map(value => value.trim()).filter(Boolean))];
  const hours = Object.entries(partner.openingHours || {}).filter(([, value]) => typeof value === "string" && value.trim());
  const TypeIcon = isNutritionist ? Apple : Dumbbell;

  return <div className="pro-public-profile">
    <nav className="pro-profile-topbar" aria-label="Navegação do perfil"><Link to={backPath}><ArrowLeft size={17}/> Voltar à busca</Link><span>PERFIL PROFISSIONAL</span></nav>
    <header className="pro-profile-hero">
      <div className="pro-profile-avatar">{partner.avatar ? <img src={partner.avatar} alt={`Foto de ${partner.name}`} /> : <span><UserRound size={38}/></span>}</div>
      <div className="pro-profile-identity"><span className="pro-profile-type"><TypeIcon size={15}/>{KIND_LABELS[partner.kind] || "Parceiro Fortalfy"}</span><h1>{partner.name}</h1><p>{partner.city ? <><MapPin size={16}/>{partner.city}</> : "Localização não informada"}</p><span className="pro-profile-approved"><BadgeCheck size={16}/> Cadastro aprovado pela Fortalfy</span></div>
      <div className="pro-profile-actions"><Link className="button primary" to={`/hire/${isNutritionist ? "nutritionist" : "personal"}?partner=${encodeURIComponent(partner.profileId)}`}><CalendarDays size={17}/> Solicitar atendimento</Link><Link className="button subtle" to={`/messages?to=${encodeURIComponent(partner.profileId)}`}><MessageCircle size={17}/> Enviar mensagem</Link><div className="pro-profile-secondary-actions"><button type="button" className="button subtle" aria-pressed={favorite} onClick={toggleFavorite}><Heart size={16} fill={favorite ? "currentColor" : "none"}/>{favorite ? "Salvo neste aparelho" : "Salvar perfil"}</button><button type="button" className="button subtle" onClick={shareProfile}><Share2 size={16}/> Compartilhar</button></div>{shareMessage && <small className="pro-profile-feedback" role="status">{shareMessage}</small>}</div>
    </header>
    <div className="pro-profile-grid">
      <div className="pro-profile-main">
        <section className="pro-profile-section"><span className="pro-profile-kicker">APRESENTAÇÃO</span><h2>Sobre {partner.name.split(" ")[0]}</h2><p>{sectionValue(partner.bio) || "Este profissional ainda não adicionou uma apresentação pública."}</p></section>
        <section className="pro-profile-section"><span className="pro-profile-kicker">ÁREAS DE ATUAÇÃO</span><h2>Serviços e modalidades</h2>{specialties.length ? <ul className="pro-profile-specialties">{specialties.map(item => <li key={item}><ShieldCheck size={16}/>{item}</li>)}</ul> : <p>Modalidades ainda não informadas pelo profissional.</p>}</section>
        <section className="pro-profile-section"><span className="pro-profile-kicker">FORMAÇÃO E EXPERIÊNCIA</span><h2>{isNutritionist ? "Credenciais profissionais" : "Formação profissional"}</h2><p>Formação, registro profissional e experiência detalhada ainda não estão disponíveis neste perfil público.</p></section>
        <section className="pro-profile-section"><span className="pro-profile-kicker">AVALIAÇÕES</span><h2><Star size={19}/> Opiniões de clientes</h2><p>A Fortalfy ainda não tem avaliações verificadas disponíveis para este perfil.</p></section>
        <section className="pro-profile-section"><span className="pro-profile-kicker">PORTFÓLIO</span><h2>Galeria e conteúdos</h2><p>Este profissional ainda não publicou fotos, vídeos ou conteúdos educativos neste perfil.</p></section>
        <section className="pro-profile-section"><span className="pro-profile-kicker">ACOMPANHAMENTO</span><h2>Metodologia</h2><p>A metodologia de atendimento ainda não foi cadastrada publicamente.</p></section>
        <section className="pro-profile-section pro-profile-limits"><ShieldCheck size={18}/><p>O selo confirma a aprovação do cadastro profissional pela equipe Fortalfy. Ele não representa avaliação de qualidade clínica nem garante horários disponíveis.</p></section>
      </div>
      <aside className="pro-profile-aside">
        <section className="pro-profile-info-card"><h2>Informações</h2><div className="pro-profile-fact"><MapPin size={17}/><span><strong>Localidade</strong><small>{partner.city || "Não informada"}</small><small className="pro-profile-private-note">O endereço completo não é exibido neste perfil.</small></span></div>{hours.length > 0 && <div className="pro-profile-fact"><Clock3 size={17}/><span><strong>Horários informados</strong>{hours.slice(0, 4).map(([day, value]) => <small key={day}>{day}: {value}</small>)}</span></div>}{partner.websiteUrl && <div className="pro-profile-fact"><Globe2 size={17}/><span><strong>Site</strong><a href={partner.websiteUrl} target="_blank" rel="noreferrer">Visitar site <ArrowRight size={13}/></a></span></div>}</section>
        <section className="pro-profile-booking-card"><CalendarDays size={20}/><h2>Solicitar atendimento</h2><p>Escolha uma data e modalidade de preferência. Esta solicitação não confirma disponibilidade; aguarde a resposta do profissional.</p><Link className="button primary wide-button" to={`/hire/${isNutritionist ? "nutritionist" : "personal"}?partner=${encodeURIComponent(partner.profileId)}`}>Enviar solicitação</Link></section>
      </aside>
    </div>
  </div>;
}

export default function ProfessionalPublicProfile({ client, kind }) {
  const { profileId } = useParams();
  const [partner, setPartner] = useState(null);
  const [state, setState] = useState("loading");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setState("loading");
    loadApprovedPartnerProfile(client, profileId, { kind }).then(result => {
      if (active) { setPartner(result); setState(result ? "ready" : "notFound"); }
    }).catch(failure => {
      if (active) { setError(getErrorMessage(failure, "Não foi possível carregar este perfil.")); setState("error"); }
    });
    return () => { active = false; };
  }, [client, profileId, kind]);
  const directoryPath = kind === "nutricionista" ? "/partner/nutritionist" : "/partner/personal";
  if (state === "notFound") return <section className="pro-profile-state"><ShieldCheck size={22}/><h2>Perfil profissional indisponível</h2><p>Este perfil pode estar privado, não aprovado ou não pertencer a esta categoria.</p><Link to={directoryPath} className="button subtle">Voltar à busca</Link></section>;
  if (state === "error") return <section className="pro-profile-state" role="alert"><ShieldCheck size={22}/><h2>Perfil temporariamente indisponível</h2><p>{error}</p><Link to={directoryPath} className="button subtle">Voltar à busca</Link></section>;
  if (state !== "ready") return <section className="pro-profile-state" role="status">Carregando perfil profissional…</section>;
  return <ProfessionalProfileContent partner={partner}/>;
}
