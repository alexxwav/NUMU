// Aislamiento entre cuentas en el MISMO dispositivo (store.js real) y uso correcto de Supabase Auth.
// El aislamiento en la base (RLS) se prueba en tests/db/despliegue-completo.check.mjs. Datos ficticios.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const memory = new Map();
globalThis.localStorage = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, String(v)), removeItem: (k) => memory.delete(k) };
const { store } = await import('../src/state/store.js');
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

function jugarComoAna() {
  store.startSession('ana');
  store.set({ xp: 1350, profile: { completed: true, nickname: 'Ana', score: 4 }, settings: { sound: false } });
  store.addRewards({ gems: 15, stars: 3, xp: 150, levelStars: 3 });
  store.recordLessonRound({ lessonId: 'sumas-basicas', stars: 3, level: 2, adaptive: { lowStreak: 0, lastSignatures: ['x'], weakTypes: ['resolver-resta'] } });
  store.recordModuleRound({ moduleId: 'conteo', stars: 3, level: 1 });
  store.set({ owned: ['frame-gold'] });
}

test('una cuenta nueva no hereda progreso, gemas, XP, compras ni perfil de la anterior', () => {
  jugarComoAna();
  store.endSession(); // signOut
  store.startSession('beto'); // loadProfile de otra cuenta
  const s = store.get();
  assert.deepEqual([s.xp, s.gems, s.owned, s.lessonStars, s.lessonRounds, s.starsByModuleLevel], [0, 0, [], {}, {}, {}]);
  assert.equal(s.profile.completed, false);
  assert.equal(s.profile.nickname, '');
  assert.deepEqual(s.gemsPending, [], 'tampoco recibe recompensas pendientes de Ana');
  assert.equal(s.settings.sound, false, 'solo se conservan los ajustes del dispositivo (sonido, accesibilidad)');
});

test('cambiar de cuenta sin cerrar sesión también limpia el dispositivo', () => {
  jugarComoAna();
  store.startSession('ceci');
  assert.deepEqual([store.get().xp, store.get().gems, store.get().lessonStars], [0, 0, {}]);
});

test('la misma cuenta al volver solo recupera SUS recompensas sin confirmar; el resto llega de la cuenta', () => {
  memory.clear();
  jugarComoAna();
  store.endSession();
  store.startSession('ana');
  assert.equal(store.get().gemsPending.length, 1, 'su recompensa pendiente vuelve para subirse una vez');
  assert.deepEqual(store.get().lessonStars, {}, 'el progreso se vuelve a leer de la cuenta (loadProfile)');
});

test('useAuth: el inicio de sesión aísla por usuario y el cierre limpia el dispositivo', () => {
  const auth = read('../src/hooks/useAuth.jsx');
  assert.match(auth, /store\.startSession\(userId\);/, 'loadProfile empieza por la cuenta de la sesión');
  assert.match(auth, /store\.endSession\(\);/, 'signOut limpia el dispositivo');
  const authService = read('../src/services/authService.js');
  for (const call of ['signUp', 'signInWithPassword', 'signOut', 'getSession', 'onAuthStateChange']) {
    assert.match(authService, new RegExp(`auth\\.${call}\\(`), `Supabase Auth: ${call}`);
  }
});

test('el frontend solo usa la clave pública: ninguna clave secreta en src/', () => {
  const files = [];
  const walk = (dir) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) walk(p); else if (/\.(js|jsx)$/.test(e.name)) files.push(p); } };
  walk(fileURLToPath(new URL('../src', import.meta.url)));
  assert.ok(files.length > 20);
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    assert.doesNotMatch(src, /sb_secret_[A-Za-z0-9]|SERVICE_ROLE_KEY|service_role_key/i, f);
  }
  assert.match(read('../src/lib/supabase.js'), /VITE_SUPABASE_PUBLISHABLE_KEY/);
});
