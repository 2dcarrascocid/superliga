-- ============================================================
-- Migration: lg_disciplinary_tribunal
-- Descripción: Módulo transversal "Tribunal de Disciplina / Código de
--              Faltas". Genérico y polimórfico: admite reglamentos y
--              catálogos de faltas por deporte (Fútbol y variantes F7/
--              Futsal/Playa, Básquetbol, Vóleibol, o transversales con
--              sport_id NULL), e imputa sanciones sobre 4 niveles de
--              entes: CLUB | TEAM (lg_club_series) | PLAYER | COACH.
--
--   - lg_disciplinary_articles: artículos del reglamento (código,
--     título, gravedad), por deporte/variante o transversal.
--   - lg_disciplinary_infractions: catálogo de faltas tipificadas,
--     vinculadas a un artículo, con el tipo de sanción que aplican y
--     a qué tipo de ente sancionan. auto_rule alimenta el motor de
--     cálculo (acumulación de tarjetas, etc. — ver
--     adf/specialists/lib/disciplinary_engine.js).
--   - lg_team_staff: registro mínimo de cuerpo técnico/dirigentes por
--     club — no existía un mantenedor de personas para este rol; se
--     agrega acá sólo lo necesario para poder identificar al
--     sancionado tipo COACH (no es un módulo de RRHH).
--   - lg_disciplinary_cases: expedientes disciplinarios (uno por
--     incidencia/reporte), con sancionado polimórfico
--     (sanctioned_type + sanctioned_id, sin FK — el tipo indica en
--     qué tabla resolver el id: lg_clubs | lg_club_series | lg_players
--     | lg_team_staff).
--   - lg_sanction_resolutions: la sanción formal aplicada sobre un
--     expediente — cantidad de fechas/días/monto/puntos y estado de
--     cumplimiento.
--   - lg_sanction_fulfillments: bitácora de partidos oficiales que
--     descontaron una fecha de suspensión (una fecha sólo se descuenta
--     si el equipo del sancionado disputó un partido válido del
--     calendario del torneo — nunca por el sólo paso del tiempo).
--
-- Nota: es idempotente. Se puede correr las veces que haga falta.
-- Fecha: 2026-09-19
-- ============================================================

-- ============================================================
-- lg_disciplinary_articles — Artículos del reglamento
-- ============================================================
CREATE TABLE IF NOT EXISTS lg_disciplinary_articles (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  org_id        uuid        NOT NULL,
  sport_id      uuid        NULL,                    -- NULL = transversal (aplica a todos los deportes)
  variant       text        NULL,                     -- F7 | FUTSAL | PLAYA | INDOOR ... NULL = todas las variantes del deporte
  code          text        NOT NULL,
  title         text        NOT NULL,
  description   text        NULL,
  severity      text        NOT NULL DEFAULT 'LEVE',
  active        boolean     NOT NULL DEFAULT true,
  created_at    timestamp with time zone NOT NULL DEFAULT now(),
  updated_at    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT lg_disciplinary_articles_pkey PRIMARY KEY (id),
  CONSTRAINT lg_disciplinary_articles_org_id_fkey FOREIGN KEY (org_id) REFERENCES lg_orgs (id) ON DELETE CASCADE,
  CONSTRAINT lg_disciplinary_articles_sport_id_fkey FOREIGN KEY (sport_id) REFERENCES lg_sports (id) ON DELETE SET NULL,
  CONSTRAINT lg_disciplinary_articles_severity_check CHECK (severity IN ('LEVE', 'GRAVE', 'GRAVISIMA')),
  CONSTRAINT lg_disciplinary_articles_org_id_code_key UNIQUE (org_id, code)
);

CREATE INDEX IF NOT EXISTS idx_disciplinary_articles_org_id ON lg_disciplinary_articles(org_id);
CREATE INDEX IF NOT EXISTS idx_disciplinary_articles_sport_id ON lg_disciplinary_articles(sport_id);

