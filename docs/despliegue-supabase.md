# NUMU · Conexión definitiva a Supabase (proyecto `numu`)

Estado: **preparado, NO ejecutado**. Ensayo completo en `node tests/db/despliegue-completo.check.mjs`
(40/0): producción simulada → respaldo → 3 migraciones → verificación → reaplicar → revertir.

## 1. Qué se aplica y en qué orden

| # | Archivo | Qué hace | Prueba propia |
|---|---|---|---|
| 0 | *(ya aplicado)* `propuesta_numu_auth.sql`, `progreso_leccion.sql` | Auth, RLS, `progreso_leccion` y RPC de 2 parámetros | `schema`, `progreso-leccion` |
| 0 | *(verificar)* `supabase_progreso_modulos.sql` (raíz del repo, de César) | `user_module_progress` para el mapa por sección | despliegue-completo |
| 1 | `propuesta_xp_monotona.sql` | Trigger: `perfil_usuario.xp` nunca baja | `xp-monotona` (12) |
| 2 | `propuesta_ultima_ronda_transaccional.sql` | `progreso_leccion`: nivel y última ronda; RPC con `p_nivel` opcional | `migracion-produccion` (45) |
| 3 | `propuesta_gemas_transaccional.sql` | Tienda, compras y recompensas por RPC; libro de movimientos | `gemas-transaccional` (40) |
| — | `reversion_propuestas.sql` | Deshace 1–3 sin borrar datos | despliegue-completo |

Compatibilidad comprobada: los tres triggers de `perfil_usuario` conviven; la app publicada sigue
guardando lecciones (RPC de 2 parámetros) y perfil; ninguna migración cambia datos existentes.

## 2. Secuencia de despliegue

1. **App primero.** Publicar la rama de integración (funciona sin las migraciones: detecta
   PGRST202 y usa el guardado anterior, sin devolver gemas gastadas).
2. **Verificación previa (solo lectura, SQL Editor):**
   ```sql
   select table_name, column_name, data_type from information_schema.columns
   where table_schema = 'public' and table_name in ('perfil_usuario', 'progreso_leccion', 'user_module_progress')
   order by table_name, ordinal_position;
   select proname, pg_get_function_identity_arguments(oid) from pg_proc
   where proname in ('usuario_actual', 'registrar_resultado_leccion', 'comprar_articulo', 'registrar_gemas_ronda');
   select tgname, tgrelid::regclass from pg_trigger where not tgisinternal and tgrelid::regclass::text like 'public.%';
   select tablename, policyname, cmd from pg_policies where schemaname = 'public' order by 1, 3;
   select count(*), sum(gemas), sum(xp) from public.perfil_usuario;
   ```
   Esperado: `perfil_usuario.gemas` y `xp` enteros; `usuario_actual()` y
   `registrar_resultado_leccion(text, integer)` existen; `user_module_progress` existe (si no, aplicar
   antes `supabase_progreso_modulos.sql`). Si algo difiere, **detenerse**.
3. **Respaldo:** exportar a CSV (Table Editor) `usuarios`, `perfil_usuario`, `progreso`,
   `progreso_leccion`, `user_module_progress`, `resultados_examen_diagnostico`; o en SQL:
   `create table respaldo_perfil_usuario_YYYYMMDD as table public.perfil_usuario;` (una por tabla).
   Anotar los totales del paso 2.
4. **Aplicar** 1 → 2 → 3, cada archivo completo en una ejecución (todos usan `begin … commit`).
5. **Verificación posterior:** repetir las consultas del paso 2. Esperado: mismos `count`, `sum(gemas)`
   y `sum(xp)`; `registrar_resultado_leccion(text, integer, integer)`; RPC de gemas creados;
   `select count(*) from movimiento_gemas where tipo = 'saldo_inicial'` = número de perfiles.
6. **Prueba con la cuenta ficticia** (sección 4).
7. **Recuperación**, solo si algo falla: ejecutar `reversion_propuestas.sql` (no borra datos) y, si
   hiciera falta, restaurar desde el respaldo del paso 3.

## 3. Qué falta para conectar Supabase real

- Autorizar el paso 1 (publicar la rama) y las credenciales públicas en `.env.local` del equipo
  (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`; nunca claves secretas en el repo).
- Ejecutar la verificación previa y confirmar que `user_module_progress` existe en `numu`.
- Autorizar el respaldo y las tres migraciones (pasos 3–5), por quien administra el proyecto.
- Crear la cuenta ficticia (correo de prueba del equipo) y ejecutar la sección 4.

## 4. Prueba con una cuenta ficticia (después de migrar)

| Paso | Acción | Esperado |
|---|---|---|
| 1 | Registrarse con la cuenta ficticia y completar el cuestionario | fila en `usuarios` y `perfil_usuario` con 0 gemas y saldo inicial en `movimiento_gemas` |
| 2 | Jugar Sumas con 3★ | `progreso_leccion` con `nivel = 2`, `ultimas_estrellas = 3`; +15 gemas por `registrar_gemas_ronda` |
| 3 | Repetir con 1★ | mejor estrella sigue en 3; `ultimas_estrellas = 1` |
| 4 | Jugar una parada del mapa | fila en `user_module_progress`; XP +50 por estrella mejorada |
| 5 | Comprar un marco con doble clic | se cobra una vez; fila en `compra_tienda` |
| 6 | Cerrar sesión, iniciar y recargar | mismas gemas, XP, marcos y progreso |
| 7 | Iniciar sesión en otro navegador y comprar otro marco | ambos dispositivos muestran el mismo saldo |
| 8 | Abrir `/lecciones/la-balanza-de-numu/jugar` | redirige a la teoría; sin gemas ni guardados |

## 5. Riesgos conocidos

- **Recompensas:** el servidor limita cantidad (0/5/10/15), formato de clave y 60 por hora, pero no
  puede comprobar que la ronda existió (cliente modificado: hasta 900 gemas/hora). Corrección completa:
  ticket de ronda emitido por el servidor (no bloquea el cierre).
- **XP:** la app puede escribir una XP mayor que la real (el trigger solo impide que baje).
- **App vieja en caché** tras la migración de gemas: no sube recompensas hasta recargar la versión nueva.
- Tras una reversión, cambios de gemas hechos por la app vieja no quedan en `movimiento_gemas`.
