-- NUMU · DIAGNÓSTICO DE SOLO LECTURA del proyecto numu (pegar completo en el SQL Editor y ejecutar).
-- Una sola consulta SELECT: no crea, modifica ni borra nada. No muestra correos, nombres ni datos
-- personales: solo estructura (tablas, columnas, funciones, triggers, RLS, permisos) y totales.
-- Resultado: una fila por comprobación → seccion | elemento | estado | detalle.
--   estado: OK · FALTA (bloquea) · REVISAR (diferencia de tipo o permiso) · APLICADA / PENDIENTE
--   (migraciones propuestas) · INFO (totales para comparar antes y después de migrar).
-- Probado en Postgres en memoria con tests/db/diagnostico.check.mjs.

with
-- 1. Tablas que usa la app ---------------------------------------------------------------------
tablas(nombre, requerida) as (values
  ('usuarios', true), ('perfil_usuario', true), ('resultados_examen_diagnostico', true),
  ('cursos', true), ('lecciones', true), ('progreso', true), ('progreso_leccion', true),
  ('user_module_progress', true),
  ('articulo_tienda', false), ('compra_tienda', false), ('movimiento_gemas', false)),
-- 2. Columnas y tipos que la app lee o escribe --------------------------------------------------
columnas(tabla, columna, tipo) as (values
  ('usuarios', 'id', 'integer'), ('usuarios', 'auth_id', 'uuid'),
  ('perfil_usuario', 'usuario_id', 'integer'), ('perfil_usuario', 'nombre', 'text'),
  ('perfil_usuario', 'apodo', 'text'), ('perfil_usuario', 'edad', 'integer'),
  ('perfil_usuario', 'pais', 'text'), ('perfil_usuario', 'grado_escolar', 'text'),
  ('perfil_usuario', 'avatar', 'integer'), ('perfil_usuario', 'gemas', 'integer'),
  ('perfil_usuario', 'xp', 'integer'), ('perfil_usuario', 'intereses', 'ARRAY'),
  ('resultados_examen_diagnostico', 'usuario_id', 'integer'), ('resultados_examen_diagnostico', 'num_aciertos', 'integer'),
  ('resultados_examen_diagnostico', 'puntuacion', 'integer'), ('resultados_examen_diagnostico', 'autoevaluacion', 'text'),
  ('cursos', 'id', 'integer'), ('cursos', 'slug', 'text'),
  ('progreso', 'usuario_id', 'integer'), ('progreso', 'curso_id', 'integer'), ('progreso', 'nivel_actual', 'integer'),
  ('progreso', 'num_estrellas', 'integer'), ('progreso', 'num_intentos', 'integer'), ('progreso', 'racha_dias', 'integer'),
  ('progreso', 'leccion_completada', 'boolean'),
  ('progreso_leccion', 'usuario_id', 'integer'), ('progreso_leccion', 'leccion_id', 'text'),
  ('progreso_leccion', 'estrellas', 'smallint'), ('progreso_leccion', 'intentos', 'integer'),
  ('user_module_progress', 'usuario_id', 'integer'), ('user_module_progress', 'module_id', 'text'),
  ('user_module_progress', 'current_level', 'integer'), ('user_module_progress', 'stars_by_level', 'jsonb')),
info_col as (
  select c.table_name, c.column_name,
         case when c.data_type = 'USER-DEFINED' then c.udt_name else c.data_type end as tipo
  from information_schema.columns c where c.table_schema = 'public'),
-- 3. Restricciones únicas que necesitan los upsert (onConflict) de la app ----------------------
unicas(tabla, columnas) as (values
  ('perfil_usuario', 'usuario_id'), ('progreso', 'curso_id,usuario_id'),
  ('progreso_leccion', 'leccion_id,usuario_id'), ('user_module_progress', 'module_id,usuario_id')),
indices as (
  select t.relname as tabla, string_agg(a.attname, ',' order by a.attname) as columnas
  from pg_index i
  join pg_class t on t.oid = i.indrelid
  join pg_namespace n on n.oid = t.relnamespace and n.nspname = 'public'
  join pg_attribute a on a.attrelid = t.oid and a.attnum = any(i.indkey)
  where i.indisunique
  group by t.relname, i.indexrelid),
