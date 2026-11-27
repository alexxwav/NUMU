// Progreso académico por ÁREA (contrato compartido v1.1 §5–§7). Solo funciones puras:
// no guardan nada, no cambian niveles ni el mapa y no deciden la dificultad.
//
// · Un área es un elemento de catalog.courses (Aritmética, Geometría, Álgebra, Trigonometría).
// · R15 (T2): una lección está terminada si su MEJOR resultado académico es de 3 estrellas.
//         Una ronda posterior peor no la desmarca; el nivel académico (1–3) no interviene.
// · R16: un área está completada cuando sus 5 lecciones cumplen T2.
// · R17: la lección de entrada de un área es la primera publicada y no terminada (por position).
// Las estrellas que se leen son las académicas por lección (lessonStars / progreso_leccion),
// nunca las estrellas de las paradas del mapa. R7–R10 siguen en utils/lessonLevel.js sin cambios.

import { clampStars } from './stars.js';
import { lessonLevelFor } from './lessonLevel.js';
import { isLessonPublished, hasLegacyRound, lessonCoverage } from './lessonRound.js';
import { normalizeModuleId, courseSlugForModule, ACTIVE_AREA_IDS, isActiveArea } from '../data/subjects.js';
import { lessonTheoryPath, lessonPlayPath } from '../services/startRoute.js';

export { ACTIVE_AREA_IDS, isActiveArea };

/**
 * ¿Se puede practicar la lección en este nivel? Publicada y, además, una de las 4 actuales
 * (su flujo de juego existe) o con 6 preguntas distintas en ese nivel (selector v2).
 * Es la misma condición que usan el juego (planLessonRound) y el recomendador (C16).
 */
export function isLessonPlayable(lesson, level) {
  if (!isLessonPublished(lesson)) return false;
  if (hasLegacyRound(lesson)) return true;
  return lessonCoverage({ lesson, level, samples: 60 }).playable;
}

/** Lecciones que forman un área completa (decisión aprobada: 4 áreas × 5 lecciones). */
export const LESSONS_PER_AREA = 5;
/** Estrellas académicas que exige T2. */
export const T2_STARS = 3;

/** R15 · T2: ¿la mejor puntuación académica de la lección es de 3 estrellas? */
export function isLessonCompleted(bestStars) {
  if (bestStars === null || bestStars === undefined) return false;
  return clampStars(bestStars) >= T2_STARS;
}

/** El área (curso del catálogo) con ese id, o null. */
export function getArea(catalog, areaId) {
  return (catalog?.courses ?? []).find((course) => course?.id === areaId) ?? null;
}

/** Lecciones del área ordenadas por position, sin modificar el catálogo. */
export function areaLessons(catalog, areaId) {
  const area = getArea(catalog, areaId);
  return [...(area?.lessons ?? [])].sort((a, b) => (a?.position ?? 0) - (b?.position ?? 0));
}

/**
 * R16 · Avance de un área: cuántas de sus lecciones cumplen T2.
 * @param {{catalog: Object, areaId: string, starsByLesson?: Record<string, number>}} input
 *   starsByLesson = mejor puntuación académica por lección.
 */
export function areaProgress({ catalog, areaId, starsByLesson = {} } = {}) {
  const lessons = areaLessons(catalog, areaId);
  const completedIds = lessons
    .filter((lesson) => isLessonCompleted(starsByLesson?.[lesson.id]))
    .map((lesson) => lesson.id);
  return {
    areaId,
    total: lessons.length,
    completed: completedIds.length,
    lessonIds: lessons.map((lesson) => lesson.id),
    completedIds,
    // Exige las 5 lecciones del área; con menos lecciones en el catálogo el área no se completa.
    isCompleted: lessons.length === LESSONS_PER_AREA && completedIds.length === LESSONS_PER_AREA,
  };
}

/** R16 · ¿Las 5 lecciones del área cumplen T2? */
export function isAreaCompleted({ catalog, areaId, starsByLesson = {} } = {}) {
  return areaProgress({ catalog, areaId, starsByLesson }).isCompleted;
}

/** R17 · Primera lección publicada y no terminada del área (por position), o null. */
export function nextLessonInArea({ catalog, areaId, starsByLesson = {} } = {}) {
  return areaLessons(catalog, areaId)
    .find((lesson) => isLessonPublished(lesson) && !isLessonCompleted(starsByLesson?.[lesson.id])) ?? null;
}

/**
 * Dónde se registra una ronda terminada (Game.jsx). La identidad académica es SIEMPRE lessonId.
 * · Lección con module_id propio (las 4 actuales): se registran también el mapa por sección y
 *   el progreso del curso, igual que antes.
 * · Lección sin module_id (las 16 nuevas): solo el progreso académico por lessonId. No se usa el
 *   módulo guardado en el dispositivo (store.module) como respaldo, porque pertenece a otra
 *   lección: una ronda de Álgebra nunca puede contar como Aritmética o Geometría.
 *   El progreso del curso (recordRound, que usa store.module) solo se registra si ese módulo
 *   pertenece a la MISMA área de la lección o no pertenece a ninguna.
 * · Sin lección del catálogo (/jugar/:modulo sin lección): el módulo de la ruta, como antes.
 * @param {{lesson?: Object|null, areaId?: string|null, routeModuleId?: string|null, storeModuleId?: string|null}} input
 * @returns {{lessonId: string|null, moduleId: string|null, recordsModuleProgress: boolean, recordsCourseProgress: boolean}}
 */
