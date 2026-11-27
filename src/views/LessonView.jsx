import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Target, Volume2 } from 'lucide-react';
import catalog from '../data/lessonContent.json';
import { getLessonById, isLessonPublished } from '../utils/lessonContent.js';
import { sfx, speak } from '../utils/audio.js';
import { store } from '../state/store.js';
import { useLessonProgress } from '../hooks/useLessonProgress.js';
import { lessonLevelFromState, MAX_LESSON_LEVEL } from '../utils/lessonLevel.js';
import { QUESTIONS_PER_ROUND } from '../utils/lessonRound.js';
import mascotUrl from '../assets/brand/mascot/numu-morado.png';
import CountingExample from '../components/CountingExample.jsx';
import GuidedExample from '../components/lessonExamples/GuidedExample.jsx';
import { COURSE_STYLE } from './CoursesView.jsx';

function PublishedLessonLevel({ lessonId }) {
  useLessonProgress();
  return <> · Nivel {lessonLevelFromState(store.get(), lessonId)} de {MAX_LESSON_LEVEL}</>;
}

export default function LessonView() {
  const navigate = useNavigate();
  const { lessonId } = useParams();
  const found = getLessonById(catalog, lessonId);
  if (!found) return <Navigate to="/cursos" replace />;

  const { lesson, course } = found;
  const style = COURSE_STYLE[course.id] ?? COURSE_STYLE.aritmetica;
  const isCountingLesson = lesson.id === 'conteo-basico';
  const canPractice = isLessonPublished(lesson);

  const practice = () => {
    sfx.tap();
    store.set({ module: lesson.module_id });
    navigate(`/lecciones/${lesson.id}/jugar`);
  };

  const practiceButton = (disabled = false) => (
    <button type="button" onClick={practice} disabled={disabled}
      className="w-full min-h-touch-lg bg-sunshine-yellow text-text-dark font-fredoka font-bold text-2xl rounded-btn shadow-3d-yellow enabled:motion-safe:hover:translate-y-1 enabled:hover:shadow-none motion-safe:transition-all disabled:opacity-60">
      ¡PRACTICAR! ({QUESTIONS_PER_ROUND} ejercicios)
    </button>
  );

  return (
    <main className="min-h-screen bg-soft-lavender font-poppins text-text-dark p-6 md:p-10 pb-24">
      <div className="max-w-3xl mx-auto space-y-8">
        <Link to={`/cursos/${course.id}`} onClick={() => sfx.tap()}
          className="inline-flex items-center gap-2 font-fredoka font-bold text-gray-500 hover:text-text-dark">
          <ArrowLeft aria-hidden="true" className="w-5 h-5" /> {course.title}
        </Link>

        <header className="flex items-center gap-5">
          <span aria-hidden="true" className={`w-16 h-16 shrink-0 rounded-full ${style.bg} text-white font-fredoka font-bold text-3xl grid place-items-center`}>
            {lesson.position}
          </span>
          <div>
            <p className="text-sm font-bold text-numu-purple">
              Lección {lesson.position} de {course.lessons.length}
              {canPractice && <PublishedLessonLevel key={lesson.id} lessonId={lesson.id} />}
            </p>
            <h1 className="text-3xl md:text-4xl font-fredoka font-bold text-numu-deep-indigo">{lesson.title}</h1>
          </div>
        </header>

        <section className="bg-white rounded-card p-6 border-2 border-gray-100 shadow-sm flex gap-4">
          <Target aria-hidden="true" className="w-8 h-8 text-numu-purple shrink-0" />
          <div>
            <h2 className="font-fredoka font-bold text-xl mb-1">¿Qué vas a aprender?</h2>
            <p className="text-gray-600">{lesson.objective}</p>
          </div>
        </section>

        <section className="bg-white rounded-card p-6 border-2 border-gray-100 shadow-sm flex gap-4 items-start">
          <img src={mascotUrl} alt="NUMU" className="w-14 h-14 object-contain shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between gap-3 mb-1">
              <h2 className="font-fredoka font-bold text-xl">{isCountingLesson ? '¡Vamos a contar!' : 'Octo te explica'}</h2>
              <button type="button" onClick={() => speak(lesson.explanation)} aria-label="Escuchar la explicación"
                className="w-12 h-12 shrink-0 grid place-items-center rounded-full bg-numu-purple text-white shadow-3d-primary active:translate-y-1 transition-transform">
                <Volume2 aria-hidden="true" className="w-6 h-6" />
              </button>
            </div>
            <p className="text-gray-600 text-lg">{lesson.explanation}</p>
          </div>
        </section>

        {isCountingLesson
          ? <CountingExample example={lesson.guided_example} renderPractice={canPractice ? practiceButton : () => null} />
          : <GuidedExample key={lesson.id} example={lesson.guided_example} />}
        {!canPractice && <p className="text-center text-gray-600">La práctica de esta lección todavía no está disponible.</p>}
        {canPractice && !isCountingLesson && practiceButton()}
      </div>
    </main>
  );
}
