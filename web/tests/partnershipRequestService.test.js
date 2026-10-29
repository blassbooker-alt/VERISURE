import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  loadOwnPartnershipRequest, PARTNERSHIP_REQUEST_STATUSES, reviewPartnershipRequest,
  savePartnershipRequest, submitPartnershipRequest, validatePartnershipRequest,
} from "../src/partnershipRequestService.js";

const validRequest = {
  business_goals: "Ampliar o conhecimento do negócio entre pessoas que treinam.",
  products_or_services: "Divulgar serviços e produtos já oferecidos pelo estabelecimento.",
  promotion_interest: true,
  marketing_interest: false,
  commercial_interest: true,
  additional_information: "",
};

test("partnership requests require a clear offer and explicit interest choices", () => {
  assert.deepEqual(validatePartnershipRequest(validRequest), {});
  assert.match(validatePartnershipRequest({ ...validRequest, business_goals: "curto" }).business_goals, /10 caracteres/);
  assert.match(validatePartnershipRequest({ ...validRequest, marketing_interest: undefined }).marketing_interest, /Informe se há interesse/);
  assert.match(PARTNERSHIP_REQUEST_STATUSES.under_review, /análise/);
});

test("partnership request persistence uses server procedures and reloads confirmed state", async () => {
  const calls = [];
  const row = { id: "request-1", application_id: "application-1", status: "under_review" };
  const client = {
    rpc: async (name, params) => { calls.push({ name, params }); return { data: name.startsWith("save_") ? row.id : row.status, error: null }; },
    from: table => {
      assert.equal(table, "professional_partnership_requests");
      const query = {
        select(columns) { calls.push({ columns }); return this; },
        eq(column, value) { calls.push({ column, value }); return this; },
        maybeSingle: async () => ({ data: row, error: null }),
      };
      return query;
    },
  };

  assert.equal(await savePartnershipRequest(client, "profile-1", "application-1", validRequest), "request-1");
  assert.equal(await submitPartnershipRequest(client, "request-1"), "under_review");
  assert.equal((await loadOwnPartnershipRequest(client, "application-1")).status, "under_review");
  assert.deepEqual(calls.map(call => call.name).filter(Boolean), ["save_fortalfy_partnership_request", "submit_fortalfy_partnership_request"]);
  assert.equal(calls[0].params.p_request_data.products_or_services, validRequest.products_or_services);
});

test("admin partnership decisions require a reason and call the authorization RPC", async () => {
  const calls = [];
  const client = { rpc: async (name, params) => { calls.push({ name, params }); return { data: params.p_status, error: null }; } };
  await assert.rejects(() => reviewPartnershipRequest(client, "request-1", "approved", "  "), /motivo/);
  assert.equal(await reviewPartnershipRequest(client, "request-1", "correction_required", "Inclua a comprovação do canal comercial."), "correction_required");
  assert.equal(calls[0].name, "review_fortalfy_partnership_request");
});

test("partnership migration keeps decisions server-controlled and audit readable by admins only", async () => {
  const migrationPath = fileURLToPath(new URL("../../supabase/migrations/20261028190000_professional_partnership_requests.sql", import.meta.url));
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /alter table public\.professional_partnership_requests enable row level security/i);
  assert.match(sql, /revoke all on public\.professional_partnership_requests from anon, authenticated/i);
  assert.match(sql, /only an authorized fortalfy administrator can review partnership requests/i);
  assert.match(sql, /professional_partnership_request_audit/i);
  assert.doesNotMatch(sql, /grant\s+(insert|update|delete).*professional_partnership_requests/i);
});
