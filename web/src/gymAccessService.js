export const CHECKIN_FAILURE_MESSAGES = Object.freeze({
  plate_not_found: "Esta placa não foi encontrada. Confira o QR Code com a equipe da academia.",
  plate_or_academy_inactive: "Esta placa ou academia está desativada e não pode iniciar acessos.",
  no_eligible_membership: "Não encontramos uma assinatura FortalPass elegível para esta conta.",
  no_active_gym_contract: "Esta unidade ainda não tem um contrato de acesso vigente aprovado pela Fortalfy.",
  outside_location_radius: "Sua localização não está dentro da área configurada para esta unidade.",
  daily_access_already_recorded: "Você já registrou um acesso nesta unidade hoje.",
  active_visit_exists: "Finalize primeiro o acesso que ainda está em andamento em outra unidade.",
});

export function getCheckinFailureMessage(reason) {
  return CHECKIN_FAILURE_MESSAGES[reason] || "O servidor não autorizou este acesso. Nenhum crédito foi gerado.";
}

export function buildPlateUrl(origin, publicId, method = "qr") {
  if (!origin || !publicId || !["qr", "nfc"].includes(method)) {
    throw new TypeError("A origem, a identificação pública da placa e o meio de acesso são obrigatórios.");
  }
  const base = new URL(origin);
  if (base.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(base.hostname)) {
    throw new Error("A placa exige um endereço HTTPS válido antes de gerar QR ou programar NFC.");
  }
  return `${base.origin}${base.pathname.replace(/\/?$/, "/")}#/checkin/${encodeURIComponent(publicId)}?via=${method}`;
}

export async function loadPublicPlate(client, publicId) {
  const { data, error } = await client.rpc("fortalfy_plate_public_info", { p_public_id: publicId });
  if (error) throw error;
  return data;
}

export async function loadAdminGymListings(client) {
  const { data, error } = await client.rpc("fortalfy_admin_gym_listings");
  if (error) throw error;
  return data || [];
}

export async function loadAdminGymUnits(client) {
  const { data, error } = await client.rpc("fortalfy_admin_gym_units");
  if (error) throw error;
  return data || [];
}

export async function loadAdminGymPlates(client) {
  const { data, error } = await client.rpc("fortalfy_admin_gym_plates");
  if (error) throw error;
  return data || [];
}

export async function loadAdminPlateHistory(client, plateId) {
  const { data, error } = await client.rpc("fortalfy_admin_gym_plate_history", { p_plate_id: plateId });
  if (error) throw error;
  return data || [];
}

export async function createGymUnit(client, values) {
  const { data, error } = await client.rpc("fortalfy_admin_create_gym_unit", {
    p_profile_id: values.profileId,
    p_listing_id: values.listingId,
    p_unit_name: values.unitName,
    p_address: values.address,
    p_latitude: values.latitude,
    p_longitude: values.longitude,
    p_timezone_name: values.timezoneName,
    p_checkin_radius_m: values.checkinRadiusM,
  });
  if (error) throw error;
  if (!data) throw new Error("O servidor não retornou a unidade criada.");
  return data;
}

export async function createGymPlate(client, unitId, nfcTagLabel) {
  const { data, error } = await client.rpc("fortalfy_admin_create_gym_plate", {
    p_unit_id: unitId,
    p_nfc_tag_label: nfcTagLabel || null,
  });
  if (error) throw error;
  const plate = data?.[0];
  if (!plate?.plate_id || !plate.public_id) throw new Error("O servidor não retornou a placa criada.");
  return plate;
}

export async function createGymAccessContract(client, values) {
  const { data, error } = await client.rpc("fortalfy_admin_create_gym_access_contract", {
    p_unit_id: values.unitId,
    p_contract_reference: values.contractReference,
    p_valid_from: values.validFrom,
    p_valid_until: values.validUntil,
    p_notes: values.notes,
  });
  if (error) throw error;
  if (!data) throw new Error("O servidor não retornou o contrato registrado.");
  return data;
}

export async function setGymAccessContractStatus(client, { contractId, status, notes }) {
  const { error } = await client.rpc("fortalfy_admin_set_gym_access_contract_status", {
    p_contract_id: contractId,
    p_status: status,
    p_notes: notes,
  });
  if (error) throw error;
}

export async function recordGymPlateEvent(client, { plateId, eventType, notes, nfcTagLabel }) {
  const { error } = await client.rpc("fortalfy_admin_record_gym_plate_event", {
    p_plate_id: plateId,
    p_event_type: eventType,
    p_notes: notes,
    p_nfc_tag_label: nfcTagLabel || null,
  });
  if (error) throw error;
}

export async function setGymPlateStatus(client, { plateId, status, notes }) {
  const { error } = await client.rpc("fortalfy_admin_set_gym_plate_status", {
    p_plate_id: plateId,
    p_status: status,
    p_notes: notes,
  });
  if (error) throw error;
}
