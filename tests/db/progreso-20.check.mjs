// Bloque 2B · Progreso académico de las 20 lecciones sobre el SQL del repositorio, en Postgres en
// memoria (PGlite). No se conecta a ningún proyecto de Supabase ni toca datos reales.
// Fase 1: solo supabase/progreso_leccion.sql (lo que la app ya usa).
// Fase 2: + supabase/propuesta_ultima_ronda.sql (preparada, NO aplicada en numu): nivel y última ronda.
// Uso: node tests/db/progreso-20.check.mjs
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
const expectError = async (name, text, pattern, params) => {
  try { await db.query(text, params); ok(name, false, '(no lanzó error)'); }
  catch (e) { ok(name, pattern.test(e.message), `(mensaje: ${e.message})`); }
};
const asUser = async (id) => { await db.exec('reset role'); await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [id ?? '']); await db.exec('set role authenticated'); };
const asAdmin = async () => { await db.exec('reset role'); };
const sql = (file) => readFileSync(join(root, 'supabase', file), 'utf8');

const LESSONS = [
  'conteo-basico', 'sumas-basicas', 'cuantos-quedan', 'grupos-iguales', 'repartimos-por-igual',
  'figuras', 'patrones', 'la-mitad-del-espejo', 'una-vuelta-al-contorno', 'llenamos-el-mosaico',
  'escaleras-de-numeros', 'la-balanza-de-numu', 'el-numero-escondido', 'la-maquina-de-reglas', 'de-un-dibujo-a-una-regla',
  'gira-el-submarino', 'que-tan-abierta-esta-la-puerta', 'el-triangulo-de-la-escalera', 'cual-rampa-sube-mas', 'la-torre-y-su-sombra',
];

// Entorno tipo Supabase con el esquema del equipo (igual que ultima-ronda.check.mjs).
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
const [A] = await q(`insert into auth.users (email) values ('alumna-a@prueba.mx') returning id`);
const [B] = await q(`insert into auth.users (email) values ('alumno-b@prueba.mx') returning id`);
const [ua] = await q(`insert into public.usuarios (correo, auth_id) values ('alumna-a@prueba.mx', $1) returning id`, [A.id]);
const [ub] = await q(`insert into public.usuarios (correo, auth_id) values ('alumno-b@prueba.mx', $1) returning id`, [B.id]);

console.log('Fase 1 · esquema actual (progreso_leccion.sql)');
await asUser(A.id);
for (const [i, id] of LESSONS.entries()) await q(`select public.registrar_resultado_leccion($1, $2)`, [id, i % 4]);
ok('guarda las 20 lecciones por leccion_id, sin filas en otras tablas', (await q(`select count(*)::int n from public.progreso_leccion`))[0].n === 20);
ok('cada lección conserva su propio resultado', (await q(`select leccion_id, estrellas from public.progreso_leccion order by leccion_id`))
  .every((r) => r.estrellas === LESSONS.indexOf(r.leccion_id) % 4));
await q(`select public.registrar_resultado_leccion('la-balanza-de-numu', 3)`);
await q(`select public.registrar_resultado_leccion('la-balanza-de-numu', 1)`);
const [balanza] = await q(`select * from public.progreso_leccion where leccion_id = 'la-balanza-de-numu'`);
ok('la mejor marca de 3 no baja con una ronda peor (greatest)', balanza.estrellas === 3);
await q(`select public.registrar_resultado_leccion('la-balanza-de-numu', 0)`);
ok('una ronda con vidas agotadas (0) conserva la mejor', (await q(`select estrellas from public.progreso_leccion where leccion_id = 'la-balanza-de-numu'`))[0].estrellas === 3);
await expectError('rechaza ids que no son del catálogo (mayúsculas, acentos, espacios)', `select public.registrar_resultado_leccion('La Balanza', 2)`, /leccion_id invalido/);
await expectError('rechaza ids con acentos', `select public.registrar_resultado_leccion('álgebra', 2)`, /leccion_id invalido/);

