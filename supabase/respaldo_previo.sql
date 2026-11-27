-- NUMU · RESPALDO PREVIO VERIFICABLE (datos + esquema) antes de las migraciones.
-- ESCRIBE en el proyecto numu (solo crea el esquema respaldo_numu): requiere autorización.
-- No modifica ninguna tabla, función, política ni trigger existente.
--
-- Guarda en respaldo_numu (la API de Supabase no lo expone; anon y authenticated no pueden leerlo):
--   · copia de las 6 tablas con datos de alumnos;
--   · esquema_20261127: definición de funciones (pg_get_functiondef), triggers, políticas RLS,
--     restricciones, columnas, RLS por tabla y permisos de anon/authenticated sobre tablas y funciones;
--   · verificacion_20261127: filas y huella md5 de cada tabla original en el momento del respaldo.
-- Si ya existe el respaldo de esa fecha NO lo sobrescribe. Para otro respaldo: cambiar _20261127.
-- Al final muestra una fila por tabla: filas y md5 originales frente al respaldo (deben coincidir)
-- y cuántas definiciones de esquema se guardaron por tipo.
-- Probado en Postgres en memoria con tests/db/despliegue-completo.check.mjs.

begin;
create schema if not exists respaldo_numu;
revoke all on schema respaldo_numu from public, anon, authenticated;

-- 1. Datos -----------------------------------------------------------------------------------------
create table if not exists respaldo_numu.usuarios_20261127 as table public.usuarios;
create table if not exists respaldo_numu.perfil_usuario_20261127 as table public.perfil_usuario;
create table if not exists respaldo_numu.resultados_examen_diagnostico_20261127 as table public.resultados_examen_diagnostico;
create table if not exists respaldo_numu.progreso_20261127 as table public.progreso;
create table if not exists respaldo_numu.progreso_leccion_20261127 as table public.progreso_leccion;
create table if not exists respaldo_numu.user_module_progress_20261127 as table public.user_module_progress;

-- 2. Huella de los datos originales (filas + md5 de todas las filas ordenadas) ----------------------
create table if not exists respaldo_numu.verificacion_20261127 as
select x.tabla,
       (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', x.tabla), false, true, '')))[1]::text::bigint as filas,
       (xpath('/row/h/text()', query_to_xml(format('select coalesce(md5(string_agg(t::text, %L order by t::text)), %L) as h from public.%I t', '|', 'vacia', x.tabla), false, true, '')))[1]::text as md5
from (values ('usuarios'), ('perfil_usuario'), ('resultados_examen_diagnostico'), ('progreso'), ('progreso_leccion'), ('user_module_progress')) x(tabla);

-- 3. Esquema: todo lo que las migraciones tocan o de lo que dependen --------------------------------
create table if not exists respaldo_numu.esquema_20261127 as
select 'funcion' as tipo, p.oid::regprocedure::text as nombre, pg_get_functiondef(p.oid) as definicion
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'
union all
select 'trigger', n.nspname || '.' || c.relname || ' · ' || t.tgname, pg_get_triggerdef(t.oid)
from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal and n.nspname in ('public', 'auth')
union all
select 'politica', p.tablename || ' · ' || p.policyname,
       format('create policy %I on public.%I as %s for %s to %s%s%s;', p.policyname, p.tablename, p.permissive, p.cmd,
              array_to_string(p.roles, ', '), coalesce(' using (' || p.qual || ')', ''), coalesce(' with check (' || p.with_check || ')', ''))
from pg_policies p where p.schemaname = 'public'
union all
select 'restriccion', c.conrelid::regclass::text || ' · ' || c.conname, pg_get_constraintdef(c.oid)
from pg_constraint c join pg_namespace n on n.oid = c.connamespace where n.nspname = 'public'
union all
select 'columna', c.table_name || '.' || c.column_name,
       c.data_type || coalesce('(' || c.character_maximum_length || ')', '') || ' · nulos ' || c.is_nullable || coalesce(' · default ' || c.column_default, '')
from information_schema.columns c where c.table_schema = 'public'
union all
select 'rls', c.relname, case when c.relrowsecurity then 'activa' else 'inactiva' end
from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'
union all
select 'permiso_tabla', g.table_name || ' · ' || g.grantee, string_agg(g.privilege_type, ', ' order by g.privilege_type)
from information_schema.role_table_grants g
where g.table_schema = 'public' and g.grantee in ('anon', 'authenticated')
group by g.table_name, g.grantee
union all
select 'permiso_funcion', p.oid::regprocedure::text || ' · ' || r.rolname, 'execute'
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
cross join (select rolname from pg_roles where rolname in ('anon', 'authenticated')) r
where n.nspname = 'public' and p.prokind = 'f' and has_function_privilege(r.rolname, p.oid, 'execute');

revoke all on all tables in schema respaldo_numu from public, anon, authenticated;
commit;

-- 4. Comprobación del respaldo (solo lectura) ---------------------------------------------------------
select 'datos' as parte, v.tabla as elemento,
       v.filas || ' filas · md5 ' || left(v.md5, 8) as original,
       r.filas || ' filas · md5 ' || left(r.md5, 8) as respaldo,
       case when v.filas = r.filas and v.md5 = r.md5 then 'OK' else 'NO COINCIDE' end as estado
from respaldo_numu.verificacion_20261127 v
cross join lateral (
  select (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from respaldo_numu.%I', v.tabla || '_20261127'), false, true, '')))[1]::text::bigint as filas,
         (xpath('/row/h/text()', query_to_xml(format('select coalesce(md5(string_agg(t::text, %L order by t::text)), %L) as h from respaldo_numu.%I t', '|', 'vacia', v.tabla || '_20261127'), false, true, '')))[1]::text as md5
) r
union all
select 'esquema', e.tipo, count(*)::text || ' definiciones', '', case when count(*) > 0 then 'OK' else 'VACÍO' end
from respaldo_numu.esquema_20261127 e group by e.tipo
order by 1, 2;

-- Recuperación (solo con autorización y si reversion_propuestas.sql no basta):
--   · Datos, por ejemplo perfil_usuario:
--       update public.perfil_usuario p set gemas = r.gemas, xp = r.xp
--       from respaldo_numu.perfil_usuario_20261127 r where r.usuario_id = p.usuario_id;
--   · Una función, trigger o política: copiar su `definicion` de respaldo_numu.esquema_20261127 y
--     ejecutarla (las funciones traen «create or replace»; triggers y políticas, su create completo).
