// Bloque 1 · Progreso académico por área: R15 (T2), R16, R17 y getAreaRoute (contrato v1.1 §5–§7).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isLessonCompleted, areaProgress, isAreaCompleted, nextLessonInArea, getAreaRoute, LESSONS_PER_AREA, T2_STARS,
} from '../src/utils/areaProgress.js';
import { store } from '../src/state/store.js';

const realCatalog = JSON.parse(readFileSync(new URL('../src/data/lessonContent.json', import.meta.url), 'utf8'));
// Área de prueba con 5 lecciones (el catálogo real aún tiene 2 por área).
const catalog = {
  courses: [{
    id: 'algebra', title: 'Álgebra', position: 3,
    lessons: [
      { id: 'escaleras-de-numeros', position: 1, title: 'Escaleras de números' },
      { id: 'la-balanza-de-numu', position: 2, title: 'La balanza de NUMU' },
      { id: 'el-numero-escondido', position: 3, title: 'El número escondido' },
      { id: 'la-maquina-de-reglas', position: 4, title: 'La máquina de reglas' },
      { id: 'de-un-dibujo-a-una-regla', position: 5, title: 'De un dibujo a una regla' },
    ],
  }],
};
const ids = catalog.courses[0].lessons.map((l) => l.id);
const allThree = Object.fromEntries(ids.map((id) => [id, 3]));

test('R15 · T2: solo 3 estrellas como mejor resultado terminan la lección', () => {
  assert.equal(T2_STARS, 3);
  assert.equal(isLessonCompleted(3), true);
  for (const stars of [0, 1, 2, undefined, null, 'x']) assert.equal(isLessonCompleted(stars), false, String(stars));
});

test('R15 · T2 usa la mejor puntuación aunque la última ronda sea peor', () => {
  store.recordLessonRound({ lessonId: 'prueba-t2', stars: 3, level: 1 });
  store.recordLessonRound({ lessonId: 'prueba-t2', stars: 1, level: 2 });
  const state = store.get();
  assert.equal(state.lessonRounds['prueba-t2'].latestStars, 1, 'la última fue de 1 estrella');
  assert.equal(state.lessonStars['prueba-t2'], 3, 'la mejor sigue siendo 3');
  assert.equal(isLessonCompleted(state.lessonStars['prueba-t2']), true);
});

test('R15 · el nivel académico no interviene: nivel 3 con 2 estrellas no termina la lección', () => {
  const route = getAreaRoute({ catalog, areaId: 'algebra', starsByLesson: { 'escaleras-de-numeros': 2 }, levelByLesson: { 'escaleras-de-numeros': 3 } });
  assert.equal(route.stops[0].level, 3);
  assert.equal(route.stops[0].completed, false);
});

test('R16 · cinco lecciones con T2 completan el área; cuatro no', () => {
  assert.equal(LESSONS_PER_AREA, 5);
  const five = areaProgress({ catalog, areaId: 'algebra', starsByLesson: allThree });
  assert.equal(five.completed, 5);
  assert.equal(five.isCompleted, true);

  const four = { ...allThree, 'la-maquina-de-reglas': 2 };
  const progress = areaProgress({ catalog, areaId: 'algebra', starsByLesson: four });
  assert.equal(progress.completed, 4);
  assert.equal(progress.isCompleted, false);
  assert.equal(isAreaCompleted({ catalog, areaId: 'algebra', starsByLesson: four }), false);
});

// Catálogo oficial integrado (Viviana b3687f8): 5 lecciones por área; solo 4 publicadas en total.
test('R16 · catálogo oficial: el área se completa con sus 5 lecciones, no solo con las publicadas', () => {
  for (const area of realCatalog.courses) {
    assert.equal(area.lessons.length, LESSONS_PER_AREA, area.id);
    const published = Object.fromEntries(area.lessons.filter((l) => l.published !== false).map((l) => [l.id, 3]));
    assert.equal(isAreaCompleted({ catalog: realCatalog, areaId: area.id, starsByLesson: published }), false, `${area.id}: solo publicadas`);
    const all = Object.fromEntries(area.lessons.map((l) => [l.id, 3]));
    assert.equal(isAreaCompleted({ catalog: realCatalog, areaId: area.id, starsByLesson: all }), true, `${area.id}: las 5`);
  }
});

