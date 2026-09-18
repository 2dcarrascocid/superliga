-- ============================================================
-- Migration: lg_scheduling_settings
-- Descripción: Módulo "Parámetros" de programación de fecha. Guarda,
--              por organización (una fila singleton por org_id), los
--              valores configurables que hoy están hardcodeados como
--              constantes en match_scheduling_specialist.js
--              (DEFAULT_START_TIME, REAL_BLOCK_MINUTES) para que el
--              algoritmo de asignación automática de cancha/horario
--              por fecha pueda parametrizarse sin tocar código.
--
--              Significado de negocio de cada columna:
--                - half_duration_minutes: duración de juego por lado
--                  (ej.: 30 minutos por lado).
--                - halftime_break_minutes: descanso entre lados
--                  (entretiempo).
--                - turnaround_minutes: tiempo de cambio/desalojo de
--                  cancha entre partidos consecutivos programados en
--                  el mismo horario/cancha.
--                - default_start_time: hora de inicio por defecto de
--                  la primera franja horaria de una fecha.
--
--              A partir de estos valores, el código (no la base)
--              calcula:
--                match_duration = half_duration_minutes*2
--                                 + halftime_break_minutes
--                block_duration = match_duration + turnaround_minutes
--
--              lg_scheduling_settings_org_id_unique garantiza que haya
--              a lo sumo una fila de configuración por organización;
--              el Specialist hace upsert con onConflict sobre org_id,
--              seteando updated_at manualmente (mismo criterio que
--              _applySchedule en match_scheduling_specialist.js), no
--              hay trigger de updated_at en este repo.
--
--              RLS: mismo criterio que 20260818_unify_rls_all_tables.sql
--              / 20260905_lg_matchday_scheduling_failures.sql — el
--              backend habla con Supabase con una clave de rol 'anon',
--              no 'service_role', por lo que las políticas son
--              permisivas para anon y authenticated; la autorización
--              real la hace el código de cada Specialist
--              (assertOrgAccess() / assertClubAccess()) antes de tocar
--              la base.
--
-- Nota: idempotente. Se puede correr las veces que haga falta.
-- Fecha: 2026-09-17
-- ============================================================

CREATE TABLE IF NOT EXISTS lg_scheduling_settings (
  id                       uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id                   uuid NOT NULL,
  half_duration_minutes    integer NOT NULL DEFAULT 30,
  halftime_break_minutes   integer NOT NULL DEFAULT 5,
  turnaround_minutes       integer NOT NULL DEFAULT 5,
  default_start_time       time NOT NULL DEFAULT '14:00:00',
  created_at               timestamp with time zone NOT NULL DEFAULT now(),
  updated_at               timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT lg_scheduling_settings_pkey PRIMARY KEY (id),
  CONSTRAINT lg_scheduling_settings_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES lg_orgs (id) ON DELETE CASCADE,
  CONSTRAINT lg_scheduling_settings_org_id_unique UNIQUE (org_id)
);

ALTER TABLE lg_scheduling_settings DROP CONSTRAINT IF EXISTS lg_scheduling_settings_half_duration_check;
ALTER TABLE lg_scheduling_settings
  ADD CONSTRAINT lg_scheduling_settings_half_duration_check
  CHECK (half_duration_minutes > 0);

ALTER TABLE lg_scheduling_settings DROP CONSTRAINT IF EXISTS lg_scheduling_settings_halftime_break_check;
ALTER TABLE lg_scheduling_settings
  ADD CONSTRAINT lg_scheduling_settings_halftime_break_check
  CHECK (halftime_break_minutes >= 0);

ALTER TABLE lg_scheduling_settings DROP CONSTRAINT IF EXISTS lg_scheduling_settings_turnaround_check;
ALTER TABLE lg_scheduling_settings
  ADD CONSTRAINT lg_scheduling_settings_turnaround_check
  CHECK (turnaround_minutes >= 0);

-- ── RLS — mismo criterio que 20260818_unify_rls_all_tables.sql /
--    20260905_lg_matchday_scheduling_failures.sql: el backend habla con
--    Supabase con una clave de rol 'anon', no 'service_role'.
ALTER TABLE lg_scheduling_settings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'lg_scheduling_settings' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON lg_scheduling_settings', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "lg_scheduling_settings_select" ON lg_scheduling_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "lg_scheduling_settings_insert" ON lg_scheduling_settings FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "lg_scheduling_settings_update" ON lg_scheduling_settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "lg_scheduling_settings_delete" ON lg_scheduling_settings FOR DELETE TO anon, authenticated USING (true);

NOTIFY pgrst, 'reload schema';
