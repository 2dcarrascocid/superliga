-- ============================================================
-- Migration: lg_polls
-- Descripción: Módulo de "Votaciones" de la organización. El ADMIN de
--              la organización crea una elección (una pregunta con 2 o
--              más alternativas) que queda abierta durante un período
--              (opens_at -> closes_at). Cada club habilitado vota UNA vez
--              a través de su representante (usuario ADMIN_CLUB del club).
--              Al cerrarse, los clubes que no votaron quedan como
--              abstención y los resultados se publican en la sección de
--              Votaciones, junto con un comentario/resolución opcional.
--
--   - lg_polls: la votación en sí. status ABIERTA -> CERRADA es una
--     transición de un solo sentido. El cierre ocurre (a) de forma
--     perezosa la primera vez que alguien consulta/vota una votación con
--     closes_at vencido, o (b) manualmente por el admin (cierre
--     anticipado) — ver polls_specialist.js::_closePoll. is_secret=true
--     publica quién votó / se abstuvo pero no qué alternativa eligió.
--
--   - lg_poll_options: alternativas de la pregunta, ordenadas por
--     position. Mínimo 2 (validado en el specialist).
--
--   - lg_poll_votes: padrón + voto. Una fila por club habilitado, creada
--     al crear la votación (el padrón queda congelado: un club que se
--     inscriba después en la temporada no vota en esa elección).
--     status PENDIENTE -> VOTO | ABSTENCION. La transición a VOTO se hace
--     con un UPDATE condicionado a status='PENDIENTE' para que el voto sea
--     único aunque el representante haga doble click / dos requests.
--
-- Nota: es idempotente. Se puede correr las veces que haga falta.
-- Fecha: 2026-10-07
-- ============================================================

CREATE TABLE IF NOT EXISTS lg_polls (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  org_id       uuid        NOT NULL,
  season_id    uuid        NULL,                       -- NULL = padrón con todos los clubes activos de la org
  title        text        NOT NULL,                   -- la pregunta
  description  text        NULL,
  opens_at     timestamp with time zone NOT NULL DEFAULT now(),
  closes_at    timestamp with time zone NOT NULL,
  is_secret    boolean     NOT NULL DEFAULT false,
  status       text        NOT NULL DEFAULT 'ABIERTA',
  resolution   text        NULL,                       -- comentario / resolución al cierre
  created_by   uuid        NULL,
  closed_by    uuid        NULL,                       -- NULL + status CERRADA = cierre automático por plazo
  closed_at    timestamp with time zone NULL,
  created_at   timestamp with time zone NOT NULL DEFAULT now(),
  updated_at   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT lg_polls_pkey PRIMARY KEY (id),
  CONSTRAINT lg_polls_org_id_fkey FOREIGN KEY (org_id) REFERENCES lg_orgs (id) ON DELETE CASCADE,
  CONSTRAINT lg_polls_season_id_fkey FOREIGN KEY (season_id) REFERENCES lg_seasons (id) ON DELETE SET NULL,
  CONSTRAINT lg_polls_status_check CHECK (status IN ('ABIERTA', 'CERRADA')),
  CONSTRAINT lg_polls_period_check CHECK (closes_at > opens_at)
);

CREATE TABLE IF NOT EXISTS lg_poll_options (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  poll_id     uuid        NOT NULL,
  label       text        NOT NULL,
  position    integer     NOT NULL DEFAULT 0,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT lg_poll_options_pkey PRIMARY KEY (id),
  CONSTRAINT lg_poll_options_poll_id_fkey FOREIGN KEY (poll_id) REFERENCES lg_polls (id) ON DELETE CASCADE,
  CONSTRAINT lg_poll_options_poll_id_position_key UNIQUE (poll_id, position)
);

CREATE TABLE IF NOT EXISTS lg_poll_votes (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  poll_id     uuid        NOT NULL,
  club_id     uuid        NOT NULL,
  option_id   uuid        NULL,
  status      text        NOT NULL DEFAULT 'PENDIENTE',
  voted_by    uuid        NULL,                        -- usuario representante que emitió el voto
  voted_at    timestamp with time zone NULL,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  updated_at  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT lg_poll_votes_pkey PRIMARY KEY (id),
  CONSTRAINT lg_poll_votes_poll_id_fkey FOREIGN KEY (poll_id) REFERENCES lg_polls (id) ON DELETE CASCADE,
  CONSTRAINT lg_poll_votes_club_id_fkey FOREIGN KEY (club_id) REFERENCES lg_clubs (id) ON DELETE CASCADE,
  CONSTRAINT lg_poll_votes_option_id_fkey FOREIGN KEY (option_id) REFERENCES lg_poll_options (id) ON DELETE RESTRICT,
  CONSTRAINT lg_poll_votes_poll_id_club_id_key UNIQUE (poll_id, club_id),
  CONSTRAINT lg_poll_votes_status_check CHECK (status IN ('PENDIENTE', 'VOTO', 'ABSTENCION')),
  CONSTRAINT lg_poll_votes_option_matches_status CHECK ((status = 'VOTO') = (option_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_lg_polls_org_id           ON lg_polls(org_id);
CREATE INDEX IF NOT EXISTS idx_lg_polls_status_closes_at ON lg_polls(status, closes_at);
CREATE INDEX IF NOT EXISTS idx_lg_poll_options_poll_id   ON lg_poll_options(poll_id);
CREATE INDEX IF NOT EXISTS idx_lg_poll_votes_poll_id     ON lg_poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_lg_poll_votes_club_id     ON lg_poll_votes(club_id);

-- ── RLS — mismo criterio que 20260918_lg_org_events.sql: el backend habla
--    con Supabase con una clave de rol 'anon', no 'service_role'; la
--    autorización real la hace polls_specialist.js (isOrgAdmin /
--    ADMIN_CLUB del club) antes de tocar la base.
ALTER TABLE lg_polls        ENABLE ROW LEVEL SECURITY;
ALTER TABLE lg_poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE lg_poll_votes   ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname, tablename FROM pg_policies
             WHERE schemaname = 'public' AND tablename IN ('lg_polls', 'lg_poll_options', 'lg_poll_votes') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

CREATE POLICY "lg_polls_select" ON lg_polls FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "lg_polls_insert" ON lg_polls FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "lg_polls_update" ON lg_polls FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "lg_polls_delete" ON lg_polls FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "lg_poll_options_select" ON lg_poll_options FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "lg_poll_options_insert" ON lg_poll_options FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "lg_poll_options_update" ON lg_poll_options FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "lg_poll_options_delete" ON lg_poll_options FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "lg_poll_votes_select" ON lg_poll_votes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "lg_poll_votes_insert" ON lg_poll_votes FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "lg_poll_votes_update" ON lg_poll_votes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "lg_poll_votes_delete" ON lg_poll_votes FOR DELETE TO anon, authenticated USING (true);

NOTIFY pgrst, 'reload schema';
