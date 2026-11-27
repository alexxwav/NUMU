import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { getExerciseFeedback, shuffleExerciseOptions } from '../src/utils/lessonContent.js';

const directory = new URL('../content-drafts/', import.meta.url);
function readJson(url) {
  return JSON.parse(readFileSync(url, 'utf8'));
}

const spec = readJson(new URL('geometry-visual-types.json', directory));
const drafts = [
  ['la-mitad-del-espejo', 'La mitad del espejo', 3, 'interactive'],
  ['una-vuelta-al-contorno', 'Una vuelta al contorno', 4, 'visual'],
  ['llenamos-el-mosaico', 'Llenamos el mosaico', 5, 'interactive'],
].map(([id, title, position, mode]) => ({
  lesson: readJson(new URL(id + '.json', directory)), id, title, position, mode,
}));
const [mirror, perimeter, mosaic] = drafts.map(({ lesson }) => lesson);
const labels = ['A', 'B', 'C', 'D'];
const cellKey = cell => cell.join(',');

function required(data, fields) {
  for (const field of fields) assert.ok(Object.hasOwn(data, field), 'Falta ' + field);
}

function cellSet(cells, rows, columns) {
  assert.ok(Array.isArray(cells));
  for (const cell of cells) {
    assert.equal(cell.length, 2);
    const [row, col] = cell;
    assert.ok(Number.isInteger(row) && row >= 1 && row <= rows);
    assert.ok(Number.isInteger(col) && col >= 1 && col <= columns);
  }
  const keys = new Set(cells.map(cellKey));
  assert.equal(keys.size, cells.length);
  return keys;
}

function gridSize(rows, columns) {
  assert.ok([rows, columns].every(size => Number.isInteger(size) && size > 0));
}

function mirrorRules(visual) {
  assert.equal(visual.type, 'reflection_grid');
  required(visual, spec.visuals.reflection_grid.required);
  const { rows, columns, axis: { direction, after } } = visual;
  gridSize(rows, columns);
  assert.ok(spec.visuals.reflection_grid.axis.direction.includes(direction));
  const perpendicular = direction === 'vertical' ? 1 : 0;
  const size = perpendicular === 1 ? columns : rows;
  assert.ok(Number.isInteger(after) && after > 0 && after * 2 === size);

  const reflect = cell => cell.map((coordinate, index) =>
    index === perpendicular ? size - coordinate + 1 : coordinate);
  return { reflect, perpendicular, after };
}

function shapeEvidenceForReflection(cells, perpendicular, after) {
  const parallel = perpendicular === 0 ? 1 : 0;
  const offset = Math.min(...cells.map(cell => cell[parallel]));
  return cells.map(cell => cellKey([cell[parallel] - offset, cell[perpendicular] - after])).sort();
}

function reflectionEvidence(exercise, level) {
  const { visual, type, options, correct_answer: answer } = exercise;
  const { reflect, perpendicular, after } = mirrorRules(visual);
  const { rows, columns, choices } = visual;
  const expectedType = ['elegir-reflejo', 'completar-reflejo', 'identificar-ficha-sin-reflejo'][Number(level) - 1];
  assert.equal(type, expectedType);
  required(visual, spec.visuals.reflection_grid.by_exercise[type]);
  assert.deepEqual(choices.map(({ label }) => label), labels);
  assert.deepEqual([...options].sort(), labels);
  const cardSets = choices.map(({ cells }) => cellSet(cells, rows, columns));
  assert.equal(new Set(cardSets.map(set => JSON.stringify([...set].sort()))).size, labels.length);

  if (level === '3') {
    const filled = cellSet(visual.filled_cells, rows, columns);
    assert.ok(filled.size >= 5);
    const unmatched = visual.filled_cells.filter(cell => !filled.has(cellKey(reflect(cell))));
    assert.equal(unmatched.length, 1);
    const matching = [];
    for (const { label, cells } of choices) {
      assert.equal(cells.length, 1);
      assert.ok(filled.has(cellKey(cells[0])));
      if (cellKey(cells[0]) === cellKey(unmatched[0])) matching.push(label);
    }
    assert.deepEqual(matching, [answer]);
    return [visual.axis.direction, shapeEvidenceForReflection(visual.filled_cells, perpendicular, after)];
  }

  const source = visual.source_cells;
  assert.ok(cellSet(source, rows, columns).size > 0);
  assert.ok(source.every(cell => cell[perpendicular] <= after));
  const mirrored = new Set(source.map(cell => cellKey(reflect(cell))));
  const placed = cellSet(visual.placed_cells ?? [], rows, columns);
  assert.ok([...placed].every(key => mirrored.has(key)));
  assert.equal(placed.size, level === '1' ? 0 : source.length - 1);
  const missing = [...mirrored].filter(key => !placed.has(key)).sort();
  const matching = [];
  choices.forEach(({ label, cells }, index) => {
    assert.ok(cells.every(cell => cell[perpendicular] > after && !placed.has(cellKey(cell))));
    assert.equal(cells.length, missing.length);
    if ([...cardSets[index]].sort().every((key, i) => key === missing[i])) matching.push(label);
  });
  assert.deepEqual(matching, [answer]);
  return [visual.axis.direction, shapeEvidenceForReflection(source, perpendicular, after),
    level === '2' ? shapeEvidenceForReflection(visual.placed_cells, perpendicular, after) : []];
}

