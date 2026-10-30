-- NUMU · Privilegios explícitos para la Data API
-- Supabase está retirando los GRANT automáticos sobre tablas nuevas de public.
-- Sin estos GRANT, PostgREST responde 42501 aunque las políticas RLS sean correctas;
-- con ellos, el proyecto funciona igual con o sin los permisos por defecto.
-- RLS sigue decidiendo QUÉ filas ve cada estudiante; aquí solo se decide QUÉ operaciones existen.

grant usage on schema public to authenticated;

-- Partir de cero para no heredar DELETE/TRUNCATE de los permisos por defecto.
revoke all on table public.profiles, public.courses, public.lessons,
                    public.diagnostic_results, public.progress from authenticated;

-- Catálogo: solo lectura.
grant select on table public.courses, public.lessons to authenticated;

-- Perfil: leer, crear el propio (respaldo del trigger) y editar solo los campos del onboarding.
grant select, insert on table public.profiles to authenticated;
grant update (nickname, name, age, country, grade, avatar, interests, onboarding_completed)
  on table public.profiles to authenticated;

-- Diagnóstico: leer y crear; no se edita ni se borra.
grant select, insert on table public.diagnostic_results to authenticated;

-- Progreso: lo usa record_lesson_result (security invoker), que inserta o actualiza.
grant select, insert, update on table public.progress to authenticated;
