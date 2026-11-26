import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Lock } from 'lucide-react';
import catalog from '../data/lessonContent.json';
import { getCourseById, getLessonsForCourse } from '../utils/lessonContent.js';
import { sfx } from '../utils/audio.js';
import { store, getModuleStars } from '../state/store.js';
import { normalizeModuleId } from '../data/subjects.js';
import { lessonLevelFromState, MAX_LESSON_LEVEL } from '../utils/lessonLevel.js';
import { COURSE_STYLE } from './CoursesView.jsx';
import OceanMap from '../components/OceanMap.jsx';
import { starIcon } from '../components/iconAssets.js';

const TOTAL_LEVELS = 10;

export default function CourseView() {
  const { courseId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState(() => store.get());

  useEffect(() => store.subscribe(() => setState(store.get())), []);

  const course = getCourseById(catalog, courseId);
  const lessons = getLessonsForCourse(catalog, courseId);
  const routeModules = lessons.map((lesson) => ({ moduleId: lesson.module_id, title: lesson.title }));
  const requestedModule = normalizeModuleId(searchParams.get('modulo'));
  const firstModule = routeModules[0]?.moduleId ?? 'conteo';
  const moduleInQuery = routeModules.some((route) => route.moduleId === requestedModule);
  const [activeModuleId, setActiveModuleId] = useState(() => (moduleInQuery ? requestedModule : firstModule));

  useEffect(() => {
    const next = moduleInQuery ? requestedModule : firstModule;
    if (next && next !== activeModuleId) {
      setActiveModuleId(next);
      store.set({ module: next });
    }
  }, [courseId, requestedModule, moduleInQuery, firstModule]);

  if (!course) return <Navigate to="/cursos" replace />;

  const style = COURSE_STYLE[course.id] ?? COURSE_STYLE.aritmetica;
  const courseStars = lessons.reduce((total, lesson) => total + getModuleStars(state, lesson.module_id), 0);
  const activeLesson = lessons.find((lesson) => lesson.module_id === activeModuleId);
  const moduleLevel = state.levelByModule?.[activeModuleId] ?? 1;
  const moduleStars = state.starsByModuleLevel?.[activeModuleId] ?? {};
  const activeStars = getModuleStars(state, activeModuleId);

  const selectModule = (moduleId) => {
    sfx.tap();
    setActiveModuleId(moduleId);
    store.set({ module: moduleId });
  };

  const handlePlayLevel = (level) => {
    sfx.tap();
    store.set({ module: activeModuleId });
    navigate(`/jugar/${activeModuleId}?parada=${level}`);
  };

  return (
    <div className="min-h-screen bg-soft-lavender font-poppins text-text-dark p-6 md:p-10">
      <header className="max-w-4xl mx-auto mb-10">
        <Link to="/inicio" onClick={() => sfx.tap()}
          className="inline-flex items-center gap-2 mb-6 font-fredoka font-bold text-numu-purple hover:text-text-dark">
          <ArrowLeft className="w-5 h-5" /> Volver al inicio
        </Link>
        <div className={`${style.bg} ${style.shadow} rounded-card p-8 text-white flex flex-col sm:flex-row items-start sm:items-center gap-6`}>
          <div className="w-20 h-20 shrink-0 rounded-full bg-white/20 grid place-items-center">
            <style.Icon className="w-10 h-10" strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl md:text-4xl font-fredoka font-bold">{course.title}</h1>
            <p className="text-white/90 mt-1">{course.description}</p>
          </div>
          <div className="shrink-0 rounded-card bg-white/20 px-5 py-3 text-center">
            <span className="flex items-center justify-center gap-2 font-fredoka font-bold text-2xl">
              <img src={starIcon} alt="" className="w-6 h-6 object-contain" />
              <span className="tabular-nums">{courseStars}</span>
            </span>
            <span className="text-sm text-white/90">estrellas del curso</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto space-y-10">
        <section aria-labelledby="ruta-titulo">
          <div className="mb-4">
            <h2 id="ruta-titulo" className="text-2xl font-fredoka font-bold text-text-dark">
              Tu ruta: {activeLesson?.title ?? course.title}
            </h2>
            <p className="mt-1 text-base text-gray-600">
              Cada vez que terminas una ronda, avanzas una parada. Toca la parada de NUMU para jugar.
            </p>
          </div>

          <div role="group" aria-label="¿Qué quieres practicar en tu ruta?" className="mb-4 grid grid-cols-2 gap-3">
            {routeModules.map(({ moduleId, title }) => {
              const active = moduleId === activeModuleId;
              return (
                <button
                  key={moduleId}
                  type="button"
                  aria-pressed={active}
                  onClick={() => selectModule(moduleId)}
                  className={`min-h-[64px] rounded-btn px-3 py-2 font-fredoka font-bold text-base sm:text-lg leading-tight border-2 transition-all ${active
                    ? 'bg-numu-purple shadow-3d-primary text-white border-white'
                    : 'bg-white text-text-dark border-gray-100 shadow-sm hover:-translate-y-0.5'}`}
                >
                  {title}
                </button>
              );
            })}
          </div>

          <div className="mb-4 rounded-card border-2 border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-fredoka font-bold text-xl text-text-dark">{activeLesson?.title ?? course.title}</h3>
                <p className="mt-1 text-sm text-gray-600">{activeLesson?.objective ?? course.description}</p>
              </div>
              <span className="shrink-0 rounded-full bg-soft-lavender text-numu-purple font-fredoka font-bold text-sm px-3 py-1">
                Nivel {lessonLevelFromState(state, activeLesson?.id)} de {MAX_LESSON_LEVEL}
              </span>
            </div>
            <div className="mt-3 inline-flex items-center gap-2 font-fredoka font-bold text-text-dark">
              <img src={starIcon} alt="" className="w-5 h-5 object-contain" />
              <span className="tabular-nums">{activeStars}</span>
              <span className="text-sm font-medium text-gray-500">estrellas en esta ruta</span>
            </div>
          </div>

          <ul className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-text-dark" aria-label="Cómo leer el mapa">
            <li className="inline-flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-mint-success border-2 border-white shadow-sm grid place-items-center text-white" aria-hidden="true"><Check className="w-4 h-4" strokeWidth={3} /></span>
              Completada
            </li>
            <li className="inline-flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-numu-purple border-2 border-white shadow-sm" aria-hidden="true" />
              Estás aquí
            </li>
            <li className="inline-flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white shadow-sm grid place-items-center text-gray-400" aria-hidden="true"><Lock className="w-3.5 h-3.5" /></span>
              Bloqueada: termina la parada anterior
            </li>
          </ul>

          <OceanMap
            totalLevels={TOTAL_LEVELS}
            currentLevel={moduleLevel}
            starsByLevel={moduleStars}
            activityTitle={activeLesson?.title ?? course.title}
            moduleId={activeModuleId}
            onPlayLevel={handlePlayLevel}
            reduceMotion={Boolean(state.settings?.reduceMotion)}
          />
        </section>
      </main>
    </div>
  );
}
