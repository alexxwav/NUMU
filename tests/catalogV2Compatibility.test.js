import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { loadCatalogV2, draftIds } from '../content-drafts/catalog-v2.fixture.js';
import { generateQuestions } from '../src/state/questions.js';
import { shuffleExerciseOptions } from '../src/utils/lessonContent.js';
import { adaptExerciseToGame, exerciseSemanticKey } from '../src/utils/lessonGameAdapter.js';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const published = read('../src/data/lessonContent.json');
const added = draftIds.map(id => read('../content-drafts/' + id + '.json'));
const expansion = read('../content-drafts/figuras-ampliacion.json');
const orderedAreas = ['aritmetica', 'geometria-patrones', 'algebra'];
const originals = published.courses.flatMap(course => course.lessons);
const exercisesOf = draft => Object.values(draft.levels).flatMap(bank => bank.exercises);
const areaExercises = new Map(orderedAreas.map(area => [area, [
  ...originals.filter(lesson => lesson.course_id === area).flatMap(lesson => lesson.exercises),
  ...added.filter(lesson => lesson.course_id === area).flatMap(exercisesOf),
  ...(area === 'geometria-patrones' ? exercisesOf(expansion) : []),
]]));
const byId = id => structuredClone([...areaExercises.values()].flat().find(exercise => exercise.id === id));
const catalog = loadCatalogV2();
const lessons = catalog.courses.flatMap(course => course.lessons);

test('El fixture v2 reúne 15 lecciones en tres áreas con IDs únicos y estado de publicación intacto', () => {
  const originalIds = ['conteo-basico', 'sumas-basicas', 'figuras', 'patrones'];
  assert.deepEqual(originals.map(lesson => lesson.id), originalIds);
  assert.deepEqual(catalog.courses.map(course => course.id), orderedAreas);
  assert.equal(added.length, 11);
  for (const course of catalog.courses) {
    assert.deepEqual(course.lessons.map(lesson => lesson.position), [1, 2, 3, 4, 5]);
    assert.ok(course.lessons.every(lesson => lesson.course_id === course.id));
  }
  assert.equal(lessons.length, 15);
  for (const original of originals) {
    const { levels, ...rest } = lessons.find(lesson => lesson.id === original.id);
    assert.deepEqual(rest, original);
    assert.deepEqual(Object.keys(levels), ['1', '2', '3']);
  }
  for (const draft of added) assert.equal(draft.published, false);
  assert.equal(expansion.lesson_id, 'figuras');
  assert.equal(expansion.published, false);
  const uniqueIds = [...orderedAreas, ...lessons.map(lesson => lesson.id),
    ...[...areaExercises.values()].flat().map(exercise => exercise.id)];
  assert.equal(new Set(uniqueIds).size, uniqueIds.length);
});

for (const [area, expected] of [['aritmetica', 66], ['geometria-patrones', 81], ['algebra', 90]]) {
  test(area + ' adapta los ' + expected + ' ejercicios editoriales íntegros, con cuatro opciones', () => {
    const items = areaExercises.get(area);
    assert.equal(items.length, expected);
    for (const exercise of items) {
      const mixed = shuffleExerciseOptions(exercise, () => 0);
      const initial = adaptExerciseToGame(exercise);
      const adapted = adaptExerciseToGame(mixed);
      assert.equal(adapted.semanticKey, initial.semanticKey, exercise.id);
      assert.equal(adapted.options.length, 4, exercise.id);
      assert.equal(new Set(adapted.options.map(option => option.label)).size, 4, exercise.id);
      assert.equal(adapted.options[adapted.answerIndex].label, String(exercise.correct_answer), exercise.id);
      for (const field of ['prompt', 'hint', 'feedback_correct', 'feedback_incorrect']) {
        assert.ok(exercise[field].trim(), exercise.id);
        assert.equal(adapted[field], exercise[field], exercise.id);
      }
    }
  });
}

