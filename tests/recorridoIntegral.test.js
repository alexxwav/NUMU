// Bloque 8 · Recorrido académico integral, paso a paso, con la navegación real (getMapModel).
// · Sin NUMU_CATALOG: catálogo FICTICIO (4 lecciones reales + 11 «[FICTICIO]»). No valida producción.
// · Con NUMU_CATALOG=ruta: usa ese catálogo (p. ej. el v2 auténtico de Viviana) y abre las lecciones
//   nuevas SOLO dentro de la prueba; el paso 14 usa las marcas reales de publicación.
// Progreso en Supabase simulado; recompensas y XP con las mismas fórmulas que Game.jsx.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getMapModel } from '../src/utils/areaProgress.js';
import { planLessonRound, questionSignature } from '../src/utils/lessonRound.js';
import { createRewardGate, mapTransition } from '../src/utils/xpProtection.js';
import { getLessonById } from '../src/utils/lessonContent.js';
import { catalogo15, supabaseSimulado, alumno, APPROVED_IDS } from './helpers/numuSimulado.js';

const SOURCE = process.env.NUMU_CATALOG ? resolve(process.env.NUMU_CATALOG) : null;
const realFlags = SOURCE ? JSON.parse(readFileSync(SOURCE, 'utf8')) : catalogo15({ 'grupos-iguales': { published: false } });
const open = { courses: realFlags.courses.map((c) => ({ ...c, lessons: c.lessons.map((l) => ({ ...l, published: true })) })) };
const LABEL = SOURCE ? 'catálogo indicado en NUMU_CATALOG' : 'catálogo FICTICIO';

test(`recorrido integral (${LABEL}): de elegir un área a recomendar otra`, async () => {
  const db = supabaseSimulado();
  const ana = alumno({ catalog: open, db, usuarioId: 1 });
  const legacyState = { xp: 1200, gems: 40, starsByModuleLevel: { conteo: { 1: 3, 2: 2 } }, levelByModule: { conteo: 3 } };
  const state = () => ana.progress().then((p) => ({ ...legacyState, lessonStars: p.starsByLesson,
    lessonRounds: Object.fromEntries(Object.entries(p.rounds).map(([id, r]) => [id, { ...r }])) }));

  // 1. Elegir un área (Álgebra) entre las tres.
  let model = getMapModel({ catalog: open, state: await state() });
  assert.deepEqual(model.areas.map((a) => a.areaId), ['aritmetica', 'geometria-patrones', 'algebra']);
  const algebra = model.areas.find((a) => a.areaId === 'algebra');
  assert.deepEqual(algebra.stops.map((s) => s.lessonId), APPROVED_IDS.algebra);

  // 2. Abrir la teoría de la primera lección (ruta existente) y ver su contenido.
  const first = algebra.stops[0];
  assert.equal(first.theoryPath, `/lecciones/${first.lessonId}`);
  const { lesson } = getLessonById(open, first.lessonId);
  assert.ok(lesson.explanation && lesson.guided_example, 'teoría y ejemplo disponibles');

  // 3–4. Iniciar una ronda jugable de 6 ejercicios distintos.
  assert.equal(first.playPath, `/lecciones/${first.lessonId}/jugar`);
  const plan = planLessonRound({ lesson, level: first.level });
  assert.equal(plan.mode, 'selector');
  assert.equal(new Set(plan.questions.map(questionSignature)).size, 6);

  // 5–6. Estrellas académicas y mejor marca T2 que no baja.
  assert.equal((await ana.play(first.lessonId, { mistakes: 0 })).academic, 3);
  assert.equal((await ana.play(first.lessonId, { mistakes: 4 })).academic, 1);
  model = getMapModel({ catalog: open, state: await state() });
  const done = model.areas.find((a) => a.areaId === 'algebra').stops[0];
  assert.deepEqual([done.bestStars, done.completed], [3, true]);

  // 7. Recomendaciones correctas tras 3 estrellas en la segunda lección: siguiente del área.
  const second = await ana.play(APPROVED_IDS.algebra[1], { mistakes: 0 });
  assert.equal(second.recommendations[0].lessonId, APPROVED_IDS.algebra[2]);

  // 8. «Continuar» va a la siguiente pendiente y no repite una terminada.
  model = getMapModel({ catalog: open, state: await state() });
  assert.deepEqual([model.continueTarget.lessonId, model.continueTarget.reason], [APPROVED_IDS.algebra[2], 'siguiente-leccion']);

  // 9. Recuperar el progreso desde otro dispositivo (Supabase simulado).
  const otro = await db.as(1).getLessonProgress();
  assert.deepEqual(otro.completedLessonIds.sort(), APPROVED_IDS.algebra.slice(0, 2).sort());

  // 10–11. Completar las cinco lecciones del área y recomendar otra área.
  let last;
  for (const id of APPROVED_IDS.algebra.slice(2)) last = await ana.play(id, { mistakes: 1 });
  model = getMapModel({ catalog: open, state: await state() });
  assert.deepEqual(model.completedAreas, ['algebra']);
  const other = last.recommendations.find((r) => r.rules.includes('C13'));
  assert.ok(other && other.courseId !== 'algebra', 'recomienda otra área');

  // 12. El historial del mapa antiguo se conserva intacto y la XP histórica no baja.
  assert.deepEqual(model.legacyHistory.sections[0].starsByStop, { 1: 3, 2: 2 });
  assert.equal(mapTransition(await state()).xp, 1200);
  assert.deepEqual([ana.moduleWrites, ana.courseWrites], [[], []], 'Álgebra no registra progreso de otra área');
});

test(`13 · doble clic: una ronda se premia una sola vez (${LABEL})`, () => {
  const gate = createRewardGate();
  let gems = 0;
  for (let click = 0; click < 2; click++) gate('ronda-algebra-1', () => { gems += 15; });
  assert.equal(gems, 15);
  const source = readFileSync(new URL('../src/views/Game.jsx', import.meta.url), 'utf8');
  assert.match(source, /roundClosedRef\.current\) return;\s*roundClosedRef\.current = true;/);
});

test(`14 · no se abren lecciones no publicadas ni se premian prácticas no disponibles (${LABEL})`, async () => {
  const hidden = realFlags.courses.flatMap((c) => c.lessons).filter((l) => l.published === false);
  assert.ok(hidden.length > 0, 'hay lecciones no publicadas en este catálogo');
  const db = supabaseSimulado();
  const beto = alumno({ catalog: realFlags, db, usuarioId: 2 });
  for (const l of hidden) {
    const r = await beto.play(l.id, { mistakes: 0 });
    assert.equal(r.plan.mode, 'unavailable', l.id);
  }
  assert.deepEqual(beto.rewards, { gems: 0, xp: 0 });
  assert.equal(db.rows.size, 0, 'sin guardados');
  const stops = getMapModel({ catalog: realFlags }).areas.flatMap((a) => a.stops);
  for (const l of hidden) assert.equal(stops.find((s) => s.lessonId === l.id).playPath, null, l.id);
});
