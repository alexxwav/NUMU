// Los 15 alumnos ficticios de supabase/alumnos_prueba.mjs son coherentes con el motor REAL:
// se reproducen sus rondas (estrellas de cada parada) desde el nivel inicial del diagnóstico con
// adaptiveLevelAfterRound y deben dar exactamente el nivel, la mejor marca, la última y los intentos
// sembrados. Sin Supabase; no contiene credenciales.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ALUMNOS, filasAlumno, respuestas, ANSWER_KEY, LESSON_MODULE, LESSON_COURSE, COURSE_ID_BY_SLUG } from '../supabase/alumnos_prueba.mjs';
import { adaptiveLevelAfterRound, initialLevelForScore } from '../src/utils/lessonLevel.js';
import { isLessonPublished } from '../src/utils/lessonRound.js';
import { buildRecommendations } from '../src/services/recommendationService.js';
import { scoreDiagnostic } from '../src/services/onboardingService.js';

const catalog = JSON.parse(readFileSync(new URL('../src/data/lessonContent.json', import.meta.url), 'utf8'));
const lessons = Object.fromEntries(catalog.courses.flatMap((c) => c.lessons).map((l) => [l.id, l]));

test('15 alumnos, sin duplicados, con datos válidos para el esquema real', () => {
  assert.equal(ALUMNOS.length, 15);
  assert.equal(new Set(ALUMNOS.map((a) => a.n)).size, 15);
  for (const a of ALUMNOS) {
    const { perfil, diagnostico } = filasAlumno(a);
    assert.match(perfil.nombre, /^NUMU Test \d{2}$/);
    assert.ok(perfil.nombre.length <= 50 && perfil.apodo.length <= 50 && perfil.grado_escolar.length <= 50, 'varchar(50)');
    assert.ok(perfil.edad >= 5 && perfil.edad <= 12, 'edad del público de NUMU');
    assert.ok(perfil.avatar >= 0 && perfil.avatar <= 7, 'avatar del catálogo (8)');
    assert.ok(perfil.intereses.length > 0 && perfil.intereses.every((i) => ['aritmetica', 'geometria', 'algebra'].includes(i)));
    assert.ok(['No sé nada', 'Sé un poco', 'Sé mucho'].includes(diagnostico.autoevaluacion), 'CHECK de autoevaluacion');
    assert.equal(scoreDiagnostic(diagnostico.respuestas, ANSWER_KEY).score, a.aciertos, 'las respuestas dan sus aciertos');
    assert.equal(diagnostico.puntuacion, Math.round((a.aciertos / 5) * 100));
  }
  assert.deepEqual(respuestas(5), ANSWER_KEY);
});

test('solo hay progreso en prácticas publicadas; nunca en las 11 bloqueadas', () => {
  for (const a of ALUMNOS) for (const id of Object.keys(a.lecciones)) {
    assert.ok(lessons[id] && isLessonPublished(lessons[id]), `${a.n}: ${id} debe estar publicada`);
  }
});

test('cada progreso es exactamente el que produce el motor (R1–R3, R7–R11, T2)', () => {
  for (const a of ALUMNOS) {
    const inicial = initialLevelForScore(a.aciertos);
    for (const [id, [mejor, intentos, ultimas, nivel]] of Object.entries(a.lecciones)) {
      const rondas = Object.values(a.mapa[LESSON_MODULE[id]] ?? {}); // estrellas de cada ronda de esa lección
      assert.equal(rondas.length, intentos, `${a.n} ${id}: una parada del mapa por ronda`);
      let level = inicial; let lowStreak = 0;
      for (const stars of rondas) ({ level, lowStreak } = adaptiveLevelAfterRound({ level, stars, livesDepleted: stars === 0, lowStreak }));
      assert.equal(level, nivel, `${a.n} ${id}: nivel`);
      assert.equal(Math.max(...rondas), mejor, `${a.n} ${id}: mejor marca`);
      assert.equal(rondas.at(-1), ultimas, `${a.n} ${id}: última ronda`);
    }
    const { perfil, modulos, cursos } = filasAlumno(a);
    const estrellas = modulos.reduce((t, m) => t + Object.values(m.stars_by_level).reduce((x, y) => x + y, 0), 0);
    assert.equal(perfil.xp, estrellas * 50, `${a.n}: XP = estrellas del mapa × 50`);
    assert.equal(perfil.gemas, estrellas * 5, `${a.n}: gemas = 5 por estrella de ronda`);
    for (const c of cursos) assert.ok(Object.values(COURSE_ID_BY_SLUG).includes(c.curso_id));
    for (const m of modulos) assert.equal(m.current_level, Object.keys(m.stars_by_level).length + 1, `${a.n} ${m.module_id}: parada siguiente`);
    for (const id of Object.keys(a.lecciones)) assert.ok(cursos.some((c) => c.curso_id === COURSE_ID_BY_SLUG[LESSON_COURSE[id]]));
  }
});

