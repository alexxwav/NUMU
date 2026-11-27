import { Link, useParams } from 'react-router-dom';
import catalog from '../../data/lessonContent.json';
import { getCourseById, getLessonsForCourse, isLessonPublished } from '../../utils/lessonContent.js';

export default function CourseTheoryIndex({ children }) {
  const { courseId } = useParams();
  const course = getCourseById(catalog, courseId);
  if (!course) return children;

  const lessons = getLessonsForCourse(catalog, courseId, { includeUnpublished: true });
  // La vista del curso (mapa de 5 lecciones) se muestra siempre, también en un área sin prácticas
  // publicadas (p. ej. Álgebra): sus paradas quedan con candado y abren solo la teoría.
  const hasPractice = lessons.some(isLessonPublished);
  // La guía va después de la vista del curso: así la barra de navegación (Regresar / Inicio)
  // queda arriba de la pantalla.
  return (
    <>
      {children}
      <div className="bg-soft-lavender px-6 pb-10 md:px-10">
        <section aria-labelledby="guia-del-curso" className="mx-auto max-w-4xl rounded-card border-2 border-gray-100 bg-white p-5 text-text-dark shadow-sm">
          <h2 id="guia-del-curso" className="font-fredoka text-2xl font-bold">
            {hasPractice ? 'Teoría y ejemplos' : course.title + ' · Teoría y ejemplos'}
          </h2>
          <ol className="mt-2 list-decimal pl-5">
            {lessons.map(lesson => (
              <li key={lesson.id}>
                <Link to={`/lecciones/${lesson.id}`} className="inline-flex min-h-touch items-center font-bold text-numu-purple underline">
                  {lesson.title}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
