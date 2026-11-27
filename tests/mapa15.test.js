// Mapa de 15 lecciones (5 paradas por área) y protección de la XP histórica en la transición.
// Datos ficticios: catálogo con 4 lecciones reales + 11 «[FICTICIO]»; estados de alumnos inventados.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getMapModel, getLearningPath } from '../src/utils/areaProgress.js';
import { lessonTheoryPath, lessonPlayPath } from '../src/services/startRoute.js';
import { reconcileXp, monotonicXp, legacyMapHistory, mapTransition, createRewardGate } from '../src/utils/xpProtection.js';
import { getTotalXp } from '../src/state/store.js';
import { catalogo15, lessonV2, APPROVED_IDS, LEGACY_LESSONS } from './helpers/numuSimulado.js';

const ROUTE = { theory: /^\/lecciones\/[a-z0-9-]+$/, play: /^\/lecciones\/[a-z0-9-]+\/jugar$/ };
// Alumno con historia en el mapa antiguo: paradas con estrellas, XP histórica mayor que la derivada.
const historico = () => ({
  xp: 1200, gems: 40, stars: 9,
  levelByModule: { conteo: 4, aritmetica: 2 },
  starsByModuleLevel: { conteo: { 1: 3, 2: 2, 3: 3 }, aritmetica: { 1: 1 } },
  lessonStars: { 'conteo-basico': 2, 'sumas-basicas': 3 },
  lessonRounds: { 'conteo-basico': { latestStars: 2, level: 1, at: '2026-11-20T10:00:00Z' } },
});

test('1 · cinco paradas por área, con todos los campos pedidos', () => {
  const model = getMapModel({ catalog: catalogo15() });
  assert.deepEqual(model.areas.map((a) => a.areaId), ['aritmetica', 'geometria-patrones', 'algebra']);
  for (const area of model.areas) {
    assert.equal(area.stops.length, 5);
    assert.deepEqual(area.stops.map((s) => s.lessonId), APPROVED_IDS[area.areaId]);
    for (const s of area.stops) {
      for (const field of ['lessonId', 'position', 'bestStars', 'level', 'completed', 'theoryPath', 'playPath', 'availability', 'isNext']) {
        assert.ok(field in s, `${s.lessonId}: falta ${field}`);
      }
      assert.equal(s.availability, 'disponible');
    }
  }
});

test('1b · disponibilidad: no publicada, solo teoría (práctica no disponible) o disponible', () => {
  const catalog = catalogo15({
    'grupos-iguales': { published: false },
    'la-maquina-de-reglas': { levels: { 1: { exercises: [] } } },
  });
  const stops = getMapModel({ catalog }).areas.flatMap((a) => a.stops);
  const by = (id) => stops.find((s) => s.lessonId === id);
  assert.deepEqual([by('grupos-iguales').availability, by('grupos-iguales').theoryPath, by('grupos-iguales').playPath], ['no-publicada', null, null]);
  assert.deepEqual([by('la-maquina-de-reglas').availability, by('la-maquina-de-reglas').theoryPath, by('la-maquina-de-reglas').playPath],
    ['practica-no-disponible', '/lecciones/la-maquina-de-reglas', null], 'teoría sí; práctica no');
  assert.equal(by('cuantos-quedan').availability, 'disponible', 'sin bloqueos artificiales');
});

test('2 · «Continuar»: alumno nuevo, lección pendiente y lección ya terminada', () => {
  const catalog = catalogo15();
  assert.equal(getMapModel({ catalog }).continueTarget.reason, 'modulo', 'alumno nuevo sin rondas ni recomendaciones');
  const pending = getMapModel({ catalog, state: { lessonStars: { 'la-balanza-de-numu': 2 },
    lessonRounds: { 'la-balanza-de-numu': { level: 1, at: '2026-11-27T10:00:00Z' } } } }).continueTarget;
  assert.deepEqual([pending.lessonId, pending.reason], ['la-balanza-de-numu', 'ultima-leccion'], 'retoma la pendiente');
  const done = getMapModel({ catalog, state: { lessonStars: { 'escaleras-de-numeros': 3, 'la-balanza-de-numu': 3 },
    lessonRounds: { 'la-balanza-de-numu': { level: 2, at: '2026-11-27T10:00:00Z' } } } }).continueTarget;
  assert.deepEqual([done.lessonId, done.reason, done.route], ['el-numero-escondido', 'siguiente-leccion', '/lecciones/el-numero-escondido/jugar'],
    'no repite la terminada: siguiente pendiente del área');
  const hidden = getMapModel({ catalog: catalogo15({ 'el-numero-escondido': { published: false } }),
    state: { lessonStars: { 'escaleras-de-numeros': 3, 'la-balanza-de-numu': 3 }, lessonRounds: { 'la-balanza-de-numu': { at: '2026-11-27T10:00:00Z' } } } }).continueTarget;
  assert.equal(hidden.lessonId, 'la-maquina-de-reglas', 'salta una no publicada');
});

test('3 · el progreso académico se conserva y las paradas antiguas no completan lecciones', () => {
  const state = historico();
  state.starsByModuleLevel.patrones = { 1: 3, 2: 3, 3: 3 }; // mapa antiguo de patrones con 3 estrellas
  const t = mapTransition(state);
  assert.deepEqual(t.lessonStars, state.lessonStars);
  assert.deepEqual(t.completedLessonIds, ['sumas-basicas'], 'solo T2 desde lessonStars, no desde paradas');
  const path = getLearningPath({ catalog: catalogo15(), starsByLesson: state.lessonStars });
  assert.equal(path.areas[1].stops.find((s) => s.lessonId === 'patrones').completed, false);
});

