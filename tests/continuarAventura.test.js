// «¡Continuar Aventura!» (Home.jsx) con el catálogo oficial integrado: 15 lecciones, 4 publicadas.
// Usa las mismas funciones que Home: resolveContinueRoute + buildRecommendations. Alumnos ficticios.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveContinueRoute } from '../src/services/startRoute.js';
import { buildRecommendations } from '../src/services/recommendationService.js';

const catalog = JSON.parse(readFileSync(new URL('../src/data/lessonContent.json', import.meta.url), 'utf8'));
const all = catalog.courses.flatMap((c) => c.lessons);
const unpublished = new Set(all.filter((l) => l.published === false).map((l) => l.id));
const round = (minute, level = 2) => ({ level, stars: 3, at: `2026-11-20T10:${String(minute).padStart(2, '0')}:00Z` });

// Igual que Home: recomendaciones con el progreso del alumno y continuar con starsByLesson.
function continueFor({ lessonRounds = {}, lessonStars = {}, interests = ['aritmetica'] }) {
  const { recommendations } = buildRecommendations({ catalog, interests, starsByLesson: lessonStars });
  return resolveContinueRoute({ lessonRounds, catalog, recommendations, moduleId: 'conteo', starsByLesson: lessonStars });
}

test('Home pasa starsByLesson (lessonStars) a resolveContinueRoute', () => {
  const source = readFileSync(new URL('../src/views/user/Home.jsx', import.meta.url), 'utf8');
  assert.match(source, /resolveContinueRoute\(\{[\s\S]*?starsByLesson: state\.lessonStars/);
});

test('última lección con 3★ (T2): continúa a la siguiente pendiente y disponible de su área', () => {
  const target = continueFor({ lessonRounds: { 'conteo-basico': round(1) }, lessonStars: { 'conteo-basico': 3 } });
  assert.deepEqual([target.lessonId, target.reason, target.route], ['sumas-basicas', 'siguiente-leccion', '/lecciones/sumas-basicas/jugar']);
});

test('última lección sin T2: vuelve a ella (no la da por terminada)', () => {
  const target = continueFor({ lessonRounds: { 'conteo-basico': round(1) }, lessonStars: { 'conteo-basico': 2 } });
  assert.deepEqual([target.lessonId, target.reason], ['conteo-basico', 'ultima-leccion']);
});

test('área publicada terminada: no repite ni abre una práctica no publicada; usa una recomendación jugable', () => {
  const lessonStars = { 'conteo-basico': 3, 'sumas-basicas': 3 };
  const target = continueFor({ lessonRounds: { 'conteo-basico': round(1), 'sumas-basicas': round(2) }, lessonStars });
  assert.notEqual(target.lessonId, 'sumas-basicas', 'no repite la última terminada');
  assert.equal(unpublished.has(target.lessonId), false, 'cuantos-quedan y las demás siguen cerradas');
  assert.equal(target.reason, 'recomendacion');
  assert.ok(['figuras', 'patrones'].includes(target.lessonId), `otra área disponible: ${target.lessonId}`);
});

test('las cuatro publicadas con 3★: destino válido según las recomendaciones, nunca una no publicada', () => {
  const lessonStars = { 'conteo-basico': 3, 'sumas-basicas': 3, figuras: 3, patrones: 3 };
  const lessonRounds = { 'conteo-basico': round(1), 'sumas-basicas': round(2), figuras: round(3), patrones: round(4) };
  const { recommendations } = buildRecommendations({ catalog, interests: ['aritmetica'], starsByLesson: lessonStars });
  const target = resolveContinueRoute({ lessonRounds, catalog, recommendations, moduleId: 'conteo', starsByLesson: lessonStars });
  assert.equal(unpublished.has(target.lessonId), false);
  assert.notEqual(target.lessonId, 'patrones', 'no repite la última jugada mientras haya una recomendación');
  const rec = recommendations.find((r) => r.lessonId === target.lessonId);
  assert.equal(target.reason, 'recomendacion');
  assert.ok(rec, 'sale de las recomendaciones existentes');
  assert.equal(target.route, rec.route, 'usa la ruta que propone la recomendación (teoría o práctica)');
});

test('una lección no publicada con rondas guardadas nunca es el destino', () => {
  const target = continueFor({ lessonRounds: { 'la-balanza-de-numu': round(9) }, lessonStars: {} });
  assert.equal(unpublished.has(target.lessonId), false);
  assert.equal(target.reason, 'recomendacion');
});
