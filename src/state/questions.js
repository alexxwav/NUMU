import { icon } from '../components/icons.js';

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const shuffle = (arr) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

function buildOptions(answer, poolSize = 3) {
  const options = new Set([answer]);
  let guard = 0;
  while (options.size <= poolSize && guard++ < 60) {
    const delta = rand(1, Math.max(2, Math.round(answer * 0.4) + 1));
    const candidate = answer + (Math.random() < 0.5 ? -delta : delta);
    if (candidate >= 0 && candidate !== answer) options.add(candidate);
    else if (candidate < 0) options.add(answer + delta);
  }
  const labels = shuffle([...options]).map((value) => ({ label: String(value) }));
  let answerIndex = labels.findIndex((opt) => opt.label === String(answer));
  if (answerIndex === -1) {
    labels[0] = { label: String(answer) };
    answerIndex = 0;
  }
  return { options: labels, answerIndex };
}

/* ---------- CONTEO (objetos SVG, sin emojis) ---------- */
const COUNT_ITEMS = [
  { iconName: 'ball', name: 'pelotas', color: 'text-cyan-ocean' },
  { iconName: 'fish', name: 'peces', color: 'text-orange-energy' },
  { iconName: 'star', name: 'estrellas', color: 'text-sunshine-yellow' },
  { iconName: 'balloon', name: 'globos', color: 'text-coral-alert' },
  { iconName: 'heart', name: 'corazones', color: 'text-numu-purple' },
];

function countQuestion(level) {
  const item = COUNT_ITEMS[rand(0, COUNT_ITEMS.length - 1)];
  const total = rand(2, Math.min(10, 4 + level));
  const { options, answerIndex } = buildOptions(total);
  return {
    prompt: `¿Cuántos ${item.name} ves?`,
    speakText: `¿Cuántos ${item.name} hay?`,
    visual: `<div class="flex flex-wrap gap-3 justify-center items-center max-w-md mx-auto p-4 bg-white rounded-card border-2 border-border-gray" role="img" aria-label="${total} ${item.name}">
        ${Array.from({ length: total }, () => icon(item.iconName, `w-11 h-11 sm:w-14 sm:h-14 ${item.color} animate-pop-in`)).join('')}
      </div>`,
    options,
    answerIndex,
  };
}

/* ---------- ARITMÉTICA ---------- */
function arithmeticQuestion(level) {
  const maxOperand = Math.min(9, 3 + level);
  const useSubtraction = Math.random() < 0.4 && level >= 2;
  let a = rand(1, maxOperand);
  let b = rand(1, maxOperand);
  if (useSubtraction && b > a) [a, b] = [b, a];
  const answer = useSubtraction ? a - b : a + b;
  const symbol = useSubtraction ? '−' : '+';
  const { options, answerIndex } = buildOptions(answer);
  return {
    prompt: `¿Cuánto es ${a} ${symbol} ${b}?`,
    speakText: `${a} ${useSubtraction ? 'menos' : 'más'} ${b}`,
    visual: `<div class="flex items-center justify-center gap-4 p-6 bg-white rounded-card border-2 border-border-gray">
        <span class="font-fredoka font-bold text-display-lg tabular-nums text-numu-purple">${a}</span>
        <span class="font-fredoka font-bold text-display-lg text-orange-energy">${symbol}</span>
        <span class="font-fredoka font-bold text-display-lg tabular-nums text-numu-purple">${b}</span>
        <span class="font-fredoka font-bold text-display-lg text-text-dark/40">=</span>
        <span class="font-fredoka font-bold text-display-lg text-text-dark/30">?</span>
      </div>`,
    options,
    answerIndex,
  };
}

