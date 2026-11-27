// Bloque 4 · Recorrido académico completo con las 15 lecciones (3 áreas × 5), sin Trigonometría.
// · Las 4 lecciones actuales se toman del catálogo real (conteo-basico, sumas-basicas, figuras, patrones).
// · Las 11 lecciones nuevas usan los ids y nombres aprobados en el contrato, pero sus EJERCICIOS SON
//   DATOS FICTICIOS DE PRUEBA (marcados «[FICTICIO]»): no son los contenidos de Viviana.
// · Supabase está simulado en memoria (con la migración de nivel y última ronda aplicada).
// El recorrido reproduce las decisiones de Game.jsx con las mismas funciones: planLessonRound,
// starsForRound, academicStarsFor, levelAfterRound, roundProgressTargets y buildRecommendations.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planLessonRound, questionSignature, QUESTIONS_PER_ROUND } from '../src/utils/lessonRound.js';
import { getLearningPath, getAreaRoute, isLessonCompleted, ACTIVE_AREA_IDS } from '../src/utils/areaProgress.js';
import { buildRecommendations } from '../src/services/recommendationService.js';
import { resolveContinueRoute } from '../src/services/startRoute.js';
import { getLessonById } from '../src/utils/lessonContent.js';
import { supabaseSimulado, alumno, APPROVED_IDS, catalogo15, lessonV2, ficticio } from './helpers/numuSimulado.js';

const IDS = APPROVED_IDS;

test('1–2 · alumno nuevo: tres áreas de cinco lecciones, sin Trigonometría, empieza por la primera', async () => {
  const catalog = catalogo15();
  const path = getLearningPath({ catalog });
  assert.deepEqual([...ACTIVE_AREA_IDS], ['aritmetica', 'geometria-patrones', 'algebra']);
  assert.deepEqual(path.areas.map((a) => a.areaId), ACTIVE_AREA_IDS);
  for (const area of path.areas) {
    assert.deepEqual(area.stops.map((s) => s.lessonId), IDS[area.areaId]);
    assert.deepEqual(area.stops.map((s) => s.position), [1, 2, 3, 4, 5]);
    assert.ok(area.stops.every((s) => s.bestStars === 0 && !s.completed && s.published && s.playable));
    assert.equal(area.stops.filter((s) => s.isNext).length, 1);
    assert.equal(area.stops[0].isNext, true);
  }
  assert.equal(path.nextLessonId, 'conteo-basico');
  const withTrig = { courses: [...catalog.courses, { id: 'trigonometria', title: 'Trigonometría', position: 4, lessons: [lessonV2('gira-el-submarino', 'trigonometria', 'Gira el submarino', 1)] }] };
  assert.equal(getLearningPath({ catalog: withTrig }).areas.length, 3, 'Trigonometría no aparece aunque esté en un catálogo');
  const [first] = buildRecommendations({ catalog: withTrig, interests: ['trigonometria'] }).recommendations;
  assert.notEqual(first.courseId, 'trigonometria');
});

test('3 · entrada a la teoría y a la práctica con las rutas existentes', () => {
  const area = getAreaRoute({ catalog: catalogo15(), areaId: 'algebra' });
  const stop = area.stops[1];
  assert.equal(stop.theoryPath, '/lecciones/la-balanza-de-numu');
  assert.equal(stop.playPath, '/lecciones/la-balanza-de-numu/jugar');
  const { lesson } = getLessonById(catalogo15(), 'la-balanza-de-numu');
  assert.ok(lesson.explanation && lesson.guided_example, 'la lección tiene teoría y ejemplo');
});

test('4 · cada lección publicada inicia una ronda de 6 preguntas distintas (15 lecciones × 3 niveles)', () => {
  const catalog = catalogo15();
  for (const ids of Object.values(IDS)) for (const id of ids) for (const level of [1, 2, 3]) {
    for (let run = 0; run < 10; run++) {
      const plan = planLessonRound({ lesson: getLessonById(catalog, id).lesson, level });
      assert.notEqual(plan.mode, 'unavailable', `${id} N${level}`);
      assert.equal(plan.questions.length, QUESTIONS_PER_ROUND);
      // Única excepción: Conteo N1–N2 (la evidencia de contar objetos es solo la cantidad: 4 y 5
      // distintas). Se juega con repeticiones mínimas, nunca dos equivalentes seguidas.
      if (id === 'conteo-basico' && level < 3) {
        assert.equal(plan.mode, 'repeticion-minima');
        const s = plan.questions.map(questionSignature);
        assert.ok(s.every((sig, i) => i === 0 || sig !== s[i - 1]), 'sin equivalentes seguidas');
        continue;
      }
      assert.equal(plan.mode, 'selector', `${id} N${level}`);
      assert.equal(new Set(plan.questions.map(questionSignature)).size, QUESTIONS_PER_ROUND, `${id} N${level}: distintas`);
    }
  }
});

