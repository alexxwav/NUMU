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

/** Lectura en voz alta de la instrucción (Web Speech API, sin dependencias). */
export function speak(text) {
  if (!enabled() || !('speechSynthesis' in window) || !text) return;
  const volume = masterVolume();
  if (volume <= 0) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'es-ES';
  utterance.rate = 0.95;
  utterance.pitch = 1.1;
  utterance.volume = volume;
  window.speechSynthesis.speak(utterance);
}
