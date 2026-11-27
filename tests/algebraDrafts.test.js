import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { getExerciseFeedback, shuffleExerciseOptions } from '../src/utils/lessonContent.js';

const directory = new URL('../content-drafts/', import.meta.url);
const readJson = url => JSON.parse(readFileSync(url, 'utf8'));
const readDraft = name => readJson(new URL(name + '.json', directory));
const spec = readDraft('algebra-visual-types');
const natural = value => Number.isSafeInteger(value) && value >= 0;
const sum = terms => terms.reduce((total, term) => total + term, 0);

function required(object, fields) {
  for (const field of fields) assert.ok(Object.hasOwn(object, field), 'Falta ' + field);
}

function staircaseEvidence(exercise, level) {
  const { visual, type, options, correct_answer: answer } = exercise;
  assert.equal(visual.type, 'number_staircase');
  const { steps, query_position: position } = visual;
  const known = steps.flatMap((value, index) => value === null ? [] : [[index, value]]);
  assert.ok(known.length >= 3 && known.every(([, value]) => natural(value)));
  const [firstIndex, first] = known[0];
  const [lastIndex, last] = known.at(-1);
  const delta = (last - first) / (lastIndex - firstIndex);
  const start = first - delta * firstIndex;
  assert.ok(Number.isInteger(delta) && delta !== 0 && natural(start));
  assert.ok(known.every(([index, value]) => start + delta * index === value));

  if (level === '2') {
    assert.equal(type, 'identificar-regla-de-escalera');
    assert.equal(position, undefined);
    assert.equal(known.length, steps.length);
    const candidates = options.filter(option => {
      const [, action, amount] = option.match(/^(Sumar|Restar) ([1-9]\d*)$/);
      return Number(amount) * (action === 'Sumar' ? 1 : -1) === delta;
    });
    assert.deepEqual(candidates, [answer]);
  } else {
    assert.ok(Number.isInteger(position) && position > 0);
    if (level === '1') {
      assert.equal(type, 'completar-escalera');
      assert.ok(delta > 0 && known.length === steps.length - 1);
      assert.equal(steps[position - 1], null);
    } else {
      assert.equal(type, 'predecir-escalon');
      assert.ok(position > steps.length && known.length === steps.length);
    }
    assert.equal(answer, start + (position - 1) * delta);
  }
  return [start, delta, position ?? null];
}

function balanceEvidence(exercise, level) {
  const { visual, type, options, correct_answer: answer } = exercise;
  assert.equal(visual.type, 'balance_model');
  const { left, right, display } = visual;
  assert.equal(display, level === '3' ? 'symbols' : 'objects');
  if (level === '1') {
    assert.equal(type, 'reconocer-equivalencia');
    assert.ok(left.length >= 2 && left.every(natural));
    assert.equal(right, null);
    const equivalent = options.filter(option => {
      assert.match(option, /^\d+(?: \+ \d+)+$/);
      return sum(option.split(' + ').map(Number)) === sum(left);
    });
    assert.deepEqual(equivalent, [answer]);
    return [...left].sort((a, b) => a - b);
  }
  assert.equal(type, level === '2' ? 'completar-balanza' : 'resolver-igualdad');
  assert.ok(left.length && right.length);
  const terms = [...left, ...right];
  assert.equal(terms.filter(value => value === null).length, 1);
  assert.ok(terms.every(value => value === null || natural(value)));
  const totals = side => value => sum(side.map(term => term ?? value));
  const equal = options.filter(value => totals(left)(value) === totals(right)(value));
  assert.deepEqual(equal, [answer]);
  const normalized = [left, right].map(side => JSON.stringify([...side].sort()));
  return normalized.sort();
}

function hiddenEvidence(exercise, level) {
  const { visual, type, prompt, options, correct_answer: answer } = exercise;
  assert.equal(visual.type, 'unknown_number');
  const { operator, operands, result, display } = visual;
  const types = ['completar-suma-con-caja', 'resolver-operacion-con-caja', 'resolver-problema-con-incognita'];
  assert.equal(type, types[Number(level) - 1]);
  assert.ok(spec.visuals.unknown_number.operators.includes(operator));
  if (level === '1') assert.equal(operator, '+');
  assert.equal(display, level === '3' ? 'story' : 'box');
  assert.equal(operands.length, 2);
  assert.equal(operands.filter(value => value === null).length, 1);
  assert.ok(natural(result) && operands.every(value => value === null || natural(value)));

  const matching = options.filter(value => {
    const [first, second] = operands.map(operand => operand ?? value);
    return (operator === '+' ? first + second : first - second) === result;
  });
  assert.deepEqual(matching, [answer]);
  if (level === '3') {
    const shown = [...prompt.matchAll(/\b\d+\b/g)].map(([value]) => Number(value));
    assert.deepEqual(shown, [...operands.filter(natural), result]);
  }
  return [operator, operands, result];
}