test('5–8 · rondas con 0, 1, 2 y 3 estrellas: nivel independiente de T2, mejor marca y recomendación', async () => {
  const catalog = catalogo15();
  const db = supabaseSimulado();
  const ana = alumno({ catalog, db, usuarioId: 1 });

  const r3 = await ana.play('escaleras-de-numeros', { mistakes: 0 });
  assert.equal(r3.academic, 3);
  assert.deepEqual([r3.level, r3.result.level, r3.result.rule], [1, 2, 'R7']);
  assert.equal(r3.recommendations[0].lessonId, 'la-balanza-de-numu', 'C12: siguiente lección de Álgebra');
  assert.equal(r3.recommendations[1].lessonId, 'escaleras-de-numeros', 'C10: seguir practicando el nivel 2');

  const r2 = await ana.play('escaleras-de-numeros', { mistakes: 2 });
  assert.deepEqual([r2.academic, r2.result.rule, r2.result.level], [2, 'R8', 2]);
  const r1 = await ana.play('escaleras-de-numeros', { mistakes: 4 });
  assert.deepEqual([r1.academic, r1.result.rule], [1, 'R9']);
  assert.equal(r1.recommendations[0].type, 'REFORZAR');
  const r0 = await ana.play('escaleras-de-numeros', { mistakes: 1, livesDepleted: true });
  assert.deepEqual([r0.academic, r0.roundStars, r0.result.rule], [0, 3, 'R10'], 'académicas 0; recompensa de 3 sin cambios');

  const p = await ana.progress();
  assert.equal(p.starsByLesson['escaleras-de-numeros'], 3, 'la mejor marca se conserva');
  assert.equal(p.latestStarsByLesson['escaleras-de-numeros'], 0);
  assert.equal(p.levelByLesson['escaleras-de-numeros'], 2, 'nivel académico independiente de T2');
  assert.ok(isLessonCompleted(p.starsByLesson['escaleras-de-numeros']), 'sigue terminada (T2)');
});

test('C11 · un refuerzo prioriza otra lección pendiente de la misma área', async () => {
  const catalog = catalogo15();
  const db = supabaseSimulado();
  const beto = alumno({ catalog, db, usuarioId: 2 });
  await beto.play('patrones', { mistakes: 4 });          // Geometría con 1 estrella
  await beto.play('cuantos-quedan', { mistakes: 4 });    // Aritmética con 1 estrella
  const r = await beto.play('figuras', { mistakes: 5 }); // otra ronda de Geometría con 1 estrella
  assert.deepEqual(r.recommendations.map((x) => x.lessonId), ['figuras', 'patrones'], 'primero la misma lección, luego su área');
  assert.ok(r.recommendations[1].rules.includes('C11'));
});

test('9–10 · terminar las cinco lecciones de un área recomienda otra área (C13) y lo explica (C15)', async () => {
  const catalog = catalogo15();
  const db = supabaseSimulado();
  const caro = alumno({ catalog, db, usuarioId: 3 });
  let last;
  for (const id of IDS.algebra) last = await caro.play(id, { mistakes: 0 });
  const route = getAreaRoute({ catalog, areaId: 'algebra', starsByLesson: (await caro.progress()).starsByLesson });
  assert.equal(route.completed, 5);
  assert.equal(route.isCompleted, true, 'R16');
  const other = last.recommendations.find((r) => r.rules.includes('C13'));
  assert.ok(other, 'recomienda otra área');
  assert.equal(other.courseId, 'aritmetica');
  assert.match(other.reason, /Llevas 0 de 5 lecciones terminadas en Aritmética/);
  assert.ok(last.recommendations.filter((r) => r.courseId !== 'algebra').length <= 1, 'C14: máximo 1 de otra área');
});

test('C13 cruzado · Aritmética → Geometría y Geometría → Álgebra según lo pendiente', async () => {
  const catalog = catalogo15();
  const db = supabaseSimulado();
  const dani = alumno({ catalog, db, usuarioId: 4 });
  let last;
  for (const id of IDS.aritmetica) last = await dani.play(id, { mistakes: 1 });
  assert.equal(last.recommendations.find((r) => r.rules.includes('C13')).courseId, 'geometria-patrones');
  for (const id of IDS['geometria-patrones']) last = await dani.play(id, { mistakes: 0 });
  assert.equal(last.recommendations.find((r) => r.rules.includes('C13')).courseId, 'algebra');
  assert.deepEqual(getLearningPath({ catalog, starsByLesson: (await dani.progress()).starsByLesson }).completedAreas, ['aritmetica', 'geometria-patrones']);
});

