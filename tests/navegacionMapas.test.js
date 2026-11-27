// Mapas por lección en el inicio y navegación «Regresar» / «Inicio» en todas las pantallas.
// Sin Supabase: se usa store.js en memoria y se revisa el código de las vistas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { store, MODULES, getModuleStars } from '../src/state/store.js';
import { roundProgressTargets } from '../src/utils/areaProgress.js';

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
  assert.match(home, /navigate\(`\/jugar\/\$\{selectedModule\.id\}\?parada=\$\{level\}&desde=inicio`, \{ state: \{ from: '\/inicio' \} \}\)/);
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

test('misión del día: comportamiento original del módulo guardado (lecciones sin module_id no arrastran otro)', () => {
  const home = read('../src/views/user/Home.jsx');
  assert.match(home, /if \(continueLesson\) store\.set\(\{ module: continueLesson\.module_id \}\);/);
  // Por qué importa: una lección futura sin module_id de Geometría con el módulo vacío registra su
  // curso; con un módulo de Aritmética arrastrado, no lo registraría.
  const futura = { id: 'leccion-futura', module_id: null, course_id: 'geometria-patrones' };
  assert.equal(roundProgressTargets({ lesson: futura, areaId: 'geometria-patrones', storeModuleId: undefined }).recordsCourseProgress, true);
  assert.equal(roundProgressTargets({ lesson: futura, areaId: 'geometria-patrones', storeModuleId: 'conteo' }).recordsCourseProgress, false);
  // Las lecciones publicadas usan su propio módulo, sin depender del guardado.
  assert.equal(roundProgressTargets({ lesson: { id: 'patrones', module_id: 'patrones' }, storeModuleId: 'conteo' }).moduleId, 'patrones');
});

test('salir de una ronda: sin pantallas duplicadas y sin guardar la ronda abandonada', () => {
  const game = read('../src/views/Game.jsx');
  // Vuelve atrás si el destino es la pantalla de origen; si no, reemplaza la entrada del juego.
  assert.match(game, /const origin = location\.state\?\.from \?\? null;/);
  assert.match(game, /if \(origin === path && \(window\.history\.state\?\.idx \?\? 0\) > 0\) navigate\(-1\);\s*else navigate\(path, \{ replace: true \}\);/);
  // Las pantallas de origen declaran desde dónde se entró, con la misma dirección a la que vuelve la ronda.
  assert.match(read('../src/views/LessonView.jsx'), /\{ state: \{ from: `\/lecciones\/\$\{lesson\.id\}` \} \}/);
  const course = read('../src/views/CourseView.jsx');
  assert.match(course, /const coursePath = `\/cursos\/\$\{course\.id\}\?modulo=\$\{activeModuleId\}`;/);
  assert.match(course, /\{ state: \{ from: coursePath \} \}/);
  assert.match(game, /: courseId \? `\/cursos\/\$\{courseId\}\?modulo=\$\{moduleId\}`/, 'mismo formato que el destino de la ronda');
  // Salir solo navega: leaveTo no guarda nada y finishRound (único punto de guardado) se llama
  // solo al responder la última pregunta.
  const leave = game.slice(game.indexOf('const leaveTo = (path) => {'), game.indexOf('};', game.indexOf('const leaveTo = (path) => {')));
  assert.doesNotMatch(leave, /record|save|store\.|finishRound/);
  assert.equal(game.match(/finishRound\(\)/g).length, 1, 'finishRound se llama en un solo lugar');
  assert.match(game, /if \(index \+ 1 >= questions\.length\) \{\s*finishRound\(\);/);
});

test('/conocerte: «Salir» en el primer paso, «Regresar» y «Siguiente» grandes, sin guardar lo parcial', () => {
  const view = read('../src/views/LoginView.jsx');
  assert.match(view, /step === 0 \? \(/, 'en el primer paso cambia «Regresar» por «Salir»');
  assert.match(view, /if \(configured && session\) await signOut\(\);\s*navigate\('\/bienvenida', \{ replace: true \}\);/);
  assert.doesNotMatch(view, /hidden sm:inline">Regresar/, '«Regresar» se ve también en móvil');
  assert.match(view, /\(saving \? 'Guardando…' : '¡A JUGAR!'\) : 'Siguiente'/);
  assert.match(view, /className="min-h-touch px-5 [^"]*text-numu-deep-indigo[^"]*"\s*>\s*<ArrowLeft/, '«Regresar» mide al menos 64 px');
  // Solo se guarda al finalizar (último paso).
  const exit = view.slice(view.indexOf('const handleExit'), view.indexOf('};', view.indexOf('const handleExit')));
  assert.doesNotMatch(exit, /saveOnboarding|completeOnboarding|store\./);
  assert.equal(view.match(/saveOnboarding\(/g).length, 1);
});
