-- ============================================================
-- Migration: lg_penalty_catalog
-- Descripción: Módulo "Castigos" (Parámetros → Castigos). Catálogo de
--              multas/sanciones configurable por el admin de organización:
--              nombre, código, descripción, monto a pagar y regla de
--              negocio (texto libre). Minimalista a propósito — sin
--              status/applies_to, sólo el flag `active` para dar de baja
--              un castigo sin borrarlo.
--
--   - lg_penalty_catalog: un castigo por (org_id, code) — el código debe
--     ser único dentro de la organización, igual criterio que
--     lg_season_cost_catalog (20260821_lg_ledger_and_cost_catalog.sql).
--
--   - lg_match_events.penalty_id (nueva columna, nullable): al registrar
--     una tarjeta/amonestación en la Planilla de Control de Partido se
--     puede asociar uno de estos castigos. lg_match_events está definida
--     en 20260814_lg_tournaments.sql.
--
--   - lg_ledger_entries.match_id (nueva columna, nullable): link opcional
--     hacia el partido que originó la fila, para trazar qué cobro del
--     libro vino de un castigo aplicado en un partido específico. Mismo
--     patrón que la columna org_event_id agregada a esta misma tabla en
--     20260918_lg_org_events.sql. La categoría 'MULTA' ya existe en el
--     CHECK de lg_ledger_entries.category — no se toca.
--
-- Nota: es idempotente. Se puede correr las veces que haga falta.
-- Fecha: 2026-09-18
-- ============================================================

CREATE TABLE IF NOT EXISTS lg_penalty_catalog (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  org_id        uuid        NOT NULL,
  name          text        NOT NULL,
  code          text        NOT NULL,
  description   text        NULL,
  amount        numeric(12,2) NOT NULL DEFAULT 0,
  business_rule text        NULL,
  active        boolean     NOT NULL DEFAULT true,
  created_at    timestamp with time zone NOT NULL DEFAULT now(),
  updated_at    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT lg_penalty_catalog_pkey PRIMARY KEY (id),
  CONSTRAINT lg_penalty_catalog_org_id_fkey FOREIGN KEY (org_id) REFERENCES lg_orgs (id) ON DELETE CASCADE,
  CONSTRAINT lg_penalty_catalog_org_id_code_key UNIQUE (org_id, code)
);

CREATE INDEX IF NOT EXISTS idx_lg_penalty_catalog_org_id ON lg_penalty_catalog(org_id);

-- lg_match_events.penalty_id: link opcional hacia el castigo del catálogo
-- asociado a una tarjeta/amonestación. Nullable porque no todo evento de
-- partido (GOAL, OWN_GOAL, etc.) tiene un castigo asociado.
ALTER TABLE lg_match_events ADD COLUMN IF NOT EXISTS penalty_id uuid NULL;

ALTER TABLE lg_match_events DROP CONSTRAINT IF EXISTS lg_match_events_penalty_id_fkey;
ALTER TABLE lg_match_events
  ADD CONSTRAINT lg_match_events_penalty_id_fkey FOREIGN KEY (penalty_id) REFERENCES lg_penalty_catalog (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lg_match_events_penalty_id ON lg_match_events(penalty_id);

-- lg_ledger_entries.match_id: link opcional hacia el partido que originó
-- la fila (cobro de un castigo aplicado en un partido específico). Mismo
-- criterio que org_event_id agregada en 20260918_lg_org_events.sql.
ALTER TABLE lg_ledger_entries ADD COLUMN IF NOT EXISTS match_id uuid NULL;

ALTER TABLE lg_ledger_entries DROP CONSTRAINT IF EXISTS lg_ledger_entries_match_id_fkey;
ALTER TABLE lg_ledger_entries
  ADD CONSTRAINT lg_ledger_entries_match_id_fkey FOREIGN KEY (match_id) REFERENCES lg_matches (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lg_ledger_entries_match_id ON lg_ledger_entries(match_id);

-- ── RLS — mismo criterio que 20260821_lg_ledger_and_cost_catalog.sql /
--    20260918_lg_org_events.sql: el backend habla con Supabase con una
--    clave de rol 'anon', no 'service_role'; la autorización real la hace
--    el specialist (isOrgAdmin) antes de tocar la base. lg_match_events y
--    lg_ledger_entries ya tienen RLS habilitado por migraciones previas,
--    no hace falta tocarlo acá.
ALTER TABLE lg_penalty_catalog ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'lg_penalty_catalog' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON lg_penalty_catalog', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "lg_penalty_catalog_select" ON lg_penalty_catalog FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "lg_penalty_catalog_insert" ON lg_penalty_catalog FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "lg_penalty_catalog_update" ON lg_penalty_catalog FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "lg_penalty_catalog_delete" ON lg_penalty_catalog FOR DELETE TO anon, authenticated USING (true);

NOTIFY pgrst, 'reload schema';
