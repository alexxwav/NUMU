import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Target, Lightbulb, Volume2 } from 'lucide-react';
import catalog from '../data/lessonContent.json';
import { getLessonById } from '../utils/lessonContent.js';
import { adaptExerciseToGame } from '../utils/lessonGameAdapter.js';
import { sfx, speak } from '../utils/audio.js';
import { store } from '../state/store.js';
import mascotUrl from '../assets/brand/mascot/numu-morado.png';
import { COURSE_STYLE } from './CoursesView.jsx';

const COLOR_NAMES = ['Morado', 'Amarillo', 'Verde', 'Coral', 'Cian'];

// Dibuja el visual del ejemplo guiado con el mismo adaptador que usa el juego.
function guidedExampleHtml(visual) {
  let shown = visual;
  let answer;
  switch (visual?.type) {
    case 'objects': answer = visual.count; break;
    case 'expression': answer = visual.operands[0] + visual.operands[1]; break;
    case 'shape': answer = visual.sides; break;
    case 'color_sequence':
      shown = { ...visual, sequence: visual.sequence.slice(0, 4), missing_index: 4 };
      answer = shown.sequence[0];
      break;
    default: return null;
  }
  const options = typeof answer === 'number'
    ? [answer, answer + 1, answer + 2, answer + 3]
    : [answer, ...COLOR_NAMES.filter((name) => name !== answer).slice(0, 3)];
  try {
    return adaptExerciseToGame({
      id: 'ejemplo', prompt: 'Ejemplo', hint: '-', feedback_correct: '-', feedback_incorrect: '-',
      visual: shown, options, answer_index: 0, correct_answer: answer,
    }).visual;
  } catch {
    return null;
  }
}

export default function LessonView() {
  const navigate = useNavigate();
  const { lessonId } = useParams();
  const found = getLessonById(catalog, lessonId);
  if (!found) return <Navigate to="/cursos" replace />;

  const { lesson, course } = found;
  const style = COURSE_STYLE[course.id] ?? COURSE_STYLE.aritmetica;
  const exampleHtml = guidedExampleHtml(lesson.guided_example?.visual);

  const practice = () => {
    sfx.tap();
    store.set({ module: lesson.module_id });
    navigate(`/lecciones/${lesson.id}/jugar`);
  };

  return (
    <div className="min-h-screen bg-soft-lavender font-poppins text-text-dark p-6 md:p-10 pb-24">
      <div className="max-w-3xl mx-auto space-y-8">
        <Link to={`/cursos/${course.id}`} onClick={() => sfx.tap()}
          className="inline-flex items-center gap-2 font-fredoka font-bold text-gray-500 hover:text-text-dark">
          <ArrowLeft className="w-5 h-5" /> {course.title}
        </Link>

        <header className="flex items-center gap-5">
          <span className={`w-16 h-16 shrink-0 rounded-full ${style.bg} text-white font-fredoka font-bold text-3xl grid place-items-center`}>
            {lesson.position}
          </span>
          <div>
            <p className="text-sm font-bold text-numu-purple">Lección {lesson.position} de {course.lessons.length}</p>
            <h1 className="text-3xl md:text-4xl font-fredoka font-bold text-numu-deep-indigo">{lesson.title}</h1>
          </div>
        </header>

        <section className="bg-white rounded-card p-6 border-2 border-gray-100 shadow-sm flex gap-4">
          <Target className="w-8 h-8 text-numu-purple shrink-0" />
          <div>
            <h2 className="font-fredoka font-bold text-xl mb-1">¿Qué vas a aprender?</h2>
            <p className="text-gray-600">{lesson.objective}</p>
          </div>
        </section>

        <section className="bg-white rounded-card p-6 border-2 border-gray-100 shadow-sm flex gap-4 items-start">
          <img src={mascotUrl} alt="NUMU" className="w-14 h-14 object-contain shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between gap-3 mb-1">
              <h2 className="font-fredoka font-bold text-xl">Octo te explica</h2>
              <button type="button" onClick={() => speak(lesson.explanation)} aria-label="Escuchar la explicación"
                className="w-12 h-12 shrink-0 grid place-items-center rounded-full bg-numu-purple text-white shadow-3d-primary active:translate-y-1 transition-transform">
                <Volume2 className="w-6 h-6" />
              </button>
            </div>
            <p className="text-gray-600 text-lg">{lesson.explanation}</p>
          </div>
        </section>

        {lesson.guided_example && (
          <section className="bg-white rounded-card p-6 border-2 border-gray-100 shadow-sm space-y-4">
            <div className="flex gap-4">
              <Lightbulb className="w-8 h-8 text-sunshine-yellow shrink-0" />
              <h2 className="font-fredoka font-bold text-xl">Ejemplo guiado</h2>
            </div>
            {exampleHtml && <div dangerouslySetInnerHTML={{ __html: exampleHtml }} />}
            <p className="text-gray-600 text-lg">{lesson.guided_example.explanation}</p>
          </section>
        )}

        <button type="button" onClick={practice}
          className="w-full min-h-touch-lg bg-sunshine-yellow text-text-dark font-fredoka font-bold text-2xl rounded-btn shadow-3d-yellow hover:translate-y-1 hover:shadow-none transition-all">
          ¡PRACTICAR! ({lesson.exercises.length} ejercicios)
        </button>
      </div>
    </div>
  );
}
