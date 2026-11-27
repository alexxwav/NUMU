// Bloque 3 · Plan de ronda del juego (planLessonRound) y recomendaciones de la pantalla final.
// Fixtures v2 propios: no se usan los borradores de Viviana ni se modifica el catálogo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planLessonRound, hasLegacyRound, questionSignature, QUESTIONS_PER_ROUND } from '../src/utils/lessonRound.js';
import { buildRecommendations, RECOMMENDATION_TYPES as T } from '../src/services/recommendationService.js';
import { academicStarsFor, starsForRound } from '../src/utils/stars.js';

const catalog = JSON.parse(readFileSync(new URL('../src/data/lessonContent.json', import.meta.url), 'utf8'));
const lessons = Object.fromEntries(catalog.courses.flatMap((c) => c.lessons).map((l) => [l.id, l]));
const LEGACY = ['conteo-basico', 'sumas-basicas', 'figuras', 'patrones'];
const looksLikeCounting = (q) => /cu[aá]nt[oa]s .+ ves\?/i.test(q.prompt ?? '');

function objectsExercise(id, count) {
  const options = [count - 1, count, count + 1, count + 2];
  return {
    id, prompt: `¿Cuántos globos hay? (${id})`, visual: { type: 'objects', icon: 'balloon', count },
    options, answer_index: 1, correct_answer: count, hint: 'Cuenta uno por uno.', feedback_correct: '¡Bien!', feedback_incorrect: 'Otra vez.',
    semanticKey: JSON.stringify(['contar-globos', [count]]),
  };
}
const bank = (prefix, n = 6) => Array.from({ length: n }, (_, i) => objectsExercise(`${prefix}${i + 1}`, i + 1));
const v2Lesson = (overrides = {}) => ({
  id: 'leccion-v2-prueba', course_id: 'algebra', title: 'Lección v2', position: 1, base_level: 1, published: true,
  levels: { 1: { exercises: bank('a') }, 2: { exercises: bank('b') }, 3: { exercises: bank('c') } },
  ...overrides,
});

test('regresión: las 4 lecciones actuales se juegan en los niveles 1, 2 y 3 con sus mismas fuentes', () => {
  for (const id of LEGACY) {
    assert.equal(hasLegacyRound(lessons[id]), true, id);
    for (const level of [1, 2, 3]) {
      for (let run = 0; run < 25; run++) {
        const plan = planLessonRound({ lesson: lessons[id], level });
        // Sin repetir preguntas donde hay 6 distintas. Conteo N1–N2 (4 y 5 cantidades distintas):
        // repeticiones mínimas, siempre con otro objeto. Figuras ya juega con su ampliación.
        const legacyExpected = id === 'conteo-basico' && level < 3;
        assert.equal(plan.mode, legacyExpected ? 'repeticion-minima' : 'selector', `${id} N${level}`);
        if (legacyExpected) {
          const distinct = new Set(plan.questions.map(questionSignature)).size;
          assert.equal(distinct, level === 1 ? 4 : 5, `conteo N${level}: todas las cantidades distintas`);
          const pairs = plan.questions.map((q) => `${questionSignature(q)}|${q.prompt}`);
          assert.equal(new Set(pairs).size, QUESTIONS_PER_ROUND, 'una cantidad repetida siempre con otro objeto');
        }
        assert.equal(plan.questions.length, QUESTIONS_PER_ROUND, `${id} N${level}`);
        assert.ok(plan.questions.every((q) => q.level === level));
        // N2–N3: el mismo generador (R12–R14); Figuras, el banco editorial de su nivel (sin generador).
        const levelIds = new Set((lessons[id].levels?.[level]?.exercises ?? []).map((e) => e.id));
        if (level > 1 && id === 'figuras') assert.ok(plan.questions.every((q) => q.source === 'catalogo' && levelIds.has(q.id)), 'Figuras N2–N3: su banco');
        else if (level > 1) assert.ok(plan.questions.every((q) => q.source === 'generador'), 'N2–N3: el mismo generador (R12–R14)');
        if (!legacyExpected) assert.equal(new Set(plan.questions.map(questionSignature)).size, QUESTIONS_PER_ROUND, `${id} N${level}: sin repetidas`);
      }
    }
  }
});

