import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BadgeCheck, CalendarDays, Clock3, Dumbbell, Apple, Globe2, MapPin, MessageCircle, ShieldCheck, UserRound } from "lucide-react";
import { getErrorMessage } from "./socialService.js";
import { loadApprovedPartnerProfile } from "./partnerService.js";

const KIND_LABELS = { personal: "Personal trainer", nutricionista: "Nutricionista", academia: "Academia" };

function sectionValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function ProfessionalProfileContent({ partner }) {
  const isProfessional = partner.kind === "personal" || partner.kind === "nutricionista";
  const specialties = [...new Set((partner.modalities || []).map(value => value.trim()).filter(Boolean))];
  const hours = Object.entries(partner.openingHours || {}).filter(([, value]) => typeof value === "string" && value.trim());
  const TypeIcon = partner.kind === "nutricionista" ? Apple : Dumbbell;

  return <div className="pro-public-profile">
    <nav className="pro-profile-topbar" aria-label="Navegação do perfil"><Link to={partner.kind === "personal" ? "/partner/personal" : partner.kind === "nutricionista" ? "/partner/nutritionist" : "/pass"}><ArrowLeft size={17}/> Voltar à busca</Link><span>PERFIL PROFISSIONAL</span></nav>
    <header className="pro-profile-hero">
      <div className="pro-profile-avatar">{partner.avatar ? <img src={partner.avatar} alt={`Foto de ${partner.name}`} /> : <span><UserRound size={38}/></span>}</div>
      <div className="pro-profile-identity"><span className="pro-profile-type"><TypeIcon size={15}/>{KIND_LABELS[partner.kind] || "Parceiro Fortalfy"}</span><h1>{partner.name}</h1><p>{partner.city ? <><MapPin size={16}/>{partner.city}</> : "Localização não informada"}</p><span className="pro-profile-approved"><BadgeCheck size={16}/> Cadastro aprovado pela Fortalfy</span></div>
      <div className="pro-profile-actions">{isProfessional && <Link className="button primary" to={`/hire/${partner.kind === "personal" ? "personal" : "nutritionist"}?partner=${encodeURIComponent(partner.profileId)}`}><CalendarDays size={17}/> Solicitar atendimento</Link>}<Link className="button subtle" to={`/messages?to=${encodeURIComponent(partner.profileId)}`}><MessageCircle size={17}/> Enviar mensagem</Link></div>
    </header>
    <div className="pro-profile-grid">
      <div className="pro-profile-main">
        <section className="pro-profile-section"><span className="pro-profile-kicker">APRESENTAÇÃO</span><h2>Sobre {partner.name.split(" ")[0]}</h2><p>{sectionValue(partner.bio) || "Este profissional ainda não adicionou uma apresentação pública."}</p></section>
        <section className="pro-profile-section"><span className="pro-profile-kicker">ÁREAS DE ATUAÇÃO</span><h2>Serviços e modalidades</h2>{specialties.length ? <ul className="pro-profile-specialties">{specialties.map(item => <li key={item}><ShieldCheck size={16}/>{item}</li>)}</ul> : <p>Modalidades ainda não informadas pelo profissional.</p>}</section>
        <section className="pro-profile-section pro-profile-limits"><ShieldCheck size={18}/><p>O selo confirma a aprovação do cadastro profissional pela equipe Fortalfy. Ele não representa avaliação de qualidade clínica nem garante horários disponíveis.</p></section>
      </div>
      <aside className="pro-profile-aside">
        <section className="pro-profile-info-card"><h2>Informações</h2><div className="pro-profile-fact"><MapPin size={17}/><span><strong>Localidade</strong><small>{partner.city || "Não informada"}</small><small className="pro-profile-private-note">O endereço completo não é exibido neste perfil.</small></span></div>{hours.length > 0 && <div className="pro-profile-fact"><Clock3 size={17}/><span><strong>Horários informados</strong>{hours.slice(0, 4).map(([day, value]) => <small key={day}>{day}: {value}</small>)}</span></div>}{partner.websiteUrl && <div className="pro-profile-fact"><Globe2 size={17}/><span><strong>Site</strong><a href={partner.websiteUrl} target="_blank" rel="noreferrer">Visitar site <ArrowRight size={13}/></a></span></div>}</section>
        <section className="pro-profile-booking-card"><CalendarDays size={20}/><h2>{isProfessional ? "Quer conhecer o atendimento?" : "Fale com este parceiro"}</h2><p>{isProfessional ? "Envie uma solicitação com sua data e modalidade preferidas. O horário só fica confirmado depois da resposta do profissional." : "Converse diretamente pela Fortalfy para tirar dúvidas."}</p>{isProfessional ? <Link className="button primary wide-button" to={`/hire/${partner.kind === "personal" ? "personal" : "nutritionist"}?partner=${encodeURIComponent(partner.profileId)}`}>Solicitar atendimento</Link> : <Link className="button primary wide-button" to={`/messages?to=${encodeURIComponent(partner.profileId)}`}>Enviar mensagem</Link>}</section>
      </aside>
    </div>
  </div>;
}

export default function ProfessionalPublicProfile({ client, fallback }) {
  const { profileId } = useParams();
  const [partner, setPartner] = useState(null);
  const [state, setState] = useState("loading");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setState("loading");
    loadApprovedPartnerProfile(client, profileId).then(result => {
      if (active) { setPartner(result); setState(result ? "ready" : "fallback"); }
    }).catch(failure => {
      if (active) { setError(getErrorMessage(failure, "Não foi possível carregar este perfil.")); setState("error"); }
    });
    return () => { active = false; };
  }, [client, profileId]);
  if (state === "fallback") return fallback;
  if (state === "error") return <section className="pro-profile-state" role="alert"><ShieldCheck size={22}/><h2>Perfil temporariamente indisponível</h2><p>{error}</p><Link to="/people" className="button subtle">Voltar para pessoas</Link></section>;
  if (state !== "ready") return <section className="pro-profile-state" role="status">Carregando perfil profissional…</section>;
  return <ProfessionalProfileContent partner={partner}/>;
}
