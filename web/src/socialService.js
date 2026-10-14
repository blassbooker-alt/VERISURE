const MEDIA_BUCKET = "social-media";
const PROFILE_FIELDS = new Set(["avatar_path", "cover_path"]);

export function getErrorMessage(error, fallback = "Não foi possível concluir esta ação.") {
  if (!error) return fallback;
  if (error.code === "23505") return "Esta ação já foi registrada.";
  if (error.code === "42501") return "Sua conta não tem permissão para esta ação.";
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
  const path = `${userId}/profile/${field === "avatar_path" ? "avatar" : "cover"}-${crypto.randomUUID()}.${extension}`;
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

async function signPostMedia(client, post) {
  const media = [...(post.post_media || [])].sort((a, b) => a.sort_order - b.sort_order);
  if (post.media_path && !media.some(item => item.storage_path === post.media_path)) {
    media.unshift({ id: post.media_path, storage_path: post.media_path, media_type: "image", sort_order: -1 });
  }
  return Promise.all(media.map(async item => ({
    ...item,
    url: await signMedia(client, item.storage_path),
  })));
}

export async function loadFeed(client, userId, { filter = "latest", offset = 0, limit = 15, authorId = "", mediaType = "" } = {}) {
  let followedIds = null;
  if (filter === "following") {
    const { data, error } = await client.from("profile_follows")
      .select("followed_id")
      .eq("follower_id", userId);
    if (error) throw error;
    followedIds = data.map(item => item.followed_id);
    if (!followedIds.length) return { posts: [], hasMore: false, total: 0 };
  }

  const mediaRelation = mediaType ? "post_media!inner" : "post_media";
  let query = client.from("posts").select(`
    id,author_id,body,visibility,shared_post_id,published_at,updated_at,
    author:profiles!posts_author_id_fkey(id,display_name,username,avatar_path,kind,verified_at,partner_approved_at,is_private),
    ${mediaRelation}(id,storage_path,media_type,sort_order),
    likes:post_likes(count),
    comments:post_comments(count),
    shares:posts!posts_shared_post_id_fkey(count),
    original:posts!posts_shared_post_id_fkey(
      id,author_id,body,published_at,media_path,
      author:profiles!posts_author_id_fkey(id,display_name,username,avatar_path,kind,verified_at,partner_approved_at,is_private),
      post_media(id,storage_path,media_type,sort_order)
    )
  `, { count: "exact" })
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);
  if (followedIds) query = query.in("author_id", followedIds);
  if (authorId) query = query.eq("author_id", authorId);
  if (mediaType) query = query.eq("post_media.media_type", mediaType);

  const { data, error, count } = await query;
  if (error) throw error;
  const rows = data || [];
  const likedIds = new Set();
  const savedIds = new Set();
  if (rows.length) {
    const [{ data: likes, error: likesError }, { data: saved, error: savedError }] = await Promise.all([
      client.from("post_likes").select("post_id").eq("user_id", userId).in("post_id", rows.map(post => post.id)),
      client.from("saved_posts").select("post_id").eq("user_id", userId).in("post_id", rows.map(post => post.id)),
    ]);
    if (likesError) throw likesError;
    if (savedError) throw savedError;
    (likes || []).forEach(like => likedIds.add(like.post_id));
    (saved || []).forEach(item => savedIds.add(item.post_id));
  }
  const posts = await Promise.all(rows.map(async post => {
    const author = mapProfile(post.author);
    if (author) author.avatar = await signMedia(client, author.avatar);
    const media = await signPostMedia(client, post);
    let original = null;
    if (post.original) {
      const originalAuthor = mapProfile(post.original.author);
      if (originalAuthor) originalAuthor.avatar = await signMedia(client, originalAuthor.avatar);
      original = {
        ...post.original,
        author: originalAuthor,
        media: await signPostMedia(client, post.original),
      };
    }
    return {
      ...post,
      author,
      media,
      original,
      likedByMe: likedIds.has(post.id),
      savedByMe: savedIds.has(post.id),
      likeCount: post.likes?.[0]?.count || 0,
      commentCount: post.comments?.[0]?.count || 0,
      shareCount: post.shares?.[0]?.count || 0,
    };
  }));
  return {
    posts,
    hasMore: count == null ? rows.length === limit : offset + rows.length < count,
    total: count ?? offset + rows.length,
  };
}

