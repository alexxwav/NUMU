/** Catálogo editorial: { courses: [{ ..., lessons: [{ ..., exercises: [] }] }] }.
 * Las búsquedas devuelven null/[] si no encuentran datos. La evaluación devuelve
 * { valid, correct, message }; la mezcla rechaza entradas inválidas con TypeError.
 * La validación devuelve { valid, errors } sin modificar el catálogo.
 */
const text = value => typeof value === 'string' && value.trim().length > 0;
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

export function isLessonPublished(lesson) {
  return Boolean(lesson && lesson.published !== false);
}

export function getLessonsForCourse(catalog, courseId, { includeUnpublished = false } = {}) {
  return lessonsOf(getCourseById(catalog, courseId))
    .filter(lesson => includeUnpublished || isLessonPublished(lesson))
    .sort((a, b) => a.position - b.position);
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

const catalogOrder = {
  aritmetica: ['conteo-basico', 'sumas-basicas', 'cuantos-quedan', 'grupos-iguales', 'repartimos-por-igual'],
  'geometria-patrones': ['figuras', 'patrones', 'la-mitad-del-espejo', 'una-vuelta-al-contorno', 'llenamos-el-mosaico'],
  algebra: ['escaleras-de-numeros', 'la-balanza-de-numu', 'el-numero-escondido', 'la-maquina-de-reglas', 'de-un-dibujo-a-una-regla'],
};
const publishedModules = {
  'conteo-basico': 'conteo', 'sumas-basicas': 'aritmetica', figuras: 'geometria', patrones: 'patrones',
};

export function validateLessonCatalog(catalog) {
  const errors = [];
  const courses = coursesOf(catalog);
  const courseIds = Object.keys(catalogOrder);
  const ids = new Set();
  const register = (id, label) => {
    if (!text(id) || ids.has(id)) errors.push(`${label}: identificador ausente o repetido`);
    ids.add(id);
  };
  if (courses.length !== courseIds.length) errors.push('Se requieren las tres áreas del catálogo');
  for (const [courseIndex, course] of courses.entries()) {
    register(course?.id, 'Curso');
    if (!text(course?.title) || !text(course?.description)) errors.push('Curso incompleto');
    if (course?.id !== courseIds[courseIndex] || course?.position !== courseIndex + 1) errors.push('Posición de curso inválida');
    const lessons = lessonsOf(course);
    const order = catalogOrder[courseIds[courseIndex]] ?? [];
    if (lessons.length !== order.length) errors.push('Lecciones del curso incompletas');
    for (const [lessonIndex, lesson] of lessons.entries()) {
      register(lesson?.id, 'Lección');
      const module = publishedModules[order[lessonIndex]];
      if (lesson?.published !== Boolean(module) || lesson?.module_id !== module) errors.push('Publicación o módulo de lección inválidos');
      if (lesson?.course_id !== course?.id || lesson?.base_level !== 1 || !['title', 'objective', 'explanation'].every(key => text(lesson?.[key])) || !text(lesson?.guided_example?.explanation) || !text(lesson?.guided_example?.visual?.type)) errors.push('Lección incompleta');
      if (lesson?.id !== order[lessonIndex] || lesson?.position !== lessonIndex + 1) errors.push('Posición de lección inválida');

      // El motor actual conserva el banco original. Los niveles pueden referenciar sus mismos ejercicios.
      const legacy = new Map();
      if (module) {
        if (lesson?.exercises?.length !== 6) errors.push('El banco original debe tener seis ejercicios');
        for (const exercise of Array.isArray(lesson?.exercises) ? lesson.exercises : []) {
          register(exercise?.id, 'Ejercicio');
          legacy.set(exercise?.id, JSON.stringify(exercise));
          errors.push(...exerciseErrors(exercise).map(error => `${exercise?.id ?? '?'}: ${error}`));
        }
      } else if (lesson?.exercises !== undefined) {
        errors.push('El banco editorial debe estar dentro de los niveles');
      }

      const levels = lesson?.levels ?? {};
      if (Object.keys(levels).join() !== '1,2,3') errors.push('Se requieren los niveles 1, 2 y 3');
      for (const level of ['1', '2', '3']) {
        const bank = levels[level];
        const generator = bank?.generator_key;
        if (generator !== undefined && (!module || generator !== module || module === 'geometria')) errors.push('Generador inválido');
        if (!Array.isArray(bank?.exercise_types) || !bank.exercise_types.length || !bank.exercise_types.every(text)) errors.push('Tipos de ejercicio inválidos');
        if (!Array.isArray(bank?.exercises) || (generator === undefined && bank.exercises.length < 6)) errors.push('Banco de nivel incompleto');
        const bankIds = new Set();
        for (const exercise of Array.isArray(bank?.exercises) ? bank.exercises : []) {
          const id = exercise?.id;
          if (bankIds.has(id)) errors.push(`${id}: ejercicio repetido en el nivel`);
          bankIds.add(id);
          if (legacy.has(id)) {
            if (JSON.stringify(exercise) !== legacy.get(id)) errors.push(`${id}: el ejercicio difiere del banco original`);
          } else {
            register(id, 'Ejercicio');
            errors.push(...exerciseErrors(exercise).map(error => `${id ?? '?'}: ${error}`));
          }
        }
      }
    }
  }
  return { valid: errors.length === 0, errors };
}
