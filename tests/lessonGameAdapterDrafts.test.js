import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { toSpeechText } from '../src/utils/audio.js';
import { shuffleExerciseOptions } from '../src/utils/lessonContent.js';
import { adaptExerciseToGame, exerciseSemanticKey } from '../src/utils/lessonGameAdapter.js';

function readDraft(name) {
  return JSON.parse(readFileSync(new URL('../content-drafts/' + name + '.json', import.meta.url), 'utf8'));
}

const drafts = [readDraft('figuras-ampliacion'), readDraft('cuantos-quedan')];
const exercises = drafts.flatMap(({ levels }) => Object.values(levels).flatMap(({ exercises }) => exercises));
const visualTypes = readDraft('visual-types').visuals;
const exerciseById = id => structuredClone(exercises.find(exercise => exercise.id === id));
const labelsIn = html => Array.from(html.matchAll(/aria-label="([^"]+)"/g), match => match[1]);

test('Los 33 ejercicios de Figuras y restas se adaptan antes y después de mezclar sus opciones', () => {
  assert.equal(exercises.length, 33);
  assert.deepEqual([...new Set(exercises.map(exercise => exercise.visual.type))].sort(), Object.keys(visualTypes).sort());
  const original = structuredClone(exercises);
  for (const exercise of exercises) {
    for (const input of [exercise, shuffleExerciseOptions(exercise, () => 0)]) {
      const question = adaptExerciseToGame(input);
      assert.equal(question.id, input.id);
      assert.equal(question.type, input.type);
      assert.equal(question.options.length, 4, input.id);
      assert.equal(new Set(question.options.map(option => option.label)).size, 4, input.id);
      assert.deepEqual(question.options.map(option => option.label), input.options.map(String), input.id);
      assert.equal(question.answerIndex, input.answer_index, input.id);
      assert.equal(question.options[question.answerIndex].label, String(input.correct_answer), input.id);
      assert.equal(question.semanticKey, exerciseSemanticKey(exercise), input.id);
      assert.equal(JSON.parse(question.semanticKey)[0], input.type);
      assert.equal(question.hint, input.hint);
      assert.equal(question.feedback_correct, input.feedback_correct);
      assert.equal(question.feedback_incorrect, input.feedback_incorrect);
      assert.equal(question.speakText, input.prompt);
    }
  }
  assert.deepEqual(exercises, original);
});

test('La clave de una figura ignora su giro, su tamaño, su ID, el texto y el orden de las opciones', () => {
  const exercise = exerciseById('figuras-n1-02');
  const variant = shuffleExerciseOptions(exercise, () => 0);
  variant.id = 'contorno-variante';
  variant.prompt = '¿Cuántos tramos del borde quedan por señalar?';
  variant.visual = { ...variant.visual, rotation_degrees: 110, size: 'small', marked_sides: [2] };
  assert.equal(exerciseSemanticKey(exercise), exerciseSemanticKey(variant));
  assert.deepEqual(JSON.parse(exerciseSemanticKey(variant)), ['contar-lados-sin-marcar', ['triangle', 1]]);
});

test('La clave de tarjetas ignora sus letras, la posición de las tarjetas y el orden de una pareja', () => {
  const exercise = exerciseById('figuras-n2-05');
  const variant = structuredClone(exercise);
  const labels = { A: 'Z', B: 'W', C: 'Y', D: 'X' };
  const rename = pair => pair.split(' y ').reverse().map(label => labels[label]).join(' y ');
  variant.visual.figures = variant.visual.figures.reverse().map(figure =>
    ({ ...figure, label: labels[figure.label], rotation_degrees: 280, size: 'small' }));
  variant.options = variant.options.map(rename).reverse();
  variant.correct_answer = rename(exercise.correct_answer);
  variant.answer_index = variant.options.indexOf(variant.correct_answer);

  assert.equal(exerciseSemanticKey(exercise), exerciseSemanticKey(variant));
  assert.equal(adaptExerciseToGame(variant).options[variant.answer_index].label, variant.correct_answer);
});

