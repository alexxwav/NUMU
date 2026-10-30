/** Catálogo editorial: { courses: [{ ..., lessons: [{ ..., exercises: [] }] }] }.
 * Las búsquedas devuelven null/[] si no encuentran datos. La evaluación devuelve
 * { valid, correct, message }; la mezcla rechaza entradas inválidas con TypeError.
 * La validación devuelve { valid, errors } sin modificar el catálogo.
 */
const text = value => typeof value === 'string' && value.trim().length > 0;
const positive = value => Number.isInteger(value) && value > 0;
const coursesOf = catalog => Array.isArray(catalog?.courses) ? catalog.courses : [];
const lessonsOf = course => Array.isArray(course?.lessons) ? course.lessons : [];
const scalar = value => (typeof value === 'number' && Number.isFinite(value)) || text(value);

function exerciseErrors(exercise) {
  if (!exercise || typeof exercise !== 'object') return ['Ejercicio inválido'];
  const errors = [];
  for (const key of ['id', 'prompt', 'hint', 'feedback_correct', 'feedback_incorrect']) {
    if (!text(exercise[key])) errors.push(`Falta ${key}`);
  }
  if (!text(exercise.visual_description) && (!exercise.visual || typeof exercise.visual !== 'object' || Array.isArray(exercise.visual) || !text(exercise.visual.type))) errors.push('Falta representación visual');
  const options = exercise.options;
  if (!Array.isArray(options) || options.length !== 4 || !options.every(scalar) || new Set(options).size !== 4) errors.push('Se requieren cuatro opciones distintas');
  if (!Number.isInteger(exercise.answer_index) || exercise.answer_index < 0 || exercise.answer_index > 3) errors.push('Índice de respuesta inválido');
  if (!scalar(exercise.correct_answer) || !Array.isArray(options) || options[exercise.answer_index] !== exercise.correct_answer) errors.push('La respuesta no coincide con su índice');
  return errors;
}

export function getCourseById(catalog, courseId) {
  return coursesOf(catalog).find(course => course?.id === courseId) ?? null;
}

export function getLessonById(catalog, lessonId) {
  for (const course of coursesOf(catalog)) {
    const lesson = lessonsOf(course).find(item => item?.id === lessonId);
    if (lesson) return { lesson, course };
  }
  return null;
}

export function getLessonsForCourse(catalog, courseId) {
  return [...lessonsOf(getCourseById(catalog, courseId))].sort((a, b) => a.position - b.position);
}

export function getExerciseFeedback(exercise, selectedIndex) {
  if (exerciseErrors(exercise).length) return { valid: false, correct: false, message: 'Este ejercicio no está disponible.' };
  if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= exercise.options.length) return { valid: false, correct: false, message: 'Elige una de las cuatro opciones.' };
  const correct = selectedIndex === exercise.answer_index;
  return { valid: true, correct, message: correct ? exercise.feedback_correct : exercise.feedback_incorrect };
}

export function shuffleExerciseOptions(exercise, randomFn = Math.random) {
  if (exerciseErrors(exercise).length || typeof randomFn !== 'function') throw new TypeError('Ejercicio o función aleatoria inválidos');
  const copy = structuredClone(exercise);
  for (let i = copy.options.length - 1; i > 0; i--) {
    const value = randomFn();
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value >= 1) throw new TypeError('La función aleatoria debe devolver un número entre 0 (incluido) y 1 (excluido)');
    const j = Math.floor(value * (i + 1));
    [copy.options[i], copy.options[j]] = [copy.options[j], copy.options[i]];
  }
  copy.answer_index = copy.options.indexOf(copy.correct_answer);
  return copy;
}

export function validateLessonCatalog(catalog) {
  const errors = [];
  const courses = coursesOf(catalog);
  const expected = {
    aritmetica: { 'conteo-basico': ['conteo', 1], 'sumas-basicas': ['aritmetica', 2] },
    'geometria-patrones': { figuras: ['geometria', 1], patrones: ['patrones', 2] },
  };
  const ids = new Set();
  const register = (id, label) => {
    if (!text(id) || ids.has(id)) errors.push(`${label}: identificador ausente o repetido`);
    ids.add(id);
  };
  if (courses.length !== 2 || !Object.keys(expected).every(id => courses.some(c => c?.id === id))) errors.push('Se requieren los dos cursos del catálogo');
  const positions = new Set();
  for (const course of courses) {
    register(course?.id, 'Curso');
    if (!text(course?.title) || !text(course?.description)) errors.push('Curso incompleto');
    if (!positive(course?.position) || positions.has(course?.position) || course?.position !== Object.keys(expected).indexOf(course?.id) + 1) errors.push('Posición de curso inválida');
    positions.add(course?.position);
    const lessons = lessonsOf(course);
    const spec = Object.hasOwn(expected, course?.id ?? '') ? expected[course.id] : {};
    if (lessons.length !== 2 || !Object.keys(spec).every(id => lessons.some(l => l?.id === id))) errors.push('Lecciones del curso incompletas');
    const lessonPositions = new Set();
    for (const lesson of lessons) {
      register(lesson?.id, 'Lección');
      const rule = Object.hasOwn(spec, lesson?.id ?? '') ? spec[lesson.id] : null;
      if (!rule || lesson?.module_id !== rule[0]) errors.push('module_id o relación de curso inválidos');
      if (lesson?.course_id !== course?.id || lesson?.base_level !== 1 || !['title', 'objective', 'explanation'].every(key => text(lesson?.[key])) || !text(lesson?.guided_example?.explanation)) errors.push('Lección incompleta');
      if (!positive(lesson?.position) || lessonPositions.has(lesson?.position) || lesson?.position !== rule?.[1]) errors.push('Posición de lección inválida');
      lessonPositions.add(lesson?.position);
      const exercises = Array.isArray(lesson?.exercises) ? lesson.exercises : [];
      if (exercises.length !== 6) errors.push('Cada lección debe tener seis ejercicios');
      for (const exercise of exercises) {
        register(exercise?.id, 'Ejercicio');
        errors.push(...exerciseErrors(exercise).map(error => `${exercise?.id ?? '?'}: ${error}`));
      }
    }
  }
  return { valid: errors.length === 0, errors };
}
