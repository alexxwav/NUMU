# NUMU · Motor adaptativo: qué ya funciona y lo mínimo que falta

Sin sistemas nuevos, exámenes ni pantallas: solo reglas sobre `lessonLevel.js`, `lessonRound.js`,
`recommendationService.js` y `store.lessonRounds`.

## Ya implementado (con pruebas)

| Necesidad | Regla | Dónde | Pruebas |
|---|---|---|---|
| Nivel inicial | R1–R3: diagnóstico 0–1 → N1, 2–3 → N2, 4–5 → N3 | `lessonLevel.js` | `lessonLevel` |
| Subir dificultad | R7: 3★ (0–1 errores) → sube un nivel | `levelAfterRound` | `lessonLevel`, `recorrido15` |
| Mantener | R8 (2★) y R9 (1★) conservan el nivel | `levelAfterRound` | ídem |
| Sin avance si se acaban las vidas | R10: 0★ académicas y no sube | `levelAfterRound`, `academicStarsFor` | `academicStars` |
| No repetir dentro de la ronda | 6 preguntas con firma semántica distinta | `selectLessonQuestions` | `lessonSelector`, `cobertura45` (43/45) |
| Ayuda al fallar | pista ofrecida al 2.º error del mismo ejercicio | `Game.jsx` | — |
| Reforzar donde falla (por lección) | C2 (1★ / R10 → reforzar), C3 (2★ → continuar), C11 | recomendador | `recommendations` |
| Conservar el mejor resultado | T2 = mejor de 3; `greatest` en BD; fusión por fecha | `store`, RPC | `lessonProgress20`, `progreso-20` |
| Siguiente lección coherente | C12 (siguiente del área), C10, C13 (otra área), C14, C16 (solo publicadas) | recomendador, `resolveContinueRoute` | `continuarAventura`, `recorridoIntegral` |

## Implementado en este bloque (`tests/motorAdaptativo.test.js`, 8 pruebas)

1. **R11 · Dificultad descendente** (`adaptiveLevelAfterRound`): dos rondas seguidas de la misma
   lección con ≤1★ (o vidas agotadas) bajan un nivel, nunca de 1. Una ronda con 2★ o 3★ rompe la racha.
   R7–R10 no cambian (se delegan en `levelAfterRound`). La mejor estrella (T2) no baja y no hay
   recompensas por bajar. El nivel bajado se guarda en la cuenta con `p_nivel`.
2. **No repetir entre rondas** (`selectLessonQuestions({ avoidSignatures })`): la ronda siguiente evita
   las firmas semánticas de la anterior; si no hay alternativas (Figuras N1 y Patrones N1: 6 distintas;
   Figuras N2–N3: 10) repite solo el mínimo inevitable y nunca bloquea la práctica.
3. **Refuerzo por errores** (`preferTypes`, `weakTypesFrom`): Game cuenta los errores por tipo de
   ejercicio (`semanticKey[0]`); la siguiente ronda de la misma lección pone primero hasta 2 preguntas
   de los tipos más fallados (`MAX_REINFORCED`), dentro del nivel, sin repetir y sin llenar la ronda.
   Las pistas no cambian.

La memoria (`lowStreak`, `lastSignatures`, `weakTypes`) vive en `store.lessonRounds` del dispositivo
y se conserva al combinar con la cuenta. Limitación: no viaja entre dispositivos (sin cambios de BD).

## Pendiente

- **Conteo N1–N2**: resuelto por Viviana (44f4061, integrado): N1 tiene 6 y N2 7 preguntas distintas
  (contar, elegir y emparejar grupos por cantidad, comparar grupos). Las 45 combinaciones usan el selector.
  `minimalRepeatRound` (modo `repeticion-minima`) queda solo como respaldo si un catálogo no trae ese banco.
