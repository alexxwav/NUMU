// Pruebas del destino de «¡Continuar Aventura!» (sin Supabase ni navegador).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveContinueRoute } from '../src/services/startRoute.js';
import { buildRecommendations } from '../src/services/recommendationService.js';

const catalog = JSON.parse(readFileSync(new URL('../src/data/lessonContent.json', import.meta.url), 'utf8'));

test('continúa la lección jugada más recientemente, directo a su práctica', () => {
  const result = resolveContinueRoute({
    catalog,
    lessonRounds: {
      'conteo-basico': { latestStars: 3, level: 2, at: '2026-11-18T10:00:00Z' },
      figuras: { latestStars: 1, level: 1, at: '2026-11-19T08:00:00Z' },
      'sumas-basicas': { latestStars: 2, level: 3, at: '2026-11-17T10:00:00Z' },
    },
    recommendations: [{ lessonId: 'patrones', route: '/lecciones/patrones' }],
  });
  assert.deepEqual(result, { route: '/lecciones/figuras/jugar', lessonId: 'figuras', reason: 'ultima-leccion' });
});

test('sin rondas jugadas, usa la primera recomendación', () => {
  const { recommendations } = buildRecommendations({ catalog, interests: ['geometria'], diagnosticScore: 2 });
  const result = resolveContinueRoute({ catalog, lessonRounds: {}, recommendations });
  assert.deepEqual(result, { route: '/lecciones/figuras', lessonId: 'figuras', reason: 'recomendacion' });
});

test('sin rondas ni recomendaciones, conserva el comportamiento anterior (módulo elegido)', () => {
  assert.deepEqual(resolveContinueRoute({ catalog, moduleId: 'patrones' }), { route: '/jugar/patrones', lessonId: null, reason: 'modulo' });
});

test('ignora lecciones que ya no están en el catálogo y rondas sin fecha', () => {
  const result = resolveContinueRoute({
    catalog,
    lessonRounds: {
      'leccion-retirada': { latestStars: 3, level: 1, at: '2026-11-19T12:00:00Z' },
      patrones: { latestStars: 2, level: 1, at: null },
      'conteo-basico': { latestStars: 2, level: 1, at: '2026-11-01T12:00:00Z' },
    },
  });
  assert.equal(result.lessonId, 'conteo-basico');
  assert.equal(resolveContinueRoute({ catalog, lessonRounds: { patrones: { at: 'no es fecha' } } }).reason, 'modulo');
});