test('4 · la XP histórica nunca disminuye (regla actual frente a la propuesta)', () => {
  const state = historico();
  const derived = getTotalXp(state); // regla ACTUAL de store.js/useAuth.jsx: solo estrellas de paradas × 50
  assert.equal(derived, 450);
  assert.ok(derived < state.xp, 'la regla actual REDUCIRÍA la XP histórica de 1200 a 450');
  assert.equal(reconcileXp({ remoteXp: 1200, localXp: 0, derivedXp: derived }), 1200, 'propuesta: se conserva');
  assert.equal(reconcileXp({ remoteXp: 300, localXp: 500, derivedXp: 650 }), 650, 'y sube si el mapa da más');
  assert.equal(mapTransition(state).xp, 1200);
  assert.equal(mapTransition({ ...state, xp: 0 }, { remoteXp: 1200 }).xp, 1200, 'otro dispositivo sin XP local');
  assert.equal(monotonicXp(-5, 'x', null, undefined), 0);
});

test('4b · guardados simultáneos: con lectura y escritura la XP puede bajar; con máximo, no', () => {
  const devices = [{ xp: 1500 }, { xp: 450 }]; // dos dispositivos guardan casi a la vez
  let current = { xp: 1200 }; // perfil_usuario.xp
  for (const d of devices) current = { xp: d.xp }; // comportamiento actual: gana la última escritura
  assert.equal(current.xp, 450, 'riesgo actual');
  let protectedRow = { xp: 1200 }; // con el trigger propuesto (greatest)
  for (const d of devices) protectedRow = { xp: monotonicXp(protectedRow.xp, d.xp) };
  assert.equal(protectedRow.xp, 1500);
});

test('5 · rutas válidas: solo las existentes y nunca con ids inválidos', () => {
  for (const s of getMapModel({ catalog: catalogo15() }).areas.flatMap((a) => a.stops)) {
    assert.match(s.theoryPath, ROUTE.theory);
    assert.match(s.playPath, ROUTE.play);
    assert.equal(s.playPath, `${s.theoryPath}/jugar`);
  }
  for (const bad of ['Álgebra', 'la balanza', '../x', '', null, 42]) {
    assert.equal(lessonTheoryPath(bad), null, String(bad));
    assert.equal(lessonPlayPath(bad), null);
  }
});

test('6 · compatibilidad de las 4 lecciones antiguas y del mapa de 10 paradas', () => {
  const state = historico();
  const model = getMapModel({ catalog: catalogo15(), state });
  for (const id of Object.keys(LEGACY_LESSONS)) {
    const stop = model.areas.flatMap((a) => a.stops).find((s) => s.lessonId === id);
    assert.equal(stop.availability, 'disponible', id);
  }
  assert.equal(model.areas[0].stops[1].completed, true, 'sumas-basicas con 3 estrellas está terminada');
  const history = model.legacyHistory;
  assert.deepEqual(history.sections.map((s) => s.moduleId), ['conteo', 'aritmetica', 'geometria', 'patrones']);
  assert.deepEqual(history.sections[0], { moduleId: 'conteo', currentStop: 4, starsByStop: { 1: 3, 2: 2, 3: 3 }, stars: 8 });
  assert.equal(history.derivedXp, 450);
  assert.ok(Object.isFrozen(history) && Object.isFrozen(history.sections[0].starsByStop), 'solo lectura');
  assert.deepEqual(state.starsByModuleLevel.conteo, { 1: 3, 2: 2, 3: 3 }, 'el estado original no cambia');
});

test('7 · Trigonometría queda fuera del mapa aunque esté en un catálogo', () => {
  const withTrig = catalogo15();
  withTrig.courses.push({ id: 'trigonometria', title: 'Trigonometría', position: 4, lessons: [lessonV2('gira-el-submarino', 'trigonometria', 'Gira el submarino', 1)] });
  const model = getMapModel({ catalog: withTrig, state: { lessonStars: { 'gira-el-submarino': 3 } } });
  assert.equal(model.areas.length, 3);
  assert.ok(model.areas.every((a) => a.areaId !== 'trigonometria'));
  assert.notEqual(model.continueTarget.lessonId, 'gira-el-submarino');
});

test('8 · sin recompensas duplicadas: la transición no da nada y una ronda se premia una vez', () => {
  const state = historico();
  const t = mapTransition(state);
  assert.deepEqual(t.rewardsGranted, { xp: 0, gems: 0, stars: 0 });
  assert.equal(t.gems, 40, 'gemas y tienda intactas');
  assert.equal(mapTransition({ ...state, xp: t.xp, gems: t.gems }).xp, t.xp, 'repetir la transición no suma XP');
  const gate = createRewardGate();
  let gems = 0;
  assert.equal(gate('ronda-1', () => { gems += 15; }), true);
  assert.equal(gate('ronda-1', () => { gems += 15; }), false, 'doble clic');
  assert.equal(gems, 15);
  const source = readFileSync(new URL('../src/views/Game.jsx', import.meta.url), 'utf8');
  assert.match(source, /roundClosedRef\.current\) return;\s*roundClosedRef\.current = true;/, 'finishRound se ejecuta una sola vez');
  assert.equal((source.match(/store\.addRewards\(/g) ?? []).length, 1);
});
