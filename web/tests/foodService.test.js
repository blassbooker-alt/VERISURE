import test from "node:test";
import assert from "node:assert/strict";
import { loadAvailableFoodMenu } from "../src/foodService.js";

function makeClient({ menuItems = [], restaurants = [], menuError = null, restaurantError = null } = {}) {
  const calls = [];
  const rowsByTable = { food_menu_items: menuItems, profiles: restaurants };
  const errorsByTable = { food_menu_items: menuError, profiles: restaurantError };
  const client = {
    calls,
    from(table) {
      calls.push({ table });
      const call = calls.at(-1);
      const builder = {
        select(columns) { call.columns = columns; return this; },
        eq(column, value) { (call.filters ||= []).push(["eq", column, value]); return this; },
        in(column, value) { (call.filters ||= []).push(["in", column, value]); return this; },
        order(column, options) { call.order = [column, options]; return this; },
        limit(value) { call.limit = value; return this; },
        then(resolve, reject) {
          return Promise.resolve({ data: rowsByTable[table], error: errorsByTable[table] }).then(resolve, reject);
        },
      };
      return builder;
    },
    storage: {
      from(bucket) {
        return {
          async createSignedUrl(path) {
            calls.push({ bucket, path });
            return { data: { signedUrl: `https://media.example/${path}` }, error: null };
          },
        };
      },
    },
  };
  return client;
}

test("food menu reads available items and returns only items from approved restaurant profiles", async () => {
  const client = makeClient({
    menuItems: [
      { id: "item-1", restaurant_id: "restaurant-1", name: "Prato real", description: "Descrição", price: "24.50", currency: "BRL", image_paths: ["food/item.jpg"], portion_label: "400 g", allergens: ["leite"], available: true, stock: null },
      { id: "item-2", restaurant_id: "restaurant-pending", name: "Pendente", description: "Não publicar", price: 20, image_paths: [], available: true, stock: 2 },
      { id: "item-3", restaurant_id: "restaurant-1", name: "Indisponível", description: "Fora de estoque", price: 18, image_paths: [], available: false, stock: 0 },
    ],
    restaurants: [
      { id: "restaurant-1", display_name: "Restaurante aprovado", city: "Fortaleza", kind: "restaurante", partner_approved_at: "2026-01-01" },
      { id: "restaurant-pending", display_name: "Restaurante pendente", kind: "restaurante", partner_approved_at: null },
    ],
  });

  const items = await loadAvailableFoodMenu(client);

  assert.equal(items.length, 1);
  assert.deepEqual(items[0], {
    id: "item-1",
    name: "Prato real",
    description: "Descrição",
    price: 24.5,
    currency: "BRL",
    image: "https://media.example/food/item.jpg",
    portionLabel: "400 g",
    allergens: ["leite"],
    restaurant: { id: "restaurant-1", name: "Restaurante aprovado", city: "Fortaleza" },
  });
  assert.deepEqual(client.calls[0].filters, [["eq", "available", true]]);
  assert.deepEqual(client.calls[1].filters, [["eq", "kind", "restaurante"], ["in", "id", ["restaurant-1", "restaurant-pending"]]]);
});

test("food menu avoids a profile query when there are no published items", async () => {
  const client = makeClient();
  assert.deepEqual(await loadAvailableFoodMenu(client), []);
  assert.equal(client.calls.length, 1);
});

test("food menu surfaces Supabase query errors", async () => {
  const queryError = new Error("Supabase indisponível");
  await assert.rejects(loadAvailableFoodMenu(makeClient({ menuError: queryError })), queryError);
});

test("food menu requires the configured backend client", async () => {
  await assert.rejects(loadAvailableFoodMenu(null), /serviço de cardápios está indisponível/);
});
