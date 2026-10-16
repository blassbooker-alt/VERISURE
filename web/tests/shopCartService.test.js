import test from "node:test";
import assert from "node:assert/strict";
import { shopProducts } from "../src/shopData.js";
import { addShopCartItem, getShopCartLineKey, getShopCartOptionsLabel, getShopCartProduct, getShopCartSummary, removeShopCartItem, updateShopCartQuantity } from "../src/shopCartService.js";

const product = shopProducts.find(item => item.sku === "FS-WHEY-C900");
const chocolate = { Sabor: "Chocolate" };
const vanilla = { Sabor: "Baunilha" };

test("adding the same product variation combines lines while other variations stay separate", () => {
  let cart = addShopCartItem([], product, chocolate, 2);
  cart = addShopCartItem(cart, product, chocolate, 1);
  cart = addShopCartItem(cart, product, vanilla);

  assert.equal(cart.length, 2);
  assert.equal(cart.find(line => line.options.Sabor === "Chocolate").quantity, 3);
  assert.equal(cart.find(line => line.options.Sabor === "Baunilha").quantity, 1);
  assert.equal(getShopCartProduct(cart[0]).sku, product.sku);
  assert.equal(getShopCartOptionsLabel(cart[0]), "Chocolate");
});

test("cart quantities update, zero removes a line, and subtotal reflects catalog prices", () => {
  const firstLine = { id: product.sku, options: chocolate, quantity: 2 };
  const secondLine = { id: product.sku, options: vanilla, quantity: 1 };
  const cart = [firstLine, secondLine];
  const summary = getShopCartSummary(cart);

  assert.equal(summary.itemCount, 3);
  assert.equal(summary.subtotal, product.price * 3);
  assert.equal(updateShopCartQuantity(cart, getShopCartLineKey(firstLine), 4)[0].quantity, 4);
  assert.deepEqual(updateShopCartQuantity(cart, getShopCartLineKey(firstLine), 0), [secondLine]);
  assert.deepEqual(removeShopCartItem(cart, getShopCartLineKey(secondLine)), [firstLine]);
});

test("unknown legacy products do not affect checkout subtotal", () => {
  const cart = [{ id: "removed-product", options: {}, quantity: 3 }];
  assert.deepEqual(getShopCartSummary(cart), { itemCount: 0, subtotal: 0 });
});
