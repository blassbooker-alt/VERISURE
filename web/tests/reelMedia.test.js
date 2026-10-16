import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateReelCrop, FORTALREEL_MAX_DURATION_SECONDS, isFortalReelRatio,
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

test("9:16 crop preserves the source aspect without stretching portrait and landscape videos", () => {
  const landscape = calculateReelCrop(1920, 1080, 0.25, 0.5);
  assert.equal(landscape.width / landscape.height, 9 / 16);
  assert.ok(landscape.left > 0);
  assert.equal(landscape.top, 0);

  const portrait = calculateReelCrop(1080, 2340, 0.5, 0.75);
  assert.equal(portrait.width / portrait.height, 9 / 16);
  assert.equal(portrait.left, 0);
  assert.ok(portrait.top > 0);

  assert.equal(FORTALREEL_MAX_DURATION_SECONDS, 90);
});