-- ============================================================
-- lg_disciplinary_infractions — Catálogo de faltas tipificadas
-- ============================================================
CREATE TABLE IF NOT EXISTS lg_disciplinary_infractions (
  id                uuid        NOT NULL DEFAULT gen_random_uuid(),
  org_id            uuid        NOT NULL,
  article_id        uuid        NULL,
  sport_id          uuid        NULL,                 -- NULL = transversal
  variant           text        NULL,
  code              text        NOT NULL,
  name              text        NOT NULL,
  description       text        NULL,
  sanctioned_type   text        NOT NULL,              -- CLUB | TEAM | PLAYER | COACH
  sanction_kind     text        NOT NULL,              -- ver CHECK más abajo
  default_quantity  numeric(12,2) NULL,                -- partidos / días / monto / puntos, según sanction_kind
  auto_trigger      text        NULL,                  -- CARD_ACCUMULATION | RED_CARD_DIRECT | NULL (manual)
  auto_rule         jsonb       NULL,                  -- parámetros del motor (umbral, tipo de tarjeta, reseteo, etc.)
  active            boolean     NOT NULL DEFAULT true,
  created_at        timestamp with time zone NOT NULL DEFAULT now(),
  updated_at        timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT lg_disciplinary_infractions_pkey PRIMARY KEY (id),
  CONSTRAINT lg_disciplinary_infractions_org_id_fkey FOREIGN KEY (org_id) REFERENCES lg_orgs (id) ON DELETE CASCADE,
  CONSTRAINT lg_disciplinary_infractions_article_id_fkey FOREIGN KEY (article_id) REFERENCES lg_disciplinary_articles (id) ON DELETE SET NULL,
  CONSTRAINT lg_disciplinary_infractions_sport_id_fkey FOREIGN KEY (sport_id) REFERENCES lg_sports (id) ON DELETE SET NULL,
  CONSTRAINT lg_disciplinary_infractions_sanctioned_type_check CHECK (sanctioned_type IN ('CLUB', 'TEAM', 'PLAYER', 'COACH')),
  CONSTRAINT lg_disciplinary_infractions_sanction_kind_check CHECK (sanction_kind IN (
    'MATCHES_SUSPENSION', 'DAYS_SUSPENSION', 'FINE', 'POINTS_DEDUCTION',
    'WALKOVER', 'LOCALIA_SUSPENSION', 'DISQUALIFICATION', 'EXPULSION'
  )),
  CONSTRAINT lg_disciplinary_infractions_auto_trigger_check CHECK (auto_trigger IS NULL OR auto_trigger IN ('CARD_ACCUMULATION', 'RED_CARD_DIRECT')),
  CONSTRAINT lg_disciplinary_infractions_org_id_code_key UNIQUE (org_id, code)
);

CREATE INDEX IF NOT EXISTS idx_disciplinary_infractions_org_id ON lg_disciplinary_infractions(org_id);
CREATE INDEX IF NOT EXISTS idx_disciplinary_infractions_article_id ON lg_disciplinary_infractions(article_id);
CREATE INDEX IF NOT EXISTS idx_disciplinary_infractions_sport_id ON lg_disciplinary_infractions(sport_id);
CREATE INDEX IF NOT EXISTS idx_disciplinary_infractions_sanctioned_type ON lg_disciplinary_infractions(sanctioned_type);
CREATE INDEX IF NOT EXISTS idx_disciplinary_infractions_auto_trigger ON lg_disciplinary_infractions(auto_trigger) WHERE auto_trigger IS NOT NULL;

-- ============================================================
-- lg_team_staff — Registro mínimo de cuerpo técnico / dirigentes
-- (sólo lo necesario para identificar al sancionado tipo COACH)
-- ============================================================
CREATE TABLE IF NOT EXISTS lg_team_staff (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  club_id     uuid        NOT NULL,
  full_name   text        NOT NULL,
  role        text        NOT NULL DEFAULT 'DT',       -- DT | AYUDANTE_TECNICO | DIRIGENTE | OTRO
  active      boolean     NOT NULL DEFAULT true,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  updated_at  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT lg_team_staff_pkey PRIMARY KEY (id),
  CONSTRAINT lg_team_staff_club_id_fkey FOREIGN KEY (club_id) REFERENCES lg_clubs (id) ON DELETE CASCADE,
  CONSTRAINT lg_team_staff_role_check CHECK (role IN ('DT', 'AYUDANTE_TECNICO', 'DIRIGENTE', 'OTRO'))
);

