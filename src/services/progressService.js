import { requireSupabase } from '../lib/supabase.js';
import { profileService } from './profileService.js';

// Esquema de numu: cursos(id, nombre_curso, slug), lecciones(id, curso_id, titulo_leccion, nivel, preguntas)
// y progreso(usuario_id, curso_id, nivel_actual, num_estrellas, num_intentos, racha_dias, leccion_completada),
// con una fila de progreso por usuario y curso.

export function createProgressService(getClient = requireSupabase, profiles = profileService) {
  return {
    /** Cursos con sus lecciones. */
    async getCatalog() {
      const { data, error } = await getClient()
        .from('cursos')
        .select('id, nombre_curso, slug, lecciones (id, titulo_leccion, nivel)')
        .order('id', { ascending: true })
        .order('id', { referencedTable: 'lecciones', ascending: true });
      return { courses: data ?? [], error: error ? error.message : null };
    },

    /** Progreso del usuario con sesión como objeto { [slugDelCurso]: fila }. */
    async getProgress() {
      const { data, error } = await getClient()
        .from('progreso')
        .select('curso_id, nivel_actual, num_estrellas, num_intentos, racha_dias, leccion_completada, cursos (slug)');
      const byCourse = {};
      for (const row of data ?? []) byCourse[row.cursos?.slug ?? row.curso_id] = row;
      return { progress: byCourse, error: error ? error.message : null };
    },

    /**
     * Registra una ronda terminada: guarda el nivel nuevo, suma las estrellas y un intento.
     * nextLevel lo decide la regla de adaptación antes de llamar a esta función.
     */
    async recordRound({ courseSlug, stars, nextLevel, streak = 1, completed = false }) {
      if (!Number.isInteger(stars) || stars < 0 || stars > 3) {
        return { progress: null, error: 'stars debe ser un entero entre 0 y 3.' };
      }
      if (!Number.isInteger(nextLevel) || nextLevel < 1) {
        return { progress: null, error: 'nextLevel debe ser un entero mayor o igual a 1.' };
      }
      const client = getClient();
      const { usuarioId, error: idError } = await profiles.currentUsuarioId();
      if (idError) return { progress: null, error: idError };

      const { data: course, error: courseError } = await client
        .from('cursos').select('id').eq('slug', courseSlug).maybeSingle();
      if (courseError || !course) return { progress: null, error: courseError?.message ?? `No existe el curso ${courseSlug}.` };

      const { data: current } = await client
        .from('progreso').select('num_estrellas, num_intentos, leccion_completada')
        .eq('usuario_id', usuarioId).eq('curso_id', course.id).maybeSingle();

      const { data, error } = await client
        .from('progreso')
        .upsert({
          usuario_id: usuarioId,
          curso_id: course.id,
          nivel_actual: nextLevel,
          num_estrellas: (current?.num_estrellas ?? 0) + stars,
          num_intentos: (current?.num_intentos ?? 0) + 1,
          racha_dias: streak,
          leccion_completada: Boolean(current?.leccion_completada) || completed,
        }, { onConflict: 'usuario_id,curso_id' })
        .select()
        .single();
      return { progress: data ?? null, error: error ? error.message : null };
    },
  };
}

export const progressService = createProgressService();
