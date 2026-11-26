import { icon } from '../components/icons.js';

// Último respaldo: solo se usa si la pregunta no trae pista y no se puede deducir ninguna.
export const ROUND_TIPS = Object.freeze({
  conteo: 'Señala un objeto a la vez mientras cuentas. El último número que digas es el total.',
  aritmetica: 'Empieza en el primer número. Avanza si ves + o retrocede si ves −. El segundo número te dice cuántos pasos dar.',
  geometria: 'Elige una esquina y recorre el borde. Cuenta cada lado una sola vez hasta volver a esa esquina.',
  patrones: 'Busca el grupo de colores que se repite. Sigue ese mismo orden hasta llegar al espacio vacío.',
});

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

/* ---------- CONTEO (objetos SVG o imágenes de marca, sin emojis) ---------- */
const COUNT_ITEMS = [
  { iconName: 'ball', name: 'pelotas', article: 'las', color: 'text-cyan-ocean' },
  { iconName: 'fish', name: 'peces', article: 'los', color: 'text-orange-energy' },
  { iconName: 'star', name: 'estrellas', article: 'las', color: '' },
  { iconName: 'balloon', name: 'globos', article: 'los', color: 'text-coral-alert' },
  { iconName: 'heart', name: 'corazones', article: 'los', color: '' },
];

const COUNT_ARTICLES = Object.fromEntries(COUNT_ITEMS.map((item) => [item.name, item.article]));

function countQuestion(level) {
  const item = COUNT_ITEMS[rand(0, COUNT_ITEMS.length - 1)];
  const total = rand(2, Math.min(10, 4 + level));
  const { options, answerIndex } = buildOptions(total);
  const itemClass = ['w-11 h-11 sm:w-14 sm:h-14', item.color, 'animate-pop-in'].filter(Boolean).join(' ');
  return {
    prompt: `¿Cuántos ${item.name} ves?`,
    speakText: `¿Cuántos ${item.name} ves?`, // igual que el texto que se muestra
    visual: `<div class="flex flex-wrap gap-3 justify-center items-center max-w-md mx-auto p-4 bg-white rounded-card border-2 border-border-gray" role="img" aria-label="${total} ${item.name}">
        ${Array.from({ length: total }, () => icon(item.iconName, itemClass)).join('')}
      </div>`,
    hint: `Señala y cuenta uno por uno ${item.article} ${item.name} de izquierda a derecha hasta el final.`,
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
    speakText: `¿Cuánto es ${a} ${symbol} ${b}?`, // igual que el texto; speak() lee + y − como «más» y «menos»
    visual: `<div class="flex items-center justify-center gap-4 p-6 bg-white rounded-card border-2 border-border-gray">
        <span class="font-fredoka font-bold text-display-lg tabular-nums text-numu-purple">${a}</span>
        <span class="font-fredoka font-bold text-display-lg text-orange-energy">${symbol}</span>
        <span class="font-fredoka font-bold text-display-lg tabular-nums text-numu-purple">${b}</span>
        <span class="font-fredoka font-bold text-display-lg text-text-dark/40">=</span>
        <span class="font-fredoka font-bold text-display-lg text-text-dark/30">?</span>
      </div>`,
    hint: `Empieza en ${a} y cuenta ${b} lugares más hacia ${useSubtraction ? 'atrás' : 'adelante'}.`,
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
    hint: `Toca y cuenta cada esquina o lado recto del ${shape.name}: tiene ${shape.sides} lados.`,
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
    hint: `El grupo ${unit.map((color) => color.label).join(' + ')} se repite. Después de ${sequence[sequence.length - 1].label} vuelve ${answerColor.label}.`,
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

/* ---------- PISTAS: explicación no vacía para toda pregunta ---------- */
const COLOR_LABELS = Object.fromEntries(PATTERN_COLORS.map(({ label, color }) => [color.toLowerCase(), label]));

const promptMatch = (question, pattern) => typeof question?.prompt === 'string' ? question.prompt.match(pattern) : null;
const visualText = (question) => typeof question?.visual === 'string' ? question.visual : '';

function inferModule(question, moduleId) {
  if (Object.hasOwn(ROUND_TIPS, moduleId)) return moduleId;
  const prompt = typeof question?.prompt === 'string' ? question.prompt : '';
  if (/¿Cuántos .+ ves\?/.test(prompt)) return 'conteo';
  if (/¿Cuánto es \d+ [+−] \d+\?/.test(prompt)) return 'aritmetica';
  if (/¿Cuántos lados tiene/.test(prompt)) return 'geometria';
  if (/patrón/.test(prompt)) return 'patrones';
  const visual = visualText(question);
  if (/aria-label="\d+ /.test(visual)) return 'conteo';
  if (visual.includes('<polygon')) return 'geometria';
  if (visual.includes('border-dashed') && visual.includes('background:')) return 'patrones';
  if (visual.includes('tabular-nums')) return 'aritmetica';
  return null;
}

function describeQuestion(question, moduleId) {
  const visual = visualText(question);
  switch (moduleId) {
    case 'conteo': {
      const name = promptMatch(question, /¿Cuántos (.+) ves\?/)?.[1] ?? visual.match(/aria-label="\d+ (.+?)"/)?.[1];
      return name
        ? `Cuenta uno por uno ${COUNT_ARTICLES[name] ?? 'los'} ${name} de izquierda a derecha hasta el final.`
        : 'Cuenta uno por uno cada objeto de izquierda a derecha hasta el final.';
    }
    case 'aritmetica': {
      const match = promptMatch(question, /¿Cuánto es (\d+) ([+−]) (\d+)\?/);
      if (!match) return '';
      const [, a, symbol, b] = match;
      return `Empieza en ${a} y cuenta ${b} lugares más hacia ${symbol === '+' ? 'adelante' : 'atrás'}.`;
    }
    case 'geometria': {
      const shape = promptMatch(question, /¿Cuántos lados tiene el (.+)\?/)?.[1] ?? visual.match(/aria-label="(.+?)"/)?.[1];
      return `Toca y cuenta cada esquina o lado recto de la figura${shape ? ` del ${shape}` : ''}: recorre el borde y cuenta sus lados.`;
    }
    case 'patrones': {
      const colors = [...new Set([...visual.matchAll(/background:\s*(#[0-9A-Fa-f]{6})/g)]
        .map((match) => COLOR_LABELS[match[1].toLowerCase()]).filter(Boolean))];
      return `Mira los colores que se repiten en orden desde el inicio${colors.length ? ` (${colors.join(' → ')})` : ''} para descubrir cuál sigue.`;
    }
    default:
      return '';
  }
}

/** Pista editorial > explicación específica de la pregunta > respaldo del módulo. Nunca devuelve ''. */
export function buildQuestionHint(question, moduleId) {
  const hint = question?.hint;
  if (typeof hint === 'string' && hint.trim()) return hint;
  const module = inferModule(question, moduleId);
  return describeQuestion(question, module) || ROUND_TIPS[module] || ROUND_TIPS.conteo;
}

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
