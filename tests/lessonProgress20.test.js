// Bloque 2B · Progreso académico de las 20 lecciones (Supabase simulado, datos ficticios).
// No se conecta a ningún proyecto real: el cliente y la tabla progreso_leccion son simulados.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLessonProgressService } from '../src/services/lessonProgressService.js';
import { academicStarsFor, starsForRound } from '../src/utils/stars.js';
import { levelAfterRound, mergeLessonProgress } from '../src/utils/lessonLevel.js';
import { isLessonCompleted, roundProgressTargets, getAreaRoute } from '../src/utils/areaProgress.js';
import { store } from '../src/state/store.js';

const LEGACY = ['conteo-basico', 'sumas-basicas', 'figuras', 'patrones'];
const NEW_LESSONS = {
  aritmetica: ['cuantos-quedan', 'grupos-iguales', 'repartimos-por-igual'],
  'geometria-patrones': ['la-mitad-del-espejo', 'una-vuelta-al-contorno', 'llenamos-el-mosaico'],
  algebra: ['escaleras-de-numeros', 'la-balanza-de-numu', 'el-numero-escondido', 'la-maquina-de-reglas', 'de-un-dibujo-a-una-regla'],
  trigonometria: ['gira-el-submarino', 'que-tan-abierta-esta-la-puerta', 'el-triangulo-de-la-escalera', 'cual-rampa-sube-mas', 'la-torre-y-su-sombra'],
};
const ALL_IDS = [...LEGACY, ...Object.values(NEW_LESSONS).flat()];
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Supabase simulado con una tabla progreso_leccion en memoria, RLS por usuario y operaciones
 * asíncronas (cada una espera un turno, para que dos guardados se intercalen como en la red).
 * rpc: 'none' (RPC no desplegado → respaldo del cliente) o 'atomic' (greatest en una sola sentencia).
 */
function memorySupabase({ rpc = 'none' } = {}) {
  const rows = new Map(); // `${usuario}|${leccion}` → { usuario_id, leccion_id, estrellas, intentos }
  const key = (u, l) => `${u}|${l}`;
  let currentUser = null;
  const visible = (row) => row.usuario_id === currentUser; // RLS: solo filas propias

  function query(op, payload, options) {
    const filters = [];
    const builder = {
      select() { return builder; },
      eq(column, value) { filters.push((r) => r[column] === value); return builder; },
      lt(column, value) { filters.push((r) => r[column] < value); return builder; },
      async maybeSingle() { await tick(); return { data: match()[0] ? { ...match()[0] } : null, error: null }; },
      then(resolve) { return run().then(resolve); },
    };
    const match = () => [...rows.values()].filter((r) => visible(r) && filters.every((f) => f(r)));
    async function run() {
      await tick();
      if (op === 'select') return { data: match().map((r) => ({ ...r })), error: null };
      if (op === 'update') { for (const r of match()) Object.assign(r, payload); return { data: null, error: null }; }
      if (op === 'upsert') {
        if (payload.usuario_id !== currentUser) return { data: null, error: { message: 'new row violates row-level security policy' } };
        const k = key(payload.usuario_id, payload.leccion_id);
        if (rows.has(k) && options?.ignoreDuplicates) return { data: null, error: null };
        rows.set(k, { ...rows.get(k), ...payload });
        return { data: null, error: null };
      }
      return { data: null, error: null };
    }
    return builder;
  }

  const client = {
    from: () => ({
      select: (...args) => query('select').select(...args),
      update: (payload) => query('update', payload),
      upsert: (payload, options) => query('upsert', payload, options),
    }),
    async rpc(_fn, { p_leccion_id: lessonId, p_estrellas: stars }) {
      await tick();
      if (rpc === 'none') return { data: null, error: { message: 'Could not find the function public.registrar_resultado_leccion' } };
      const k = key(currentUser, lessonId);
      const prev = rows.get(k);
      const row = { usuario_id: currentUser, leccion_id: lessonId, estrellas: Math.max(prev?.estrellas ?? 0, stars), intentos: (prev?.intentos ?? 0) + 1 };
      rows.set(k, row);
      return { data: { ...row }, error: null };
    },
  };
  const profiles = { currentUsuarioId: async () => (currentUser ? { usuarioId: currentUser, error: null } : { usuarioId: null, error: 'Sin sesión' }) };
  return {
    rows,
    as(usuarioId) { currentUser = usuarioId; return createLessonProgressService(() => client, profiles); },
  };
}

