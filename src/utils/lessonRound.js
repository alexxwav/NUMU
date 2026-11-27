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
    const ids = new Set(published.map((exercise) => exercise?.id));
    // Catálogo v2 de Viviana: si `levels` ya incluye ejercicios publicados (el MISMO ejercicio: mismo
    // id y mismo contenido), cada nivel es el banco COMPLETO (p. ej. Conteo N2 = solo generador) y no
    // se le agregan los publicados. Un ejercicio que solo repite el id con otro contenido no cuenta.
    const publishedById = new Map(published.map((exercise) => [exercise?.id, JSON.stringify(exercise)]));
    const levelsAreComplete = Object.values(lesson.levels ?? {})
      .some((bank) => (bank?.exercises ?? []).some((exercise) => publishedById.get(exercise?.id) === JSON.stringify(exercise)));
    if (published.length === 0 || levelsAreComplete) {
      return { level: lessonLevel, format: 'v2', exercises: extension, generatorKey, ignoredIds: [] };
    }
    // Ampliación «delta» (solo ejercicios nuevos): se combina con los publicados del nivel.
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

/* ---------- Claves semánticas con el formato del adaptador de Viviana ----------
 * Contrato: JSON.stringify([tipo de habilidad, evidencia matemática]). El adaptador de Viviana
 * (exerciseSemanticKey) la calcula para los ejercicios del catálogo; los generadores no la traen.
 * Para que una pregunta generada y una del catálogo matemáticamente iguales se detecten como
 * repetidas, TODAS las preguntas de una ronda deben tener clave. Estas funciones la dan, con el
 * mismo formato, a las preguntas que llegan sin ella. Si la pregunta ya trae clave, se respeta. */
const SHAPE_BY_NAME = Object.freeze({ triángulo: 'triangle', cuadrado: 'square', pentágono: 'pentagon', hexágono: 'hexagon' });
const COLOR_BY_HEX = Object.freeze({ '#5124ee': 'Morado', '#ffc700': 'Amarillo', '#00d282': 'Verde', '#ff5a5f': 'Coral', '#00b4d8': 'Cian' });
const DEFAULT_EXERCISE_TYPE = Object.freeze({ objects: 'contar-objetos', shape: 'contar-lados', color_sequence: 'continuar-patron' });
const keyOf = (type, evidence) => JSON.stringify([type, evidence]);

/** Clave de un ejercicio del catálogo de los tipos actuales (objetos, suma/resta, figura, patrón). */
export function semanticKeyForExercise(exercise) {
  const visual = exercise?.visual;
  if (!visual || typeof visual !== 'object') return null;
  const type = visual.type === 'expression'
    ? (visual.operator === '-' ? 'resolver-resta' : 'resolver-suma')
    : DEFAULT_EXERCISE_TYPE[visual.type];
  // Tipos nuevos (o un tipo distinto del habitual) los resuelve el adaptador de Viviana.
  if (!type || (exercise.type && exercise.type !== type)) return null;
  switch (visual.type) {
    case 'objects': return Number.isInteger(visual.count) ? keyOf(type, [visual.count]) : null;
    case 'expression': return Array.isArray(visual.operands) && visual.operands.length === 2 ? keyOf(type, [...visual.operands]) : null;
    case 'shape': return typeof visual.shape === 'string' ? keyOf(type, [visual.shape]) : null;
    case 'color_sequence': return Array.isArray(visual.sequence) ? keyOf(type, visual.sequence.slice(0, 2)) : null;
    default: return null;
  }
}

