import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Bookmark, ChevronDown, ChevronRight, CircleAlert, Clapperboard, Compass, Heart,
  ImagePlus, LoaderCircle, LockKeyhole, MessageCircle, MoreHorizontal,
  Search, Send, Share2, ShieldCheck, UserMinus, UserPlus, Users, Video, X,
} from "lucide-react";
import {
  addComment, cancelFollowRequest, deleteComment, deletePost, getErrorMessage,
  hidePost, loadComments, loadFeed, loadFollowRequests, loadFollowState, loadProfile,
  loadConversations, loadDirectMessages, mapProfile, markConversationRead, publishPost,
  reportComment, reportPost, respondFollowRequest, searchProfiles, sendDirectMessage,
  setBookmark, removeProfileImage, setCommentLike, setFollow, setPostLike, sharePost, startConversation,
  updateComment, updatePost, uploadProfileImage,
} from "./socialService.js";

const mediaUrl = path => path || "";
const formatDate = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "agora"
    : date.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

function SocialAuth({ client, configured, notify, recovery = false, onRecovered }) {
  const [mode, setMode] = useState(recovery ? "update" : "login");
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState({ name: "", email: "", password: "" });
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (recovery) {
      setMode("update");
      setMessage("");
    }
  }, [recovery]);

  const submit = async event => {
    event.preventDefault();
    setMessage("");
    if (!configured || !client) {
      setMessage("A conexão com o Supabase ainda não foi configurada nesta publicação.");
      return;
    }
    if (mode === "signup" && fields.name.trim().length < 2) {
      setMessage("Informe um nome com pelo menos 2 caracteres.");
      return;
    }
    if (mode !== "reset" && fields.password.length < 8) {
      setMessage("Use uma senha com pelo menos 8 caracteres.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "update") {
        const { error } = await client.auth.updateUser({ password: fields.password });
        if (error) throw error;
        setMessage("Senha atualizada com sucesso.");
        onRecovered?.();
      } else if (mode === "signup") {
        const { data, error } = await client.auth.signUp({
          email: fields.email.trim(),
          password: fields.password,
          options: { data: { display_name: fields.name.trim() } },
        });
        if (error) throw error;
        setMessage(data.session
          ? "Conta criada. Seu perfil já está pronto."
          : "Conta criada. Confirme seu e-mail pelo link enviado para entrar.");
      } else if (mode === "reset") {
        const { error } = await client.auth.resetPasswordForEmail(fields.email.trim());
        if (error) throw error;
        setMessage("Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.");
      } else {
        const { error } = await client.auth.signInWithPassword({
          email: fields.email.trim(),
          password: fields.password,
        });
        if (error) throw error;
      }
    } catch (error) {
      console.error("Falha na autenticação Supabase.", error);
      setMessage(getErrorMessage(error, "Não foi possível autenticar."));
    } finally {
      setBusy(false);
    }
  };

  return <section className="social-auth-card">
    <span className="social-auth-icon"><LockKeyhole size={20} /></span>
    <span className="eyebrow">FORTALFY COMUNIDADE</span>
    <h2>{mode === "signup" ? "Crie sua conta" : mode === "reset" ? "Recupere seu acesso" : mode === "update" ? "Defina uma nova senha" : "Entre para participar"}</h2>
    <p>Entre ou crie uma conta para publicar, comentar e interagir com pessoas reais.</p>
    {!configured && <div className="social-config-warning"><CircleAlert size={17} /> {message || "O app está aguardando as variáveis do Supabase na publicação."}</div>}
    <form className="social-auth-form" onSubmit={submit}>
      {mode === "signup" && <label>Nome de exibição<input autoComplete="name" value={fields.name} minLength={2} maxLength={120} onChange={event => setFields(current => ({ ...current, name: event.target.value }))} required /></label>}
      <label>E-mail<input type="email" autoComplete="email" value={fields.email} onChange={event => setFields(current => ({ ...current, email: event.target.value }))} required /></label>
      {mode !== "reset" && <label>Senha<input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} value={fields.password} onChange={event => setFields(current => ({ ...current, password: event.target.value }))} required /></label>}
      {message && configured && <p className="social-auth-message" role="status">{message}</p>}
      <button className="button primary wide-button" type="submit" disabled={busy || !configured}>
        {busy ? <LoaderCircle className="spin" size={16} /> : null}
        {mode === "signup" ? "Criar conta" : mode === "reset" ? "Enviar link de recuperação" : mode === "update" ? "Atualizar senha" : "Entrar"}
      </button>
    </form>
    <div className="social-auth-links">
      {mode !== "login" && mode !== "update" && <button type="button" onClick={() => { setMode("login"); setMessage(""); }}>Já tenho uma conta</button>}
      {mode === "login" && <><button type="button" onClick={() => { setMode("signup"); setMessage(""); }}>Criar conta</button><button type="button" onClick={() => { setMode("reset"); setMessage(""); }}>Esqueci a senha</button></>}
    </div>
    <small>Suas publicações e interações ficam associadas à sua conta, não apenas a este aparelho.</small>
  </section>;
}

