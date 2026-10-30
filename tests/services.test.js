// Pruebas unitarias de los servicios con un cliente de Supabase simulado.
// No se conectan a ningún proyecto real. Ejecutar con: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthService, validateSignUp } from '../src/services/authService.js';
import { createProfileService, pickProfileFields } from '../src/services/profileService.js';
import { createProgressService } from '../src/services/progressService.js';
import { isSupabaseConfigured, requireSupabase } from '../src/lib/supabase.js';

// Simula el query builder encadenable de supabase-js y registra cada llamada.
function fakeClient(result = { data: null, error: null }) {
  const calls = [];
  const builder = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'then') return (resolve) => resolve(result);
      return (...args) => { calls.push([prop, ...args]); return builder; };
    },
  });
  const client = {
    calls,
    from: (table) => { calls.push(['from', table]); return builder; },
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

test('pickProfileFields descarta campos no editables y convierte la edad', () => {
  const clean = pickProfileFields({ id: 'otro', nickname: 'Luis', age: '8', score: 5, created_at: 'x' });
  assert.deepEqual(clean, { nickname: 'Luis', age: 8 });
});

test('updateProfile sin campos válidos no llama a Supabase', async () => {
  const client = fakeClient();
  const res = await createProfileService(() => client).updateProfile('u1', { id: 'otro' });
  assert.match(res.error, /No hay campos/);
  assert.equal(client.calls.length, 0);
});

test('saveDiagnostic inserta en diagnostic_results con nombres de columna correctos', async () => {
  const client = fakeClient({ data: { id: 'd1' }, error: null });
  const res = await createProfileService(() => client)
    .saveDiagnostic({ userId: 'u1', answers: [1, 2, 0, 3, 0], score: 5, total: 5, selfLevel: 'some' });
  assert.equal(res.error, null);
  assert.deepEqual(client.calls[0], ['from', 'diagnostic_results']);
  assert.deepEqual(client.calls[1], ['insert', { user_id: 'u1', answers: [1, 2, 0, 3, 0], score: 5, total: 5, self_level: 'some' }]);
});

test('getProgress indexa las filas por lección', async () => {
  const rows = [{ lesson_id: 'conteo-basico', current_level: 2 }, { lesson_id: 'patrones', current_level: 1 }];
  const client = fakeClient({ data: rows, error: null });
  const res = await createProgressService(() => client).getProgress('u1');
  assert.equal(res.progress['conteo-basico'].current_level, 2);
  assert.equal(res.progress.patrones.current_level, 1);
});

test('recordLessonResult valida y llama al RPC con los parámetros del SQL', async () => {
  const client = fakeClient({ data: { lesson_id: 'figuras' }, error: null });
  const svc = createProgressService(() => client);

  assert.match((await svc.recordLessonResult({ lessonId: 'figuras', stars: 4, nextLevel: 1 })).error, /stars/);
  assert.match((await svc.recordLessonResult({ lessonId: 'figuras', stars: 2, nextLevel: 0 })).error, /nextLevel/);
  assert.equal(client.calls.length, 0);

  const ok = await svc.recordLessonResult({ lessonId: 'figuras', stars: 3, nextLevel: 2, completed: true });
  assert.equal(ok.error, null);
  assert.deepEqual(client.calls[0], ['rpc', 'record_lesson_result',
    { p_lesson_id: 'figuras', p_stars: 3, p_next_level: 2, p_completed: true }]);
});
