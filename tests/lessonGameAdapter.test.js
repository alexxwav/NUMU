import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { adaptExerciseToGame } from '../src/utils/lessonGameAdapter.js';
import { shuffleExerciseOptions } from '../src/utils/lessonContent.js';
import { generateQuestions } from '../src/state/questions.js';

const catalog = JSON.parse(readFileSync(new URL('../src/data/lessonContent.json', import.meta.url), 'utf8'));
const lessons = catalog.courses.flatMap(course => course.lessons);
const exercises = lessons.flatMap(lesson => lesson.exercises);
const copy = id => structuredClone(exercises.find(exercise => exercise.id === id));
const colors = { Morado: '#5124EE', Amarillo: '#FFC700', Verde: '#00D282', Coral: '#FF5A5F', Cian: '#00B4D8' };

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}

test('Los 24 ejercicios cumplen el contrato del generador consumido por Game.jsx', () => {
  assert.equal(exercises.length, 24);
  for (const lesson of lessons) {
    const reference = generateQuestions(lesson.module_id, 1, 1)[0];
    for (const exercise of lesson.exercises) {
      const question = adaptExerciseToGame(exercise);
      for (const key of Object.keys(reference)) assert.equal(typeof question[key], typeof reference[key], `${exercise.id}: ${key}`);
      assert.equal(question.prompt, exercise.prompt);
      assert.ok(question.speakText.includes(exercise.prompt));
      assert.ok(question.visual.startsWith('<div'));
      assert.equal(question.options.length, 4);
      assert.deepEqual(question.options.map(option => option.label), exercise.options.map(String));
      assert.equal(question.answerIndex, exercise.answer_index);
      assert.equal(question.options[question.answerIndex].label, String(exercise.correct_answer));
      for (let index = 0; index < 4; index++) assert.equal(index === question.answerIndex, index === exercise.answer_index);
      assert.equal(question.id, exercise.id);
      assert.equal(question.correct_answer, exercise.correct_answer);
      for (const key of ['hint', 'feedback_correct', 'feedback_incorrect']) assert.equal(question[key], exercise[key]);
    }
  }
});

test('Conteo representa la cantidad exacta mediante iconos SVG locales', () => {
  for (const exercise of lessons[0].exercises) {
    const question = adaptExerciseToGame(exercise);
    assert.equal((question.visual.match(/<svg\b/g) ?? []).length, exercise.visual.count);
    assert.ok(question.visual.includes(`aria-label="${exercise.visual.count} `));
    assert.equal(question.options[question.answerIndex].label, String(exercise.visual.count));
  }
});

test('Sumas muestran los operandos y el signo, sin revelar el resultado', () => {
  for (const exercise of lessons[1].exercises) {
    const question = adaptExerciseToGame(exercise);
    const [a, b] = exercise.visual.operands;
    assert.ok(question.visual.includes(`>${a}</span>`));
    assert.ok(question.visual.includes(`>${b}</span>`));
    assert.ok(question.visual.includes('>+</span>'));
    assert.ok(question.visual.includes('>?</span>'));
    assert.equal(Number(question.options[question.answerIndex].label), a + b);
  }
});

test('Figuras conservan sus lados, orientación y variante de tamaño', () => {
  for (const exercise of lessons[2].exercises) {
    const question = adaptExerciseToGame(exercise);
    const points = question.visual.match(/<polygon points="([^"]+)"/)[1].split(' ');
    assert.equal(points.length, exercise.visual.sides);
    assert.equal(Number(question.options[question.answerIndex].label), points.length);
  }
  assert.ok(adaptExerciseToGame(copy('G05')).visual.includes('rotate(90)'));
  assert.ok(adaptExerciseToGame(copy('G06')).visual.includes('scale(0.65)'));
});

