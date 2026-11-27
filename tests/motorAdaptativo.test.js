// Motor adaptativo mínimo: R11 (dificultad descendente), no repetir la ronda anterior y refuerzo del
// tipo de ejercicio fallado. Catálogo oficial integrado; alumnos ficticios; sin Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { adaptiveLevelAfterRound, levelAfterRound, mergeLessonProgress } from '../src/utils/lessonLevel.js';
import { planLessonRound, selectLessonQuestions, questionSignature, semanticTypeOf, weakTypesFrom, lessonCoverage, MAX_REINFORCED, QUESTIONS_PER_ROUND } from '../src/utils/lessonRound.js';
import { isLessonCompleted } from '../src/utils/areaProgress.js';

const memory = new Map();
globalThis.localStorage = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, String(v)), removeItem: (k) => memory.delete(k) };
const { store } = await import('../src/state/store.js');
const catalog = JSON.parse(readFileSync(new URL('../src/data/lessonContent.json', import.meta.url), 'utf8'));
const lessons = Object.fromEntries(catalog.courses.flatMap((c) => c.lessons).map((l) => [l.id, l]));
const sigs = (questions) => questions.map(questionSignature);
const RUNS = 30;

// Simula el cierre de ronda de Game.jsx (mismas funciones y mismos datos guardados).
function jugar(lessonId, { stars, livesDepleted = false, failedTypes = [] }) {
  const round = store.get().lessonRounds?.[lessonId] ?? {};
  const level = round.level ?? 1;
  const plan = planLessonRound({ lesson: lessons[lessonId], level, avoidSignatures: round.lastSignatures ?? [], preferTypes: round.weakTypes ?? [] });
  const result = adaptiveLevelAfterRound({ level, stars, livesDepleted, lowStreak: round.lowStreak ?? 0 });
  const mistakes = {};
  for (const t of failedTypes) mistakes[t] = (mistakes[t] ?? 0) + 1;
  store.recordLessonRound({ lessonId, stars: livesDepleted ? 0 : stars, level: result.level,
    adaptive: { lowStreak: result.lowStreak, lastSignatures: sigs(plan.questions), weakTypes: weakTypesFrom(mistakes) } });
  return { plan, result };
}

test('R11 · dos rondas seguidas con ≤1 estrella bajan un nivel; nunca de 1', () => {
  assert.deepEqual(adaptiveLevelAfterRound({ level: 3, stars: 1, lowStreak: 0 }), { level: 3, advanced: false, rule: 'R9', lowered: false, lowStreak: 1 });
  assert.deepEqual(adaptiveLevelAfterRound({ level: 3, stars: 1, lowStreak: 1 }), { level: 2, advanced: false, lowered: true, rule: 'R11', lowStreak: 0 });
  assert.deepEqual(adaptiveLevelAfterRound({ level: 2, stars: 0, lowStreak: 1 }), { level: 1, advanced: false, lowered: true, rule: 'R11', lowStreak: 0 });
  assert.equal(adaptiveLevelAfterRound({ level: 2, stars: 3, livesDepleted: true, lowStreak: 1 }).rule, 'R11', 'vidas agotadas cuenta como bajo desempeño');
  const atOne = adaptiveLevelAfterRound({ level: 1, stars: 1, lowStreak: 5 });
  assert.deepEqual([atOne.level, atOne.lowered], [1, false], 'nunca baja de 1');
});

test('R11 · una ronda con 2 o 3 estrellas rompe la racha; R7–R10 no cambian', () => {
  assert.deepEqual(adaptiveLevelAfterRound({ level: 2, stars: 2, lowStreak: 1 }), { ...levelAfterRound({ level: 2, stars: 2 }), lowered: false, lowStreak: 0 });
  assert.deepEqual(adaptiveLevelAfterRound({ level: 2, stars: 3, lowStreak: 1 }), { level: 3, advanced: true, rule: 'R7', lowered: false, lowStreak: 0 });
  for (const [level, stars, livesDepleted] of [[1, 3, false], [3, 3, false], [2, 2, false], [2, 1, false], [2, 3, true], [1, 0, false]]) {
    const { lowered, lowStreak, ...rest } = adaptiveLevelAfterRound({ level, stars, livesDepleted, lowStreak: 0 });
    assert.deepEqual(rest, levelAfterRound({ level, stars, livesDepleted }), `nivel ${level}, ${stars}★`);
  }
});

