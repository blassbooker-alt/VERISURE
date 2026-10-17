import { mapProfile, signMedia } from "./socialService.js";

import { createSecureId } from "./secureId.js";

const MEDIA_BUCKET = "social-media";
const IMAGE_LIMIT = 15 * 1024 * 1024;
const VIDEO_LIMIT = 40 * 1024 * 1024;
const MIME_EXTENSIONS = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["video/mp4", "mp4"],
  ["video/webm", "webm"],
]);

function requireUser(client, userId) {
  if (!client) throw new Error("A conexão com o Supabase não está configurada.");
  if (!userId || userId.startsWith("demo-") || userId.startsWith("local-")) {
    throw new Error("Entre com sua conta Fortalfy para usar Stories.");
  }
}

export function validateStoryMedia(file, caption = "") {
  if (!file || !MIME_EXTENSIONS.has(file.type)) {
    throw new Error("Escolha uma foto JPG, PNG ou WebP, ou um vídeo MP4 ou WebM.");
  }
  const limit = file.type.startsWith("image/") ? IMAGE_LIMIT : VIDEO_LIMIT;
  if (file.size > limit) {
    throw new Error(file.type.startsWith("image/") ? "A imagem deve ter até 15 MB." : "O vídeo deve ter até 40 MB.");
  }
  if (typeof caption !== "string" || caption.length > 180) {
    throw new Error("A legenda do Story pode ter no máximo 180 caracteres.");
  }
}

function mapStory(row, likedIds, viewedIds) {
  const profile = mapProfile(row.profile);
  if (!profile) throw new Error("Não foi possível carregar o perfil de quem publicou este Story.");
  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerName: profile.name,
    avatar: profile.avatar,
    profile: { ...profile, avatar: "" },
    caption: row.caption || "",
    mediaPath: row.media_path,
    mediaType: row.media_type,
    createdAt: new Date(row.created_at).getTime(),
    expiresAt: new Date(row.expires_at).getTime(),
    viewCount: Number(row.views?.[0]?.count) || 0,
    likeCount: Number(row.likes?.[0]?.count) || 0,
    liked: likedIds.has(row.id),
    viewedByMe: viewedIds.has(row.id),
  };
}

export async function loadStories(client, userId) {
  requireUser(client, userId);
  const { data, error } = await client.from("stories").select(`
    id,owner_id,caption,media_path,media_type,created_at,expires_at,
    profile:profiles!stories_owner_id_fkey(id,display_name,username,bio,city,avatar_path,cover_path,kind,verified_at,partner_approved_at,is_private),
    likes:story_likes(count),
    views:story_views(count)
  `)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(250);
  if (error) throw error;

  const rows = data || [];
  if (!rows.length) return [];
  const storyIds = rows.map(story => story.id);
  const [{ data: likes, error: likesError }, { data: views, error: viewsError }] = await Promise.all([
    client.from("story_likes").select("story_id").eq("user_id", userId).in("story_id", storyIds),
    client.from("story_views").select("story_id").eq("viewer_id", userId).in("story_id", storyIds),
  ]);
  if (likesError) throw likesError;
  if (viewsError) throw viewsError;

  const likedIds = new Set((likes || []).map(item => item.story_id));
  const viewedIds = new Set((views || []).map(item => item.story_id));
  return Promise.all(rows.map(async row => {
    const story = mapStory(row, likedIds, viewedIds);
    const [media, avatar] = await Promise.all([
      signMedia(client, story.mediaPath),
      signMedia(client, story.avatar),
    ]);
    return { ...story, media, mediaUrl: media, avatar, profile: { ...story.profile, avatar } };
  }));
}

export async function publishStory(client, userId, file, caption = "") {
  requireUser(client, userId);
  validateStoryMedia(file, caption);
  const id = createSecureId();
  const extension = MIME_EXTENSIONS.get(file.type);
  const path = `${userId}/stories/${id}.${extension}`;
  const { error: uploadError } = await client.storage.from(MEDIA_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data, error } = await client.from("stories").insert({
    id,
    owner_id: userId,
    caption: caption.trim(),
    media_path: path,
    media_type: file.type.startsWith("video/") ? "video" : "image",
  }).select("id,owner_id,caption,media_path,media_type,created_at,expires_at").single();
  if (error) {
    const { error: cleanupError } = await client.storage.from(MEDIA_BUCKET).remove([path]);
    if (cleanupError) console.error("Não foi possível limpar a mídia de um Story não publicado.", cleanupError);
    throw error;
  }
  return data;
}

export async function recordStoryView(client, userId, story) {
  requireUser(client, userId);
  if (story.ownerId === userId || story.viewedByMe) return false;
  const { data, error } = await client.from("story_views").upsert({
    story_id: story.id,
    viewer_id: userId,
  }, { onConflict: "story_id,viewer_id", ignoreDuplicates: true }).select("story_id");
  if (error) throw error;
  return Boolean(data?.length);
}

export async function loadStoryViewers(client, userId, storyId) {
  requireUser(client, userId);
  const { data, error } = await client.rpc("get_fortalfy_story_viewers", { p_story_id: storyId });
  if (error) throw error;
  return Promise.all((data || []).map(async viewer => ({
    id: viewer.viewer_id,
    name: viewer.viewer_name || "Conta privada",
    username: viewer.username || "",
    avatar: await signMedia(client, viewer.avatar_path),
    viewedAt: viewer.viewed_at,
  })));
}

export async function setStoryLike(client, userId, story, liked) {
  requireUser(client, userId);
  if (liked) {
    const { error } = await client.from("story_likes").upsert({
      story_id: story.id,
      user_id: userId,
    }, { onConflict: "story_id,user_id", ignoreDuplicates: true });
    if (error) throw error;
    return;
  }
  const { error } = await client.from("story_likes").delete()
    .eq("story_id", story.id)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function deleteStory(client, userId, story) {
  requireUser(client, userId);
  if (story.ownerId !== userId) throw new Error("Você só pode excluir Stories publicados pela sua conta.");
  const { data, error } = await client.from("stories").delete()
    .eq("id", story.id)
    .eq("owner_id", userId)
    .select("media_path")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Este Story não existe mais ou você não tem permissão para excluí-lo.");

  const { error: cleanupError } = await client.storage.from(MEDIA_BUCKET).remove([data.media_path]);
  if (cleanupError) {
    console.error("O Story foi removido, mas sua mídia não pôde ser limpa do armazenamento.", cleanupError);
    return "O Story foi excluído, mas a mídia antiga não pôde ser removida do armazenamento.";
  }
  return "";
}
