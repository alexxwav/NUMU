# Backend de NUMU (Supabase)

Scripts para un proyecto de Supabase **nuevo y exclusivo de NUMU**. No aplicar sobre otros proyectos.

## Archivos

| Archivo | Contenido |
|---|---|
| `migrations/20261029000001_schema.sql` | Tablas `profiles`, `courses`, `lessons`, `diagnostic_results`, `progress`; trigger de alta de perfil; RPC `record_lesson_result`. |
| `migrations/20261029000002_rls.sql` | RLS: cada estudiante solo accede a lo suyo; catálogo de solo lectura. |
| `seed.sql` | Catálogo provisional: 2 cursos y 4 lecciones (idempotente). |

## Aplicar (cuando exista el proyecto)

1. En el SQL Editor del proyecto, ejecutar en orden: `20261029000001_schema.sql`, `20261029000002_rls.sql`, `seed.sql`.
   Con Supabase CLI: `supabase link` y `supabase db push`, luego ejecutar `seed.sql`.
2. Copiar `.env.example` como `.env.local` y poner la URL y la clave **pública** (anon/publishable).
   La clave `service_role` nunca va en el frontend ni en Git.
3. Authentication → Providers → Email: decidir con el equipo si se exige confirmar el correo.

## Relación con el frontend

- `lessons.module_id` debe ser uno de los generadores de `src/state/questions.js`:
  `conteo`, `aritmetica`, `geometria`, `patrones`.
- Servicios en `src/services/` (`authService`, `profileService`, `progressService`).
- `progress.current_level` lo envía el frontend según la regla adaptativa (pendiente de definir).
