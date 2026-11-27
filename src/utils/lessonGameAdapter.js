import { icon } from '../components/icons.js';
import { getExerciseFeedback } from './lessonContent.js';
import { buildQuestionHint } from '../state/questions.js';

const COLORS = Object.freeze({
  Morado: '#5124EE', Amarillo: '#FFC700', Verde: '#00D282',
  Coral: '#FF5A5F', Cian: '#00B4D8',
});
const OBJECTS = Object.freeze({
  star: ['estrellas', '', 'Estrella'],
  ball: ['pelotas', 'text-cyan-ocean', 'Pelota'],
  fish: ['peces', 'text-orange-energy', 'Pez'],
  balloon: ['globos', 'text-coral-alert', 'Globo'],
  heart: ['corazones', '', 'Corazón'],
});
const SHAPES = Object.freeze({
  triangle: ['triángulo', 3, '50,8 92,88 8,88'],
  square: ['cuadrado', 4, '12,12 88,12 88,88 12,88'],
  pentagon: ['pentágono', 5, '50,6 94,38 77,92 23,92 6,38'],
  hexagon: ['hexágono', 6, '50,5 91,27.5 91,72.5 50,95 9,72.5 9,27.5'],
});
const SHAPE_NAMES = Object.values(SHAPES).map(([name]) => name);
const HINT_MODULE = Object.freeze({
  objects: 'conteo',
  object_groups: 'conteo',
  expression: 'aritmetica',
  object_subtraction: 'aritmetica',
  shape: 'geometria',
  shape_set: 'geometria',
  color_sequence: 'patrones',
});
const MAX_MARKED_OBJECTS = 100;
const own = (object, key) => Object.hasOwn(object, key);
const nonnegativeInteger = value => Number.isSafeInteger(value) && value >= 0;
const isRecord = value => value && typeof value === 'object' && !Array.isArray(value);
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const normalizeName = value => typeof value === 'string' ? value.trim().toLowerCase().normalize('NFC') : '';

function invalid(message) {
  throw new TypeError('No se puede adaptar el ejercicio: ' + message);
}

function validateNumericAnswer(exercise, expected) {
  if (!nonnegativeInteger(expected) || ![...exercise.options].every(nonnegativeInteger)
      || exercise.correct_answer !== expected) {
    invalid('respuesta numérica incoherente con el visual');
  }
}

function validateShape(figure) {
  if (!isRecord(figure) || typeof figure.shape !== 'string' || !own(SHAPES, figure.shape)) invalid('figura no admitida');
  const sides = SHAPES[figure.shape][1];
  if (figure.sides !== undefined && figure.sides !== sides) invalid('cantidad de lados incoherente');
  const { rotation_degrees: rotation = 0, size = 'normal', marked_sides: marks = [] } = figure;
  if (!Number.isFinite(rotation) || rotation < 0 || rotation >= 360) invalid('rotación inválida');
  if (!['small', 'normal'].includes(size)) invalid('tamaño no admitido');
  if (!Array.isArray(marks) || ![...marks].every(index => nonnegativeInteger(index) && index < sides)
      || new Set(marks).size !== marks.length) {
    invalid('lados marcados inválidos');
  }
}

function shapeEvidence(exercise, type) {
  const { visual, options, correct_answer: answer } = exercise;
  validateShape(visual);
  const [name, sides] = SHAPES[visual.shape];
  const marked = visual.marked_sides?.length ?? 0;
  switch (type) {
    case 'contar-lados':
      validateNumericAnswer(exercise, sides);
      return [visual.shape];
    case 'contar-lados-sin-marcar':
      if (marked === 0) invalid('se necesita al menos un lado marcado');
      validateNumericAnswer(exercise, sides - marked);
      return [visual.shape, marked];
    case 'nombrar-figura': {
      const names = options.map(normalizeName);
      if (!names.every(option => SHAPE_NAMES.includes(option)) || new Set(names).size !== names.length
          || normalizeName(answer) !== name) invalid('nombre de figura incoherente');
      return [visual.shape];
    }
    default:
      invalid('tipo de pregunta sobre una figura no admitido');
  }
}

function cardCandidates(type, { figures, reference, target_sides: target }, sides) {
  switch (type) {
    case 'elegir-por-lados':
      if (!Number.isInteger(target)) invalid('falta la cantidad de lados solicitada');
      return figures.filter((_, index) => sides[index] === target);
    case 'emparejar-figura':
      validateShape(reference);
      return figures.filter(figure => figure.shape === reference.shape);
    case 'elegir-menos-lados':
      return figures.filter((_, index) => sides[index] === Math.min(...sides));
    case 'elegir-mas-lados':
      return figures.filter((_, index) => sides[index] === Math.max(...sides));
    case 'detectar-figura-distinta':
      return figures.filter((_, index) => {
        const others = sides.filter((_, other) => other !== index);
        return others.length >= 2 && sides[index] !== others[0] && others.every(value => value === others[0]);
      });
    default:
      invalid('tipo de pregunta sobre tarjetas no admitido');
  }
}

function validatePairAnswer(exercise, labels, sides) {
  const normalizePair = option => {
    if (typeof option !== 'string' || !/^[A-Z] y [A-Z]$/.test(option)) return null;
    const pair = option.split(' y ').sort();
    if (pair[0] === pair[1] || !pair.every(label => labels.includes(label))) return null;
    return pair.join(' y ');
  };
  const options = exercise.options.map(normalizePair);
  const matchingPairs = labels.flatMap((label, index) => labels.slice(index + 1)
    .filter((_, offset) => sides[index] === sides[index + 1 + offset])
    .map(other => normalizePair(label + ' y ' + other)));
  if (options.includes(null) || new Set(options).size !== options.length || matchingPairs.length !== 1
      || normalizePair(exercise.correct_answer) !== matchingPairs[0]) {
    invalid('las parejas de tarjetas o su respuesta son incoherentes');
  }
}

function shapeSetEvidence(exercise, type) {
  const { visual, options, correct_answer: answer } = exercise;
  const { figures, reference, target_sides: target } = visual;
  if (!Array.isArray(figures) || figures.length < 2 || figures.length > 4) invalid('se necesitan de dos a cuatro tarjetas');
  for (const figure of figures) validateShape(figure);
  const labels = figures.map(figure => figure.label);
  if (!labels.every(label => typeof label === 'string' && /^[A-Z]$/.test(label))
      || new Set(labels).size !== labels.length) invalid('etiquetas de tarjetas inválidas');
  if (reference !== undefined && type !== 'emparejar-figura') invalid('modelo ajeno a la consigna');
  if (target !== undefined && type !== 'elegir-por-lados') invalid('cantidad solicitada ajena a la consigna');

  const sides = figures.map(figure => SHAPES[figure.shape][1]);
  if (type === 'sumar-lados') {
    validateNumericAnswer(exercise, sides.reduce((total, value) => total + value, 0));
  } else if (type === 'encontrar-par-con-iguales-lados') {
    validatePairAnswer(exercise, labels, sides);
  } else {
    const candidates = cardCandidates(type, visual, sides);
    if (!options.every(option => labels.includes(option)) || candidates.length !== 1
        || answer !== candidates[0].label) invalid('las tarjetas no determinan una respuesta única y válida');
  }
  return [figures.map(figure => figure.shape).sort(), reference?.shape ?? null, target ?? null];
}