console.log('Respaldo del cliente sin RPC (update condicional del servicio)');
const raise = (stars, lesson) => q(`update public.progreso_leccion set estrellas = $1 where usuario_id = $2 and leccion_id = $3 and estrellas < $1 returning estrellas`, [stars, ua.id, lesson]);
ok('no baja la mejor (3 → 1 no actualiza ninguna fila)', (await raise(1, 'la-balanza-de-numu')).length === 0);
ok('sí la sube cuando es mayor (escaleras 2 → 3)', (await raise(3, 'escaleras-de-numeros'))[0]?.estrellas === 3);
const insertIgnore = await q(`insert into public.progreso_leccion (usuario_id, leccion_id, estrellas, intentos) values ($1, 'figuras', 0, 1)
  on conflict (usuario_id, leccion_id) do nothing returning *`, [ua.id]);
ok('crear la fila sin pisar una existente (do nothing) deja intacto el progreso', insertIgnore.length === 0
  && (await q(`select estrellas from public.progreso_leccion where leccion_id = 'figuras'`))[0].estrellas === LESSONS.indexOf('figuras') % 4);

console.log('Aislamiento entre alumnos (RLS)');
await asUser(B.id);
ok('B no ve ninguna fila de A', (await q(`select * from public.progreso_leccion`)).length === 0);
ok('B no puede modificar el progreso de A (0 filas)', (await q(`update public.progreso_leccion set estrellas = 0 where usuario_id = $1 returning *`, [ua.id])).length === 0);
await expectError('B no puede crear filas a nombre de A', `insert into public.progreso_leccion (usuario_id, leccion_id, estrellas, intentos) values ($1, 'gira-el-submarino', 3, 1)`, /row-level security/i, [ua.id]);
await q(`select public.registrar_resultado_leccion('figuras', 3)`);
ok('el RPC de B escribe solo en la fila de B', (await q(`select usuario_id from public.progreso_leccion`)).every((r) => r.usuario_id === ub.id));
await asAdmin();
ok('A conserva sus 20 lecciones', (await q(`select count(*)::int n from public.progreso_leccion where usuario_id = $1`, [ua.id]))[0].n === 20);

console.log('Fase 2 · con la migración preparada (propuesta_ultima_ronda.sql)');
const before = await q(`select usuario_id, leccion_id, estrellas, intentos from public.progreso_leccion order by 1, 2`);
await db.exec(sql('propuesta_ultima_ronda.sql'));
const after = await q(`select usuario_id, leccion_id, estrellas, intentos, nivel, ultimas_estrellas from public.progreso_leccion order by 1, 2`);
ok('no borra ni cambia el progreso existente', JSON.stringify(before) === JSON.stringify(after.map(({ nivel, ultimas_estrellas, ...r }) => r)));
ok('no inventa nivel ni última ronda para filas antiguas', after.every((r) => r.nivel === null && r.ultimas_estrellas === null));
await asUser(A.id);
const [n1] = await q(`select * from public.registrar_resultado_leccion('gira-el-submarino', 3, 2)`);
ok('guarda el nivel académico de una lección nueva (Trigonometría, nivel 2)', n1.nivel === 2 && n1.ultimas_estrellas === 3);
const [n2] = await q(`select * from public.registrar_resultado_leccion('gira-el-submarino', 0, 2)`);
ok('vidas agotadas: última = 0, mejor = 3, nivel se conserva (R10)', n2.estrellas === 3 && n2.ultimas_estrellas === 0 && n2.nivel === 2);
ok('el nivel de una lección no cambia el de otra área', (await q(`select nivel from public.progreso_leccion where leccion_id = 'conteo-basico' and usuario_id = $1`, [ua.id]))[0].nivel === null);
await asUser(B.id);
ok('B sigue sin ver la fila de A tras la migración', (await q(`select * from public.progreso_leccion where leccion_id = 'gira-el-submarino'`)).length === 0);

console.log(`\n${pass} correctas, ${fail} fallidas`);
await db.close();
process.exit(fail ? 1 : 0);
