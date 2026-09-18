-- ============================================================
-- Fix: 20260918_fn_get_org_admins_fix_types
-- Descripción: fn_get_org_admins (definida en
--              20260918_lg_org_admins.sql) falla con "structure of query
--              does not match function result type" — mismo problema ya
--              visto y resuelto en fn_get_club_admins
--              (20260814_fn_get_club_admins_fix_types.sql): el SELECT
--              interno no castea explícitamente a los tipos declarados en
--              RETURNS TABLE, y alguna columna real (lg_org_users.role si
--              es un enum, o created_at si no es exactamente timestamptz)
--              no matchea exacto.
--
--              Además "position" es palabra reservada en Postgres
--              (colisiona con la función POSITION(substring IN string)) —
--              debe ir citada como "position" en todo el SQL crudo
--              (tanto en el RETURNS TABLE como en el SELECT). Ya se
--              corrigió lo mismo en 20260918_lg_org_admins.sql.
--
--              Redefine la función casteando cada columna al tipo
--              declarado, sin importar el tipo real subyacente. Operación
--              no destructiva (solo redefine la función, no toca datos).
-- Fecha: 2026-09-18
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_get_org_admins(p_org_id uuid)
RETURNS TABLE(user_id uuid, email text, full_name text, phone text, "position" text, assigned_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  RETURN QUERY
  SELECT  ou.user_id::uuid,
          u.email::text,
          ou.full_name::text,
          ou.phone::text,
          ou."position"::text,
          ou.created_at::timestamptz AS assigned_at
  FROM    public.lg_org_users ou
  JOIN    auth.users u ON u.id = ou.user_id
  WHERE   ou.org_id      = p_org_id
    AND   ou.role::text  = 'ADMIN'
    AND   u.deleted_at IS NULL
  ORDER BY ou.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_get_org_admins(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
