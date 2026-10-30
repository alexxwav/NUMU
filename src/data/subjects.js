// IDs canónicos compartidos entre el frontend y Supabase.

/** Generadores de src/state/questions.js; coinciden con lessons.module_id. */
export const MODULE_IDS = ['conteo', 'aritmetica', 'geometria', 'patrones'];

// IDs que hoy usan Home.jsx y LoginView.jsx y que questions.js no reconoce.
const MODULE_ALIASES = { sumas: 'aritmetica', formas: 'geometria' };

/** Devuelve el ID de generador canónico, o null si no existe. */
export function normalizeModuleId(id) {
  const canonical = MODULE_ALIASES[id] ?? id;
  return MODULE_IDS.includes(canonical) ? canonical : null;
}

// Curso (cursos.slug en numu) al que pertenece cada generador.
const MODULE_COURSE = {
  conteo: 'aritmetica',
  aritmetica: 'aritmetica',
  geometria: 'geometria-patrones',
  patrones: 'geometria-patrones',
};

/** Curso de un módulo, aceptando también los alias viejos; null si no existe. */
export function courseSlugForModule(id) {
  return MODULE_COURSE[normalizeModuleId(id)] ?? null;
}

/**
 * Intereses del diseño original (Actividad 5, 24-09-2026).
 * Solo dos tienen curso en el MVP; Álgebra y Trigonometría quedan sin curso.
 */
export const INTERESTS = [
  { id: 'aritmetica', name: 'Aritmética', courseId: 'aritmetica' },
  { id: 'geometria', name: 'Geometría', courseId: 'geometria-patrones' },
  { id: 'algebra', name: 'Álgebra', courseId: null },
  { id: 'trigonometria', name: 'Trigonometría', courseId: null },
];

// Intereses que hoy ofrece LoginView.jsx, traducidos al vocabulario del diseño.
const INTEREST_ALIASES = { conteo: 'aritmetica', sumas: 'aritmetica', formas: 'geometria' };

/** Traduce y depura una lista de intereses, sin duplicados y en el orden elegido. */
export function normalizeInterests(list = []) {
  const known = new Set(INTERESTS.map((i) => i.id));
  const result = [];
  for (const raw of list) {
    const id = INTEREST_ALIASES[raw] ?? raw;
    if (known.has(id) && !result.includes(id)) result.push(id);
  }
  return result;
}

/**
 * PROPUESTA R2 (pendiente de validación de Dante): recomendar el primer
 * interés elegido que tenga curso; null si ninguno lo tiene.
 */
export function recommendedCourseId(interests = []) {
  for (const id of normalizeInterests(interests)) {
    const interest = INTERESTS.find((i) => i.id === id);
    if (interest?.courseId) return interest.courseId;
  }
  return null;
}
