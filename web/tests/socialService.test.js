import test from "node:test";
import assert from "node:assert/strict";
import {
  getErrorMessage, isUsernameAvailable, loadComments, loadFeed, loadFollowState,
  loadMutualFollowState, loadProfileConnections, mapProfile, recordReelView,
  prepareProfileImage, publishPost, respondFollowRequest, startConversation,
  setFollow,
} from "../src/socialService.js";

function query(result, onSelect = () => {}) {
  return {
    select(fields) { onSelect(fields); return this; },
    order() { return this; },
    range() { return this; },
    eq() { return this; },
    in() { return this; },
    then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
  };
}

test("profile mapping only shows verification for actually verified or approved profiles", () => {
  assert.deepEqual(mapProfile({
    id: "user-1",
    display_name: "Ana",
    username: "ana",
    bio: null,
    city: null,
    avatar_path: null,
    cover_path: null,
    kind: "cliente",
    verified_at: null,
    partner_approved_at: null,
    is_private: true,
    phone: "must not be copied",
  }), {
    id: "user-1",
    name: "Ana",
    username: "ana",
    bio: "",
    city: "",
    avatar: "",
    cover: "",
    kind: "cliente",
    verified: false,
    partnerApproved: false,
    isPrivate: true,
  });

  assert.equal(mapProfile(null), null);
});

test("username availability normalizes valid input and skips malformed usernames", async () => {
  const calls = [];
  const client = {
    rpc: async (name, params) => {
      calls.push({ name, params });
      return { data: true, error: null };
    },
  };
  assert.equal(await isUsernameAvailable(client, " @Ana.Fit_30 "), true);
  assert.deepEqual(calls, [{
    name: "is_fortalfy_username_available",
    params: { p_username: "ana.fit_30", p_profile_id: null },
  }]);
  assert.equal(await isUsernameAvailable(client, "an"), false);
  assert.equal(calls.length, 1);
});

test("follow state uses the privacy-aware aggregate RPC and normalizes counts", async () => {
  const calls = [];
  const client = {
    rpc: async (name, params) => {
      calls.push({ name, params });
      return {
        data: [{ followers_count: "12", following_count: 4, is_following: true, request_status: null }],
        error: null,
      };
    },
  };
  assert.deepEqual(await loadFollowState(client, "viewer-1", "profile-1"), {
    followers: 12,
    following: 4,
    isFollowing: true,
    requestStatus: "",
  });
  assert.deepEqual(calls, [{
    name: "get_fortalfy_profile_social_stats",
    params: { p_profile_id: "profile-1" },
  }]);
});

test("following a Reel author persists public follows and private follow requests", async () => {
  const calls = [];
  const client = {
    from(table) {
      return {
        upsert: async (row, options) => {
          calls.push({ table, operation: "upsert", row, options });
          return { error: null };
        },
        select: () => ({
          eq: (column, value) => ({
            eq: (nextColumn, nextValue) => ({
              maybeSingle: async () => {
                calls.push({ table, operation: "lookup", column, value, nextColumn, nextValue });
                return { data: null, error: null };
              },
            }),
          }),
        }),
        insert: async row => {
          calls.push({ table, operation: "insert", row });
          return { error: null };
        },
      };
    },
  };

  assert.equal(await setFollow(client, "viewer-1", "creator-1", true), "following");
  assert.equal(await setFollow(client, "viewer-1", "private-creator-1", true, true), "requested");
  assert.deepEqual(calls, [
    {
      table: "profile_follows",
      operation: "upsert",
      row: { follower_id: "viewer-1", followed_id: "creator-1" },
      options: { onConflict: "follower_id,followed_id", ignoreDuplicates: true },
    },
    {
      table: "follow_requests",
      operation: "lookup",
      column: "follower_id",
      value: "viewer-1",
      nextColumn: "followed_id",
      nextValue: "private-creator-1",
    },
    {
      table: "follow_requests",
      operation: "insert",
      row: { follower_id: "viewer-1", followed_id: "private-creator-1", status: "pending" },
    },
  ]);
});

test("profile connection lists use the access-controlled paginated RPC", async () => {
  const client = {
    rpc: async (name, params) => {
      assert.equal(name, "get_fortalfy_profile_connections");
      assert.deepEqual(params, {
        p_profile_id: "profile-1",
        p_direction: "followers",
        p_offset: 0,
        p_limit: 3,
      });
      return {
        data: [
          { connection_id: "person-1", display_name: "Ana", username: "ana", avatar_path: "person-1/avatar.jpg" },
          { connection_id: "person-2", display_name: "Bia", username: "bia", avatar_path: null },
          { connection_id: "person-3", display_name: "Caio", username: "caio", avatar_path: null },
        ],
        error: null,
      };
    },
    storage: {
      from: () => ({ createSignedUrl: async path => ({ data: { signedUrl: `signed:${path}` }, error: null }) }),
    },
  };
  const result = await loadProfileConnections(client, "viewer-1", "profile-1", "followers", { limit: 2 });
  assert.deepEqual(result.profiles.map(profile => profile.id), ["person-1", "person-2"]);
  assert.equal(result.profiles[0].avatar, "signed:person-1/avatar.jpg");
  assert.equal(result.hasMore, true);
});

