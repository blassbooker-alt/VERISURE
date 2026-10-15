import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera, Check, Clock3, Eye, Heart, ImagePlus, LoaderCircle, Pause,
  Play, Plus, Trash2, Volume2, VolumeX, X,
} from "lucide-react";
import { isValidVideoDuration } from "./appLogic.js";

const DATABASE_NAME = "fortalfy-stories-local";
const DATABASE_VERSION = 1;
const STORY_STORE = "stories";
const STORY_LIFETIME = 24 * 60 * 60 * 1000;
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

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("Este navegador não oferece armazenamento local seguro para Stories."));
      return;
    }
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORY_STORE)) {
        request.result.createObjectStore(STORY_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Não foi possível abrir o armazenamento local."));
  });
}

async function readStoredStories() {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORY_STORE, "readwrite");
    const store = transaction.objectStore(STORY_STORE);
    const request = store.getAll();
    let stories = [];
    request.onsuccess = () => {
      const now = Date.now();
      stories = request.result;
      request.result.forEach(story => {
        if (story.expiresAt <= now) store.delete(story.id);
      });
    };
    transaction.oncomplete = () => resolve(stories.filter(story => story.expiresAt > Date.now()).map(story => ({ ...story, mediaUrl: URL.createObjectURL(story.media) })));
    transaction.onerror = () => reject(transaction.error || new Error("Não foi possível carregar seus Stories salvos."));
  });
}

async function saveStoredStory(story) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORY_STORE, "readwrite");
    transaction.objectStore(STORY_STORE).put(story);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error("Não foi possível salvar este Story no navegador."));
  });
}

async function changeStoredStory(storyId, update) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORY_STORE, "readwrite");
    const store = transaction.objectStore(STORY_STORE);
    const request = store.get(storyId);
    let updated;
    request.onsuccess = () => {
      if (!request.result) return;
      updated = update(request.result);
      store.put(updated);
    };
    transaction.oncomplete = () => resolve(updated || null);
    transaction.onerror = () => reject(transaction.error || new Error("Não foi possível atualizar este Story salvo."));
  });
}

async function deleteStoredStory(storyId) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORY_STORE, "readwrite");
    transaction.objectStore(STORY_STORE).delete(storyId);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error("Não foi possível excluir este Story."));
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
      setError(publishError.message || "Não foi possível salvar o Story neste navegador.");
      setSaving(false);
      notify("O Story não foi salvo. Revise o espaço disponível e tente novamente.");
    }
  };

  return <div className="story-composer-scrim" role="presentation" onMouseDown={event => event.target === event.currentTarget && !saving && !validating && onClose()}>
    <section className="story-composer" role="dialog" aria-modal="true" aria-labelledby="story-composer-title">
      <header className="story-composer-header"><div><span className="eyebrow">SOMENTE NESTE NAVEGADOR</span><h2 id="story-composer-title">Criar Story</h2></div><button type="button" className="icon-button" aria-label="Fechar janela" disabled={saving || validating} onClick={onClose}><X size={20} /></button></header>
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
        <div className="story-composer-note">O arquivo fica neste dispositivo por até 24 horas. Não será publicado para outras contas sem um serviço de contas e mídia.</div>
        {error && <p className="story-form-error" role="alert">{error}</p>}
        <footer className="story-composer-footer"><button type="button" className="button subtle" disabled={saving || validating} onClick={onClose}>Cancelar</button><button type="submit" className="button primary" disabled={saving || validating || !file}>{saving ? <><LoaderCircle className="story-spinner" size={16} /> Salvando…</> : validating ? "Conferindo vídeo…" : <>Publicar Story <Plus size={16} /></>}</button></footer>
      </form>
    </section>
  </div>;
}

