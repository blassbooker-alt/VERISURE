import { createSecureId } from "./secureId.js";

const MEDIA_BUCKET = "social-media";
const PROFILE_FIELDS = new Set(["avatar_path", "cover_path"]);

export function isDemoUser(userId) {
  if (!userId || typeof userId !== "string") return false;
  return userId === "demo-user-fortalfy" || userId.startsWith("demo-") || userId.startsWith("local-");
}

export function normalizeSocialCount(value) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
}

function requireRealUser(userId) {
  if (!userId || isDemoUser(userId)) throw new Error("Entre com uma conta real para acessar este recurso.");
}

export function getErrorMessage(error, fallback = "Não foi possível concluir esta ação.") {
  if (!error) return fallback;
  if (error.code === "23505") return "Esta ação já foi registrada.";
  if (error.code === "42501") return "Sua conta não tem permissão para esta ação.";
  if (error.code === "PGRST202" && /get_fortalfy_profile_social_stats/i.test(error.message || "")) {
    return "O Supabase ainda não tem as funções de perfil social. Aplique FORTALFY_SOCIAL_VIEWS_V1.sql após as migrações base do projeto.";
  }
  if (error.code === "42703" && /post_media.*reel_validated/i.test(error.message || "")) {
    return "O banco ainda não tem o suporte de validação dos Reels. Aplique FORTALFY_REELS_9_16_SUPABASE.sql após FORTALFY_SOCIAL_VIEWS_V1.sql.";
  }
  if (error.code === "42703" && /posts\.is_reel/i.test(error.message || "")) {
    return "O banco ainda não tem o suporte aos Reels. Aplique FORTALFY_REELS_9_16_SUPABASE.sql para ativar essa área.";
  }
  if (error.code === "PGRST205") return "Esta área ainda não está habilitada no banco. A equipe precisa aplicar as migrações do Fortalfy no Supabase.";
  return error.message || fallback;
}

export function mapProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.display_name || "Pessoa Fortalfy",
    username: row.username || "",
    bio: row.bio || "",
    city: row.city || "",
    avatar: row.avatar_path || "",
    cover: row.cover_path || "",
    kind: row.kind || "cliente",
    verified: Boolean(row.verified_at || row.partner_approved_at),
    partnerApproved: Boolean(row.partner_approved_at),
    isPrivate: Boolean(row.is_private),
  };
}

export async function signMedia(client, path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path) || path.startsWith("data:")) return path;
  const { data, error } = await client.storage.from(MEDIA_BUCKET).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function uploadProfileImage(client, userId, file, field) {
  if (!PROFILE_FIELDS.has(field)) throw new Error("Tipo de imagem de perfil inválido.");
  if (!file.type.startsWith("image/") || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
    throw new Error("Use uma imagem JPG, PNG, WebP ou GIF.");
  }
  if (file.size > 5 * 1024 * 1024) throw new Error("A imagem do perfil pode ter até 5 MB.");
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "webp";
  const path = `${userId}/profile/${field === "avatar_path" ? "avatar" : "cover"}-${createSecureId()}.${extension}`;
  const { error: uploadError } = await client.storage.from(MEDIA_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) throw uploadError;
  const { error: profileError } = await client.from("profiles").update({ [field]: path }).eq("id", userId);
  if (profileError) {
    const { error: cleanupError } = await client.storage.from(MEDIA_BUCKET).remove([path]);
    if (cleanupError) console.error("Não foi possível limpar uma imagem de perfil sem referência.", cleanupError);
    throw profileError;
  }
  return path;
}

