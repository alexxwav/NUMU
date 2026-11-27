-- NUMU · PROPUESTA (NO APLICADA): nivel académico y última ronda por lección — versión transaccional
-- Proyecto: numu. Sustituye a supabase/propuesta_ultima_ronda.sql para producción (mismo resultado final).
-- Probada en Postgres en memoria con tests/db/migracion-produccion.check.mjs. Aplicar solo con autorización.
--
-- Diferencias con propuesta_ultima_ronda.sql:
--   1. Todo va en UNA transacción (begin … commit): si cualquier sentencia falla, no queda nada a
--      medias. En particular, nunca existe un momento sin el RPC registrar_resultado_leccion.
--   2. Al final avisa a la API de Supabase (PostgREST) que recargue su catálogo de funciones,
--      para que reconozca la firma nueva sin esperar.
--
-- Estado de producción confirmado (26-nov-2026) sobre el que se diseñó:
--   progreso_leccion(usuario_id integer, leccion_id text, estrellas smallint, intentos integer,
--                    created_at timestamptz, updated_at timestamptz) + 3 políticas RLS (SELECT, INSERT, UPDATE)
--   registrar_resultado_leccion(p_leccion_id text, p_estrellas integer)
--
-- Compatibilidad: la app publicada llama al RPC con (p_leccion_id, p_estrellas). Sigue funcionando
-- porque p_nivel es opcional (null = conservar el nivel guardado). La app nueva llama con p_nivel y,
-- si la migración aún no está aplicada, repite la llamada sin él (lessonProgressService.js).
-- No borra ni modifica filas: las existentes quedan con ultimas_estrellas, ultimo_intento y nivel en null.
-- Se puede ejecutar más de una vez sin duplicar objetos ni perder datos.

begin;

-- 1. Columnas nuevas (idempotente) --------------------------------------------------------------
alter table public.progreso_leccion
  add column if not exists ultimas_estrellas smallint check (ultimas_estrellas between 0 and 3),
  add column if not exists ultimo_intento timestamptz,
  add column if not exists nivel smallint check (nivel between 1 and 3);

comment on column public.progreso_leccion.estrellas is 'Mejor puntuación académica de la lección (0 a 3); T2 = 3.';
comment on column public.progreso_leccion.ultimas_estrellas is 'Estrellas académicas de la última ronda (0 a 3); null si aún no se registró con esta versión.';
comment on column public.progreso_leccion.ultimo_intento is 'Fecha y hora de la última ronda registrada.';
comment on column public.progreso_leccion.nivel is 'Nivel académico de la lección (1 a 3) que decide el motor (R7–R10); null = nivel inicial del diagnóstico.';

-- 2. RPC con p_nivel opcional (reemplaza a la firma de dos parámetros dentro de la transacción) ---
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

  -- Una sola sentencia: dos guardados simultáneos nunca bajan la mejor puntuación.
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

commit;

-- 3. Recarga del catálogo de la API (fuera de la transacción; no modifica datos).
notify pgrst, 'reload schema';
