-- NUMU · Verificación de SOLO LECTURA de la cuenta ficticia de prueba (SQL Editor de numu).
-- Cambiar el correo de la primera línea por el de la cuenta ficticia del equipo. No modifica nada y
-- solo muestra datos de esa cuenta. Ejecutar después de cada paso de la prueba para ver lo guardado.
with cuenta as (select 'cuenta.ficticia@ejemplo.com'::text as correo),
u as (select us.id from public.usuarios us, cuenta where lower(us.correo) = lower(cuenta.correo))
select 'perfil' as dato, 'gemas ' || p.gemas || ' · xp ' || p.xp || ' · intereses ' || coalesce(array_to_string(p.intereses, ','), '') as valor
from public.perfil_usuario p where p.usuario_id in (select id from u)
union all
select 'diagnostico', 'aciertos ' || d.num_aciertos || ' · puntuación ' || d.puntuacion
from public.resultados_examen_diagnostico d where d.usuario_id in (select id from u)
union all
select 'leccion ' || l.leccion_id,
       'mejor ' || l.estrellas || ' · intentos ' || l.intentos
       || coalesce(' · última ' || (to_jsonb(l) ->> 'ultimas_estrellas'), '')
       || coalesce(' · nivel ' || (to_jsonb(l) ->> 'nivel'), '')
from public.progreso_leccion l where l.usuario_id in (select id from u)
union all
select 'mapa ' || m.module_id, 'parada ' || m.current_level || ' · estrellas ' || m.stars_by_level::text
from public.user_module_progress m where m.usuario_id in (select id from u)
union all
select 'curso ' || c.curso_id, 'nivel ' || c.nivel_actual || ' · estrellas ' || c.num_estrellas || ' · intentos ' || c.num_intentos
from public.progreso c where c.usuario_id in (select id from u)
union all
-- Solo existe después de la migración de gemas: si falla esta parte, borrar desde aquí hasta el final.
select 'gemas ' || x.tipo, x.cantidad::text || ' → saldo ' || x.saldo || coalesce(' · ' || x.articulo_id, '')
from public.movimiento_gemas x where x.usuario_id in (select id from u)
order by 1;
