import test from "node:test";
import assert from "node:assert/strict";
import { loadStories, loadStoryViewers, publishStory, validateStoryMedia } from "../src/storyService.js";

function query(result) {
  return {
    select() { return this; },
    gt() { return this; },
    order() { return this; },
    limit() { return this; },
    eq() { return this; },
    in() { return this; },
    then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
  };
}

test("story media validation accepts supported image and video types and enforces size and caption limits", () => {
  assert.doesNotThrow(() => validateStoryMedia({ type: "image/webp", size: 15 * 1024 * 1024 }, "Treino de hoje"));
  assert.doesNotThrow(() => validateStoryMedia({ type: "video/mp4", size: 40 * 1024 * 1024 }));
  assert.throws(() => validateStoryMedia({ type: "image/svg+xml", size: 100 }), /JPG, PNG ou WebP/);
  assert.throws(() => validateStoryMedia({ type: "video/mp4", size: 40 * 1024 * 1024 + 1 }), /40 MB/);
  assert.throws(() => validateStoryMedia({ type: "image/jpeg", size: 100 }, "x".repeat(181)), /180 caracteres/);
});

test("stories load only for an authenticated account and resolve signed media", async () => {
  const row = {
    id: "story-1",
    owner_id: "author-1",
    caption: "Treino de hoje",
    media_path: "author-1/stories/story-1.jpg",
    media_type: "image",
    created_at: "2026-10-14T12:00:00Z",
    expires_at: "2026-10-15T12:00:00Z",
    profile: { id: "author-1", display_name: "Ana", avatar_path: "author-1/profile/avatar.jpg" },
    likes: [{ count: 3 }],
    views: [{ count: 8 }],
  };
  const client = {
    from(table) {
      if (table === "stories") return query({ data: [row], error: null });
      if (table === "story_likes") return query({ data: [{ story_id: "story-1" }], error: null });
      if (table === "story_views") return query({ data: [], error: null });
      throw new Error(`Unexpected table: ${table}`);
    },
    storage: {
      from(bucket) {
        assert.equal(bucket, "social-media");
        return { createSignedUrl: async path => ({ data: { signedUrl: `signed:${path}` }, error: null }) };
      },
    },
  };

  const [story] = await loadStories(client, "viewer-1");
  assert.equal(story.ownerName, "Ana");
  assert.equal(story.media, "signed:author-1/stories/story-1.jpg");
  assert.equal(story.avatar, "signed:author-1/profile/avatar.jpg");
  assert.equal(story.likeCount, 3);
  assert.equal(story.viewCount, 8);
  assert.equal(story.liked, true);
  assert.equal(story.viewedByMe, false);
  await assert.rejects(loadStories(client, "demo-user-fortalfy"), /conta Fortalfy/);
});

test("publishing uploads media to the existing private bucket before creating a shared story", async () => {
  const uploads = [];
  const inserts = [];
  const storyRow = {
    id: "story-id",
    owner_id: "user-1",
    caption: "Agora sim",
    media_path: "",
    media_type: "image",
    created_at: "2026-10-14T12:00:00Z",
    expires_at: "2026-10-15T12:00:00Z",
  };
  const client = {
    storage: {
      from(bucket) {
        assert.equal(bucket, "social-media");
        return { upload: async (path, file, options) => {
          uploads.push({ path, file, options });
          return { error: null };
        } };
      },
    },
    from(table) {
      assert.equal(table, "stories");
      return {
        insert(values) {
          inserts.push(values);
          storyRow.media_path = values.media_path;
          return {
            select() { return this; },
            single: async () => ({ data: storyRow, error: null }),
          };
        },
      };
    },
  };
  const file = { type: "image/jpeg", size: 1024 };

  const result = await publishStory(client, "user-1", file, "  Agora sim  ");
  assert.equal(uploads.length, 1);
  assert.match(uploads[0].path, /^user-1\/stories\/[0-9a-f-]+\.jpg$/);
  assert.equal(uploads[0].options.contentType, "image/jpeg");
  assert.equal(inserts[0].owner_id, "user-1");
  assert.equal(inserts[0].caption, "Agora sim");
  assert.equal(inserts[0].media_path, uploads[0].path);
  assert.equal(result.media_type, "image");
});

test("Story viewer identities come only from the authorized owner RPC and private viewers stay anonymous", async () => {
  const rpcCalls = [];
  const client = {
    rpc: async (name, params) => {
      rpcCalls.push({ name, params });
      return {
        data: [
          { viewer_id: "viewer-1", viewer_name: "Ana", username: "ana.fit", avatar_path: "viewer-1/avatar.jpg", viewed_at: "2026-10-15T12:00:00Z" },
          { viewer_id: null, viewer_name: "Conta privada", username: null, avatar_path: null, viewed_at: "2026-10-15T11:00:00Z" },
        ],
        error: null,
      };
    },
    storage: { from: () => ({ createSignedUrl: async path => ({ data: { signedUrl: `signed:${path}` }, error: null }) }) },
  };
  const viewers = await loadStoryViewers(client, "owner-1", "story-1");
  assert.deepEqual(rpcCalls, [{ name: "get_fortalfy_story_viewers", params: { p_story_id: "story-1" } }]);
  assert.equal(viewers[0].id, "viewer-1");
  assert.equal(viewers[0].avatar, "signed:viewer-1/avatar.jpg");
  assert.equal(viewers[1].id, null);
  assert.equal(viewers[1].name, "Conta privada");
});
