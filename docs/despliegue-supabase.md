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

## 2. Secuencia de despliegue (corta)

1. **Confirmar esquema:** ejecutar `supabase/diagnostico_numu.sql` (solo lectura). Seguir solo si no hay
   ninguna fila `FALTA`; si `user_module_progress` falta, aplicar antes `supabase_progreso_modulos.sql`.
   Guardar la fila `totales · perfil_usuario` (perfiles, suma de gemas y XP).
2. **Respaldar:** ejecutar `supabase/respaldo_previo.sql` (copia las 6 tablas al esquema
   `respaldo_numu`, no expuesto por la API; al final, originales = respaldadas). Opcional: CSV.
3. **Aplicar** (cada archivo completo, en este orden): `propuesta_xp_monotona.sql` →
   `propuesta_ultima_ronda_transaccional.sql` → `propuesta_gemas_transaccional.sql`.
4. **Verificar:** repetir `diagnostico_numu.sql`: las 3 migraciones `APLICADA`, mismos totales, RPC de
   gemas ejecutables por `authenticated` y no por `anon`.
5. **Cuenta ficticia:** sección 4 con la app publicada (`.env.local` con URL y clave pública de numu).
6. **Persistencia:** después de cada paso, `supabase/verificar_cuenta_ficticia.sql` (solo lectura).
7. **Recuperar si falla:** `supabase/reversion_propuestas.sql` (no borra datos); si hiciera falta,
   restaurar los CSV del paso 2.

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

## 6. Verificación de esta sesión (27-nov-2026)

| Comprobación | Resultado | Cómo |
|---|---|---|
| Configuración local | `.env.local` (solo en el worktree principal, ignorado por git) tiene `VITE_SUPABASE_URL` con formato válido y una clave `sb_publishable_…`; sin claves secretas | lectura sin mostrar valores |
| Proyecto `numu` accesible para consultas de solo lectura | **NO**: el conector de Supabase de esta sesión solo ve un proyecto ajeno (CRM), que no se consultó. La URL de la app no es ese proyecto | `list_projects` |
| Supabase Auth en la app | `signUp`, `signInWithPassword`, `signOut`, `getSession`, `onAuthStateChange`; solo clave pública en `src/` | `tests/cuentasAisladas.test.js` |
| Aislamiento de cuentas en el dispositivo | una cuenta nueva no hereda XP, gemas, compras, progreso ni perfil | `tests/cuentasAisladas.test.js` (5) |
| Registro, sesión, progreso, niveles, XP, gemas, compras, recompensas, RLS | correctos en la base aislada con las 3 migraciones | `tests/db/despliegue-completo.check.mjs` (40) |

**Bloqueo:** la verificación previa (sección 2, paso 2) y la prueba con cuenta ficticia (sección 4) deben
ejecutarse en el proyecto `numu` por quien tenga acceso (SQL Editor o conector con ese proyecto).
Nada de lo anterior demuestra que Supabase real funcione: solo la base simulada.

### Conexión real comprobada (27-nov-2026, solo lectura, sin sesión ni escrituras)

Con la URL y la clave pública de `.env.local` (no se imprimieron):
- Auth responde (200), el registro por correo está habilitado y **pide confirmar el correo**
  (`mailer_autoconfirm = false`): la cuenta ficticia necesita un buzón accesible.
- `perfil_usuario`, `progreso_leccion`, `user_module_progress` y `cursos` **existen** en numu y sin sesión
  responden «permission denied» (RLS/permisos correctos para `anon`).
- Funciones RPC, columnas y políticas: no se pueden ver sin sesión ni clave secreta → `diagnostico_numu.sql`.
