import { requireSupabase } from '../lib/supabase.js';

export function createProgressService(getClient = requireSupabase) {
  return {
    /** Cursos con sus lecciones, ordenados por posición. */
    async getCatalog() {
      const { data, error } = await getClient()
        .from('courses')
        .select('id, title, description, position, lessons (id, title, description, position, module_id, base_level)')
        .order('position', { ascending: true })
        .order('position', { referencedTable: 'lessons', ascending: true });
      return { courses: data ?? [], error: error ? error.message : null };
    },

    /** Progreso del estudiante como objeto { [lessonId]: fila }. */
    async getProgress(userId) {
      const { data, error } = await getClient()
        .from('progress')
        .select('lesson_id, current_level, best_stars, attempts, completed, last_played_at')
        .eq('user_id', userId);
      const byLesson = {};
      for (const row of data ?? []) byLesson[row.lesson_id] = row;
      return { progress: byLesson, error: error ? error.message : null };
    },

    /**
     * Registra una ronda terminada en Game.jsx. El servidor usa auth.uid(),
     * así que no se puede escribir el progreso de otro estudiante.
     * nextLevel lo calcula la regla adaptativa (pendiente de definir por Dante).
     */
    async recordLessonResult({ lessonId, stars, nextLevel, completed = false }) {
      if (!Number.isInteger(stars) || stars < 0 || stars > 3) {
        return { progress: null, error: 'stars debe ser un entero entre 0 y 3.' };
      }
      if (!Number.isInteger(nextLevel) || nextLevel < 1) {
        return { progress: null, error: 'nextLevel debe ser un entero mayor o igual a 1.' };
      }
      const { data, error } = await getClient().rpc('record_lesson_result', {
        p_lesson_id: lessonId,
        p_stars: stars,
        p_next_level: nextLevel,
        p_completed: completed,
      });
      return { progress: data ?? null, error: error ? error.message : null };
    },
  };
}

export const progressService = createProgressService();
