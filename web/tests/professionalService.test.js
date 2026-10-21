import test from "node:test";
import assert from "node:assert/strict";
import {
  loadProfessionalBookings, normalizeExternalUrl, PROFESSIONAL_CATEGORIES,
  professionalFieldsFor, saveSocialProfile, validateProfessionalApplication,
  validateProfileLinks,
} from "../src/professionalService.js";

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

test("all professional categories have category-specific application fields", () => {
  assert.equal(PROFESSIONAL_CATEGORIES.length, 8);
  assert.ok(professionalFieldsFor("nutricionista").some(field => field.id === "registrationRegion"));
  assert.ok(professionalFieldsFor("influenciador").some(field => field.id === "fitnessNiches"));
  assert.ok(professionalFieldsFor("restaurante").some(field => field.id === "cuisine"));
  assert.ok(professionalFieldsFor("academia").some(field => field.id === "operatingHours"));
  assert.deepEqual(professionalFieldsFor("unsupported"), []);
});

test("professional application validation requires category data and safe HTTPS links", () => {
  assert.ok(validateProfessionalApplication("nutricionista", {}).registrationNumber);
  assert.deepEqual(validateProfessionalApplication("personal", {
    displayName: "Coach",
    contactEmail: "coach@example.com",
    phone: "+5511999999999",
    city: "Fortaleza, CE",
    addressCountry: "Brasil",
    addressState: "Ceará",
    addressCity: "Fortaleza",
    addressNeighborhood: "Centro",
    addressStreet: "Rua Um",
    addressNumber: "10",
    addressPostalCode: "60000-000",
    addressType: "atendimento",
    description: "Atendimento personalizado",
    legalName: "Coach Silva",
    personDocument: "529.982.247-25",
    registrationNumber: "CREF 00000",
    specialties: "Musculação",
    serviceModes: "Presencial",
  }), {});
  assert.equal(normalizeExternalUrl("javascript:alert(1)"), "");
  assert.equal(normalizeExternalUrl("http://example.com"), "");
  assert.equal(normalizeExternalUrl("https://user:pass@example.com"), "");
  assert.equal(normalizeExternalUrl("https://example.com"), "https://example.com/");
});

test("professional identity validation checks CPF and CNPJ digits", () => {
  const common = {
    displayName: "Negócio",
    contactEmail: "contato@example.com",
    phone: "+5511999999999",
    city: "Fortaleza, CE",
    addressCountry: "Brasil",
    addressState: "Ceará",
    addressCity: "Fortaleza",
    addressNeighborhood: "Centro",
    addressStreet: "Rua Um",
    addressNumber: "10",
    addressPostalCode: "60000-000",
    addressType: "comercial",
    description: "Empresa de exemplo",
    legalName: "Empresa de Exemplo Ltda",
    businessId: "11.222.333/0001-81",
    representativeName: "Ana Silva",
    representativeDocument: "529.982.247-25",
    category: "Bem-estar",
  };
  assert.deepEqual(validateProfessionalApplication("empresa", common), {});
  assert.match(validateProfessionalApplication("empresa", { ...common, businessId: "11.222.333/0001-80" }).businessId, /CNPJ válido/);
  assert.match(validateProfessionalApplication("empresa", { ...common, representativeDocument: "111.111.111-11" }).representativeDocument, /CPF válido/);
});

test("profile links enforce size, labels, types, HTTPS and no fake verified status", () => {
  assert.equal(validateProfileLinks([{ label: "Instagram", url: "https://instagram.com/test", type: "social" }]), "");
  assert.match(validateProfileLinks([{ label: "Site", url: "javascript:alert(1)", type: "official" }]), /HTTPS/);
  assert.match(validateProfileLinks([{ label: "", url: "https://example.com", type: "other" }]), /nome válido/);
  assert.match(validateProfileLinks(Array.from({ length: 9 }, (_, index) => ({
    label: `Link ${index}`,
    url: `https://example${index}.com`,
    type: "other",
  }))), /até oito/);
  assert.match(validateProfileLinks([{ label: "Site", url: "https://example.com", type: "verified" }]), /tipo válido/);
});

test("saving a profile and links uses the atomic authenticated Supabase RPC", async () => {
  let call;
  const client = {
    rpc(name, args) {
      call = { name, args };
      return Promise.resolve({ error: null });
    },
  };
  await saveSocialProfile(client, {
    id: "user-1",
    name: "Profissional",
    username: "profissional",
    bio: "Atendimento online",
    city: "Fortaleza, CE",
    isPrivate: false,
  }, [{ label: "Meu site", url: "https://example.com", type: "official", isPublic: true }]);

  assert.equal(call.name, "update_fortalfy_profile_with_links");
  assert.equal(call.args.p_display_name, "Profissional");
  assert.equal(call.args.p_bio, "Atendimento online");
  assert.deepEqual(call.args.p_links, [{
    label: "Meu site",
    url: "https://example.com/",
    link_type: "official",
    is_public: true,
  }]);
});
