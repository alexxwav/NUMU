import { useCallback, useEffect, useState } from 'react';
import { store } from '../state/store.js';
import { lessonProgressService } from '../services/lessonProgressService.js';
import { clampStars, sumStars } from '../utils/stars.js';
import { useAuth } from './useAuth.jsx';

/**
 * Progreso por lección del usuario con sesión.
 * Lee las estrellas guardadas en Supabase y las mantiene en el store, que sigue
 * siendo la fuente de verdad de las vistas.
 * @returns {{starsByLesson: Record<string, number>, totalStars: number, loaded: boolean, loading: boolean, error: string|null, refresh: Function, saveLessonResult: Function}}
 */
export function useLessonProgress() {
  const { session, configured } = useAuth();
  const [starsByLesson, setStarsByLesson] = useState(() => store.get().lessonStars ?? {});
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!configured || !session) {
      setStarsByLesson({});
      setLoaded(false);
      setError(null);
      store.set({ lessonStars: {} });
      return { starsByLesson: {}, totalStars: 0, error: null };
    }

    setLoading(true);
    const result = await lessonProgressService.getLessonProgress();
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return result;
    }

    setError(null);
    setLoaded(true);
    setStarsByLesson(result.starsByLesson);
    store.set({ lessonStars: result.starsByLesson });
    return result;
  }, [configured, session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Guarda el resultado de una lección y conserva la mejor puntuación. */
  const saveLessonResult = useCallback(async ({ lessonId, stars } = {}) => {
    if (!lessonId) return { stars: 0, error: null };
    const result = await lessonProgressService.saveLessonResult({ lessonId, stars });
    if (!result.error) {
      const current = store.get().lessonStars ?? {};
      const next = { ...current, [lessonId]: Math.max(current[lessonId] ?? 0, clampStars(result.stars)) };
      setStarsByLesson(next);
      setLoaded(true);
      store.set({ lessonStars: next });
    }
    return result;
  }, []);

  return {
    starsByLesson,
    totalStars: sumStars(starsByLesson),
    loaded,
    loading,
    error,
    refresh,
    saveLessonResult,
  };
}
