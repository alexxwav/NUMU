import { initialLevelForScore, lessonLevelFor, MAX_LESSON_LEVEL } from '../utils/lessonLevel.js';

// Sistema de recomendación de NUMU: reglas deterministas, sin modelos predictivos.
//
// No es otro motor adaptativo. Lee las decisiones que ya toma el motor de Dante
// y propone la siguiente actividad:
//   - R1–R3: nivel inicial de cada lección según los aciertos del diagnóstico (utils/lessonLevel.js).
//   - R4–R6: curso recomendado según los intereses (subjects.js).
//   - R7–R9: estrellas de cada ronda según los errores (utils/stars.js → starsForRound).
//   - R7–R10 también deciden el nivel académico de cada lección (utils/lessonLevel.js → levelAfterRound):
//            3 estrellas sube un nivel; 2 y 1 lo conservan; si se acaban las vidas no hay avance.
//   - R10:   si se acaban las vidas la ronda no se aprueba (0 estrellas); tiene prioridad.
// El recomendador no calcula estrellas, no cambia niveles, vidas ni premios y no escribe datos:
// solo LEE el nivel académico que ya decidió el motor.
//
// Criterios propios del recomendador (NO son reglas de Dante), documentados aquí:
export const CRITERIA = Object.freeze({
  C1: 'Justo después de una ronda, la primera recomendación sigue el resultado de esa ronda.',
  C2: 'Primero se refuerzan las lecciones cuya mejor ronda obtuvo 1 estrella.',
  C3: 'Después se continúan las lecciones cuya mejor ronda obtuvo 2 estrellas.',
  C4: 'Si hay una lección dominada (3 estrellas), se avanza a la siguiente lección sin empezar, en el orden del catálogo.',
  C5: 'Sin progreso, se inicia la primera lección del curso recomendado por intereses; si ningún interés tiene curso, el primer curso del catálogo.',
  C6: 'Desempate: primero los cursos de interés y luego el orden del catálogo (curso y lección).',
  C7: 'Si todas las lecciones están dominadas, se sugiere un repaso de la primera lección del curso de interés.',
  C8: 'Se muestran como máximo 3 recomendaciones y nunca dos sobre la misma lección.',
  C9: 'Para decidir reforzar, continuar o avanzar se usa la última ronda de cada lección cuando existe; si no, la mejor puntuación. La mejor sigue siendo la que cuentan premios y logros.',
  C10: 'Si una lección se dominó (3 estrellas) y por eso subió de nivel sin llegar al máximo, se recomienda practicarla en su nuevo nivel antes de pasar a otra lección.',
});

export const RECOMMENDATION_TYPES = Object.freeze({
  INICIAR: 'INICIAR',
  CONTINUAR: 'CONTINUAR',
  REFORZAR: 'REFORZAR',
  AVANZAR: 'AVANZAR',
});

const { INICIAR, CONTINUAR, REFORZAR, AVANZAR } = RECOMMENDATION_TYPES;

// Intereses del diseño original y su curso publicado (null = todavía no existe).
const INTEREST_COURSES = Object.freeze({
  aritmetica: 'aritmetica',
  geometria: 'geometria-patrones',
  algebra: null,
  trigonometria: null,
});
const INTEREST_NAMES = Object.freeze({
  aritmetica: 'Aritmética', geometria: 'Geometría', algebra: 'Álgebra', trigonometria: 'Trigonometría',
});
// Intereses con nombre de módulo que guardaba el cuestionario anterior.
const INTEREST_ALIASES = Object.freeze({ conteo: 'aritmetica', sumas: 'aritmetica', formas: 'geometria' });

// R1–R3 viven en utils/lessonLevel.js (una sola implementación); se reexporta por compatibilidad.
export { initialLevelForScore };

function normalizeInterests(interests) {
  const result = [];
  for (const raw of Array.isArray(interests) ? interests : []) {
    const id = INTEREST_ALIASES[raw] ?? raw;
    if (id in INTEREST_COURSES && !result.includes(id)) result.push(id);
  }
  return result;
}

const clamp = (stars) => Math.max(0, Math.min(3, Math.round(Number(stars) || 0)));

