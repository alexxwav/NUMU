import { Link } from 'react-router-dom';
import { ArrowLeft, Calculator, Shapes, ChevronRight } from 'lucide-react';
import catalog from '../data/lessonContent.json';
import { sfx } from '../utils/audio.js';

// Color e ícono de cada curso (DESIGN_SYSTEM: Aritmética naranja, Geometría verde).
export const COURSE_STYLE = {
  aritmetica: { bg: 'bg-orange-energy', shadow: 'shadow-3d-orange', Icon: Calculator },
  'geometria-patrones': { bg: 'bg-mint-success', shadow: 'shadow-3d-success', Icon: Shapes },
};

export default function CoursesView() {
  const courses = [...catalog.courses].sort((a, b) => a.position - b.position);

  return (
    <div className="min-h-screen bg-soft-lavender font-poppins text-text-dark p-6 md:p-10">
      <header className="max-w-5xl mx-auto flex items-center gap-4 mb-10">
        <Link to="/inicio" onClick={() => sfx.tap()} aria-label="Volver al inicio"
          className="w-14 h-14 shrink-0 grid place-items-center rounded-full bg-white border-2 border-gray-100 shadow-sm hover:scale-105 transition-transform text-numu-deep-indigo">
          <ArrowLeft className="w-7 h-7" />
        </Link>
        <div>
          <h1 className="text-3xl md:text-4xl font-fredoka font-bold text-numu-deep-indigo">Cursos</h1>
          <p className="text-gray-500">Elige un curso para ver sus lecciones.</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        {courses.map((course) => {
          const style = COURSE_STYLE[course.id] ?? COURSE_STYLE.aritmetica;
          return (
            <Link key={course.id} to={`/cursos/${course.id}`} onClick={() => sfx.tap()}
              className="bg-white rounded-card p-8 border-2 border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all flex flex-col gap-5 group">
              <div className={`w-20 h-20 rounded-full ${style.bg} text-white grid place-items-center group-hover:scale-110 transition-transform`}>
                <style.Icon className="w-10 h-10" strokeWidth={2.5} />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-fredoka font-bold mb-2">{course.title}</h2>
                <p className="text-gray-500">{course.description}</p>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-fredoka font-bold text-numu-purple">{course.lessons.length} lecciones</span>
                <span className={`min-h-touch px-6 rounded-btn ${style.bg} ${style.shadow} text-white font-fredoka font-bold text-lg flex items-center gap-2`}>
                  Entrar <ChevronRight className="w-5 h-5" />
                </span>
              </div>
            </Link>
          );
        })}
      </main>
    </div>
  );
}
