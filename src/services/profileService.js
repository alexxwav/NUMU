import { requireSupabase } from '../lib/supabase.js';

// Esquema de numu (tablas del equipo):
//   usuarios(id, correo, fecha_registro, auth_id)  → se crea solo al registrarse
//   perfil_usuario(usuario_id, nombre, apodo, edad, pais, grado_escolar, avatar, gemas, xp, intereses)
//   resultados_examen_diagnostico(usuario_id, num_aciertos, puntuacion, autoevaluacion, respuestas)
// Las reglas RLS solo dejan ver y cambiar las filas del usuario con sesión.

// Campos del perfil que se pueden guardar, con su columna en perfil_usuario.
const PROFILE_COLUMNS = {
  name: 'nombre',
  nickname: 'apodo',
  age: 'edad',
  country: 'pais',
  grade: 'grado_escolar',
  avatar: 'avatar',
  interests: 'intereses',
  gems: 'gemas',
  xp: 'xp',
};

export function pickProfileFields(patch = {}) {
  const clean = {};
  for (const [key, column] of Object.entries(PROFILE_COLUMNS)) {
    if (patch[key] !== undefined) clean[column] = patch[key];
  }
  if (clean.edad === '') clean.edad = null;
  else if (clean.edad != null) clean.edad = Number(clean.edad);
  return clean;
}

/** Convierte una fila de perfil_usuario a la forma que usa la app. Sin fila = cuestionario pendiente. */
export function fromProfileRow(row) {
  if (!row) return null;
  return {
    name: row.nombre ?? '',
    nickname: row.apodo ?? '',
    age: row.edad ?? '',
    country: row.pais ?? '',
    grade: row.grado_escolar ?? '',
    avatar: row.avatar ?? 0,
    interests: row.intereses ?? [],
    gems: row.gemas ?? 0,
    xp: row.xp ?? 0,
    onboarding_completed: true,
  };
}

export function createProfileService(getClient = requireSupabase) {
  // id de la tabla usuarios del usuario con sesión (RLS solo devuelve su fila).
  async function currentUsuarioId() {
    const { data, error } = await getClient().from('usuarios').select('id').maybeSingle();
    if (error) return { usuarioId: null, error: error.message };
    if (!data) return { usuarioId: null, error: 'No se encontró el usuario de esta cuenta.' };
    return { usuarioId: data.id, error: null };
  }

  return {
    currentUsuarioId,

    async getProfile() {
      const { usuarioId, error: idError } = await currentUsuarioId();
      if (idError) return { profile: null, error: idError };
      const { data, error } = await getClient()
        .from('perfil_usuario')
        .select('*')
        .eq('usuario_id', usuarioId)
        .maybeSingle();
      return { profile: fromProfileRow(data), error: error ? error.message : null };
    },

    /** Crea o actualiza el perfil (hay uno por usuario). */
    async saveProfile(patch) {
      const fields = pickProfileFields(patch);
      if (Object.keys(fields).length === 0) return { profile: null, error: 'No hay campos para guardar.' };
      const { usuarioId, error: idError } = await currentUsuarioId();
      if (idError) return { profile: null, error: idError };
      const { data, error } = await getClient()
        .from('perfil_usuario')
        .upsert({ usuario_id: usuarioId, ...fields }, { onConflict: 'usuario_id' })
        .select()
        .single();
      return { profile: fromProfileRow(data), error: error ? error.message : null };
    },

    /**
     * Guarda un intento del diagnóstico del cuestionario inicial.
     * @param {object} result
     * @param {Array<number|null>} result.answers - Índice elegido por pregunta.
     * @param {number} result.score - Aciertos.
     * @param {number} result.total - Número de preguntas.
     * @param {'none'|'some'|'much'|null} [result.selfLevel] - Autoevaluación.
     */
    async saveDiagnostic({ answers, score, total, selfLevel = null }) {
      const { usuarioId, error: idError } = await currentUsuarioId();
      if (idError) return { diagnostic: null, error: idError };
      const { data, error } = await getClient()
        .from('resultados_examen_diagnostico')
        .insert({
          usuario_id: usuarioId,
          num_aciertos: score,
          puntuacion: total ? Math.round((score / total) * 100) : 0,
          autoevaluacion: selfLevel,
          respuestas: answers,
        })
        .select()
        .single();
      return { diagnostic: data ? { score: data.num_aciertos, self_level: data.autoevaluacion } : null, error: error ? error.message : null };
    },

    async getLatestDiagnostic() {
      const { usuarioId, error: idError } = await currentUsuarioId();
      if (idError) return { diagnostic: null, error: idError };
      const { data, error } = await getClient()
        .from('resultados_examen_diagnostico')
        .select('num_aciertos, autoevaluacion')
        .eq('usuario_id', usuarioId)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      return { diagnostic: data ? { score: data.num_aciertos, self_level: data.autoevaluacion } : null, error: error ? error.message : null };
    },
  };
}

export const profileService = createProfileService();
