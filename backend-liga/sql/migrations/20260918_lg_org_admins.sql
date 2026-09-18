-- ============================================================
-- Migration: lg_org_admins
-- Descripción: Panel de configuración de administrador → gestión de hasta
--              5 administradores de organización (rol ADMIN, a nivel
--              lg_orgs — distinto del rol ADMIN_CLUB de
--              migrations/002_club_admins.sql, que es por club). Clona
--              casi 1:1 el patrón de invitación de
--              migrations/002_club_admins.sql (lg_club_invites +
--              fn_invite_club_admin / fn_get_club_admins /
--              fn_accept_club_invite) pero a nivel de organización, y
--              suma 3 campos de perfil (full_name, phone, position) que
--              el club-admin-invite original no maneja. La política de
--              "máximo 5 administradores por org" es una regla de negocio
--              que valida el código del Specialist antes de invocar
--              fn_invite_org_admin — no se modela como constraint SQL
--              porque depende de un COUNT(*) contra filas ya existentes,
--              no de la forma de una fila individual.
--
--              1) lg_org_users (ya existente: org_id, user_id, role) suma
--                 full_name/phone/position, nullable, para no romper las
--                 filas ADMIN ya creadas por el flujo de bootstrap
--                 (routes/auth/bootstrap.js, adf/specialists/
--                 auth_specialist.js) que hoy solo escriben org_id/
--                 user_id/role.
--
--              2) lg_org_admin_invites: mismo shape que lg_club_invites
--                 (email, invited_by, token_hash, user_id, accepted_at,
--                 expires_at, created_at) con org_id en vez de club_id,
--                 más full_name/phone/position. Igual que lg_club_invites,
--                 no lleva FK cruzada a lg_orgs/auth.users (mismo criterio
--                 "sin FK cross-schema" documentado en
--                 migrations/003_player_users.sql).
--
--              3) Funciones RPC — clones de fn_invite_club_admin /
--                 fn_get_club_admins / fn_accept_club_invite, con el
--                 refinamiento de FOR UPDATE en la aceptación de invite ya
--                 incorporado en migrations/003_player_users.sql (cierra
--                 la ventana de carrera entre dos aceptaciones
--                 concurrentes del mismo token — hallazgo de
--                 security-reviewer T-20260828-103923).
--
--              ── Ajuste sobre el conflict target de lg_org_users ──
--              El plan original asumía UNIQUE (org_id, user_id). Se
--              descartó al confirmar el upsert real en
--              routes/auth/bootstrap.js (`.upsert({...}, { onConflict:
--              'org_id,user_id,role' })`) y en
--              adf/specialists/auth_specialist.js — ambos dependen de que
--              exista una constraint/índice único que cubra exactamente
--              (org_id, user_id, role), no (org_id, user_id). Esta
--              migración no crea esa constraint (ya debe existir en la
--              base para que el bootstrap funcione hoy) pero usa
--              ON CONFLICT (org_id, user_id, role) en las funciones
--              nuevas para ser consistente con el resto del código. No se
--              encontró en este repo el CREATE TABLE original de
--              lg_org_users (la tabla no está versionada en
--              sql/migrations/ ni en migrations/), por lo que su nombre
--              real de constraint no se pudo confirmar por lectura de
--              código — si el ON CONFLICT fallara al ejecutar esto en
--              Supabase, es indicio de que esa constraint no existe con
--              exactamente esas 3 columnas y hay que crearla antes.
--
--              También se agrega defensivamente lg_org_users.created_at
--              (ADD COLUMN IF NOT EXISTS, no-op si ya existe) porque
--              fn_get_org_admins ordena por fecha de asignación y no se
--              pudo confirmar por lectura de código el nombre real de esa
--              columna en la tabla existente (mismo motivo que arriba);
--              se asume created_at por ser el nombre usado de forma
--              consistente en el resto de tablas *_users de este repo
--              (lg_club_users, lg_player_users, lg_org_admin_invites).
--
--              RLS: lg_org_users no se toca (ya cubierta por el criterio
--              unificado de 20260818_unify_rls_all_tables.sql). Para
--              lg_org_admin_invites se usa el mismo criterio que
--              lg_club_invites en migrations/002_club_admins.sql:
--              DISABLE ROW LEVEL SECURITY (no políticas ad-hoc) — la
--              autorización real la hace el código del Specialist antes
--              de invocar las funciones RPC.
--
-- Nota: idempotente. Se puede correr las veces que haga falta.
-- Fecha: 2026-09-18
-- ============================================================

-- ── 1) lg_org_users: campos de perfil del administrador ──────────────────
-- "position" es palabra reservada en Postgres (colisiona con la función
-- POSITION(substring IN string)) — se usa citada como "position" en todo
-- este archivo (definición de columna, CHECK, listas de columnas de
-- INSERT/SELECT y SET de ON CONFLICT).
ALTER TABLE lg_org_users
  ADD COLUMN IF NOT EXISTS full_name   text,
  ADD COLUMN IF NOT EXISTS phone       text,
  ADD COLUMN IF NOT EXISTS "position"  text,
  ADD COLUMN IF NOT EXISTS created_at  timestamptz NOT NULL DEFAULT now();

ALTER TABLE lg_org_users DROP CONSTRAINT IF EXISTS lg_org_users_position_check;
ALTER TABLE lg_org_users
  ADD CONSTRAINT lg_org_users_position_check
  CHECK ("position" IS NULL OR "position" IN ('PRESIDENTE', 'SECRETARIO', 'TESORERO'));

