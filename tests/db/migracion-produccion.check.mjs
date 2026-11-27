// Bloque 3 · Migración de nivel académico y última ronda contra el estado EXACTO de producción de numu
// (confirmado el 26-nov-2026), en Postgres en memoria (PGlite). No se conecta a Supabase real.
// Prueba las dos propuestas, cada una en una base nueva:
//   · supabase/propuesta_ultima_ronda.sql               (original)
//   · supabase/propuesta_ultima_ronda_transaccional.sql (recomendada para producción)
// Uso: node tests/db/migracion-produccion.check.mjs
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const sql = (file) => readFileSync(join(root, 'supabase', file), 'utf8');
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  ✔', name); } else { fail++; console.log('  ✖', name, extra); }
};

async function productionLikeDb() {
  const db = new PGlite();
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
      id serial primary key, correo text, fecha_registro date default current_date,
      auth_id uuid unique references auth.users (id) on delete cascade
    );
  `);
  await db.exec(sql('progreso_leccion.sql'));
  const q = async (text, params) => (await db.query(text, params)).rows;
  const as = async (role, sub = '') => {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [sub]);
    if (role) await db.exec(`set role ${role}`);
  };
  return { db, q, as };
}

const schemaOf = async (q) => ({
  columns: (await q(`select column_name, data_type from information_schema.columns
    where table_schema = 'public' and table_name = 'progreso_leccion' order by ordinal_position`))
    .map((r) => `${r.column_name}:${r.data_type}`),
  functions: (await q(`select pg_get_function_identity_arguments(oid) a from pg_proc where proname = 'registrar_resultado_leccion'`)).map((r) => r.a),
  policies: (await q(`select cmd from pg_policies where tablename = 'progreso_leccion' order by cmd`)).map((r) => r.cmd),
  constraints: (await q(`select count(*)::int n from pg_constraint where conrelid = 'public.progreso_leccion'::regclass`))[0].n,
});
const rowsOf = (q) => q(`select usuario_id, leccion_id, estrellas, intentos from public.progreso_leccion order by 1, 2`);

for (const file of ['propuesta_ultima_ronda.sql', 'propuesta_ultima_ronda_transaccional.sql']) {
  console.log(`\n== ${file}`);
  const { db, q, as } = await productionLikeDb();

  // Estado de producción confirmado.
  const prod = await schemaOf(q);
  ok('la base de prueba reproduce las columnas de producción', JSON.stringify(prod.columns) === JSON.stringify([
    'usuario_id:integer', 'leccion_id:text', 'estrellas:smallint', 'intentos:integer',
    'created_at:timestamp with time zone', 'updated_at:timestamp with time zone']), prod.columns.join(', '));
  ok('reproduce el RPC de producción (p_leccion_id text, p_estrellas integer)', JSON.stringify(prod.functions) === JSON.stringify(['p_leccion_id text, p_estrellas integer']));
  ok('reproduce las 3 políticas (SELECT, INSERT, UPDATE)', JSON.stringify(prod.policies) === JSON.stringify(['INSERT', 'SELECT', 'UPDATE']));

  // Alumnos y progreso existentes (antes de migrar), con la firma de producción.
  const [A] = await q(`insert into auth.users (email) values ('alumna-a@prueba.mx') returning id`);
  const [B] = await q(`insert into auth.users (email) values ('alumno-b@prueba.mx') returning id`);
  const [ua] = await q(`insert into public.usuarios (correo, auth_id) values ('a', $1) returning id`, [A.id]);
  await q(`insert into public.usuarios (correo, auth_id) values ('b', $1)`, [B.id]);
  await as('authenticated', A.id);
  for (const [id, s] of [['conteo-basico', 3], ['sumas-basicas', 1], ['figuras', 2], ['patrones', 3]]) await q(`select public.registrar_resultado_leccion($1, $2)`, [id, s]);
  await q(`select public.registrar_resultado_leccion('figuras', 1)`); // 2 intentos, mejor 2
  await as('authenticated', B.id);
  await q(`select public.registrar_resultado_leccion('conteo-basico', 2)`);
  await as(null);
  const before = await rowsOf(q);

  // 1 y 2 · Aplicar.
  try { await db.exec(sql(file)); ok('se aplica sin errores', true); } catch (e) { ok('se aplica sin errores', false, e.message); continue; }
  const after = await schemaOf(q);
  ok('1 · conserva todos los registros existentes (usuario, lección, mejor e intentos)', JSON.stringify(await rowsOf(q)) === JSON.stringify(before));
  ok('2 · agrega ultimas_estrellas, ultimo_intento y nivel con sus tipos', ['ultimas_estrellas:smallint', 'ultimo_intento:timestamp with time zone', 'nivel:smallint']
    .every((c) => after.columns.includes(c)) && after.columns.length === 9, after.columns.join(', '));
  ok('2 · las filas existentes no inventan nivel ni última ronda', (await q(`select count(*)::int n from public.progreso_leccion where nivel is not null or ultimas_estrellas is not null or ultimo_intento is not null`))[0].n === 0);
  ok('deja una sola función, con p_nivel opcional', after.functions.length === 1 && /p_nivel integer/.test(after.functions[0]), after.functions.join(' | '));
  ok('5 · conserva las 3 políticas RLS', JSON.stringify(after.policies) === JSON.stringify(['INSERT', 'SELECT', 'UPDATE']));

  // 3 · La mejor nunca baja.
  await as('authenticated', A.id);
  const [r1] = await q(`select * from public.registrar_resultado_leccion('conteo-basico', 1, 2)`);
  const [r0] = await q(`select * from public.registrar_resultado_leccion('conteo-basico', 0, 2)`);
  ok('3 · la mejor (3) no baja con rondas de 1 y de 0', r1.estrellas === 3 && r0.estrellas === 3 && r0.ultimas_estrellas === 0);
  const [up] = await q(`select * from public.registrar_resultado_leccion('sumas-basicas', 3, 2)`);
  ok('3 · sí sube cuando la nueva es mayor', up.estrellas === 3);

  // 4 · Recuperación del nivel desde otro dispositivo (otra sesión del mismo alumno lee la fila).
  await q(`select public.registrar_resultado_leccion('gira-el-submarino', 3, 2)`);
  await as(null);
  await as('authenticated', A.id); // «otro dispositivo»: sesión nueva, sin estado local
  const recovered = await q(`select leccion_id, estrellas, nivel, ultimas_estrellas, ultimo_intento from public.progreso_leccion order by leccion_id`);
  const byId = Object.fromEntries(recovered.map((r) => [r.leccion_id, r]));
  ok('4 · otro dispositivo recupera nivel, última ronda y fecha', byId['gira-el-submarino']?.nivel === 2 && byId['gira-el-submarino']?.ultimas_estrellas === 3
    && byId['gira-el-submarino']?.ultimo_intento !== null && byId['conteo-basico']?.nivel === 2);

  // 5 · Aislamiento por alumno.
  await as('authenticated', B.id);
  ok('5 · B solo ve su fila', (await q(`select usuario_id from public.progreso_leccion`)).every((r) => r.usuario_id !== ua.id));
  ok('5 · B no modifica filas de A (0 filas)', (await q(`update public.progreso_leccion set nivel = 1 where usuario_id = $1 returning *`, [ua.id])).length === 0);
  await as('anon');
  let anonBlocked = false;
  try { await q(`select public.registrar_resultado_leccion('figuras', 1)`); } catch (e) { anonBlocked = /permission denied/i.test(e.message); }
  ok('5 · anon no puede ejecutar el RPC nuevo', anonBlocked);

  // 6 · Clientes con la firma anterior.
  await as('authenticated', A.id);
  const [named] = await q(`select * from public.registrar_resultado_leccion(p_leccion_id => 'conteo-basico', p_estrellas => 2)`);
  ok('6 · la llamada anterior con argumentos por nombre (como la API) funciona y conserva el nivel', named.nivel === 2 && named.estrellas === 3 && named.ultimas_estrellas === 2);
  const [positional] = await q(`select * from public.registrar_resultado_leccion('patrones', 1)`);
  ok('6 · la llamada anterior por posición también funciona', positional.estrellas === 3 && positional.nivel === null);

  // 7 · Repetir la migración.
  await as(null);
  const rowsBeforeRerun = await q(`select * from public.progreso_leccion order by 1, 2`);
  try { await db.exec(sql(file)); ok('7 · se puede volver a ejecutar sin error', true); } catch (e) { ok('7 · se puede volver a ejecutar sin error', false, e.message); }
  const rerun = await schemaOf(q);
  ok('7 · no duplica columnas, funciones, políticas ni restricciones', JSON.stringify(rerun) === JSON.stringify(after), JSON.stringify(rerun));
  ok('7 · no pierde ni cambia datos al repetirse', JSON.stringify(await q(`select * from public.progreso_leccion order by 1, 2`)) === JSON.stringify(rowsBeforeRerun));

  // 8 · Rondas intercaladas de dos dispositivos del mismo alumno (cada llamada es una sola sentencia).
  await as('authenticated', A.id);
  for (const s of [3, 0, 1, 2, 0]) await q(`select public.registrar_resultado_leccion('el-numero-escondido', $1, 1)`, [s]);
  const [mix] = await q(`select estrellas, intentos, ultimas_estrellas from public.progreso_leccion where leccion_id = 'el-numero-escondido'`);
  ok('8 · rondas intercaladas: mejor 3, 5 intentos, última = la más reciente', mix.estrellas === 3 && mix.intentos === 5 && mix.ultimas_estrellas === 0);
  await db.close();
}

// Un fallo justo después de borrar el RPC anterior (antes de crear el nuevo).
//   · Enviado como UN bloque (así lo hace el SQL Editor de Supabase): Postgres lo trata como una
//     transacción implícita y revierte todo → el RPC anterior sigue disponible.
//   · Ejecutado sentencia por sentencia (p. ej. psql o un cliente con autocommit): la base queda
//     SIN RPC. La versión transaccional (begin … commit explícitos) lo evita en ambos casos.
console.log('\n== Fallo a mitad de la migración');
const original = sql('propuesta_ultima_ronda.sql');
const partial = original.slice(0, original.indexOf('create or replace function')) + '\nselect 1 / 0; -- fallo simulado\n';
const statements = partial.replace(/--.*$/gm, '').split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);
const rpcCount = async (q) => (await q(`select count(*)::int n from pg_proc where proname = 'registrar_resultado_leccion'`))[0].n;
for (const [label, run, expected] of [
  ['original enviada como un bloque', (db) => db.exec(partial), 1],
  ['original sentencia por sentencia', async (db) => { for (const s of statements) await db.exec(s); }, 0],
  ['transaccional sentencia por sentencia', async (db) => {
    await db.exec('begin');
    try { for (const s of statements) await db.exec(s); await db.exec('commit'); } catch (e) { await db.exec('rollback'); throw e; }
  }, 1],
]) {
  const { db, q } = await productionLikeDb();
  try { await run(db); } catch { /* el fallo es parte de la prueba */ }
  const n = await rpcCount(q);
  ok(expected === 1 ? `${label}: el RPC anterior sigue disponible tras el fallo` : `${label}: confirma el riesgo, la base queda sin RPC`, n === expected, `(funciones: ${n})`);
  await db.close();
}

console.log(`\n${pass} correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
