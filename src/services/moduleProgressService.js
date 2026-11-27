import { requireSupabase } from '../lib/supabase.js';
import { profileService } from './profileService.js';
import { normalizeModuleId } from '../data/subjects.js';
import { clampStars, MAX_MODULE_LEVEL, STARS_TO_UNLOCK, unlockedLevelFor } from '../utils/stars.js';

// Progreso del mapa por SECCIÓN, independiente del curso y de la lección:
//   user_module_progress(usuario_id, module_id, current_level, stars_by_level)
// con una fila por usuario y módulo (conteo,aritmetica,geometria,patrones).
// stars_by_level guarda { "1": 3, "2": 2, ... }: mejores estrellas de cada parada.

const TABLE = 'user_module_progress';

function clampLevel(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function cleanStars(raw) {
  const result = {};
  let source = raw;
  if (typeof source === 'string') {
    try { source = JSON.parse(source); } catch { return result; }
  }
  if (!source || typeof source !== 'object' || Array.isArray(source)) return result;
  for (const [level, stars] of Object.entries(source)) {
    const key = String(clampLevel(level));
    result[key] = Math.max(result[key] ?? 0, clampStars(stars));
  }
  return result;
}

export function createModuleProgressService(getClient = requireSupabase, profiles = profileService) {
  const empty = (error) => ({ levelByModule: {}, starsByModuleLevel: {}, error });

  return {
    /** Progreso de las 4 secciones del usuario con sesión. */
    async getModuleProgress() {
      const { usuarioId, error: idError } = await profiles.currentUsuarioId();
      if (idError) return empty(idError);

      const { data, error } = await getClient()
        .from(TABLE)
        .select('module_id, current_level, stars_by_level')
        .eq('usuario_id', usuarioId);
      if (error) return empty(error.message);

      const result = empty(null);
      for (const row of data ?? []) {
        const moduleId = normalizeModuleId(row?.module_id);
        if (!moduleId) continue;
        const starsByLevel = cleanStars(row.stars_by_level);
        result.starsByModuleLevel[moduleId] = starsByLevel;
        result.levelByModule[moduleId] = Math.min(
          clampLevel(row.current_level),
          unlockedLevelFor(starsByLevel, row.current_level),
        );
      }
      return result;
    },

    /**
     * Guarda una ronda terminada de una sección. Conserva la mejor puntuación de
     * la parada y, si ya se había completado, no retrocede la parada actual.
     * @param {{moduleId: string, stars: number, level: number}} round - `level` es la parada terminada.
     */
    async saveModuleRound({ moduleId, stars, level } = {}) {
      const fail = (error) => ({ moduleId: null, currentLevel: 1, starsByLevel: {}, error });
      const id = normalizeModuleId(moduleId);
      if (!id) return fail('module_id debe ser conteo, aritmetica, geometria o patrones.');
      if (!Number.isInteger(stars) || stars < 0 || stars > 3) {
        return fail('Las estrellas deben ser un entero entre 0 y 3.');
      }
      if (level === undefined || !Number.isInteger(level) || level < 1) {
        return fail('La parada terminada debe ser un entero mayor o igual a 1.');
      }

      const { usuarioId, error: idError } = await profiles.currentUsuarioId();
      if (idError) return fail(idError);

      const client = getClient();
      const { data: current, error: readError } = await client
        .from(TABLE)
        .select('current_level, stars_by_level')
        .eq('usuario_id', usuarioId)
        .eq('module_id', id)
        .maybeSingle();
      if (readError) return fail(readError.message);

      const currentLevel = Math.min(MAX_MODULE_LEVEL, clampLevel(current?.current_level ?? 1));
      const starsByLevel = cleanStars(current?.stars_by_level);
      const best = Math.max(starsByLevel[String(level)] ?? 0, stars);
      starsByLevel[String(level)] = best;
      const nextLevel = best >= STARS_TO_UNLOCK
        ? Math.min(MAX_MODULE_LEVEL, Math.max(currentLevel, level + 1))
        : currentLevel;

      const { error: writeError } = await client
        .from(TABLE)
        .upsert({
          usuario_id: usuarioId,
          module_id: id,
          current_level: nextLevel,
          stars_by_level: starsByLevel,
        }, { onConflict: 'usuario_id,module_id' })
        .select()
        .single();
      if (writeError) return fail(writeError.message);

      return { moduleId: id, currentLevel: nextLevel, starsByLevel, error: null };
    },
  };
}

export const moduleProgressService = createModuleProgressService();
