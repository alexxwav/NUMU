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

## Lo mínimo que falta (propuesta, no implementado)

1. **Bajar dificultad (R11).** Hoy un alumno que falla siempre se queda en su nivel. Regla mínima:
   si la ronda anterior y la actual de la misma lección y nivel tienen ≤1★ (R9/R10), el nivel baja uno
   (mínimo N1). Datos ya disponibles: `lessonRounds[id].latestStars` y `level`. Cambio: un parámetro
   `previousStars` en `levelAfterRound` + guardarlo en `recordLessonRound`. Sin cambios de BD.
2. **No repetir entre rondas seguidas.** El selector evita repetidas dentro de una ronda, pero la
   siguiente puede traer las mismas. Cambio: guardar las firmas de la última ronda en
   `lessonRounds[id].lastSignatures` y que `selectLessonQuestions` prefiera las no vistas (si alcanza
   para 6; si no, completa con las vistas). Solo local.
3. **Reforzar el tipo de ejercicio fallado.** Hoy el refuerzo es por lección completa. Cambio: guardar
   los tipos (`semanticKey[0]`) con error de la última ronda y que el selector incluya hasta 2 de esos
   tipos primero, sin romper la regla de 6 distintas. Solo local.
4. **Cobertura de Conteo N1–N2** (4 y 5 cantidades distintas): decidir con Viviana la evidencia o
   ampliar el banco; hoy usan el flujo anterior y pueden repetir.

Orden sugerido: 1 → 2 → 3 (cada uno con su prueba en `tests/`), 4 depende de contenidos.
