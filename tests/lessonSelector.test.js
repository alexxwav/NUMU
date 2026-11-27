// Bloque 1 · Selector v2 de preguntas por lección y nivel (contrato v1.1 §3–§4).
// El juego todavía usa buildLessonRound; estas pruebas cubren el selector nuevo y que el flujo
// actual de las cuatro lecciones no cambió.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildLessonRound, selectLessonQuestions, lessonCoverage, lessonLevelSpec,
  questionSignature, isKnownGenerator, GENERATOR_KEYS, QUESTIONS_PER_ROUND,
} from '../src/utils/lessonRound.js';

const catalog = JSON.parse(readFileSync(new URL('../src/data/lessonContent.json', import.meta.url), 'utf8'));
const lessons = Object.fromEntries(catalog.courses.flatMap((c) => c.lessons).map((l) => [l.id, l]));
const LEVELS = [1, 2, 3];
const RUNS = 40;
const signatures = (questions) => questions.map(questionSignature);
const looksLikeCounting = (q) => /cu[aá]nt[oa]s .+ ves\?/i.test(q.prompt ?? '');

// Ejercicio editorial mínimo válido (visual de objetos) para catálogos de prueba v2.
function objectsExercise(id, count, icon = 'star', options = null) {
  const opts = options ?? [count - 1, count, count + 1, count + 2].map((n) => Math.max(0, n));
  return {
    id, prompt: '¿Cuántas estrellas ves?', visual: { type: 'objects', icon, count },
    options: opts, answer_index: opts.indexOf(count), correct_answer: count,
    hint: 'Cuenta una por una.', feedback_correct: '¡Bien!', feedback_incorrect: 'Intenta de nuevo.',
  };
}
function sumExercise(id, a, b) {
  const sum = a + b;
  const options = [sum - 1, sum, sum + 1, sum + 2];
  return {
    id, prompt: `¿Cuánto es ${a} + ${b}?`, visual: { type: 'expression', operator: '+', operands: [a, b] },
    options, answer_index: 1, correct_answer: sum,
    hint: 'Empieza en el primero.', feedback_correct: '¡Bien!', feedback_incorrect: 'Intenta de nuevo.',
  };
}

test('las cuatro lecciones conservan sus IDs y el flujo actual (buildLessonRound) no cambió', () => {
  for (const id of ['conteo-basico', 'sumas-basicas', 'figuras', 'patrones']) {
    assert.ok(lessons[id], `falta ${id}`);
    for (const level of LEVELS) {
      const round = buildLessonRound({ lesson: lessons[id], level });
      assert.equal(round.length, QUESTIONS_PER_ROUND, `${id} N${level}`);
      assert.ok(round.every((q) => q.level === level));
      if (level > 1) assert.ok(round.every((q) => q.source === 'generador'), `${id} N${level}: niveles 2–3 siguen con generador`);
    }
  }
});

test('capa de compatibilidad: las lecciones actuales se leen como formato legacy por nivel', () => {
  const conteo = lessonLevelSpec(lessons['conteo-basico'], 1);
  assert.equal(conteo.format, 'legacy');
  assert.equal(conteo.generatorKey, 'conteo');
  assert.ok(conteo.exercises.every((e) => e.visual.count <= 5), 'nivel 1 usa solo ejercicios que caben (fitsLevelOne)');
  assert.deepEqual(lessonLevelSpec(lessons.figuras, 2).exercises, [], 'niveles 2–3 no usan ejercicios editoriales');
  assert.equal(lessonLevelSpec(lessons.patrones, 9).level, 3, 'el nivel se acota a 1–3');
});