function countGroupEvidence(exercise, type) {
  const { visual: { icon: item, groups, target_count: target, model_count: model }, options, correct_answer: answer } = exercise;
  const validCount = count => Number.isInteger(count) && count >= 1 && count <= 6;
  if (!own(OBJECTS, item) || !Array.isArray(groups) || groups.length !== 4
    || !groups.every(group => isRecord(group) && /^[A-Z]$/.test(group.label) && validCount(group.count))) {
    invalid('se necesitan cuatro grupos válidos de hasta seis objetos');
  }
  const labels = groups.map(group => group.label);
  if (new Set(labels).size !== 4 || !options.every(option => labels.includes(option))) invalid('rótulos de los grupos inválidos');
  const counts = groups.map(group => group.count);

  if ((type === 'elegir-grupo-por-cantidad' ? !validCount(target) : target !== undefined)
    || (type === 'emparejar-grupo-por-cantidad' ? !validCount(model) : model !== undefined)) {
    invalid('la cantidad solicitada o la del modelo no corresponde a la consigna');
  }

  let expected;
  switch (type) {
    case 'elegir-grupo-por-cantidad': expected = target; break;
    case 'emparejar-grupo-por-cantidad': expected = model; break;
    case 'elegir-grupo-con-mas-objetos': expected = Math.max(...counts); break;
    case 'elegir-grupo-con-menos-objetos': expected = Math.min(...counts); break;
    default: invalid('comparación de grupos no admitida');
  }
  const matches = groups.filter(group => group.count === expected);
  if (matches.length !== 1 || matches[0].label !== answer) invalid('los grupos no determinan una respuesta única y válida');
  return [counts.sort((a, b) => a - b), target ?? model ?? null];
}

function defaultExerciseType(visual) {
  switch (visual.type) {
    case 'objects': return 'contar-objetos';
    case 'expression': return visual.operator === '+' ? 'resolver-suma' : 'resolver-resta';
    case 'object_subtraction': return visual.display === 'marked' ? 'restar-con-objetos' : 'restar-en-contexto';
    case 'shape': return 'contar-lados';
    case 'color_sequence': return 'continuar-patron';
    default: return null;
  }
}

function mathematicalEvidence(exercise, type) {
  const { visual } = exercise;
  switch (visual.type) {
    case 'objects': {
      if (typeof visual.icon !== 'string' || !own(OBJECTS, visual.icon)
          || !Number.isInteger(visual.count) || visual.count < 1 || visual.count > 10) {
        invalid('icono o cantidad de objetos no admitidos (1 a 10)');
      }
      if (type !== 'contar-objetos') invalid('tipo de conteo no admitido');
      validateNumericAnswer(exercise, visual.count);
      return [visual.count];
    }
    case 'object_groups': return countGroupEvidence(exercise, type);
    case 'expression': {
      const { operator, operands } = visual;
      if (!['+', '-'].includes(operator) || type !== defaultExerciseType(visual)
          || !Array.isArray(operands) || operands.length !== 2 || ![...operands].every(nonnegativeInteger)) {
        invalid('operación o operandos incoherentes');
      }
      const [first, second] = operands;
      validateNumericAnswer(exercise, operator === '+' ? first + second : first - second);
      return [first, second];
    }
    case 'object_subtraction': {
      const { icon: item, initial, removed, display } = visual;
      if (typeof item !== 'string' || !own(OBJECTS, item) || !nonnegativeInteger(initial) || !nonnegativeInteger(removed) || removed > initial
          || !['marked', 'summary'].includes(display) || !['restar-con-objetos', 'restar-en-contexto'].includes(type)) {
        invalid('objetos, cantidades o presentación de la resta incoherentes');
      }
      if (display === 'marked' && initial > MAX_MARKED_OBJECTS) invalid('demasiados objetos para mostrar sus marcas');
      validateNumericAnswer(exercise, initial - removed);
      return [initial, removed];
    }
    case 'shape': return shapeEvidence(exercise, type);
    case 'shape_set': return shapeSetEvidence(exercise, type);
    case 'color_sequence': {
      const { sequence, missing_index: missing } = visual;
      if (type !== 'continuar-patron' || !Array.isArray(sequence) || sequence.length !== 4
          || ![...sequence].every(color => typeof color === 'string' && own(COLORS, color)) || missing !== sequence.length) {
        invalid('se necesita una secuencia de cuatro colores y un hueco final');
      }
      const [first, second, third, fourth] = sequence;
      if (first === second || first !== third || second !== fourth || exercise.correct_answer !== first
          || !exercise.options.every(color => own(COLORS, color))) invalid('patrón ABAB o respuesta incoherente');
      return [first, second];
    }
    default:
      if (typeof visual.type !== 'string' || !own(DRAFT_VISUALS, visual.type)) invalid('tipo visual no admitido');
      return DRAFT_VISUALS[visual.type].evidence(exercise, type);
  }
}

/** Valida un ejercicio editorial y devuelve su identidad matemática para deduplicar rondas. */
export function exerciseSemanticKey(exercise) {
  if (!getExerciseFeedback(exercise, exercise?.answer_index).valid || exercise.options.includes(undefined)) {
    invalid('faltan campos o la respuesta no es válida');
  }
  if (!isRecord(exercise.visual)) invalid('se necesita un visual estructurado');
  const type = exercise.type ?? defaultExerciseType(exercise.visual);
  return JSON.stringify([type, mathematicalEvidence(exercise, type)]);
}

function objectIcon(item) {
  const [, color] = OBJECTS[item];
  return icon(item, ['w-11 h-11 sm:w-14 sm:h-14', color].filter(Boolean).join(' '));
}

function renderObjectSubtraction({ icon: item, initial, removed, display }) {
  const [name] = OBJECTS[item];
  const description = `${initial} ${name} al inicio. Cantidad retirada ${removed}.`;
  const content = display === 'summary'
    ? `${objectIcon(item)}<span>Al inicio ${initial}</span><span>Se retiran ${removed}</span>`
    : Array.from({ length: initial }, (_, index) => {
      const picture = objectIcon(item);
      if (index >= removed) return picture;
      return `<span class="relative inline-flex" aria-hidden="true">${picture}<span class="absolute inset-0 grid place-items-center text-4xl font-bold text-text-dark">×</span></span>`;
    }).join('');
  return `<div class="flex flex-wrap items-center justify-center gap-3 p-4 bg-white rounded-card border-2 border-border-gray" role="img" aria-label="${description}">${content}</div>`;
}

