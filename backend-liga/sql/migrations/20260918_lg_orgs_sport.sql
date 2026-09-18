-- ============================================================
-- Migration: lg_orgs_sport
-- Descripción: Panel de configuración de administrador → selector de
--              "Deporte de la liga". Cada organización (lg_orgs) pasa a
--              declarar un único deporte de referencia contra el catálogo
--              global lg_sports (id, name, team_sport — sembrado en
--              routes/auth/bootstrap.js con Futbol/Basketball/Tennis/
--              Volleyball), mismo criterio de FK ya usado para conectar
--              lg_categories.sport_id → lg_sports en
--              20260821_lg_categories_sport_gender_serie.sql.
--
--              ON DELETE SET NULL: si en el futuro se depura el catálogo
--              de lg_sports, una organización no debe perder su fila ni
--              quedar bloqueada por la FK — simplemente vuelve a quedar
--              sin deporte configurado (sport_id NULL) hasta que un admin
--              lo reasigne desde el panel.
--
--              RLS: no se toca. lg_orgs ya quedó cubierta por el criterio
--              unificado de 20260818_unify_rls_all_tables.sql (RLS
--              habilitada + políticas permisivas para anon/authenticated;
--              la autorización real la hace el código de cada Specialist).
--              Agregar una columna nullable a una tabla existente no
--              requiere tocar sus políticas.
--
-- Nota: idempotente. Se puede correr las veces que haga falta.
-- Fecha: 2026-09-18
-- ============================================================

ALTER TABLE lg_orgs
  ADD COLUMN IF NOT EXISTS sport_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'lg_orgs_sport_id_fkey'
  ) THEN
    ALTER TABLE lg_orgs
      ADD CONSTRAINT lg_orgs_sport_id_fkey
      FOREIGN KEY (sport_id) REFERENCES lg_sports (id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_lg_orgs_sport_id ON lg_orgs (sport_id);

NOTIFY pgrst, 'reload schema';
