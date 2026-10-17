import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateReelCrop, FORTALREEL_MAX_DURATION_SECONDS, FORTALREEL_MAX_FILE_BYTES, inspectMp4AudioTrack, inspectMp4AudioTrackUrl, isFortalReelDurationAllowed, isFortalReelRatio,
} from "../src/reelMedia.js";

test("FortalReels accepts only vertical 9:16 dimensions within the metadata tolerance", () => {
  assert.equal(isFortalReelRatio(1080, 1920), true);
  assert.equal(isFortalReelRatio(1080, 1921), true);
  assert.equal(isFortalReelRatio(1082, 1920), true);
  assert.equal(isFortalReelRatio(1083, 1920), false);
  assert.equal(isFortalReelRatio(1920, 1080), false);
  assert.equal(isFortalReelRatio(1000, 1000), false);
  assert.equal(isFortalReelRatio(0, 1920), false);
});

test("FortalReels permits videos up to three minutes and rejects longer durations", () => {
  assert.equal(FORTALREEL_MAX_DURATION_SECONDS, 180);
  assert.equal(isFortalReelDurationAllowed(0), false);
  assert.equal(isFortalReelDurationAllowed(179.999), true);
  assert.equal(isFortalReelDurationAllowed(180), true);
  assert.equal(isFortalReelDurationAllowed(180.001), false);
  assert.equal(isFortalReelDurationAllowed(Number.NaN), false);
});

test("FortalReels keeps a 40 MB upload ceiling for processed files", () => {
  assert.equal(FORTALREEL_MAX_FILE_BYTES, 40 * 1024 * 1024);
});

function mp4Box(type, payload) {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(header.length + payload.length);
  header.write(type, 4, 4, "latin1");
  return Buffer.concat([header, payload]);
}

function mp4Track(handler) {
  const handlerData = Buffer.alloc(12);
  handlerData.write(handler, 8, 4, "latin1");
  return mp4Box("trak", mp4Box("mdia", mp4Box("hdlr", handlerData)));
}

test("FortalReels detects original MP4 audio tracks without treating silent video as audio", async () => {
  const movie = mp4Box("moov", Buffer.concat([mp4Track("vide"), mp4Track("soun")]));
  const silentMovie = mp4Box("moov", mp4Track("vide"));
  const withAudio = new Blob([mp4Box("ftyp", Buffer.alloc(8)), movie], { type: "video/mp4" });
  const withoutAudio = new Blob([mp4Box("ftyp", Buffer.alloc(8)), silentMovie], { type: "video/mp4" });
  const unsupported = new Blob([movie], { type: "video/webm" });
  assert.equal(await inspectMp4AudioTrack(withAudio), true);
  assert.equal(await inspectMp4AudioTrack(withoutAudio), false);
  assert.equal(await inspectMp4AudioTrack(unsupported), null);
});

test("FortalReels detects audio in remote MP4 files using byte-range requests", async () => {
  const movieWithAudio = mp4Box("moov", Buffer.concat([mp4Track("vide"), mp4Track("soun")]));
  const silentMovie = mp4Box("moov", mp4Track("vide"));
  const makeFetcher = content => async (_url, options) => {
    const [, start, end] = options.headers.Range.match(/bytes=(\d+)-(\d+)/);
    return new Response(content.subarray(Number(start), Number(end) + 1), { status: 206 });
  };
  const withAudio = Buffer.concat([mp4Box("ftyp", Buffer.alloc(8)), movieWithAudio]);
  const withoutAudio = Buffer.concat([mp4Box("ftyp", Buffer.alloc(8)), mp4Box("mdat", Buffer.alloc(4)), silentMovie]);

  assert.equal(await inspectMp4AudioTrackUrl("https://storage.example/reel.mp4?token=signed", makeFetcher(withAudio)), true);
  assert.equal(await inspectMp4AudioTrackUrl("https://storage.example/reel.mp4?token=signed", makeFetcher(withoutAudio)), false);
  assert.equal(await inspectMp4AudioTrackUrl("https://storage.example/reel.webm?token=signed", makeFetcher(withAudio)), null);
});

test("9:16 crop preserves the source aspect without stretching portrait and landscape videos", () => {
  const landscape = calculateReelCrop(1920, 1080, 0.25, 0.5);
  assert.equal(landscape.width / landscape.height, 9 / 16);
  assert.ok(landscape.left > 0);
  assert.equal(landscape.top, 0);

  const portrait = calculateReelCrop(1080, 2340, 0.5, 0.75);
  assert.equal(portrait.width / portrait.height, 9 / 16);
  assert.equal(portrait.left, 0);
  assert.ok(portrait.top > 0);

});
