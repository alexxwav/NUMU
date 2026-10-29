import { createClient } from '@supabase/supabase-js';

// Solo URL y clave pública (anon/publishable). Nunca usar service_role en el frontend.
const env = import.meta.env ?? {};
const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase no está configurado: define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.local');
  }
  return supabase;
}
