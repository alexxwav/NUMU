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

/* ------------------------------------------------------------------------------------------
 * Selector v2 (contrato compartido v1.1 §3–§4). Todavía NO lo usa Game.jsx: las cuatro
 * lecciones actuales siguen jugándose con buildLessonRound hasta autorizar el cambio.
 *
 * · Cada lección se identifica por lesson.id; el nivel académico es 1, 2 o 3.
 * · Formato v2: lesson.levels["1" | "2" | "3"] = { exercises, generator_key?, exercise_types? }.
 * · Lecciones actuales sin `levels` (capa de compatibilidad): nivel 1 = ejercicios del catálogo
 *   que cumplen fitsLevelOne + generador de su module_id; niveles 2 y 3 = ese generador.
 * · Lecciones actuales CON ampliación en `levels` (formato combinado, p. ej. Figuras): sus
 *   ejercicios publicados del nivel + los de la ampliación; generador solo si el nivel lo declara.
 * · Preguntas iguales: misma semanticKey ([habilidad, evidencia]) o, sin ella, mismo enunciado,
 *   visual (sin giro ni escala) y respuesta.
 * · Solo se usan generadores registrados. Una clave desconocida NO cae en conteo: no genera nada.
 * · Una ronda necesita 6 preguntas distintas (enunciado, visual y respuesta). Si no alcanzan,
 *   la lección no es jugable en ese nivel; no se inventan ni se repiten preguntas.
 * ------------------------------------------------------------------------------------------ */

/** Generadores de src/state/questions.js autorizados para lecciones. */
export const GENERATOR_KEYS = Object.freeze(['conteo', 'aritmetica', 'geometria', 'patrones']);

/** Intentos máximos para pedir al generador preguntas distintas por cada pregunta que falta. */
const GENERATOR_ATTEMPTS_PER_SLOT = 40;
/** Muestras del generador para estimar su cobertura en lessonCoverage. */
const COVERAGE_SAMPLES = 400;

export function isKnownGenerator(key) {
  return typeof key === 'string' && GENERATOR_KEYS.includes(key);
}

/** ¿La lección puede mostrarse a los niños? Las lecciones actuales no traen `published`. */
export function isLessonPublished(lesson) {
  return Boolean(lesson) && lesson.published !== false;
}

/**
 * Qué contenido corresponde a una lección en un nivel:
 * · 'v2': lección nueva, solo levels[nivel].
 * · 'combined': lección existente con ampliación (p. ej. Figuras): sus ejercicios publicados
 *   del nivel (N1: los que cumplen fitsLevelOne; N2 y N3: todos, el hexágono entra desde N2)
 *   seguidos de levels[nivel].exercises. Solo usa generador si el nivel lo declara.
 * · 'legacy': lección actual sin ampliación (capa de compatibilidad, igual que buildLessonRound).
 * Si un ejercicio de la ampliación repite el id de uno publicado, se conserva el original
 * y el repetido se informa en ignoredIds.
 * @returns {{level: number, format: 'v2'|'combined'|'legacy', exercises: Object[],
 *   generatorKey: string|null, ignoredIds: string[]}}
 */
export function lessonLevelSpec(lesson, level) {
  const lessonLevel = clampLessonLevel(level);
  const published = Array.isArray(lesson?.exercises) ? lesson.exercises : [];
  const publishedForLevel = lessonLevel === 1 ? published.filter(fitsLevelOne) : published;
  const v2 = lesson?.levels?.[String(lessonLevel)];
  if (v2 && typeof v2 === 'object' && !Array.isArray(v2)) {
    const extension = Array.isArray(v2.exercises) ? v2.exercises : [];
    const generatorKey = v2.generator_key ?? null;
    if (published.length === 0) {
      return { level: lessonLevel, format: 'v2', exercises: extension, generatorKey, ignoredIds: [] };
    }
    const ids = new Set(published.map((exercise) => exercise?.id));
    const ignoredIds = extension.filter((exercise) => ids.has(exercise?.id)).map((exercise) => exercise.id);
    return {
      level: lessonLevel,
      format: 'combined',
      exercises: [...publishedForLevel, ...extension.filter((exercise) => !ids.has(exercise?.id))],
      generatorKey,
      ignoredIds,
    };
  }
  return {
    level: lessonLevel,
    format: 'legacy',
    exercises: lessonLevel === 1 ? publishedForLevel : [],
    generatorKey: lesson?.module_id ?? null,
    ignoredIds: [],
  };
}

