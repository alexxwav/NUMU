-- NUMU · PROPUESTA (NO APLICADA): gemas y compras transaccionales en el servidor.
-- Proyecto: numu. Probada en Postgres en memoria con tests/db/gemas-transaccional.check.mjs.
-- Aplicar solo con autorización, DESPUÉS de publicar la app que usa los RPC (ver «Compatibilidad»).
--
-- Problema (reproducido en tests/gemas.test.js):
--   · Comprar solo cambiaba el dispositivo (store.purchase); ni la compra ni el artículo llegaban a la cuenta.
--   · recordRound escribía el saldo ABSOLUTO del dispositivo en perfil_usuario.gemas (gana el último).
--   · loadProfile tomaba max(gemas locales, gemas de la cuenta): devolvía gemas ya gastadas.
--   · Nada impedía gastar las mismas gemas dos veces desde dos dispositivos.
--
-- Solución:
--   1. perfil_usuario.gemas sigue siendo el saldo (no se pierde ninguna gema histórica) y solo lo
--      cambian dos RPC transaccionales. Cada cambio queda en movimiento_gemas.
--   2. comprar_articulo: bloquea la fila del perfil (FOR UPDATE), cobra el precio del SERVIDOR una sola
--      vez (clave idempotente + un artículo por usuario) y registra el artículo en compra_tienda.
--   3. registrar_gemas_ronda: suma la recompensa de una ronda una sola vez (clave idempotente).
--      Valida el rango de la regla vigente (0 a 15 = 3 estrellas × 5); no crea recompensas nuevas.
--   4. Un trigger ignora los cambios de gemas que haga la app directamente (roles anon/authenticated),
--      p. ej. el upsert absoluto de una app vieja. Los RPC corren como su dueño (security definer).
--
-- Precios: los 6 marcos y precios actuales de src/components/Avatar.js (FRAMES). No se inventan
-- artículos ni precios; si cambian en la app, hay que actualizarlos aquí (mismo id y precio).
--
-- Compatibilidad: la app nueva usa los RPC y, si aún no existen (PGRST202), guarda como antes pero
-- sin devolver gemas gastadas (compra guardada al momento y saldo de la cuenta + pendientes al
-- iniciar sesión). Una app vieja que siga escribiendo gemas absolutas tras la migración no cambia el
-- saldo (el trigger lo conserva); sus recompensas no se suben hasta actualizarla.
-- Idempotente: se puede ejecutar más de una vez. Todo en una transacción. No borra filas.

begin;

-- 1. Catálogo de la tienda (precios del servidor) ---------------------------------------------
create table if not exists public.articulo_tienda (
  id     text primary key check (id ~ '^[a-z0-9-]+$'),
  precio integer not null check (precio > 0)
);
insert into public.articulo_tienda (id, precio) values
  ('frame-gold', 60), ('frame-mint', 40), ('frame-cyan', 40),
  ('frame-coral', 30), ('frame-orange', 30), ('frame-indigo', 50)
on conflict (id) do nothing;

-- 2. Artículos comprados (uno por usuario y artículo) -------------------------------------------
create table if not exists public.compra_tienda (
  usuario_id  integer not null references public.usuarios (id) on delete cascade,
  articulo_id text    not null references public.articulo_tienda (id),
  precio      integer not null check (precio > 0),
  created_at  timestamptz not null default now(),
  primary key (usuario_id, articulo_id)
);

-- 3. Libro de movimientos (auditoría e idempotencia) ---------------------------------------------
create table if not exists public.movimiento_gemas (
  id          bigserial primary key,
  usuario_id  integer not null references public.usuarios (id) on delete cascade,
  tipo        text    not null check (tipo in ('saldo_inicial', 'recompensa', 'compra')),
  cantidad    integer not null,
  articulo_id text references public.articulo_tienda (id),
  clave       text    not null check (char_length(clave) between 1 and 100),
  saldo       integer not null check (saldo >= 0),
  created_at  timestamptz not null default now(),
  unique (usuario_id, clave)
);

-- Saldo inicial: una fila por perfil existente con sus gemas actuales (no cambia ningún saldo).
insert into public.movimiento_gemas (usuario_id, tipo, cantidad, clave, saldo)
select usuario_id, 'saldo_inicial', coalesce(gemas, 0), 'saldo-inicial', greatest(coalesce(gemas, 0), 0)
from public.perfil_usuario
on conflict (usuario_id, clave) do nothing;

