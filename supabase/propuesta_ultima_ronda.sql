-- NUMU · MIGRACIÓN PREPARADA (NO APLICADA): nivel académico y última ronda por lección
-- Proyecto: numu. Requiere progreso_leccion y registrar_resultado_leccion de progreso_leccion.sql (César).
-- Probada localmente con tests/db/ultima-ronda.check.mjs. Aplicar solo con autorización del equipo.
--
-- Una sola fila por usuario y lección guarda todo (sin tablas nuevas):
--   · estrellas          → MEJOR puntuación (estrellas visibles, premios, logros, historial). Ya existía.
--   · intentos           → rondas registradas. Ya existía.
--   · ultimas_estrellas  → estrellas de la ÚLTIMA ronda (las usa el recomendador). Nueva.
--   · ultimo_intento     → fecha de la última ronda (evita que una lectura antigua gane). Nueva.
--   · nivel              → nivel ACADÉMICO de la lección, de 1 a 3 (R1–R3 y R7–R10). Nueva.
-- Las filas existentes quedan con ultimas_estrellas, ultimo_intento y nivel en null: no se inventan;
-- la app usa entonces la mejor puntuación y el nivel inicial del diagnóstico.
-- No cambia políticas RLS: la tabla y sus 3 políticas siguen igual.
--
-- Verificación previa (solo lectura) en el SQL Editor:
--   select column_name, data_type, is_nullable from information_schema.columns
--   where table_schema = 'public' and table_name = 'progreso_leccion' order by ordinal_position;
--     → usuario_id, leccion_id, estrellas, intentos, created_at, updated_at
--   select pg_get_function_identity_arguments(p.oid) from pg_proc p
--   where p.proname = 'registrar_resultado_leccion';
--     → p_leccion_id text, p_estrellas integer

-- 1. Columnas nuevas (idempotente) ------------------------------------------------
alter table public.progreso_leccion
  add column if not exists ultimas_estrellas smallint check (ultimas_estrellas between 0 and 3),
  add column if not exists ultimo_intento timestamptz,
  add column if not exists nivel smallint check (nivel between 1 and 3);

comment on column public.progreso_leccion.estrellas is 'Mejor puntuación de la lección (0 a 3); estrellas visibles, premios y logros.';
comment on column public.progreso_leccion.ultimas_estrellas is 'Estrellas de la última ronda (0 a 3); null si aún no se registró con esta versión.';
comment on column public.progreso_leccion.ultimo_intento is 'Fecha y hora de la última ronda registrada.';
comment on column public.progreso_leccion.nivel is 'Nivel académico de la lección (1 a 3) que decide el motor (R7–R10); null = nivel inicial del diagnóstico.';

-- 2. La función recibe el nivel decidido por el motor (parámetro opcional) ---------------
-- Se reemplaza la firma de dos parámetros por la de tres; llamarla con dos sigue funcionando
-- porque p_nivel es opcional (null = conservar el nivel guardado).
drop function if exists public.registrar_resultado_leccion(text, integer);

create or replace function public.registrar_resultado_leccion(
  p_leccion_id text,
  p_estrellas  integer,
  p_nivel      integer default null
)
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
  if p_nivel is not null and (p_nivel < 1 or p_nivel > 3) then
    raise exception 'nivel fuera de rango';
  end if;

  insert into public.progreso_leccion as p
    (usuario_id, leccion_id, estrellas, intentos, ultimas_estrellas, ultimo_intento, nivel)
  values
    (v_usuario, p_leccion_id, p_estrellas, 1, p_estrellas, now(), p_nivel)
  on conflict (usuario_id, leccion_id) do update
    set estrellas         = greatest(p.estrellas, excluded.estrellas), -- la mejor no baja
        intentos          = p.intentos + 1,
        ultimas_estrellas = excluded.ultimas_estrellas,                -- la última siempre se actualiza
        ultimo_intento    = excluded.ultimo_intento,
        nivel             = coalesce(excluded.nivel, p.nivel),         -- sin nivel: se conserva
        updated_at        = now()
  returning * into v_fila;

  return v_fila;
end;
$$;

-- Mismos permisos que la función original (solo estudiantes con sesión).
revoke execute on function public.registrar_resultado_leccion(text, integer, integer) from public, anon;
grant execute on function public.registrar_resultado_leccion(text, integer, integer) to authenticated;