test('Figuras con una ampliación aún no jugable conserva temporalmente el flujo legacy', () => {
  // Tipo de visual que el adaptador actual todavía no admite (depende de Viviana).
  const ampliacion = { 1: { exercises: [{ ...objectsExercise('F1', 3), visual: { type: 'shape_set', figures: [] }, options: ['A', 'B', 'C', 'D'] }] } };
  const plan = planLessonRound({ lesson: { ...lessons.figuras, levels: ampliacion }, level: 1 });
  assert.equal(plan.mode, 'legacy');
  assert.equal(plan.questions.length, QUESTIONS_PER_ROUND);
  assert.ok(plan.reasons.length > 0, 'informa por qué no usó el selector');
});

test('Figuras con una ampliación jugable usa el selector (6 distintas, sin repetir)', () => {
  const ampliacion = { 2: { exercises: bank('fig', 2) } }; // 4 publicadas (N2) + 2 nuevas
  const plan = planLessonRound({ lesson: { ...lessons.figuras, levels: ampliacion }, level: 2 });
  assert.equal(plan.mode, 'selector');
  assert.equal(new Set(plan.questions.map(questionSignature)).size, QUESTIONS_PER_ROUND);
});

test('lección v2 publicada y jugable usa el selector en sus tres niveles', () => {
  for (const level of [1, 2, 3]) {
    const plan = planLessonRound({ lesson: v2Lesson(), level });
    assert.equal(plan.mode, 'selector', `N${level}`);
    assert.equal(plan.questions.length, QUESTIONS_PER_ROUND);
    assert.ok(plan.questions.every((q) => q.source === 'catalogo'));
  }
});

test('lección no publicada: no se juega ni por URL directa (también una antigua marcada como no publicada)', () => {
  for (const lesson of [v2Lesson({ published: false }), { ...lessons['conteo-basico'], published: false }]) {
    for (const level of [1, 2, 3]) {
      const plan = planLessonRound({ lesson, level });
      assert.equal(plan.mode, 'unavailable');
      assert.deepEqual(plan.questions, []);
    }
  }
  assert.equal(planLessonRound({ lesson: null, level: 1 }).mode, 'unavailable', 'id inexistente');
});

test('lección v2 sin 6 preguntas distintas: «no disponible», sin inventar ni repetir', () => {
  const corta = v2Lesson({ levels: { 1: { exercises: bank('x', 4) } } });
  const plan = planLessonRound({ lesson: corta, level: 1 });
  assert.equal(plan.mode, 'unavailable');
  assert.deepEqual(plan.questions, []);
  assert.ok(plan.reasons.some((r) => r.startsWith('Cobertura insuficiente')));
});

test('nunca hay respaldo silencioso de conteo para una lección nueva', () => {
  const sinNada = { id: 'la-balanza-de-numu', course_id: 'algebra', published: true };
  const genDesconocido = v2Lesson({ levels: { 2: { exercises: [], generator_key: 'algebra' } } });
  const nivelSinBanco = v2Lesson({ levels: { 1: { exercises: bank('y') } } }); // nivel 3 sin contenido
  for (const [lesson, level] of [[sinNada, 1], [genDesconocido, 2], [nivelSinBanco, 3]]) {
    const plan = planLessonRound({ lesson, level });
    assert.equal(plan.mode, 'unavailable', lesson.id);
    assert.ok(!plan.questions.some(looksLikeCounting));
  }
});

/* ---------- Recomendaciones de la pantalla final ---------- */

const areaCatalog = (extra = {}) => ({
  courses: [
    { id: 'aritmetica', title: 'Aritmética', position: 1, lessons: [
      lessons['conteo-basico'], lessons['sumas-basicas'],
      v2Lesson({ id: 'cuantos-quedan', course_id: 'aritmetica', title: '¿Cuántos quedan?', position: 3, ...(extra['cuantos-quedan'] ?? {}) }),
    ] },
    { id: 'algebra', title: 'Álgebra', position: 3, lessons: [
      v2Lesson({ id: 'escaleras-de-numeros', title: 'Escaleras de números', position: 1, ...(extra['escaleras-de-numeros'] ?? {}) }),
    ] },
  ],
});
const finished = (lessonId, stars, extra = {}) => ({ lessonId, stars, approved: true, levelBefore: 1, levelAfter: stars === 3 ? 2 : 1, ...extra });

test('tras 3 estrellas: siguiente lección no terminada del área y después seguir practicando (C12 → C10)', () => {
  const { recommendations } = buildRecommendations({
    catalog: areaCatalog(), starsByLesson: { 'sumas-basicas': 3 }, lastRound: finished('conteo-basico', 3), limit: 2,
  });
  assert.deepEqual(recommendations.map((r) => [r.lessonId, r.rules.at(-1)]), [['cuantos-quedan', 'C12'], ['conteo-basico', 'C10']],
    'salta sumas-basicas porque ya cumple T2');
});

