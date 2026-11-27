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
      invalid('tipo visual no admitido');
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

function renderVisual(visual) {
  switch (visual.type) {
    case 'objects': {
      const [, , singular] = OBJECTS[visual.icon];
      const description = Array(visual.count).fill(singular).join('. ') + '.';
      const pictures = Array.from({ length: visual.count }, () => objectIcon(visual.icon)).join('');
      return `<div class="flex flex-wrap gap-3 justify-center items-center max-w-md mx-auto p-4 bg-white rounded-card border-2 border-border-gray" role="img" aria-label="${description}">${pictures}</div>`;
    }
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
    default: invalid('tipo visual no admitido');
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
    hint: buildQuestionHint(exercise, HINT_MODULE[visual.type]),
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
