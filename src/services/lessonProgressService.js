import { requireSupabase } from '../lib/supabase.js';
import { profileService } from './profileService.js';
import { clampStars, sumStars } from '../utils/stars.js';

// Progreso por lección del proyecto "numu":
//   progreso_leccion(usuario_id, leccion_id, estrellas, intentos, created_at, updated_at)
// con una fila por usuario y lección. El RPC registrar_resultado_leccion conserva
// la mejor puntuación (greatest) al repetir una lección.

const TABLE = 'progreso_leccion';
const RPC = 'registrar_resultado_leccion';

/** El RPC aún no está desplegado: se hace el guardado desde el cliente. */
function isMissingFunction(message = '') {
  return /could not find the function|PGRST202|function .* does not exist/i.test(message);
}

export function createLessonProgressService(getClient = requireSupabase, profiles = profileService) {
  return {
    /**
     * Estrellas guardadas del usuario con sesión.
     * @returns {Promise<{starsByLesson: Record<string, number>, totalStars: number, error: string|null}>}
     */
    async getLessonProgress() {
      const client = getClient();
      const { usuarioId, error: idError } = await profiles.currentUsuarioId();
      if (idError) return { starsByLesson: {}, totalStars: 0, error: idError };

      const { data, error } = await client
        .from(TABLE)
        .select('leccion_id, estrellas')
        .eq('usuario_id', usuarioId);
      if (error) return { starsByLesson: {}, totalStars: 0, error: error.message };

      const starsByLesson = {};
      for (const row of data ?? []) {
        if (!row?.leccion_id) continue;
        starsByLesson[row.leccion_id] = Math.max(starsByLesson[row.leccion_id] ?? 0, clampStars(row.estrellas));
      }
      return { starsByLesson, totalStars: sumStars(starsByLesson), error: null };
    },

    /**
     * Guarda el resultado de una lección conservando la mejor puntuación.
     * @param {Object} options
     * @param {string} options.lessonId - Id del catálogo editorial (src/data/lessonContent.json).
     * @param {number} options.stars - Estrellas ganadas (0 a 3).
     * @returns {Promise<{stars: number, error: string|null}>} Estrellas guardadas (la mejor).
     */
    async saveLessonResult({ lessonId, stars } = {}) {
      if (typeof lessonId !== 'string' || lessonId.trim() === '') {
        return { stars: 0, error: 'Falta el identificador de la lección.' };
      }
      if (!Number.isInteger(stars) || stars < 0 || stars > 3) {
        return { stars: 0, error: 'Las estrellas deben ser un entero entre 0 y 3.' };
      }

      const client = getClient();
      const { data, error } = await client.rpc(RPC, { p_leccion_id: lessonId, p_estrellas: stars });
      if (!error) return { stars: clampStars(data?.estrellas ?? stars), error: null };
      if (!isMissingFunction(error.message)) return { stars: 0, error: error.message };

      // Respaldo cuando el RPC no está desplegado: lectura + upsert con el máximo.
      const { usuarioId, error: idError } = await profiles.currentUsuarioId();
      if (idError) return { stars: 0, error: idError };

      const { data: current, error: readError } = await client
        .from(TABLE)
        .select('estrellas, intentos')
        .eq('usuario_id', usuarioId)
        .eq('leccion_id', lessonId)
        .maybeSingle();
      if (readError) return { stars: 0, error: readError.message };

      const best = Math.max(clampStars(current?.estrellas), stars);
      const { data: saved, error: writeError } = await client
        .from(TABLE)
        .upsert({
          usuario_id: usuarioId,
          leccion_id: lessonId,
          estrellas: best,
          intentos: (current?.intentos ?? 0) + 1,
        }, { onConflict: 'usuario_id,leccion_id' })
        .select()
        .single();
      if (writeError) return { stars: 0, error: writeError.message };
      return { stars: clampStars(saved?.estrellas ?? best), error: null };
    },
  };
}

export const lessonProgressService = createLessonProgressService();