// Con la evidencia semántica de Viviana para contar objetos (solo la cantidad), Conteo N1 y N2
// no llegan a 6 cantidades distintas (N1: 2–5 objetos; N2: 2–6). Decisión educativa pendiente.
test('conteo N1 y N2: cobertura semántica insuficiente (4 y 5 cantidades distintas), se informa', () => {
  assert.equal(lessonCoverage({ lesson: lessons['conteo-basico'], level: 1 }).distinct, 4);
  assert.equal(lessonCoverage({ lesson: lessons['conteo-basico'], level: 2 }).distinct, 5);
  for (const level of [1, 2]) {
    const result = selectLessonQuestions({ lesson: lessons['conteo-basico'], level });
    assert.equal(result.playable, false);
    assert.equal(new Set(signatures(result.questions)).size, result.questions.length, 'sin repetir para completar');
  }
});

test('conteo N3, sumas y patrones N1–N3: 6 preguntas distintas', () => {
  for (const id of ['conteo-basico', 'sumas-basicas', 'patrones']) {
    for (const level of id === 'conteo-basico' ? [3] : LEVELS) {
      for (let run = 0; run < RUNS; run++) {
        const result = selectLessonQuestions({ lesson: lessons[id], level });
        assert.equal(result.playable, true, `${id} N${level}`);
        assert.equal(result.questions.length, QUESTIONS_PER_ROUND);
        assert.equal(new Set(signatures(result.questions)).size, QUESTIONS_PER_ROUND, `${id} N${level}: sin repetidas`);
        assert.ok(result.questions.every((q) => q.level === level));
      }
    }
  }
});

test('figuras: cobertura insuficiente en los tres niveles (se informa, no se rellena)', () => {
  // Pendiente de Viviana (contrato v1.1 §4): ampliar Figuras con variaciones reales.
  // N1: triángulo, cuadrado y pentágono (G05 y G06 solo cambian giro/tamaño: no cuentan aparte).
  // N2–N3: el generador solo tiene 4 figuras.
  const expected = { 1: 3, 2: 4, 3: 4 };
  for (const level of LEVELS) {
    const coverage = lessonCoverage({ lesson: lessons.figuras, level });
    assert.equal(coverage.playable, false, `figuras N${level}`);
    assert.equal(coverage.distinct, expected[level], `figuras N${level}: preguntas distintas`);
    assert.ok(coverage.reasons.some((r) => r.startsWith('Cobertura insuficiente')));

    const result = selectLessonQuestions({ lesson: lessons.figuras, level });
    assert.equal(result.playable, false);
    assert.equal(result.questions.length, expected[level], 'no se repiten preguntas para completar 6');
    assert.equal(new Set(signatures(result.questions)).size, result.questions.length);
  }
});

test('deduplicación semántica: cambiar el orden de opciones, el id o la concordancia no cuenta como distinta', () => {
  const lesson = {
    id: 'prueba-dedupe', published: true,
    levels: { 1: { exercises: [
      objectsExercise('D1', 4),
      objectsExercise('D2', 4, 'star', [6, 5, 4, 3]),                                // otro orden de opciones
      { ...objectsExercise('D3', 4), prompt: '¿Cuántos estrellas ves?' },           // solo cambia la concordancia
      objectsExercise('D4', 5),
    ] } },
  };
  const coverage = lessonCoverage({ lesson, level: 1 });
  assert.equal(coverage.distinct, 2);
  const result = selectLessonQuestions({ lesson, level: 1 });
  assert.deepEqual(result.questions.map((q) => q.id), ['D1', 'D4']);
  assert.equal(result.playable, false);
});

test('el catálogo y el generador se deduplican entre sí (misma figura, mismo enunciado y respuesta)', () => {
  const [catalogTriangle] = selectLessonQuestions({ lesson: { ...lessons.figuras, module_id: null }, level: 1 }).questions;
  const generated = selectLessonQuestions({ lesson: { id: 'solo-gen', levels: { 1: { exercises: [], generator_key: 'geometria' } } }, level: 1 });
  assert.ok(generated.questions.some((q) => questionSignature(q) === questionSignature(catalogTriangle)),
    'el triángulo del generador tiene la misma firma que el del catálogo');
});