export async function prepareProfileImage(file, field, zoom = 1) {
  if (!PROFILE_FIELDS.has(field)) throw new Error("Tipo de imagem de perfil inválido.");
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file?.type)) {
    throw new Error("Use uma imagem JPG, PNG, WebP ou GIF.");
  }
  if (file.size > 15 * 1024 * 1024) throw new Error("A imagem original pode ter até 15 MB.");
  if (file.type === "image/gif") {
    if (file.size > 5 * 1024 * 1024) throw new Error("GIFs animados podem ter até 5 MB para preservar a animação.");
    return file;
  }
  if (typeof globalThis.createImageBitmap !== "function") {
    throw new Error("Este navegador não permite ajustar a imagem com segurança.");
  }

  const bitmap = await globalThis.createImageBitmap(file);
  try {
    const ratio = field === "avatar_path" ? 1 : 3;
    const sourceWidth = Math.min(bitmap.width, bitmap.height * ratio);
    const sourceHeight = sourceWidth / ratio;
    const scale = Math.min(2, Math.max(1, Number(zoom) || 1));
    const cropWidth = sourceWidth / scale;
    const cropHeight = sourceHeight / scale;
    const sourceX = (bitmap.width - cropWidth) / 2;
    const sourceY = (bitmap.height - cropHeight) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = field === "avatar_path" ? 900 : 1500;
    canvas.height = field === "avatar_path" ? 900 : 500;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar o corte da imagem.");
    context.drawImage(bitmap, sourceX, sourceY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve, reject) => canvas.toBlob(
      result => result ? resolve(result) : reject(new Error("Não foi possível comprimir a imagem.")),
      "image/webp",
      0.86,
    ));
    if (blob.size > 5 * 1024 * 1024) throw new Error("A imagem ajustada ainda excede o limite de 5 MB.");
    const extension = blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
    return new File([blob], `${field === "avatar_path" ? "foto-perfil" : "capa"}.${extension}`, { type: blob.type });
  } finally {
    bitmap.close?.();
  }
}

export async function removeProfileImage(client, userId, path, field) {
  if (!PROFILE_FIELDS.has(field)) throw new Error("Tipo de imagem de perfil inválido.");
  const { error: profileError } = await client.from("profiles").update({ [field]: null }).eq("id", userId);
  if (profileError) throw profileError;
  if (path && !/^https?:\/\//i.test(path)) {
    const { error } = await client.storage.from(MEDIA_BUCKET).remove([path]);
    if (error) {
      console.error("A imagem foi removida do perfil, mas não foi possível limpar o arquivo antigo.", error);
      throw error;
    }
  }
}

export async function loadProfile(client, userId) {
  requireRealUser(userId);
  if (!client) throw new Error("A conexão com o Supabase não está configurada.");
  const { data, error } = await client.from("profiles")
    .select("id,display_name,username,bio,city,avatar_path,cover_path,kind,verified_at,partner_approved_at,is_private")
    .eq("id", userId)
    .single();
  if (error) throw error;
  const profile = mapProfile(data);
  const [avatar, cover] = await Promise.all([
    signMedia(client, profile.avatar),
    signMedia(client, profile.cover),
  ]);
  return { ...profile, avatar, cover, avatarPath: data.avatar_path || "", coverPath: data.cover_path || "" };
}

export async function isUsernameAvailable(client, username, profileId = null) {
  if (!client) throw new Error("A conexão com o Supabase não está configurada.");
  const normalized = String(username || "").trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9._]{3,30}$/.test(normalized)) return false;
  const { data, error } = await client.rpc("is_fortalfy_username_available", {
    p_username: normalized,
    p_profile_id: profileId,
  });
  if (error) throw error;
  return Boolean(data);
}

