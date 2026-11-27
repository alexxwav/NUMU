import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { loadCatalogV2 } from '../content-drafts/catalog-v2.fixture.js';
import { getLessonById, isLessonPublished } from '../src/utils/lessonContent.js';
import { renderGuidedExample } from '../src/utils/lessonGameAdapter.js';

const catalog = loadCatalogV2();
const lessons = catalog.courses.flatMap(course => course.lessons);
const lesson = id => getLessonById(catalog, id).lesson;

test('Las 15 lecciones tienen objetivo, teoría y los ejemplos aprobados', () => {
  const interactions = [];
  let visual = 0;
  for (const { id, title, objective, explanation, guided_example: example } of lessons) {
    assert.ok(title.trim() && objective.trim() && explanation.trim() && example.explanation.trim(), id);
    if (id === 'conteo-basico') continue;
    if (example.mode === 'interactive') {
      interactions.push(example.interaction.type);
      assert.ok(example.interaction.instructions.every(step => step.trim()), id);
      assert.ok(example.interaction.instructions.length >= 2, id);
      assert.ok(example.interaction.feedback_on_complete.trim() && example.interaction.restart_label.trim(), id);
    } else {
      visual++;
      for (const item of [example, ...(example.additional_examples ?? [])]) {
        const html = renderGuidedExample(item.visual);
        assert.match(html, /role="img"/, id);
        assert.match(html, /aria-label="[^"]+"/, id);
      }
    }
  }
  assert.equal(visual, 8);
  assert.deepEqual(interactions, [
    'remove_objects', 'share_objects', 'place_reflection_cells',
    'place_tiles', 'balance_objects', 'try_rule_machine',
  ]);
});

test('Los ejemplos de las lecciones originales enseñan la operación o propiedad esperada', () => {
  const count = lesson('conteo-basico');
  assert.equal(count.guided_example.visual.icon, 'balloon');
  assert.notEqual(count.guided_example.visual.icon, count.exercises[0].visual.icon);
  const subtraction = lesson('sumas-basicas').guided_example.additional_examples[0].visual;
  assert.match(renderGuidedExample(subtraction), /5 − 2 = 3/);
  const { guided_example: figure, levels } = lesson('figuras');
  const rotated = figure.additional_examples[0].visual;
  assert.equal(rotated.shape, figure.visual.shape);
  assert.ok(rotated.rotation_degrees > 0 && rotated.size === 'small');
  assert.ok(!levels['1'].exercises.some(({ visual }) => JSON.stringify(visual).includes('hexagon')));
  for (const level of ['2', '3']) assert.ok(levels[level].exercises.some(({ visual }) => visual.shape === 'hexagon'));
  const pattern = lesson('patrones').guided_example.additional_examples[0].visual.sequence;
  assert.equal(new Set(pattern).size, 3);
  assert.deepEqual(pattern.slice(0, 3), pattern.slice(3));
});

test('La visibilidad de teoría es independiente de la disponibilidad de práctica', () => {
  assert.deepEqual(lessons.filter(isLessonPublished).map(({ id }) => id),
    ['conteo-basico', 'sumas-basicas', 'figuras', 'patrones']);
  assert.equal(lessons.filter(({ published }) => published === false).length, 11);
  assert.ok(!isLessonPublished(getLessonById(catalog, 'sin-leccion')?.lesson));
});

test('React renderiza los ejemplos nuevos y expone controles y retroalimentación accesibles', async t => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  t.after(() => server.close());
  const { default: GuidedExample } = await server.ssrLoadModule('/src/components/lessonExamples/GuidedExample.jsx');
  for (const { id, guided_example: example } of lessons.filter(({ id }) => id !== 'conteo-basico')) {
    const html = renderToStaticMarkup(createElement(GuidedExample, { example }));
    assert.match(html, /Ejemplo guiado/, id);
    if (example.mode === 'interactive') {
      assert.match(html, /<button type="button"/, id);
      assert.match(html, /role="status"/, id);
    } else {
      assert.match(html, /role="img"/, id);
    }
  }
});
