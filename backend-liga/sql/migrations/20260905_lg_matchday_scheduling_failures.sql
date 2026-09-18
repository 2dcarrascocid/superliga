-- ============================================================
-- Migration: lg_matchday_scheduling_failures
-- Descripción: Módulo "Programación de Fecha" (asignación automática
--              de cancha/horario por fecha). Esta tabla trackea qué
--              clubes sufrieron una "distribución fallida" (canchas
--              separadas en vez de continuas) en una fecha dada.
--
--              El conteo se hace a nivel de TEMPORADA (season_id), no
--              por torneo individual: una fecha de liga cruza varios
--              torneos a la vez (uno por categoría), y el club puede
--              tener series en más de uno de esos torneos jugando el
--              mismo día.
--
--              uq_scheduling_failures_season_club_date existe para que
--              reintentar la operación de guardar la programación de
--              la misma fecha sea idempotente vía upsert con
--              onConflict, sin duplicar el historial.
--
--              RLS: mismo criterio que 20260818_unify_rls_all_tables.sql
--              / 20260825_lg_tournament_clubs_and_fee.sql — el backend
--              habla con Supabase con una clave de rol 'anon', no
--              'service_role', por lo que las políticas son permisivas
--              para anon y authenticated; la autorización real la hace
--              el código de cada Specialist (assertOrgAccess() /
--              assertClubAccess()) antes de tocar la base.
--
-- Nota: idempotente. Se puede correr las veces que haga falta.
-- Fecha: 2026-09-05
-- ============================================================

CREATE TABLE IF NOT EXISTS lg_matchday_scheduling_failures (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  org_id       uuid        NOT NULL,
  season_id    uuid        NOT NULL,
  club_id      uuid        NOT NULL,
  match_date   date        NOT NULL,
  reason       text        NOT NULL DEFAULT 'SPLIT_VENUE',
  notes        text        NULL,
  created_by   uuid        NULL,
  created_at   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT lg_matchday_scheduling_failures_pkey PRIMARY KEY (id),
  CONSTRAINT lg_matchday_scheduling_failures_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES lg_orgs (id) ON DELETE CASCADE,
  CONSTRAINT lg_matchday_scheduling_failures_season_id_fkey
    FOREIGN KEY (season_id) REFERENCES lg_seasons (id) ON DELETE CASCADE,
  CONSTRAINT lg_matchday_scheduling_failures_club_id_fkey
    FOREIGN KEY (club_id) REFERENCES lg_clubs (id) ON DELETE CASCADE
);

ALTER TABLE lg_matchday_scheduling_failures DROP CONSTRAINT IF EXISTS lg_matchday_scheduling_failures_reason_check;
ALTER TABLE lg_matchday_scheduling_failures
  ADD CONSTRAINT lg_matchday_scheduling_failures_reason_check
  CHECK (reason IN ('SPLIT_VENUE', 'PARTIAL_CONTINUITY'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_scheduling_failures_season_club_date
  ON lg_matchday_scheduling_failures(season_id, club_id, match_date);

CREATE INDEX IF NOT EXISTS idx_scheduling_failures_season_club
  ON lg_matchday_scheduling_failures(season_id, club_id);

-- ── RLS — mismo criterio que 20260818_unify_rls_all_tables.sql /
--    20260825_lg_tournament_clubs_and_fee.sql: el backend habla con
--    Supabase con una clave de rol 'anon', no 'service_role'.
ALTER TABLE lg_matchday_scheduling_failures ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'lg_matchday_scheduling_failures' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON lg_matchday_scheduling_failures', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "lg_matchday_scheduling_failures_select" ON lg_matchday_scheduling_failures FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "lg_matchday_scheduling_failures_insert" ON lg_matchday_scheduling_failures FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "lg_matchday_scheduling_failures_update" ON lg_matchday_scheduling_failures FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "lg_matchday_scheduling_failures_delete" ON lg_matchday_scheduling_failures FOR DELETE TO anon, authenticated USING (true);

NOTIFY pgrst, 'reload schema';