test('formato v2: usa levels["1"|"2"|"3"] y el generador registrado de cada nivel', () => {
  const lesson = {
    id: 'v2-mixta', published: true,
    levels: {
      1: { exercises: [1, 2, 3, 4, 5, 6].map((n) => objectsExercise(`O${n}`, n)) },
      2: { exercises: [sumExercise('S1', 1, 2), sumExercise('S2', 2, 2)], generator_key: 'aritmetica' },
      3: { exercises: [], generator_key: 'patrones' },
    },
  };
  const n1 = selectLessonQuestions({ lesson, level: 1 });
  assert.equal(n1.playable, true);
  assert.equal(n1.source, 'catalogo');
  const n2 = selectLessonQuestions({ lesson, level: 2 });
  assert.equal(n2.playable, true);
  assert.equal(n2.source, 'catalogo+generador');
  assert.deepEqual(n2.questions.slice(0, 2).map((q) => q.id), ['S1', 'S2'], 'primero las editoriales');
  const n3 = selectLessonQuestions({ lesson, level: 3 });
  assert.equal(n3.source, 'generador');
  assert.ok(n3.questions.every((q) => q.options.some((o) => o.color)), 'nivel 3 usa el generador de patrones');
});

test('cobertura insuficiente en v2: 3 ejercicios y sin generador → no jugable, sin inventar ni repetir', () => {
  const lesson = { id: 'v2-corta', published: true, levels: { 2: { exercises: [1, 2, 3].map((n) => objectsExercise(`C${n}`, n)) } } };
  const result = selectLessonQuestions({ lesson, level: 2 });
  assert.equal(result.playable, false);
  assert.equal(result.questions.length, 3);
  assert.equal(lessonCoverage({ lesson, level: 2 }).distinct, 3);
});

test('generadores desconocidos: no se usa conteo como respaldo', () => {
  assert.deepEqual([...GENERATOR_KEYS], ['conteo', 'aritmetica', 'geometria', 'patrones']);
  assert.equal(isKnownGenerator('algebra'), false);
  const v2 = { id: 'la-balanza-de-numu', published: true, levels: { 2: { exercises: [], generator_key: 'algebra' } } };
  const legacy = { id: 'leccion-sin-generador', module_id: 'trigonometria', exercises: [] };
  for (const [lesson, level] of [[v2, 2], [legacy, 3]]) {
    const result = selectLessonQuestions({ lesson, level });
    assert.equal(result.playable, false);
    assert.equal(result.questions.length, 0);
    assert.ok(!result.questions.some(looksLikeCounting));
    assert.ok(result.reasons.some((r) => r.includes('Generador desconocido')));
    assert.equal(lessonCoverage({ lesson, level }).playable, false);
  }
});

test('ejercicios con tipos aún no admitidos por el adaptador se informan y se omiten', () => {
  const lesson = { id: 'tipo-nuevo', published: true, levels: { 1: { exercises: [
    { ...objectsExercise('X1', 3), visual: { type: 'equation', left: 'x + 2', right: 5 } },
    objectsExercise('X2', 2),
  ] } } };
  const result = selectLessonQuestions({ lesson, level: 1 });
  assert.deepEqual(result.questions.map((q) => q.id), ['X2']);
  assert.ok(result.reasons.some((r) => r.startsWith('Ejercicio X1 no se puede usar')));
});

test('lección no publicada: no jugable en ningún nivel', () => {
  const lesson = { ...lessons['conteo-basico'], published: false };
  for (const level of LEVELS) {
    assert.equal(selectLessonQuestions({ lesson, level }).playable, false);
    assert.equal(lessonCoverage({ lesson, level }).playable, false);
  }
});

test('el selector no modifica el catálogo', () => {
  const before = JSON.stringify(catalog);
  for (const lesson of Object.values(lessons)) for (const level of LEVELS) {
    selectLessonQuestions({ lesson, level });
    lessonCoverage({ lesson, level, samples: 20 });
  }
  assert.equal(JSON.stringify(catalog), before);
});
