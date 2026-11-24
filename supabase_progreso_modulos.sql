-- NUMU · Progreso del mapa por sección (conteo / aritmetica / geometria / patrones)
-- Ejecutar en el SQL Editor del proyecto "numu". Idempotente: se puede volver a ejecutar.
-- Una fila por usuario y módulo; NO agrupa módulos en cursos.
-- Requiere public.usuario_actual() (ya definido en supabase/propuesta_numu_auth.sql y
-- supabase/progreso_leccion.sql), que devuelve el id entero de public.usuarios de la sesión.

-- ---------------------------------------------------------------
-- Utilidad para updated_at (misma definición que usan las tablas del proyecto)
-- ---------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------
-- Tabla: una parada actual y estrellas por parada para cada sección
-- ---------------------------------------------------------------
create table if not exists public.user_module_progress (
  usuario_id      integer not null references public.usuarios (id) on delete cascade,
  module_id       text not null check (module_id in ('conteo', 'aritmetica', 'geometria', 'patrones')),
  current_level   integer not null default 1 check (current_level >= 1),
  stars_by_level  jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (usuario_id, module_id)
);

-- Columnas añadidas de forma segura si la tabla ya existiera parcialmente.
alter table public.user_module_progress add column if not exists current_level  integer not null default 1 check (current_level >= 1);
alter table public.user_module_progress add column if not exists stars_by_level jsonb not null default '{}'::jsonb;
alter table public.user_module_progress add column if not exists created_at     timestamptz not null default now();
alter table public.user_module_progress add column if not exists updated_at     timestamptz not null default now();

-- Índice explícito por si la tabla se creó sin llave primaria.
create unique index if not exists user_module_progress_usuario_modulo_idx
  on public.user_module_progress (usuario_id, module_id);

drop trigger if exists user_module_progress_set_updated_at on public.user_module_progress;
create trigger user_module_progress_set_updated_at
  before update on public.user_module_progress
  for each row execute function public.set_updated_at();

comment on column public.user_module_progress.current_level is 'Parada actual de esa sección en /inicio (empieza en 1).';
comment on column public.user_module_progress.stars_by_level is 'Mejores estrellas por parada: {"1": 3, "2": 2, ...} (0 a 3).';

-- ---------------------------------------------------------------
-- RLS: cada estudiante solo lee y escribe SU progreso por sección
-- ---------------------------------------------------------------
alter table public.user_module_progress enable row level security;

drop policy if exists "progreso modulos: leer el propio" on public.user_module_progress;
create policy "progreso modulos: leer el propio"
  on public.user_module_progress for select to authenticated
  using (usuario_id = (select public.usuario_actual()));

drop policy if exists "progreso modulos: crear el propio" on public.user_module_progress;
create policy "progreso modulos: crear el propio"
  on public.user_module_progress for insert to authenticated
  with check (usuario_id = (select public.usuario_actual()));

drop policy if exists "progreso modulos: actualizar el propio" on public.user_module_progress;
create policy "progreso modulos: actualizar el propio"
  on public.user_module_progress for update to authenticated
  using (usuario_id = (select public.usuario_actual()))
  with check (usuario_id = (select public.usuario_actual()));

-- ---------------------------------------------------------------
-- Permisos mínimos (nada para anónimos; sin DELETE desde el cliente)
-- ---------------------------------------------------------------
revoke all on public.user_module_progress from anon;
grant usage on schema public to authenticated;
grant select, insert, update on public.user_module_progress to authenticated;