test('los perfiles cubren principiante, intermedio y avanzado y producen recomendaciones distintas', () => {
  const niveles = new Set(ALUMNOS.map((a) => initialLevelForScore(a.aciertos)));
  assert.deepEqual([...niveles].sort(), [1, 2, 3]);
  const tipos = new Set();
  for (const a of ALUMNOS) {
    const starsByLesson = Object.fromEntries(Object.entries(a.lecciones).map(([id, [mejor]]) => [id, mejor]));
    const latestStarsByLesson = Object.fromEntries(Object.entries(a.lecciones).map(([id, [, , ultimas]]) => [id, ultimas]));
    const levelByLesson = Object.fromEntries(Object.entries(a.lecciones).map(([id, [, , , nivel]]) => [id, nivel]));
    const { recommendations, unavailableInterests } = buildRecommendations({ catalog, interests: a.intereses, diagnosticScore: a.aciertos, starsByLesson, latestStarsByLesson, levelByLesson });
    assert.ok(recommendations.length > 0 || Object.keys(a.lecciones).length === 4, `${a.n}: tiene una recomendación`);
    for (const r of recommendations) assert.ok(isLessonPublished(lessons[r.lessonId]), 'nunca recomienda una práctica bloqueada');
    if (a.intereses.includes('algebra')) assert.ok(unavailableInterests.some((i) => i.id === 'algebra'), 'Álgebra «Próximamente»');
    if (recommendations[0]) tipos.add(recommendations[0].type);
  }
  assert.ok(tipos.size >= 3, `recomendaciones variadas: ${[...tipos].join(', ')}`);
});

test('las filas se insertan con las restricciones reales de numu (PGlite: NOT NULL, CHECK, tipos, únicas)', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  await db.exec(`
    create table usuarios (id serial primary key, correo varchar not null unique, auth_id uuid unique);
    create table perfil_usuario (id serial primary key, usuario_id integer unique references usuarios (id), nombre varchar(50) not null, apodo varchar(50),
      edad integer not null, pais varchar(50) not null, grado_escolar varchar(50), avatar integer, gemas integer check (gemas >= 0), xp integer, intereses text[] not null);
    create table resultados_examen_diagnostico (id serial primary key, usuario_id integer references usuarios (id), num_aciertos integer, puntuacion numeric,
      autoevaluacion varchar(20) check (autoevaluacion in ('No sé nada', 'Sé un poco', 'Sé mucho')), respuestas jsonb);
    create table progreso_leccion (usuario_id integer references usuarios (id), leccion_id text check (leccion_id ~ '^[a-z0-9-]+$'), estrellas smallint check (estrellas between 0 and 3),
      intentos integer, ultimas_estrellas smallint check (ultimas_estrellas between 0 and 3), ultimo_intento timestamptz, nivel smallint check (nivel between 1 and 3), primary key (usuario_id, leccion_id));
    create table user_module_progress (usuario_id integer references usuarios (id), module_id text check (module_id in ('conteo', 'aritmetica', 'geometria', 'patrones')),
      current_level integer check (current_level >= 1), stars_by_level jsonb, primary key (usuario_id, module_id));
    create table progreso (id serial primary key, usuario_id integer references usuarios (id), curso_id integer, nivel_actual integer, num_estrellas integer,
      num_intentos integer, racha_dias integer, leccion_completada boolean, unique (usuario_id, curso_id));
  `);
  for (const a of ALUMNOS) {
    const f = filasAlumno(a);
    const [{ id }] = (await db.query(`insert into usuarios (correo, auth_id) values ($1, gen_random_uuid()) returning id`, [f.email((n) => `buzon+numutest${n}@ejemplo.mx`)])).rows;
    const p = f.perfil;
    await db.query(`insert into perfil_usuario (usuario_id, nombre, apodo, edad, pais, grado_escolar, avatar, gemas, xp, intereses) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, p.nombre, p.apodo, p.edad, p.pais, p.grado_escolar, p.avatar, p.gemas, p.xp, p.intereses]);
    const d = f.diagnostico;
    await db.query(`insert into resultados_examen_diagnostico (usuario_id, num_aciertos, puntuacion, autoevaluacion, respuestas) values ($1,$2,$3,$4,$5)`,
      [id, d.num_aciertos, d.puntuacion, d.autoevaluacion, JSON.stringify(d.respuestas)]);
    for (const l of f.lecciones) await db.query(`insert into progreso_leccion values ($1,$2,$3,$4,$5,$6,$7)`, [id, l.leccion_id, l.estrellas, l.intentos, l.ultimas_estrellas, l.ultimo_intento, l.nivel]);
    for (const m of f.modulos) await db.query(`insert into user_module_progress values ($1,$2,$3,$4)`, [id, m.module_id, m.current_level, JSON.stringify(m.stars_by_level)]);
    for (const c of f.cursos) await db.query(`insert into progreso (usuario_id, curso_id, nivel_actual, num_estrellas, num_intentos, racha_dias, leccion_completada) values ($1,$2,$3,$4,$5,$6,$7)`,
      [id, c.curso_id, c.nivel_actual, c.num_estrellas, c.num_intentos, c.racha_dias, c.leccion_completada]);
  }
  const [cuenta] = (await db.query(`select (select count(*) from perfil_usuario)::int p, (select count(*) from resultados_examen_diagnostico)::int d,
    (select count(*) from progreso_leccion)::int l, (select count(*) from user_module_progress)::int m`)).rows;
  const esperado = ALUMNOS.reduce((t, x) => ({ l: t.l + filasAlumno(x).lecciones.length, m: t.m + filasAlumno(x).modulos.length }), { l: 0, m: 0 });
  assert.deepEqual(cuenta, { p: 15, d: 15, ...esperado });
  assert.deepEqual(esperado, { l: 27, m: 27 });
  await db.close();
});
