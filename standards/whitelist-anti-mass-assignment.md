# Whitelist explícito de campos editables (Anti Mass-Assignment)

## Cuándo aplica
Cualquier operación UPDATE/PATCH que recibe un payload del cliente y lo usa
(total o parcialmente) para construir el patch que se persiste en DB.

## Criterio (obligatorio)
1. Nunca pasar el body crudo (`...body` o `req.body` completo) directo al
   `.update()` — siempre construir el patch a partir de una lista explícita de
   campos permitidos para esa operación puntual (por destructuring nombrado o
   por constante tipo `<RECURSO>_UPDATABLE_FIELDS`).
2. Campos de identidad/pertenencia (`org_id`, `club_id`, `user_id`, o
   equivalentes) nunca deben estar en la lista de editables vía este tipo de
   endpoint, salvo que sea explícitamente el propósito de la operación.
3. Un campo fuera de la whitelist se ignora en silencio (no rompe la
   request) — no es un patrón de rechazo con error, es de filtrado. Mantener
   esto consistente entre operaciones.
4. Si no queda ningún campo válido tras filtrar, responder con un código de
   error específico (ej. `NO_FIELDS`), no un update vacío silencioso.
5. Test obligatorio: enviar campos fuera de whitelist junto con los válidos,
   y verificar (capturando el patch real enviado a `.update()`, no solo el
   status code) que el resultado no contiene rastro de los campos no
   permitidos.

## Ejemplos de referencia
- `UPDATE_MY_PLAYER_PROFILE` — `.claude/evidence/T-20260828-103923/backend.md`
  (destructuring `{ firstName, lastName }`)
- `UPDATE_TOURNAMENT` — `.claude/evidence/T-20260825-113906/backend.md`
  (`TOURNAMENT_UPDATABLE_FIELDS`, excluye `org_id`)

## Excepciones conocidas
- Ninguna detectada todavía — si aparece un caso donde parezca necesario
  permitir campos de identidad vía update masivo, señalarlo (Modo Consultivo)
  antes de implementarlo.

## Historial
- Creado: 2026-09-01
- Aprobado por: David Carrasco
- Última revisión: 2026-09-01