function AuthorLink({ author, ownId }) {
  if (!author) return <span className="social-avatar social-avatar-fallback">?</span>;
  const target = author.id === ownId ? "/profile" : `/profile/${author.id}`;
  return <Link className="social-avatar" to={target} aria-label={`Abrir perfil de ${author.name}`}>
    {author.avatar ? <img src={mediaUrl(author.avatar)} alt="" /> : author.name.slice(0, 1).toUpperCase()}
  </Link>;
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
        <Link className="social-comment-author" to={own ? "/profile" : `/profile/${comment.author?.id}`}>{comment.author?.name || "Pessoa Fortalfy"}</Link>
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

function PostMedia({ media, onOpen, reelMode = false }) {
  if (!media?.length) return null;
  return <div className={`social-media-grid count-${Math.min(media.length, 4)}`}>
    {media.slice(0, 4).map((item, index) => <div key={item.id || item.storage_path} className="social-media-item">
      {item.media_type === "video"
        ? <video src={item.url} controls playsInline preload="metadata" loop={reelMode} muted={reelMode} />
        : <button type="button" onClick={() => onOpen(media, index)} aria-label={`Ampliar mídia ${index + 1}`}><img src={item.url} alt={`Mídia da publicação ${index + 1}`} loading="lazy" />{index === 3 && media.length > 4 && <span>+{media.length - 4}</span>}</button>}
    </div>)}
  </div>;
}

function CreatePost({ client, userId, onPublished, notify, videosOnly = false }) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState([]);
  const [visibility, setVisibility] = useState("public");
  const [busy, setBusy] = useState(false);

  const chooseFiles = event => {
    const selected = Array.from(event.target.files || []);
    const current = files.length;
    if (current + selected.length > 10) {
      notify("Adicione no máximo 10 fotos ou vídeos por publicação.");
      event.target.value = "";
      return;
    }
    for (const file of selected) {
      const image = file.type.startsWith("image/") && ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type);
      const video = ["video/mp4", "video/webm"].includes(file.type);
      if (videosOnly && !video) {
        notify("Para criar um Reel, selecione um vídeo MP4 ou WebM.");
        event.target.value = "";
        return;
      }
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
      await publishPost(client, userId, { body, files, visibility });
      setBody("");
      setFiles([]);
      notify("Publicação enviada para a comunidade.");
      await onPublished();
    } catch (error) {
      console.error("Falha ao publicar no Feed.", error);
      notify(getErrorMessage(error, "Não foi possível publicar. Sua publicação não foi enviada."));
    } finally {
      setBusy(false);
    }
  };

  return <form className="social-create-post" onSubmit={submit}>
    <label className="social-create-text"><span className="sr-only">{videosOnly ? "Legenda do Reel" : "Texto da publicação"}</span><textarea value={body} maxLength={5000} rows={3} onChange={event => setBody(event.target.value)} placeholder={videosOnly ? "Escreva uma legenda para seu Reel..." : "No que você está pensando?"} /><small>{body.length}/5.000</small></label>
    {!!files.length && <div className="social-file-list">{files.map((file, index) => <span key={`${file.name}-${index}`}>{file.type.startsWith("video/") ? <Video size={14} /> : <ImagePlus size={14} />}{file.name}<button type="button" aria-label={`Remover ${file.name}`} onClick={() => setFiles(current => current.filter((_, itemIndex) => itemIndex !== index))}><X size={14} /></button></span>)}</div>}
    <div className="social-create-footer">
      <label className="button subtle small-button social-file-picker">{videosOnly ? <Clapperboard size={16} /> : <ImagePlus size={16} />}{videosOnly ? " Vídeo do Reel" : " Foto/vídeo"}<input type="file" accept={videosOnly ? "video/mp4,video/webm" : "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"} multiple={!videosOnly} onChange={chooseFiles} /></label>
      <label className="social-visibility"><ShieldCheck size={14} /><select value={visibility} onChange={event => setVisibility(event.target.value)}><option value="public">Público</option><option value="followers">Seguidores</option></select><ChevronDown size={13} /></label>
      <button className="button primary small-button" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : <Send size={15} />} {videosOnly ? "Publicar Reel" : "Publicar"}</button>
    </div>
  </form>;
}

