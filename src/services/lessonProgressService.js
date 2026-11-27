import { requireSupabase } from '../lib/supabase.js';
import { profileService } from './profileService.js';
import { clampStars, sumStars } from '../utils/stars.js';
import { clampLessonLevel, MIN_LESSON_LEVEL, MAX_LESSON_LEVEL } from '../utils/lessonLevel.js';
import { isLessonCompleted } from '../utils/areaProgress.js';

// Progreso ACADÉMICO por lección del proyecto "numu" (las 20 lecciones de las 4 áreas):
//   progreso_leccion(usuario_id, leccion_id, estrellas, intentos, created_at, updated_at)
// con una fila por usuario y lección. leccion_id es el id estable del catálogo (texto libre que
// cumple ^[a-z0-9-]+$): las 16 lecciones nuevas no necesitan filas en otras tablas ni module_id.
// El RPC registrar_resultado_leccion conserva la mejor puntuación (greatest) al repetir.
// estrellas = mejor puntuación académica → T2 (lección terminada con 3, utils/areaProgress.js).
// No guarda XP, gemas ni progreso del mapa: eso sigue en sus servicios, sin cambios.
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
    starsByLesson: {}, latestStarsByLesson: {}, levelByLesson: {}, attemptsByLesson: {}, rounds: {}, totalStars: 0,
    completedLessonIds: [], error,
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
      result.completedLessonIds = Object.keys(result.starsByLesson).filter((id) => isLessonCompleted(result.starsByLesson[id]));
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

      // Respaldo cuando el RPC no está desplegado. La mejor puntuación NUNCA baja, ni con dos
      // guardados a la vez: no se escribe un máximo calculado en el cliente (lectura + escritura
      // podría pisar un 3 guardado entre medias), sino que se sube con un update condicional
      // «where estrellas < nuevas», atómico por fila. Sin RPC tampoco está la migración de nivel:
      // se guarda solo lo de siempre (mejor e intentos) y el nivel queda en el dispositivo.
      const { usuarioId, error: idError } = await profiles.currentUsuarioId();
      if (idError) return fail(idError);
      const row = (query) => query.eq('usuario_id', usuarioId).eq('leccion_id', lessonId);

      const { data: current, error: readError } = await row(client.from(TABLE).select('estrellas, intentos')).maybeSingle();
      if (readError) return fail(readError.message);

      // 1. Asegura la fila sin pisar una existente (si otro guardado la creó antes, se ignora)
      //    o cuenta el intento. El contador de intentos puede perder uno en una carrera; la mejor no.
      const { error: ensureError } = current
        ? await row(client.from(TABLE).update({ intentos: (current.intentos ?? 0) + 1 }))
        : await client.from(TABLE).upsert(
          { usuario_id: usuarioId, leccion_id: lessonId, estrellas: stars, intentos: 1 },
          { onConflict: 'usuario_id,leccion_id', ignoreDuplicates: true },
        );
      if (ensureError) return fail(ensureError.message);

      // 2. Sube la mejor solo si la nueva es mayor (nunca la reduce).
      if (stars > 0) {
        const { error: raiseError } = await row(client.from(TABLE).update({ estrellas: stars })).lt('estrellas', stars);
        if (raiseError) return fail(raiseError.message);
      }

      // 3. Devuelve lo que quedó guardado.
      const { data: saved, error: savedError } = await row(client.from(TABLE).select('estrellas, intentos')).maybeSingle();
      if (savedError) return fail(savedError.message);
      return { ...done(saved, stars), level: null }; // el nivel queda solo en el dispositivo
    },
  };
}

export const lessonProgressService = createLessonProgressService();
