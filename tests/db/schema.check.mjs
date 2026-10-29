// Valida las migraciones de NUMU en una base Postgres en memoria (PGlite),
// simulando auth.users, auth.uid() y los roles anon/authenticated de Supabase.
// No se conecta a ningún proyecto de Supabase (ni al de NUMU ni al del CRM).
// Uso: npm run test:db   (o: node tests/db/schema.check.mjs nuevo|antiguo)
//   nuevo   → proyecto sin GRANT automáticos (comportamiento actual de Supabase)
//   antiguo → proyecto con GRANT automáticos en public
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const supaDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'supabase');
const mode = process.argv[2] ?? 'nuevo';
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
const noEffect = async (name, sql, params) => {
  try { const r = await db.query(sql, params); ok(name, r.affectedRows === 0, `(filas: ${r.affectedRows})`); }
  catch (e) { ok(name, /permission denied|row-level security/i.test(e.message), `(mensaje: ${e.message})`); }
};
const asUser = async (id) => { await db.exec('reset role'); await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [id ?? '']); await db.exec('set role authenticated'); };
const asAnon = async () => { await db.exec('reset role'); await db.query(`select set_config('request.jwt.claim.sub', '', false)`); await db.exec('set role anon'); };
const asAdmin = async () => { await db.exec('reset role'); };

