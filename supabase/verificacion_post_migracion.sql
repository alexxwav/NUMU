-- NUMU · COMPROBACIÓN POSTERIOR (solo lectura). Ejecutar después de CADA migración.
-- Requiere haber ejecutado antes respaldo_previo.sql (compara contra respaldo_numu.*_20261127).
-- Una fila por comprobación: migracion | comprobacion | estado | detalle.
--   OK · PENDIENTE (esa migración aún no se aplica) · ERROR (detenerse y revisar / revertir).
-- Ninguna migración cambia datos: filas, gemas, XP y mejores estrellas deben seguir iguales.
-- Probado en Postgres en memoria con tests/db/despliegue-completo.check.mjs.

with
n as (select (xpath('/row/v/text()', query_to_xml(q, false, true, '')))[1]::text as v, k
      from (values
        ('perfil_actual', 'select count(*) || '' · '' || coalesce(sum(gemas), 0) || '' · '' || coalesce(sum(xp), 0) || '' · '' || coalesce(md5(string_agg(usuario_id || '':'' || gemas || '':'' || xp, ''|'' order by usuario_id)), '''') as v from public.perfil_usuario'),
        ('perfil_respaldo', 'select count(*) || '' · '' || coalesce(sum(gemas), 0) || '' · '' || coalesce(sum(xp), 0) || '' · '' || coalesce(md5(string_agg(usuario_id || '':'' || gemas || '':'' || xp, ''|'' order by usuario_id)), '''') as v from respaldo_numu.perfil_usuario_20261127'),
        ('leccion_actual', 'select count(*) || '' · '' || coalesce(md5(string_agg(usuario_id || '':'' || leccion_id || '':'' || estrellas || '':'' || intentos, ''|'' order by usuario_id, leccion_id)), '''') as v from public.progreso_leccion'),
        ('leccion_respaldo', 'select count(*) || '' · '' || coalesce(md5(string_agg(usuario_id || '':'' || leccion_id || '':'' || estrellas || '':'' || intentos, ''|'' order by usuario_id, leccion_id)), '''') as v from respaldo_numu.progreso_leccion_20261127')
      ) x(k, q)),
v as (select max(v) filter (where k = 'perfil_actual') pa, max(v) filter (where k = 'perfil_respaldo') pr,
             max(v) filter (where k = 'leccion_actual') la, max(v) filter (where k = 'leccion_respaldo') lr from n),
fn as (select to_regprocedure('public.registrar_resultado_leccion(text,integer,integer)') as rpc3,
              to_regprocedure('public.registrar_resultado_leccion(text,integer)') as rpc2,
              to_regprocedure('public.comprar_articulo(text,text)') as compra,
              to_regprocedure('public.registrar_gemas_ronda(integer,text)') as ronda),
