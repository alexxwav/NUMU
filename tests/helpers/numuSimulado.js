// Ayudas compartidas por las pruebas del motor (no es una prueba: npm test solo ejecuta tests/*.test.js).
// · APPROVED_LESSONS: los 15 ids y nombres aprobados en el contrato compartido (sin Trigonometría).
// · supabaseSimulado(): progreso_leccion en memoria con nivel y última ronda (migración aplicada).
// · alumno(): juega rondas con las MISMAS decisiones que Game.jsx (planLessonRound, starsForRound,
//   academicStarsFor, levelAfterRound, roundProgressTargets, saveLessonResult y buildRecommendations).
//   Todos los datos son ficticios; no se conecta a ningún servicio real.
import { planLessonRound } from '../../src/utils/lessonRound.js';
import { roundProgressTargets } from '../../src/utils/areaProgress.js';
import { buildRecommendations } from '../../src/services/recommendationService.js';
import { createLessonProgressService } from '../../src/services/lessonProgressService.js';
import { starsForRound, academicStarsFor } from '../../src/utils/stars.js';
import { levelAfterRound, lessonLevelFor } from '../../src/utils/lessonLevel.js';
import { getLessonById } from '../../src/utils/lessonContent.js';
import { readFileSync } from 'node:fs';

export const APPROVED_LESSONS = Object.freeze({
  aritmetica: [
    ['conteo-basico', 'Conteo básico'], ['sumas-basicas', 'Sumas básicas'], ['cuantos-quedan', '¿Cuántos quedan?'],
    ['grupos-iguales', 'Grupos iguales'], ['repartimos-por-igual', 'Repartimos por igual'],
  ],
  'geometria-patrones': [
    ['figuras', 'Figuras geométricas'], ['patrones', 'Patrones de colores'], ['la-mitad-del-espejo', 'La mitad del espejo'],
    ['una-vuelta-al-contorno', 'Una vuelta al contorno'], ['llenamos-el-mosaico', 'Llenamos el mosaico'],
  ],
  algebra: [
    ['escaleras-de-numeros', 'Escaleras de números'], ['la-balanza-de-numu', 'La balanza de NUMU'],
    ['el-numero-escondido', 'El número escondido'], ['la-maquina-de-reglas', 'La máquina de reglas'],
    ['de-un-dibujo-a-una-regla', 'De un dibujo a una regla'],
  ],
});
export const APPROVED_IDS = Object.freeze(Object.fromEntries(
  Object.entries(APPROVED_LESSONS).map(([area, lessons]) => [area, lessons.map(([id]) => id)]),
));
export const LEGACY_LESSONS = Object.freeze({ 'conteo-basico': 'conteo', 'sumas-basicas': 'aritmetica', figuras: 'geometria', patrones: 'patrones' });

/** progreso_leccion en memoria, con RLS por usuario, nivel y última ronda. */
export function supabaseSimulado() {
  const rows = new Map();
  let user = null;
  const client = {
    from: () => ({
      select: () => {
        const filters = [];
        const builder = {
          eq(col, val) { filters.push((r) => r[col] === val); return builder; },
          then(resolve) {
            resolve({ data: [...rows.values()].filter((r) => r.usuario_id === user && filters.every((f) => f(r))).map((r) => ({ ...r })), error: null });
          },
        };
        return builder;
      },
    }),
    async rpc(_fn, { p_leccion_id: id, p_estrellas: stars, p_nivel: nivel = null }) {
      const key = `${user}|${id}`;
      const prev = rows.get(key);
      const row = {
        usuario_id: user, leccion_id: id, estrellas: Math.max(prev?.estrellas ?? 0, stars), intentos: (prev?.intentos ?? 0) + 1,
        ultimas_estrellas: stars, ultimo_intento: new Date(Date.now() + rows.size).toISOString(), nivel: nivel ?? prev?.nivel ?? null,
      };
      rows.set(key, row);
      return { data: { ...row }, error: null };
    },
  };
  const profiles = { currentUsuarioId: async () => ({ usuarioId: user, error: user ? null : 'Sin sesión' }) };
  return { rows, as(id) { user = id; return createLessonProgressService(() => client, profiles); } };
}

