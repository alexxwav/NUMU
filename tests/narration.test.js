import assert from 'node:assert/strict';
import test from 'node:test';
import { store } from '../src/state/store.js';
import { selectSpanishVoice, spanishVoice, speak, stopSpeech, toSpeechText } from '../src/utils/audio.js';
import { loadCatalogV2 } from '../content-drafts/catalog-v2.fixture.js';
import { adaptExerciseToGame } from '../src/utils/lessonGameAdapter.js';

const voice = (name, lang, localService = true) => ({ name, lang, localService });
const dalia = voice('Microsoft Dalia Online (Natural)', 'es-MX', false);
const sabina = voice('Microsoft Sabina', 'es_MX');
const paloma = voice('Paloma', 'es-US');

test('La voz prioriza español de México y elige una voz femenina natural cuando está disponible', () => {
  const spanish = voice('Spanish (Spain)', 'es-ES');
  const english = voice('Female Natural', 'en-US');
  const mexican = voice('Spanish (Mexico)', 'es-MX');
  assert.equal(selectSpanishVoice([english, spanish, paloma, mexican, sabina, dalia]), dalia);
  assert.equal(selectSpanishVoice([spanish, paloma, mexican, sabina]), sabina);
  assert.equal(selectSpanishVoice([spanish, paloma]), paloma);
  assert.equal(selectSpanishVoice([english]), null);
});

test('La lectura conserva las preguntas, separa los párrafos y pronuncia expresiones completas', () => {
  assert.equal(toSpeechText('¿Cuánto es 11+2+3=16?\nMarca la respuesta'), '¿Cuánto es 11 más 2 más 3 igual a 16? Marca la respuesta');
  assert.equal(toSpeechText('Cuenta con NUMU\n5−2=3. 12/3=4. 2×3≥6.'), 'Cuenta con NUMU. 5 menos 2 igual a 3. 12 entre 3 igual a 4. 2 por 3 mayor o igual a 6.');
  assert.equal(toSpeechText('□ + 3 = 8. 1.5 < 2. −2'), 'el número que falta más 3 igual a 8. 1 punto 5 menor que 2. menos 2');
});

test('La lectura de Patrones dice los colores y enuncia la consigna una sola vez', () => {
  const exercise = loadCatalogV2().courses[1].lessons.find(({ id }) => id === 'patrones').exercises[0];
  const question = adaptExerciseToGame(exercise);
  assert.equal(question.speakText, 'Colores: ' + exercise.visual.sequence.join(', ') + '. ' + exercise.prompt);
  assert.equal(question.speakText.split(exercise.prompt).length, 2);
});

test('Cancela la anterior, evita duplicados y respeta silenciar y el volumen maestro', t => {
  const previousWindow = globalThis.window;
  const previousSettings = store.get().settings;
  const spoken = [];
  let cancelled = 0;
  let voices = [];
  globalThis.window = {
    speechSynthesis: {
      getVoices: () => voices,
      speak: utterance => spoken.push(utterance),
      cancel: () => { cancelled++; },
    },
    SpeechSynthesisUtterance: class {
      constructor(value) { this.text = value; }
    },
  };
  t.after(() => {
    stopSpeech();
    store.set({ settings: previousSettings });
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  });
  store.set({ settings: { sound: true, volume: 0.6 } });
  const ended = [];
  assert.equal(speak('¡Vamos a contar!', { onFinish: () => ended.push('primera') }), true);
  assert.equal(spoken[0].lang, 'es-MX');
  assert.equal(spoken[0].volume, 0.6);
  assert.equal(speak('¡Vamos a  contar!'), false);
  assert.equal(spoken.length, 1);

  voices = [paloma, dalia];
  assert.equal(spanishVoice(), dalia);
  assert.equal(speak('¡Sigue contando!', { onFinish: () => ended.push('segunda') }), true);
  assert.equal(spoken[1].voice, dalia);
  assert.equal(spoken[1].rate, 0.96);
  assert.equal(spoken[1].pitch, 1.02);
  assert.equal(cancelled, 1);
  assert.deepEqual(ended, ['primera']);
  spoken[0].onerror();
  assert.deepEqual(ended, ['primera']);
  store.set({ settings: { sound: false } });
  assert.equal(cancelled, 2);
  assert.equal(speak('No debe oírse'), false);
  assert.deepEqual(ended, ['primera', 'segunda']);

  store.set({ settings: { sound: true, volume: 0 } });
  assert.equal(speak('Volumen cero'), false);
  store.set({ settings: { volume: 0.8 } });
  assert.equal(speak('Otra lectura'), true);
  spoken[2].onend();
  stopSpeech();
  assert.equal(cancelled, 2);
});