function StoryViewer({ groups, initialProfileId, initialStoryId, onClose, onView, onLike, onDelete, notify }) {
  const [profileIndex, setProfileIndex] = useState(() => Math.max(0, groups.findIndex(group => group.id === initialProfileId)));
  const [storyIndex, setStoryIndex] = useState(() => Math.max(0, (groups.find(group => group.id === initialProfileId)?.items || []).findIndex(story => story.id === initialStoryId)));
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [showViews, setShowViews] = useState(false);
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
    if (story && !viewedRef.current.has(story.id)) {
      viewedRef.current.add(story.id);
      onView(story);
    }
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
  const deleteStory = async () => {
    if (!window.confirm("Excluir este Story salvo neste navegador?")) return;
    try {
      await onDelete(story);
      notify("Story excluído deste navegador.");
      if (profile.items.length > 1) setStoryIndex(index => Math.min(index, profile.items.length - 2));
      else if (profileIndex === 0 && groups.length > 1) setStoryIndex(0);
      else onClose();
    } catch (error) {
      notify(error.message);
    }
  };

  return <div className="story-viewer-backdrop" role="presentation">
    <section className="story-viewer" ref={stageRef} tabIndex={0} aria-label={`Story de ${profile.name}`} onKeyDown={event => event.key === " " && event.preventDefault()} onPointerDown={handlePress} onPointerUp={handleRelease} onPointerCancel={handleRelease} onClick={navigateTap}>
      <div className="story-viewer-media">
        {isVideo
          ? <video key={story.id} ref={videoRef} src={story.mediaUrl || story.media} playsInline muted={!soundOn} preload="metadata" onLoadedMetadata={() => setMediaReady(true)} onCanPlay={() => setMediaReady(true)} onWaiting={() => setMediaReady(false)} onPlaying={() => setMediaReady(true)} onError={() => { setMediaFailed(true); setMediaReady(true); }} onEnded={() => next.current?.()} aria-label={`Vídeo do Story de ${profile.name}`} />
          : <img key={story.id} src={story.media} alt={story.caption || `Story de ${profile.name}`} onLoad={() => setMediaReady(true)} onError={() => { setMediaFailed(true); setMediaReady(true); }} />}
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
        <button type="button" className="story-view-count" onClick={event => { event.stopPropagation(); setShowViews(value => !value); }}><Eye size={17} /> {story.viewers?.length || 1} visualização</button>
        <button type="button" className={`story-like-button ${isLiked ? "liked" : ""}`} aria-pressed={isLiked} onClick={event => { event.stopPropagation(); toggleLike(); }}><Heart size={20} fill={isLiked ? "currentColor" : "none"} /> {isLiked ? "Curtido" : "Curtir"}</button>
        <button type="button" className="story-delete-button" aria-label="Excluir seu Story" onClick={event => { event.stopPropagation(); deleteStory(); }}><Trash2 size={18} /></button>
      </footer>
      {showViews && <div className="story-viewers-popover" onClick={event => event.stopPropagation()}><strong>Visualizações neste navegador</strong>{story.viewers?.length ? story.viewers.map(viewer => <span key={viewer.id}><Eye size={15} /> {viewer.name}</span>) : <p>Nenhuma visualização registrada ainda.</p>}</div>}
      <button type="button" className="story-tap-zone previous" aria-label="Story anterior" onClick={event => { event.stopPropagation(); previous.current?.(); }} />
      <button type="button" className="story-tap-zone next" aria-label="Próximo Story" onClick={event => { event.stopPropagation(); next.current?.(); }} />
    </section>
  </div>;
}

