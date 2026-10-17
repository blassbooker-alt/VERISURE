import test from "node:test";
import assert from "node:assert/strict";
import { emptyActivity, loadAccountActivity, recordAccountActivity } from "../src/activityService.js";

test("empty account activity starts with no records", () => {
  assert.deepEqual(emptyActivity(), {
    waterMl: 0,
    workoutsLogged: 0,
    workoutEntries: [],
    mealEntries: [],
  });
});

test("load account activity reads only the authenticated-user RPC", async () => {
  const expected = { waterMl: 250, workoutsLogged: 1, workoutEntries: [], mealEntries: [] };
  let requestedFunction = "";
  const client = {
    rpc: async name => {
      requestedFunction = name;
      return { data: expected, error: null };
    },
  };
  assert.equal(await loadAccountActivity(client), expected);
  assert.equal(requestedFunction, "get_fortalfy_activity");
});

test("record activity sends the typed entry and returns server state", async () => {
  const expected = { waterMl: 250, workoutsLogged: 1, workoutEntries: [], mealEntries: [] };
  let request;
  const client = {
    rpc: async (name, args) => {
      request = { name, args };
      return { data: expected, error: null };
    },
  };
  const detail = { id: "meal-1", name: "Almoço", calories: 520, date: "2026-10-16" };
  assert.equal(await recordAccountActivity(client, "meal", detail), expected);
  assert.deepEqual(request, {
    name: "record_fortalfy_activity",
    args: { p_kind: "meal", p_detail: detail },
  });
});

test("activity service surfaces backend and malformed-response errors", async () => {
  const backendError = new Error("not authorized");
  await assert.rejects(loadAccountActivity({ rpc: async () => ({ data: null, error: backendError }) }), backendError);
  await assert.rejects(
    recordAccountActivity({ rpc: async () => ({ data: null, error: null }) }, "water"),
    /não confirmou a gravação/i,
  );
});