test('R11 · recorrido: bajar de nivel no baja la mejor estrella ni da recompensas', () => {
  store.endSession();
  store.set({ gems: 40, xp: 1200, lessonRounds: { 'sumas-basicas': { level: 3, latestStars: 3, at: '2026-11-27T10:00:00Z' } }, lessonStars: { 'sumas-basicas': 3 } });
  const before = { gems: store.get().gems, xp: store.get().xp };
  jugar('sumas-basicas', { stars: 1 });
  assert.equal(store.get().lessonRounds['sumas-basicas'].level, 3, 'una ronda mala no baja');
  jugar('sumas-basicas', { stars: 2 });
  jugar('sumas-basicas', { stars: 1 });
  assert.equal(store.get().lessonRounds['sumas-basicas'].level, 3, '2★ en medio rompió la racha');
  const { result } = jugar('sumas-basicas', { stars: 0, livesDepleted: true });
  assert.deepEqual([result.rule, store.get().lessonRounds['sumas-basicas'].level], ['R11', 2]);
  assert.equal(store.get().lessonStars['sumas-basicas'], 3, 'la mejor marca (T2) no baja');
  assert.equal(isLessonCompleted(store.get().lessonStars['sumas-basicas']), true, 'sigue terminada');
  assert.deepEqual({ gems: store.get().gems, xp: store.get().xp }, before, 'sin recompensas por bajar de nivel');
  jugar('sumas-basicas', { stars: 3 });
  assert.equal(store.get().lessonRounds['sumas-basicas'].level, 3, 'y vuelve a subir con 3★ (R7)');
});

test('no repetir · con alternativas, la ronda siguiente no trae ninguna pregunta equivalente de la anterior', () => {
  for (const [id, level] of [['sumas-basicas', 2], ['sumas-basicas', 3], ['patrones', 2], ['patrones', 3], ['figuras', 2], ['figuras', 3]]) {
    for (let run = 0; run < RUNS; run++) {
      const first = selectLessonQuestions({ lesson: lessons[id], level });
      const second = selectLessonQuestions({ lesson: lessons[id], level, avoidSignatures: sigs(first.questions) });
      assert.equal(second.playable, true);
      assert.equal(new Set(sigs(second.questions)).size, QUESTIONS_PER_ROUND, `${id} N${level}: 6 distintas`);
      const repeated = sigs(second.questions).filter((s) => sigs(first.questions).includes(s)).length;
      const available = lessonCoverage({ lesson: lessons[id], level }).distinct;
      // Con 12 o más distintas no se repite ninguna; con menos (Figuras N2–N3: 10), solo las inevitables.
      assert.equal(repeated, Math.max(0, 2 * QUESTIONS_PER_ROUND - available), `${id} N${level}: ${available} distintas disponibles`);
    }
  }
});

test('no repetir · sin alternativas suficientes repite el mínimo necesario y no bloquea la práctica', () => {
  for (const [id, level] of [['figuras', 1], ['patrones', 1]]) {
    const available = lessonCoverage({ lesson: lessons[id], level }).distinct;
    for (let run = 0; run < RUNS; run++) {
      const first = selectLessonQuestions({ lesson: lessons[id], level });
      const second = planLessonRound({ lesson: lessons[id], level, avoidSignatures: sigs(first.questions) });
      assert.equal(second.mode, 'selector', `${id} N${level}: sigue jugable`);
      const repeated = sigs(second.questions).filter((s) => sigs(first.questions).includes(s)).length;
      assert.equal(repeated, Math.max(0, 2 * QUESTIONS_PER_ROUND - available), `${id} N${level}: solo las repeticiones inevitables`);
    }
  }
});