export default function StoryExperience({ user, notify }) {
  const [localStories, setLocalStories] = useState([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [viewerSelection, setViewerSelection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState("");
  const mountedRef = useRef(true);
  const mediaUrlsRef = useRef([]);

  useEffect(() => {
    mountedRef.current = true;
    readStoredStories().then(stories => {
      if (!mountedRef.current) {
        stories.forEach(story => URL.revokeObjectURL(story.mediaUrl));
        return;
      }
      mediaUrlsRef.current = stories.map(story => story.mediaUrl);
      setLocalStories(stories);
    }).catch(error => {
      console.error("Falha ao carregar Stories locais.", error);
      setStorageError(error.message);
    }).finally(() => mountedRef.current && setLoading(false));
    return () => {
      mountedRef.current = false;
      mediaUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    const cleanupExpired = async () => {
      const expired = localStories.filter(story => story.expiresAt <= Date.now());
      if (!expired.length) return;
      try {
        await Promise.all(expired.map(story => deleteStoredStory(story.id)));
        expired.forEach(story => URL.revokeObjectURL(story.mediaUrl));
        mediaUrlsRef.current = mediaUrlsRef.current.filter(url => !expired.some(story => story.mediaUrl === url));
        setLocalStories(current => current.filter(story => story.expiresAt > Date.now()));
      } catch (error) {
        console.error("Falha ao limpar Stories expirados.", error);
        setStorageError("Não foi possível limpar automaticamente todos os Stories expirados.");
      }
    };
    const timer = window.setInterval(cleanupExpired, 60000);
    return () => window.clearInterval(timer);
  }, [localStories]);

  const profiles = useMemo(() => {
    const ownProfile = {
      id: "local-device",
      name: displayName(user.name),
      avatar: user.avatar || "",
      isSample: false,
      followed: true,
      items: [...localStories].sort((a, b) => b.createdAt - a.createdAt).map(story => ({ ...story, media: story.mediaUrl, isSample: false })),
    };
    return [ownProfile];
  }, [localStories, user.avatar, user.name]);

  const visibleProfiles = profiles;
  const viewableGroups = useMemo(
    () => visibleProfiles.map(profile => ({ ...profile, items: profile.items.filter(story => story.expiresAt > Date.now()) })).filter(profile => profile.items.length),
    [visibleProfiles],
  );

  const closeComposer = () => setComposerOpen(false);
  const showStory = (profileId, storyId) => setViewerSelection({ profileId, storyId });
  const openGroup = profile => {
    if (profile.id === "local-device" && !profile.items.length) {
      setComposerOpen(true);
      return;
    }
    if (profile.items.length) showStory(profile.id, profile.items[0].id);
  };

  const publishStory = async (file, caption) => {
    const storage = navigator.storage;
    if (storage?.estimate) {
      const { quota, usage } = await storage.estimate();
      if (quota && quota - (usage || 0) < file.size * 1.2) throw new Error("Há pouco espaço disponível neste navegador para salvar este arquivo.");
    }
    const now = Date.now();
    const id = crypto.randomUUID ? crypto.randomUUID() : `story-${now}-${Math.random().toString(36).slice(2, 8)}`;
    const story = {
      id,
      ownerId: "local-device",
      ownerName: displayName(user.name),
      avatar: user.avatar || "",
      caption,
      media: file,
      mediaType: file.type.startsWith("video/") ? "video" : "image",
      createdAt: now,
      expiresAt: now + STORY_LIFETIME,
      viewers: [],
      liked: false,
    };
    await saveStoredStory(story);
    const mediaUrl = URL.createObjectURL(file);
    mediaUrlsRef.current.push(mediaUrl);
    setLocalStories(current => [{ ...story, mediaUrl }, ...current]);
    setComposerOpen(false);
    notify("Story salvo neste navegador e disponível por 24 horas. Ele não foi enviado à comunidade.");
    setViewerSelection({ profileId: "local-device", storyId: id });
  };

  const markViewed = async story => {
    if (story.viewers?.some(viewer => viewer.id === "local-browser")) return;
    try {
      const updated = await changeStoredStory(story.id, record => ({
        ...record,
        viewers: [...(record.viewers || []), { id: "local-browser", name: "Você (neste navegador)", viewedAt: Date.now() }],
      }));
      if (updated) setLocalStories(current => current.map(item => item.id === story.id ? { ...item, ...updated, mediaUrl: item.mediaUrl } : item));
    } catch (error) {
      console.error("Não foi possível registrar a visualização local.", error);
      notify(error.message);
    }
  };

  const toggleLike = async story => {
    const updated = await changeStoredStory(story.id, record => ({ ...record, liked: !record.liked }));
    if (updated) setLocalStories(current => current.map(item => item.id === story.id ? { ...item, ...updated, mediaUrl: item.mediaUrl } : item));
  };

  const removeStory = async story => {
    await deleteStoredStory(story.id);
    URL.revokeObjectURL(story.mediaUrl);
    mediaUrlsRef.current = mediaUrlsRef.current.filter(url => url !== story.mediaUrl);
    setLocalStories(current => current.filter(item => item.id !== story.id));
  };

  return <>
    <section className="stories-experience" aria-label="Stories da comunidade">
      <div className="stories-section-heading"><div><span className="eyebrow">MOMENTOS DA COMUNIDADE</span><h2>Histórias que inspiram</h2></div><button className="button subtle small-button" onClick={() => setComposerOpen(true)}><Plus size={16} /> Criar Story</button></div>
      <div className="stories-row" role="list" aria-label="Perfis com Stories disponíveis">
        <div className="story-item-wrap">
          <button className="story-item own-story" role="listitem" onClick={() => openGroup(profiles[0])} aria-label={profiles[0].items.length ? `Ver seu Story, ${profiles[0].items.length} itens` : "Adicionar seu primeiro Story"}>
            <span className={`story-ring own ${profiles[0].items.length ? "has-story" : ""}`}><span className="story-avatar">{profiles[0].avatar ? <img src={profiles[0].avatar} alt="" /> : displayName(user.name).slice(0, 1).toUpperCase()}</span>{!profiles[0].items.length && <i><Plus size={13} /></i>}</span><span>Seu Story</span>
          </button>
          {profiles[0].items.length > 0 && <button type="button" className="story-add-own" aria-label="Adicionar outro Story" onClick={() => setComposerOpen(true)}><Plus size={14} /></button>}
        </div>
        {!profiles[0].items.length && <p className="stories-filter-empty">Ainda não há Stories publicados por outras contas.</p>}
      </div>
      {loading && <p className="stories-status" role="status"><LoaderCircle className="story-spinner" size={15} /> Carregando Stories…</p>}
      {storageError && <p className="stories-status error" role="alert">{storageError}</p>}
      <p className="stories-filter-disclosure">Stories próprios ficam salvos neste navegador por 24 horas; publicação sincronizada ainda não está ativa.</p>
    </section>
    {composerOpen && <StoryComposer onClose={closeComposer} onPublish={publishStory} notify={notify} />}
    {viewerSelection && <StoryViewer groups={viewableGroups} initialProfileId={viewerSelection.profileId} initialStoryId={viewerSelection.storyId} onClose={() => setViewerSelection(null)} onView={markViewed} onLike={toggleLike} onDelete={removeStory} notify={notify} />}
  </>;
}