function apply(value, { operator, amount }) {
  assert.ok(natural(value) && Number.isInteger(amount) && amount > 0);
  switch (operator) {
    case '+': return value + amount;
    case '-': return value - amount;
    case '×': return value * amount;
    default: assert.fail('Operador fuera del contrato');
  }
}

function parseRule(text) {
  const [, name, amount] = text.match(/^(Sumar|Restar|Multiplicar por) ([1-9]\d*)$/);
  return { operator: { Sumar: '+', Restar: '-', 'Multiplicar por': '×' }[name], amount: Number(amount) };
}

function machineEvidence(exercise, level) {
  const { visual, type, options, correct_answer: answer } = exercise;
  assert.equal(visual.type, 'rule_machine');
  if (level === '2') {
    assert.equal(type, 'descubrir-regla-simple');
    assert.equal(visual.operations, undefined);
    const { examples } = visual;
    assert.ok(examples.length >= 3 && examples.every(({ input, output }) => natural(input) && natural(output)));
    assert.equal(new Set(examples.map(({ input }) => input)).size, examples.length);
    const consistent = options.filter(option => {
      const rule = parseRule(option);
      return examples.every(({ input, output }) => apply(input, rule) === output);
    });
    assert.deepEqual(consistent, [answer]);
    return examples.map(({ input, output }) => [input, output]).sort(([a], [b]) => a - b);
  }

  assert.equal(type, level === '1' ? 'aplicar-regla-simple' : 'aplicar-reglas-consecutivas');
  assert.equal(visual.operations.length, level === '1' ? 1 : 2);
  assert.ok(natural(visual.input));
  const output = visual.operations.reduce((value, { operator, value: amount }) => {
    const result = apply(value, { operator, amount });
    assert.ok(natural(result));
    return result;
  }, visual.input);
  assert.equal(answer, output);
  return [visual.input, visual.operations.map(({ operator, value }) => [operator, value])];
}

function growingEvidence(exercise, level) {
  const { visual, type, options, correct_answer: answer } = exercise;
  assert.equal(visual.type, 'growing_pattern');
  const { stages, query_position: position } = visual;
  assert.ok(stages.length >= 3);
  for (const { position: step, groups, fixed } of stages) {
    assert.ok(Number.isInteger(step) && step > 0 && natural(fixed));
    assert.equal(groups.length, step);
    assert.ok(groups.every(group => Number.isInteger(group) && group > 0));
  }
  const totals = stages.map(({ position: step, groups, fixed }) => [step, sum(groups) + fixed]);
  assert.ok(totals.every(([step], index) => index === 0 || step > totals[index - 1][0]));
  const [[first, smallest], [second, next]] = totals;
  const gain = (next - smallest) / (second - first);
  const fixed = smallest - gain * first;
  assert.ok(Number.isInteger(gain) && gain > 0 && natural(fixed));
  assert.ok(stages.every(stage => stage.fixed === fixed && stage.groups.every(part => part === gain)));

  if (level === '3') {
    assert.equal(type, 'deducir-regla-del-dibujo');
    assert.equal(position, undefined);
    const candidates = options.filter(option => {
      const [, perStep, fixedPieces] = option.match(/^(\d+) por paso y (\d+) ficha(?:s)? fija(?:s)?$/);
      return totals.every(([step, value]) => Number(perStep) * step + Number(fixedPieces) === value);
    });
    assert.deepEqual(candidates, [answer]);
  } else {
    assert.equal(type, level === '1' ? 'contar-piezas-de-un-paso' : 'relacionar-paso-con-cantidad');
    assert.ok(Number.isInteger(position) && position > 0);
    assert.equal(totals.some(([step]) => step === position), level === '1');
    assert.equal(answer, gain * position + fixed);
  }
  return [gain, fixed, position ?? null];
}

const drafts = [
  ['escaleras-de-numeros', 'Escaleras de números', 'visual', staircaseEvidence],
  ['la-balanza-de-numu', 'La balanza de NUMU', 'interactive', balanceEvidence],
  ['el-numero-escondido', 'El número escondido', 'visual', hiddenEvidence],
  ['la-maquina-de-reglas', 'La máquina de reglas', 'interactive', machineEvidence],
  ['de-un-dibujo-a-una-regla', 'De un dibujo a una regla', 'visual', growingEvidence],
].map(([id, title, mode, evidence], index) => ({ id, title, mode, evidence, position: index + 1, lesson: readDraft(id) }));

