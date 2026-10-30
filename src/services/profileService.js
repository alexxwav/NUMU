import { requireSupabase } from '../lib/supabase.js';

// Campos que el estudiante puede editar; coinciden con el perfil de store.js.
const EDITABLE_FIELDS = ['nickname', 'name', 'age', 'country', 'grade', 'avatar', 'interests', 'onboarding_completed'];

export function pickProfileFields(patch = {}) {
  const clean = {};
  for (const key of EDITABLE_FIELDS) {
    if (patch[key] !== undefined) clean[key] = patch[key];
  }
  if (clean.age !== undefined && clean.age !== null && clean.age !== '') clean.age = Number(clean.age);
  if (clean.age === '') clean.age = null;
  return clean;
}

export function createProfileService(getClient = requireSupabase) {
  return {
    async getProfile(userId) {
      const { data, error } = await getClient()
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      return { profile: data ?? null, error: error ? error.message : null };
    },

    async updateProfile(userId, patch) {
      const fields = pickProfileFields(patch);
      if (Object.keys(fields).length === 0) return { profile: null, error: 'No hay campos para actualizar.' };
      const { data, error } = await getClient()
        .from('profiles')
        .update(fields)
        .eq('id', userId)
        .select()
        .single();
      return { profile: data ?? null, error: error ? error.message : null };
    },

    /**
     * Guarda un intento del diagnóstico de LoginView.jsx.
     * @param {object} result
     * @param {string} result.userId
     * @param {Array<number|null>} result.answers - Índice elegido por pregunta.
     * @param {number} result.score - Aciertos.
     * @param {number} result.total - Número de preguntas.
     * @param {'none'|'some'|'much'|null} [result.selfLevel] - Autoevaluación.
     */
    async saveDiagnostic({ userId, answers, score, total, selfLevel = null }) {
      const { data, error } = await getClient()
        .from('diagnostic_results')
        .insert({ user_id: userId, answers, score, total, self_level: selfLevel })
        .select()
        .single();
      return { diagnostic: data ?? null, error: error ? error.message : null };
    },

    async getLatestDiagnostic(userId) {
      const { data, error } = await getClient()
        .from('diagnostic_results')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return { diagnostic: data ?? null, error: error ? error.message : null };
    },
  };
}

export const profileService = createProfileService();