async function signMediaBatch(client, paths) {
  const uniquePaths = [...new Set(paths.filter(path => path && !/^https?:\/\//i.test(path) && !path.startsWith("data:")))];
  if (!uniquePaths.length) return new Map();
  const signedUrls = new Map();
  for (let offset = 0; offset < uniquePaths.length; offset += 100) {
    const pathsBatch = uniquePaths.slice(offset, offset + 100);
    const { data, error } = await client.storage.from(MEDIA_BUCKET).createSignedUrls(pathsBatch, 3600);
    if (error) throw error;
    for (const item of data || []) {
      if (item.error) throw item.error;
      if (!item.signedUrl) throw new Error("Não foi possível preparar as mídias do Feed.");
      signedUrls.set(item.path, item.signedUrl);
    }
  }
  if (signedUrls.size !== uniquePaths.length) {
    throw new Error("O armazenamento não retornou todos os vídeos solicitados.");
  }
  return signedUrls;
}

export async function loadFeed(client, userId, {
  filter = "latest",
  offset = 0,
  limit = 15,
  authorId = "",
  mediaType = "",
  onPostsReady,
} = {}) {
  requireRealUser(userId);
  if (!client) throw new Error("A conexão com o Supabase não está configurada.");
  let followedIds = null;
  if (filter === "following") {
    const { data, error } = await client.from("profile_follows")
      .select("followed_id")
      .eq("follower_id", userId);
    if (error) throw error;
    followedIds = data.map(item => item.followed_id);
    if (!followedIds.length) return { posts: [], hasMore: false, total: 0 };
  }

  const pageLimit = mediaType === "video" ? Math.min(limit, 5) : limit;
  const mediaRelation = mediaType ? "post_media!inner" : "post_media";
  const engagementRelations = mediaType === "video"
    ? ""
    : ",\n    likes:post_likes(count),\n    comments:post_comments(count)";
  let query = client.from("posts").select(`
    id,author_id,body,visibility,shared_post_id,published_at,
    author:profiles!posts_author_id_fkey(id,display_name,username,avatar_path,kind,verified_at,partner_approved_at,is_private),
    ${mediaRelation}(id,storage_path,media_type,sort_order)
    ${engagementRelations}
  `, mediaType === "video" ? undefined : { count: "exact" })
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + pageLimit);
  if (followedIds) query = query.in("author_id", followedIds);
  if (authorId) query = query.eq("author_id", authorId);
  if (mediaType) query = query.eq("post_media.media_type", mediaType);
  if (mediaType === "video") query = query.eq("is_reel", true).eq("post_media.reel_validated", true);

  const { data, error, count } = await query;
  if (error) throw error;
  const fetchedRows = data || [];
  const rows = fetchedRows.slice(0, pageLimit);
  const hasMore = mediaType === "video" || count == null
    ? fetchedRows.length > pageLimit
    : offset + rows.length < count;
  const sharedPostIds = [...new Set(rows.map(post => post.shared_post_id).filter(Boolean))];
  const likedIds = new Set();
  const savedIds = new Set();
  const shareCounts = new Map();
  const originals = new Map();
  const reelViewCounts = new Map();
  const engagementCounts = new Map();
  let posts = [];
  let relatedPromise = Promise.resolve({ results: [] });
  if (rows.length) {
    const originalFields = `
      id,author_id,body,published_at,media_path,
      author:profiles!posts_author_id_fkey(id,display_name,username,avatar_path,kind,verified_at,partner_approved_at,is_private),
      post_media(id,storage_path,media_type,sort_order)
    `;
    relatedPromise = Promise.all([
      client.from("post_likes").select("post_id").eq("user_id", userId).in("post_id", rows.map(post => post.id)),
      client.from("saved_posts").select("post_id").eq("user_id", userId).in("post_id", rows.map(post => post.id)),
      client.from("posts").select("shared_post_id").in("shared_post_id", rows.map(post => post.id)),
      sharedPostIds.length
        ? client.from("posts").select(originalFields).in("id", sharedPostIds)
        : Promise.resolve({ data: [], error: null }),
      mediaType === "video"
        ? client.rpc("get_fortalfy_reel_view_counts", { p_post_ids: rows.map(post => post.id) })
        : Promise.resolve({ data: [], error: null }),
      mediaType === "video"
        ? client.from("posts").select("id,likes:post_likes(count),comments:post_comments(count)").in("id", rows.map(post => post.id))
        : Promise.resolve({ data: rows, error: null }),
    ]).then(results => ({ results }), error => ({ error }));
    const signedUrls = await signMediaBatch(client, rows.flatMap(post => [
      post.author?.avatar_path,
      post.media_path,
      ...(post.post_media || []).map(item => item.storage_path),
    ]));
    const resolveMedia = path => {
      if (!path || /^https?:\/\//i.test(path) || path.startsWith("data:")) return path || "";
      const signedUrl = signedUrls.get(path);
      if (!signedUrl) throw new Error("Não foi possível preparar uma mídia do Feed.");
      return signedUrl;
    };
    posts = rows.map(post => {
      const author = mapProfile(post.author);
      if (author) author.avatar = resolveMedia(author.avatar);
      const media = [...(post.post_media || [])]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(item => ({ ...item, url: resolveMedia(item.storage_path) }));
      if (post.media_path && !media.some(item => item.storage_path === post.media_path)) {
        media.unshift({ id: post.media_path, storage_path: post.media_path, media_type: "image", sort_order: -1, url: resolveMedia(post.media_path) });
      }
      return {
        ...post,
        author,
        media,
        original: null,
        likedByMe: false,
        savedByMe: false,
        likeCount: post.likes?.[0]?.count || 0,
        commentCount: post.comments?.[0]?.count || 0,
        shareCount: 0,
        reelViewCount: 0,
      };
    });
  }
  const total = mediaType === "video" ? offset + rows.length + Number(hasMore) : count ?? offset + rows.length;
  onPostsReady?.({ posts, hasMore, total });

  if (rows.length) {
    const related = await relatedPromise;
    if (related.error) throw related.error;
    const [
      { data: likes, error: likesError },
      { data: saved, error: savedError },
      sharesResult,
      originalsResult,
      reelViewsResult,
      engagementResult,
    ] = related.results;
    if (likesError) throw likesError;
    if (savedError) throw savedError;
    if (sharesResult.error) throw sharesResult.error;
    if (originalsResult.error) throw originalsResult.error;
    if (reelViewsResult.error) throw reelViewsResult.error;
    if (engagementResult.error) throw engagementResult.error;
    (likes || []).forEach(like => likedIds.add(like.post_id));
    (saved || []).forEach(item => savedIds.add(item.post_id));
    (sharesResult.data || []).forEach(share => {
      if (share.shared_post_id) shareCounts.set(share.shared_post_id, (shareCounts.get(share.shared_post_id) || 0) + 1);
    });
    (reelViewsResult.data || []).forEach(view => reelViewCounts.set(view.post_id, Number(view.view_count) || 0));
    (originalsResult.data || []).forEach(original => originals.set(original.id, original));
    (engagementResult.data || []).forEach(item => engagementCounts.set(item.id, {
      likeCount: item.likes?.[0]?.count || 0,
      commentCount: item.comments?.[0]?.count || 0,
    }));
    for (const post of posts) {
      post.likedByMe = likedIds.has(post.id);
      post.savedByMe = savedIds.has(post.id);
      post.likeCount = engagementCounts.get(post.id)?.likeCount ?? post.likeCount;
      post.commentCount = engagementCounts.get(post.id)?.commentCount ?? post.commentCount;
      post.shareCount = shareCounts.get(post.id) || 0;
      post.reelViewCount = reelViewCounts.get(post.id) || 0;
    }
  }

  const originalSignedUrls = await signMediaBatch(client, [...originals.values()].flatMap(post => [
    post.author?.avatar_path,
    post.media_path,
    ...(post.post_media || []).map(item => item.storage_path),
  ]));
  const resolveOriginalMedia = path => {
    if (!path || /^https?:\/\//i.test(path) || path.startsWith("data:")) return path || "";
    const signedUrl = originalSignedUrls.get(path);
    if (!signedUrl) throw new Error("Não foi possível preparar uma mídia compartilhada do Feed.");
    return signedUrl;
  };
  for (const post of posts) {
    let original = null;
    const originalPost = originals.get(post.shared_post_id);
    if (originalPost) {
      const originalAuthor = mapProfile(originalPost.author);
      if (originalAuthor) originalAuthor.avatar = resolveOriginalMedia(originalAuthor.avatar);
      original = {
        ...originalPost,
        author: originalAuthor,
        media: [...(originalPost.post_media || [])]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(item => ({ ...item, url: resolveOriginalMedia(item.storage_path) })),
      };
    }
    post.original = original;
  }
  return {
    posts: posts.map(post => ({ ...post })),
    hasMore,
    total: mediaType === "video" ? offset + rows.length + Number(hasMore) : count ?? offset + rows.length,
  };
}

export async function searchProfiles(client, userId, { search = "", offset = 0, limit = 24 } = {}) {
  requireRealUser(userId);
  const term = search.trim().replace(/[,%()\\_*]/g, " ").replace(/\s+/g, " ");
  let query = client.from("profiles")
    .select("id,display_name,username,bio,city,avatar_path,kind,verified_at,partner_approved_at,is_private", { count: "exact" });
  query = query.neq("id", userId);
  query = query
    .order("display_name", { ascending: true })
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);
  if (term) {
    const pattern = `%${term}%`;
    query = query.or(`display_name.ilike.${pattern},username.ilike.${pattern}`);
  }
  const { data, error, count } = await query;
  if (error) throw error;
  const profiles = await Promise.all((data || []).map(async row => {
    const profile = mapProfile(row);
    profile.avatar = await signMedia(client, profile.avatar);
    return profile;
  }));
  return {
    profiles,
    hasMore: count == null ? profiles.length === limit : offset + profiles.length < count,
    total: count ?? offset + profiles.length,
  };
}

export async function startConversation(client, userId, otherUserId) {
  if (!userId || !otherUserId || userId === otherUserId) throw new Error("Escolha outra pessoa para iniciar uma conversa.");
  const access = await loadMutualFollowState(client, userId, otherUserId);
  if (!access.canMessage) throw new Error("Vocês precisam se seguir para conversar.");
  const [memberOne, memberTwo] = [userId, otherUserId].sort();
  const { error: createError } = await client.from("dm_conversations").upsert({
    member_one: memberOne,
    member_two: memberTwo,
  }, { onConflict: "member_one,member_two", ignoreDuplicates: true });
  if (createError) throw createError;
  const { data, error } = await client.from("dm_conversations")
    .select("id,member_one,member_two,member_one_read_at,member_two_read_at,last_message_at,created_at")
    .eq("member_one", memberOne)
    .eq("member_two", memberTwo)
    .single();
  if (error) throw error;
  return data;
}

export async function loadMutualFollowState(client, userId, otherUserId) {
  requireRealUser(userId);
  requireRealUser(otherUserId);
  if (userId === otherUserId) throw new Error("Escolha outra pessoa para iniciar uma conversa.");
  const readFollow = async (followerId, followedId) => {
    const { data, error } = await client.from("profile_follows")
      .select("follower_id")
      .eq("follower_id", followerId)
      .eq("followed_id", followedId)
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  };
  const [followsOther, otherFollowsUser, request] = await Promise.all([
    readFollow(userId, otherUserId),
    readFollow(otherUserId, userId),
    client.from("follow_requests")
      .select("status")
      .eq("follower_id", userId)
      .eq("followed_id", otherUserId)
      .eq("status", "pending")
      .maybeSingle(),
  ]);
  if (request.error) throw request.error;
  return {
    followsOther,
    otherFollowsUser,
    canMessage: followsOther && otherFollowsUser,
    requestPending: Boolean(request.data),
  };
}

export async function loadConversations(client, userId) {
  requireRealUser(userId);
  const { data, error } = await client.from("dm_conversations")
    .select("id,member_one,member_two,member_one_read_at,member_two_read_at,last_message_at,created_at")
    .or(`member_one.eq.${userId},member_two.eq.${userId}`)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(0, 49);
  if (error) throw error;
  const rows = data || [];
  const otherIds = [...new Set(rows.map(row => row.member_one === userId ? row.member_two : row.member_one))];
  if (!otherIds.length) return [];
  const { data: profileRows, error: profilesError } = await client.from("profiles")
    .select("id,display_name,username,avatar_path,kind,verified_at,partner_approved_at,is_private")
    .in("id", otherIds);
  if (profilesError) throw profilesError;
  const profileMap = new Map(await Promise.all((profileRows || []).map(async row => {
    const person = mapProfile(row);
    person.avatar = await signMedia(client, person.avatar);
    return [person.id, person];
  })));
  const conversations = await Promise.all(rows.map(async row => {
    const otherId = row.member_one === userId ? row.member_two : row.member_one;
    const { data: latestMessage, error: messageError } = await client.from("direct_messages")
      .select("id,body,sender_id,created_at")
      .eq("conversation_id", row.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (messageError) throw messageError;
    return { ...row, person: profileMap.get(otherId) || null, latestMessage };
  }));
  return conversations.filter(conversation => conversation.person);
}

export async function loadDirectMessages(client, userId, conversationId, { limit = 100 } = {}) {
  requireRealUser(userId);
  const { data, error } = await client.from("direct_messages")
    .select("id,conversation_id,sender_id,body,created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .range(0, limit - 1);
  if (error) throw error;
  return data || [];
}

export async function sendDirectMessage(client, userId, conversationId, body) {
  requireRealUser(userId);
  const text = body.trim();
  if (!text || text.length > 4000) throw new Error("A mensagem deve ter entre 1 e 4.000 caracteres.");
  const { data, error } = await client.from("direct_messages").insert({
    conversation_id: conversationId,
    sender_id: userId,
    body: text,
  }).select("id,conversation_id,sender_id,body,created_at").single();
  if (error) throw error;
  return data;
}

export async function markConversationRead(client, userId, conversation) {
  requireRealUser(userId);
  const readColumn = conversation.member_one === userId ? "member_one_read_at" : "member_two_read_at";
  const memberColumn = conversation.member_one === userId ? "member_one" : "member_two";
  const { error } = await client.from("dm_conversations").update({ [readColumn]: new Date().toISOString() })
    .eq("id", conversation.id)
    .eq(memberColumn, userId);
  if (error) throw error;
}

export async function loadComments(client, userId, postId, { offset = 0, limit = 50 } = {}) {
  requireRealUser(userId);
  const { data, error, count } = await client.from("post_comments").select(`
    id,post_id,author_id,parent_comment_id,body,created_at,updated_at,
    author:profiles!post_comments_author_id_fkey(id,display_name,username,avatar_path),
    likes:post_comment_likes(count)
  `, { count: "exact" })
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  const rows = data || [];
  const likedIds = new Set();
  if (rows.length) {
    const { data: likes, error: likesError } = await client.from("post_comment_likes")
      .select("comment_id")
      .eq("user_id", userId)
      .in("comment_id", rows.map(comment => comment.id));
    if (likesError) throw likesError;
    (likes || []).forEach(like => likedIds.add(like.comment_id));
  }
  const comments = await Promise.all(rows.map(async comment => {
    const author = mapProfile(comment.author);
    if (author) author.avatar = await signMedia(client, author.avatar);
    return {
      ...comment,
      author,
      likedByMe: likedIds.has(comment.id),
      likeCount: comment.likes?.[0]?.count || 0,
    };
  }));
  return { comments, hasMore: count == null ? rows.length === limit : offset + rows.length < count };
}

export async function publishPost(client, userId, {
  body, files = [], visibility = "public", isReel = false, postId: requestedPostId = "",
}) {
  requireRealUser(userId);
  if (!client) throw new Error("A conexão com o Supabase não está configurada.");
  if (isReel && (files.length !== 1 || !["video/mp4", "video/webm"].includes(files[0]?.type))) {
    throw new Error("O FortalReels aceita um único vídeo MP4 ou WebM por publicação.");
  }
  const uploaded = [];
  const postId = isReel ? requestedPostId || createSecureId() : createSecureId();
  if (isReel && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(postId)) {
    throw new Error("Não foi possível iniciar esta publicação do FortalReels.");
  }
  const publishReel = async storagePath => {
    const { data, error } = await client.functions.invoke("validate-fortalreel-media", {
      body: {
        storagePath,
        postId,
        caption: body.trim(),
        visibility,
      },
    });
    if (error) {
      const response = error.context;
      if (response && typeof response.json === "function") {
        let payload;
        try {
          payload = await response.json();
        } catch { /* The original function error remains available. */ }
        if (typeof payload?.error === "string" && payload.error) throw new Error(payload.error);
      }
      throw error;
    }
    if (!data?.valid || data.postId !== postId || data.storagePath !== storagePath) {
      throw new Error("O servidor não confirmou a publicação vertical do FortalReels.");
    }
    return { id: data.postId };
  };
  let postCreated = false;
  try {
    for (const [index, file] of files.entries()) {
      const extension = file.type.startsWith("video/")
        ? file.type === "video/mp4" ? "mp4" : "webm"
        : file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "webp";
      const path = `${userId}/posts/${postId}/${String(index).padStart(2, "0")}.${extension}`;
      const { error: uploadError } = await client.storage.from(MEDIA_BUCKET).upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (uploadError) {
        if (isReel) {
          try {
            return await publishReel(path);
          } catch (publishError) {
            const { error: cleanupError } = await client.storage.from(MEDIA_BUCKET).remove([path]);
            if (cleanupError) console.error("Não foi possível limpar o upload pendente do FortalReels.", cleanupError);
            throw publishError;
          }
        }
        throw uploadError;
      }
      const mediaType = file.type.startsWith("video/") ? "video" : "image";
      const uploadedMedia = {
        post_id: postId,
        storage_path: path,
        media_type: mediaType,
        sort_order: index,
      };
      uploaded.push(uploadedMedia);
      if (isReel) return await publishReel(path);
    }
    const { error: postError } = await client.from("posts").insert({
      id: postId,
      author_id: userId,
      body: body.trim(),
      visibility,
      media_path: uploaded[0]?.storage_path || null,
    });
    if (postError) throw postError;
    postCreated = true;
    if (uploaded.length) {
      const { error: mediaError } = await client.from("post_media").insert(uploaded);
      if (mediaError) throw mediaError;
    }
    return { id: postId };
  } catch (error) {
    if (postCreated) {
      const { error: postCleanupError } = await client.from("posts").delete().eq("id", postId);
      if (postCleanupError) console.error("Não foi possível remover a publicação incompleta.", postCleanupError);
    }
    if (uploaded.length) {
      const { error: cleanupError } = await client.storage.from(MEDIA_BUCKET).remove(uploaded.map(media => media.storage_path));
      if (cleanupError) console.error("Não foi possível limpar a mídia após falha ao publicar.", cleanupError);
    }
    throw error;
  }
}

export async function setPostLike(client, userId, postId, liked) {
  requireRealUser(userId);
  const request = liked
    ? client.from("post_likes").upsert({ post_id: postId, user_id: userId }, { onConflict: "post_id,user_id", ignoreDuplicates: true })
    : client.from("post_likes").delete().eq("post_id", postId).eq("user_id", userId);
  const { error } = await request;
  if (error) throw error;
}

export async function setCommentLike(client, userId, commentId, liked) {
  requireRealUser(userId);
  const request = liked
    ? client.from("post_comment_likes").upsert({ comment_id: commentId, user_id: userId }, { onConflict: "comment_id,user_id", ignoreDuplicates: true })
    : client.from("post_comment_likes").delete().eq("comment_id", commentId).eq("user_id", userId);
  const { error } = await request;
  if (error) throw error;
}

export async function addComment(client, userId, postId, body, parentCommentId = null) {
  requireRealUser(userId);
  const { data, error } = await client.from("post_comments").insert({
    post_id: postId,
    author_id: userId,
    parent_comment_id: parentCommentId,
    body: body.trim(),
  }).select("id").single();
  if (error) throw error;
  return data;
}

export async function updateComment(client, commentId, body) {
  const { error } = await client.from("post_comments").update({ body: body.trim() }).eq("id", commentId);
  if (error) throw error;
}

export async function deleteComment(client, commentId) {
  const { error } = await client.from("post_comments").delete().eq("id", commentId);
  if (error) throw error;
}

export async function updatePost(client, postId, body) {
  const { error } = await client.from("posts").update({ body: body.trim() }).eq("id", postId);
  if (error) throw error;
}

export async function deletePost(client, postId) {
  const { data: media, error: mediaError } = await client.from("post_media")
    .select("storage_path").eq("post_id", postId);
  if (mediaError) throw mediaError;
  const { error: postError } = await client.from("posts").delete().eq("id", postId);
  if (postError) throw postError;
  if (media?.length) {
    const { error } = await client.storage.from(MEDIA_BUCKET).remove(media.map(item => item.storage_path));
    if (error) throw error;
  }
}

export async function sharePost(client, userId, postId, body = "") {
  requireRealUser(userId);
  const { data, error } = await client.from("posts").insert({
    author_id: userId,
    body: body.trim(),
    shared_post_id: postId,
    visibility: "public",
  }).select("id").single();
  if (error) throw error;
  return data;
}

export async function setFollow(client, followerId, followedId, following, isPrivate = false) {
  requireRealUser(followerId);
  requireRealUser(followedId);
  if (followerId === followedId) throw new Error("Você não pode seguir seu próprio perfil.");
  if (isPrivate && following) {
    const { data: existing, error: lookupError } = await client.from("follow_requests")
      .select("status").eq("follower_id", followerId).eq("followed_id", followedId).maybeSingle();
    if (lookupError) throw lookupError;
    if (existing?.status === "pending") return "requested";
    if (existing) {
      const { error: removeError } = await client.from("follow_requests")
        .delete().eq("follower_id", followerId).eq("followed_id", followedId);
      if (removeError) throw removeError;
    }
    const { error } = await client.from("follow_requests").insert({
      follower_id: followerId,
      followed_id: followedId,
      status: "pending",
    });
    if (error) throw error;
    return "requested";
  }
  if (isPrivate && !following) {
    const { error: unfollowError } = await client.from("profile_follows")
      .delete().eq("follower_id", followerId).eq("followed_id", followedId);
    if (unfollowError) throw unfollowError;
    await cancelFollowRequest(client, followerId, followedId);
    return "not-following";
  }
  const request = following
    ? client.from("profile_follows").upsert({ follower_id: followerId, followed_id: followedId }, { onConflict: "follower_id,followed_id", ignoreDuplicates: true })
    : client.from("profile_follows").delete().eq("follower_id", followerId).eq("followed_id", followedId);
  const { error } = await request;
  if (error) throw error;
  return following ? "following" : "not-following";
}

export async function cancelFollowRequest(client, followerId, followedId) {
  requireRealUser(followerId);
  requireRealUser(followedId);
  const { error } = await client.from("follow_requests")
    .delete().eq("follower_id", followerId).eq("followed_id", followedId);
  if (error) throw error;
}

export async function loadFollowRequests(client, userId) {
  requireRealUser(userId);
  const { data, error } = await client.from("follow_requests").select(`
    follower_id,followed_id,status,created_at,
    follower:profiles!follow_requests_follower_id_fkey(id,display_name,username,avatar_path)
  `).eq("followed_id", userId).eq("status", "pending").order("created_at", { ascending: false });
  if (error) throw error;
  return Promise.all((data || []).map(async row => {
    const follower = mapProfile(row.follower);
    if (follower) follower.avatar = await signMedia(client, follower.avatar);
    return { ...row, follower };
  }));
}

export async function respondFollowRequest(client, followerId, followedId, accepted) {
  requireRealUser(followerId);
  requireRealUser(followedId);
  const { error } = await client.rpc("respond_fortalfy_follow_request", {
    p_follower_id: followerId,
    p_accept: accepted,
  });
  if (error) throw error;
}

export async function loadFollowState(client, userId, profileId) {
  requireRealUser(userId);
  requireRealUser(profileId);
  const { data, error } = await client.rpc("get_fortalfy_profile_social_stats", { p_profile_id: profileId });
  if (error) {
    const missingStatsFunction = error.code === "PGRST202"
      && /get_fortalfy_profile_social_stats/i.test(error.message || "");
    if (!missingStatsFunction) throw error;

    const countFollows = async (column, value) => {
      const result = await client.from("profile_follows")
        .select("follower_id", { count: "exact", head: true })
        .eq(column, value);
      if (result.error) throw result.error;
      return result.count || 0;
    };
    const [followers, following, relationship, request] = await Promise.all([
      countFollows("followed_id", profileId),
      countFollows("follower_id", profileId),
      client.from("profile_follows").select("follower_id")
        .eq("follower_id", userId).eq("followed_id", profileId).maybeSingle(),
      client.from("follow_requests").select("status")
        .eq("follower_id", userId).eq("followed_id", profileId).maybeSingle(),
    ]);
    if (relationship.error) throw relationship.error;
    if (request.error) throw request.error;
    return {
      followers: normalizeSocialCount(followers),
      following: normalizeSocialCount(following),
      isFollowing: Boolean(relationship.data),
      requestStatus: request.data?.status || "",
    };
  }
  const stats = Array.isArray(data) ? data[0] : data;
  if (!stats) throw new Error("Este perfil não está disponível para sua conta.");
  return {
    followers: normalizeSocialCount(stats.followers_count),
    following: normalizeSocialCount(stats.following_count),
    isFollowing: Boolean(stats.is_following),
    requestStatus: stats.request_status || "",
  };
}

export async function loadProfileConnections(client, userId, profileId, direction, { offset = 0, limit = 50 } = {}) {
  requireRealUser(userId);
  requireRealUser(profileId);
  if (!["followers", "following"].includes(direction)) throw new Error("Tipo de lista de conexões inválido.");
  const { data, error } = await client.rpc("get_fortalfy_profile_connections", {
    p_profile_id: profileId,
    p_direction: direction,
    p_offset: offset,
    p_limit: limit + 1,
  });
  if (error) throw error;
  const rows = data || [];
  const page = rows.slice(0, limit);
  const profiles = await Promise.all(page.map(async row => {
    const profile = mapProfile({
      id: row.connection_id,
      display_name: row.display_name,
      username: row.username,
      avatar_path: row.avatar_path,
    });
    profile.avatar = await signMedia(client, profile.avatar);
    return profile;
  }));
  return { profiles, hasMore: rows.length > limit };
}

export async function recordReelView(client, userId, postId) {
  requireRealUser(userId);
  const { data, error } = await client.rpc("record_fortalfy_reel_view", { p_post_id: postId });
  if (error) throw error;
  return Boolean(data);
}

export async function setBookmark(client, userId, postId, saved) {
  requireRealUser(userId);
  const request = saved
    ? client.from("saved_posts").upsert({ user_id: userId, post_id: postId }, { onConflict: "user_id,post_id", ignoreDuplicates: true })
    : client.from("saved_posts").delete().eq("user_id", userId).eq("post_id", postId);
  const { error } = await request;
  if (error) throw error;
}

export async function hidePost(client, userId, postId) {
  requireRealUser(userId);
  const { error } = await client.from("hidden_posts").upsert(
    { user_id: userId, post_id: postId },
    { onConflict: "user_id,post_id", ignoreDuplicates: true },
  );
  if (error) throw error;
}

export async function reportPost(client, userId, postId, reason) {
  requireRealUser(userId);
  const { error } = await client.from("content_reports").insert({ reporter_id: userId, post_id: postId, reason });
  if (error) throw error;
}

export async function reportComment(client, userId, commentId, reason) {
  requireRealUser(userId);
  const { error } = await client.from("content_reports").insert({ reporter_id: userId, comment_id: commentId, reason });
  if (error) throw error;
}
