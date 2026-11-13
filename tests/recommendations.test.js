// Pruebas del sistema de recomendación (reglas deterministas, sin conexión a Supabase).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildRecommendations, initialLevelForScore, RECOMMENDATION_TYPES as T } from '../src/services/recommendationService.js';
import { starsForRound } from '../src/utils/stars.js';

const catalog = JSON.parse(readFileSync(new URL('../src/data/lessonContent.json', import.meta.url), 'utf8'));
const LESSON_IDS = new Set(catalog.courses.flatMap((c) => c.lessons.map((l) => l.id)));
const first = (input) => buildRecommendations({ catalog, ...input }).recommendations[0];
// Ronda tal como la decide el motor (starsForRound), no calculada por el recomendador.
const round = (lessonId, mistakes, approved = true) => ({ lessonId, stars: starsForRound({ total: 6, mistakes, approved }), approved });

test('1. estudiante nuevo con interés en Aritmética inicia Conteo básico', () => {
  const result = buildRecommendations({ catalog, interests: ['aritmetica'], diagnosticScore: 4 });
  const [rec] = result.recommendations;
  assert.equal(rec.type, T.INICIAR);
  assert.equal(rec.lessonId, 'conteo-basico');
  assert.deepEqual(rec.rules, ['R4', 'R3', 'C5']);
  assert.match(rec.reason, /nivel 3/);
  assert.equal(result.recommendedCourseId, 'aritmetica');
  // El otro curso disponible no se oculta.
  assert.ok(result.recommendations.some((r) => r.courseId === 'geometria-patrones'));
});

test('2. estudiante nuevo con interés en Geometría inicia Figuras geométricas', () => {
  const rec = first({ interests: ['geometria'], diagnosticScore: 1 });
  assert.equal(rec.type, T.INICIAR);
  assert.equal(rec.lessonId, 'figuras');
  assert.deepEqual(rec.rules, ['R5', 'R1', 'C5']);
});

test('3. buen desempeño (0–1 errores, R7) recomienda avanzar a otra lección', () => {
  const rec = first({ interests: ['aritmetica'], lastRound: round('conteo-basico', 0) });
  assert.equal(rec.type, T.AVANZAR);
  assert.equal(rec.lessonId, 'sumas-basicas');
  assert.ok(rec.rules.includes('R7'));
  assert.match(rec.message, /nuevo desafío/);
});

test('4. errores moderados (2–3, R8) recomienda continuar la misma lección', () => {
  const rec = first({ lastRound: round('sumas-basicas', 3) });
  assert.equal(rec.type, T.CONTINUAR);
  assert.equal(rec.lessonId, 'sumas-basicas');
  assert.ok(rec.rules.includes('R8'));
});

test('5. dificultades (4 o más errores, R9) recomienda reforzar antes de avanzar', () => {
  const result = buildRecommendations({ catalog, lastRound: round('sumas-basicas', 5) });
  const [rec] = result.recommendations;
  assert.equal(rec.type, T.REFORZAR);
  assert.equal(rec.lessonId, 'sumas-basicas');
  assert.ok(rec.rules.includes('R9'));
  assert.match(rec.message, /Practiquemos nuevamente sumas básicas/);
  assert.equal(result.recommendations.some((r) => r.type === T.AVANZAR), false);
});

test('6. lección empezada (mejor ronda con 2 estrellas) se recomienda continuar', () => {
  const rec = first({ interests: ['aritmetica'], starsByLesson: { figuras: 2 } });
  assert.equal(rec.type, T.CONTINUAR);
  assert.equal(rec.lessonId, 'figuras');
  assert.ok(rec.rules.includes('C3'));
});

test('7. lección completada con 3 estrellas no se vuelve a recomendar', () => {
  const result = buildRecommendations({ catalog, interests: ['aritmetica'], starsByLesson: { 'conteo-basico': 3 } });
  assert.equal(result.recommendations.some((r) => r.lessonId === 'conteo-basico'), false);
  assert.equal(result.recommendations[0].type, T.AVANZAR);
  assert.equal(result.recommendations[0].lessonId, 'sumas-basicas');
});

