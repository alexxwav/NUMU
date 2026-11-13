import { useCallback, useEffect, useState } from 'react';
import { store } from '../state/store.js';
import { lessonProgressService } from '../services/lessonProgressService.js';
import { sumStars } from '../utils/stars.js';
import { useAuth } from './useAuth.jsx';

/** Vista del progreso por lección a partir del store (fuente única de verdad de las vistas). */
function fromStore(state) {
  const starsByLesson = state.lessonStars ?? {};
  const latestStarsByLesson = {};
  const levelByLesson = {};
  for (const [lessonId, round] of Object.entries(state.lessonRounds ?? {})) {
    if (round?.latestStars !== null && round?.latestStars !== undefined) latestStarsByLesson[lessonId] = round.latestStars;
    if (round?.level !== null && round?.level !== undefined) levelByLesson[lessonId] = round.level;
  }
  return { starsByLesson, latestStarsByLesson, levelByLesson };
}

/**
 * Progreso por lección del estudiante: mejor puntuación, última ronda y nivel académico.
 * El store guarda el progreso del dispositivo; con sesión de Supabase se combina con lo guardado
 * en la base sin que una lectura antigua borre lo más reciente (mergeLessonProgress).
 * En modo local (sin Supabase) se conserva el progreso del dispositivo; al cambiar de cuenta,
 * store.startSession / endSession ya lo reinician.
 */
export function useLessonProgress() {
  const { session, configured } = useAuth();
  const [progress, setProgress] = useState(() => fromStore(store.get()));
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => store.subscribe((state) => setProgress(fromStore(state))), []);

  const refresh = useCallback(async () => {
    if (!configured || !session) {
      setLoaded(false);
      setError(null);
      return { ...fromStore(store.get()), error: null };
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
    store.applyLessonProgress({ stars: result.starsByLesson, rounds: result.rounds });
    return result;
  }, [configured, session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /**
   * Guarda una ronda terminada: primero en el dispositivo (para que nada la pise) y, con sesión,
   * en Supabase. La mejor puntuación nunca baja; la última ronda y el nivel se reemplazan.
   */
  const saveLessonResult = useCallback(async ({ lessonId, stars, level } = {}) => {
    if (!lessonId) return { stars: 0, error: null };
    store.recordLessonRound({ lessonId, stars, level });
    if (!configured || !session) return { stars: store.get().lessonStars[lessonId] ?? 0, error: null, local: true };
    const result = await lessonProgressService.saveLessonResult({ lessonId, stars, level });
    if (!result.error) {
      store.applyLessonProgress({ stars: { [lessonId]: result.stars } });
      setLoaded(true);
    }
    return result;
  }, [configured, session]);

  return {
    ...progress,
    totalStars: sumStars(progress.starsByLesson),
    loaded,
    loading,
    error,
    refresh,
    saveLessonResult,
  };
}
