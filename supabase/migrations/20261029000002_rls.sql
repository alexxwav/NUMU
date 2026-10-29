-- NUMU · Row Level Security
-- Cada estudiante solo ve y modifica su propia información.
-- El catálogo (cursos y lecciones) es de solo lectura para usuarios autenticados.
-- No existe ninguna política de DELETE: el borrado ocurre solo en cascada desde auth.users.

alter table public.profiles           enable row level security;
alter table public.courses            enable row level security;
alter table public.lessons            enable row level security;
alter table public.diagnostic_results enable row level security;
alter table public.progress           enable row level security;

-- ---------- profiles ----------
-- El insert lo hace el trigger handle_new_user (security definer);
-- esta política solo cubre el caso de un perfil que falte.
create policy "profiles: leer el propio"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: crear el propio"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

create policy "profiles: actualizar el propio"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------- catálogo ----------
create policy "courses: lectura autenticada"
  on public.courses for select to authenticated
  using (true);

create policy "lessons: lectura autenticada"
  on public.lessons for select to authenticated
  using (true);

-- ---------- diagnostic_results ----------
-- Solo lectura e inserción: un resultado no se edita después de guardarse.
create policy "diagnostic: leer los propios"
  on public.diagnostic_results for select to authenticated
  using (user_id = (select auth.uid()));

create policy "diagnostic: crear los propios"
  on public.diagnostic_results for insert to authenticated
  with check (user_id = (select auth.uid()));

-- ---------- progress ----------
create policy "progress: leer el propio"
  on public.progress for select to authenticated
  using (user_id = (select auth.uid()));

create policy "progress: crear el propio"
  on public.progress for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "progress: actualizar el propio"
  on public.progress for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------- privilegios ----------
-- El rol anónimo no necesita tocar ninguna tabla de NUMU.
revoke all on public.profiles, public.courses, public.lessons,
              public.diagnostic_results, public.progress from anon;

-- Las funciones internas no deben invocarse por RPC.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- record_lesson_result solo para estudiantes autenticados.
revoke execute on function public.record_lesson_result(text, integer, integer, boolean) from public, anon;
grant  execute on function public.record_lesson_result(text, integer, integer, boolean) to authenticated;
