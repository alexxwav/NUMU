const STORAGE_KEY = 'numu-state-v1';

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
  owned: [],
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

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    return deepMerge(DEFAULT_STATE, JSON.parse(raw));
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
      state = { ...structuredClone(DEFAULT_STATE), settings, userId };
    }
    return store.set(patch);
  },

  endSession() {
    const { settings } = state;
    state = { ...structuredClone(DEFAULT_STATE), settings };
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

  purchase(itemId, price) {
    if (state.owned.includes(itemId) || state.gems < price) return state;
    return store.set({ gems: state.gems - price, owned: [...state.owned, itemId] });
  },

  /* ---- Acciones de gamificación ---- */

  loseLife() {
    return store.set({ lives: Math.max(0, state.lives - 1) });
  },

  restoreLives() {
    return store.set({ lives: state.maxLives });
  },

  addRewards({ gems = 0, stars = 0, xp = 0, levelStars = null }) {
    const patch = {
      gems: state.gems + gems,
      stars: state.stars + stars,
      xp: state.xp + xp,
    };
    if (levelStars !== null) {
      patch.starsByLevel = { ...state.starsByLevel, [state.level]: Math.max(state.starsByLevel[state.level] ?? 0, levelStars) };
    }
    return store.set(patch);
  },

  completeLevel() {
    return store.set({ level: state.level + 1 });
  },
};

export const MODULES = [
  { id: 'conteo', name: 'Conteo', color: 'bg-cyan-ocean', shadow: 'shadow-3d-cyan', iconKey: 'countIcon' },
  { id: 'aritmetica', name: 'Aritmética', color: 'bg-orange-energy', shadow: 'shadow-3d-orange', iconKey: 'plusMinus' },
  { id: 'geometria', name: 'Geometría', color: 'bg-mint-success', shadow: 'shadow-3d-success', iconKey: 'shapes' },
  { id: 'patrones', name: 'Patrones', color: 'bg-numu-purple', shadow: 'shadow-3d-primary', iconKey: 'pattern' },
];
