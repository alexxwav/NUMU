// Ejercicios de una ronda de lección según su nivel académico (1 a 3).
//
// · Nivel 1: los ejercicios del catálogo de Viviana que respetan los límites del nivel 1
//   (los mismos que usan los generadores y R12–R14), con sus pistas y retroalimentación;
//   si no alcanzan para la ronda, se completan con el generador del módulo en nivel 1.
// · Niveles 2 y 3: el generador existente del módulo (src/state/questions.js) con ese nivel,
//   que es el que aplica R12 (restas), R13 (hexágono) y R14 (patrones de 3 colores).
// No se inventa contenido nuevo: el catálogo actual no trae ejercicios graduados por nivel.

import { generateQuestions } from '../state/questions.js';
import { adaptExerciseToGame } from './lessonGameAdapter.js';
import { shuffleExerciseOptions } from './lessonContent.js';
import { clampLessonLevel } from './lessonLevel.js';

export const QUESTIONS_PER_ROUND = 6;

/** ¿Un ejercicio del catálogo respeta los límites del nivel 1 del generador de su módulo? */
export function fitsLevelOne(exercise) {
  const visual = exercise?.visual;
  switch (visual?.type) {
    case 'objects': return visual.count <= 5;                                   // countQuestion: hasta 4 + nivel
    case 'expression': return Math.max(...visual.operands) <= 4;                // arithmeticQuestion: hasta 3 + nivel, sin restas
    case 'shape': return visual.sides <= 5;                                     // R13: el hexágono aparece desde el nivel 2
    case 'color_sequence': return new Set(visual.sequence).size <= 2;           // R14: 3 colores desde el nivel 3
    default: return false;
  }
}

/**
 * Preguntas (formato de Game.jsx) de una ronda de la lección en el nivel indicado.
 * Cada pregunta indica su origen en `source`: 'catalogo' o 'generador'.
 */
export function buildLessonRound({ lesson, level, count = QUESTIONS_PER_ROUND, random = Math.random }) {
  const lessonLevel = clampLessonLevel(level);
  if (lessonLevel === 1) {
    const curated = (lesson.exercises ?? [])
      .filter(fitsLevelOne)
      .slice(0, count)
      .map((exercise) => ({ ...adaptExerciseToGame(shuffleExerciseOptions(exercise, random)), source: 'catalogo', level: 1 }));
    const fill = generateQuestions(lesson.module_id, 1, count - curated.length)
      .map((question) => ({ ...question, source: 'generador', level: 1 }));
    return [...curated, ...fill];
  }
  return generateQuestions(lesson.module_id, lessonLevel, count)
    .map((question) => ({ ...question, source: 'generador', level: lessonLevel }));
}
