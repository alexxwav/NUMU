// Pruebas de los módulos de integración (IDs, cuestionario inicial y ruta de arranque).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULE_IDS, normalizeModuleId, normalizeInterests, recommendedCourseId } from '../src/data/subjects.js';
import { scoreDiagnostic, buildOnboardingPayload, toStoreProfile, createOnboardingService } from '../src/services/onboardingService.js';
import { resolveStartRoute, ROUTES } from '../src/services/startRoute.js';
import { generateQuestions } from '../src/state/questions.js';

// Respuestas correctas del DIAGNOSTIC actual de LoginView.jsx.
const ANSWER_KEY = [1, 2, 0, 3, 0];

const PROMPT_BY_MODULE = {
  conteo: /ves\?$/,
  aritmetica: /^¿Cuánto es /,
  geometria: /lados tiene/,
  patrones: /patrón/,
};

test('cada MODULE_ID tiene generador propio en questions.js', () => {
  for (const id of MODULE_IDS) {
    for (const q of generateQuestions(id, 1, 5)) assert.match(q.prompt, PROMPT_BY_MODULE[id], id);
  }
});

test('confirma el error actual: "sumas" y "formas" generan preguntas de conteo', () => {
  assert.match(generateQuestions('sumas', 1, 1)[0].prompt, PROMPT_BY_MODULE.conteo);
  assert.match(generateQuestions('formas', 1, 1)[0].prompt, PROMPT_BY_MODULE.conteo);
  assert.match(generateQuestions(normalizeModuleId('sumas'), 1, 1)[0].prompt, PROMPT_BY_MODULE.aritmetica);
  assert.match(generateQuestions(normalizeModuleId('formas'), 1, 1)[0].prompt, PROMPT_BY_MODULE.geometria);
});

test('los alias de Home.jsx se traducen y los desconocidos dan null', () => {
  assert.equal(normalizeModuleId('sumas'), 'aritmetica');
  assert.equal(normalizeModuleId('formas'), 'geometria');
  assert.equal(normalizeModuleId('patrones'), 'patrones');
  assert.equal(normalizeModuleId('algebra'), null);
});

test('normalizeInterests usa el vocabulario del diseño original', () => {
  assert.deepEqual(normalizeInterests(['sumas', 'conteo', 'formas', 'algebra', 'x']), ['aritmetica', 'geometria', 'algebra']);
});

test('recommendedCourseId no enlaza intereses sin curso', () => {
  assert.equal(recommendedCourseId(['algebra', 'formas']), 'geometria-patrones');
  assert.equal(recommendedCourseId(['trigonometria']), null);
});

test('scoreDiagnostic cuenta aciertos y tolera respuestas vacías', () => {
  assert.deepEqual(scoreDiagnostic([1, 2, 0, 3, 0], ANSWER_KEY), { score: 5, total: 5 });
  assert.deepEqual(scoreDiagnostic([0, null, 0], ANSWER_KEY), { score: 1, total: 5 });
});

const DRAFT = {
  name: ' Luis ', age: '8', country: 'México', grade: '3° de Primaria',
  interests: ['sumas', 'formas'], level: 'some', answers: [1, 2, 1, 3, 0], avatar: 2, nickname: 'LuisPro',
};

test('buildOnboardingPayload produce filas válidas para profiles y diagnostic_results', () => {
  const { profile, diagnostic } = buildOnboardingPayload(DRAFT, ANSWER_KEY);
  assert.deepEqual(profile, {
    name: 'Luis', age: 8, country: 'México', grade: '3° de Primaria',
    interests: ['aritmetica', 'geometria'], avatar: 2, nickname: 'LuisPro', onboarding_completed: true,
  });
  assert.deepEqual(diagnostic, { answers: [1, 2, 1, 3, 0], score: 4, total: 5, selfLevel: 'some' });
});

test('toStoreProfile devuelve la forma de state.profile de store.js', () => {
  const p = toStoreProfile({ name: 'Luis', age: 8, interests: ['aritmetica'], avatar: 2, nickname: 'LuisPro', onboarding_completed: true },
    { self_level: 'some', score: 4 });
  assert.deepEqual(Object.keys(p).sort(), ['age', 'avatar', 'completed', 'country', 'grade', 'interests', 'level', 'name', 'nickname', 'score']);
  assert.equal(p.completed, true);
  assert.equal(p.score, 4);
  assert.equal(toStoreProfile(null).completed, false);
});

test('onboardingService.save guarda el diagnóstico antes del perfil y se detiene si falla', async () => {
  const calls = [];
  const ok = createOnboardingService({
    saveDiagnostic: async (d) => { calls.push(['diag', d.userId, d.score]); return { diagnostic: { id: 'd1' }, error: null }; },
    updateProfile: async (id, p) => { calls.push(['profile', id, p.onboarding_completed]); return { profile: { id }, error: null }; },
  });
  const res = await ok.save('u1', DRAFT, ANSWER_KEY);
  assert.equal(res.error, null);
  assert.deepEqual(calls, [['diag', 'u1', 4], ['profile', 'u1', true]]);

  const fail = createOnboardingService({
    saveDiagnostic: async () => ({ diagnostic: null, error: 'sin permiso' }),
    updateProfile: async () => { throw new Error('no debería llamarse'); },
  });
  assert.equal((await fail.save('u1', DRAFT, ANSWER_KEY)).error, 'sin permiso');
});

test('resolveStartRoute separa login real y cuestionario inicial', () => {
  assert.equal(resolveStartRoute({ session: null, profile: null }), ROUTES.signIn);
  assert.equal(resolveStartRoute({ session: {}, profile: null }), ROUTES.onboarding);
  assert.equal(resolveStartRoute({ session: {}, profile: { onboarding_completed: false } }), ROUTES.onboarding);
  assert.equal(resolveStartRoute({ session: {}, profile: { onboarding_completed: true } }), ROUTES.home);
  assert.notEqual(ROUTES.signIn, ROUTES.onboarding);
});
