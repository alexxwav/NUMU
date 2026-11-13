// Pruebas del nivel académico por lección (R1–R3, R7–R10), de la dificultad de cada ronda,
// de la mejor/última puntuación y de su integración con el recomendador.
// No se conectan a Supabase: usan un cliente simulado y un localStorage en memoria.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// localStorage en memoria ANTES de cargar el store, para probar la persistencia al recargar.
const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
};

const { store } = await import('../src/state/store.js');
const {
  levelAfterRound, lessonLevelFor, lessonLevelFromState, mergeLessonProgress, startingLessonLevel,
  lessonForModule, MAX_LESSON_LEVEL,
} = await import('../src/utils/lessonLevel.js');
const { buildLessonRound, fitsLevelOne, QUESTIONS_PER_ROUND } = await import('../src/utils/lessonRound.js');
const { starsForRound, hasFinishedRound } = await import('../src/utils/stars.js');
const { buildRecommendations, RECOMMENDATION_TYPES: T } = await import('../src/services/recommendationService.js');
const { createLessonProgressService } = await import('../src/services/lessonProgressService.js');

const catalog = JSON.parse(readFileSync(new URL('../src/data/lessonContent.json', import.meta.url), 'utf8'));
const lesson = (id) => catalog.courses.flatMap((c) => c.lessons).find((l) => l.id === id);
const fresh = () => store.endSession();

