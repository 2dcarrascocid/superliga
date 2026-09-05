-- ============================================================
-- Migration: lg_club_events
-- Descripción: Módulo de "Eventos" sobre el módulo financiero existente
--              (20260821_lg_ledger_and_cost_catalog.sql). Un evento es
--              algo que crea un club (o el admin de organización) y que
--              se reparte entre jugadores con un monto individual cada
--              uno. Ejemplos reales: fecha de partido (arriendo de
--              cancha dividido entre los que confirman asistencia),
--              colecta (cada jugador anotado con su aporte, INGRESO),
--              compra de implementos deportivos (EGRESO, con o sin
--              desglose por jugador).
--
--   - lg_club_events: el evento en sí. direction sigue el mismo
--     criterio que lg_ledger_entries.direction (INGRESO | EGRESO).
--     event_type tiene un CHECK con los casos conocidos hoy más 'OTRO'
--     para no bloquear casos futuros no previstos.
--
--   - lg_club_event_charges: una fila por jugador dentro del evento,
--     con su monto individual. UNIQUE (event_id, player_id) — un
--     jugador no puede estar dos veces en el mismo evento. paid_amount/
--     paid_at replican el mismo criterio sin-columna-de-estado que ya
--     usa lg_ledger_entries (el estado PAGADO/PARCIAL/PENDIENTE se
--     calcula en la app).
--
--   - lg_ledger_entries.event_id (nueva columna, nullable): el total del
--     evento (suma de amount de sus charges) se refleja como UNA fila
--     resumen en lg_ledger_entries, para que GET_PAYMENT_STATS y
--     ClubFinanceView sigan funcionando sin cambios — event_id es solo
--     el link opcional hacia el detalle por jugador. Se agrega 'EVENTO'
--     al CHECK de category para poder distinguir estas filas resumen de
--     las categorías manuales existentes (INSCRIPCION/FECHA/MULTA/OTRO/
--     VALOR).
--
-- Nota: es idempotente. Se puede correr las veces que haga falta.
-- Fecha: 2026-09-05
-- ============================================================

CREATE TABLE IF NOT EXISTS lg_club_events (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL,
  club_id     uuid        NOT NULL,
  name        text        NOT NULL,
  event_type  text        NOT NULL DEFAULT 'OTRO',
  direction   text        NOT NULL DEFAULT 'EGRESO',
  event_date  date        NULL,
  description text        NULL,
  created_by  uuid        NULL,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  updated_at  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT lg_club_events_pkey PRIMARY KEY (id),
  CONSTRAINT lg_club_events_org_id_fkey FOREIGN KEY (org_id) REFERENCES lg_orgs (id) ON DELETE CASCADE,
  CONSTRAINT lg_club_events_club_id_fkey FOREIGN KEY (club_id) REFERENCES lg_clubs (id) ON DELETE CASCADE,
  CONSTRAINT lg_club_events_event_type_check CHECK (event_type IN ('FECHA_PARTIDO', 'COLECTA', 'COMPRA_IMPLEMENTOS', 'OTRO')),
  CONSTRAINT lg_club_events_direction_check CHECK (direction IN ('INGRESO', 'EGRESO'))
);

CREATE TABLE IF NOT EXISTS lg_club_event_charges (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  event_id    uuid        NOT NULL,
  player_id   uuid        NOT NULL,
  amount      numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  paid_at     timestamp with time zone NULL,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  updated_at  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT lg_club_event_charges_pkey PRIMARY KEY (id),
  CONSTRAINT lg_club_event_charges_event_id_fkey FOREIGN KEY (event_id) REFERENCES lg_club_events (id) ON DELETE CASCADE,
  CONSTRAINT lg_club_event_charges_player_id_fkey FOREIGN KEY (player_id) REFERENCES lg_players (id) ON DELETE CASCADE,
  CONSTRAINT lg_club_event_charges_event_id_player_id_key UNIQUE (event_id, player_id)
);

-- lg_ledger_entries.event_id: link opcional hacia la fila resumen del
-- evento. Nullable porque el resto de categorías (INSCRIPCION/FECHA/
-- MULTA/OTRO/VALOR) no vienen de un evento.
ALTER TABLE lg_ledger_entries ADD COLUMN IF NOT EXISTS event_id uuid NULL;

ALTER TABLE lg_ledger_entries DROP CONSTRAINT IF EXISTS lg_ledger_entries_event_id_fkey;
ALTER TABLE lg_ledger_entries
  ADD CONSTRAINT lg_ledger_entries_event_id_fkey FOREIGN KEY (event_id) REFERENCES lg_club_events (id) ON DELETE CASCADE;

-- 'EVENTO' se agrega al CHECK existente de category para distinguir la
-- fila resumen de un evento del resto de altas manuales/automáticas.
ALTER TABLE lg_ledger_entries DROP CONSTRAINT IF EXISTS lg_ledger_entries_category_check;
ALTER TABLE lg_ledger_entries
  ADD CONSTRAINT lg_ledger_entries_category_check CHECK (category IN ('INSCRIPCION', 'FECHA', 'MULTA', 'OTRO', 'VALOR', 'EVENTO'));

CREATE INDEX IF NOT EXISTS idx_lg_club_events_club_id         ON lg_club_events(club_id);
CREATE INDEX IF NOT EXISTS idx_lg_club_events_org_id          ON lg_club_events(org_id);
CREATE INDEX IF NOT EXISTS idx_lg_club_event_charges_event_id ON lg_club_event_charges(event_id);
CREATE INDEX IF NOT EXISTS idx_lg_club_event_charges_player_id ON lg_club_event_charges(player_id);
CREATE INDEX IF NOT EXISTS idx_lg_ledger_entries_event_id     ON lg_ledger_entries(event_id);

-- Garantiza a nivel de DB que un evento tiene a lo más UNA fila resumen
-- en lg_ledger_entries (category='EVENTO') — la capa de aplicación
-- (upsertEventSummaryEntry en lib/ledger.js) ya asume esto, este índice
-- lo blinda contra una carrera o un bug futuro que inserte dos veces.
CREATE UNIQUE INDEX IF NOT EXISTS uq_lg_ledger_entries_event_summary
  ON lg_ledger_entries(event_id) WHERE category = 'EVENTO';

-- ── RLS — mismo criterio que 20260818_unify_rls_all_tables.sql /
--    20260821_lg_ledger_and_cost_catalog.sql: el backend habla con
--    Supabase con una clave de rol 'anon', no 'service_role'; la
--    autorización real la hace el código de cada Specialist
--    (assertOrgAccess() / assertClubAccess()) antes de tocar la base.
ALTER TABLE lg_club_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE lg_club_event_charges ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'lg_club_events' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON lg_club_events', pol.policyname);
  END LOOP;
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'lg_club_event_charges' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON lg_club_event_charges', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "lg_club_events_select" ON lg_club_events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "lg_club_events_insert" ON lg_club_events FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "lg_club_events_update" ON lg_club_events FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "lg_club_events_delete" ON lg_club_events FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "lg_club_event_charges_select" ON lg_club_event_charges FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "lg_club_event_charges_insert" ON lg_club_event_charges FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "lg_club_event_charges_update" ON lg_club_event_charges FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "lg_club_event_charges_delete" ON lg_club_event_charges FOR DELETE TO anon, authenticated USING (true);

NOTIFY pgrst, 'reload schema';
