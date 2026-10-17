export const emptyActivity = () => ({
  waterMl: 0,
  workoutsLogged: 0,
  workoutEntries: [],
  mealEntries: [],
});

export async function loadAccountActivity(client) {
  if (!client) throw new Error("A conexão com a conta não está configurada.");
  const { data, error } = await client.rpc("get_fortalfy_activity");
  if (error) throw error;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("O servidor retornou um formato de atividade inválido.");
  }
  return data;
}

export async function recordAccountActivity(client, kind, detail = null) {
  if (!client) throw new Error("A conexão com a conta não está configurada.");
  const { data, error } = await client.rpc("record_fortalfy_activity", {
    p_kind: kind,
    p_detail: detail,
  });
  if (error) throw error;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("O servidor não confirmou a gravação da atividade.");
  }
  return data;
}
