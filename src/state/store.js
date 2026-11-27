import { mergeLessonProgress, clampLessonLevel } from '../utils/lessonLevel.js';
import { normalizeModuleId } from '../data/subjects.js';
import { reconcileXp } from '../utils/xpProtection.js';

const STORAGE_KEY = 'numu-state-v1';

// Las 4 rutas del mapa; el total de estrellas se deriva de sus paradas, no de las lecciones.
export const MODULE_IDS = ['conteo', 'aritmetica', 'geometria', 'patrones'];
export const XP_PER_STAR = 50;

/** Clave única de una recompensa de gemas (idempotencia en registrar_gemas_ronda). */
function newRewardKey() {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `ronda-${random}`;
}

const DEFAULT_STATE = {
  userId: null,
  lives: 5,
  maxLives: 5,
  streak: 1,
  gems: 0,
  stars: 0,
  xp: 0,
  level: 1,
  module: 'conteo',
  starsByLevel: {},
  // Progreso independiente de cada sección del mapa (/inicio):
  //   levelByModule:     { [moduleId]: parada actual (empieza en 1) }.
  //   starsByModuleLevel: { [moduleId]: { [parada]: mejores estrellas (0 a 3) } }.
  levelByModule: {},
  starsByModuleLevel: {},
  lessonStars: {},
  // Última ronda y nivel académico por lección: { [lessonId]: { latestStars, level, at } }.
  lessonRounds: {},
  owned: [],
  // Recompensas de gemas aún no confirmadas por la cuenta: [{ key, amount }].
  gemsPending: [],
  // Pendientes de cuentas que cerraron sesión sin confirmarlas: { [userId]: [{ key, amount }] }.
  pendingGemsByUser: {},
  profile: {
    completed: false,
    name: '',
    age: '',
    country: '',
    grade: '',
    interests: [],
    level: '',
    score: 0,
    avatar: 0,
    frame: null,
    nickname: '',
  },
  settings: {
    sound: true,
    volume: 0.8,
    colorblind: false,
    reduceMotion: false,
    fontScale: 1,
  },
};

function deepMerge(base, saved) {
  if (typeof base !== 'object' || base === null) {
    return saved === undefined ? base : saved;
  }
  const result = { ...base };
  if (typeof saved !== 'object' || saved === null) return result;
  for (const key of Object.keys(saved)) {
    if (
      typeof base[key] === 'object' && base[key] !== null && !Array.isArray(base[key]) &&
      typeof saved[key] === 'object' && saved[key] !== null && !Array.isArray(saved[key])
    ) {
      result[key] = deepMerge(base[key], saved[key]);
    } else if (saved[key] !== undefined) {
      result[key] = saved[key];
    }
  }
  return result;
}

function clampModuleLevel(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function clampModuleStars(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(3, Math.round(n))) : 0;
}

/** Normaliza un objeto { [parada]: estrellas } que viene de localStorage o de Supabase. */
function cleanModuleStars(raw = {}) {
  const result = {};
  let source = raw;
  if (typeof source === 'string') {
    try { source = JSON.parse(source); } catch { return result; }
  }
  if (!source || typeof source !== 'object' || Array.isArray(source)) return result;
  for (const [level, stars] of Object.entries(source)) {
    const key = clampModuleLevel(level);
    result[key] = Math.max(result[key] ?? 0, clampModuleStars(stars));
  }
  return result;
}

/** Estrellas reales de una ruta: suma de la mejor puntuación de cada parada. */
export function getModuleStars(state, moduleId) {
  const id = normalizeModuleId(moduleId);
  if (!id) return 0;
  const byLevel = cleanModuleStars(state?.starsByModuleLevel?.[id]);
  return Object.values(byLevel).reduce((total, value) => total + value, 0);
}

/** Total global: estrellas de las paradas de las 4 rutas (conteo, aritmética, geometría y patrones). */
export function getTotalModuleStars(state) {
  return MODULE_IDS.reduce((total, id) => total + getModuleStars(state, id), 0);
}