const colorNames = {
  '#5124EE': 'Morado', '#FFC700': 'Amarillo', '#00D282': 'Verde', '#FF5A5F': 'Coral', '#00B4D8': 'Cian',
};
function legacyEvidence(module, level, question) {
  if (module === 'conteo') {
    const amount = Number(question.options[question.answerIndex].label);
    return ['contar-objetos', [amount]];
  }
  if (module === 'aritmetica') {
    const [, left, sign, right] = question.prompt.match(/(\d+) ([+−]) (\d+)/);
    return [sign === '+' ? 'resolver-suma' : 'resolver-resta', [Number(left), Number(right)]];
  }
  assert.equal(module, 'patrones');
  const length = level >= 3 ? 3 : 2;
  const colors = Array.from(question.visual.matchAll(/background:(#[0-9A-F]{6})/g), match => colorNames[match[1]]);
  assert.ok(colors.length >= length && colors.every(Boolean));
  return ['continuar-patron', colors.slice(0, length)];
}

function generatedKeys(module, level) {
  const originalRandom = Math.random;
  let seed = 6219;
  try {
    Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    return generateQuestions(module, level, 256).map(question => JSON.stringify(legacyEvidence(module, level, question)));
  } finally {
    Math.random = originalRandom;
  }
}

test('El fixture distingue cobertura editorial, capacidad del generador legado y faltantes reales', () => {
  const missing = [];
  let checked = 0;
  for (const lesson of lessons) {
    assert.deepEqual(Object.keys(lesson.levels), ['1', '2', '3']);
    for (const [index, bank] of Object.entries(lesson.levels)) {
      checked++;
      const level = Number(index);
      const keys = new Set(bank.exercises.map(exerciseSemanticKey));
      for (const key of keys) assert.ok(bank.exercise_types.includes(JSON.parse(key)[0]));
      if (lesson.published === false) {
        assert.equal(bank.exercises.length, 6, lesson.id + ' N' + index);
        assert.equal(keys.size, 6, lesson.id + ' N' + index);
      }
      if (lesson.id === 'figuras') assert.equal(keys.size, level === 1 ? 6 : 10);
      if (bank.generator_key) {
        assert.equal(bank.generator_key, lesson.module_id);
        for (const key of generatedKeys(bank.generator_key, level)) {
          assert.ok(bank.exercise_types.includes(JSON.parse(key)[0]));
          keys.add(key);
        }
      }
      if (keys.size < 6) missing.push([lesson.id, level, keys.size]);
    }
  }
  assert.equal(checked, 45);
  // Conteo deduplica por cantidad. Un icono diferente no añade otra operación de conteo.
  assert.deepEqual(missing, [['conteo-basico', 1, 4], ['conteo-basico', 2, 5]]);
});

test('Los diez tipos nuevos validan la respuesta matemática y dan una descripción accesible', () => {
  const proposed = ['geometry-visual-types', 'algebra-visual-types', 'arithmetic-visual-types']
    .flatMap(name => Object.keys(read('../content-drafts/' + name + '.json').visuals));
  const cases = [...areaExercises.values()].flat().filter(exercise => proposed.includes(exercise.visual.type));
  assert.equal(cases.length, 180);
  assert.deepEqual([...new Set(cases.map(exercise => exercise.visual.type))].sort(), [...proposed].sort());
  for (const item of cases) {
    const question = adaptExerciseToGame(item);
    assert.match(question.visual, /aria-label="[^"]+"/, item.id);
    assert.doesNotMatch(question.visual, /respuesta correcta|<script|onclick=/i);
    const wrong = structuredClone(item);
    wrong.answer_index = (item.answer_index + 1) % item.options.length;
    wrong.correct_answer = wrong.options[wrong.answer_index];
    assert.throws(() => adaptExerciseToGame(wrong), TypeError, item.id);
  }
});

test('Las cuadrículas ignoran rótulos y giros decorativos al calcular la clave', () => {
  const original = byId('la-mitad-del-espejo-n1-01');
  const renamed = structuredClone(original);
  const mapping = { A: 'Z', B: 'Y', C: 'W', D: 'X' };
  renamed.visual.choices.reverse();
  for (const card of renamed.visual.choices) card.label = mapping[card.label];
  renamed.options = renamed.options.map(label => mapping[label]);
  renamed.correct_answer = renamed.options[renamed.answer_index];
  renamed.prompt = '¿Dónde estaría la ficha en el espejo?';
  assert.equal(exerciseSemanticKey(original), exerciseSemanticKey(renamed));

  const perimeter = byId('una-vuelta-al-contorno-n1-03');
  const rotated = structuredClone(perimeter);
  const [figure] = rotated.visual.figures;
  figure.cells = figure.cells.map(([row, col]) => [col, figure.rows + 1 - row]).reverse();
  [figure.rows, figure.columns] = [figure.columns, figure.rows];
  figure.label = 'M';
  assert.equal(exerciseSemanticKey(perimeter), exerciseSemanticKey(rotated));
});

test('Las claves de patrones e igualdades conservan la operación e ignoran adorno y orden no matemático', () => {
  const growth = byId('de-un-dibujo-a-una-regla-n2-01');
  const decorative = structuredClone(growth);
  decorative.visual.repeated_icon = 'fish';
  decorative.visual.fixed_icon = 'heart';
  decorative.prompt = '¿Qué cantidad de piezas corresponde al paso solicitado?';
  assert.equal(exerciseSemanticKey(growth), exerciseSemanticKey(decorative));
  assert.notEqual(exerciseSemanticKey(growth), exerciseSemanticKey(byId('de-un-dibujo-a-una-regla-n2-02')));

  const balance = byId('la-balanza-de-numu-n3-01');
  const swapped = structuredClone(balance);
  [swapped.visual.left, swapped.visual.right] = [swapped.visual.right.reverse(), swapped.visual.left.reverse()];
  assert.equal(exerciseSemanticKey(balance), exerciseSemanticKey(swapped));
  assert.notEqual(exerciseSemanticKey(balance), exerciseSemanticKey(byId('la-balanza-de-numu-n3-02')));
});

test('Las etiquetas y figuras solo muestran los datos de partida de los ejercicios con incógnitas', () => {
  const machine = adaptExerciseToGame(byId('la-maquina-de-reglas-n3-01'));
  assert.match(machine.visual, /aria-label="Entra 3\. Sumar 2\. Multiplicar por 2\. salida vacía"/);
  assert.doesNotMatch(machine.visual, /\b10\b/);

  const hidden = adaptExerciseToGame(byId('el-numero-escondido-n1-02'));
  assert.match(hidden.visual, /aria-label="casilla vacía más 2 igual a 8"/);
  assert.doesNotMatch(hidden.visual, /\b6\b/);

  const area = adaptExerciseToGame(byId('llenamos-el-mosaico-n1-01'));
  assert.match(area.visual, /aria-label="Figura A\. fila 1, columna 1; fila 1, columna 2"/);
  assert.doesNotMatch(area.visual, /Total|Área 2/i);
});

test('Se rechazan coordenadas repetidas, tarjetas ambiguas y operaciones contradictorias', () => {
  const cases = [
    ['la-mitad-del-espejo-n1-01', visual => { visual.choices[1].cells = visual.choices[0].cells; }],
    ['la-mitad-del-espejo-n2-01', visual => { visual.placed_cells.push([1, 1]); }],
    ['una-vuelta-al-contorno-n1-03', visual => { visual.figures[0].cells.push(visual.figures[0].cells[0]); }],
    ['llenamos-el-mosaico-n1-03', visual => { visual.figures[0].cells = [[1, 1], [2, 3]]; }],
    ['escaleras-de-numeros-n1-01', visual => { visual.steps[1] = 9; }],
    ['la-balanza-de-numu-n2-01', visual => { visual.right = [null]; }],
    ['el-numero-escondido-n1-01', visual => { visual.result++; }],
    ['la-maquina-de-reglas-n2-01', visual => { visual.examples[0].output++; }],
    ['de-un-dibujo-a-una-regla-n2-01', visual => { visual.stages[0].fixed += 1; }],
    ['repartimos-por-igual-n2-01', visual => { visual.total++; }],
  ];
  for (const [id, mutate] of cases) {
    const exercise = byId(id);
    mutate(exercise.visual);
    assert.throws(() => adaptExerciseToGame(exercise), TypeError, id);
  }
});
