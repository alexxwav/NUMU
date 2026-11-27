-- NUMU · RESPALDO PREVIO a las migraciones (ESCRIBE: requiere autorización para el proyecto numu).
-- Copia las 6 tablas con datos de alumnos a un esquema aparte, respaldo_numu, que la API de Supabase
-- NO expone (ni anon ni authenticated pueden leerlo). No modifica las tablas originales.
-- Si ya existe un respaldo, NO lo sobrescribe (create table if not exists): para un respaldo nuevo,
-- cambiar el sufijo _20261127 por la fecha del día.
-- Al final muestra una fila por tabla: filas originales y filas respaldadas (deben coincidir).
-- Probado en Postgres en memoria con tests/db/despliegue-completo.check.mjs.

begin;
create schema if not exists respaldo_numu;
revoke all on schema respaldo_numu from public, anon, authenticated;

create table if not exists respaldo_numu.usuarios_20261127 as table public.usuarios;
create table if not exists respaldo_numu.perfil_usuario_20261127 as table public.perfil_usuario;
create table if not exists respaldo_numu.resultados_examen_diagnostico_20261127 as table public.resultados_examen_diagnostico;
create table if not exists respaldo_numu.progreso_20261127 as table public.progreso;
create table if not exists respaldo_numu.progreso_leccion_20261127 as table public.progreso_leccion;
create table if not exists respaldo_numu.user_module_progress_20261127 as table public.user_module_progress;
commit;

select 'usuarios' as tabla, (select count(*) from public.usuarios) as originales, (select count(*) from respaldo_numu.usuarios_20261127) as respaldadas
union all select 'perfil_usuario', (select count(*) from public.perfil_usuario), (select count(*) from respaldo_numu.perfil_usuario_20261127)
union all select 'resultados_examen_diagnostico', (select count(*) from public.resultados_examen_diagnostico), (select count(*) from respaldo_numu.resultados_examen_diagnostico_20261127)
union all select 'progreso', (select count(*) from public.progreso), (select count(*) from respaldo_numu.progreso_20261127)
union all select 'progreso_leccion', (select count(*) from public.progreso_leccion), (select count(*) from respaldo_numu.progreso_leccion_20261127)
union all select 'user_module_progress', (select count(*) from public.user_module_progress), (select count(*) from respaldo_numu.user_module_progress_20261127);

-- Recuperación (solo si la reversión no basta y con autorización; ejemplo para una tabla):
--   begin;
--   update public.perfil_usuario p set gemas = r.gemas, xp = r.xp
--   from respaldo_numu.perfil_usuario_20261127 r where r.usuario_id = p.usuario_id;
--   commit;
