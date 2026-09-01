-- ─────────────────────────────────────────────────────────────────────────────
-- 003_player_users.sql
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- Requiere que 002_club_admins.sql ya esté ejecutado.
--
-- Rol nuevo "Jugador": vincula un login de Google (auth.users) a un
-- registro específico de lg_players, con acceso muy acotado (perfil propio
-- + lectura de su serie/standings/goleadores/fairplay). Replica casi 1:1 el
-- patrón de invitación de 002_club_admins.sql (lg_club_invites/
-- lg_club_users → ADMIN_CLUB) pero para el rol JUGADOR.
--
-- Nota de RLS: 002_club_admins.sql originalmente dejó lg_club_invites con
-- "DISABLE ROW LEVEL SECURITY". Esa migración quedó superada por
-- sql/migrations/20260818_unify_rls_all_tables.sql, que unificó el criterio
-- en TODA la app -- incluyendo explícitamente lg_club_invites y
-- lg_club_users -- a RLS habilitado + políticas permisivas USING(true) /
-- WITH CHECK(true) para anon+authenticated (el backend habla con Supabase
-- con una key de rol 'anon', no service_role; la autorización real la hace
-- el código de cada Specialist, no RLS). Para que lg_player_users y
-- lg_player_invites se comporten igual que sus tablas hermanas HOY, se
-- aplica acá directamente ese patrón unificado (en vez de repetir el ciclo
-- disable → drift → re-enable que motivó la migración 20260818).
-- ─────────────────────────────────────────────────────────────────────────────

-- Tabla de vínculo jugador ↔ usuario (rol Jugador)
CREATE TABLE IF NOT EXISTS public.lg_player_users (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id   uuid        NOT NULL REFERENCES public.lg_players(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL,          -- id de auth.users; sin FK cross-schema (mismo criterio que lg_club_users.user_id)
  role        text        NOT NULL DEFAULT 'JUGADOR',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, user_id)
);

CREATE INDEX IF NOT EXISTS lg_player_users_player_idx ON public.lg_player_users (player_id);
CREATE INDEX IF NOT EXISTS lg_player_users_user_idx   ON public.lg_player_users (user_id);

-- Un login de Google se vincula a un solo jugador (mismo criterio 1:1 que
-- idx_club_users_admin_club_one_per_user en
-- sql/migrations/20260815_lg_club_users_one_admin_per_user.sql; acá el
-- índice es sobre toda la tabla -- no parcial por rol -- porque JUGADOR es
-- el único rol que maneja lg_player_users).
CREATE UNIQUE INDEX IF NOT EXISTS idx_player_users_one_player_per_user
  ON public.lg_player_users (user_id);