trg as (select t.tgname from pg_trigger t where t.tgrelid = 'public.perfil_usuario'::regclass and not t.tgisinternal),
filas as (
  -- 0. Datos intactos (siempre)
  select 0 o, 'todas' m, 'perfil_usuario: perfiles · suma gemas · suma xp · huella' c,
         case when v.pa = v.pr then 'OK' else 'ERROR' end e, 'ahora ' || v.pa || ' · respaldo ' || v.pr d from v
  union all
  select 0, 'todas', 'progreso_leccion: filas · huella (mejor estrella e intentos)',
         case when v.la = v.lr then 'OK' else 'ERROR' end, 'ahora ' || v.la || ' · respaldo ' || v.lr from v
  union all
  select 0, 'todas', x.t || ': filas',
         case when a.n = b.n then 'OK' else 'ERROR' end, 'ahora ' || a.n || ' · respaldo ' || b.n
  from (values ('usuarios'), ('resultados_examen_diagnostico'), ('progreso'), ('user_module_progress')) x(t)
  cross join lateral (select (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', x.t), false, true, '')))[1]::text as n) a
  cross join lateral (select (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from respaldo_numu.%I', x.t || '_20261127'), false, true, '')))[1]::text as n) b
  union all
  -- 1. propuesta_xp_monotona.sql
  select 1, '1 · xp_monotona', 'trigger perfil_usuario_xp_no_baja',
         case when exists (select 1 from trg where tgname = 'perfil_usuario_xp_no_baja') then 'OK' else 'PENDIENTE' end, 'la XP guardada nunca baja'
  union all
  -- 2. propuesta_ultima_ronda_transaccional.sql
  select 2, '2 · ultima_ronda', 'RPC registrar_resultado_leccion(text, integer, integer)',
         case when fn.rpc3 is null then 'PENDIENTE'
              when fn.rpc2 is not null then 'ERROR'
              when has_function_privilege('authenticated', fn.rpc3, 'execute') and not has_function_privilege('anon', fn.rpc3, 'execute') then 'OK' else 'ERROR' end,
         'p_nivel opcional; la firma de 2 parámetros ya no debe existir; authenticated sí, anon no' from fn
  union all
  select 2, '2 · ultima_ronda', 'columnas ultimas_estrellas, ultimo_intento, nivel',
         case when (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'progreso_leccion'
                    and column_name in ('ultimas_estrellas', 'ultimo_intento', 'nivel')) = 3 then 'OK' else 'PENDIENTE' end,
         'filas existentes quedan en null (correcto)'
  union all
  -- 3. propuesta_gemas_transaccional.sql
  select 3, '3 · gemas', 'tablas articulo_tienda, compra_tienda, movimiento_gemas',
         case when to_regclass('public.articulo_tienda') is not null and to_regclass('public.compra_tienda') is not null and to_regclass('public.movimiento_gemas') is not null
              then 'OK' else 'PENDIENTE' end, 'con RLS y solo lectura para authenticated'
  union all
  select 3, '3 · gemas', 'artículos y precios de la tienda',
         case when to_regclass('public.articulo_tienda') is null then 'PENDIENTE'
              when (xpath('/row/v/text()', query_to_xml('select string_agg(id || ''='' || precio, '','' order by id) as v from public.articulo_tienda', false, true, '')))[1]::text
                   = 'frame-coral=30,frame-cyan=40,frame-gold=60,frame-indigo=50,frame-mint=40,frame-orange=30' then 'OK' else 'ERROR' end,
         'los 6 marcos de Avatar.js'
  union all
  select 3, '3 · gemas', 'saldo inicial en el libro = perfiles y gemas del respaldo',
         case when to_regclass('public.movimiento_gemas') is null then 'PENDIENTE'
              when (xpath('/row/v/text()', query_to_xml('select count(*) || '' · '' || coalesce(sum(cantidad), 0) as v from public.movimiento_gemas where tipo = ''saldo_inicial''', false, true, '')))[1]::text
                   = (xpath('/row/v/text()', query_to_xml('select count(*) || '' · '' || coalesce(sum(gemas), 0) as v from respaldo_numu.perfil_usuario_20261127', false, true, '')))[1]::text
              then 'OK' else 'ERROR' end,
         'una fila saldo_inicial por perfil con sus gemas'
  union all
  select 3, '3 · gemas', 'RPC comprar_articulo y registrar_gemas_ronda',
         case when fn.compra is null or fn.ronda is null then 'PENDIENTE'
              when has_function_privilege('authenticated', fn.compra, 'execute') and has_function_privilege('authenticated', fn.ronda, 'execute')
               and not has_function_privilege('anon', fn.compra, 'execute') and not has_function_privilege('anon', fn.ronda, 'execute') then 'OK' else 'ERROR' end,
         'authenticated sí, anon no' from fn
  union all
  select 3, '3 · gemas', 'triggers de gemas en perfil_usuario',
         case when (select count(*) from trg where tgname in ('perfil_usuario_gemas_por_rpc', 'perfil_usuario_saldo_inicial')) = 2 then 'OK'
              when (select count(*) from trg where tgname in ('perfil_usuario_gemas_por_rpc', 'perfil_usuario_saldo_inicial')) = 0 then 'PENDIENTE' else 'ERROR' end,
         'la app ya no escribe gemas directamente'
)
select m as migracion, c as comprobacion, e as estado, d as detalle from filas order by o, m, c;
