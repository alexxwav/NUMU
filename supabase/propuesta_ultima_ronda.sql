-- NUMU · PROPUESTA (NO APLICADA): guardar la última ronda además de la mejor puntuación
-- Proyecto: numu. Requiere progreso_leccion y registrar_resultado_leccion de progreso_leccion.sql (César).
-- Opción A aprobada por el equipo; aplicar solo con autorización de César y del equipo.
--
-- Qué cambia:
--   · progreso_leccion.estrellas      → sigue siendo la MEJOR puntuación (premios, logros, tarjetas).
--   · progreso_leccion.ultimas_estrellas (nueva) → estrellas de la ÚLTIMA ronda (recomendador, criterio C9).
--   · progreso_leccion.ultimo_intento    (nueva) → fecha y hora de esa última ronda.
-- Las filas existentes quedan con ultimas_estrellas = null: no se inventa su última ronda;
-- con null el recomendador decide con la mejor puntuación, como hoy.
-- No toca tablas del equipo, políticas RLS ni permisos: create or replace conserva los GRANT de la función.
--
-- Verificación previa (solo lectura), ejecutar antes en el SQL Editor:
--   select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'progreso_leccion'
--   order by ordinal_position;
--   -- Debe mostrar usuario_id, leccion_id, estrellas, intentos, created_at, updated_at.
--   select pg_get_function_identity_arguments(p.oid)
--   from pg_proc p where p.proname = 'registrar_resultado_leccion';
--   -- Debe mostrar: p_leccion_id text, p_estrellas integer

-- 1. Columnas nuevas (idempotente) ------------------------------------------------
alter table public.progreso_leccion
  add column if not exists ultimas_estrellas smallint check (ultimas_estrellas between 0 and 3),
  add column if not exists ultimo_intento timestamptz;

comment on column public.progreso_leccion.estrellas is 'Mejor puntuación de la lección (0 a 3); la usan premios y logros.';
comment on column public.progreso_leccion.ultimas_estrellas is 'Estrellas de la última ronda (0 a 3); null si aún no se registró con esta versión.';
comment on column public.progreso_leccion.ultimo_intento is 'Fecha y hora de la última ronda registrada.';

-- 2. Misma función, misma firma: ahora también guarda la última ronda -----------------
create or replace function public.registrar_resultado_leccion(p_leccion_id text, p_estrellas integer)
returns public.progreso_leccion
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_usuario integer := public.usuario_actual();
  v_fila    public.progreso_leccion;
begin
  if v_usuario is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_leccion_id is null or p_leccion_id !~ '^[a-z0-9-]+$' then
    raise exception 'leccion_id invalido';
  end if;
  if p_estrellas is null or p_estrellas < 0 or p_estrellas > 3 then
    raise exception 'estrellas fuera de rango';
  end if;

  insert into public.progreso_leccion as p
    (usuario_id, leccion_id, estrellas, intentos, ultimas_estrellas, ultimo_intento)
  values
    (v_usuario, p_leccion_id, p_estrellas, 1, p_estrellas, now())
  on conflict (usuario_id, leccion_id) do update
    set estrellas         = greatest(p.estrellas, excluded.estrellas), -- la mejor no baja
        intentos          = p.intentos + 1,
        ultimas_estrellas = excluded.ultimas_estrellas,                -- la última siempre se actualiza
        ultimo_intento    = excluded.ultimo_intento,
        updated_at        = now()
  returning * into v_fila;

  return v_fila;
end;
$$;