test('La clave distingue la operación, los operandos y la propiedad geométrica evaluada', () => {
  const subtraction = exerciseById('cuantos-quedan-n2-01');
  const addition = structuredClone(subtraction);
  addition.type = 'resolver-suma';
  addition.visual.operator = '+';
  addition.prompt = '¿Cuánto es 6 + 1?';
  addition.options[addition.answer_index] = 7;
  addition.correct_answer = 7;
  assert.notEqual(exerciseSemanticKey(subtraction), exerciseSemanticKey(addition));
  assert.notEqual(exerciseSemanticKey(subtraction), exerciseSemanticKey({
    ...subtraction, prompt: '¿Cuánto es 7 − 2?', visual: { ...subtraction.visual, operands: [7, 2] },
  }));

  const partial = exerciseById('figuras-n1-02');
  const total = { ...partial, type: 'contar-lados', prompt: '¿Cuántos lados tiene la figura?', answer_index: 1, correct_answer: 3 };
  assert.notEqual(exerciseSemanticKey(partial), exerciseSemanticKey(total));
  const fewest = exerciseById('figuras-n2-06');
  const most = { ...fewest, type: 'elegir-mas-lados', prompt: '¿Qué tarjeta tiene más lados?', answer_index: 3, correct_answer: 'D' };
  assert.notEqual(exerciseSemanticKey(fewest), exerciseSemanticKey(most));

  const fish = exerciseById('cuantos-quedan-n1-01');
  const hearts = { ...fish, visual: { ...fish.visual, icon: 'heart' }, prompt: 'Hay cuatro corazones y guardas uno. ¿Cuántos quedan?' };
  assert.equal(exerciseSemanticKey(fish), exerciseSemanticKey(hearts));
});

test('Las figuras dan acceso al contorno sin anunciar el nombre, el total ni la tarjeta correcta', () => {
  const named = adaptExerciseToGame(exerciseById('figuras-n2-01'));
  assert.deepEqual(labelsIn(named.visual), ['Figura. Lado recto. Lado recto. Lado recto.']);
  assert.doesNotMatch(named.speakText, /triángulo/i);

  const marked = adaptExerciseToGame(exerciseById('figuras-n1-02'));
  assert.deepEqual(labelsIn(marked.visual), ['Figura. Lado marcado. Lado sin marcar. Lado sin marcar.']);
  assert.equal((marked.visual.match(/<polyline\b/g) ?? []).length, 1);

  const match = adaptExerciseToGame(exerciseById('figuras-n1-01'));
  const labels = labelsIn(match.visual);
  assert.equal(labels.length, 6);
  assert.match(labels[1], /^Figura modelo\./);
  assert.deepEqual(labels.slice(2).map(label => label.split('.')[0]), ['Tarjeta A', 'Tarjeta B', 'Tarjeta C', 'Tarjeta D']);
  assert.doesNotMatch(labels.join(' '), /triángulo|cuadrado|pentágono|correcta|\d/i);
});

test('Las restas muestran las cantidades de entrada y mantienen el signo y la voz', () => {
  const marked = adaptExerciseToGame(exerciseById('cuantos-quedan-n1-05'));
  assert.equal((marked.visual.match(/<svg\b|<img\b/g) ?? []).length, 7);
  assert.equal((marked.visual.match(/>×<\/span>/g) ?? []).length, 2);
  assert.deepEqual(labelsIn(marked.visual), ['7 peces al inicio. Cantidad retirada 2.']);

  const summary = adaptExerciseToGame(exerciseById('cuantos-quedan-n3-01'));
  assert.equal((summary.visual.match(/<svg\b|<img\b/g) ?? []).length, 1);
  assert.deepEqual(labelsIn(summary.visual), ['12 peces al inicio. Cantidad retirada 4.']);
  assert.doesNotMatch(summary.visual, />8<\/span>/);

  const expression = adaptExerciseToGame(exerciseById('cuantos-quedan-n2-04'));
  assert.match(expression.visual, />−<\/span>/);
  assert.match(expression.visual, />\?<\/span>/);
  assert.equal(toSpeechText(expression.speakText), '¿Cuánto es 7 menos 7?');
  assert.equal(expression.options[expression.answerIndex].label, '0');
});