CREATE INDEX IF NOT EXISTS idx_team_staff_club_id ON lg_team_staff(club_id);

-- ============================================================
-- lg_disciplinary_cases — Expedientes disciplinarios
-- ============================================================
CREATE TABLE IF NOT EXISTS lg_disciplinary_cases (
  id                uuid        NOT NULL DEFAULT gen_random_uuid(),
  org_id            uuid        NOT NULL,
  tournament_id     uuid        NULL,
  match_id          uuid        NULL,
  match_event_id    uuid        NULL,                  -- si nace de una tarjeta puntual de lg_match_events
  sanctioned_type   text        NOT NULL,               -- CLUB | TEAM | PLAYER | COACH
  sanctioned_id     uuid        NOT NULL,               -- polimórfico: id en lg_clubs | lg_club_series | lg_players | lg_team_staff
  club_id           uuid        NULL,                   -- club del sancionado, resuelto al crear (para filtrar rápido sin importar el tipo)
  infraction_id     uuid        NULL,
  article_id        uuid        NULL,
  source            text        NOT NULL DEFAULT 'MANUAL',
  title             text        NOT NULL,
  description       text        NULL,
  status            text        NOT NULL DEFAULT 'PENDING',
  reported_by       uuid        NULL,                   -- auth.users.id
  created_at        timestamp with time zone NOT NULL DEFAULT now(),
  updated_at        timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT lg_disciplinary_cases_pkey PRIMARY KEY (id),
  CONSTRAINT lg_disciplinary_cases_org_id_fkey FOREIGN KEY (org_id) REFERENCES lg_orgs (id) ON DELETE CASCADE,
  CONSTRAINT lg_disciplinary_cases_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES lg_tournaments (id) ON DELETE SET NULL,
  CONSTRAINT lg_disciplinary_cases_match_id_fkey FOREIGN KEY (match_id) REFERENCES lg_matches (id) ON DELETE SET NULL,
  CONSTRAINT lg_disciplinary_cases_match_event_id_fkey FOREIGN KEY (match_event_id) REFERENCES lg_match_events (id) ON DELETE SET NULL,
  CONSTRAINT lg_disciplinary_cases_club_id_fkey FOREIGN KEY (club_id) REFERENCES lg_clubs (id) ON DELETE SET NULL,
  CONSTRAINT lg_disciplinary_cases_infraction_id_fkey FOREIGN KEY (infraction_id) REFERENCES lg_disciplinary_infractions (id) ON DELETE SET NULL,
  CONSTRAINT lg_disciplinary_cases_article_id_fkey FOREIGN KEY (article_id) REFERENCES lg_disciplinary_articles (id) ON DELETE SET NULL,
  CONSTRAINT lg_disciplinary_cases_sanctioned_type_check CHECK (sanctioned_type IN ('CLUB', 'TEAM', 'PLAYER', 'COACH')),
  CONSTRAINT lg_disciplinary_cases_source_check CHECK (source IN ('MATCH_REPORT', 'REFEREE_REPORT', 'MANUAL', 'AUTO_CARD_ACCUMULATION')),
  CONSTRAINT lg_disciplinary_cases_status_check CHECK (status IN ('PENDING', 'IN_REVIEW', 'SANCTIONED', 'DISMISSED'))
);

CREATE INDEX IF NOT EXISTS idx_disciplinary_cases_org_id ON lg_disciplinary_cases(org_id);
CREATE INDEX IF NOT EXISTS idx_disciplinary_cases_tournament_id ON lg_disciplinary_cases(tournament_id);
CREATE INDEX IF NOT EXISTS idx_disciplinary_cases_match_id ON lg_disciplinary_cases(match_id);
CREATE INDEX IF NOT EXISTS idx_disciplinary_cases_club_id ON lg_disciplinary_cases(club_id);
CREATE INDEX IF NOT EXISTS idx_disciplinary_cases_status ON lg_disciplinary_cases(status);
CREATE INDEX IF NOT EXISTS idx_disciplinary_cases_sanctioned ON lg_disciplinary_cases(sanctioned_type, sanctioned_id);
-- Un evento de partido (una tarjeta puntual) dispara a lo sumo un expediente
-- automático — evita duplicar caso+resolución si el motor de acumulación de
-- tarjetas se invoca dos veces para la misma tarjeta (reintento del cliente,
-- llamada concurrente). Ver disciplinary_specialist.js#_evaluateCardAccumulation.
CREATE UNIQUE INDEX IF NOT EXISTS idx_disciplinary_cases_match_event_unique
  ON lg_disciplinary_cases(match_event_id) WHERE match_event_id IS NOT NULL;

