-- ============================================================
-- Migration: series/tournament integrity and atomic lifecycle RPCs
-- Task: club-series-tournaments-20260901
-- Date: 2026-09-01
--
-- Changes:
--   1. Prevent deleting a series that is registered in a tournament.
--   2. Make club + series + inscription charge registration atomic/idempotent.
--   3. Make season closing and organization-series deactivation atomic.
--
-- Authorization model:
--   The application authenticates its own JWT and invokes these RPCs from the
--   trusted backend with SUPABASE_SERVICE_ROLE_KEY_LIGA.
--   These functions are deliberately SECURITY INVOKER (not DEFINER): they do
--   not elevate the caller. PUBLIC, anon and authenticated cannot execute them;
--   the backend must validate organization/club access before invoking either
--   write RPC as service_role.
-- ============================================================

BEGIN;

-- Fail explicitly if historical drift produced an orphan. The replacement FK
-- must never hide or silently repair referential-integrity problems.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.lg_tournament_teams tt
    LEFT JOIN public.lg_club_series cs ON cs.id = tt.series_id
    WHERE tt.series_id IS NOT NULL
      AND cs.id IS NULL
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'Cannot protect lg_tournament_teams.series_id: orphan rows exist';
  END IF;
END $$;

ALTER TABLE public.lg_tournament_teams
  DROP CONSTRAINT IF EXISTS lg_tournament_teams_series_id_fkey;

ALTER TABLE public.lg_tournament_teams
  ADD CONSTRAINT lg_tournament_teams_series_id_fkey
  FOREIGN KEY (series_id)
  REFERENCES public.lg_club_series (id)
  ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE public.lg_tournament_teams
  VALIDATE CONSTRAINT lg_tournament_teams_series_id_fkey;

-- One club-level inscription charge per tournament. Validate historical data
-- before adding the partial unique index so no existing row is discarded.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.lg_ledger_entries
    WHERE category = 'INSCRIPCION'
      AND series_id IS NULL
      AND tournament_id IS NOT NULL
    GROUP BY tournament_id, club_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'Cannot enforce inscription charge idempotency: duplicate club/tournament charges exist';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_lg_ledger_club_tournament_inscription
  ON public.lg_ledger_entries (tournament_id, club_id)
  WHERE category = 'INSCRIPCION'
    AND series_id IS NULL
    AND tournament_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_register_club_series_atomic(
  p_tournament_id uuid,
  p_series_id uuid,
  p_registered_by uuid DEFAULT NULL,
  p_due_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tournament public.lg_tournaments%ROWTYPE;
  v_series public.lg_club_series%ROWTYPE;
  v_club_org_id uuid;
  v_season_active boolean;
  v_tournament_club_id uuid;
  v_team_id uuid;
  v_ledger_id uuid;
BEGIN
  -- Serialize registrations in the same tournament, including concurrent
  -- retries. pg_advisory_xact_lock is released automatically on commit/rollback.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tournament_id::text, 0));

  SELECT * INTO v_tournament
  FROM public.lg_tournaments
  WHERE id = p_tournament_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TOURNAMENT_NOT_FOUND');
  END IF;

  IF v_tournament.status <> 'REGISTRATION' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TOURNAMENT_NOT_OPEN');
  END IF;

  IF v_tournament.season_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TOURNAMENT_WITHOUT_SEASON');
  END IF;

  SELECT active INTO v_season_active
  FROM public.lg_seasons
  WHERE id = v_tournament.season_id
    AND org_id = v_tournament.org_id;

  IF v_season_active IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SEASON_NOT_ACTIVE');
  END IF;

  SELECT * INTO v_series
  FROM public.lg_club_series
  WHERE id = p_series_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SERIES_NOT_FOUND');
  END IF;

  IF v_series.active IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SERIES_NOT_ACTIVE');
  END IF;

  SELECT org_id INTO v_club_org_id
  FROM public.lg_clubs
  WHERE id = v_series.club_id;

  IF v_club_org_id IS DISTINCT FROM v_tournament.org_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CLUB_ORG_MISMATCH');
  END IF;

  IF v_tournament.category_id IS NOT NULL
     AND v_series.category_id IS DISTINCT FROM v_tournament.category_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CATEGORY_MISMATCH');
  END IF;

  INSERT INTO public.lg_tournament_clubs (
    tournament_id, club_id, registered_by
  ) VALUES (
    p_tournament_id, v_series.club_id, p_registered_by
  )
  ON CONFLICT (tournament_id, club_id) DO UPDATE
    SET updated_at = public.lg_tournament_clubs.updated_at
  RETURNING id INTO v_tournament_club_id;

  INSERT INTO public.lg_ledger_entries (
    org_id, club_id, series_id, tournament_id, category, direction,
    amount, description, due_date, recorded_by
  ) VALUES (
    v_tournament.org_id, v_series.club_id, NULL, p_tournament_id,
    'INSCRIPCION', 'INGRESO', v_tournament.inscription_fee,
    'Inscripcion a torneo: ' || v_tournament.name, p_due_date, p_registered_by
  )
  ON CONFLICT (tournament_id, club_id)
    WHERE category = 'INSCRIPCION'
      AND series_id IS NULL
      AND tournament_id IS NOT NULL
  DO UPDATE SET updated_at = public.lg_ledger_entries.updated_at
  RETURNING id INTO v_ledger_id;

  INSERT INTO public.lg_tournament_teams (
    tournament_id, series_id, status
  ) VALUES (
    p_tournament_id, p_series_id, 'ACTIVE'
  )
  ON CONFLICT (tournament_id, series_id) DO UPDATE
    SET updated_at = public.lg_tournament_teams.updated_at
  RETURNING id INTO v_team_id;

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'SERIES_REGISTERED',
    'tournamentClubId', v_tournament_club_id,
    'teamId', v_team_id,
    'ledgerEntryId', v_ledger_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_close_season_atomic(
  p_season_id uuid,
  p_org_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_closed_count integer;
  v_deactivated_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_season_id::text, 0));

  UPDATE public.lg_seasons
  SET active = false,
      updated_at = now()
  WHERE id = p_season_id
    AND org_id = p_org_id
    AND active = true;
  GET DIAGNOSTICS v_closed_count = ROW_COUNT;

  IF v_closed_count = 0 AND NOT EXISTS (
    SELECT 1 FROM public.lg_seasons
    WHERE id = p_season_id AND org_id = p_org_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SEASON_NOT_FOUND');
  END IF;

  UPDATE public.lg_club_series cs
  SET active = false,
      updated_at = now()
  FROM public.lg_clubs c
  WHERE c.id = cs.club_id
    AND c.org_id = p_org_id
    AND cs.active = true;
  GET DIAGNOSTICS v_deactivated_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'code', CASE WHEN v_closed_count = 1 THEN 'SEASON_CLOSED' ELSE 'SEASON_ALREADY_CLOSED' END,
    'seasonId', p_season_id,
    'deactivatedSeries', v_deactivated_count
  );
