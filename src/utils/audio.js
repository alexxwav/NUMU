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

/* ---------- Lectura en voz alta (Web Speech API, sin dependencias) ---------- */

/** Preferencia de narración guardada en ajustes (persiste entre preguntas y partidas). */
export function isVoiceMuted() {
  return store.get().settings?.voiceMuted === true;
}

/** Detiene la lectura que estuviera sonando ahora mismo. No toca los efectos de sonido. */
export function stopSpeech() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
}

// Orden de preferencia de las voces en español. Si el navegador no tiene ninguna,
// se pide 'es-ES' y el navegador decide (puede sonar con acento de otro idioma).
const SPANISH_PREFERENCE = ['es-MX', 'es-US', 'es-419', 'es-ES'];
const FALLBACK_LANG = 'es-ES';

let cachedVoice; // undefined = sin buscar todavía; null = no hay voz en español

function pickSpanishVoice() {
  const synth = window.speechSynthesis;
  const voices = synth.getVoices?.() ?? [];
  if (!voices.length) return undefined; // las voces cargan en segundo plano: se reintenta después
  const spanish = voices.filter((v) => v.lang?.toLowerCase().replace('_', '-').startsWith('es'));
  const byLang = (lang) => spanish.filter((v) => v.lang.toLowerCase().replace('_', '-') === lang.toLowerCase());
  for (const lang of SPANISH_PREFERENCE) {
    const matches = byLang(lang);
    if (matches.length) return matches.find((v) => v.localService) ?? matches[0];
  }
  return spanish[0] ?? null;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.addEventListener?.('voiceschanged', () => { cachedVoice = undefined; });
}

/** Voz en español que usará NUMU, o null si el dispositivo no tiene ninguna instalada. */
export function spanishVoice() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  if (cachedVoice === undefined) cachedVoice = pickSpanishVoice();
  return cachedVoice ?? null;
}

/**
 * Texto que recibe el sintetizador: el mismo que ve el niño. Solo se escriben con palabras
 * los signos matemáticos, que algunas voces leen en inglés o se saltan («2 + 3» → «2 más 3»).
 * No cambia palabras, género, número ni la puntuación (¿?¡!).
 */
export function toSpeechText(text) {
  return String(text ?? '')
    .replace(/(\d)\s*\+\s*(\d)/g, '$1 más $2')
    .replace(/(\d)\s*[−–-]\s*(\d)/g, '$1 menos $2')
    .replace(/(\d)\s*×\s*(\d)/g, '$1 por $2')
    .replace(/(\d)\s*÷\s*(\d)/g, '$1 entre $2')
    .replace(/\s*=\s*/g, ' igual a ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lee en voz alta exactamente el texto indicado, con una voz en español si existe. */
export function speak(text) {
  if (isVoiceMuted() || !enabled() || typeof window === 'undefined' || !('speechSynthesis' in window) || !text) return;
  const volume = masterVolume();
  if (volume <= 0) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(toSpeechText(text));
  const voice = spanishVoice();
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang ?? FALLBACK_LANG;
  utterance.rate = 0.95;
  utterance.pitch = 1.1;
  utterance.volume = volume;
  window.speechSynthesis.speak(utterance);
}