test('1 · alumno sin progreso previo: nada guardado, ninguna lección terminada', async () => {
  const db = memorySupabase();
  const progress = await db.as(1).getLessonProgress();
  assert.equal(progress.error, null);
  assert.deepEqual(progress.starsByLesson, {});
  assert.deepEqual(progress.completedLessonIds, []);
  assert.equal(progress.totalStars, 0);
});

test('2 · alumno con progreso en las cuatro lecciones antiguas (IDs conservados)', async () => {
  const db = memorySupabase({ rpc: 'atomic' });
  const service = db.as(1);
  for (const [id, stars] of [['conteo-basico', 3], ['sumas-basicas', 2], ['figuras', 3], ['patrones', 1]]) {
    await service.saveLessonResult({ lessonId: id, stars });
  }
  const progress = await service.getLessonProgress();
  assert.deepEqual(progress.starsByLesson, { 'conteo-basico': 3, 'sumas-basicas': 2, figuras: 3, patrones: 1 });
  assert.deepEqual(progress.completedLessonIds.sort(), ['conteo-basico', 'figuras']);
});

test('3 · lecciones nuevas de las cuatro áreas se guardan por lessonId sin module_id', async () => {
  for (const rpc of ['atomic', 'none']) {
    const db = memorySupabase({ rpc });
    const service = db.as(2);
    for (const id of ALL_IDS) {
      const result = await service.saveLessonResult({ lessonId: id, stars: id.length % 4 });
      assert.equal(result.error, null, `${rpc}: ${id}`);
    }
    const progress = await service.getLessonProgress();
    assert.equal(Object.keys(progress.starsByLesson).length, ALL_IDS.length, `${rpc}: 20 lecciones`);
    for (const id of ALL_IDS) assert.equal(progress.starsByLesson[id], id.length % 4, `${rpc}: ${id}`);
  }
});

test('4 · la mejor marca de 3 estrellas no disminuye (con RPC y sin RPC)', async () => {
  for (const rpc of ['atomic', 'none']) {
    const service = memorySupabase({ rpc }).as(3);
    await service.saveLessonResult({ lessonId: 'la-balanza-de-numu', stars: 3 });
    const lower = await service.saveLessonResult({ lessonId: 'la-balanza-de-numu', stars: 1 });
    assert.equal(lower.stars, 3, rpc);
    const progress = await service.getLessonProgress();
    assert.equal(progress.starsByLesson['la-balanza-de-numu'], 3, rpc);
    assert.ok(progress.completedLessonIds.includes('la-balanza-de-numu'), `${rpc}: sigue terminada`);
    assert.equal(progress.attemptsByLesson['la-balanza-de-numu'], 2, `${rpc}: cuenta los 2 intentos`);
  }
});

test('5 · ronda con vidas agotadas: guarda 0 académicas, conserva la mejor y las recompensas', async () => {
  const reward = starsForRound({ total: 6, mistakes: 1, approved: true }); // recargó y terminó
  const academic = academicStarsFor({ roundStars: reward, livesDepleted: true });
  assert.equal(reward, 3, 'recompensa sin cambios');
  assert.equal(academic, 0);
  for (const rpc of ['atomic', 'none']) {
    const service = memorySupabase({ rpc }).as(4);
    await service.saveLessonResult({ lessonId: 'gira-el-submarino', stars: 2 });
    const saved = await service.saveLessonResult({ lessonId: 'gira-el-submarino', stars: academic });
    assert.equal(saved.stars, 2, `${rpc}: la mejor anterior (2) se conserva`);
    assert.equal(saved.latestStars, 0);
    assert.equal(isLessonCompleted(saved.stars), false, `${rpc}: no acredita T2`);
  }
});