/* ---------- GEOMETRÍA ---------- */
const SHAPES = [
  { name: 'triángulo', sides: 3, points: '50,8 92,88 8,88' },
  { name: 'cuadrado', sides: 4, points: '12,12 88,12 88,88 12,88' },
  { name: 'pentágono', sides: 5, points: '50,6 94,38 77,92 23,92 6,38' },
  { name: 'hexágono', sides: 6, points: '50,5 91,27.5 91,72.5 50,95 9,72.5 9,27.5' },
];

function shapeSvg(shape) {
  return `<svg viewBox="0 0 100 100" class="w-40 h-40 sm:w-48 sm:h-48" role="img" aria-label="${shape.name}">
      <polygon points="${shape.points}" fill="#5124EE" stroke="#2B0F8A" stroke-width="4" stroke-linejoin="round"/>
      <circle cx="40" cy="50" r="5" fill="#FFFFFF"/><circle cx="60" cy="50" r="5" fill="#FFFFFF"/>
      <path d="M40 66 Q50 76 60 66" stroke="#FFFFFF" stroke-width="4" fill="none" stroke-linecap="round"/>
    </svg>`;
}

function geometryQuestion(level) {
  const pool = SHAPES.slice(0, Math.min(SHAPES.length, 2 + level));
  const shape = pool[rand(0, pool.length - 1)];
  const { options, answerIndex } = buildOptions(shape.sides);
  return {
    prompt: `¿Cuántos lados tiene el ${shape.name}?`,
    speakText: `¿Cuántos lados tiene el ${shape.name}?`,
    visual: `<div class="flex items-center justify-center p-4 bg-white rounded-card border-2 border-border-gray">${shapeSvg(shape)}</div>`,
    options,
    answerIndex,
  };
}

/* ---------- PATRONES ---------- */
const PATTERN_COLORS = [
  { label: 'Morado', color: '#5124EE' },
  { label: 'Amarillo', color: '#FFC700' },
  { label: 'Verde', color: '#00D282' },
  { label: 'Coral', color: '#FF5A5F' },
  { label: 'Cian', color: '#00B4D8' },
];

function patternQuestion(level) {
  const unitSize = level >= 3 ? 3 : 2;
  const unit = shuffle(PATTERN_COLORS).slice(0, unitSize);
  const sequence = Array.from({ length: 6 }, (_, i) => unit[i % unit.length]);
  const answerColor = unit[sequence.length % unit.length];
  const distractors = shuffle(PATTERN_COLORS.filter((c) => c.label !== answerColor.label)).slice(0, 3);
  const options = shuffle([answerColor, ...distractors]).map((c) => ({ label: c.label, color: c.color }));
  const answerIndex = options.findIndex((opt) => opt.label === answerColor.label);

  const dot = (c, extra = '') =>
    `<span class="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-4 border-white shadow-md ${extra}" style="background:${c.color}"></span>`;

  return {
    prompt: '¿Qué color sigue en el patrón?',
    speakText: '¿Qué color sigue en el patrón?',
    visual: `<div class="flex flex-wrap items-center justify-center gap-3 p-5 bg-white rounded-card border-2 border-border-gray">
        ${sequence.map((c) => dot(c)).join('')}
        <span class="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-4 border-dashed border-text-dark/40 grid place-items-center font-fredoka font-bold text-h2 text-text-dark/50">?</span>
      </div>`,
    options,
    answerIndex,
  };
}

const GENERATORS = {
  conteo: countQuestion,
  aritmetica: arithmeticQuestion,
  geometria: geometryQuestion,
  patrones: patternQuestion,
};

/**
 * Genera una ronda de preguntas adaptadas al módulo y nivel actual.
 * @param {string} moduleId - conteo | aritmetica | geometria | patrones
 * @param {number} level - Nivel actual del niño (1+).
 * @param {number} [count] - Cantidad de preguntas.
 */
export function generateQuestions(moduleId, level = 1, count = 6) {
  const generator = GENERATORS[moduleId] ?? countQuestion;
  return Array.from({ length: count }, () => generator(Math.max(1, level)));
}
