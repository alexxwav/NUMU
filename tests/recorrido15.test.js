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
import { getLearningPath, getAreaRoute, isLessonCompleted, roundProgressTargets, ACTIVE_AREA_IDS } from '../src/utils/areaProgress.js';
import { buildRecommendations } from '../src/services/recommendationService.js';
import { createLessonProgressService } from '../src/services/lessonProgressService.js';
import { resolveContinueRoute } from '../src/services/startRoute.js';
import { starsForRound, academicStarsFor } from '../src/utils/stars.js';
import { levelAfterRound, lessonLevelFor } from '../src/utils/lessonLevel.js';
import { getLessonById } from '../src/utils/lessonContent.js';

const real = JSON.parse(readFileSync(new URL('../src/data/lessonContent.json', import.meta.url), 'utf8'));
const realLesson = (id) => real.courses.flatMap((c) => c.lessons).find((l) => l.id === id);

// ---------- Catálogo de prueba de 15 lecciones ----------
function ficticio(id, level, n) {
  const count = ((n + level) % 9) + 1;
  const options = [count, count + 1, count + 2, count + 3];
  return {
    id: `${id}-n${level}-${n}`, prompt: `[FICTICIO] ${id} · nivel ${level} · pregunta ${n}`,
    visual: { type: 'objects', icon: 'star', count }, options, answer_index: 0, correct_answer: count,
    hint: '[FICTICIO] Pista.', feedback_correct: '[FICTICIO] ¡Bien!', feedback_incorrect: '[FICTICIO] Otra vez.',
    semanticKey: JSON.stringify([`ficticio-${id}`, [level, n]]),
  };
}
const lessonV2 = (id, courseId, title, position, extra = {}) => ({
  id, course_id: courseId, title, position, base_level: 1, published: true,
  objective: '[FICTICIO] Objetivo.', explanation: '[FICTICIO] Teoría de la lección.',
  guided_example: { mode: 'visual', visual: { type: 'objects', icon: 'star', count: 2 }, explanation: '[FICTICIO] Ejemplo.' },
  levels: Object.fromEntries([1, 2, 3].map((lv) => [lv, { exercises: [1, 2, 3, 4, 5, 6].map((n) => ficticio(id, lv, n)) }])),
  ...extra,
});
function catalogo15(extra = {}) {
  const v2 = (id, course, title, pos) => lessonV2(id, course, title, pos, extra[id] ?? {});
  return {
    courses: [
      { id: 'aritmetica', title: 'Aritmética', position: 1, description: '—', lessons: [
        realLesson('conteo-basico'), realLesson('sumas-basicas'),
        v2('cuantos-quedan', 'aritmetica', '¿Cuántos quedan?', 3),
        v2('grupos-iguales', 'aritmetica', 'Grupos iguales', 4),
        v2('repartimos-por-igual', 'aritmetica', 'Repartimos por igual', 5),
      ] },
      { id: 'geometria-patrones', title: 'Geometría', position: 2, description: '—', lessons: [
        realLesson('figuras'), realLesson('patrones'),
        v2('la-mitad-del-espejo', 'geometria-patrones', 'La mitad del espejo', 3),
        v2('una-vuelta-al-contorno', 'geometria-patrones', 'Una vuelta al contorno', 4),
        v2('llenamos-el-mosaico', 'geometria-patrones', 'Llenamos el mosaico', 5),
      ] },
      { id: 'algebra', title: 'Álgebra', position: 3, description: '—', lessons: [
        v2('escaleras-de-numeros', 'algebra', 'Escaleras de números', 1),
        v2('la-balanza-de-numu', 'algebra', 'La balanza de NUMU', 2),
        v2('el-numero-escondido', 'algebra', 'El número escondido', 3),
        v2('la-maquina-de-reglas', 'algebra', 'La máquina de reglas', 4),
        v2('de-un-dibujo-a-una-regla', 'algebra', 'De un dibujo a una regla', 5),
      ] },
    ],
  };
}
const IDS = {
  aritmetica: ['conteo-basico', 'sumas-basicas', 'cuantos-quedan', 'grupos-iguales', 'repartimos-por-igual'],
  'geometria-patrones': ['figuras', 'patrones', 'la-mitad-del-espejo', 'una-vuelta-al-contorno', 'llenamos-el-mosaico'],
  algebra: ['escaleras-de-numeros', 'la-balanza-de-numu', 'el-numero-escondido', 'la-maquina-de-reglas', 'de-un-dibujo-a-una-regla'],
};

