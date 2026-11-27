import assert from 'node:assert/strict';
import test from 'node:test';
import { loadCatalogV2 } from '../content-drafts/catalog-v2.fixture.js';
import { shuffleExerciseOptions } from '../src/utils/lessonContent.js';
import { adaptExerciseToGame, exerciseSemanticKey } from '../src/utils/lessonGameAdapter.js';

const lesson = loadCatalogV2().courses[0].lessons.find(item => item.id === 'conteo-basico');
const newExercises = level => lesson.levels[level].exercises.filter(({ visual }) => visual.type === 'object_groups');

test('Conteo N1 y N2 tienen 6 y 7 preguntas editoriales distintas, dentro del rango de cada nivel', () => {
  assert.deepEqual(lesson.exercises.map(({ id }) => id), ['C01', 'C02', 'C03', 'C04', 'C05', 'C06']);
  for (const [level, distinct] of [[1, 6], [2, 7]]) {
    const bank = lesson.levels[level].exercises;
    assert.equal(bank.length, distinct);
    assert.equal(new Set(bank.map(exerciseSemanticKey)).size, distinct);
    for (const exercise of newExercises(level)) {
      const { visual } = exercise;
      assert.equal(visual.groups.length, 4);
      for (const count of [...visual.groups.map(group => group.count), visual.model_count, visual.target_count].filter(Number.isInteger)) {
        assert.ok(count >= 2 && count <= level + 4, exercise.id);
      }
      const result = adaptExerciseToGame(shuffleExerciseOptions(exercise, () => 0));
      assert.equal(result.options[result.answerIndex].label, exercise.correct_answer);
      assert.match(result.visual, /role="img" aria-label="Grupo A\./);
      assert.equal(result.speakText, exercise.prompt);
    }
  }
});

test('Comparar, emparejar y elegir una cantidad tienen claves propias sin depender del dibujo o las etiquetas', () => {
  const [choose, match, most, least] = [...newExercises(1), ...newExercises(2)];
  const altered = structuredClone(choose);
  altered.visual.icon = 'star';
  altered.visual.groups.reverse().forEach((group, index) => { group.label = ['W', 'X', 'Y', 'Z'][index]; });
  altered.options = ['X', 'Y', 'Z', 'W'];
  altered.correct_answer = altered.visual.groups.find(group => group.count === altered.visual.target_count).label;
  altered.answer_index = altered.options.indexOf(altered.correct_answer);
  assert.equal(exerciseSemanticKey(altered), exerciseSemanticKey(choose));
  assert.notEqual(exerciseSemanticKey(choose), exerciseSemanticKey(match));
  assert.notEqual(exerciseSemanticKey(most), exerciseSemanticKey(least));
});

test('Se rechazan importes, empates relevantes y respuestas incompatibles con los grupos', () => {
  const [choose, match] = newExercises(1);
  const [most] = newExercises(2);
  const cases = [
    [choose, example => { example.visual.target_count = 10; }],
    [choose, example => { example.answer_index = 0; example.correct_answer = 'A'; }],
    [match, example => { example.visual.model_count = undefined; }],
    [most, example => { example.visual.groups[0].count = 6; }],
  ];
  for (const [exercise, mutate] of cases) {
    const wrong = structuredClone(exercise);
    mutate(wrong);
    assert.throws(() => adaptExerciseToGame(wrong), TypeError, exercise.id);
  }
});
