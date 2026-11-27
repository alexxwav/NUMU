// Protección de la XP histórica y del mapa antiguo durante la transición a 5 paradas por área.
// Funciones puras: no guardan nada ni cambian reglas de XP. Son la base de la propuesta para
// store.js y useAuth.jsx (archivos congelados) y de supabase/propuesta_xp_monotona.sql.
//
// Situación actual (rama base): store.js y useAuth.jsx REEMPLAZAN la XP por getTotalXp(state),
// que solo cuenta las estrellas de las paradas del mapa × 50. Un usuario con XP ganada antes
// (rondas anteriores, otro dispositivo) puede ver su XP bajar, y useAuth la guarda así en
// perfil_usuario.xp. Estas funciones garantizan que la XP mostrada y guardada nunca baje.
//
// Reglas:
//  · La XP nunca disminuye: siempre el máximo entre la guardada, la local y la derivada del mapa.
//  · Las gemas NO se protegen así: bajan legítimamente al comprar en la tienda.
//  · El mapa antiguo de 10 paradas se conserva como historial de solo lectura.
//  · Una parada antigua nunca cuenta como lección académica terminada (T2 sale de lessonStars).
//  · La transición no otorga recompensas: ni XP, ni gemas, ni estrellas.

const LEGACY_MODULES = Object.freeze(['conteo', 'aritmetica', 'geometria', 'patrones']);
const XP_PER_LEGACY_STAR = 50; // valor que ya usa store.js (XP_PER_STAR); no es una regla nueva

const nonNegativeInt = (value) => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const clampStars = (value) => Math.max(0, Math.min(3, Math.round(Number(value) || 0)));

/** XP que nunca baja: el máximo de los valores conocidos (los inválidos cuentan como 0). */
export function monotonicXp(...values) {
  return values.reduce((max, value) => Math.max(max, nonNegativeInt(value)), 0);
}

/**
 * XP a mostrar y guardar al reconciliar fuentes (inicio de sesión, ronda terminada, cambio de mapa).
 * @param {{remoteXp?: number, localXp?: number, derivedXp?: number}} sources
 *   remoteXp: perfil_usuario.xp · localXp: state.xp del dispositivo · derivedXp: getTotalXp(state).
 */
export function reconcileXp({ remoteXp = 0, localXp = 0, derivedXp = 0 } = {}) {
  return monotonicXp(remoteXp, localXp, derivedXp);
}

/** Estrellas de una parada antigua del mapa (mejor por parada), sin alterar los datos. */
function legacyStarsOf(starsByModuleLevel = {}, moduleId) {
  const byLevel = starsByModuleLevel?.[moduleId] ?? {};
  return Object.values(byLevel ?? {}).reduce((sum, stars) => sum + clampStars(stars), 0);
}

/**
 * Historial de solo lectura del mapa antiguo (10 paradas por sección), tal como está guardado.
 * Devuelve copias congeladas: quien lo consuma no puede modificarlo por accidente.
 */
export function legacyMapHistory(state = {}) {
  const sections = LEGACY_MODULES.map((moduleId) => Object.freeze({
    moduleId,
    currentStop: nonNegativeInt(state.levelByModule?.[moduleId]) || 1,
    starsByStop: Object.freeze({ ...(state.starsByModuleLevel?.[moduleId] ?? {}) }),
    stars: legacyStarsOf(state.starsByModuleLevel, moduleId),
  }));
  const stars = sections.reduce((sum, s) => sum + s.stars, 0);
  return Object.freeze({ sections: Object.freeze(sections), stars, derivedXp: stars * XP_PER_LEGACY_STAR });
}

/**
 * Estado del alumno al pasar del mapa de 10 paradas al de 5 por área. NO otorga recompensas:
 * · xp: la histórica protegida (nunca menor que antes, ni que la derivada del mapa antiguo).
 * · gems y lessonStars: exactamente las mismas.
 * · legacyHistory: el mapa antiguo intacto, de solo lectura.
 * · completedLessonIds: SOLO desde lessonStars (T2); las paradas antiguas no completan lecciones.
 */
export function mapTransition(state = {}, { remoteXp = 0 } = {}) {
  const legacyHistory = legacyMapHistory(state);
  const lessonStars = { ...(state.lessonStars ?? {}) };
  return {
    xp: reconcileXp({ remoteXp, localXp: state.xp, derivedXp: legacyHistory.derivedXp }),
    gems: nonNegativeInt(state.gems),
    lessonStars,
    completedLessonIds: Object.keys(lessonStars).filter((id) => clampStars(lessonStars[id]) === 3),
    legacyHistory,
    rewardsGranted: { xp: 0, gems: 0, stars: 0 },
  };
}

/**
 * Evita conceder dos veces las recompensas de la misma ronda (doble clic, doble llamada).
 * @returns {(roundId: string, grant: () => void) => boolean} true si concedió; false si ya estaba.
 */
export function createRewardGate() {
  const granted = new Set();
  return (roundId, grant) => {
    if (!roundId || granted.has(roundId)) return false;
    granted.add(roundId);
    grant();
    return true;
  };
}
