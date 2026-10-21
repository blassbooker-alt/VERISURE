import test from "node:test";
import assert from "node:assert/strict";
import {
  applyToCreatorCampaign, createCreatorCourse, enrollFreeCreatorCourse,
  registerCreatorLive, reviewCreatorCampaignApplication,
} from "../src/creatorProgramService.js";

function clientWithRpc(result = { data: "ok", error: null }) {
  const calls = [];
  return {
    calls,
    rpc: async (name, args) => { calls.push({ name, args }); return result; },
  };
}

test("free course enrollment is delegated to the server RPC", async () => {
  const client = clientWithRpc({ data: "enrollment-id", error: null });
  assert.equal(await enrollFreeCreatorCourse(client, "course-id"), "enrollment-id");
  assert.deepEqual(client.calls, [{ name: "enroll_free_creator_course", args: { p_course_id: "course-id" } }]);
});

test("live registration and campaign application use authorization RPCs", async () => {
  const client = clientWithRpc();
  await registerCreatorLive(client, "live-id");
  await applyToCreatorCampaign(client, "campaign-id", "Minha apresentação");
  assert.deepEqual(client.calls.map(call => call.name), ["register_creator_live", "apply_to_creator_campaign"]);
  assert.equal(client.calls[1].args.p_message, "Minha apresentação");
});

test("campaign decisions reject statuses outside the administrative workflow", async () => {
  const client = clientWithRpc();
  await assert.rejects(reviewCreatorCampaignApplication(client, "application-id", "approved"), /decisão/i);
  assert.equal(client.calls.length, 0);
});

test("course creation validates amounts before accessing the backend", async () => {
  const client = { from() { throw new Error("must not reach database"); } };
  await assert.rejects(createCreatorCourse(client, "profile-id", { title: "Curso", summary: "", priceCents: -10 }), /preço/i);
});
