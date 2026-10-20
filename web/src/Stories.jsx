import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera, Check, Clock3, Eye, Heart, ImagePlus, LoaderCircle, Pause,
  Play, Plus, Trash2, Volume2, VolumeX, X,
} from "lucide-react";
import { isValidVideoDuration } from "./appLogic.js";
import { deleteStory, loadStories, loadStoryViewers, publishStory as createStory, recordStoryView, setStoryLike } from "./storyService.js";

const IMAGE_LIMIT = 15 * 1024 * 1024;
const VIDEO_LIMIT = 40 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/webm"];
const VIDEO_DURATION_LIMIT = 30;

function readVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    const timeout = window.setTimeout(() => finish(reject, new Error("Não foi possível ler a duração do vídeo.")), 10000);
    const finish = (callback, value) => {
      window.clearTimeout(timeout);
      video.onloadedmetadata = null;
      video.onerror = null;
      URL.revokeObjectURL(objectUrl);
      callback(value);
    };
    video.preload = "metadata";
    video.onloadedmetadata = () => finish(resolve, video.duration);
    video.onerror = () => finish(reject, new Error("Não foi possível abrir este vídeo para conferir sua duração."));
    video.src = objectUrl;
  });
}

function formatAge(createdAt) {
  const minutes = Math.max(0, Math.floor((Date.now() - createdAt) / 60000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `há ${hours} h`;
}

function displayName(name) {
  return name.trim().slice(0, 28) || "Seu perfil";
}

function storyPublishError(error) {
  const code = String(error?.code || "");
  const status = Number(error?.status || error?.statusCode || 0);
  const message = String(error?.message || "");
  if (status === 401 || /jwt expired|session.*expired/i.test(message)) {
    return "Sua sessão expirou. Entre novamente na Fortalfy e tente publicar o Story.";
  }
  if (status === 403 || code === "42501" || /row-level security|permission denied|not allowed/i.test(message)) {
    return "A permissão de publicação foi recusada. Aplique a configuração de upload de Stories no Supabase e tente novamente.";
  }
  if (status === 413 || /file size|too large/i.test(message)) {
    return "O arquivo excede o limite permitido para Stories.";
  }
  if (status === 415 || /mime|content.?type|bucket.*not found/i.test(message)) {
    return "Este formato de mídia não está habilitado no armazenamento de Stories.";
  }
  return message || "Não foi possível publicar o Story. Verifique sua conexão e tente novamente.";
}

function StoryComposer({ onClose, onPublish, notify }) {
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return undefined;
    }
    const nextUrl = URL.createObjectURL(file);
    setPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  useEffect(() => {
    const closeOnEscape = event => event.key === "Escape" && !saving && !validating && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, saving, validating]);

  const selectFile = async event => {
    const nextFile = event.target.files?.[0];
    event.target.value = "";
    if (!nextFile) return;
    const isImage = PHOTO_TYPES.includes(nextFile.type);
    const isVideo = VIDEO_TYPES.includes(nextFile.type);
    if (!isImage && !isVideo) {
      setError("Escolha uma imagem JPG, PNG ou WebP, ou um vídeo MP4 ou WebM.");
      setFile(null);
      return;
    }
    if (nextFile.size > (isImage ? IMAGE_LIMIT : VIDEO_LIMIT)) {
      setError(isImage ? "A imagem deve ter até 15 MB." : "O vídeo deve ter até 40 MB.");
      setFile(null);
      return;
    }
    if (isVideo) {
      setValidating(true);
      try {
        const duration = await readVideoDuration(nextFile);
        if (!isValidVideoDuration(duration, VIDEO_DURATION_LIMIT)) {
          setError("O vídeo deve ter duração maior que zero e de até 30 segundos.");
          setFile(null);
          setValidating(false);
          return;
        }
      } catch (validationError) {
        setError(validationError.message);
        setFile(null);
        setValidating(false);
        return;
      }
      setValidating(false);
    }
    setError("");
    setFile(nextFile);
  };

  const publish = async event => {
    event.preventDefault();
    if (!file) {
      setError("Selecione uma foto ou um vídeo antes de publicar.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onPublish(file, caption.trim());
    } catch (publishError) {
      setError(storyPublishError(publishError));
      setSaving(false);
      notify("O Story não foi publicado. Veja o motivo e tente novamente.");
    }
  };

  return <div className="story-composer-scrim" role="presentation" onMouseDown={event => event.target === event.currentTarget && !saving && !validating && onClose()}>
    <section className="story-composer" role="dialog" aria-modal="true" aria-labelledby="story-composer-title">
      <header className="story-composer-header"><div><span className="eyebrow">COMUNIDADE FORTALFY</span><h2 id="story-composer-title">Criar Story</h2></div><button type="button" className="icon-button" aria-label="Fechar janela" disabled={saving || validating} onClick={onClose}><X size={20} /></button></header>
      <form onSubmit={publish}>
        <div className={`story-upload-preview ${previewUrl ? "has-media" : ""}`}>
          {previewUrl && (file?.type.startsWith("video/") ? <video src={previewUrl} controls playsInline aria-label="Prévia do vídeo do Story" /> : <img src={previewUrl} alt="Prévia da foto do Story" />)}
          {!previewUrl && <div><ImagePlus size={30} /><strong>Sua próxima conquista, em um Story.</strong><span>Escolha uma foto ou vídeo vertical para começar.</span></div>}
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" onChange={selectFile} aria-label="Selecionar foto ou vídeo" disabled={saving || validating} />
        </div>
        <div className="story-upload-actions">
          <button type="button" className="button subtle" onClick={() => inputRef.current?.click()} disabled={saving || validating}><Camera size={16} /> {file ? "Trocar mídia" : "Escolher foto ou vídeo"}</button>
          {file && <span>{file.type.startsWith("video/") ? "Vídeo" : "Foto"} · {(file.size / (1024 * 1024)).toFixed(1).replace(".", ",")} MB</span>}
        </div>
        <label className="story-caption-field">Legenda opcional<textarea value={caption} maxLength={180} rows={2} placeholder="Conte um pouco sobre este momento..." onChange={event => setCaption(event.target.value)} /></label>
        <div className="story-composer-note">Seu Story será publicado para as contas autorizadas e ficará disponível por 24 horas.</div>
        {error && <p className="story-form-error" role="alert">{error}</p>}
        <footer className="story-composer-footer"><button type="button" className="button subtle" disabled={saving || validating} onClick={onClose}>Cancelar</button><button type="submit" className="button primary" disabled={saving || validating || !file}>{saving ? <><LoaderCircle className="story-spinner" size={16} /> Salvando…</> : validating ? "Conferindo vídeo…" : <>Publicar Story <Plus size={16} /></>}</button></footer>
      </form>
    </section>
  </div>;
}

function StoryViewer({ groups, userId, initialProfileId, initialStoryId, onClose, onView, onLoadViewers, onLike, onDelete, notify }) {
  const [profileIndex, setProfileIndex] = useState(() => Math.max(0, groups.findIndex(group => group.id === initialProfileId)));
  const [storyIndex, setStoryIndex] = useState(() => Math.max(0, (groups.find(group => group.id === initialProfileId)?.items || []).findIndex(story => story.id === initialStoryId)));
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [showViews, setShowViews] = useState(false);
  const [viewers, setViewers] = useState([]);
  const [viewersLoading, setViewersLoading] = useState(false);
  const [viewersError, setViewersError] = useState("");
  const stageRef = useRef(null);
  const videoRef = useRef(null);
  const tickRef = useRef(0);
  const viewedRef = useRef(new Set());
  const currentStoryIdRef = useRef(null);
  const advancingRef = useRef(false);
  const profile = groups[profileIndex];
  const story = profile?.items[storyIndex];
  const isLiked = !!story?.liked;
  const isVideo = story?.mediaType === "video";
  const next = useRef(null);
  const previous = useRef(null);

  next.current = () => {
    if (!profile || advancingRef.current) return;
    advancingRef.current = true;
    if (storyIndex < profile.items.length - 1) {
      setStoryIndex(index => index + 1);
      return;
    }
    if (profileIndex < groups.length - 1) {
      setProfileIndex(index => index + 1);
      setStoryIndex(0);
      return;
    }
    onClose();
  };
  previous.current = () => {
    if (storyIndex > 0) {
      setStoryIndex(index => index - 1);
      return;
    }
    if (profileIndex > 0) {
      const previousProfile = groups[profileIndex - 1];
      setProfileIndex(index => index - 1);
      setStoryIndex(previousProfile.items.length - 1);
    }
  };

  useEffect(() => {
    if (!story || currentStoryIdRef.current === story.id) return;
    currentStoryIdRef.current = story.id;
    setProgress(0);
    setPaused(false);
    advancingRef.current = false;
    setMediaReady(false);
    setMediaFailed(false);
    setShowViews(false);
    setViewers([]);
    setViewersError("");
  }, [story?.id]);

  useEffect(() => {
    stageRef.current?.focus();
    const handleKey = event => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") next.current?.();
      if (event.key === "ArrowLeft") previous.current?.();
      if (event.code === "Space" && event.target === stageRef.current) {
        event.preventDefault();
        setPaused(value => !value);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    if (!story || paused || mediaFailed || !mediaReady) return undefined;
    const startedAt = Date.now();
    const previousProgress = progress;
    const duration = isVideo
      ? Math.max(1, (videoRef.current?.duration || 15) * 1000 * (1 - previousProgress / 100))
      : 6500 * (1 - previousProgress / 100);
    const timer = window.setInterval(() => {
      const nextProgress = Math.min(100, previousProgress + ((Date.now() - startedAt) / duration) * (100 - previousProgress));
      if (isVideo && videoRef.current?.duration) {
        setProgress(Math.min(100, videoRef.current.currentTime / videoRef.current.duration * 100));
        return;
      }
      setProgress(nextProgress);
      if (nextProgress >= 100) next.current?.();
    }, 80);
    return () => window.clearInterval(timer);
  }, [story?.id, paused, mediaFailed, mediaReady, isVideo]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVideo) return;
    if (paused) video.pause();
    else if (mediaReady) video.play().catch(() => setPaused(true));
  }, [isVideo, paused, mediaReady, story?.id]);

  if (!story || !profile) return null;

  const handlePress = event => {
    if (event.target.closest("button, a")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (!paused) {
      tickRef.current = window.setTimeout(() => setPaused(true), 220);
    }
  };
  const handleRelease = () => {
    window.clearTimeout(tickRef.current);
    setPaused(false);
  };
  const navigateTap = event => {
    if (event.target.closest("button, a")) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX - bounds.left < bounds.width / 2) previous.current?.();
    else next.current?.();
  };
  const toggleLike = async () => {
    try {
      await onLike(story);
    } catch (error) {
      notify(error.message);
    }
  };
  const registerDisplayedView = () => {
    if (!story || story.ownerId === userId || story.viewedByMe || viewedRef.current.has(story.id)) return;
    viewedRef.current.add(story.id);
    Promise.resolve(onView(story)).catch(error => notify(error.message || "Não foi possível registrar a visualização."));
  };
  const toggleViewers = async () => {
    const opening = !showViews;
    setShowViews(opening);
    if (!opening) return;
    setViewersLoading(true);
    setViewersError("");
    try {
      setViewers(await onLoadViewers(story.id));
    } catch (error) {
      console.error("Falha ao carregar as visualizações do Story.", error);
      setViewersError(error.message || "Não foi possível carregar as visualizações.");
    } finally {
      setViewersLoading(false);
    }
  };
  const deleteCurrentStory = async () => {
    if (!window.confirm("Excluir este Story da sua conta?")) return;
    try {
      const warning = await onDelete(story);
      notify(warning || "Story excluído da sua conta.");
      onClose();
    } catch (error) {
      notify(error.message);
    }
  };

  return <div className="story-viewer-backdrop" role="presentation">
    <section className="story-viewer" ref={stageRef} tabIndex={0} aria-label={`Story de ${profile.name}`} onKeyDown={event => event.key === " " && event.preventDefault()} onPointerDown={handlePress} onPointerUp={handleRelease} onPointerCancel={handleRelease} onClick={navigateTap}>
      <div className="story-viewer-media">
        {isVideo
          ? <video key={story.id} ref={videoRef} src={story.mediaUrl || story.media} playsInline muted={!soundOn} preload="metadata" onLoadedMetadata={() => setMediaReady(true)} onCanPlay={() => setMediaReady(true)} onWaiting={() => setMediaReady(false)} onPlaying={() => { setMediaReady(true); registerDisplayedView(); }} onError={() => { setMediaFailed(true); setMediaReady(true); }} onEnded={() => next.current?.()} aria-label={`Vídeo do Story de ${profile.name}`} />
          : <img key={story.id} src={story.media} alt={story.caption || `Story de ${profile.name}`} onLoad={() => { setMediaReady(true); registerDisplayedView(); }} onError={() => { setMediaFailed(true); setMediaReady(true); }} />}
      </div>
      <div className="story-viewer-shade" />
      <header className="story-viewer-top">
        <div className="story-progress-list" aria-label={`Story ${storyIndex + 1} de ${profile.items.length}`}>
          {profile.items.map((item, index) => <span key={item.id} className="story-progress-track"><i style={{ width: index < storyIndex ? "100%" : index === storyIndex ? `${progress}%` : "0%" }} /></span>)}
        </div>
        <div className="story-viewer-author">
          <img src={profile.avatar || story.avatar} alt="" />
          <span><strong>{profile.name}</strong><small>{story.createdAt ? `${formatAge(story.createdAt)} · expira em 24 h` : "Comunidade Fortalfy"}</small></span>
          {isVideo && <button type="button" className="story-control-button" aria-label={soundOn ? "Silenciar vídeo" : "Ativar som"} onClick={event => { event.stopPropagation(); setSoundOn(value => !value); }}>{soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>}
          <button type="button" className="story-control-button" aria-label={paused ? "Retomar Story" : "Pausar Story"} onClick={event => { event.stopPropagation(); setPaused(value => !value); }}>{paused ? <Play size={18} /> : <Pause size={18} />}</button>
          <button type="button" className="story-control-button story-close-button" aria-label="Fechar Story" onClick={event => { event.stopPropagation(); onClose(); }}><X size={20} /></button>
        </div>
      </header>
      {!mediaReady && <div className="story-media-loading" role="status"><LoaderCircle className="story-spinner" size={28} /><span>Carregando mídia…</span></div>}
      {mediaFailed && <div className="story-media-failed" role="alert"><ImagePlus size={25} /><strong>Não foi possível carregar esta mídia.</strong><button className="button light-button" onClick={event => { event.stopPropagation(); next.current?.(); }}>Avançar</button></div>}
      {story.caption && <p className="story-viewer-caption">{story.caption}</p>}
      <footer className="story-viewer-actions">
        {story.ownerId === userId && <button type="button" className="story-view-count" onClick={event => { event.stopPropagation(); void toggleViewers(); }}><Eye size={17} /> {story.viewCount} {story.viewCount === 1 ? "visualização" : "visualizações"}</button>}
        <button type="button" className={`story-like-button ${isLiked ? "liked" : ""}`} aria-pressed={isLiked} onClick={event => { event.stopPropagation(); toggleLike(); }}><Heart size={20} fill={isLiked ? "currentColor" : "none"} /> {isLiked ? "Curtido" : "Curtir"}</button>
        {story.ownerId === userId && <button type="button" className="story-delete-button" aria-label="Excluir seu Story" onClick={event => { event.stopPropagation(); deleteCurrentStory(); }}><Trash2 size={18} /></button>}
      </footer>
      {showViews && story.ownerId === userId && <div className="story-viewers-popover" onClick={event => event.stopPropagation()}><strong>Visualizações do Story</strong>{viewersLoading ? <p role="status">Carregando visualizações…</p> : viewersError ? <p role="alert">{viewersError}</p> : viewers.length ? <ul>{viewers.map((viewer, index) => <li key={`${viewer.id || "private"}-${index}`}>{viewer.id ? <img src={viewer.avatar || ""} alt="" /> : <span className="story-viewer-private-avatar" aria-hidden="true" />}<span><strong>{viewer.name}</strong>{viewer.username && <small>@{viewer.username}</small>}</span><time>{new Date(viewer.viewedAt).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</time></li>)}</ul> : <p>Este Story ainda não recebeu visualizações.</p>}</div>}
      <button type="button" className="story-tap-zone previous" aria-label="Story anterior" onClick={event => { event.stopPropagation(); previous.current?.(); }} />
      <button type="button" className="story-tap-zone next" aria-label="Próximo Story" onClick={event => { event.stopPropagation(); next.current?.(); }} />
    </section>
  </div>;
}

export default function StoryExperience({ client, configured, session, user, notify }) {
  const [stories, setStories] = useState([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [viewerSelection, setViewerSelection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [now, setNow] = useState(Date.now());
  const userId = session?.user?.id;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setStorageError("");
    if (!configured || !client || !userId) {
      setStories([]);
      setLoading(false);
      if (userId) setStorageError("Conecte o Supabase e aplique a migração de Stories para ativar este recurso.");
      return () => { active = false; };
    }
    loadStories(client, userId)
      .then(result => { if (active) setStories(result); })
      .catch(error => {
        console.error("Falha ao carregar Stories do Supabase.", error);
        if (active) setStorageError(error.message || "Não foi possível carregar os Stories.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client, configured, userId, reloadKey]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const profiles = useMemo(() => {
    const byOwner = new Map([[userId, {
      id: userId,
      name: displayName(user.name),
      avatar: user.avatar || "",
      items: [],
    }]]);
    stories.forEach(story => {
      let profile = byOwner.get(story.ownerId);
      if (!profile) {
        profile = { id: story.ownerId, name: story.ownerName, avatar: story.avatar, items: [] };
        byOwner.set(story.ownerId, profile);
      }
      profile.items.push(story);
    });
    const ownProfile = byOwner.get(userId);
    const otherProfiles = [...byOwner.values()].filter(profile => profile.id !== userId);
    return [ownProfile, ...otherProfiles];
  }, [stories, user.avatar, user.name, userId]);

  const viewableGroups = useMemo(
    () => profiles.map(profile => ({ ...profile, items: profile.items.filter(story => story.expiresAt > now) })).filter(profile => profile.id === userId || profile.items.length),
    [now, profiles, userId],
  );

  const closeComposer = () => setComposerOpen(false);
  const showStory = (profileId, storyId) => setViewerSelection({ profileId, storyId });
  const openGroup = profile => {
    if (profile.id === userId && !profile.items.length) {
      setComposerOpen(true);
      return;
    }
    if (profile.items.length) showStory(profile.id, profile.items[0].id);
  };

  const publishStory = async (file, caption) => {
    await createStory(client, userId, file, caption);
    setComposerOpen(false);
    setReloadKey(value => value + 1);
    notify("Story publicado para a comunidade. Ele expira em 24 horas.");
  };

  const markViewed = async story => {
    if (story.ownerId === userId || story.viewedByMe) return;
    const recorded = await recordStoryView(client, userId, story);
    setStories(current => current.map(item => item.id === story.id
      ? { ...item, viewCount: item.viewCount + (recorded ? 1 : 0), viewedByMe: true }
      : item));
  };

  const toggleLike = async story => {
    const liked = !story.liked;
    await setStoryLike(client, userId, story, liked);
    setStories(current => current.map(item => item.id === story.id
      ? { ...item, liked, likeCount: Math.max(0, item.likeCount + (liked ? 1 : -1)) }
      : item));
  };

  const removeStory = async story => {
    const warning = await deleteStory(client, userId, story);
    setStories(current => current.filter(item => item.id !== story.id));
    return warning;
  };

  return <>
    <section className="stories-experience" aria-label="Stories da comunidade">
      <div className="stories-section-heading"><div><span className="eyebrow">MOMENTOS DA COMUNIDADE</span><h2>Histórias que inspiram</h2></div><button className="button subtle small-button" onClick={() => setComposerOpen(true)}><Plus size={16} /> Criar Story</button></div>
      <div className="stories-row" role="list" aria-label="Perfis com Stories disponíveis">
        {viewableGroups.map(profile => <div className="story-item-wrap" key={profile.id}>
          <button className={`story-item ${profile.id === userId ? "own-story" : ""}`} role="listitem" onClick={() => openGroup(profile)} aria-label={profile.id === userId ? profile.items.length ? `Ver seu Story, ${profile.items.length} itens` : "Adicionar seu primeiro Story" : `Ver Story de ${profile.name}`}>
            <span className={`story-ring ${profile.id === userId ? "own" : ""} ${profile.items.length ? "has-story" : ""}`}><span className="story-avatar">{profile.avatar ? <img src={profile.avatar} alt="" /> : profile.name.slice(0, 1).toUpperCase()}</span>{profile.id === userId && !profile.items.length && <i><Plus size={13} /></i>}</span><span>{profile.id === userId ? "Seu Story" : profile.name}</span>
          </button>
          {profile.id === userId && profile.items.length > 0 && <button type="button" className="story-add-own" aria-label="Adicionar outro Story" onClick={() => setComposerOpen(true)}><Plus size={14} /></button>}
        </div>)}
        {!loading && !storageError && !stories.length && <p className="stories-filter-empty">Ainda não há Stories publicados pela comunidade.</p>}
      </div>
      {loading && <p className="stories-status" role="status"><LoaderCircle className="story-spinner" size={15} /> Carregando Stories…</p>}
      {storageError && <div className="stories-status error" role="alert">{storageError}<button type="button" className="button subtle small-button" onClick={() => setReloadKey(value => value + 1)}>Tentar novamente</button></div>}
      <p className="stories-filter-disclosure">Os Stories publicados ficam visíveis para as contas autorizadas e expiram após 24 horas.</p>
    </section>
    {composerOpen && <StoryComposer onClose={closeComposer} onPublish={publishStory} notify={notify} />}
    {viewerSelection && <StoryViewer groups={viewableGroups} userId={userId} initialProfileId={viewerSelection.profileId} initialStoryId={viewerSelection.storyId} onClose={() => setViewerSelection(null)} onView={markViewed} onLoadViewers={storyId => loadStoryViewers(client, userId, storyId)} onLike={toggleLike} onDelete={removeStory} notify={notify} />}
  </>;
}