function connected(cells, filled) {
  const visited = new Set();
  const pending = [cells[0]];
  while (pending.length) {
    const [row, col] = pending.pop();
    const key = cellKey([row, col]);
    if (!filled.has(key) || visited.has(key)) continue;
    visited.add(key);
    pending.push([row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]);
  }
  return visited.size === filled.size;
}

function canonicalShape(cells) {
  const views = [];
  for (const swap of [false, true]) {
    for (const rowSign of [1, -1]) {
      for (const columnSign of [1, -1]) {
        const oriented = cells.map(([row, col]) => swap ? [col * rowSign, row * columnSign] : [row * rowSign, col * columnSign]);
        const top = Math.min(...oriented.map(([row]) => row));
        const left = Math.min(...oriented.map(([, col]) => col));
        views.push(oriented.map(([row, col]) => cellKey([row - top, col - left])).sort().join(';'));
      }
    }
  }
  return views.sort()[0];
}

function measure(figure) {
  required(figure, spec.visuals.measurement_grid.figure.required);
  const { rows, columns, cells, label } = figure;
  gridSize(rows, columns);
  const filled = cellSet(cells, rows, columns);
  assert.ok(filled.size > 0 && connected(cells, filled));
  const sharedEdges = cells.reduce((count, [row, col]) =>
    count + Number(filled.has(cellKey([row + 1, col]))) + Number(filled.has(cellKey([row, col + 1]))), 0);
  return { label, area: filled.size, perimeter: 4 * filled.size - 2 * sharedEdges, key: canonicalShape(cells) };
}

function checkSameAreaPair(figureA, figureB) {
  assert.equal(figureA.area, figureB.area);
  assert.notEqual(figureA.perimeter, figureB.perimeter);
}

function measurementEvidence(exercise, level, mode) {
  const { visual, type, correct_answer: answer, options } = exercise;
  required(visual, spec.visuals.measurement_grid.required);
  assert.equal(visual.type, 'measurement_grid');
  assert.equal(visual.mode, mode);
  const { figures, show_dimensions: show } = visual;
  assert.ok(spec.visuals.measurement_grid.figure.counts.includes(figures.length));
  assert.deepEqual(figures.map(({ label }) => label), labels.slice(0, figures.length));
  const measures = figures.map(measure);

  if (level === '1' || level === '2') {
    const expectedTypes = mode === 'perimeter' ? ['contar-tramos-del-borde', 'sumar-lados-de-rectangulo']
      : ['contar-baldosas', 'calcular-area-de-rectangulo'];
    assert.equal(type, expectedTypes[Number(level) - 1]);
    assert.equal(figures.length, 1);
    const [{ area, perimeter }] = measures;
    assert.equal(answer, mode === 'perimeter' ? perimeter : area);
    assert.equal(show === true, mode === 'perimeter' && level === '2');
    if (level === '2') {
      const [{ rows, columns }] = figures;
      assert.equal(area, rows * columns);
      assert.equal(perimeter, 2 * rows + 2 * columns);
    }
  } else if (mode === 'perimeter') {
    assert.equal(type, 'comparar-perimetros');
    assert.equal(figures.length, 2);
    assert.equal(answer, Math.abs(measures[0].perimeter - measures[1].perimeter));
  } else if (type === 'hallar-area-comun') {
    assert.equal(figures.length, 2);
    checkSameAreaPair(...measures);
    assert.equal(answer, measures[0].area);
  } else {
    assert.equal(type, 'elegir-par-de-igual-area');
    assert.equal(figures.length, 4);
    const matches = measures.flatMap((first, index) => measures.slice(index + 1)
      .filter(second => first.area === second.area)
      .map(second => {
        checkSameAreaPair(first, second);
        return first.label + ' y ' + second.label;
      }));
    for (const option of options) {
      assert.match(option, /^[A-D] y [A-D]$/);
      assert.ok(option[0] < option.at(-1));
    }
    assert.deepEqual(matches, [answer]);
  }
  return measures.map(({ key }) => key).sort();
}

test('Los borradores de Geometría preservan el curso técnico y aportan 54 IDs de ejercicio únicos', () => {
  const catalog = readJson(new URL('../src/data/lessonContent.json', import.meta.url));
  const published = catalog.courses.flatMap(course => course.lessons).filter(lesson => lesson.published);
  const documents = readdirSync(directory).filter(name => name.endsWith('.json'))
    .map(name => readJson(new URL(name, directory))).filter(document => document.levels);
  const items = [
    ...catalog.courses, ...published, ...published.flatMap(({ exercises }) => exercises),
    ...documents.filter(({ id }) => id),
    ...documents.flatMap(({ levels }) => Object.values(levels).flatMap(({ exercises }) => exercises)),
  ];
  assert.equal(new Set(items.map(({ id }) => id)).size, items.length);

  let exerciseCount = 0;
  for (const { lesson, id, title, position, mode } of drafts) {
    assert.equal(lesson.id, id);
    assert.equal(lesson.title, title);
    assert.equal(lesson.course_id, 'geometria-patrones');
    assert.equal(lesson.position, position);
    assert.equal(lesson.base_level, 1);
    assert.equal(lesson.published, false);
    assert.equal(lesson.guided_example.mode, mode);
    assert.equal(published.some(existing => existing.id === id), false);
    assert.ok(lesson.objective.trim() && lesson.explanation.trim() && lesson.guided_example.explanation.trim());
    assert.deepEqual(Object.keys(lesson.levels), ['1', '2', '3']);
    exerciseCount += Object.values(lesson.levels).reduce((sum, { exercises }) => sum + exercises.length, 0);
  }
  assert.equal(exerciseCount, 54);
});