export async function searchProfiles(client, userId, { search = "", offset = 0, limit = 24 } = {}) {
  const term = search.trim().replace(/[,%()\\_*]/g, " ").replace(/\s+/g, " ");
  let query = client.from("profiles")
    .select("id,display_name,username,bio,city,avatar_path,kind,verified_at,partner_approved_at,is_private", { count: "exact" })
    .neq("id", userId)
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

export async function loadConversations(client, userId) {
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
  const { data, error } = await client.from("direct_messages")
    .select("id,conversation_id,sender_id,body,created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .range(0, limit - 1);
  if (error) throw error;
  return data || [];
}

export async function sendDirectMessage(client, userId, conversationId, body) {
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
  const readColumn = conversation.member_one === userId ? "member_one_read_at" : "member_two_read_at";
  const memberColumn = conversation.member_one === userId ? "member_one" : "member_two";
  const { error } = await client.from("dm_conversations").update({ [readColumn]: new Date().toISOString() })
    .eq("id", conversation.id)
    .eq(memberColumn, userId);
  if (error) throw error;
}

export async function loadComments(client, userId, postId, { offset = 0, limit = 50 } = {}) {
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

export async function publishPost(client, userId, { body, files = [], visibility = "public" }) {
  const uploaded = [];
  const postId = crypto.randomUUID();
  let postCreated = false;
  try {
    for (const [index, file] of files.entries()) {
      const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || (file.type === "video/mp4" ? "mp4" : "webp");
      const path = `${userId}/posts/${postId}/${String(index).padStart(2, "0")}.${extension}`;
      const { error: uploadError } = await client.storage.from(MEDIA_BUCKET).upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (uploadError) throw uploadError;
      uploaded.push({ post_id: postId, storage_path: path, media_type: file.type.startsWith("video/") ? "video" : "image", sort_order: index });
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
  const request = liked
    ? client.from("post_likes").upsert({ post_id: postId, user_id: userId }, { onConflict: "post_id,user_id", ignoreDuplicates: true })
    : client.from("post_likes").delete().eq("post_id", postId).eq("user_id", userId);
  const { error } = await request;
  if (error) throw error;
}

export async function setCommentLike(client, userId, commentId, liked) {
  const request = liked
    ? client.from("post_comment_likes").upsert({ comment_id: commentId, user_id: userId }, { onConflict: "comment_id,user_id", ignoreDuplicates: true })
    : client.from("post_comment_likes").delete().eq("comment_id", commentId).eq("user_id", userId);
  const { error } = await request;
  if (error) throw error;
}

export async function addComment(client, userId, postId, body, parentCommentId = null) {
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
  if (media?.length) {
    const { error } = await client.storage.from(MEDIA_BUCKET).remove(media.map(item => item.storage_path));
    if (error) throw error;
  }
  const { error } = await client.from("posts").delete().eq("id", postId);
  if (error) throw error;
}

export async function sharePost(client, userId, postId, body = "") {
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
  const { error } = await client.from("follow_requests")
    .delete().eq("follower_id", followerId).eq("followed_id", followedId);
  if (error) throw error;
}

export async function loadFollowRequests(client, userId) {
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
  const { error } = await client.from("follow_requests").update({
    status: accepted ? "accepted" : "rejected",
  }).eq("follower_id", followerId).eq("followed_id", followedId).eq("status", "pending");
  if (error) throw error;
}

export async function loadFollowState(client, userId, profileId) {
  const [{ count: followers, error: followersError }, { count: following, error: followingError }, { data, error }, { data: request, error: requestError }] = await Promise.all([
    client.from("profile_follows").select("follower_id", { count: "exact", head: true }).eq("followed_id", profileId),
    client.from("profile_follows").select("followed_id", { count: "exact", head: true }).eq("follower_id", profileId),
    client.from("profile_follows").select("followed_id").eq("follower_id", userId).eq("followed_id", profileId).maybeSingle(),
    client.from("follow_requests").select("status").eq("follower_id", userId).eq("followed_id", profileId).maybeSingle(),
  ]);
  if (followersError) throw followersError;
  if (followingError) throw followingError;
  if (error) throw error;
  if (requestError) throw requestError;
  return { followers: followers || 0, following: following || 0, isFollowing: Boolean(data), requestStatus: request?.status || "" };
}

export async function setBookmark(client, userId, postId, saved) {
  const request = saved
    ? client.from("saved_posts").upsert({ user_id: userId, post_id: postId }, { onConflict: "user_id,post_id", ignoreDuplicates: true })
    : client.from("saved_posts").delete().eq("user_id", userId).eq("post_id", postId);
  const { error } = await request;
  if (error) throw error;
}

export async function hidePost(client, userId, postId) {
  const { error } = await client.from("hidden_posts").upsert(
    { user_id: userId, post_id: postId },
    { onConflict: "user_id,post_id", ignoreDuplicates: true },
  );
  if (error) throw error;
}

export async function reportPost(client, userId, postId, reason) {
  const { error } = await client.from("content_reports").insert({ reporter_id: userId, post_id: postId, reason });
  if (error) throw error;
}

export async function reportComment(client, userId, commentId, reason) {
  const { error } = await client.from("content_reports").insert({ reporter_id: userId, comment_id: commentId, reason });
  if (error) throw error;
}
