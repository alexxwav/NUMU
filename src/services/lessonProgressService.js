import { requireSupabase } from '../lib/supabase.js';
import { profileService } from './profileService.js';
import { clampStars, sumStars } from '../utils/stars.js';
import { clampLessonLevel, MIN_LESSON_LEVEL, MAX_LESSON_LEVEL } from '../utils/lessonLevel.js';

// Progreso por lección del proyecto "numu":
//   progreso_leccion(usuario_id, leccion_id, estrellas, intentos, created_at, updated_at)
// con una fila por usuario y lección. El RPC registrar_resultado_leccion conserva
// la mejor puntuación (greatest) al repetir una lección.
// Con supabase/propuesta_ultima_ronda.sql (preparada, aún NO aplicada) la fila guarda además
// ultimas_estrellas, ultimo_intento y nivel (nivel académico de la lección, 1 a 3), y el RPC
// recibe p_nivel. Mientras no se aplique, el servicio usa las columnas y la firma de siempre.

const TABLE = 'progreso_leccion';
const RPC = 'registrar_resultado_leccion';

const FULL_COLUMNS = 'leccion_id, estrellas, intentos, ultimas_estrellas, nivel, ultimo_intento';
const BASE_COLUMNS = 'leccion_id, estrellas, intentos';

/** La migración de última ronda / nivel aún no está aplicada (columna inexistente). */
function isMissingColumn(message = '') {
  return /column .* does not exist|could not find the .* column|42703|PGRST204/i.test(message);
}

/** El RPC aún no está desplegado: se hace el guardado desde el cliente. */
function isMissingFunction(message = '') {
  return /could not find the function|PGRST202|function .* does not exist/i.test(message);
}

export function createLessonProgressService(getClient = requireSupabase, profiles = profileService) {
  const empty = (error) => ({
    starsByLesson: {}, latestStarsByLesson: {}, levelByLesson: {}, attemptsByLesson: {}, rounds: {}, totalStars: 0, error,
  });

  return {
    /**
     * Progreso guardado del usuario con sesión, por lección.
     * · starsByLesson: mejor puntuación. · latestStarsByLesson: última ronda (si ya se guarda).
     * · levelByLesson: nivel académico guardado (si ya se guarda). · attemptsByLesson: rondas.
     * · rounds: { latestStars, level, at } para combinar con el dispositivo sin perder lo reciente.
     */
    async getLessonProgress() {
      const client = getClient();
      const { usuarioId, error: idError } = await profiles.currentUsuarioId();
      if (idError) return empty(idError);

      const read = (columns) => client.from(TABLE).select(columns).eq('usuario_id', usuarioId);
      let { data, error } = await read(FULL_COLUMNS);
      if (error && isMissingColumn(error.message)) ({ data, error } = await read(BASE_COLUMNS));
      if (error) return empty(error.message);

      const result = empty(null);
      for (const row of data ?? []) {
        const id = row?.leccion_id;
        if (!id) continue;
        result.starsByLesson[id] = Math.max(result.starsByLesson[id] ?? 0, clampStars(row.estrellas));
        if (Number.isInteger(row.intentos)) result.attemptsByLesson[id] = row.intentos;
        const latest = row.ultimas_estrellas ?? null;
        const level = row.nivel ?? null;
        if (latest !== null) result.latestStarsByLesson[id] = clampStars(latest);
        if (level !== null) result.levelByLesson[id] = clampLessonLevel(level);
        if (latest !== null || level !== null) {
          result.rounds[id] = {
            latestStars: latest === null ? null : clampStars(latest),
            level: level === null ? null : clampLessonLevel(level),
            at: row.ultimo_intento ?? null,
          };
        }
      }
      result.totalStars = sumStars(result.starsByLesson);
      return result;
    },

    /**
     * Guarda el resultado de una lección conservando la mejor puntuación.
     * @param {Object} options
     * @param {string} options.lessonId - Id del catálogo editorial (src/data/lessonContent.json).
     * @param {number} options.stars - Estrellas ganadas (0 a 3).
     * @param {number} [options.level] - Nivel académico de la lección tras la ronda (1 a 3, R7–R10).
     * @returns {Promise<{stars: number, latestStars: number, level: number|null, error: string|null}>}
     */
    async saveLessonResult({ lessonId, stars, level } = {}) {
      const fail = (error) => ({ stars: 0, latestStars: 0, level: null, error });
      if (typeof lessonId !== 'string' || lessonId.trim() === '') {
        return fail('Falta el identificador de la lección.');
      }
      if (!Number.isInteger(stars) || stars < 0 || stars > 3) {
        return fail('Las estrellas deben ser un entero entre 0 y 3.');
      }
      const hasLevel = level !== undefined && level !== null;
      if (hasLevel && (!Number.isInteger(level) || level < MIN_LESSON_LEVEL || level > MAX_LESSON_LEVEL)) {
        return fail(`El nivel debe ser un entero entre ${MIN_LESSON_LEVEL} y ${MAX_LESSON_LEVEL}.`);
      }
      const done = (row, fallbackBest) => ({
        stars: clampStars(row?.estrellas ?? fallbackBest),
        latestStars: stars,
        level: row?.nivel ?? (hasLevel ? level : null),
        error: null,
      });

      const client = getClient();
      const args = { p_leccion_id: lessonId, p_estrellas: stars };
      let { data, error } = await client.rpc(RPC, hasLevel ? { ...args, p_nivel: level } : args);
      // Firma anterior (sin p_nivel): la migración aún no está aplicada.
      if (error && hasLevel && isMissingFunction(error.message)) ({ data, error } = await client.rpc(RPC, args));
      if (!error) return done(data, stars);
      if (!isMissingFunction(error.message)) return fail(error.message);

      // Respaldo cuando el RPC no está desplegado: lectura + upsert con el máximo.
      const { usuarioId, error: idError } = await profiles.currentUsuarioId();
      if (idError) return fail(idError);

      const { data: current, error: readError } = await client
        .from(TABLE)
        .select('estrellas, intentos')
        .eq('usuario_id', usuarioId)
        .eq('leccion_id', lessonId)
        .maybeSingle();
      if (readError) return fail(readError.message);

      const best = Math.max(clampStars(current?.estrellas), stars);
      // Sin RPC tampoco está la migración de nivel: se guarda solo lo de siempre (mejor e intentos).
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
      if (writeError) return fail(writeError.message);
      return { ...done(saved, best), level: null }; // el nivel queda solo en el dispositivo
    },
  };
}

export const lessonProgressService = createLessonProgressService();