/** Cada estrella de una parada vale exactamente 50 XP. */
export function getTotalXp(state) {
  return getTotalModuleStars(state) * XP_PER_STAR;
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const saved = deepMerge(DEFAULT_STATE, JSON.parse(raw));
    // La XP guardada nunca baja al recalcular las estrellas del mapa (xpProtection.js).
    return { ...saved, stars: getTotalModuleStars(saved), xp: reconcileXp({ localXp: saved.xp, derivedXp: getTotalXp(saved) }) };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

let state = load();
const listeners = new Set();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage no disponible: la app sigue funcionando en memoria */
  }
}

function emit() {
  for (const listener of listeners) listener(state);
}

export const store = {
  get() {
    return state;
  },

  set(partial) {
    state = deepMerge(state, partial);
    persist();
    emit();
    return state;
  },

  update(fn) {
    const next = fn({ ...state }) ?? {};
    state = deepMerge(state, next);
    persist();
    emit();
    return state;
  },

  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  reset() {
    const { profile, settings, owned } = state;
    state = { ...structuredClone(DEFAULT_STATE), profile, settings, owned };
    persist();
    emit();
    return state;
  },

  /* ---- Cuenta ---- */

  // Asocia el estado a una cuenta. Si entra otra cuenta, empieza de cero (conserva los ajustes).
  startSession(userId, patch = {}) {
    if (state.userId !== userId) {
      const { settings } = state;
      // Recompensas que esta cuenta no alcanzó a subir antes de cerrar sesión: se recuperan para
      // enviarlas (con su misma clave, sin duplicar). Las de otras cuentas se quedan guardadas.
      const { [userId]: ownPending = [], ...othersPending } = state.pendingGemsByUser ?? {};
      state = { ...structuredClone(DEFAULT_STATE), settings, userId, gemsPending: ownPending, pendingGemsByUser: othersPending };
    }
    return store.set(patch);
  },

  endSession() {
    const { settings } = state;
    // No se pierden recompensas sin confirmar: se apartan por cuenta hasta su próximo inicio de sesión.
    const pendingGemsByUser = { ...(state.pendingGemsByUser ?? {}) };
    if (state.userId && state.gemsPending?.length) {
      pendingGemsByUser[state.userId] = [...(pendingGemsByUser[state.userId] ?? []), ...state.gemsPending];
    }
    state = { ...structuredClone(DEFAULT_STATE), settings, pendingGemsByUser };
    persist();
    emit();
    return state;
  },

  /* ---- Onboarding / perfil ---- */

  completeOnboarding(profilePatch) {
    const profile = { ...state.profile, ...profilePatch, completed: true };
    const derivedLevel = Math.min(3, 1 + Math.floor((profile.score ?? 0) / 2));
    return store.set({
      profile,
      level: derivedLevel,
      module: profile.interests?.[0] ?? state.module,
    });
  },

  /* ---- Tienda / premios ---- */

  /** Compra local (sin cuenta o sin la migración de gemas). Con cuenta: gemsService.purchaseItem. */
  purchase(itemId, price) {
    if (state.owned.includes(itemId) || state.gems < price) return state;
    return store.set({ gems: state.gems - price, owned: [...state.owned, itemId] });
  },

  /**
   * Aplica el saldo que devolvió la cuenta (fuente de verdad). Quita las recompensas ya confirmadas
   * y suma las que siguen pendientes en este dispositivo. Los artículos de la cuenta se agregan.
   * @param {{balance: number, confirmedKeys?: string[], owned?: string[]|null}} account
   */
  applyAccountGems({ balance, confirmedKeys = [], owned = null } = {}) {
    const confirmed = new Set(confirmedKeys);
    const gemsPending = (state.gemsPending ?? []).filter((entry) => !confirmed.has(entry.key));
    const pendingTotal = gemsPending.reduce((total, entry) => total + entry.amount, 0);
    const safeBalance = Math.max(0, Math.floor(Number(balance) || 0));
    return store.set({
      gems: safeBalance + pendingTotal,
      gemsPending,
      owned: owned ? [...new Set([...state.owned, ...owned])] : state.owned,
    });
  },

  /* ---- Acciones de gamificación ---- */

  loseLife() {
    return store.set({ lives: Math.max(0, state.lives - 1) });
  },

  restoreLives() {
    return store.set({ lives: state.maxLives });
  },

  addRewards({ gems = 0, stars = 0, xp = 0, levelStars = null }) {
    // La XP NO se suma aquí: la regla vigente es +50 por estrella MEJORADA en una parada del mapa
    // (recordModuleRound). Antes, este valor se sobrescribía con la XP derivada; ahora que la XP
    // guardada se conserva, sumarlo crearía una regla nueva (XP por repetir o por lecciones nuevas).
    void xp;
    const patch = {
      gems: state.gems + gems,
      stars: state.stars + stars,
    };
    // Las gemas de la ronda quedan pendientes (con una clave única) hasta que la cuenta las confirme:
    // así un reintento o un segundo dispositivo no las suma dos veces (gemsService.syncPendingGems).
    if (gems > 0) patch.gemsPending = [...(state.gemsPending ?? []), { key: newRewardKey(), amount: gems }];
    if (levelStars !== null) {
      patch.starsByLevel = { ...state.starsByLevel, [state.level]: Math.max(state.starsByLevel[state.level] ?? 0, levelStars) };
    }
    return store.set(patch);
  },

  completeLevel() {
    return store.set({ level: state.level + 1 });
  },

  /* ---- Progreso del mapa por sección (conteo, aritmética, geometría, patrones) ---- */

  /**
   * Registra en el dispositivo la ronda terminada de una sección.
   * La parada actual nunca retrocede: repetir una parada ya completada no avanza.
   * @param {{moduleId: string, stars: number, level?: number}} round
   *        `level` es la parada que se acaba de terminar; por defecto la actual.
   */
  recordModuleRound({ moduleId, stars, level } = {}) {
    const id = normalizeModuleId(moduleId);
    if (!id) return state;
    const earned = clampModuleStars(stars);
    const current = clampModuleLevel(state.levelByModule[id] ?? 1);
    const finished = level === undefined ? current : clampModuleLevel(level);
    const next = Math.max(current, finished + 1);
    const byLevel = cleanModuleStars(state.starsByModuleLevel[id]);
    byLevel[finished] = Math.max(byLevel[finished] ?? 0, earned);
    const starsByModuleLevel = { ...state.starsByModuleLevel, [id]: byLevel };
    // Se suma solo lo que sube la XP derivada (estrellas mejoradas × 50), sobre la XP guardada.
    const derivedBefore = getTotalXp(state);
    const derivedAfter = getTotalXp({ ...state, starsByModuleLevel });
    return store.set({
      levelByModule: { ...state.levelByModule, [id]: next },
      starsByModuleLevel,
      stars: getTotalModuleStars({ ...state, starsByModuleLevel }),
      xp: reconcileXp({ localXp: state.xp + Math.max(0, derivedAfter - derivedBefore), derivedXp: derivedAfter }),
    });
  },

  /**
   * Combina el progreso leído de Supabase con el local: gana el mayor nivel y
   * la mejor puntuación de cada parada. No borra rondas recientes del dispositivo.
   * @param {{levelByModule?: Object, starsByModuleLevel?: Object}} remote
   */
  applyModuleProgress(remote = {}) {
    const levels = { ...state.levelByModule };
    const stars = {};
    for (const id of Object.keys(state.starsByModuleLevel)) stars[id] = cleanModuleStars(state.starsByModuleLevel[id]);

    for (const [rawId, value] of Object.entries(remote.levelByModule ?? {})) {
      const id = normalizeModuleId(rawId);
      if (!id) continue;
      levels[id] = Math.max(clampModuleLevel(levels[id] ?? 1), clampModuleLevel(value));
    }
    for (const [rawId, value] of Object.entries(remote.starsByModuleLevel ?? {})) {
      const id = normalizeModuleId(rawId);
      if (!id) continue;
      const merged = cleanModuleStars(stars[id]);
      for (const [level, earned] of Object.entries(cleanModuleStars(value))) {
        merged[level] = Math.max(merged[level] ?? 0, earned);
      }
      stars[id] = merged;
    }
    return store.set({
      levelByModule: levels,
      starsByModuleLevel: stars,
      stars: getTotalModuleStars({ ...state, starsByModuleLevel: stars }),
      // Combinar con otro dispositivo no otorga XP ni la reduce: el máximo conocido.
      xp: reconcileXp({ localXp: state.xp, derivedXp: getTotalXp({ ...state, starsByModuleLevel: stars }) }),
    });
  },

  /* ---- Progreso por lección ---- */

  /**
   * Guarda las estrellas de una lección conservando la mejor puntuación.
   * @param {string} lessonId - Id del catálogo editorial.
   * @param {number} stars - Estrellas ganadas (0 a 3).
   */
  setLessonStars(lessonId, stars) {
    if (!lessonId) return state;
    const earned = Math.max(0, Math.min(3, Math.round(Number(stars) || 0)));
    const best = Math.max(state.lessonStars[lessonId] ?? 0, earned);
    return store.set({ lessonStars: { ...state.lessonStars, [lessonId]: best } });
  },

  /**
   * Registra en el dispositivo una ronda terminada de una lección: la mejor puntuación no baja,
   * la última ronda y el nivel académico se reemplazan (con su fecha para combinar con Supabase).
   * `adaptive` es la memoria del motor para la próxima ronda (solo en el dispositivo):
   * { lowStreak, lastSignatures, weakTypes } (R11, no repetir la ronda anterior, refuerzo).
   * @param {{lessonId: string, stars: number, level: number, at?: string, adaptive?: Object}} round
   */
  recordLessonRound({ lessonId, stars, level, at = new Date().toISOString(), adaptive = null } = {}) {
    if (!lessonId) return state;
    const earned = Math.max(0, Math.min(3, Math.round(Number(stars) || 0)));
    const previous = state.lessonRounds?.[lessonId] ?? {};
    const memory = adaptive ? {
      lowStreak: Math.max(0, Math.floor(Number(adaptive.lowStreak) || 0)),
      lastSignatures: Array.isArray(adaptive.lastSignatures) ? adaptive.lastSignatures.slice(0, 12) : [],
      weakTypes: Array.isArray(adaptive.weakTypes) ? adaptive.weakTypes.slice(0, 2) : [],
    } : {};
    return store.set({
      lessonStars: { ...state.lessonStars, [lessonId]: Math.max(state.lessonStars[lessonId] ?? 0, earned) },
      lessonRounds: { ...state.lessonRounds, [lessonId]: { ...previous, ...memory, latestStars: earned, level: clampLessonLevel(level), at } },
    });
  },

  /**
   * Combina el progreso leído de Supabase con el del dispositivo sin perder lo más reciente
   * (ver mergeLessonProgress en utils/lessonLevel.js).
   * @param {{stars?: Record<string, number>, rounds?: Record<string, Object>}} remote
   */
  applyLessonProgress(remote = {}) {
    const merged = mergeLessonProgress({ stars: state.lessonStars, rounds: state.lessonRounds }, remote);
    return store.set({ lessonStars: merged.stars, lessonRounds: merged.rounds });
  },
};

export const MODULES = [
  { id: 'conteo', name: 'Conteo', color: 'bg-cyan-ocean', shadow: 'shadow-3d-cyan', iconKey: 'countIcon' },
  { id: 'aritmetica', name: 'Aritmética', color: 'bg-orange-energy', shadow: 'shadow-3d-orange', iconKey: 'plusMinus' },
  { id: 'geometria', name: 'Geometría', color: 'bg-mint-success', shadow: 'shadow-3d-success', iconKey: 'shapes' },
  { id: 'patrones', name: 'Patrones', color: 'bg-numu-purple', shadow: 'shadow-3d-primary', iconKey: 'pattern' },
];
