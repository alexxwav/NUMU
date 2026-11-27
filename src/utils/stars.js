// Reglas de estrellas: cuántas se ganan en una ronda y cuántas hay guardadas.

/**
 * Estrellas de una ronda terminada.
 * 0 si la ronda no se aprobó (se acabaron las vidas) o si no hubo aciertos;
 * de 1 a 3 según los errores: hasta 1 error → 3, hasta 3 → 2, más → 1.
 * @param {Object} options
 * @param {number} options.total - Preguntas de la ronda.
 * @param {number} options.mistakes - Respuestas incorrectas.
 * @param {boolean} [options.approved] - Si el niño terminó con vidas.
 * @returns {number} Estrellas entre 0 y 3.
 */
export function starsForRound({ total, mistakes, approved = true } = {}) {
  if (!approved) return 0;
  if (!Number.isFinite(total) || total <= 0) return 0;
  const failed = Math.max(0, Number(mistakes) || 0);
  if (failed >= total) return 0;
  if (failed <= 1) return 3;
  if (failed <= 3) return 2;
  return 1;
}

/**
 * Suma de las estrellas guardadas de todas las lecciones.
 * @param {Record<string, number>} starsByLesson
 * @returns {number}
 */
export function sumStars(starsByLesson = {}) {
  if (!starsByLesson || typeof starsByLesson !== 'object') return 0;
  return Object.values(starsByLesson).reduce(
    (total, stars) => total + Math.max(0, Math.min(3, Number(stars) || 0)),
    0,
  );
}

/**
 * ¿El estudiante terminó al menos una lección? Evidencia real: alguna ronda terminada con
 * estrellas, ya sea por lección (lessonStars, también cargadas de Supabase) o, para datos
 * históricos de antes del progreso por lección, en starsByLevel. Ya no depende del nivel general.
 * @param {{lessonStars?: Record<string, number>, starsByLevel?: Record<string, number>}} state
 */
export function hasFinishedRound(state = {}) {
  const earned = (values) => Object.values(values ?? {}).some((stars) => clampStars(stars) > 0);
  return earned(state.lessonStars) || earned(state.starsByLevel);
}

/** Estrellas de una lección con valores seguros (0 a 3). */
export function clampStars(stars) {
  return Math.max(0, Math.min(3, Math.round(Number(stars) || 0)));
}

/**
 * Solo se sugiere reforzar cuando la ronda tuvo varios errores, una estrella
 * o no se completó. Con buen desempeño no se muestra ninguna sugerencia.
 */
export function needsReinforcement({ mistakes = 0, stars = 3 } = {}) {
  const failed = Math.max(0, Number(mistakes) || 0);
  return failed >= 2 || clampStars(stars) <= 1;
}

export const STARS_TO_UNLOCK = 2;
export const MAX_MODULE_LEVEL = 10;

/** Parada máxima alcanzable: solo se abre la N+1 si la N tiene al menos 2 estrellas. */
export function unlockedLevelFor(starsByLevel = {}, desiredLevel = 1) {
  const target = Number.isFinite(Number(desiredLevel)) ? Math.max(1, Math.floor(Number(desiredLevel))) : 1;
  let unlocked = 1;
  for (let level = 1; level < target; level += 1) {
    const earned = clampStars(starsByLevel?.[level] ?? starsByLevel?.[String(level)] ?? 0);
    if (earned < STARS_TO_UNLOCK) break;
    unlocked = level + 1;
  }
  return Math.min(MAX_MODULE_LEVEL, unlocked);
}
