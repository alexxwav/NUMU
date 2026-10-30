import { icon } from '../components/icons.js';
import { getExerciseFeedback } from './lessonContent.js';

// Contrato leído en Game.jsx y questions.js (base 02deb61): visual es HTML,
// options contiene { label: string, color?: string } y answerIndex es base cero.
// Solo convierte una pregunta: no genera rondas, premios, progreso ni adaptación.
// El juego todavía no consume hint/feedback_*; se conservan como metadatos.
// Los fragmentos siguen los recursos y estilos del generador existente.
const COLORS = Object.freeze({
  Morado: '#5124EE', Amarillo: '#FFC700', Verde: '#00D282',
  Coral: '#FF5A5F', Cian: '#00B4D8',
});
const OBJECTS = Object.freeze({
  star: ['estrellas', 'text-sunshine-yellow'],
  ball: ['pelotas', 'text-cyan-ocean'],
  fish: ['peces', 'text-orange-energy'],
  balloon: ['globos', 'text-coral-alert'],
  heart: ['corazones', 'text-numu-purple'],
});
const SHAPES = Object.freeze({
  triangle: ['triángulo', 3, '50,8 92,88 8,88'],
  square: ['cuadrado', 4, '12,12 88,12 88,88 12,88'],
  pentagon: ['pentágono', 5, '50,6 94,38 77,92 23,92 6,38'],
  hexagon: ['hexágono', 6, '50,5 91,27.5 91,72.5 50,95 9,72.5 9,27.5'],
});
const own = (object, key) => Object.hasOwn(object, key);
const nonnegativeInteger = value => Number.isSafeInteger(value) && value >= 0;
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

function invalid(message) {
  throw new TypeError(`No se puede adaptar el ejercicio: ${message}`);
}

function validateVisual(exercise) {
  const visual = exercise.visual;
  if (!visual || typeof visual !== 'object' || Array.isArray(visual)) invalid('se necesita un visual estructurado');
  if (visual.type !== 'color_sequence' && !Array.from(exercise.options).every(nonnegativeInteger)) invalid('las opciones deben ser enteros no negativos');
  switch (visual.type) {
    case 'objects':
      if (!own(OBJECTS, visual.icon) || !Number.isInteger(visual.count) || visual.count < 1 || visual.count > 10) invalid('icono o cantidad de objetos no admitidos (1 a 10)');
      if (exercise.correct_answer !== visual.count) invalid('la cantidad no coincide con la respuesta');
      break;
    case 'expression':
      if (visual.operator !== '+' || !Array.isArray(visual.operands) || visual.operands.length !== 2 || !visual.operands.every(nonnegativeInteger)) invalid('solo se admiten sumas de dos enteros no negativos');
      if (!Number.isSafeInteger(visual.operands[0] + visual.operands[1]) || exercise.correct_answer !== visual.operands[0] + visual.operands[1]) invalid('la suma no coincide con la respuesta');
      break;
    case 'shape':
      if (!own(SHAPES, visual.shape) || visual.sides !== SHAPES[visual.shape][1] || exercise.correct_answer !== visual.sides) invalid('figura, lados o respuesta inconsistentes');
      if (visual.rotation_degrees !== undefined && (typeof visual.rotation_degrees !== 'number' || !Number.isFinite(visual.rotation_degrees) || visual.rotation_degrees < 0 || visual.rotation_degrees >= 360)) invalid('rotación inválida');
      if (visual.size !== undefined && !['small', 'normal'].includes(visual.size)) invalid('tamaño no admitido');
      break;
    case 'color_sequence': {
      const sequence = visual.sequence;
      if (!Array.isArray(sequence) || sequence.length !== 4 || !Array.from(sequence).every(color => typeof color === 'string' && own(COLORS, color)) || visual.missing_index !== sequence.length) invalid('se necesita una secuencia de cuatro colores y un hueco final');
      if (sequence[0] === sequence[1] || sequence[0] !== sequence[2] || sequence[1] !== sequence[3] || exercise.correct_answer !== sequence[0]) invalid('la secuencia debe seguir la regla ABAB');
      if (!Array.from(exercise.options).every(color => typeof color === 'string' && own(COLORS, color))) invalid('color no admitido');
      break;
    }
    default: invalid('tipo visual no admitido');
  }
}

