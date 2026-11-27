// Prueba supabase/propuesta_gemas_transaccional.sql en Postgres en memoria (PGlite), con datos ficticios.
// No se conecta a Supabase. Reproduce usuarios/perfil_usuario con usuario_actual() y sus políticas RLS
// (como propuesta_numu_auth.sql) y aplica también propuesta_xp_monotona.sql para comprobar que conviven.
// Limitación: PGlite tiene una sola conexión; la concurrencia real la resuelve el FOR UPDATE de Postgres.
// Aquí se prueban las compras intercaladas, los reintentos y el doble gasto desde dos «dispositivos».
// Uso: node tests/db/gemas-transaccional.check.mjs
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const sql = (name) => readFileSync(join(root, 'supabase', name), 'utf8');
const db = new PGlite();
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  ✔', name); } else { fail++; console.log('  ✖', name, extra); }
};
const q = async (text, params) => (await db.query(text, params)).rows;
const asUser = async (id) => { await db.exec('reset role'); await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [id]); await db.exec('set role authenticated'); };
const asAdmin = async () => { await db.exec('reset role'); };
const fails = async (fn) => { try { await fn(); return false; } catch { return true; } };

await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  create table public.usuarios (id serial primary key, correo text, auth_id uuid unique references auth.users (id));
  create function public.usuario_actual() returns integer language sql stable security definer set search_path = '' as
    $$ select id from public.usuarios where auth_id = auth.uid() $$;
  grant execute on function public.usuario_actual() to authenticated;
  create table public.perfil_usuario (
    id serial primary key, usuario_id integer not null unique references public.usuarios (id),
    apodo text, xp integer not null default 0, gemas integer not null default 0
  );
  alter table public.perfil_usuario enable row level security;
  create policy "perfil: leer el propio" on public.perfil_usuario for select to authenticated using (usuario_id = (select public.usuario_actual()));
  create policy "perfil: crear el propio" on public.perfil_usuario for insert to authenticated with check (usuario_id = (select public.usuario_actual()));
  create policy "perfil: actualizar el propio" on public.perfil_usuario for update to authenticated
    using (usuario_id = (select public.usuario_actual())) with check (usuario_id = (select public.usuario_actual()));
  grant select, insert, update on public.perfil_usuario to authenticated;
  grant usage on all sequences in schema public to authenticated;
