#!/usr/bin/env node
// NUMU · Crea los 15 alumnos FICTICIOS de supabase/alumnos_prueba.mjs en el proyecto numu.
// Se ejecuta en la computadora de quien administra el proyecto. NUNCA guardar claves en el repo.
//
//   $env:SUPABASE_SERVICE_ROLE_KEY = '<clave secreta del panel>'   # solo en esa ventana
//   $env:NUMU_TEST_EMAIL = 'buzon.del.equipo@gmail.com'              # buzón controlado por el equipo
//   node supabase/crear_alumnos_prueba.mjs --revisar                 # no escribe: muestra el plan
//   node supabase/crear_alumnos_prueba.mjs --crear                   # crea lo que falte
//
// · Solo trabaja con el proyecto khjjyxqquruexuwrsbfb (la URL sale de ../NUMU/.env.local o de
//   SUPABASE_URL); con cualquier otro se detiene.
// · Cuentas: API administrativa de Auth (auth.admin.createUser, correo ya confirmado). El trigger
//   al_crear_cuenta_numu crea la fila de usuarios; el script NO escribe en auth.users.
// · Correos: alias «+numutest01…15» del buzón del equipo (NUMU_TEST_EMAIL). No son de personas reales.
// · Idempotente: si la cuenta existe no se recrea; si su perfil ya existe, ese alumno NO se toca.
// · Contraseña: una temporal robusta generada aquí (o NUMU_TEST_PASSWORD), escrita SOLO en un archivo
//   local fuera del repo (NUMU_CREDENCIALES o Documentos/NUMU_credenciales_prueba.txt). Nunca en consola.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomInt } from 'node:crypto';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { ALUMNOS, filasAlumno } from './alumnos_prueba.mjs';

const PROJECT_REF = 'khjjyxqquruexuwrsbfb';
const args = process.argv.slice(2);
const CREAR = args.includes('--crear');
if (!CREAR && !args.includes('--revisar')) { console.log('Usa --revisar (sin cambios) o --crear.'); process.exit(1); }

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = [join(root, '.env.local'), join(root, '..', 'NUMU', '.env.local')].find(existsSync);
const fromEnvFile = envFile ? Object.fromEntries(readFileSync(envFile, 'utf8').split(/\r?\n/).filter((l) => l.includes('='))
  .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])) : {};
const url = process.env.SUPABASE_URL ?? fromEnvFile.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const buzon = process.env.NUMU_TEST_EMAIL;

const fail = (msg) => { console.error(`✖ ${msg}`); process.exit(1); };
if (!url || !url.includes(`${PROJECT_REF}.supabase.co`)) fail(`La URL no es la del proyecto ${PROJECT_REF}. No se hace nada.`);
if (!key) fail('Falta SUPABASE_SERVICE_ROLE_KEY en esta ventana (no se guarda en ningún archivo).');
if (!buzon || !/^[^@\s+]+@[^@\s]+\.[^@\s]+$/.test(buzon)) fail('Falta NUMU_TEST_EMAIL (buzón del equipo, sin «+»).');
const [local, domain] = buzon.split('@');
const emailDe = (n2) => `${local}+numutest${n2}@${domain}`.toLowerCase();

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

function nuevaContrasena() {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '!#%*+-=?@_'];
  const all = sets.join('');
  const chars = sets.map((s) => s[randomInt(s.length)]);
  while (chars.length < 20) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) { const j = randomInt(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join('');
}

async function cuentasExistentes() {
  const map = new Map();
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) fail(`No se pudieron leer las cuentas: ${error.message}`);
    for (const u of data.users) map.set((u.email ?? '').toLowerCase(), u);
    if (data.users.length < 1000) return map;
  }
}

