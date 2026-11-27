// Bloque 7 · Regresión de la XP histórica con el código REAL de store.js (sin modificarlo) y la
// propuesta de xpProtection.js. Datos ficticios; no se conecta a Supabase.
//
// Las pruebas marcadas «ERROR ACTUAL» documentan el comportamiento de hoy: la XP baja. Cuando se
// autorice y aplique la corrección en store.js / useAuth.jsx, DEBEN fallar y cambiarse por la
// expectativa «PROPUESTA» (la XP se conserva). No están escritas para aprobarse por comodidad.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reconcileXp, monotonicXp, mapTransition, legacyMapHistory } from '../src/utils/xpProtection.js';

// Alumna ficticia: 1200 XP históricas, pero solo 9 estrellas en paradas del mapa (9 × 50 = 450).
const STORED = {
  xp: 1200, gems: 40, stars: 9, owned: [],
  levelByModule: { conteo: 4, aritmetica: 2 },
  starsByModuleLevel: { conteo: { 1: 3, 2: 2, 3: 3 }, aritmetica: { 1: 1 } },
  lessonStars: { 'sumas-basicas': 3 }, lessonRounds: {},
};
// «Cerrar e iniciar sesión / recargar»: store.js lee localStorage al importarse.
const memory = new Map([['numu-state-v1', JSON.stringify(STORED)]]);
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
};
const { store, getTotalXp } = await import('../src/state/store.js');
const xpAfterReload = store.get().xp;
const useAuthSource = readFileSync(new URL('../src/hooks/useAuth.jsx', import.meta.url), 'utf8');
const storeSource = readFileSync(new URL('../src/state/store.js', import.meta.url), 'utf8');

test('escenario base: 1200 XP históricas frente a 450 XP derivadas del mapa', () => {
  assert.equal(getTotalXp(STORED), 450);
  assert.equal(reconcileXp({ remoteXp: 0, localXp: STORED.xp, derivedXp: getTotalXp(STORED) }), 1200, 'PROPUESTA');
});

test('ERROR ACTUAL · al recargar (store.load) la XP baja de 1200 a 450', () => {
  assert.equal(xpAfterReload, 450, 'store.js reemplaza la XP guardada por getTotalXp');
  assert.match(storeSource, /xp: getTotalXp\(saved\)/, 'línea a corregir en load()');
  // PROPUESTA: reconcileXp({ localXp: saved.xp, derivedXp: getTotalXp(saved) }) → 1200.
  assert.equal(reconcileXp({ localXp: STORED.xp, derivedXp: getTotalXp(STORED) }), 1200);
});

test('ERROR ACTUAL · al combinar el mapa de otro dispositivo (applyModuleProgress) la XP no se recupera', () => {
  store.set({ xp: 1200 });
  store.applyModuleProgress({ levelByModule: { conteo: 2 }, starsByModuleLevel: { conteo: { 1: 1 } } });
  assert.equal(store.get().xp, 450, 'vuelve a la derivada aunque el alumno tenía 1200');
  assert.deepEqual(store.get().starsByModuleLevel.conteo, { 1: 3, 2: 2, 3: 3 }, 'las paradas sí conservan la mejor marca');
  assert.equal(reconcileXp({ localXp: 1200, derivedXp: getTotalXp(store.get()) }), 1200, 'PROPUESTA');
});

test('ERROR ACTUAL · terminar una ronda del mapa (recordModuleRound) también recalcula la XP', () => {
  store.set({ xp: 1200 });
  store.recordModuleRound({ moduleId: 'patrones', stars: 2, level: 1 });
  assert.equal(store.get().xp, 550, '450 + 2 estrellas × 50: se pierden las 1200 históricas');
  assert.equal(reconcileXp({ localXp: 1200, derivedXp: 550 }), 1200, 'PROPUESTA: conserva 1200');
});

test('ERROR ACTUAL · useAuth.jsx guarda en la cuenta la XP derivada (al iniciar sesión y en cada ronda)', () => {
  assert.match(useAuthSource, /xp: getTotalXp\(store\.get\(\)\)/, 'loadProfile (línea a corregir)');
  assert.match(useAuthSource, /saveProfile\(\{ gems: state\.gems, xp: getTotalXp\(state\) \}\)/, 'recordRound (línea a corregir)');
  // Inicio de sesión en un dispositivo nuevo: perfil remoto 1200, mapa remoto con 9 estrellas.
  const remote = { xp: 1200 };
  const actual = getTotalXp(STORED);
  assert.equal(actual, 450, 'hoy la cuenta queda con 450');
  assert.equal(reconcileXp({ remoteXp: remote.xp, localXp: 0, derivedXp: actual }), 1200, 'PROPUESTA');
});

test('dos dispositivos con progreso distinto terminan con la mayor XP (propuesta)', () => {
  const tablet = { xp: 1200, derived: 450 };   // tenía XP histórica
  const phone = { xp: 300, derived: 650 };     // jugó más paradas, pero tenía menos XP guardada
  const remote = reconcileXp({ remoteXp: 0, localXp: tablet.xp, derivedXp: tablet.derived }); // sube la tablet
  const afterPhone = reconcileXp({ remoteXp: remote, localXp: phone.xp, derivedXp: phone.derived });
  const backToTablet = reconcileXp({ remoteXp: afterPhone, localXp: tablet.xp, derivedXp: tablet.derived });
  assert.deepEqual([remote, afterPhone, backToTablet], [1200, 1200, 1200]);
  assert.equal(reconcileXp({ remoteXp: 1200, localXp: 0, derivedXp: 1500 }), 1500, 'si el mapa ya da más, sube');
});

test('guardados concurrentes y reintentos: con el máximo la XP nunca baja y un reintento no suma', () => {
  // Dos dispositivos y reintentos de red; la escritura del dispositivo con menos datos llega al final.
  const writes = [1300, 1300, 450];
  const lastWriteWins = writes.reduce((_, w) => w, 1200); // hoy (upsert directo): gana la última que llegue
  assert.equal(lastWriteWins, 450, 'ERROR ACTUAL: la XP guardada baja');
  const withTrigger = writes.reduce((xp, w) => monotonicXp(xp, w), 1200); // propuesta_xp_monotona.sql
  assert.equal(withTrigger, 1300, 'PROPUESTA: se queda la mayor');
  assert.equal([1300, 1300, 1300].reduce((xp, w) => monotonicXp(xp, w), withTrigger), 1300, 'reintentos idempotentes');
});

test('comprar en la tienda reduce gemas y no cambia la XP (store.purchase real)', () => {
  store.set({ xp: 1200, gems: 40, owned: [] });
  store.purchase('sombrero', 25);
  assert.deepEqual([store.get().gems, store.get().xp], [15, 1200]);
  assert.equal(mapTransition(store.get()).gems, 15, 'la transición del mapa no devuelve ni quita gemas');
});

test('el mapa antiguo se conserva como historial de solo lectura', () => {
  const before = JSON.stringify(STORED.starsByModuleLevel);
  const history = legacyMapHistory(STORED);
  assert.deepEqual(history.sections.find((s) => s.moduleId === 'conteo').starsByStop, { 1: 3, 2: 2, 3: 3 });
  assert.equal(history.stars, 9);
  assert.throws(() => { history.sections[0].starsByStop[1] = 0; }, TypeError, 'congelado');
  assert.equal(JSON.stringify(STORED.starsByModuleLevel), before, 'el estado original no cambia');
});
