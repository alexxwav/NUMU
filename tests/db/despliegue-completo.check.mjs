// Ensayo completo del despliegue en Supabase, en Postgres en memoria (PGlite). Datos ficticios.
// No se conecta a Supabase real.
//   1. «Producción»: esquema del equipo + propuesta_numu_auth.sql + progreso_leccion.sql +
//      supabase_progreso_modulos.sql, con alumnos ficticios creados con los flujos de la app publicada.
//   2. Respaldo (copia de las tablas con datos de alumnos).
//   3. Las tres propuestas en orden: XP monótona → última ronda transaccional → gemas transaccionales.
//   4. Verificación posterior: nada cambió en los datos; registro, inicio de sesión, progreso,
//      compras y recompensas funcionan con la app nueva y con la app publicada.
//   5. Reaplicar las tres (idempotentes) y REVERTIR con reversion_propuestas.sql sin perder datos.
// Uso: node tests/db/despliegue-completo.check.mjs
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const file = (...p) => readFileSync(join(root, ...p), 'utf8');
const MIGRACIONES = ['propuesta_xp_monotona.sql', 'propuesta_ultima_ronda_transaccional.sql', 'propuesta_gemas_transaccional.sql'];
const db = new PGlite();
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  ✔', name); } else { fail++; console.log('  ✖', name, extra); }
};
const q = async (text, params) => (await db.query(text, params)).rows;
const as = async (sub) => { await db.exec('reset role'); await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [sub ?? '']); if (sub) await db.exec('set role authenticated'); };
const fails = async (fn) => { try { await fn(); return false; } catch { return true; } };

// --- 1. Producción simulada ---------------------------------------------------------------------
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  -- Tablas del equipo (antes de propuesta_numu_auth.sql).
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
await db.exec(file('supabase_progreso_modulos.sql'));

// Flujos de la app publicada (servicios actuales), con alumnos ficticios.
async function registrar(email) { // authService.signUp → trigger crear_usuario_numu
  await as(null);
  const [u] = await q(`insert into auth.users (email) values ($1) returning id`, [email]);
  return u.id;
}
const usuarioId = async () => (await q(`select id from public.usuarios`))[0]?.id; // profileService.currentUsuarioId (RLS)
async function onboarding(sub, apodo) { // onboardingService.save
  await as(sub);
  const id = await usuarioId();
  await q(`insert into public.resultados_examen_diagnostico (usuario_id, num_aciertos, puntuacion, autoevaluacion, respuestas) values ($1, 3, 60, 'Sé un poco', '[]')`, [id]);
  await q(`insert into public.perfil_usuario (usuario_id, nombre, apodo, edad, intereses) values ($1, 'Ficticio', $2, 9, '{aritmetica}')
    on conflict (usuario_id) do update set nombre = excluded.nombre, apodo = excluded.apodo, edad = excluded.edad, intereses = excluded.intereses`, [id, apodo]);
  return id;
}
async function guardarPerfil(sub, fields) { // profileService.saveProfile (upsert absoluto)
  await as(sub);
  const id = await usuarioId();
  const cols = Object.keys(fields);
  const [row] = await q(`insert into public.perfil_usuario (usuario_id, ${cols.join(', ')}) values ($1, ${cols.map((_, i) => `$${i + 2}`).join(', ')})
    on conflict (usuario_id) do update set ${cols.map((c) => `${c} = excluded.${c}`).join(', ')} returning gemas, xp`, [id, ...Object.values(fields)]);
  return row;
}
async function rondaCurso(sub, slug) { // progressService.recordRound
  await as(sub);
  const id = await usuarioId();
  const [curso] = await q(`select id from public.cursos where slug = $1`, [slug]);
  await q(`insert into public.progreso (usuario_id, curso_id, nivel_actual, num_estrellas, num_intentos) values ($1, $2, 2, 3, 1)
    on conflict (usuario_id, curso_id) do update set num_estrellas = public.progreso.num_estrellas + 3, num_intentos = public.progreso.num_intentos + 1`, [id, curso.id]);
}
async function rondaModulo(sub, moduleId, stars) { // moduleProgressService.saveModuleRound
  await as(sub);
  const id = await usuarioId();
  await q(`insert into public.user_module_progress (usuario_id, module_id, current_level, stars_by_level) values ($1, $2, 2, $3)
    on conflict (usuario_id, module_id) do update set current_level = greatest(public.user_module_progress.current_level, 2), stars_by_level = excluded.stars_by_level`,
  [id, moduleId, JSON.stringify({ 1: stars })]);
}
async function inicioSesion(sub) { // loadProfile + useLessonProgress + getModuleProgress
  await as(sub);
  const [perfil] = await q(`select apodo, gemas, xp from public.perfil_usuario`);
  const progreso = await q(`select curso_id, num_estrellas from public.progreso`);
  const lecciones = await q(`select leccion_id, estrellas from public.progreso_leccion order by leccion_id`);
  const modulos = await q(`select module_id, current_level from public.user_module_progress`);
  const diag = await q(`select num_aciertos from public.resultados_examen_diagnostico order by id desc limit 1`);
  return { perfil, progreso, lecciones, modulos, diag };
}

