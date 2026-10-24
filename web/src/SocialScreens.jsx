import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import SponsoredCreative from "./SponsoredCreative.jsx";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Activity, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BadgeCheck, Bookmark, Calendar, Camera, Check, CheckCircle2, ChevronDown, ChevronRight, CircleAlert, Clapperboard, Compass, Dumbbell, Eye, EyeOff, ExternalLink, Heart,
  ImagePlus, Link as LinkIcon, LoaderCircle, Lock, LockKeyhole, Mail, MapPin, MessageCircle, MoreHorizontal, Plus,
  Move, Play, Search, Send, Share2, ShieldCheck, Sparkles, Trash2, User, UserMinus, UserPlus, Users, Video, Volume2, VolumeX, X, Zap,
} from "lucide-react";
import Brand from "./Brand.jsx";
import { credibilityPackAsset, fortalfyAsset, visualPackAsset } from "./assetPath.js";
import { playNotificationSound } from "./notificationService.js";
import PartnerStorefront from "./PartnerStorefront.jsx";
import { ReelCameraRecorder, ReelVideoEditor } from "./ReelVideoEditor.jsx";
import { createSecureId } from "./secureId.js";
import {
  FORTALREEL_MAX_DURATION_SECONDS, FORTALREEL_SOUNDTRACK_URL, inspectMp4AudioTrackUrl, inspectReelVideo,
  isFortalReelDurationAllowed, isFortalReelRatio,
} from "./reelMedia.js";
import {
  addComment, cancelFollowRequest, deleteComment, deletePost, getErrorMessage,
  hidePost, loadComments, loadFeed, loadFollowRequests, loadFollowState, loadProfile,
  isUsernameAvailable, loadConversations, loadDirectMessages, loadMutualFollowState, loadProfileConnections, mapProfile, markConversationRead, publishPost,
  getProfileImageCropRect, prepareProfileImage, recordReelView,
  reportComment, reportPost, respondFollowRequest, searchProfiles, sendDirectMessage,
  setBookmark, removeProfileImage, setCommentLike, setFollow as persistFollow, setPostLike, sharePost, startConversation, normalizeSocialCount,
  updateComment, updatePost, uploadProfileImage,
} from "./socialService.js";
import {
  createAccount, isExistingEmailSignup, isUsernameAvailabilityFunctionMissing, loadUserPreferences, resendSignupOtp, saveOnboarding, signInWithGoogle, verifySignupOtp,
  validateOnboarding, validateSignup,
} from "./authService.js";
import {
  loadApprovedProfessionalProfiles, loadProfessionalApplications, loadProfileLinks, PROFESSIONAL_CATEGORIES,
  saveSocialProfile, validateProfileLinks,
} from "./professionalService.js";
import { reportCommercialContent } from "./commercialService.js";

const mediaUrl = path => path || "";
const REEL_SOUND_EVENT = "fortalfy:reel-sound";
const REEL_AUTO_ADVANCE_EVENT = "fortalfy:reel-auto-advance";
const REEL_SPEED_EVENT = "fortalfy:reel-speed";
const FOLLOW_STATE_EVENT = "fortalfy:follow-state";
let reelSoundEnabled = (() => {
  try {
    const preference = window.localStorage.getItem("fortalfy.reels.sound");
    return preference == null || preference === "on";
  } catch (error) {
    console.error("Não foi possível carregar a preferência de áudio dos Reels.", error);
    return false;
  }
})();

function saveReelSoundPreference(enabled) {
  reelSoundEnabled = enabled;
  try {
    window.localStorage.setItem("fortalfy.reels.sound", enabled ? "on" : "off");
  } catch (error) {
    console.error("Não foi possível salvar a preferência de áudio dos Reels.", error);
  }
  window.dispatchEvent(new CustomEvent(REEL_SOUND_EVENT, { detail: enabled }));
}

function publishFollowState(followerId, followedId, isFollowing, requestStatus = "") {
  window.dispatchEvent(new CustomEvent(FOLLOW_STATE_EVENT, {
    detail: { followerId, followedId, isFollowing, requestStatus },
  }));
}

const formatDate = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "agora"
    : date.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};
const formatCompactCount = value => new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
}).format(Math.max(0, Number(value) || 0));

function ProfileImageCropPreview({ imageDraft, setImageDraft }) {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const dragRef = useRef(null);
  const isAvatar = imageDraft.field === "avatar_path";
  const canAdjust = imageDraft.file.type !== "image/gif";

  const drawPreview = () => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image?.naturalWidth || !image.naturalHeight) return;
    const width = isAvatar ? 900 : 1500;
    const height = isAvatar ? 900 : 500;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      setImageDraft(current => ({ ...current, previewError: "Este navegador não conseguiu abrir a prévia da imagem." }));
      return;
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    const crop = getProfileImageCropRect(
      image.naturalWidth,
      image.naturalHeight,
      imageDraft.field,
      imageDraft.zoom,
      imageDraft.panX,
      imageDraft.panY,
    );
    context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
    setImageDraft(current => current?.previewUrl === imageDraft.previewUrl
      ? { ...current, previewLoading: false, previewError: "" }
      : current);
  };

  useEffect(() => {
    drawPreview();
  }, [imageDraft.previewUrl, imageDraft.zoom, imageDraft.panX, imageDraft.panY, isAvatar]);

  const moveImage = event => {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (!canAdjust || !drag || drag.pointerId !== event.pointerId || !canvas || !imageRef.current?.naturalWidth) return;
    const crop = getProfileImageCropRect(
      imageRef.current.naturalWidth,
      imageRef.current.naturalHeight,
      imageDraft.field,
      imageDraft.zoom,
      drag.panX,
      drag.panY,
    );
    setImageDraft(current => ({
      ...current,
      panX: crop.maxPanX ? Math.min(1, Math.max(-1, drag.panX - ((event.clientX - drag.clientX) / canvas.clientWidth * crop.width) / crop.maxPanX)) : 0,
      panY: crop.maxPanY ? Math.min(1, Math.max(-1, drag.panY - ((event.clientY - drag.clientY) / canvas.clientHeight * crop.height) / crop.maxPanY)) : 0,
    }));
  };

  const nudge = (x, y) => setImageDraft(current => ({
    ...current,
    panX: Math.min(1, Math.max(-1, current.panX + x)),
    panY: Math.min(1, Math.max(-1, current.panY + y)),
  }));

  return <div className={`social-image-crop-preview ${isAvatar ? "avatar" : "cover"}`}>
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`Prévia do corte da ${isAvatar ? "foto do perfil" : "foto de capa"}${canAdjust ? ". Arraste para posicionar ou use as setas do teclado." : "."}`}
      tabIndex={canAdjust ? 0 : undefined}
      onPointerDown={event => {
        if (!canAdjust || event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, panX: imageDraft.panX, panY: imageDraft.panY };
      }}
      onPointerMove={moveImage}
      onPointerUp={event => { if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null; }}
      onPointerCancel={event => { if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null; }}
      onKeyDown={event => {
        if (!canAdjust) return;
        const step = event.shiftKey ? 0.2 : 0.05;
        const movement = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[event.key];
        if (movement) {
          event.preventDefault();
          nudge(...movement);
        }
      }}
    />
    <img ref={imageRef} src={imageDraft.previewUrl} alt="" aria-hidden="true" className="social-image-crop-source" onLoad={drawPreview} onError={() => setImageDraft(current => ({ ...current, previewLoading: false, previewError: "Não foi possível carregar esta imagem. Escolha outro arquivo." }))} />
    {imageDraft.previewLoading && <span className="social-image-crop-status" role="status">Carregando prévia…</span>}
    {canAdjust && <span className="social-image-crop-move-hint"><Move size={14} /> Arraste para reposicionar</span>}
  </div>;
}

function getAuthEmailFailureMessage(error, fallback) {
  const message = [error?.message, error?.msg, error?.details].filter(Boolean).join(" ").toLowerCase();
  const code = String(error?.code || "").toLowerCase();
  if (code === "email_address_not_authorized" || /email address not authorized|recipient.*not authorized/.test(message)) {
    return "O Supabase recusou o destinat\u00e1rio. A equipe precisa revisar o SMTP e a autoriza\u00e7\u00e3o do remetente no painel Supabase.";
  }
  if (/error sending (confirmation|recovery|reset)|smtp.*(error|fail)|failed to send email/.test(message)) {
    return "O servi\u00e7o de e-mail n\u00e3o conseguiu enviar a mensagem. A equipe precisa conferir Authentication > SMTP Settings e os logs de Auth no Supabase.";
  }
  return fallback;
}