test('Álgebra conserva los cinco IDs aprobados y aporta 90 ejercicios de borrador con IDs únicos', () => {
  const catalog = readJson(new URL('../src/data/lessonContent.json', import.meta.url));
  const published = catalog.courses.flatMap(({ lessons }) => lessons);
  assert.deepEqual(published.map(({ id }) => id), ['conteo-basico', 'sumas-basicas', 'figuras', 'patrones']);
  const documents = readdirSync(directory).filter(name => name.endsWith('.json'))
    .map(name => readJson(new URL(name, directory))).filter(document => document.levels);
  const items = [
    ...catalog.courses, ...published, ...published.flatMap(({ exercises }) => exercises),
    ...documents.filter(({ id }) => id),
    ...documents.flatMap(({ levels }) => Object.values(levels).flatMap(({ exercises }) => exercises)),
  ];
  assert.equal(new Set(items.map(({ id }) => id)).size, items.length);
  assert.deepEqual(documents.filter(({ course_id }) => course_id === 'algebra').map(({ id }) => id).sort(),
    drafts.map(({ id }) => id).sort());
  let total = 0;
  for (const { lesson, id, title, mode, position } of drafts) {
    assert.equal(lesson.id, id);
    assert.equal(lesson.title, title);
    assert.equal(lesson.course_id, 'algebra');
    assert.equal(lesson.position, position);
    assert.equal(lesson.base_level, 1);
    assert.equal(lesson.published, false);
    assert.equal(lesson.guided_example.mode, mode);
    assert.ok(lesson.objective.trim() && lesson.explanation.trim() && lesson.guided_example.explanation.trim());
    required(lesson.guided_example.visual, spec.visuals[lesson.guided_example.visual.type].required);
    assert.deepEqual(Object.keys(lesson.levels), ['1', '2', '3']);
    total += Object.values(lesson.levels).reduce((count, bank) => count + bank.exercises.length, 0);
  }
  assert.equal(total, 90);
});

test('Los cinco ejemplos guiados concuerdan con sus datos y las dos interacciones acordadas', () => {
  const [stair, balance, hidden, machine, growth] = drafts.map(({ lesson }) => lesson.guided_example);
  assert.deepEqual(stair.visual.steps, [2, 4, 6, 8]);
  assert.equal(stair.visual.query_position, 5);
  assert.deepEqual([balance.visual.left, balance.visual.right], [[6], [4, null]]);
  assert.deepEqual(hidden.visual.operands, [null, 3]);
  assert.equal(hidden.visual.result, 8);
  assert.deepEqual(machine.visual.inputs, [2, 3, 5]);
  assert.deepEqual(machine.visual.operations, [{ operator: '×', value: 2 }]);
  assert.deepEqual(growth.visual.stages.map(({ groups, fixed }) => sum(groups) + fixed), [3, 5, 7]);
  assert.deepEqual([balance.interaction.type, machine.interaction.type], ['balance_objects', 'try_rule_machine']);
  for (const example of [balance, machine]) {
    const { interaction } = example;
    required(interaction, spec.interactions[interaction.type].required);
    assert.ok(interaction.instructions.length >= 2 && interaction.instructions.every(text => text.trim()));
    assert.ok(interaction.feedback_on_complete.trim() && interaction.restart_label.trim());
  }
});

for (const { lesson, evidence } of drafts) {
  for (const [level, { exercises, exercise_types: types }] of Object.entries(lesson.levels)) {
    test(lesson.title + ' N' + level + ' tiene seis preguntas distintas con una solución válida', () => {
      assert.equal(exercises.length, 6);
      assert.deepEqual([...types].sort(), [...new Set(exercises.map(({ type }) => type))].sort());
      const keys = new Set();
      for (const exercise of exercises) {
        const { id, type, visual, options, answer_index: index, correct_answer: answer, prompt, hint } = exercise;
        assert.match(id, new RegExp('^' + lesson.id + '-n' + level + '-\\d{2}$'));
        assert.match(prompt, /¿[^?]+\?/);
        required(visual, spec.visuals[visual.type].required);
        assert.equal(options.length, 4, id);
        assert.equal(new Set(options).size, 4, id);
        assert.ok(options.every(option => typeof answer === 'number' ? natural(option) : typeof option === 'string' && option.trim()));
        assert.equal(options[index], answer, id);
        assert.deepEqual(getExerciseFeedback(exercise, index),
          { valid: true, correct: true, message: exercise.feedback_correct }, id);
        assert.deepEqual(getExerciseFeedback(exercise, options.findIndex(option => option !== answer)),
          { valid: true, correct: false, message: exercise.feedback_incorrect }, id);
        assert.doesNotMatch(hint, /\d/, id);
        const mixed = shuffleExerciseOptions(exercise, () => 0);
        assert.equal(mixed.options[mixed.answer_index], answer, id);
        const key = JSON.stringify([type, evidence(exercise, level)]);
        assert.ok(!keys.has(key), id + ' repite el planteamiento matemático de otra pregunta');
        keys.add(key);
      }
      if (lesson.id === 'escaleras-de-numeros' && level === '2') {
        assert.ok(exercises.some(({ correct_answer: answer }) => answer.startsWith('Sumar')));
        assert.ok(exercises.some(({ correct_answer: answer }) => answer.startsWith('Restar')));
      }
      if (lesson.id === 'el-numero-escondido' && level !== '1') {
        assert.deepEqual([...new Set(exercises.map(({ visual }) => visual.operator))].sort(), ['+', '-']);
      }
    });
  }
}
