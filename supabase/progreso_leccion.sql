-- NUMU · Progreso por lección (0 a 3 estrellas) — proyecto "numu"
-- Ejecutar en el SQL Editor del proyecto numu (khjjyxqquruexuwrsbfb).
-- Es idempotente: se puede volver a ejecutar sin romper nada.
--
-- Contexto del proyecto (esquema del equipo):
--   usuarios(id integer, correo, fecha_registro, auth_id uuid -> auth.users)
--   progreso(usuario_id, curso_id, ...): una fila por usuario y CURSO.
-- Esta tabla añade una fila por usuario y LECCIÓN, que es lo que pide la pantalla
-- de inicio: 3 estrellas por lección, conservando la mejor puntuación.
--
-- leccion_id es el id del catálogo editorial de la app
-- (src/data/lessonContent.json: conteo-basico, sumas-basicas, figuras, patrones),
-- el mismo que aparece en la URL /lecciones/<id>. No lleva llave foránea a
-- public.lecciones porque ahí el id es un serial numérico del MVP y no coincide
-- con los ids del catálogo; el CHECK de formato mantiene la integridad.

-- ---------------------------------------------------------------
-- Utilidad: mantener updated_at
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
-- Id del usuario con sesión (misma definición que usa el resto de políticas)
-- ---------------------------------------------------------------
create or replace function public.usuario_actual()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.usuarios where auth_id = auth.uid()
$$;

-- ---------------------------------------------------------------
-- Progreso por lección: una fila por usuario y lección
-- ---------------------------------------------------------------
create table if not exists public.progreso_leccion (
  usuario_id integer not null references public.usuarios (id) on delete cascade,
  leccion_id text not null check (leccion_id ~ '^[a-z0-9-]+$'),
  estrellas smallint not null default 0 check (estrellas between 0 and 3),
  intentos integer not null default 0 check (intentos >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (usuario_id, leccion_id)
);

create index if not exists progreso_leccion_leccion_id_idx on public.progreso_leccion (leccion_id);

drop trigger if exists progreso_leccion_set_updated_at on public.progreso_leccion;
create trigger progreso_leccion_set_updated_at
  before update on public.progreso_leccion
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- RLS: cada estudiante solo ve y cambia su propio progreso
-- ---------------------------------------------------------------
alter table public.progreso_leccion enable row level security;

drop policy if exists "progreso_leccion: leer el propio" on public.progreso_leccion;
create policy "progreso_leccion: leer el propio"
  on public.progreso_leccion for select to authenticated
  using (usuario_id = (select public.usuario_actual()));

drop policy if exists "progreso_leccion: crear el propio" on public.progreso_leccion;
create policy "progreso_leccion: crear el propio"
  on public.progreso_leccion for insert to authenticated
  with check (usuario_id = (select public.usuario_actual()));

drop policy if exists "progreso_leccion: actualizar el propio" on public.progreso_leccion;
create policy "progreso_leccion: actualizar el propio"
  on public.progreso_leccion for update to authenticated
  using (usuario_id = (select public.usuario_actual()))
  with check (usuario_id = (select public.usuario_actual()));

-- ---------------------------------------------------------------
-- Permisos mínimos (sin acceso para visitantes sin sesión)
-- ---------------------------------------------------------------
revoke all on public.progreso_leccion from anon;
grant usage on schema public to authenticated;
grant select, insert, update on public.progreso_leccion to authenticated;

-- ---------------------------------------------------------------
-- RPC atómico: al repetir una lección conserva la mejor puntuación (greatest)
-- ---------------------------------------------------------------
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
