import { store } from '../state/store.js';

let audioCtx = null;

function ctx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  return audioCtx;
}

function enabled() {
  return store.get().settings?.sound !== false;
}

/** Volumen maestro (0–1) configurado en Ajustes. */
function masterVolume() {
  const v = store.get().settings?.volume;
  return typeof v === 'number' ? Math.min(1, Math.max(0, v)) : 0.8;
}

function tone(frequency, { duration = 0.16, type = 'sine', delay = 0, volume = 0.16 } = {}) {
  const ac = ctx();
  const gainLevel = volume * masterVolume();
  if (!ac || gainLevel <= 0) return;
  const start = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(gainLevel, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

export const sfx = {
  tap() {
    if (!enabled()) return;
    tone(520, { duration: 0.07, type: 'triangle', volume: 0.08 });
  },
  correct() {
    if (!enabled()) return;
    tone(659.25, { duration: 0.14, type: 'sine' });
    tone(880, { duration: 0.2, type: 'sine', delay: 0.12 });
  },
  wrong() {
    if (!enabled()) return;
    tone(220, { duration: 0.18, type: 'triangle', volume: 0.12 });
    tone(174.61, { duration: 0.24, type: 'triangle', delay: 0.14, volume: 0.12 });
  },
  win() {
    if (!enabled()) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      tone(f, { duration: 0.24, type: 'sine', delay: i * 0.13 })
    );
  },
};

/* Lectura en voz alta mediante las voces que ofrece el navegador. */
const SPANISH_PREFERENCE = ['es-mx', 'es-us', 'es-419', 'es-es'];
const FEMALE_VOICE = /\b(?:female|femenina|dal[ií]a|sabina|paulina|monica|mónica|paloma|helena|luc[ií]a)\b/i;
const NATURAL_VOICE = /\b(?:natural|neural|premium|enhanced)\b/i;
const normalizeLocale = locale => (locale ?? '').toLowerCase().replace(/_/g, '-');

export function selectSpanishVoice(voices) {
  const spanish = voices.filter(voice => /^es(?:-|$)/.test(normalizeLocale(voice.lang)));
  const dialectRank = voice => {
    const index = SPANISH_PREFERENCE.indexOf(normalizeLocale(voice.lang));
    return index === -1 ? SPANISH_PREFERENCE.length : index;
  };
  const quality = voice => 4 * Number(FEMALE_VOICE.test(voice.name))
    + 2 * Number(NATURAL_VOICE.test(voice.name)) + Number(voice.localService === true);
  return spanish.sort((a, b) => dialectRank(a) - dialectRank(b) || quality(b) - quality(a))[0] ?? null;
}

export function spanishVoice() {
  const synth = globalThis.window?.speechSynthesis;
  return selectSpanishVoice(synth?.getVoices?.() ?? []);
}

const MATH_WORDS = {
  '+': 'más', '-': 'menos', '−': 'menos', '–': 'menos', '×': 'por', '*': 'por',
  '÷': 'entre', '/': 'entre', '=': 'igual a', '<': 'menor que', '>': 'mayor que',
  '≤': 'menor o igual a', '≥': 'mayor o igual a',
};

export function toSpeechText(text) {
  const paragraphs = String(text ?? '').trim().split(/\s*\r?\n\s*/).filter(Boolean);
  return paragraphs.map((line, index) =>
    index < paragraphs.length - 1 && !/[.!?…]$/.test(line) ? line + '.' : line)
    .join(' ')
    .replace(/(?<=[\d□)])\s*([+−–×*÷/=<>≤≥-])\s*(?=[\d□(−-])/g, (_, sign) => ` ${MATH_WORDS[sign]} `)
    .replace(/(^|[\s(])[-−](?=\d)/g, '$1menos ')
    .replace(/(\d)\.(?=\d)/g, '$1 punto ')
    .replace(/□/g, ' el número que falta ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

let activeReading;

function finishReading(reading) {
  if (activeReading !== reading) return;
  activeReading = undefined;
  reading.onFinish?.();
}

export function stopSpeech() {
  if (!activeReading) return;
  const { synth, onFinish } = activeReading;
  activeReading = undefined;
  synth.cancel();
  onFinish?.();
}

export function speak(text, { onFinish } = {}) {
  const { speechSynthesis: synth, SpeechSynthesisUtterance: Utterance } = globalThis.window ?? {};
  const spoken = toSpeechText(text);
  const volume = masterVolume();
  if (!synth || !Utterance || !enabled() || volume <= 0 || !spoken) return false;

  // El juego puede solicitar la lectura automática y manual casi a la vez.
  if (activeReading?.text === spoken) return false;
  stopSpeech();
  const voice = spanishVoice();
  const natural = Boolean(voice && NATURAL_VOICE.test(voice.name));
  const utterance = new Utterance(spoken);
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang?.replace(/_/g, '-') ?? 'es-MX';
  utterance.rate = natural ? 0.96 : 0.92;
  utterance.pitch = natural ? 1.02 : 1.05;
  utterance.volume = volume;

  const reading = { synth, text: spoken, onFinish, utterance };
  activeReading = reading;
  utterance.onend = utterance.onerror = () => finishReading(reading);
  try {
    synth.speak(utterance);
  } catch {
    finishReading(reading);
  }
  return activeReading === reading;
}

store.subscribe(() => {
  if (activeReading && (!enabled() || masterVolume() <= 0)) stopSpeech();
});
