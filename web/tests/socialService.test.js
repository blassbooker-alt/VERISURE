import test from "node:test";
import assert from "node:assert/strict";
import { getErrorMessage, loadComments, loadFeed, mapProfile } from "../src/socialService.js";

function query(result) {
  return {
    select() { return this; },
    order() { return this; },
    range() { return this; },
    eq() { return this; },
    in() { return this; },
    then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
  };
}

test("profile mapping exposes only public social fields and normalizes defaults", () => {
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
    isPrivate: true,
  });
  assert.equal(mapProfile(null), null);
});

test("feed loads mapped counts, the current user's like state, and pagination", async () => {
  const post = {
    id: "post-1",
    author_id: "author-1",
    body: "Uma publicação",
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
      if (table === "posts") return query({ data: [post], error: null, count: 16 });
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
  assert.equal(getErrorMessage({ message: "E-mail indisponível" }), "E-mail indisponível");
  assert.equal(getErrorMessage(null, "Erro alternativo"), "Erro alternativo");
});
