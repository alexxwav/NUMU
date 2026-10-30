-- NUMU · PROPUESTA para el proyecto de Supabase "numu" (esquema del equipo)
-- Objetivo: que las cuentas usen Supabase Auth (contraseñas con hash) y que cada
-- estudiante guarde y recupere su cuestionario y su progreso de forma segura.
-- Solo AGREGA columnas, restricciones, una función, un trigger, reglas RLS y el catálogo.
-- No borra ni renombra tablas o columnas existentes.
-- Revisar con quien administra la base ANTES de ejecutarlo en el SQL Editor.

-- 1. Ligar cada fila de usuarios con su cuenta de Supabase Auth -------------------
alter table public.usuarios
  add column if not exists auth_id uuid unique references auth.users (id) on delete cascade;

-- La contraseña la guarda Supabase Auth con hash; esta columna deja de usarse.
alter table public.usuarios alter column contrasena drop not null;
comment on column public.usuarios.contrasena is 'Sin uso: Supabase Auth guarda la contraseña con hash.';

-- 2. Datos del cuestionario inicial que faltan ------------------------------------
alter table public.perfil_usuario
  add column if not exists intereses text[] not null default '{}';

-- Un solo perfil y un solo progreso por curso para cada usuario.
alter table public.perfil_usuario
  add constraint perfil_usuario_un_perfil unique (usuario_id);
alter table public.progreso
  add constraint progreso_usuario_curso unique (usuario_id, curso_id);

-- 3. Alta automática: al crear la cuenta se crea su fila en usuarios ---------------
create or replace function public.crear_usuario_numu()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.usuarios (auth_id, correo, fecha_registro)
  values (new.id, new.email, current_date);
  return new;
end;
$$;

drop trigger if exists al_crear_cuenta_numu on auth.users;
create trigger al_crear_cuenta_numu
  after insert on auth.users
  for each row execute function public.crear_usuario_numu();

-- id (entero) de la tabla usuarios que corresponde a la sesión actual.
create or replace function public.usuario_actual()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.usuarios where auth_id = auth.uid()
$$;

-- 4. Seguridad por fila (RLS): cada estudiante solo ve y cambia lo suyo -------------
alter table public.usuarios                      enable row level security;
alter table public.perfil_usuario                enable row level security;
alter table public.resultados_examen_diagnostico enable row level security;
alter table public.progreso                      enable row level security;
alter table public.cursos                        enable row level security;
alter table public.lecciones                     enable row level security;

create policy "usuarios: el propio" on public.usuarios
  for select to authenticated using (auth_id = (select auth.uid()));

create policy "perfil: leer el propio" on public.perfil_usuario
  for select to authenticated using (usuario_id = (select public.usuario_actual()));
create policy "perfil: crear el propio" on public.perfil_usuario
  for insert to authenticated with check (usuario_id = (select public.usuario_actual()));
create policy "perfil: actualizar el propio" on public.perfil_usuario
  for update to authenticated using (usuario_id = (select public.usuario_actual()))
  with check (usuario_id = (select public.usuario_actual()));

create policy "diagnostico: leer los propios" on public.resultados_examen_diagnostico
  for select to authenticated using (usuario_id = (select public.usuario_actual()));
create policy "diagnostico: crear los propios" on public.resultados_examen_diagnostico
  for insert to authenticated with check (usuario_id = (select public.usuario_actual()));

create policy "progreso: leer el propio" on public.progreso
  for select to authenticated using (usuario_id = (select public.usuario_actual()));
create policy "progreso: crear el propio" on public.progreso
  for insert to authenticated with check (usuario_id = (select public.usuario_actual()));
create policy "progreso: actualizar el propio" on public.progreso
  for update to authenticated using (usuario_id = (select public.usuario_actual()))
  with check (usuario_id = (select public.usuario_actual()));

create policy "cursos: lectura" on public.cursos for select to authenticated using (true);
create policy "lecciones: lectura" on public.lecciones for select to authenticated using (true);

-- 5. Permisos mínimos (sin acceso para visitantes sin sesión) ------------------------
revoke all on public.usuarios, public.perfil_usuario, public.resultados_examen_diagnostico,
              public.progreso, public.cursos, public.lecciones from anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.usuarios, public.cursos, public.lecciones to authenticated;
grant select, insert, update on public.perfil_usuario, public.progreso to authenticated;
grant select, insert on public.resultados_examen_diagnostico to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke execute on function public.crear_usuario_numu() from public, anon, authenticated;
grant execute on function public.usuario_actual() to authenticated;

-- 6. Catálogo del MVP: 2 cursos y 4 lecciones (solo si aún no existen) --------------
insert into public.cursos (nombre_curso, slug)
select v.nombre, v.slug
from (values ('Aritmética', 'aritmetica'), ('Geometría y patrones', 'geometria-patrones')) as v(nombre, slug)
where not exists (select 1 from public.cursos c where c.slug = v.slug);

insert into public.lecciones (curso_id, titulo_leccion, nivel, preguntas)
select c.id, v.titulo, 1, '[]'::json
from (values
  ('aritmetica', 'Conteo básico'),
  ('aritmetica', 'Sumas básicas'),
  ('geometria-patrones', 'Figuras geométricas'),
  ('geometria-patrones', 'Patrones de colores')
) as v(slug, titulo)
join public.cursos c on c.slug = v.slug
where not exists (select 1 from public.lecciones l where l.curso_id = c.id and l.titulo_leccion = v.titulo);
