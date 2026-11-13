// Valida supabase/propuesta_ultima_ronda.sql sobre progreso_leccion.sql en Postgres en memoria (PGlite).
// No se conecta a ningún proyecto de Supabase. La propuesta NO está aplicada en numu.
// Uso: node tests/db/ultima-ronda.check.mjs
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
const sql = (file) => readFileSync(join(root, 'supabase', file), 'utf8');

// ---- Entorno tipo Supabase con el esquema del equipo (igual que progreso-leccion.check.mjs) ----
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
await db.exec(sql('progreso_leccion.sql'));

// Filas existentes ANTES de la propuesta (deben quedar con ultimas_estrellas = null).
const [A] = await q(`insert into auth.users (email) values ('ana@test.mx') returning id`);
const [B] = await q(`insert into auth.users (email) values ('beto@test.mx') returning id`);
const [ua] = await q(`insert into public.usuarios (correo, auth_id) values ('ana@test.mx', $1) returning id`, [A.id]);
await q(`insert into public.usuarios (correo, auth_id) values ('beto@test.mx', $1)`, [B.id]);
await asUser(A.id);
await q(`select public.registrar_resultado_leccion('figuras', 3)`);
await asAdmin();

console.log('Aplicación de la propuesta');
try { await db.exec(sql('propuesta_ultima_ronda.sql')); ok('aplica propuesta_ultima_ronda.sql', true); }
catch (e) { ok('aplica propuesta_ultima_ronda.sql', false, e.message); process.exit(1); }
try { await db.exec(sql('propuesta_ultima_ronda.sql')); ok('se puede volver a ejecutar sin error', true); }
catch (e) { ok('se puede volver a ejecutar sin error', false, e.message); }
const columnas = (await q(`select column_name from information_schema.columns where table_schema='public' and table_name='progreso_leccion'`)).map((r) => r.column_name);
ok('agrega ultimas_estrellas, ultimo_intento y nivel', ['ultimas_estrellas', 'ultimo_intento', 'nivel'].every((c) => columnas.includes(c)));
const [vieja] = await q(`select * from public.progreso_leccion where leccion_id='figuras'`);
ok('las filas existentes no inventan su última ronda ni su nivel (null)', vieja.estrellas === 3 && vieja.ultimas_estrellas === null && vieja.nivel === null);
const firmas = (await q(`select pg_get_function_identity_arguments(oid) a from pg_proc where proname='registrar_resultado_leccion'`)).map((r) => r.a);
ok('queda una sola función, con p_nivel opcional', firmas.length === 1 && /p_nivel integer/.test(firmas[0]), `(${firmas.join(' | ')})`);
ok('se conservan las 3 políticas RLS', (await q(`select count(*)::int n from pg_policies where tablename='progreso_leccion'`))[0].n === 3);

console.log('Mejor y última puntuación (caso 3 y luego 1)');
await asUser(A.id);
await q(`select public.registrar_resultado_leccion('conteo-basico', 3)`);
const [r] = await q(`select * from public.registrar_resultado_leccion('conteo-basico', 1)`);
ok('la mejor se conserva en 3', r.estrellas === 3);
ok('la última queda en 1', r.ultimas_estrellas === 1);
ok('cuenta 2 intentos', r.intentos === 2);
ok('registra la fecha del último intento', r.ultimo_intento !== null);
const [r2] = await q(`select * from public.registrar_resultado_leccion('conteo-basico', 2)`);
ok('una ronda nueva reemplaza la última y no baja la mejor', r2.estrellas === 3 && r2.ultimas_estrellas === 2 && r2.intentos === 3);
const [vieja2] = await q(`select * from public.registrar_resultado_leccion('figuras', 1)`);
ok('una fila vieja empieza a guardar su última ronda', vieja2.estrellas === 3 && vieja2.ultimas_estrellas === 1);
await expectError('sigue rechazando más de 3 estrellas', `select public.registrar_resultado_leccion('patrones', 4)`, /estrellas fuera de rango/);

console.log('Nivel académico por lección');
const [s1] = await q(`select * from public.registrar_resultado_leccion('sumas-basicas', 3, 3)`);
const [f1] = await q(`select * from public.registrar_resultado_leccion('patrones', 2, 1)`);
ok('cada lección guarda su propio nivel (sumas 3, patrones 1)', s1.nivel === 3 && f1.nivel === 1);
const [s2] = await q(`select * from public.registrar_resultado_leccion('sumas-basicas', 2, 3)`);
ok('el nivel se conserva con 2 estrellas (R8) y no cambia otras lecciones', s2.nivel === 3
  && (await q(`select nivel from public.progreso_leccion where leccion_id='patrones' and usuario_id=$1`, [ua.id]))[0].nivel === 1);
const [s3] = await q(`select * from public.registrar_resultado_leccion('sumas-basicas', 1)`);
ok('la llamada antigua (sin p_nivel) sigue funcionando y conserva el nivel', s3.nivel === 3 && s3.ultimas_estrellas === 1 && s3.estrellas === 3);
await expectError('rechaza nivel 4', `select public.registrar_resultado_leccion('figuras', 2, 4)`, /nivel fuera de rango/);
await expectError('rechaza nivel 0', `select public.registrar_resultado_leccion('figuras', 2, 0)`, /nivel fuera de rango/);
await asAdmin();
await expectError('la columna nivel solo acepta 1 a 3', `update public.progreso_leccion set nivel = 5 where leccion_id='figuras'`, /check/i);
await asUser(A.id);
await expectError('rechaza ultimas_estrellas fuera de rango', `update public.progreso_leccion set ultimas_estrellas = 5 where leccion_id='figuras'`, /check/i);

console.log('Respaldo del cliente (lessonProgressService sin RPC)');
const [u] = await q(`insert into public.progreso_leccion (usuario_id, leccion_id, estrellas, intentos) values ($1, 'leccion-respaldo', 2, 1)
  on conflict (usuario_id, leccion_id) do update set estrellas = greatest(progreso_leccion.estrellas, excluded.estrellas) returning *`, [ua.id]);
ok('el upsert actual del servicio sigue funcionando (última = null)', u.estrellas === 2 && u.ultimas_estrellas === null);

console.log('Aislamiento y permisos');
await asUser(B.id);
ok('B no ve el progreso de A', (await q(`select * from public.progreso_leccion`)).length === 0);
await asAnon();
await expectError('anon no lee el progreso', `select * from public.progreso_leccion`, /permission denied/i);
await expectError('anon no ejecuta el RPC', `select public.registrar_resultado_leccion('figuras', 1)`, /permission denied/i);

console.log(`\n${pass} correctas, ${fail} fallidas`);
await db.close();
process.exit(fail ? 1 : 0);