test('Los ejemplos guiados representan el espejo, el contorno rectangular y la superficie que se cubre', () => {
  const mirrorExample = mirror.guided_example;
  const { reflect } = mirrorRules(mirrorExample.visual);
  const { rows, columns, source_cells: source, placed_cells: placed } = mirrorExample.visual;
  assert.ok(cellSet(source, rows, columns).size > 0);
  assert.ok(source.every(([, column]) => column <= mirrorExample.visual.axis.after));
  assert.equal(cellSet(source.map(reflect), rows, columns).size, source.length);
  assert.deepEqual(placed, []);

  const perimeterExample = perimeter.guided_example;
  assert.equal(perimeterExample.visual.mode, 'perimeter');
  assert.equal(perimeterExample.visual.show_dimensions, true);
  assert.equal(perimeterExample.visual.figures.length, 1);
  assert.equal(measure(perimeterExample.visual.figures[0]).perimeter, 10);
  assert.match(perimeterExample.explanation, /3 \+ 2 \+ 3 \+ 2 = 10/);

  const mosaicExample = mosaic.guided_example;
  assert.equal(mosaicExample.visual.mode, 'area');
  assert.equal(mosaicExample.visual.figures.length, 1);
  assert.equal(measure(mosaicExample.visual.figures[0]).area, 6);
  assert.match(mosaicExample.interaction.feedback_on_complete, /2 × 3 = 6/);
  assert.deepEqual([mirrorExample.interaction.type, mosaicExample.interaction.type], ['place_reflection_cells', 'place_tiles']);
  for (const interaction of [mirrorExample.interaction, mosaicExample.interaction]) {
    required(interaction, spec.interactions[interaction.type].required);
    assert.equal(interaction.instructions.length, 3);
    assert.ok(interaction.instructions.every(instruction => instruction.trim()));
    assert.ok(interaction.feedback_on_complete.trim() && interaction.restart_label.trim());
  }
});

for (const [lesson, check] of [
  [mirror, reflectionEvidence],
  [perimeter, (exercise, level) => measurementEvidence(exercise, level, 'perimeter')],
  [mosaic, (exercise, level) => measurementEvidence(exercise, level, 'area')],
]) {
  for (const [level, { exercise_types: types, exercises }] of Object.entries(lesson.levels)) {
    test(lesson.title + ' N' + level + ' contiene seis problemas distintos con una respuesta válida', () => {
      assert.equal(exercises.length, 6);
      assert.deepEqual([...types].sort(), [...new Set(exercises.map(({ type }) => type))].sort());
      const signatures = new Set();
      for (const exercise of exercises) {
        const { id, options, prompt, answer_index: answerIndex, correct_answer: answer, hint } = exercise;
        assert.match(id, new RegExp('^' + lesson.id + '-n' + level + '-\\d{2}$'));
        assert.match(prompt, /¿[^?]+\?/);
        assert.equal(options.length, 4);
        assert.equal(new Set(options).size, 4);
        assert.ok(options.every(option => typeof answer === 'number'
          ? Number.isInteger(option) && option >= 0
          : typeof option === 'string' && Boolean(option.trim())));
        assert.equal(options[answerIndex], answer);
        assert.deepEqual(getExerciseFeedback(exercise, answerIndex),
          { valid: true, correct: true, message: exercise.feedback_correct });
        const wrongIndex = options.findIndex(option => option !== answer);
        assert.deepEqual(getExerciseFeedback(exercise, wrongIndex),
          { valid: true, correct: false, message: exercise.feedback_incorrect });
        assert.doesNotMatch(hint, /\d/);
        const shuffled = shuffleExerciseOptions(exercise, () => 0);
        assert.equal(shuffled.options[shuffled.answer_index], answer);
        const signature = JSON.stringify(check(exercise, level));
        assert.ok(!signatures.has(signature), id + ' duplica otro problema del nivel');
        signatures.add(signature);
      }
      if (lesson === mirror && level !== '1') {
        assert.deepEqual([...new Set(exercises.map(({ visual }) => visual.axis.direction))].sort(), ['horizontal', 'vertical']);
      }
      if (lesson === perimeter && level === '3') {
        assert.ok(exercises.some(({ correct_answer: answer }) => answer === 0));
        assert.ok(exercises.some(({ correct_answer: answer }) => answer > 0));
      }
    });
  }
}