test('Patrones conservan secuencia, hueco, nombres y colores del generador', () => {
  for (const exercise of lessons[3].exercises) {
    const question = adaptExerciseToGame(exercise);
    assert.deepEqual([...question.visual.matchAll(/background:(#[A-Fa-f0-9]{6})/g)].map(match => match[1]), exercise.visual.sequence.map(color => colors[color]));
    assert.ok(question.visual.includes('>?</span>'));
    assert.ok(question.speakText.includes(exercise.visual.sequence.join(', ')));
    for (const option of question.options) assert.equal(option.color, colors[option.label]);
  }
});

test('La conversión funciona después de mezclar cualquiera de los 24 ejercicios', () => {
  for (const exercise of exercises) {
    const mixed = shuffleExerciseOptions(exercise, () => 0);
    const question = adaptExerciseToGame(mixed);
    assert.equal(question.options[question.answerIndex].label, String(exercise.correct_answer));
    assert.deepEqual(question.options.map(option => option.label), mixed.options.map(String));
  }
});

test('No modifica ni comparte objetos con el catálogo original', () => {
  const original = structuredClone(catalog);
  const frozen = freeze(structuredClone(catalog));
  for (const course of frozen.courses) for (const lesson of course.lessons) for (const exercise of lesson.exercises) {
    const question = adaptExerciseToGame(exercise);
    question.options[0].label = 'Cambio';
    question.hint = 'Cambio';
    assert.notEqual(question.options[0].label, String(exercise.options[0]));
  }
  assert.deepEqual(frozen, original);
});

test('Rechaza campos ausentes, índices incoherentes y opciones inválidas', () => {
  for (const input of [null, undefined, {}, [], 'texto']) assert.throws(() => adaptExerciseToGame(input), TypeError);
  for (const patch of [
    { answer_index: -1 }, { answer_index: 4 }, { answer_index: 1.5 },
    { correct_answer: 99 }, { options: [4, 4, 5, 6] },
    { hint: '' }, { feedback_correct: null }, { visual: '<script>alert(1)</script>' },
    { visual: undefined, visual_description: 'Cuatro estrellas' },
  ]) assert.throws(() => adaptExerciseToGame({ ...copy('C01'), ...patch }), TypeError);
  for (const id of ['C01', 'P01']) {
    const sparse = copy(id);
    delete sparse.options[2];
    assert.throws(() => adaptExerciseToGame(sparse), TypeError);
  }
});

test('Rechaza datos visuales inconsistentes en los cuatro tipos', () => {
  const cases = [
    ['C01', { type: 'otro' }], ['C01', { icon: 'desconocido' }],
    ['C01', { icon: '__proto__' }], ['C01', { count: 3 }], ['C01', { count: 1000000 }],
    ['A01', { operator: '-' }], ['A01', { operands: [2, 4] }],
    ['A01', { operands: [2, '3'] }], ['A01', { operands: [Number.MAX_SAFE_INTEGER, 1] }],
    ['G01', { shape: 'circle' }], ['G01', { sides: 4 }],
    ['G05', { rotation_degrees: '90)" onload="alert(1)' }],
    ['G05', { rotation_degrees: Infinity }], ['G05', { rotation_degrees: -1 }],
    ['G06', { size: 'enorme' }],
    ['P01', { sequence: ['Morado', 'Amarillo', 'Verde', 'Coral'] }],
    ['P01', { sequence: ['Morado', 'Morado', 'Morado', 'Morado'] }],
    ['P01', { missing_index: 2 }],
  ];
  for (const [id, patch] of cases) {
    const exercise = copy(id); Object.assign(exercise.visual, patch);
    assert.throws(() => adaptExerciseToGame(exercise), TypeError, `${id}: ${JSON.stringify(patch)}`);
  }
  const pattern = copy('P01'); pattern.options[3] = 'Azul';
  assert.throws(() => adaptExerciseToGame(pattern), TypeError);
  const sparse = copy('P01'); delete sparse.visual.sequence[3];
  assert.throws(() => adaptExerciseToGame(sparse), TypeError);
});

test('No interpola texto arbitrario como HTML ni acepta colores o iconos inyectados', () => {
  const exercise = copy('C01'); exercise.prompt = '<img src=x onerror=alert(1)>';
  assert.ok(!adaptExerciseToGame(exercise).visual.includes('<img'));
  exercise.visual.icon = 'star" onload="alert(1)';
  assert.throws(() => adaptExerciseToGame(exercise), TypeError);
  const pattern = copy('P01'); pattern.visual.sequence[0] = 'red; background:url(x)';
  assert.throws(() => adaptExerciseToGame(pattern), TypeError);
});
