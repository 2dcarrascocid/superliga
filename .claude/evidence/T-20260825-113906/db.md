# DB — T-20260825-113906

**Timestamp:** 2026-08-25
**Rol:** db-architect
**Status:** done

## Migración creada
`backend-liga/sql/migrations/20260825_lg_tournament_clubs_and_fee.sql`

## Resumen de cambios

### 1. `lg_tournaments.inscription_fee`
- `ALTER TABLE lg_tournaments ADD COLUMN IF NOT EXISTS inscription_fee numeric(12,2) NOT NULL DEFAULT 0;`
- Default 0 para no romper filas existentes. La obligatoriedad de "costo > 0"
  al crear el torneo queda a cargo del backend en `CREATE_TOURNAMENT` (no se
  agregó `CHECK > 0` en DB).
- No se tocó `lg_season_cost_catalog`: sigue vigente tal cual, solo para
  `matchday_fee` (cobro FECHA, por temporada). `inscription_fee` de
  `lg_tournaments` es el que reemplaza, para el cobro INSCRIPCION, al valor
  único por temporada.

### 2. Nueva tabla `lg_tournament_clubs`
Gate previo a `lg_tournament_teams`: representa "club inscrito en un torneo"
(antes se inscribía la serie directo, sin paso de club).

Columnas:
- `id uuid PK default gen_random_uuid()`
- `tournament_id uuid NOT NULL FK -> lg_tournaments(id) ON DELETE CASCADE`
- `club_id uuid NOT NULL FK -> lg_clubs(id) ON DELETE CASCADE`
- `registered_by uuid NULL` (sin FK — mismo patrón que `lg_ledger_entries.recorded_by`)
- `created_at`, `updated_at timestamptz NOT NULL DEFAULT now()`
- `CONSTRAINT lg_tournament_clubs_unique UNIQUE (tournament_id, club_id)`

Índices: `idx_tournament_clubs_tournament_id`, `idx_tournament_clubs_club_id`.

Sin columna de estado: el pendiente/pagado se deriva del `lg_ledger_entries`
(categoría `INSCRIPCION`) asociado a `club_id + tournament_id`, mismo
criterio ya usado en el módulo de ledger (`computeEntryStatus` en runtime,
sin columna a sincronizar).

### 3. RLS
- `lg_tournament_clubs` con RLS habilitado.
- Políticas SELECT/INSERT/UPDATE/DELETE para `TO anon, authenticated USING (true)`.
- Confirmado el patrón real revisando `20260818_unify_rls_all_tables.sql` y
  `20260821_lg_ledger_and_cost_catalog.sql`: el backend habla con Supabase
  con una clave cuyo rol real es `anon`, no `authenticated` puro ni
  `service_role` — se replicó ese criterio (no el de `20260814_lg_tournaments.sql`,
  que quedó desactualizado con solo `authenticated`).

## Validación de integridad referencial
- `tournament_id` -> `lg_tournaments(id)` ON DELETE CASCADE (consistente con
  `lg_tournament_teams`).
- `club_id` -> `lg_clubs(id)` ON DELETE CASCADE (consistente con
  `lg_tournament_teams`).
- `UNIQUE (tournament_id, club_id)` evita doble inscripción del mismo club.
- No hay entorno local con conexión a Postgres/Supabase disponible en esta
  sesión (sin `psql`, sin credenciales en `.env` — solo `ejm.env` de
  ejemplo) para ejecutar la migración; se validó por revisión manual línea a
  línea contra el estilo y las FKs de las migraciones de referencia
  (`20260814_lg_tournaments.sql`, `20260821_lg_ledger_and_cost_catalog.sql`,
  `20260818_unify_rls_all_tables.sql`, `20260817_lg_club_series_add_fields.sql`
  para el patrón `ADD COLUMN IF NOT EXISTS`). Es idempotente: puede correrse
  varias veces sin error (`IF NOT EXISTS` / `DROP POLICY IF EXISTS` en todas
  las operaciones).

## Riesgos destructivos
Ninguno. No hay `DROP`, `TRUNCATE` ni `ALTER` que pierda datos. Todo es
aditivo (`ADD COLUMN` con default, `CREATE TABLE IF NOT EXISTS`).

## Fuera de alcance (no tocado)
- `lg_season_cost_catalog` — sin cambios.
- `lg_ledger_entries` — sin cambios (el backend-dev deberá generar el
  ledger entry INSCRIPCION al inscribir el club, usando el
  `inscription_fee` del torneo; eso es lógica de aplicación, no de schema).
- Ningún archivo de backend/frontend fue modificado.

## Coordinación pendiente (para el orchestrator)
El siguiente paso es backend-dev: agregar capacidades `REGISTER_CLUB` /
`UNREGISTER_CLUB` / `LIST_TOURNAMENT_CLUBS` en `tournaments_specialist.js`,
ajustar `_registerTeam` para exigir club ya inscrito en `lg_tournament_clubs`
+ validar `series.category_id === tournament.category_id`, y exigir
`inscriptionFee` en `CREATE_TOURNAMENT` — según lo documentado en
`.claude/evidence/T-20260825-113906/plan.md`.