function renderShape(shape, label = 'Figura', compact = false) {
  const [, sides, points] = SHAPES[shape.shape];
  const rotation = shape.rotation_degrees ?? 0;
  const scale = shape.size === 'small' ? 0.65 : 1;
  const marks = new Set(shape.marked_sides);
  const vertices = points.split(' ');
  // Exponer los tramos para que se puedan contar sin anunciar el nombre ni la respuesta.
  const edges = Array.from({ length: sides }, (_, index) =>
    marks.has(index) ? 'Lado marcado' : marks.size ? 'Lado sin marcar' : 'Lado recto');
  const description = [label, ...edges].join('. ') + '.';
  const lines = [...marks].map(index => {
    const next = vertices[(index + 1) % sides];
    return `<polyline points="${vertices[index]} ${next}" fill="none" stroke="#FFCC42" stroke-width="7" stroke-linecap="round"/>`;
  }).join('');
  const sizeClass = compact ? 'w-20 h-20 sm:w-28 sm:h-28' : 'w-40 h-40 sm:w-48 sm:h-48';
  return `<svg viewBox="0 0 100 100" class="${sizeClass}" role="img" aria-label="${escapeHTML(description)}"><g transform="translate(50 50) rotate(${rotation}) scale(${scale}) translate(-50 -50)"><polygon points="${points}" fill="#5124EE" stroke="#2B0F8A" stroke-width="4" stroke-linejoin="round"/>${lines}<circle cx="40" cy="50" r="5" fill="#FFFFFF"/><circle cx="60" cy="50" r="5" fill="#FFFFFF"/><path d="M40 66 Q50 76 60 66" stroke="#FFFFFF" stroke-width="4" fill="none" stroke-linecap="round"/></g></svg>`;
}

function renderShapeSet({ figures, reference }) {
  const model = reference
    ? `<div class="flex flex-col items-center"><span aria-hidden="true">Modelo</span>${renderShape(reference, 'Figura modelo', true)}</div>`
    : '';
  const cards = figures.map(figure =>
    `<div class="flex flex-col items-center rounded-card border-2 border-gray-100 p-2"><span aria-hidden="true">${figure.label}</span>${renderShape(figure, 'Tarjeta ' + figure.label, true)}</div>`).join('');
  return `<div class="flex flex-col items-center gap-4 p-4 bg-white rounded-card border-2 border-border-gray" role="group" aria-label="Tarjetas de figuras">${model}<div class="flex flex-wrap justify-center gap-2">${cards}</div></div>`;
}

function renderObjectGroups({ icon: item, groups, model_count: model }) {
  const [, color, name] = OBJECTS[item];
  const picture = icon(item, `h-7 w-7 sm:h-8 sm:w-8 ${color}`);
  const card = (title, count) => {
    const description = [title, ...Array(count).fill(name)].join('. ') + '.';
    return `<div role="img" aria-label="${description}" class="rounded-card border-2 border-border-gray bg-white p-2">
      <span aria-hidden="true" class="block text-center font-fredoka text-base font-bold">${title}</span>
      <div aria-hidden="true" class="flex min-h-10 flex-wrap items-center justify-center gap-2">${picture.repeat(count)}</div>
    </div>`;
  };
  return `<div class="w-full max-w-md space-y-3">${model === undefined ? '' : card('Modelo', model)}
    <div class="grid grid-cols-2 gap-2">${groups.map(group => card(`Grupo ${group.label}`, group.count)).join('')}</div>
  </div>`;
}

function renderVisual(visual) {
  switch (visual.type) {
    case 'objects': {
      const [, , singular] = OBJECTS[visual.icon];
      const description = Array(visual.count).fill(singular).join('. ') + '.';
      const pictures = Array.from({ length: visual.count }, () => objectIcon(visual.icon)).join('');
      return `<div class="flex flex-wrap gap-3 justify-center items-center max-w-md mx-auto p-4 bg-white rounded-card border-2 border-border-gray" role="img" aria-label="${description}">${pictures}</div>`;
    }
    case 'object_groups':
      return renderObjectGroups(visual);
    case 'object_subtraction':
      return renderObjectSubtraction(visual);
    case 'expression': {
      const [a, b] = visual.operands;
      const sign = visual.operator === '-' ? '−' : '+';
      return `<div class="flex items-center justify-center gap-4 p-6 bg-white rounded-card border-2 border-border-gray"><span class="font-fredoka font-bold text-display-lg tabular-nums text-numu-purple">${a}</span><span class="font-fredoka font-bold text-display-lg text-orange-energy">${sign}</span><span class="font-fredoka font-bold text-display-lg tabular-nums text-numu-purple">${b}</span><span class="font-fredoka font-bold text-display-lg text-text-dark/40">=</span><span class="font-fredoka font-bold text-display-lg text-text-dark/30">?</span></div>`;
    }
    case 'shape':
      return `<div class="flex items-center justify-center p-4 bg-white rounded-card border-2 border-border-gray">${renderShape(visual)}</div>`;
    case 'shape_set':
      return renderShapeSet(visual);
    case 'color_sequence': {
      const sequence = visual.sequence.map(color => `<span class="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-4 border-white shadow-md" style="background:${COLORS[color]}"></span>`).join('');
      return `<div class="flex flex-wrap items-center justify-center gap-3 p-5 bg-white rounded-card border-2 border-border-gray" role="img" aria-label="${escapeHTML(visual.sequence.join(', '))}, ¿qué color sigue?">${sequence}<span class="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-4 border-dashed border-text-dark/40 grid place-items-center font-fredoka font-bold text-h2 text-text-dark/50">?</span></div>`;
    }
    default:
      return DRAFT_VISUALS[visual.type].render(visual);
  }
}

/** Convierte un ejercicio editorial al contrato de Game.jsx sin modificar el original.
 * Conserva id, correct_answer, hint y feedback_*. answer_index pasa a answerIndex
 * y las opciones pasan a etiquetas en el mismo orden.
 */
export function adaptExerciseToGame(exercise) {
  const semanticKey = exerciseSemanticKey(exercise);
  const { answer_index, visual, options, feedback_correct, feedback_incorrect, ...metadata } = structuredClone(exercise);
  return {
    ...metadata,
    semanticKey,
    hint: buildQuestionHint(exercise, HINT_MODULE[visual.type] ?? DRAFT_VISUALS[visual.type]?.module),
    feedback_correct,
    feedback_incorrect,
    prompt: exercise.prompt,
    speakText: visual.type === 'color_sequence'
      ? `${exercise.prompt} ${visual.sequence.join(', ')}. ¿Qué color sigue?`
      : exercise.prompt,
    visual: renderVisual(visual),
    options: options.map(value => visual.type === 'color_sequence'
      ? { label: value, color: COLORS[value] }
      : { label: String(value) }),
    answerIndex: answer_index,
  };
}

const sizeIsSafe = value => nonnegativeInteger(value) && value > 0 && value <= 32;
const allNumeric = values => Array.isArray(values) && [...values].every(nonnegativeInteger);
const totalOf = values => values.reduce((sum, value) => sum + value, 0);
const cellKey = cell => cell.join(',');
const sortedCellKeys = cells => cells.map(cellKey).sort();
const sameCells = (a, b) => JSON.stringify(sortedCellKeys(a)) === JSON.stringify(sortedCellKeys(b));

