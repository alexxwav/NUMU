// Mapas por lección en el inicio y navegación «Regresar» / «Inicio» en todas las pantallas.
// Sin Supabase: se usa store.js en memoria y se revisa el código de las vistas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { store, MODULES, getModuleStars } from '../src/state/store.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('cada lección tiene su propio mapa: jugar una no cambia el de las otras tres', () => {
  for (const played of MODULES) {
    store.startSession(`mapas-independientes-${played.id}`);
    const before = store.get();
    store.recordModuleRound({ moduleId: played.id, stars: 2, level: 1 });
    const after = store.get();
    assert.equal(after.levelByModule[played.id], 2, `${played.id} avanza una parada`);
    assert.equal(getModuleStars(after, played.id), 2, `${played.id} guarda sus estrellas`);
    for (const other of MODULES.filter((m) => m.id !== played.id)) {
      assert.equal(after.levelByModule[other.id], before.levelByModule[other.id], `${other.id} no se mueve`);
      assert.deepEqual(after.starsByModuleLevel[other.id], before.starsByModuleLevel[other.id], `${other.id} conserva sus estrellas`);
    }
  }
});

test('el inicio muestra el mapa de la lección elegida con sus datos reales y vuelve al inicio al salir', () => {
  const home = read('../src/views/user/Home.jsx');
  const panel = read('../src/components/LessonRouteMap.jsx');
  assert.match(home, /<LessonRouteMap/, 'el mapa vuelve a estar en el inicio');
  assert.match(home, /moduleId=\{selectedModule\.id\}/);
  assert.match(home, /MODULES\.map\(\(module\) => \(\{ module, lesson: lessonForModule\(catalog, module\.id\)/, 'un mapa por lección');
  assert.match(home, /navigate\(`\/jugar\/\$\{selectedModule\.id\}\?parada=\$\{level\}&desde=inicio`\)/);
  // El panel lee SOLO el progreso de su lección.
  assert.match(panel, /state\.levelByModule\?\.\[moduleId\]/);
  assert.match(panel, /state\.starsByModuleLevel\?\.\[moduleId\]/);
  assert.match(panel, /Iniciar parada \{nextStop\}/);
  // La ronda abierta desde el inicio vuelve al inicio; y sigue guardando el avance de su lección.
  const game = read('../src/views/Game.jsx');
  assert.match(game, /const fromHome = !lessonId && searchParams\.get\('desde'\) === 'inicio'/);
  assert.match(game, /if \(progressTargets\.recordsModuleProgress\) store\.recordModuleRound\(\{ moduleId, stars, level: completedLevel \}\)/);
});

test('todas las pantallas tienen «Regresar» y acceso directo al inicio', () => {
  const nav = read('../src/components/NavBar.jsx');
  assert.match(nav, />Regresar</);
  assert.match(nav, />Inicio</);
  assert.match(nav, /navigate\(-1\)/, 'Regresar vuelve a la pantalla anterior');
  assert.match(nav, /navigate\(ROUTES\.home\)/, 'Inicio va directo a la pantalla principal');
  for (const view of ['CoursesView', 'CourseView', 'LessonView', 'ShopView', 'Achievements', 'SettingsView']) {
    assert.match(read(`../src/views/${view}.jsx`), /<NavBar/, `${view} usa la barra de navegación`);
  }
  for (const view of ['Login', 'Register']) {
    assert.match(read(`../src/views/user/${view}.jsx`), /Regresar/, `${view} permite regresar a la bienvenida`);
  }
  const game = read('../src/views/Game.jsx');
  assert.match(game, /aria-label="Volver al inicio"/, 'dentro de la ronda hay acceso directo al inicio');
});

test('los botones dicen lo que hacen', () => {
  const game = read('../src/views/Game.jsx');
  assert.doesNotMatch(game, />\s*CONTINUAR\s*</, 'el botón de resultados nombra su destino');
  assert.doesNotMatch(game, />\s*REPETIR\s*</);
  assert.match(game, /'Volver al inicio'\s*: lessonId \? 'Volver a la lección' : 'Volver al mapa'/);
  assert.match(game, /Jugar otra vez/);
  const home = read('../src/views/user/Home.jsx');
  assert.match(home, /'siguiente-leccion': '¡Siguiente lección!'/);
  assert.match(home, /'ultima-leccion': '¡Continuar aventura!'/, '«Continuar» solo cuando se retoma la última lección');
});