test('6 · al iniciar sesión en otro dispositivo se recupera el progreso sin que lo local lo pise', async () => {
  const db = memorySupabase({ rpc: 'atomic' });
  // Dispositivo 1 del alumno 5.
  await db.as(5).saveLessonResult({ lessonId: 'cuantos-quedan', stars: 3 });
  await db.as(5).saveLessonResult({ lessonId: 'escaleras-de-numeros', stars: 2 });
  // Dispositivo 2: sesión nueva (el store empieza vacío) con un progreso local menor.
  store.startSession('alumno-5-dispositivo-2');
  store.recordLessonRound({ lessonId: 'cuantos-quedan', stars: 1, level: 1 });
  const remote = await db.as(5).getLessonProgress();
  store.applyLessonProgress({ stars: remote.starsByLesson, rounds: remote.rounds });
  const state = store.get();
  assert.equal(state.lessonStars['cuantos-quedan'], 3, 'la mejor del servidor gana a la local menor');
  assert.equal(state.lessonStars['escaleras-de-numeros'], 2);
  assert.equal(isLessonCompleted(state.lessonStars['cuantos-quedan']), true, 'terminada en otro dispositivo sigue terminada');
  assert.equal(state.lessonRounds['cuantos-quedan'].latestStars, 1, 'la última ronda local más reciente no se pierde');
});

test('6b · una lectura antigua del servidor no reemplaza la última ronda local más reciente', () => {
  const merged = mergeLessonProgress(
    { stars: { 'la-torre-y-su-sombra': 2 }, rounds: { 'la-torre-y-su-sombra': { latestStars: 2, level: 2, at: '2026-11-27T10:00:00Z' } } },
    { stars: { 'la-torre-y-su-sombra': 3 }, rounds: { 'la-torre-y-su-sombra': { latestStars: 3, level: 1, at: '2026-11-26T10:00:00Z' } } },
  );
  assert.equal(merged.stars['la-torre-y-su-sombra'], 3, 'la mejor es la mayor');
  assert.deepEqual(merged.rounds['la-torre-y-su-sombra'], { latestStars: 2, level: 2, at: '2026-11-27T10:00:00Z' });
});

test('7 · aislamiento entre alumnos: cada uno ve y modifica solo su progreso', async () => {
  const db = memorySupabase({ rpc: 'none' });
  await db.as(10).saveLessonResult({ lessonId: 'figuras', stars: 3 });
  await db.as(11).saveLessonResult({ lessonId: 'figuras', stars: 1 });
  assert.deepEqual((await db.as(10).getLessonProgress()).starsByLesson, { figuras: 3 });
  assert.deepEqual((await db.as(11).getLessonProgress()).starsByLesson, { figuras: 1 });
  assert.equal(db.rows.get('10|figuras').estrellas, 3, 'el alumno 11 no tocó la fila del 10');
  // En el mismo dispositivo, cambiar de cuenta reinicia el progreso local.
  store.startSession('alumno-10');
  store.recordLessonRound({ lessonId: 'figuras', stars: 3, level: 2 });
  store.startSession('alumno-11');
  assert.deepEqual(store.get().lessonStars, {});
});

test('8 · aislamiento entre áreas: una lección nueva no registra el mapa ni el curso de otra área', () => {
  const algebra = { id: 'la-balanza-de-numu', course_id: 'algebra' };
  for (const storeModuleId of ['conteo', 'aritmetica', 'geometria', 'patrones', null]) {
    const t = roundProgressTargets({ lesson: algebra, areaId: 'algebra', storeModuleId, routeModuleId: storeModuleId });
    assert.equal(t.lessonId, 'la-balanza-de-numu');
    assert.equal(t.moduleId, null, 'no hereda store.module');
    assert.equal(t.recordsModuleProgress, false, 'no avanza el mapa de otra área');
    assert.equal(t.recordsCourseProgress, storeModuleId === null, `curso con store.module=${storeModuleId}`);
  }
  const trig = roundProgressTargets({ lesson: { id: 'gira-el-submarino', course_id: 'trigonometria' }, storeModuleId: 'geometria' });
  assert.equal(trig.recordsCourseProgress, false, 'Trigonometría no cuenta como Geometría');
  const sameArea = roundProgressTargets({ lesson: { id: 'cuantos-quedan', course_id: 'aritmetica' }, storeModuleId: 'conteo' });
  assert.deepEqual([sameArea.recordsModuleProgress, sameArea.recordsCourseProgress], [false, true], 'misma área: curso sí, mapa no');
  // Las 4 antiguas siguen igual que antes.
  for (const [id, module] of [['conteo-basico', 'conteo'], ['sumas-basicas', 'aritmetica'], ['figuras', 'geometria'], ['patrones', 'patrones']]) {
    const legacy = roundProgressTargets({ lesson: { id, module_id: module }, storeModuleId: 'conteo' });
    assert.deepEqual(legacy, { lessonId: id, moduleId: module, recordsModuleProgress: true, recordsCourseProgress: true });
  }
  assert.equal(roundProgressTargets({ routeModuleId: 'sumas' }).moduleId, 'aritmetica', '/jugar/:modulo como antes');
});

