// NUMU · 15 alumnos FICTICIOS para pruebas y demostración (datos, sin credenciales).
// Los usa supabase/crear_alumnos_prueba.mjs y los valida tests/alumnosPrueba.test.js.
// Reglas reales del motor: nivel inicial por diagnóstico (R1–R3: 0–1 → 1, 2–3 → 2, 4–5 → 3), nivel
// posterior por rondas (R7 sube con 3★, R10/R11), T2 = mejor marca de 3★. Solo las 4 lecciones
// publicadas tienen progreso; Álgebra (sin prácticas publicadas) aparece solo como interés.
// XP = estrellas de las paradas del mapa × 50 (regla vigente). Gemas = 5 por estrella de cada ronda.

export const TEST_PREFIX = 'NUMU Test';
// Clave de respuestas del diagnóstico de LoginView.jsx (5 preguntas).
export const ANSWER_KEY = [1, 2, 0, 3, 0];
export const COURSE_ID_BY_SLUG = { aritmetica: 4, 'geometria-patrones': 5 }; // ids reales de public.cursos en numu
export const LESSON_MODULE = { 'conteo-basico': 'conteo', 'sumas-basicas': 'aritmetica', figuras: 'geometria', patrones: 'patrones' };
export const LESSON_COURSE = { 'conteo-basico': 'aritmetica', 'sumas-basicas': 'aritmetica', figuras: 'geometria-patrones', patrones: 'geometria-patrones' };
const SELF = { none: 'No sé nada', some: 'Sé un poco', much: 'Sé mucho' };

