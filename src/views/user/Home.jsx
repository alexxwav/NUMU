import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Menu, X, Rocket, ChevronRight, Gem,
  Home as HomeIcon, Trophy, Settings, LogOut, Store, BookOpen,
} from 'lucide-react';
import { store, MODULES, getModuleStars, getTotalModuleStars, getTotalXp } from '../../state/store.js';
import { sfx } from '../../utils/audio.js';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useLessonProgress } from '../../hooks/useLessonProgress.js';
import { useRecommendations } from '../../hooks/useRecommendations.js';
import Recommendations from '../../components/Recommendations.jsx';
import LessonRouteMap, { ROUTE_STOPS } from '../../components/LessonRouteMap.jsx';
import { normalizeModuleId, courseSlugForModule } from '../../data/subjects.js';
import catalog from '../../data/lessonContent.json';
import { COURSE_STYLE } from '../CoursesView.jsx';
import { starIcon } from '../../components/iconAssets.js';
import { resolveContinueRoute } from '../../services/startRoute.js';
import { reconcileXp } from '../../utils/xpProtection.js';
import { lessonForModule } from '../../utils/lessonLevel.js';
import { RECOMMENDATION_TYPES } from '../../services/recommendationService.js';

// Accesos del menú: los mismos en el menú lateral y en la barra inferior.
const NAV_LINKS = [
  { to: '/inicio', label: 'Inicio', Icon: HomeIcon, tone: 'text-numu-purple' },
  { to: '/cursos', label: 'Cursos', Icon: BookOpen, tone: 'text-orange-energy' },
  { to: '/tienda', label: 'Tienda', Icon: Store, tone: 'text-cyan-ocean' },
  { to: '/trofeos', label: 'Trofeos', Icon: Trophy, tone: 'text-sunshine-yellow' },
  { to: '/ajustes', label: 'Ajustes', Icon: Settings, tone: 'text-gray-500' },
];

// Texto del botón de la misión según lo que realmente hace (resolveContinueRoute).
const MISSION_BUTTON = {
  'ultima-leccion': '¡Continuar aventura!',
  'siguiente-leccion': '¡Siguiente lección!',
  recomendacion: 'Empezar lección',
  modulo: '¡A jugar!',
};