/**
 * Calcula las recomendaciones de un estudiante a partir de sus datos.
 * Función pura: con los mismos datos devuelve siempre lo mismo y no modifica nada.
 *
 * @param {Object} input
 * @param {{courses: Array}} input.catalog - Catálogo publicado (src/data/lessonContent.json).
 * @param {string[]} [input.interests] - Intereses elegidos en el cuestionario inicial.
 * @param {number|null} [input.diagnosticScore] - Aciertos del diagnóstico (0–5) o null si no hay.
 * @param {Record<string, number>} [input.starsByLesson] - Mejor estrella guardada por lección (0–3).
 *   Es la que cuentan premios y logros; aquí solo sirve para saber qué lecciones ya se empezaron.
 * @param {Record<string, number>} [input.latestStarsByLesson] - Estrellas de la ÚLTIMA ronda por lección (0–3).
 *   Opcional: si una lección no la tiene, se decide con la mejor (C9).
 * @param {Record<string, number>} [input.levelByLesson] - Nivel académico guardado por lección (1–3).
 *   Si una lección no lo tiene, su nivel es el inicial del diagnóstico (R1–R3).
 * @param {{lessonId: string, stars: number, approved: boolean, levelBefore?: number, levelAfter?: number}|null} [input.lastRound]
 *   Resultado de la ronda recién terminada, tal como lo decidieron starsForRound y levelAfterRound.
 * @param {number} [input.limit] - Máximo de recomendaciones (C8).
 * @returns {{recommendations: Array<Object>, unavailableInterests: Array<{id: string, name: string}>,
 *   recommendedCourseId: string|null, initialLevel: number|null}}
 */
