import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { getCourseById, getLessonById, getLessonsForCourse, getExerciseFeedback, shuffleExerciseOptions, validateLessonCatalog } from '../src/utils/lessonContent.js';

const catalog = JSON.parse(readFileSync(new URL('../src/data/lessonContent.json', import.meta.url), 'utf8'));
const lessons = catalog.courses.flatMap(course => course.lessons);
const exercises = lessons.flatMap(lesson => lesson.exercises);
const clone = () => structuredClone(catalog);

test('Dos cursos, cuatro lecciones, seis ejercicios por lección y 24 en total', () => {
  assert.equal(catalog.courses.length, 2);
  assert.equal(lessons.length, 4);
  for (const lesson of lessons) assert.equal(lesson.exercises.length, 6);
  assert.equal(exercises.length, 24);
});
test('Identificadores únicos en todo el catálogo', () => {
  const ids = [...catalog.courses, ...lessons, ...exercises].map(item => item.id);
  assert.equal(new Set(ids).size, ids.length);
});
test('IDs, relaciones, módulos, niveles y posiciones coinciden con el seed de Laura', () => {
  // Lee la referencia disponible sin cambiar de rama ni requerir red.
  const sql = execFileSync('git', ['show', 'origin/laura/backend-mvp:supabase/seed.sql'], { cwd: new URL('../', import.meta.url), encoding: 'utf8' });
  const courseRows = [...sql.split('insert into public.lessons')[0].matchAll(/\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*(\d+)\)/g)];
  assert.deepEqual(catalog.courses.map(c => [c.id, c.position]), courseRows.map(row => [row[1], Number(row[4])]));
  const rows = [...sql.matchAll(/\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*(?:null|'[^']*'),\s*(\d+),\s*'([^']+)',\s*(\d+)\)/g)];
  assert.equal(rows.length, 4);
  assert.deepEqual(lessons.map(l => [l.id, l.course_id, l.position, l.module_id, l.base_level]), rows.map(r => [r[1], r[2], Number(r[4]), r[5], Number(r[6])]));
});
test('Catálogo completo, opciones distintas y contenido editorial legible', () => {
  assert.deepEqual(validateLessonCatalog(catalog), { valid: true, errors: [] });
  assert.equal(catalog.courses[0].title, 'Aritmética');
  assert.equal(lessons[3].title, 'Patrones de colores');
  for (const exercise of exercises) {
    assert.ok(exercise.prompt.startsWith('¿'));
    assert.equal(exercise.options[exercise.answer_index], exercise.correct_answer);
    for (const field of ['hint', 'feedback_correct', 'feedback_incorrect']) assert.ok(exercise[field].trim());
  }
});
test('Búsquedas, valores ausentes y orden sin mutación', () => {
  assert.equal(getCourseById(catalog, 'aritmetica'), catalog.courses[0]);
  assert.deepEqual(getLessonById(catalog, 'figuras'), { lesson: lessons[2], course: catalog.courses[1] });
  assert.equal(getLessonById(catalog, 'ausente'), null);
  assert.equal(getCourseById(null, 'ausente'), null);
  assert.deepEqual(getLessonsForCourse(catalog, 'ausente'), []);
  const copy = clone(); copy.courses[0].lessons.reverse();
  assert.deepEqual(getLessonsForCourse(copy, 'aritmetica').map(l => l.position), [1, 2]);
  assert.equal(copy.courses[0].lessons[0].position, 2);
});
test('Evaluación correcta e incorrecta para todos los ejercicios', () => {
  for (const exercise of exercises) for (let index = 0; index < 4; index++) {
    const correct = index === exercise.answer_index;
    assert.deepEqual(getExerciseFeedback(exercise, index), { valid: true, correct, message: correct ? exercise.feedback_correct : exercise.feedback_incorrect });
  }
});
test('Índices inválidos y ejercicios mal formados se manejan sin lanzar errores', () => {
  for (const index of [-1, 4, 0.5, NaN, Infinity, '1', null, undefined]) assert.equal(getExerciseFeedback(exercises[0], index).valid, false);
  for (const exercise of [null, {}, { ...exercises[0], options: [4, 4, 5, 6] }, { ...exercises[0], answer_index: 8 }]) assert.equal(getExerciseFeedback(exercise, 0).valid, false);
});
test('Fisher-Yates reproducible conserva respuestas y no comparte datos mutables', () => {
  const before = structuredClone(catalog);
  for (const exercise of exercises) {
    const mixed = shuffleExerciseOptions(exercise, () => 0);
    assert.deepEqual(mixed.options, [...exercise.options.slice(1), exercise.options[0]]);
    assert.equal(mixed.options[mixed.answer_index], exercise.correct_answer);
    assert.equal(getExerciseFeedback(mixed, mixed.answer_index).correct, true);
    assert.notEqual(mixed.visual, exercise.visual);
    mixed.visual.type = 'changed';
    assert.deepEqual(shuffleExerciseOptions(exercise, () => 0.999).options, exercise.options);
  }
  assert.deepEqual(catalog, before);
});
test('La mezcla rechaza datos y valores aleatorios inválidos', () => {
  for (const value of [null, {}, { ...exercises[0], correct_answer: 999 }]) assert.throws(() => shuffleExerciseOptions(value), TypeError);
  assert.throws(() => shuffleExerciseOptions(exercises[0], null), TypeError);
  for (const value of [-1, 1, NaN, Infinity, '0', undefined]) assert.throws(() => shuffleExerciseOptions(exercises[0], () => value), TypeError);
});
test('Conteo: iconos identificables y cantidades exactas', () => {
  assert.deepEqual(lessons[0].exercises.map(e => e.correct_answer), [4, 3, 5, 2, 6, 7]);
  for (const e of lessons[0].exercises) {
    assert.equal(e.visual.type, 'objects');
    assert.ok(['star', 'ball', 'fish', 'balloon', 'heart'].includes(e.visual.icon));
    assert.ok(Number.isInteger(e.visual.count) && e.visual.count > 0);
    assert.equal(e.visual.count, e.correct_answer);
  }
});
test('Aritmética: todas las sumas corresponden a sus operandos', () => {
  assert.deepEqual(lessons[1].exercises.map(e => e.visual.operands), [[2, 3], [1, 4], [3, 4], [5, 2], [6, 3], [4, 4]]);
  for (const e of lessons[1].exercises) {
    assert.equal(e.visual.operator, '+');
    assert.equal(e.correct_answer, e.visual.operands.reduce((a, b) => a + b, 0));
  }
});
test('Geometría: figuras, lados y variantes coherentes', () => {
  const sides = { triangle: 3, square: 4, pentagon: 5, hexagon: 6 };
  for (const e of lessons[2].exercises) {
    assert.equal(e.visual.type, 'shape');
    assert.equal(sides[e.visual.shape], e.visual.sides);
    assert.equal(e.correct_answer, e.visual.sides);
  }
  assert.equal(lessons[2].exercises[4].visual.rotation_degrees, 90);
  assert.equal(lessons[2].exercises[5].visual.size, 'small');
});
test('Patrones: secuencias ABAB y colores compatibles con NUMU', () => {
  for (const e of lessons[3].exercises) {
    const [a, b, c, d] = e.visual.sequence;
    assert.equal(a, c); assert.equal(b, d); assert.notEqual(a, b);
    assert.equal(e.visual.missing_index, 4);
    assert.equal(e.correct_answer, a);
    assert.equal(new Set(e.options).size, 4);
    for (const color of [...e.options, ...e.visual.sequence]) assert.ok(['Morado', 'Amarillo', 'Verde', 'Coral', 'Cian'].includes(color));
  }
});
test('Validador rechaza catálogos incompletos y campos inconsistentes', () => {
  for (const input of [null, {}, { courses: [] }, { courses: [null, {}] }]) assert.equal(validateLessonCatalog(input).valid, false);
  const mutations = [
    c => { c.courses[1].id = 'aritmetica'; },
    c => { c.courses[0].position = 0; },
    c => { c.courses[0].lessons.pop(); },
    c => { c.courses[0].lessons[0].module_id = 'otro'; },
    c => { c.courses[0].lessons[0].course_id = 'otro'; },
    c => { c.courses[0].lessons[0].position = 2; },
    c => { c.courses[0].lessons[0].exercises[0].options = [4, 4, 5, 6]; },
    c => { c.courses[0].lessons[0].exercises[0].answer_index = 4; },
    c => { c.courses[0].lessons[0].exercises[0].correct_answer = 99; },
    c => { c.courses[0].lessons[0].exercises[0].hint = ''; },
    c => { c.courses[0].lessons[0].exercises[1].id = 'C01'; },
  ];
  for (const mutate of mutations) { const copy = clone(); mutate(copy); assert.equal(validateLessonCatalog(copy).valid, false); }
});
