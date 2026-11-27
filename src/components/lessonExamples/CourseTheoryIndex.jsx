import { Link, useParams } from 'react-router-dom';
import catalog from '../../data/lessonContent.json';
import { getCourseById, getLessonsForCourse, isLessonPublished } from '../../utils/lessonContent.js';

export default function CourseTheoryIndex({ children }) {
  const { courseId } = useParams();
  const course = getCourseById(catalog, courseId);
  if (!course) return children;

  const lessons = getLessonsForCourse(catalog, courseId, { includeUnpublished: true });
  const hasPractice = lessons.some(isLessonPublished);
  const Container = hasPractice ? 'div' : 'main';
  const Heading = hasPractice ? 'h2' : 'h1';
  return (
    <>
      <Container className="bg-soft-lavender px-6 py-6 md:px-10">
        <section aria-labelledby="guia-del-curso" className="mx-auto max-w-4xl rounded-card border-2 border-gray-100 bg-white p-5 text-text-dark shadow-sm">
          {!hasPractice && <Link to="/cursos" className="inline-flex min-h-touch items-center font-bold text-numu-purple underline">Volver a cursos</Link>}
          <Heading id="guia-del-curso" className="font-fredoka text-2xl font-bold">
            {hasPractice ? 'Teoría y ejemplos' : course.title + ' · Teoría y ejemplos'}
          </Heading>
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
      </Container>
      {hasPractice && children}
    </>
  );
}