// lecciones: { leccionId: [mejor, intentos, últimas, nivel] } · mapa: { modulo: { parada: estrellas } }
export const ALUMNOS = [
  { n: 1, apodo: 'Pulpito', edad: 6, grado: '1° de Primaria', intereses: ['aritmetica'], avatar: 0, aciertos: 1, auto: 'none', area: 'Aritmética',
    caso: 'Alumno nuevo sin progreso: empieza en N1 por su diagnóstico', lecciones: {}, mapa: {}, racha: 1 },
  { n: 2, apodo: 'Estrella', edad: 11, grado: '6° de Primaria', intereses: ['algebra', 'aritmetica'], avatar: 1, aciertos: 4, auto: 'much', area: 'Álgebra (interés)',
    caso: 'Nuevo con buen diagnóstico: empieza en N3; Álgebra aparece como «Próximamente»', lecciones: {}, mapa: {}, racha: 1 },
  { n: 3, apodo: 'Burbuja', edad: 7, grado: '2° de Primaria', intereses: ['aritmetica'], avatar: 2, aciertos: 1, auto: 'none', area: 'Aritmética',
    caso: 'Dificultades frecuentes: 1★ y rondas sin aprobar → refuerzo (C2)',
    lecciones: { 'conteo-basico': [1, 4, 0, 1], 'sumas-basicas': [1, 2, 1, 1] }, mapa: { conteo: { 1: 1, 2: 0, 3: 1, 4: 0 }, aritmetica: { 1: 1, 2: 1 } }, racha: 1 },
  { n: 4, apodo: 'Coral', edad: 9, grado: '4° de Primaria', intereses: ['aritmetica', 'geometria'], avatar: 3, aciertos: 3, auto: 'some', area: 'Aritmética',
    caso: 'Bajada de nivel (R11): llegó a N3 en Sumas y bajó a N2 tras dos rondas de 1★',
    lecciones: { 'sumas-basicas': [3, 4, 1, 2] }, mapa: { aritmetica: { 1: 2, 2: 3, 3: 1, 4: 1 } }, racha: 2 },
  { n: 5, apodo: 'Delfín', edad: 8, grado: '3° de Primaria', intereses: ['aritmetica'], avatar: 4, aciertos: 3, auto: 'some', area: 'Aritmética',
    caso: 'Intermedio: Conteo terminado (3★, N3) y Sumas en curso (2★, N2)',
    lecciones: { 'conteo-basico': [3, 2, 3, 3], 'sumas-basicas': [2, 2, 2, 2] }, mapa: { conteo: { 1: 2, 2: 3 }, aritmetica: { 1: 2, 2: 2 } }, racha: 3 },
  { n: 6, apodo: 'Ancla', edad: 10, grado: '5° de Primaria', intereses: ['aritmetica', 'algebra'], avatar: 5, aciertos: 5, auto: 'much', area: 'Aritmética',
    caso: 'Avanzado: terminó las prácticas publicadas de Aritmética → recomienda otra área (C13)',
    lecciones: { 'conteo-basico': [3, 1, 3, 3], 'sumas-basicas': [3, 2, 3, 3] }, mapa: { conteo: { 1: 3 }, aritmetica: { 1: 3, 2: 3 } }, racha: 4 },
  { n: 7, apodo: 'Concha', edad: 6, grado: '1° de Primaria', intereses: ['geometria'], avatar: 6, aciertos: 0, auto: 'none', area: 'Geometría',
    caso: 'Principiante en Geometría: Figuras con 1★ en N1',
    lecciones: { figuras: [1, 2, 1, 1] }, mapa: { geometria: { 1: 0, 2: 1 } }, racha: 1 },
  { n: 8, apodo: 'Marea', edad: 8, grado: '3° de Primaria', intereses: ['geometria'], avatar: 7, aciertos: 2, auto: 'some', area: 'Geometría',
    caso: 'Intermedio en Geometría: Figuras 3★ (sube a N3) y Patrones 2★',
    lecciones: { figuras: [3, 2, 3, 3], patrones: [2, 1, 2, 2] }, mapa: { geometria: { 1: 2, 2: 3 }, patrones: { 1: 2 } }, racha: 2 },
  { n: 9, apodo: 'Ola', edad: 11, grado: '6° de Primaria', intereses: ['geometria', 'algebra'], avatar: 0, aciertos: 5, auto: 'much', area: 'Geometría',
    caso: 'Avanzado: Geometría publicada terminada (Figuras y Patrones 3★, N3)',
    lecciones: { figuras: [3, 1, 3, 3], patrones: [3, 1, 3, 3] }, mapa: { geometria: { 1: 3 }, patrones: { 1: 3 } }, racha: 5 },
  { n: 10, apodo: 'Arena', edad: 9, grado: '4° de Primaria', intereses: ['aritmetica', 'geometria'], avatar: 1, aciertos: 3, auto: 'some', area: 'Mixta',
    caso: 'Progreso parcial en dos áreas: Conteo 3★, Figuras 2★; Sumas y Patrones sin empezar',
    lecciones: { 'conteo-basico': [3, 1, 3, 3], figuras: [2, 1, 2, 2] }, mapa: { conteo: { 1: 3 }, geometria: { 1: 2 } }, racha: 2 },
  { n: 11, apodo: 'Brisa', edad: 8, grado: '3° de Primaria', intereses: ['aritmetica'], avatar: 2, aciertos: 2, auto: 'some', area: 'Aritmética',
    caso: 'Errores en distintos contenidos: Sumas (mejor 2★, última 1★) y Patrones 1★ → refuerzo',
    lecciones: { 'sumas-basicas': [2, 3, 1, 2], patrones: [1, 1, 1, 2] }, mapa: { aritmetica: { 1: 2, 2: 2, 3: 1 }, patrones: { 1: 1 } }, racha: 1 },
  { n: 12, apodo: 'Faro', edad: 12, grado: '6° de Primaria', intereses: ['aritmetica', 'geometria'], avatar: 3, aciertos: 5, auto: 'much', area: 'Mixta',
    caso: 'Lecciones terminadas: las 4 prácticas publicadas con 3★ (las 11 nuevas siguen cerradas)',
    lecciones: { 'conteo-basico': [3, 1, 3, 3], 'sumas-basicas': [3, 1, 3, 3], figuras: [3, 1, 3, 3], patrones: [3, 1, 3, 3] },
    mapa: { conteo: { 1: 3 }, aritmetica: { 1: 3 }, geometria: { 1: 3 }, patrones: { 1: 3 } }, racha: 6 },
  { n: 13, apodo: 'Brújula', edad: 12, grado: '1° de Secundaria', intereses: ['algebra'], avatar: 4, aciertos: 4, auto: 'much', area: 'Álgebra (interés)',
    caso: 'Prefiere Álgebra (aún sin práctica): avanzado en Sumas (3★, N3) mientras tanto',
    lecciones: { 'sumas-basicas': [3, 1, 3, 3] }, mapa: { aritmetica: { 1: 3 } }, racha: 2 },
  { n: 14, apodo: 'Perla', edad: 7, grado: '2° de Primaria', intereses: ['aritmetica', 'geometria'], avatar: 5, aciertos: 2, auto: 'some', area: 'Geometría',
    caso: 'Vidas agotadas (R10): Patrones con 0★ académicas; Figuras 1★',
    lecciones: { patrones: [0, 1, 0, 2], figuras: [1, 1, 1, 2] }, mapa: { patrones: { 1: 0 }, geometria: { 1: 1 } }, racha: 1 },
  { n: 15, apodo: 'Timón', edad: 10, grado: '5° de Primaria', intereses: ['geometria', 'aritmetica'], avatar: 6, aciertos: 3, auto: 'some', area: 'Mixta',
    caso: 'Constante e intermedio: 2★ en las 4 lecciones (N2), racha de 5 días',
    lecciones: { 'conteo-basico': [2, 2, 2, 2], 'sumas-basicas': [2, 2, 2, 2], figuras: [2, 2, 2, 2], patrones: [2, 2, 2, 2] },
    mapa: { conteo: { 1: 2, 2: 2 }, aritmetica: { 1: 2, 2: 2 }, geometria: { 1: 2, 2: 2 }, patrones: { 1: 2, 2: 2 } }, racha: 5 },
];

