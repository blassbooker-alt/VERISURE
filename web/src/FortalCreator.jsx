import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, BookOpen, Camera, Clapperboard, GraduationCap, HeartHandshake, LockKeyhole, Radio, Sparkles, Users } from "lucide-react";
import { loadProfessionalApplications, professionalStatusLabel } from "./professionalService.js";
import Brand from "./Brand.jsx";
import { brandCampaignAsset, publicAsset } from "./assetPath.js";
import CreatorGallery from "./CreatorGallery.jsx";
import SponsoredCreative from "./SponsoredCreative.jsx";
import {
  applyToCreatorCampaign, authorizeCreatorInstructor, cancelCreatorLive, createCreatorCampaign, createCreatorCourse,
  createCreatorCourseLesson, createCreatorLive, enrollFreeCreatorCourse,
  loadCreatorCampaigns, loadCreatorCourses, loadCreatorInstructorAuthorization,
  loadCreatorLiveOrders, loadCreatorLiveRegistrations, loadCreatorLives, loadCreatorMetrics, loadMyCreatorCampaignApplications, loadMyCreatorLearning,
  loadMyCreatorLiveRegistrations, publishCreatorCourse, publishCreatorLive, registerCreatorLive,
  reviewCreatorCampaignApplication, updateCreatorLive,
} from "./creatorProgramService.js";

