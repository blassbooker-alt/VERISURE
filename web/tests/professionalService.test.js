import test from "node:test";
import assert from "node:assert/strict";
import { loadProfessionalBookings } from "../src/professionalService.js";

function query(result) {
  return {
    select() { return this; },
    eq() { return this; },
    order() { return this; },
    limit() { return this; },
    then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
  };
}

test("professional bookings come from the authenticated provider's Supabase records", async () => {
  let filters;
  const client = {
    from(table) {
      assert.equal(table, "bookings");
      return {
        ...query({
          data: [{
            id: "booking-1",
            customer_id: "customer-1",
            professional_id: "professional-1",
            starts_at: "2026-10-20T13:00:00Z",
            modality: "online",
            status: "confirmada",
            created_at: "2026-10-14T12:00:00Z",
            customer: { id: "customer-1", display_name: "Ana", avatar_path: "customer-1/profile/avatar.jpg" },
          }],
          error: null,
        }),
        eq(column, value) { filters = { column, value }; return this; },
      };
    },
    storage: {
      from(bucket) {
        assert.equal(bucket, "social-media");
        return { createSignedUrl: async path => ({ data: { signedUrl: `signed:${path}` }, error: null }) };
      },
    },
  };

  const [booking] = await loadProfessionalBookings(client, "professional-1");
  assert.deepEqual(filters, { column: "professional_id", value: "professional-1" });
  assert.equal(booking.customer.name, "Ana");
  assert.equal(booking.customer.avatar, "signed:customer-1/profile/avatar.jpg");
  assert.equal(booking.status, "confirmada");
  assert.equal(booking.modality, "online");
});

test("professional bookings reject local or missing accounts before querying", async () => {
  let queried = false;
  const client = { from() { queried = true; } };
  await assert.rejects(loadProfessionalBookings(client, "local-user"), /conta profissional real/);
  await assert.rejects(loadProfessionalBookings(client, ""), /conta profissional real/);
  assert.equal(queried, false);
});