-- ── 2) lg_org_admin_invites ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lg_org_admin_invites (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  email       text        NOT NULL,
  org_id      uuid        NOT NULL,
  full_name   text        NOT NULL,
  phone       text,
  "position"  text,
  invited_by  uuid        NOT NULL,
  token_hash  text        NOT NULL UNIQUE,
  user_id     uuid,          -- se rellena si el usuario ya existía al invitar
  accepted_at timestamptz,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lg_org_admin_invites DROP CONSTRAINT IF EXISTS lg_org_admin_invites_position_check;
ALTER TABLE public.lg_org_admin_invites
  ADD CONSTRAINT lg_org_admin_invites_position_check
  CHECK ("position" IS NULL OR "position" IN ('PRESIDENTE', 'SECRETARIO', 'TESORERO'));

CREATE INDEX IF NOT EXISTS lg_org_admin_invites_org_idx   ON public.lg_org_admin_invites (org_id);
CREATE INDEX IF NOT EXISTS lg_org_admin_invites_email_idx ON public.lg_org_admin_invites (email);

ALTER TABLE public.lg_org_admin_invites DISABLE ROW LEVEL SECURITY;

-- ── fn_invite_org_admin ────────────────────────────────────────────────────
-- Token generado en JS (crypto.randomBytes) — no requiere pgcrypto.
-- Recibe token_hash y expires_at pre-calculados. Mismo patrón que
-- fn_invite_club_admin, sumando los 3 campos de perfil.
-- Retorna: { is_new, user_id }
CREATE OR REPLACE FUNCTION public.fn_invite_org_admin(
  p_email      text,
  p_org_id     uuid,
  p_full_name  text,
  p_phone      text,
  p_position   text,
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

  -- Limpiar invitaciones previas pendientes para este email+org
  DELETE FROM public.lg_org_admin_invites
  WHERE lower(email) = lower(p_email) AND org_id = p_org_id AND accepted_at IS NULL;

  INSERT INTO public.lg_org_admin_invites
    (email, org_id, full_name, phone, "position", invited_by, token_hash, user_id, expires_at)
  VALUES
    (lower(p_email), p_org_id, p_full_name, p_phone, p_position, p_inviter_id, p_token_hash, v_user_id, p_expires_at);

  -- Si ya existe → asignar rol de inmediato
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.lg_org_users (org_id, user_id, role, full_name, phone, "position")
    VALUES (p_org_id, v_user_id, 'ADMIN', p_full_name, p_phone, p_position)
    ON CONFLICT (org_id, user_id, role) DO UPDATE
      SET full_name  = EXCLUDED.full_name,
          phone      = EXCLUDED.phone,
          "position" = EXCLUDED."position";
  END IF;

  RETURN jsonb_build_object(
    'is_new',  v_user_id IS NULL,
    'user_id', v_user_id
  );
END;
$$;

-- ── fn_get_org_admins ───────────────────────────────────────────────────────
-- Retorna usuarios con rol ADMIN de una organización, incluyendo su email
-- y perfil. Mismo patrón que fn_get_club_admins.
CREATE OR REPLACE FUNCTION public.fn_get_org_admins(p_org_id uuid)
RETURNS TABLE(user_id uuid, email text, full_name text, phone text, "position" text, assigned_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  RETURN QUERY
  SELECT  ou.user_id,
          u.email,
          ou.full_name,
          ou.phone,
          ou."position",
          ou.created_at AS assigned_at
  FROM    public.lg_org_users ou
  JOIN    auth.users u ON u.id = ou.user_id
  WHERE   ou.org_id     = p_org_id
    AND   ou.role       = 'ADMIN'
    AND   u.deleted_at IS NULL
  ORDER BY ou.created_at DESC;
END;
$$;

-- ── fn_accept_org_admin_invite ────────────────────────────────────────────
-- Acepta una invitación: asigna ADMIN (con perfil) y marca el invite como
-- aceptado. Recibe p_token_hash pre-calculado en JS con SHA-256.
-- FOR UPDATE: cierra la ventana de carrera entre dos aceptaciones
-- concurrentes del mismo token (mismo refuerzo aplicado en
-- migrations/003_player_users.sql, T-20260828-103923).
CREATE OR REPLACE FUNCTION public.fn_accept_org_admin_invite(p_token_hash text, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_record public.lg_org_admin_invites%ROWTYPE;
BEGIN
  SELECT * INTO v_record
  FROM public.lg_org_admin_invites
  WHERE token_hash = p_token_hash AND expires_at > now() AND accepted_at IS NULL
  LIMIT 1
  FOR UPDATE;

  IF v_record.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_INVITE');
  END IF;

  INSERT INTO public.lg_org_users (org_id, user_id, role, full_name, phone, "position")
  VALUES (v_record.org_id, p_user_id, 'ADMIN', v_record.full_name, v_record.phone, v_record."position")
  ON CONFLICT (org_id, user_id, role) DO UPDATE
    SET full_name  = EXCLUDED.full_name,
        phone      = EXCLUDED.phone,
        "position" = EXCLUDED."position";

  UPDATE public.lg_org_admin_invites
  SET accepted_at = now(), user_id = p_user_id
  WHERE id = v_record.id;

  RETURN jsonb_build_object('success', true, 'org_id', v_record.org_id);
END;
$$;

-- ── Permisos ──────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.fn_invite_org_admin(text, uuid, text, text, text, uuid, text, timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_get_org_admins(uuid)                                                     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_accept_org_admin_invite(text, uuid)                                      TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
