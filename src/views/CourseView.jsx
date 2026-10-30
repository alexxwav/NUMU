import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import catalog from '../data/lessonContent.json';
import { getCourseById, getLessonsForCourse } from '../utils/lessonContent.js';
import { sfx } from '../utils/audio.js';
import { COURSE_STYLE } from './CoursesView.jsx';

export default function CourseView() {
  const { courseId } = useParams();
  const course = getCourseById(catalog, courseId);
  if (!course) return <Navigate to="/cursos" replace />;

  const style = COURSE_STYLE[course.id] ?? COURSE_STYLE.aritmetica;
  const lessons = getLessonsForCourse(catalog, course.id);

  return (
    <div className="min-h-screen bg-soft-lavender font-poppins text-text-dark p-6 md:p-10">
      <header className="max-w-4xl mx-auto mb-10">
        <Link to="/cursos" onClick={() => sfx.tap()}
          className="inline-flex items-center gap-2 mb-6 font-fredoka font-bold text-gray-500 hover:text-text-dark">
          <ArrowLeft className="w-5 h-5" /> Cursos
        </Link>
        <div className={`${style.bg} ${style.shadow} rounded-card p-8 text-white flex items-center gap-6`}>
          <div className="w-20 h-20 shrink-0 rounded-full bg-white/20 grid place-items-center">
            <style.Icon className="w-10 h-10" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-fredoka font-bold">{course.title}</h1>
            <p className="text-white/90 mt-1">{course.description}</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto space-y-6">
        <h2 className="text-2xl font-fredoka font-bold">Lecciones</h2>
        {lessons.map((lesson) => (
          <Link key={lesson.id} to={`/lecciones/${lesson.id}`} onClick={() => sfx.tap()}
            className="bg-white rounded-card p-6 border-2 border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all flex items-center gap-5">
            <span className={`w-16 h-16 shrink-0 rounded-full ${style.bg} text-white font-fredoka font-bold text-3xl grid place-items-center`}>
              {lesson.position}
            </span>
            <div className="flex-1">
              <h3 className="text-xl font-fredoka font-bold">{lesson.title}</h3>
              <p className="text-gray-500 text-sm mt-1">{lesson.objective}</p>
            </div>
            <ChevronRight className="w-8 h-8 text-numu-purple shrink-0" />
          </Link>
        ))}
      </main>
    </div>
  );
}
