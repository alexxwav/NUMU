// La app integrada contra el proyecto numu ANTES de aplicar las migraciones: Supabase (PostgREST)
// responde con estos errores reales. Los servicios deben reconocerlos y usar su respaldo sin perder
// progreso ni gemas. Cliente simulado con los mensajes exactos de PostgREST; sin conexión real.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLessonProgressService } from '../src/services/lessonProgressService.js';
import { createGemsService, isMissingGemsBackend } from '../src/services/gemsService.js';

// Mensajes tal como los devuelve PostgREST (código + texto).
const ERR = {
  rpcLeccion3: { code: 'PGRST202', message: 'Could not find the function public.registrar_resultado_leccion(p_estrellas, p_leccion_id, p_nivel) in the schema cache' },
  columna: { code: '42703', message: 'column progreso_leccion.ultimas_estrellas does not exist' },
  rpcCompra: { code: 'PGRST202', message: 'Could not find the function public.comprar_articulo(p_articulo_id, p_clave) in the schema cache' },
  rpcRonda: { code: 'PGRST202', message: 'Could not find the function public.registrar_gemas_ronda(p_cantidad, p_clave) in the schema cache' },
  tablaCompras: { code: 'PGRST205', message: "Could not find the table 'public.compra_tienda' in the schema cache" },
  sinPermiso: { code: '42501', message: 'permission denied for table perfil_usuario' },
};

function clienteSimulado({ rpc = [], select = [] } = {}) {
  const calls = [];
  const rpcs = [...rpc]; const selects = [...select];
  const query = (table) => {
    const q = {
      select(columns) { calls.push(['select', table, columns]); return q; },
      eq() { return q; },
      maybeSingle() { return Promise.resolve(selects.shift() ?? { data: null, error: null }); },
      then(resolve, reject) { return Promise.resolve(selects.shift() ?? { data: [], error: null }).then(resolve, reject); },
    };
    return q;
  };
  return {
    calls,
    rpc(name, args) { calls.push(['rpc', name, args]); return Promise.resolve(rpcs.shift() ?? { data: null, error: null }); },
    from: query,
  };
}
const profiles = { currentUsuarioId: async () => ({ usuarioId: 7, error: null }) };

test('progreso por lección: sin la migración de nivel, guarda con el RPC de 2 parámetros (app publicada)', async () => {
  const client = clienteSimulado({ rpc: [{ data: null, error: ERR.rpcLeccion3 }, { data: { estrellas: 3, intentos: 2 }, error: null }] });
  const saved = await createLessonProgressService(() => client, profiles).saveLessonResult({ lessonId: 'sumas-basicas', stars: 3, level: 2 });
  assert.equal(saved.error, null);
  assert.equal(saved.stars, 3);
  assert.deepEqual(client.calls.map((c) => c[2]), [
    { p_leccion_id: 'sumas-basicas', p_estrellas: 3, p_nivel: 2 },
    { p_leccion_id: 'sumas-basicas', p_estrellas: 3 },
  ], 'reintenta sin p_nivel');
});

test('progreso por lección: sin las columnas nuevas, lee las columnas de siempre', async () => {
  const client = clienteSimulado({ select: [
    { data: null, error: ERR.columna },
    { data: [{ leccion_id: 'figuras', estrellas: 3, intentos: 4 }], error: null },
  ] });
  const progress = await createLessonProgressService(() => client, profiles).getLessonProgress();
  assert.equal(progress.error, null);
  assert.deepEqual(progress.starsByLesson, { figuras: 3 });
  assert.equal(client.calls.filter((c) => c[0] === 'select').length, 2);
});

test('gemas: sin la migración, la app reconoce los errores reales y usa el modo anterior', async () => {
  for (const e of [ERR.rpcCompra, ERR.rpcRonda, ERR.tablaCompras]) assert.equal(isMissingGemsBackend(e.message), true, e.code);
  assert.equal(isMissingGemsBackend(ERR.sinPermiso.message), false, 'un permiso denegado NO se toma como «sin migración»');
  const client = clienteSimulado({ rpc: [{ data: null, error: ERR.rpcCompra }, { data: null, error: ERR.rpcRonda }], select: [{ data: null, error: ERR.tablaCompras }] });
  const service = createGemsService(() => client);
  assert.equal((await service.purchase('frame-gold', 'compra-0000000001')).legacy, true);
  assert.equal((await service.grantRound(15, 'ronda-0000000001')).legacy, true);
  assert.equal((await service.getOwned()).legacy, true);
});

test('gemas: con la migración, lee la respuesta real de los RPC (tabla de una fila)', async () => {
  const client = clienteSimulado({ rpc: [
    { data: [{ gemas: 40, comprado: true, motivo: 'comprado' }], error: null },
    { data: [{ gemas: 55, aplicada: true, motivo: 'aplicada' }], error: null },
  ], select: [{ data: [{ articulo_id: 'frame-gold' }], error: null }] });
  const service = createGemsService(() => client);
  assert.deepEqual(await service.purchase('frame-gold', 'compra-0000000001'), { gems: 40, purchased: true, reason: 'comprado', error: null, legacy: false });
  assert.deepEqual(await service.grantRound(15, 'ronda-0000000001'), { gems: 55, applied: true, reason: 'aplicada', error: null, legacy: false });
  assert.deepEqual(await service.getOwned(), { owned: ['frame-gold'], error: null, legacy: false });
  assert.deepEqual(client.calls[0], ['rpc', 'comprar_articulo', { p_articulo_id: 'frame-gold', p_clave: 'compra-0000000001' }]);
  assert.deepEqual(client.calls[1], ['rpc', 'registrar_gemas_ronda', { p_cantidad: 15, p_clave: 'ronda-0000000001' }]);
});