const ana = await registrar('ana@prueba.mx');
const beto = await registrar('beto@prueba.mx');
const anaId = await onboarding(ana, 'Ana');
await onboarding(beto, 'Beto');
await guardarPerfil(ana, { gemas: 100, xp: 1200 });
await guardarPerfil(beto, { gemas: 25, xp: 300 });
await rondaCurso(ana, 'aritmetica');
await as(ana);
await q(`select public.registrar_resultado_leccion('conteo-basico', 3)`);
await q(`select public.registrar_resultado_leccion('sumas-basicas', 2)`);
await rondaModulo(ana, 'conteo', 3);

console.log('Producción simulada');
const tablasAlumno = ['usuarios', 'perfil_usuario', 'resultados_examen_diagnostico', 'progreso', 'progreso_leccion', 'user_module_progress'];
const snapshot = async () => {
  await as(null);
  const out = {};
  for (const t of tablasAlumno) out[t] = JSON.stringify(await q(`select * from public.${t} order by 1, 2`));
  return out;
};
await as(null);
ok('el registro crea la fila de usuarios (trigger)', (await q(`select count(*)::int n from public.usuarios`))[0].n === 2);
const antes = await inicioSesion(ana);
ok('la app publicada guarda perfil, progreso, lecciones y mapa', antes.perfil.gemas === 100 && antes.perfil.xp === 1200
  && antes.lecciones.length === 2 && antes.modulos.length === 1 && antes.progreso.length === 1 && antes.diag.length === 1);

// --- 2. Respaldo -----------------------------------------------------------------------------------
console.log('Respaldo');
await as(null);
for (const t of tablasAlumno) await db.exec(`create table respaldo_${t} as table public.${t}`);
ok('respaldo de las 6 tablas con datos de alumnos', (await q(`select count(*)::int n from pg_tables where tablename like 'respaldo_%'`))[0].n === 6);
const datosAntes = await snapshot();

// --- 3. Las tres propuestas, en orden ----------------------------------------------------------------
console.log('Aplicación en orden');
for (const m of MIGRACIONES) {
  try { await as(null); await db.exec(file('supabase', m)); ok(`${m} se aplica`, true); }
  catch (e) { ok(`${m} se aplica`, false, e.message); process.exit(1); }
}

// --- 4. Verificación posterior ------------------------------------------------------------------------
console.log('Verificación posterior');
const datosDespues = await snapshot();
for (const t of ['usuarios', 'perfil_usuario', 'resultados_examen_diagnostico', 'progreso', 'user_module_progress']) {
  ok(`${t}: sin cambios`, datosDespues[t] === datosAntes[t]);
}
await as(null);
const filasLeccion = await q(`select usuario_id, leccion_id, estrellas, intentos, ultimas_estrellas, nivel from public.progreso_leccion order by 2`);
ok('progreso_leccion: mismas filas; columnas nuevas en null', filasLeccion.length === 2 && filasLeccion.every((r) => r.ultimas_estrellas === null && r.nivel === null)
  && filasLeccion[0].estrellas === 3 && filasLeccion[1].estrellas === 2);
ok('saldo inicial en el libro = gemas actuales', JSON.stringify(await q(`select saldo from public.movimiento_gemas order by usuario_id`)) === JSON.stringify([{ saldo: 100 }, { saldo: 25 }]));
const triggers = (await q(`select tgname from pg_trigger where tgrelid = 'public.perfil_usuario'::regclass and not tgisinternal order by 1`)).map((r) => r.tgname);
ok('perfil_usuario: triggers de XP y gemas conviven', JSON.stringify(triggers) === JSON.stringify(['perfil_usuario_gemas_por_rpc', 'perfil_usuario_saldo_inicial', 'perfil_usuario_xp_no_baja']), triggers.join(', '));

