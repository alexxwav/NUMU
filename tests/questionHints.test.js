import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildQuestionHint, generateQuestions, ROUND_TIPS } from '../src/state/questions.js';
import { adaptExerciseToGame } from '../src/utils/lessonGameAdapter.js';

const catalog = JSON.parse(readFileSync(new URL('../src/data/lessonContent.json', import.meta.url), 'utf8'));
const exercises = catalog.courses.flatMap((course) => course.lessons).flatMap((lesson) => lesson.exercises);
const modules = ['conteo', 'aritmetica', 'geometria', 'patrones'];

test('toda pregunta generada y todo ejercicio del catálogo tiene pista no vacía', () => {
  for (const moduleId of modules) {
    for (const level of [1, 2, 3]) {
      for (const question of generateQuestions(moduleId, level, 10)) {
        const hint = buildQuestionHint(question, moduleId);
        assert.ok(hint.trim(), `${moduleId}: pista vacía`);
        assert.equal(hint, question.hint);
      }
    }
  }
  for (const exercise of exercises) {
    const question = adaptExerciseToGame(exercise);
    assert.ok(buildQuestionHint(question).trim(), `${exercise.id}: pista vacía`);
    assert.equal(question.hint, exercise.hint);
  }
});

test('sin hint se deduce una explicación concreta de cada tipo de ejercicio', () => {
  const count = buildQuestionHint({ prompt: '¿Cuántos peces ves?' }, 'conteo');
  assert.match(count, /peces/);
  assert.match(count, /izquierda a derecha/);

  const add = buildQuestionHint({ prompt: '¿Cuánto es 3 + 4?' }, 'aritmetica');
  assert.match(add, /3/);
  assert.match(add, /4/);
  assert.match(add, /adelante/);

  const sub = buildQuestionHint({ prompt: '¿Cuánto es 7 − 2?' }, 'aritmetica');
  assert.match(sub, /7/);
  assert.match(sub, /2/);
  assert.match(sub, /atrás/);

  const shape = buildQuestionHint({ prompt: '¿Cuántos lados tiene el hexágono?' }, 'geometria');
  assert.match(shape, /hexágono/);
  assert.match(shape, /lados/);

  const pattern = buildQuestionHint({ visual: '<div><span style="background:#5124EE"></span></div>' }, 'patrones');
  assert.match(pattern, /Morado/);
  assert.match(pattern, /se repiten/);

  assert.match(buildQuestionHint({ prompt: '¿Cuántos peces ves?' }), /peces/);
});

test('si no hay pista ni datos que deducir se usa el respaldo del módulo', () => {
  assert.equal(buildQuestionHint({}, 'aritmetica'), ROUND_TIPS.aritmetica);
  assert.equal(buildQuestionHint({}, 'desconocido'), ROUND_TIPS.conteo);
  assert.ok(buildQuestionHint(null, null).trim());
});