test('8. interés en un curso no disponible (R6): «Próximamente» y sin enlaces inexistentes', () => {
  const result = buildRecommendations({ catalog, interests: ['algebra', 'trigonometria'], diagnosticScore: 2 });
  assert.deepEqual(result.unavailableInterests.map((i) => i.name), ['Álgebra', 'Trigonometría']);
  assert.equal(result.recommendedCourseId, null);
  assert.equal(result.recommendations[0].lessonId, 'conteo-basico');
  assert.ok(result.recommendations[0].rules.includes('C6'));
  for (const rec of result.recommendations) assert.ok(LESSON_IDS.has(rec.lessonId));
});

test('9. sin diagnóstico ni historial: inicia por la primera lección y no inventa nivel', () => {
  const result = buildRecommendations({ catalog });
  assert.equal(result.initialLevel, null);
  assert.equal(result.recommendations[0].type, T.INICIAR);
  assert.equal(result.recommendations[0].lessonId, 'conteo-basico');
  assert.match(result.recommendations[0].reason, /Todavía no tenemos tu diagnóstico/);
  assert.equal(result.recommendations[0].rules.some((r) => /^R[123]$/.test(r)), false);
});

test('10. dos estudiantes con avances distintos reciben recomendaciones independientes', () => {
  const anaStars = { 'conteo-basico': 3, 'sumas-basicas': 1 };
  const betoStars = { figuras: 2 };
  const ana = buildRecommendations({ catalog, interests: ['aritmetica'], starsByLesson: anaStars });
  const beto = buildRecommendations({ catalog, interests: ['geometria'], starsByLesson: betoStars });
  assert.equal(ana.recommendations[0].type, T.REFORZAR);
  assert.equal(ana.recommendations[0].lessonId, 'sumas-basicas');
  assert.equal(beto.recommendations[0].type, T.CONTINUAR);
  assert.equal(beto.recommendations[0].lessonId, 'figuras');
  assert.deepEqual(anaStars, { 'conteo-basico': 3, 'sumas-basicas': 1 }); // no modifica los datos
  assert.deepEqual(betoStars, { figuras: 2 });
});

test('R10 tiene prioridad: sin vidas se refuerza y no se avanza', () => {
  const result = buildRecommendations({ catalog, starsByLesson: { 'conteo-basico': 3 }, lastRound: round('sumas-basicas', 2, false) });
  assert.equal(result.recommendations[0].type, T.REFORZAR);
  assert.deepEqual(result.recommendations[0].rules, ['R10', 'C1']);
  assert.equal(result.recommendations[0].lessonId, 'sumas-basicas');
});

test('R1–R3: el nivel inicial coincide con el que aplica store.completeOnboarding', () => {
  for (let score = 0; score <= 5; score++) {
    assert.equal(initialLevelForScore(score), Math.min(3, 1 + Math.floor(score / 2)));
  }
  assert.equal(initialLevelForScore(null), null);
});

test('C7: con todo dominado se sugiere repaso; C8: máximo 3 y sin lecciones repetidas', () => {
  const all = Object.fromEntries([...LESSON_IDS].map((id) => [id, 3]));
  const done = buildRecommendations({ catalog, starsByLesson: all });
  assert.equal(done.recommendations.length, 1);
  assert.ok(done.recommendations[0].rules.includes('C7'));

  const mixed = buildRecommendations({ catalog, starsByLesson: { 'conteo-basico': 1, 'sumas-basicas': 2, figuras: 1, patrones: 2 } });
  assert.equal(mixed.recommendations.length, 3);
  assert.equal(new Set(mixed.recommendations.map((r) => r.lessonId)).size, 3);
  for (const rec of mixed.recommendations) {
    assert.ok(LESSON_IDS.has(rec.lessonId));
    assert.equal(rec.route, `/lecciones/${rec.lessonId}`);
    assert.ok(rec.title && rec.message && rec.reason && rec.rules.length);
  }
});

test('datos desconocidos se ignoran: lecciones inexistentes y estrellas fuera de rango', () => {
  const result = buildRecommendations({ catalog, starsByLesson: { 'leccion-falsa': 3, figuras: 9 }, lastRound: { lessonId: 'otra', stars: 3, approved: true } });
  for (const rec of result.recommendations) assert.ok(LESSON_IDS.has(rec.lessonId));
  assert.equal(result.recommendations.some((r) => r.lessonId === 'figuras'), false); // 9 → 3 estrellas: dominada
});