const id2 = (n) => String(n).padStart(2, '0');
/** Respuestas del diagnóstico con exactamente `aciertos` correctas (las primeras), el resto incorrectas. */
export function respuestas(aciertos) {
  return ANSWER_KEY.map((correct, i) => (i < aciertos ? correct : (correct + 1) % 4));
}
const sumStars = (mapa) => Object.values(mapa).reduce((t, paradas) => t + Object.values(paradas).reduce((a, b) => a + b, 0), 0);

/** Filas para Supabase de un alumno (sin usuario_id ni credenciales). */
export function filasAlumno(a, { now = new Date('2026-11-27T12:00:00Z') } = {}) {
  const day = 24 * 3600 * 1000;
  const estrellasMapa = sumStars(a.mapa);
  return {
    email: (base) => base(id2(a.n)),
    perfil: {
      nombre: `${TEST_PREFIX} ${id2(a.n)}`, apodo: a.apodo, edad: a.edad, pais: 'México', grado_escolar: a.grado,
      avatar: a.avatar, intereses: a.intereses, xp: estrellasMapa * 50, gemas: estrellasMapa * 5,
    },
    diagnostico: {
      num_aciertos: a.aciertos, puntuacion: Math.round((a.aciertos / ANSWER_KEY.length) * 100),
      autoevaluacion: SELF[a.auto], respuestas: respuestas(a.aciertos),
    },
    lecciones: Object.entries(a.lecciones).map(([leccion_id, [estrellas, intentos, ultimas, nivel]], i) => ({
      leccion_id, estrellas, intentos, ultimas_estrellas: ultimas, nivel, ultimo_intento: new Date(now - (i + 1) * day).toISOString(),
    })),
    modulos: Object.entries(a.mapa).map(([module_id, paradas]) => ({
      module_id, current_level: Object.keys(paradas).length + 1, stars_by_level: paradas,
    })),
    cursos: Object.entries(Object.entries(a.mapa).reduce((acc, [mod, paradas]) => {
      const slug = mod === 'conteo' || mod === 'aritmetica' ? 'aritmetica' : 'geometria-patrones';
      const stops = Object.values(paradas);
      acc[slug] = acc[slug] ?? { estrellas: 0, intentos: 0 };
      acc[slug].estrellas += stops.reduce((x, y) => x + y, 0);
      acc[slug].intentos += stops.length;
      return acc;
    }, {})).map(([slug, v]) => ({
      curso_id: COURSE_ID_BY_SLUG[slug], nivel_actual: v.intentos + 1, num_estrellas: v.estrellas, num_intentos: v.intentos,
      racha_dias: a.racha, leccion_completada: Object.entries(a.lecciones).some(([id, [best]]) => LESSON_COURSE[id] === slug && best === 3),
    })),
  };
}
