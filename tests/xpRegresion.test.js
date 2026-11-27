// Bloque 7 · Regresión de la XP histórica con el código REAL de store.js y useAuth.jsx, ya corregidos
// con xpProtection.js (rama de integración local). Datos ficticios; no se conecta a Supabase.
//
// Antes (comportamiento «ERROR ACTUAL» documentado en feat/laura-motor-20): store.js y useAuth.jsx
// reemplazaban la XP por getTotalXp (estrellas de paradas × 50) y una alumna con 1200 XP bajaba a 450.
// Ahora estas pruebas EXIGEN el comportamiento corregido: la XP nunca baja al recalcular el mapa y
// solo sube con la regla vigente (+50 por estrella MEJORADA en una parada). No se define XP para las
// lecciones nuevas.
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
// Recargar la página = volver a evaluar store.js con lo que quedó en localStorage.
let reloads = 0;
const reload = async () => (await import(`../src/state/store.js?recarga=${++reloads}`)).store.get();
const useAuthSource = readFileSync(new URL('../src/hooks/useAuth.jsx', import.meta.url), 'utf8');
const storeSource = readFileSync(new URL('../src/state/store.js', import.meta.url), 'utf8');
const homeSource = readFileSync(new URL('../src/views/user/Home.jsx', import.meta.url), 'utf8');
// store.set combina (deepMerge): se parte de un estado en blanco para no arrastrar paradas de otra prueba.
const reset = () => { store.endSession(); store.set({ ...structuredClone(STORED), lives: 5 }); };

test('escenario base: 1200 XP históricas frente a 450 XP derivadas del mapa', () => {
  assert.equal(getTotalXp(STORED), 450);
  assert.equal(reconcileXp({ remoteXp: 0, localXp: STORED.xp, derivedXp: getTotalXp(STORED) }), 1200);
});

test('CORREGIDO · al recargar (store.load) la XP se conserva en 1200', async () => {
  assert.equal(xpAfterReload, 1200, 'store.js ya no reemplaza la XP guardada por getTotalXp');
  assert.match(storeSource, /xp: reconcileXp\(\{ localXp: saved\.xp, derivedXp: getTotalXp\(saved\) \}\)/, 'load() usa reconcileXp');
  reset();
  assert.equal((await reload()).xp, 1200, 'primera recarga');
  assert.equal((await reload()).xp, 1200, 'segunda recarga');
});

test('CORREGIDO · al combinar el mapa de otro dispositivo (applyModuleProgress) la XP no baja ni sube sola', () => {
  reset();
  store.applyModuleProgress({ levelByModule: { conteo: 2 }, starsByModuleLevel: { conteo: { 1: 1 } } });
  assert.equal(store.get().xp, 1200, 'conserva las 1200 aunque la derivada sea 450');
  assert.deepEqual(store.get().starsByModuleLevel.conteo, { 1: 3, 2: 2, 3: 3 }, 'las paradas conservan la mejor marca');
  // Si el otro dispositivo trae más estrellas y la derivada supera la guardada, se toma el máximo.
  store.applyModuleProgress({ starsByModuleLevel: { patrones: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3 } } });
  assert.equal(getTotalXp(store.get()), 1650);
  assert.equal(store.get().xp, 1650, 'el máximo entre la guardada y la derivada');
});

test('CORREGIDO · terminar una ronda del mapa (recordModuleRound) suma solo las estrellas mejoradas', () => {
  reset();
  store.recordModuleRound({ moduleId: 'patrones', stars: 2, level: 1 });
  assert.equal(store.get().xp, 1300, '1200 + 2 estrellas nuevas × 50 (antes bajaba a 550)');
  store.recordModuleRound({ moduleId: 'patrones', stars: 2, level: 1 });
  assert.equal(store.get().xp, 1300, 'repetir la parada con las mismas estrellas no suma (regla vigente)');
  store.recordModuleRound({ moduleId: 'patrones', stars: 3, level: 1 });
  assert.equal(store.get().xp, 1350, 'mejorar 1 estrella suma 50');
  store.recordModuleRound({ moduleId: 'patrones', stars: 0, level: 1 });
  assert.equal(store.get().xp, 1350, 'una ronda peor no resta');
});

