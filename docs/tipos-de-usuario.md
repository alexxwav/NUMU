# Tipos de usuario en NUMU

Este documento describe los **estados/tipos de usuario** que reconoce la aplicación, qué pantallas puede ver cada uno y qué datos se guardan. Se basa en:

- `src/App.jsx` (`RequireAccount`) y `src/services/startRoute.js` (`ROUTES`, `resolveStartRoute`).
- `src/hooks/useAuth.jsx` y `src/services/authService.js` (sesión de Supabase Auth).
- `src/views/LoginView.jsx` y `src/services/onboardingService.js` (cuestionario inicial).
- `src/data/subjects.js`, `src/state/store.js` (intereses, módulos y estado local).

## 1. Fuentes de verdad

| Fuente | Qué decide |
|---|---|
| `isSupabaseConfigured` (`src/lib/supabase.js`) | Si hay backend. Sin `.env.local`, las restricciones de cuenta se desactivan. |
| `session` (`useAuth`) | Si hay usuario autenticado en Supabase Auth. |
| `profile?.onboarding_completed` (`useAuth`) | Si el cuestionario inicial terminó (equivalente a tener fila en `perfil_usuario`). |
| `store.js` (`numu-state-v1` en `localStorage`) | Estado local de la vista: nivel, módulo activo, estrellas, ajustes. |
| `state.level` vs. nivel por lección | `state.level` es gamificación (paradas del mapa); el nivel académico (1–3) es por lección. |

## 2. Tipos / estados de usuario

| Tipo | Condición | Destino inicial (`resolveStartRoute`) |
|---|---|---|
| **Modo local (sin Supabase)** | `isSupabaseConfigured === false` | `/bienvenida` → elige libremente; `RequireAccount` no bloquea nada. |
| **Visitante sin sesión** | `configured === true`, `session === null` | `/iniciar-sesion` |
| **Sesión cargando** | `configured === true`, `loading === true` | Pantalla «Cargando…» en rutas protegidas; botones del splash deshabilitados. |
| **Autenticado sin onboarding** | `session !== null`, `onboarding_completed === false` | `/conocerte` |
| **Estudiante activo** | `session !== null`, `onboarding_completed === true` | `/inicio` |
| **Adulto/tutor en ajustes** | Cualquiera; desbloquea el control parental con la respuesta `6` | `/ajustes` (ruta pública) |

> Nota: `/conocerte` es una ruta **provisional** acordada en `startRoute.js`; hoy el cuestionario se renderiza con `LoginView.jsx`.

## 3. Rutas permitidas y restringidas

Leyenda: ✅ disponible · ⛔ redirige a la pantalla que falta.

| Ruta | Modo local | Sin sesión | Autenticado sin onboarding | Estudiante activo |
|---|---|---|---|---|
| `/` → `/bienvenida` | ✅ | ✅ | ✅ (salta a `/conocerte`) | ✅ (salta a `/inicio`) |
| `/iniciar-sesion` | ✅ | ✅ | ✅ | ✅ |
| `/crear-cuenta` | ✅ | ✅ | ✅ | ✅ |
| `/conocerte` | ✅ | ⛔ → `/iniciar-sesion` | ✅ | ⛔ → `/inicio` |
| `/inicio` | ✅ | ⛔ → `/iniciar-sesion` | ⛔ → `/conocerte` | ✅ |
| `/cursos` | ✅ | ⛔ → `/iniciar-sesion` | ⛔ → `/conocerte` | ✅ |
| `/cursos/:courseId` | ✅ | ⛔ → `/iniciar-sesion` | ⛔ → `/conocerte` | ✅ |
| `/lecciones/:lessonId` | ✅ | ⛔ → `/iniciar-sesion` | ⛔ → `/conocerte` | ✅ |
| `/lecciones/:lessonId/jugar` | ✅ | ⛔ → `/iniciar-sesion` | ⛔ → `/conocerte` | ✅ |
| `/jugar` y `/jugar/:nivel` | ✅ | ⛔ → `/iniciar-sesion` | ⛔ → `/conocerte` | ✅ |
| `/tienda` | ✅ | ⛔ → `/iniciar-sesion` | ⛔ → `/conocerte` | ✅ |
| `/trofeos` | ✅ | ⛔ → `/iniciar-sesion` | ⛔ → `/conocerte` | ✅ |
| `/ajustes` | ✅ | ✅ | ✅ | ✅ |

`RequireAccount` aplica `onboarding=true` solo a `/conocerte`: si el perfil ya está completo, te manda al inicio; para el resto de rutas protegidas, un perfil incompleto te manda al cuestionario.

### Zona adulta / control parental

`/ajustes` no exige cuenta y se abre desde el botón «Zona de ajustes (personas adultas)» del splash. Dentro de la vista, las acciones de adulto (por ejemplo, reiniciar el progreso) requieren responder `6` en la compuerta parental. No es un tipo de usuario separado en Supabase: es un estado local (`isParentalUnlocked`) de esa pantalla.

## 4. Estado del estudiante activo

### Nivel general y avance por sección

`state.level` es la gamificación global y sube al terminar cualquier ronda. El mapa de `/inicio` **ya no lo usa**: cada pestaña muestra su propio progreso.

