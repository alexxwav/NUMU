// Las 45 combinaciones lección × nivel del catálogo de 15 lecciones (3 áreas × 5, sin Trigonometría).
// Corre con el catálogo oficial o con NUMU_CATALOG=ruta (p. ej. el fixture v2 de Viviana en el entorno
// aislado de tests/integracion/validar-con-viviana.mjs). Se omite si el catálogo no tiene las 15.
// Las lecciones se abren SOLO dentro de la prueba para medir cobertura; el estado real se prueba aparte.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { planLessonRound, lessonLevelSpec, lessonCoverage, questionSignature, readSemanticKey, QUESTIONS_PER_ROUND } from '../src/utils/lessonRound.js';
import { ACTIVE_AREA_IDS } from '../src/utils/areaProgress.js';
import { courseSlugForModule } from '../src/data/subjects.js';
import { APPROVED_IDS, supabaseSimulado, alumno } from './helpers/numuSimulado.js';

const SOURCE = process.env.NUMU_CATALOG ? resolve(process.env.NUMU_CATALOG) : new URL('../src/data/lessonContent.json', import.meta.url);
const catalog = JSON.parse(readFileSync(SOURCE, 'utf8'));
const entries = catalog.courses.filter((c) => ACTIVE_AREA_IDS.includes(c.id))
  .flatMap((course) => course.lessons.map((lesson) => ({ lesson, course })));
const full = ACTIVE_AREA_IDS.every((area) => JSON.stringify((catalog.courses.find((c) => c.id === area)?.lessons ?? []).map((l) => l.id).sort())
  === JSON.stringify([...APPROVED_IDS[area]].sort()));
const FULL = full ? {} : { skip: 'el catálogo de 15 lecciones aún no está publicado (verificar con NUMU_CATALOG=ruta)' };
const open = (lesson) => ({ ...lesson, published: true });
// Cobertura real documentada (no se oculta ni se inventan bancos): Conteo deduplica por cantidad.
const DOCUMENTED_GAPS = { 'conteo-basico:1': 4, 'conteo-basico:2': 5 };

test('45 combinaciones: cada lessonId en su área, con sus tres niveles', FULL, () => {
  assert.equal(entries.length, 15);
  for (const { lesson, course } of entries) {
    assert.ok(APPROVED_IDS[course.id].includes(lesson.id), `${lesson.id} fuera de su área`);
    assert.equal(lesson.course_id ?? course.id, course.id, `${lesson.id}: course_id`);
    for (const level of [1, 2, 3]) assert.equal(lessonLevelSpec(lesson, level).level, level);
  }
});

test('45 combinaciones: 6 preguntas distintas de SU lección y SU nivel (salvo la cobertura documentada)', FULL, () => {
  const result = {};
  for (const { lesson, course } of entries) for (const level of [1, 2, 3]) {
    const key = `${lesson.id}:${level}`;
    const coverage = lessonCoverage({ lesson: open(lesson), level });
    result[key] = coverage.distinct;
    if (DOCUMENTED_GAPS[key] !== undefined) {
      assert.equal(coverage.distinct, DOCUMENTED_GAPS[key], `${key}: cambió la cobertura; actualizar el registro con Viviana`);
      assert.equal(coverage.playable, false);
      continue;
    }
    const plan = planLessonRound({ lesson: open(lesson), level });
    assert.equal(plan.mode, 'selector', `${key}: ${coverage.reasons.join(' · ')}`);
    assert.equal(new Set(plan.questions.map(questionSignature)).size, QUESTIONS_PER_ROUND, key);
    const bank = lessonLevelSpec(lesson, level);
    const ids = new Set(bank.exercises.map((e) => e.id));
    const types = lesson.levels?.[level]?.exercise_types;
    for (const q of plan.questions) {
      assert.equal(q.level, level, `${key}: pregunta de otro nivel`);
      if (q.source === 'catalogo') assert.ok(ids.has(q.id), `${key}: ${q.id} no es de este banco`);
      else assert.equal(courseSlugForModule(bank.generatorKey), course.id, `${key}: generador «${bank.generatorKey}» de otra área`);
      if (types) assert.ok(types.includes(JSON.parse(readSemanticKey(q))[0]), `${key}: tipo ${readSemanticKey(q)} no declarado`);
    }
  }
  const ok = Object.entries(result).filter(([k]) => DOCUMENTED_GAPS[k] === undefined).length;
  assert.equal(ok, 43, 'combinaciones con 6 distintas');
});

test('Figuras combina sus ejercicios antiguos y ampliados en los tres niveles', FULL, () => {
  const figuras = entries.find((e) => e.lesson.id === 'figuras').lesson;
  const oldIds = new Set(figuras.exercises.map((e) => e.id));
  for (const level of [1, 2, 3]) {
    const bank = lessonLevelSpec(figuras, level).exercises;
    assert.ok(bank.some((e) => oldIds.has(e.id)), `N${level}: incluye ejercicios antiguos`);
    assert.ok(bank.some((e) => !oldIds.has(e.id)), `N${level}: incluye ejercicios nuevos`);
    assert.ok(lessonCoverage({ lesson: figuras, level }).distinct >= 6);
  }
});

test('prácticas no disponibles (no publicadas) no dan recompensas ni guardan progreso', FULL, async () => {
  const hidden = entries.filter((e) => e.lesson.published === false);
  const db = supabaseSimulado();
  const nadie = alumno({ catalog, db, usuarioId: 99 });
  for (const { lesson } of hidden) {
    for (const level of [1, 2, 3]) assert.equal(planLessonRound({ lesson, level }).mode, 'unavailable', `${lesson.id} N${level}`);
    assert.equal((await nadie.play(lesson.id, { mistakes: 0 })).saved, false);
  }
  assert.deepEqual(nadie.rewards, { gems: 0, xp: 0 });
  assert.equal(db.rows.size, 0);
});
