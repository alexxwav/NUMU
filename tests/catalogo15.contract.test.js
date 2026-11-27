// Contrato del motor con el catálogo REAL de 15 lecciones (3 áreas × 5, sin Trigonometría).
// · Por defecto lee src/data/lessonContent.json. Para verificar otro catálogo (p. ej. el de Viviana en
//   un entorno temporal aislado): NUMU_CATALOG=ruta/al/catalogo.json npm test
// · Las comprobaciones «siempre» corren con cualquier catálogo. Las «catálogo de 15» se omiten (con su
//   motivo) hasta que el catálogo publicado tenga las 15 lecciones aprobadas.
// · El recorrido de un alumno usa datos ficticios de progreso (Supabase simulado), nunca cuentas reales.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  planLessonRound, selectLessonQuestions, lessonCoverage, questionSignature, readSemanticKey,
  representabilityProblem, isLessonPlayable, hasLegacyRound, QUESTIONS_PER_ROUND,
} from '../src/utils/lessonRound.js';
import { adaptExerciseToGame } from '../src/utils/lessonGameAdapter.js';
import { getLearningPath, getAreaRoute, ACTIVE_AREA_IDS } from '../src/utils/areaProgress.js';
import { resolveContinueRoute } from '../src/services/startRoute.js';
import { courseSlugForModule } from '../src/data/subjects.js';
import { APPROVED_LESSONS, APPROVED_IDS, LEGACY_LESSONS, supabaseSimulado, alumno } from './helpers/numuSimulado.js';

const CATALOG_SOURCE = process.env.NUMU_CATALOG
  ? resolve(process.env.NUMU_CATALOG)
  : new URL('../src/data/lessonContent.json', import.meta.url);
const catalog = JSON.parse(readFileSync(CATALOG_SOURCE, 'utf8'));
const activeCourses = catalog.courses.filter((c) => ACTIVE_AREA_IDS.includes(c.id));
const allLessons = activeCourses.flatMap((course) => course.lessons.map((lesson) => ({ lesson, course })));
const isFull = ACTIVE_AREA_IDS.every((area) => {
  const ids = (catalog.courses.find((c) => c.id === area)?.lessons ?? []).map((l) => l.id).sort();
  return JSON.stringify(ids) === JSON.stringify([...APPROVED_IDS[area]].sort());
});
const FULL = isFull ? {} : { skip: 'el catálogo de 15 lecciones aún no está publicado (verificar con NUMU_CATALOG=ruta)' };
// Combinaciones sin cobertura documentadas (no se inventan bancos): Conteo N1–N2, decisión pendiente con Viviana.
const KNOWN_GAPS = new Set(['conteo-basico:1', 'conteo-basico:2']);
const LEVELS = [1, 2, 3];
const looksLikeCounting = (q) => /cu[aá]nt[oa]s .+ ves\?/i.test(q.prompt ?? '');
const withPublished = (lesson) => ({ ...lesson, published: true });

/* ======================= Siempre (cualquier catálogo) ======================= */

test('siempre · solo ids aprobados en las áreas activas; Trigonometría nunca se navega', () => {
  const approved = new Set(Object.values(APPROVED_IDS).flat());
  for (const { lesson, course } of allLessons) {
    assert.ok(approved.has(lesson.id), `${lesson.id} no está en el contrato`);
    assert.ok(APPROVED_IDS[course.id].includes(lesson.id), `${lesson.id} está en un área que no le corresponde`);
  }
  assert.ok(getLearningPath({ catalog }).areas.every((a) => a.areaId !== 'trigonometria'));
});

test('siempre · las 4 lecciones anteriores conservan id, área y módulo', () => {
  for (const [id, moduleId] of Object.entries(LEGACY_LESSONS)) {
    const entry = allLessons.find((e) => e.lesson.id === id);
    assert.ok(entry, `falta ${id}`);
    assert.equal(entry.lesson.module_id, moduleId, id);
    assert.equal(courseSlugForModule(moduleId), entry.course.id, `${id} sigue en su área`);
    assert.ok(hasLegacyRound(entry.lesson));
  }
});

test('siempre · toda pregunta que llega al juego se puede mostrar (enunciado, visual y 4 opciones)', () => {
  for (const { lesson } of allLessons) for (const level of LEVELS) {
    const plan = planLessonRound({ lesson, level });
    for (const q of plan.questions) {
      assert.equal(representabilityProblem(q), null, `${lesson.id} N${level}: ${q.prompt}`);
      assert.equal(q.level, level);
    }
  }
});