- `state.levelByModule[moduleId]`: parada actual de esa sección (empieza en 1).
- `state.starsByModuleLevel[moduleId][parada]`: mejores estrellas (0 a 3) de cada parada de esa sección.

Para la sección activa:

- `parada < levelByModule[moduleId]` → **Completada** (jugable otra vez, con sus estrellas guardadas).
- `parada === levelByModule[moduleId]` → **Estás aquí** (pulpo y botón «Siguiente lección»).
- `parada > levelByModule[moduleId]` → **Bloqueada** (deshabilitada).

Cambiar de pestaña solo cambia `state.module`; el pulpo salta a la parada que esa sección tenga guardada en Supabase (o en el dispositivo si no hay sesión).

### Módulos habilitados

Los cuatro módulos están siempre disponibles en las pestañas de `/inicio`, sin importar los intereses elegidos:

| Módulo (`module_id`) | Lección del catálogo | Curso |
|---|---|---|
| `conteo` | `conteo-basico` | `aritmetica` |
| `aritmetica` | `sumas-basicas` | `aritmetica` |
| `geometria` | `figuras` | `geometria-patrones` |
| `patrones` | `patrones` | `geometria-patrones` |

Alias históricos aceptados: `sumas` → `aritmetica`, `formas` → `geometria`.

### Intereses y disponibilidad

`src/data/subjects.js` define los intereses `aritmetica`, `geometria`, `algebra` y `trigonometria`. Solo los dos primeros tienen curso publicado; `algebra` y `trigonometria` se muestran como **intereses no disponibles** en las recomendaciones. Los intereses ordenan las recomendaciones, pero **no bloquean** módulos.

### Nivel académico por lección (1–3)

No es una restricción de ruta ni de módulo: ajusta la dificultad de los ejercicios. Se deriva del diagnóstico (`0–1 → 1`, `2–3 → 2`, `4–5 → 3`) y evoluciona por ronda (3 estrellas suben, 2 o 1 conservan, vidas agotadas no avanzan). Cada lección tiene su propio nivel.

## 5. Datos almacenados por usuario

### A. Local: `localStorage['numu-state-v1']`

`src/state/store.js` guarda un objeto con:

| Grupo | Propiedades |
|---|---|
| Cuenta | `userId` |
| Gamificación | `lives`, `maxLives`, `streak`, `gems`, `stars`, `xp`, `level`, `module` |
| Progreso local | `starsByLevel` (global), `levelByModule` (`{ [moduleId]: parada }`), `starsByModuleLevel` (`{ [moduleId]: { [parada]: estrellas } }`), `lessonStars`, `lessonRounds` (`{ latestStars, level, at }` por lección) |
| Inventario | `owned` |
| Perfil local | `profile`: `completed`, `name`, `age`, `country`, `grade`, `interests`, `level`, `score`, `avatar`, `frame`, `nickname` |
| Ajustes | `settings`: `sound`, `volume`, `colorblind`, `reduceMotion`, `fontScale` |

Reglas importantes:

- `startSession(userId)`: al entrar otra cuenta, reinicia el progreso y conserva solo `settings`.
- `endSession()`: al salir, reinicia todo salvo `settings`.
- `reset()`: borra progreso pero conserva `profile`, `settings` y `owned`.
- Con sesión, el progreso local se combina con el remoto: `applyModuleProgress` toma el mayor nivel y las mejores estrellas por parada; `mergeLessonProgress` hace lo propio por lección (gana la ronda con fecha más reciente).

### B. Remoto: Supabase (proyecto `numu`)

| Tabla / servicio | Datos |
|---|---|
| Supabase Auth (`auth.users`) | Correo, contraseña hasheada y `user_metadata.nickname`. La contraseña **nunca** se guarda en la app. |
| `usuarios` | `id`, `correo`, `fecha_registro`, `auth_id` (liga Auth con el perfil). |
| `perfil_usuario` | `nombre`, `apodo`, `edad`, `pais`, `grado_escolar`, `avatar`, `gemas`, `xp`, `intereses`. La existencia de fila implica `onboarding_completed = true`. |
| `resultados_examen_diagnostico` | `num_aciertos`, `puntuacion`, `autoevaluacion`, `respuestas`. |
| `progreso` (por curso) | `nivel_actual`, `num_estrellas`, `num_intentos`, `racha_dias`, `leccion_completada`. |
| `progreso_leccion` (por lección) | `estrellas` (mejor), `intentos` y, si aplica la migración de última ronda, `ultimas_estrellas`, `nivel`, `ultimo_intento`. |
| `user_module_progress` (por sección) | `usuario_id`, `module_id`, `current_level` (parada actual), `stars_by_level` (`{"1":3,"2":2,...}`). Una fila por usuario y módulo; se aplica con `supabase_progreso_modulos.sql`. |

RLS: cada estudiante solo lee y modifica sus propias filas; sin sesión no se lee nada. Las claves `service_role` / `sb_secret_` nunca se usan en el frontend.

## 6. Resumen rápido

- **Sin Supabase**: la app es completamente local y no hay restricciones de cuenta.
- **Con Supabase**: estar autenticado abre el juego; haber completado `/conocerte` abre el resto de pantallas.
- **El perfil y los ajustes** son locales; **el progreso y el diagnóstico** se sincronizan con Supabase cuando hay sesión.
- **Los cuatro módulos** siempre son jugables; los intereses solo influyen en las recomendaciones.
