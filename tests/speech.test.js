import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toSpeechText, isVoiceMuted, stopSpeech } from '../src/utils/audio.js';
import { generateQuestions } from '../src/state/questions.js';
import { store } from '../src/state/store.js';

const catalog = JSON.parse(readFileSync(new URL('../src/data/lessonContent.json', import.meta.url), 'utf8'));
const lessons = catalog.courses.flatMap((course) => course.lessons);

test('la voz lee las mismas palabras del texto, sin cambiar género, número ni signos ¿?', () => {
  for (const text of ['¿Cuántas estrellas ves?', '¿Cuántos peces ves?', '¿Qué color sigue en el patrón?',
    ...lessons.map((lesson) => lesson.explanation)]) {
    assert.equal(toSpeechText(text), text);
  }
});

test('los signos matemáticos se leen con palabras', () => {
  assert.equal(toSpeechText('¿Cuánto es 2 + 3?'), '¿Cuánto es 2 más 3?');
  assert.equal(toSpeechText('¿Cuánto es 7 − 4?'), '¿Cuánto es 7 menos 4?');
  assert.equal(toSpeechText('2 + 3 = 5. Empieza en dos.'), '2 más 3 igual a 5. Empieza en dos.');
});

test('el mute de la voz persiste en ajustes y no desactiva los efectos de sonido', () => {
  const initial = Boolean(store.get().settings?.voiceMuted);
  store.setVoiceMuted(true);
  assert.equal(isVoiceMuted(), true);
  assert.notEqual(store.get().settings.sound, false);
  store.setVoiceMuted(initial);
  assert.equal(isVoiceMuted(), false);
});

test('stopSpeech es seguro sin Web Speech API', () => {
  assert.doesNotThrow(() => stopSpeech());
});

test('las preguntas generadas leen el mismo texto que muestran (salvo patrones de colores del catálogo)', () => {
  for (const moduleId of ['conteo', 'aritmetica', 'geometria', 'patrones']) {
    for (const level of [1, 2, 3]) {
      for (const question of generateQuestions(moduleId, level, 12)) {
        assert.equal(question.speakText, question.prompt, `${moduleId} nivel ${level}`);
      }
    }
  }
});
