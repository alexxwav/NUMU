# NUMU · Procedimiento de integración del motor (15 lecciones)

Responsable: Laura (motor, progreso y navegación). Rama: `feat/laura-motor-20`.
Alcance: 15 lecciones en Aritmética, Geometría y Álgebra. Sin Trigonometría.

Este documento **no autoriza** cambios: describe qué hacer cuando el equipo lo apruebe.

---

## 1. Validar el motor con los contenidos de Viviana (antes de unir ramas)

```bash
node tests/integracion/validar-con-viviana.mjs                       # referencia por omisión
node tests/integracion/validar-con-viviana.mjs --ref <commit-o-rama> # otra referencia
node tests/integracion/validar-con-viviana.mjs --keep                # conserva el entorno temporal
```

- Crea un entorno **aislado** en la carpeta temporal del sistema: copia este worktree y le superpone
  solo los archivos que cambió la rama de Viviana. Usa git en modo lectura; no modifica ramas ni worktrees.
- Si `src/data/lessonContent.json` ya tiene las 15 lecciones, usa el catálogo **oficial**; si no, el
  fixture `content-drafts/catalog-v2.fixture.js` (lo indica en la salida: **no es el catálogo oficial**).
- Ejecuta la suite completa y las pruebas con el catálogo de 15, e imprime las 45 combinaciones.
- Resultado esperado hoy (Viviana `1770484`): 0 fallidas · 43/45 combinaciones con 6 preguntas
  distintas · pendientes documentados: Conteo N1 (cobertura 4) y N2 (cobertura 5).

Con el catálogo oficial integrado, las pruebas «catálogo de 15» dejan de omitirse solas en `npm test`.

## 2. Unir las ramas (cuando se autorice)

1. `git fetch origin` y confirmar los SHA de `feat/laura-motor-20` y `feat/viviana-contenidos-20`.
2. Ejecutar el paso 1 con la referencia exacta de Viviana: debe terminar con código 0.
3. Comprobar que no hay conflictos: `git merge-tree --write-tree origin/feat/laura-motor-20 origin/feat/viviana-contenidos-20`
   (simulación en memoria; código 0 = sin conflictos).
4. Crear una rama de integración NUEVA desde `integracion/numu-20-cursos` y fusionar ambas ramas con
   `git merge` normal (sin force, sin rebase de ramas ajenas).
5. Verificar: `npm test`, `npm run test:db`, `node tests/db/*.check.mjs`, `npm run build` y el recorrido
   en navegador local (teoría → práctica → resultados → recomendaciones → continuar).
6. Publicar la rama de integración y pedir revisión. No tocar `main` ni ramas de otros.

## 3. XP histórica: cambios mínimos pendientes (archivos compartidos, NO aplicados)

Problema reproducido con el código real en `tests/xpRegresion.test.js`: `store.js` y `useAuth.jsx`
reemplazan la XP por `getTotalXp` (estrellas de paradas × 50). Una alumna con 1200 XP pasa a 450.

Usar `reconcileXp` de `src/utils/xpProtection.js` (ya existe; no reescribirla):

| Archivo | Lugar | Hoy | Cambio |
|---|---|---|---|
| `src/state/store.js` | `load()` | `xp: getTotalXp(saved)` | `xp: reconcileXp({ localXp: saved.xp, derivedXp: getTotalXp(saved) })` |
| `src/state/store.js` | `recordModuleRound` | `xp: getTotalXp({ ...state, starsByModuleLevel })` | `xp: reconcileXp({ localXp: state.xp, derivedXp: getTotalXp({ ...state, starsByModuleLevel }) })` |
| `src/state/store.js` | `applyModuleProgress` | `xp: getTotalXp({ ...state, starsByModuleLevel: stars })` | `xp: reconcileXp({ localXp: state.xp, derivedXp: getTotalXp({ ...state, starsByModuleLevel: stars }) })` |
| `src/hooks/useAuth.jsx` | `loadProfile` | `xp: getTotalXp(store.get())` | `xp: reconcileXp({ remoteXp: profile.xp, localXp: local.xp, derivedXp: getTotalXp(store.get()) })` |
| `src/hooks/useAuth.jsx` | `recordRound` | `xp: getTotalXp(state)` | `xp: reconcileXp({ localXp: state.xp, derivedXp: getTotalXp(state) })` |