test('8b · guardar una lección no cambia las demás', async () => {
  const service = memorySupabase({ rpc: 'atomic' }).as(12);
  await service.saveLessonResult({ lessonId: 'conteo-basico', stars: 3 });
  await service.saveLessonResult({ lessonId: 'cuantos-quedan', stars: 1 });
  const { starsByLesson } = await service.getLessonProgress();
  assert.deepEqual(starsByLesson, { 'conteo-basico': 3, 'cuantos-quedan': 1 });
});

test('9 · guardados simultáneos (sin RPC) nunca reducen la mejor marca', async () => {
  for (const order of [[3, 1], [1, 3], [3, 0], [0, 3], [2, 3, 1]]) {
    const db = memorySupabase({ rpc: 'none' });
    const service = db.as(20);
    await Promise.all(order.map((stars) => service.saveLessonResult({ lessonId: 'el-numero-escondido', stars })));
    assert.equal(db.rows.get('20|el-numero-escondido').estrellas, Math.max(...order), `orden ${order}`);
  }
  // Con fila previa de 3 y dos guardados menores a la vez.
  const db = memorySupabase({ rpc: 'none' });
  const service = db.as(21);
  await service.saveLessonResult({ lessonId: 'cual-rampa-sube-mas', stars: 3 });
  await Promise.all([1, 2].map((stars) => service.saveLessonResult({ lessonId: 'cual-rampa-sube-mas', stars })));
  assert.equal(db.rows.get('21|cual-rampa-sube-mas').estrellas, 3);
});

test('10 · T2 y R7–R10 con el progreso recuperado', async () => {
  const service = memorySupabase({ rpc: 'atomic' }).as(30);
  const catalog = { courses: [{ id: 'algebra', title: 'Álgebra', lessons: NEW_LESSONS.algebra.map((id, i) => ({ id, position: i + 1, title: id })) }] };
  for (const id of NEW_LESSONS.algebra) await service.saveLessonResult({ lessonId: id, stars: 3 });
  await service.saveLessonResult({ lessonId: 'la-maquina-de-reglas', stars: 1 }); // peor después: sigue terminada
  const { starsByLesson } = await service.getLessonProgress();
  const route = getAreaRoute({ catalog, areaId: 'algebra', starsByLesson });
  assert.equal(route.completed, 5);
  assert.equal(route.isCompleted, true, 'R16: las 5 lecciones con T2');
  // R7–R10 no cambian.
  assert.deepEqual(levelAfterRound({ level: 1, stars: 3 }), { level: 2, advanced: true, rule: 'R7' });
  assert.deepEqual(levelAfterRound({ level: 2, stars: 2 }), { level: 2, advanced: false, rule: 'R8' });
  assert.deepEqual(levelAfterRound({ level: 2, stars: 1 }), { level: 2, advanced: false, rule: 'R9' });
  assert.deepEqual(levelAfterRound({ level: 2, stars: 3, livesDepleted: true }), { level: 2, advanced: false, rule: 'R10' });
});

test('Game.jsx usa roundProgressTargets y ya no hereda store.module para lecciones sin module_id', async () => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('../src/views/Game.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /lesson\.module_id \?\? normalizeModuleId/);
  assert.match(source, /roundProgressTargets\(\{/);
  assert.match(source, /if \(progressTargets\.recordsModuleProgress\) store\.recordModuleRound/);
  assert.match(source, /if \(progressTargets\.recordsCourseProgress\) \{\s*recordRound/);
  assert.match(source, /store\.addRewards\(\{ gems: stars \* 5, stars, xp: stars \* 50, levelStars: stars \}\)/, 'recompensas intactas');
});
