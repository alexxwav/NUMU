import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8'));
}

const figuras = readJson('../content-drafts/figuras-ampliacion.json');
const restas = readJson('../content-drafts/cuantos-quedan.json');
const { visuals, interactions } = readJson('../content-drafts/visual-types.json');
const published = readJson('../src/data/lessonContent.json');
const publishedLessons = published.courses.flatMap(({ lessons }) => lessons);
const publishedExercises = publishedLessons.flatMap(({ exercises }) => exercises);
const sides = visuals.shape.polygons;
const shapeNames = { triangle: 'Triángulo', square: 'Cuadrado', pentagon: 'Pentágono', hexagon: 'Hexágono' };

function validateExercise(exercise) {
  const { id, options, correct_answer: answer, answer_index: index, hint } = exercise;
  for (const field of ['type', 'prompt', 'hint', 'feedback_correct', 'feedback_incorrect']) {
    assert.ok(typeof exercise[field] === 'string' && exercise[field].trim(), `${id}: falta ${field}`);
  }
  assert.ok(exercise.prompt.includes('¿') && exercise.prompt.endsWith('?'), id);
  assert.ok(Object.hasOwn(visuals, exercise.visual?.type), id);
  for (const field of visuals[exercise.visual.type].required) {
    assert.ok(Object.hasOwn(exercise.visual, field), `${id}: falta visual.${field}`);
  }
  assert.match(id, /^[a-z0-9-]+$/);
  assert.equal(options.length, 4, id);
  assert.equal(new Set(options).size, 4, id);
  assert.ok(options.every(option => typeof answer === 'number'
    ? Number.isInteger(option) && option >= 0
    : typeof option === 'string' && option.trim()), id);
  assert.ok(Number.isInteger(index) && index >= 0 && index < options.length, id);
  assert.equal(options[index], answer, id);
  assert.doesNotMatch(hint, /\d/, `${id}: la pista orienta sin mostrar cantidades numéricas`);
}

function validateLevel(level, evidenceOf, expectedCount = 6) {
  assert.equal(level.exercises.length, expectedCount);
  const usedTypes = [...new Set(level.exercises.map(({ type }) => type))].sort();
  assert.deepEqual([...level.exercise_types].sort(), usedTypes);

  const signatures = new Set();
  for (const exercise of level.exercises) {
    validateExercise(exercise);
    const evidence = evidenceOf(exercise);
    const signature = JSON.stringify([exercise.type, evidence]);
    assert.ok(!signatures.has(signature), `${exercise.id}: pregunta equivalente a otra del nivel`);
    signatures.add(signature);
  }
  return signatures;
}

function validateShape({ shape, rotation_degrees: rotation = 0, size = 'normal' }) {
  assert.ok(Object.hasOwn(sides, shape), shape);
  assert.ok(Number.isFinite(rotation) && rotation >= 0 && rotation < 360);
  assert.ok(visuals.shape.sizes.includes(size));
}

function geometryAnswers(type, visual) {
  switch (type) {
    case 'nombrar-figura':
      return [shapeNames[visual.shape]];
    case 'contar-lados-sin-marcar':
      return [sides[visual.shape] - visual.marked_sides.length];
    case 'elegir-por-lados':
      return visual.figures.filter(figure => sides[figure.shape] === visual.target_sides).map(figure => figure.label);
    case 'emparejar-figura':
      return visual.figures.filter(figure => figure.shape === visual.reference.shape).map(figure => figure.label);
    case 'encontrar-par-con-iguales-lados':
      return visual.figures.flatMap((first, index) => visual.figures.slice(index + 1)
        .filter(second => sides[first.shape] === sides[second.shape])
        .map(second => `${first.label} y ${second.label}`));
    case 'detectar-figura-distinta': {
      const counts = visual.figures.map(figure => sides[figure.shape]);
      assert.deepEqual([...new Set(counts)].map(count => counts.filter(value => value === count).length).sort(), [1, 3]);
      return visual.figures.filter((_, index) => counts.indexOf(counts[index]) === counts.lastIndexOf(counts[index]))
        .map(figure => figure.label);
    }
    case 'elegir-menos-lados':
    case 'elegir-mas-lados': {
      const counts = visual.figures.map(figure => sides[figure.shape]);
      const extremum = type === 'elegir-menos-lados' ? Math.min(...counts) : Math.max(...counts);
      return visual.figures.filter((_, index) => counts[index] === extremum).map(figure => figure.label);
    }
    case 'sumar-lados':
      return [visual.figures.reduce((sum, figure) => sum + sides[figure.shape], 0)];
    default:
      assert.fail(`Tipo de geometría desconocido: ${type}`);
  }
}