export function buildRecommendations({
  catalog,
  interests = [],
  diagnosticScore = null,
  starsByLesson = {},
  latestStarsByLesson = {},
  levelByLesson = {},
  lastRound = null,
  limit = 3,
} = {}) {
  const chosen = normalizeInterests(interests);
  const courseIds = new Set((catalog?.courses ?? []).map((course) => course.id));
  const interestCourses = [...new Set(chosen.map((id) => INTEREST_COURSES[id]).filter((id) => id && courseIds.has(id)))];
  const unavailableInterests = chosen
    .filter((id) => !INTEREST_COURSES[id] || !courseIds.has(INTEREST_COURSES[id]))
    .map((id) => ({ id, name: INTEREST_NAMES[id] }));
  const initialLevel = initialLevelForScore(diagnosticScore);

  // C6: cursos de interés primero, luego el orden del catálogo.
  const courses = [...(catalog?.courses ?? [])].sort((a, b) => {
    const ia = interestCourses.indexOf(a.id);
    const ib = interestCourses.indexOf(b.id);
    if (ia !== ib) return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
    return a.position - b.position;
  });
  const ordered = courses.flatMap((course) => [...course.lessons]
    .sort((a, b) => a.position - b.position)
    .map((lesson) => ({ lesson, course })));
  const byId = new Map(ordered.map((entry) => [entry.lesson.id, entry]));

  // Mejor y última estrella por lección. La ronda recién terminada es la última y puede subir la mejor.
  const best = {};
  for (const [lessonId, stars] of Object.entries(starsByLesson ?? {})) {
    if (byId.has(lessonId)) best[lessonId] = clamp(stars);
  }
  const latest = {};
  for (const [lessonId, stars] of Object.entries(latestStarsByLesson ?? {})) {
    if (byId.has(lessonId) && stars !== null && stars !== undefined) latest[lessonId] = clamp(stars);
  }
  const round = lastRound && byId.has(lastRound.lessonId) ? lastRound : null;
  if (round) {
    latest[round.lessonId] = round.approved ? clamp(round.stars) : 0;
    if (round.approved) best[round.lessonId] = Math.max(best[round.lessonId] ?? 0, clamp(round.stars));
  }
  // Nivel académico de cada lección: el guardado, el que dejó la ronda recién terminada o el inicial.
  const levels = { ...(levelByLesson ?? {}) };
  if (round && Number.isInteger(round.levelAfter)) levels[round.lessonId] = round.levelAfter;
  const levelOf = (lessonId) => lessonLevelFor({ lessonId, levelByLesson: levels, diagnosticScore });
  const hasStoredLevel = (lessonId) => levels[lessonId] !== null && levels[lessonId] !== undefined;
  const bestOf = (lessonId) => best[lessonId] ?? 0;
  const hasLatest = (lessonId) => Object.hasOwn(latest, lessonId);
  // C9: se decide con la última ronda cuando existe; si no, con la mejor puntuación.
  const decisionOf = (lessonId) => (hasLatest(lessonId) ? latest[lessonId] : bestOf(lessonId));
  const started = (lessonId) => bestOf(lessonId) > 0 || hasLatest(lessonId);
  // Si la última ronda fue peor que la mejor, el motivo lo dice (la mejor sigue contando para premios).
  const scoreNote = (lessonId) => (hasLatest(lessonId) && latest[lessonId] < bestOf(lessonId)
    ? ` Tu mejor marca sigue siendo de ${bestOf(lessonId)} estrellas.`
    : '');

  const recommendations = [];
  const add = (type, entry, message, reason, rules) => {
    if (!entry || recommendations.some((rec) => rec.lessonId === entry.lesson.id)) return;
    const id = entry.lesson.id;
    recommendations.push({
      type,
      courseId: entry.course.id,
      lessonId: id,
      title: entry.lesson.title,
      courseTitle: entry.course.title,
      message,
      reason,
      rules,
      route: `/lecciones/${id}`,
      bestStars: bestOf(id),
      latestStars: hasLatest(id) ? latest[id] : null,
      level: levelOf(id),
    });
  };
  const nextUnstarted = (afterLessonId = null) => {
    const start = afterLessonId ? ordered.findIndex((e) => e.lesson.id === afterLessonId) + 1 : 0;
    return [...ordered.slice(start), ...ordered.slice(0, start)].find((e) => !started(e.lesson.id)) ?? null;
  };

  // C1: la ronda recién terminada manda (R10 antes que R7–R9).
  if (round) {
    const entry = byId.get(round.lessonId);
    const name = entry.lesson.title.toLowerCase();
    const at = ` Sigues en el nivel ${levelOf(round.lessonId)} de esta lección.`;
    const leveledUp = Number.isInteger(round.levelBefore) && Number.isInteger(round.levelAfter)
      && round.levelAfter > round.levelBefore;
    if (!round.approved) {
      add(REFORZAR, entry, `Se acabaron las vidas en ${name}. Recarga y vuelve a intentarlo con calma.`,
        `La ronda se pausó porque las vidas llegaron a cero, así que todavía no se puede avanzar.${at}`, ['R10', 'C1']);
    } else if (round.stars === 1) {
      add(REFORZAR, entry, `Practiquemos nuevamente ${name} para mejorar tus habilidades.`,
        `Tuviste 4 o más errores en esta ronda: conviene reforzar antes de avanzar.${at}`, ['R9', 'C1']);
    } else if (round.stars === 2) {
      add(CONTINUAR, entry, `¡Vas muy bien en ${name}! Una ronda más para ganar las 3 estrellas.`,
        `Tuviste 2 o 3 errores: se mantiene la dificultad y se sigue practicando.${at}`, ['R8', 'C1']);
    } else if (round.stars === 3 && leveledUp) {
      add(AVANZAR, entry, `¡Excelente! Sube la dificultad: ${name}, nivel ${round.levelAfter}.`,
        `Dominaste el nivel ${round.levelBefore} con 0 o 1 errores, así que esta lección sube al nivel ${round.levelAfter}.`,
        ['R7', 'C1', 'C10']);
    } else if (round.stars === 3) {
      const next = nextUnstarted(round.lessonId);
      if (next) {
        add(AVANZAR, next, `¡Excelente! Puedes continuar con un nuevo desafío: ${next.lesson.title.toLowerCase()}.`,
          `Dominaste ${name} con 0 o 1 errores, así que puedes avanzar a la siguiente lección.`, ['R7', 'C1', 'C4']);
      }
    }
  }

  // Texto de qué ronda se usó para decidir (C9).
  const which = (lessonId) => (hasLatest(lessonId) ? 'Tu última ronda' : 'Tu mejor ronda');

  // C2: refuerzo (ronda con 1 estrella, R9; o última ronda sin aprobar, R10).
  for (const entry of ordered) {
    const id = entry.lesson.id;
    const stars = decisionOf(id);
    if (stars === 1) {
      add(REFORZAR, entry, `Te recomendamos repasar ${entry.lesson.title.toLowerCase()}.`,
        `${which(id)} en esta lección (nivel ${levelOf(id)}) obtuvo 1 estrella: un repaso te ayudará a avanzar.${scoreNote(id)}`,
        hasLatest(id) ? ['R9', 'C2', 'C9'] : ['R9', 'C2']);
    } else if (stars === 0 && started(id)) {
      add(REFORZAR, entry, `Vuelve a intentar ${entry.lesson.title.toLowerCase()} con calma.`,
        `Tu última ronda en esta lección no se completó porque se acabaron las vidas. Sigues en el nivel ${levelOf(id)}.${scoreNote(id)}`, ['R10', 'C2', 'C9']);
    }
  }
  // C3: continuar (ronda con 2 estrellas, R8).
  for (const entry of ordered) {
    const id = entry.lesson.id;
    if (decisionOf(id) === 2) {
      add(CONTINUAR, entry, `Has mejorado mucho en ${entry.lesson.title.toLowerCase()}. ¡Continúa aprendiendo!`,
        `${which(id)} en el nivel ${levelOf(id)} obtuvo 2 estrellas: una ronda más y puedes conseguir las 3.${scoreNote(id)}`,
        hasLatest(id) ? ['R8', 'C3', 'C9'] : ['R8', 'C3']);
    }
  }
  // C4: avanzar después de dominar una lección (3 estrellas, R7).
  const mastered = ordered.filter((entry) => decisionOf(entry.lesson.id) === 3);
  // C10: lección dominada que subió de nivel sin llegar al máximo → practicarla en su nuevo nivel.
  // (Con la última ronda en 3 y un nivel guardado menor al máximo, la lección acaba de subir: R7.)
  for (const entry of mastered) {
    const id = entry.lesson.id;
    if (hasLatest(id) && hasStoredLevel(id) && levelOf(id) < MAX_LESSON_LEVEL) {
      add(AVANZAR, entry, `¡Sube la dificultad en ${entry.lesson.title.toLowerCase()}! Ahora juegas en el nivel ${levelOf(id)}.`,
        `Tu última ronda obtuvo 3 estrellas, así que esta lección pasó al nivel ${levelOf(id)}.`, ['R7', 'C10', 'C9']);
    }
  }
  if (mastered.length) {
    const next = nextUnstarted(mastered[mastered.length - 1].lesson.id);
    if (next) {
      add(AVANZAR, next, `¡Vamos a practicar ${next.lesson.title.toLowerCase()}!`,
        `Ya dominaste ${mastered[mastered.length - 1].lesson.title.toLowerCase()}, así que puedes seguir con esta lección.`, ['R7', 'C4']);
    }
  }
  // C5: iniciar (primera lección del curso recomendado por intereses, R4–R6; nivel R1–R3).
  const levelText = initialLevel
    ? `Tu diagnóstico te ubicó en el nivel ${initialLevel}.`
    : 'Todavía no tenemos tu diagnóstico, así que empezamos desde el principio.';
  for (const course of courses) {
    const entry = ordered.find((e) => e.course.id === course.id && !started(e.lesson.id));
    if (!entry) continue;
    const isInterest = interestCourses.includes(course.id);
    add(INICIAR, entry, `¡Vamos a practicar ${entry.lesson.title.toLowerCase()}!`,
      `${isInterest ? `Elegiste ${course.title} entre tus intereses.` : `Es la primera lección disponible de ${course.title}.`} ${levelText} Empezarás en el nivel ${levelOf(entry.lesson.id)} de esta lección.`,
      [
        ...(isInterest ? [course.id === 'aritmetica' ? 'R4' : 'R5'] : ['C6']),
        ...(initialLevel ? [`R${initialLevel}`] : []), // R1, R2 o R3 según el nivel inicial
        'C5',
      ]);
  }
  // C7: todo dominado → repaso.
  if (!recommendations.length && ordered.length) {
    const entry = ordered[0];
    add(CONTINUAR, entry, `¡Dominaste todas las lecciones! Repasa ${entry.lesson.title.toLowerCase()} cuando quieras.`,
      ordered.every((e) => levelOf(e.lesson.id) === MAX_LESSON_LEVEL)
        ? `Obtuviste 3 estrellas en todas las lecciones publicadas, en su nivel más alto (${MAX_LESSON_LEVEL}).`
        : 'Obtuviste 3 estrellas en todas las lecciones publicadas.', ['R7', 'C7']);
  }

  return {
    recommendations: recommendations.slice(0, Math.max(0, limit)), // C8
    unavailableInterests,
    recommendedCourseId: interestCourses[0] ?? null,
    initialLevel,
  };
}
