# Guarda de verificación de identidad/pertenencia cruzada (Cross-Identity Mismatch Guard)

## Cuándo aplica
Cualquier endpoint donde una acción vincula dos entidades que deberían pertenecer
al mismo dueño/contexto, pero cuya relación no está garantizada solo por la
autenticación (JWT) ni por el chequeo de acceso base existente (ej.
`assertClubAccess`). Señal típica: "esto vincula A con B, pero nada obliga a que
A y B correspondan entre sí".

## Criterio (obligatorio)
1. Identificar los dos identificadores que deben coincidir (ej. organización del
   club vs. organización del torneo; email de la invitación vs. email de la
   cuenta OAuth que acepta).
2. Comparar explícitamente ambos valores **antes** de ejecutar la acción — no
   confiar en que el chequeo de acceso genérico ya lo cubre.
3. Rechazar con un código de error específico y nombrado en `SCREAMING_SNAKE_CASE`
   terminado en `_MISMATCH` (no un `FORBIDDEN` genérico) — así el frontend y los
   logs distinguen esta causa puntual.
4. Agregar test explícito para el caso de mismatch (no alcanza con testear el
   camino feliz).
5. Documentar el error nuevo en el contrato de API del endpoint.

## Ejemplos de referencia
- `CLUB_ORG_MISMATCH` — `.claude/evidence/T-20260825-113906/backend.md`
  (club vs. organización del torneo)
- `EMAIL_MISMATCH` — `.claude/evidence/T-20260828-103923/backend.md`
  (email de invitación vs. email de cuenta Google que acepta)

## Excepciones conocidas
- Si el chequeo de acceso base (`assertClubAccess` o equivalente) ya cubre
  matemáticamente la relación completa entre las dos entidades, no hace falta
  duplicar — pero hay que confirmarlo leyendo su implementación, no asumirlo.

## Historial
- Creado: 2026-09-01
- Aprobado por: David Carrasco
- Última revisión: 2026-09-01
