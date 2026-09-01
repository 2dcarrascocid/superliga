# QA Report — T-20260828-103923

**Timestamp:** 2026-08-28
**Rol:** qa-tester
**Status:** approved (con una salvedad documentada, no bloqueante)

## Resultados de tests
- `backend-liga` (Node 20): `npm test` → **46/46 pass** (13 tests nuevos del rol Jugador + 3 de mapeo de status HTTP), reproducido de forma independiente.
- `frontend-liga` (Node 20): `npm run build` → build exitoso, sin errores.

## Checklist contra el requerimiento original

1. **Admin agrega correo → invitación por Gmail** — ✅ `_invitePlayer` (players_specialist.js) valida `assertClubAccess`; `_acceptPlayerInvite` (auth_specialist.js) solo acepta vía Google; `EMAIL_MISMATCH` evita que otra cuenta acepte la invitación de otro. UI: `PlayerDetail.vue`.
2. **Jugador edita nombre/apellido, nunca el RUT** — ✅ verificado en 3 capas: `handler.js` (destructuring explícito del body), `players_specialist.js::_updateMyPlayerProfile` (whitelist por firma), y un test explícito que manda `rut`/`email`/`club_id` junto al payload y confirma que el `.update()` real solo aplica `first_name`/`last_name`. UI: input de RUT deshabilitado con aviso.
3. **Jugador ve solo su propia serie** — ✅ `_getMyPlayerProfile` resuelve el roster ACTIVE del propio jugador y trae solo esa serie puntual, sin listado. `PlayerProfile.vue` no reutiliza ningún componente de listado de series.
4. **Posiciones/goleadores/fairplay del torneo donde participa** — ✅ en UX (enlaces directos solo a los torneos de su propia serie, sin buscador libre) — **con salvedad**: `GET_STANDINGS`/`GET_TOP_SCORERS`/`GET_FAIRPLAY_RANKING` no validan server-side que el `tournamentId` pertenezca al torneo del usuario — cualquier autenticado puede acceder a esos datos de cualquier torneo editando la URL. Esto **ya existía antes de esta tarea** (afecta a todos los roles) y quedó explícitamente fuera de alcance en `plan.md`. No es una regresión introducida por el rol Jugador.

## Veredicto: **APPROVED**, con la salvedad del punto 4 registrada como deuda técnica pre-existente.