-- ============================================================
-- lg_sanction_resolutions — Resolución formal / sanción aplicada
-- ============================================================
CREATE TABLE IF NOT EXISTS lg_sanction_resolutions (
  id                  uuid        NOT NULL DEFAULT gen_random_uuid(),
  case_id             uuid        NOT NULL,
  org_id              uuid        NOT NULL,
  sanctioned_type     text        NOT NULL,
  sanctioned_id       uuid        NOT NULL,
  club_id             uuid        NULL,
  tournament_id       uuid        NULL,                 -- alcance del cumplimiento (calendario contra el que se cuentan las fechas)
  sanction_kind       text        NOT NULL,
  quantity            numeric(12,2) NOT NULL DEFAULT 0,  -- partidos / días / monto / puntos según sanction_kind
  matches_remaining   integer     NULL,                  -- vivo, sólo si sanction_kind = MATCHES_SUSPENSION
  start_date          date        NULL,
  end_date            date        NULL,                  -- sólo DAYS_SUSPENSION
  resolution_text     text        NULL,                  -- boletín oficial firmado por el tribunal
  resolved_by         uuid        NULL,
  resolved_at         timestamp with time zone NULL,
  status_cumplimiento text        NOT NULL DEFAULT 'PENDING',
  created_at          timestamp with time zone NOT NULL DEFAULT now(),
  updated_at          timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT lg_sanction_resolutions_pkey PRIMARY KEY (id),
  CONSTRAINT lg_sanction_resolutions_case_id_fkey FOREIGN KEY (case_id) REFERENCES lg_disciplinary_cases (id) ON DELETE CASCADE,
  CONSTRAINT lg_sanction_resolutions_org_id_fkey FOREIGN KEY (org_id) REFERENCES lg_orgs (id) ON DELETE CASCADE,
  CONSTRAINT lg_sanction_resolutions_club_id_fkey FOREIGN KEY (club_id) REFERENCES lg_clubs (id) ON DELETE SET NULL,
  CONSTRAINT lg_sanction_resolutions_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES lg_tournaments (id) ON DELETE SET NULL,
  CONSTRAINT lg_sanction_resolutions_sanctioned_type_check CHECK (sanctioned_type IN ('CLUB', 'TEAM', 'PLAYER', 'COACH')),
  CONSTRAINT lg_sanction_resolutions_sanction_kind_check CHECK (sanction_kind IN (
    'MATCHES_SUSPENSION', 'DAYS_SUSPENSION', 'FINE', 'POINTS_DEDUCTION',
    'WALKOVER', 'LOCALIA_SUSPENSION', 'DISQUALIFICATION', 'EXPULSION'
  )),
  CONSTRAINT lg_sanction_resolutions_status_check CHECK (status_cumplimiento IN ('PENDING', 'IN_FULFILLMENT', 'COMPLETED', 'APPEALED'))
);

CREATE INDEX IF NOT EXISTS idx_sanction_resolutions_case_id ON lg_sanction_resolutions(case_id);
CREATE INDEX IF NOT EXISTS idx_sanction_resolutions_org_id ON lg_sanction_resolutions(org_id);
CREATE INDEX IF NOT EXISTS idx_sanction_resolutions_tournament_id ON lg_sanction_resolutions(tournament_id);
CREATE INDEX IF NOT EXISTS idx_sanction_resolutions_sanctioned ON lg_sanction_resolutions(sanctioned_type, sanctioned_id);
CREATE INDEX IF NOT EXISTS idx_sanction_resolutions_status ON lg_sanction_resolutions(status_cumplimiento);
-- Consulta más caliente del módulo: "¿está este jugador/equipo suspendido
-- ahora mismo?" — filtra por tipo+id con cumplimiento activo y fechas
-- pendientes en un solo índice parcial.
CREATE INDEX IF NOT EXISTS idx_sanction_resolutions_active_lookup
  ON lg_sanction_resolutions(sanctioned_type, sanctioned_id, tournament_id)
  WHERE status_cumplimiento IN ('PENDING', 'IN_FULFILLMENT');

