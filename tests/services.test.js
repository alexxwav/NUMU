// Pruebas unitarias de los servicios con un cliente de Supabase simulado.
// No se conectan a ningún proyecto real. Ejecutar con: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthService, validateSignUp } from '../src/services/authService.js';
import { createProfileService, pickProfileFields } from '../src/services/profileService.js';
import { createProgressService } from '../src/services/progressService.js';
import { isSupabaseConfigured, requireSupabase } from '../src/lib/supabase.js';

// Simula el query builder encadenable de supabase-js y registra cada llamada.
// `tables` permite dar una respuesta distinta por tabla (por ejemplo, el id de usuarios).
function fakeClient(result = { data: null, error: null }, tables = {}) {
  const calls = [];
  const builderFor = (res) => {
    const builder = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'then') return (resolve) => resolve(res);
        return (...args) => { calls.push([prop, ...args]); return builder; };
      },
    });
    return builder;
  };
  const client = {
    calls,
    from: (table) => { calls.push(['from', table]); return builderFor(tables[table] ?? result); },
    rpc: async (fn, args) => { calls.push(['rpc', fn, args]); return result; },
    auth: {
      signUp: async (args) => { calls.push(['signUp', args]); return result; },
      signInWithPassword: async (args) => { calls.push(['signIn', args]); return result; },
      signOut: async () => { calls.push(['signOut']); return { error: result.error }; },
      getSession: async () => result,
    },
  };
  return client;
}

test('sin variables de entorno, el cliente no se configura y avisa', () => {
  assert.equal(isSupabaseConfigured, false);
  assert.throws(() => requireSupabase(), /no está configurado/);
});

test('validateSignUp rechaza datos inválidos', () => {
  assert.match(validateSignUp({ email: 'no-es-correo', password: '123456' }), /correo/);
  assert.match(validateSignUp({ email: 'a@b.mx', confirmEmail: 'c@b.mx', password: '123456' }), /no coinciden/);
  assert.match(validateSignUp({ email: 'a@b.mx', password: '123' }), /al menos 6/);
  assert.equal(validateSignUp({ email: ' A@B.mx ', confirmEmail: 'a@b.mx', password: '123456' }), null);
});

test('signUp no llama a Supabase si la validación falla', async () => {
  const client = fakeClient();
  const auth = createAuthService(() => client);
  const res = await auth.signUp({ email: 'a@b.mx', confirmEmail: 'x@b.mx', password: '123456' });
  assert.equal(res.error, 'Los correos no coinciden.');
  assert.equal(client.calls.length, 0);
});

test('signUp normaliza el correo y envía el apodo como metadata', async () => {
  const client = fakeClient({ data: { user: { id: 'u1' }, session: null }, error: null });
  const auth = createAuthService(() => client);
  const res = await auth.signUp({ email: ' Ana@Numu.MX ', confirmEmail: 'ana@numu.mx', password: 'secreta1', nickname: ' Ani ' });
  assert.equal(res.error, null);
  assert.equal(res.user.id, 'u1');
  const [, args] = client.calls[0];
  assert.equal(args.email, 'ana@numu.mx');
  assert.deepEqual(args.options, { data: { nickname: 'Ani' } });
});

test('signIn propaga el mensaje de error de Supabase', async () => {
  const client = fakeClient({ data: { user: null, session: null }, error: { message: 'Invalid login credentials' } });
  const res = await createAuthService(() => client).signIn({ email: 'a@b.mx', password: 'x' });
  assert.equal(res.error, 'Invalid login credentials');
  assert.equal(res.user, null);
});

test('pickProfileFields traduce a columnas de perfil_usuario y descarta lo demás', () => {
  const clean = pickProfileFields({ id: 'otro', nickname: 'Luis', age: '8', interests: ['geometria'], score: 5 });
  assert.deepEqual(clean, { apodo: 'Luis', edad: 8, intereses: ['geometria'] });
});

test('saveProfile sin campos válidos no llama a Supabase', async () => {
  const client = fakeClient();
  const res = await createProfileService(() => client).saveProfile({ id: 'otro' });
  assert.match(res.error, /No hay campos/);
  assert.equal(client.calls.length, 0);
});

