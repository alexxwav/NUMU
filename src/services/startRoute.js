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
 *      directo a su práctica, con el nivel que ya tiene esa lección;
 *   2. si todavía no hay rondas, la primera recomendación;
 *   3. si tampoco hay recomendaciones, el juego del módulo elegido (comportamiento anterior).
 * Solo se consideran lecciones que existen en el catálogo publicado.
 * @returns {{route: string, lessonId: string|null, reason: 'ultima-leccion'|'recomendacion'|'modulo'}}
 */
export function resolveContinueRoute({ lessonRounds = {}, catalog, recommendations = [], moduleId = 'conteo' } = {}) {
  const lessonIds = new Set((catalog?.courses ?? []).flatMap((course) => course.lessons.map((lesson) => lesson.id)));
  const timeOf = (round) => {
    const time = Date.parse(round?.at ?? '');
    return Number.isFinite(time) ? time : -Infinity;
  };
  let last = null;
  for (const [lessonId, round] of Object.entries(lessonRounds ?? {})) {
    if (!lessonIds.has(lessonId) || timeOf(round) === -Infinity) continue;
    if (!last || timeOf(round) > timeOf(last.round)) last = { lessonId, round };
  }
  if (last) return { route: `/lecciones/${last.lessonId}/jugar`, lessonId: last.lessonId, reason: 'ultima-leccion' };

  const [first] = recommendations ?? [];
  if (first?.route && lessonIds.has(first.lessonId)) {
    return { route: first.route, lessonId: first.lessonId, reason: 'recomendacion' };
  }
  return { route: `/jugar/${moduleId}`, lessonId: null, reason: 'modulo' };
}