END;
$$;

-- Functions are not public API. Only the trusted backend service role can
-- execute them. Authorization over the application's custom JWT remains in
-- Node.js and must happen before the RPC call.
REVOKE ALL ON FUNCTION public.fn_register_club_series_atomic(uuid, uuid, uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_close_season_atomic(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_register_club_series_atomic(uuid, uuid, uuid, date) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_close_season_atomic(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_register_club_series_atomic(uuid, uuid, uuid, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_close_season_atomic(uuid, uuid) TO service_role;

-- Permission gate: abort the migration if either write RPC is exposed to a
-- public API role or unavailable to the trusted backend role.
DO $$
DECLARE
  v_register regprocedure := 'public.fn_register_club_series_atomic(uuid,uuid,uuid,date)'::regprocedure;
  v_close regprocedure := 'public.fn_close_season_atomic(uuid,uuid)'::regprocedure;
BEGIN
  IF EXISTS (
       SELECT 1
       FROM information_schema.routine_privileges
       WHERE specific_schema = 'public'
         AND routine_name IN ('fn_register_club_series_atomic', 'fn_close_season_atomic')
         AND grantee = 'PUBLIC'
         AND privilege_type = 'EXECUTE'
     )
     OR has_function_privilege('anon', v_register, 'EXECUTE')
     OR has_function_privilege('authenticated', v_register, 'EXECUTE')
     OR has_function_privilege('anon', v_close, 'EXECUTE')
     OR has_function_privilege('authenticated', v_close, 'EXECUTE') THEN
    RAISE EXCEPTION 'Write RPC permission check failed: a public API role can execute it';
  END IF;

  IF NOT has_function_privilege('service_role', v_register, 'EXECUTE')
     OR NOT has_function_privilege('service_role', v_close, 'EXECUTE') THEN
    RAISE EXCEPTION 'Write RPC permission check failed: service_role lacks EXECUTE';
  END IF;
END $$;

COMMENT ON FUNCTION public.fn_register_club_series_atomic(uuid, uuid, uuid, date) IS
  'Service-role-only RPC. Atomically and idempotently registers club, club-level fee and series. Backend must authorize club access first.';
COMMENT ON FUNCTION public.fn_close_season_atomic(uuid, uuid) IS
  'Service-role-only RPC. Atomically closes a season and deactivates all series in its organization. Backend must authorize org admin first.';

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ============================================================
-- Rollback (manual, intentionally not executed with this migration)
-- ============================================================
-- BEGIN;
-- REVOKE ALL ON FUNCTION public.fn_close_season_atomic(uuid, uuid) FROM service_role;
-- REVOKE ALL ON FUNCTION public.fn_register_club_series_atomic(uuid, uuid, uuid, date) FROM service_role;
-- DROP FUNCTION IF EXISTS public.fn_close_season_atomic(uuid, uuid);
-- DROP FUNCTION IF EXISTS public.fn_register_club_series_atomic(uuid, uuid, uuid, date);
-- DROP INDEX IF EXISTS public.uq_lg_ledger_club_tournament_inscription;
-- ALTER TABLE public.lg_tournament_teams
--   DROP CONSTRAINT IF EXISTS lg_tournament_teams_series_id_fkey;
-- ALTER TABLE public.lg_tournament_teams
--   ADD CONSTRAINT lg_tournament_teams_series_id_fkey
--   FOREIGN KEY (series_id) REFERENCES public.lg_club_series(id)
--   ON DELETE CASCADE NOT VALID;
-- ALTER TABLE public.lg_tournament_teams
--   VALIDATE CONSTRAINT lg_tournament_teams_series_id_fkey;
-- NOTIFY pgrst, 'reload schema';
-- COMMIT;
