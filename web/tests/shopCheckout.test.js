import test from "node:test";
import assert from "node:assert/strict";
import { buildSandboxCartItems } from "../src/shopCheckout.js";
import { shopProducts } from "../src/shopData.js";

const products = [{ id: "mat" }, { id: "bottle" }];

test("combines cart variants by product for server-side priced sandbox orders", () => {
  assert.deepEqual(buildSandboxCartItems([
    { id: "mat", quantity: 2 },
    { id: "mat", quantity: 1 },
    { id: "bottle", quantity: 1 },
  ], products), [
    { id: "mat", quantity: 3 },
    { id: "bottle", quantity: 1 },
  ]);
});

test("rejects unknown products and invalid quantities", () => {
  assert.throws(() => buildSandboxCartItems([{ id: "unknown", quantity: 1 }], products), /inválido/);
  assert.throws(() => buildSandboxCartItems([{ id: "mat", quantity: 0 }], products), /inválido/);
});

test("enforces per-product and per-order sandbox limits", () => {
  assert.throws(() => buildSandboxCartItems([
    { id: "mat", quantity: 11 },
    { id: "mat", quantity: 10 },
  ], products), /20 unidades/);
  const manyProducts = Array.from({ length: 21 }, (_, index) => ({ id: `product-${index}` }));
  assert.throws(() => buildSandboxCartItems(manyProducts.map(product => ({ id: product.id, quantity: 1 })), manyProducts), /20 produtos/);
});

test("uses all 25 suggested PDF prices in the local sandbox preview", () => {
  const prices = new Map(shopProducts.map(product => [product.id, product.price]));
  assert.equal(shopProducts.length, 25);
  assert.equal(prices.get("thermal-bottle"), 69.9);
  assert.equal(prices.get("thermal-bottle-500"), 59.9);
  assert.equal(prices.get("recovery-kit"), 249.9);
  assert.equal(prices.get("wellness-gift-kit"), 199.9);
});
