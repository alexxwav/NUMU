// Bloque 1 · Estrellas académicas frente a recompensas cuando se agotan las vidas (contrato v1.1 §5).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { academicStarsFor, starsForRound } from '../src/utils/stars.js';
import { levelAfterRound } from '../src/utils/lessonLevel.js';
import { isLessonCompleted } from '../src/utils/areaProgress.js';
import { store } from '../src/state/store.js';

const TOTAL = 6;
// Lo que Game.jsx calcula hoy para recompensas (sin cambios): starsForRound con approved = lives > 0.
const rewardStars = ({ mistakes, lives }) => starsForRound({ total: TOTAL, mistakes, approved: lives > 0 });

test('sin vidas agotadas: las estrellas académicas son las de la ronda', () => {
  for (const mistakes of [0, 1, 2, 3, 4, 5]) {
    const stars = rewardStars({ mistakes, lives: 5 - Math.min(mistakes, 4) });
    assert.equal(academicStarsFor({ roundStars: stars, livesDepleted: false }), stars, `${mistakes} errores`);
  }
});

test('vidas agotadas y recargadas: 0 estrellas académicas, recompensas iguales que antes', () => {
  // Empezó con 1 vida, falló una vez (0 vidas), recargó a 5 y terminó sin más errores.
  const reward = rewardStars({ mistakes: 1, lives: 5 });
  assert.equal(reward, 3, 'las recompensas siguen dando 3 estrellas (economía sin cambios)');
  assert.equal(reward * 5, 15, 'gemas como hoy');
  assert.equal(reward * 50, 150, 'XP de la ronda como hoy');
  assert.equal(academicStarsFor({ roundStars: reward, livesDepleted: true }), 0, 'académicas: 0');
  assert.equal(isLessonCompleted(academicStarsFor({ roundStars: reward, livesDepleted: true })), false, 'no acredita T2');
});

test('R7–R10 sin cambios: levelAfterRound da los mismos resultados', () => {
  assert.deepEqual(levelAfterRound({ level: 1, stars: 3 }), { level: 2, advanced: true, rule: 'R7' });
  assert.deepEqual(levelAfterRound({ level: 3, stars: 3 }), { level: 3, advanced: false, rule: 'R7' });
  assert.deepEqual(levelAfterRound({ level: 2, stars: 2 }), { level: 2, advanced: false, rule: 'R8' });
  assert.deepEqual(levelAfterRound({ level: 2, stars: 1 }), { level: 2, advanced: false, rule: 'R9' });
  assert.deepEqual(levelAfterRound({ level: 2, stars: 3, livesDepleted: true }), { level: 2, advanced: false, rule: 'R10' });
});

test('se conserva la mejor puntuación académica anterior; la última ronda queda en 0', () => {
  store.recordLessonRound({ lessonId: 'prueba-vidas', stars: 2, level: 1 });
  store.recordLessonRound({ lessonId: 'prueba-vidas', stars: academicStarsFor({ roundStars: 3, livesDepleted: true }), level: 1 });
  const state = store.get();
  assert.equal(state.lessonStars['prueba-vidas'], 2, 'la mejor (2) no baja ni sube a 3');
  assert.equal(state.lessonRounds['prueba-vidas'].latestStars, 0);
});

test('Game.jsx guarda las estrellas académicas y deja las recompensas con `stars`', () => {
  const source = readFileSync(new URL('../src/views/Game.jsx', import.meta.url), 'utf8');
  assert.match(source, /academicStarsFor\(\{ roundStars: stars, livesDepleted \}\)/);
  assert.match(source, /saveLessonResult\(\{ lessonId: finishedLessonId, stars: academicStars, level: result\.level \}\)/);
  assert.match(source, /store\.addRewards\(\{ gems: stars \* 5, stars, xp: stars \* 50, levelStars: stars \}\)/, 'recompensas intactas');
  assert.match(source, /levelAfterRound\(\{ level: lessonLevel, stars, livesDepleted \}\)/, 'R7–R10 reciben lo mismo que antes');
});
