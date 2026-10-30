import { createClient } from '@supabase/supabase-js';

// Solo URL y clave publishable (sb_publishable_...). Nunca usar claves secret ni service_role en el frontend.
const env = import.meta.env ?? {};
const url = env.VITE_SUPABASE_URL;
const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && publishableKey);

export const supabase = isSupabaseConfigured
  ? createClient(url, publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase no está configurado: define VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en .env.local');
  }
  return supabase;
}