`moduleProgressService.js` no necesita cambios. **No** se define una regla de XP para las lecciones
nuevas (decisión pendiente): hoy, en esta rama, una ronda de una lección nueva muestra «+0 XP».

### Verificación después de aplicar los cambios

1. `node --test tests/xpRegresion.test.js`: las pruebas «ERROR ACTUAL» **deben fallar** (la XP ya no
   baja). Cambiar cada una a su expectativa «PROPUESTA» (1200 se conserva) y volver a ejecutar.
2. `node --test tests/mapa15.test.js tests/recorridoIntegral.test.js`: la XP histórica no baja en la
   transición del mapa y el historial de 10 paradas se conserva.
3. Navegador local: recargar con 1200 XP guardadas → debe seguir en 1200.

### Gemas independientes de la XP

- Las gemas **no** usan `reconcileXp`: bajan al comprar en la tienda (`store.purchase`).
- Prueba: `tests/xpRegresion.test.js` («comprar en la tienda…»): 40 → 15 gemas, XP 1200 sin cambios.
- El trigger SQL solo protege `xp`; `tests/db/xp-monotona.check.mjs` comprueba que las gemas pueden bajar.

### Recompensas duplicadas

- `Game.jsx` cierra cada ronda una sola vez (`roundClosedRef`): un doble clic no repite recompensas.
- La transición del mapa no otorga nada (`mapTransition(...).rewardsGranted` = 0).
- Pruebas: `tests/mapa15.test.js` (8) y `tests/recorridoIntegral.test.js` (13).

### Persistencia entre dispositivos

- Progreso académico: `progreso_leccion` (mejor marca con `greatest`) — `tests/lessonProgress20.test.js`,
  `tests/db/progreso-20.check.mjs`.
- XP: con los cambios de la tabla + el trigger, el máximo entre dispositivos —
  `tests/xpRegresion.test.js` («dos dispositivos…», «guardados concurrentes…»).

## 4. Migraciones propuestas (verificar antes de aplicar; NO ejecutadas)

| Orden | Archivo | Qué hace | Prueba local |
|---|---|---|---|
| 1 | `supabase/propuesta_ultima_ronda_transaccional.sql` | Nivel académico y última ronda en `progreso_leccion`; RPC con `p_nivel` opcional | `node tests/db/migracion-produccion.check.mjs` |
| 2 | `supabase/propuesta_xp_monotona.sql` | Trigger: `perfil_usuario.xp` nunca baja | `node tests/db/xp-monotona.check.mjs` |

Antes de aplicar cada una en producción:

1. Ejecutar su prueba PGlite: debe terminar con 0 fallidas (incluye repetir la migración y conservar registros).
2. Ejecutar en el SQL Editor las consultas de **solo lectura** que trae cada archivo al inicio o al final,
   y confirmar que el esquema real coincide (columnas, tipos, firma del RPC, políticas, triggers).
3. Hacer un respaldo (exportación) de `progreso_leccion` y `perfil_usuario`.
4. Aplicar el archivo completo como un solo bloque (ambos ya usan `begin … commit`).
5. Repetir las consultas de solo lectura y probar en la app con una cuenta de prueba.

## 5. Pendientes que requieren a otras personas

| Pendiente | Quién | Detalle |
|---|---|---|
| Catálogo oficial de 15 lecciones | Viviana | Publicar en `src/data/lessonContent.json` (p. ej. desde `loadCatalogV2()`), con el área `algebra`. |
| Mapa visual | Viviana | `OceanMap.jsx` debe usar `getMapModel(...)` (5 paradas por área, `theoryPath`, `playPath`). |
| «Continuar» sin repetir | quien tenga `Home.jsx` | Pasar `starsByLesson: state.lessonStars` a `resolveContinueRoute`. |
| Conteo N1–N2 | Viviana + equipo | Decidir la evidencia semántica (hoy cobertura 4 y 5; se juega con el flujo anterior). |
| XP de lecciones nuevas | equipo | Decidir la regla (hoy «+0 XP»). |
| XP histórica | equipo | Autorizar los cambios de la sección 3 y la migración 2. |

## 6. Reglas provisionales de economía (aprobadas para la integración local)