test('siempre · una lección sin módulo propio nunca usa el módulo de otra área ni conteo de respaldo', () => {
  for (const { lesson, course } of allLessons) {
    for (const level of LEVELS) {
      const plan = planLessonRound({ lesson: withPublished(lesson), level });
      if (!lesson.module_id) {
        assert.notEqual(plan.mode, 'legacy', `${lesson.id}: sin flujo legacy prestado`);
        if (course.id !== 'aritmetica') assert.ok(!plan.questions.some(looksLikeCounting), `${lesson.id}: sin preguntas de conteo`);
      }
      const key = lesson.levels?.[level]?.generator_key;
      if (key) assert.equal(courseSlugForModule(key), course.id, `${lesson.id} N${level}: generador «${key}» de otra área`);
    }
  }
});

test('siempre · published:false bloquea la práctica, también por URL directa', () => {
  for (const { lesson } of allLessons) {
    const hidden = { ...lesson, published: false };
    for (const level of LEVELS) assert.equal(planLessonRound({ lesson: hidden, level }).mode, 'unavailable', lesson.id);
    assert.equal(isLessonPlayable(hidden, 1), false);
  }
});

test('siempre · Game.jsx: sin práctica disponible no hay premios ni guardados; recompensas sin cambios', () => {
  const source = readFileSync(new URL('../src/views/Game.jsx', import.meta.url), 'utf8');
  assert.match(source, /const finishRound = \(\) => \{\s*\/\/[^\n]*\n\s*if \(isUnavailable \|\| questions\.length === 0\) return;/);
  assert.match(source, /if \(isUnavailable\) \{\s*return/);
  assert.match(source, /store\.addRewards\(\{ gems: stars \* 5, stars, xp: stars \* 50, levelStars: stars \}\)/);
  assert.equal((source.match(/store\.addRewards\(/g) ?? []).length, 1, 'un solo punto que da recompensas');
});

test('siempre · las combinaciones sin cobertura de Conteo siguen documentadas, sin bancos inventados', () => {
  const conteo = allLessons.find((e) => e.lesson.id === 'conteo-basico')?.lesson;
  for (const level of [1, 2]) {
    assert.equal(lessonCoverage({ lesson: conteo, level }).playable, false, `conteo N${level}`);
    assert.equal(planLessonRound({ lesson: conteo, level }).mode, 'legacy', 'se juega con el flujo anterior, sin cambios');
  }
});

/* ======================= «Continuar» y «siguiente lección» ======================= */

test('Continuar · tras completar (T2) la última lección, va a la siguiente del área y no la repite', () => {
  const rounds = { 'conteo-basico': { at: '2026-11-27T10:00:00Z', level: 2 } };
  assert.equal(resolveContinueRoute({ catalog, lessonRounds: rounds, starsByLesson: { 'conteo-basico': 2 } }).lessonId, 'conteo-basico',
    'sin terminar: retoma la misma');
  const done = resolveContinueRoute({ catalog, lessonRounds: rounds, starsByLesson: { 'conteo-basico': 3 } });
  assert.deepEqual([done.lessonId, done.reason, done.route], ['sumas-basicas', 'siguiente-leccion', '/lecciones/sumas-basicas/jugar']);
  const legacyCall = resolveContinueRoute({ catalog, lessonRounds: rounds });
  assert.equal(legacyCall.lessonId, 'conteo-basico', 'sin starsByLesson (Home.jsx actual) se conserva el comportamiento anterior');
});

test('Continuar · con el área completa usa una recomendación distinta; nunca una lección no jugable', () => {
  const area = APPROVED_IDS.aritmetica.filter((id) => allLessons.some((e) => e.lesson.id === id));
  const stars = Object.fromEntries(area.map((id) => [id, 3]));
  const recs = [{ lessonId: area[0], route: `/lecciones/${area[0]}` }, { lessonId: 'figuras', route: '/lecciones/figuras' }];
  const r = resolveContinueRoute({ catalog, lessonRounds: { [area[0]]: { at: '2026-11-27T10:00:00Z' } }, starsByLesson: stars, recommendations: recs });
  assert.deepEqual([r.lessonId, r.reason], ['figuras', 'recomendacion']);
  const hidden = structuredClone(catalog);
  hidden.courses.find((c) => c.id === 'aritmetica').lessons.find((l) => l.id === 'sumas-basicas').published = false;
  const h = resolveContinueRoute({ catalog: hidden, lessonRounds: { 'conteo-basico': { at: '2026-11-27T10:00:00Z' } }, starsByLesson: { 'conteo-basico': 3 } });
  assert.notEqual(h.lessonId, 'sumas-basicas', 'no lleva a una lección no publicada');
});

test('siguiente lección · getAreaRoute marca una sola siguiente por área y su ruta es de práctica de ESA lección', () => {
  for (const area of getLearningPath({ catalog, starsByLesson: { 'conteo-basico': 3, figuras: 3 } }).areas) {
    const next = area.stops.filter((s) => s.isNext);
    assert.ok(next.length <= 1);
    for (const s of next) assert.equal(s.playPath === null || s.playPath === `/lecciones/${s.lessonId}/jugar`, true);
    if (area.areaId === 'aritmetica') assert.equal(area.nextLessonId, 'sumas-basicas', 'no repite conteo-basico');
  }
});

/* ======================= Catálogo de 15 lecciones (cuando esté publicado) ======================= */

test('catálogo de 15 · ids, nombres y posiciones aprobados', FULL, () => {
  for (const [area, lessons] of Object.entries(APPROVED_LESSONS)) {
    const course = catalog.courses.find((c) => c.id === area);
    const sorted = [...course.lessons].sort((a, b) => a.position - b.position);
    assert.deepEqual(sorted.map((l) => [l.id, l.title]), lessons, area);
    assert.deepEqual(sorted.map((l) => l.position), [1, 2, 3, 4, 5], area);
  }
});

test('catálogo de 15 · cada ejercicio se adapta, se puede mostrar y trae semanticKey válida', FULL, () => {
  for (const { lesson } of allLessons) {
    const banks = [lesson.exercises ?? [], ...LEVELS.map((lv) => lesson.levels?.[lv]?.exercises ?? [])];
    for (const exercise of banks.flat()) {
      const q = adaptExerciseToGame(exercise);
      assert.equal(representabilityProblem(q), null, `${lesson.id}/${exercise.id}`);
      assert.ok(readSemanticKey(q), `${lesson.id}/${exercise.id}: sin semanticKey del adaptador`);
    }
  }
});

test('catálogo de 15 · 6 preguntas distintas por lección y nivel (salvo las combinaciones documentadas)', FULL, () => {
  for (const { lesson } of allLessons) for (const level of LEVELS) {
    if (KNOWN_GAPS.has(`${lesson.id}:${level}`)) continue;
    for (let run = 0; run < 5; run++) {
      const result = selectLessonQuestions({ lesson: withPublished(lesson), level });
      assert.equal(result.playable, true, `${lesson.id} N${level}: ${result.reasons.join(' · ')}`);
      assert.equal(new Set(result.questions.map(questionSignature)).size, QUESTIONS_PER_ROUND, `${lesson.id} N${level}`);
    }
  }
});

test('catálogo de 15 · cada lección nueva tiene teoría y ejemplo antes de practicar', FULL, () => {
  for (const { lesson } of allLessons.filter((e) => !LEGACY_LESSONS[e.lesson.id])) {
    assert.ok(lesson.objective && lesson.explanation, `${lesson.id}: teoría`);
    assert.ok(lesson.guided_example && ['visual', 'interactive'].includes(lesson.guided_example.mode), `${lesson.id}: ejemplo guiado`);
  }
  const stops = getLearningPath({ catalog }).areas.flatMap((a) => a.stops);
  assert.equal(stops.length, 15);
  assert.ok(stops.filter((s) => s.published).every((s) => s.theoryPath === `/lecciones/${s.lessonId}`));
});

test('catálogo de 15 · recorrido ficticio: resultados, T2, recomendaciones y recuperación', FULL, async () => {
  const open = { courses: catalog.courses.map((c) => ({ ...c, lessons: c.lessons.map(withPublished) })) };
  const db = supabaseSimulado();
  const ana = alumno({ catalog: open, db, usuarioId: 1 });
  let last;
  for (const id of APPROVED_IDS.algebra) last = await ana.play(id, { mistakes: 0 });
  assert.equal(getAreaRoute({ catalog: open, areaId: 'algebra', starsByLesson: (await ana.progress()).starsByLesson }).isCompleted, true);
  assert.ok(last.recommendations.some((r) => r.rules.includes('C13') && r.courseId !== 'algebra'), 'recomienda otra área');
  assert.deepEqual([ana.moduleWrites, ana.courseWrites], [[], []], 'Álgebra no registra progreso de otra área');
  const r1 = await ana.play('cuantos-quedan', { mistakes: 4 });
  assert.equal(r1.recommendations[0].type, 'REFORZAR');
  const recovered = await db.as(1).getLessonProgress();
  assert.equal(recovered.completedLessonIds.length, 5);
  assert.equal(recovered.starsByLesson['cuantos-quedan'], 1);
});
