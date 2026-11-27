import { isActiveArea } from '../data/subjects.js';
import { isLessonPlayable } from '../utils/lessonRound.js';

// Separa el login real del cuestionario inicial.
// Rutas PROVISIONALES: '/conocerte' está por acordarse con César y Citlalli
// (hoy el cuestionario vive en '/iniciar-sesion').
export const ROUTES = {
  welcome: '/bienvenida',
  signUp: '/crear-cuenta',
  signIn: '/iniciar-sesion',
  onboarding: '/conocerte',
  home: '/inicio',
};

/**
 * Decide a dónde va el estudiante tras abrir la app o iniciar sesión:
 * sin sesión → login; con sesión y sin cuestionario → onboarding; si no → inicio.
 */
export function resolveStartRoute({ session, profile }) {
  if (!session) return ROUTES.signIn;
  if (!profile?.onboarding_completed) return ROUTES.onboarding;
  return ROUTES.home;
}

/**
 * Destino de «¡Continuar Aventura!» en el inicio:
 *   1. la lección jugada más recientemente (la ronda con la fecha más nueva en lessonRounds),
 *      directo a su práctica, con el nivel que ya tiene esa lección. Si se pasa starsByLesson y esa
 *      lección ya cumple T2 (mejor = 3), no se repite: se va a la siguiente lección no terminada
 *      y jugable de su área (R17); si el área está completa, a la primera recomendación distinta;
 *   2. si todavía no hay rondas, la primera recomendación;
 *   3. si tampoco hay recomendaciones, el juego del módulo elegido (comportamiento anterior).
 * Solo se consideran lecciones publicadas y jugables de las áreas activas: nunca lleva a una
 * práctica bloqueada ni a una lección no publicada.
 * @returns {{route: string, lessonId: string|null,
 *   reason: 'ultima-leccion'|'siguiente-leccion'|'recomendacion'|'modulo'}}
 */
export function resolveContinueRoute({ lessonRounds = {}, catalog, recommendations = [], moduleId = 'conteo', starsByLesson = null } = {}) {
  const entries = (catalog?.courses ?? [])
    .filter((course) => isActiveArea(course.id))
    .flatMap((course) => [...course.lessons].sort((a, b) => a.position - b.position).map((lesson) => ({ lesson, course })));
  const levelOf = (lessonId) => lessonRounds?.[lessonId]?.level ?? 1;
  const playable = new Set(entries.filter(({ lesson }) => isLessonPlayable(lesson, levelOf(lesson.id))).map(({ lesson }) => lesson.id));
  const completed = (lessonId) => starsByLesson !== null && Number(starsByLesson?.[lessonId]) >= 3;
  const timeOf = (round) => {
    const time = Date.parse(round?.at ?? '');
    return Number.isFinite(time) ? time : -Infinity;
  };
  let last = null;
  for (const [lessonId, round] of Object.entries(lessonRounds ?? {})) {
    if (!playable.has(lessonId) || timeOf(round) === -Infinity) continue;
    if (!last || timeOf(round) > timeOf(last.round)) last = { lessonId, round };
  }
  const firstRecommendation = (except = null) => (recommendations ?? [])
    .find((rec) => rec?.route && playable.has(rec.lessonId) && rec.lessonId !== except);

  if (last) {
    if (!completed(last.lessonId)) return { route: lessonPlayPath(last.lessonId), lessonId: last.lessonId, reason: 'ultima-leccion' };
    const area = entries.find((e) => e.lesson.id === last.lessonId).course.id;
    const next = entries.find((e) => e.course.id === area && e.lesson.id !== last.lessonId
      && playable.has(e.lesson.id) && !completed(e.lesson.id));
    if (next) return { route: lessonPlayPath(next.lesson.id), lessonId: next.lesson.id, reason: 'siguiente-leccion' };
    const rec = firstRecommendation(last.lessonId);
    if (rec) return { route: rec.route, lessonId: rec.lessonId, reason: 'recomendacion' };
    return { route: lessonPlayPath(last.lessonId), lessonId: last.lessonId, reason: 'ultima-leccion' };
  }

  const first = firstRecommendation();
  if (first) return { route: first.route, lessonId: first.lessonId, reason: 'recomendacion' };
  return { route: `/jugar/${moduleId}`, lessonId: null, reason: 'modulo' };
}

// Rutas de una lección (ya existen en App.jsx; no se crean rutas nuevas).
// Devuelven null si el id no tiene el formato del catálogo, para no construir rutas inválidas.
const LESSON_ID = /^[a-z0-9-]+$/;

/** Teoría de la lección: /lecciones/:lessonId */
export function lessonTheoryPath(lessonId) {
  return typeof lessonId === 'string' && LESSON_ID.test(lessonId) ? `/lecciones/${lessonId}` : null;
}

/** Práctica de la lección: /lecciones/:lessonId/jugar */
export function lessonPlayPath(lessonId) {
  const theory = lessonTheoryPath(lessonId);
  return theory ? `${theory}/jugar` : null;
}