test('Las preguntas numéricas aceptan conjuntos de dos, tres y cuatro tarjetas', () => {
  for (const extraCount of [0, 1, 2]) {
    const exercise = exerciseById('figuras-n3-06');
    exercise.visual.figures.push(...[
      { label: 'C', shape: 'square' },
      { label: 'D', shape: 'pentagon' },
    ].slice(0, extraCount));
    const total = [9, 13, 18][extraCount];
    exercise.prompt = '¿Cuántos lados tienen en total las tarjetas dibujadas?';
    exercise.options = [total - 1, total, total + 1, total + 2];
    exercise.correct_answer = total;
    exercise.answer_index = 1;

    const question = adaptExerciseToGame(exercise);
    assert.equal(labelsIn(question.visual).length, extraCount + 3);
    assert.equal(question.options[question.answerIndex].label, String(total));
  }
});

test('El adaptador rechaza datos geométricos inválidos, opciones ajenas y respuestas ambiguas', () => {
  const cases = [
    ['figuras-n1-02', exercise => { exercise.visual.marked_sides = [0, 0]; }],
    ['figuras-n1-02', exercise => { exercise.visual.marked_sides = [3]; }],
    ['figuras-n1-02', exercise => { exercise.visual.marked_sides = []; }],
    ['figuras-n2-01', exercise => { exercise.options[0] = 'triángulo'; }],
    ['figuras-n2-01', exercise => { exercise.correct_answer = 'Cuadrado'; exercise.answer_index = 0; }],
    ['figuras-n1-01', exercise => { exercise.visual.figures[1].label = 'A'; }],
    ['figuras-n1-01', exercise => { exercise.visual.figures[0].label = 'A" onclick="x'; }],
    ['figuras-n1-01', exercise => { exercise.visual.figures[0].shape = 'square'; }],
    ['figuras-n1-01', exercise => { exercise.options[0] = 'Z'; }],
    ['figuras-n1-01', exercise => { delete exercise.visual.reference; }],
    ['figuras-n1-03', exercise => { exercise.visual.target_sides = 6; }],
    ['figuras-n2-05', exercise => { exercise.options[0] = 'C y A'; }],
    ['figuras-n2-05', exercise => { exercise.options[0] = 'A y Z'; }],
    ['figuras-n3-06', exercise => { exercise.visual.figures = exercise.visual.figures.slice(0, 1); }],
    ['figuras-n3-06', exercise => { exercise.visual.figures[1].shape = 'square'; }],
    ['figuras-n3-06', exercise => { exercise.visual.figures = Array(5).fill(exercise.visual.figures[0]); }],
  ];
  for (const [id, mutate] of cases) {
    const exercise = exerciseById(id);
    mutate(exercise);
    assert.throws(() => adaptExerciseToGame(exercise), TypeError, id);
    assert.throws(() => exerciseSemanticKey(exercise), TypeError, id);
  }
});

test('El adaptador rechaza restas negativas, operadores incoherentes y visuales de ejemplo interactivos', () => {
  for (const patch of [{ removed: 5 }, { removed: -1 }, { removed: 1.5 }, { removed: 3 },
    { initial: '4' }, { initial: Number.MAX_SAFE_INTEGER + 1 }, { display: 'interactive' }, { icon: 'missing' }]) {
    const exercise = exerciseById('cuantos-quedan-n1-01');
    Object.assign(exercise.visual, patch);
    assert.throws(() => adaptExerciseToGame(exercise), TypeError);
  }
  for (const patch of [{ operands: [2, 3] }, { operands: [6, 2] }, { operands: [6, '1'] }, { operator: '×' }, { operator: '+' }]) {
    const exercise = exerciseById('cuantos-quedan-n2-01');
    Object.assign(exercise.visual, patch);
    assert.throws(() => adaptExerciseToGame(exercise), TypeError);
  }
});
