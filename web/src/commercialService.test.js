import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getDiscountSchedulePercent, loadAdminCommercialData, reviewCommercialItem } from "./commercialService.js";

test("commercial migration adds post columns before triggers and reloads the API schema", async () => {
  const migration = await readFile(new URL("../../FORTALFY_COMMERCIAL_GOVERNANCE_AND_DISCOUNTS_V1.sql", import.meta.url), "utf8");
  const columnsIndex = migration.search(/alter table public\.posts\s+add column if not exists commercial_profile_id/i);
  const triggerIndex = migration.indexOf("create trigger fortalfy_queue_commercial_posts");

  assert.notEqual(columnsIndex, -1);
  assert.notEqual(triggerIndex, -1);
  assert.ok(columnsIndex < triggerIndex);
  assert.match(migration.trimEnd(), /notify pgrst, 'reload schema';\s*commit;\s*$/i);
});

const rules = [
  { plan: "start", day_from: 1, day_to: 10, percent: 1 },
  { plan: "start", day_from: 11, day_to: 20, percent: 2 },
  { plan: "start", day_from: 21, day_to: 25, percent: 3 },
  { plan: "start", day_from: 26, day_to: 31, percent: 5 },
  { plan: "plus", day_from: 1, day_to: 10, percent: 2 },
  { plan: "plus", day_from: 11, day_to: 20, percent: 4 },
  { plan: "plus", day_from: 21, day_to: 25, percent: 6 },
  { plan: "plus", day_from: 26, day_to: 31, percent: 10 },
  { plan: "master", day_from: 1, day_to: 10, percent: 5 },
  { plan: "master", day_from: 11, day_to: 20, percent: 10 },
  { plan: "master", day_from: 21, day_to: 25, percent: 15 },
  { plan: "master", day_from: 26, day_to: 31, percent: 20 },
];

test("progressive discount ranges match the configured plans", () => {
  assert.equal(getDiscountSchedulePercent(rules, "start", 5), 1);
  assert.equal(getDiscountSchedulePercent(rules, "start", 15), 2);
  assert.equal(getDiscountSchedulePercent(rules, "start", 25), 3);
  assert.equal(getDiscountSchedulePercent(rules, "start", 26), 5);
  assert.equal(getDiscountSchedulePercent(rules, "plus", 26), 10);
  assert.equal(getDiscountSchedulePercent(rules, "master", 26), 20);
});

test("month ends and leap-year February use calendar day ranges without overflow", () => {
  assert.equal(getDiscountSchedulePercent(rules, "master", 28), 20);
  assert.equal(getDiscountSchedulePercent(rules, "master", 29), 20);
  assert.equal(getDiscountSchedulePercent(rules, "master", 30), 20);
  assert.equal(getDiscountSchedulePercent(rules, "master", 31), 20);
});

test("unknown plans and invalid days do not produce a discount", () => {
  assert.equal(getDiscountSchedulePercent(rules, "unknown", 26), null);
  assert.equal(getDiscountSchedulePercent(rules, "master", 0), null);
  assert.equal(getDiscountSchedulePercent(rules, "master", 32), null);
  assert.equal(getDiscountSchedulePercent(rules, "master", "not-a-day"), null);
});

test("admin content review sends the selected decision and note to the backend", async () => {
  let call;
  const client = {
    rpc: async (...args) => {
      call = args;
      return { error: null };
    },
  };

  await reviewCommercialItem(client, "store_product", "product-id", "approved", "Revisado");

  assert.deepEqual(call, ["fortalfy_admin_review_commercial_content", {
    p_target_kind: "store_product",
    p_target_id: "product-id",
    p_status: "approved",
    p_reviewer_note: "Revisado",
  }]);
});

test("admin commercial data maps content queue and audit results correctly", async () => {
  const rows = {
    fortalfy_admin_list_commercial_businesses: [{ profile_id: "business" }],
    fortalfy_admin_list_commercial_reports: [{ id: "report" }],
    fortalfy_admin_list_commercial_content: [{ target_id: "content" }],
    fortalfy_discount_rules: [{ plan: "start" }],
    fortalfy_commercial_price_history: [{ id: "price", suspicious_increase: true }],
    fortalfy_commercial_audit: [{ id: "business-audit" }],
    fortalfy_commercial_moderation_audit: [{ id: "report-audit" }],
    fortalfy_discount_rule_audit: [{ id: "rule-audit" }],
    fortalfy_commercial_content_audit: [{ id: "content-audit" }],
  };
  const client = {
    rpc: async name => ({ data: rows[name], error: null }),
    from: name => {
      const result = { data: rows[name], error: null };
      const query = {
        select: () => query,
        order: () => query,
        limit: () => query,
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
      };
      return query;
    },
  };

  const data = await loadAdminCommercialData(client);

  assert.equal(data.businesses[0].profile_id, "business");
  assert.equal(data.reports[0].id, "report");
  assert.equal(data.commercialContent[0].target_id, "content");
  assert.equal(data.schedule[0].plan, "start");
  assert.equal(data.suspiciousPrices[0].id, "price");
  assert.equal(data.businessAudit[0].id, "business-audit");
  assert.equal(data.moderationAudit[0].id, "report-audit");
  assert.equal(data.ruleAudit[0].id, "rule-audit");
  assert.equal(data.commercialContentAudit[0].id, "content-audit");
});
