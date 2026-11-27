-- NUMU · PROPUESTA (NO APLICADA): la XP guardada en perfil_usuario nunca disminuye.
-- Proyecto: numu. Probada en Postgres en memoria con tests/db/xp-monotona.check.mjs.
-- Aplicar solo con autorización, después de verificar el esquema real (consultas al final).
--
-- Problema: la app guarda la XP leyendo y escribiendo desde el cliente (useAuth.jsx →
-- profileService.saveProfile). Un dispositivo con menos datos, o dos guardados a la vez, pueden
-- escribir una XP MENOR y borrar XP histórica.
-- Solución mínima: un trigger BEFORE UPDATE que conserva el mayor valor entre la XP guardada y la
-- nueva. Cada UPDATE se evalúa contra la fila ya confirmada (Postgres la bloquea), así que funciona
-- con guardados simultáneos y no requiere cambios en la app.
--
-- Qué NO hace:
--   · No cambia ninguna XP existente ni otorga XP (no hay regla nueva de XP).
--   · No toca las gemas: bajan legítimamente al comprar en la tienda.
--   · No cambia políticas RLS ni permisos.
-- Idempotente: se puede ejecutar más de una vez. Todo en una transacción.

begin;

create or replace function public.perfil_usuario_xp_no_baja()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.xp := greatest(coalesce(old.xp, 0), coalesce(new.xp, 0));
  return new;
end;
$$;

comment on function public.perfil_usuario_xp_no_baja() is
  'Conserva la mayor XP entre la guardada y la nueva: la XP histórica nunca disminuye.';

drop trigger if exists perfil_usuario_xp_no_baja on public.perfil_usuario;
create trigger perfil_usuario_xp_no_baja
  before update on public.perfil_usuario
  for each row execute function public.perfil_usuario_xp_no_baja();

commit;

-- Verificación previa (solo lectura) en el SQL Editor:
--   select column_name, data_type from information_schema.columns
--   where table_schema = 'public' and table_name = 'perfil_usuario' and column_name in ('xp', 'gemas');
--     → xp y gemas numéricas (integer). Si xp no existe o no es numérica, NO aplicar.
--   select tgname from pg_trigger where tgrelid = 'public.perfil_usuario'::regclass and not tgisinternal;
--     → revisar que no exista otro trigger que modifique xp.
