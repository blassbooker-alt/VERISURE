import test from "node:test";
import assert from "node:assert/strict";
import { publishStory, validateStoryMedia } from "./storyService.js";

const validUserId = "7876315f-c9df-4aaf-8bc0-b726756361cb";
const photo = { type: "image/jpeg", size: 1024 };

test("Story valida formatos, tamanho e legenda antes do upload", () => {
  assert.equal(validateStoryMedia(photo, "Treino de hoje"), undefined);
  assert.throws(() => validateStoryMedia({ ...photo, type: "image/heic" }), /JPG, PNG ou WebP/);
  assert.throws(() => validateStoryMedia({ ...photo, size: 16 * 1024 * 1024 }), /15 MB/);
  assert.throws(() => validateStoryMedia(photo, "x".repeat(181)), /180 caracteres/);
});

test("publicação envia a mídia para o caminho isolado do próprio usuário e grava o Story", async () => {
  const calls = [];
  const client = {
    storage: { from: bucket => ({ upload: async (path, file, options) => {
      calls.push({ bucket, path, file, options });
      return { error: null };
    } }) },
    from: table => ({ insert: values => ({ select: () => ({ single: async () => {
      calls.push({ table, values });
      return { data: values, error: null };
    } }) }) }),
  };

  const saved = await publishStory(client, validUserId, photo, "Minha rotina");
  assert.equal(calls[0].bucket, "social-media");
  assert.match(calls[0].path, new RegExp(`^${validUserId}/stories/[0-9a-f-]+\\.jpg$`));
  assert.equal(calls[0].options.contentType, "image/jpeg");
  assert.equal(calls[1].table, "stories");
  assert.equal(calls[1].values.media_path, calls[0].path);
  assert.equal(calls[1].values.caption, "Minha rotina");
  assert.equal(saved.media_type, "image");
});

test("falha ao salvar o registro limpa a mídia já enviada", async () => {
  const removed = [];
  const client = {
    storage: { from: () => ({
      upload: async () => ({ error: null }),
      remove: async paths => { removed.push(...paths); return { error: null }; },
    }) },
    from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: null, error: new Error("database unavailable") }) }) }) }),
  };

  await assert.rejects(publishStory(client, validUserId, photo), /database unavailable/);
  assert.equal(removed.length, 1);
  assert.match(removed[0], new RegExp(`^${validUserId}/stories/[0-9a-f-]+\\.jpg$`));
});