/** Clave de una pregunta creada por un generador registrado (mismo formato que el catálogo). */
export function semanticKeyForGenerated(generatorKey, question) {
  const prompt = String(question?.prompt ?? '');
  const visual = String(question?.visual ?? '');
  switch (generatorKey) {
    case 'conteo': {
      const count = Number(visual.match(/aria-label="(\d+) /)?.[1]);
      return Number.isInteger(count) ? keyOf('contar-objetos', [count]) : null;
    }
    case 'aritmetica': {
      const match = prompt.match(/(\d+)\s*([+−-])\s*(\d+)/);
      if (!match) return null;
      return keyOf(match[2] === '+' ? 'resolver-suma' : 'resolver-resta', [Number(match[1]), Number(match[3])]);
    }
    case 'geometria': {
      const shape = SHAPE_BY_NAME[prompt.match(/tiene el (.+)\?/)?.[1]];
      return shape ? keyOf('contar-lados', [shape]) : null;
    }
    case 'patrones': {
      const colors = [...visual.matchAll(/background:\s*(#[0-9a-fA-F]{6})/g)].map((m) => COLOR_BY_HEX[m[1].toLowerCase()]);
      if (!colors.length || colors.some((c) => !c)) return null;
      const period = [1, 2, 3].find((p) => colors.every((c, i) => c === colors[i % p])) ?? colors.length;
      return keyOf('continuar-patron', colors.slice(0, Math.max(2, period)));
    }
    default: return null;
  }
}

const withKey = (question, key) => (question.semanticKey || !key ? question : { ...question, semanticKey: key });

/**
 * ¿Game.jsx puede mostrar la pregunta? Enunciado, visual HTML, al menos 2 opciones con texto
 * distinto y una respuesta correcta dentro de las opciones. Devuelve el motivo si no.
 */
export function representabilityProblem(question) {
  if (!question || typeof question !== 'object') return 'pregunta vacía';
  if (typeof question.prompt !== 'string' || !question.prompt.trim()) return 'sin enunciado';
  if (typeof question.visual !== 'string' || !question.visual.trim()) return 'sin representación visual';
  const labels = Array.isArray(question.options) ? question.options.map((o) => (typeof o?.label === 'string' ? o.label.trim() : '')) : [];
  if (labels.length < 2 || labels.some((l) => !l) || new Set(labels).size !== labels.length) return 'opciones vacías o repetidas';
  if (!Number.isInteger(question.answerIndex) || question.answerIndex < 0 || question.answerIndex >= labels.length) return 'respuesta fuera de las opciones';
  return null;
}

// Ejercicios editoriales convertidos al formato del juego; los que no se pueden adaptar
// (tipo de visual aún no admitido, datos incompletos) se informan y se omiten.
function adaptEditorial(exercises, random, level, reasons) {
  const adapted = [];
  for (const exercise of exercises) {
    try {
      const question = adaptExerciseToGame(shuffleExerciseOptions(exercise, random));
      const problem = representabilityProblem(question);
      if (problem) {
        reasons.push(`Ejercicio ${exercise?.id ?? '?'} no se puede mostrar: ${problem}.`);
        continue;
      }
      adapted.push({ ...withKey(question, semanticKeyForExercise(exercise)), source: 'catalogo', level });
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
        generatedSignatures.add(questionSignature(withKey(question, semanticKeyForGenerated(spec.generatorKey, question))));
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
export function selectLessonQuestions({ lesson, level, count = QUESTIONS_PER_ROUND, random = Math.random, avoidSignatures = [], preferTypes = [] } = {}) {
  const spec = lessonLevelSpec(lesson, level);
  // Motor adaptativo: firmas de la ronda anterior (evitarlas si hay alternativas) y tipos a reforzar.
  const avoid = new Set(avoidSignatures ?? []);
  const prefer = new Set(preferTypes ?? []);
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

  const editorial = adaptEditorial(spec.exercises, random, spec.level, reasons);
  // Generador registrado del nivel (si lo hay): se pide bajo demanda y se reutiliza lo ya generado.
  const hasGenerator = spec.generatorKey !== null && spec.generatorKey !== undefined;
  const canGenerate = hasGenerator && isKnownGenerator(spec.generatorKey);
  const generated = [];
  let budget = canGenerate ? count * GENERATOR_ATTEMPTS_PER_SLOT * (avoid.size || prefer.size ? 2 : 1) : 0;
  const generateOne = () => {
    while (budget-- > 0) {
      const [question] = generateQuestions(spec.generatorKey, spec.level, 1);
      if (question && !representabilityProblem(question)) {
        const item = { ...withKey(question, semanticKeyForGenerated(spec.generatorKey, question)), source: 'generador', level: spec.level };
        generated.push(item);
        return item;
      }
    }
    return null;
  };
  const fresh = (question) => !avoid.has(questionSignature(question));
  const fill = (accept) => {
    for (const question of [...editorial, ...generated]) { if (chosen.length >= count) return; if (accept(question)) take(question); }
    while (chosen.length < count) { const question = generateOne(); if (!question) return; if (accept(question)) take(question); }
  };

  // 1. Refuerzo: hasta MAX_REINFORCED preguntas de los tipos que el alumno más falló (no toda la ronda).
  if (prefer.size) {
    let reinforced = 0;
    const tryReinforce = (question) => {
      if (reinforced >= MAX_REINFORCED || chosen.length >= count) return;
      if (prefer.has(semanticTypeOf(question)) && take(question)) reinforced++;
    };
    for (const question of [...editorial.filter(fresh), ...editorial.filter((q) => !fresh(q))]) tryReinforce(question);
    let tries = count * GENERATOR_ATTEMPTS_PER_SLOT;
    while (reinforced < MAX_REINFORCED && canGenerate && tries-- > 0) {
      const question = generateOne();
      if (!question) break;
      if (fresh(question)) tryReinforce(question);
    }
  }
  // 2. Preguntas que NO salieron en la ronda anterior (catálogo primero, luego generador).
  fill(fresh);
  // 3. Solo si no alcanza: el mínimo de preguntas de la ronda anterior (nunca se bloquea la práctica).
  fill(() => true);
  if (hasGenerator && !canGenerate && editorial.length < count) {
    reasons.push(`Generador desconocido «${spec.generatorKey}»: no se usa ningún respaldo.`);
  }
  return result(chosen);
}

/** Máximo de preguntas de refuerzo (tipos fallados) por ronda: el resto sigue siendo variado. */
export const MAX_REINFORCED = 2;

/** Tipo de ejercicio de una pregunta (primer elemento de su clave semántica), o null. */
export function semanticTypeOf(question) {
  try {
    const key = JSON.parse(readSemanticKey(question));
    return Array.isArray(key) ? String(key[0]) : null;
  } catch {
    return null;
  }
}

/**
 * Tipos que más falló el alumno en una ronda (para reforzarlos en la siguiente de la misma lección).
 * @param {Record<string, number>} mistakesByType - { tipo: errores }.
 * @returns {string[]} Hasta 2 tipos con más errores (en empate, el primero que falló).
 */
export function weakTypesFrom(mistakesByType = {}) {
  return Object.entries(mistakesByType)
    .filter(([type, n]) => type && n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_REINFORCED)
    .map(([type]) => type);
}

/** ¿Es una de las lecciones actuales que el juego ya sabe armar (generador registrado)? */
export function hasLegacyRound(lesson) {
  return isKnownGenerator(lesson?.module_id);
}

/**
 * ¿Se puede practicar la lección en este nivel? Publicada y, además, una de las 4 actuales
 * (su flujo de juego existe) o con 6 preguntas distintas en ese nivel (selector v2).
 * Misma condición que usan el juego (planLessonRound), el recomendador (C16) y «Continuar».
 */
export function isLessonPlayable(lesson, level) {
  if (!isLessonPublished(lesson)) return false;
  if (hasLegacyRound(lesson)) return true;
  return lessonCoverage({ lesson, level, samples: 60 }).playable;
}

/**
 * Cómo arma Game.jsx la ronda de una lección (contrato v1.1 §4). Nunca usa conteo como respaldo.
 * · 'unavailable': lección no publicada (también por URL directa), sin contenido para el nivel
 *   o sin forma segura de armar 6 preguntas distintas → «Práctica no disponible», sin guardar nada.
 * · 'selector':    lección con `levels` (v2 o ampliación) y 6 preguntas distintas jugables.
 *   Las 4 lecciones actuales también usan el selector (mismas fuentes, sin repetir preguntas).
 * · 'legacy':      buildLessonRound, igual que siempre, solo para las 4 lecciones actuales que todavía
 *   no reúnen 6 preguntas distintas (Figuras) o cuya ampliación aún no es jugable (falta el adaptador
 *   de Viviana): se conserva temporalmente para no romper el juego actual.
 * @returns {{mode: 'legacy'|'selector'|'unavailable', questions: Object[], reasons: string[]}}
 */
export function planLessonRound({ lesson, level, count = QUESTIONS_PER_ROUND, random = Math.random, avoidSignatures = [], preferTypes = [] } = {}) {
  const adaptive = { avoidSignatures, preferTypes };
  if (!lesson) return { mode: 'unavailable', questions: [], reasons: ['La lección no existe en el catálogo.'] };
  if (!isLessonPublished(lesson)) return { mode: 'unavailable', questions: [], reasons: ['La lección no está publicada.'] };

  const legacy = () => ({ mode: 'legacy', questions: buildLessonRound({ lesson, level, count, random }), reasons: [] });
  const hasLevels = Boolean(lesson.levels) && typeof lesson.levels === 'object' && Object.keys(lesson.levels).length > 0;
  if (hasLevels) {
    const selection = selectLessonQuestions({ lesson, level, count, random, ...adaptive });
    if (selection.playable) return { mode: 'selector', questions: selection.questions, reasons: selection.reasons };
    if (hasLegacyRound(lesson)) return { ...legacy(), reasons: selection.reasons };
    return { mode: 'unavailable', questions: [], reasons: selection.reasons };
  }
  if (hasLegacyRound(lesson)) {
    // Mismas fuentes que buildLessonRound (catálogo en N1 y el mismo generador con R12–R14), pero
    // sin repetir preguntas (contrato v1.1 §4). Si no llega a 6 distintas (Figuras, hasta integrar
    // la ampliación de Viviana), se conserva temporalmente el flujo legacy.
    const selection = selectLessonQuestions({ lesson, level, count, random, ...adaptive });
    if (selection.playable) return { mode: 'selector', questions: selection.questions, reasons: [] };
    return { ...legacy(), reasons: selection.reasons };
  }
  return { mode: 'unavailable', questions: [], reasons: ['La lección no tiene ejercicios por nivel ni un generador registrado.'] };
}
