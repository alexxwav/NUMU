// Pruebas unitarias del progreso por lección (estrellas de 1 a 3) con un cliente
// de Supabase simulado. No se conectan a ningún proyecto real. Ejecutar con: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLessonProgressService } from '../src/services/lessonProgressService.js';
import { starsForRound, sumStars, clampStars } from '../src/utils/stars.js';
import { store } from '../src/state/store.js';

// Simula el query builder encadenable de supabase-js y registra cada llamada.
function fakeClient({ rpc = { data: null, error: null }, tables = {} } = {}) {
  const calls = [];
  const builderFor = (result) => {
    const builder = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'then') return (resolve) => resolve(result);
        return (...args) => { calls.push([prop, ...args]); return builder; };
      },
    });
    return builder;
  };
  return {
    calls,
    from: (table) => { calls.push(['from', table]); return builderFor(tables[table] ?? { data: null, error: null }); },
    rpc: async (fn, args) => { calls.push(['rpc', fn, args]); return rpc; },
  };
}

const profiles = { currentUsuarioId: async () => ({ usuarioId: 7, error: null }) };

test('starsForRound reparte de 1 a 3 estrellas según los errores', () => {
  assert.equal(starsForRound({ total: 6, mistakes: 0 }), 3);
  assert.equal(starsForRound({ total: 6, mistakes: 1 }), 3);
  assert.equal(starsForRound({ total: 6, mistakes: 2 }), 2);
  assert.equal(starsForRound({ total: 6, mistakes: 3 }), 2);
  assert.equal(starsForRound({ total: 6, mistakes: 4 }), 1);
  assert.equal(starsForRound({ total: 6, mistakes: 5 }), 1);
});

test('starsForRound da 0 estrellas si la ronda no se aprobó', () => {
  assert.equal(starsForRound({ total: 6, mistakes: 1, approved: false }), 0);
  assert.equal(starsForRound({ total: 6, mistakes: 6 }), 0);
  assert.equal(starsForRound({ total: 0, mistakes: 0 }), 0);
  assert.equal(starsForRound(), 0);
});

test('sumStars y clampStars respetan el rango de 0 a 3', () => {
  assert.equal(sumStars({ 'conteo-basico': 3, figuras: 2 }), 5);
  assert.equal(sumStars({ 'conteo-basico': 9 }), 3);
  assert.equal(sumStars({}), 0);
  assert.equal(sumStars(null), 0);
  assert.equal(clampStars(7), 3);
  assert.equal(clampStars(-2), 0);
  assert.equal(clampStars('2'), 2);
});

test('el store conserva la mejor puntuación de cada lección', () => {
  store.setLessonStars('conteo-basico', 2);
  store.setLessonStars('conteo-basico', 1);
  store.setLessonStars('figuras', 3);
  assert.equal(store.get().lessonStars['conteo-basico'], 2);
  assert.equal(store.get().lessonStars.figuras, 3);
});

test('getLessonProgress devuelve las estrellas por lección y su suma', async () => {
  const client = fakeClient({ tables: { progreso_leccion: { data: [
    { leccion_id: 'conteo-basico', estrellas: 3 },
    { leccion_id: 'figuras', estrellas: 2 },
  ], error: null } } });
  const res = await createLessonProgressService(() => client, profiles).getLessonProgress();
  assert.equal(res.error, null);
  assert.deepEqual(res.starsByLesson, { 'conteo-basico': 3, figuras: 2 });
  assert.equal(res.totalStars, 5);
  assert.ok(client.calls.some((c) => c[0] === 'from' && c[1] === 'progreso_leccion'));
});

test('getLessonProgress avisa si no hay usuario con sesión', async () => {
  const client = fakeClient();
  const sinUsuario = { currentUsuarioId: async () => ({ usuarioId: null, error: 'No se encontró el usuario de esta cuenta.' }) };
  const res = await createLessonProgressService(() => client, sinUsuario).getLessonProgress();
  assert.match(res.error, /No se encontró el usuario/);
  assert.deepEqual(res.starsByLesson, {});
});

test('saveLessonResult valida la lección y las estrellas antes de escribir', async () => {
  const client = fakeClient();
  const svc = createLessonProgressService(() => client, profiles);
  assert.match((await svc.saveLessonResult({ lessonId: '', stars: 3 })).error, /lección/);
  assert.match((await svc.saveLessonResult({ lessonId: 'conteo-basico', stars: 4 })).error, /entre 0 y 3/);
  assert.match((await svc.saveLessonResult({ lessonId: 'conteo-basico', stars: 1.5 })).error, /entre 0 y 3/);
  assert.equal(client.calls.length, 0);
});

test('saveLessonResult usa el RPC y devuelve las estrellas guardadas', async () => {
  const client = fakeClient({ rpc: { data: { leccion_id: 'conteo-basico', estrellas: 3 }, error: null } });
  const res = await createLessonProgressService(() => client, profiles)
    .saveLessonResult({ lessonId: 'conteo-basico', stars: 2 });
  assert.equal(res.error, null);
  assert.equal(res.stars, 3);
  assert.deepEqual(client.calls.find((c) => c[0] === 'rpc'), ['rpc', 'registrar_resultado_leccion', { p_leccion_id: 'conteo-basico', p_estrellas: 2 }]);
});

test('saveLessonResult cae al upsert y conserva la mejor puntuación si el RPC no existe', async () => {
  const client = fakeClient({
    rpc: { data: null, error: { message: 'Could not find the function public.registrar_resultado_leccion in the schema cache' } },
    tables: { progreso_leccion: { data: { estrellas: 3, intentos: 1 }, error: null } },
  });
  const res = await createLessonProgressService(() => client, profiles)
    .saveLessonResult({ lessonId: 'conteo-basico', stars: 1 });
  assert.equal(res.error, null);
  assert.equal(res.stars, 3);
  const upsert = client.calls.find((c) => c[0] === 'upsert');
  assert.deepEqual(upsert, ['upsert', { usuario_id: 7, leccion_id: 'conteo-basico', estrellas: 3, intentos: 2 }, { onConflict: 'usuario_id,leccion_id' }]);
});

test('saveLessonResult propaga otros errores del RPC', async () => {
  const client = fakeClient({ rpc: { data: null, error: { message: 'new row violates row-level security policy' } } });
  const res = await createLessonProgressService(() => client, profiles)
    .saveLessonResult({ lessonId: 'conteo-basico', stars: 3 });
  assert.match(res.error, /row-level security/);
  assert.equal(client.calls.some((c) => c[0] === 'upsert'), false);
});
