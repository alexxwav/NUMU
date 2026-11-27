// Integración local NUMU (pruebas/integracion-numu-15): mapa de 15 lecciones en la app, vidas al entrar
// a una ronda, mensaje de progreso C15 y recomendaciones con el catálogo OFICIAL (4 de 15 publicadas).
// Alumnos ficticios; sin Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getMapModel, roundProgressTargets } from '../src/utils/areaProgress.js';
import { buildRecommendations } from '../src/services/recommendationService.js';

const catalog = JSON.parse(readFileSync(new URL('../src/data/lessonContent.json', import.meta.url), 'utf8'));
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const all = catalog.courses.flatMap((c) => c.lessons.map((lesson) => ({ lesson, course: c })));
const unpublished = new Set(all.filter((e) => e.lesson.published === false).map((e) => e.lesson.id));

test('mapa de 15 lecciones: 3 áreas × 5 paradas por lessonId; práctica solo en las publicadas', () => {
  const model = getMapModel({ catalog, state: { lessonStars: { 'conteo-basico': 3 } } });
  assert.deepEqual(model.areas.map((a) => [a.areaId, a.stops.length]), [['aritmetica', 5], ['geometria-patrones', 5], ['algebra', 5]]);
  for (const stop of model.areas.flatMap((a) => a.stops)) {
    assert.equal(stop.theoryPath, `/lecciones/${stop.lessonId}`, `${stop.lessonId}: teoría`);
    if (unpublished.has(stop.lessonId)) assert.deepEqual([stop.playPath, stop.availability], [null, 'no-publicada'], stop.lessonId);
    else assert.equal(stop.playPath, `/lecciones/${stop.lessonId}/jugar`, stop.lessonId);
    assert.doesNotMatch(`${stop.theoryPath}${stop.playPath ?? ''}`, /parada=/, 'sin ?parada=N');
  }
  // «Siguiente lección» no vuelve a la terminada: Conteo (3★) → Sumas.
  const aritmetica = model.areas[0].stops;
  assert.deepEqual(aritmetica.filter((s) => s.isNext).map((s) => s.lessonId), ['sumas-basicas']);
  assert.equal(aritmetica[0].completed, true);
  assert.deepEqual(model.legacyHistory.sections.map((s) => s.moduleId), ['conteo', 'aritmetica', 'geometria', 'patrones'], 'historial antiguo');
});

test('CourseView y OceanMap usan getMapModel y abren theoryPath/playPath (sin ?parada en las paradas nuevas)', () => {
  const view = read('../src/views/CourseView.jsx');
  const map = read('../src/components/OceanMap.jsx');
  assert.match(view, /getMapModel\(\{ catalog, state \}\)/);
  assert.match(view, /<OceanMap\s+stops=\{areaMap\.stops\}/);
  assert.match(view, /const openLessonStop = \(path\) => \{\s*sfx\.tap\(\);\s*navigate\(path\);/);
  assert.match(view, /Historial de tu ruta/, 'el mapa antiguo se conserva como historial');
  assert.match(map, /open\(stop\.playPath\)/);
  assert.match(map, /open\(stop\.theoryPath\)/);
  assert.match(map, /if \(!stop\.published \|\| !stop\.playPath\)/, 'no publicada: candado y solo teoría');
});

test('entrar a una ronda con 0 vidas muestra el aviso existente (Salir/Recargar) y no deja responder', () => {
  const game = read('../src/views/Game.jsx');
  assert.match(game, /useState\(\(\) => \(!isUnavailable && store\.get\(\)\.lives <= 0 \? \{\s*kind: 'danger',\s*title: '¡Se acabaron las vidas!'/);
  assert.match(game, /isGameOver: true,\s*\} : null\)\)/);
  assert.match(game, /if \(answered \|\| lives <= 0\) return;/);
  assert.match(game, /const refillLives = \(\) => \{\s*store\.restoreLives\(\);/, 'se recupera con el mecanismo vigente');
  assert.match(read('../src/state/store.js'), /restoreLives\(\) \{\s*return store\.set\(\{ lives: state\.maxLives \}\);/, 'sin vidas adicionales');
});

test('C15 distingue lecciones existentes y disponibles con el catálogo oficial', () => {
  // Igual que la pantalla de resultados de Game.jsx: con la ronda recién terminada (lastRound).
  const { recommendations } = buildRecommendations({ catalog, interests: ['aritmetica'], starsByLesson: { 'conteo-basico': 3 },
    lastRound: { lessonId: 'conteo-basico', stars: 3, approved: true, levelBefore: 1, levelAfter: 2 }, limit: 2 });
  const note = recommendations.map((r) => r.reason).find((reason) => /Llevas/.test(reason));
  assert.match(note, /Llevas 1 de 2 lecciones disponibles terminadas en Aritmética \(el área tiene 5; las demás llegarán pronto\)\./);
});

test('las recomendaciones respetan published en distintos avances (nunca una de las 11)', () => {
  const progresses = [
    {}, { 'conteo-basico': 3 }, { 'conteo-basico': 3, 'sumas-basicas': 3 },
    { 'conteo-basico': 3, 'sumas-basicas': 3, figuras: 3, patrones: 3 }, { figuras: 1, patrones: 2 },
  ];
  for (const interests of [['aritmetica'], ['geometria'], ['algebra'], ['algebra', 'trigonometria']]) {
    for (const starsByLesson of progresses) {
      const { recommendations, unavailableInterests } = buildRecommendations({ catalog, interests, starsByLesson, limit: 3 });
      for (const rec of recommendations) assert.equal(unpublished.has(rec.lessonId), false, `${interests}: ${rec.lessonId}`);
      if (interests.includes('algebra')) assert.ok(unavailableInterests.some((i) => i.id === 'algebra'), 'Álgebra: «Próximamente»');
    }
  }
});

test('las rondas de las 11 lecciones nuevas no escriben en el mapa antiguo; las 4 antiguas siguen en su ruta', () => {
  for (const { lesson, course } of all) {
    const targets = roundProgressTargets({ lesson, areaId: course.id, storeModuleId: 'conteo', routeModuleId: 'conteo' });
    if (unpublished.has(lesson.id)) assert.equal(targets.recordsModuleProgress, false, lesson.id);
    else assert.deepEqual([targets.recordsModuleProgress, targets.moduleId], [true, lesson.module_id], lesson.id);
  }
});
