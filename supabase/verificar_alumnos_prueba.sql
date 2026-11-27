-- NUMU · Verificación de SOLO LECTURA de los 15 alumnos ficticios («+numutest01…15» del buzón del equipo).
-- Una fila por comprobación: comprobacion | estado | detalle. No muestra correos ni contraseñas.
with prueba as (
  select u.id as uid, a.id as auth_id
  from auth.users a join public.usuarios u on u.auth_id = a.id
  where a.email ~ '\+numutest(0[1-9]|1[0-5])@'
),
originales as (select id from public.usuarios where id not in (select uid from prueba))
select '1 · cuentas Auth de prueba' as comprobacion,
       case when (select count(*) from auth.users where email ~ '\+numutest(0[1-9]|1[0-5])@') = 15 then 'OK' else 'ERROR' end as estado,
       (select count(*) from auth.users where email ~ '\+numutest(0[1-9]|1[0-5])@')::text || ' de 15 · confirmadas ' ||
       (select count(*) from auth.users where email ~ '\+numutest(0[1-9]|1[0-5])@' and email_confirmed_at is not null)::text as detalle
union all
select '2 · usuario y perfil por cuenta',
       case when (select count(*) from prueba) = 15 and (select count(*) from public.perfil_usuario where usuario_id in (select uid from prueba)) = 15 then 'OK' else 'ERROR' end,
       (select count(*) from prueba)::text || ' usuarios · ' || (select count(*) from public.perfil_usuario where usuario_id in (select uid from prueba))::text || ' perfiles'
union all
select '3 · sin huérfanos (toda la base)',
       case when (select count(*) from public.usuarios where auth_id is null or auth_id not in (select id from auth.users)) = 0
             and (select count(*) from public.perfil_usuario where usuario_id is null or usuario_id not in (select id from public.usuarios)) = 0 then 'OK' else 'ERROR' end,
       'usuarios sin cuenta: ' || (select count(*) from public.usuarios where auth_id is null or auth_id not in (select id from auth.users))::text
       || ' · perfiles sin usuario: ' || (select count(*) from public.perfil_usuario where usuario_id is null or usuario_id not in (select id from public.usuarios))::text
union all
select '4 · un diagnóstico por alumno, con sus aciertos',
       case when (select count(*) from public.resultados_examen_diagnostico where usuario_id in (select uid from prueba)) = 15
             and not exists (select 1 from public.resultados_examen_diagnostico d where d.usuario_id in (select uid from prueba)
                             and d.puntuacion <> round(d.num_aciertos * 100.0 / 5)) then 'OK' else 'ERROR' end,
       (select count(*) from public.resultados_examen_diagnostico where usuario_id in (select uid from prueba))::text || ' diagnósticos'
union all
select '5 · estrellas y niveles válidos (0–3, nivel 1–3, mejor ≥ última)',
       case when not exists (select 1 from public.progreso_leccion where usuario_id in (select uid from prueba)
                              and (estrellas not between 0 and 3 or nivel not between 1 and 3 or ultimas_estrellas > estrellas)) then 'OK' else 'ERROR' end,
       (select count(*) from public.progreso_leccion where usuario_id in (select uid from prueba))::text || ' filas de lección (esperado 27)'
union all
select '5b · solo prácticas publicadas',
       case when not exists (select 1 from public.progreso_leccion where usuario_id in (select uid from prueba)
                              and leccion_id not in ('conteo-basico', 'sumas-basicas', 'figuras', 'patrones')) then 'OK' else 'ERROR' end, ''
union all
select '5c · XP = estrellas del mapa × 50',
       case when not exists (select 1 from public.perfil_usuario p where p.usuario_id in (select uid from prueba)
              and p.xp <> 50 * coalesce((select sum(v::int) from public.user_module_progress m, jsonb_each_text(m.stars_by_level) e(k, v) where m.usuario_id = p.usuario_id), 0)) then 'OK' else 'ERROR' end,
       (select count(*) from public.user_module_progress where usuario_id in (select uid from prueba))::text || ' filas de mapa (esperado 27)'
union all
select '5d · saldo inicial de gemas en el libro',
       case when (select count(*) from public.movimiento_gemas where tipo = 'saldo_inicial' and usuario_id in (select uid from prueba)) = 15 then 'OK' else 'ERROR' end, ''
union all
select '6 · preferencias guardadas',
       case when not exists (select 1 from public.perfil_usuario where usuario_id in (select uid from prueba) and cardinality(intereses) = 0) then 'OK' else 'ERROR' end,
       (select string_agg(distinct i, ', ') from public.perfil_usuario p, unnest(p.intereses) i where p.usuario_id in (select uid from prueba))
union all
select '10 · las 4 cuentas originales intactas',
       case when (select count(*) from originales) = 4
             and (select md5(string_agg(usuario_id || ':' || gemas || ':' || xp, '|' order by usuario_id)) from public.perfil_usuario where usuario_id in (select id from originales))
               = (select md5(string_agg(usuario_id || ':' || gemas || ':' || xp, '|' order by usuario_id)) from respaldo_numu.perfil_usuario_20261127)
             and (select count(*) from public.progreso_leccion where usuario_id in (select id from originales)) = (select count(*) from respaldo_numu.progreso_leccion_20261127)
       then 'OK' else 'ERROR' end,
       (select count(*) from originales)::text || ' cuentas originales comparadas con respaldo_numu';
