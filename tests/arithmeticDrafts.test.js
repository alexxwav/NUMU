import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getExerciseFeedback, shuffleExerciseOptions } from '../src/utils/lessonContent.js';

function readJson(path) {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
}

const groups = readJson('../content-drafts/grupos-iguales.json');
const sharing = readJson('../content-drafts/repartimos-por-igual.json');
const published = readJson('../src/data/lessonContent.json');
const existingDrafts = [
  readJson('../content-drafts/cuantos-quedan.json'),
  readJson('../content-drafts/figuras-ampliacion.json'),
];

function exercisesOf(draft) {
  return Object.values(draft.levels).flatMap(({ exercises }) => exercises);
}

function assertPositiveIntegers(...values) {
  assert.ok(values.every(value => Number.isInteger(value) && value > 0));
}

function groupEvidence(exercise, level) {
  const { visual, prompt, options, type, correct_answer: answer } = exercise;
  assert.ok(typeof visual.icon === 'string' && visual.icon.length > 0);
  if (level !== '3') {
    assert.equal(visual.type, 'equal_groups');
    const { group_count: count, items_per_group: size } = visual;
    assertPositiveIntegers(count, size);
    assert.ok(count >= 2 && size >= 2);
    assert.ok(typeof visual.container === 'string' && visual.container.length > 0);
    if (level === '1') {
      assert.equal(type, 'contar-grupos');
      assert.match(prompt, /[Cc]uántos grupos/);
      assert.equal(answer, count);
    } else {
      assert.equal(type, 'identificar-suma-repetida');
      assert.match(prompt, /un número por/);
      for (const option of options) assert.match(option, /^\d+(?: \+ \d+)+$/);
      assert.equal(answer, Array(count).fill(size).join(' + '));
    }
    return [count, size];
  }

  assert.equal(visual.type, 'rectangular_array');
  const { rows, columns } = visual;
  assertPositiveIntegers(rows, columns);
  assert.ok(rows >= 2 && columns >= 2);
  assert.match(prompt, /filas/);
  if (type === 'representar-multiplicacion') {
    assert.match(prompt, /primero/);
    for (const option of options) assert.match(option, /^\d+ × \d+$/);
    assert.equal(answer, rows + ' × ' + columns);
  } else {
    assert.equal(type, 'calcular-total-del-arreglo');
    assert.match(prompt, /total/);
    assert.equal(answer, rows * columns);
  }
  return [rows, columns];
}

function sharingEvidence(exercise, level) {
  const { visual, prompt, options, type, correct_answer: answer } = exercise;
  const { total, recipients } = visual;
  assert.equal(visual.type, 'equal_sharing');
  assertPositiveIntegers(total, recipients);
  assert.ok(recipients >= 2 && total >= recipients);
  assert.ok(typeof visual.icon === 'string' && visual.icon.length > 0);
  assert.ok(typeof visual.container === 'string' && visual.container.length > 0);
  assert.deepEqual([...prompt.matchAll(/\b\d+\b/g)].map(([quantity]) => Number(quantity)), [total, recipients]);
  assert.equal(visual.display, level === '1' ? 'objects' : 'summary');

  if (level === '1') {
    assert.equal(type, 'elegir-reparto-exacto');
    const fairLayouts = options.filter(option => {
      assert.match(option, /^\d+(?:, \d+)* y \d+$/);
      const amounts = option.match(/\d+/g).map(Number);
      assert.equal(amounts.length, recipients);
      return new Set(amounts).size === 1 && amounts.reduce((sum, amount) => sum + amount, 0) === total;
    });
    assert.deepEqual(fairLayouts, [answer]);
  } else if (level === '2') {
    assert.equal(type, 'calcular-cuanto-recibe-cada-uno');
    assert.match(prompt, /cuánt[oa]s.*\b(?:cada|una) /);
    assert.equal(total % recipients, 0);
    assert.equal(answer, total / recipients);
  } else {
    assert.equal(type, 'identificar-sobrantes');
    assert.match(prompt, /sobran\?$/);
    assert.equal(answer, total % recipients);
    assert.ok(answer >= 0 && answer < recipients);
  }
  return [total, recipients];
}

