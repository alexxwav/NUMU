-- NUMU · Esquema base del MVP
-- Tablas: profiles, courses, lessons, diagnostic_results, progress.
-- Pensado para un proyecto de Supabase NUEVO y exclusivo de NUMU.

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
-- Perfiles: 1 a 1 con auth.users (Supabase Auth guarda la contraseña con hash)
-- Los campos reflejan el onboarding de LoginView.jsx y el perfil de store.js.
-- ---------------------------------------------------------------
create table public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  nickname              text check (nickname is null or char_length(nickname) between 2 and 30),
  name                  text check (name is null or char_length(name) <= 80),
  age                   smallint check (age is null or age between 4 and 15),
  country               text check (country is null or char_length(country) <= 60),
  grade                 text check (grade is null or char_length(grade) <= 40),
  avatar                smallint not null default 0 check (avatar >= 0),
  interests             text[] not null default '{}',
  onboarding_completed  boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- Catálogo: cursos y lecciones (solo lectura para estudiantes)
-- module_id enlaza cada lección con un generador de src/state/questions.js.
-- ---------------------------------------------------------------
create table public.courses (
  id          text primary key check (id ~ '^[a-z0-9-]+$'),
  title       text not null check (char_length(title) between 1 and 80),
  description text,
  position    smallint not null unique check (position >= 1),
  created_at  timestamptz not null default now()
);

create table public.lessons (
  id          text primary key check (id ~ '^[a-z0-9-]+$'),
  course_id   text not null references public.courses (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 80),
  description text,
  position    smallint not null check (position >= 1),
  module_id   text not null check (module_id in ('conteo', 'aritmetica', 'geometria', 'patrones')),
  base_level  smallint not null default 1 check (base_level >= 1),
  created_at  timestamptz not null default now(),
  unique (course_id, position)
);

create index lessons_course_id_idx on public.lessons (course_id);

-- ---------------------------------------------------------------
-- Resultados del diagnóstico (un registro por intento)
-- self_level corresponde a LEVEL_OPTIONS de LoginView.jsx.
-- ---------------------------------------------------------------
create table public.diagnostic_results (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  score       smallint not null check (score >= 0),
  total       smallint not null check (total > 0),
  self_level  text check (self_level in ('none', 'some', 'much')),
  answers     jsonb not null default '[]'::jsonb check (jsonb_typeof(answers) = 'array'),
  created_at  timestamptz not null default now(),
  check (score <= total)
);

create index diagnostic_results_user_idx on public.diagnostic_results (user_id, created_at desc);

-- ---------------------------------------------------------------
-- Progreso por estudiante y lección
-- current_level lo decide la regla adaptativa (pendiente de Dante).
-- ---------------------------------------------------------------
create table public.progress (
  user_id         uuid not null references public.profiles (id) on delete cascade,
  lesson_id       text not null references public.lessons (id) on delete cascade,
  current_level   smallint not null default 1 check (current_level >= 1),
  best_stars      smallint not null default 0 check (best_stars between 0 and 3),
  attempts        integer not null default 0 check (attempts >= 0),
  completed       boolean not null default false,
  last_played_at  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create index progress_lesson_id_idx on public.progress (lesson_id);

create trigger progress_set_updated_at
  before update on public.progress
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- Alta automática del perfil al registrarse en Supabase Auth.
-- Toma el apodo de raw_user_meta_data.nickname si se envió en signUp.
-- ---------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nickname text := nullif(trim(new.raw_user_meta_data ->> 'nickname'), '');
begin
  if v_nickname is not null and char_length(v_nickname) not between 2 and 30 then
    v_nickname := null;
  end if;
  insert into public.profiles (id, nickname) values (new.id, v_nickname);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------
-- Registro atómico de una ronda terminada.
-- security invoker: se ejecuta con los permisos del estudiante y respeta RLS.
-- ---------------------------------------------------------------
create or replace function public.record_lesson_result(
  p_lesson_id  text,
  p_stars      integer,
  p_next_level integer,
  p_completed  boolean default false
)
returns public.progress
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_row  public.progress;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  insert into public.progress as p
    (user_id, lesson_id, current_level, best_stars, attempts, completed, last_played_at)
  values
    (v_user, p_lesson_id, p_next_level, p_stars, 1, p_completed, now())
  on conflict (user_id, lesson_id) do update
    set current_level  = excluded.current_level,
        best_stars     = greatest(p.best_stars, excluded.best_stars),
        attempts       = p.attempts + 1,
        completed      = p.completed or excluded.completed,
        last_played_at = now()
  returning * into v_row;

  return v_row;
end;
$$;