function SocialAuth({ client, configured, notify, recovery = false, onRecovered, variant = "", initialMode = "login" }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedKind = searchParams.get("professionalKind") || "";
  const authCallbackError = searchParams.get("authError");
  const professionalKind = PROFESSIONAL_CATEGORIES.some(category => category.id === requestedKind) ? requestedKind : "";
  const [mode, setMode] = useState(recovery ? "update" : professionalKind ? "signup" : initialMode);
  const [busy, setBusy] = useState(false);
  const [otpToken, setOtpToken] = useState("");
  const [resendSeconds, setResendSeconds] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [googleHelpOpen, setGoogleHelpOpen] = useState(false);
  const [fields, setFields] = useState({
    name: "", username: "", email: "", password: "", confirmPassword: "", birthDate: "", city: "", kind: professionalKind || "cliente",
    goals: ["emagrecimento", "forca"], interests: ["feed", "treinos"], acceptedTerms: false,
    acceptedBenefitsTerms: false,
  });
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const signupUsername = fields.username.trim().replace(/^@/, "").toLowerCase();
  const [usernameCheck, setUsernameCheck] = useState({ username: "", checking: false, available: null, error: "", missingFunction: false });

  const signupGoals = [
    ["emagrecimento", "🔥 Emagrecimento"],
    ["forca", "💪 Força & Hipertrofia"],
    ["cardio", "🏃 Resistência & Cardio"],
    ["mobilidade", "🧘 Mobilidade & Flex"],
    ["alimentacao", "🥗 Reeducação Alimentar"],
    ["bem-estar", "✨ Bem-estar & Mente"],
    ["comunidade", "🤝 Conexão & Apoio"],
  ];
  const signupInterests = [
    ["feed", "📱 Feed & Stories"],
    ["food", "🥑 Fortalfy Food"],
    ["shop", "🛍️ FortalShop"],
    ["treinos", "🏋️ Treinos & Rotinas"],
    ["pass", "🎟️ Fortalfy Pass"],
  ];

  useEffect(() => {
    if (recovery) {
      setMode("update");
      setMessage("");
    }
  }, [recovery]);

  useEffect(() => {
    if (authCallbackError === "expired") {
      setMode("reset");
      setMessage("O link expirou ou já foi usado. Informe seu e-mail para solicitar outro.");
      setMessageType("error");
    }
  }, [authCallbackError]);

  useEffect(() => {
    if (resendSeconds <= 0) return undefined;
    const timer = window.setTimeout(() => setResendSeconds(seconds => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  useEffect(() => {
    if (mode !== "signup" || !/^[a-z0-9._]{3,30}$/.test(signupUsername) || !client) {
      setUsernameCheck({ username: signupUsername, checking: false, available: null, error: "", missingFunction: false });
      return undefined;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      setUsernameCheck({ username: signupUsername, checking: true, available: null, error: "", missingFunction: false });
      isUsernameAvailable(client, signupUsername)
        .then(available => {
          if (active) setUsernameCheck({ username: signupUsername, checking: false, available, error: "", missingFunction: false });
        })
        .catch(error => {
          if (isUsernameAvailabilityFunctionMissing(error)) {
            if (active) setUsernameCheck({ username: signupUsername, checking: false, available: null, error: "", missingFunction: true });
            return;
          }
          console.error("Falha ao verificar a disponibilidade do nome de usuario.", error);
          if (active) setUsernameCheck({ username: signupUsername, checking: false, available: null, error: getErrorMessage(error), missingFunction: false });
        });
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [client, mode, signupUsername]);

  const submit = async event => {
    event.preventDefault();
    setMessage("");
    setGoogleHelpOpen(false);

    if (mode === "signup") {
      const errors = validateSignup(fields);
      if (Object.keys(errors).length) {
        setMessage(Object.values(errors)[0]);
        setMessageType("error");
        return;
      }
    }
    if (["signup", "update"].includes(mode) && fields.password.length < 8) {
      setMessage("Use uma senha com pelo menos 8 caracteres.");
      setMessageType("error");
      return;
    }
    if (mode === "update" && fields.password !== fields.confirmPassword) {
      setMessage("As duas senhas precisam ser iguais.");
      setMessageType("error");
      return;
    }
    setBusy(true);
    try {
      if (mode === "confirm") {
        if (!configured || !client) throw new Error("A conexão com o servidor de autenticação ainda não foi configurada.");
        const data = await verifySignupOtp(client, fields.email, otpToken);
        setMessage("E-mail confirmado. Sua conta está ativa.");
        setMessageType("success");
        if (data?.session) {
          if (fields.kind !== "cliente") navigate(`/professional/manage?category=${encodeURIComponent(fields.kind)}`);
          else navigate("/home");
        } else {
          setMode("login");
        }
      } else if (mode === "update") {
        if (!configured || !client) throw new Error("Supabase não configurado.");
        if (!recovery) throw new Error("Abra o link de recuperação mais recente para continuar.");
        const { data: sessionData, error: sessionError } = await client.auth.getSession();
        if (sessionError || !sessionData?.session) throw new Error("O link de recuperação expirou ou já foi usado. Solicite outro.");
        const { error } = await client.auth.updateUser({ password: fields.password });
        if (error) throw error;
        notify?.("Senha atualizada. Entre novamente com sua nova senha.");
        setFields(current => ({ ...current, password: "", confirmPassword: "" }));
        await client.auth.signOut();
        onRecovered?.();
        navigate("/profile");
      } else if (mode === "signup") {
        if (!configured || !client) throw new Error("A conexão com o servidor de autenticação ainda não foi configurada.");
        try {
          if (!await isUsernameAvailable(client, signupUsername)) {
            const unavailable = new Error("Esse nome de usuario ja esta em uso ou reservado.");
            unavailable.code = "fortalfy_username_unavailable";
            throw unavailable;
          }
        } catch (error) {
          if (!isUsernameAvailabilityFunctionMissing(error)) throw error;
          console.warn("A verificação de username não está instalada no Supabase; a restrição única do banco validará o cadastro.");
        }
        const redirectTo = fields.kind === "cliente"
          ? `${window.location.origin}${window.location.pathname}`
          : `${window.location.origin}${window.location.pathname}#/professional/manage?category=${encodeURIComponent(fields.kind)}`;
        const data = await createAccount(client, fields, redirectTo);
        if (isExistingEmailSignup(data)) {
          // signUp does not resend confirmation for an existing unconfirmed account.
          setFields(current => ({ ...current, password: "" }));
          setOtpToken("");
          setResendSeconds(0);
          setMode("confirm");
          try {
            await resendSignupOtp(client, fields.email);
            setResendSeconds(60);
            setMessage("Se o cadastro ainda estiver pendente, enviamos um novo c\u00f3digo. Se voc\u00ea j\u00e1 tem uma conta, use Entrar ou Recuperar senha abaixo. Confira tamb\u00e9m o spam.");
            setMessageType("success");
          } catch (emailError) {
            const errorText = (emailError?.message || "").toLowerCase();
            const rateLimited = emailError?.code === "over_email_send_rate_limit" || /rate limit/i.test(errorText);
            setMessage(rateLimited
              ? "O servi\u00e7o limitou novos envios. Aguarde um minuto e toque em Reenviar c\u00f3digo de confirma\u00e7\u00e3o."
              : getAuthEmailFailureMessage(emailError, "N\u00e3o foi poss\u00edvel enviar o c\u00f3digo agora. Tente reenviar ou use Recuperar senha abaixo."));
            setMessageType("error");
          }
          return;
        }
        if (data?.session) {
          setMessage("Conta criada com sucesso! Bem-vindo(a) ao Fortalfy.");
          setMessageType("success");
          notify?.("Conta criada com sucesso!");
          if (fields.kind !== "cliente") navigate(`/professional/manage?category=${encodeURIComponent(fields.kind)}`);
          return;
        }
        if (data?.user) {
          setFields(current => ({ ...current, password: "" }));
          setOtpToken("");
          setResendSeconds(60);
          setMessage("Enviamos um código de confirmação. Informe-o abaixo para ativar sua conta.");
          setMessageType("success");
          setMode("confirm");
          return;
        }
        setMessage("Conta criada com sucesso! Você já pode entrar.");
        setMessageType("success");
        setMode("login");
      } else if (mode === "reset") {
        if (!configured || !client) throw new Error("Supabase não configurado.");
        const redirectTo = `${window.location.origin}${window.location.pathname}`;
        const { error } = await client.auth.resetPasswordForEmail(fields.email.trim(), { redirectTo });
        if (error) throw error;
        setMessage("Se o e-mail estiver cadastrado, você receberá um link seguro para redefinir sua senha.");
        setMessageType("success");
      } else {
        // mode === "login"
        if (!configured || !client) throw new Error("Supabase não configurado.");
        const { data, error } = await client.auth.signInWithPassword({
          email: fields.email.trim(),
          password: fields.password,
        });
        if (error) {
          const errText = (error.message || "").toLowerCase();
          if (errText.includes("invalid login credentials") || error.code === "invalid_credentials") {
            setMessage("O Supabase não aceitou este e-mail e senha. Se a conta acabou de ser criada, confirme o e-mail primeiro; se já confirmou, confira o endereço ou use “Esqueceu a senha?”.");
          } else if (errText.includes("email not confirmed")) {
            setMessage("Seu e-mail ainda precisa de confirmação. Informe o código recebido ou solicite outro.");
            setMode("confirm");
            setResendSeconds(0);
          } else {
            setMessage(getErrorMessage(error, "Não foi possível autenticar. Verifique seus dados de acesso."));
          }
          setMessageType("error");
          return;
        }
        if (data?.session) {
          notify?.("Bem-vindo(a) de volta!");
          if (professionalKind) navigate(`/professional/manage?category=${encodeURIComponent(professionalKind)}`);
        }
      }
    } catch (error) {
      console.error("Falha na autenticação.", { code: error?.code || "unknown" });
      const errText = (error?.message || "").toLowerCase();
      const duplicateUsername = error?.code === "23505"
        || /profiles_username_lower_unique|duplicate key/i.test(error?.message || "");
      const userExists = errText.includes("user already registered") || error?.code === "user_already_exists";
      if (duplicateUsername || error?.code === "fortalfy_username_unavailable") {
        setMessage("Esse nome de usuário já está em uso. Escolha outro.");
      } else if (userExists) {
        setMessage("Se este endereço puder ser usado, enviaremos instruções. Tente entrar ou solicitar a recuperação da senha.");
      } else if (errText.includes("rate limit") && mode === "reset") {
        setMessage("O limite de envio foi atingido. Aguarde um minuto antes de pedir outro link de recupera\u00e7\u00e3o.");
      } else if (errText.includes("rate limit")) {
        setMessage("Limite temporário de requisições de e-mail atingido. Se já tem conta, utilize o login.");
      } else if (mode === "reset") {
        setMessage(getAuthEmailFailureMessage(error, "N\u00e3o foi poss\u00edvel enviar o link agora. Confira o e-mail e tente novamente mais tarde."));
      } else if (mode === "confirm") {
        setMessage("O código não foi aceito ou expirou. Confira o e-mail e solicite outro código se necessário.");
      } else if (mode === "update") {
        setMessage("O link de recuperação expirou ou já foi usado. Solicite um novo link para continuar.");
      } else {
        setMessage(getErrorMessage(error, "Não foi possível concluir a ação. Verifique seus dados."));
      }
      setMessageType("error");
    } finally {
      setBusy(false);
    }
  };

  const resendConfirmation = async () => {
    if (busy || resendSeconds > 0) return;
    setBusy(true);
    setMessage("");
    try {
      if (!configured || !client) throw new Error("A conexão com o servidor de autenticação ainda não foi configurada.");
      await resendSignupOtp(client, fields.email);
      setResendSeconds(60);
      setMessage("Se este cadastro ainda precisar de confirmação, enviaremos um novo código para esse e-mail.");
      setMessageType("success");
    } catch (error) {
      const code = error?.code || "";
      console.error("Falha ao reenviar confirmação de e-mail.", { code });
      setMessage(code === "over_email_send_rate_limit" || /rate limit/i.test(error?.message || "")
        ? "Aguarde antes de pedir outro código. O limite de envio do serviço foi atingido."
        : getAuthEmailFailureMessage(error, "Não foi possível reenviar agora. Confira o endereço e tente novamente mais tarde."));
      setMessageType("error");
    } finally {
      setBusy(false);
    }
  };

  const updateChoice = (field, value) => setFields(current => ({
    ...current,
    [field]: current[field].includes(value)
      ? current[field].filter(item => item !== value)
      : [...current[field], value],
  }));

  const startGoogleLogin = async () => {
    if (!configured || !client) {
      setMessage("A conexão com o Supabase ainda não foi configurada nesta publicação.");
      setMessageType("error");
      return;
    }
    if (mode === "signup" && fields.kind !== "cliente") {
      setMessage("Para vincular a categoria profissional à conta, conclua o cadastro com e-mail e senha.");
      setMessageType("error");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const redirectTo = professionalKind
        ? `${window.location.origin}${window.location.pathname}#/professional/manage?category=${encodeURIComponent(professionalKind)}`
        : `${window.location.origin}${window.location.pathname}#${location.pathname}${location.search}`;
      await signInWithGoogle(client, redirectTo);
    } catch (error) {
      console.error("Falha ao iniciar autenticação com Google.", error);
      const errStr = (error?.message || error?.msg || JSON.stringify(error) || "").toLowerCase();
      if (errStr.includes("provider is not enabled") || errStr.includes("unsupported provider") || errStr.includes("validation_failed")) {
        setGoogleHelpOpen(true);
        setMessage("O login com Google requer ativação no painel do Supabase com o Client ID do Google Cloud.");
        setMessageType("info");
      } else {
        setMessage(getErrorMessage(error, "Não foi possível iniciar o acesso com Google."));
        setMessageType("error");
      }
      setBusy(false);
    }
  };

  return (
    <div className={`social-auth-hero-container${variant ? ` ${variant}` : ""}`}>
      <div className="social-auth-split">
        {/* Left Column: Brand Showcase */}
        <aside className="social-auth-showcase">
          <div className="showcase-glow-circle" />
          <div className="showcase-brand-header">
            <Brand light />
            <span className="showcase-pill">COMUNIDADE & BEM-ESTAR</span>
          </div>

          <div className="showcase-content">
            <h2>Bem-estar no seu ritmo.</h2>
            <p>
              Encontre parceiros e profissionais aprovados, consulte conteúdos publicados e acompanhe os registros da sua rotina.
            </p>

            <div className="showcase-perks">
              <div className="showcase-perk-item">
                <span className="perk-icon perk-mint"><Dumbbell size={18} /></span>
                <div>
                  <strong>Fortalfy Pass</strong>
                  <small>Academias e profissionais aprovados, quando disponíveis</small>
                </div>
              </div>
              <div className="showcase-perk-item">
                <span className="perk-icon perk-orange"><Sparkles size={18} /></span>
                <div>
                  <strong>Nutrição & Food</strong>
                  <small>Cardápios publicados por restaurantes parceiros</small>
                </div>
              </div>
              <div className="showcase-perk-item">
                <span className="perk-icon perk-lime"><Users size={18} /></span>
                <div>
                  <strong>Feed & Conexão</strong>
                  <small>Publicações e conversas da comunidade Fortalfy</small>
                </div>
              </div>
            </div>
          </div>

          <img
            className="showcase-banner"
            src={visualPackAsset("fortalfy-pack-onboarding-lifestyle.jpg")}
            alt=""
            aria-hidden="true"
          />

          <div className="showcase-footer">
            <div className="showcase-proof">
              <strong>Seu espaço para evoluir</strong>
              <small>Treino, comunidade e bem-estar em um só lugar.</small>
            </div>
          </div>
        </aside>

        {/* Right Column: Interactive Auth Hub */}
        <section className={`social-auth-form-card${mode === "confirm" ? " auth-confirm-mode" : ""}`}>
          {/* Segmented Mode Selector */}
          {!['confirm', 'update'].includes(mode) && <div className="auth-tab-switch" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              className={`auth-tab-btn ${mode === "login" ? "active" : ""}`}
              onClick={() => { setMode("login"); setMessage(""); setGoogleHelpOpen(false); }}
            >
              Entrar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              className={`auth-tab-btn ${mode === "signup" ? "active" : ""}`}
              onClick={() => { setMode("signup"); setMessage(""); setGoogleHelpOpen(false); }}
            >
              Criar Conta
            </button>
          </div>}

          {!['confirm', 'update'].includes(mode) && <div className="auth-card-header">
            <span className="auth-badge-pill">
              <Sparkles size={13} />
              {mode === "signup" ? "Novo por aqui?" : mode === "reset" ? "Recuperação segura" : mode === "update" ? "Nova senha" : "Bem-vindo(a) de volta"}
            </span>
            <h3>
              {mode === "signup"
                ? "Crie sua conta no Fortalfy"
                : mode === "reset"
                ? "Recuperar seu acesso"
                : mode === "update"
                ? "Defina uma nova senha"
                : "Acesse sua conta"}
            </h3>
            <p>
              {mode === "signup"
                ? "Junte-se à comunidade para registrar seus treinos, alimentação e evolução."
                : mode === "reset"
                ? "Informe seu e-mail cadastrado para receber instruções de recuperação."
                : "Entre para acompanhar seus treinos, publicações e contatos."}
            </p>
          </div>}

          {mode === "confirm" && (
            <div className="auth-confirm-intro">
              <span className="auth-badge-pill"><ShieldCheck size={13} /> CONFIRMAÇÃO DE CONTA</span>
              <h3>Confirme seu e-mail</h3>
              <p>Digite o código enviado para ativar sua conta. Você pode colar o código completo no campo.</p>
            </div>
          )}

          {!configured && (
            <div className="social-config-warning">
              <CircleAlert size={17} />
              <span>O app está aguardando as variáveis do Supabase nesta publicação.</span>
            </div>
          )}

          {/* Social Sign-in button with Official Google SVG */}
          {(mode === "login" || mode === "signup") && (
            <div className="auth-social-section">
              <button
                className="social-google-button"
                type="button"
                onClick={startGoogleLogin}
                disabled={busy || !configured || (mode === "signup" && fields.kind !== "cliente")}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                )}
                <span>Continuar com Google</span>
              </button>
              {mode === "signup" && fields.kind !== "cliente" && <p className="auth-hint-text">Para garantir que a categoria profissional fique vinculada corretamente, use o cadastro por e-mail.</p>}

              {/* Google OAuth Helper Modal / Card */}
              {googleHelpOpen && (
                <div className="google-helper-banner">
                  <div className="google-helper-top">
                    <CircleAlert size={17} className="helper-icon" />
                    <div className="helper-text">
                      <strong>Por que deu erro ao clicar no Google?</strong>
                      <p>
                        O login com Google requer que o provedor esteja ativado no painel do Supabase com as credenciais do Google Cloud Console.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="helper-close-btn"
                      onClick={() => setGoogleHelpOpen(false)}
                      aria-label="Fechar aviso"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  <div className="google-helper-steps">
                    <div><span>1</span> Abra o <strong>Supabase Dashboard</strong> &gt; <strong>Authentication</strong> &gt; <strong>Providers</strong> &gt; <strong>Google</strong>.</div>
                    <div><span>2</span> Ative o provedor e insira o <strong>Client ID</strong> e <strong>Client Secret</strong>.</div>
                    <div><span>3</span> Adicione <code>https://blassbooker-alt.github.io/VERISURE/</code> às Redirect URLs.</div>
                  </div>

                  <button
                    type="button"
                    className="google-helper-cta"
                    onClick={() => {
                      setGoogleHelpOpen(false);
                      document.getElementById("auth-field-email")?.focus();
                    }}
                  >
                    Entendido, vou entrar com e-mail e senha abaixo ↓
                  </button>
                </div>
              )}

              <div className="social-auth-divider">
                <span>ou continue com seu e-mail</span>
              </div>
            </div>
          )}

          {/* Form */}
          <form className="social-auth-form" onSubmit={submit}>
            {mode === "signup" && (
              <div className="auth-field">
                <label htmlFor="auth-field-name">Nome completo ou de exibição</label>
                <div className="auth-input-box">
                  <User size={16} className="auth-box-icon" />
                  <input
                    id="auth-field-name"
                    autoComplete="name"
                    placeholder="Ex.: Lucas Mendes"
                    value={fields.name}
                    minLength={2}
                    maxLength={120}
                    onChange={event => setFields(current => ({ ...current, name: event.target.value }))}
                    required
                  />
                </div>
              </div>
            )}

            {mode === "signup" && (
              <div className="auth-field">
                <label htmlFor="auth-field-kind">Tipo de conta</label>
                <select
                  id="auth-field-kind"
                  value={fields.kind}
                  onChange={event => setFields(current => ({ ...current, kind: event.target.value }))}
                >
                  <option value="cliente">Pessoa</option>
                  <option value="personal">Personal trainer</option>
                  <option value="nutricionista">Nutricionista</option>
                  <option value="academia">Academia</option>
                  <option value="marca">Loja / marca</option>
                  <option value="empresa">Empresa</option>
                  <option value="vendedor">Vendedor Fortalfy Shop</option>
                  <option value="restaurante">Restaurante</option>
                  <option value="influenciador">Influenciador fitness</option>
                </select>
                <small className="auth-hint-text">{fields.kind === "cliente"
                  ? "Contas profissionais devem enviar o cadastro para análise antes de receber selo ou recursos comerciais."
                  : "Seu perfil profissional só será publicado após análise. A criação da conta não valida credenciais automaticamente."}</small>
              </div>
            )}

            {mode === "signup" && (
              <div className="auth-field">
                <label htmlFor="auth-field-username">Nome de usuário (@)</label>
                <div className="auth-input-box">
                  <span className="auth-at-symbol">@</span>
                  <input
                    id="auth-field-username"
                    autoComplete="username"
                    placeholder="lucas_mendes"
                    value={fields.username}
                    minLength={3}
                    maxLength={30}
                    pattern="[A-Za-z0-9._]{3,30}"
                    onChange={event => setFields(current => ({ ...current, username: event.target.value.toLowerCase() }))}
                    required
                  />
                </div>
                <small className="auth-hint-text">De 3 a 30 caracteres: letras, números, ponto e sublinhado (_).</small>
                {signupUsername.length >= 3 && /^[a-z0-9._]{3,30}$/.test(signupUsername) && !usernameCheck.missingFunction && (
                  <small className={`auth-username-availability ${usernameCheck.error ? "is-error" : usernameCheck.available ? "is-available" : usernameCheck.available === false ? "is-unavailable" : ""}`}>
                    {usernameCheck.username !== signupUsername || usernameCheck.checking
                      ? "Verificando disponibilidade…"
                      : usernameCheck.error
                        ? "Não foi possível confirmar a disponibilidade agora. Tente novamente antes de criar a conta."
                        : usernameCheck.available
                          ? "Nome de usuário disponível."
                          : "Nome de usuário em uso ou reservado."}
                  </small>
                )}
              </div>
            )}

            {['signup', 'login', 'reset'].includes(mode) && (
              <div className="auth-field">
                <label htmlFor="auth-field-email">E-mail</label>
                <div className="auth-input-box">
                  <Mail size={16} className="auth-box-icon" />
                  <input
                    id="auth-field-email"
                    type="email"
                    autoComplete="email"
                    placeholder="seu.email@exemplo.com"
                    value={fields.email}
                    onChange={event => setFields(current => ({ ...current, email: event.target.value }))}
                    required
                  />
                </div>
              </div>
            )}

            {['signup', 'login', 'update'].includes(mode) && (
              <div className="auth-field">
                <div className="auth-label-row">
                  <label htmlFor="auth-field-password">Senha</label>
                  {mode === "login" && (
                    <button
                      type="button"
                      className="auth-link-btn"
                      onClick={() => { setMode("reset"); setMessage(""); setGoogleHelpOpen(false); }}
                    >
                      Esqueceu a senha?
                    </button>
                  )}
                </div>
                <div className="auth-input-box">
                  <Lock size={16} className="auth-box-icon" />
                  <input
                    id="auth-field-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    placeholder="Pelo menos 8 caracteres"
                    minLength={8}
                    value={fields.password}
                    onChange={event => setFields(current => ({ ...current, password: event.target.value }))}
                    required
                  />
                  <button
                    type="button"
                    className="auth-toggle-pwd"
                    onClick={() => setShowPassword(p => !p)}
                    aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {mode === "confirm" && (
              <div className="auth-field">
                <label htmlFor="auth-field-otp">Código de confirmação</label>
                <div className="auth-input-box">
                  <ShieldCheck size={16} className="auth-box-icon" />
                  <input
                    id="auth-field-otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="Cole o código recebido"
                    value={otpToken}
                    onChange={event => setOtpToken(event.target.value.replace(/\s+/g, ""))}
                    required
                    aria-describedby="auth-otp-help"
                  />
                </div>
                <small id="auth-otp-help" className="auth-hint-text">O Supabase valida o código e a validade antes de ativar sua conta.</small>
              </div>
            )}

            {mode === "update" && (
              <div className="auth-field">
                <label htmlFor="auth-field-confirm-password">Confirme a nova senha</label>
                <div className="auth-input-box">
                  <Lock size={16} className="auth-box-icon" />
                  <input
                    id="auth-field-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Digite a nova senha novamente"
                    minLength={8}
                    value={fields.confirmPassword}
                    onChange={event => setFields(current => ({ ...current, confirmPassword: event.target.value }))}
                    required
                  />
                </div>
                <small className="auth-hint-text">Use pelo menos 8 caracteres. O link precisa estar válido e ainda não utilizado.</small>
                <div className="auth-password-rules" id="auth-password-rules" aria-live="polite">
                  <span className={fields.password.length >= 8 ? "is-valid" : ""}>{fields.password.length >= 8 ? "✓" : "○"} Pelo menos 8 caracteres</span>
                  <span className={fields.confirmPassword && fields.password === fields.confirmPassword ? "is-valid" : ""}>{fields.confirmPassword && fields.password === fields.confirmPassword ? "✓" : "○"} As duas senhas coincidem</span>
                </div>
              </div>
            )}

            {mode === "signup" && (
              <>
                <div className="auth-two-col">
                  <div className="auth-field">
                    <label htmlFor="auth-field-bday">Data de nascimento</label>
                    <div className="auth-input-box">
                      <Calendar size={16} className="auth-box-icon" />
                      <input
                        id="auth-field-bday"
                        type="date"
                        autoComplete="bday"
                        value={fields.birthDate}
                        max={new Date().toISOString().slice(0, 10)}
                        onChange={event => setFields(current => ({ ...current, birthDate: event.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="auth-field">
                    <label htmlFor="auth-field-city">Cidade (opcional)</label>
                    <div className="auth-input-box">
                      <MapPin size={16} className="auth-box-icon" />
                      <input
                        id="auth-field-city"
                        autoComplete="address-level2"
                        placeholder="Ex.: Fortaleza"
                        value={fields.city}
                        maxLength={120}
                        onChange={event => setFields(current => ({ ...current, city: event.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                <fieldset className="social-auth-choice-group">
                  <legend>Quais são seus objetivos principais?</legend>
                  <div className="auth-choice-chips">
                    {signupGoals.map(([value, label]) => (
                      <label key={value} className={`choice-chip ${fields.goals.includes(value) ? "selected" : ""}`}>
                        <input
                          type="checkbox"
                          checked={fields.goals.includes(value)}
                          onChange={() => updateChoice("goals", value)}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="social-auth-choice-group">
                  <legend>O que mais deseja explorar no app?</legend>
                  <div className="auth-choice-chips">
                    {signupInterests.map(([value, label]) => (
                      <label key={value} className={`choice-chip ${fields.interests.includes(value) ? "selected" : ""}`}>
                        <input
                          type="checkbox"
                          checked={fields.interests.includes(value)}
                          onChange={() => updateChoice("interests", value)}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label className="social-auth-consent">
                  <input
                    type="checkbox"
                    checked={fields.acceptedTerms}
                    onChange={event => setFields(current => ({ ...current, acceptedTerms: event.target.checked }))}
                    required
                  />
                  <span>Li e aceito os Termos de Uso, a Política de Privacidade e as Diretrizes da Comunidade Fortalfy.</span>
                </label>
                <label className="social-auth-consent">
                  <input
                    type="checkbox"
                    checked={fields.acceptedBenefitsTerms}
                    onChange={event => setFields(current => ({ ...current, acceptedBenefitsTerms: event.target.checked }))}
                  />
                  <span>Li e concordo com as regras dos benefícios e descontos Fortalfy, quando aplicáveis. <Link to="/benefits-terms">Consultar declaração e termos</Link>. Este aceite é opcional e separado dos termos gerais.</span>
                </label>
              </>
            )}

            {message && (
              <div className={`auth-alert-message ${messageType}`} role="status">
                <CircleAlert size={16} />
                <span>{message}</span>
              </div>
            )}

            <button className="auth-submit-btn" type="submit" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <>
                  <span>
                    {mode === "confirm" ? "Confirmar meu e-mail" : mode === "signup"
                      ? "Criar Conta & Começar"
                      : mode === "reset"
                      ? "Enviar Link de Recuperação"
                      : mode === "update"
                      ? "Atualizar Senha"
                      : "Entrar na Minha Conta"}
                  </span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          {/* Bottom Switch Links */}
          <div className="auth-bottom-switch">
            {mode === "confirm" && (
              <button type="button" className="auth-link-btn" onClick={resendConfirmation} disabled={busy || resendSeconds > 0}>
                {resendSeconds > 0 ? `Solicite outro código em ${resendSeconds}s` : "Reenviar código de confirmação"}
              </button>
            )}
            {mode === "confirm" && (
              <button type="button" className="auth-link-btn" onClick={() => { setMode("reset"); setMessage(""); setGoogleHelpOpen(false); }}>
                Já tem conta? <strong>Recuperar senha</strong>
              </button>
            )}
            {mode !== "login" && mode !== "update" && (
              <button
                type="button"
                className="auth-link-btn"
                onClick={() => { setMode("login"); setMessage(""); setGoogleHelpOpen(false); }}
              >
                Já tem uma conta? <strong>Entrar</strong>
              </button>
            )}
            {mode === "login" && (
              <button
                type="button"
                className="auth-link-btn"
                onClick={() => { setMode("signup"); setMessage(""); setGoogleHelpOpen(false); }}
              >
                Ainda não tem conta? <strong>Cadastre-se gratuitamente</strong>
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export function OnboardingGate({ client, userId, configured, notify, onSignOut }) {
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [fields, setFields] = useState({
    birthDate: "", goals: [], interests: [], acceptedTerms: false,
  });
  const goals = [
    ["emagrecimento", "Emagrecimento"], ["forca", "Força"], ["cardio", "Cardio"],
    ["mobilidade", "Mobilidade"], ["alimentacao", "Alimentação"], ["bem-estar", "Bem-estar"],
    ["comunidade", "Comunidade"],
  ];
  const interests = [["feed", "Feed"], ["food", "Food"], ["shop", "Shop"], ["treinos", "Treinos"], ["pass", "Pass"]];

  useEffect(() => {
    let active = true;
    setLoading(true);
    setMessage("");
    loadUserPreferences(client, userId)
      .then(result => {
        if (!active) return;
        setPreferences(result);
        setFields({
          birthDate: result?.birth_date || "",
          goals: result?.goals || [],
          interests: result?.interests || [],
          acceptedTerms: Boolean(result?.accepted_terms_at),
        });
      })
      .catch(error => {
        if (!active) return;
        console.error("Não foi possível carregar as preferências privadas da conta.", error);
        setMessage(getErrorMessage(error, "Não foi possível carregar seu onboarding."));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client, userId, retry]);

  const toggle = (field, value) => setFields(current => ({
    ...current,
    [field]: current[field].includes(value)
      ? current[field].filter(item => item !== value)
      : [...current[field], value],
  }));

  const submit = async event => {
    event.preventDefault();
    const errors = validateOnboarding(fields);
    if (Object.keys(errors).length) {
      setMessage(Object.values(errors)[0]);
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const saved = await saveOnboarding(client, userId, fields);
      setPreferences(saved);
      notify("Preferências salvas com segurança na sua conta.");
    } catch (error) {
      console.error("Não foi possível salvar o onboarding.", error);
      setMessage(getErrorMessage(error, "Não foi possível salvar suas preferências."));
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    try {
      if (client?.auth) await client.auth.signOut();
      onSignOut?.();
    } catch (error) {
      console.error("Não foi possível sair da conta durante o onboarding.", error);
      setMessage(getErrorMessage(error, "Não foi possível sair da conta."));
      setBusy(false);
    }
  };

  if (dismissed || preferences?.onboarding_completed) return null;

  return <div className="onboarding-scrim">
    <section className="onboarding-dialog" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <img className="onboarding-welcome-art" src={credibilityPackAsset("26-onboarding-welcome.png")} alt="Pessoa amarrando o tênis ao nascer do sol no Rio de Janeiro" />
      <span className="social-auth-icon"><ShieldCheck size={20} /></span>
      <span className="eyebrow">SEU RITMO, SUAS ESCOLHAS</span>
      <h2 id="onboarding-title">Vamos personalizar sua jornada</h2>
      <p>Essas preferências ficam privadas na sua conta e podem ser alteradas depois.</p>
      {!configured && <div className="social-config-warning"><CircleAlert size={17} /> Configure o Supabase para salvar o onboarding com segurança.</div>}
      {loading ? <p role="status">Carregando suas preferências...</p> : message && !preferences
        ? <div className="social-auth-message" role="alert">
            <p>{message}</p>
            <div style={{ display: "flex", gap: "10px", marginTop: "14px", flexWrap: "wrap", justifyContent: "center" }}>
              <button type="button" className="button subtle small-button" onClick={() => setRetry(value => value + 1)}>Tentar novamente</button>
              <button type="button" className="button primary small-button" onClick={() => setDismissed(true)}>Continuar para o aplicativo</button>
              <button type="button" className="text-button" onClick={signOut} disabled={busy}>Sair da conta</button>
            </div>
          </div>
        : <form className="social-auth-form" onSubmit={submit}>
          <label>Data de nascimento<input type="date" autoComplete="bday" max={new Date().toISOString().slice(0, 10)} value={fields.birthDate} onChange={event => setFields(current => ({ ...current, birthDate: event.target.value }))} required /></label>
          <fieldset className="social-auth-choice-group"><legend>Seus objetivos</legend><div>{goals.map(([value, label]) => <label key={value}><input type="checkbox" checked={fields.goals.includes(value)} onChange={() => toggle("goals", value)} />{label}</label>)}</div></fieldset>
          <fieldset className="social-auth-choice-group"><legend>Seus interesses</legend><div>{interests.map(([value, label]) => <label key={value}><input type="checkbox" checked={fields.interests.includes(value)} onChange={() => toggle("interests", value)} />{label}</label>)}</div></fieldset>
          <label className="social-auth-consent"><input type="checkbox" checked={fields.acceptedTerms} onChange={event => setFields(current => ({ ...current, acceptedTerms: event.target.checked }))} required /><span>Li e aceito os Termos de uso, a Política de privacidade e as Diretrizes da comunidade.</span></label>
          {message && <p className="social-auth-message" role="alert">{message}</p>}
          <button className="button primary wide-button" type="submit" disabled={busy || !configured}>{busy ? <LoaderCircle className="spin" size={16} /> : null}Salvar e continuar</button>
          <div style={{ display: "flex", gap: "12px", justifyContent: "space-between", width: "100%", marginTop: "8px" }}>
            <button className="text-button" type="button" onClick={() => setDismissed(true)} disabled={busy}>Pular por enquanto</button>
            <button className="text-button" type="button" onClick={signOut} disabled={busy}>Sair da conta</button>
          </div>
        </form>}
    </section>
  </div>;
}

function AuthorLink({ author, ownId }) {
  if (!author) return <span className="social-avatar social-avatar-fallback">?</span>;
  const target = author.id === ownId ? "/profile" : `/profile/${author.id}`;
  return <Link className="social-avatar" to={target} aria-label={`Abrir perfil de ${author.name}`}>
    {author.avatar ? <img src={mediaUrl(author.avatar)} alt="" /> : author.name.slice(0, 1).toUpperCase()}
  </Link>;
}

function VerificationBadge({ size = 15 }) {
  return <BadgeCheck className="social-verification-badge" size={size} strokeWidth={2.4} aria-label="Verificado" role="img" />;
}

function communityRole(kind) {
  return ({
    academia: "Academia",
    marca: "Marca esportiva",
    nutricionista: "Nutricionista",
    personal: "Profissional de educação física",
    empresa: "Empresa",
    vendedor: "Vendedor Fortalfy Shop",
    restaurante: "Restaurante",
    influenciador: "Criador de conteúdo fitness",
  })[kind] || "";
}

function LinkifiedText({ text }) {
  const parts = text.split(/(https?:\/\/[^\s]+|#[\p{L}\p{N}_]+|@[a-zA-Z0-9._]+)/gu);
  return <p className="social-post-copy">{parts.map((part, index) => {
    if (/^https?:\/\//i.test(part)) return <a key={index} href={part} target="_blank" rel="noreferrer">{part}</a>;
    if (part.startsWith("#")) return <a key={index} href={`https://www.google.com/search?q=${encodeURIComponent(part)}`} target="_blank" rel="noreferrer">{part}</a>;
    if (part.startsWith("@")) return <span key={index}>{part}</span>;
    return <span key={index}>{part}</span>;
  })}</p>;
}

function SocialComment({ comment, userId, onLike, onEdit, onDelete, onReply, onReport, busy }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState("");
  const own = comment.author_id === userId;
  return <article className={`social-comment-row ${comment.parent_comment_id ? "is-reply" : ""}`}>
    <AuthorLink author={comment.author} ownId={userId} />
    <div className="social-comment-main">
      <div className="social-comment-bubble">
        <Link className="social-comment-author" to={own ? "/profile" : `/profile/${comment.author?.id}`}>{comment.author?.name || "Pessoa Fortalfy"}{comment.author?.verified && <VerificationBadge size={12} />}</Link>
        {editing ? <form className="social-inline-edit" onSubmit={async event => { event.preventDefault(); await onEdit(draft); setEditing(false); }}><textarea value={draft} maxLength={2000} onChange={event => setDraft(event.target.value)} required /><button className="button primary small-button" disabled={busy}>Salvar</button><button className="button subtle small-button" type="button" onClick={() => { setDraft(comment.body); setEditing(false); }}>Cancelar</button></form> : <p>{comment.body}</p>}
      </div>
      <div className="social-comment-meta">
        <button className={comment.likedByMe ? "is-liked" : ""} aria-pressed={comment.likedByMe} onClick={onLike} disabled={busy}>{comment.likedByMe ? "Curtido" : "Curtir"}</button>
        {!comment.parent_comment_id && <button onClick={() => setReplying(value => !value)}>Responder</button>}
        <time dateTime={comment.created_at}>{formatDate(comment.created_at)}</time>
        {comment.likeCount > 0 && <span><Heart size={12} fill="currentColor" /> {comment.likeCount}</span>}
        {own && !editing && <><button onClick={() => setEditing(true)}>Editar</button><button onClick={onDelete}>Excluir</button></>}
        {!own && <button onClick={onReport}>Denunciar</button>}
      </div>
      {replying && <form className="social-reply-form" onSubmit={async event => { event.preventDefault(); if (!reply.trim()) return; await onReply(reply); setReply(""); setReplying(false); }}><textarea value={reply} maxLength={2000} onChange={event => setReply(event.target.value)} placeholder="Escreva uma resposta..." required /><button className="button primary small-button" disabled={busy}><Send size={14} /> Responder</button></form>}
    </div>
  </article>;
}

function PostMedia({ media, onOpen, reelMode = false, onReelWatch, autoAdvance = false, playbackRate = 1, onCaptionsAvailable, onRetry }) {
  const watchedMedia = useRef(new Set());
  const containerRef = useRef(null);
  const audioTrackCheckRef = useRef({ path: "", promise: null, hasAudio: null });
  const soundtrackRef = useRef(null);
  const soundEnabledRef = useRef(reelSoundEnabled);
  const reelVisibleRef = useRef(false);
  const [soundEnabled, setSoundEnabled] = useState(reelSoundEnabled);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [retryingMedia, setRetryingMedia] = useState(false);
  const mediaSourceKey = media?.map(item => item.url || item.storage_path || item.id).join("|") || "";
  useEffect(() => {
    setMediaFailed(false);
    setRetryingMedia(false);
  }, [mediaSourceKey]);
  useEffect(() => {
    const syncSoundPreference = event => {
      soundEnabledRef.current = event.detail;
      setSoundEnabled(event.detail);
    };
    window.addEventListener(REEL_SOUND_EVENT, syncSoundPreference);
    return () => window.removeEventListener(REEL_SOUND_EVENT, syncSoundPreference);
  }, []);
  useEffect(() => {
    if (!reelMode || !containerRef.current) return undefined;
    const video = containerRef.current.querySelector("video");
    if (!video) return undefined;
    const syncCaptions = () => onCaptionsAvailable?.(video.textTracks.length > 0);
    video.addEventListener("loadedmetadata", syncCaptions);
    syncCaptions();
    return () => video.removeEventListener("loadedmetadata", syncCaptions);
  }, [media, onCaptionsAvailable, reelMode]);
  useEffect(() => {
    if (!reelMode || !containerRef.current) return;
    const video = containerRef.current.querySelector("video");
    if (video) video.playbackRate = playbackRate;
  }, [media, playbackRate, reelMode]);
  useEffect(() => {
    if (!reelMode || !containerRef.current || typeof IntersectionObserver === "undefined") return undefined;
    const video = containerRef.current.querySelector("video");
    if (!video) return undefined;
    const reel = media.find(item => item.media_type === "video");
    if (!reel) return undefined;
    const soundtrack = new Audio(FORTALREEL_SOUNDTRACK_URL);
    soundtrack.loop = true;
    soundtrack.preload = "none";
    soundtrack.volume = 0.4;
    soundtrackRef.current = soundtrack;
    let intersects = false;
    let active = true;
    const stopSoundtrack = () => {
      soundtrack.pause();
      soundtrack.currentTime = 0;
    };
    const startSoundtrack = () => {
      soundtrack.play().catch(error => {
        if (error.name === "NotAllowedError") {
          soundEnabledRef.current = false;
          saveReelSoundPreference(false);
          setSoundEnabled(false);
          video.muted = true;
          return;
        }
        if (error.name === "AbortError") return;
        console.error("Não foi possível iniciar a trilha dos Reels.", error);
      });
    };
    const syncSoundtrack = (fromUserGesture = false) => {
      const enabled = soundEnabledRef.current;
      if (!active || !intersects || document.visibilityState !== "visible" || !enabled) {
        stopSoundtrack();
        video.muted = true;
        return;
      }
      if (audioTrackCheckRef.current.path !== reel.storage_path) {
        const check = {
          path: reel.storage_path,
          promise: inspectMp4AudioTrackUrl(reel.url),
          hasAudio: null,
        };
        check.promise = check.promise.then(hasAudio => {
          if (audioTrackCheckRef.current.path === reel.storage_path) {
            audioTrackCheckRef.current.hasAudio = hasAudio;
          }
          return hasAudio;
        });
        audioTrackCheckRef.current = check;
      }
      const audioCheck = audioTrackCheckRef.current;
      if (audioCheck.hasAudio === true) {
        stopSoundtrack();
        video.muted = false;
      } else {
        video.muted = true;
        if (audioCheck.hasAudio === false || fromUserGesture) startSoundtrack();
        else stopSoundtrack();
      }
      if (video.paused && !fromUserGesture) return;
      audioCheck.promise.then(hasAudio => {
        if (!active || !intersects || document.visibilityState !== "visible" || !soundEnabledRef.current) return;
        if (hasAudio === false) {
          video.muted = true;
          if (soundtrack.paused) startSoundtrack();
        } else if (hasAudio === true) {
          stopSoundtrack();
          video.muted = false;
        } else {
          stopSoundtrack();
          video.muted = false;
        }
      }).catch(error => console.error("Não foi possível verificar o áudio original do Reel.", error));
    };
    const syncPlayback = () => {
      reelVisibleRef.current = intersects && document.visibilityState === "visible";
      if (intersects && document.visibilityState === "visible") {
        syncSoundtrack();
        video.play().catch(error => {
          if (error.name === "AbortError") return;
          if (!soundEnabledRef.current || error.name !== "NotAllowedError") {
            console.error("Não foi possível iniciar a reprodução do Reel.", error);
            return;
          }
          soundEnabledRef.current = false;
          saveReelSoundPreference(false);
          setSoundEnabled(false);
          stopSoundtrack();
          video.muted = true;
          video.play().catch(retryError => console.error("Não foi possível iniciar a reprodução do Reel.", retryError));
        });
      } else {
        video.pause();
        stopSoundtrack();
      }
    };
    const handleVideoPlay = () => syncSoundtrack();
    const handleVideoPause = () => stopSoundtrack();
    const observer = new IntersectionObserver(entries => {
      intersects = entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.65);
      syncPlayback();
    }, { threshold: [0, 0.65, 1] });
    observer.observe(containerRef.current);
    document.addEventListener("visibilitychange", syncPlayback);
    video.addEventListener("play", handleVideoPlay);
    video.addEventListener("pause", handleVideoPause);
    return () => {
      active = false;
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncPlayback);
      video.removeEventListener("play", handleVideoPlay);
      video.removeEventListener("pause", handleVideoPause);
      reelVisibleRef.current = false;
      video.pause();
      stopSoundtrack();
      soundtrack.removeAttribute("src");
      soundtrack.load();
      if (soundtrackRef.current === soundtrack) soundtrackRef.current = null;
    };
  }, [media, reelMode]);
  const toggleReelSound = event => {
    const video = event.currentTarget.parentElement?.querySelector("video");
    if (!video) return;
    const next = !soundEnabledRef.current;
    soundEnabledRef.current = next;
    video.muted = !next;
    saveReelSoundPreference(next);
    setSoundEnabled(next);
    if (next) {
      const soundtrack = soundtrackRef.current;
      const reel = media.find(item => item.media_type === "video");
      const hasOriginalAudio = reel && audioTrackCheckRef.current.path === reel.storage_path
        ? audioTrackCheckRef.current.hasAudio
        : null;
      if (reelVisibleRef.current && hasOriginalAudio !== true) {
        video.muted = true;
        if (soundtrack) soundtrack.play().catch(error => {
          if (error.name === "NotAllowedError") {
            soundEnabledRef.current = false;
            saveReelSoundPreference(false);
            setSoundEnabled(false);
            video.muted = true;
          } else if (error.name !== "AbortError") {
            console.error("Não foi possível iniciar a trilha dos Reels.", error);
          }
        });
      } else if (hasOriginalAudio === true) {
        video.muted = false;
      }
      if (reelVisibleRef.current && video.paused) video.play().catch(error => {
        if (error.name !== "AbortError") console.error("Não foi possível iniciar a reprodução do Reel com som.", error);
      });
    } else if (soundtrackRef.current) {
      soundtrackRef.current.pause();
      soundtrackRef.current.currentTime = 0;
    }
  };
  const retryReelMedia = async event => {
    event.stopPropagation();
    if (retryingMedia) return;
    setRetryingMedia(true);
    try {
      if (onRetry) await onRetry();
      else {
        const video = containerRef.current?.querySelector("video");
        if (video) {
          video.load();
          await video.play();
        }
        setMediaFailed(false);
      }
    } catch (error) {
      console.error("Não foi possível atualizar o vídeo do Reel.", error);
    } finally {
      setRetryingMedia(false);
    }
  };
  if (!media?.length) return null;
  const hasVideo = media.some(item => item.media_type === "video");
  return <div ref={containerRef} className={`social-media-grid count-${Math.min(media.length, 4)}${hasVideo && !reelMode ? " has-landscape-video" : ""}`}>
    {media.slice(0, 4).map((item, index) => <div key={item.id || item.storage_path} className={`social-media-item${item.media_type === "video" && !reelMode ? " is-landscape-video" : ""}`}>
      {item.media_type === "video"
        ? <><video src={item.url} controls={!reelMode} playsInline preload={reelMode ? "none" : "metadata"} loop={reelMode && !autoAdvance} muted={reelMode ? true : undefined} tabIndex={reelMode ? 0 : undefined} aria-label={reelMode ? (isPlaying ? "Pausar vídeo do Reel" : "Reproduzir vídeo do Reel") : undefined} onError={reelMode ? () => { setIsPlaying(false); setMediaFailed(true); } : undefined} onCanPlay={reelMode ? () => setMediaFailed(false) : undefined} onEnded={reelMode && autoAdvance ? event => event.currentTarget.closest(".social-reel-card")?.nextElementSibling?.scrollIntoView({ behavior: "smooth", block: "start" }) : undefined} onPlay={reelMode ? () => { setIsPlaying(true); setMediaFailed(false); } : undefined} onPause={reelMode ? () => setIsPlaying(false) : undefined} onClick={reelMode ? event => {
          const video = event.currentTarget;
          if (video.paused) video.play().catch(error => console.error("Não foi possível iniciar a reprodução do Reel.", error));
          else video.pause();
        } : undefined} onKeyDown={reelMode ? event => {
          if (event.key !== " " && event.key !== "Enter") return;
          event.preventDefault();
          const video = event.currentTarget;
          if (video.paused) video.play().catch(error => console.error("Não foi possível iniciar a reprodução do Reel.", error));
          else video.pause();
        } : undefined} onTimeUpdate={event => {
          if (!reelMode || !onReelWatch || watchedMedia.current.has(item.id || item.storage_path)) return;
          const video = event.currentTarget;
          const threshold = video.duration > 0 ? Math.min(3, video.duration / 2) : Infinity;
          if (video.currentTime < threshold) return;
          const mediaKey = item.id || item.storage_path;
          watchedMedia.current.add(mediaKey);
          void onReelWatch();
        }} />{reelMode && <>
          {mediaFailed
            ? <button type="button" className="social-reel-media-error" onClick={retryReelMedia} disabled={retryingMedia} aria-label="Tentar carregar o vídeo do Reel">{retryingMedia ? <LoaderCircle className="spin" size={20} /> : <Play size={20} fill="currentColor" />}<span>{retryingMedia ? "Reconectando…" : "Não foi possível carregar o vídeo. Tentar novamente"}</span></button>
            : !isPlaying && <button type="button" className="social-reel-play" onClick={event => {
            event.stopPropagation();
            const video = event.currentTarget.parentElement?.querySelector("video");
            video?.play().catch(error => console.error("Não foi possível iniciar a reprodução do Reel.", error));
          }} aria-label="Reproduzir Reel"><Play size={27} fill="currentColor" /></button>}
          <button type="button" className="social-reel-sound" onClick={toggleReelSound} aria-label={soundEnabled ? "Desativar som do Reel" : "Ativar som do Reel"}>{soundEnabled ? <Volume2 size={21} /> : <VolumeX size={21} />}</button>
        </>}</>
        : <button type="button" onClick={() => onOpen(media, index)} aria-label={`Ampliar mídia ${index + 1}`}><img src={item.url} alt={`Mídia da publicação ${index + 1}`} loading="lazy" />{index === 3 && media.length > 4 && <span>+{media.length - 4}</span>}</button>}
    </div>)}
  </div>;
}

function CreatePost({ client, userId, onPublished, notify, videosOnly = false, soundtrackByDefault = false }) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState([]);
  const [visibility, setVisibility] = useState("public");
  const [commercialContent, setCommercialContent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [videoEditorFile, setVideoEditorFile] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const reelPostId = useRef("");
  if (!reelPostId.current) reelPostId.current = createSecureId();

  const chooseFiles = event => {
    const selected = Array.from(event.target.files || []);
    if (videosOnly) {
      if (!selected.length) return;
      if (selected.length !== 1) {
        notify("Selecione um único vídeo para o FortalReels.");
        event.target.value = "";
        return;
      }
      setVideoEditorFile(selected[0]);
      event.target.value = "";
      return;
    }
    const current = files.length;
    if (current + selected.length > 10) {
      notify("Adicione no máximo 10 fotos ou vídeos por publicação.");
      event.target.value = "";
      return;
    }
    for (const file of selected) {
      const image = file.type.startsWith("image/") && ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type);
      const video = ["video/mp4", "video/webm"].includes(file.type);
      if (!image && !video) {
        notify("Use imagens JPG, PNG, WEBP ou GIF e vídeos MP4 ou WebM.");
        event.target.value = "";
        return;
      }
      if (file.size > (video ? 40 : 15) * 1024 * 1024) {
        notify(`Cada ${video ? "vídeo" : "imagem"} pode ter até ${video ? "40" : "15"} MB.`);
        event.target.value = "";
        return;
      }
    }
    setFiles(currentFiles => [...currentFiles, ...selected]);
    event.target.value = "";
  };

  const submit = async event => {
    event.preventDefault();
    if (!body.trim() && !files.length) {
      notify("Escreva uma mensagem ou adicione uma foto ou vídeo.");
      return;
    }
    setBusy(true);
    try {
      if (videosOnly) {
        const file = files[0];
        const media = await inspectReelVideo(file);
        if (!isFortalReelRatio(media.width, media.height)) {
          throw new Error("O vídeo final precisa estar no formato vertical 9:16. Recorte o vídeo antes de publicar.");
        }
        if (!isFortalReelDurationAllowed(media.duration)) {
          throw new Error(`O vídeo final não pode ultrapassar ${FORTALREEL_MAX_DURATION_SECONDS} segundos.`);
        }
      }
      await publishPost(client, userId, {
        body,
        files,
        visibility,
        isReel: videosOnly,
        commercialContent,
        postId: videosOnly ? reelPostId.current : "",
      });
      setBody("");
      setFiles([]);
      setCommercialContent(false);
      reelPostId.current = createSecureId();
      notify(videosOnly ? "Reel publicado no FortalReels." : "Publicação enviada para a comunidade.");
      try {
        await onPublished();
      } catch (refreshError) {
        console.error("Publicação concluída, mas não foi possível atualizar o Feed.", refreshError);
        notify("Publicação concluída. Atualize o Feed para visualizá-la.");
      }
    } catch (error) {
      console.error("Falha ao publicar no Feed.", error);
      notify(getErrorMessage(error, "Não foi possível publicar. Sua publicação não foi enviada."));
    } finally {
      setBusy(false);
    }
  };

  return <>
  <form id={videosOnly ? undefined : "social-create-post"} className={`social-create-post${videosOnly ? " social-reel-create-post" : ""}`} onSubmit={submit}>
    <label className="social-create-text"><span className="sr-only">{videosOnly ? "Legenda do Reel" : "Texto da publicação"}</span><textarea value={body} maxLength={5000} rows={3} onChange={event => setBody(event.target.value)} placeholder={videosOnly ? "Escreva uma legenda para seu Reel..." : "Compartilhe uma conquista, dica de treino ou novidade do esporte..."} /><small>{body.length}/5.000</small></label>
    {!!files.length && <div className="social-file-list">{files.map((file, index) => <span key={`${file.name}-${index}`}>{file.type.startsWith("video/") ? <Video size={14} /> : <ImagePlus size={14} />}{file.name}<button type="button" aria-label={`Remover ${file.name}`} onClick={() => setFiles(current => current.filter((_, itemIndex) => itemIndex !== index))}><X size={14} /></button></span>)}</div>}
    <div className="social-create-footer">
      {videosOnly && <button className="button subtle small-button" type="button" onClick={() => setCameraOpen(true)}><Camera size={16} /> Gravar vertical</button>}
      <label className="button subtle small-button social-file-picker">{videosOnly ? <Clapperboard size={16} /> : <ImagePlus size={16} />}{videosOnly ? " Escolher vídeo" : " Foto/vídeo esportivo"}<input type="file" accept={videosOnly ? "video/mp4,video/webm,video/quicktime" : "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"} multiple={!videosOnly} onChange={chooseFiles} /></label>
      <label className="social-visibility"><input type="checkbox" checked={commercialContent} onChange={event => setCommercialContent(event.target.checked)} /><span>Conteúdo comercial</span></label>
      <label className="social-visibility"><ShieldCheck size={14} /><select value={visibility} onChange={event => setVisibility(event.target.value)}><option value="public">Público</option><option value="followers">Seguidores</option></select><ChevronDown size={13} /></label>
      <button className="button primary small-button" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : <Send size={15} />} {videosOnly ? "Publicar Reel" : "Publicar"}</button>
    </div>
    {commercialContent && <p className="professional-inline-status">O backend só publica conteúdo comercial vinculado a uma empresa aprovada com permissão de publicidade.</p>}
  </form>
  {videoEditorFile && <ReelVideoEditor file={videoEditorFile} soundtrackByDefault={soundtrackByDefault} onCancel={() => setVideoEditorFile(null)} onReady={async file => {
    const metadata = await inspectReelVideo(file);
    if (!isFortalReelRatio(metadata.width, metadata.height) || metadata.duration > FORTALREEL_MAX_DURATION_SECONDS) {
      throw new Error(`O vídeo final precisa estar no formato 9:16 e ter no máximo ${FORTALREEL_MAX_DURATION_SECONDS} segundos.`);
    }
    setFiles([file]);
    setVideoEditorFile(null);
  }} notify={notify} />}
  {cameraOpen && <ReelCameraRecorder onCancel={() => setCameraOpen(false)} onCaptured={file => {
    setCameraOpen(false);
    setVideoEditorFile(file);
  }} />}
  </>;
}

function SocialPost({ post, userId, client, onRefresh, notify, reelMode = false, onCreateReel }) {
  const [comments, setComments] = useState([]);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const [commentsError, setCommentsError] = useState("");
  const [commentText, setCommentText] = useState("");
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareText, setShareText] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("Spam ou conteúdo enganoso");
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [lightboxMedia, setLightboxMedia] = useState([]);
  const [followingAuthor, setFollowingAuthor] = useState(false);
  const [authorFollowRequest, setAuthorFollowRequest] = useState("");
  const [followStateLoaded, setFollowStateLoaded] = useState(false);
  const followStateRevision = useRef(0);
  const [saved, setSaved] = useState(Boolean(post.savedByMe));
  const [liked, setLiked] = useState(Boolean(post.likedByMe));
  const [likeCount, setLikeCount] = useState(post.likeCount || 0);
  const [playbackRate, setPlaybackRate] = useState(() => {
    try {
      const storedRate = Number(window.localStorage.getItem("fortalfy.reels.playbackRate"));
      return [0.75, 1, 1.25, 1.5, 2].includes(storedRate) ? storedRate : 1;
    } catch { return 1; }
  });
  const [autoAdvance, setAutoAdvance] = useState(() => {
    try { return window.localStorage.getItem("fortalfy.reels.autoAdvance") === "true"; } catch { return false; }
  });
  const [captionsAvailable, setCaptionsAvailable] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [reelViewCount, setReelViewCount] = useState(Number(post.reelViewCount) || 0);
  const reportedReelViews = useRef(new Set());
  const commentsPanelRef = useRef(null);
  const own = post.author_id === userId;
  const longBody = post.body.length > 150;
  const displayBody = expanded || !longBody ? post.body : `${post.body.slice(0, 500)}…`;
  const childComments = useMemo(() => {
    const roots = comments.filter(comment => !comment.parent_comment_id);
    return roots.map(root => ({ ...root, replies: comments.filter(comment => comment.parent_comment_id === root.id) }));
  }, [comments]);
  useEffect(() => {
    setSaved(Boolean(post.savedByMe));
  }, [post.id, post.savedByMe]);
  useEffect(() => {
    setLiked(Boolean(post.likedByMe));
    setLikeCount(post.likeCount || 0);
  }, [post.id, post.likedByMe, post.likeCount]);
  useEffect(() => {
    setReelViewCount(Number(post.reelViewCount) || 0);
  }, [post.id, post.reelViewCount]);
  useEffect(() => {
    if (!reelMode || !commentsOpen) return undefined;
    const closeOnOutsidePointer = event => {
      if (!(event.target instanceof Element)) return;
      if (commentsPanelRef.current?.contains(event.target)) return;
      if (event.target.closest('.social-reel-actions button[aria-label^="Comentar"]')) return;
      setCommentsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [commentsOpen, reelMode]);
  useEffect(() => {
    if (own) return undefined;
    let active = true;
    const revision = followStateRevision.current;
    setFollowStateLoaded(false);
    loadFollowState(client, userId, post.author_id)
      .then(state => {
        if (!active || followStateRevision.current !== revision) return;
        setFollowingAuthor(state.isFollowing);
        setAuthorFollowRequest(state.requestStatus);
        setFollowStateLoaded(true);
      })
      .catch(error => {
        console.error("Não foi possível carregar o estado de seguimento.", error);
        if (active) setFollowStateLoaded(true);
      });
    return () => { active = false; };
  }, [client, userId, post.author_id, own]);
  useEffect(() => {
    const syncFollowState = event => {
      const { followerId, followedId, isFollowing, requestStatus } = event.detail;
      if (followerId !== userId || followedId !== post.author_id) return;
      followStateRevision.current += 1;
      setFollowingAuthor(isFollowing);
      setAuthorFollowRequest(requestStatus);
      setFollowStateLoaded(true);
    };
    window.addEventListener(FOLLOW_STATE_EVENT, syncFollowState);
    return () => window.removeEventListener(FOLLOW_STATE_EVENT, syncFollowState);
  }, [userId, post.author_id]);
  useEffect(() => {
    const syncAutoAdvance = event => setAutoAdvance(Boolean(event.detail));
    const syncPlaybackRate = event => setPlaybackRate(Number(event.detail) || 1);
    window.addEventListener(REEL_AUTO_ADVANCE_EVENT, syncAutoAdvance);
    window.addEventListener(REEL_SPEED_EVENT, syncPlaybackRate);
    return () => {
      window.removeEventListener(REEL_AUTO_ADVANCE_EVENT, syncAutoAdvance);
      window.removeEventListener(REEL_SPEED_EVENT, syncPlaybackRate);
    };
  }, []);

  const doAction = async (action, successMessage) => {
    setBusy(true);
    try {
      await action();
      if (successMessage) notify(successMessage);
      return true;
    } catch (error) {
      console.error("Falha em uma interação do Feed.", error);
      notify(getErrorMessage(error));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const registerReelView = async () => {
    if (reportedReelViews.current.has(post.id)) return;
    reportedReelViews.current.add(post.id);
    try {
      const recorded = await recordReelView(client, userId, post.id);
      if (recorded) setReelViewCount(count => count + 1);
    } catch (error) {
      console.error("Falha ao registrar a visualização do Reel.", error);
      notify(getErrorMessage(error, "Não foi possível registrar a visualização do Reel."));
    }
  };
  const toggleLike = async () => {
    const next = !liked;
    setLiked(next);
    setLikeCount(count => Math.max(0, count + (next ? 1 : -1)));
    if (await doAction(() => setPostLike(client, userId, post.id, next), next ? "Publicação curtida." : "Curtida removida.")) {
      await onRefresh();
    } else {
      setLiked(!next);
      setLikeCount(count => Math.max(0, count + (next ? -1 : 1)));
    }
  };
  const openComments = async () => {
    const opening = !commentsOpen;
    setCommentsOpen(opening);
    if (!opening) return;
    setCommentsLoading(true);
    await refreshComments();
    setCommentsLoading(false);
  };
  const refreshComments = async () => {
    try {
      const result = await loadComments(client, userId, post.id);
      setComments(result.comments);
      setCommentsHasMore(result.hasMore);
      setCommentsError("");
    } catch (error) {
      console.error("Falha ao atualizar comentários.", error);
      setCommentsError(getErrorMessage(error, "Não foi possível atualizar os comentários."));
    }
  };
  const loadMoreComments = async () => {
    setCommentsLoading(true);
    try {
      const result = await loadComments(client, userId, post.id, { offset: comments.length });
      setComments(current => [...current, ...result.comments]);
      setCommentsHasMore(result.hasMore);
    } catch (error) {
      console.error("Falha ao carregar mais comentários.", error);
      setCommentsError(getErrorMessage(error, "Não foi possível carregar mais comentários."));
    } finally {
      setCommentsLoading(false);
    }
  };
  const submitComment = async event => {
    event.preventDefault();
    if (!commentText.trim()) return;
    if (!await doAction(() => addComment(client, userId, post.id, commentText))) return;
    setCommentText("");
    await Promise.all([refreshComments(), onRefresh()]);
  };
  const toggleCommentLike = async comment => {
    const next = !comment.likedByMe;
    setComments(current => current.map(item => item.id === comment.id
      ? { ...item, likedByMe: next, likeCount: Math.max(0, item.likeCount + (next ? 1 : -1)) }
      : item));
    if (!await doAction(() => setCommentLike(client, userId, comment.id, next))) await refreshComments();
  };
  const handleShare = async event => {
    event.preventDefault();
    if (!await doAction(() => sharePost(client, userId, post.id, shareText), "Publicação compartilhada no Feed.")) return;
    setShareOpen(false);
    setShareText("");
    await onRefresh();
  };
  const copyLink = async () => {
    try {
      const url = `${window.location.origin}${window.location.pathname}#/feed?post=${post.id}`;
      await navigator.clipboard.writeText(url);
      notify("Link da publicação copiado.");
    } catch (error) {
      console.error("Falha ao copiar o link da publicação.", error);
      notify("Não foi possível copiar o link neste navegador.");
    }
    setMenuOpen(false);
  };
  const bookmark = async () => {
    if (await doAction(() => setBookmark(client, userId, post.id, !saved), saved ? "Publicação removida dos salvos." : "Publicação salva na sua conta.")) {
      setSaved(!saved);
      post.savedByMe = !saved;
      setMenuOpen(false);
    }
  };
  const choosePlaybackRate = rate => {
    setPlaybackRate(rate);
    try { window.localStorage.setItem("fortalfy.reels.playbackRate", String(rate)); } catch (error) {
      console.error("Não foi possível salvar a velocidade de reprodução do FortalReels.", error);
    }
    window.dispatchEvent(new CustomEvent(REEL_SPEED_EVENT, { detail: rate }));
    const video = document.getElementById(`post-${post.id}`)?.querySelector("video");
    if (video) video.playbackRate = rate;
  };
  const toggleAutoAdvance = () => {
    const next = !autoAdvance;
    setAutoAdvance(next);
    try { window.localStorage.setItem("fortalfy.reels.autoAdvance", String(next)); } catch (error) {
      console.error("Não foi possível salvar a preferência de rolagem do FortalReels.", error);
    }
    window.dispatchEvent(new CustomEvent(REEL_AUTO_ADVANCE_EVENT, { detail: next }));
  };
  const toggleCaptions = () => {
    const video = document.getElementById(`post-${post.id}`)?.querySelector("video");
    const tracks = Array.from(video?.textTracks || []);
    if (!tracks.length) {
      notify("Este Reel não oferece legendas.");
      return;
    }
    const next = !captionsEnabled;
    tracks.forEach(track => { track.mode = next ? "showing" : "hidden"; });
    setCaptionsEnabled(next);
  };
  const toggleFollow = async () => {
    const result = await doAction(() => authorFollowRequest === "pending"
      ? cancelFollowRequest(client, userId, post.author_id)
      : persistFollow(client, userId, post.author_id, !followingAuthor, post.author?.isPrivate));
    if (result) {
      if (authorFollowRequest === "pending") {
        setAuthorFollowRequest("");
        publishFollowState(userId, post.author_id, false);
        notify("Solicitação cancelada.");
      } else {
        const isFollowing = result === "following";
        const requestStatus = result === "requested" ? "pending" : "";
        setFollowingAuthor(isFollowing);
        setAuthorFollowRequest(requestStatus);
        publishFollowState(userId, post.author_id, isFollowing, requestStatus);
        notify(requestStatus ? "Solicitação de seguimento enviada." : isFollowing ? "Perfil seguido." : "Você deixou de seguir este perfil.");
      }
      await onRefresh();
    }
    setMenuOpen(false);
  };
  const editPost = async () => {
    const next = window.prompt("Editar publicação", post.body);
    if (next == null || next.trim() === post.body) return;
    if (!next.trim()) {
      notify("Uma publicação com mídia não pode ficar sem texto vazio nesta edição.");
      return;
    }
    if (await doAction(() => updatePost(client, post.id, next), "Publicação atualizada.")) await onRefresh();
  };
  const removePost = async () => {
    if (!window.confirm("Excluir esta publicação? Essa ação não pode ser desfeita.")) return;
    if (await doAction(() => deletePost(client, post.id), "Publicação excluída.")) await onRefresh();
  };
  const report = async () => {
    setReportReason("Spam ou conteúdo enganoso");
    setReportOpen(true);
    setMenuOpen(false);
  };
  const submitReport = async event => {
    event.preventDefault();
    if (await doAction(() => post.commercial_content
      ? reportCommercialContent(client, "post", post.id, reportReason)
      : reportPost(client, userId, post.id, reportReason), "Denúncia enviada à moderação.")) setReportOpen(false);
  };
  const reportAComment = async comment => {
    const reason = window.prompt("Por que deseja denunciar este comentário? (mínimo de 3 caracteres)");
    if (reason == null) return;
    if (reason.trim().length < 3) {
      notify("Descreva o motivo da denúncia.");
      return;
    }
    await doAction(() => reportComment(client, userId, comment.id, reason.trim()), "Denúncia de comentário enviada à moderação.");
  };
  const hide = async () => {
    if (await doAction(() => hidePost(client, userId, post.id), "Publicação ocultada do seu Feed.")) await onRefresh();
    setMenuOpen(false);
  };

  const postMenu = <div className={`social-post-menu-wrap${reelMode ? " social-reel-settings-wrap" : ""}`}>
    <button className="social-icon-button" aria-label="Opções da publicação" aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}><MoreHorizontal size={20} /></button>
    {menuOpen && <div className={`social-post-menu${reelMode ? " social-reel-settings-menu" : ""}`}>
      {reelMode && <section className="social-reel-player-settings" aria-label="Configurações de reprodução">
        <strong>Velocidade</strong>
        <div role="group" aria-label="Velocidade de reprodução">{[0.75, 1, 1.25, 1.5, 2].map(rate => <button type="button" key={rate} className={playbackRate === rate ? "is-selected" : ""} aria-pressed={playbackRate === rate} onClick={() => choosePlaybackRate(rate)}>{`${rate.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}x`}</button>)}</div>
        <strong>Qualidade</strong><p>Automática <span>Este Reel não oferece versões em outras resoluções.</span></p>
        <button type="button" onClick={toggleAutoAdvance}>{autoAdvance ? <Check size={14} /> : <Play size={14} />}{`Rolagem automática: ${autoAdvance ? "ativada" : "desativada"}`}</button>
        <button type="button" onClick={toggleCaptions} disabled={!captionsAvailable}>{captionsEnabled ? <Check size={14} /> : <MessageCircle size={14} />}{captionsAvailable ? (captionsEnabled ? "Desativar legendas" : "Ativar legendas") : "Legendas indisponíveis"}</button>
      </section>}
      {reelMode && onCreateReel && <button type="button" onClick={() => { setMenuOpen(false); onCreateReel(); }}><Video size={14} /> Criar Reel</button>}
      {own && <><button onClick={editPost}>Editar publicação</button><button className="danger-action" onClick={removePost}>Excluir publicação</button></>}
      <button onClick={bookmark}><Bookmark size={14} /> {saved ? "Remover dos salvos" : "Salvar publicação"}</button>
      <button onClick={copyLink}>Copiar link</button>
      {!own && <button onClick={hide}>{reelMode ? "Não tenho interesse" : "Ocultar publicação"}</button>}
      {!own && <><button onClick={toggleFollow}>{followingAuthor ? <UserMinus size={14} /> : <UserPlus size={14} />}{authorFollowRequest === "pending" ? "Cancelar solicitação" : followingAuthor ? "Deixar de seguir" : post.author?.isPrivate ? "Solicitar para seguir" : "Seguir autor"}</button><button className="danger-action" onClick={report}><CircleAlert size={14} /> Denunciar</button></>}
    </div>}
  </div>;
  const authorHeader = <header className={`social-post-header${reelMode ? " social-reel-author-header" : ""}`}>
    <AuthorLink author={post.author} ownId={userId} />
    <div className="social-post-author">
      <Link to={own ? "/profile" : `/profile/${post.author?.id}`}><strong>{post.author?.name || "Pessoa Fortalfy"}</strong>{post.author?.verified && <VerificationBadge />}</Link>
      {reelMode
        ? <span className="social-reel-author-meta">{post.author?.username && <><span className="social-reel-handle">@{post.author.username}</span><span aria-hidden="true">·</span></>}{communityRole(post.author?.kind) || "Criador Fortalfy"}<span aria-hidden="true">·</span>{post.visibility === "followers" ? "Seguidores" : "Público"}{post.commercial_content && <><span aria-hidden="true">·</span>Publicidade</>}</span>
        : <span>{post.commercial_content && <><strong className="social-author-role">Publicidade</strong> · </>}{communityRole(post.author?.kind) && <><strong className="social-author-role">{communityRole(post.author.kind)}</strong> · </>}<time dateTime={post.published_at}>{formatDate(post.published_at)}</time> · <Users size={12} /> {post.visibility === "followers" ? "Seguidores" : "Público"}</span>}
    </div>
    {!reelMode && !own && <button type="button" className={`social-reel-follow social-post-follow${followingAuthor || authorFollowRequest === "pending" ? " is-following" : ""}`} onClick={toggleFollow} disabled={busy || !followStateLoaded} aria-label={authorFollowRequest === "pending" ? "Cancelar solicitação para seguir" : followingAuthor ? `Deixar de seguir ${post.author?.name || "perfil"}` : `Seguir ${post.author?.name || "perfil"}`}>{authorFollowRequest === "pending" ? "Solicitado" : followingAuthor ? <><UserMinus size={14} /> Seguindo</> : <><UserPlus size={14} /> Seguir</>}</button>}
    {reelMode && !own && <button type="button" className={`social-reel-follow-inline${followingAuthor || authorFollowRequest === "pending" ? " is-following" : ""}`} onClick={toggleFollow} disabled={busy || !followStateLoaded} aria-label={authorFollowRequest === "pending" ? "Cancelar solicitação para seguir" : followingAuthor ? "Deixar de seguir criador" : "Seguir criador"}>{authorFollowRequest === "pending" ? "Solicitado" : followingAuthor ? "Seguindo" : "+ Seguir"}</button>}
    {!reelMode && postMenu}
  </header>;
  const postDescription = !!post.body && <div className={`social-post-text${expanded ? " is-expanded" : " is-collapsed"}`}><LinkifiedText text={displayBody} />{longBody && <button className="social-text-toggle" onClick={() => setExpanded(value => !value)}>{expanded ? "menos" : "mais"}</button>}</div>;
  const postActions = <div className={`social-post-actions${reelMode ? " social-reel-actions" : ""}`}>
    <button className={liked ? "is-liked" : ""} aria-pressed={liked} aria-label={reelMode ? `${liked ? "Descurtir" : "Curtir"} · ${formatCompactCount(likeCount)} curtidas` : undefined} onClick={toggleLike} disabled={busy}><Heart size={reelMode ? 25 : 18} fill={liked ? "currentColor" : "none"} /><span>{reelMode ? formatCompactCount(likeCount) : "Curtir"}</span></button>
    <button aria-label={reelMode ? `Comentar · ${formatCompactCount(post.commentCount)} comentários` : undefined} onClick={openComments}><MessageCircle size={reelMode ? 25 : 18} /><span>{reelMode ? formatCompactCount(post.commentCount) : "Comentar"}</span></button>
    <button aria-label={reelMode ? `Compartilhar · ${formatCompactCount(post.shareCount)} compartilhamentos` : undefined} onClick={() => setShareOpen(true)}><Share2 size={reelMode ? 24 : 18} /><span>{reelMode ? formatCompactCount(post.shareCount) : "Compartilhar"}</span></button>
    {reelMode && <button className={saved ? "is-liked" : ""} aria-pressed={saved} aria-label={saved ? "Remover Reel dos salvos" : "Salvar Reel"} onClick={bookmark} disabled={busy}><Bookmark size={23} fill={saved ? "currentColor" : "none"} /><span>{saved ? "Salvo" : "Salvar"}</span></button>}
  </div>;
  const reelFollowLabel = authorFollowRequest === "pending"
    ? "Cancelar solicitação para seguir"
    : followingAuthor ? `Deixar de seguir ${post.author?.name || "perfil"}` : `Seguir ${post.author?.name || "perfil"}`;

  const reelInfo = <aside className="social-reel-info">
    <div className="social-reel-caption">{authorHeader}{postDescription}</div>
    <div className="social-reel-side-rail">
      <div className="social-reel-creator-action">
        <AuthorLink author={post.author} ownId={userId} />
        {!own && <button type="button" className={`social-reel-follow-badge${followingAuthor || authorFollowRequest === "pending" ? " is-following" : ""}`} onClick={toggleFollow} disabled={busy || !followStateLoaded} aria-label={reelFollowLabel} title={reelFollowLabel}>
          {followingAuthor || authorFollowRequest === "pending" ? <Check size={14} /> : <UserPlus size={14} />}
        </button>}
      </div>
      {postActions}
    </div>
    <div className="social-reel-view-count"><Eye size={15} /> {formatCompactCount(reelViewCount)} {"visualiza\u00e7\u00f5es"}</div>
  </aside>;

  return <article className={`social-post-card${reelMode ? " social-reel-card" : ""}`} id={`post-${post.id}`}>
    {post.shared_post_id && <div className="social-shared-label"><Share2 size={14} /> {post.author?.name || "Uma pessoa"} compartilhou</div>}
    {reelMode
      ? reelInfo
      : <>{authorHeader}{postDescription}</>}
    {reelMode && <div className="social-reel-top-menu">{postMenu}</div>}
    {post.media?.length > 0 && <PostMedia media={post.media} reelMode={reelMode} onReelWatch={registerReelView} autoAdvance={autoAdvance} playbackRate={playbackRate} onCaptionsAvailable={setCaptionsAvailable} onRetry={reelMode ? onRefresh : undefined} onOpen={(media, index) => { setLightboxMedia(media); setLightboxIndex(index); }} />}
    {post.original && <div className="social-original-post"><div className="social-original-author"><AuthorLink author={post.original.author} ownId={userId} /><span><strong>{post.original.author?.name}</strong><small>{formatDate(post.original.published_at)}</small></span></div><LinkifiedText text={post.original.body} /><PostMedia media={post.original.media} reelMode={reelMode} onReelWatch={registerReelView} onOpen={(media, index) => { setLightboxMedia(media); setLightboxIndex(index); }} /></div>}
    <div className="social-post-stats"><span>{likeCount > 0 && <><Heart size={14} fill="currentColor" /> {likeCount} curtida{likeCount === 1 ? "" : "s"}</>}</span><span>{reelMode && <><Eye size={14} /> {reelViewCount} visualizaç{reelViewCount === 1 ? "ão" : "ões"} · </>}{post.commentCount} comentário{post.commentCount === 1 ? "" : "s"} · {post.shareCount} compartilhamento{post.shareCount === 1 ? "" : "s"}</span></div>
    {!reelMode && postActions}
    {commentsOpen && <section className="social-comments" ref={commentsPanelRef}><header className="social-reel-comments-header"><strong>Comentários</strong><span>{formatCompactCount(post.commentCount)}</span><button type="button" onClick={() => setCommentsOpen(false)} aria-label="Fechar comentários"><X size={18} /></button></header>
      {commentsLoading ? <p className="social-inline-status"><LoaderCircle className="spin" size={16} /> Carregando comentários…</p>
        : commentsError ? <p className="social-inline-error">{commentsError}<button onClick={async () => { setCommentsLoading(true); await refreshComments(); setCommentsLoading(false); }}>Tentar novamente</button></p>
          : !childComments.length ? <p className="social-empty-comments">Seja a primeira pessoa a comentar.</p>
            : childComments.map(comment => <div className="social-comment-group" key={comment.id}><SocialComment
              comment={comment} userId={userId} busy={busy}
              onLike={() => toggleCommentLike(comment)}
              onEdit={async body => { if (await doAction(() => updateComment(client, comment.id, body), "Comentário editado.")) await refreshComments(); }}
              onDelete={async () => { if (!window.confirm("Excluir este comentário e suas respostas?")) return; if (await doAction(() => deleteComment(client, comment.id), "Comentário excluído.")) { await refreshComments(); await onRefresh(); } }}
              onReply={async body => { if (await doAction(() => addComment(client, userId, post.id, body, comment.id), "Resposta publicada.")) { await refreshComments(); await onRefresh(); } }}
              onReport={() => reportAComment(comment)}
            />{comment.replies.map(reply => <SocialComment key={reply.id}
              comment={reply} userId={userId} busy={busy}
              onLike={() => toggleCommentLike(reply)}
              onEdit={async body => { if (await doAction(() => updateComment(client, reply.id, body), "Resposta editada.")) await refreshComments(); }}
              onDelete={async () => { if (!window.confirm("Excluir esta resposta?")) return; if (await doAction(() => deleteComment(client, reply.id), "Resposta excluída.")) { await refreshComments(); await onRefresh(); } }}
              onReply={() => {}}
              onReport={() => reportAComment(reply)}
            />)}</div>)}
      {!commentsLoading && commentsHasMore && <button className="social-comments-more" onClick={loadMoreComments}>Carregar mais comentários</button>}
      <form className="social-comment-form" onSubmit={submitComment}><textarea value={commentText} maxLength={2000} rows={1} onChange={event => setCommentText(event.target.value)} placeholder="Escreva um comentário..." required /><button className="button primary small-button" disabled={busy || !commentText.trim()} aria-label="Enviar comentário"><Send size={15} /></button></form>
    </section>}
    {shareOpen && <div className="social-share-scrim" role="presentation" onMouseDown={event => event.target === event.currentTarget && setShareOpen(false)}><section className="social-share-dialog" role="dialog" aria-modal="true" aria-label="Compartilhar publicação"><header><strong>Compartilhar no Feed</strong><button className="social-icon-button" onClick={() => setShareOpen(false)} aria-label="Fechar"><X size={18} /></button></header><textarea value={shareText} maxLength={2000} onChange={event => setShareText(event.target.value)} placeholder="Escreva algo sobre esta publicação (opcional)" /><button className="button primary wide-button" onClick={handleShare}>Compartilhar agora <Share2 size={16} /></button><button className="social-native-share" onClick={async () => { try { if (navigator.share) await navigator.share({ title: "Publicação Fortalfy", text: post.body, url: window.location.href }); else await copyLink(); } catch (error) { if (error.name !== "AbortError") { console.error("Falha ao compartilhar pelo dispositivo.", error); notify("Não foi possível abrir o compartilhamento do dispositivo."); } } }}>Compartilhar por outro app</button></section></div>}
    {reportOpen && <div className="social-share-scrim" role="presentation" onMouseDown={event => event.target === event.currentTarget && setReportOpen(false)}><form className="social-share-dialog social-reel-report-dialog" role="dialog" aria-modal="true" aria-label="Denunciar Reel" onSubmit={submitReport}><header><strong>Denunciar publicação</strong><button type="button" className="social-icon-button" onClick={() => setReportOpen(false)} aria-label="Fechar"><X size={18} /></button></header><p>Selecione o motivo. A denúncia será enviada à moderação do Fortalfy.</p><label>Motivo<select value={reportReason} onChange={event => setReportReason(event.target.value)}><option value="Spam ou conteúdo enganoso">Spam ou conteúdo enganoso</option><option value="Assédio ou discurso de ódio">Assédio ou discurso de ódio</option><option value="Conteúdo perigoso">Conteúdo perigoso</option><option value="Conteúdo sexual">Conteúdo sexual</option><option value="Violação de direitos autorais">Violação de direitos autorais</option><option value="Outro motivo">Outro motivo</option></select></label><footer><button type="button" className="button subtle" onClick={() => setReportOpen(false)}>Cancelar</button><button type="submit" className="button primary" disabled={busy}>Enviar denúncia</button></footer></form></div>}
    {lightboxIndex != null && lightboxMedia[lightboxIndex] && <div className="social-lightbox" role="dialog" aria-modal="true" aria-label="Visualizar mídia"><button className="social-lightbox-close" onClick={() => setLightboxIndex(null)} aria-label="Fechar"><X size={22} /></button>{lightboxMedia[lightboxIndex].media_type === "video" ? <video controls autoPlay src={lightboxMedia[lightboxIndex].url} /> : <img src={lightboxMedia[lightboxIndex].url} alt="Mídia ampliada" />}{lightboxMedia.length > 1 && <div className="social-lightbox-nav"><button disabled={lightboxIndex === 0} onClick={() => setLightboxIndex(index => index - 1)}><ArrowLeft size={18} /> Anterior</button><span>{lightboxIndex + 1} / {lightboxMedia.length}</span><button disabled={lightboxIndex >= lightboxMedia.length - 1} onClick={() => setLightboxIndex(index => index + 1)}>Próxima <ChevronRight size={18} /></button></div>}</div>}
  </article>;
}

function CommunityNavigation({ active }) {
  return <nav className="social-community-tabs" aria-label="Comunidade">
    <Link className={active === "feed" ? "active" : ""} aria-current={active === "feed" ? "page" : undefined} to="/feed"><Users size={16} /> Feed</Link>
    <Link className={active === "reels" ? "active" : ""} aria-current={active === "reels" ? "page" : undefined} to="/reels"><Clapperboard size={16} /> Reels</Link>
    <Link className={active === "people" ? "active" : ""} aria-current={active === "people" ? "page" : undefined} to="/people"><Compass size={16} /> Pessoas</Link>
    <Link className={active === "messages" ? "active" : ""} aria-current={active === "messages" ? "page" : undefined} to="/messages"><MessageCircle size={16} /> Mensagens</Link>
  </nav>;
}

export function SocialPeople({ client, session, configured, notify }) {
  const [search, setSearch] = useState("");
  const [profiles, setProfiles] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const userId = session?.user?.id;

  useEffect(() => {
    if (!client || !userId) return undefined;
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const result = await searchProfiles(client, userId, { search });
        if (!active) return;
        setProfiles(result.profiles);
        setHasMore(result.hasMore);
        setError("");
      } catch (failure) {
        if (!active) return;
        console.error("Falha ao descobrir perfis da comunidade.", failure);
        setError(getErrorMessage(failure, "Não foi possível carregar as pessoas."));
      } finally {
        if (active) setLoading(false);
      }
    }, 220);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [client, userId, search]);

  const loadMore = async () => {
    setLoading(true);
    try {
      const result = await searchProfiles(client, userId, { search, offset: profiles.length });
      setProfiles(current => [...current, ...result.profiles]);
      setHasMore(result.hasMore);
    } catch (failure) {
      console.error("Falha ao carregar mais perfis da comunidade.", failure);
      notify(getErrorMessage(failure, "Não foi possível carregar mais pessoas."));
    } finally {
      setLoading(false);
    }
  };

  return <div className="social-people-page">
    <CommunityNavigation active="people" />
    {!configured || !session
      ? <SocialAuth client={client} configured={configured} notify={notify} />
      : <section className="social-discovery-card">
        <div className="social-discovery-heading"><div><span className="eyebrow">COMUNIDADE FORTALFY</span><h2>Encontre pessoas</h2><p>Descubra perfis públicos e conheça o que a comunidade compartilha.</p></div><Compass size={25} /></div>
        <label className="social-discovery-search"><Search size={17} /><span className="sr-only">Buscar pessoas</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por nome ou @usuário" type="search" autoComplete="off" /></label>
        {error && <p className="social-inline-error" role="alert">{error}</p>}
        {loading && !profiles.length && <p className="social-inline-status"><LoaderCircle className="spin" size={17} /> Buscando pessoas…</p>}
        {!loading && !error && !profiles.length && <div className="social-empty-feed"><Users size={23} /><h3>{search.trim() ? "Nenhum perfil encontrado" : "Você já está entre as primeiras pessoas"}</h3><p>{search.trim() ? "Confira o nome ou o usuário digitado." : "Quando outras pessoas se cadastrarem, os perfis públicos aparecerão aqui."}</p></div>}
        {!!profiles.length && <div className="social-people-grid">{profiles.map(person => <Link className="social-person-card" key={person.id} to={`/profile/${person.id}`}>
          <span className="social-person-avatar">{person.avatar ? <img src={person.avatar} alt="" loading="lazy" /> : person.name.slice(0, 1).toUpperCase()}</span>
          <span className="social-person-name">{person.name}{person.verified && <VerificationBadge />}</span>
          <span className="social-person-username">@{person.username || "fortalfy"}</span>
          {person.bio && <span className="social-person-bio">{person.bio}</span>}
          <span className="social-person-action">Ver perfil <ChevronRight size={14} /></span>
        </Link>)}</div>}
        {hasMore && <button className="button subtle wide-button social-load-more" onClick={loadMore} disabled={loading}>{loading ? "Carregando…" : "Carregar mais pessoas"}</button>}
      </section>}
  </div>;
}

export function SocialMessages({ client, session, configured, notify, onNotification, messagePreferences }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [conversationAccess, setConversationAccess] = useState({ canMessage: false });
  const [pendingTarget, setPendingTarget] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState("CONNECTING");
  const [following, setFollowing] = useState(false);
  const [error, setError] = useState("");
  const [conversationSearch, setConversationSearch] = useState("");
  const knownMessageIds = useRef(new Set());
  const initializedConversationIds = useRef(new Set());
  const messageRuntimeRef = useRef({ onNotification, messagePreferences });
  messageRuntimeRef.current = { onNotification, messagePreferences };
  const userId = session?.user?.id;
  const targetId = searchParams.get("to");
  const requestedConversationId = searchParams.get("conversation");

  const refreshConversations = async () => {
    const rows = await loadConversations(client, userId);
    setConversations(current => {
      const unchanged = current.length === rows.length && current.every((item, index) => {
        const next = rows[index];
        return item.id === next.id && item.last_message_at === next.last_message_at
          && item.latestMessage?.id === next.latestMessage?.id
          && item.latestMessage?.body === next.latestMessage?.body;
      });
      return unchanged ? current : rows;
    });
    if (conversation) {
      const updated = rows.find(item => item.id === conversation.id);
      if (updated && (updated.last_message_at !== conversation.last_message_at
        || updated.latestMessage?.id !== conversation.latestMessage?.id
        || updated.latestMessage?.body !== conversation.latestMessage?.body
        || updated.person?.avatar !== conversation.person?.avatar
        || updated.person?.name !== conversation.person?.name)) setConversation(updated);
    }
  };

  useEffect(() => {
    if (!client || !userId) return undefined;
    let active = true;
    const open = async () => {
      setLoading(true);
      try {
        const rows = await loadConversations(client, userId);
        if (!active) return;
        setConversations(rows);
        setError("");
        if (targetId && targetId !== userId) {
          const person = await loadProfile(client, targetId);
          const access = await loadMutualFollowState(client, userId, targetId);
          if (!access.canMessage) {
            setConversation(null);
            setPendingTarget({ person, access });
            setError("");
            return;
          }
          const started = await startConversation(client, userId, targetId);
          if (!active) return;
          const match = rows.find(item => item.id === started.id) || {
            ...started,
            person,
            latestMessage: null,
          };
          setConversation(match);
          setConversationAccess(access);
          setPendingTarget(null);
          const nextParams = new URLSearchParams(searchParams);
          nextParams.delete("to");
          nextParams.set("conversation", started.id);
          setSearchParams(nextParams, { replace: true });
        } else if (requestedConversationId) {
          const match = rows.find(item => item.id === requestedConversationId);
          if (match) {
            setConversation(match);
            setPendingTarget(null);
            setConversationAccess(await loadMutualFollowState(client, userId, match.person.id));
          } else {
            setConversation(null);
            setError("Esta conversa não está disponível para sua conta.");
          }
        } else if (conversation) {
          setConversation(rows.find(item => item.id === conversation.id) || null);
        }
      } catch (failure) {
        if (!active) return;
        console.error("Falha ao carregar as conversas.", failure);
        setError(getErrorMessage(failure, "Não foi possível carregar suas conversas."));
      } finally {
        if (active) setLoading(false);
      }
    };
    open();
    return () => { active = false; };
  }, [client, userId, targetId, requestedConversationId]);

  useEffect(() => {
    if (!client || !userId || !conversation?.id) return undefined;
    let active = true;
    setRealtimeStatus("CONNECTING");
    const refreshMessages = async () => {
      try {
        const access = await loadMutualFollowState(client, userId, conversation.person.id);
        if (!active) return;
        setConversationAccess(access);
        const rows = await loadDirectMessages(client, userId, conversation.id);
        if (!active) return;
        const firstLoad = !initializedConversationIds.current.has(conversation.id);
        initializedConversationIds.current.add(conversation.id);
        const incoming = firstLoad ? [] : rows.filter(row => row.sender_id !== userId && !knownMessageIds.current.has(row.id));
        rows.forEach(row => knownMessageIds.current.add(row.id));
        if (incoming.length && document.visibilityState === "visible") {
          const latestIncoming = incoming[incoming.length - 1];
          void playNotificationSound(messageRuntimeRef.current.messagePreferences, { notificationId: latestIncoming.id, type: "chat.message" });
        }
        incoming.forEach(row => {
          const senderKind = conversation.person?.kind;
          const type = senderKind === "nutricionista" ? "nutritionist_message"
            : senderKind === "personal" ? "personal_message"
              : ["marca", "academia", "restaurante"].includes(senderKind) ? "shop" : "message";
          messageRuntimeRef.current.onNotification?.({
          type,
          title: type === "nutritionist_message" ? "Mensagem da nutricionista"
            : type === "personal_message" ? "Mensagem do personal"
              : type === "shop" ? "Mensagem de parceiro" : "Nova mensagem",
          message: `${conversation.person?.name || "Nova mensagem"}: ${String(row.body || "Mensagem recebida").slice(0, 180)}`,
          });
        });
        setMessages(current => current.length === rows.length && current.every((item, index) => item.id === rows[index]?.id && item.body === rows[index]?.body && item.created_at === rows[index]?.created_at) ? current : rows);
        if (firstLoad || incoming.length) await markConversationRead(client, userId, conversation);
        if (active) await refreshConversations();
        setError("");
      } catch (failure) {
        if (!active) return;
        console.error("Falha ao atualizar mensagens.", failure);
        setError(getErrorMessage(failure, "Não foi possível carregar as mensagens."));
      }
    };
    refreshMessages();
    const timer = window.setInterval(refreshMessages, 10000);
    const channel = client.channel(`direct-messages:${conversation.id}:${userId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "direct_messages",
        filter: `conversation_id=eq.${conversation.id}`,
      }, () => { void refreshMessages(); })
      .subscribe(status => {
        if (!active) return;
        setRealtimeStatus(status);
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("A conexão em tempo real não está disponível; a conversa continuará atualizando periodicamente.");
        }
      });
    return () => {
      active = false;
      window.clearInterval(timer);
      client.removeChannel(channel)
        .then(status => {
          if (status !== "ok") console.error("Não foi possível encerrar o canal de mensagens em tempo real.", status);
        })
        .catch(failure => console.error("Não foi possível encerrar o canal de mensagens em tempo real.", failure));
    };
  }, [client, userId, conversation?.id, conversation?.person?.name]);

  const openConversation = item => {
    setConversation(item);
    setPendingTarget(null);
    setConversationAccess({ canMessage: false });
    setMessages([]);
    setError("");
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("to");
    nextParams.set("conversation", item.id);
    setSearchParams(nextParams, { replace: true });
  };

  const followForConversation = async () => {
    if (!pendingTarget || following) return;
    setFollowing(true);
    try {
      const result = await persistFollow(client, userId, pendingTarget.person.id, true, pendingTarget.person.isPrivate);
      publishFollowState(userId, pendingTarget.person.id, result === "following", result === "requested" ? "pending" : "");
      const access = await loadMutualFollowState(client, userId, pendingTarget.person.id);
      setPendingTarget(current => current ? { ...current, access } : current);
      if (access.canMessage) {
        const started = await startConversation(client, userId, pendingTarget.person.id);
        setConversation({ ...started, person: pendingTarget.person, latestMessage: null });
        setConversationAccess(access);
        setPendingTarget(null);
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete("to");
        nextParams.set("conversation", started.id);
        setSearchParams(nextParams, { replace: true });
      } else if (access.requestPending || pendingTarget.person.isPrivate) {
        notify("Solicitação enviada. Aguarde a aprovação para conversar.");
      } else {
        notify("Agora você segue este perfil. Para conversar, a pessoa também precisa seguir você.");
      }
    } catch (failure) {
      console.error("Falha ao seguir para iniciar uma conversa.", failure);
      setError(getErrorMessage(failure, "Não foi possível atualizar o seguimento."));
    } finally {
      setFollowing(false);
    }
  };

  const submitMessage = async event => {
    event.preventDefault();
    if (!conversation || !draft.trim() || !conversationAccess.canMessage) return;
    setSending(true);
    try {
      const message = await sendDirectMessage(client, userId, conversation.id, draft);
      void playNotificationSound(messagePreferences, { notificationId: `sent:${message.id}`, type: "chat.message" });
      setMessages(current => [...current, message]);
      setDraft("");
      await refreshConversations();
      await markConversationRead(client, userId, conversation);
      setError("");
    } catch (failure) {
      console.error("Falha ao enviar mensagem.", failure);
      if (failure?.code === "42501") {
        setConversationAccess({ canMessage: false });
        setError("Vocês precisam se seguir para conversar.");
      } else {
        setError(getErrorMessage(failure, "Não foi possível enviar a mensagem."));
      }
    } finally {
      setSending(false);
    }
  };

  const formatMessageTime = value => new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const filteredConversations = conversations.filter(item => {
    const query = conversationSearch.trim().toLocaleLowerCase("pt-BR");
    return !query || `${item.person?.name || ""} ${item.latestMessage?.body || ""}`.toLocaleLowerCase("pt-BR").includes(query);
  });
  if (!configured || !session) return <div className="social-messages-page"><CommunityNavigation active="messages" /><SocialAuth client={client} configured={configured} notify={notify} /></div>;

  return <div className="social-messages-page">
    <CommunityNavigation active="messages" />
    <section className={`social-messages-panel${conversation ? " conversation-open" : ""}${!conversations.length ? " no-conversations" : ""}`}>
      <aside className="social-conversation-list">
        <header><div><span className="eyebrow">SUA COMUNIDADE</span><h2>Conversas</h2></div><Link to="/people" className="button subtle small-button"><Users size={15} /> Pessoas</Link></header>
        <label className="social-conversation-search"><Search size={16} /><input type="search" value={conversationSearch} onChange={event => setConversationSearch(event.target.value)} placeholder="Buscar nas conversas" aria-label="Buscar conversas" /></label>
        {loading && !conversations.length && <p className="social-inline-status"><LoaderCircle className="spin" size={16} /> Carregando conversas…</p>}
        {!loading && !conversations.length && <div className="social-conversation-empty"><span><MessageCircle size={23} /></span><h3>Suas mensagens começam aqui</h3><p>Encontre pessoas da comunidade e inicie uma conversa privada.</p><Link className="button primary small-button" to="/people"><Users size={15} /> Encontrar pessoas</Link></div>}
        {conversations.length > 0 && !filteredConversations.length && <p className="social-conversation-search-empty">Nenhuma conversa corresponde à busca.</p>}
        {filteredConversations.map(item => <button key={item.id} className={`social-conversation-item${conversation?.id === item.id ? " active" : ""}`} onClick={() => openConversation(item)}>
          <span className="social-person-avatar">{item.person?.avatar ? <img src={item.person.avatar} alt="" /> : item.person?.name?.slice(0, 1).toUpperCase()}</span>
          <span className="social-conversation-preview"><strong>{item.person?.name || "Pessoa Fortalfy"}</strong><small>{item.latestMessage?.body || "Inicie uma conversa"}</small></span>
          {item.latestMessage && <time>{formatMessageTime(item.latestMessage.created_at)}</time>}
        </button>)}
      </aside>
      {pendingTarget ? <section className="social-chat-window social-chat-gate">
        <header className="social-chat-header"><Link to={`/profile/${pendingTarget.person.id}`} className="social-chat-person"><span className="social-person-avatar">{pendingTarget.person.avatar ? <img src={pendingTarget.person.avatar} alt="" /> : pendingTarget.person.name.slice(0, 1).toUpperCase()}</span><span><strong>{pendingTarget.person.name}</strong><small>@{pendingTarget.person.username || "fortalfy"}</small></span></Link></header>
        <div className="social-chat-placeholder"><LockKeyhole size={28} /><h3>Vocês precisam se seguir para conversar</h3>
          {pendingTarget.access.requestPending
            ? <p>Sua solicitação para seguir foi enviada. Aguarde a aprovação.</p>
            : pendingTarget.access.followsOther
            ? <p>Você já segue esta pessoa. Aguarde que ela também siga você.</p>
            : <><p>Siga este perfil. A conversa será liberada quando o seguimento for mútuo.</p><button className="button primary small-button" onClick={followForConversation} disabled={following}>{following ? <LoaderCircle className="spin" size={15} /> : <UserPlus size={15} />}{pendingTarget.person.isPrivate ? " Solicitar para conversar" : " Seguir para conversar"}</button></>}
          {error && <p className="social-inline-error" role="alert">{error}</p>}
        </div>
      </section> : conversation ? <section className="social-chat-window">
        <header className="social-chat-header"><button className="social-chat-back" onClick={() => setConversation(null)} aria-label="Voltar às conversas"><ArrowLeft size={18} /></button><Link to={`/profile/${conversation.person?.id}`} className="social-chat-person"><span className="social-person-avatar">{conversation.person?.avatar ? <img src={conversation.person.avatar} alt="" /> : conversation.person?.name?.slice(0, 1).toUpperCase()}</span><span><strong>{conversation.person?.name}</strong><small>@{conversation.person?.username || "fortalfy"}</small></span></Link></header>
        {error && <p className="social-inline-error" role="alert">{error}</p>}
        {realtimeStatus !== "SUBSCRIBED" && <p className="social-inline-status" role="status">Atualização em tempo real reconectando; novas mensagens também serão verificadas periodicamente.</p>}
        <div className="social-chat-messages" aria-live="polite">{messages.map(message => <article key={message.id} className={`social-chat-bubble${message.sender_id === userId ? " own" : ""}`}><p>{message.body}</p><time dateTime={message.created_at}>{formatMessageTime(message.created_at)}</time></article>)}</div>
        {!conversationAccess.canMessage && <p className="social-inline-status" role="status">Vocês precisam se seguir para conversar. O envio está bloqueado.</p>}
        <form className="social-chat-composer" onSubmit={submitMessage}><label className="sr-only" htmlFor="social-chat-draft">Sua mensagem</label><textarea id="social-chat-draft" rows={1} value={draft} maxLength={4000} onChange={event => setDraft(event.target.value)} placeholder={conversationAccess.canMessage ? "Escreva uma mensagem..." : "Envio bloqueado até o seguimento mútuo"} disabled={!conversationAccess.canMessage} required /><button className="button primary small-button" aria-label="Enviar mensagem" disabled={sending || !draft.trim() || !conversationAccess.canMessage}>{sending ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />}</button></form>
      </section> : <div className="social-chat-placeholder"><span><MessageCircle size={28} /></span><h3>Suas conversas, em um só lugar</h3><p>As mensagens são privadas entre você e a pessoa escolhida.</p></div>}
    </section>
  </div>;
}

export function SocialFeed({ client, configured, session, authReady = true, profile, profileError = "", feedArts = [], notify, recovery = false, onRecovered, onRetryProfile, mediaType = "" }) {
  const [filter, setFilter] = useState("latest");
  const [posts, setPosts] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const authDialogRef = useRef(null);
  const authReturnFocusRef = useRef(null);
  const [searchParams] = useSearchParams();
  const reelListRef = useRef(null);
  const loadingMoreRef = useRef(false);
  const userId = session?.user?.id;
  const canPublishReels = Boolean(profile?.partnerApproved
    && ["personal", "nutricionista", "academia", "marca"].includes(profile.kind));
  const filters = [["latest", "Mais recentes"], ["following", "Seguindo"]];
  const openAuth = mode => {
    const activeElement = document.activeElement;
    authReturnFocusRef.current = activeElement instanceof HTMLElement && activeElement !== document.body ? activeElement : null;
    setAuthMode(mode);
    setAuthOpen(true);
  };

  useEffect(() => {
    if (searchParams.get("compose") !== "1") return;
    if (!userId) {
      openAuth("signup");
      return;
    }
    window.setTimeout(() => document.getElementById("social-create-post")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
  }, [searchParams, userId]);

  useEffect(() => {
    if (!authOpen) return undefined;
    const dialog = authDialogRef.current;
    const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusableElements = () => [...(dialog?.querySelectorAll(focusableSelector) || [])]
      .filter(element => element.getClientRects().length > 0 && element.getAttribute("aria-hidden") !== "true");
    const handleDialogKeyDown = event => {
      if (event.key === "Escape") {
        setAuthOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusableElements();
      if (!elements.length) {
        event.preventDefault();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog?.querySelector(".social-auth-feed-close")?.focus({ preventScroll: true });
    window.addEventListener("keydown", handleDialogKeyDown);
    return () => {
      window.removeEventListener("keydown", handleDialogKeyDown);
      const returnFocus = authReturnFocusRef.current;
      if (returnFocus?.isConnected) window.requestAnimationFrame(() => returnFocus.focus({ preventScroll: true }));
    };
  }, [authOpen]);

  const refresh = async () => {
    if (!client || !userId) return;
    setRefreshing(true);
    try {
      const result = await loadFeed(client, userId, { filter, offset: 0, mediaType });
      setPosts(result.posts);
      setHasMore(result.hasMore);
      setError("");
    } catch (failure) {
      console.error("Falha ao atualizar o Feed social.", failure);
      setError(getErrorMessage(failure, "Não foi possível carregar o Feed."));
    } finally {
      setRefreshing(false);
    }
  };

  const changeFeedFilter = nextFilter => {
    if (nextFilter === filter) return;
    if (mediaType === "video") {
      try {
        sessionStorage.removeItem("fortalfy.reels.scroll");
      } catch (failure) {
        console.error("Falha ao limpar a posição salva do FortalReels.", failure);
      }
      reelListRef.current?.scrollTo({ top: 0 });
      setPosts([]);
      setHasMore(false);
    }
    setFilter(nextFilter);
  };

  useEffect(() => {
    if (!client || !userId) return undefined;
    let active = true;
    const timeout = window.setTimeout(() => {
      if (!active) return;
      setLoading(false);
      setError("A conexão com o serviço está demorando. Verifique sua conexão e tente novamente.");
    }, 20000);
    setLoading(true);
    setError("");
    loadFeed(client, userId, {
      filter,
      offset: 0,
      mediaType,
      onPostsReady: mediaType === "video" ? result => {
        if (!active) return;
        window.clearTimeout(timeout);
        setPosts(result.posts);
        setHasMore(result.hasMore);
        setError("");
        setLoading(false);
      } : undefined,
    })
      .then(result => {
        if (!active) return;
        setPosts(result.posts);
        setHasMore(result.hasMore);
        setError("");
      })
      .catch(failure => {
        if (!active) return;
        console.error("Falha ao carregar o Feed social.", failure);
        setError(getErrorMessage(failure, "Não foi possível carregar o Feed."));
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [client, userId, filter, mediaType]);

  useEffect(() => {
    if (mediaType !== "video" || !posts.length || !reelListRef.current) return;
    try {
      const savedPosition = Number(sessionStorage.getItem("fortalfy.reels.scroll"));
      if (Number.isFinite(savedPosition) && savedPosition > 0) reelListRef.current.scrollTop = savedPosition;
    } catch (failure) {
      console.error("Não foi possível restaurar a posição do FortalReels.", failure);
    }
  }, [mediaType, posts.length, loading]);

  const loadMore = async () => {
    if (loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;
    setLoading(true);
    try {
      const result = await loadFeed(client, userId, { filter, offset: posts.length, mediaType });
      setPosts(current => [...current, ...result.posts]);
      setHasMore(result.hasMore);
    } catch (failure) {
      console.error("Falha ao carregar mais publicações.", failure);
      notify(getErrorMessage(failure, "Não foi possível carregar mais publicações."));
    } finally {
      loadingMoreRef.current = false;
      setLoading(false);
    }
  };

  const reelMode = mediaType === "video";
  if (recovery) return <SocialAuth client={client} configured={configured} notify={notify} recovery onRecovered={onRecovered} />;
  if (!session && !authReady && !reelMode) return <div className="social-feed-skeleton" role="status" aria-label="Preparando sua comunidade"><span /><span /><span /></div>;
  if (!session && !reelMode) return <div className="social-guest-feed">
    <header className="social-guest-feed-header"><span className="eyebrow">FORTALFY · COMUNIDADE & BEM-ESTAR</span><h1>Feed da comunidade</h1><p>Inspiração, rotina e bem-estar no seu ritmo.</p><div className="social-guest-feed-actions"><button type="button" className="button social-feed-primary" onClick={() => openAuth("signup")}>Criar conta</button><button type="button" className="button social-feed-secondary" onClick={() => openAuth("login")}>Entrar</button></div></header>
    <section className="social-guest-empty"><span className="social-guest-empty-icon"><Users size={25} /></span><span className="eyebrow">UM ESPAÇO PARA A COMUNIDADE</span><h2>Seu Feed começa com uma conexão.</h2><p>Siga pessoas, profissionais e parceiros para encontrar conteúdos que combinam com seu ritmo.</p><div className="social-guest-empty-actions"><Link to="/people" className="button social-feed-primary">Encontrar pessoas</Link><button type="button" className="social-feed-text-action" onClick={() => openAuth("signup")}>Criar primeira publicação <ArrowRight size={15} /></button></div></section>
    <p className="social-guest-honesty-note">As publicações da comunidade aparecem aqui quando você entra. Nenhum conteúdo de demonstração é apresentado como atividade real.</p>
    {authOpen && <div className="social-auth-feed-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setAuthOpen(false)}><section ref={authDialogRef} className="social-auth-feed-dialog" role="dialog" aria-modal="true" aria-label={authMode === "signup" ? "Criar conta Fortalfy" : "Entrar na Fortalfy"}><button className="social-auth-feed-close" type="button" aria-label="Fechar janela de acesso" onClick={() => setAuthOpen(false)}><X size={20} /></button><SocialAuth client={client} configured={configured} notify={notify} variant="social-auth-feed-modal" initialMode={authMode} /></section></div>}
  </div>;
  if (!session) return <>{!reelMode && <CommunityNavigation active="feed" />}<SocialAuth client={client} configured={configured} notify={notify} /></>;
  if (profileError) return <div className="social-feed-error" role="alert">{reelMode && <Link to="/feed" className="social-reels-back" aria-label="Voltar ao Feed"><ArrowLeft size={20} /></Link>}<CircleAlert size={17} /><span>{profileError}</span><button onClick={onRetryProfile}>Tentar novamente</button></div>;
  if (!profile) return <div className="social-inline-status"><LoaderCircle className="spin" size={17} /> Preparando seu perfil…</div>;
  return <div className={`social-feed${reelMode ? ` social-reels-page${composerOpen ? " is-composing" : ""}` : " social-feed-authenticated"}`}>
    <main className="social-feed-main">
    {!reelMode && <><CommunityNavigation active="feed" /><header className="social-feed-header"><div><span className="eyebrow">SUA COMUNIDADE FORTALFY</span><h1>Feed da comunidade</h1><p>Inspiração, rotina e bem-estar no seu ritmo.</p></div><nav className="social-feed-quick-actions" aria-label="Ações rápidas"><Link to="/workout"><Dumbbell size={16} /> Registrar treino</Link><Link to="/nutrition"><Activity size={16} /> Registrar alimentação</Link></nav></header></>}
    {reelMode && <div className="social-reels-intro"><Link className="social-reels-back" to="/feed" aria-label="Voltar ao Feed"><ArrowLeft size={20} /></Link><Clapperboard size={19} /><span><strong>FortalReels</strong><small>Vídeos verticais 9:16 · até {FORTALREEL_MAX_DURATION_SECONDS / 60} minutos</small></span><button type="button" className="button primary small-button" onClick={() => {
      if (!canPublishReels) {
        notify("A publicação no FortalReels é exclusiva de criadores e parceiros aprovados.");
        return;
      }
      setComposerOpen(value => !value);
    }}><Video size={15} />{composerOpen ? "Fechar criação" : "Criar Reel"}</button></div>}
    {!reelMode && <div className="social-feed-toolbar"><div className="social-filter-tabs">{filters.map(([value, label]) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>)}</div><button className="social-refresh" onClick={refresh} disabled={refreshing}>{refreshing ? <LoaderCircle className="spin" size={15} /> : "Atualizar"}</button></div>}
    {reelMode && <div className="social-feed-toolbar social-reels-toolbar" role="group" aria-label="Escolher vídeos do FortalReels"><div className="social-filter-tabs">{[["latest", "Recentes"], ["following", "Seguindo"]].map(([value, label]) => <button key={value} type="button" className={filter === value ? "active" : ""} aria-pressed={filter === value} onClick={() => changeFeedFilter(value)}>{label}</button>)}</div><button className="social-refresh" type="button" onClick={refresh} disabled={refreshing} aria-label="Atualizar vídeos">{refreshing ? <LoaderCircle className="spin" size={15} /> : "Atualizar"}</button></div>}
    {(!reelMode || composerOpen) && <CreatePost client={client} userId={userId} onPublished={async () => { setComposerOpen(false); await refresh(); }} notify={notify} videosOnly={reelMode} soundtrackByDefault={reelMode && profile.username?.toLowerCase() === "fortalfy"} />}
    {!reelMode && feedArts.length > 0 && <section className="social-local-creations"><h3>Criações deste aparelho</h3><p>Essas peças ainda não foram publicadas para outras contas.</p><div>{feedArts.map(art => <article key={art.id}><img src={art.dataUrl} alt={`Criação local: ${art.title}`} /><span>SOMENTE NESTE APARELHO</span><strong>{art.title}</strong></article>)}</div></section>}
    {reelMode
      ? <section className="social-reels-list" ref={reelListRef} aria-label="Vídeos FortalReels" onScroll={event => {
        try {
          sessionStorage.setItem("fortalfy.reels.scroll", String(event.currentTarget.scrollTop));
        } catch (failure) {
          console.error("Não foi possível salvar a posição do FortalReels.", failure);
        }
        if (hasMore && !loadingMoreRef.current
            && event.currentTarget.scrollHeight - event.currentTarget.scrollTop - event.currentTarget.clientHeight < event.currentTarget.clientHeight * 2) {
          void loadMore();
        }
      }}>
        {error && <div className="social-feed-error" role="alert"><CircleAlert size={17} /><span>{error}</span><button onClick={refresh}>Tentar novamente</button></div>}
        {loading && !posts.length && <p className="social-inline-status"><LoaderCircle className="spin" size={17} /> Carregando Reels…</p>}
        {!loading && !error && !posts.length && <div className="social-empty-feed"><img className="credibility-empty-art" src={credibilityPackAsset("23-empty-live-illustration.png")} alt="Estúdio preparado para uma transmissão ao vivo" loading="lazy" /><Users size={25} /><h2>{filter === "following" ? "Ainda não há Reels de perfis seguidos" : "Ainda não há Reels"}</h2><p>{filter === "following" ? "Siga criadores para ver os vídeos deles aqui." : "Os vídeos verticais 9:16 publicados pela comunidade aparecerão aqui."}</p></div>}
        {posts.map((post, index) => <Fragment key={post.id}>{index === 2 && posts.length >= 3 && <SponsoredCreative frequencyKey="fortalfy.ads.session.v1" image="07-reels-sponsored.png" alt="Reel patrocinado Fortalfy: ligue o modo treino. Constância vence." label="Patrocinado" to="/campaigns" className="reels-sponsored-creative" />}<SocialPost post={post} client={client} userId={userId} onRefresh={refresh} notify={notify} reelMode onCreateReel={canPublishReels ? () => setComposerOpen(true) : undefined} /></Fragment>)}
        {hasMore && <button className="button subtle wide-button social-load-more" onClick={loadMore} disabled={loading}>{loading ? "Carregando…" : "Carregar mais Reels"}</button>}
      </section>
      : <>
        {error && <div className="social-feed-error" role="alert"><CircleAlert size={17} /><span>{error}</span><button onClick={refresh}>Tentar novamente</button></div>}
        {loading && !posts.length && <p className="social-inline-status"><LoaderCircle className="spin" size={17} /> Carregando publicações…</p>}
        {!loading && !error && !posts.length && <div className="social-empty-feed"><img className="credibility-empty-art" src={credibilityPackAsset("21-empty-feed-illustration.png")} alt="Caminho de treino Fortalfy em direção ao horizonte" loading="lazy" /><Users size={25} /><h2>{filter === "following" ? "Você ainda não segue ninguém" : "O Feed está começando"}</h2><p>{filter === "following" ? "Siga perfis para ver as publicações deles aqui." : "Quando as pessoas publicarem, as novidades aparecerão aqui. Você pode começar com uma publicação sua."}</p></div>}
        {posts.map((post, index) => <Fragment key={post.id}>{index === 5 && posts.length >= 6 && <SponsoredCreative frequencyKey="fortalfy.ads.session.v1" image="06-feed-sponsored.png" alt="Publicação patrocinada Fortalfy sobre evolução e consistência no treino." label="Patrocinado · Fortalfy" to="/campaigns" className="feed-sponsored-creative" />}<SocialPost post={post} client={client} userId={userId} onRefresh={refresh} notify={notify} /></Fragment>)}
        {hasMore && <button className="button subtle wide-button social-load-more" onClick={loadMore} disabled={loading}>{loading ? "Carregando…" : "Carregar mais publicações"}</button>}
      </>}
    </main>
    {!reelMode && <aside className="social-feed-side-panel" aria-label="Descubra mais na Fortalfy"><section><span className="eyebrow">FORTALPASS</span><h2>Encontre seu próximo treino</h2><p>Explore academias, modalidades e parceiros disponíveis na sua região.</p><Link to="/pass">Explorar FortalPass <ArrowRight size={15} /></Link></section><section><span className="eyebrow">SUA ROTINA</span><h2>Bem-estar no seu ritmo</h2><p>Registre treinos e refeições para acompanhar sua própria jornada.</p><Link to="/home">Ver minha jornada <ArrowRight size={15} /></Link></section><section><span className="eyebrow">COMUNIDADE</span><h2>Conheça quem faz parte</h2><p>Descubra perfis de pessoas e parceiros da Fortalfy.</p><Link to="/people">Explorar pessoas <ArrowRight size={15} /></Link></section></aside>}
  </div>;
}

export function SocialProfile({ client, session, profile, profileError = "", configured, notify, onProfileUpdated, recovery = false, onRecovered, onRetryProfile, onSignOut }) {
  const { profileId = "" } = useParams();
  const navigate = useNavigate();
  const userId = session?.user?.id;
  const targetId = profileId || userId;
  const isOwn = Boolean(userId && targetId === userId);
  const [person, setPerson] = useState(isOwn ? profile : null);
  const [posts, setPosts] = useState([]);
  const [postCount, setPostCount] = useState(0);
  const [postsHasMore, setPostsHasMore] = useState(false);
  const [postsLoading, setPostsLoading] = useState(false);
  const [follow, setFollow] = useState({ followers: 0, following: 0, isFollowing: false, requestStatus: "" });
  const [requests, setRequests] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [postsError, setPostsError] = useState("");
  const [detailsError, setDetailsError] = useState("");
  const [links, setLinks] = useState([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [linksError, setLinksError] = useState("");
  const [approvedProfessionalProfiles, setApprovedProfessionalProfiles] = useState([]);
  const [hasProfessionalApplication, setHasProfessionalApplication] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", username: "", bio: "", city: "", isPrivate: false });
  const [draftLinks, setDraftLinks] = useState([]);
  const [connectionsDialog, setConnectionsDialog] = useState(null);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [connectionsError, setConnectionsError] = useState("");
  const [connectionsHasMore, setConnectionsHasMore] = useState(false);
  const [imageDraft, setImageDraft] = useState(null);
  const profileUsername = draft.username.trim().replace(/^@/, "").toLowerCase();
  const [profileUsernameCheck, setProfileUsernameCheck] = useState({ username: "", checking: false, available: null, error: "" });
  const followStateRevision = useRef(0);
  const professionalProfile = Boolean(person && (
    person.kind !== "cliente" || approvedProfessionalProfiles.length || hasProfessionalApplication
  ));

  useEffect(() => {
    const syncFollowState = event => {
      const { followerId, followedId, isFollowing, requestStatus } = event.detail;
      if (followerId !== userId || followedId !== targetId) return;
      followStateRevision.current += 1;
      setFollow(current => ({ ...current, isFollowing, requestStatus }));
    };
    window.addEventListener(FOLLOW_STATE_EVENT, syncFollowState);
    return () => window.removeEventListener(FOLLOW_STATE_EVENT, syncFollowState);
  }, [userId, targetId]);

  useEffect(() => {
    if (!client || !userId || !targetId) {
      setLinks([]);
      setApprovedProfessionalProfiles([]);
      setHasProfessionalApplication(false);
      setLinksError("");
      setLinksLoading(false);
      return undefined;
    }
    let active = true;
    setLinks([]);
    setApprovedProfessionalProfiles([]);
    setHasProfessionalApplication(false);
    setLinksLoading(true);
    setLinksError("");
    Promise.all([
      loadProfileLinks(client, targetId, { owner: isOwn }),
      loadApprovedProfessionalProfiles(client, targetId),
      isOwn ? loadProfessionalApplications(client, targetId) : Promise.resolve([]),
    ]).then(([nextLinks, nextApplications, ownerApplications]) => {
      if (!active) return;
      setLinks(nextLinks.map(link => ({
        id: link.id,
        label: link.label,
        url: link.url,
        type: link.link_type,
        isPublic: link.is_public,
        validationStatus: link.validation_status,
      })));
      setApprovedProfessionalProfiles(nextApplications);
      setHasProfessionalApplication(ownerApplications.length > 0);
    }).catch(failure => {
      if (!active) return;
      console.error("Falha ao carregar bio, links e perfis profissionais aprovados.", failure);
      setLinksError(getErrorMessage(failure, "Não foi possível carregar os links deste perfil."));
    }).finally(() => { if (active) setLinksLoading(false); });
    return () => { active = false; };
  }, [client, isOwn, targetId, userId]);

  useEffect(() => {
    if (!imageDraft?.previewUrl) return undefined;
    return () => URL.revokeObjectURL(imageDraft.previewUrl);
  }, [imageDraft?.previewUrl]);

  useEffect(() => {
    if (!editOpen || !client || !/^[a-z0-9._]{3,30}$/.test(profileUsername)) {
      setProfileUsernameCheck({ username: profileUsername, checking: false, available: null, error: "" });
      return undefined;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      setProfileUsernameCheck({ username: profileUsername, checking: true, available: null, error: "" });
      isUsernameAvailable(client, profileUsername, userId)
        .then(available => {
          if (active) setProfileUsernameCheck({ username: profileUsername, checking: false, available, error: "" });
        })
        .catch(failure => {
          console.error("Falha ao verificar a disponibilidade do nome de usuário do perfil.", failure);
          if (active) setProfileUsernameCheck({ username: profileUsername, checking: false, available: null, error: getErrorMessage(failure) });
        });
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [client, editOpen, profileUsername, userId]);

  useEffect(() => {
    setPerson(isOwn ? profile : null);
    setPosts([]);
    setPostCount(0);
    setPostsHasMore(false);
    setPostsError("");
    setDetailsError("");
    setError("");
    if (!client || !userId || !targetId) return undefined;
    let active = true;
    const loadProfileData = async () => {
      let nextPerson;
      try {
        nextPerson = isOwn ? profile : await loadProfile(client, targetId);
        if (!nextPerson) throw new Error("Perfil não encontrado ou não disponível para sua conta.");
        if (active) setPerson(nextPerson);
      } catch (failure) {
        if (!active) return;
        console.error("Falha ao carregar os dados principais do perfil social.", failure);
        setError(getErrorMessage(failure, "Não foi possível carregar este perfil."));
        return;
      }
      if (!active) return;
      loadFeed(client, userId, { filter: "latest", offset: 0, limit: 20, authorId: targetId })
        .then(feed => {
          if (!active) return;
          setPosts(feed.posts);
          setPostCount(feed.total);
          setPostsHasMore(feed.hasMore);
          setPostsError("");
        })
        .catch(failure => {
          if (!active) return;
          console.error("Falha ao carregar as publicações do perfil.", failure);
          setPostsError(getErrorMessage(failure, "Não foi possível carregar as publicações."));
        });
      const followRevision = followStateRevision.current;
      Promise.all([
        loadFollowState(client, userId, targetId),
        isOwn ? loadFollowRequests(client, userId) : Promise.resolve([]),
      ]).then(([nextFollow, nextRequests]) => {
        if (!active) return;
        if (followStateRevision.current === followRevision) setFollow(nextFollow);
        setRequests(nextRequests);
        setDetailsError("");
      }).catch(failure => {
        if (!active) return;
        console.error("Falha ao carregar os detalhes sociais do perfil.", failure);
        setDetailsError(getErrorMessage(failure, "Não foi possível carregar os dados de seguimento."));
      });
    };
    loadProfileData();
    return () => { active = false; };
  }, [client, userId, targetId, isOwn, profile]);

  const retryProfilePosts = async () => {
    setPostsLoading(true);
    try {
      const result = await loadFeed(client, userId, { filter: "latest", offset: 0, limit: 20, authorId: targetId });
      setPosts(result.posts);
      setPostCount(result.total);
      setPostsHasMore(result.hasMore);
      setPostsError("");
    } catch (failure) {
      console.error("Falha ao tentar novamente carregar as publicações do perfil.", failure);
      setPostsError(getErrorMessage(failure, "Não foi possível carregar as publicações."));
    } finally {
      setPostsLoading(false);
    }
  };

  const openConnections = async direction => {
    setConnectionsDialog({ direction, profiles: [] });
    setConnectionsLoading(true);
    setConnectionsError("");
    try {
      const result = await loadProfileConnections(client, userId, targetId, direction);
      setConnectionsDialog(current => current?.direction === direction ? { direction, profiles: result.profiles } : current);
      setConnectionsHasMore(result.hasMore);
    } catch (failure) {
      console.error("Falha ao carregar as conexões do perfil.", failure);
      setConnectionsError(getErrorMessage(failure, "Não foi possível carregar esta lista."));
    } finally {
      setConnectionsLoading(false);
    }
  };

  const loadMoreConnections = async () => {
    if (!connectionsDialog || connectionsLoading) return;
    setConnectionsLoading(true);
    try {
      const result = await loadProfileConnections(client, userId, targetId, connectionsDialog.direction, {
        offset: connectionsDialog.profiles.length,
      });
      setConnectionsDialog(current => current?.direction === connectionsDialog.direction
        ? { ...current, profiles: [...current.profiles, ...result.profiles] }
        : current);
      setConnectionsHasMore(result.hasMore);
      setConnectionsError("");
    } catch (failure) {
      console.error("Falha ao carregar mais conexões do perfil.", failure);
      setConnectionsError(getErrorMessage(failure, "Não foi possível carregar mais perfis."));
    } finally {
      setConnectionsLoading(false);
    }
  };

  const saveProfile = async event => {
    event.preventDefault();
    const name = draft.name.trim();
    const username = draft.username.trim().replace(/^@/, "").toLowerCase();
    const bio = draft.bio.trim();
    const city = draft.city.trim();
    const bioLimit = professionalProfile ? 150 : 2000;
    if (name.length < 2 || name.length > 120 || bio.length > bioLimit || (username && !/^[a-z0-9._]{3,30}$/.test(username))) {
      notify(`Confira o nome, a biografia (até ${bioLimit} caracteres) e o nome de usuário.`);
      return;
    }
    const linkError = validateProfileLinks(draftLinks);
    if (linkError) {
      notify(linkError);
      return;
    }
    setBusy(true);
    try {
      if (username && !await isUsernameAvailable(client, username, userId)) {
        notify("Esse nome de usuário já está em uso ou reservado.");
        return;
      }
      await saveSocialProfile(client, {
        id: userId,
        name,
        username,
        bio,
        city,
        isPrivate: draft.isPrivate,
      }, draftLinks);
      await onProfileUpdated();
      setLinks(draftLinks.map((link, sortOrder) => ({ ...link, sort_order: sortOrder })));
      setEditOpen(false);
      notify("Perfil atualizado.");
    } catch (failure) {
      console.error("Falha ao atualizar o perfil.", failure);
      const duplicateUsername = failure?.code === "23505"
        || /profiles_username_lower_unique|duplicate key|username.*reserved/i.test(failure?.message || "");
      notify(duplicateUsername
        ? "Esse nome de usuário já está em uso ou reservado."
        : getErrorMessage(failure, "Não foi possível atualizar seu perfil."));
    } finally {
      setBusy(false);
    }
  };
  const beginEdit = () => {
    setDraft({ name: person?.name || "", username: person?.username || "", bio: person?.bio || "", city: person?.city || "", isPrivate: Boolean(person?.isPrivate) });
    setDraftLinks(links.map(link => ({ ...link })));
    setEditOpen(true);
  };
  const toggleFollow = async () => {
    if (!userId) return;
    setBusy(true);
    try {
      if (follow.requestStatus === "pending") {
        await cancelFollowRequest(client, userId, targetId);
        setFollow(current => ({ ...current, requestStatus: "" }));
        publishFollowState(userId, targetId, false);
        notify("Solicitação cancelada.");
        return;
      }
      const wasFollowing = follow.isFollowing;
      const result = await persistFollow(client, userId, targetId, !follow.isFollowing, person?.isPrivate);
      if (result === "requested") {
        setFollow(current => ({ ...current, requestStatus: "pending" }));
        publishFollowState(userId, targetId, false, "pending");
        notify("Solicitação de seguimento enviada.");
      } else {
        setFollow(current => ({ ...current, isFollowing: result === "following", requestStatus: "", followers: Math.max(0, normalizeSocialCount(current.followers) + (result === "following" ? 1 : wasFollowing ? -1 : 0)) }));
        publishFollowState(userId, targetId, result === "following");
        notify(result === "following" ? "Perfil seguido." : "Você deixou de seguir este perfil.");
      }
    } catch (failure) {
      console.error("Falha ao seguir perfil.", failure);
      notify(getErrorMessage(failure, "Não foi possível atualizar o seguimento."));
    } finally {
      setBusy(false);
    }
  };
  const handleFollowRequest = async (request, accepted) => {
    setBusy(true);
    try {
      await respondFollowRequest(client, request.follower_id, userId, accepted);
      setRequests(current => current.filter(item => item.follower_id !== request.follower_id));
      if (accepted) setFollow(current => ({ ...current, followers: normalizeSocialCount(current.followers) + 1 }));
      notify(accepted ? "Solicitação aprovada." : "Solicitação recusada.");
    } catch (failure) {
      console.error("Falha ao responder à solicitação de seguimento.", failure);
      notify(getErrorMessage(failure, "Não foi possível atualizar a solicitação."));
    } finally {
      setBusy(false);
    }
  };
  const handleProfileShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      notify("Link do perfil copiado.");
    } catch (failure) {
      console.error("Falha ao copiar o link do perfil.", failure);
      notify("Não foi possível copiar o link neste navegador.");
    }
  };
  const loadMoreProfilePosts = async () => {
    setPostsLoading(true);
    try {
      const result = await loadFeed(client, userId, { authorId: targetId, offset: posts.length, limit: 20 });
      setPosts(current => [...current, ...result.posts]);
      setPostCount(result.total);
      setPostsHasMore(result.hasMore);
    } catch (failure) {
      console.error("Falha ao carregar mais publicações do perfil.", failure);
      setPostsError(getErrorMessage(failure, "Não foi possível carregar mais publicações."));
    } finally {
      setPostsLoading(false);
    }
  };
  const updateProfileImage = (event, field) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      notify("Use uma imagem JPG, PNG, WebP ou GIF.");
    } else if (file.type === "image/gif" && file.size > 5 * 1024 * 1024) {
      notify("GIFs animados podem ter até 5 MB para preservar a animação.");
    } else if (file.size > 15 * 1024 * 1024) {
      notify("A imagem original pode ter até 15 MB.");
    } else {
      setImageDraft({ field, file, previewUrl: URL.createObjectURL(file), zoom: 1, panX: 0, panY: 0, previewLoading: true, previewError: "" });
    }
    event.target.value = "";
  };
  const saveProfileImage = async () => {
    if (!imageDraft) return;
    setBusy(true);
    try {
      const oldPath = imageDraft.field === "avatar_path" ? person.avatarPath : person.coverPath;
      const prepared = await prepareProfileImage(imageDraft.file, imageDraft.field, imageDraft.zoom, { x: imageDraft.panX, y: imageDraft.panY });
      await uploadProfileImage(client, userId, prepared, imageDraft.field);
      const updated = await onProfileUpdated();
      setPerson(updated);
      setImageDraft(null);
      if (oldPath && !/^https?:\/\//i.test(oldPath)) {
        const { error: cleanupError } = await client.storage.from("social-media").remove([oldPath]);
        if (cleanupError) {
          console.error("Não foi possível limpar a imagem antiga do perfil.", cleanupError);
          notify("Imagem atualizada. Não foi possível limpar a cópia anterior do armazenamento.");
          return;
        }
      }
      notify(imageDraft.field === "avatar_path" ? "Foto do perfil atualizada." : "Foto de capa atualizada.");
    } catch (failure) {
      console.error("Falha ao ajustar e salvar imagem do perfil.", failure);
      notify(getErrorMessage(failure, "Não foi possível salvar esta imagem."));
    } finally {
      setBusy(false);
    }
  };
  const clearProfileImage = async field => {
    setBusy(true);
    try {
      const path = field === "avatar_path" ? person.avatarPath : person.coverPath;
      await removeProfileImage(client, userId, path, field);
      const updated = await onProfileUpdated();
      setPerson(updated);
      notify(field === "avatar_path" ? "Foto do perfil removida." : "Foto de capa removida.");
    } catch (failure) {
      console.error("Falha ao remover imagem do perfil.", failure);
      notify(getErrorMessage(failure, "Não foi possível remover esta imagem."));
    } finally {
      setBusy(false);
    }
  };

  if (recovery) return <SocialAuth client={client} configured={configured} notify={notify} recovery onRecovered={onRecovered} />;
  if (!session) return <SocialAuth client={client} configured={configured} notify={notify} />;
  if (isOwn && profileError) return <div className="social-feed-error" role="alert"><CircleAlert size={17} /><span>{profileError}</span><button onClick={onRetryProfile}>Tentar novamente</button></div>;
  if (error) return <div className="social-feed-error" role="alert"><CircleAlert size={17} />{error}<button onClick={() => navigate("/feed")}>Voltar ao Feed</button></div>;
  if (!person) return <p className="social-inline-status"><LoaderCircle className="spin" size={17} /> Carregando perfil…</p>;
  const author = mapProfile({
    id: person.id, display_name: person.name, username: person.username, bio: person.bio,
    city: person.city, avatar_path: person.avatar, kind: person.kind, verified_at: person.verified ? "verified" : null,
    is_private: person.isPrivate,
  });
  author.avatar = person.avatar;
  const visibleProfileLinks = links.filter(link => (
    link.isPublic && link.validationStatus !== "blocked"
  ));
  return <div className="social-profile">
    <CommunityNavigation active="" />
    <section className="social-profile-card">
      <div className={`social-profile-cover${person.cover ? " has-image" : ""}`}>{person.cover ? <img src={person.cover} alt="" /> : <img className="social-profile-cover-default" src={visualPackAsset("fortalfy-pack-wellness-morning.jpg")} alt="" loading="lazy" />}
        {isOwn && <label className="social-profile-cover-edit" title="Alterar foto de capa"><Camera size={16} /><span>Editar capa</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" aria-label="Escolher foto de capa" onChange={event => updateProfileImage(event, "cover_path")} disabled={busy} /></label>}
      </div>
      <div className="social-profile-main">
        <div className="social-profile-avatar-wrap"><AuthorLink author={author} ownId={userId} />
          {isOwn && <label className="social-profile-avatar-edit" title="Alterar foto do perfil"><Camera size={14} /><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" aria-label="Escolher foto do perfil" onChange={event => updateProfileImage(event, "avatar_path")} disabled={busy} /></label>}
        </div>
        <div className="social-profile-bio"><h2>{person.name}{person.verified && <VerificationBadge size={18} />}</h2><span>@{person.username || "fortalfy"}</span>{person.isPrivate && <small className="social-profile-privacy-badge"><LockKeyhole size={12} /> Perfil privado</small>}<p>{person.bio || "Bem-estar no seu ritmo."}</p>{person.city && <small>{person.city}</small>}
          {linksLoading && <small className="profile-links-loading">Carregando links…</small>}
          {!linksLoading && linksError && isOwn && <small className="profile-links-error" role="alert">{linksError}</small>}
          {!linksLoading && !linksError && visibleProfileLinks.length > 0 && <div className="social-profile-links" aria-label="Links externos">
            {visibleProfileLinks.map(link => <a key={link.id || `${link.label}-${link.url}`} href={link.url} target="_blank" rel="noopener noreferrer" title={`${link.label} — você está saindo da Fortalfy`} onClick={event => {
              const host = new URL(link.url).hostname;
              if (!window.confirm(`Você está saindo da Fortalfy para ${host}. Deseja continuar?`)) event.preventDefault();
            }}><ExternalLink size={13} /><span>{link.label}</span></a>)}
          </div>}
        </div>
        {isOwn ? <button className="button subtle small-button" onClick={beginEdit} disabled={linksLoading}>Editar informações</button> : <div className="social-profile-actions"><button className="button primary small-button" disabled={busy} onClick={toggleFollow}>{follow.requestStatus === "pending" ? "Cancelar solicitação" : follow.isFollowing ? <><UserMinus size={15} /> Seguindo</> : <><UserPlus size={15} /> Seguir</>}</button><button className="button subtle small-button" onClick={() => navigate(`/messages?to=${encodeURIComponent(targetId)}`)}><MessageCircle size={15} /> Enviar mensagem</button></div>}
      </div>
      {approvedProfessionalProfiles.map(application => {
        const title = PROFESSIONAL_CATEGORIES.find(item => item.id === application.kind)?.label || "Perfil profissional";
        const data = application.public_data || {};
        return <section className="social-professional-public-card" key={application.application_id}>
          <span className="eyebrow">{title.toUpperCase()} · APROVADO</span>
          <h3>{data.displayName || person.name}</h3>
          {data.description && <p>{data.description}</p>}
          {data.city && <small>{data.city}</small>}
          {data.website && <a href={data.website} target="_blank" rel="noopener noreferrer" onClick={event => {
            const host = new URL(data.website).hostname;
            if (!window.confirm(`Você está saindo da Fortalfy para ${host}. Deseja continuar?`)) event.preventDefault();
          }}><ExternalLink size={14} /> Site oficial</a>}
        </section>;
      })}
      <div className="social-profile-metrics"><span><strong>{postCount}</strong> publicações</span><button type="button" onClick={() => openConnections("followers")}><strong>{follow.followers}</strong> seguidores</button><button type="button" onClick={() => openConnections("following")}><strong>{follow.following}</strong> seguindo</button><button onClick={handleProfileShare}><Share2 size={15} /> Compartilhar perfil</button></div>
      {isOwn && <button className="social-signout" onClick={async () => {
        if (onSignOut) {
          onSignOut();
          return;
        }
        const { error: signOutError } = await client.auth.signOut();
        if (signOutError) notify(getErrorMessage(signOutError));
      }}>Sair da conta</button>}
    </section>
    {detailsError && <p className="social-inline-error" role="alert">{detailsError}</p>}
    {isOwn && requests.length > 0 && <section className="social-follow-requests"><h3>Solicitações para seguir <span>{requests.length}</span></h3>{requests.map(request => <div className="social-follow-request" key={request.follower_id}><AuthorLink author={request.follower} ownId={userId} /><Link to={`/profile/${request.follower_id}`}><strong>{request.follower?.name || "Pessoa Fortalfy"}</strong><small>{formatDate(request.created_at)}</small></Link><button className="button primary small-button" disabled={busy} onClick={() => handleFollowRequest(request, true)}>Aceitar</button><button className="button subtle small-button" disabled={busy} onClick={() => handleFollowRequest(request, false)}>Recusar</button></div>)}</section>}
    {(person.kind === "marca" || person.kind === "academia" || approvedProfessionalProfiles.some(application => application.kind === "vendedor")) && <PartnerStorefront
      client={client}
      profile={approvedProfessionalProfiles.some(application => application.kind === "vendedor") ? { ...person, kind: "vendedor" } : person}
      userId={userId}
      isOwn={isOwn}
      notify={notify}
    />}
    <h3 className="social-profile-posts-title">Publicações</h3>
    {postsError && <div className="social-feed-error" role="alert"><CircleAlert size={17} /><span>{postsError}</span><button onClick={retryProfilePosts} disabled={postsLoading}>{postsLoading ? "Tentando…" : "Tentar novamente"}</button></div>}
    {person.isPrivate && !isOwn && !follow.isFollowing ? <div className="social-empty-feed"><ShieldCheck size={23} /><h3>Este perfil é privado</h3><p>Envie uma solicitação para ver suas publicações.</p></div>
      : postsError ? null
      : posts.length ? posts.map(post => <SocialPost key={post.id} post={post} client={client} userId={userId} onRefresh={async () => {
        const result = await loadFeed(client, userId, { authorId: targetId, limit: 20 });
        setPosts(result.posts);
        setPostCount(result.total);
        setPostsHasMore(result.hasMore);
      }} notify={notify} />)
        : <div className="social-empty-feed"><MessageCircle size={24} /><h3>Nenhuma publicação por aqui</h3><p>As publicações deste perfil aparecerão nesta área.</p>{isOwn && <Link className="button primary small-button social-profile-desktop-create" to="/feed"><Plus size={15} /> Criar publicação</Link>}</div>}
    {postsHasMore && <button className="button subtle wide-button social-load-more" onClick={loadMoreProfilePosts} disabled={postsLoading}>{postsLoading ? "Carregando…" : "Carregar mais publicações"}</button>}
    {connectionsDialog && <div className="social-share-scrim" role="presentation" onMouseDown={event => event.target === event.currentTarget && setConnectionsDialog(null)}><section className="social-share-dialog social-connections-dialog" role="dialog" aria-modal="true" aria-label={connectionsDialog.direction === "followers" ? "Seguidores" : "Perfis seguidos"}><header><strong>{connectionsDialog.direction === "followers" ? "Seguidores" : "Seguindo"}</strong><button className="social-icon-button" onClick={() => setConnectionsDialog(null)} aria-label="Fechar"><X size={18} /></button></header>{connectionsError && <p className="social-inline-error" role="alert">{connectionsError}<button type="button" onClick={() => openConnections(connectionsDialog.direction)}>Tentar novamente</button></p>}{connectionsDialog.profiles.length > 0 && <ul className="social-connection-list">{connectionsDialog.profiles.map(connection => <li key={connection.id}><Link to={`/profile/${connection.id}`} onClick={() => setConnectionsDialog(null)}><span className="social-person-avatar">{connection.avatar ? <img src={connection.avatar} alt="" /> : connection.name.slice(0, 1).toUpperCase()}</span><span><strong>{connection.name}</strong><small>{connection.username ? `@${connection.username}` : "Perfil Fortalfy"}</small></span><ArrowRight size={16} /></Link></li>)}</ul>}{connectionsLoading && <p className="social-inline-status" role="status"><LoaderCircle className="spin" size={16} /> Carregando perfis…</p>}{!connectionsLoading && !connectionsError && !connectionsDialog.profiles.length && <p className="social-empty-comments">Nenhum perfil aparece nesta lista.</p>}{connectionsHasMore && <button className="button subtle wide-button" onClick={loadMoreConnections} disabled={connectionsLoading}>Carregar mais perfis</button>}</section></div>}
    {editOpen && <div className="social-share-scrim" role="presentation" onMouseDown={event => event.target === event.currentTarget && setEditOpen(false)}>
      <section className="social-share-dialog" role="dialog" aria-modal="true" aria-label="Editar perfil">
        <header><strong>Editar perfil</strong><button className="social-icon-button" onClick={() => setEditOpen(false)} aria-label="Fechar"><X size={18} /></button></header>
        <form onSubmit={saveProfile} className="social-profile-edit-form">
          <label>Nome<input value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} required maxLength={120} /></label>
          <label>Nome de usuário<input value={draft.username} onChange={event => setDraft(current => ({ ...current, username: event.target.value.toLowerCase() }))} maxLength={30} pattern="[A-Za-z0-9._]{3,30}" /><small>De 3 a 30 caracteres: letras, números, ponto e sublinhado.</small>{profileUsername.length >= 3 && /^[a-z0-9._]{3,30}$/.test(profileUsername) && <small className={`auth-username-availability ${profileUsernameCheck.error ? "is-error" : profileUsernameCheck.available ? "is-available" : profileUsernameCheck.available === false ? "is-unavailable" : ""}`}>{profileUsernameCheck.username !== profileUsername || profileUsernameCheck.checking ? "Verificando disponibilidade…" : profileUsernameCheck.error ? "Não foi possível verificar agora; a disponibilidade será validada ao salvar." : profileUsernameCheck.available ? "Nome de usuário disponível." : "Nome de usuário em uso ou reservado."}</small>}</label>
          <label>Biografia<textarea value={draft.bio} onChange={event => setDraft(current => ({ ...current, bio: event.target.value }))} maxLength={professionalProfile ? 150 : 2000} rows={4} /><small>{Math.max(0, (professionalProfile ? 150 : 2000) - draft.bio.length)} caracteres restantes</small></label>
          <label>Cidade<input value={draft.city} onChange={event => setDraft(current => ({ ...current, city: event.target.value }))} maxLength={120} /></label>
          <fieldset className="profile-link-editor">
            <legend>Links e redes sociais</legend>
            <p>Adicione até oito links HTTPS. Um link cadastrado não significa que o site ou a conta foi verificado pela Fortalfy.</p>
            {draftLinks.map((link, index) => <div className="profile-link-editor-row" key={link.id || `draft-link-${index}`}>
              <label>Nome de exibição<input value={link.label} maxLength={80} placeholder="Ex.: Instagram profissional" onChange={event => setDraftLinks(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} /></label>
              <label>URL HTTPS<input type="url" value={link.url} maxLength={2048} placeholder="https://..." onChange={event => setDraftLinks(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, url: event.target.value } : item))} /></label>
              <label>Tipo<select value={link.type} onChange={event => setDraftLinks(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value } : item))}>
                <option value="social">Rede social</option><option value="official">Site oficial declarado</option><option value="booking">Agendamento</option><option value="menu">Cardápio</option><option value="portfolio">Portfólio</option><option value="catalog">Catálogo / loja</option><option value="contact">Contato</option><option value="other">Outro</option>
              </select></label>
              <label className="profile-link-visibility"><input type="checkbox" checked={link.isPublic !== false} onChange={event => setDraftLinks(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, isPublic: event.target.checked } : item))} /> Exibir publicamente</label>
              <div className="profile-link-order">
                <button type="button" aria-label={`Mover ${link.label || "link"} para cima`} disabled={index === 0} onClick={() => setDraftLinks(current => current.map((item, itemIndex) => itemIndex === index ? current[index - 1] : itemIndex === index - 1 ? current[index] : item))}><ArrowUp size={15} /></button>
                <button type="button" aria-label={`Mover ${link.label || "link"} para baixo`} disabled={index === draftLinks.length - 1} onClick={() => setDraftLinks(current => current.map((item, itemIndex) => itemIndex === index ? current[index + 1] : itemIndex === index + 1 ? current[index] : item))}><ArrowDown size={15} /></button>
                <button type="button" aria-label={`Remover ${link.label || "link"}`} onClick={() => setDraftLinks(current => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={15} /></button>
              </div>
            </div>)}
            <button type="button" className="button subtle small-button" disabled={draftLinks.length >= 8} onClick={() => setDraftLinks(current => [...current, { label: "", url: "", type: "social", isPublic: true }])}><Plus size={15} /> Adicionar link</button>
            {draftLinks.length > 0 && <div className="profile-link-preview"><strong>Prévia pública</strong>{draftLinks.filter(link => link.isPublic !== false && link.label.trim() && link.url.trim()).map((link, index) => <span key={`${link.label}-${index}`}><LinkIcon size={13} /> {link.label}</span>)}</div>}
          </fieldset>
          {(person.avatar || person.cover) && <div className="social-remove-image-actions">{person.avatar && <button className="social-remove-image" type="button" disabled={busy} onClick={() => clearProfileImage("avatar_path")}>Remover foto do perfil</button>}{person.cover && <button className="social-remove-image" type="button" disabled={busy} onClick={() => clearProfileImage("cover_path")}>Remover foto de capa</button>}</div>}
          <fieldset className="profile-privacy-choice"><legend>Visibilidade do perfil</legend>
            <label><input type="radio" name="profile-visibility" value="public" checked={!draft.isPrivate} onChange={() => setDraft(current => ({ ...current, isPrivate: false }))} /><span><strong>Perfil público</strong><small>Qualquer pessoa pode ver suas publicações.</small></span></label>
            <label><input type="radio" name="profile-visibility" value="private" checked={draft.isPrivate} onChange={() => setDraft(current => ({ ...current, isPrivate: true }))} /><span><strong>Perfil privado</strong><small>Somente seguidores aprovados podem ver suas publicações.</small></span></label>
          </fieldset>
          <button className="button primary wide-button" disabled={busy}>{busy ? "Salvando…" : "Salvar alterações"}</button>
        </form>
      </section>
    </div>}
    {imageDraft && createPortal(<div className="social-share-scrim" role="presentation" onMouseDown={event => event.target === event.currentTarget && !busy && setImageDraft(null)}>
      <section className="social-share-dialog social-image-crop-dialog" role="dialog" aria-modal="true" aria-labelledby="social-image-crop-title" aria-describedby="social-image-crop-description" aria-busy={busy} onKeyDown={event => {
        if (event.key === "Escape" && !busy) setImageDraft(null);
        if (event.key === "Tab") {
          const focusable = [...event.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled), canvas[tabindex="0"]')];
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
        <header><strong id="social-image-crop-title">{imageDraft.field === "avatar_path" ? "Ajustar foto do perfil" : "Ajustar foto de capa"}</strong><button autoFocus type="button" className="social-icon-button" onClick={() => setImageDraft(null)} aria-label="Fechar edição da imagem" disabled={busy}><X size={18} /></button></header>
        <ProfileImageCropPreview imageDraft={imageDraft} setImageDraft={setImageDraft} />
        {imageDraft.file.type === "image/gif"
          ? <p className="social-image-crop-note">GIFs animados são mantidos sem corte para preservar a animação.</p>
          : <div className="social-image-zoom">
            <div><label htmlFor="social-image-zoom">Zoom</label><output htmlFor="social-image-zoom">{Math.round(imageDraft.zoom * 100)}%</output></div>
            <input id="social-image-zoom" aria-label="Zoom do enquadramento" type="range" min="1" max="3" step="0.05" value={imageDraft.zoom} onChange={event => setImageDraft(current => ({ ...current, zoom: Number(event.target.value) }))} />
            <button type="button" className="social-image-crop-reset" disabled={busy} onClick={() => setImageDraft(current => ({ ...current, zoom: 1, panX: 0, panY: 0 }))}>Redefinir</button>
          </div>}
        <p id="social-image-crop-description" className="social-image-crop-note">{imageDraft.file.type === "image/gif" ? "Prévia central do GIF. Arraste desativado para manter a animação original." : "Arraste para reposicionar. A prévia mostra o recorte que será salvo."}</p>
        {imageDraft.previewError && <p className="social-image-crop-error" role="alert">{imageDraft.previewError}</p>}
        <footer className="social-image-crop-actions"><button type="button" className="button subtle" disabled={busy} onClick={() => setImageDraft(null)}>Cancelar</button><button type="button" className="button primary" disabled={busy || imageDraft.previewLoading || !!imageDraft.previewError} onClick={saveProfileImage}>{busy ? "Salvando imagem…" : "Salvar"}</button></footer>
      </section>
    </div>, document.querySelector(".mobile-app") || document.body)}
  </div>;
}