function SocialPost({ post, userId, client, onRefresh, notify, reelMode = false }) {
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
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [lightboxMedia, setLightboxMedia] = useState([]);
  const [followingAuthor, setFollowingAuthor] = useState(false);
  const [authorFollowRequest, setAuthorFollowRequest] = useState("");
  const [saved, setSaved] = useState(Boolean(post.savedByMe));
  const [liked, setLiked] = useState(Boolean(post.likedByMe));
  const [likeCount, setLikeCount] = useState(post.likeCount || 0);
  const own = post.author_id === userId;
  const longBody = post.body.length > 500;
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
    if (own) return undefined;
    let active = true;
    loadFollowState(client, userId, post.author_id)
      .then(state => {
        if (!active) return;
        setFollowingAuthor(state.isFollowing);
        setAuthorFollowRequest(state.requestStatus);
      })
      .catch(error => console.error("Não foi possível carregar o estado de seguimento.", error));
    return () => { active = false; };
  }, [client, userId, post.author_id, own]);

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
  const toggleFollow = async () => {
    const result = await doAction(() => authorFollowRequest === "pending"
      ? cancelFollowRequest(client, userId, post.author_id)
      : setFollow(client, userId, post.author_id, !followingAuthor, post.author?.isPrivate));
    if (result) {
      if (authorFollowRequest === "pending") {
        setAuthorFollowRequest("");
        notify("Solicitação cancelada.");
      } else {
        setFollowingAuthor(!followingAuthor && !post.author?.isPrivate);
        setAuthorFollowRequest(post.author?.isPrivate && !followingAuthor ? "pending" : "");
        notify(post.author?.isPrivate && !followingAuthor ? "Solicitação de seguimento enviada." : followingAuthor ? "Você deixou de seguir este perfil." : "Perfil seguido.");
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
    const reason = window.prompt("Por que deseja denunciar esta publicação? (mínimo de 3 caracteres)");
    if (reason == null) return;
    if (reason.trim().length < 3) {
      notify("Descreva o motivo da denúncia.");
      return;
    }
    await doAction(() => reportPost(client, userId, post.id, reason.trim()), "Denúncia enviada à moderação.");
    setMenuOpen(false);
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

  return <article className={`social-post-card${reelMode ? " social-reel-card" : ""}`} id={`post-${post.id}`}>
    {post.shared_post_id && <div className="social-shared-label"><Share2 size={14} /> {post.author?.name || "Uma pessoa"} compartilhou</div>}
    <header className="social-post-header">
      <AuthorLink author={post.author} ownId={userId} />
      <div className="social-post-author">
        <Link to={own ? "/profile" : `/profile/${post.author?.id}`}><strong>{post.author?.name || "Pessoa Fortalfy"}</strong>{post.author?.verified && <ShieldCheck size={15} fill="currentColor" />}</Link>
        <span><time dateTime={post.published_at}>{formatDate(post.published_at)}</time> · {post.visibility === "followers" ? <Users size={12} /> : <Users size={12} />} {post.visibility === "followers" ? "Seguidores" : "Público"}</span>
      </div>
      <div className="social-post-menu-wrap">
        <button className="social-icon-button" aria-label="Opções da publicação" aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}><MoreHorizontal size={20} /></button>
        {menuOpen && <div className="social-post-menu">
          {own && <><button onClick={editPost}>Editar publicação</button><button className="danger-action" onClick={removePost}>Excluir publicação</button></>}
          <button onClick={bookmark}><Bookmark size={14} /> {saved ? "Remover dos salvos" : "Salvar publicação"}</button>
          <button onClick={copyLink}>Copiar link</button>
          {!own && <button onClick={hide}>Ocultar publicação</button>}
          {!own && <><button onClick={toggleFollow}>{followingAuthor ? <UserMinus size={14} /> : <UserPlus size={14} />}{authorFollowRequest === "pending" ? "Cancelar solicitação" : followingAuthor ? "Deixar de seguir" : post.author?.isPrivate ? "Solicitar para seguir" : "Seguir autor"}</button><button className="danger-action" onClick={report}><CircleAlert size={14} /> Denunciar</button></>}
        </div>}
      </div>
    </header>
    {!!post.body && <div className="social-post-text"><LinkifiedText text={displayBody} />{longBody && <button className="social-text-toggle" onClick={() => setExpanded(value => !value)}>{expanded ? "Ver menos" : "Ver mais"}</button>}</div>}
    {post.media?.length > 0 && <PostMedia media={post.media} reelMode={reelMode} onOpen={(media, index) => { setLightboxMedia(media); setLightboxIndex(index); }} />}
    {post.original && <div className="social-original-post"><div className="social-original-author"><AuthorLink author={post.original.author} ownId={userId} /><span><strong>{post.original.author?.name}</strong><small>{formatDate(post.original.published_at)}</small></span></div><LinkifiedText text={post.original.body} /><PostMedia media={post.original.media} reelMode={reelMode} onOpen={(media, index) => { setLightboxMedia(media); setLightboxIndex(index); }} /></div>}
    <div className="social-post-stats"><span>{likeCount > 0 && <><Heart size={14} fill="currentColor" /> {likeCount} curtida{likeCount === 1 ? "" : "s"}</>}</span><span>{post.commentCount} comentário{post.commentCount === 1 ? "" : "s"} · {post.shareCount} compartilhamento{post.shareCount === 1 ? "" : "s"}</span></div>
    <div className="social-post-actions">
      <button className={liked ? "is-liked" : ""} aria-pressed={liked} onClick={toggleLike} disabled={busy}><Heart size={18} fill={liked ? "currentColor" : "none"} /> Curtir</button>
      <button onClick={openComments}><MessageCircle size={18} /> Comentar</button>
      <button onClick={() => setShareOpen(true)}><Share2 size={18} /> Compartilhar</button>
    </div>
    {commentsOpen && <section className="social-comments">
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
          <span className="social-person-name">{person.name}{person.verified && <ShieldCheck size={15} fill="currentColor" />}</span>
          <span className="social-person-username">@{person.username || "fortalfy"}</span>
          {person.bio && <span className="social-person-bio">{person.bio}</span>}
          <span className="social-person-action">Ver perfil <ChevronRight size={14} /></span>
        </Link>)}</div>}
        {hasMore && <button className="button subtle wide-button social-load-more" onClick={loadMore} disabled={loading}>{loading ? "Carregando…" : "Carregar mais pessoas"}</button>}
      </section>}
  </div>;
}