// Normaliza texto para comparar: sin acentos, signos ni mayúsculas, y sin variaciones de
// concordancia que no cambian la pregunta («cuántos/cuántas», «el/este/la/esta…»).
function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[¿?¡!.,;:«»"']/g, ' ')
    .replace(/\bcuant[oa]s?\b/g, 'cuant')
    .replace(/\b(el|la|los|las|este|esta|estos|estas)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Respaldo para preguntas sin semanticKey (catálogo actual y generadores): rasgos con
// significado del visual HTML, iguales si vienen del catálogo o de un generador:
// etiquetas accesibles, texto visible, colores en orden y vértices de la figura.
// El giro y la escala NO cuentan: son decorativos (una figura girada o pequeña es la misma).
function visualKey(html) {
  const source = String(html ?? '');
  return JSON.stringify({
    labels: [...source.matchAll(/aria-label="([^"]*)"/g)].map((match) => normalizeText(match[1])),
    text: normalizeText(source.replace(/<[^>]*>/g, ' ')),
    colors: [...source.matchAll(/background:\s*(#[0-9a-fA-F]{3,8})/g)].map((match) => match[1].toLowerCase()),
    points: [...source.matchAll(/points="([^"]*)"/g)].map((match) => match[1].trim()),
  });
}

/**
 * Clave semántica válida según el contrato acordado con Viviana:
 * exerciseSemanticKey(exercise) → JSON.stringify([type, evidencia]), con type texto no vacío.
 * Devuelve null si no existe o no cumple el formato (entonces se usa el respaldo).
 */
export function readSemanticKey(question) {
  const key = question?.semanticKey;
  if (typeof key !== 'string' || !key.trim()) return null;
  try {
    const parsed = JSON.parse(key);
    if (!Array.isArray(parsed) || parsed.length !== 2 || typeof parsed[0] !== 'string' || !parsed[0].trim()) return null;
    return JSON.stringify(parsed); // forma canónica: espacios del JSON original no cuentan
  } catch {
    return null;
  }
}

/**
 * Firma semántica de una pregunta.
 * · Con semanticKey ([tipo de habilidad, evidencia matemática]) se usa solo esa clave: el
 *   enunciado, el giro, la escala, las letras de las tarjetas y el orden de opciones no cuentan.
 * · Sin semanticKey: enunciado normalizado + rasgos del visual (sin giro ni escala) + respuesta.
 *   El orden de las opciones, los identificadores y los cambios de marcado no la cambian.
 */
export function questionSignature(question) {
  const semantic = readSemanticKey(question);
  if (semantic) return JSON.stringify(['semantica', semantic]);
  const answer = question?.options?.[question?.answerIndex];
  return JSON.stringify([
    normalizeText(question?.prompt),
    visualKey(question?.visual),
    normalizeText(answer?.label ?? answer),
  ]);
}

// Ejercicios editoriales convertidos al formato del juego; los que no se pueden adaptar
// (tipo de visual aún no admitido, datos incompletos) se informan y se omiten.
function adaptEditorial(exercises, random, level, reasons) {
  const adapted = [];
  for (const exercise of exercises) {
    try {
      adapted.push({ ...adaptExerciseToGame(shuffleExerciseOptions(exercise, random)), source: 'catalogo', level });
    } catch (error) {
      reasons.push(`Ejercicio ${exercise?.id ?? '?'} no se puede usar: ${error.message}`);
    }
  }
  return adapted;
}

/**
 * Cuántas preguntas distintas hay para una lección en un nivel.
 * La parte del generador es una estimación por muestreo (no exhaustiva).
 * @returns {{lessonId: string|null, level: number, format: string, published: boolean,
 *   generatorKey: string|null, editorial: number, generated: number, distinct: number,
 *   needed: number, playable: boolean, reasons: string[]}}
 */
export function lessonCoverage({ lesson, level, needed = QUESTIONS_PER_ROUND, samples = COVERAGE_SAMPLES, random = Math.random } = {}) {
  const spec = lessonLevelSpec(lesson, level);
  const reasons = spec.ignoredIds.map((id) => `Ejercicio ${id} de la ampliación repite un id publicado: se conserva el original.`);
  const published = isLessonPublished(lesson);
  if (!published) reasons.push('La lección no está publicada.');

  const editorialSignatures = new Set(adaptEditorial(spec.exercises, random, spec.level, reasons).map(questionSignature));
  const generatedSignatures = new Set();
  if (spec.generatorKey !== null && spec.generatorKey !== undefined) {
    if (isKnownGenerator(spec.generatorKey)) {
      for (const question of generateQuestions(spec.generatorKey, spec.level, samples)) {
        generatedSignatures.add(questionSignature(question));
      }
    } else {
      reasons.push(`Generador desconocido «${spec.generatorKey}»: no se usa ningún respaldo.`);
    }
  }

  const distinct = new Set([...editorialSignatures, ...generatedSignatures]).size;
  if (distinct < needed) reasons.push(`Cobertura insuficiente: ${distinct} preguntas distintas de ${needed}.`);
  return {
    lessonId: lesson?.id ?? null,
    level: spec.level,
    format: spec.format,
    published,
    generatorKey: spec.generatorKey,
    editorial: editorialSignatures.size,
    generated: generatedSignatures.size,
    distinct,
    needed,
    playable: published && distinct >= needed,
    reasons,
  };
}

/**
 * Hasta `count` preguntas distintas para la lección y el nivel: primero las editoriales
 * (en el orden del catálogo) y después las del generador registrado. Nunca repite preguntas
 * ni usa conteo como respaldo. Si no alcanzan, devuelve las que hay con playable = false.
 * @returns {{lessonId: string|null, level: number, questions: Object[], playable: boolean,
 *   distinct: number, needed: number, source: 'catalogo'|'generador'|'catalogo+generador'|'ninguno',
 *   reasons: string[]}}
 */
export function selectLessonQuestions({ lesson, level, count = QUESTIONS_PER_ROUND, random = Math.random } = {}) {
  const spec = lessonLevelSpec(lesson, level);
  const reasons = spec.ignoredIds.map((id) => `Ejercicio ${id} de la ampliación repite un id publicado: se conserva el original.`);
  const result = (questions) => {
    const sources = new Set(questions.map((question) => question.source));
    const playable = isLessonPublished(lesson) && questions.length >= count;
    if (questions.length < count) reasons.push(`Cobertura insuficiente: ${questions.length} preguntas distintas de ${count}.`);
    return {
      lessonId: lesson?.id ?? null,
      level: spec.level,
      questions,
      playable,
      distinct: questions.length,
      needed: count,
      source: sources.size === 2 ? 'catalogo+generador' : ([...sources][0] ?? 'ninguno'),
      reasons,
    };
  };
  if (!isLessonPublished(lesson)) {
    reasons.push('La lección no está publicada.');
    return result([]);
  }

  const chosen = [];
  const seen = new Set();
  const take = (question) => {
    const signature = questionSignature(question);
    if (seen.has(signature)) return false;
    seen.add(signature);
    chosen.push(question);
    return true;
  };

  for (const question of adaptEditorial(spec.exercises, random, spec.level, reasons)) {
    if (chosen.length >= count) break;
    take(question);
  }

  if (chosen.length < count && spec.generatorKey !== null && spec.generatorKey !== undefined) {
    if (!isKnownGenerator(spec.generatorKey)) {
      reasons.push(`Generador desconocido «${spec.generatorKey}»: no se usa ningún respaldo.`);
    } else {
      let attempts = (count - chosen.length) * GENERATOR_ATTEMPTS_PER_SLOT;
      while (chosen.length < count && attempts-- > 0) {
        const [question] = generateQuestions(spec.generatorKey, spec.level, 1);
        if (question) take({ ...question, source: 'generador', level: spec.level });
      }
    }
  }
  return result(chosen);
}