async function usuarioId(authId) {
  for (let i = 0; i < 10; i++) {
    const { data, error } = await db.from('usuarios').select('id').eq('auth_id', authId).maybeSingle();
    if (error) fail(`usuarios: ${error.message}`);
    if (data) return data.id;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

const cuentas = await cuentasExistentes();
const password = process.env.NUMU_TEST_PASSWORD ?? nuevaContrasena();
if (password.length < 12) fail('NUMU_TEST_PASSWORD debe tener al menos 12 caracteres.');
const resumen = [];
let creadas = 0;

for (const a of ALUMNOS) {
  const filas = filasAlumno(a);
  const email = filas.email(emailDe);
  let user = cuentas.get(email);
  const fila = { alumno: filas.perfil.nombre, correo: email, cuenta: user ? 'ya existía' : 'por crear', perfil: '', progreso: '' };
  resumen.push(fila);
  if (!CREAR) {
    if (user) {
      const uid = await usuarioId(user.id);
      const { data: perfil } = uid ? await db.from('perfil_usuario').select('id').eq('usuario_id', uid).maybeSingle() : { data: null };
      fila.perfil = perfil ? 'ya existe (no se toca)' : 'por crear';
    } else fila.perfil = 'por crear';
    continue;
  }

  if (!user) {
    const { data, error } = await db.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { nickname: a.apodo, numu_prueba: true },
    });
    if (error) { fila.cuenta = `ERROR: ${error.message}`; break; }
    user = data.user; fila.cuenta = 'creada'; creadas++;
  }
  const uid = await usuarioId(user.id);
  if (!uid) { fila.perfil = 'ERROR: el trigger no creó la fila de usuarios'; break; }

  const { data: existente } = await db.from('perfil_usuario').select('id').eq('usuario_id', uid).maybeSingle();
  if (existente) { fila.perfil = 'ya existía (no se toca)'; fila.progreso = '—'; continue; }

  const pasos = [
    ['perfil', db.from('perfil_usuario').insert({ usuario_id: uid, ...filas.perfil })],
    ['diagnóstico', db.from('resultados_examen_diagnostico').insert({ usuario_id: uid, ...filas.diagnostico })],
    ...filas.lecciones.map((l) => [`lección ${l.leccion_id}`, db.from('progreso_leccion').upsert({ usuario_id: uid, ...l }, { onConflict: 'usuario_id,leccion_id', ignoreDuplicates: true })]),
    ...filas.modulos.map((m) => [`mapa ${m.module_id}`, db.from('user_module_progress').upsert({ usuario_id: uid, ...m }, { onConflict: 'usuario_id,module_id', ignoreDuplicates: true })]),
    ...filas.cursos.map((c) => [`curso ${c.curso_id}`, db.from('progreso').upsert({ usuario_id: uid, ...c }, { onConflict: 'usuario_id,curso_id', ignoreDuplicates: true })]),
  ];
  let ok = true;
  for (const [nombre, consulta] of pasos) {
    const { error } = await consulta;
    if (error) { fila.progreso = `ERROR en ${nombre}: ${error.message}`; ok = false; break; }
  }
  if (!ok) break;
  fila.perfil = 'creado';
  fila.progreso = `${filas.lecciones.length} lecciones · ${filas.modulos.length} paradas de mapa · ${filas.cursos.length} cursos`;
}

console.table(resumen);
if (CREAR && creadas > 0) {
  const destino = process.env.NUMU_CREDENCIALES ?? join(homedir(), 'Documents', 'NUMU_credenciales_prueba.txt');
  if (destino.startsWith(root)) fail('El archivo de credenciales no puede quedar dentro del repositorio.');
  writeFileSync(destino, [
    'NUMU · cuentas FICTICIAS de prueba (proyecto numu). PRIVADO: no subir a Git ni compartir en chats públicos.',
    `Contraseña temporal (igual para las ${creadas} cuentas creadas en esta ejecución): ${password}`,
    '', ...resumen.filter((r) => r.cuenta === 'creada').map((r) => `${r.alumno}\t${r.correo}`), '',
  ].join('\n'), { encoding: 'utf8', flag: 'a' });
  console.log(`Credenciales guardadas en: ${destino} (no se muestran aquí).`);
}
if (resumen.some((r) => /ERROR/.test(`${r.cuenta}${r.perfil}${r.progreso}`))) { console.error('Se detuvo en el primer ERROR. Nada se borró.'); process.exit(1); }
console.log(CREAR ? 'Listo.' : 'Revisión sin cambios. Para crear: --crear');