function validGrid({ rows, columns }) {
  if (!sizeIsSafe(rows) || !sizeIsSafe(columns)) invalid('dimensiones de cuadrícula inválidas');
}

function validCells(cells, { rows, columns }) {
  if (!Array.isArray(cells) || ![...cells].every(cell => Array.isArray(cell) && cell.length === 2
      && cell.every(value => Number.isInteger(value) && value > 0) && cell[0] <= rows && cell[1] <= columns)
      || new Set(cells.map(cellKey)).size !== cells.length) invalid('casillas inválidas o repetidas');
}

function validateChoiceAnswer(exercise, correctOptions) {
  if (correctOptions.length !== 1 || correctOptions[0] !== exercise.correct_answer) {
    invalid('la consigna no determina una respuesta única y coherente');
  }
}

function reflectionEvidence(exercise, type) {
  const { visual, options } = exercise;
  const { axis, choices } = visual;
  validGrid(visual);
  const directions = { horizontal: 0, vertical: 1 };
  if (!isRecord(axis) || !own(directions, axis.direction)) invalid('eje de simetría inválido');
  const across = directions[axis.direction];
  const along = 1 - across;
  const size = across ? visual.columns : visual.rows;
  const after = axis.after;
  if (!Number.isInteger(after) || after * 2 !== size) invalid('el eje debe separar dos mitades');
  const reflect = cell => cell.map((coordinate, index) => index === across ? size + 1 - coordinate : coordinate);

  if (!Array.isArray(choices) || choices.length !== 4) invalid('se necesitan cuatro tarjetas de reflejo');
  for (const card of choices) {
    if (!isRecord(card) || !/^[A-Z]$/.test(card.label) || typeof card.label !== 'string') invalid('tarjeta de reflejo inválida');
    validCells(card.cells, visual);
  }
  const labels = choices.map(card => card.label);
  if (new Set(labels).size !== 4 || !options.every(option => labels.includes(option))
      || new Set(choices.map(card => JSON.stringify(sortedCellKeys(card.cells)))).size !== 4) {
    invalid('tarjetas y opciones de reflejo incoherentes');
  }

  if (type === 'identificar-ficha-sin-reflejo') {
    const filled = visual.filled_cells;
    validCells(filled, visual);
    if (filled.length < 3) invalid('faltan fichas de referencia');
    const keys = new Set(filled.map(cellKey));
    if (choices.some(card => card.cells.length !== 1 || !keys.has(cellKey(card.cells[0])))) {
      invalid('solo se puede retirar una ficha visible');
    }
    const unmatched = filled.filter(cell => !keys.has(cellKey(reflect(cell))));
    if (unmatched.length !== 1) invalid('debe haber una sola ficha sin pareja');
    validateChoiceAnswer(exercise, choices.filter(card => sameCells(card.cells, unmatched)).map(card => card.label));
    return [axis.direction, relativeCells(filled, across, after, Math.min(...filled.map(cell => cell[along])))];
  }

  if (!['elegir-reflejo', 'completar-reflejo'].includes(type)) invalid('tipo de ejercicio de simetría inválido');
  if (visual.filled_cells !== undefined) invalid('el ejercicio requiere fichas de origen y no un tablero terminado');
  const { source_cells: source, placed_cells: placed = [] } = visual;
  validCells(source, visual);
  validCells(placed, visual);
  if (!source.length || source.some(cell => cell[across] > after)
      || (type === 'elegir-reflejo' ? placed.length !== 0 : placed.length === 0)) invalid('fichas de origen o de avance inválidas');
  const mirrored = source.map(reflect);
  const mirroredKeys = new Set(mirrored.map(cellKey));
  if (placed.some(cell => !mirroredKeys.has(cellKey(cell)))) invalid('hay fichas colocadas fuera de su reflejo');
  const placedKeys = new Set(placed.map(cellKey));
  const missing = mirrored.filter(cell => !placedKeys.has(cellKey(cell)));
  if (!missing.length || choices.some(card => card.cells.length !== missing.length
      || card.cells.some(cell => cell[across] <= after || placedKeys.has(cellKey(cell))))) {
    invalid('las opciones deben completar las casillas de la mitad opuesta');
  }
  validateChoiceAnswer(exercise, choices.filter(card => sameCells(card.cells, missing)).map(card => card.label));
  const offset = Math.min(...source.map(cell => cell[along]));
  return [axis.direction, relativeCells(source, across, after, offset), relativeCells(placed, across, after, offset)];
}

function relativeCells(cells, axis, after, offset) {
  return sortedCellKeys(cells.map(cell => [cell[1 - axis] - offset, cell[axis] - after]));
}

function shapeEdges(cells) {
  const filled = new Set(cells.map(cellKey));
  return cells.flatMap(([r, c]) => [
    [[r - 1, c], [r - 1, c - 1, r - 1, c]],
    [[r + 1, c], [r, c - 1, r, c]],
    [[r, c - 1], [r - 1, c - 1, r, c - 1]],
    [[r, c + 1], [r - 1, c, r, c]],
  ].filter(([neighbor]) => !filled.has(cellKey(neighbor))).map(([, edge]) => edge));
}

function connectedGrid(cells) {
  const keys = new Set(cells.map(cellKey));
  const pending = [cells[0]];
  const visited = new Set();
  while (pending.length) {
    const [r, c] = pending.pop();
    const key = cellKey([r, c]);
    if (!keys.has(key) || visited.has(key)) continue;
    visited.add(key);
    pending.push([r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]);
  }
  return visited.size === keys.size;
}

function gridShapeKey(cells) {
  const orientations = [];
  for (const swap of [false, true]) {
    for (const rSign of [-1, 1]) {
      for (const cSign of [-1, 1]) {
        const oriented = cells.map(([r, c]) => swap ? [c * rSign, r * cSign] : [r * rSign, c * cSign]);
        const top = Math.min(...oriented.map(([r]) => r));
        const left = Math.min(...oriented.map(([, c]) => c));
        orientations.push(sortedCellKeys(oriented.map(([r, c]) => [r - top, c - left])).join(';'));
      }
    }
  }
  return orientations.sort()[0];
}

const MEASUREMENT_TASKS = {
  'contar-tramos-del-borde': ['perimeter', 1],
  'sumar-lados-de-rectangulo': ['perimeter', 1],
  'comparar-perimetros': ['perimeter', 2],
  'contar-baldosas': ['area', 1],
  'calcular-area-de-rectangulo': ['area', 1],
  'hallar-area-comun': ['area', 2],
  'elegir-par-de-igual-area': ['area', 4],
};