test("Reel view and follow-request responses use server-validated RPCs", async () => {
  const calls = [];
  let inserted = true;
  const client = {
    rpc: async (name, params) => {
      calls.push({ name, params });
      if (name === "record_fortalfy_reel_view") {
        const data = inserted;
        inserted = false;
        return { data, error: null };
      }
      return { data: "accepted", error: null };
    },
  };
  assert.equal(await recordReelView(client, "viewer-1", "reel-1"), true);
  assert.equal(await recordReelView(client, "viewer-1", "reel-1"), false);
  await respondFollowRequest(client, "follower-1", "profile-owner-1", true);
  assert.deepEqual(calls, [
    { name: "record_fortalfy_reel_view", params: { p_post_id: "reel-1" } },
    { name: "record_fortalfy_reel_view", params: { p_post_id: "reel-1" } },
    { name: "respond_fortalfy_follow_request", params: { p_follower_id: "follower-1", p_accept: true } },
  ]);
});

test("Reel publication delegates validation and atomic metadata writes to the server", async () => {
  const calls = [];
  const file = { name: "vertical.webm", type: "video/webm", size: 1024 };
  const postId = "ad1f2df8-5a5d-4fca-aeb8-9cb03f72c137";
  const client = {
    storage: { from: bucket => ({
      upload: async (path, uploadedFile) => {
        calls.push({ operation: "upload", bucket, path, file: uploadedFile });
        return { error: null };
      },
      remove: async paths => ({ error: null, paths }),
    }) },
    functions: { invoke: async (name, options) => {
      calls.push({ operation: "validate", name, options });
      return { data: { valid: true, postId, storagePath: options.body.storagePath }, error: null };
    } },
  };
  assert.deepEqual(await publishPost(client, "owner-1", {
    body: "Treino vertical",
    files: [file],
    isReel: true,
    postId,
  }), { id: postId });
  assert.deepEqual(calls.map(call => call.operation), ["upload", "validate"]);
  assert.equal(calls[0].path, `owner-1/posts/${postId}/00.webm`);
  assert.equal(calls[1].name, "validate-fortalreel-media");
  assert.deepEqual(calls[1].options.body, {
    storagePath: calls[0].path,
    postId,
    caption: "Treino vertical",
    visibility: "public",
  });
});

test("profile images preserve valid animated GIFs and reject excessive source sizes", async () => {
  const gif = { type: "image/gif", size: 1024, name: "avatar.gif" };
  assert.equal(await prepareProfileImage(gif, "avatar_path"), gif);
  await assert.rejects(
    prepareProfileImage({ type: "image/jpeg", size: 16 * 1024 * 1024 }, "cover_path"),
    /15 MB/,
  );
});

test("feed loads mapped counts, the current user's like state, and pagination", async () => {
  let postsQueries = 0;
  const postSelections = [];
  const post = {
    id: "post-1",
    author_id: "author-1",
    body: "Uma publicação",
    shared_post_id: null,
    published_at: "2026-10-13T20:00:00Z",
    author: { id: "author-1", display_name: "Ana", avatar_path: null },
    post_media: [],
    likes: [{ count: 4 }],
    comments: [{ count: 2 }],
    shares: [{ count: 1 }],
    original: null,
  };
  const client = {
    from(table) {
      if (table === "posts") {
        postsQueries += 1;
        const result = postsQueries === 1
          ? { data: [post], error: null, count: 16 }
          : { data: [{ shared_post_id: "post-1" }], error: null };
        return query(result, fields => postSelections.push(fields));
      }
      if (table === "post_likes") return query({ data: [{ post_id: "post-1" }], error: null });
      if (table === "saved_posts") return query({ data: [], error: null });
      throw new Error(`Unexpected table: ${table}`);
    },
  };

  const result = await loadFeed(client, "viewer-1", { offset: 15, limit: 15 });
  assert.equal(result.posts.length, 1);
  assert.equal(result.posts[0].author.name, "Ana");
  assert.equal(result.posts[0].likeCount, 4);
  assert.equal(result.posts[0].commentCount, 2);
  assert.equal(result.posts[0].shareCount, 1);
  assert.equal(result.posts[0].likedByMe, true);
  assert.equal(result.posts[0].savedByMe, false);
  assert.equal(result.hasMore, false);
  assert.equal(postSelections.some(fields => fields.includes("posts!")), false);
  assert.equal(postSelections.some(fields => fields.includes("updated_at")), false);
});