// Lee los datos de una pregunta generada (questions.js) a partir de su texto.
const operands = (q) => q.prompt.match(/(\d+) ([+−]) (\d+)/).slice(1);
const colorsInSequence = (q) => new Set([...q.visual.matchAll(/background:(#[0-9A-Fa-f]{6})/g)].map((m) => m[1])).size;
const countShown = (q) => Number(q.visual.match(/aria-label="(\d+) /)[1]);
const many = (lessonId, level, rounds = 40) =>
  Array.from({ length: rounds }, () => buildLessonRound({ lesson: lesson(lessonId), level })).flat();

/* ---------- 1. Un estudiante con niveles distintos en cada lección ---------- */

test('1. el mismo estudiante puede estar en nivel 3 en Sumas y en nivel 1 en Figuras', () => {
  fresh();
  store.recordLessonRound({ lessonId: 'sumas-basicas', stars: 3, level: 3 });
  store.recordLessonRound({ lessonId: 'figuras', stars: 2, level: 1 });
  const state = store.get();
  assert.equal(lessonLevelFromState(state, 'sumas-basicas'), 3);
  assert.equal(lessonLevelFromState(state, 'figuras'), 1);
  // El nivel general (gamificación) no se toca.
  assert.equal(state.level, 1);

  // Sumas nivel 3: generador con números hasta 6 y restas (R12).
  const sums = many('sumas-basicas', 3);
  assert.ok(sums.every((q) => q.source === 'generador' && q.level === 3));
  assert.ok(sums.every((q) => Math.max(Number(operands(q)[0]), Number(operands(q)[2])) <= 6));
  assert.ok(sums.some((q) => operands(q)[1] === '−'), 'en nivel 3 aparecen restas');
  assert.ok(sums.some((q) => Math.max(Number(operands(q)[0]), Number(operands(q)[2])) > 4), 'números mayores que en nivel 1');

  // Figuras nivel 1: sin hexágono (R13) y con los ejercicios de Viviana que caben en el nivel.
  const shapes = many('figuras', 1);
  assert.ok(shapes.every((q) => q.level === 1));
  assert.ok(shapes.filter((q) => q.source === 'generador').every((q) => !/hexágono/.test(q.prompt)));
  assert.equal(buildLessonRound({ lesson: lesson('figuras'), level: 1 }).filter((q) => q.source === 'catalogo').length, 5);
});

test('1b. la dificultad cambia de verdad con el nivel de la lección', () => {
  // Nivel 1: solo ejercicios del catálogo que respetan los límites del nivel 1, completados con el generador.
  const curated = (id) => lesson(id).exercises.filter(fitsLevelOne).length;
  assert.deepEqual(
    ['conteo-basico', 'sumas-basicas', 'figuras', 'patrones'].map(curated),
    [4, 4, 5, 6],
  );
  for (const id of ['conteo-basico', 'sumas-basicas', 'figuras', 'patrones']) {
    const round = buildLessonRound({ lesson: lesson(id), level: 1 });
    assert.equal(round.length, QUESTIONS_PER_ROUND);
    assert.ok(round.every((q) => q.prompt && Array.isArray(q.options) && Number.isInteger(q.answerIndex)));
  }
  // Patrones: los 6 ejercicios de Viviana caben en el nivel 1, así que la ronda es toda del catálogo.
  const fromCatalog = buildLessonRound({ lesson: lesson('patrones'), level: 1 });
  assert.ok(fromCatalog.every((q) => q.source === 'catalogo'));

  // Conteo: nivel 1 hasta 5 objetos; nivel 3 hasta 7.
  assert.ok(many('conteo-basico', 1).filter((q) => q.source === 'generador').every((q) => countShown(q) <= 5));
  assert.ok(many('conteo-basico', 3).some((q) => countShown(q) > 5));
  // Sumas nivel 1: sin restas y números hasta 4.
  assert.ok(many('sumas-basicas', 1).filter((q) => q.source === 'generador')
    .every((q) => operands(q)[1] === '+' && Number(operands(q)[0]) <= 4 && Number(operands(q)[2]) <= 4));
  // Figuras: el hexágono aparece desde el nivel 2 (R13).
  assert.ok(many('figuras', 2).some((q) => /hexágono/.test(q.prompt)));
  // Patrones: 2 colores en niveles 1 y 2; 3 colores en nivel 3 (R14).
  assert.ok(many('patrones', 2).every((q) => colorsInSequence(q) === 2));
  assert.ok(many('patrones', 3).every((q) => colorsInSequence(q) === 3));
});

/* ---------- 2–5. R7–R10 ---------- */

const play = (level, mistakes, { livesDepleted = false } = {}) =>
  levelAfterRound({ level, stars: starsForRound({ total: 6, mistakes, approved: true }), livesDepleted });

test('2. R7: con 0 o 1 errores (3 estrellas) la lección sube un nivel, hasta el máximo', () => {
  assert.deepEqual(play(1, 0), { level: 2, advanced: true, rule: 'R7' });
  assert.deepEqual(play(2, 1), { level: 3, advanced: true, rule: 'R7' });
  assert.deepEqual(play(MAX_LESSON_LEVEL, 0), { level: MAX_LESSON_LEVEL, advanced: false, rule: 'R7' });
});

test('3. R8: con 2 o 3 errores (2 estrellas) se conserva el nivel', () => {
  assert.deepEqual(play(2, 2), { level: 2, advanced: false, rule: 'R8' });
  assert.deepEqual(play(1, 3), { level: 1, advanced: false, rule: 'R8' });
});

test('4. R9: con 4 o más errores (1 estrella) se conserva el nivel y se recomienda refuerzo', () => {
  assert.deepEqual(play(3, 4), { level: 3, advanced: false, rule: 'R9' });
  const rec = buildRecommendations({
    catalog,
    lastRound: { lessonId: 'figuras', stars: 1, approved: true, levelBefore: 2, levelAfter: 2 },
  }).recommendations[0];
  assert.equal(rec.type, T.REFORZAR);
  assert.equal(rec.lessonId, 'figuras');
  assert.equal(rec.level, 2);
  assert.match(rec.reason, /nivel 2/);
});

test('5. R10: si se acaban las vidas no hay avance académico, aunque se recarguen y se termine la ronda', () => {
  // Sin recargar: ronda no aprobada (0 estrellas).
  assert.deepEqual(levelAfterRound({ level: 1, stars: 0 }), { level: 1, advanced: false, rule: 'R10' });
  // Recargando: las estrellas de la ronda no cambian (premios igual que antes) pero el nivel no sube.
  assert.deepEqual(levelAfterRound({ level: 2, stars: 3, livesDepleted: true }), { level: 2, advanced: false, rule: 'R10' });
  const rec = buildRecommendations({
    catalog,
    lastRound: { lessonId: 'conteo-basico', stars: 1, approved: false, levelBefore: 2, levelAfter: 2 },
  }).recommendations[0];
  assert.equal(rec.type, T.REFORZAR);
  assert.ok(rec.rules.includes('R10'));
  assert.match(rec.reason, /nivel 2/);
});

/* ---------- 6. Mejor y última puntuación ---------- */

test('6. 3 estrellas y luego 1: la mejor sigue en 3, la última es 1 y se recomienda reforzar', () => {
  fresh();
  store.recordLessonRound({ lessonId: 'conteo-basico', stars: 3, level: 2, at: '2026-11-10T10:00:00Z' });
  store.recordLessonRound({ lessonId: 'conteo-basico', stars: 1, level: 2, at: '2026-11-11T10:00:00Z' });
  const state = store.get();
  assert.equal(state.lessonStars['conteo-basico'], 3);
  assert.deepEqual(state.lessonRounds['conteo-basico'], { latestStars: 1, level: 2, at: '2026-11-11T10:00:00Z' });

  const rec = buildRecommendations({
    catalog,
    starsByLesson: state.lessonStars,
    latestStarsByLesson: { 'conteo-basico': 1 },
    levelByLesson: { 'conteo-basico': 2 },
  }).recommendations[0];
  assert.equal(rec.type, T.REFORZAR);
  assert.equal(rec.lessonId, 'conteo-basico');
  assert.equal(rec.bestStars, 3);
  assert.equal(rec.latestStars, 1);
  assert.match(rec.reason, /mejor marca sigue siendo de 3/);
});

test('6b. tras subir de nivel (C10) se recomienda la misma lección en su nuevo nivel; en el máximo, la siguiente', () => {
  const justNow = buildRecommendations({
    catalog,
    lastRound: { lessonId: 'conteo-basico', stars: 3, approved: true, levelBefore: 1, levelAfter: 2 },
  }).recommendations[0];
  assert.equal(justNow.type, T.AVANZAR);
  assert.equal(justNow.lessonId, 'conteo-basico');
  assert.deepEqual(justNow.rules, ['R7', 'C1', 'C10']);
  assert.equal(justNow.level, 2);

  const atHome = buildRecommendations({
    catalog,
    starsByLesson: { 'conteo-basico': 3 },
    latestStarsByLesson: { 'conteo-basico': 3 },
    levelByLesson: { 'conteo-basico': 2 },
  }).recommendations[0];
  assert.equal(atHome.lessonId, 'conteo-basico');
  assert.ok(atHome.rules.includes('C10'));

  const atMax = buildRecommendations({
    catalog,
    lastRound: { lessonId: 'conteo-basico', stars: 3, approved: true, levelBefore: 3, levelAfter: 3 },
  }).recommendations[0];
  assert.equal(atMax.type, T.AVANZAR);
  assert.equal(atMax.lessonId, 'sumas-basicas');
  assert.ok(atMax.rules.includes('C4'));
});

/* ---------- 7. Dos estudiantes ---------- */

test('7. dos estudiantes con datos distintos reciben recomendaciones y niveles distintos', () => {
  const ana = buildRecommendations({
    catalog, interests: ['aritmetica'], diagnosticScore: 5,
    starsByLesson: { 'conteo-basico': 2 }, latestStarsByLesson: { 'conteo-basico': 2 }, levelByLesson: { 'conteo-basico': 3 },
  });
  const beto = buildRecommendations({ catalog, interests: ['geometria'], diagnosticScore: 0 });
  assert.notDeepEqual(ana.recommendations.map((r) => r.lessonId), beto.recommendations.map((r) => r.lessonId));
  assert.equal(ana.recommendations[0].lessonId, 'conteo-basico');
  assert.equal(ana.recommendations[0].level, 3);
  assert.equal(beto.recommendations[0].lessonId, 'figuras');
  assert.equal(beto.recommendations[0].level, 1);
  assert.match(beto.recommendations[0].reason, /nivel 1 de esta lección/);
  // Sin progreso, cada lección empieza en el nivel del diagnóstico (R1–R3).
  assert.equal(lessonLevelFor({ lessonId: 'figuras', diagnosticScore: 5 }), 3);
  assert.equal(lessonLevelFor({ lessonId: 'figuras', diagnosticScore: 2 }), 2);
  assert.equal(startingLessonLevel(null), 1);
});

/* ---------- 8. Persistencia ---------- */

test('8. el nivel de cada lección persiste al recargar la página', async () => {
  fresh();
  store.startSession('auth-ana');
  store.recordLessonRound({ lessonId: 'patrones', stars: 3, level: 3 });
  const { store: reloaded } = await import(`../src/state/store.js?recarga=${Date.now()}`);
  assert.equal(reloaded.get().userId, 'auth-ana');
  assert.equal(reloaded.get().lessonRounds.patrones.level, 3);
  assert.equal(lessonLevelFromState(reloaded.get(), 'patrones'), 3);
  // Otra cuenta en el mismo dispositivo empieza de cero (no hereda niveles).
  reloaded.startSession('auth-beto');
  assert.deepEqual(reloaded.get().lessonRounds, {});
});

// Cliente simulado: cada select puede responder distinto (para probar columnas faltantes).
function sequenceClient({ selects = [], rpcs = [] } = {}) {
  const calls = [];
  const next = (list) => list.shift() ?? { data: null, error: null };
  const builder = (columns) => {
    const result = next(selects);
    const chain = { eq: () => chain, then: (resolve) => resolve(result) };
    calls.push(['select', columns]);
    return chain;
  };
  return {
    calls,
    from: () => ({ select: builder }),
    rpc: async (fn, args) => { calls.push(['rpc', fn, args]); return next(rpcs); },
  };
}
const profiles = { currentUsuarioId: async () => ({ usuarioId: 7, error: null }) };

test('8b. el servicio lee y guarda el nivel de cada lección (otra sesión u otro dispositivo)', async () => {
  const client = sequenceClient({
    selects: [{
      data: [
        { leccion_id: 'sumas-basicas', estrellas: 3, intentos: 4, ultimas_estrellas: 2, nivel: 3, ultimo_intento: '2026-11-12T09:00:00Z' },
        { leccion_id: 'figuras', estrellas: 2, intentos: 1, ultimas_estrellas: null, nivel: null, ultimo_intento: null },
      ],
      error: null,
    }],
    rpcs: [{ data: { estrellas: 3, nivel: 2 }, error: null }],
  });
  const service = createLessonProgressService(() => client, profiles);
  const progress = await service.getLessonProgress();
  assert.deepEqual(progress.starsByLesson, { 'sumas-basicas': 3, figuras: 2 });
  assert.deepEqual(progress.latestStarsByLesson, { 'sumas-basicas': 2 });
  assert.deepEqual(progress.levelByLesson, { 'sumas-basicas': 3 });
  assert.deepEqual(progress.attemptsByLesson, { 'sumas-basicas': 4, figuras: 1 });
  assert.deepEqual(progress.rounds, { 'sumas-basicas': { latestStars: 2, level: 3, at: '2026-11-12T09:00:00Z' } });

  const saved = await service.saveLessonResult({ lessonId: 'conteo-basico', stars: 3, level: 2 });
  assert.deepEqual(client.calls.at(-1), ['rpc', 'registrar_resultado_leccion', { p_leccion_id: 'conteo-basico', p_estrellas: 3, p_nivel: 2 }]);
  assert.deepEqual(saved, { stars: 3, latestStars: 3, level: 2, error: null });
  assert.match((await service.saveLessonResult({ lessonId: 'conteo-basico', stars: 3, level: 4 })).error, /nivel/);
});

/* ---------- 9. Lecturas antiguas ---------- */

test('9. una lectura antigua de Supabase no sobrescribe la ronda más reciente del dispositivo', () => {
  fresh();
  store.recordLessonRound({ lessonId: 'figuras', stars: 3, level: 2, at: '2026-11-13T10:00:00Z' });
  // Lectura que salió antes de guardar la ronda: mejor 1, nivel 1, de ayer.
  store.applyLessonProgress({
    stars: { figuras: 1, patrones: 2 },
    rounds: { figuras: { latestStars: 1, level: 1, at: '2026-11-12T10:00:00Z' } },
  });
  const state = store.get();
  assert.equal(state.lessonStars.figuras, 3);
  assert.deepEqual(state.lessonRounds.figuras, { latestStars: 3, level: 2, at: '2026-11-13T10:00:00Z' });
  assert.equal(state.lessonStars.patrones, 2, 'lo que solo está en la base se incorpora');

  // Una ronda más nueva jugada en otro dispositivo sí gana.
  store.applyLessonProgress({ rounds: { figuras: { latestStars: 2, level: 3, at: '2026-11-13T12:00:00Z' } } });
  assert.equal(store.get().lessonRounds.figuras.level, 3);
  assert.equal(store.get().lessonStars.figuras, 3, 'la mejor nunca baja');
});

/* ---------- 10. Compatibilidad ---------- */

test('10. compatibilidad: datos históricos sin última ronda ni nivel y base sin migrar', async () => {
  // Filas viejas (columnas en null) no borran nada ni inventan nivel.
  const merged = mergeLessonProgress(
    { stars: { figuras: 2 }, rounds: { figuras: { latestStars: 2, level: 2, at: '2026-11-01T00:00:00Z' } } },
    { stars: { figuras: 3 }, rounds: { figuras: { latestStars: null, level: null, at: null } } },
  );
  assert.deepEqual(merged, { stars: { figuras: 3 }, rounds: { figuras: { latestStars: 2, level: 2, at: '2026-11-01T00:00:00Z' } } });

  // Estado guardado antes de esta versión (sin lessonRounds): el nivel sale del diagnóstico.
  const legacy = { lessonStars: { figuras: 3 }, profile: { completed: true, score: 3 } };
  assert.equal(lessonLevelFromState(legacy, 'figuras'), 2);

  // Base sin la migración: columnas nuevas inexistentes → se leen las de siempre.
  const client = sequenceClient({
    selects: [
      { data: null, error: { message: 'column progreso_leccion.ultimas_estrellas does not exist' } },
      { data: [{ leccion_id: 'figuras', estrellas: 2, intentos: 3 }], error: null },
    ],
    rpcs: [
      { data: null, error: { message: 'Could not find the function public.registrar_resultado_leccion(p_estrellas, p_leccion_id, p_nivel) in the schema cache' } },
      { data: { estrellas: 2 }, error: null },
    ],
  });
  const service = createLessonProgressService(() => client, profiles);
  const progress = await service.getLessonProgress();
  assert.deepEqual(progress.starsByLesson, { figuras: 2 });
  assert.deepEqual(progress.levelByLesson, {});
  assert.deepEqual(client.calls.slice(0, 2).map((c) => c[1]), [
    'leccion_id, estrellas, intentos, ultimas_estrellas, nivel, ultimo_intento',
    'leccion_id, estrellas, intentos',
  ]);
  // RPC sin p_nivel (firma de César): se reintenta con la llamada de dos parámetros.
  const saved = await service.saveLessonResult({ lessonId: 'figuras', stars: 1, level: 2 });
  assert.equal(saved.error, null);
  assert.deepEqual(client.calls.at(-1), ['rpc', 'registrar_resultado_leccion', { p_leccion_id: 'figuras', p_estrellas: 1 }]);

  // /jugar/:modulo usa la lección de ese módulo (con su nivel).
  assert.equal(lessonForModule(catalog, 'sumas').lesson.id, 'sumas-basicas');
  assert.equal(lessonForModule(catalog, 'formas').lesson.id, 'figuras');
});

/* ---------- 11. Logros y gamificación ---------- */

test('11. «Primera lección» depende de una ronda terminada, no del nivel general', () => {
  fresh();
  assert.equal(hasFinishedRound(store.get()), false);
  assert.equal(hasFinishedRound({ ...store.get(), level: 4 }), false, 'subir de nivel general no basta');
  store.recordLessonRound({ lessonId: 'figuras', stars: 1, level: 1 });
  assert.equal(hasFinishedRound(store.get()), true);
  // Datos históricos de antes del progreso por lección.
  assert.equal(hasFinishedRound({ starsByLevel: { 1: 2 } }), true);
});

test('11b. premios, vidas y nivel general siguen igual; el nivel de lección es independiente', () => {
  fresh();
  const stars = starsForRound({ total: 6, mistakes: 0 });
  store.addRewards({ gems: stars * 5, stars, xp: stars * 10, levelStars: stars });
  store.completeLevel();
  store.recordLessonRound({ lessonId: 'conteo-basico', stars, level: levelAfterRound({ level: 1, stars }).level });
  const state = store.get();
  assert.deepEqual([state.gems, state.stars, state.xp, state.level], [15, 3, 30, 2]);
  assert.equal(state.lives, 5);
  assert.equal(state.lessonRounds['conteo-basico'].level, 2);
  assert.equal(lessonLevelFromState(state, 'sumas-basicas'), 1, 'otras lecciones no cambian');
});
