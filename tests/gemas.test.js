// Gemas y compras: reproducción del error y solución transaccional (gemsService + store reales).
// La cuenta se simula en memoria con la MISMA lógica que supabase/propuesta_gemas_transaccional.sql
// (probada aparte en tests/db/gemas-transaccional.check.mjs). Alumnos y dispositivos ficticios.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Cada «dispositivo» tiene su propio localStorage y su propia copia de store.js.
const storages = new Map();
let current = null;
globalThis.localStorage = {
  getItem: (k) => storages.get(current)?.get(k) ?? null,
  setItem: (k, v) => storages.get(current)?.set(k, String(v)),
  removeItem: (k) => storages.get(current)?.delete(k),
};
let imports = 0;
async function device(name, seed = null) {
  if (!storages.has(name)) storages.set(name, new Map(seed ? [['numu-state-v1', JSON.stringify(seed)]] : []));
  current = name;
  const { store } = await import(`../src/state/store.js?dispositivo=${name}-${++imports}`);
  return { name, store, use() { current = name; return store; } };
}
const { syncPendingGems, reconcileAccountGems, purchaseItem, isMissingGemsBackend } = await import('../src/services/gemsService.js');

// Precios: los de la app (Avatar.js) y los de la migración deben ser los mismos (no se inventan).
const avatarSource = readFileSync(new URL('../src/components/Avatar.js', import.meta.url), 'utf8');
const sqlSource = readFileSync(new URL('../supabase/propuesta_gemas_transaccional.sql', import.meta.url), 'utf8');
const APP_PRICES = Object.fromEntries([...avatarSource.matchAll(/id: '(frame-[a-z]+)', name: '[^']+', price: (\d+)/g)].map((m) => [m[1], Number(m[2])]));
const SQL_PRICES = Object.fromEntries([...sqlSource.matchAll(/\('(frame-[a-z]+)', (\d+)\)/g)].map((m) => [m[1], Number(m[2])]));

// Cuenta simulada (misma lógica que los RPC comprar_articulo y registrar_gemas_ronda).
function cuentaSimulada(gems, { limitPerHour = 60 } = {}) {
  const acc = { gems, owned: new Set(), keys: new Set(), rewards: 0, ledger: [{ tipo: 'saldo_inicial', cantidad: gems }] };
  acc.service = {
    async purchase(itemId, key) {
      if (!/^compra-[A-Za-z0-9-]{8,80}$/.test(key)) return { error: 'Clave inválida', legacy: false };
      const price = SQL_PRICES[itemId];
      if (!price) return { error: `Artículo inexistente: ${itemId}`, legacy: false };
      if (acc.keys.has(key) || acc.owned.has(itemId)) return { gems: acc.gems, purchased: false, reason: 'ya-comprado', error: null, legacy: false };
      if (acc.gems < price) return { gems: acc.gems, purchased: false, reason: 'gemas-insuficientes', error: null, legacy: false };
      acc.gems -= price; acc.owned.add(itemId); acc.keys.add(key); acc.ledger.push({ tipo: 'compra', cantidad: -price });
      return { gems: acc.gems, purchased: true, reason: 'comprado', error: null, legacy: false };
    },
    async grantRound(amount, key) {
      if (!/^ronda-[A-Za-z0-9-]{8,80}$/.test(key)) return { error: 'Clave inválida', legacy: false };
      if (![0, 5, 10, 15].includes(amount)) return { error: 'Recompensa fuera de la regla vigente', legacy: false };
      if (acc.keys.has(key)) return { gems: acc.gems, applied: false, reason: 'repetida', error: null, legacy: false };
      if (acc.rewards >= limitPerHour) return { gems: acc.gems, applied: false, reason: 'limite', error: null, legacy: false };
      acc.gems += amount; acc.keys.add(key); acc.rewards++; acc.ledger.push({ tipo: 'recompensa', cantidad: amount });
      return { gems: acc.gems, applied: true, reason: 'aplicada', error: null, legacy: false };
    },
    async getOwned() { return { owned: [...acc.owned], error: null, legacy: false }; },
  };
  return acc;
}
// Supabase sin la migración aplicada: los RPC no existen.
const sinMigracion = {
  async purchase() { return { error: 'Could not find the function public.comprar_articulo (PGRST202)', legacy: true }; },
  async grantRound() { return { error: 'Could not find the function public.registrar_gemas_ronda (PGRST202)', legacy: true }; },
  async getOwned() { return { owned: [], error: 'relation "public.compra_tienda" does not exist', legacy: true }; },
};
const ALUMNA = { userId: 'alumna-ficticia', gems: 100, xp: 1200, levelByModule: { conteo: 3 }, starsByModuleLevel: { conteo: { 1: 3, 2: 2 } }, lessonStars: { 'sumas-basicas': 3 }, owned: [] };
// Iniciar sesión como hace useAuth.loadProfile (perfil remoto + reconcileAccountGems).
async function iniciarSesion(dev, acc, service = acc.service) {
  const store = dev.use();
  store.startSession('alumna-ficticia');
  await reconcileAccountGems({ service, store, remoteGems: acc.gems });
  return store.get();
}
const progress = (s) => JSON.stringify([s.xp, s.stars, s.level, s.levelByModule, s.starsByModuleLevel, s.lessonStars]);

test('los precios de la migración son exactamente los de la tienda (Avatar.js)', () => {
  assert.equal(Object.keys(APP_PRICES).length, 6);
  assert.deepEqual(SQL_PRICES, APP_PRICES);
});

test('ERROR ANTERIOR reproducido: comprar solo en el dispositivo + max() al iniciar sesión devuelve las gemas', async () => {
  const dev = await device('antes', ALUMNA);
  const store = dev.use();
  store.purchase('frame-gold', 60);                       // ShopView → store.purchase (no llega a la cuenta)
  assert.equal(store.get().gems, 40);
  const remote = 100;                                     // la cuenta nunca supo de la compra
  assert.equal(Math.max(store.get().gems, remote), 100, 'loadProfile anterior: max(local, cuenta) → 100');
  const auth = readFileSync(new URL('../src/hooks/useAuth.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(auth, /Math\.max\(local\.gems, profile\.gems\)/, 'useAuth ya no toma el máximo de gemas');
  assert.match(auth, /reconcileAccountGems\(\{ service: gemsService, store, remoteGems: profile\.gems \}\)/);
});

test('1 · comprar descuenta una sola vez (doble clic y reintento incluidos)', async () => {
  const acc = cuentaSimulada(100);
  const dev = await device('uno', ALUMNA);
  const store = dev.use();
  const [a, b] = await Promise.all([
    purchaseItem({ service: acc.service, store, itemId: 'frame-gold', price: 60 }),
    purchaseItem({ service: acc.service, store, itemId: 'frame-gold', price: 60 }),
  ]);
  assert.deepEqual([a.purchased, b.purchased, b.reason], [true, false, 'ya-comprado']);
  assert.deepEqual([acc.gems, store.get().gems], [40, 40]);
  assert.deepEqual(store.get().owned, ['frame-gold']);
  const retry = await purchaseItem({ service: acc.service, store, itemId: 'frame-gold', price: 60, key: 'compra-misma-clave-01' });
  assert.equal(retry.purchased, false);
  assert.equal(acc.gems, 40, 'ni otro clic ni un reintento vuelven a cobrar');
});

test('2 · cerrar e iniciar sesión no devuelve gemas gastadas', async () => {
  const acc = cuentaSimulada(100);
  const dev = await device('dos', ALUMNA);
  await purchaseItem({ service: acc.service, store: dev.use(), itemId: 'frame-gold', price: 60 });
  dev.use().endSession();
  const after = await iniciarSesion(dev, acc);
  assert.equal(after.gems, 40);
  assert.deepEqual(after.owned, ['frame-gold'], 'el artículo comprado vuelve desde la cuenta');
});

test('3 · recargar no restaura compras anteriores', async () => {
  const acc = cuentaSimulada(100);
  const dev = await device('tres', ALUMNA);
  await purchaseItem({ service: acc.service, store: dev.use(), itemId: 'frame-mint', price: 40 });
  const reloaded = await device('tres');                 // misma memoria, nueva copia de store.js
  assert.equal(reloaded.use().get().gems, 60);
  const synced = await iniciarSesion(reloaded, acc);       // al recargar con sesión también se reconcilia
  assert.deepEqual([synced.gems, synced.owned], [60, ['frame-mint']]);
});

test('4 · una cuenta en dos dispositivos conserva un saldo consistente', async () => {
  const acc = cuentaSimulada(100);
  const tablet = await device('tablet', ALUMNA);
  const phone = await device('telefono', ALUMNA);
  await iniciarSesion(tablet, acc); await iniciarSesion(phone, acc);
  tablet.use().addRewards({ gems: 15, stars: 3, xp: 150, levelStars: 3 });          // ronda en la tablet
  await syncPendingGems({ service: acc.service, store: tablet.use() });               // recordRound
  await purchaseItem({ service: acc.service, store: phone.use(), itemId: 'frame-indigo', price: 50 }); // compra en el teléfono
  assert.equal(acc.gems, 65, '100 + 15 − 50');
  assert.equal((await iniciarSesion(tablet, acc)).gems, 65);
  assert.equal((await iniciarSesion(phone, acc)).gems, 65);
  assert.deepEqual(tablet.use().get().owned, ['frame-indigo'], 'la tablet también ve el marco comprado');
});

test('5 · no se pueden gastar las mismas gemas dos veces con compras simultáneas', async () => {
  const acc = cuentaSimulada(40);
  const tablet = await device('tablet-5', { ...ALUMNA, gems: 40 });
  const phone = await device('telefono-5', { ...ALUMNA, gems: 40 });
  const [t, p] = await Promise.all([
    purchaseItem({ service: acc.service, store: tablet.use(), itemId: 'frame-mint', price: 40 }),
    purchaseItem({ service: acc.service, store: phone.use(), itemId: 'frame-cyan', price: 40 }),
  ]);
  assert.deepEqual([t.purchased, p.purchased, p.reason], [true, false, 'gemas-insuficientes']);
  assert.equal(acc.gems, 0);
  assert.equal(phone.use().get().gems, 0, 'el teléfono se corrige con el saldo de la cuenta');
});

test('6 · las recompensas legítimas se suman una sola vez (aunque se reintente o se cierre sesión)', async () => {
  const acc = cuentaSimulada(10);
  const dev = await device('seis', { ...ALUMNA, gems: 10 });
  const store = dev.use();
  store.addRewards({ gems: 15, stars: 3, xp: 150, levelStars: 3 });
  store.addRewards({ gems: 10, stars: 2, xp: 100, levelStars: 2 });
  assert.equal(store.get().gems, 35, 'se ven al momento en el dispositivo');
  assert.equal(store.get().gemsPending.length, 2);
  // Falla la red a la mitad: la primera se confirma, la segunda queda pendiente.
  let calls = 0;
  const flaky = { ...acc.service, grantRound: (n, k) => (++calls === 2 ? Promise.resolve({ error: 'sin red', legacy: false }) : acc.service.grantRound(n, k)) };
  await syncPendingGems({ service: flaky, store });
  assert.deepEqual([acc.gems, store.get().gems, store.get().gemsPending.length], [25, 35, 1]);
  await syncPendingGems({ service: acc.service, store });
  await syncPendingGems({ service: acc.service, store }); // reintento sin pendientes: no suma
  assert.deepEqual([acc.gems, store.get().gems, store.get().gemsPending.length], [35, 35, 0]);
  store.addRewards({ gems: 0, stars: 0, xp: 0, levelStars: 0 });
  assert.equal(store.get().gemsPending.length, 0, 'una ronda de 0 estrellas no crea pendientes');
});

test('7 · comprar y sincronizar gemas no cambia XP, estrellas, niveles ni el mapa', async () => {
  const acc = cuentaSimulada(100);
  const dev = await device('siete', ALUMNA);
  const store = dev.use();
  const before = progress(store.get());
  await purchaseItem({ service: acc.service, store, itemId: 'frame-coral', price: 30 });
  await iniciarSesion(dev, acc);
  assert.equal(progress(store.get()), before);
  assert.equal(store.get().xp, 1200);
});

test('8 · no se pierden gemas históricas: el saldo de la cuenta se conserva tal cual', async () => {
  const acc = cuentaSimulada(340);
  const dev = await device('ocho', { ...ALUMNA, gems: 0 });   // dispositivo nuevo sin datos
  assert.equal((await iniciarSesion(dev, acc)).gems, 340);
  assert.deepEqual(acc.ledger, [{ tipo: 'saldo_inicial', cantidad: 340 }]);
});

test('sin la migración aplicada: compra local, se guarda al momento y el inicio de sesión no usa max()', async () => {
  assert.equal(isMissingGemsBackend('Could not find the function public.comprar_articulo (PGRST202)'), true);
  const dev = await device('legacy', ALUMNA);
  const store = dev.use();
  const r = await purchaseItem({ service: sinMigracion, store, itemId: 'frame-gold', price: 60 });
  assert.deepEqual([r.purchased, r.legacy, store.get().gems], [true, true, 40]);
  const auth = readFileSync(new URL('../src/hooks/useAuth.jsx', import.meta.url), 'utf8');
  assert.match(auth, /saveLegacyGems: \(gems\) => profileService\.saveProfile\(\{ gems \}\)/,
    'useAuth guarda el saldo en la cuenta en cuanto compra');
  // La cuenta ya tiene 40 (guardado al momento) y el dispositivo tenía una recompensa sin subir.
  store.addRewards({ gems: 15, stars: 3, xp: 150, levelStars: 3 });
  store.startSession('alumna-ficticia');
  await reconcileAccountGems({ service: sinMigracion, store, remoteGems: 40 });
  assert.equal(store.get().gems, 55, 'saldo de la cuenta (40) + recompensa pendiente (15), sin max()');
});

test('la tienda compra a través de useAuth y bloquea el doble clic', () => {
  const shop = readFileSync(new URL('../src/views/ShopView.jsx', import.meta.url), 'utf8');
  assert.match(shop, /const \{ purchase \} = useAuth\(\);/);
  assert.match(shop, /if \(buyingRef\.current\) return;\s*buyingRef\.current = true;/);
  assert.doesNotMatch(shop, /store\.purchase\(/, 'ya no compra directo en el dispositivo');
});

test('seguridad · el tope del servidor deja las recompensas pendientes (no se pierden ni se duplican)', async () => {
  const acc = cuentaSimulada(0, { limitPerHour: 2 });
  const dev = await device('limite', { ...ALUMNA, gems: 0 });
  const store = dev.use();
  for (let i = 0; i < 3; i++) store.addRewards({ gems: 15, stars: 3, xp: 150, levelStars: 3 });
  const r = await syncPendingGems({ service: acc.service, store });
  assert.equal(r.limited, true);
  assert.deepEqual([acc.gems, store.get().gemsPending.length, store.get().gems], [30, 1, 45], 'la tercera queda pendiente y se sigue viendo');
  acc.rewards = 0; // pasó la hora
  await syncPendingGems({ service: acc.service, store });
  await syncPendingGems({ service: acc.service, store });
  assert.deepEqual([acc.gems, store.get().gemsPending.length, store.get().gems], [45, 0, 45]);
});

test('seguridad · cerrar sesión sin red no pierde recompensas; al volver se envían una sola vez', async () => {
  const acc = cuentaSimulada(10);
  const dev = await device('reconectar', { ...ALUMNA, gems: 10 });
  const store = dev.use();
  store.addRewards({ gems: 15, stars: 3, xp: 150, levelStars: 3 });
  const offline = { ...acc.service, grantRound: async () => ({ error: 'sin red', legacy: false }) };
  await syncPendingGems({ service: offline, store });        // signOut intenta subirlas y falla
  store.endSession();
  assert.equal(store.get().gemsPending.length, 0, 'el dispositivo queda limpio…');
  assert.equal(store.get().pendingGemsByUser['alumna-ficticia'].length, 1, '…pero la recompensa se aparta para su cuenta');
  store.startSession('otra-cuenta');
  assert.equal(store.get().gemsPending.length, 0, 'otra cuenta no recibe recompensas ajenas');
  store.endSession();
  const back = await iniciarSesion(dev, acc);
  assert.deepEqual([acc.gems, back.gems, back.gemsPending.length], [25, 25, 0]);
  await iniciarSesion(dev, acc);
  assert.equal(acc.gems, 25, 'volver a iniciar sesión no la suma otra vez');
});

test('seguridad · una compra fallida no aparece como exitosa', async () => {
  const acc = cuentaSimulada(20);
  const dev = await device('fallida', { ...ALUMNA, gems: 20 });
  const store = dev.use();
  const poor = await purchaseItem({ service: acc.service, store, itemId: 'frame-gold', price: 60 });
  assert.deepEqual([poor.purchased, poor.reason, store.get().gems, store.get().owned], [false, 'gemas-insuficientes', 20, []]);
  const down = { ...acc.service, purchase: async () => ({ error: 'sin red', legacy: false }) };
  const offline = await purchaseItem({ service: down, store, itemId: 'frame-coral', price: 30 });
  assert.deepEqual([offline.purchased, store.get().owned], [false, []]);
  // Sin migración: compra local, pero si la cuenta no guarda el saldo, se deshace.
  const legacyStore = (await device('fallida-legacy', { ...ALUMNA, gems: 100 })).use();
  const failed = await purchaseItem({ service: sinMigracion, store: legacyStore, itemId: 'frame-gold', price: 60,
    saveLegacyGems: async () => ({ error: 'sin red' }) });
  assert.deepEqual([failed.purchased, legacyStore.get().gems, legacyStore.get().owned], [false, 100, []]);
  const shop = readFileSync(new URL('../src/views/ShopView.jsx', import.meta.url), 'utf8');
  assert.match(shop, /if \(purchased\) \{\s*store\.set\(\{ profile: \{ frame: item\.id \} \}\);/, 'solo se equipa si la compra fue exitosa');
});