-- ============================================================
-- lg_sanction_fulfillments — Bitácora de fechas descontadas
-- ============================================================
CREATE TABLE IF NOT EXISTS lg_sanction_fulfillments (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  resolution_id uuid        NOT NULL,
  match_id      uuid        NOT NULL,
  consumed_at   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT lg_sanction_fulfillments_pkey PRIMARY KEY (id),
  CONSTRAINT lg_sanction_fulfillments_resolution_id_fkey FOREIGN KEY (resolution_id) REFERENCES lg_sanction_resolutions (id) ON DELETE CASCADE,
  CONSTRAINT lg_sanction_fulfillments_match_id_fkey FOREIGN KEY (match_id) REFERENCES lg_matches (id) ON DELETE CASCADE,
  CONSTRAINT lg_sanction_fulfillments_unique UNIQUE (resolution_id, match_id)
);

CREATE INDEX IF NOT EXISTS idx_sanction_fulfillments_resolution_id ON lg_sanction_fulfillments(resolution_id);
CREATE INDEX IF NOT EXISTS idx_sanction_fulfillments_match_id ON lg_sanction_fulfillments(match_id);

-- ============================================================
-- Vista: vw_active_sanctions — castigos vigentes, aplanada para la
-- consulta pública/de clubes ("expulsados y sancionados por fecha").
-- ============================================================
CREATE OR REPLACE VIEW vw_active_sanctions AS
SELECT
  r.id                  AS resolution_id,
  r.case_id,
  r.org_id,
  r.tournament_id,
  r.sanctioned_type,
  r.sanctioned_id,
  r.club_id,
  c.name                AS club_name,
  r.sanction_kind,
  r.quantity,
  r.matches_remaining,
  r.start_date,
  r.end_date,
  r.status_cumplimiento,
  cs.title               AS case_title,
  cs.infraction_id,
  i.name                 AS infraction_name,
  cs.article_id,
  a.code                 AS article_code
FROM lg_sanction_resolutions r
JOIN lg_disciplinary_cases cs ON cs.id = r.case_id
LEFT JOIN lg_clubs c ON c.id = r.club_id
LEFT JOIN lg_disciplinary_infractions i ON i.id = cs.infraction_id
LEFT JOIN lg_disciplinary_articles a ON a.id = cs.article_id
WHERE r.status_cumplimiento IN ('PENDING', 'IN_FULFILLMENT')
  AND (r.sanction_kind != 'MATCHES_SUSPENSION' OR COALESCE(r.matches_remaining, 0) > 0)
  AND (r.sanction_kind != 'DAYS_SUSPENSION' OR r.end_date IS NULL OR r.end_date >= CURRENT_DATE);

-- ── RLS — mismo criterio que 20260918_lg_penalty_catalog.sql: la
--    autorización real la hace el specialist (isOrgAdmin) antes de
--    tocar la base; acá se habilita RLS con políticas permisivas para
--    no bloquear al backend.
ALTER TABLE lg_disciplinary_articles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE lg_disciplinary_infractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lg_team_staff               ENABLE ROW LEVEL SECURITY;
ALTER TABLE lg_disciplinary_cases       ENABLE ROW LEVEL SECURITY;
ALTER TABLE lg_sanction_resolutions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE lg_sanction_fulfillments    ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
  pol record;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'lg_disciplinary_articles', 'lg_disciplinary_infractions', 'lg_team_staff',
    'lg_disciplinary_cases', 'lg_sanction_resolutions', 'lg_sanction_fulfillments'
  ]
  LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, t);
    END LOOP;

    EXECUTE format('CREATE POLICY "%s_select" ON %I FOR SELECT TO anon, authenticated USING (true)', t, t);
    EXECUTE format('CREATE POLICY "%s_insert" ON %I FOR INSERT TO anon, authenticated WITH CHECK (true)', t, t);
    EXECUTE format('CREATE POLICY "%s_update" ON %I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)', t, t);
    EXECUTE format('CREATE POLICY "%s_delete" ON %I FOR DELETE TO anon, authenticated USING (true)', t, t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