// ---------- Supabase simulado (progreso_leccion con nivel y última ronda) ----------
function supabaseSimulado() {
  const rows = new Map();
  let user = null;
  const client = {
    from: () => ({
      select: () => {
        const filters = [];
        const builder = {
          eq(col, val) { filters.push((r) => r[col] === val); return builder; },
          then(resolve) {
            resolve({ data: [...rows.values()].filter((r) => r.usuario_id === user && filters.every((f) => f(r))).map((r) => ({ ...r })), error: null });
          },
        };
        return builder;
      },
    }),
    async rpc(_fn, { p_leccion_id: id, p_estrellas: stars, p_nivel: nivel = null }) {
      const key = `${user}|${id}`;
      const prev = rows.get(key);
      const row = {
        usuario_id: user, leccion_id: id, estrellas: Math.max(prev?.estrellas ?? 0, stars), intentos: (prev?.intentos ?? 0) + 1,
        ultimas_estrellas: stars, ultimo_intento: new Date(Date.now() + rows.size).toISOString(), nivel: nivel ?? prev?.nivel ?? null,
      };
      rows.set(key, row);
      return { data: { ...row }, error: null };
    },
  };
  const profiles = { currentUsuarioId: async () => ({ usuarioId: user, error: user ? null : 'Sin sesión' }) };
  return { rows, as(id) { user = id; return createLessonProgressService(() => client, profiles); } };
}

// ---------- Un alumno jugando, con las mismas decisiones que Game.jsx ----------
function alumno({ catalog, db, usuarioId, diagnosticScore = 0, storeModuleId = 'conteo' }) {
  const service = db.as(usuarioId);
  const me = { rewards: { gems: 0, xp: 0 }, moduleWrites: [], courseWrites: [] };
  me.progress = async () => service.getLessonProgress();
  me.play = async (lessonId, { mistakes = 0, livesDepleted = false } = {}) => {
    db.as(usuarioId);
    const entry = getLessonById(catalog, lessonId);
    const saved = await service.getLessonProgress();
    const level = lessonLevelFor({ lessonId, levelByLesson: saved.levelByLesson, diagnosticScore });
    const plan = planLessonRound({ lesson: entry?.lesson ?? null, level });
    if (plan.mode === 'unavailable') return { plan, saved: false, recommendations: [] };
    const roundStars = starsForRound({ total: plan.questions.length, mistakes, approved: true }); // vidas recargadas si se agotaron
    me.rewards.gems += roundStars * 5; // recompensas como hoy (sin cambios)
    me.rewards.xp += roundStars * 50;
    const targets = roundProgressTargets({ lesson: entry.lesson, areaId: entry.course.id, storeModuleId, routeModuleId: storeModuleId });
    if (targets.recordsModuleProgress) me.moduleWrites.push(targets.moduleId);
    if (targets.recordsCourseProgress) me.courseWrites.push(entry.course.id);
    const result = levelAfterRound({ level, stars: roundStars, livesDepleted });
    const academic = academicStarsFor({ roundStars, livesDepleted });
    await service.saveLessonResult({ lessonId, stars: academic, level: result.level });
    const after = await service.getLessonProgress();
    const { recommendations } = buildRecommendations({
      catalog, diagnosticScore, starsByLesson: after.starsByLesson, latestStarsByLesson: after.latestStarsByLesson,
      levelByLesson: after.levelByLesson, limit: 2,
      lastRound: { lessonId, stars: academic, approved: !livesDepleted, levelBefore: level, levelAfter: result.level },
    });
    return { plan, saved: true, academic, roundStars, level, result, recommendations };
  };
  return me;
}

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
      // Excepciones conocidas con flujo legacy temporal (pueden repetir): Figuras N1–N3 (hasta integrar
      // la ampliación de Viviana) y Conteo N1–N2 (la evidencia de contar objetos es solo la cantidad).
      if (id === 'figuras' || (id === 'conteo-basico' && level < 3)) { assert.equal(plan.mode, 'legacy'); continue; }
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
    // Nivel 1 (diagnóstico 0): Figuras y Conteo usan el flujo legacy temporal; Sumas y Patrones, el selector.
    assert.equal(r.plan.mode, ['figuras', 'conteo-basico'].includes(id) ? 'legacy' : 'selector', id);
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
  assert.deepEqual([grupos.status, grupos.theoryPath, grupos.playPath], ['no-publicada', null, null]);
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