| Regla | Dónde se cumple | Prueba |
|---|---|---|
| La XP histórica nunca baja al recalcular el mapa | `store.load`, `applyModuleProgress`, `useAuth.loadProfile/recordRound`, Home | `tests/xpRegresion.test.js` |
| Repetir una parada sin mejorar: +0 XP | `store.recordModuleRound` (suma solo lo que sube la XP derivada) | «suma solo las estrellas mejoradas» |
| Mejorar una estrella del mapa antiguo: +50 XP | `getTotalXp` (XP_PER_STAR = 50) | ídem |
| Lecciones nuevas: +0 XP | `addRewards` ya no suma XP; las lecciones nuevas no tienen parada | «secuencia real de Game.jsx» |
| Gemas: +5 por estrella de la ronda, sin duplicar | `Game.finishRound` + `roundClosedRef` | `tests/recorridoIntegral.test.js` (13) |

`addRewards` solo se llama en `Game.finishRound` (una vez por ronda). Antes sumaba XP que luego se
sobrescribía con la derivada; con la XP protegida esa suma se habría conservado (XP por repetir y por
lecciones nuevas), por eso ya no suma XP. Gemas y estrellas siguen igual.

**Contradicción documentada (sin resolver, anterior a este bloque):** las compras bajan gemas solo en
el dispositivo (`ShopView` → `store.purchase`, sin `saveProfile`) y `loadProfile` toma
`max(gemas locales, gemas de la cuenta)`. Al iniciar sesión antes de terminar otra ronda, las gemas
gastadas vuelven. Requiere decidir cómo sincronizar compras; no se inventó una regla.

## 7. Gemas y compras transaccionales (Parte B, pendiente de revisión; NO aplicada)

Causa del error: la compra solo cambiaba el dispositivo (`store.purchase`), `recordRound` escribía el
saldo absoluto en `perfil_usuario.gemas` y `loadProfile` tomaba `max(local, cuenta)`.

Solución: `supabase/propuesta_gemas_transaccional.sql` + `src/services/gemsService.js`.
- El saldo de la cuenta manda. Las recompensas quedan pendientes en el dispositivo (`gemsPending`,
  con clave única) hasta que `registrar_gemas_ronda` las confirma (una sola vez).
- `comprar_articulo` bloquea el perfil (`FOR UPDATE`), cobra el precio del servidor una sola vez y
  guarda el artículo en `compra_tienda`. Precios = `FRAMES` de `Avatar.js` (prueba que los compara).
- Un trigger impide que la app cambie `gemas` directamente; el libro `movimiento_gemas` audita todo.

Orden de despliegue (compatibilidad):
1. Publicar la app (funciona sin la migración: compra local + guardado inmediato, sin `max()`).
2. Verificar con las consultas de solo lectura del archivo y respaldar `perfil_usuario`.
3. Aplicar `propuesta_xp_monotona.sql` y luego `propuesta_gemas_transaccional.sql` (son compatibles).
4. Probar con una cuenta ficticia: compra, doble clic, cerrar/iniciar sesión, dos dispositivos.

Pruebas: `tests/gemas.test.js` (15) y `node tests/db/gemas-transaccional.check.mjs` (40).

Seguridad (revisión final):
- Recompensas: solo 0, 5, 10 o 15 (regla vigente), clave `ronda-…` y máximo 60 por hora y usuario
  (límite anti-abuso; las que lo superen quedan pendientes y se reintentan). **Riesgo pendiente:** el
  servidor no puede comprobar que la ronda existió; un cliente modificado podría pedir hasta 900 gemas
  por hora. Corrección completa propuesta: un ticket de ronda emitido por el servidor al empezar y
  canjeable una vez al terminar (cambio mayor; no bloquea el cierre).
- Compras: bloqueo `FOR UPDATE` + `UPDATE … WHERE gemas >= precio` + `CHECK (gemas >= 0)`.
- Perfiles creados por la app empiezan en 0 gemas; la app no puede escribir el saldo ni los libros.
- Cliente: una compra fallida no se muestra como exitosa (sin migración se deshace si la cuenta no
  guarda el saldo); las recompensas sin confirmar se apartan por cuenta al cerrar sesión.
Riesgos: una app vieja en caché no sube recompensas tras la migración; al crear el perfil, la app
puede enviar un saldo inicial (no lo hace hoy: el cuestionario no envía gemas).