test('con el área completa (T2 en todas sus lecciones disponibles) se recomienda otra área (C13)', () => {
  const { recommendations } = buildRecommendations({
    catalog: areaCatalog(), starsByLesson: { 'sumas-basicas': 3, 'cuantos-quedan': 3 },
    lastRound: finished('conteo-basico', 3, { levelBefore: 3, levelAfter: 3 }), limit: 2,
  });
  assert.equal(recommendations[0].lessonId, 'escaleras-de-numeros');
  assert.deepEqual(recommendations[0].rules, ['R7', 'C1', 'C13']);
});

test('no se recomiendan lecciones no publicadas ni sin 6 preguntas distintas (C16)', () => {
  const catalogo = areaCatalog({
    'cuantos-quedan': { published: false },
    'escaleras-de-numeros': { levels: { 1: { exercises: bank('z', 3) } } },
  });
  const all = [
    ...buildRecommendations({ catalog: catalogo, lastRound: finished('conteo-basico', 3), limit: 3 }).recommendations,
    ...buildRecommendations({ catalog: catalogo, limit: 3 }).recommendations,
    ...buildRecommendations({ catalog: catalogo, starsByLesson: { 'conteo-basico': 3, 'sumas-basicas': 3 }, limit: 3 }).recommendations,
  ];
  assert.ok(all.length > 0);
  assert.ok(all.every((r) => !['cuantos-quedan', 'escaleras-de-numeros'].includes(r.lessonId)), all.map((r) => r.lessonId).join(', '));
  assert.ok(all.every((r) => r.route === `/lecciones/${r.lessonId}`), 'solo rutas existentes de lecciones publicadas');
});

test('el refuerzo sigue R8–R10 (sin la regla de «2 errores = reforzar» que contradecía R8)', () => {
  const stars = (mistakes) => starsForRound({ total: 6, mistakes, approved: true });
  const rec = (lastRound) => buildRecommendations({ catalog, lastRound, limit: 2 }).recommendations[0];
  assert.equal(rec(finished('sumas-basicas', stars(2))).type, T.CONTINUAR, 'R8: 2 errores → continuar, no reforzar');
  assert.equal(rec(finished('sumas-basicas', stars(4))).type, T.REFORZAR, 'R9');
  const depleted = academicStarsFor({ roundStars: stars(1), livesDepleted: true });
  const r10 = rec({ lessonId: 'sumas-basicas', stars: depleted, approved: false, levelBefore: 2, levelAfter: 2 });
  assert.equal(r10.type, T.REFORZAR);
  assert.ok(r10.rules.includes('R10'), 'vidas agotadas: refuerzo por R10, aunque la recompensa sea de 3');
});

test('la mejor puntuación y T2 se respetan: una ronda peor no hace recomendar una lección terminada como siguiente', () => {
  const { recommendations } = buildRecommendations({
    catalog, starsByLesson: { 'conteo-basico': 3, 'sumas-basicas': 3 }, latestStarsByLesson: { 'sumas-basicas': 2 },
    lastRound: finished('figuras', 3), limit: 2,
  });
  assert.equal(recommendations[0].lessonId, 'patrones', 'siguiente de Geometría y patrones');
});

test('Game.jsx: plan de ronda, salida segura y recomendaciones con el resultado académico', () => {
  const source = readFileSync(new URL('../src/views/Game.jsx', import.meta.url), 'utf8');
  assert.match(source, /planLessonRound\(\{ lesson: lessonEntry\.lesson, level: lessonLevel,\s*avoidSignatures: memory\.lastSignatures \?\? \[\], preferTypes: memory\.weakTypes \?\? \[\] \}\)/);
  assert.doesNotMatch(source, /buildLessonRound/);
  assert.doesNotMatch(source, /needsReinforcement|showReinforcement/);
  assert.match(source, /Práctica no disponible/);
  assert.match(source, /if \(isUnavailable\) \{\s*return/);
  assert.match(source, /stars: academicStarsFor\(\{ roundStars, livesDepleted \}\)/);
  assert.match(source, /limit: 2/);
  assert.match(source, /store\.addRewards\(\{ gems: stars \* 5, stars, xp: stars \* 50, levelStars: stars \}\)/, 'recompensas intactas');
});