function geometryEvidence(exercise) {
  const { id, type, visual, options, hint, correct_answer: answer } = exercise;
  if (type === 'nombrar-figura' || type === 'contar-lados-sin-marcar') {
    assert.equal(visual.type, 'shape', id);
    validateShape(visual);
    if (type === 'nombrar-figura') {
      assert.deepEqual([...options].sort(), Object.values(shapeNames).sort(), id);
      assert.ok(!hint.toLocaleLowerCase('es').includes(answer.toLocaleLowerCase('es')), id);
    } else {
      const marks = visual.marked_sides;
      assert.ok(marks.length > 0 && marks.length < sides[visual.shape], id);
      assert.equal(new Set(marks).size, marks.length, id);
      assert.ok(marks.every(mark => Number.isInteger(mark) && mark >= 0 && mark < sides[visual.shape]), id);
    }
    assert.deepEqual(geometryAnswers(type, visual), [answer], id);
    return [visual.shape, visual.marked_sides?.length];
  }

  assert.equal(visual.type, 'shape_set', id);
  const figures = visual.figures;
  const labels = figures.map(({ label }) => label);
  assert.deepEqual(labels, type === 'sumar-lados' ? ['A', 'B'] : ['A', 'B', 'C', 'D'], id);
  figures.forEach(validateShape);
  if (type === 'emparejar-figura') validateShape(visual.reference);
  if (type === 'elegir-por-lados') assert.ok(Object.values(sides).includes(visual.target_sides), id);
  if (type === 'encontrar-par-con-iguales-lados') {
    assert.ok(options.every(option => /^[A-D] y [A-D]$/.test(option) && option[0] < option.at(-1)), id);
  } else if (type !== 'sumar-lados') {
    assert.deepEqual([...options].sort(), labels, id);
  }
  assert.doesNotMatch(hint, /(?:tarjeta [A-D]\b|\b[A-D] y [A-D]\b)/, id);
  assert.deepEqual(geometryAnswers(type, visual), [answer], id);
  return [figures.map(({ shape }) => shape).sort(), visual.reference?.shape, visual.target_sides];
}

function subtractionEvidence(level, exercise) {
  const { visual, type, id, correct_answer: answer, prompt } = exercise;
  const expectedType = { 1: 'restar-con-objetos', 2: 'resolver-resta', 3: 'restar-en-contexto' }[level];
  assert.equal(type, expectedType, id);
  let initial;
  let removed;
  if (level === 2) {
    assert.equal(visual.type, 'expression', id);
    assert.equal(visual.operator, visuals.expression.operator, id);
    assert.equal(visual.operands.length, 2, id);
    [initial, removed] = visual.operands;
    assert.equal(prompt, `¿Cuánto es ${initial} − ${removed}?`, id);
  } else {
    assert.equal(visual.type, 'object_subtraction', id);
    assert.equal(visual.display, level === 1 ? 'marked' : 'summary', id);
    assert.ok(visuals.object_subtraction.icons.includes(visual.icon), id);
    ({ initial, removed } = visual);
    assert.ok(removed > 0 && initial <= (level === 1 ? 7 : 15), id);
    const statedQuantities = [...prompt.matchAll(/\b\d+\b|\b(?:uno|nueve)\b/gi)]
      .map(([quantity]) => ({ uno: 1, nueve: 9 })[quantity.toLowerCase()] ?? Number(quantity));
    assert.deepEqual(statedQuantities, [initial, removed], id);
    assert.match(prompt, /quedan|queda|siguen|todavía/i, id);
  }
  assert.ok(Number.isInteger(initial) && initial > 0, id);
  assert.ok(Number.isInteger(removed) && removed >= 0 && removed <= initial, id);
  assert.equal(answer, initial - removed, id);
  return [initial, removed];
}

