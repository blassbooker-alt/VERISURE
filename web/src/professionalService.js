import { mapProfile, signMedia } from "./socialService.js";

export async function loadProfessionalBookings(client, professionalId) {
  if (!client) throw new Error("A conexão com o Supabase não está configurada.");
  if (!professionalId || professionalId.startsWith("demo-") || professionalId.startsWith("local-")) {
    throw new Error("Entre com uma conta profissional real para consultar os agendamentos.");
  }

  const { data, error } = await client.from("bookings").select(`
    id,customer_id,professional_id,starts_at,modality,status,created_at,
    customer:profiles!bookings_customer_id_fkey(id,display_name,username,avatar_path,kind,verified_at,partner_approved_at,is_private)
  `)
    .eq("professional_id", professionalId)
    .order("starts_at", { ascending: true })
    .limit(100);
  if (error) throw error;

  return Promise.all((data || []).map(async row => {
    const customer = mapProfile(row.customer);
    if (!customer) throw new Error("Um agendamento não possui um perfil de cliente válido.");
    return {
      id: row.id,
      customer: { ...customer, avatar: await signMedia(client, customer.avatar) },
      startsAt: row.starts_at,
      modality: row.modality,
      status: row.status,
      createdAt: row.created_at,
    };
  }));
}