test('Los dos borradores 2A conservan la secuencia de Aritmética y tienen IDs únicos', () => {
  const publishedLessons = published.courses.flatMap(({ lessons }) => lessons);
  const existingItems = [...published.courses, ...publishedLessons, ...publishedLessons.flatMap(({ exercises }) => exercises)];
  const draftLessons = [...existingDrafts.filter(draft => draft.id), groups, sharing];
  const draftExercises = [...existingDrafts, groups, sharing].flatMap(exercisesOf);
  const ids = [...existingItems, ...draftLessons, ...draftExercises].map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length);

  for (const [lesson, id, title, position] of [
    [groups, 'grupos-iguales', 'Grupos iguales', 4],
    [sharing, 'repartimos-por-igual', 'Repartimos por igual', 5],
  ]) {
    assert.equal(lesson.id, id);
    assert.equal(lesson.title, title);
    assert.equal(lesson.course_id, 'aritmetica');
    assert.equal(lesson.position, position);
    assert.equal(lesson.base_level, 1);
    assert.equal(lesson.published, false);
    assert.deepEqual(Object.keys(lesson.levels), ['1', '2', '3']);
  }
});

test('Grupos iguales muestra tres peceras con dos peces en cada una', () => {
  assert.match(groups.objective, /suma repetida.*filas y columnas/);
  assert.match(groups.explanation, /grupos iguales/);
  const { mode, visual, explanation } = groups.guided_example;
  assert.equal(mode, 'visual');
  assert.deepEqual(visual, { type: 'equal_groups', icon: 'fish', container: 'fish_tank', group_count: 3, items_per_group: 2 });
  assert.match(explanation, /2 \+ 2 \+ 2 = 6/);
  assert.match(explanation, /3 × 2 = 6/);
});

test('Repartimos por igual propone repartir trece conchas entre tres canastas', () => {
  assert.match(sharing.objective, /misma cantidad.*sobra/);
  assert.match(sharing.explanation, /vuelta.*reparto es exacto/);
  const { mode, visual, interaction } = sharing.guided_example;
  assert.equal(mode, 'interactive');
  assert.deepEqual(visual, { type: 'equal_sharing', icon: 'shell', container: 'basket', total: 13, recipients: 3, display: 'interactive' });
  assert.equal(interaction.type, 'share_objects');
  assert.equal(interaction.instructions.length, 3);
  assert.ok(interaction.instructions.every(instruction => instruction.trim()));
  assert.match(interaction.feedback_on_complete, /recibe 4 conchas y sobra 1/);
  assert.ok(interaction.restart_label.trim());
});

for (const [lesson, evidenceFor] of [[groups, groupEvidence], [sharing, sharingEvidence]]) {
  for (const [level, { exercises, exercise_types: declaredTypes }] of Object.entries(lesson.levels)) {
    test(lesson.title + ' N' + level + ' tiene seis ejercicios distintos con respuestas coherentes', () => {
      assert.equal(exercises.length, 6);
      assert.deepEqual([...declaredTypes].sort(), [...new Set(exercises.map(({ type }) => type))].sort());

      const signatures = new Set();
      for (const exercise of exercises) {
        const { id, options, correct_answer: answer, answer_index: answerIndex, prompt, hint } = exercise;
        assert.match(id, new RegExp('^' + lesson.id + '-n' + level + '-\\d{2}$'));
        assert.match(prompt, /¿[^?]+\?/);
        assert.equal(options.length, 4, id);
        assert.equal(new Set(options).size, 4, id);
        assert.ok(options.every(option => typeof answer === 'number'
          ? Number.isInteger(option) && option >= 0
          : typeof option === 'string' && Boolean(option.trim())), id);
        assert.equal(options[answerIndex], answer, id);
        assert.deepEqual(getExerciseFeedback(exercise, answerIndex),
          { valid: true, correct: true, message: exercise.feedback_correct }, id);
        const incorrectIndex = options.findIndex(option => option !== answer);
        assert.deepEqual(getExerciseFeedback(exercise, incorrectIndex),
          { valid: true, correct: false, message: exercise.feedback_incorrect }, id);
        assert.doesNotMatch(hint, /\d/, id);
        const shuffled = shuffleExerciseOptions(exercise, () => 0);
        assert.equal(shuffled.options[shuffled.answer_index], answer, id);

        // Ignora nombres, iconos y orden de las opciones al buscar duplicados.
        const signature = JSON.stringify(evidenceFor(exercise, level));
        assert.ok(!signatures.has(signature), id + ' repite las cantidades y la estructura de otro ejercicio');
        signatures.add(signature);
      }

      if (lesson === sharing && level === '3') {
        assert.ok(exercises.some(({ correct_answer: answer }) => answer === 0));
        assert.ok(exercises.some(({ correct_answer: answer }) => answer > 0));
      }
    });
  }
}
