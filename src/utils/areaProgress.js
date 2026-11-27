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
import { isLessonPublished } from './lessonRound.js';
import { normalizeModuleId, courseSlugForModule } from '../data/subjects.js';

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
 * Información de las paradas de un área, una por lessonId, para que la presentación la dibuje.
 * No guarda progreso, no genera rutas de navegación y no modifica el mapa actual.
 * status: 'no-publicada' | 'terminada' | 'siguiente' (R17) | 'disponible'.
 * level es el nivel académico de la lección (guardado o inicial por diagnóstico, R1–R3).
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
    let status = 'disponible';
    if (!published) status = 'no-publicada';
    else if (completed) status = 'terminada';
    else if (next?.id === lesson.id) status = 'siguiente';
    return {
      lessonId: lesson.id,
      position: lesson.position,
      title: lesson.title,
      published,
      completed,
      status,
      bestStars,
      level: lessonLevelFor({ lessonId: lesson.id, levelByLesson, diagnosticScore }),
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