test('saveProfile usa el id de usuarios de la sesión y hace upsert por usuario_id', async () => {
  const client = fakeClient({ data: { nombre: 'Luis', apodo: 'LuisPro', edad: 8, intereses: [] }, error: null },
    { usuarios: { data: { id: 7 }, error: null } });
  const res = await createProfileService(() => client).saveProfile({ name: 'Luis', nickname: 'LuisPro', age: 8 });
  assert.equal(res.error, null);
  assert.equal(res.profile.onboarding_completed, true);
  const upsert = client.calls.find((c) => c[0] === 'upsert');
  assert.deepEqual(upsert, ['upsert', { usuario_id: 7, nombre: 'Luis', apodo: 'LuisPro', edad: 8 }, { onConflict: 'usuario_id' }]);
});

test('getProfile sin fila de perfil devuelve null (cuestionario pendiente)', async () => {
  const client = fakeClient({ data: null, error: null }, { usuarios: { data: { id: 7 }, error: null } });
  const res = await createProfileService(() => client).getProfile();
  assert.equal(res.profile, null);
  assert.equal(res.error, null);
});

test('saveDiagnostic inserta en resultados_examen_diagnostico con las columnas de numu', async () => {
  const client = fakeClient({ data: { num_aciertos: 4, autoevaluacion: 'some' }, error: null },
    { usuarios: { data: { id: 7 }, error: null } });
  const res = await createProfileService(() => client)
    .saveDiagnostic({ answers: [1, 2, 0, 3, 1], score: 4, total: 5, selfLevel: 'some' });
  assert.deepEqual(res.diagnostic, { score: 4, self_level: 'some' });
  assert.deepEqual(client.calls.find((c) => c[0] === 'insert'), ['insert',
    { usuario_id: 7, num_aciertos: 4, puntuacion: 80, autoevaluacion: 'some', respuestas: [1, 2, 0, 3, 1] }]);
});

test('sin fila en usuarios, el servicio avisa en lugar de escribir', async () => {
  const client = fakeClient({ data: null, error: null });
  const res = await createProfileService(() => client).saveProfile({ name: 'Luis' });
  assert.match(res.error, /No se encontró el usuario/);
  assert.equal(client.calls.some((c) => c[0] === 'upsert'), false);
});

test('getProgress indexa las filas por slug del curso', async () => {
  const rows = [{ curso_id: 1, nivel_actual: 2, cursos: { slug: 'aritmetica' } }, { curso_id: 2, nivel_actual: 1, cursos: { slug: 'geometria-patrones' } }];
  const res = await createProgressService(() => fakeClient({ data: rows, error: null })).getProgress();
  assert.equal(res.progress.aritmetica.nivel_actual, 2);
  assert.equal(res.progress['geometria-patrones'].nivel_actual, 1);
});

test('recordRound valida y acumula estrellas e intentos sobre lo guardado', async () => {
  const profiles = { currentUsuarioId: async () => ({ usuarioId: 7, error: null }) };
  const client = fakeClient({ data: { nivel_actual: 3 }, error: null }, {
    cursos: { data: { id: 2 }, error: null },
  });
  // La lectura del progreso actual y el upsert comparten tabla: ambos devuelven `result`.
  const svc = createProgressService(() => client, profiles);

  assert.match((await svc.recordRound({ courseSlug: 'aritmetica', stars: 4, nextLevel: 1 })).error, /stars/);
  assert.match((await svc.recordRound({ courseSlug: 'aritmetica', stars: 2, nextLevel: 0 })).error, /nextLevel/);
  assert.equal(client.calls.length, 0);

  const ok = await svc.recordRound({ courseSlug: 'aritmetica', stars: 3, nextLevel: 3, streak: 2 });
  assert.equal(ok.error, null);
  const [, row, options] = client.calls.find((c) => c[0] === 'upsert');
  assert.deepEqual(options, { onConflict: 'usuario_id,curso_id' });
  assert.equal(row.usuario_id, 7);
  assert.equal(row.curso_id, 2);
  assert.equal(row.nivel_actual, 3);
  assert.equal(row.racha_dias, 2);
  assert.equal(row.num_intentos, 1); // la fila simulada no trae intentos previos
});