// ---- Entorno tipo Supabase ----
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
`);
const legacyDefaults = mode === 'antiguo';
if (legacyDefaults) await db.exec(`
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`);
console.log(legacyDefaults ? 'Modo: CON grants automáticos (proyectos antiguos)' : 'Modo: SIN grants automáticos (proyectos nuevos)');

console.log('Migraciones y seed');
for (const f of ['migrations/20261029000001_schema.sql', 'migrations/20261029000002_rls.sql', 'migrations/20261029000003_grants.sql', 'seed.sql', 'seed.sql']) {
  try { await db.exec(readFileSync(join(supaDir, f), 'utf8')); ok(`aplica ${f}`, true); }
  catch (e) { ok(`aplica ${f}`, false, e.message); process.exit(1); }
}
ok('seed idempotente: 2 cursos', (await q('select count(*)::int n from public.courses'))[0].n === 2);
ok('seed idempotente: 4 lecciones', (await q('select count(*)::int n from public.lessons'))[0].n === 4);
ok('RLS activo en las 5 tablas', (await q(`select count(*)::int n from pg_class where relnamespace='public'::regnamespace and relkind='r' and relrowsecurity`))[0].n === 5);

console.log('Registro (trigger handle_new_user)');
const [A] = await q(`insert into auth.users (email, raw_user_meta_data) values ('ana@test.mx', '{"nickname":"Ana"}') returning id`);
const [B] = await q(`insert into auth.users (email, raw_user_meta_data) values ('beto@test.mx', '{"nickname":"Beto"}') returning id`);
const [C] = await q(`insert into auth.users (email, raw_user_meta_data) values ('c@test.mx', '{"nickname":"x"}') returning id`);
ok('crea un perfil por usuario', (await q('select count(*)::int n from public.profiles'))[0].n === 3);
ok('guarda el apodo de la metadata', (await q('select nickname from public.profiles where id=$1', [A.id]))[0].nickname === 'Ana');
ok('apodo inválido no bloquea el registro', (await q('select nickname from public.profiles where id=$1', [C.id]))[0].nickname === null);

console.log('Perfiles (usuario A)');
await asUser(A.id);
const visible = await q('select id from public.profiles');
ok('A solo ve su perfil', visible.length === 1 && visible[0].id === A.id);
await noEffect('A no puede modificar el perfil de B', `update public.profiles set nickname='Hack' where id=$1`, [B.id]);
ok('el perfil de B sigue intacto', (await (async () => { await asAdmin(); const r = await q('select nickname from public.profiles where id=$1', [B.id]); await asUser(A.id); return r; })())[0].nickname === 'Beto');
const own = await db.query(`update public.profiles set age=8, grade='3° primaria', interests='{conteo}', onboarding_completed=true where id=$1`, [A.id]);
ok('A actualiza su propio perfil', own.affectedRows === 1);
await expectError('A no puede cambiar el id de su perfil', `update public.profiles set id=gen_random_uuid() where id=$1`, /permission denied|row-level security/i, [A.id]);
await expectError('edad fuera de rango rechazada', `update public.profiles set age=30 where id=$1`, /check/i, [A.id]);
await expectError('A no puede crear un perfil ajeno', `insert into public.profiles (id) values (gen_random_uuid())`, /row-level security/i);

console.log('Cuestionario del diseño original (usuario A)');
const full = await db.query(`update public.profiles set name='Luis Raza', age=8, country='México', grade='3° de Primaria',
  interests='{aritmetica,geometria,algebra,trigonometria}', avatar=2, nickname='LuisPro', onboarding_completed=true where id=$1`, [A.id]);
ok('acepta nombre, edad, país, grado, 4 intereses, avatar y apodo', full.affectedRows === 1);
await q(`insert into public.diagnostic_results (user_id, score, total, self_level, answers) values ($1, 0, 5, 'none', '[null,null,null,null,null]')`, [A.id]);
ok('acepta autoevaluación y respuestas vacías del diagnóstico', true);
await expectError('autoevaluación desconocida rechazada', `insert into public.diagnostic_results (user_id, score, total, self_level) values ($1, 1, 5, 'experto')`, /check/i, [A.id]);
await asAdmin(); await q('delete from public.diagnostic_results'); await asUser(A.id);

console.log('Catálogo (usuario A)');
const lessons = await q('select l.id, l.module_id from public.lessons l join public.courses c on c.id=l.course_id order by c.position, l.position');
ok('lee 4 lecciones en orden', lessons.map((l) => l.id).join(',') === 'conteo-basico,sumas-basicas,figuras,patrones');
const descs = Object.fromEntries((await q('select id, description from public.lessons')).map((r) => [r.id, r.description]));
ok('descripciones de Viviana en figuras y patrones', descs.figuras?.startsWith('Reconocer triángulos') && descs.patrones?.startsWith('Identificar el color'));
ok('conteo y sumas sin descripción hasta ajustar el texto', descs['conteo-basico'] === null && descs['sumas-basicas'] === null);
ok('descripciones de cursos tras ejecutar el seed dos veces', (await q(`select description from public.courses where id='aritmetica'`))[0].description.startsWith('Construye confianza'));
ok('module_id compatibles con questions.js', lessons.map((l) => l.module_id).join(',') === 'conteo,aritmetica,geometria,patrones');
await expectError('A no puede crear cursos', `insert into public.courses (id, title, position) values ('x','X',9)`, /row-level security|permission denied/i);
await noEffect('A no puede borrar lecciones', `delete from public.lessons`);

console.log('Progreso (RPC record_lesson_result)');
await q(`select public.record_lesson_result('conteo-basico', 2, 1, false)`);
await q(`select public.record_lesson_result('conteo-basico', 3, 2, true)`);
await q(`select public.record_lesson_result('conteo-basico', 1, 1, false)`);
const [p] = await q(`select * from public.progress where lesson_id='conteo-basico'`);
ok('acumula intentos', p.attempts === 3);
ok('conserva la mejor puntuación', p.best_stars === 3);
ok('guarda el último nivel enviado', p.current_level === 1);
ok('completed no se revierte', p.completed === true);
ok('updated_at se actualiza (trigger)', p.updated_at >= p.created_at);
await expectError('lección inexistente rechazada', `select public.record_lesson_result('no-existe', 1, 1, false)`, /foreign key/i);
await expectError('estrellas > 3 rechazadas', `select public.record_lesson_result('figuras', 5, 1, false)`, /check/i);
await expectError('nivel < 1 rechazado', `select public.record_lesson_result('figuras', 1, 0, false)`, /check/i);
await expectError('A no puede insertar progreso de B', `insert into public.progress (user_id, lesson_id) values ($1, 'figuras')`, /row-level security/i, [B.id]);
await noEffect('A no puede borrar su progreso', `delete from public.progress`);
await expectError('A no puede vaciar tablas (TRUNCATE)', `truncate public.progress`, /permission denied/i);

console.log('Diagnóstico (usuario A)');
await q(`insert into public.diagnostic_results (user_id, score, total, self_level, answers) values ($1, 4, 5, 'some', '[1,2,0,3,1]')`, [A.id]);
ok('A guarda su diagnóstico', (await q('select count(*)::int n from public.diagnostic_results'))[0].n === 1);
await expectError('score > total rechazado', `insert into public.diagnostic_results (user_id, score, total) values ($1, 6, 5)`, /check/i, [A.id]);
await expectError('A no puede guardar diagnóstico de B', `insert into public.diagnostic_results (user_id, score, total) values ($1, 1, 5)`, /row-level security/i, [B.id]);
await noEffect('diagnóstico no editable', `update public.diagnostic_results set score=5`);

console.log('Aislamiento (usuario B)');
await asUser(B.id);
ok('B no ve el progreso de A', (await q('select * from public.progress')).length === 0);
ok('B no ve el diagnóstico de A', (await q('select * from public.diagnostic_results')).length === 0);
await q(`select public.record_lesson_result('patrones', 2, 1, false)`);
ok('B tiene su propio progreso', (await q('select lesson_id from public.progress')).map((r) => r.lesson_id).join() === 'patrones');
await asUser(A.id);
ok('A sigue viendo solo lo suyo', (await q('select lesson_id from public.progress')).map((r) => r.lesson_id).join() === 'conteo-basico');

console.log('Sin sesión');
await asUser(null);
await expectError('authenticated sin uid no registra progreso', `select public.record_lesson_result('figuras', 1, 1, false)`, /not authenticated/);
await asAnon();
await expectError('anon no lee cursos', `select * from public.courses`, /permission denied/i);
await expectError('anon no lee perfiles', `select * from public.profiles`, /permission denied/i);
await expectError('anon no ejecuta el RPC', `select public.record_lesson_result('figuras', 1, 1, false)`, /permission denied/i);

console.log('Borrado en cascada');
await asAdmin();
await q('delete from auth.users where id=$1', [A.id]);
ok('borrar usuario elimina perfil, progreso y diagnóstico',
  (await q(`select (select count(*) from public.profiles where id=$1)
                 + (select count(*) from public.progress where user_id=$1)
                 + (select count(*) from public.diagnostic_results where user_id=$1) as n`, [A.id]))[0].n == 0);

console.log(`\n${pass} correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