-- 4. Funciones (RPC y auxiliares) ----------------------------------------------------------------
funciones(firma, requerida, para) as (values
  ('public.usuario_actual()', true, 'RLS y RPC'),
  ('public.crear_usuario_numu()', true, 'registro (trigger en auth.users)'),
  ('public.set_updated_at()', true, 'updated_at'),
  ('public.registrar_resultado_leccion(text,integer)', false, 'app publicada (antes de migrar)'),
  ('public.registrar_resultado_leccion(text,integer,integer)', false, 'migración última ronda'),
  ('public.perfil_usuario_xp_no_baja()', false, 'migración XP monótona'),
  ('public.comprar_articulo(text,text)', false, 'migración gemas'),
  ('public.registrar_gemas_ronda(integer,text)', false, 'migración gemas')),
-- 5. Triggers -----------------------------------------------------------------------------------
triggers(tabla, nombre, requerido, para) as (values
  ('auth.users', 'al_crear_cuenta_numu', true, 'registro: crea la fila de usuarios'),
  ('public.perfil_usuario', 'perfil_usuario_xp_no_baja', false, 'migración XP monótona'),
  ('public.perfil_usuario', 'perfil_usuario_gemas_por_rpc', false, 'migración gemas'),
  ('public.perfil_usuario', 'perfil_usuario_saldo_inicial', false, 'migración gemas')),
info_trg as (
  select n.nspname || '.' || c.relname as tabla, t.tgname as nombre
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
  where not t.tgisinternal),
