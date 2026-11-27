-- NUMU · REVERSIÓN de las tres propuestas (usar solo si algo sale mal después de aplicarlas).
-- Probada en Postgres en memoria con tests/db/despliegue-completo.check.mjs.
--
-- Deja la base funcionando como ANTES para la app publicada, SIN BORRAR DATOS:
--   · XP monótona: quita el trigger (la XP guardada se queda como está).
--   · Última ronda: restaura el RPC de 2 parámetros; las columnas nuevas se conservan (nullable,
--     la app anterior no las lee) junto con lo que ya guardaron.
--   · Gemas: quita triggers y RPC; el saldo actual de perfil_usuario.gemas se conserva y vuelve a
--     poder escribirlo la app. Las tablas compra_tienda / movimiento_gemas / articulo_tienda se
--     CONSERVAN como respaldo (borrarlas es una decisión aparte, después de revisar).
-- Idempotente. Todo en una transacción.

begin;

-- Gemas -----------------------------------------------------------------------------------------
drop trigger if exists perfil_usuario_gemas_por_rpc on public.perfil_usuario;
drop trigger if exists perfil_usuario_saldo_inicial on public.perfil_usuario;
drop function if exists public.comprar_articulo(text, text);
drop function if exists public.registrar_gemas_ronda(integer, text);
drop function if exists public.perfil_usuario_gemas_por_rpc();
drop function if exists public.perfil_usuario_saldo_inicial();
alter table public.perfil_usuario drop constraint if exists perfil_usuario_gemas_no_negativas;

-- Última ronda: vuelve el RPC de producción (p_leccion_id, p_estrellas) -------------------------
drop function if exists public.registrar_resultado_leccion(text, integer, integer);
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
    (usuario_id, leccion_id, estrellas, intentos)
  values
    (v_usuario, p_leccion_id, p_estrellas, 1)
  on conflict (usuario_id, leccion_id) do update
    set estrellas  = greatest(p.estrellas, excluded.estrellas),
        intentos   = p.intentos + 1,
        updated_at = now()
  returning * into v_fila;

  return v_fila;
end;
$$;
revoke execute on function public.registrar_resultado_leccion(text, integer) from public, anon;
grant execute on function public.registrar_resultado_leccion(text, integer) to authenticated;

-- XP monótona ---------------------------------------------------------------------------------------
drop trigger if exists perfil_usuario_xp_no_baja on public.perfil_usuario;
drop function if exists public.perfil_usuario_xp_no_baja();

notify pgrst, 'reload schema';

commit;
