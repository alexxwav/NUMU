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
