import test from "node:test";
import assert from "node:assert/strict";
import {
  distanceKm, loadApprovedPartnerProfile, loadApprovedPartners, openStreetMapUrl, orderPartnersByDistance,
  savePartnerListing,
} from "../src/partnerService.js";

test("partner distance uses supplied coordinates and sorts nearest first", () => {
  const origin = { latitude: -3.7319, longitude: -38.5267 };
  const nearby = { name: "Perto", latitude: -3.732, longitude: -38.527 };
  const farther = { name: "Longe", latitude: -3.75, longitude: -38.55 };
  assert.ok(distanceKm(origin, nearby) < distanceKm(origin, farther));
  assert.deepEqual(orderPartnersByDistance([farther, nearby], origin).map(item => item.name), ["Perto", "Longe"]);
  assert.equal(distanceKm(origin, { latitude: 91, longitude: -38 }), null);
});

test("OpenStreetMap links include only the partner's actual coordinates", () => {
  assert.equal(
    openStreetMapUrl({ latitude: -3.73, longitude: -38.52 }),
    "https://www.openstreetmap.org/?mlat=-3.73&mlon=-38.52#map=16/-3.73/-38.52",
  );
  assert.equal(openStreetMapUrl({ latitude: NaN, longitude: -38.52 }), "");
});

test("approved discovery filters unapproved and non-partner profiles from backend rows", async () => {
  const rows = [
    {
      id: "listing-1", profile_id: "user-1", address: "Rua A", latitude: -3.73, longitude: -38.52,
      modalities: ["Musculação"], profile: { display_name: "Academia Real", kind: "academia", partner_approved_at: "2026-10-01" },
    },
    {
      id: "listing-2", profile_id: "user-2", address: "Rua B", latitude: -3.74, longitude: -38.53,
      modalities: [], profile: { display_name: "Pendente", kind: "personal", partner_approved_at: null },
    },
    {
      id: "listing-3", profile_id: "user-3", address: "Rua C", latitude: -3.74, longitude: -38.53,
      modalities: [], profile: { display_name: "Pessoa", kind: "cliente", partner_approved_at: "2026-10-01" },
    },
    {
      id: "listing-4", profile_id: "user-4", address: "Rua D", latitude: -3.74, longitude: -38.53,
      modalities: [], profile: { display_name: "Perfil privado", kind: "personal", is_private: true, partner_approved_at: "2026-10-01" },
    },
  ];
  const client = {
    from(table) {
      assert.equal(table, "partner_listings");
      let kindFilter = "";
      const builder = {
        select() { return this; },
        eq(column, value) { assert.equal(column, "profile.kind"); kindFilter = value; return this; },
        order() { return this; },
        limit() { return this; },
        then(resolve, reject) { return Promise.resolve({ data: rows.filter(row => !kindFilter || row.profile.kind === kindFilter), error: null }).then(resolve, reject); },
      };
      return builder;
    },
  };

  const result = await loadApprovedPartners(client);
  assert.equal(result.length, 1);
  assert.equal(result[0].name, "Academia Real");
  assert.equal(result[0].verified, true);
  assert.equal(result.some(item => item.name === "Perfil privado"), false);
  const personalDirectory = await loadApprovedPartners(client, { kind: "personal" });
  assert.deepEqual(personalDirectory, [], "private profiles remain hidden in the Personal directory");
});

test("partners without coordinates do not resolve to the Null Island map location", async () => {
  const client = {
    from() {
      const builder = {
        select() { return this; },
        order() { return this; },
        limit() { return this; },
        then(resolve, reject) {
          return Promise.resolve({
            data: [{
              id: "listing-no-location",
              profile_id: "user-no-location",
              latitude: null,
              longitude: null,
              profile: { display_name: "Parceiro sem localização", kind: "academia", partner_approved_at: "2026-10-01" },
            }],
            error: null,
          }).then(resolve, reject);
        },
      };
      return builder;
    },
  };

  const [partner] = await loadApprovedPartners(client);
  assert.equal(partner.latitude, null);
  assert.equal(partner.longitude, null);
  assert.equal(openStreetMapUrl(partner), "");
});

test("public professional profile resolves only an approved partner listing", async () => {
  let requestedId = "";
  const client = {
    from(table) {
      assert.equal(table, "partner_listings");
      const builder = {
        select() { return this; },
        eq(column, value) { assert.equal(column, "profile_id"); requestedId = value; return this; },
        maybeSingle() { return Promise.resolve({ data: {
          id: "listing-real", profile_id: "personal-real", address: "Private full address",
          modalities: ["Treino funcional"], opening_hours: {}, profile: {
            display_name: "Profissional aprovado", kind: "personal", city: "Fortaleza", bio: "Apresentação real",
            partner_approved_at: "2026-10-01T12:00:00Z",
          },
        }, error: null }); },
      };
      return builder;
    },
  };
  const partner = await loadApprovedPartnerProfile(client, "personal-real", { kind: "personal" });
  assert.equal(requestedId, "personal-real");
  assert.equal(partner.name, "Profissional aprovado");
  assert.equal(partner.kind, "personal");
  assert.equal(partner.verified, true);
  assert.equal(partner.address, "Private full address"); // available to the component for filtering, not rendered on its public page

  const unapprovedClient = {
    from() { return { select() { return this; }, eq() { return this; }, maybeSingle() { return Promise.resolve({ data: {
      profile_id: "pending", profile: { display_name: "Pendente", kind: "nutricionista", partner_approved_at: null },
    }, error: null }); } }; },
  };
  assert.equal(await loadApprovedPartnerProfile(unapprovedClient, "pending", { kind: "nutricionista" }), null);
  assert.equal(await loadApprovedPartnerProfile(client, "personal-real", { kind: "nutricionista" }), null);
});

test("partner listing validation rejects invented or malformed location input before write", async () => {
  const client = { from() { throw new Error("Invalid listing must not reach the backend"); } };
  await assert.rejects(savePartnerListing(client, "user-1", {
    address: "Rua Real",
    latitude: "91",
    longitude: "-38",
    modalities: [],
  }), /coordenadas válidas/);
});