test("feed loads shared posts and share counts without recursive PostgREST relationships", async () => {
  let postsQueries = 0;
  const sharedPost = {
    id: "share-1",
    author_id: "author-1",
    body: "",
    shared_post_id: "original-1",
    published_at: "2026-10-13T21:00:00Z",
    author: { id: "author-1", display_name: "Ana", avatar_path: null },
    post_media: [],
    likes: [{ count: 0 }],
    comments: [{ count: 0 }],
  };
  const original = {
    id: "original-1",
    author_id: "author-2",
    body: "Publicação original",
    published_at: "2026-10-13T20:00:00Z",
    author: { id: "author-2", display_name: "Bruna", avatar_path: null },
    post_media: [],
  };
  const client = {
    from(table) {
      if (table === "posts") {
        postsQueries += 1;
        if (postsQueries === 1) return query({ data: [sharedPost], error: null, count: 1 });
        if (postsQueries === 2) return query({ data: [{ shared_post_id: "original-1" }], error: null });
        return query({ data: [original], error: null });
      }
      if (table === "post_likes" || table === "saved_posts") return query({ data: [], error: null });
      throw new Error(`Unexpected table: ${table}`);
    },
  };

  const result = await loadFeed(client, "viewer-1");
  assert.equal(result.posts[0].original.id, "original-1");
  assert.equal(result.posts[0].original.author.name, "Bruna");
  assert.equal(result.posts[0].shareCount, 0);
  assert.equal(postsQueries, 3);
});

test("comments map individual likes and preserve parent relationships", async () => {
  const client = {
    from(table) {
      if (table === "post_comments") return query({
        data: [{
          id: "comment-1",
          post_id: "post-1",
          author_id: "author-1",
          parent_comment_id: null,
          body: "Comentário",
          created_at: "2026-10-13T20:00:00Z",
          author: { id: "author-1", display_name: "Ana", avatar_path: null },
          likes: [{ count: 3 }],
        }],
        error: null,
        count: 1,
      });
      if (table === "post_comment_likes") return query({ data: [{ comment_id: "comment-1" }], error: null });
      throw new Error(`Unexpected table: ${table}`);
    },
  };
  const result = await loadComments(client, "viewer-1", "post-1");
  assert.equal(result.comments[0].author.name, "Ana");
  assert.equal(result.comments[0].parent_comment_id, null);
  assert.equal(result.comments[0].likeCount, 3);
  assert.equal(result.comments[0].likedByMe, true);
  assert.equal(result.hasMore, false);
});

test("database error messages preserve authorization details", () => {
  assert.equal(getErrorMessage({ code: "42501", message: "blocked" }), "Sua conta não tem permissão para esta ação.");
  assert.equal(getErrorMessage({ code: "PGRST205", message: "table missing" }), "Esta área ainda não está habilitada no banco. A equipe precisa aplicar as migrações do Fortalfy no Supabase.");
  assert.equal(getErrorMessage({ message: "E-mail indisponível" }), "E-mail indisponível");
  assert.equal(getErrorMessage(null, "Erro alternativo"), "Erro alternativo");
});

test("direct-message access requires both follow directions and reports a pending request", async () => {
  const edges = new Set(["user-1:user-2"]);
  const client = {
    from(table) {
      const filters = {};
      return {
        select() { return this; },
        eq(column, value) { filters[column] = value; return this; },
        maybeSingle: async () => table === "profile_follows"
          ? { data: edges.has(`${filters.follower_id}:${filters.followed_id}`) ? filters : null, error: null }
          : { data: { status: "pending" }, error: null },
      };
    },
  };

  const state = await loadMutualFollowState(client, "user-1", "user-2");
  assert.deepEqual(state, {
    followsOther: true,
    otherFollowsUser: false,
    canMessage: false,
    requestPending: true,
  });
  edges.add("user-2:user-1");
  assert.equal((await loadMutualFollowState(client, "user-1", "user-2")).canMessage, true);
});

test("starting a conversation is rejected before creating a conversation without mutual follows", async () => {
  let attemptedInsert = false;
  const client = {
    from(table) {
      if (table === "dm_conversations") {
        attemptedInsert = true;
        throw new Error("Conversation must not be created");
      }
      const filters = {};
      return {
        select() { return this; },
        eq(column, value) { filters[column] = value; return this; },
        maybeSingle: async () => ({ data: null, error: null }),
      };
    },
  };

  await assert.rejects(startConversation(client, "user-1", "user-2"), /Vocês precisam se seguir/);
  assert.equal(attemptedInsert, false);
});