test('CORREGIDO · secuencia real de Game.jsx: addRewards + recordModuleRound, sin XP inventada', () => {
  reset();
  // Lección con parada propia (p. ej. Conteo), 3 estrellas en una parada nueva.
  const before = getTotalXp(store.get());
  store.addRewards({ gems: 15, stars: 3, xp: 150, levelStars: 3 });
  store.recordModuleRound({ moduleId: 'conteo', stars: 3, level: 4 });
  assert.equal(getTotalXp(store.get()) - before, 150, '«+150 XP» mostrado en resultados');
  assert.equal(store.get().xp, 1350, 'la XP guardada sube lo mismo que se muestra');
  assert.equal(store.get().gems, 55, 'las gemas siguen igual (+5 por estrella)');
  // Lección nueva sin parada del mapa (sin regla de XP aprobada): sigue en «+0 XP».
  store.addRewards({ gems: 15, stars: 3, xp: 150, levelStars: 3 });
  assert.equal(store.get().xp, 1350, 'no se inventa XP para las lecciones nuevas');
  assert.equal(store.get().gems, 70);
});

test('CORREGIDO · useAuth.jsx guarda y recupera la XP protegida (iniciar sesión y cada ronda)', () => {
  assert.doesNotMatch(useAuthSource, /xp: getTotalXp\(store\.get\(\)\)/, 'loadProfile ya no usa solo la derivada');
  assert.match(useAuthSource, /xp: reconcileXp\(\{ remoteXp: profile\.xp, localXp: local\.xp, derivedXp: getTotalXp\(local\) \}\)/);
  assert.match(useAuthSource, /saveProfile\(\{ gems: state\.gems, xp: reconcileXp\(\{ localXp: state\.xp, derivedXp: getTotalXp\(state\) \}\) \}\)/);
  assert.match(homeSource, /reconcileXp\(\{ localXp: state\.xp, derivedXp: getTotalXp\(state\) \}\)/, 'Home muestra la XP protegida');
});

test('CORREGIDO · cerrar e iniciar sesión: el perfil remoto devuelve las 1200 XP', () => {
  reset();
  const saved = reconcileXp({ localXp: store.get().xp, derivedXp: getTotalXp(store.get()) }); // recordRound
  store.endSession(); // signOut: el dispositivo queda en blanco
  assert.equal(store.get().xp, 0);
  store.startSession('alumna-ficticia');
  store.applyModuleProgress({ levelByModule: STORED.levelByModule, starsByModuleLevel: STORED.starsByModuleLevel });
  const local = store.get();
  store.set({ xp: reconcileXp({ remoteXp: saved, localXp: local.xp, derivedXp: getTotalXp(local) }) }); // loadProfile
  assert.equal(store.get().xp, 1200);
});

test('dos dispositivos con progreso distinto terminan con la mayor XP', () => {
  const tablet = { xp: 1200, derived: 450 };   // tenía XP histórica
  const phone = { xp: 300, derived: 650 };     // jugó más paradas, pero tenía menos XP guardada
  const remote = reconcileXp({ remoteXp: 0, localXp: tablet.xp, derivedXp: tablet.derived }); // sube la tablet
  const afterPhone = reconcileXp({ remoteXp: remote, localXp: phone.xp, derivedXp: phone.derived });
  const backToTablet = reconcileXp({ remoteXp: afterPhone, localXp: tablet.xp, derivedXp: tablet.derived });
  assert.deepEqual([remote, afterPhone, backToTablet], [1200, 1200, 1200]);
  assert.equal(reconcileXp({ remoteXp: 1200, localXp: 0, derivedXp: 1500 }), 1500, 'si el mapa ya da más, sube');
});

test('guardados concurrentes en Supabase: sin el trigger, el último en llegar aún puede bajar la XP', () => {
  // La app ya envía la XP protegida, pero un dispositivo con datos viejos puede escribir al final.
  const writes = [1300, 1300, 450];
  const lastWriteWins = writes.reduce((_, w) => w, 1200); // upsert directo (migración NO aplicada)
  assert.equal(lastWriteWins, 450, 'PENDIENTE: requiere propuesta_xp_monotona.sql en Supabase');
  const withTrigger = writes.reduce((xp, w) => monotonicXp(xp, w), 1200); // propuesta_xp_monotona.sql
  assert.equal(withTrigger, 1300, 'con el trigger: se queda la mayor');
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