test('refuerzo · el tipo más fallado aparece en la siguiente ronda, sin ocupar toda la ronda', () => {
  assert.deepEqual(weakTypesFrom({ 'resolver-resta': 3, 'resolver-suma': 1, x: 0 }), ['resolver-resta', 'resolver-suma']);
  assert.equal(MAX_REINFORCED, 2);
  for (const [id, level, type] of [['sumas-basicas', 2, 'resolver-resta'], ['figuras', 1, 'emparejar-figura'], ['figuras', 2, 'nombrar-figura'], ['figuras', 3, 'elegir-por-lados']]) {
    for (let run = 0; run < RUNS; run++) {
      const plain = selectLessonQuestions({ lesson: lessons[id], level, random: () => 0.99 });
      const plan = selectLessonQuestions({ lesson: lessons[id], level, preferTypes: [type] });
      const ofType = plan.questions.filter((q) => semanticTypeOf(q) === type).length;
      assert.ok(ofType >= 1, `${id} N${level}: incluye ${type}`);
      assert.ok(plan.questions.slice(0, 1).every((q) => semanticTypeOf(q) === type), `${id} N${level}: el refuerzo va primero`);
      assert.equal(new Set(sigs(plan.questions)).size, QUESTIONS_PER_ROUND, 'sigue con 6 distintas');
      assert.ok(plan.questions.some((q) => semanticTypeOf(q) !== type), 'no toda la ronda es del tipo reforzado');
      assert.ok(plan.questions.every((q) => q.level === level), 'respeta el nivel');
      assert.ok(plain.playable);
    }
  }
  // Sumas N2: el tipo fallado aparece al menos 2 veces (hay muchas restas distintas).
  const restas = selectLessonQuestions({ lesson: lessons['sumas-basicas'], level: 2, preferTypes: ['resolver-resta'] })
    .questions.filter((q) => semanticTypeOf(q) === 'resolver-resta').length;
  assert.ok(restas >= 2);
});

test('memoria adaptativa: se guarda por lección y no se pierde al combinar con la cuenta', () => {
  store.endSession();
  jugar('figuras', { stars: 1, failedTypes: ['nombrar-figura', 'nombrar-figura', 'contar-lados'] });
  const round = store.get().lessonRounds.figuras;
  assert.equal(round.lastSignatures.length, QUESTIONS_PER_ROUND);
  assert.deepEqual(round.weakTypes, ['nombrar-figura', 'contar-lados']);
  assert.equal(round.lowStreak, 1);
  const merged = mergeLessonProgress({ rounds: { figuras: round } }, { rounds: { figuras: { latestStars: 1, level: 1, at: '2099-01-01T00:00:00Z' } } });
  assert.deepEqual([merged.rounds.figuras.level, merged.rounds.figuras.weakTypes, merged.rounds.figuras.lowStreak], [1, ['nombrar-figura', 'contar-lados'], 1]);
  assert.equal(store.get().lessonRounds['patrones'], undefined, 'otras lecciones no cambian');
});

test('Game.jsx usa el motor: memoria en el plan, errores por tipo y R11 al cerrar', () => {
  const game = readFileSync(new URL('../src/views/Game.jsx', import.meta.url), 'utf8');
  assert.match(game, /if \(failedType\) mistakesByTypeRef\.current\[failedType\]/);
  assert.match(game, /weakTypes: weakTypesFrom\(mistakesByTypeRef\.current\)/);
  assert.match(game, /lastSignatures: questions\.map\(questionSignature\)/);
  assert.match(game, /levelResult\.lowered/);
  assert.match(game, /store\.addRewards\(\{ gems: stars \* 5, stars, xp: stars \* 50, levelStars: stars \}\)/, 'recompensas sin cambios');
});
