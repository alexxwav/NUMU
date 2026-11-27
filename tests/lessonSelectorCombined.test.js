// Bloque 2A · Lección existente + ampliación por niveles, y firma semántica (semanticKey).
// Fixtures independientes: no se importa nada de la rama de Viviana ni se cambia el catálogo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildLessonRound, selectLessonQuestions, lessonCoverage, lessonLevelSpec,
  questionSignature, readSemanticKey, isLessonPublished, QUESTIONS_PER_ROUND,
} from '../src/utils/lessonRound.js';
import { adaptExerciseToGame } from '../src/utils/lessonGameAdapter.js';

const catalog = JSON.parse(readFileSync(new URL('../src/data/lessonContent.json', import.meta.url), 'utf8'));
const lessons = Object.fromEntries(catalog.courses.flatMap((c) => c.lessons).map((l) => [l.id, l]));
const figuras = lessons.figuras;
const byId = (id) => figuras.exercises.find((e) => e.id === id);
const sig = (q) => questionSignature(q);

// Ejercicio de ampliación con un visual que el adaptador actual ya admite y una semanticKey
// con el formato acordado: JSON.stringify([tipo, evidencia]).
function extension(id, type, evidence, count = 3) {
  const options = [count - 1, count, count + 1, count + 2];
  return {
    id, type, prompt: `Pregunta ${id}`, visual: { type: 'objects', icon: 'star', count },
    options, answer_index: 1, correct_answer: count,
    hint: 'Observa con calma.', feedback_correct: '¡Bien!', feedback_incorrect: 'Intenta de nuevo.',
    semanticKey: JSON.stringify([type, evidence]),
  };
}
// Figuras publicada + ampliación (como figuras-ampliacion de Viviana: sin generador declarado).
function figurasWith(levels) {
  return { ...figuras, levels };
}

test('las cuatro lecciones sin ampliación conservan el formato legacy y buildLessonRound', () => {
  for (const id of ['conteo-basico', 'sumas-basicas', 'figuras', 'patrones']) {
    for (const level of [1, 2, 3]) {
      const spec = lessonLevelSpec(lessons[id], level);
      assert.equal(spec.format, 'legacy', `${id} N${level}`);
      assert.equal(spec.generatorKey, lessons[id].module_id);
      assert.deepEqual(spec.ignoredIds, []);
      assert.equal(buildLessonRound({ lesson: lessons[id], level }).length, QUESTIONS_PER_ROUND);
    }
  }
});

test('combinado N1: publicados que cumplen fitsLevelOne + ampliación, con ids originales y sin generador', () => {
  const lesson = figurasWith({ 1: { exercises: [extension('X1', 'emparejar-figura', ['square'])] } });
  const spec = lessonLevelSpec(lesson, 1);
  assert.equal(spec.format, 'combined');
  assert.equal(spec.generatorKey, null, 'sin generador si el nivel no lo declara');
  assert.deepEqual(spec.exercises.map((e) => e.id), ['G01', 'G02', 'G03', 'G05', 'G06', 'X1'], 'sin el hexágono en N1');
  assert.equal(spec.exercises[0], byId('G01'), 'el ejercicio original se usa tal cual');
});

test('combinado N2 y N3: todos los publicados (incluido el hexágono) + ampliación', () => {
  const lesson = figurasWith({ 2: { exercises: [extension('Y1', 'sumar-lados', [[3, 4]])] }, 3: { exercises: [] } });
  assert.deepEqual(lessonLevelSpec(lesson, 2).exercises.map((e) => e.id), ['G01', 'G02', 'G03', 'G04', 'G05', 'G06', 'Y1']);
  assert.deepEqual(lessonLevelSpec(lesson, 3).exercises.map((e) => e.id), ['G01', 'G02', 'G03', 'G04', 'G05', 'G06']);
  assert.equal(lessonLevelSpec(lesson, 3).format, 'combined');
});

test('Figuras combinada alcanza 6 distintas: N1 = 3 publicadas + 3 nuevas; N2 = 4 publicadas + 2 nuevas', () => {
  const lesson = figurasWith({
    1: { exercises: [
      extension('N1a', 'emparejar-figura', [['pentagon', 'square', 'triangle', 'triangle'], 'square', null]),
      extension('N1b', 'contar-lados-sin-marcar', ['triangle', 1]),
      extension('N1c', 'elegir-por-lados', [['pentagon', 'square', 'triangle', 'triangle'], null, 4]),
    ] },
    2: { exercises: [
      extension('N2a', 'nombrar-figura', ['hexagon', null]),
      extension('N2b', 'sumar-lados', [['square', 'triangle'], null, null]),
    ] },
  });
  for (const level of [1, 2]) {
    const coverage = lessonCoverage({ lesson, level });
    assert.equal(coverage.distinct, 6, `N${level}`);
    assert.equal(coverage.generated, 0, 'no se usa el generador de geometría');
    assert.equal(coverage.playable, true);
    const result = selectLessonQuestions({ lesson, level });
    assert.equal(result.playable, true);
    assert.equal(result.questions.length, 6);
    assert.equal(new Set(result.questions.map(sig)).size, 6, 'sin duplicados semánticos');
    assert.ok(result.questions.every((q) => q.source === 'catalogo'));
    assert.equal(isLessonPublished(lesson), true, 'Figuras sigue publicada');
  }
});

