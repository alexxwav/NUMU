import { requireSupabase } from '../lib/supabase.js';

// Gemas y compras en la cuenta (supabase/propuesta_gemas_transaccional.sql, aún NO aplicada).
//   · comprar_articulo(p_articulo_id, p_clave): cobra el precio del servidor una sola vez.
//   · registrar_gemas_ronda(p_cantidad, p_clave): suma la recompensa de una ronda una sola vez.
//   · compra_tienda: artículos comprados por el usuario con sesión (RLS).
// El saldo de la cuenta es la fuente de verdad. El dispositivo guarda solo las recompensas que aún
// no confirmó la cuenta (store.gemsPending) y las envía con su clave: reintentar no duplica.
// Si los RPC aún no existen (migración sin aplicar), las funciones devuelven `legacy: true` y la app
// usa el guardado anterior SIN devolver gemas gastadas (ver useAuth.jsx).

/** La migración aún no está aplicada (función o tabla inexistente). */
export function isMissingGemsBackend(message = '') {
  return /could not find the function|PGRST202|function .* does not exist|relation .* does not exist|could not find the table|PGRST205|42P01|42883/i.test(message);
}

/** Clave única de una operación (compra o recompensa) para que un reintento no se aplique dos veces. */
export function newGemsKey(prefix = 'op') {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${random}`;
}

const firstRow = (data) => (Array.isArray(data) ? data[0] : data) ?? null;

export function createGemsService(getClient = requireSupabase) {
  return {
    async purchase(itemId, key) {
      const { data, error } = await getClient().rpc('comprar_articulo', { p_articulo_id: itemId, p_clave: key });
      if (error) return { error: error.message, legacy: isMissingGemsBackend(error.message) };
      const row = firstRow(data);
      return { gems: row?.gemas ?? null, purchased: Boolean(row?.comprado), reason: row?.motivo ?? null, error: null, legacy: false };
    },

    async grantRound(amount, key) {
      const { data, error } = await getClient().rpc('registrar_gemas_ronda', { p_cantidad: amount, p_clave: key });
      if (error) return { error: error.message, legacy: isMissingGemsBackend(error.message) };
      const row = firstRow(data);
      return { gems: row?.gemas ?? null, applied: Boolean(row?.aplicada), reason: row?.motivo ?? null, error: null, legacy: false };
    },

    async getOwned() {
      const { data, error } = await getClient().from('compra_tienda').select('articulo_id');
      if (error) return { owned: [], error: error.message, legacy: isMissingGemsBackend(error.message) };
      return { owned: (data ?? []).map((row) => row.articulo_id), error: null, legacy: false };
    },
  };
}

export const gemsService = createGemsService();

/**
 * Envía a la cuenta las recompensas pendientes del dispositivo, una por una y con su clave.
 * @returns {Promise<{balance: number|null, legacy: boolean, error: string|null}>}
 *   balance: saldo de la cuenta tras la última confirmada (null si no había pendientes).
 */
export async function syncPendingGems({ service = gemsService, store }) {
  let balance = null;
  for (const { key, amount } of [...(store.get().gemsPending ?? [])]) {
    const result = await service.grantRound(amount, key);
    // Sin red o sin migración: la recompensa sigue pendiente (no se pierde) y se reintenta después.
    if (result.error) return { balance, legacy: result.legacy, limited: false, error: result.error };
    // Límite anti-abuso del servidor: sigue pendiente; se reintenta más tarde.
    if (result.reason === 'limite') {
      store.applyAccountGems({ balance: result.gems, confirmedKeys: [] });
      return { balance: result.gems, legacy: false, limited: true, error: null };
    }
    // Aplicada ahora o ya aplicada antes (respuesta perdida): en ambos casos queda confirmada.
    balance = result.gems;
    store.applyAccountGems({ balance, confirmedKeys: [key] });
  }
  return { balance, legacy: false, limited: false, error: null };
}

/**
 * Al iniciar sesión: el saldo de la cuenta manda. Se confirman primero las recompensas pendientes y
 * se suman los artículos comprados en la cuenta. Nunca se toma el máximo con el saldo local (así se
 * devolvían gemas gastadas).
 * @param {{remoteGems: number}} params - perfil_usuario.gemas leído al iniciar sesión.
 */
export async function reconcileAccountGems({ service = gemsService, store, remoteGems = 0 }) {
  const synced = await syncPendingGems({ service, store });
  if (synced.legacy) {
    // Migración sin aplicar: saldo de la cuenta + recompensas aún no subidas (sin max).
    store.applyAccountGems({ balance: remoteGems, confirmedKeys: [] });
    return { legacy: true, error: null };
  }
  if (synced.error) return { legacy: false, error: synced.error };
  const { owned, legacy, error } = await service.getOwned();
  store.applyAccountGems({ balance: synced.balance ?? remoteGems, confirmedKeys: [], owned: error ? null : owned });
  return { legacy, error };
}

/**
 * Compra con sesión: la cuenta decide (precio, saldo, una sola vez). Sin migración, compra local.
 * @returns {Promise<{purchased: boolean, reason: string|null, legacy: boolean, error: string|null}>}
 */
export async function purchaseItem({ service = gemsService, store, itemId, price, key = newGemsKey('compra'), saveLegacyGems = null }) {
  const result = await service.purchase(itemId, key);
  if (result.legacy) {
    const before = store.get();
    store.purchase(itemId, price);
    const purchased = store.get().owned.length > before.owned.length;
    if (purchased && saveLegacyGems) {
      // Sin migración, la compra solo es válida si la cuenta guarda el saldo nuevo. Si falla, se
      // deshace en el dispositivo: la interfaz no la muestra como exitosa ni se pierde al reconectar.
      const saved = await saveLegacyGems(store.get().gems);
      if (saved?.error) {
        store.set({ gems: store.get().gems + price, owned: store.get().owned.filter((id) => id !== itemId) });
        return { purchased: false, reason: null, legacy: true, error: saved.error };
      }
    }
    return { purchased, reason: null, legacy: true, error: null };
  }
  if (result.error) return { purchased: false, reason: null, legacy: false, error: result.error };
  const owns = result.purchased || result.reason === 'ya-comprado';
  store.applyAccountGems({ balance: result.gems, confirmedKeys: [], owned: owns ? [itemId] : null });
  return { purchased: result.purchased, reason: result.reason, legacy: false, error: null };
}