console.log('Flujos con la app nueva');
const ceci = await registrar('ceci@prueba.mx');
await onboarding(ceci, 'Ceci');
ok('registro + cuestionario de un alumno nuevo: perfil con 0 gemas', (await inicioSesion(ceci)).perfil.gemas === 0);
await as(ceci);
ok('su saldo inicial queda en el libro', (await q(`select tipo from public.movimiento_gemas`)).some((m) => m.tipo === 'saldo_inicial'));
const [l1] = await q(`select estrellas, nivel, ultimas_estrellas from public.registrar_resultado_leccion('figuras', 3, 2)`);
ok('lección con nivel (RPC de 3 parámetros)', l1.estrellas === 3 && l1.nivel === 2 && l1.ultimas_estrellas === 3);
const [l2] = await q(`select estrellas, ultimas_estrellas from public.registrar_resultado_leccion('figuras', 1)`);
ok('la app publicada (RPC de 2 parámetros) sigue funcionando y la mejor no baja', l2.estrellas === 3 && l2.ultimas_estrellas === 1);
const r = (await q(`select * from public.registrar_gemas_ronda(15, 'ronda-ceci-00000001')`))[0];
ok('recompensa de ronda: 0 → 15', r.gemas === 15 && r.aplicada === true);
const c = (await q(`select * from public.comprar_articulo('frame-gold', 'compra-ceci-0000001')`))[0];
ok('compra sin saldo suficiente: rechazada', c.comprado === false && c.motivo === 'gemas-insuficientes');
await rondaCurso(ceci, 'aritmetica'); await rondaModulo(ceci, 'patrones', 2);
const sesion = await inicioSesion(ceci);
ok('inicio de sesión lee todo (perfil, progreso, lecciones, mapa)', sesion.perfil.gemas === 15 && sesion.lecciones.length === 1 && sesion.modulos.length === 1 && sesion.progreso.length === 1);

console.log('Flujos de la app publicada tras la migración');
const viejo = await guardarPerfil(ana, { gemas: 999, xp: 50 });
ok('upsert absoluto: no cambia gemas (100) ni baja la XP (1200)', viejo.gemas === 100 && viejo.xp === 1200);
await as(ana);
const compra = (await q(`select * from public.comprar_articulo('frame-gold', 'compra-ana-00000001')`))[0];
ok('Ana compra el Marco Dorado: 100 → 40', compra.comprado === true && compra.gemas === 40);
ok('Ana no ve datos de Ceci', (await q(`select * from public.movimiento_gemas`)).every((m) => m.usuario_id === anaId));

console.log('Reaplicar (idempotencia)');
const antesReaplicar = await snapshot();
for (const m of MIGRACIONES) {
  try { await as(null); await db.exec(file('supabase', m)); ok(`${m} se puede volver a ejecutar`, true); }
  catch (e) { ok(`${m} se puede volver a ejecutar`, false, e.message); }
}
const trasReaplicar = await snapshot();
ok('reaplicar no cambia datos', tablasAlumno.every((t) => trasReaplicar[t] === antesReaplicar[t]));

// --- 5. Reversión ---------------------------------------------------------------------------------
console.log('Reversión');
try { await as(null); await db.exec(file('supabase', 'reversion_propuestas.sql')); ok('reversion_propuestas.sql se aplica', true); }
catch (e) { ok('reversion_propuestas.sql se aplica', false, e.message); }
const trasRevertir = await snapshot();
ok('revertir no borra datos de alumnos', tablasAlumno.every((t) => trasRevertir[t] === antesReaplicar[t]));
await as(null);
ok('las tablas de gemas se conservan como respaldo', (await q(`select count(*)::int n from public.movimiento_gemas`))[0].n >= 4);
ok('ya no existen los RPC de gemas', (await q(`select count(*)::int n from pg_proc where proname in ('comprar_articulo', 'registrar_gemas_ronda')`))[0].n === 0);
ok('vuelve el RPC de 2 parámetros', JSON.stringify((await q(`select pg_get_function_identity_arguments(oid) a from pg_proc where proname = 'registrar_resultado_leccion'`)).map((x) => x.a))
  === JSON.stringify(['p_leccion_id text, p_estrellas integer']));
await as(ana);
const [l3] = await q(`select estrellas, intentos from public.registrar_resultado_leccion('conteo-basico', 1)`);
ok('la app publicada vuelve a guardar lecciones', l3.estrellas === 3 && l3.intentos === 2);
const tras = await guardarPerfil(ana, { gemas: 40, xp: 1300 });
ok('y vuelve a escribir gemas y XP como antes', tras.gemas === 40 && tras.xp === 1300);
try { await as(null); await db.exec(file('supabase', 'reversion_propuestas.sql')); ok('la reversión es idempotente', true); }
catch (e) { ok('la reversión es idempotente', false, e.message); }
for (const m of MIGRACIONES) {
  try { await as(null); await db.exec(file('supabase', m)); ok(`${m} se puede volver a aplicar después de revertir`, true); }
  catch (e) { ok(`${m} se puede volver a aplicar después de revertir`, false, e.message); }
}
await as(null);
ok('al reaplicar se conserva el libro anterior (sin duplicar saldos iniciales)',
  (await q(`select count(*)::int n from public.movimiento_gemas where tipo = 'saldo_inicial'`))[0].n === 3);

console.log(`\n${pass} correctas, ${fail} fallidas`);
await db.close();
process.exit(fail ? 1 : 0);
