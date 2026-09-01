# Plan — T-20260825-113906

**Timestamp:** 2026-08-25
**Rol:** agent_orchestrator (ejecutado manualmente por el asistente principal — la
skill `agent_orchestrator` no está registrada como skill invocable en esta
sesión; se siguió su SKILL.md al pie de la letra)

## Objetivo
Inscripción de clubes/equipos a torneos, con validación de categoría/serie,
costo de inscripción obligatorio por torneo, y estado pendiente/pagado.

## Estado previo (confirmado por Explore + lectura directa de código)
El dominio de torneos/clubes/series/temporadas/ledger YA existe end-to-end
(migraciones del 2026-08-14 al 2026-08-21). Se reutiliza en vez de rehacerse:
- `lg_tournaments`, `lg_club_series`, `lg_categories`, `lg_seasons`, `lg_clubs`.
- `lib/club_access.js` (assertClubAccess / isOrgAdmin) → roles ADMIN (org) y
  ADMIN_CLUB ya resueltos, reutilizar tal cual.
- `lib/ledger.js` → estado PAGADO/PARCIAL/VENCIDO/PENDIENTE calculado en
  runtime desde `paid_amount`/`due_date`, sin columna de estado. Reutilizar
  el mismo criterio para el nuevo flujo, no agregar columna de estado propia.
- `_registerTeam` en `tournaments_specialist.js` ya valida:
  torneo en `status=REGISTRATION`, temporada activa si el que inscribe no es
  admin de org, y acceso al club vía `assertClubAccess`.

## Gaps confirmados contra el requerimiento del usuario
1. **Sin validación de categoría/serie**: `_registerTeam` no compara
   `lg_club_series.category_id` vs `lg_tournaments.category_id`.
2. **Costo de inscripción es por temporada** (`lg_season_cost_catalog`,
   UNIQUE por `season_id`), no obligatorio al crear el torneo.
3. **Sin paso de "club inscrito al torneo"** como prerequisito: hoy se
   inscribe una serie directo a `lg_tournament_teams`, sin gate de club.

## Decisión de diseño (tomada por el orchestrator, documentada para trazabilidad)
- Se agrega `inscription_fee` NOT NULL a `lg_tournaments` (obligatorio en
  CREATE_TOURNAMENT). Reemplaza, para el cobro de INSCRIPCION, al valor de
  `lg_season_cost_catalog` — ese catálogo queda vigente solo para
  `matchday_fee` (cobro FECHA, que sigue siendo por temporada).
- Nueva tabla `lg_tournament_clubs` (club inscrito a un torneo): gate previo
  a `lg_tournament_teams`. UNIQUE(tournament_id, club_id).
- El cobro INSCRIPCION se dispara UNA vez, al inscribir el CLUB (no la
  serie) — usa `tournament.inscription_fee`. `_registerTeam` (inscripción de
  serie) deja de generar su propio cobro INSCRIPCION; en su lugar exige que
  el club ya esté inscrito (`lg_tournament_clubs`) y valida
  `series.category_id === tournament.category_id` (error `CATEGORY_MISMATCH`
  si no matchea).
- El estado pendiente/pagado del club se deriva del ledger entry INSCRIPCION
  de ese club+torneo (mismo `computeEntryStatus` ya existente) — sin columna
  de estado nueva, consistente con el patrón ya usado en `lg_ledger_entries`.

## Capas y orden
1. **DB** (db-architect): migración con `lg_tournaments.inscription_fee` +
   tabla `lg_tournament_clubs`.
2. **Backend** (backend-dev): capacidades `REGISTER_CLUB` / `UNREGISTER_CLUB`
   / `LIST_TOURNAMENT_CLUBS` en `tournaments_specialist.js`; ajustar
   `_registerTeam` (gate de club + validación de categoría, sin cobro propio);
   exigir `inscriptionFee` en `CREATE_TOURNAMENT`.
3. **Frontend** (frontend-dev): UI para inscribir club a torneo (admin org +
   admin club), filtrar el listado de "agregar equipo" solo a clubes ya
   inscritos y series de la categoría del torneo, campo de costo obligatorio
   al crear torneo, e indicador de estado pendiente/pagado por club
   (reutilizando el flujo de pago ya existente en `LedgerView.vue`).
4. **Validación**: security-reviewer (permisos/roles, RLS de la tabla nueva)
   y qa-tester (flujo funcional end-to-end).
5. **Evidencia**: este archivo + outputs de cada Specialist + resultado de
   validación.

## Cierre

**Status final: done.** DB → backend → frontend implementados. QA aprobó los
6 puntos del requerimiento original (`qa-report.md`). Security-reviewer
bloqueó la primera ronda con 3 hallazgos (crítico: CRUD de torneo sin
autorización; alto: fuga de datos financieros cross-tenant en
`LIST_TOURNAMENT_CLUBS`; medio: inscripción cross-organización) — backend-dev
los corrigió con 12 tests nuevos, y security-reviewer aprobó la segunda
ronda verificando el código y los tests de forma independiente
(`security-review.md`). Backend: 27/27 tests pasando. Frontend: build de
Vite exitoso. Sin e2e/smoke test en vivo (sin credenciales de Supabase en
el sandbox) — recomendado antes de producción.