export function roundProgressTargets({ lesson = null, areaId = null, routeModuleId = null, storeModuleId = null } = {}) {
  if (!lesson) {
    const moduleId = normalizeModuleId(routeModuleId) ?? 'conteo';
    return { lessonId: null, moduleId, recordsModuleProgress: true, recordsCourseProgress: true };
  }
  const ownModule = normalizeModuleId(lesson.module_id);
  if (ownModule) {
    return { lessonId: lesson.id ?? null, moduleId: ownModule, recordsModuleProgress: true, recordsCourseProgress: true };
  }
  const lessonArea = areaId ?? lesson.course_id ?? null;
  const storeArea = courseSlugForModule(storeModuleId);
  return {
    lessonId: lesson.id ?? null,
    moduleId: null,
    recordsModuleProgress: false,
    recordsCourseProgress: storeArea === null || storeArea === lessonArea,
  };
}

/**
 * Entradas lógicas de un área, una por lessonId y en orden de posición, para que la presentación
 * (el mapa de 5 paradas de Viviana) las dibuje. Se calculan SOLO desde el progreso académico por
 * lección: no guardan nada, no usan las 10 paradas históricas ni modifican el mapa actual.
 * Cada entrada:
 * · lessonId, position, title.
 * · bestStars: mejor puntuación académica; completed: T2 (mejor = 3).
 * · level: nivel académico (guardado o inicial por diagnóstico, R1–R3), independiente de T2.
 * · published, playable: publicada y con práctica posible en su nivel.
 * · isNext: la siguiente lección recomendada del área (R17: primera publicada y no terminada).
 * · status: 'no-publicada' | 'terminada' | 'siguiente' | 'disponible'.
 * · theoryPath: /lecciones/:id (solo publicadas); playPath: /lecciones/:id/jugar (solo jugables).
 * Sin bloqueos artificiales: toda lección publicada se puede consultar.
 * @param {{catalog: Object, areaId: string, starsByLesson?: Record<string, number>,
 *   levelByLesson?: Record<string, number>, diagnosticScore?: number|null}} input
 */
export function getAreaRoute({ catalog, areaId, starsByLesson = {}, levelByLesson = {}, diagnosticScore = null } = {}) {
  const area = getArea(catalog, areaId);
  if (!area) return null;
  const progress = areaProgress({ catalog, areaId, starsByLesson });
  const next = nextLessonInArea({ catalog, areaId, starsByLesson });
  const stops = areaLessons(catalog, areaId).map((lesson) => {
    const bestStars = clampStars(starsByLesson?.[lesson.id]);
    const published = isLessonPublished(lesson);
    const completed = isLessonCompleted(starsByLesson?.[lesson.id]);
    const level = lessonLevelFor({ lessonId: lesson.id, levelByLesson, diagnosticScore });
    const playable = isLessonPlayable(lesson, level);
    const isNext = next?.id === lesson.id;
    let status = 'disponible';
    if (!published) status = 'no-publicada';
    else if (completed) status = 'terminada';
    else if (isNext) status = 'siguiente';
    return {
      lessonId: lesson.id,
      position: lesson.position,
      title: lesson.title,
      published,
      playable,
      completed,
      isNext,
      status,
      bestStars,
      level,
      theoryPath: published ? lessonTheoryPath(lesson.id) : null,
      playPath: playable ? lessonPlayPath(lesson.id) : null,
    };
  });
  return {
    areaId: area.id,
    title: area.title,
    total: progress.total,
    completed: progress.completed,
    isCompleted: progress.isCompleted,
    nextLessonId: next?.id ?? null,
    stops,
  };
}

/**
 * Recorrido completo del alcance actual: las áreas activas (Aritmética, Geometría y Álgebra) en
 * orden, con sus entradas (getAreaRoute). Las áreas que no estén en el catálogo se omiten;
 * Trigonometría nunca aparece. nextLessonId es la primera lección siguiente en orden de áreas.
 */
export function getLearningPath({ catalog, starsByLesson = {}, levelByLesson = {}, diagnosticScore = null } = {}) {
  const areas = ACTIVE_AREA_IDS
    .map((areaId) => getAreaRoute({ catalog, areaId, starsByLesson, levelByLesson, diagnosticScore }))
    .filter(Boolean);
  const firstNext = areas.find((area) => area.nextLessonId);
  return {
    areas,
    completedAreas: areas.filter((area) => area.isCompleted).map((area) => area.areaId),
    nextLessonId: firstNext?.nextLessonId ?? null,
  };
}