function gridPairAnswer(exercise, figures) {
  const normalize = option => {
    if (typeof option !== 'string' || !/^[A-Z] y [A-Z]$/.test(option)) return '';
    const pair = option.split(' y ').sort();
    return pair[0] !== pair[1] && pair.every(label => figures.some(figure => figure.label === label)) ? pair.join(' y ') : '';
  };
  const options = exercise.options.map(normalize);
  if (options.includes('') || new Set(options).size !== 4) invalid('opciones de pareja inválidas');
  const pairs = figures.flatMap((first, i) => figures.slice(i + 1)
    .filter(second => first.area === second.area).map(second => [first, second]));
  if (pairs.length !== 1) invalid('debe haber una sola pareja de igual área');
  const [[first, second]] = pairs;
  if (first.perimeter === second.perimeter || normalize(exercise.correct_answer) !== normalize(first.label + ' y ' + second.label)) {
    invalid('la pareja de igual área es incoherente');
  }
}

function measurementEvidence(exercise, type) {
  const { visual } = exercise;
  const { figures, mode, show_dimensions: show = false } = visual;
  if (!own(MEASUREMENT_TASKS, type)) invalid('medición no admitida');
  const [expectedMode, count] = MEASUREMENT_TASKS[type];
  if (mode !== expectedMode || !Array.isArray(figures) || figures.length !== count || typeof show !== 'boolean') {
    invalid('modo, figuras o medidas inválidos');
  }
  const labels = new Set();
  const measurements = Array.from(figures, figure => {
    if (!isRecord(figure) || typeof figure.label !== 'string' || !/^[A-Z]$/.test(figure.label)
        || labels.has(figure.label)) invalid('figura de medición inválida');
    labels.add(figure.label);
    validGrid(figure);
    validCells(figure.cells, figure);
    if (!figure.cells.length || !connectedGrid(figure.cells)) invalid('las casillas deben formar una figura conectada');
    const rectangle = figure.cells.length === figure.rows * figure.columns;
    if ((show && (mode !== 'perimeter' || !rectangle)) ||
        (['sumar-lados-de-rectangulo', 'calcular-area-de-rectangulo'].includes(type) && !rectangle)) {
      invalid('la consigna requiere un rectángulo completo y un modo coherente');
    }
    return { label: figure.label, area: figure.cells.length, perimeter: shapeEdges(figure.cells).length };
  });
  const [first, second] = measurements;
  if (type === 'elegir-par-de-igual-area') {
    gridPairAnswer(exercise, measurements);
  } else {
    let answer = first[mode];
    if (type === 'comparar-perimetros') answer = Math.abs(first.perimeter - second.perimeter);
    if (type === 'hallar-area-comun' && (first.area !== second.area || first.perimeter === second.perimeter)) {
      invalid('se requieren áreas iguales con perímetros distintos');
    }
    validateNumericAnswer(exercise, answer);
  }
  return figures.map(({ cells }) => gridShapeKey(cells)).sort();
}

const signedRule = text => {
  if (typeof text !== 'string') return null;
  const match = text.match(/^(Sumar|Restar|Multiplicar por) ([1-9]\d*)$/);
  if (!match || !nonnegativeInteger(Number(match[2]))) return null;
  return [{ Sumar: '+', Restar: '-', 'Multiplicar por': '×' }[match[1]], Number(match[2])];
};

function staircaseEvidence(exercise, type) {
  const { steps, query_position: position } = exercise.visual;
  if (!Array.isArray(steps) || !sizeIsSafe(steps.length)
      || ![...steps].every(step => step === null || nonnegativeInteger(step))) invalid('escalones inválidos');
  const known = steps.flatMap((step, index) => step === null ? [] : [[index, step]]);
  if (known.length < 3) invalid('faltan escalones para deducir la regla');
  const [[firstIndex, first], [nextIndex, next]] = known;
  const delta = (next - first) / (nextIndex - firstIndex);
  const start = first - firstIndex * delta;
  if (!Number.isSafeInteger(delta) || delta === 0 || !nonnegativeInteger(start)
      || known.some(([index, step]) => step !== start + index * delta)) invalid('los cambios de la escalera no son constantes');
  if (type === 'identificar-regla-de-escalera') {
    if (position !== undefined || known.length !== steps.length) invalid('la regla requiere una escalera visible');
    validateChoiceAnswer(exercise, exercise.options.filter(option => {
      const rule = signedRule(option);
      if (!rule || rule[0] === '×') invalid('opción de regla de escalera inválida');
      const [op, value] = rule;
      return (op === '+' ? value : -value) === delta;
    }));
  } else {
    if (!['completar-escalera', 'predecir-escalon'].includes(type) || !sizeIsSafe(position)) invalid('posición de escalera inválida');
    if (type === 'completar-escalera' ? delta <= 0 || known.length !== steps.length - 1 || steps[position - 1] !== null
      : position <= steps.length || known.length !== steps.length) invalid('los escalones no corresponden a la consigna');
    validateNumericAnswer(exercise, start + (position - 1) * delta);
  }
  return [start, delta, position ?? null];
}

function parseSum(text) {
  if (typeof text !== 'string' || !/^\d+(?: \+ \d+)+$/.test(text)) invalid('opción de suma inválida');
  const values = text.split(' + ').map(Number);
  if (!allNumeric(values) || !nonnegativeInteger(totalOf(values))) invalid('sumandos fuera del rango');
  return values;
}

