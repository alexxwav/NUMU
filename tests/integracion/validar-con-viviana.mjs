#!/usr/bin/env node
// Validación reproducible del motor de Laura con los contenidos de Viviana, en un entorno AISLADO.
//
//   node tests/integracion/validar-con-viviana.mjs [--ref origin/feat/viviana-contenidos-20] [--keep]
//
// · Copia el worktree actual (archivos versionados + nuevos no ignorados) a una carpeta temporal del
//   sistema y le superpone SOLO los archivos que cambió la referencia de Viviana desde la base común.
// · No modifica ningún worktree, rama ni índice: solo usa git en modo lectura (ls-files, diff, show).
// · Catálogo: si src/data/lessonContent.json ya trae las 15 lecciones aprobadas, usa ese (OFICIAL);
//   si no, exporta loadCatalogV2() de content-drafts/catalog-v2.fixture.js (FIXTURE, no oficial).
// · Ejecuta la suite completa y las pruebas de contrato, cobertura y recorrido con ese catálogo, e
//   imprime la tabla de las 45 combinaciones lección/nivel. Sale con código ≠ 0 si algo falla.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync, symlinkSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const REF = args.includes('--ref') ? args[args.indexOf('--ref') + 1] : 'origin/feat/viviana-contenidos-20';
const KEEP = args.includes('--keep');
const git = (...a) => {
  const r = spawnSync('git', a, { encoding: 'buffer', maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`git ${a.join(' ')}: ${r.stderr.toString()}`);
  return r.stdout;
};
const text = (...a) => git(...a).toString('utf8').trim();

const root = text('rev-parse', '--show-toplevel');
const gitDir = resolve(root, text('rev-parse', '--git-common-dir'));
const refSha = text('rev-parse', '--short', REF);
const base = text('merge-base', 'HEAD', REF);
const tmp = mkdtempSync(join(tmpdir(), 'numu-integracion-'));
console.log(`Entorno aislado: ${tmp}`);
console.log(`Laura: ${text('rev-parse', '--short', 'HEAD')} (+ cambios del worktree) · Viviana: ${REF} (${refSha}) · base común: ${base.slice(0, 7)}`);

// 1. Copia del worktree de Laura (sin node_modules, dist ni ignorados).
const files = [...git('ls-files', '-z').toString('utf8').split('\0'), ...git('ls-files', '--others', '--exclude-standard', '-z').toString('utf8').split('\0')]
  .filter(Boolean);
for (const f of new Set(files)) {
  if (!existsSync(join(root, f))) continue; // borrado en el worktree
  mkdirSync(dirname(join(tmp, f)), { recursive: true });
  copyFileSync(join(root, f), join(tmp, f));
}
// 2. Archivos de Viviana (solo los que cambió su rama).
const theirs = text('diff', '--name-only', base, REF).split('\n').filter(Boolean);
const overlap = theirs.filter((f) => text('diff', '--name-only', base, 'HEAD').split('\n').includes(f));
for (const f of theirs) {
  const exists = spawnSync('git', ['cat-file', '-e', `${REF}:${f}`]).status === 0;
  if (!exists) { rmSync(join(tmp, f), { force: true }); continue; }
  mkdirSync(dirname(join(tmp, f)), { recursive: true });
  writeFileSync(join(tmp, f), git('show', `${REF}:${f}`));
}
console.log(`Archivos de Viviana superpuestos: ${theirs.length}${overlap.length ? ` · TOCADOS POR AMBAS: ${overlap.join(', ')}` : ' · sin archivos en común'}`);
const nm = join(tmp, 'node_modules');
symlinkSync(join(root, 'node_modules'), nm, 'junction');

// 3. Catálogo: oficial si ya tiene las 15 lecciones; si no, el fixture de Viviana.
const APPROVED = ['conteo-basico', 'sumas-basicas', 'cuantos-quedan', 'grupos-iguales', 'repartimos-por-igual',
  'figuras', 'patrones', 'la-mitad-del-espejo', 'una-vuelta-al-contorno', 'llenamos-el-mosaico',
  'escaleras-de-numeros', 'la-balanza-de-numu', 'el-numero-escondido', 'la-maquina-de-reglas', 'de-un-dibujo-a-una-regla'];
const official = JSON.parse(readFileSync(join(tmp, 'src/data/lessonContent.json'), 'utf8'));
const officialIds = official.courses.flatMap((c) => c.lessons.map((l) => l.id)).sort();
let catalogPath = join(tmp, 'src/data/lessonContent.json');
let source = 'OFICIAL (src/data/lessonContent.json)';
if (JSON.stringify(officialIds) !== JSON.stringify([...APPROVED].sort())) {
  const fixture = join(tmp, 'content-drafts/catalog-v2.fixture.js');
  if (!existsSync(fixture)) throw new Error('Ni el catálogo oficial ni el fixture de Viviana tienen las 15 lecciones.');
  const { loadCatalogV2 } = await import(pathToFileURL(fixture).href);
  catalogPath = join(tmp, 'catalogo-v2-fixture.json');
  writeFileSync(catalogPath, JSON.stringify(loadCatalogV2(), null, 2));
  source = 'FIXTURE de Viviana (content-drafts/catalog-v2.fixture.js) — el catálogo oficial aún NO tiene las 15 lecciones';
}
console.log(`Catálogo usado: ${source}\n`);

// 4. Pruebas.
const run = (label, testArgs, env = {}) => {
  const r = spawnSync(process.execPath, ['--test', ...testArgs], { cwd: tmp, encoding: 'utf8', env: { ...process.env, GIT_DIR: gitDir, ...env }, shell: false });
  const out = `${r.stdout}${r.stderr}`;
  const pick = (k) => Number(out.match(new RegExp(`^ℹ ${k} (\\d+)`, 'm'))?.[1] ?? 0);
  const failed = [...out.matchAll(/^✖ (.+?) \(\d/mg)].map((m) => m[1]).filter((n) => n !== 'failing tests:');
  console.log(`${label}: ${pick('pass')} aprobadas · ${pick('fail')} fallidas · ${pick('skipped')} omitidas`);
  for (const f of new Set(failed)) console.log(`   ✖ ${f}`);
  return pick('fail');
};
const testFiles = readdirSync(join(tmp, 'tests')).filter((f) => f.endsWith('.test.js')).map((f) => `tests/${f}`);
let failures = 0;
failures += run('Suite completa combinada (catálogo oficial)', testFiles);
failures += run('Contrato, cobertura y recorrido con el catálogo de 15', ['tests/catalogo15.contract.test.js', 'tests/cobertura45.test.js', 'tests/recorridoIntegral.test.js'], { NUMU_CATALOG: catalogPath });

// 5. Tabla de las 45 combinaciones (lecciones abiertas solo para medir; el estado real se indica).
const { planLessonRound, lessonCoverage, questionSignature } = await import(pathToFileURL(join(tmp, 'src/utils/lessonRound.js')).href);
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
let ok = 0; const gaps = [];
console.log('\nLección (área)                              publicada  N1               N2               N3');
for (const course of catalog.courses) for (const lesson of course.lessons) {
  const cells = [1, 2, 3].map((level) => {
    const open = planLessonRound({ lesson: { ...lesson, published: true }, level });
    const distinct = new Set(open.questions.map(questionSignature)).size;
    const cov = lessonCoverage({ lesson: { ...lesson, published: true }, level }).distinct;
    if (open.mode === 'selector' && distinct === 6) ok++; else gaps.push(`${lesson.id} N${level}: ${open.mode}, cobertura ${cov}`);
    return `${open.mode.padEnd(11)}${String(cov).padStart(3)}`;
  });
  console.log(`${`${lesson.id} (${course.id})`.padEnd(44)}${String(lesson.published !== false).padEnd(11)}${cells.map((c) => c.padEnd(17)).join('')}`);
}
console.log(`\nCombinaciones con 6 preguntas distintas por el selector: ${ok}/45`);
console.log(`Sin cobertura (documentadas, no ocultas): ${gaps.join(' · ') || 'ninguna'}`);

if (KEEP) console.log(`\nEntorno conservado en ${tmp}`);
else { unlinkSync(nm); rmSync(tmp, { recursive: true, force: true }); }
process.exit(failures ? 1 : 0);
