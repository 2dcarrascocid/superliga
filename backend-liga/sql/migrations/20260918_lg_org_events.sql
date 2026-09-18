-- ============================================================
-- Migration: lg_org_events
-- Descripción: Módulo de "Eventos de organización" sobre el módulo
--              financiero existente (20260821_lg_ledger_and_cost_catalog.sql,
--              20260905_lg_club_events.sql). A diferencia de lg_club_events
--              (evento de un club, repartido entre jugadores), un evento de
--              organización lo crea el ADMIN de la organización y se cobra
--              POR CLUB (no por jugador) a todos los clubes participantes
--              de una temporada — ej: cuota social, actividad deportiva
--              extraordinaria.
--
--   - lg_org_events: el evento en sí. cost = monto unitario por club.
--     direction sigue el mismo criterio que lg_ledger_entries.direction
--     (INGRESO | EGRESO). status ABIERTO -> CERRADO es una transición de
--     un solo sentido (el cierre traspasa los cargos al libro y bloquea
--     nuevas ediciones — ver club_finance_specialist.js::_closeOrgEvent).
--
--   - lg_org_event_charges: una fila por club dentro del evento, con su
--     monto (copiado de lg_org_events.cost al crear el evento). Soporta
--     exención (is_exempt/exempt_reason) y medio de pago (payment_method).
--     paid_amount/paid_at replican el mismo criterio sin-columna-de-estado
--     que ya usa lg_ledger_entries/lg_club_event_charges.
--
--   - lg_ledger_entries.org_event_id (nueva columna, nullable): al cerrar
--     el evento, cada charge no exento se traspasa como UNA fila en
--     lg_ledger_entries (category='EVENTO_ORG') para la cuadratura de
--     ingreso/egreso de la organización. Paralela a la columna event_id
--     que ya existe para lg_club_events.
--
-- Nota: es idempotente. Se puede correr las veces que haga falta.
-- Fecha: 2026-09-18
-- ============================================================

CREATE TABLE IF NOT EXISTS lg_org_events (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL,
  season_id   uuid        NOT NULL,
  name        text        NOT NULL,
  description text        NULL,
  event_type  text        NOT NULL DEFAULT 'OTRO',
  cost        numeric(12,2) NOT NULL DEFAULT 0,
  direction   text        NOT NULL DEFAULT 'INGRESO',
  start_date  date        NULL,
  end_date    date        NULL,
  status      text        NOT NULL DEFAULT 'ABIERTO',
  created_by  uuid        NULL,
  closed_by   uuid        NULL,
  closed_at   timestamp with time zone NULL,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  updated_at  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT lg_org_events_pkey PRIMARY KEY (id),
  CONSTRAINT lg_org_events_org_id_fkey FOREIGN KEY (org_id) REFERENCES lg_orgs (id) ON DELETE CASCADE,
  CONSTRAINT lg_org_events_season_id_fkey FOREIGN KEY (season_id) REFERENCES lg_seasons (id) ON DELETE CASCADE,
  CONSTRAINT lg_org_events_event_type_check CHECK (event_type IN ('SOCIAL', 'DEPORTIVO', 'ESPECIAL', 'OTRO')),
  CONSTRAINT lg_org_events_direction_check CHECK (direction IN ('INGRESO', 'EGRESO')),
  CONSTRAINT lg_org_events_status_check CHECK (status IN ('ABIERTO', 'CERRADO'))
);

CREATE TABLE IF NOT EXISTS lg_org_event_charges (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  org_event_id   uuid        NOT NULL,
  club_id        uuid        NOT NULL,
  amount         numeric(12,2) NOT NULL DEFAULT 0,
  is_exempt      boolean     NOT NULL DEFAULT false,
  exempt_reason  text        NULL,
  payment_method text        NULL,
  paid_amount    numeric(12,2) NOT NULL DEFAULT 0,
  paid_at        timestamp with time zone NULL,
  recorded_by    uuid        NULL,
  created_at     timestamp with time zone NOT NULL DEFAULT now(),
  updated_at     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT lg_org_event_charges_pkey PRIMARY KEY (id),
  CONSTRAINT lg_org_event_charges_org_event_id_fkey FOREIGN KEY (org_event_id) REFERENCES lg_org_events (id) ON DELETE CASCADE,
  CONSTRAINT lg_org_event_charges_club_id_fkey FOREIGN KEY (club_id) REFERENCES lg_clubs (id) ON DELETE CASCADE,
  CONSTRAINT lg_org_event_charges_org_event_id_club_id_key UNIQUE (org_event_id, club_id),
  CONSTRAINT lg_org_event_charges_payment_method_check CHECK (payment_method IS NULL OR payment_method IN ('TRANSFERENCIA', 'EFECTIVO', 'TARJETA'))
);

-- lg_ledger_entries.org_event_id: link opcional hacia el evento de
-- organización que originó la fila (traspaso al cerrar el evento).
-- Nullable porque el resto de categorías no vienen de un evento de org.
ALTER TABLE lg_ledger_entries ADD COLUMN IF NOT EXISTS org_event_id uuid NULL;

ALTER TABLE lg_ledger_entries DROP CONSTRAINT IF EXISTS lg_ledger_entries_org_event_id_fkey;
ALTER TABLE lg_ledger_entries
  ADD CONSTRAINT lg_ledger_entries_org_event_id_fkey FOREIGN KEY (org_event_id) REFERENCES lg_org_events (id) ON DELETE SET NULL;

-- 'EVENTO_ORG' se agrega al CHECK existente de category para distinguir
-- el traspaso de un evento de organización del resto de categorías.
ALTER TABLE lg_ledger_entries DROP CONSTRAINT IF EXISTS lg_ledger_entries_category_check;
ALTER TABLE lg_ledger_entries
  ADD CONSTRAINT lg_ledger_entries_category_check CHECK (category IN ('INSCRIPCION', 'FECHA', 'MULTA', 'OTRO', 'VALOR', 'EVENTO', 'EVENTO_ORG'));

CREATE INDEX IF NOT EXISTS idx_lg_org_events_org_id            ON lg_org_events(org_id);
CREATE INDEX IF NOT EXISTS idx_lg_org_events_season_id         ON lg_org_events(season_id);
CREATE INDEX IF NOT EXISTS idx_lg_org_event_charges_event_id   ON lg_org_event_charges(org_event_id);
CREATE INDEX IF NOT EXISTS idx_lg_org_event_charges_club_id    ON lg_org_event_charges(club_id);
CREATE INDEX IF NOT EXISTS idx_lg_ledger_entries_org_event_id  ON lg_ledger_entries(org_event_id);

-- ── RLS — mismo criterio que 20260905_lg_club_events.sql: el backend
--    habla con Supabase con una clave de rol 'anon', no 'service_role';
--    la autorización real la hace club_finance_specialist.js (isOrgAdmin)
--    antes de tocar la base.
ALTER TABLE lg_org_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE lg_org_event_charges ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'lg_org_events' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON lg_org_events', pol.policyname);
  END LOOP;
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'lg_org_event_charges' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON lg_org_event_charges', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "lg_org_events_select" ON lg_org_events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "lg_org_events_insert" ON lg_org_events FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "lg_org_events_update" ON lg_org_events FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "lg_org_events_delete" ON lg_org_events FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "lg_org_event_charges_select" ON lg_org_event_charges FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "lg_org_event_charges_insert" ON lg_org_event_charges FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "lg_org_event_charges_update" ON lg_org_event_charges FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "lg_org_event_charges_delete" ON lg_org_event_charges FOR DELETE TO anon, authenticated USING (true);

NOTIFY pgrst, 'reload schema';