function balanceEvidence(exercise, type) {
  const { left, right, display } = exercise.visual;
  const terms = side => Array.isArray(side) && sizeIsSafe(side.length)
    && [...side].every(term => term === null || (nonnegativeInteger(term) && (display !== 'objects' || term <= 32)))
    && nonnegativeInteger(totalOf(side.filter(nonnegativeInteger)));
  if (!terms(left) || !['objects', 'symbols'].includes(display)) invalid('plato o representación de balanza inválidos');
  const canonicalSide = side => [side.filter(term => term !== null).sort((a, b) => a - b), side.includes(null)];
  if (type === 'reconocer-equivalencia') {
    if (right !== null || !allNumeric(left)) invalid('la equivalencia necesita un plato completo y otro vacío');
    validateChoiceAnswer(exercise, exercise.options.filter(option => totalOf(parseSum(option)) === totalOf(left)));
    return canonicalSide(left)[0];
  }
  if (!['completar-balanza', 'resolver-igualdad'].includes(type) || !terms(right)
      || [...left, ...right].filter(term => term === null).length !== 1) invalid('la igualdad requiere una sola casilla vacía');
  const expected = left.includes(null) ? totalOf(right) - totalOf(left.filter(nonnegativeInteger))
    : totalOf(left) - totalOf(right.filter(nonnegativeInteger));
  validateNumericAnswer(exercise, expected);
  return [canonicalSide(left), canonicalSide(right)].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

function hiddenNumberEvidence(exercise, type) {
  const { operands, operator, result, display } = exercise.visual;
  if (!['completar-suma-con-caja', 'resolver-operacion-con-caja', 'resolver-problema-con-incognita'].includes(type)
      || !['+', '-'].includes(operator) || (type === 'completar-suma-con-caja' && operator !== '+')
      || display !== (type === 'resolver-problema-con-incognita' ? 'story' : 'box')
      || !Array.isArray(operands) || operands.length !== 2
      || ![...operands].every(value => value === null || nonnegativeInteger(value))
      || operands.filter(value => value === null).length !== 1 || !nonnegativeInteger(result)) {
    invalid('la operación requiere una sola incógnita y un resultado válido');
  }
  const [a, b] = operands;
  const expected = operator === '+' ? result - (a ?? b) : a === null ? result + b : a - result;
  validateNumericAnswer(exercise, expected);
  return [operator, operands, result];
}

function applyRule(input, [operator, value]) {
  if (operator === '+') return input + value;
  if (operator === '-') return input - value;
  return input * value;
}

function machineEvidence(exercise, type) {
  const { examples, input, operations } = exercise.visual;
  if (type === 'descubrir-regla-simple') {
    if (operations !== undefined || input !== undefined || !Array.isArray(examples) || examples.length < 3
        || ![...examples].every(pair => isRecord(pair) && nonnegativeInteger(pair.input) && nonnegativeInteger(pair.output))
        || new Set(examples.map(pair => pair.input)).size !== examples.length) invalid('pares de entrada y salida inválidos');
    validateChoiceAnswer(exercise, exercise.options.filter(option => {
      const rule = signedRule(option);
      if (!rule) invalid('opción de máquina inválida');
      return examples.every(pair => applyRule(pair.input, rule) === pair.output);
    }));
    return examples.map(pair => [pair.input, pair.output]).sort(([a], [b]) => a - b);
  }
  const count = type === 'aplicar-regla-simple' ? 1 : type === 'aplicar-reglas-consecutivas' ? 2 : 0;
  if (!count || examples !== undefined || !nonnegativeInteger(input) || !Array.isArray(operations) || operations.length !== count
      || ![...operations].every(op => isRecord(op) && ['+', '-', '×'].includes(op.operator) && nonnegativeInteger(op.value) && op.value > 0)) {
    invalid('entrada u operaciones inválidas');
  }
  const rules = operations.map(op => [op.operator, op.value]);
  const output = rules.reduce((value, rule) => {
    const next = applyRule(value, rule);
    if (!nonnegativeInteger(next)) invalid('resultado intermedio fuera del rango');
    return next;
  }, input);
  validateNumericAnswer(exercise, output);
  return [input, rules];
}

function growthEvidence(exercise, type) {
  const { stages, query_position: position, repeated_icon: repeated, fixed_icon: fixedIcon } = exercise.visual;
  if (!validDraftIcon(repeated) || !validDraftIcon(fixedIcon) || !Array.isArray(stages) || stages.length < 3
      || ![...stages].every(stage => isRecord(stage) && sizeIsSafe(stage.position) && allNumeric(stage.groups)
        && stage.groups.length === stage.position && nonnegativeInteger(stage.fixed) && stage.fixed <= 32)
      || stages.some((stage, index) => index > 0 && stage.position <= stages[index - 1].position)) {
    invalid('etapas o cantidades del patrón inválidas');
  }
  const gain = stages[0].groups[0];
  const fixed = stages[0].fixed;
  if (!sizeIsSafe(gain) || stages.some(stage => stage.fixed !== fixed || stage.groups.some(group => group !== gain))) {
    invalid('el tamaño de los grupos y la parte fija deben mantenerse');
  }
  if (type === 'deducir-regla-del-dibujo') {
    if (position !== undefined) invalid('deducir una regla usa todas las etapas');
    validateChoiceAnswer(exercise, exercise.options.filter(option => {
      const match = typeof option === 'string' && option.match(/^([1-9]\d*) por paso y (\d+) ficha(?:s)? fija(?:s)?$/);
      if (!match) invalid('opción de regla de crecimiento inválida');
      return Number(match[1]) === gain && Number(match[2]) === fixed;
    }));
  } else {
    const present = stages.some(stage => stage.position === position);
    if (!['contar-piezas-de-un-paso', 'relacionar-paso-con-cantidad'].includes(type) || !sizeIsSafe(position)
        || present !== (type === 'contar-piezas-de-un-paso')) invalid('paso consultado inválido');
    validateNumericAnswer(exercise, position * gain + fixed);
  }
  return [gain, fixed, position ?? null];
}

const DRAFT_CONTAINERS = { fish_tank: 'Pecera', basket: 'Canasta', child: 'Participante', tray: 'Bandeja', box: 'Caja' };
const DRAFT_ICONS = { coral: 'Coral', shell: 'Concha' };
const validDraftIcon = item => typeof item === 'string' && (own(OBJECTS, item) || own(DRAFT_ICONS, item));
const validContainer = item => typeof item === 'string' && own(DRAFT_CONTAINERS, item);

function groupingEvidence(exercise, type) {
  const { visual } = exercise;
  const { group_count: count, items_per_group: size } = visual;
  if (!sizeIsSafe(count) || !sizeIsSafe(size) || !validDraftIcon(visual.icon) || !validContainer(visual.container)) {
    invalid('cantidad, icono o recipiente de grupos inválido');
  }
  if (type === 'contar-grupos') validateNumericAnswer(exercise, count);
  else if (type === 'identificar-suma-repetida') {
    validateChoiceAnswer(exercise, exercise.options.filter(option => {
      const terms = parseSum(option);
      return terms.length === count && terms.every(term => term === size);
    }));
  } else invalid('tipo de agrupación inválido');
  return [count, size];
}

function arrayEvidence(exercise, type) {
  const { visual } = exercise;
  const { rows, columns } = visual;
  validGrid(visual);
  if (!validDraftIcon(visual.icon)) invalid('icono de arreglo inválido');
  if (type === 'calcular-total-del-arreglo') validateNumericAnswer(exercise, rows * columns);
  else if (type === 'representar-multiplicacion') {
    validateChoiceAnswer(exercise, exercise.options.filter(option => {
      const match = typeof option === 'string' && option.match(/^(\d+) × (\d+)$/);
      if (!match) invalid('opción de multiplicación inválida');
      return Number(match[1]) === rows && Number(match[2]) === columns;
    }));
  } else invalid('tipo de arreglo inválido');
  return [rows, columns];
}

function sharingEvidence(exercise, type) {
  const { visual } = exercise;
  const { total, recipients, display } = visual;
  if (!nonnegativeInteger(total) || !sizeIsSafe(recipients) || recipients < 2 || total < recipients
      || !validDraftIcon(visual.icon) || !validContainer(visual.container)) invalid('datos de reparto inválidos');
  if (type === 'elegir-reparto-exacto') {
    if (display !== 'objects' || total > 100 || total % recipients !== 0) invalid('se requiere un reparto exacto dibujable');
    validateChoiceAnswer(exercise, exercise.options.filter(option => {
      if (typeof option !== 'string' || !/^\d+(?:, \d+)* y \d+$/.test(option)) invalid('opción de reparto inválida');
      const amounts = option.match(/\d+/g).map(Number);
      if (amounts.length !== recipients || !allNumeric(amounts)) invalid('faltan cantidades para los participantes');
      return amounts.every(amount => amount === amounts[0]) && totalOf(amounts) === total;
    }));
  } else {
    if (!['calcular-cuanto-recibe-cada-uno', 'identificar-sobrantes'].includes(type) || display !== 'summary') {
      invalid('tipo o presentación de reparto inválidos');
    }
    if (type === 'calcular-cuanto-recibe-cada-uno' && total % recipients !== 0) invalid('la consigna requiere reparto exacto');
    validateNumericAnswer(exercise, type === 'identificar-sobrantes' ? total % recipients : total / recipients);
  }
  return [total, recipients];
}

function visualFrame(description, body) {
  return `<div class="w-full max-w-2xl rounded-card border-2 border-border-gray bg-white p-4 text-center font-fredoka text-lg" role="img" aria-label="${escapeHTML(description)}">${body}</div>`;
}

function gridSvg({ rows, columns }, cells, description, { edges = [], axis, markers = [] } = {}) {
  const line = (x1, y1, x2, y2, color, width) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}"/>`;
  const base = [
    ...Array.from({ length: rows + 1 }, (_, r) => line(0, r, columns, r, '#CBD5E1', '.025')),
    ...Array.from({ length: columns + 1 }, (_, c) => line(c, 0, c, rows, '#CBD5E1', '.025')),
  ].join('');
  const tiles = cells.map(([r, c]) =>
    `<rect x="${c - 1}" y="${r - 1}" width="1" height="1" fill="#DDD6FE" stroke="#7050A3" stroke-width=".05"/>`).join('');
  const border = edges.map(([r1, c1, r2, c2]) => line(c1, r1, c2, r2, '#593284', '.12')).join('');
  const mirror = !axis ? '' : axis.direction === 'vertical'
    ? line(axis.after, 0, axis.after, rows, '#593284', '.12')
    : line(0, axis.after, columns, axis.after, '#593284', '.12');
  const marked = markers.map(({ label, cells: [[r, c]] }) =>
    `<text x="${c - .5}" y="${r - .32}" text-anchor="middle" font-size=".52" fill="#37204F">${label}</text>`).join('');
  return `<svg class="mx-auto w-full max-w-xs" viewBox="-.1 -.1 ${columns + .2} ${rows + .2}" role="img" aria-label="${escapeHTML(description)}">${base}${tiles}${border}${mirror}${marked}</svg>`;
}

