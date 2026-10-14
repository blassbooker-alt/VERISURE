import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.NEXT_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || "";
const publishableKey = import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || "";

export const isSupabaseConfigured = Boolean(url && publishableKey);
export const supabaseConfigError = isSupabaseConfigured
  ? ""
  : "Configure a URL e a chave pública do Supabase para ativar a comunidade.";

export const supabase = isSupabaseConfigured
  ? createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  })
  : null;
