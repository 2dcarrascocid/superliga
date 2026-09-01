# Security Review — T-20260825-113906

**Timestamp:** 2026-08-25
**Rol:** security-reviewer
**Status:** approved (tras una ronda de fixes)

## Ronda 1 — status: blocked

1. **CRÍTICO**: `_createTournament`/`_updateTournament`/`_deleteTournament` (`tournaments_specialist.js:256-361`) sin ningún control de autorización — cualquier usuario autenticado podía editar/borrar torneos de cualquier organización, incluyendo `category_id: null` (bypass de `CATEGORY_MISMATCH`) o manipular `inscription_fee` para evadir el cobro obligatorio.
2. **ALTO**: `LIST_TOURNAMENT_CLUBS` (`tournaments_specialist.js:487-519`) sin `assertClubAccess`/`isOrgAdmin` — exponía `inscription_charge`/`inscription_status` (montos adeudados/pagados) de clubes de cualquier organización.
3. **MEDIO**: `_registerClub` (y preexistente en `_registerTeam`) no validaba `club.org_id === tournament.org_id` — permitía inscripción cross-organización, incluyendo el cobro de dinero.
4. **Menor**: `inscription_fee` sin validación declarativa en `request_validator.js` para `UPDATE_TOURNAMENT`.

## Fix aplicado por backend-dev
- `_createTournament`/`_updateTournament`/`_deleteTournament` ahora exigen `isOrgAdmin(userId, org_id, db)`; para UPDATE/DELETE el `org_id` se resuelve de la fila existente en DB, nunca del payload (`org_id` tampoco es un campo editable en `TOURNAMENT_UPDATABLE_FIELDS`).
- `_listTournamentClubs` resuelve `tournament.org_id` y filtra con `getAccessibleClubIds` (mismo patrón que `club_finance_specialist.js`) cuando el caller no es admin de esa organización; corte temprano si no hay clubes accesibles.
- `_registerClub` y `_registerTeam` comparan `club.org_id === tournament.org_id` → error `CLUB_ORG_MISMATCH`.
- `request_validator.js` agrega `inscription_fee` (number, min 0) a `UPDATE_TOURNAMENT`.
- 12 tests nuevos cubriendo específicamente los bypasses reportados.

## Ronda 2 — status: approved

Verificado por security-reviewer con lectura directa del código real (no solo el changelog) y ejecución propia de `npm test` en `backend-liga/` → **27/27 pass**. Confirmado:
- El chequeo de autorización se aplica antes de cualquier escritura en los 3 casos de CRUD de torneo.
- `getAccessibleClubIds` acota por la organización del torneo, no la del usuario — sin fuga cross-tenant.
- `CLUB_ORG_MISMATCH` colocado antes del insert en ambos puntos de inscripción.
- Sin fixes incompletos ni problemas nuevos introducidos.

## Veredicto final: **APPROVED**, sin findings pendientes.
