// Valida supabase/progreso_leccion.sql en una base Postgres en memoria (PGlite),
// simulando auth.users, auth.uid(), usuario_actual() y los roles anon/authenticated.
// No se conecta a ningún proyecto de Supabase.
// Uso: npm run test:db   (o: node tests/db/progreso-leccion.check.mjs)
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const db = new PGlite();

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  ✔', name); }
  else { fail++; console.log('  ✖', name, extra); }
};
const q = async (sql, params) => (await db.query(sql, params)).rows;
const expectError = async (name, sql, pattern, params) => {
  try { await db.query(sql, params); ok(name, false, '(no lanzó error)'); }
  catch (e) { ok(name, pattern.test(e.message), `(mensaje: ${e.message})`); }
};
const asUser = async (id) => { await db.exec('reset role'); await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [id ?? '']); await db.exec('set role authenticated'); };
const asAnon = async () => { await db.exec('reset role'); await db.query(`select set_config('request.jwt.claim.sub', '', false)`); await db.exec('set role anon'); };
const asAdmin = async () => { await db.exec('reset role'); };

// ---- Entorno tipo Supabase con el esquema del equipo (numu) ----
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;

  create table public.usuarios (
    id serial primary key,
    correo text,
    fecha_registro date default current_date,
    auth_id uuid unique references auth.users (id) on delete cascade
  );
`);

console.log('Aplicación de supabase/progreso_leccion.sql');
try {
  await db.exec(readFileSync(join(root, 'supabase', 'progreso_leccion.sql'), 'utf8'));
  ok('aplica progreso_leccion.sql', true);
} catch (e) {
  ok('aplica progreso_leccion.sql', false, e.message);
  process.exit(1);
}

console.log('Tabla, RLS y permisos');
const [tabla] = await q(`select relrowsecurity, relforcerowsecurity from pg_class where oid = 'public.progreso_leccion'::regclass`);
ok('la tabla existe con RLS activo', Boolean(tabla?.relrowsecurity));
const columnas = (await q(`select column_name from information_schema.columns where table_schema='public' and table_name='progreso_leccion'`)).map(r => r.column_name);
ok('tiene usuario_id, leccion_id, estrellas y updated_at', ['usuario_id', 'leccion_id', 'estrellas', 'updated_at'].every(c => columnas.includes(c)), `(${columnas.join(', ')})`);
const politicas = (await q(`select policyname from pg_policies where schemaname='public' and tablename='progreso_leccion'`)).map(r => r.policyname);
ok('tiene 3 políticas RLS', politicas.length === 3, `(${politicas.join(', ')})`);
const grants = await q(`select grantee, privilege_type from information_schema.role_table_grants where table_name='progreso_leccion'`);
ok('authenticated puede leer, insertar y actualizar', ['SELECT', 'INSERT', 'UPDATE'].every(p => grants.some(g => g.grantee === 'authenticated' && g.privilege_type === p)));
ok('anon no tiene permisos', grants.every(g => g.grantee !== 'anon'));

console.log('Usuarios de prueba');
await asAdmin();
const [A] = await q(`insert into auth.users (email) values ('ana@test.mx') returning id`);
const [B] = await q(`insert into auth.users (email) values ('beto@test.mx') returning id`);
const [ua] = await q(`insert into public.usuarios (correo, auth_id) values ('ana@test.mx', $1) returning id`, [A.id]);
const [ub] = await q(`insert into public.usuarios (correo, auth_id) values ('beto@test.mx', $1) returning id`, [B.id]);

console.log('Registro de estrellas (RPC registrar_resultado_leccion)');
await asUser(A.id);
const [r1] = await q(`select * from public.registrar_resultado_leccion('conteo-basico', 2)`);
ok('guarda las estrellas de la lección', r1.estrellas === 2 && r1.usuario_id === ua.id);
await q(`select public.registrar_resultado_leccion('conteo-basico', 3)`);
await q(`select public.registrar_resultado_leccion('conteo-basico', 1)`);
const [p] = await q(`select * from public.progreso_leccion where usuario_id=$1 and leccion_id='conteo-basico'`, [ua.id]);
ok('conserva la mejor puntuación al repetir', p.estrellas === 3);
ok('cuenta los intentos', p.intentos === 3);
ok('updated_at se actualiza (trigger)', new Date(p.updated_at) >= new Date(p.created_at));
await expectError('rechaza más de 3 estrellas', `select public.registrar_resultado_leccion('figuras', 4)`, /estrellas fuera de rango/);
await expectError('rechaza estrellas negativas', `select public.registrar_resultado_leccion('figuras', -1)`, /estrellas fuera de rango/);
await expectError('rechaza un id de lección inválido', `select public.registrar_resultado_leccion('No Valido', 2)`, /leccion_id invalido/);
await expectError('no puede registrar estrellas de otro usuario', `insert into public.progreso_leccion (usuario_id, leccion_id, estrellas) values ($1, 'figuras', 3)`, /row-level security/i, [ub.id]);

console.log('Aislamiento (usuario B)');
await asUser(B.id);
ok('B no ve el progreso de A', (await q(`select * from public.progreso_leccion`)).length === 0);
await q(`select public.registrar_resultado_leccion('patrones', 1)`);
ok('B tiene su propio progreso', (await q(`select leccion_id from public.progreso_leccion`)).map(r => r.leccion_id).join() === 'patrones');
await asUser(A.id);
ok('A sigue viendo solo lo suyo', (await q(`select leccion_id from public.progreso_leccion`)).map(r => r.leccion_id).join() === 'conteo-basico');

console.log('Sin sesión');
await asUser(null);
await expectError('authenticated sin uid no registra progreso', `select public.registrar_resultado_leccion('figuras', 1)`, /not authenticated/);
await asAnon();
await expectError('anon no lee el progreso', `select * from public.progreso_leccion`, /permission denied/i);
await expectError('anon no ejecuta el RPC', `select public.registrar_resultado_leccion('figuras', 1)`, /permission denied/i);

console.log('Borrado en cascada');
await asAdmin();
await q(`delete from auth.users where id=$1`, [A.id]);
ok('borrar la cuenta elimina su progreso por lección',
  (await q(`select count(*)::int n from public.progreso_leccion where usuario_id=$1`, [ua.id]))[0].n === 0);

console.log(`\n${pass} correctas, ${fail} fallidas`);
// Cierra PGlite antes de salir: si no, en Windows el proceso puede terminar con
// un aserto de libuv al matar los handles del worker.
await db.close();
process.exit(fail ? 1 : 0);