`);
const [A] = await q(`insert into auth.users (email) values ('a@prueba.mx') returning id`);
const [B] = await q(`insert into auth.users (email) values ('b@prueba.mx') returning id`);
const [ua] = await q(`insert into public.usuarios (correo, auth_id) values ('a', $1) returning id`, [A.id]);
const [ub] = await q(`insert into public.usuarios (correo, auth_id) values ('b', $1) returning id`, [B.id]);
// Perfiles existentes (ficticios): Ana con 100 gemas y 1200 XP; Beto con 25 gemas.
await q(`insert into public.perfil_usuario (usuario_id, apodo, xp, gemas) values ($1, 'Ana', 1200, 100), ($2, 'Beto', 300, 25)`, [ua.id, ub.id]);
const before = await q(`select usuario_id, apodo, xp, gemas from public.perfil_usuario order by usuario_id`);

console.log('Aplicación');
try { await db.exec(sql('propuesta_xp_monotona.sql')); await db.exec(sql('propuesta_gemas_transaccional.sql')); ok('se aplica sin errores (junto con la XP monótona)', true); }
catch (e) { ok('se aplica sin errores', false, e.message); process.exit(1); }
ok('no cambia ningún saldo ni perfil (gemas históricas intactas)', JSON.stringify(await q(`select usuario_id, apodo, xp, gemas from public.perfil_usuario order by usuario_id`)) === JSON.stringify(before));
try { await db.exec(sql('propuesta_gemas_transaccional.sql')); ok('se puede volver a ejecutar', true); }
catch (e) { ok('se puede volver a ejecutar', false, e.message); }
const initial = await q(`select usuario_id, cantidad, saldo from public.movimiento_gemas where tipo = 'saldo_inicial' order by usuario_id`);
ok('un saldo inicial por perfil, igual a sus gemas', initial.length === 2 && initial[0].saldo === 100 && initial[1].saldo === 25);
ok('6 artículos con los precios de la app', JSON.stringify(await q(`select id, precio from public.articulo_tienda order by id`)) ===
  JSON.stringify([{ id: 'frame-coral', precio: 30 }, { id: 'frame-cyan', precio: 40 }, { id: 'frame-gold', precio: 60 }, { id: 'frame-indigo', precio: 50 }, { id: 'frame-mint', precio: 40 }, { id: 'frame-orange', precio: 30 }]));

const buy = (item, key) => q(`select * from public.comprar_articulo($1, $2)`, [item, key]).then((r) => r[0]);
const reward = (n, key) => q(`select * from public.registrar_gemas_ronda($1, $2)`, [n, key]).then((r) => r[0]);
const balance = async (u) => { await asAdmin(); const [r] = await q(`select gemas from public.perfil_usuario where usuario_id = $1`, [u]); return r.gemas; };

console.log('Comprar descuenta una sola vez');
await asUser(A.id);
const first = await buy('frame-gold', 'compra-00000001');
ok('compra el Marco Dorado: 100 → 40', first.comprado === true && first.gemas === 40 && first.motivo === 'comprado');
await asUser(A.id);
const retry = await buy('frame-gold', 'compra-00000001');
ok('reintento con la misma clave: no cobra otra vez (40)', retry.comprado === false && retry.gemas === 40 && retry.motivo === 'ya-comprado');
const again = await buy('frame-gold', 'compra-00000002');
ok('el mismo artículo con otra clave (doble clic): no cobra otra vez', again.comprado === false && again.gemas === 40);
const poor = await buy('frame-indigo', 'compra-00000003');
ok('sin gemas suficientes (40 < 50): no compra ni descuenta', poor.comprado === false && poor.motivo === 'gemas-insuficientes' && poor.gemas === 40);
ok('artículo inexistente: error', await fails(() => buy('frame-falso', 'compra-00000004')));
ok('el precio lo pone el servidor (el cliente no lo envía)', (await q(`select precio from public.compra_tienda where articulo_id = 'frame-gold'`))[0].precio === 60);

console.log('Doble gasto desde dos dispositivos (compras intercaladas)');
await asUser(A.id);
const tablet = await buy('frame-mint', 'compra-tablet-0001');   // 40 → 0
const phone = await buy('frame-cyan', 'compra-telefono-01');  // ya no alcanza
ok('la primera compra gasta las 40 gemas', tablet.comprado === true && tablet.gemas === 0);
ok('la segunda, con las mismas gemas, se rechaza', phone.comprado === false && phone.motivo === 'gemas-insuficientes');
ok('el saldo nunca es negativo', (await balance(ua.id)) === 0);
await asAdmin();
ok('la base rechaza un saldo negativo aunque lo intente el administrador', await fails(() => q(`update public.perfil_usuario set gemas = -1 where usuario_id = $1`, [ua.id])));

console.log('Recompensas legítimas');
await asUser(A.id);
const r1 = await reward(15, 'ronda-00000001');
ok('una ronda de 3 estrellas suma 15', r1.aplicada === true && r1.gemas === 15);
await asUser(A.id);
const r1b = await reward(15, 'ronda-00000001');
ok('reintentar la misma ronda no suma otra vez', r1b.aplicada === false && r1b.gemas === 15);
const r2 = await reward(10, 'ronda-00000002');
ok('otra ronda (2 estrellas) suma 10 → 25', r2.gemas === 25);
const r0 = await reward(0, 'ronda-00000003');
ok('una ronda de 0 estrellas se registra con 0', r0.aplicada === true && r0.gemas === 25);
ok('una recompensa fuera de la regla vigente (16) se rechaza', await fails(() => reward(16, 'ronda-0000000x')));
await asUser(A.id);
ok('una recompensa negativa se rechaza', await fails(() => reward(-5, 'ronda-0000000y')));

console.log('Origen y límites de las recompensas');
await asUser(A.id);
ok('una cantidad que no sale de la regla (7) se rechaza', await fails(() => reward(7, 'ronda-00000007')));
await asUser(A.id);
ok('una clave con otro formato se rechaza', await fails(() => reward(5, 'inventada')));
await asUser(A.id);
ok('una compra con clave de otro formato se rechaza', await fails(() => buy('frame-coral', 'x')));
await asAdmin();
const saldoAntes = await balance(ua.id);
await asUser(A.id);
let aplicadas = 0, limitada = null;
for (let i = 0; i < 62; i++) {
  const r = await reward(5, `ronda-limite-${String(i).padStart(4, '0')}`);
  if (r.aplicada) aplicadas++; else limitada = limitada ?? r.motivo;
}
ok('como máximo 60 recompensas por hora (A ya tenía 3: entran 57); el resto: «limite»', aplicadas === 57 && limitada === 'limite', `(aplicadas: ${aplicadas}, motivo: ${limitada})`);
ok('el tope acota lo que se puede pedir inventando claves', (await balance(ua.id)) === saldoAntes + 57 * 5);
await asAdmin();
await q(`update public.movimiento_gemas set created_at = now() - interval '2 hours' where usuario_id = $1 and tipo = 'recompensa'`, [ua.id]);
await asUser(A.id);
ok('pasada la hora se vuelve a aceptar', (await reward(5, 'ronda-despues-0001')).aplicada === true);
await asAdmin();
const saldoLimpio = await balance(ua.id);
// Deja el saldo de A como estaba para las pruebas siguientes (solo el administrador puede).
await q(`update public.perfil_usuario set gemas = 25 where usuario_id = $1`, [ua.id]);
await q(`delete from public.movimiento_gemas where usuario_id = $1 and (clave like 'ronda-limite-%' or clave = 'ronda-despues-0001')`, [ua.id]);
ok('(preparación) saldo restablecido por el administrador', saldoLimpio > 25 && (await balance(ua.id)) === 25);

console.log('El saldo no se puede escribir desde el cliente');
await asUser(A.id);
const [direct] = await q(`update public.perfil_usuario set gemas = 9999, xp = 1500 where usuario_id = $1 returning gemas, xp`, [ua.id]);
ok('un update directo no cambia las gemas (25) pero sí guarda la XP mayor', direct.gemas === 25 && direct.xp === 1500);
const [upsert] = await q(`insert into public.perfil_usuario (usuario_id, xp, gemas) values ($1, 100, 500)
  on conflict (usuario_id) do update set xp = excluded.xp, gemas = excluded.gemas returning gemas, xp`, [ua.id]);
ok('el upsert absoluto de la app vieja tampoco (25) y la XP no baja (1500)', upsert.gemas === 25 && upsert.xp === 1500);
ok('el cliente no puede insertar movimientos', await fails(() => q(`insert into public.movimiento_gemas (usuario_id, tipo, cantidad, clave, saldo) values ($1, 'recompensa', 999, 'x', 999)`, [ua.id])));
await asUser(A.id);
ok('ni insertar compras sin pagar', await fails(() => q(`insert into public.compra_tienda (usuario_id, articulo_id, precio) values ($1, 'frame-coral', 30)`, [ua.id])));

console.log('Perfiles nuevos');
await asAdmin();
const [C] = await q(`insert into auth.users (email) values ('c@prueba.mx') returning id`);
const [uc] = await q(`insert into public.usuarios (correo, auth_id) values ('c', $1) returning id`, [C.id]);
await asUser(C.id);
const [ceci] = await q(`insert into public.perfil_usuario (usuario_id, apodo, gemas) values ($1, 'Ceci', 500) returning gemas`, [uc.id]);
ok('un perfil creado por la app empieza en 0 aunque envíe 500 gemas', ceci.gemas === 0);
await asUser(C.id);
ok('un perfil nuevo empieza con su saldo inicial en el libro (0)', (await q(`select tipo, saldo from public.movimiento_gemas`)).some((m) => m.tipo === 'saldo_inicial' && m.saldo === 0));
const firstReward = await reward(15, 'ronda-ceci-0001');
ok('y suma su primera ronda (15)', firstReward.gemas === 15);

console.log('Aislamiento y auditoría');
await asUser(B.id);
ok('B solo ve sus movimientos', (await q(`select usuario_id from public.movimiento_gemas`)).every((m) => m.usuario_id === ub.id));
ok('B no ve las compras de A', (await q(`select * from public.compra_tienda`)).length === 0);
const bBuy = await buy('frame-coral', 'compra-beto-0001');
ok('B compra con SUS gemas (25 < 30: insuficientes); A no cambia', bBuy.motivo === 'gemas-insuficientes' && (await balance(ua.id)) === 25);
await asAdmin();
const ledger = await q(`select sum(cantidad)::int total from public.movimiento_gemas where usuario_id = $1`, [ua.id]);
ok('el libro cuadra con el saldo de A (100 − 60 − 40 + 15 + 10 + 0 = 25)', ledger[0].total === 25);
await db.exec('reset role');
ok('anon no puede comprar', await fails(async () => { await db.exec('set role anon'); await q(`select * from public.comprar_articulo('frame-coral', 'anon')`); }));
await db.exec('reset role');

console.log(`\n${pass} correctas, ${fail} fallidas`);
await db.close();
process.exit(fail ? 1 : 0);
