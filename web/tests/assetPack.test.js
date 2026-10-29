import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { restaurants, workoutCategories } from "../src/data.js";
import { shopOffers, shopProducts } from "../src/shopData.js";

const publicRoot = fileURLToPath(new URL("../public/", import.meta.url));
const assetRoot = resolve(publicRoot, "assets", "fortalfy");

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

function assertPublicAsset(url) {
  assert.match(url, /^\/assets\/fortalfy\//);
  const path = resolve(publicRoot, url.slice(1));
  assert.equal(existsSync(path), true, `Missing public asset: ${url}`);
}

test("the supplied 82-image core pack is optimized and demo-gallery assets stay separate", () => {
  const files = listFiles(assetRoot);
  const productFiles = files.filter(path => {
    const normalized = path.toLowerCase().replaceAll("\\", "/");
    return !normalized.includes("/campaign/") && !normalized.includes("/shop-demo/");
  });
  assert.equal(productFiles.length, 82);
  assert.equal(files.length, 140);
  assert.ok(productFiles.every(path => path.endsWith(".jpg")));
  assert.ok(productFiles.every(path => statSync(path).size < 1024 * 1024));
  assert.ok(productFiles.reduce((total, path) => total + statSync(path).size, 0) < 15 * 1024 * 1024);
  assert.deepEqual(
    readdirSync(assetRoot).sort(),
    ["campaign", "food", "ofertas", "produtos", "publicidade", "shop-demo", "treino"],
  );
});

test("approved Fortalfy campaigns and email artwork retain their original PNG assets", () => {
  const campaignRoot = resolve(assetRoot, "campaign");
  const files = listFiles(campaignRoot);
  assert.equal(files.length, 8);
  assert.ok(files.every(path => path.endsWith(".png")));
  assert.ok(files.every(path => statSync(path).size < 2 * 1024 * 1024));
  assert.ok(files.every(path => {
    const png = readFileSync(path);
    return png.readUInt32BE(16) === 768 && png.readUInt32BE(20) === 960;
  }));
});

test("catalog, food, workout, and shop-offer records point to packaged assets", () => {
  const urls = [
    ...shopProducts.map(product => product.image),
    ...shopOffers.map(offer => offer.image),
    ...restaurants.map(item => item.image),
    ...workoutCategories.map(category => category.image),
  ];
  assert.equal(shopProducts.length, 50);
  assert.equal(shopProducts.filter(product => product.sku).length, 25);
  assert.equal(new Set(shopProducts.map(product => product.id)).size, shopProducts.length);
  assert.equal(restaurants.length, 10);
  assert.equal(workoutCategories.length, 4);
  urls.forEach(assertPublicAsset);
});

test("the login and shop campaign banners are available as packaged assets", () => {
  assertPublicAsset("/assets/fortalfy/publicidade/banner-app-papagaio-a.jpg");
  assertPublicAsset("/assets/fortalfy/publicidade/banner-app-papagaio-b.jpg");
});
