# Backend de NUMU (Supabase)

Scripts para un proyecto de Supabase **nuevo y exclusivo de NUMU**. No aplicar sobre otros proyectos.

## Archivos

| Archivo | Contenido |
|---|---|
| `migrations/20261029000001_schema.sql` | Tablas `profiles`, `courses`, `lessons`, `diagnostic_results`, `progress`; trigger de alta de perfil; RPC `record_lesson_result`. |
| `migrations/20261029000002_rls.sql` | RLS: cada estudiante solo accede a lo suyo; catálogo de solo lectura. |
| `migrations/20261029000003_grants.sql` | GRANT explícitos mínimos para `authenticated` (no depende de los permisos automáticos de Supabase). |
| `seed.sql` | Catálogo del MVP: 2 cursos y 4 lecciones, con las descripciones de Viviana compatibles con los generadores (idempotente, fuente única del catálogo). |

## Aplicar (cuando exista el proyecto)

1. En el SQL Editor del proyecto, ejecutar en orden: `20261029000001_schema.sql`, `20261029000002_rls.sql`, `20261029000003_grants.sql`, `seed.sql`.
   Con Supabase CLI: `supabase link` y `supabase db push`, luego ejecutar `seed.sql`.
2. Copiar `.env.example` como `.env.local` y poner la URL y la clave **publishable** (`sb_publishable_...`).
   Las claves `sb_secret_...` y `service_role` nunca van en el frontend ni en Git.
   Las claves `anon` heredadas dejan de funcionar a finales de 2026.
3. Authentication → Providers → Email: decidir con el equipo si se exige confirmar el correo.

## Pruebas (sin conectarse a ningún proyecto)

- `npm test`: servicios y módulos de integración con un cliente simulado.
- `npm run test:db`: aplica migraciones y seed en Postgres en memoria (PGlite) y verifica
  restricciones, RLS, GRANT y aislamiento entre dos estudiantes, con y sin los GRANT automáticos.
  No sustituye la prueba en el proyecto real de Supabase.

## Relación con el frontend

- `lessons.module_id` debe ser uno de los generadores de `src/state/questions.js`:
  `conteo`, `aritmetica`, `geometria`, `patrones`.
- Servicios en `src/services/` (`authService`, `profileService`, `progressService`).
- `progress.current_level` lo envía el frontend según la regla adaptativa (pendiente de definir).
- `src/data/subjects.js`: IDs canónicos, alias (`sumas` → `aritmetica`, `formas` → `geometria`) e intereses del diseño original.
- `src/services/onboardingService.js`: guarda el cuestionario inicial en `profiles` y `diagnostic_results`.
- `src/services/startRoute.js`: decide entre login, cuestionario inicial e inicio (rutas provisionales).
