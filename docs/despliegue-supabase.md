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

Diagnóstico real de numu (27-nov-2026): **COMPATIBLE**. 8 tablas, `user_module_progress`, 4 únicas,
trigger de registro y RLS correctos; 3 migraciones pendientes. Las 6 columnas `character varying` y
`puntuacion numeric` no afectan a ninguna migración (ensayo con esos tipos: 53/53). 4 perfiles con 0 XP y
0 gemas: el libro de gemas empezará con 4 saldos iniciales de 0.

Cada archivo se pega COMPLETO en el SQL Editor y se ejecuta una vez:

| Paso | Archivo | Escribe | Esperado |
|---|---|---|---|
| 1 | `respaldo_previo.sql` | sí (solo crea `respaldo_numu`) | 6 filas «datos» OK (filas y md5) + 8 tipos «esquema» OK |
| 2 | `verificacion_post_migracion.sql` | no | «todas» OK · 1, 2, 3 PENDIENTE |
| 3 | `propuesta_xp_monotona.sql` | sí | — |
| 4 | `verificacion_post_migracion.sql` | no | «todas» OK · 1 OK · 2, 3 PENDIENTE |
| 5 | `propuesta_ultima_ronda_transaccional.sql` | sí | — |
| 6 | `verificacion_post_migracion.sql` | no | «todas» OK · 1, 2 OK · 3 PENDIENTE |
| 7 | `propuesta_gemas_transaccional.sql` | sí | — |
| 8 | `verificacion_post_migracion.sql` | no | todo OK |
| 9 | `diagnostico_numu.sql` | no | 3 migraciones APLICADA, mismos totales |

Si cualquier verificación muestra **ERROR**: no seguir y ejecutar `reversion_propuestas.sql` (no borra
datos). Si aun así hiciera falta, restaurar desde `respaldo_numu` (instrucciones al final de `respaldo_previo.sql`).

## 3. Qué falta para conectar Supabase real

- Autorizar el paso 1 (publicar la rama) y las credenciales públicas en `.env.local` del equipo
  (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`; nunca claves secretas en el repo).
- Ejecutar la verificación previa y confirmar que `user_module_progress` existe en `numu`.
- Autorizar el respaldo y las tres migraciones (pasos 3–5), por quien administra el proyecto.
- Crear la cuenta ficticia (correo de prueba del equipo) y ejecutar la sección 4.

## 4. Prueba con una cuenta ficticia (después del paso 9)

Preparación: correo de prueba del equipo con buzón accesible (el proyecto exige confirmar el correo).
App: rama `pruebas/integracion-numu-15` con `.env.local` de numu (`npm run dev`). Después de cada paso,
`verificar_cuenta_ficticia.sql` (solo lectura) con ese correo en la primera línea.

| # | Acción en la app | Esperado en `verificar_cuenta_ficticia.sql` |
|---|---|---|
| 1 | Crear cuenta y confirmar el correo | (aún sin filas de perfil) |
| 2 | Iniciar sesión y completar el cuestionario | `perfil`: gemas 0 · xp 0; `diagnostico`; `gemas saldo_inicial` 0 |
| 3 | Abrir la teoría de Sumas básicas | sin cambios (abrir teoría no guarda ni premia) |
| 4 | Jugar Sumas con 0–1 errores (3★) | `leccion sumas-basicas`: mejor 3 · última 3 · nivel 2; `gemas recompensa` 15; `mapa aritmetica`; perfil: xp > 0 |
| 5 | Recargar la página | la app muestra las mismas gemas, XP, estrellas y nivel |
| 6 | Cerrar sesión e iniciar otra vez | igual que el paso 5 |
| 7 | Iniciar sesión en otro navegador | igual que el paso 5 |
| 8 | Comprar «Marco Coral» (30) si alcanza, con doble clic | `gemas compra` −30 una sola vez; al recargar e iniciar sesión las gemas no vuelven |
| 9 | Abrir `/lecciones/la-balanza-de-numu/jugar` | redirige a la teoría; sin filas nuevas |

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

## 7. Identidad del proyecto y copia fuera de la base (antes del paso 1)

**Identidad:** la app apunta al proyecto cuyo identificador empieza en `khjj` y termina en `sbfb`
(20 caracteres; NO es el CRM). En el panel de Supabase, el identificador aparece en la URL
(`supabase.com/dashboard/project/<id>`) y en Project Settings → General. Ejecutar solo si coinciden.

**Copia recuperable fuera de `respaldo_numu`** (la hace quien tiene la contraseña de la base; no se comparte):
1. Panel → **Connect** → copiar la cadena «Session pooler» (o «Direct»).
2. En una terminal con Node:
   ```bash
   npx supabase db dump --db-url "<cadena>" -f numu_esquema_20261127.sql
   npx supabase db dump --db-url "<cadena>" --data-only -f numu_datos_20261127.sql
   npx supabase db dump --db-url "<cadena>" --data-only --schema auth -f numu_auth_20261127.sql
   ```
3. Comprobar que los tres archivos tienen contenido (en el de datos deben aparecer `perfil_usuario`,
   `progreso_leccion` y `user_module_progress`) y guardarlos fuera del repositorio (contienen datos personales).
   Si el plan del proyecto tiene copias automáticas (Database → Backups), anotar también la más reciente.
