// Nivel académico por lección: reglas del motor adaptativo de Dante en un solo lugar.
//
// · Nivel GENERAL (state.level): gamificación (mapa de niveles, logros, «Nivel N»). No es dificultad.
// · Nivel ACADÉMICO por lección: dificultad de los ejercicios de esa lección, de 1 a 3.
//   Cada lección avanza por separado; jugar una no cambia el nivel de las demás.
//
// Reglas aplicadas:
//   R1–R3 nivel inicial según los aciertos del diagnóstico (0–1 → 1, 2–3 → 2, 4–5 → 3).
//   R7  3 estrellas (0–1 errores) → sube un nivel la lección (hasta el máximo).
//   R8  2 estrellas (2–3 errores) → conserva el nivel.
//   R9  1 estrella (4 o más errores) → conserva el nivel (el recomendador sugiere refuerzo).
//   R10 si en la ronda se acabaron las vidas → no hay avance académico, aunque se recarguen
//       las vidas y se termine la ronda (las recompensas de la ronda no cambian).

import { normalizeModuleId } from '../data/subjects.js';

export const MIN_LESSON_LEVEL = 1;
// Tres dificultades: son las que distinguen R12–R14 (restas desde 2, hexágono desde 2, 3 colores desde 3)
// y las mismas que asigna el diagnóstico (R1–R3).
export const MAX_LESSON_LEVEL = 3;

export function clampLessonLevel(level) {
  const value = Math.round(Number(level));
  if (!Number.isFinite(value)) return MIN_LESSON_LEVEL;
  return Math.max(MIN_LESSON_LEVEL, Math.min(MAX_LESSON_LEVEL, value));
}

/** R1–R3: nivel inicial según los aciertos del diagnóstico; null si no hay diagnóstico. */
export function initialLevelForScore(score) {
  if (!Number.isInteger(score) || score < 0) return null;
  if (score <= 1) return 1;
  if (score <= 3) return 2;
  return 3;
}

/** Nivel con el que empieza una lección que todavía no se ha jugado. */
export function startingLessonLevel(diagnosticScore) {
  return initialLevelForScore(diagnosticScore) ?? MIN_LESSON_LEVEL;
}

/** Nivel académico actual de una lección: el guardado o, si no hay, el inicial del diagnóstico. */
export function lessonLevelFor({ lessonId, levelByLesson = {}, diagnosticScore = null }) {
  const stored = levelByLesson?.[lessonId];
  if (stored !== null && stored !== undefined) return clampLessonLevel(stored);
  return startingLessonLevel(diagnosticScore);
}

/**
 * R7–R10: nivel académico de la lección después de una ronda.
 * Usa las estrellas que ya decidió starsForRound (utils/stars.js); no las recalcula.
 * @param {Object} round
 * @param {number} round.level - Nivel de la lección con el que se jugó la ronda.
 * @param {number} round.stars - Estrellas de la ronda (0 a 3).
 * @param {boolean} [round.livesDepleted] - Si en algún momento de la ronda las vidas llegaron a 0.
 * @returns {{level: number, advanced: boolean, rule: 'R7'|'R8'|'R9'|'R10'}}
 */
export function levelAfterRound({ level, stars, livesDepleted = false }) {
  const current = clampLessonLevel(level);
  if (livesDepleted || stars === 0) return { level: current, advanced: false, rule: 'R10' };
  if (stars === 3) {
    const next = Math.min(MAX_LESSON_LEVEL, current + 1);
    return { level: next, advanced: next > current, rule: 'R7' };
  }
  if (stars === 2) return { level: current, advanced: false, rule: 'R8' };
  return { level: current, advanced: false, rule: 'R9' };
}

/** Lección del catálogo que corresponde a un módulo (conteo → conteo-basico, sumas → sumas-basicas…). */
export function lessonForModule(catalog, moduleId) {
  const id = normalizeModuleId(moduleId);
  for (const course of catalog?.courses ?? []) {
    const lesson = course.lessons.find((item) => item.module_id === id);
    if (lesson) return { lesson, course };
  }
  return null;
}

const timeOf = (value) => {
  const time = Date.parse(value ?? '');
  return Number.isFinite(time) ? time : -Infinity;
};

/**
 * Combina el progreso por lección del dispositivo con el leído de Supabase sin que una lectura
 * antigua borre lo más reciente:
 *   · mejor puntuación (stars): siempre la mayor de las dos;
 *   · última ronda y nivel (rounds): gana la que tenga la fecha (at) más reciente.
 * @param {{stars?: Record<string, number>, rounds?: Record<string, {latestStars: number, level: number, at: string|null}>}} local
 * @param {{stars?: Record<string, number>, rounds?: Record<string, {latestStars: number|null, level: number|null, at: string|null}>}} remote
 */
export function mergeLessonProgress(local = {}, remote = {}) {
  const stars = { ...(local.stars ?? {}) };
  for (const [lessonId, value] of Object.entries(remote.stars ?? {})) {
    stars[lessonId] = Math.max(stars[lessonId] ?? 0, Math.max(0, Math.min(3, Number(value) || 0)));
  }
  const rounds = { ...(local.rounds ?? {}) };
  for (const [lessonId, round] of Object.entries(remote.rounds ?? {})) {
    if (!round) continue;
    const mine = rounds[lessonId];
    // Una fila histórica sin última ronda ni nivel no aporta nada que combinar.
    if ((round.latestStars === null || round.latestStars === undefined) && (round.level === null || round.level === undefined)) continue;
    if (!mine || timeOf(round.at) >= timeOf(mine.at)) {
      rounds[lessonId] = {
        latestStars: round.latestStars ?? mine?.latestStars ?? null,
        level: round.level ?? mine?.level ?? null,
        at: round.at ?? mine?.at ?? null,
      };
    }
  }
  return { stars, rounds };
}

/** Nivel académico actual de una lección a partir del estado del store (lessonRounds y diagnóstico). */
export function lessonLevelFromState(state = {}, lessonId) {
  const levelByLesson = {};
  for (const [id, round] of Object.entries(state.lessonRounds ?? {})) levelByLesson[id] = round?.level ?? null;
  const profile = state.profile ?? {};
  const diagnosticScore = profile.completed && Number.isInteger(profile.score) ? profile.score : null;
  return lessonLevelFor({ lessonId, levelByLesson, diagnosticScore });
}
