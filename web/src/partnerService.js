import { signMedia } from "./socialService.js";

const PARTNER_KINDS = new Set(["personal", "nutricionista", "academia"]);

function mapListing(row) {
  if (!row?.profile) return null;
  const latitude = row.latitude == null || row.latitude === "" ? null : Number(row.latitude);
  const longitude = row.longitude == null || row.longitude === "" ? null : Number(row.longitude);
  return {
    id: row.id,
    profileId: row.profile_id,
    name: row.profile.display_name,
    username: row.profile.username || "",
    kind: row.profile.kind,
    city: row.profile.city || "",
    bio: row.profile.bio || "",
    avatar: row.profile.avatar_path || "",
    isPrivate: Boolean(row.profile.is_private),
    verified: Boolean(row.profile.partner_approved_at),
    address: row.address,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    modalities: Array.isArray(row.modalities) ? row.modalities : [],
    openingHours: row.opening_hours || {},
    websiteUrl: row.website_url || "",
    contactPhone: row.contact_phone || "",
  };
}

export function distanceKm(from, to) {
  const coordinates = [from?.latitude, from?.longitude, to?.latitude, to?.longitude];
  if (!coordinates.every(Number.isFinite)
      || Math.abs(from.latitude) > 90 || Math.abs(to.latitude) > 90
      || Math.abs(from.longitude) > 180 || Math.abs(to.longitude) > 180) return null;
  const radians = degrees => degrees * Math.PI / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function openStreetMapUrl(listing) {
  if (!Number.isFinite(listing?.latitude) || !Number.isFinite(listing?.longitude)) return "";
  return `https://www.openstreetmap.org/?mlat=${listing.latitude}&mlon=${listing.longitude}#map=16/${listing.latitude}/${listing.longitude}`;
}

export async function loadApprovedPartners(client, { kind = "" } = {}) {
  if (!client) throw new Error("O serviço de parceiros está indisponível.");
  if (kind && !PARTNER_KINDS.has(kind)) throw new Error("Categoria de parceiro inválida.");

  let query = client.from("partner_listings").select(`
    id,profile_id,address,latitude,longitude,modalities,opening_hours,website_url,contact_phone,
    profile:profiles!partner_listings_profile_id_fkey(id,display_name,username,kind,city,bio,avatar_path,is_private,partner_approved_at)
  `).order("created_at", { ascending: false }).limit(100);
  if (kind) query = query.eq("profile.kind", kind);

  const { data, error } = await query;
  if (error) throw error;
  const listings = (data || [])
    .map(mapListing)
    .filter(listing => listing?.verified && !listing.isPrivate && PARTNER_KINDS.has(listing.kind));
  return Promise.all(listings.map(async listing => ({
    ...listing,
    avatar: await signMedia(client, listing.avatar),
  })));
}

export async function loadApprovedPartnerProfile(client, profileId) {
  if (!client || !profileId) return null;
  const { data, error } = await client.from("partner_listings").select(`
    id,profile_id,address,latitude,longitude,modalities,opening_hours,website_url,contact_phone,
    profile:profiles!partner_listings_profile_id_fkey(id,display_name,username,kind,city,bio,avatar_path,is_private,partner_approved_at)
  `).eq("profile_id", profileId).maybeSingle();
  if (error) throw error;
  const listing = mapListing(data);
  if (!listing?.verified || listing.isPrivate || !PARTNER_KINDS.has(listing.kind)) return null;
  return { ...listing, avatar: await signMedia(client, listing.avatar) };
}

export async function loadOwnPartnerListing(client, userId) {
  if (!client || !userId) throw new Error("Entre na sua conta para gerenciar seu perfil de parceiro.");
  const { data, error } = await client.from("partner_listings").select(`
    id,profile_id,address,latitude,longitude,modalities,opening_hours,website_url,contact_phone,
    profile:profiles!partner_listings_profile_id_fkey(id,display_name,username,kind,city,bio,avatar_path,is_private,partner_approved_at)
  `).eq("profile_id", userId).maybeSingle();
  if (error) throw error;
  return mapListing(data);
}

export async function savePartnerListing(client, userId, fields) {
  if (!client || !userId) throw new Error("Entre na sua conta para cadastrar seu estabelecimento ou serviço.");
  const address = fields.address?.trim() || "";
  const latitude = Number(fields.latitude);
  const longitude = Number(fields.longitude);
  const modalities = [...new Set((fields.modalities || []).map(item => item.trim()).filter(Boolean))];
  if (address.length < 3 || address.length > 300) throw new Error("Informe um endereço válido.");
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
      || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error("Informe coordenadas válidas para localizar o parceiro.");
  }
  const websiteUrl = fields.websiteUrl?.trim() || null;
  if (websiteUrl) {
    let url;
    try {
      url = new URL(websiteUrl);
    } catch {
      throw new Error("Informe uma URL válida para o site.");
    }
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("O endereço do site deve começar com http:// ou https://.");
  }
  const { data, error } = await client.from("partner_listings").upsert({
    profile_id: userId,
    address,
    latitude,
    longitude,
    modalities,
    opening_hours: fields.openingHours || {},
    website_url: websiteUrl,
    contact_phone: fields.contactPhone?.trim() || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "profile_id" }).select("id,profile_id,address,latitude,longitude,modalities,opening_hours,website_url,contact_phone").single();
  if (error) throw error;
  return data;
}

export function orderPartnersByDistance(partners, location) {
  return [...partners]
    .map(partner => ({ ...partner, distanceKm: location ? distanceKm(location, partner) : null }))
    .sort((left, right) => {
      if (left.distanceKm == null) return right.distanceKm == null ? left.name.localeCompare(right.name) : 1;
      if (right.distanceKm == null) return -1;
      return left.distanceKm - right.distanceKm;
    });
}