test('Los borradores tienen IDs únicos y conservan la referencia a Figuras publicada', () => {
  assert.equal(figuras.lesson_id, 'figuras');
  assert.equal(figuras.published, false);
  assert.equal(restas.published, false);
  assert.equal(restas.id, 'cuantos-quedan');
  assert.equal(restas.course_id, 'aritmetica');
  assert.equal(restas.position, 3);
  assert.equal(restas.base_level, 1);
  const drafts = [figuras, restas].flatMap(({ levels }) => Object.values(levels).flatMap(({ exercises }) => exercises));
  const ids = [...published.courses, ...publishedLessons, ...publishedExercises, restas, ...drafts].map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(Object.keys(figuras.levels), ['1', '2', '3']);
  assert.deepEqual(Object.keys(restas.levels), ['1', '2', '3']);
});

const publishedGeometry = publishedLessons.find(({ id }) => id === figuras.lesson_id).exercises;

for (const [level, bank] of Object.entries(figuras.levels)) {
  test(`Figuras N${level} reúne seis preguntas distintas o más entre las publicadas y el borrador`, () => {
    // Las preguntas publicadas cuentan lados. Los giros y tamaños no cambian esa tarea.
    // El hexágono se habilita desde N2.
    const eligiblePublished = publishedGeometry.filter(({ visual }) => level !== '1' || sides[visual.shape] <= 5);
    const publishedSignatures = new Set(eligiblePublished.map(({ visual }) =>
      JSON.stringify(['contar-lados', [visual.shape]])));
    assert.equal(publishedSignatures.size, level === '1' ? 3 : 4);

    const draftSignatures = validateLevel(bank, exercise => {
      const evidence = geometryEvidence(exercise);
      if (level === '1') {
        const { visual } = exercise;
        const shapes = visual.type === 'shape' ? [visual] : [...visual.figures, ...(visual.reference ? [visual.reference] : [])];
        assert.ok(shapes.every(({ shape }) => sides[shape] <= 5), exercise.id);
      }
      return evidence;
    }, level === '1' ? 3 : 6);

    const combined = new Set([...publishedSignatures, ...draftSignatures]);
    assert.equal(combined.size, publishedSignatures.size + draftSignatures.size);
    assert.ok(combined.size >= 6);
  });
}

for (const [level, bank] of Object.entries(restas.levels)) {
  test(`¿Cuántos quedan? N${level} tiene seis restas distintas y coherentes con su representación`, () => {
    validateLevel(bank, exercise => subtractionEvidence(Number(level), exercise));
    if (level === '2') {
      assert.ok(bank.exercises.some(exercise => exercise.correct_answer === 0));
      assert.ok(bank.exercises.some(exercise => exercise.visual.operands[1] === 0));
    }
  });
}

test('El ejemplo guiado especifica la interacción de quitar dos de siete peces', () => {
  assert.match(restas.objective, /resta.*quitar.*quedan/i);
  assert.match(restas.explanation, /signo menos.*cero/i);
  const example = restas.guided_example;
  assert.equal(example.mode, 'interactive');
  assert.deepEqual(example.visual, { type: 'object_subtraction', icon: 'fish', initial: 7, removed: 2, display: 'interactive' });
  const interaction = example.interaction;
  assert.equal(interaction.type, 'remove_objects');
  for (const field of interactions.remove_objects.required) assert.ok(Object.hasOwn(interaction, field), field);
  assert.equal(interaction.instructions.length, 3);
  assert.match(interaction.feedback_on_complete, /7 − 2 = 5/);
});

test('Las cuatro lecciones publicadas conservan el contenido de la base del bloque', () => {
  // Huellas del contenido JSON en 339d181. Los espacios y saltos de línea no intervienen.
  const baseline = {
    'conteo-basico': 'fc44ce553379d20fd8dd946210b02f707cc1d590c6b42ba80bb8f2a77e4ed6ce',
    'sumas-basicas': 'bff366e29ab219751cf5b79383d72af11699b850538adba298308560b913cc15',
    figuras: '68942a15c459734a6f42b3043c2479f4a7551117e346cfc046ba4ab0ed93ac5a',
    patrones: 'd67878603be25df55abf803368745e793214414b91319efe9ee5407c8f82e236',
  };
  assert.deepEqual(publishedLessons.map(({ id }) => id), Object.keys(baseline));
  for (const lesson of publishedLessons) {
    const hash = createHash('sha256').update(JSON.stringify(lesson)).digest('hex');
    assert.equal(hash, baseline[lesson.id], lesson.id);
  }
});