const sections = ["Visão geral", "Minha evolução", "Níveis e benefícios", "Academia", "Lives", "Campanhas e collabs", "Meu perfil", "Minha candidatura"];
const levels = [
  { name: "Start", color: "start", criteria: "Acessos válidos e primeiros usuários ativados pelo link pessoal.", perks: "Conteúdos de orientação e possibilidade de participar de oportunidades abertas." },
  { name: "Pro", color: "pro", criteria: "Crescimento consistente, usuários ativados e audiência real na Fortalfy.", perks: "Possibilidade de seleção para collabs, unboxing e campanhas compatíveis." },
  { name: "Oficial", color: "official", criteria: "Desempenho sustentado, qualidade e regularidade de conteúdo.", perks: "Possibilidade de campanhas oficiais conforme seleção e disponibilidade." },
];
const creatorPillars = [
  { image: "fortalfy_gym_09_motivacao.jpg", icon: Clapperboard, title: "Crie conteúdo", description: "Transforme suas ideias em vídeos, fotos e histórias com a sua identidade." },
  { image: "fortalfy_gym_11_superiores.jpg", icon: GraduationCap, title: "Aprenda novas habilidades", description: "Desenvolva repertório para criar, editar e comunicar com mais confiança." },
  { image: "fortalfy_gym_20_manifesto.jpg", icon: HeartHandshake, title: "Conecte-se com uma comunidade", description: "Troque experiências com pessoas que também estão construindo sua jornada." },
];
const creatorAudiences = [
  { image: "fortalfy_gym_04_forca.jpg", title: "Quem está começando", description: "Dê forma às primeiras ideias e descubra seu jeito de criar." },
  { image: "fortalfy_gym_14_hiit.jpg", title: "Quem já compartilha", description: "Dê consistência a vídeos e fotografias que já fazem parte da sua rotina." },
  { image: "fortalfy_gym_19_constancia.jpg", title: "Quem fortalece sua marca", description: "Amplie sua presença digital e desenvolva competências profissionais." },
];
const creatorSteps = [
  { title: "Crie seu perfil", description: "Apresente quem você é e o tipo de conteúdo que deseja desenvolver." },
  { title: "Produza e publique", description: "Compartilhe conteúdos autorais nas redes em que você já está presente." },
  { title: "Aprenda e evolua", description: "Aprimore habilidades e troque experiências com a comunidade." },
  { title: "Explore colaborações", description: "Acompanhe oportunidades compatíveis com seu perfil e sua jornada." },
];
export default function FortalCreator({ session, client, notify }) {
  const [section, setSection] = useState("Visão geral");
  const [application, setApplication] = useState(null);
  const [applicationLoading, setApplicationLoading] = useState(false);
  const [applicationError, setApplicationError] = useState("");
  const [programData, setProgramData] = useState({ courses: [], enrollments: [], orders: [], lives: [], registrations: [], campaigns: [], campaignApplications: [], metrics: null, instructor: false });
  const [programLoading, setProgramLoading] = useState(false);
  const [programError, setProgramError] = useState("");
  const [programMessage, setProgramMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [courseForm, setCourseForm] = useState({ title: "", summary: "", price: "0" });
  const [lessonForms, setLessonForms] = useState({});
  const isAdmin = session?.user?.app_metadata?.role === "admin";
  const userId = session?.user?.id || "";

  useEffect(() => {
    if (!["Minha evolução", "Academia", "Lives", "Campanhas e collabs"].includes(section)) return undefined;
    if (!client) { setProgramError("Configure o Supabase para carregar dados reais do programa."); return undefined; }
    let active = true;
    setProgramLoading(true);
    setProgramError("");
    setProgramMessage("");
    const task = async () => {
      if (section === "Academia") {
        const [courses, learning, instructor] = await Promise.all([
          loadCreatorCourses(client, userId, isAdmin), loadMyCreatorLearning(client, userId),
          isAdmin ? Promise.resolve(true) : loadCreatorInstructorAuthorization(client, userId),
        ]);
        return { courses, enrollments: learning.enrollments, orders: learning.orders, instructor };
      }
      if (section === "Lives") {
        const [lives, myRegistrations, instructor] = await Promise.all([loadCreatorLives(client, userId, isAdmin), loadMyCreatorLiveRegistrations(client, userId), isAdmin ? Promise.resolve(true) : loadCreatorInstructorAuthorization(client, userId)]);
        const [hostedRegistrations, liveOrders] = lives.length ? await Promise.all([loadCreatorLiveRegistrations(client, lives.map(live => live.id)), loadCreatorLiveOrders(client, lives.map(live => live.id))]) : [[], []];
        const registrations = [...new Map([...myRegistrations, ...hostedRegistrations].map(item => [item.id, item])).values()];
        return { lives, registrations, liveOrders, instructor };
      }
      if (section === "Campanhas e collabs") {
        const [campaigns, campaignApplications] = await Promise.all([loadCreatorCampaigns(client), loadMyCreatorCampaignApplications(client, userId, isAdmin)]);
        return { campaigns, campaignApplications };
      }
      return { metrics: await loadCreatorMetrics(client, userId) };
    };
    task().then(result => { if (active) setProgramData(current => ({ ...current, ...result })); })
      .catch(error => { if (active) setProgramError(error.message || "Não foi possível carregar os dados FortalCreator."); })
      .finally(() => { if (active) setProgramLoading(false); });
    return () => { active = false; };
  }, [client, isAdmin, reloadKey, section, userId]);

  async function runProgramAction(action, successMessage) {
    setProgramError(""); setProgramMessage("");
    try { await action(); setProgramMessage(successMessage); setReloadKey(value => value + 1); notify?.(successMessage); }
    catch (error) { setProgramError(error.message || "Não foi possível concluir esta ação."); }
  }

  useEffect(() => {
    if (section !== "Minha candidatura" || !userId || !client) return undefined;
    let active = true;
    setApplicationLoading(true);
    setApplicationError("");
    loadProfessionalApplications(client, userId).then(rows => {
      if (active) setApplication(rows.find(row => row.kind === "influenciador") || null);
    }).catch(error => {
      if (active) setApplicationError(error.message || "Não foi possível carregar sua candidatura.");
    }).finally(() => { if (active) setApplicationLoading(false); });
    return () => { active = false; };
  }, [client, section, userId]);

  return <div className="creator-page">
    <header className="creator-hero" id="creator-top"><picture><source media="(max-width: 760px)" srcSet={publicAsset("creator/06_torne_se_um_fortalcreator.jpg")}/><img className="creator-hero-photo" src={brandCampaignAsset("fortalfy_gym_20_manifesto.jpg")} alt="" aria-hidden="true" fetchpriority="high"/></picture><div className="creator-hero-content"><span className="creator-hero-kicker">PROGRAMA DE CRIADORES FORTALFY</span><h2>Sua criatividade pode abrir novos caminhos.</h2><p>Faça parte do FortalCreator e desenvolva sua presença digital com conteúdo, aprendizado e comunidade.</p><div className="creator-hero-actions"><button type="button" className="button primary" onClick={() => { setSection("Minha candidatura"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Quero ser FortalCreator <ArrowRight size={16}/></button><button type="button" className="creator-hero-secondary" onClick={() => { setSection("Visão geral"); window.setTimeout(() => scrollToCreatorSection("creator-about"), 0); }}>Conhecer o programa</button></div></div><div className="creator-hero-image-note"><img src={brandCampaignAsset("fortalfy_gym_13_acessorios.jpg")} alt="" aria-hidden="true"/><span><strong>Ideias que ganham espaço</strong><small>Uma jornada de criação e aprendizado</small></span></div><span className="creator-hero-icon" aria-hidden="true"><Clapperboard size={34}/></span></header>
    <nav className="creator-tabs" aria-label="Seções FortalCreator">{sections.map(item => <button key={item} type="button" className={section === item ? "selected" : ""} aria-current={section === item ? "page" : undefined} onClick={() => setSection(item)}>{item}</button>)}</nav>

    {section === "Minha candidatura" && <section className="creator-card creator-application"><span className="eyebrow">CANDIDATURA OFICIAL</span><h2>Inscrição e acompanhamento</h2>
      <p>A candidatura usa o fluxo profissional existente da Fortalfy, com rascunho no Supabase, revisão administrativa e documentos em armazenamento privado.</p>
      {applicationLoading && <p role="status">Carregando estado da candidatura…</p>}
      {applicationError && <p className="creator-error" role="alert">{applicationError}</p>}
      {!client && <p className="creator-error" role="alert">O Supabase não está configurado neste ambiente. A candidatura não pode ser salva.</p>}
      {!userId && <p>Entre ou crie uma conta Fortalfy para salvar e acompanhar sua candidatura. O fluxo preserva os dados até você retornar à área de cadastro.</p>}
      {userId && !applicationLoading && !applicationError && <div className="creator-application-state"><strong>{application ? professionalStatusLabel(application.status) : "Nenhuma candidatura de Creator encontrada"}</strong>{application?.submitted_at && <small>Enviada em {new Date(application.submitted_at).toLocaleDateString("pt-BR")}</small>}{application?.reviewer_note && <p>Orientação da equipe: {application.reviewer_note}</p>}</div>}
      <div className="creator-form-actions"><Link className="button primary" to={userId ? "/professional/manage?category=influenciador" : "/profile?professionalKind=influenciador"}>{application ? "Continuar ou acompanhar candidatura" : "Iniciar candidatura segura"} <ArrowRight size={16}/></Link></div>
      <aside className="creator-status"><LockKeyhole size={16}/> Dados pessoais e endereço são tratados pelo cadastro profissional com acesso restrito; documentos são enviados ao bucket privado. O fluxo atual não faz reconhecimento facial automático. A revisão é manual.</aside>
    </section>}

    {section === "Visão geral" && <CreatorLanding onApply={() => { setSection("Minha candidatura"); window.scrollTo({ top: 0, behavior: "smooth" }); }} onAcademy={() => { setSection("Academia"); window.scrollTo({ top: 0, behavior: "smooth" }); }} onLevels={() => setSection("Níveis e benefícios")}/>}
    {section === "Minha evolução" && <section className="creator-card"><Users/><h2>{programData.metrics?.assigned_level ? `Nível ${programData.metrics.assigned_level}` : "Métricas do programa"}</h2>{programLoading && <p role="status">Carregando indicadores…</p>}{programError && <p className="creator-error" role="alert">{programError}</p>}{programData.metrics ? <div className="creator-metric-grid">{[["Acessos válidos",programData.metrics.valid_referral_visits],["Usuários ativados",programData.metrics.activated_users],["Seguidores Fortalfy",programData.metrics.fortalfy_followers],["Qualidade do conteúdo",programData.metrics.content_quality_score ?? "Pendente"],["Regularidade",programData.metrics.content_regularity_score ?? "Pendente"]].map(([label,value])=><article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div> : !programLoading && !programError && <p>Nenhum snapshot de métricas foi calculado para esta conta. Acessos válidos, ativações, seguidores reais e qualidade/regularidade não serão estimados pelo cliente.</p>}<p>Cursos e lives não alteram o nível.</p></section>}
    {section === "Níveis e benefícios" && <Levels/>}
    {section === "Academia" && <AcademyProgram client={client} profileId={userId} isAdmin={isAdmin} data={programData} loading={programLoading} error={programError} message={programMessage} courseForm={courseForm} setCourseForm={setCourseForm} lessonForms={lessonForms} setLessonForms={setLessonForms} runAction={runProgramAction}/>}
    {section === "Lives" && <LiveProgram client={client} profileId={userId} isAdmin={isAdmin} data={programData} loading={programLoading} error={programError} message={programMessage} runAction={runProgramAction}/>}
    {section === "Campanhas e collabs" && <CampaignProgram client={client} profileId={userId} isAdmin={isAdmin} data={programData} loading={programLoading} error={programError} message={programMessage} runAction={runProgramAction}/>}
    {section === "Meu perfil" && <section className="creator-card"><h2>Perfil de criador</h2><p>Um perfil oficial é disponibilizado depois da aprovação administrativa da candidatura.</p>{session?.user?.email && <small>Conta Fortalfy: {session.user.email}</small>}</section>}
  </div>;
}

function Levels({ titlePrefix = "" }) { return <section className="creator-levels"><h2>Níveis e possibilidades</h2><p>A evolução considera crescimento e qualidade dentro da Fortalfy. Cursos e lives não alteram o nível. Critérios e metas ainda precisam ser configurados pelo programa.</p><div>{levels.map(level => <article className={`creator-card creator-level creator-level-${level.color}`} key={level.name}><span className="creator-level-number">NÍVEL</span><h3>{titlePrefix ? `${titlePrefix} ${level.name}` : level.name}</h3><strong>Critérios considerados</strong><p>{level.criteria}</p><strong>Possibilidades</strong><p>{level.perks}</p></article>)}</div><aside className="creator-status"><BadgeCheck size={16}/> Nível atual e progresso aguardam integração das métricas específicas do Creator.</aside></section>; }

function scrollToCreatorSection(id) { document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); }

function CreatorLanding({ onApply, onAcademy, onLevels }) {
  return <div className="creator-landing">
    <section className="creator-landing-section creator-about" id="creator-about" aria-labelledby="creator-about-title">
      <div className="creator-section-heading"><span className="eyebrow">CRIATIVIDADE COM PROPÓSITO</span><h2 id="creator-about-title">O que é o FortalCreator?</h2><p>O FortalCreator é um programa para pessoas que desejam criar conteúdo, desenvolver sua presença digital, conectar-se com uma comunidade ativa e evoluir profissionalmente.</p></div>
      <div className="creator-pillar-grid">{creatorPillars.map(({ image, icon: Icon, title, description }) => <article className="creator-pillar-card" key={title}><div className="creator-pillar-photo"><img src={brandCampaignAsset(image)} alt="" loading="lazy" decoding="async"/><span><Icon size={19}/></span></div><div><h3>{title}</h3><p>{description}</p></div></article>)}</div>
    </section>

    <SponsoredCreative image="03-creator-campaign.png" alt="Campanha em destaque do FortalCreator: crie com autenticidade e evolua com consistência." label="Campanha Fortalfy" to="/creator" className="creator-campaign-creative" />
    <section className="creator-landing-section creator-audience" aria-labelledby="creator-audience-title">
      <div className="creator-section-heading"><span className="eyebrow">DIFERENTES CAMINHOS, UMA MESMA VONTADE DE CRIAR</span><h2 id="creator-audience-title">Para quem é?</h2><p>Para pessoas adultas que querem compartilhar ideias e construir uma presença digital com autenticidade.</p></div>
      <div className="creator-audience-grid">{creatorAudiences.map(item => <article className="creator-audience-card" key={item.title}><img src={brandCampaignAsset(item.image)} alt="" loading="lazy" decoding="async"/><div><h3>{item.title}</h3><p>{item.description}</p></div></article>)}</div>
      <div className="creator-interest-list" aria-label="Áreas de interesse"><span>Lifestyle</span><span>Tecnologia</span><span>Moda</span><span>Beleza</span><span>Fitness</span><span>Bem-estar</span><span>Marketing digital</span><span>Edição</span></div>
    </section>

    <section className="creator-landing-section creator-steps-section" aria-labelledby="creator-steps-title">
      <div className="creator-section-heading"><span className="eyebrow">UMA JORNADA POSSÍVEL</span><h2 id="creator-steps-title">Como funciona?</h2><p>Um caminho para aprender, praticar e descobrir novas possibilidades criativas.</p></div>
      <ol className="creator-step-grid">{creatorSteps.map((step, index) => <li className="creator-step-card" key={step.title}><span className="creator-step-number">0{index + 1}</span><div><h3>{step.title}</h3><p>{step.description}</p></div></li>)}</ol>
      <p className="creator-opportunity-note"><LockKeyhole size={15}/> Oportunidades de colaboração dependem dos critérios e da seleção da Fortalfy; participação ou benefícios não são automáticos.</p>
    </section>

    <CreatorGallery onApply={onApply} onLearn={() => scrollToCreatorSection("creator-about")} />

    <section className="creator-academy-feature" aria-labelledby="creator-academy-title"><div className="creator-academy-copy"><span className="eyebrow">ACADEMIA FORTALCREATOR</span><h2 id="creator-academy-title">Aprenda a criar melhor.</h2><p>A Academia foi pensada para apoiar seu desenvolvimento com conteúdos sobre criação de vídeos, edição, marketing digital, engajamento, marca pessoal e publicidade.</p><p className="creator-academy-pricing">A disponibilidade do catálogo depende da configuração do programa. Os cursos podem ser gratuitos em períodos promocionais ou vendidos individualmente; o preço será informado antes da compra.</p><button type="button" className="button primary" onClick={onAcademy}>Conhecer a Academia <ArrowRight size={16}/></button></div><div className="creator-academy-visual"><img src="/assets/creator/03_fortalfy_no_cotidiano.jpg" alt="Criadora estudando e planejando conteúdo em um ambiente iluminado" loading="lazy" decoding="async"/><span><BookOpen size={16}/> Aprendizado no seu ritmo</span></div></section>

    <section className="creator-landing-section creator-landing-levels" aria-labelledby="creator-landing-levels-title"><div className="creator-section-heading"><span className="eyebrow">EVOLUÇÃO COM CONSISTÊNCIA</span><h2 id="creator-landing-levels-title">Desenvolva sua presença.</h2><p>FortalCreator Start, Pro e Oficial representam etapas de participação e desenvolvimento dentro do programa. Os critérios ainda dependem da configuração das métricas.</p></div><Levels titlePrefix="FortalCreator"/><button type="button" className="creator-inline-link" onClick={onLevels}>Ver detalhes dos níveis <ArrowRight size={15}/></button></section>

    <section className="creator-testimonial" aria-labelledby="creator-testimonial-title"><div className="creator-testimonial-image"><img src="/assets/creator/09_mostre_sua_personalidade.jpg" alt="Conteúdo visual da campanha FortalCreator" loading="lazy" decoding="async"/></div><div className="creator-testimonial-copy"><span className="eyebrow">PROGRAMA FORTALCREATOR</span><h2 id="creator-testimonial-title">Crie com autenticidade. Evolua com consistência.</h2><p>O FortalCreator reúne oportunidades de aprendizado, campanhas e colaboração. As candidaturas e participações são avaliadas conforme os critérios e a disponibilidade do programa.</p><button type="button" className="button primary" onClick={onApply}>Conhecer o programa <ArrowRight size={16}/></button></div></section>

    <section className="creator-final-cta" aria-labelledby="creator-final-title"><span className="eyebrow">FORTALCREATOR</span><h2 id="creator-final-title">Seu próximo passo começa aqui.</h2><p>Comece a desenvolver sua criatividade, sua presença digital e suas conexões.</p><button type="button" className="button creator-final-button" onClick={onApply}>Quero fazer parte <ArrowRight size={16}/></button><small>A candidatura passa por análise. A participação depende dos critérios do programa.</small></section>

    <CreatorLandingFooter onAcademy={onAcademy}/>
  </div>;
}

function CreatorLandingFooter({ onAcademy }) {
  return <footer className="creator-landing-footer"><div className="creator-footer-brand"><Link to="/home" aria-label="Fortalfy, página inicial"><Brand/></Link><p>Uma jornada para criar, aprender e evoluir com autenticidade.</p></div><nav aria-label="Links FortalCreator"><Link to="/home">Fortalfy</Link><button type="button" onClick={() => scrollToCreatorSection("creator-top")}>FortalCreator</button><button type="button" onClick={onAcademy}>Academia</button><a href="mailto:fortalfy@gmail.com">Contato</a><Link to="/benefits-terms">Termos e benefícios</Link></nav><p className="creator-footer-availability">Campanhas, collabs, produtos e demais oportunidades dependem de critérios, seleção e disponibilidade da Fortalfy.</p><small>© {new Date().getFullYear()} Fortalfy · Conteúdo demonstrativo identificado quando aplicável.</small></footer>;
}

function ProgramFeedback({ loading, error, message }) { return <>{loading && <p role="status">Carregando FortalCreator…</p>}{error && <p className="creator-error" role="alert">{error} Confira se a migração FORTALFY_CREATOR_PROGRAM_V1.sql foi aplicada.</p>}{message && <p className="creator-feedback" role="status">{message}</p>}</>; }

function AcademyProgram({ client, profileId, isAdmin, data, loading, error, message, courseForm, setCourseForm, lessonForms, setLessonForms, runAction }) {
  const canTeach = Boolean(data.instructor || isAdmin);
  const [teacherId, setTeacherId] = useState("");
  return <section className="creator-card"><BookOpen/><h2>Academia FortalCreator</h2><ProgramFeedback loading={loading} error={error} message={message}/>
    {(canTeach) && <form className="creator-admin-form" onSubmit={event => { event.preventDefault(); runAction(() => createCreatorCourse(client, profileId, { title: courseForm.title, summary: courseForm.summary, priceCents: Math.round(Number(courseForm.price || 0) * 100) }), "Rascunho de curso salvo no servidor."); }}><h3>Criar curso</h3><label>Título<input required minLength={3} maxLength={160} value={courseForm.title} onChange={event => setCourseForm(value => ({ ...value, title: event.target.value }))}/></label><label>Descrição<textarea maxLength={3000} value={courseForm.summary} onChange={event => setCourseForm(value => ({ ...value, summary: event.target.value }))}/></label><label>Preço individual (R$)<input type="number" min="0" step="0.01" value={courseForm.price} onChange={event => setCourseForm(value => ({ ...value, price: event.target.value }))}/></label><button type="submit" className="button primary" disabled={!client}>Salvar curso como rascunho</button><small>Publicar um curso não habilita checkout. Pagamentos dependem de gateway e confirmação segura no servidor.</small></form>}
    {isAdmin && <form className="creator-admin-form" onSubmit={event => { event.preventDefault(); runAction(() => authorizeCreatorInstructor(client, profileId, teacherId.trim()), "Permissão de professor concedida."); setTeacherId(""); }}><h3>Autorizar professor</h3><label>ID da conta Fortalfy<input required value={teacherId} onChange={event => setTeacherId(event.target.value)} placeholder="UUID do perfil"/></label><button type="submit" className="button subtle" disabled={!client}>Autorizar</button></form>}
    <h3>Catálogo</h3>{!loading && !error && !data.courses.length && <p>Nenhum curso publicado.</p>}{data.courses.map(course => { const enrolled = data.enrollments.some(item => item.course_id === course.id && item.status === "active"); const own = course.instructor_id === profileId || isAdmin; return <article className="creator-program-item" key={course.id}><div><span className="eyebrow">{course.status === "draft" ? "RASCUNHO" : "CURSO"} · {course.price_cents === 0 ? "GRATUITO" : `R$ ${(course.price_cents / 100).toFixed(2).replace(".", ",")}`}</span><h3>{course.title}</h3><p>{course.summary || "Descrição ainda não adicionada."}</p><small>Professor: {course.instructor?.display_name || (course.instructor?.username ? `@${course.instructor.username}` : "Perfil não informado")}</small></div>{course.status === "published" && (course.price_cents === 0 ? <button className="button primary" disabled={!client || enrolled || !profileId} onClick={() => runAction(() => enrollFreeCreatorCourse(client, course.id), "Inscrição gratuita confirmada no servidor.")}>{enrolled ? "Inscrito" : "Inscrever-se"}</button> : <button className="button subtle" disabled title="Checkout de cursos ainda não está configurado">Pagamento indisponível</button>)}{own && course.status === "draft" && <div className="creator-admin-form"><label>Título da aula<input value={lessonForms[course.id]?.title || ""} onChange={event => setLessonForms(current => ({ ...current, [course.id]: { ...current[course.id], title: event.target.value } }))}/></label><label>Conteúdo da aula<textarea value={lessonForms[course.id]?.body || ""} onChange={event => setLessonForms(current => ({ ...current, [course.id]: { ...current[course.id], body: event.target.value } }))}/></label><label>Ordem<input type="number" min="0" value={lessonForms[course.id]?.position ?? "0"} onChange={event => setLessonForms(current => ({ ...current, [course.id]: { ...current[course.id], position: event.target.value } }))}/></label><button type="button" className="button subtle" onClick={() => runAction(() => createCreatorCourseLesson(client, course.id, lessonForms[course.id] || {}), "Aula adicionada ao rascunho.")}>Adicionar aula</button><button type="button" className="button primary" onClick={() => runAction(() => publishCreatorCourse(client, course.id), "Curso publicado no catálogo.")}>Publicar curso</button></div>}</article>; })}
    <div className="creator-subsections"><section><h3>Meus cursos</h3>{data.enrollments.length ? data.enrollments.map(item => <p key={item.id}>{data.courses.find(course => course.id === item.course_id)?.title || "Curso inscrito"} · {item.status}</p>) : !error && <p>Nenhuma inscrição.</p>}</section><section><h3>Histórico de compras</h3>{data.orders.length ? data.orders.map(order => <p key={order.id}>R$ {(order.amount_cents / 100).toFixed(2)} · {order.status}</p>) : !error && <p>Nenhuma compra.</p>}</section><section><h3>Próximas lives</h3><Link to="/live" className="text-link">Ver transmissões da Fortalfy <ArrowRight size={15}/></Link></section></div>
    {!canTeach && !error && <p>Criação de cursos disponível somente para professores autorizados pela administração.</p>}
  </section>;
}

const EMPTY_LIVE_FORM = { title: "", description: "", startsAt: "", accessMode: "public", category: "treino", durationMinutes: "60", price: "0", participantLimit: "", coverUrl: "", cancellationPolicy: "", participantInformation: "" };
function LiveProgram({ client, profileId, isAdmin, data, loading, error, message, runAction }) {
  const [form, setForm] = useState(EMPTY_LIVE_FORM);
  const [coverFile, setCoverFile] = useState(null);
  const [editingId, setEditingId] = useState("");
  const canSchedule = Boolean(data.instructor || isAdmin);
  const resetForm = () => { setForm(EMPTY_LIVE_FORM); setCoverFile(null); setEditingId(""); };
  const submitLive = event => {
    event.preventDefault();
    const payload = { ...form, instructorId: profileId, priceCents: Math.round(Number(form.price || 0) * 100), coverFile };
    runAction(async () => {
      if (editingId) await updateCreatorLive(client, editingId, payload);
      else await createCreatorLive(client, profileId, payload);
      resetForm();
    }, editingId ? "Transmissão atualizada." : "Rascunho da transmissão salvo.");
  };
  const editLive = live => {
    const date = new Date(live.starts_at);
    const localStartsAt = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setForm({ title: live.title || "", description: live.description || "", startsAt: localStartsAt, accessMode: live.access_mode || "public", category: live.category || "treino", durationMinutes: String(live.duration_minutes || 60), price: ((live.price_cents || 0) / 100).toFixed(2), participantLimit: live.participant_limit ? String(live.participant_limit) : "", coverUrl: live.cover_url || "", cancellationPolicy: live.cancellation_policy || "", participantInformation: live.participant_information || "" });
    setEditingId(live.id); setCoverFile(null); document.getElementById("fortal-live-organizer")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const statusLabel = { draft: "RASCUNHO", pending_approval: "AGUARDANDO APROVAÇÃO", published: "AGENDADA", live: "AO VIVO · PLAYER NÃO CONFIGURADO", ended: "ENCERRADA", cancelled: "CANCELADA" };
  return <section className="creator-card"><Radio/><h2>Lives FortalCreator</h2><ProgramFeedback loading={loading} error={error} message={message}/><p>Somente professores autorizados e a administração podem organizar transmissões. Capas, agenda e inscrições ficam no Supabase; streaming e checkout dependem de provedores externos.</p>
    {canSchedule && <form id="fortal-live-organizer" className="creator-admin-form" onSubmit={submitLive}><h3>{editingId ? "Editar transmissão" : "Cadastrar transmissão"}</h3><label>Título<input required minLength={3} maxLength={160} value={form.title} onChange={event => setForm(value => ({ ...value, title: event.target.value }))}/></label><label>Descrição<textarea maxLength={3000} value={form.description} onChange={event => setForm(value => ({ ...value, description: event.target.value }))}/></label><label>Categoria<select value={form.category} onChange={event => setForm(value => ({ ...value, category: event.target.value }))}><option value="treino">Treino</option><option value="nutricao">Nutrição</option><option value="emagrecimento">Emagrecimento</option><option value="hipertrofia">Hipertrofia</option><option value="saude_bem_estar">Saúde e bem-estar</option><option value="marketing_fitness">Marketing fitness</option></select></label><label>Data e hora<input required type="datetime-local" value={form.startsAt} onChange={event => setForm(value => ({ ...value, startsAt: event.target.value }))}/></label><label>Duração prevista (minutos)<input required type="number" min="5" max="480" value={form.durationMinutes} onChange={event => setForm(value => ({ ...value, durationMinutes: event.target.value }))}/></label><label>Limite de participantes (opcional)<input type="number" min="1" max="100000" value={form.participantLimit} onChange={event => setForm(value => ({ ...value, participantLimit: event.target.value }))}/></label><label>Preço da inscrição (R$)<input type="number" min="0" step="0.01" value={form.price} onChange={event => setForm(value => ({ ...value, price: event.target.value }))}/><small>Lives pagas serão listadas com o preço, mas a compra fica bloqueada até a integração segura do provedor.</small></label><label>Quem pode participar<select value={form.accessMode} onChange={event => setForm(value => ({ ...value, accessMode: event.target.value }))}><option value="public">Público autenticado</option><option value="approved_creator">Criadores aprovados</option></select></label><label>Capa da transmissão<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setCoverFile(event.target.files?.[0] || null)}/><small>JPG, PNG ou WebP · até 5 MB{coverFile ? ` · ${coverFile.name}` : ""}</small></label><label>Ou URL segura da capa (HTTPS)<input type="url" value={form.coverUrl} onChange={event => setForm(value => ({ ...value, coverUrl: event.target.value }))} placeholder="https://…"/></label><label>Política de cancelamento<textarea maxLength={2000} value={form.cancellationPolicy} onChange={event => setForm(value => ({ ...value, cancellationPolicy: event.target.value }))}/></label><label>Informações para participantes<textarea maxLength={2000} value={form.participantInformation} onChange={event => setForm(value => ({ ...value, participantInformation: event.target.value }))}/></label><div className="creator-form-actions"><button className="button primary" disabled={!client}>{editingId ? "Salvar alterações" : "Salvar como rascunho"}</button>{editingId && <button type="button" className="button subtle" onClick={resetForm}>Cancelar edição</button>}</div><small>A live começa em rascunho. Publicar só disponibiliza a agenda; não inicia uma transmissão.</small></form>}
    <h3>Agenda e inscrições</h3>{data.lives.map(live => { const registrations = data.registrations.filter(item => item.live_id === live.id && item.status === "registered"); const registered = registrations.some(item => item.profile_id === profileId); const own = live.instructor_id === profileId || isAdmin; const confirmedOrders = (data.liveOrders || []).filter(order => order.live_id === live.id && order.status === "confirmed"); const confirmedSales = confirmedOrders.reduce((total, order) => total + Number(order.amount_cents || 0), 0); return <article className="creator-program-item" key={live.id}><div><span className="eyebrow">{statusLabel[live.status] || live.status} · {live.access_mode === "approved_creator" ? "CRIADORES APROVADOS" : "PÚBLICA"}</span><h3>{live.title}</h3><p>{new Date(live.starts_at).toLocaleString("pt-BR")} · {live.description}</p><small>{registrations.length} inscrição(ões) confirmada(s) · {live.price_cents ? `R$ ${(live.price_cents / 100).toFixed(2).replace(".", ",")}` : "Gratuita"} · {confirmedOrders.length} compra(s) confirmada(s) · R$ {(confirmedSales / 100).toFixed(2).replace(".", ",")}</small></div>{live.status === "published" && live.price_cents === 0 && <button className="button primary" disabled={!client || registered || !profileId} onClick={() => runAction(() => registerCreatorLive(client, live.id), "Inscrição confirmada no servidor.")}>{registered ? "Inscrito" : "Inscrever-se"}</button>}{own && <div className="creator-form-actions"><button className="button subtle" onClick={() => editLive(live)}>Editar / reagendar</button>{(live.status === "draft" || (isAdmin && live.status === "pending_approval")) && <button className="button primary" onClick={() => runAction(() => publishCreatorLive(client, live.id, isAdmin), isAdmin ? "Transmissão aprovada e publicada." : "Transmissão enviada para aprovação da equipe.")}>{isAdmin ? "Aprovar e publicar" : "Enviar para aprovação"}</button>}{["draft", "pending_approval", "published"].includes(live.status) && <button className="button subtle" onClick={() => { if (window.confirm("Cancelar esta transmissão? As inscrições existentes não serão apagadas.")) runAction(() => cancelCreatorLive(client, live.id), "Transmissão cancelada."); }}>Cancelar</button>}</div>}</article>; })}
    {!loading && !error && !data.lives.length && <p>Nenhuma live Creator programada.</p>}{!canSchedule && !error && <p>Agendamento disponível para professores autorizados e administradores.</p>}
  </section>;
}

function CampaignProgram({ client, profileId, isAdmin, data, loading, error, message, runAction }) {
  const [form, setForm] = useState({ title: "", description: "", opportunityType: "collab" });
  const [applicationMessage, setApplicationMessage] = useState("");
  return <section className="creator-card"><Clapperboard/><h2>Campanhas e collabs</h2><ProgramFeedback loading={loading} error={error} message={message}/><p>Collabs, unboxing, campanhas e produtos dependem de seleção e disponibilidade. Nenhuma oportunidade garante remuneração ou envio de produto.</p>
    {isAdmin && <form className="creator-admin-form" onSubmit={event => { event.preventDefault(); runAction(async () => { await createCreatorCampaign(client, profileId, form); setForm({ title: "", description: "", opportunityType: "collab" }); }, "Oportunidade publicada."); }}><h3>Publicar oportunidade</h3><label>Título<input required minLength={3} maxLength={160} value={form.title} onChange={event => setForm(value => ({ ...value, title: event.target.value }))}/></label><label>Descrição<textarea maxLength={5000} value={form.description} onChange={event => setForm(value => ({ ...value, description: event.target.value }))}/></label><label>Tipo<select value={form.opportunityType} onChange={event => setForm(value => ({ ...value, opportunityType: event.target.value }))}><option value="collab">Collab</option><option value="unboxing">Unboxing</option><option value="campaign">Campanha</option><option value="product">Produto</option></select></label><button className="button primary" disabled={!client}>Publicar</button></form>}
    {data.campaigns.map(campaign => { const ownApplication = data.campaignApplications.find(item => item.campaign_id === campaign.id && item.profile_id === profileId); return <article className="creator-program-item" key={campaign.id}><div><span className="eyebrow">{campaign.opportunity_type.toUpperCase()}</span><h3>{campaign.title}</h3><p>{campaign.description}</p></div><button type="button" className="button primary" disabled={!client || Boolean(ownApplication) || !profileId} onClick={() => runAction(() => applyToCreatorCampaign(client, campaign.id, applicationMessage), "Candidatura à oportunidade registrada.")}>{ownApplication ? `Solicitação: ${ownApplication.status}` : "Solicitar participação"}</button></article>; })}
    {!loading && !error && !data.campaigns.length && <p>Nenhuma oportunidade aberta.</p>}
    {data.campaignApplications.length > 0 && <section className="creator-subsections"><h3>{isAdmin ? "Solicitações recebidas" : "Minhas solicitações"}</h3>{data.campaignApplications.map(item => <article className="creator-program-item" key={item.id}><div><strong>{item.profile_id === profileId ? "Minha inscrição" : "Conta candidata"}</strong><p>{item.message || "Sem mensagem"} · {item.status}</p></div>{isAdmin && item.status === "pending" && <div className="creator-form-actions"><button className="button primary" onClick={() => runAction(() => reviewCreatorCampaignApplication(client, item.id, "selected"), "Participação selecionada.")}>Selecionar</button><button className="button subtle" onClick={() => runAction(() => reviewCreatorCampaignApplication(client, item.id, "declined"), "Solicitação encerrada.")}>Recusar</button></div>}</article>)}</section>}
    {!isAdmin && data.campaigns.length > 0 && <label className="creator-application-message">Apresentação para a campanha<textarea maxLength={2000} value={applicationMessage} onChange={event => setApplicationMessage(event.target.value)}/></label>}
  </section>;
}