-- Tabla de invitaciones a jugador (mismo shape que lg_club_invites)
CREATE TABLE IF NOT EXISTS public.lg_player_invites (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  email       text        NOT NULL,
  player_id   uuid        NOT NULL REFERENCES public.lg_players(id) ON DELETE CASCADE,
  invited_by  uuid        NOT NULL,          -- id de auth.users; sin FK cross-schema (mismo criterio que lg_club_invites.invited_by)
  token_hash  text        NOT NULL UNIQUE,
  user_id     uuid,          -- se rellena si el usuario ya existía al invitar
  accepted_at timestamptz,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lg_player_invites_player_idx ON public.lg_player_invites (player_id);
CREATE INDEX IF NOT EXISTS lg_player_invites_email_idx  ON public.lg_player_invites (email);

-- ── RLS: habilitada + políticas permisivas, mismo criterio unificado que el
--    resto del schema (ver sql/migrations/20260818_unify_rls_all_tables.sql).
--    La autorización real la hace el backend (assertPlayerAccess, a cargo de
--    backend-dev), RLS acá es solo una capa extra, no la barrera principal.
ALTER TABLE public.lg_player_users   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lg_player_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lg_player_users_select" ON public.lg_player_users;
DROP POLICY IF EXISTS "lg_player_users_insert" ON public.lg_player_users;
DROP POLICY IF EXISTS "lg_player_users_update" ON public.lg_player_users;
DROP POLICY IF EXISTS "lg_player_users_delete" ON public.lg_player_users;
CREATE POLICY "lg_player_users_select" ON public.lg_player_users FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "lg_player_users_insert" ON public.lg_player_users FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "lg_player_users_update" ON public.lg_player_users FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "lg_player_users_delete" ON public.lg_player_users FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "lg_player_invites_select" ON public.lg_player_invites;
DROP POLICY IF EXISTS "lg_player_invites_insert" ON public.lg_player_invites;
DROP POLICY IF EXISTS "lg_player_invites_update" ON public.lg_player_invites;
DROP POLICY IF EXISTS "lg_player_invites_delete" ON public.lg_player_invites;
CREATE POLICY "lg_player_invites_select" ON public.lg_player_invites FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "lg_player_invites_insert" ON public.lg_player_invites FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "lg_player_invites_update" ON public.lg_player_invites FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "lg_player_invites_delete" ON public.lg_player_invites FOR DELETE TO anon, authenticated USING (true);

-- ── fn_invite_player ─────────────────────────────────────────────────────────
-- Token generado en JS (crypto.randomBytes) — no requiere pgcrypto.
-- Recibe token_hash y expires_at pre-calculados.
-- Además de crear/renovar la invitación, siempre actualiza lg_players.email
-- con el correo cargado por el admin (exista o no ya el usuario en
-- auth.users -- el admin ya "agregó el correo del jugador" en la ficha,
-- independientemente de si el jugador ya se logueó alguna vez).
-- Si el email ya existe en auth.users, además vincula de inmediato en
-- lg_player_users (mismo patrón que fn_invite_club_admin).
-- Retorna: { is_new, user_id }
CREATE OR REPLACE FUNCTION public.fn_invite_player(
  p_email      text,
  p_player_id  uuid,
  p_inviter_id uuid,
  p_token_hash text,
  p_expires_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(p_email) AND deleted_at IS NULL
  LIMIT 1;

  -- Limpiar invitaciones previas pendientes para este email+jugador
  DELETE FROM public.lg_player_invites
  WHERE lower(email) = lower(p_email) AND player_id = p_player_id AND accepted_at IS NULL;

  INSERT INTO public.lg_player_invites (email, player_id, invited_by, token_hash, user_id, expires_at)
  VALUES (lower(p_email), p_player_id, p_inviter_id, p_token_hash, v_user_id, p_expires_at);

  -- El admin ya cargó el correo del jugador en la ficha, exista o no el
  -- usuario todavía en auth.users.
  UPDATE public.lg_players
  SET email = lower(p_email)
  WHERE id = p_player_id;

  -- Si el usuario ya existe → vincular de inmediato
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.lg_player_users (player_id, user_id, role)
    VALUES (p_player_id, v_user_id, 'JUGADOR')
    ON CONFLICT (player_id, user_id) DO UPDATE SET role = 'JUGADOR', updated_at = now();
  END IF;

  RETURN jsonb_build_object(
    'is_new',  v_user_id IS NULL,
    'user_id', v_user_id
  );
END;
$$;

-- ── fn_get_player_link ────────────────────────────────────────────────────────
-- Retorna el/los usuario(s) con rol JUGADOR vinculados a un jugador,
-- incluyendo su email. Mismo patrón que fn_get_club_admins.
CREATE OR REPLACE FUNCTION public.fn_get_player_link(p_player_id uuid)
RETURNS TABLE(user_id uuid, email text, role text, assigned_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  RETURN QUERY
  SELECT  pu.user_id,
          u.email,
          pu.role,
          pu.created_at AS assigned_at
  FROM    public.lg_player_users pu
  JOIN    auth.users u ON u.id = pu.user_id
  WHERE   pu.player_id = p_player_id
    AND   pu.role      = 'JUGADOR'
    AND   u.deleted_at IS NULL
  ORDER BY pu.created_at DESC;
END;
$$;

-- ── fn_accept_player_invite ───────────────────────────────────────────────────
-- Acepta una invitación: asigna rol JUGADOR y marca el invite como
-- aceptado. Recibe p_token_hash pre-calculado en JS con SHA-256. Mismo
-- patrón que fn_accept_club_invite.
CREATE OR REPLACE FUNCTION public.fn_accept_player_invite(p_token_hash text, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_record public.lg_player_invites%ROWTYPE;
BEGIN
  -- FOR UPDATE: cierra la ventana de carrera entre dos aceptaciones
  -- concurrentes del mismo token (hallazgo de security-reviewer,
  -- T-20260828-103923 — severidad baja, defensa en profundidad).
  SELECT * INTO v_record
  FROM public.lg_player_invites
  WHERE token_hash = p_token_hash AND expires_at > now() AND accepted_at IS NULL
  LIMIT 1
  FOR UPDATE;

  IF v_record.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_INVITE');
  END IF;

  INSERT INTO public.lg_player_users (player_id, user_id, role)
  VALUES (v_record.player_id, p_user_id, 'JUGADOR')
  ON CONFLICT (player_id, user_id) DO UPDATE SET role = 'JUGADOR', updated_at = now();

  UPDATE public.lg_player_invites
  SET accepted_at = now(), user_id = p_user_id
  WHERE id = v_record.id;

  RETURN jsonb_build_object('success', true, 'player_id', v_record.player_id);
END;
$$;

-- ── Permisos ──────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.fn_invite_player(text, uuid, uuid, text, timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_get_player_link(uuid)                              TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_accept_player_invite(text, uuid)                   TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