const describeCells = cells => cells.map(([r, c]) => 'fila ' + r + ', columna ' + c).join('; ');

function renderReflection(visual) {
  const { axis, choices, filled_cells: filled, source_cells: source = [], placed_cells: placed = [] } = visual;
  const description = 'Eje ' + axis.direction + ' después de la '
    + (axis.direction === 'vertical' ? 'columna ' : 'fila ') + axis.after + '. ';
  const main = gridSvg(visual, filled ?? [...source, ...placed], description + (filled
    ? 'Fichas visibles. ' + describeCells(filled) + '. ' + choices.map(card => card.label + ', ' + describeCells(card.cells)).join('. ')
    : 'Fichas de origen. ' + describeCells(source) + (placed.length ? '. Fichas colocadas. ' + describeCells(placed) : '')),
  { axis, markers: filled ? choices : [] });
  const cards = filled ? '' : `<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">${choices.map(card =>
    `<div><span aria-hidden="true">${card.label}</span>${gridSvg(visual, card.cells, 'Tarjeta ' + card.label + '. ' + describeCells(card.cells), { axis })}</div>`).join('')}</div>`;
  return `<div class="mx-auto w-full max-w-2xl rounded-card border-2 border-border-gray bg-white p-4 text-center font-fredoka">${main}${cards}</div>`;
}

function renderMeasurement({ figures, mode, show_dimensions: show }) {
  const cards = figures.map(figure => {
    const edges = mode === 'perimeter' ? shapeEdges(figure.cells) : [];
    const dimensions = show ? 'Ancho ' + figure.columns + ', alto ' + figure.rows + '. ' : '';
    const description = mode === 'area' ? describeCells(figure.cells)
      : edges.map(([r1, c1, r2, c2]) => `tramo de (${r1}, ${c1}) a (${r2}, ${c2})`).join('; ');
    return `<div><p aria-hidden="true">${figure.label} ${dimensions}</p>${gridSvg(figure, mode === 'area' ? figure.cells : [],
      'Figura ' + figure.label + '. ' + dimensions + description, { edges })}</div>`;
  }).join('');
  return `<div class="mx-auto grid w-full max-w-2xl gap-4 rounded-card border-2 border-border-gray bg-white p-4 text-center font-fredoka ${figures.length > 1 ? 'grid-cols-2' : ''}">${cards}</div>`;
}

function renderStaircase({ steps, query_position: position }) {
  const visible = steps.map((step, index) => 'Escalón ' + (index + 1) + ': ' + (step ?? 'casilla vacía'));
  if (position > steps.length) visible.push('Escalón ' + position + ': casilla vacía');
  const cards = visible.map(step => `<span class="rounded-btn bg-soft-lavender px-3 py-2">${step.replace('casilla vacía', '□')}</span>`);
  return visualFrame(visible.join('. '), `<div class="flex flex-wrap justify-center gap-2">${cards.join('')}</div>`);
}

function chips(item, count) {
  const picture = own(OBJECTS, item)
    ? icon(item, 'h-6 w-6')
    : item === 'coral' ? '<span>✿</span>' : '<span>◈</span>';
  return picture.repeat(count);
}

function renderBalance({ left, right, display }) {
  const text = side => side === null ? 'plato vacío' : side.map(value => value ?? 'casilla vacía').join(' más ');
  const plate = side => side === null ? '□' : side.map(value => value === null ? '□'
    : display === 'symbols' ? value : `<span class="inline-flex flex-wrap rounded bg-soft-lavender">${value ? chips('ball', value) : 0}</span>`).join(' + ');
  return visualFrame('Izquierda ' + text(left) + '. Derecha ' + text(right) + '.',
    `<div class="flex flex-wrap items-center justify-center gap-4"><span class="rounded-btn border-b-4 border-numu-purple p-2">${plate(left)}</span><span>=</span><span class="rounded-btn border-b-4 border-numu-purple p-2">${plate(right)}</span></div>`);
}

function renderHiddenNumber({ operator, operands, result }) {
  const word = operator === '+' ? ' más ' : ' menos ';
  const description = operands.map(value => value ?? 'casilla vacía').join(word) + ' igual a ' + result;
  const shown = operands.map(value => value ?? '□').join(operator === '+' ? ' + ' : ' − ');
  return visualFrame(description, `<span class="text-2xl">${shown} = ${result}</span>`);
}

function renderMachine({ examples, operations, input }) {
  if (examples) {
    const description = examples.map(pair => 'Entra ' + pair.input + ', sale ' + pair.output).join('. ');
    const rows = examples.map(pair => `<li>${pair.input} → ${pair.output}</li>`).join('');
    return visualFrame(description, `<ul>${rows}</ul>`);
  }
  const names = { '+': 'Sumar ', '-': 'Restar ', '×': 'Multiplicar por ' };
  const chain = operations.map(op => names[op.operator] + op.value);
  const description = ['Entra ' + input, ...chain, 'salida vacía'].join('. ');
  return visualFrame(description, [input, ...chain, '□'].join(' → '));
}