-- 4. Solo los RPC cambian las gemas de un perfil existente ----------------------------------------
create or replace function public.perfil_usuario_gemas_por_rpc()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- La app (roles anon/authenticated) no cambia el saldo; los RPC (security definer) sí.
  -- Un perfil creado por la app empieza en 0 gemas (las gemas solo llegan por registrar_gemas_ronda).
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.gemas := 0;
    else
      new.gemas := old.gemas;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists perfil_usuario_gemas_por_rpc on public.perfil_usuario;
create trigger perfil_usuario_gemas_por_rpc
  before insert or update on public.perfil_usuario
  for each row execute function public.perfil_usuario_gemas_por_rpc();

-- El saldo nunca es negativo (NOT VALID: no revisa filas antiguas, solo las escrituras nuevas).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'perfil_usuario_gemas_no_negativas') then
    alter table public.perfil_usuario add constraint perfil_usuario_gemas_no_negativas check (gemas >= 0) not valid;
  end if;
end;
$$;

-- Perfiles nuevos: su saldo inicial también queda en el libro (auditoría completa).
create or replace function public.perfil_usuario_saldo_inicial()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.movimiento_gemas (usuario_id, tipo, cantidad, clave, saldo)
  values (new.usuario_id, 'saldo_inicial', coalesce(new.gemas, 0), 'saldo-inicial', greatest(coalesce(new.gemas, 0), 0))
  on conflict (usuario_id, clave) do nothing;
  return new;
end;
$$;

drop trigger if exists perfil_usuario_saldo_inicial on public.perfil_usuario;
create trigger perfil_usuario_saldo_inicial
  after insert on public.perfil_usuario
  for each row execute function public.perfil_usuario_saldo_inicial();

