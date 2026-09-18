-- ============================================================
-- Migration: lg_tournaments_max_teams
-- Descripción: Cantidad de equipos/series que participan del torneo,
--              obligatoria al crear un torneo (CREATE_TOURNAMENT) desde
--              ahora en adelante — se valida en la app (tournaments_specialist.js),
--              no acá, para no romper los torneos ya creados sin este dato.
--
-- Nota: idempotente. Nullable a nivel de columna (los torneos existentes
-- quedan con max_teams = NULL, sin backfill inventado) — el CHECK solo
-- exige >= 2 cuando el valor está presente.
-- Fecha: 2026-09-05
-- ============================================================

ALTER TABLE lg_tournaments ADD COLUMN IF NOT EXISTS max_teams smallint NULL;

ALTER TABLE lg_tournaments DROP CONSTRAINT IF EXISTS lg_tournaments_max_teams_check;
ALTER TABLE lg_tournaments
  ADD CONSTRAINT lg_tournaments_max_teams_check CHECK (max_teams IS NULL OR max_teams >= 2);

NOTIFY pgrst, 'reload schema';