function renderVisual(visual) {
  switch (visual.type) {
    case 'objects': {
      const [name, colorClass] = OBJECTS[visual.icon];
      const objects = Array.from({ length: visual.count }, () => icon(visual.icon, `w-11 h-11 sm:w-14 sm:h-14 ${colorClass}`)).join('');
      return `<div class="flex flex-wrap gap-3 justify-center items-center max-w-md mx-auto p-4 bg-white rounded-card border-2 border-border-gray" role="img" aria-label="${visual.count} ${name}">${objects}</div>`;
    }
    case 'expression': {
      const [a, b] = visual.operands;
      return `<div class="flex items-center justify-center gap-4 p-6 bg-white rounded-card border-2 border-border-gray"><span class="font-fredoka font-bold text-display-lg tabular-nums text-numu-purple">${a}</span><span class="font-fredoka font-bold text-display-lg text-orange-energy">+</span><span class="font-fredoka font-bold text-display-lg tabular-nums text-numu-purple">${b}</span><span class="font-fredoka font-bold text-display-lg text-text-dark/40">=</span><span class="font-fredoka font-bold text-display-lg text-text-dark/30">?</span></div>`;
    }
    case 'shape': {
      const [name, , points] = SHAPES[visual.shape];
      const rotation = visual.rotation_degrees ?? 0;
      const scale = visual.size === 'small' ? 0.65 : 1;
      return `<div class="flex items-center justify-center p-4 bg-white rounded-card border-2 border-border-gray"><svg viewBox="0 0 100 100" class="w-40 h-40 sm:w-48 sm:h-48" role="img" aria-label="${name}"><g transform="translate(50 50) rotate(${rotation}) scale(${scale}) translate(-50 -50)"><polygon points="${points}" fill="#5124EE" stroke="#2B0F8A" stroke-width="4" stroke-linejoin="round"/><circle cx="40" cy="50" r="5" fill="#FFFFFF"/><circle cx="60" cy="50" r="5" fill="#FFFFFF"/><path d="M40 66 Q50 76 60 66" stroke="#FFFFFF" stroke-width="4" fill="none" stroke-linecap="round"/></g></svg></div>`;
    }
    case 'color_sequence': {
      const sequence = visual.sequence.map(color => `<span class="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-4 border-white shadow-md" style="background:${COLORS[color]}"></span>`).join('');
      return `<div class="flex flex-wrap items-center justify-center gap-3 p-5 bg-white rounded-card border-2 border-border-gray" role="img" aria-label="${escapeHTML(visual.sequence.join(', '))}, ¿qué color sigue?">${sequence}<span class="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-4 border-dashed border-text-dark/40 grid place-items-center font-fredoka font-bold text-h2 text-text-dark/50">?</span></div>`;
    }
    default: invalid('tipo visual no admitido');
  }
}

/** Convierte un ejercicio editorial a una pregunta para Game.jsx.
 * Conserva id, correct_answer, hint y feedback_* sin renombrarlos.
 * answer_index se convierte a answerIndex; las opciones pasan a etiquetas.
 * Rechaza HTML de entrada y visual_description sin estructura con TypeError.
 * No mezcla opciones ni cambia su orden. No modifica ni comparte objetos de entrada.
 * El HTML solo se construye con recursos locales, números validados y colores fijos.
 */
export function adaptExerciseToGame(exercise) {
  if (!getExerciseFeedback(exercise, exercise?.answer_index).valid) invalid('faltan campos o la respuesta no es válida');
  validateVisual(exercise);
  const { answer_index, visual, options, ...metadata } = structuredClone(exercise);
  return {
    ...metadata,
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