-- 5. Comprar un artículo (una sola vez, con el precio del servidor) ------------------------------
create or replace function public.comprar_articulo(p_articulo_id text, p_clave text)
returns table (gemas integer, comprado boolean, motivo text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario integer := public.usuario_actual();
  v_precio  integer;
  v_saldo   integer;
begin
  if v_usuario is null then raise exception 'Sin sesión' using errcode = '42501'; end if;
  if p_clave is null or p_clave !~ '^compra-[A-Za-z0-9-]{8,80}$' then raise exception 'Clave inválida' using errcode = '22023'; end if;
  select a.precio into v_precio from public.articulo_tienda a where a.id = p_articulo_id;
  if v_precio is null then raise exception 'Artículo inexistente: %', p_articulo_id using errcode = '22023'; end if;

  -- Bloquea el perfil: compras simultáneas del mismo usuario se atienden una por una.
  select p.gemas into v_saldo from public.perfil_usuario p where p.usuario_id = v_usuario for update;
  if v_saldo is null then raise exception 'Perfil inexistente' using errcode = '22023'; end if;

  -- Reintento de la misma compra o artículo ya comprado: no se cobra otra vez.
  if exists (select 1 from public.movimiento_gemas m where m.usuario_id = v_usuario and m.clave = p_clave)
     or exists (select 1 from public.compra_tienda c where c.usuario_id = v_usuario and c.articulo_id = p_articulo_id) then
    return query select v_saldo, false, 'ya-comprado'::text; return;
  end if;
  if v_saldo < v_precio then
    return query select v_saldo, false, 'gemas-insuficientes'::text; return;
  end if;

  -- Doble protección contra saldo negativo: el UPDATE solo ocurre si aún alcanza.
  update public.perfil_usuario p set gemas = p.gemas - v_precio
  where p.usuario_id = v_usuario and p.gemas >= v_precio returning p.gemas into v_saldo;
  if not found then
    return query select (select p.gemas from public.perfil_usuario p where p.usuario_id = v_usuario), false, 'gemas-insuficientes'::text; return;
  end if;
  insert into public.compra_tienda (usuario_id, articulo_id, precio) values (v_usuario, p_articulo_id, v_precio);
  insert into public.movimiento_gemas (usuario_id, tipo, cantidad, articulo_id, clave, saldo)
  values (v_usuario, 'compra', -v_precio, p_articulo_id, p_clave, v_saldo);
  return query select v_saldo, true, 'comprado'::text;
end;
$$;

-- 6. Sumar las gemas de una ronda (una sola vez por clave) ---------------------------------------
-- Límite anti-abuso (no es una regla de economía): como máximo 60 recompensas por hora y usuario
-- (una ronda por minuto en promedio). Las que lo superen quedan pendientes en el dispositivo y se
-- reintentan después. LIMITACIÓN CONOCIDA: el servidor aún no puede comprobar que la ronda existió
-- (haría falta un ticket de ronda emitido por el servidor); ver docs §8.
drop function if exists public.registrar_gemas_ronda(integer, text);
create or replace function public.registrar_gemas_ronda(p_cantidad integer, p_clave text)
returns table (gemas integer, aplicada boolean, motivo text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario integer := public.usuario_actual();
  v_saldo   integer;
begin
  if v_usuario is null then raise exception 'Sin sesión' using errcode = '42501'; end if;
  if p_clave is null or p_clave !~ '^ronda-[A-Za-z0-9-]{8,80}$' then raise exception 'Clave inválida' using errcode = '22023'; end if;
  -- Regla vigente (Game.jsx): 5 gemas por estrella, de 0 a 3 estrellas → 0, 5, 10 o 15 por ronda.
  if p_cantidad is null or p_cantidad not in (0, 5, 10, 15) then
    raise exception 'Recompensa fuera de la regla vigente: %', p_cantidad using errcode = '22023';
  end if;
  select p.gemas into v_saldo from public.perfil_usuario p where p.usuario_id = v_usuario for update;
  if v_saldo is null then raise exception 'Perfil inexistente' using errcode = '22023'; end if;
  if exists (select 1 from public.movimiento_gemas m where m.usuario_id = v_usuario and m.clave = p_clave) then
    return query select v_saldo, false, 'repetida'::text; return;
  end if;
  if (select count(*) from public.movimiento_gemas m
      where m.usuario_id = v_usuario and m.tipo = 'recompensa' and m.created_at > now() - interval '1 hour') >= 60 then
    return query select v_saldo, false, 'limite'::text; return;
  end if;
  update public.perfil_usuario p set gemas = p.gemas + p_cantidad where p.usuario_id = v_usuario returning p.gemas into v_saldo;
  insert into public.movimiento_gemas (usuario_id, tipo, cantidad, clave, saldo)
  values (v_usuario, 'recompensa', p_cantidad, p_clave, v_saldo);
  return query select v_saldo, true, 'aplicada'::text;
end;
$$;

-- 7. Seguridad: cada estudiante lee lo suyo; solo los RPC escriben -------------------------------
alter table public.articulo_tienda enable row level security;
alter table public.compra_tienda enable row level security;
alter table public.movimiento_gemas enable row level security;
drop policy if exists "tienda: lectura autenticada" on public.articulo_tienda;
create policy "tienda: lectura autenticada" on public.articulo_tienda for select to authenticated using (true);
drop policy if exists "compras: leer las propias" on public.compra_tienda;
create policy "compras: leer las propias" on public.compra_tienda for select to authenticated
  using (usuario_id = (select public.usuario_actual()));
drop policy if exists "movimientos: leer los propios" on public.movimiento_gemas;
create policy "movimientos: leer los propios" on public.movimiento_gemas for select to authenticated
  using (usuario_id = (select public.usuario_actual()));

revoke all on public.articulo_tienda, public.compra_tienda, public.movimiento_gemas from anon, authenticated;
grant select on public.articulo_tienda, public.compra_tienda, public.movimiento_gemas to authenticated;
revoke execute on function public.comprar_articulo(text, text) from public, anon;
grant execute on function public.comprar_articulo(text, text) to authenticated;
revoke execute on function public.registrar_gemas_ronda(integer, text) from public, anon;
grant execute on function public.registrar_gemas_ronda(integer, text) to authenticated;
revoke execute on function public.perfil_usuario_gemas_por_rpc() from public, anon, authenticated;
revoke execute on function public.perfil_usuario_saldo_inicial() from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;

-- Verificación previa (solo lectura) en el SQL Editor:
--   select column_name, data_type from information_schema.columns
--   where table_schema = 'public' and table_name = 'perfil_usuario' and column_name = 'gemas';   → integer
--   select proname from pg_proc where proname = 'usuario_actual';                                → existe
--   select tgname from pg_trigger where tgrelid = 'public.perfil_usuario'::regclass and not tgisinternal;
-- Verificación posterior:
--   select count(*) from public.movimiento_gemas where tipo = 'saldo_inicial';  → = número de perfiles
--   select sum(gemas) from public.perfil_usuario;                               → igual que antes