test('R17 · la siguiente lección es la primera publicada y no terminada por posición', () => {
  assert.equal(nextLessonInArea({ catalog, areaId: 'algebra' }).id, 'escaleras-de-numeros');
  const stars = { 'escaleras-de-numeros': 3, 'la-balanza-de-numu': 2 };
  assert.equal(nextLessonInArea({ catalog, areaId: 'algebra', starsByLesson: stars }).id, 'la-balanza-de-numu');

  const withUnpublished = structuredClone(catalog);
  withUnpublished.courses[0].lessons[1].published = false;
  assert.equal(nextLessonInArea({ catalog: withUnpublished, areaId: 'algebra', starsByLesson: { 'escaleras-de-numeros': 3 } }).id,
    'el-numero-escondido', 'salta las no publicadas');
  assert.equal(nextLessonInArea({ catalog, areaId: 'algebra', starsByLesson: allThree }), null, 'área terminada');
});

test('getAreaRoute: una parada por lessonId con estado, mejor estrella y nivel, sin modificar datos', () => {
  const withUnpublished = structuredClone(catalog);
  withUnpublished.courses[0].lessons[4].published = false;
  const stars = { 'escaleras-de-numeros': 3, 'la-balanza-de-numu': 1 };
  const before = JSON.stringify({ withUnpublished, stars });
  const route = getAreaRoute({ catalog: withUnpublished, areaId: 'algebra', starsByLesson: stars, levelByLesson: { 'la-balanza-de-numu': 2 }, diagnosticScore: 0 });

  assert.equal(route.areaId, 'algebra');
  assert.equal(route.total, 5);
  assert.equal(route.completed, 1);
  assert.equal(route.nextLessonId, 'la-balanza-de-numu');
  assert.deepEqual(route.stops.map((s) => s.status), ['terminada', 'siguiente', 'disponible', 'disponible', 'no-publicada']);
  assert.deepEqual(route.stops.map((s) => s.lessonId), ids);
  assert.equal(route.stops[1].bestStars, 1);
  assert.equal(route.stops[1].level, 2, 'nivel guardado');
  assert.equal(route.stops[2].level, 1, 'nivel inicial por diagnóstico (R1)');
  // Solo rutas existentes: teoría para las publicadas; práctica solo si se puede jugar.
  assert.equal(route.stops[0].theoryPath, '/lecciones/escaleras-de-numeros');
  assert.equal(route.stops[4].theoryPath, '/lecciones/de-un-dibujo-a-una-regla', 'no publicada: solo su teoría (LessonView la muestra sin práctica)');
  assert.equal(route.stops[4].playPath, null);
  assert.ok(route.stops.every((s) => s.playPath === null || s.playPath === `${s.theoryPath}/jugar`));
  assert.equal(JSON.stringify({ withUnpublished, stars }), before);
  assert.equal(getAreaRoute({ catalog, areaId: 'no-existe' }), null);
});

test('getAreaRoute funciona con las áreas actuales por lessonId', () => {
  const route = getAreaRoute({ catalog: realCatalog, areaId: 'geometria-patrones', starsByLesson: { figuras: 3 } });
  assert.deepEqual(route.stops.map((s) => [s.lessonId, s.status]), [['figuras', 'terminada'], ['patrones', 'siguiente'],
    ['la-mitad-del-espejo', 'no-publicada'], ['una-vuelta-al-contorno', 'no-publicada'], ['llenamos-el-mosaico', 'no-publicada']]);
  assert.ok(route.stops.slice(2).every((s) => s.playPath === null), 'las no publicadas no abren práctica');
});