/** Un alumno que juega rondas con las mismas decisiones que Game.jsx. */
export function alumno({ catalog, db, usuarioId, diagnosticScore = 0, storeModuleId = 'conteo' }) {
  const service = db.as(usuarioId);
  const me = { rewards: { gems: 0, xp: 0 }, moduleWrites: [], courseWrites: [] };
  me.progress = async () => { db.as(usuarioId); return service.getLessonProgress(); };
  me.play = async (lessonId, { mistakes = 0, livesDepleted = false } = {}) => {
    db.as(usuarioId);
    const entry = getLessonById(catalog, lessonId);
    const saved = await service.getLessonProgress();
    const level = lessonLevelFor({ lessonId, levelByLesson: saved.levelByLesson, diagnosticScore });
    const plan = planLessonRound({ lesson: entry?.lesson ?? null, level });
    if (plan.mode === 'unavailable') return { plan, saved: false, recommendations: [] };
    const roundStars = starsForRound({ total: plan.questions.length, mistakes, approved: true }); // vidas recargadas si se agotaron
    me.rewards.gems += roundStars * 5; // recompensas como hoy (sin cambios)
    me.rewards.xp += roundStars * 50;
    const targets = roundProgressTargets({ lesson: entry.lesson, areaId: entry.course.id, storeModuleId, routeModuleId: storeModuleId });
    if (targets.recordsModuleProgress) me.moduleWrites.push(targets.moduleId);
    if (targets.recordsCourseProgress) me.courseWrites.push(entry.course.id);
    const result = levelAfterRound({ level, stars: roundStars, livesDepleted });
    const academic = academicStarsFor({ roundStars, livesDepleted });
    await service.saveLessonResult({ lessonId, stars: academic, level: result.level });
    const after = await service.getLessonProgress();
    const { recommendations } = buildRecommendations({
      catalog, diagnosticScore, starsByLesson: after.starsByLesson, latestStarsByLesson: after.latestStarsByLesson,
      levelByLesson: after.levelByLesson, limit: 2,
      lastRound: { lessonId, stars: academic, approved: !livesDepleted, levelBefore: level, levelAfter: result.level },
    });
    return { plan, saved: true, academic, roundStars, level, result, recommendations };
  };
  return me;
}

// ---------- Catálogo ficticio de 15 lecciones: 4 reales + 11 con ejercicios «[FICTICIO]» ----------
const real = JSON.parse(readFileSync(new URL('../../src/data/lessonContent.json', import.meta.url), 'utf8'));
const realLesson = (id) => real.courses.flatMap((c) => c.lessons).find((l) => l.id === id);

// ---------- Catálogo de prueba de 15 lecciones ----------
export function ficticio(id, level, n) {
  const count = ((n + level) % 9) + 1;
  const options = [count, count + 1, count + 2, count + 3];
  return {
    id: `${id}-n${level}-${n}`, prompt: `[FICTICIO] ${id} · nivel ${level} · pregunta ${n}`,
    visual: { type: 'objects', icon: 'star', count }, options, answer_index: 0, correct_answer: count,
    hint: '[FICTICIO] Pista.', feedback_correct: '[FICTICIO] ¡Bien!', feedback_incorrect: '[FICTICIO] Otra vez.',
    semanticKey: JSON.stringify([`ficticio-${id}`, [level, n]]),
  };
}
export const lessonV2 = (id, courseId, title, position, extra = {}) => ({
  id, course_id: courseId, title, position, base_level: 1, published: true,
  objective: '[FICTICIO] Objetivo.', explanation: '[FICTICIO] Teoría de la lección.',
  guided_example: { mode: 'visual', visual: { type: 'objects', icon: 'star', count: 2 }, explanation: '[FICTICIO] Ejemplo.' },
  levels: Object.fromEntries([1, 2, 3].map((lv) => [lv, { exercises: [1, 2, 3, 4, 5, 6].map((n) => ficticio(id, lv, n)) }])),
  ...extra,
});
export function catalogo15(extra = {}) {
  const v2 = (id, course, title, pos) => lessonV2(id, course, title, pos, extra[id] ?? {});
  return {
    courses: [
      { id: 'aritmetica', title: 'Aritmética', position: 1, description: '—', lessons: [
        realLesson('conteo-basico'), realLesson('sumas-basicas'),
        v2('cuantos-quedan', 'aritmetica', '¿Cuántos quedan?', 3),
        v2('grupos-iguales', 'aritmetica', 'Grupos iguales', 4),
        v2('repartimos-por-igual', 'aritmetica', 'Repartimos por igual', 5),
      ] },
      { id: 'geometria-patrones', title: 'Geometría', position: 2, description: '—', lessons: [
        realLesson('figuras'), realLesson('patrones'),
        v2('la-mitad-del-espejo', 'geometria-patrones', 'La mitad del espejo', 3),
        v2('una-vuelta-al-contorno', 'geometria-patrones', 'Una vuelta al contorno', 4),
        v2('llenamos-el-mosaico', 'geometria-patrones', 'Llenamos el mosaico', 5),
      ] },
      { id: 'algebra', title: 'Álgebra', position: 3, description: '—', lessons: [
        v2('escaleras-de-numeros', 'algebra', 'Escaleras de números', 1),
        v2('la-balanza-de-numu', 'algebra', 'La balanza de NUMU', 2),
        v2('el-numero-escondido', 'algebra', 'El número escondido', 3),
        v2('la-maquina-de-reglas', 'algebra', 'La máquina de reglas', 4),
        v2('de-un-dibujo-a-una-regla', 'algebra', 'De un dibujo a una regla', 5),
      ] },
    ],
  };
}
