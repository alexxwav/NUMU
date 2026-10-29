-- NUMU · Catálogo provisional del MVP (2 cursos, 4 lecciones)
-- Títulos provisionales: el contenido educativo definitivo lo entregará Viviana.
-- module_id debe coincidir con GENERATORS de src/state/questions.js.
-- Idempotente: puede ejecutarse varias veces.

insert into public.courses (id, title, description, position) values
  ('aritmetica',          'Aritmética',           'Conteo y sumas básicas.',              1),
  ('geometria-patrones',  'Geometría y patrones', 'Figuras geométricas y patrones.',      2)
on conflict (id) do update
  set title = excluded.title, description = excluded.description, position = excluded.position;

insert into public.lessons (id, course_id, title, position, module_id, base_level) values
  ('conteo-basico',  'aritmetica',         'Conteo básico',        1, 'conteo',     1),
  -- arithmeticQuestion solo genera sumas en el nivel 1; desde el nivel 2 mezcla restas (40 %).
  ('sumas-basicas',  'aritmetica',         'Sumas básicas',        2, 'aritmetica', 1),
  ('figuras',        'geometria-patrones', 'Figuras geométricas',  1, 'geometria',  1),
  ('patrones',       'geometria-patrones', 'Patrones',             2, 'patrones',   1)
on conflict (id) do update
  set course_id = excluded.course_id, title = excluded.title, position = excluded.position,
      module_id = excluded.module_id, base_level = excluded.base_level;