export default function Home() {
  const navigate = useNavigate();
  const { configured, signOut } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [state, setState] = useState(() => store.get());

  useEffect(() => store.subscribe(() => setState(store.get())), []);

  const handleSignOut = async () => {
    sfx.tap();
    if (configured) await signOut();
    navigate('/bienvenida', { replace: true });
  };
  const toggleSidebar = () => setIsSidebarOpen((open) => !open);

  // Mantiene hidratado el progreso por lección que usan las recomendaciones.
  useLessonProgress();

  const displayName = state.profile?.nickname || state.profile?.name || 'Explorador';
  const selectedModule = MODULES.find((m) => m.id === normalizeModuleId(state.module)) ?? MODULES[0];
  const lessons = catalog.courses.flatMap((course) => course.lessons.map((lesson) => ({ lesson, course })));
  const courses = [...catalog.courses].sort((a, b) => a.position - b.position);
  // Una ruta (mapa) por lección con práctica propia: conteo, sumas, figuras y patrones.
  const routes = MODULES.map((module) => ({ module, lesson: lessonForModule(catalog, module.id)?.lesson ?? null }));
  const selectedRoute = routes.find((route) => route.module.id === selectedModule.id) ?? routes[0];
  const routeTitle = selectedRoute.lesson?.title ?? selectedModule.name;

  const starCount = getTotalModuleStars(state);
  // XP mostrada = XP guardada protegida (nunca menor que la derivada de las paradas).
  const totalXp = reconcileXp({ localXp: state.xp, derivedXp: getTotalXp(state) });
  const { recommendations, unavailableInterests } = useRecommendations();
  // Las tarjetas de refuerzo (pocas estrellas) van primero cuando existen.
  const displayedRecommendations = [...recommendations].sort((a, b) =>
    Number(b.type === RECOMMENDATION_TYPES.REFORZAR) - Number(a.type === RECOMMENDATION_TYPES.REFORZAR));

  // Misión del día: la última lección jugada; si ya cumple T2 (3★), la siguiente pendiente de su
  // área; si no hay, la primera recomendación jugable.
  const continueTarget = resolveContinueRoute({
    lessonRounds: state.lessonRounds,
    catalog,
    recommendations,
    moduleId: selectedModule.id,
    starsByLesson: state.lessonStars ?? {},
  });
  const continueLesson = continueTarget.lessonId
    ? lessons.find(({ lesson }) => lesson.id === continueTarget.lessonId)?.lesson
    : null;
  const handleContinue = () => {
    sfx.tap();
    // Comportamiento original: el módulo guardado pasa a ser el de la lección, también cuando la
    // lección no tiene module_id (queda vacío y no se arrastra el de otra área: roundProgressTargets).
    if (continueLesson) store.set({ module: continueLesson.module_id });
    navigate(continueTarget.route, { state: { from: '/inicio' } });
  };

  const selectRoute = (moduleId) => {
    sfx.tap();
    store.set({ module: moduleId });
  };

  // Jugar una parada del mapa: la ronda guarda el avance de ESA lección y vuelve aquí al salir.
  const handlePlayLevel = (level) => {
    sfx.tap();
    store.set({ module: selectedModule.id });
    navigate(`/jugar/${selectedModule.id}?parada=${level}&desde=inicio`, { state: { from: '/inicio' } });
  };

  // El contenedor exterior es el que hace scroll: su padding inferior reserva el espacio
  // de la barra fija para que «Tus cursos» no quede cortado al llegar al final.
  return (
    <div className="min-h-screen bg-soft-lavender font-poppins text-text-dark px-4 pt-5 pb-bottom-nav sm:px-6 md:px-10 md:pt-8">

      {/* Menú lateral (también tiene «Salir») */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40" onClick={toggleSidebar} aria-hidden="true" />
      )}
      <aside
        aria-label="Menú"
        aria-hidden={!isSidebarOpen}
        className={`fixed top-0 left-0 w-72 h-full bg-white z-50 shadow-2xl transform transition-transform duration-300 ease-in-out rounded-r-3xl flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full invisible'}`}
      >
        <div className="p-6 flex items-center justify-between border-b border-gray-100">
          <h2 className="text-4xl font-fredoka font-extrabold text-numu-purple">Numu</h2>
          <button type="button" onClick={toggleSidebar} aria-label="Cerrar menú"
            className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center hover:bg-coral-alert hover:text-white transition-colors">
            <X className="w-7 h-7" />
          </button>
        </div>
        <nav className="flex-1 p-6 space-y-2">
          {NAV_LINKS.map(({ to, label, Icon, tone }) => (
            <Link key={to} to={to} onClick={() => { sfx.tap(); setIsSidebarOpen(false); }}
              className={`flex items-center gap-4 p-4 min-h-touch rounded-2xl font-fredoka font-bold text-xl transition-colors ${to === '/inicio' ? 'bg-soft-lavender text-numu-purple' : 'hover:bg-soft-lavender text-text-dark'}`}>
              <Icon className={`w-6 h-6 ${tone}`} aria-hidden="true" /> {label}
            </Link>
          ))}
        </nav>
        <div className="p-6 border-t border-gray-100">
          <button type="button" onClick={handleSignOut} className="w-full min-h-touch flex items-center gap-4 p-4 rounded-2xl bg-gray-100 hover:bg-coral-alert hover:text-white text-text-dark font-fredoka font-bold text-xl transition-colors group">
            <LogOut className="w-6 h-6 text-coral-alert group-hover:text-white" aria-hidden="true" /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* --- Encabezado: menú, saludo y progreso (estrellas, XP y gemas) --- */}
      <header className="max-w-6xl mx-auto mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button type="button" onClick={toggleSidebar} aria-label="Abrir menú" aria-expanded={isSidebarOpen}
            className="w-14 h-14 shrink-0 bg-white rounded-full shadow-sm flex items-center justify-center hover:scale-105 transition-transform border-2 border-gray-100 text-numu-deep-indigo">
            <Menu className="w-7 h-7" />
          </button>
          <div className="w-14 h-14 shrink-0 bg-cyan-ocean rounded-full border-4 border-white shadow-md flex items-center justify-center text-white text-2xl" aria-hidden="true">
            {['👾', '🐱', '🐶', '🦊', '🚀', '⭐'][state.profile?.avatar || 0]}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-fredoka font-bold text-numu-deep-indigo truncate">¡Hola, {displayName}!</h1>
            <p className="text-sm md:text-base font-medium text-gray-600">¿Qué vamos a aprender hoy?</p>
          </div>
        </div>
        <ul className="flex items-center gap-2" aria-label="Tu progreso">
          <li className="bg-white px-4 py-2 rounded-full shadow-sm border-2 border-gray-100 flex items-center gap-2" title="Estrellas">
            <img src={starIcon} alt="" className="w-6 h-6 object-contain" />
            <span className="font-fredoka font-bold text-lg text-text-dark tabular-nums">{starCount}</span>
            <span className="sr-only">estrellas</span>
          </li>
          <li className="bg-white px-4 py-2 rounded-full shadow-sm border-2 border-gray-100 flex items-center gap-1.5" title="Puntos de experiencia">
            <span className="font-fredoka font-bold text-lg text-numu-purple tabular-nums">{totalXp}</span>
            <span className="font-fredoka font-bold text-sm text-numu-purple">XP</span>
          </li>
          <li className="bg-white px-4 py-2 rounded-full shadow-sm border-2 border-gray-100 flex items-center gap-2" title="Gemas">
            <Gem className="w-5 h-5 text-cyan-ocean" aria-hidden="true" />
            <span className="font-fredoka font-bold text-lg text-text-dark tabular-nums">{state.gems}</span>
            <span className="sr-only">gemas</span>
          </li>
        </ul>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* --- Columna izquierda: misión del día y elección de mapa --- */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <section aria-labelledby="mision-titulo" className="bg-numu-purple rounded-card p-6 text-white shadow-3d-primary relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-numu-deep-indigo rounded-full opacity-30" aria-hidden="true" />
            <div className="relative z-10 flex items-center gap-4">
              <div className="flex-1 space-y-2">
                <h2 id="mision-titulo" className="text-2xl md:text-3xl font-fredoka font-bold">Misión del día</h2>
                <p className="text-soft-lavender text-lg">
                  {continueLesson
                    ? `${continueTarget.reason === 'ultima-leccion' ? 'Sigue donde te quedaste' : 'Te toca'}: ${continueLesson.title}.`
                    : 'Avanza en tu ruta para ganar estrellas y gemas.'}
                </p>
              </div>
              <Rocket className={`hidden sm:block w-16 h-16 shrink-0 ${state.settings?.reduceMotion ? '' : 'animate-bounce'}`} strokeWidth={1.5} aria-hidden="true" />
            </div>
            <button type="button" onClick={handleContinue}
              className="relative z-10 mt-4 w-full min-h-touch bg-sunshine-yellow text-text-dark font-fredoka font-bold text-xl px-6 rounded-btn shadow-3d-yellow active:translate-y-1 active:shadow-none hover:translate-y-0.5 transition-all">
              {MISSION_BUTTON[continueTarget.reason] ?? '¡A jugar!'}
            </button>
          </section>

          <section aria-labelledby="mapas-titulo" className="bg-white rounded-card p-5 border-2 border-gray-100 shadow-sm">
            <h2 id="mapas-titulo" className="font-fredoka font-bold text-2xl text-text-dark">Tus mapas</h2>
            <p className="text-sm text-gray-600 mb-4">Cada lección tiene su propio mapa.</p>
            <div role="group" aria-label="Elige el mapa de una lección" className="grid grid-cols-2 gap-3">
              {routes.map(({ module, lesson }) => {
                const active = module.id === selectedModule.id;
                const level = state.levelByModule?.[module.id] ?? 1;
                return (
                  <button key={module.id} type="button" aria-pressed={active} onClick={() => selectRoute(module.id)}
                    className={`min-h-touch-lg rounded-btn p-3 text-left border-2 transition-all flex flex-col gap-1 ${active
                      ? `${module.color} ${module.shadow} text-white border-white`
                      : 'bg-soft-lavender text-text-dark border-transparent hover:border-numu-purple hover:-translate-y-0.5'}`}>
                    <span className="font-fredoka font-bold text-lg leading-tight">{lesson?.title ?? module.name}</span>
                    <span className={`text-sm font-bold flex items-center gap-1 ${active ? 'text-white' : 'text-gray-600'}`}>
                      <img src={starIcon} alt="" className="w-4 h-4 object-contain" />
                      <span className="tabular-nums">{getModuleStars(state, module.id)}</span>
                      <span aria-hidden="true">·</span>
                      {level > ROUTE_STOPS ? 'Completa' : `Parada ${level}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* --- Columna derecha: el mapa de la lección elegida --- */}
        <section aria-label={`Mapa de ${routeTitle}`} className="lg:col-span-7 bg-white rounded-card p-5 border-2 border-gray-100 shadow-sm">
          <LessonRouteMap
            state={state}
            moduleId={selectedModule.id}
            title={routeTitle}
            onPlayLevel={handlePlayLevel}
            footer={selectedRoute.lesson && (
              <Link to={`/lecciones/${selectedRoute.lesson.id}`} onClick={() => sfx.tap()}
                className="self-start min-h-touch inline-flex items-center gap-1 font-fredoka font-bold text-lg text-numu-purple hover:underline">
                Ver la teoría de {routeTitle} <ChevronRight className="w-5 h-5" aria-hidden="true" />
              </Link>
            )}
          />
        </section>

        {/* --- Recomendaciones --- */}
        <div className="lg:col-span-12">
          <Recommendations recommendations={displayedRecommendations} unavailableInterests={unavailableInterests} />
        </div>

        {/* --- Cursos --- */}
        <section aria-labelledby="cursos-titulo" className="lg:col-span-12">
          <div className="flex items-center justify-between mb-4">
            <h2 id="cursos-titulo" className="text-2xl font-fredoka font-bold text-text-dark">Tus cursos</h2>
            <Link to="/cursos" onClick={() => sfx.tap()} className="min-h-touch inline-flex items-center font-fredoka font-bold text-lg text-numu-purple hover:underline">
              Ver todos los cursos
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {courses.map((course) => {
              const style = COURSE_STYLE[course.id] ?? COURSE_STYLE.aritmetica;
              const firstRoute = routes.find(({ module }) => courseSlugForModule(module.id) === course.id);
              return (
                <Link key={course.id} to={`/cursos/${course.id}${firstRoute ? `?modulo=${firstRoute.module.id}` : ''}`} onClick={() => sfx.tap()}
                  className="bg-white rounded-card p-4 border-2 border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all flex items-center gap-4 group">
                  <div className={`w-14 h-14 shrink-0 ${style.bg} text-white rounded-full flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <style.Icon className="w-7 h-7" strokeWidth={2.5} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xl font-fredoka font-bold text-text-dark">{course.title}</h3>
                    <p className="text-gray-600 text-sm">{course.lessons.length} lecciones</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </main>

      {/* --- Barra inferior: accesos rápidos con icono y texto --- */}
      <nav aria-label="Accesos rápidos" className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t-2 border-gray-100 shadow-[0_-4px_16px_rgba(30,27,75,0.06)]">
        <ul className="max-w-3xl mx-auto grid grid-cols-5">
          {NAV_LINKS.map(({ to, label, Icon, tone }) => {
            const current = to === '/inicio';
            return (
              <li key={to}>
                <Link to={to} onClick={() => sfx.tap()} aria-current={current ? 'page' : undefined}
                  className={`min-h-touch-lg flex flex-col items-center justify-center gap-1 font-fredoka font-bold text-sm sm:text-base ${current ? 'text-numu-purple' : 'text-text-dark hover:bg-soft-lavender'}`}>
                  <Icon className={`w-7 h-7 ${current ? 'text-numu-purple' : tone}`} aria-hidden="true" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
