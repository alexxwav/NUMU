// Prueba supabase/diagnostico_numu.sql (solo lectura) en Postgres en memoria (PGlite), con el esquema
// de producción simulado de numu. No se conecta a Supabase. Uso: node tests/db/diagnostico.check.mjs
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const file = (...p) => readFileSync(join(root, ...p), 'utf8');
const DIAGNOSTICO = file('supabase', 'diagnostico_numu.sql');
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  ✔', name); } else { fail++; console.log('  ✖', name, extra); }
};

async function produccion({ modulos = true } = {}) {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    create table public.usuarios (id serial primary key, correo text, contrasena text not null, fecha_registro date);
    create table public.perfil_usuario (id serial primary key, usuario_id integer references public.usuarios (id),
      nombre text, apodo text, edad integer, pais text, grado_escolar text, avatar integer default 0,
      gemas integer not null default 0, xp integer not null default 0);
    create table public.resultados_examen_diagnostico (id serial primary key, usuario_id integer references public.usuarios (id),
      num_aciertos integer, puntuacion integer, autoevaluacion text, respuestas json);
    create table public.cursos (id serial primary key, nombre_curso text, slug text unique);
    create table public.lecciones (id serial primary key, curso_id integer references public.cursos (id), titulo_leccion text, nivel integer, preguntas json);
    create table public.progreso (id serial primary key, usuario_id integer references public.usuarios (id), curso_id integer references public.cursos (id),
      nivel_actual integer default 1, num_estrellas integer default 0, num_intentos integer default 0, racha_dias integer default 1, leccion_completada boolean default false);
  `);
  await db.exec(file('supabase', 'propuesta_numu_auth.sql'));
  await db.exec(file('supabase', 'progreso_leccion.sql'));
  if (modulos) await db.exec(file('supabase_progreso_modulos.sql'));
  // Dos alumnos ficticios con datos.
  await db.exec(`insert into auth.users (email) values ('a@prueba.mx'), ('b@prueba.mx');`);
  await db.exec(`insert into public.perfil_usuario (usuario_id, apodo, gemas, xp) select id, 'Ficticio', 40, 1200 from public.usuarios;`);
  return db;
}
const diagnosticar = async (db) => (await db.query(DIAGNOSTICO)).rows;
const estado = (rows, elemento) => rows.find((r) => r.elemento === elemento)?.estado;
const snapshot = async (db) => JSON.stringify((await db.query(`select * from public.perfil_usuario order by id`)).rows)
  + JSON.stringify((await db.query(`select count(*) from public.usuarios`)).rows);

console.log('Producción actual (sin migraciones propuestas)');
let db = await produccion();
let rows;
try { rows = await diagnosticar(db); ok('el diagnóstico se ejecuta sin errores', true); }
catch (e) { ok('el diagnóstico se ejecuta sin errores', false, e.message); process.exit(1); }
ok('devuelve las columnas seccion/elemento/estado/detalle', ['seccion', 'elemento', 'estado', 'detalle'].every((k) => k in rows[0]));
const faltas = rows.filter((r) => r.estado === 'FALTA');
ok('nada FALTA en un esquema de producción completo', faltas.length === 0, faltas.map((r) => r.elemento).join(', '));
ok('las 3 migraciones aparecen PENDIENTE', ['propuesta_xp_monotona.sql', 'propuesta_ultima_ronda_transaccional.sql', 'propuesta_gemas_transaccional.sql'].every((m) => estado(rows, m) === 'PENDIENTE'));
ok('supabase_progreso_modulos.sql aparece APLICADA', estado(rows, 'supabase_progreso_modulos.sql') === 'APLICADA');
ok('detecta el RPC de 2 parámetros de la app publicada', estado(rows, 'public.registrar_resultado_leccion(text,integer)') === 'APLICADA');
ok('detecta el trigger de registro en auth.users', estado(rows, 'auth.users · al_crear_cuenta_numu') === 'OK');
ok('reporta las únicas que usan los upsert', ['perfil_usuario (usuario_id)', 'progreso (curso_id,usuario_id)', 'progreso_leccion (leccion_id,usuario_id)', 'user_module_progress (module_id,usuario_id)'].every((e) => estado(rows, e) === 'OK'));
const totales = rows.find((r) => r.elemento === 'perfil_usuario' && r.seccion === 'totales');
ok('totales sin datos personales: perfiles 2 · suma gemas 80 · suma xp 2400', /perfiles 2 · suma gemas 80 · suma xp 2400 · gemas negativas 0 · usuario_id repetidos 0/.test(totales?.detalle ?? ''), totales?.detalle);
ok('no muestra correos ni apodos', !JSON.stringify(rows).includes('prueba.mx') && !JSON.stringify(rows).includes('Ficticio'));
ok('RLS activa con políticas en perfil_usuario', rows.find((r) => r.seccion === 'rls' && r.elemento === 'perfil_usuario')?.estado === 'OK');

console.log('Solo lectura');
const antes = await snapshot(db);
try {
  await db.exec('begin transaction read only');
  await db.query(DIAGNOSTICO);
  await db.exec('commit');
  ok('se ejecuta dentro de una transacción READ ONLY (no escribe nada)', true);
} catch (e) { await db.exec('rollback'); ok('se ejecuta dentro de una transacción READ ONLY', false, e.message); }
ok('los datos no cambian', (await snapshot(db)) === antes);
await db.close();

console.log('Proyecto sin user_module_progress');
db = await produccion({ modulos: false });
rows = await diagnosticar(db);
ok('marca la tabla y su migración como FALTA', estado(rows, 'user_module_progress') === 'FALTA' && estado(rows, 'supabase_progreso_modulos.sql') === 'FALTA');
ok('y no falla por la tabla inexistente (totales: «no existe»)', rows.some((r) => r.seccion === 'totales' && r.elemento === 'user_module_progress' && r.detalle === 'no existe'));
await db.close();

console.log('Después de las 3 migraciones');
db = await produccion();
for (const m of ['propuesta_xp_monotona.sql', 'propuesta_ultima_ronda_transaccional.sql', 'propuesta_gemas_transaccional.sql']) await db.exec(file('supabase', m));
rows = await diagnosticar(db);
ok('las 3 migraciones aparecen APLICADA', ['propuesta_xp_monotona.sql', 'propuesta_ultima_ronda_transaccional.sql', 'propuesta_gemas_transaccional.sql'].every((m) => estado(rows, m) === 'APLICADA'));
ok('columnas nuevas de progreso_leccion APLICADA', ['progreso_leccion.nivel', 'progreso_leccion.ultimas_estrellas', 'progreso_leccion.ultimo_intento'].every((e) => estado(rows, e) === 'APLICADA'));
ok('RPC de gemas: authenticated sí, anon no', /authenticated puede ejecutar: sí · anon: no/.test(rows.find((r) => r.elemento === 'public.comprar_articulo(text,text)')?.detalle ?? ''));
ok('sin FALTA ni triggers inesperados', rows.filter((r) => r.estado === 'FALTA' || (r.seccion === 'triggers' && r.estado === 'REVISAR')).length === 0);
ok('totales iguales a antes de migrar', /perfiles 2 · suma gemas 80 · suma xp 2400/.test(rows.find((r) => r.elemento === 'perfil_usuario' && r.seccion === 'totales')?.detalle ?? ''));
ok('el libro de gemas ya tiene filas (saldo inicial)', rows.find((r) => r.seccion === 'totales' && r.elemento === 'movimiento_gemas')?.detalle === 'filas 2');
const cuenta = file('supabase', 'verificar_cuenta_ficticia.sql').replace('cuenta.ficticia@ejemplo.com', 'a@prueba.mx');
await db.exec(`update public.usuarios set correo = email from auth.users where auth.users.id = usuarios.auth_id`);
try {
  await db.exec('begin transaction read only');
  const filas = (await db.query(cuenta)).rows;
  await db.exec('commit');
  ok('verificar_cuenta_ficticia.sql: solo lectura y muestra solo esa cuenta', filas.some((r) => r.dato === 'perfil' && /gemas 40 · xp 1200/.test(r.valor))
    && filas.filter((r) => r.dato === 'perfil').length === 1 && filas.some((r) => r.dato === 'gemas saldo_inicial'));
} catch (e) { await db.exec('rollback'); ok('verificar_cuenta_ficticia.sql', false, e.message); }
await db.close();

console.log(`\n${pass} correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