function draftIconName(item) {
  return own(OBJECTS, item) ? OBJECTS[item][2] : DRAFT_ICONS[item];
}

function renderGrowth({ stages, repeated_icon: repeated, fixed_icon: fixed, query_position: position }) {
  const descriptions = stages.map(stage => 'Paso ' + stage.position + '. '
    + stage.groups.map(count => draftIconName(repeated) + ', grupo de ' + count).join('. ')
    + '. Piezas fijas de ' + draftIconName(fixed) + ': ' + stage.fixed + '.');
  const drawings = stages.map(stage => `<div class="rounded-btn bg-soft-lavender p-2">Paso ${stage.position}
    <div class="flex flex-wrap justify-center gap-2">${stage.groups.map(count =>
      `<span class="inline-flex flex-wrap rounded border border-numu-purple">${chips(repeated, count)}</span>`).join('')}
      <span class="inline-flex flex-wrap">${chips(fixed, stage.fixed)}</span></div></div>`).join('');
  const query = position ? ' Paso solicitado ' + position + '.' : '';
  return visualFrame(descriptions.join(' ') + query, `<div class="grid gap-2">${drawings}${query}</div>`);
}

function renderGrouping({ group_count: count, items_per_group: size, icon: item, container }) {
  const name = DRAFT_CONTAINERS[container];
  const description = Array(count).fill(name + ' con ' + size + ' de ' + draftIconName(item)).join('. ');
  const drawings = Array(count).fill(`<div class="flex flex-wrap justify-center rounded-btn border-2 border-numu-purple p-2">${chips(item, size)}</div>`).join('');
  return visualFrame(description, `<div class="flex flex-wrap justify-center gap-3">${drawings}</div>`);
}

function renderArray({ rows, columns, icon: item }) {
  const description = Array(rows).fill('Fila con ' + columns + ' de ' + draftIconName(item)).join('. ');
  const drawings = Array(rows).fill(`<div class="flex justify-center">${chips(item, columns)}</div>`).join('');
  return visualFrame(description, `<div class="grid gap-1">${drawings}</div>`);
}

function renderSharing({ total, recipients, display, icon: item, container }) {
  const description = 'Cantidad para repartir ' + total + ' de ' + draftIconName(item) + '. ' + DRAFT_CONTAINERS[container] + ', cantidad ' + recipients + '.';
  const drawings = display === 'objects'
    ? `<div class="flex flex-wrap justify-center">${chips(item, total)}</div><div class="flex flex-wrap justify-center gap-2">${Array(recipients).fill('□').join(' ')}</div>`
    : `<div>Para repartir ${total}</div><div>${DRAFT_CONTAINERS[container]} · ${recipients}</div>`;
  return visualFrame(description, drawings);
}

const DRAFT_VISUALS = {
  reflection_grid: { evidence: reflectionEvidence, render: renderReflection, module: 'geometria' },
  measurement_grid: { evidence: measurementEvidence, render: renderMeasurement, module: 'geometria' },
  number_staircase: { evidence: staircaseEvidence, render: renderStaircase, module: 'algebra' },
  balance_model: { evidence: balanceEvidence, render: renderBalance, module: 'algebra' },
  unknown_number: { evidence: hiddenNumberEvidence, render: renderHiddenNumber, module: 'algebra' },
  rule_machine: { evidence: machineEvidence, render: renderMachine, module: 'algebra' },
  growing_pattern: { evidence: growthEvidence, render: renderGrowth, module: 'algebra' },
  equal_groups: { evidence: groupingEvidence, render: renderGrouping, module: 'aritmetica' },
  rectangular_array: { evidence: arrayEvidence, render: renderArray, module: 'aritmetica' },
  equal_sharing: { evidence: sharingEvidence, render: renderSharing, module: 'aritmetica' },
};

/** Dibuja ejemplos explicados, que no tienen opciones ni una respuesta que calificar. */
export function renderGuidedExample(visual) {
  switch (visual?.type) {
    case 'expression': {
      const { operator, operands } = visual;
      if (!['+', '-'].includes(operator) || !allNumeric(operands) || operands.length !== 2) invalid('operación de ejemplo inválida');
      const [a, b] = operands;
      const operation = operator === '+' ? `${a} + ${b} = ${a + b}` : `${a} − ${b} = ${a - b}`;
      return visualFrame(operation, `<span class="text-2xl">${operation}</span>`);
    }
    case 'shape':
      validateShape(visual);
      return renderVisual(visual);
    case 'color_sequence': {
      if (!Array.isArray(visual.sequence) || visual.sequence.length === 0
        || !visual.sequence.every(color => typeof color === 'string' && own(COLORS, color))) invalid('colores de ejemplo inválidos');
      const cards = visual.sequence.map(color => `<span class="inline-flex flex-col items-center gap-1"><span class="h-8 w-8 rounded-full border-2 border-white shadow-sm" style="background:${COLORS[color]}"></span><span class="text-sm">${color}</span></span>`);
      return visualFrame(visual.sequence.join(', '), `<div class="flex flex-wrap justify-center gap-3">${cards.join('')}</div>`);
    }
    case 'measurement_grid': {
      const [figure] = visual.figures ?? [];
      if (visual.mode !== 'perimeter' || visual.figures?.length !== 1 || !/^[A-Z]$/.test(figure?.label)) invalid('contorno de ejemplo inválido');
      validGrid(figure);
      validCells(figure.cells, figure);
      return renderMeasurement(visual);
    }
    case 'equal_groups':
      if (!sizeIsSafe(visual.group_count) || !sizeIsSafe(visual.items_per_group)
        || !validDraftIcon(visual.icon) || !validContainer(visual.container)) invalid('grupos de ejemplo inválidos');
      return renderGrouping(visual);
    case 'number_staircase':
      if (!allNumeric(visual.steps) || !sizeIsSafe(visual.query_position)) invalid('escalera de ejemplo inválida');
      return renderStaircase(visual);
    case 'unknown_number':
      if (!['+', '-'].includes(visual.operator) || visual.operands?.length !== 2
        || visual.operands.filter(value => value === null).length !== 1
        || !visual.operands.every(value => value === null || nonnegativeInteger(value))
        || !nonnegativeInteger(visual.result)) invalid('incógnita de ejemplo inválida');
      return renderHiddenNumber(visual);
    case 'growing_pattern':
      if (!validDraftIcon(visual.repeated_icon) || !validDraftIcon(visual.fixed_icon)
        || !Array.isArray(visual.stages) || !visual.stages.every(stage => sizeIsSafe(stage?.position)
          && Array.isArray(stage.groups) && stage.groups.every(sizeIsSafe) && (stage.fixed === 0 || sizeIsSafe(stage.fixed)))) invalid('crecimiento de ejemplo inválido');
      return renderGrowth({ ...visual, query_position: undefined });
    default:
      invalid('tipo de visual de ejemplo no admitido');
  }
}