test('11 · al iniciar sesión en otro dispositivo se recupera el progreso de las 15 lecciones', async () => {
  const catalog = catalogo15();
  const db = supabaseSimulado();
  const eva = alumno({ catalog, db, usuarioId: 5 });
  for (const id of [...IDS.aritmetica.slice(0, 3), 'figuras', 'la-balanza-de-numu']) await eva.play(id, { mistakes: 0 });
  await eva.play('patrones', { mistakes: 2 });
  const otroDispositivo = await db.as(5).getLessonProgress(); // sesión nueva, sin estado local
  const path = getLearningPath({ catalog, starsByLesson: otroDispositivo.starsByLesson, levelByLesson: otroDispositivo.levelByLesson });
  const stop = (id) => path.areas.flatMap((a) => a.stops).find((s) => s.lessonId === id);
  assert.equal(stop('cuantos-quedan').completed, true);
  assert.equal(stop('cuantos-quedan').level, 2);
  assert.equal(stop('patrones').bestStars, 2);
  assert.equal(stop('patrones').completed, false);
  assert.equal(path.areas[0].nextLessonId, 'grupos-iguales');
  assert.equal(otroDispositivo.completedLessonIds.length, 5);
});

test('12 · las cuatro lecciones antiguas conservan ids, flujo legacy y registro de su módulo', async () => {
  const catalog = catalogo15();
  const db = supabaseSimulado();
  const fede = alumno({ catalog, db, usuarioId: 6 });
  for (const id of ['conteo-basico', 'sumas-basicas', 'figuras', 'patrones']) {
    const r = await fede.play(id, { mistakes: 0 });
    // Nivel 1 (diagnóstico 0): solo Conteo usa el flujo legacy temporal; Sumas, Figuras y Patrones, el selector.
    assert.equal(r.plan.mode, id === 'conteo-basico' ? 'repeticion-minima' : 'selector', id);
    assert.equal(r.plan.questions.length, QUESTIONS_PER_ROUND);
  }
  assert.deepEqual(fede.moduleWrites, ['conteo', 'aritmetica', 'geometria', 'patrones'], 'su mapa por sección sigue igual');
  assert.deepEqual(Object.keys((await fede.progress()).starsByLesson).sort(), ['conteo-basico', 'figuras', 'patrones', 'sumas-basicas']);
});

test('13 · lección no publicada o sin cobertura: práctica no disponible, sin premios ni guardados', async () => {
  const catalog = catalogo15({
    'grupos-iguales': { published: false },
    'la-maquina-de-reglas': { levels: { 1: { exercises: [ficticio('la-maquina-de-reglas', 1, 1)] } } },
  });
  const db = supabaseSimulado();
  const gil = alumno({ catalog, db, usuarioId: 7 });
  for (const id of ['grupos-iguales', 'la-maquina-de-reglas', 'id-que-no-existe']) {
    const r = await gil.play(id, { mistakes: 0 });
    assert.equal(r.plan.mode, 'unavailable', id);
    assert.equal(r.saved, false);
  }
  assert.deepEqual(gil.rewards, { gems: 0, xp: 0 }, 'sin premios');
  assert.equal(db.rows.size, 0, 'sin guardados');
  const stops = getLearningPath({ catalog }).areas.flatMap((a) => a.stops);
  const grupos = stops.find((s) => s.lessonId === 'grupos-iguales');
  assert.deepEqual([grupos.status, grupos.theoryPath, grupos.playPath], ['no-publicada', '/lecciones/grupos-iguales', null], 'solo teoría');
  const maquina = stops.find((s) => s.lessonId === 'la-maquina-de-reglas');
  assert.deepEqual([maquina.published, maquina.playable, maquina.playPath], [true, false, null], 'teoría sí, práctica no');
  const recs = buildRecommendations({ catalog, starsByLesson: Object.fromEntries([...IDS.aritmetica.slice(0, 3), ...IDS.algebra.slice(0, 3)].map((id) => [id, 3])), limit: 3 }).recommendations;
  assert.ok(recs.every((r) => !['grupos-iguales', 'la-maquina-de-reglas'].includes(r.lessonId)));
  assert.equal(resolveContinueRoute({ catalog, lessonRounds: { 'grupos-iguales': { at: '2026-11-27T10:00:00Z' } }, recommendations: [] }).reason, 'modulo',
    '«Continuar» no lleva a una lección no publicada');
});

test('14 · una ronda de Álgebra nunca se registra como progreso de otra área', async () => {
  const catalog = catalogo15();
  const db = supabaseSimulado();
  for (const storeModuleId of ['conteo', 'aritmetica', 'geometria', 'patrones']) {
    const hugo = alumno({ catalog, db, usuarioId: 8, storeModuleId });
    for (const id of IDS.algebra) await hugo.play(id, { mistakes: 0 });
    assert.deepEqual(hugo.moduleWrites, [], `${storeModuleId}: sin mapa de otra área`);
    assert.deepEqual(hugo.courseWrites, [], `${storeModuleId}: sin progreso de curso de otra área`);
  }
  assert.ok([...db.rows.values()].every((r) => IDS.algebra.includes(r.leccion_id)), 'solo filas de lecciones de Álgebra');
});