test('cobertura insuficiente en la combinación: se informa sin inventar ni repetir', () => {
  const lesson = figurasWith({ 3: { exercises: [extension('Z1', 'elegir-mas-lados', [['hexagon', 'square'], null, null])] } });
  const coverage = lessonCoverage({ lesson, level: 3 });
  assert.equal(coverage.distinct, 5, '4 publicadas + 1 nueva');
  assert.equal(coverage.playable, false);
  const result = selectLessonQuestions({ lesson, level: 3 });
  assert.equal(result.playable, false);
  assert.equal(result.questions.length, 5);
  assert.equal(new Set(result.questions.map(sig)).size, 5);
});

test('una ampliación que repite un id publicado conserva el original y lo informa', () => {
  const impostor = { ...extension('G01', 'nombrar-figura', ['triangle', null]) };
  const lesson = figurasWith({ 1: { exercises: [impostor] } });
  const spec = lessonLevelSpec(lesson, 1);
  assert.deepEqual(spec.ignoredIds, ['G01']);
  assert.equal(spec.exercises.filter((e) => e.id === 'G01').length, 1);
  assert.equal(spec.exercises.find((e) => e.id === 'G01'), byId('G01'));
  assert.ok(selectLessonQuestions({ lesson, level: 1 }).reasons.some((r) => r.includes('G01')));
});

test('ampliación duplicada semánticamente con otra pregunta del mismo nivel no cuenta dos veces', () => {
  const lesson = figurasWith({ 1: { exercises: [
    extension('D1', 'contar-lados-sin-marcar', ['square', 1], 3),
    { ...extension('D2', 'contar-lados-sin-marcar', ['square', 1], 3), prompt: 'Otra redacción', visual: { type: 'objects', icon: 'ball', count: 3 } },
  ] } });
  assert.equal(lessonCoverage({ lesson, level: 1 }).distinct, 4, '3 publicadas + 1 (D2 repite la evidencia de D1)');
});

test('semanticKey: misma clave = misma pregunta aunque cambien enunciado, visual, letras u opciones', () => {
  const a = { prompt: '¿Qué tarjeta tiene un cuadrado?', visual: '<div>A B C D</div>', options: [{ label: 'C' }, { label: 'A' }], answerIndex: 0,
    semanticKey: JSON.stringify(['emparejar-figura', [['pentagon', 'square'], 'square']]) };
  const b = { prompt: 'Busca el cuadrado', visual: '<div>D C B A</div>', options: [{ label: 'B' }, { label: 'D' }], answerIndex: 1,
    semanticKey: '["emparejar-figura", [["pentagon","square"], "square"]]' };
  assert.equal(sig(a), sig(b));
  const c = { ...a, semanticKey: JSON.stringify(['emparejar-figura', [['pentagon', 'square'], 'pentagon']]) };
  assert.notEqual(sig(a), sig(c), 'otra evidencia matemática es otra pregunta');
  const d = { ...a, semanticKey: JSON.stringify(['elegir-por-lados', [['pentagon', 'square'], 'square']]) };
  assert.notEqual(sig(a), sig(d), 'otra habilidad es otra pregunta');
});

test('semanticKey inválida se ignora y se usa el respaldo', () => {
  for (const key of ['', '   ', 'no-json', '["solo-tipo"]', '[1, 2]', '{"a":1}', 42]) {
    assert.equal(readSemanticKey({ semanticKey: key }), null, String(key));
  }
  const base = adaptExerciseToGame(byId('G01'));
  assert.equal(sig({ ...base, semanticKey: 'no-json' }), sig(base));
});

test('la semanticKey del catálogo llega a la pregunta adaptada y la reconoce el selector', () => {
  const question = adaptExerciseToGame(extension('S1', 'nombrar-figura', ['square', null]));
  assert.equal(readSemanticKey(question), JSON.stringify(['nombrar-figura', ['square', null]]));
});

test('respaldo sin semanticKey: el giro y el tamaño no crean preguntas distintas', () => {
  const [g01, g02, g05, g06, g03] = ['G01', 'G02', 'G05', 'G06', 'G03'].map((id) => adaptExerciseToGame(byId(id)));
  assert.equal(byId('G05').visual.rotation_degrees, 90);
  assert.equal(byId('G06').visual.size, 'small');
  assert.equal(sig(g05), sig(g01), 'triángulo girado = triángulo');
  assert.equal(sig(g06), sig(g02), 'cuadrado pequeño = cuadrado');
  assert.notEqual(sig(g01), sig(g02));
  assert.notEqual(sig(g02), sig(g03));
  const published = new Set(figuras.exercises.map((e) => sig(adaptExerciseToGame(e))));
  assert.equal(published.size, 4, 'G01–G06: triángulo, cuadrado, pentágono y hexágono');
});

test('respaldo sin semanticKey: conteo, sumas y patrones siguen distinguiendo sus preguntas', () => {
  for (const id of ['conteo-basico', 'sumas-basicas', 'patrones']) {
    const adapted = lessons[id].exercises.map((e) => sig(adaptExerciseToGame(e)));
    assert.equal(new Set(adapted).size, lessons[id].exercises.length, `${id}: sus 6 ejercicios siguen siendo distintos`);
  }
});