-- 6. RLS y políticas por tabla ----------------------------------------------------------------------
rls as (
  select c.relname as tabla, c.relrowsecurity as activa,
         (select string_agg(p.cmd || ':' || array_to_string(p.roles, '/'), ', ' order by p.cmd)
            from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as politicas
  from pg_class c join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where c.relkind = 'r' and c.relname in (select nombre from tablas)),
filas as (
  -- 1. Tablas
  select 1 as orden, 'tablas' as seccion, t.nombre as elemento,
         case when to_regclass('public.' || t.nombre) is not null then 'OK'
              when t.requerida then 'FALTA' else 'PENDIENTE' end as estado,
         case when t.requerida then 'la usa la app' else 'la crea la migración de gemas' end as detalle
  from tablas t
  union all
  -- 2. Columnas y tipos
  select 2, 'columnas', c.tabla || '.' || c.columna,
         case when i.column_name is null then 'FALTA' when i.tipo = c.tipo then 'OK' else 'REVISAR' end,
         'esperado ' || c.tipo || coalesce(', encontrado ' || i.tipo, ', no existe')
  from columnas c left join info_col i on i.table_name = c.tabla and i.column_name = c.columna
  union all
  -- Columnas de la migración «última ronda» en progreso_leccion
  select 2, 'columnas', 'progreso_leccion.' || x.col,
         case when exists (select 1 from info_col i where i.table_name = 'progreso_leccion' and i.column_name = x.col) then 'APLICADA' else 'PENDIENTE' end,
         'migración última ronda'
  from (values ('ultimas_estrellas'), ('ultimo_intento'), ('nivel')) x(col)
  union all
  -- 3. Únicas para upsert
  select 3, 'restricciones', u.tabla || ' (' || u.columnas || ')',
         case when to_regclass('public.' || u.tabla) is null then 'FALTA'
              when exists (select 1 from indices i where i.tabla = u.tabla and i.columnas = u.columnas) then 'OK' else 'FALTA' end,
         'única requerida por el upsert de la app'
  from unicas u
  union all
  -- 4. Funciones
  select 4, 'funciones', f.firma,
         case when to_regprocedure(f.firma) is not null then (case when f.requerida then 'OK' else 'APLICADA' end)
              when f.requerida then 'FALTA' else 'PENDIENTE' end,
         f.para || coalesce(
           (select ' · security ' || case when p.prosecdef then 'definer' else 'invoker' end
                   || ' · authenticated puede ejecutar: ' || case when has_function_privilege('authenticated', p.oid, 'execute') then 'sí' else 'no' end
                   || ' · anon: ' || case when has_function_privilege('anon', p.oid, 'execute') then 'sí' else 'no' end
              from pg_proc p where p.oid = to_regprocedure(f.firma)), '')
  from funciones f
  union all
  -- 5. Triggers
  select 5, 'triggers', tr.tabla || ' · ' || tr.nombre,
         case when exists (select 1 from info_trg i where i.tabla = tr.tabla and i.nombre = tr.nombre) then (case when tr.requerido then 'OK' else 'APLICADA' end)
              when tr.requerido then 'FALTA' else 'PENDIENTE' end,
         tr.para
  from triggers tr
  union all
  -- Otros triggers en perfil_usuario (pueden chocar con las migraciones)
  select 5, 'triggers', 'public.perfil_usuario · ' || i.nombre, 'REVISAR', 'trigger no esperado en perfil_usuario: revisar que no cambie xp ni gemas'
  from info_trg i
  where i.tabla = 'public.perfil_usuario'
    and i.nombre not in ('perfil_usuario_xp_no_baja', 'perfil_usuario_gemas_por_rpc', 'perfil_usuario_saldo_inicial')
  union all
  -- 6. RLS
  select 6, 'rls', r.tabla, case when r.activa and r.politicas is not null then 'OK' else 'REVISAR' end,
         'RLS ' || case when r.activa then 'activa' else 'INACTIVA' end || ' · políticas: ' || coalesce(r.politicas, 'ninguna')
  from rls r
  union all
  -- 7. Permisos de tabla para anon / authenticated (la app nunca usa service_role)
  select 7, 'permisos', t.nombre,
         case when has_table_privilege('anon', 'public.' || t.nombre, 'insert, update, delete') then 'REVISAR' else 'OK' end,
         'authenticated: ' || concat_ws(' ',
           case when has_table_privilege('authenticated', 'public.' || t.nombre, 'select') then 'select' end,
           case when has_table_privilege('authenticated', 'public.' || t.nombre, 'insert') then 'insert' end,
           case when has_table_privilege('authenticated', 'public.' || t.nombre, 'update') then 'update' end,
           case when has_table_privilege('authenticated', 'public.' || t.nombre, 'delete') then 'delete' end)
         || ' · anon escribe: ' || case when has_table_privilege('anon', 'public.' || t.nombre, 'insert, update, delete') then 'SÍ' else 'no' end
  from tablas t where to_regclass('public.' || t.nombre) is not null
  union all
  -- 8. Estado de las tres migraciones propuestas
  select 8, 'migraciones', 'propuesta_xp_monotona.sql',
         case when to_regprocedure('public.perfil_usuario_xp_no_baja()') is not null then 'APLICADA' else 'PENDIENTE' end, 'trigger xp nunca baja'
  union all
  select 8, 'migraciones', 'propuesta_ultima_ronda_transaccional.sql',
         case when to_regprocedure('public.registrar_resultado_leccion(text,integer,integer)') is not null then 'APLICADA' else 'PENDIENTE' end, 'RPC con p_nivel + columnas nivel/última ronda'
  union all
  select 8, 'migraciones', 'propuesta_gemas_transaccional.sql',
         case when to_regprocedure('public.comprar_articulo(text,text)') is not null then 'APLICADA' else 'PENDIENTE' end, 'tienda y recompensas por RPC'
  union all
  select 8, 'migraciones', 'supabase_progreso_modulos.sql',
         case when to_regclass('public.user_module_progress') is not null then 'APLICADA' else 'FALTA' end, 'mapa por sección (aplicar ANTES de las otras si falta)'
  union all
  -- 9. Totales para comparar antes y después (sin datos personales)
  select 9, 'totales', 'perfil_usuario', 'INFO',
         case when to_regclass('public.perfil_usuario') is null then 'no existe' else
           (xpath('/row/n/text()', query_to_xml(
             'select ''perfiles '' || count(*) || '' · suma gemas '' || coalesce(sum(gemas), 0) || '' · suma xp '' || coalesce(sum(xp), 0)'
             || ' || '' · gemas negativas '' || count(*) filter (where gemas < 0)'
             || ' || '' · usuario_id repetidos '' || (count(*) - count(distinct usuario_id)) as n from public.perfil_usuario',
             false, true, '')))[1]::text end
  union all
  select 9, 'totales', 'usuarios', 'INFO',
         case when to_regclass('public.usuarios') is null then 'no existe' else
           (xpath('/row/n/text()', query_to_xml(
             'select ''usuarios '' || count(*) || '' · sin auth_id '' || count(*) filter (where auth_id is null) as n from public.usuarios',
             false, true, '')))[1]::text end
  union all
  select 9, 'totales', x.t, 'INFO',
         case when to_regclass('public.' || x.t) is null then 'no existe'
              else 'filas ' || (xpath('/row/n/text()', query_to_xml('select count(*) as n from public.' || quote_ident(x.t), false, true, '')))[1]::text end
  from (values ('progreso'), ('progreso_leccion'), ('user_module_progress'), ('resultados_examen_diagnostico'), ('movimiento_gemas'), ('compra_tienda')) x(t)
)
select seccion, elemento, estado, detalle
from filas
order by orden, case estado when 'FALTA' then 0 when 'REVISAR' then 1 else 2 end, elemento;
