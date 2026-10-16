import test from "node:test";
import assert from "node:assert/strict";
import { filterShopProducts, getShopDepartment, shopProducts } from "../src/shopData.js";

const catalogProducts = shopProducts.filter(product => product.sku);

test("FortalShop department filters group products by their top-level category", () => {
  const supplements = filterShopProducts(catalogProducts, { category: "Suplementos" });
  assert.ok(supplements.length > 0);
  assert.ok(supplements.every(product => getShopDepartment(product) === "Suplementos"));
  assert.equal(filterShopProducts(catalogProducts).length, catalogProducts.length);
});

test("FortalShop search is case-insensitive, accent-insensitive, and matches all terms", () => {
  assert.deepEqual(
    filterShopProducts(catalogProducts, { search: "CREATINA MONOHIDRATADA" }).map(product => product.sku),
    ["FS-CREA-300"],
  );
  assert.deepEqual(
    filterShopProducts(catalogProducts, { search: "saude medicao" }).map(product => product.sku),
    ["FS-BAL-BIO"],
  );
});

test("FortalShop sorting preserves the selected product set and orders by price", () => {
  const cheapestFirst = filterShopProducts(catalogProducts, { sort: "price-asc" });
  const mostExpensiveFirst = filterShopProducts(catalogProducts, { sort: "price-desc" });
  assert.equal(cheapestFirst.length, catalogProducts.length);
  assert.ok(cheapestFirst.every((product, index) => index === 0 || cheapestFirst[index - 1].price <= product.price));
  assert.ok(mostExpensiveFirst.every((product, index) => index === 0 || mostExpensiveFirst[index - 1].price >= product.price));
  assert.deepEqual(
    filterShopProducts(catalogProducts, { category: "Eletrônicos", sort: "price-asc" }).map(product => product.sku),
    ["FS-CORDA-DIG", "FS-POWER-10K", "FS-FONE-TWS", "FS-CINTA-FC", "FS-BAL-BIO", "FS-BAND-5", "FS-SOM-BT", "FS-FONE-OVR", "FS-MASS-GUN", "FS-WATCH-PRO"],
  );
});