export function SocialMessages({ client, session, configured, notify }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const userId = session?.user?.id;
  const targetId = searchParams.get("to");

  const refreshConversations = async () => {
    const rows = await loadConversations(client, userId);
    setConversations(rows);
    if (conversation) {
      const updated = rows.find(item => item.id === conversation.id);
      if (updated) setConversation(updated);
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
        if (targetId && targetId !== userId) {
          const person = await loadProfile(client, targetId);
          const started = await startConversation(client, userId, targetId);
          if (!active) return;
          const match = rows.find(item => item.id === started.id) || {
            ...started,
            person,
            latestMessage: null,
          };
          setConversation(match);
          const nextParams = new URLSearchParams(searchParams);
          nextParams.delete("to");
          setSearchParams(nextParams, { replace: true });
        } else if (conversation) {
          setConversation(rows.find(item => item.id === conversation.id) || null);
        }
        setError("");
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
  }, [client, userId, targetId]);

  useEffect(() => {
    if (!client || !userId || !conversation?.id) return undefined;
    let active = true;
    const refreshMessages = async () => {
      try {
        const rows = await loadDirectMessages(client, userId, conversation.id);
        if (!active) return;
        setMessages(rows);
        await markConversationRead(client, userId, conversation);
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
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [client, userId, conversation?.id]);

  const openConversation = item => {
    setConversation(item);
    setMessages([]);
    setError("");
  };

  const submitMessage = async event => {
    event.preventDefault();
    if (!conversation || !draft.trim()) return;
    setSending(true);
    try {
      const message = await sendDirectMessage(client, userId, conversation.id, draft);
      setMessages(current => [...current, message]);
      setDraft("");
      await refreshConversations();
      await markConversationRead(client, userId, conversation);
      setError("");
    } catch (failure) {
      console.error("Falha ao enviar mensagem.", failure);
      setError(getErrorMessage(failure, "Não foi possível enviar a mensagem."));
    } finally {
      setSending(false);
    }
  };

  const formatMessageTime = value => new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  if (!configured || !session) return <div className="social-messages-page"><CommunityNavigation active="messages" /><SocialAuth client={client} configured={configured} notify={notify} /></div>;

  return <div className="social-messages-page">
    <CommunityNavigation active="messages" />
    <section className={`social-messages-panel${conversation ? " conversation-open" : ""}`}>
      <aside className="social-conversation-list">
        <header><div><span className="eyebrow">SUA COMUNIDADE</span><h2>Conversas</h2></div><Link to="/people" className="button subtle small-button"><Users size={15} /> Pessoas</Link></header>
        {loading && !conversations.length && <p className="social-inline-status"><LoaderCircle className="spin" size={16} /> Carregando conversas…</p>}
        {!loading && !conversations.length && <div className="social-empty-feed"><MessageCircle size={22} /><h3>Comece uma conversa</h3><p>Abra um perfil público e toque em “Enviar mensagem”.</p><Link className="button primary small-button" to="/people">Encontrar pessoas</Link></div>}
        {conversations.map(item => <button key={item.id} className={`social-conversation-item${conversation?.id === item.id ? " active" : ""}`} onClick={() => openConversation(item)}>
          <span className="social-person-avatar">{item.person?.avatar ? <img src={item.person.avatar} alt="" /> : item.person?.name?.slice(0, 1).toUpperCase()}</span>
          <span className="social-conversation-preview"><strong>{item.person?.name || "Pessoa Fortalfy"}</strong><small>{item.latestMessage?.body || "Inicie uma conversa"}</small></span>
          {item.latestMessage && <time>{formatMessageTime(item.latestMessage.created_at)}</time>}
        </button>)}
      </aside>
      {conversation ? <section className="social-chat-window">
        <header className="social-chat-header"><button className="social-chat-back" onClick={() => setConversation(null)} aria-label="Voltar às conversas"><ArrowLeft size={18} /></button><Link to={`/profile/${conversation.person?.id}`} className="social-chat-person"><span className="social-person-avatar">{conversation.person?.avatar ? <img src={conversation.person.avatar} alt="" /> : conversation.person?.name?.slice(0, 1).toUpperCase()}</span><span><strong>{conversation.person?.name}</strong><small>@{conversation.person?.username || "fortalfy"}</small></span></Link></header>
        {error && <p className="social-inline-error" role="alert">{error}</p>}
        <div className="social-chat-messages" aria-live="polite">{messages.map(message => <article key={message.id} className={`social-chat-bubble${message.sender_id === userId ? " own" : ""}`}><p>{message.body}</p><time dateTime={message.created_at}>{formatMessageTime(message.created_at)}</time></article>)}</div>
        <form className="social-chat-composer" onSubmit={submitMessage}><label className="sr-only" htmlFor="social-chat-draft">Sua mensagem</label><textarea id="social-chat-draft" rows={1} value={draft} maxLength={4000} onChange={event => setDraft(event.target.value)} placeholder="Escreva uma mensagem..." required /><button className="button primary small-button" aria-label="Enviar mensagem" disabled={sending || !draft.trim()}>{sending ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />}</button></form>
      </section> : <div className="social-chat-placeholder"><MessageCircle size={28} /><h3>Suas conversas, em um só lugar</h3><p>As mensagens são privadas entre você e a pessoa escolhida.</p></div>}
    </section>
  </div>;
}

export function SocialFeed({ client, configured, session, profile, profileError = "", feedArts = [], notify, recovery = false, onRecovered, onRetryProfile, mediaType = "" }) {
  const [filter, setFilter] = useState("latest");
  const [posts, setPosts] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const userId = session?.user?.id;
  const filters = [["latest", "Mais recentes"], ["following", "Seguindo"]];

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

  useEffect(() => {
    if (!client || !userId) return undefined;
    let active = true;
    setLoading(true);
    setError("");
    loadFeed(client, userId, { filter, offset: 0, mediaType })
      .then(result => {
        if (!active) return;
        setPosts(result.posts);
        setHasMore(result.hasMore);
      })
      .catch(failure => {
        if (!active) return;
        console.error("Falha ao carregar o Feed social.", failure);
        setError(getErrorMessage(failure, "Não foi possível carregar o Feed."));
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [client, userId, filter, mediaType]);

  const loadMore = async () => {
    setLoading(true);
    try {
      const result = await loadFeed(client, userId, { filter, offset: posts.length, mediaType });
      setPosts(current => [...current, ...result.posts]);
      setHasMore(result.hasMore);
    } catch (failure) {
      console.error("Falha ao carregar mais publicações.", failure);
      notify(getErrorMessage(failure, "Não foi possível carregar mais publicações."));
    } finally {
      setLoading(false);
    }
  };

  const reelMode = mediaType === "video";
  if (recovery) return <SocialAuth client={client} configured={configured} notify={notify} recovery onRecovered={onRecovered} />;
  if (!session) return <><CommunityNavigation active={reelMode ? "reels" : "feed"} /><SocialAuth client={client} configured={configured} notify={notify} /></>;
  if (profileError) return <div className="social-feed-error" role="alert"><CircleAlert size={17} /><span>{profileError}</span><button onClick={onRetryProfile}>Tentar novamente</button></div>;
  if (!profile) return <div className="social-inline-status"><LoaderCircle className="spin" size={17} /> Preparando seu perfil…</div>;
  return <div className="social-feed">
    <CommunityNavigation active={reelMode ? "reels" : "feed"} />
    {reelMode && <div className="social-reels-intro"><Clapperboard size={19} /><span><strong>Reels da comunidade</strong><small>Vídeos públicos publicados por pessoas cadastradas.</small></span></div>}
    <div className="social-feed-toolbar"><div className="social-filter-tabs">{filters.map(([value, label]) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>)}</div><button className="social-refresh" onClick={refresh} disabled={refreshing}>{refreshing ? <LoaderCircle className="spin" size={15} /> : "Atualizar"}</button></div>
    <CreatePost client={client} userId={userId} onPublished={refresh} notify={notify} videosOnly={reelMode} />
    {!reelMode && feedArts.length > 0 && <section className="social-local-creations"><h3>Criações deste aparelho</h3><p>Essas peças ainda não foram publicadas para outras contas.</p><div>{feedArts.map(art => <article key={art.id}><img src={art.dataUrl} alt={`Criação local: ${art.title}`} /><span>SOMENTE NESTE APARELHO</span><strong>{art.title}</strong></article>)}</div></section>}
    {error && <div className="social-feed-error" role="alert"><CircleAlert size={17} /><span>{error}</span><button onClick={refresh}>Tentar novamente</button></div>}
    {loading && !posts.length && <p className="social-inline-status"><LoaderCircle className="spin" size={17} /> Carregando publicações…</p>}
    {!loading && !error && !posts.length && <div className="social-empty-feed"><Users size={25} /><h2>{reelMode ? "Ainda não há Reels" : filter === "following" ? "Você ainda não segue ninguém" : "O Feed está começando"}</h2><p>{reelMode ? "Quando a comunidade publicar vídeos, eles aparecerão aqui. Você pode publicar o primeiro Reel agora." : filter === "following" ? "Siga perfis para ver as publicações deles aqui." : "Quando as pessoas publicarem, as novidades aparecerão aqui. Você pode começar com uma publicação sua."}</p></div>}
    {posts.map(post => <SocialPost key={post.id} post={post} client={client} userId={userId} onRefresh={refresh} notify={notify} reelMode={reelMode} />)}
    {hasMore && <button className="button subtle wide-button social-load-more" onClick={loadMore} disabled={loading}>{loading ? "Carregando…" : "Carregar mais publicações"}</button>}
  </div>;
}

export function SocialProfile({ client, session, profile, profileError = "", configured, notify, onProfileUpdated, recovery = false, onRecovered, onRetryProfile }) {
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
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", username: "", bio: "", city: "", isPrivate: false });

  useEffect(() => {
    if (!isOwn) setPerson(null);
    if (!client || !userId || !targetId) return undefined;
    let active = true;
    Promise.all([
      isOwn ? Promise.resolve(profile) : loadProfile(client, targetId),
      loadFeed(client, userId, { filter: "latest", offset: 0, limit: 20, authorId: targetId }),
      loadFollowState(client, userId, targetId),
      isOwn ? loadFollowRequests(client, userId) : Promise.resolve([]),
    ]).then(([nextPerson, feed, nextFollow, nextRequests]) => {
      if (!active) return;
      if (!nextPerson) throw new Error("Perfil não encontrado ou não disponível para sua conta.");
      setPerson(nextPerson);
      setPosts(feed.posts);
      setPostCount(feed.total);
      setPostsHasMore(feed.hasMore);
      setFollow(nextFollow);
      setRequests(nextRequests);
      setError("");
    }).catch(failure => {
      if (!active) return;
      console.error("Falha ao carregar o perfil social.", failure);
      setError(getErrorMessage(failure, "Não foi possível carregar este perfil."));
    });
    return () => { active = false; };
  }, [client, userId, targetId, isOwn, profile]);

  const saveProfile = async event => {
    event.preventDefault();
    const name = draft.name.trim();
    const username = draft.username.trim().replace(/^@/, "").toLowerCase();
    const bio = draft.bio.trim();
    const city = draft.city.trim();
    if (name.length < 2 || name.length > 120 || bio.length > 2000 || (username && !/^[a-z0-9._]{3,24}$/.test(username))) {
      notify("Confira o nome, a biografia (até 2.000 caracteres) e o nome de usuário.");
      return;
    }
    setBusy(true);
    try {
      const { error: saveError } = await client.from("profiles").update({
        display_name: name,
        username: username || null,
        bio,
        city: city || null,
        is_private: draft.isPrivate,
      }).eq("id", userId);
      if (saveError) throw saveError;
      await onProfileUpdated();
      setEditOpen(false);
      notify("Perfil atualizado.");
    } catch (failure) {
      console.error("Falha ao atualizar o perfil.", failure);
      notify(getErrorMessage(failure, "Não foi possível atualizar seu perfil."));
    } finally {
      setBusy(false);
    }
  };
  const beginEdit = () => {
    setDraft({ name: person?.name || "", username: person?.username || "", bio: person?.bio || "", city: person?.city || "", isPrivate: Boolean(person?.isPrivate) });
    setEditOpen(true);
  };
  const toggleFollow = async () => {
    if (!userId) return;
    setBusy(true);
    try {
      if (follow.requestStatus === "pending") {
        await cancelFollowRequest(client, userId, targetId);
        setFollow(current => ({ ...current, requestStatus: "" }));
        notify("Solicitação cancelada.");
        return;
      }
      const wasFollowing = follow.isFollowing;
      const result = await setFollow(client, userId, targetId, !follow.isFollowing, person?.isPrivate);
      if (result === "requested") {
        setFollow(current => ({ ...current, requestStatus: "pending" }));
        notify("Solicitação de seguimento enviada.");
      } else {
        setFollow(current => ({ ...current, isFollowing: result === "following", requestStatus: "", followers: current.followers + (result === "following" ? 1 : wasFollowing ? -1 : 0) }));
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
      if (accepted) setFollow(current => ({ ...current, followers: current.followers + 1 }));
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
      notify(getErrorMessage(failure, "Não foi possível carregar mais publicações."));
    } finally {
      setPostsLoading(false);
    }
  };
  const updateProfileImage = async (event, field) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const oldPath = field === "avatar_path" ? person.avatarPath : person.coverPath;
      await uploadProfileImage(client, userId, file, field);
      const updated = await onProfileUpdated();
      setPerson(updated);
      if (oldPath && !/^https?:\/\//i.test(oldPath)) {
        const { error: cleanupError } = await client.storage.from("social-media").remove([oldPath]);
        if (cleanupError) {
          console.error("Não foi possível limpar a imagem antiga do perfil.", cleanupError);
          notify("Imagem atualizada. Não foi possível limpar a cópia anterior do armazenamento.");
          event.target.value = "";
          return;
        }
      }
      notify(field === "avatar_path" ? "Foto do perfil atualizada." : "Foto de capa atualizada.");
    } catch (failure) {
      console.error("Falha ao salvar imagem do perfil.", failure);
      notify(getErrorMessage(failure, "Não foi possível salvar esta imagem."));
    } finally {
      setBusy(false);
      event.target.value = "";
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
  return <div className="social-profile">
    <CommunityNavigation active="" />
    <section className="social-profile-card">
      <div className="social-profile-cover">{person.cover && <img src={person.cover} alt="" />}</div>
      <div className="social-profile-main"><AuthorLink author={author} ownId={userId} /><div className="social-profile-bio"><h2>{person.name}{person.verified && <ShieldCheck size={17} fill="currentColor" />}</h2><span>@{person.username || "fortalfy"}</span><p>{person.bio || "Bem-estar no seu ritmo."}</p>{person.city && <small>{person.city}</small>}</div>
        {isOwn ? <button className="button subtle small-button" onClick={beginEdit}>Editar perfil</button> : <div className="social-profile-actions"><button className="button primary small-button" disabled={busy} onClick={toggleFollow}>{follow.requestStatus === "pending" ? "Cancelar solicitação" : follow.isFollowing ? <><UserMinus size={15} /> Seguindo</> : <><UserPlus size={15} /> Seguir</>}</button><button className="button subtle small-button" onClick={() => navigate(`/messages?to=${encodeURIComponent(targetId)}`)}><MessageCircle size={15} /> Enviar mensagem</button></div>}
      </div>
      <div className="social-profile-metrics"><span><strong>{postCount}</strong> publicações</span><span><strong>{follow.followers}</strong> seguidores</span><span><strong>{follow.following}</strong> seguindo</span><button onClick={handleProfileShare}><Share2 size={15} /> Compartilhar perfil</button></div>
      {isOwn && <button className="social-signout" onClick={async () => { const { error: signOutError } = await client.auth.signOut(); if (signOutError) notify(getErrorMessage(signOutError)); }}>Sair da conta</button>}
    </section>
    {isOwn && requests.length > 0 && <section className="social-follow-requests"><h3>Solicitações para seguir <span>{requests.length}</span></h3>{requests.map(request => <div className="social-follow-request" key={request.follower_id}><AuthorLink author={request.follower} ownId={userId} /><Link to={`/profile/${request.follower_id}`}><strong>{request.follower?.name || "Pessoa Fortalfy"}</strong><small>{formatDate(request.created_at)}</small></Link><button className="button primary small-button" disabled={busy} onClick={() => handleFollowRequest(request, true)}>Aceitar</button><button className="button subtle small-button" disabled={busy} onClick={() => handleFollowRequest(request, false)}>Recusar</button></div>)}</section>}
    <h3 className="social-profile-posts-title">Publicações</h3>
    {person.isPrivate && !isOwn && !follow.isFollowing ? <div className="social-empty-feed"><ShieldCheck size={23} /><h3>Este perfil é privado</h3><p>Envie uma solicitação para ver suas publicações.</p></div>
      : posts.length ? posts.map(post => <SocialPost key={post.id} post={post} client={client} userId={userId} onRefresh={async () => {
        const result = await loadFeed(client, userId, { authorId: targetId, limit: 20 });
        setPosts(result.posts);
        setPostCount(result.total);
        setPostsHasMore(result.hasMore);
      }} notify={notify} />)
        : <div className="social-empty-feed"><MessageCircle size={24} /><h3>Nenhuma publicação por aqui</h3><p>As publicações deste perfil aparecerão nesta área.</p></div>}
    {postsHasMore && <button className="button subtle wide-button social-load-more" onClick={loadMoreProfilePosts} disabled={postsLoading}>{postsLoading ? "Carregando…" : "Carregar mais publicações"}</button>}
    {editOpen && <div className="social-share-scrim" role="presentation" onMouseDown={event => event.target === event.currentTarget && setEditOpen(false)}><section className="social-share-dialog" role="dialog" aria-modal="true" aria-label="Editar perfil"><header><strong>Editar perfil</strong><button className="social-icon-button" onClick={() => setEditOpen(false)} aria-label="Fechar"><X size={18} /></button></header><form onSubmit={saveProfile} className="social-profile-edit-form"><label>Nome<input value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} required maxLength={120} /></label><label>Nome de usuário<input value={draft.username} onChange={event => setDraft(current => ({ ...current, username: event.target.value }))} maxLength={24} /></label><label>Biografia<textarea value={draft.bio} onChange={event => setDraft(current => ({ ...current, bio: event.target.value }))} maxLength={2000} /></label><label>Cidade<input value={draft.city} onChange={event => setDraft(current => ({ ...current, city: event.target.value }))} maxLength={120} /></label><div className="social-profile-image-fields"><label className="button subtle small-button">{person.avatar ? "Alterar foto do perfil" : "Adicionar foto do perfil"}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={event => updateProfileImage(event, "avatar_path")} disabled={busy} /></label>{person.avatar && <button className="social-remove-image" type="button" disabled={busy} onClick={() => clearProfileImage("avatar_path")}>Remover foto</button>}<label className="button subtle small-button">{person.cover ? "Alterar capa" : "Adicionar capa"}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={event => updateProfileImage(event, "cover_path")} disabled={busy} /></label>{person.cover && <button className="social-remove-image" type="button" disabled={busy} onClick={() => clearProfileImage("cover_path")}>Remover capa</button>}<small>Imagens salvas diretamente na sua conta (até 5 MB cada).</small></div><label className="social-private-toggle"><input type="checkbox" checked={draft.isPrivate} onChange={event => setDraft(current => ({ ...current, isPrivate: event.target.checked }))} /> Perfil privado — aprovo quem pode me seguir</label><button className="button primary wide-button" disabled={busy}>{busy ? "Salvando…" : "Salvar alterações"}</button></form></section></div>}
  </div>;
}
