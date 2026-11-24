// Pruebas del progreso del mapa por sección, con cliente de Supabase simulado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createModuleProgressService } from '../src/services/moduleProgressService.js';
import { store } from '../src/state/store.js';

function fakeClient({ tables = {} } = {}) {
  const calls = [];
  const builderFor = (result) => new Proxy({}, {
    get(_t, prop) {
      if (prop === 'then') return (resolve) => resolve(result);
      return (...args) => { calls.push([prop, ...args]); return builderFor(result); };
    },
  });
  return {
    calls,
    from: (table) => { calls.push(['from', table]); return builderFor(tables[table] ?? { data: null, error: null }); },
  };
}

const profiles = { currentUsuarioId: async () => ({ usuarioId: 7, error: null }) };

test('recordModuleRound avanza solo la sección jugada y guarda estrellas por parada', () => {
  store.startSession('module-progress-test');
  store.recordModuleRound({ moduleId: 'conteo', stars: 2, level: 1 });
  const state = store.get();
  assert.equal(state.levelByModule.conteo, 2);
  assert.deepEqual(state.starsByModuleLevel.conteo, { 1: 2 });
  assert.equal(state.levelByModule.geometria, undefined);

  // Repetir una parada completada no adelanta la posición, pero mejora estrellas.
  store.recordModuleRound({ moduleId: 'conteo', stars: 3, level: 1 });
  assert.equal(store.get().levelByModule.conteo, 2);
  assert.equal(store.get().starsByModuleLevel.conteo[1], 3);
});

test('applyModuleProgress conserva el mayor nivel y las mejores estrellas', () => {
  store.startSession('module-progress-merge-test');
  store.recordModuleRound({ moduleId: 'patrones', stars: 3, level: 1 });
  store.applyModuleProgress({
    levelByModule: { patrones: 4, conteo: 2 },
    starsByModuleLevel: { patrones: { 1: 1, 3: 2 }, conteo: { 1: 3 } },
  });
  const state = store.get();
  assert.equal(state.levelByModule.patrones, 4);
  assert.equal(state.levelByModule.conteo, 2);
  assert.equal(state.starsByModuleLevel.patrones[1], 3);
  assert.equal(state.starsByModuleLevel.patrones[3], 2);
  assert.equal(state.starsByModuleLevel.conteo[1], 3);
});

test('getModuleProgress lee current_level y stars_by_level por módulo', async () => {
  const client = fakeClient({ tables: { user_module_progress: { data: [
    { module_id: 'conteo', current_level: 3, stars_by_level: { 1: 3, 2: 2 } },
    { module_id: 'patrones', current_level: 2, stars_by_level: { '1': 1 } },
    { module_id: 'sumas', current_level: 5, stars_by_level: {} }, // alias se normaliza
  ], error: null } } });
  const res = await createModuleProgressService(() => client, profiles).getModuleProgress();
  assert.equal(res.error, null);
  assert.deepEqual(res.levelByModule, { conteo: 3, patrones: 2, aritmetica: 5 });
  assert.deepEqual(res.starsByModuleLevel.conteo, { 1: 3, 2: 2 });
  assert.ok(client.calls.some((c) => c[0] === 'from' && c[1] === 'user_module_progress'));
});

test('saveModuleRound valida módulo, estrellas y parada antes de escribir', async () => {
  const client = fakeClient();
  const svc = createModuleProgressService(() => client, profiles);
  assert.match((await svc.saveModuleRound({ moduleId: 'otro', stars: 2, level: 1 })).error, /module_id/);
  assert.match((await svc.saveModuleRound({ moduleId: 'conteo', stars: 4, level: 1 })).error, /estrellas/);
  assert.match((await svc.saveModuleRound({ moduleId: 'conteo', stars: 2 })).error, /parada/);
  assert.equal(client.calls.length, 0);
});

test('saveModuleRound guarda la parada siguiente y conserva la mejor estrella de la parada', async () => {
  const client = fakeClient({ tables: { user_module_progress: {
    data: { current_level: 2, stars_by_level: { 1: 1 } }, error: null,
  } } });
  const res = await createModuleProgressService(() => client, profiles)
    .saveModuleRound({ moduleId: 'geometria', stars: 3, level: 2 });
  assert.equal(res.error, null);
  assert.equal(res.currentLevel, 3);
  assert.deepEqual(res.starsByLevel, { 1: 1, 2: 3 });
  assert.deepEqual(client.calls.find((c) => c[0] === 'upsert'), ['upsert', {
    usuario_id: 7,
    module_id: 'geometria',
    current_level: 3,
    stars_by_level: { 1: 1, 2: 3 },
  }, { onConflict: 'usuario_id,module_id' }]);
});

test('saveModuleRound no retrocede al repetir una parada ya completada', async () => {
  const client = fakeClient({ tables: { user_module_progress: {
    data: { current_level: 5, stars_by_level: { 2: 2 } }, error: null,
  } } });
  const res = await createModuleProgressService(() => client, profiles)
    .saveModuleRound({ moduleId: 'aritmetica', stars: 1, level: 2 });
  assert.equal(res.currentLevel, 5);
  assert.equal(res.starsByLevel[2], 2);
});
