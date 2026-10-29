-- NUMU · Catálogo del MVP (2 cursos, 4 lecciones)
-- Descripciones: material de Viviana (NUMU_descripciones_catalogo_propuesta.sql, 29-10-2026).
-- module_id debe coincidir con GENERATORS de src/state/questions.js.
-- Idempotente: puede ejecutarse varias veces; este archivo es la fuente única del catálogo.

insert into public.courses (id, title, description, position) values
  ('aritmetica',         'Aritmética',
   'Construye confianza con el conteo y las sumas, paso a paso.', 1),
  ('geometria-patrones', 'Geometría y patrones',
   'Observa figuras, reconoce sus lados y descubre secuencias de colores.', 2)
on conflict (id) do update
  set title = excluded.title, description = excluded.description, position = excluded.position;

insert into public.lessons (id, course_id, title, description, position, module_id, base_level) values
  -- PENDIENTE: el texto propuesto dice "entre 1 y 10", pero countQuestion genera de 2 a 5 objetos
  -- en el nivel 1 y llega a 10 en el nivel 6. Falta ajustar el texto o el generador.
  ('conteo-basico', 'aritmetica', 'Conteo básico', null, 1, 'conteo', 1),
  -- PENDIENTE: el texto propuesto dice "sumas ... usando apoyo visual", pero arithmeticQuestion
  -- muestra solo números (sin objetos) y mezcla restas (40 %) desde el nivel 2.
  ('sumas-basicas', 'aritmetica', 'Sumas básicas', null, 2, 'aritmetica', 1),
  ('figuras', 'geometria-patrones', 'Figuras geométricas',
   'Reconocer triángulos, cuadrados, pentágonos y hexágonos por su número de lados. Las figuras tienen bordes llamados lados. Podemos identificar algunas figuras contando sus lados: el triángulo tiene tres y el cuadrado tiene cuatro.',
   1, 'geometria', 1),
  ('patrones', 'geometria-patrones', 'Patrones',
   'Identificar el color que continúa una secuencia repetitiva. Un patrón es algo que se repite en el mismo orden. Si vemos morado, amarillo, morado, amarillo, el siguiente es morado.',
   2, 'patrones', 1)
on conflict (id) do update
  set course_id = excluded.course_id, title = excluded.title, description = excluded.description,
      position = excluded.position, module_id = excluded.module_id, base_level = excluded.base_level;
