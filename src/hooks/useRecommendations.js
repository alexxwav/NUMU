import { useEffect, useMemo, useState } from 'react';
import catalog from '../data/lessonContent.json';
import { store } from '../state/store.js';
import { buildRecommendations } from '../services/recommendationService.js';
import { useLessonProgress } from './useLessonProgress.js';

/**
 * Recomendaciones del estudiante con sesión.
 * Usa los mismos datos que el resto de la app, sin otra fuente de verdad:
 *   - intereses y aciertos del diagnóstico: state.profile (se cargan de Supabase al iniciar sesión);
 *   - estrellas por lección: useLessonProgress (tabla progreso_leccion, RLS: solo las propias).
 *     useLessonProgress también da la última ronda (latestStarsByLesson) y el nivel académico de
 *     cada lección (levelByLesson), del dispositivo y de Supabase cuando la migración esté aplicada.
 * @param {Object} [options]
 * @param {{lessonId: string, stars: number, approved: boolean, levelBefore?: number, levelAfter?: number}|null} [options.lastRound] - Ronda recién terminada.
 * @param {number} [options.limit] - Máximo de recomendaciones.
 */
export function useRecommendations({ lastRound = null, limit = 3 } = {}) {
  const { starsByLesson, latestStarsByLesson, levelByLesson } = useLessonProgress();
  const [state, setState] = useState(() => store.get());

  useEffect(() => store.subscribe(() => setState(store.get())), []);

  const profile = state.profile ?? {};
  // Sin cuestionario terminado no hay diagnóstico: no se inventa un puntaje.
  const diagnosticScore = profile.completed && Number.isInteger(profile.score) ? profile.score : null;
  // Las estrellas locales y las guardadas se combinan conservando la mejor (igual que el store).
  const stars = { ...(state.lessonStars ?? {}) };
  for (const [lessonId, value] of Object.entries(starsByLesson ?? {})) {
    stars[lessonId] = Math.max(stars[lessonId] ?? 0, value);
  }
  const starsKey = JSON.stringify(stars);
  const latestKey = JSON.stringify(latestStarsByLesson ?? {});
  const levelKey = JSON.stringify(levelByLesson ?? {});
  const interestsKey = JSON.stringify(profile.interests ?? []);
  const roundKey = lastRound
    ? `${lastRound.lessonId}:${lastRound.stars}:${lastRound.approved}:${lastRound.levelBefore}:${lastRound.levelAfter}`
    : '';

  return useMemo(() => buildRecommendations({
    catalog,
    interests: JSON.parse(interestsKey),
    diagnosticScore,
    starsByLesson: JSON.parse(starsKey),
    latestStarsByLesson: JSON.parse(latestKey),
    levelByLesson: JSON.parse(levelKey),
    lastRound,
    limit,
  }), [interestsKey, diagnosticScore, starsKey, latestKey, levelKey, roundKey, limit]); // eslint-disable-line react-hooks/exhaustive-deps
}
