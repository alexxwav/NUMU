// Prueba supabase/propuesta_xp_monotona.sql en Postgres en memoria (PGlite), con datos ficticios.
// No se conecta a Supabase. perfil_usuario se reproduce con las columnas que usa la app
// (usuario_id único, xp, gemas) y sus 3 políticas RLS; el esquema real debe verificarse antes.
// Uso: node tests/db/xp-monotona.check.mjs
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const db = new PGlite();
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  ✔', name); } else { fail++; console.log('  ✖', name, extra); }
};
const q = async (text, params) => (await db.query(text, params)).rows;
const asUser = async (id) => { await db.exec('reset role'); await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [id]); await db.exec('set role authenticated'); };
const asAdmin = async () => { await db.exec('reset role'); };

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
// Usuarios existentes: A con XP histórica 1200 y 40 gemas; B con 300 XP.
await q(`insert into public.perfil_usuario (usuario_id, apodo, xp, gemas) values ($1, 'Ana', 1200, 40), ($2, 'Beto', 300, 10)`, [ua.id, ub.id]);
const before = await q(`select usuario_id, apodo, xp, gemas from public.perfil_usuario order by usuario_id`);

console.log('Aplicación');
try { await db.exec(readFileSync(join(root, 'supabase', 'propuesta_xp_monotona.sql'), 'utf8')); ok('se aplica sin errores', true); }
catch (e) { ok('se aplica sin errores', false, e.message); process.exit(1); }
ok('no cambia ningún perfil existente', JSON.stringify(await q(`select usuario_id, apodo, xp, gemas from public.perfil_usuario order by usuario_id`)) === JSON.stringify(before));
try { await db.exec(readFileSync(join(root, 'supabase', 'propuesta_xp_monotona.sql'), 'utf8')); ok('se puede volver a ejecutar', true); }
catch (e) { ok('se puede volver a ejecutar', false, e.message); }
ok('queda un solo trigger', (await q(`select count(*)::int n from pg_trigger where tgname = 'perfil_usuario_xp_no_baja'`))[0].n === 1);

console.log('La XP nunca baja (el mismo upsert que hace profileService.saveProfile)');
const upsert = (usuario, xp, gemas) => q(`insert into public.perfil_usuario (usuario_id, xp, gemas) values ($1, $2, $3)
  on conflict (usuario_id) do update set xp = excluded.xp, gemas = excluded.gemas returning xp, gemas`, [usuario, xp, gemas]);
await asUser(A.id);
const [low] = await upsert(ua.id, 150, 40); // un dispositivo que solo conoce 3 estrellas de paradas
ok('un guardado con XP menor (150) conserva la histórica (1200)', low.xp === 1200, `(xp: ${low.xp})`);
const [high] = await upsert(ua.id, 1350, 40);
ok('un guardado con XP mayor (1350) sí se aplica', high.xp === 1350);
const [shop] = await upsert(ua.id, 1350, 15);
ok('las gemas pueden bajar (compra en la tienda): 40 → 15', shop.gemas === 15 && shop.xp === 1350);
const [plainUpdate] = await q(`update public.perfil_usuario set xp = 0 where usuario_id = $1 returning xp`, [ua.id]);
ok('ni un update directo a 0 la reduce', plainUpdate.xp === 1350);

console.log('Guardados intercalados de dos dispositivos');
for (const xp of [1400, 900, 1500, 50, 1450]) await upsert(ua.id, xp, 15);
ok('tras 5 guardados en cualquier orden queda la mayor (1500)', (await q(`select xp from public.perfil_usuario where usuario_id = $1`, [ua.id]))[0].xp === 1500);

console.log('Aislamiento y usuarios nuevos');
await asUser(B.id);
ok('B no puede modificar el perfil de A (0 filas)', (await q(`update public.perfil_usuario set xp = 99999 where usuario_id = $1 returning xp`, [ua.id])).length === 0);
await asAdmin();
const [C] = await q(`insert into auth.users (email) values ('c@prueba.mx') returning id`);
const [uc] = await q(`insert into public.usuarios (correo, auth_id) values ('c2', $1) returning id`, [C.id]);
await asUser(C.id);
const [created] = await upsert(uc.id, 0, 0);
ok('un usuario nuevo crea su perfil con XP 0 (el trigger solo actúa al actualizar)', created.xp === 0);
await asAdmin();
ok('B conserva sus 300 XP', (await q(`select xp from public.perfil_usuario where usuario_id = $1`, [ub.id]))[0].xp === 300);

console.log(`\n${pass} correctas, ${fail} fallidas`);
await db.close();
process.exit(fail ? 1 : 0);
