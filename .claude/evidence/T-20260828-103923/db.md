# DB — T-20260828-103923

**Timestamp:** 2026-08-28
**Layer:** db
**Status:** done

## Migración creada

`backend-liga/migrations/003_player_users.sql`

Sigue la numeración/carpeta existente (`migrations/001_password_reset_system.sql`,
`migrations/002_club_admins.sql`) — no `sql/migrations/`, siguiendo la
instrucción explícita de replicar el precedente `002_club_admins.sql`.
Ejecutar manualmente en Supabase → SQL Editor (mismo mecanismo que 001/002,
este proyecto no tiene servidor Postgres local para correr migraciones
automáticamente — confirmado en `CLAUDE.md` raíz). No pude ejecutarla contra
la base real (no tengo credenciales de conexión directa en este entorno);
la validé por revisión estática + verificación de tipos/columnas contra
migraciones ya aplicadas (`sql/migrations/20260325_lg_player_documents.sql`,
`20260808_transfers_kpis.sql` confirman `lg_players.id uuid` y el patrón
`REFERENCES lg_players(id) ON DELETE CASCADE`).

## Objetos agregados

### Tabla `lg_player_users`
Vínculo 1:1 entre `auth.users` (`user_id`, sin FK cross-schema — mismo
criterio que `lg_club_users.user_id`, confirmado revisando
`adf/specialists/lib/club_access.js`) y `lg_players` (`player_id`, FK con
`ON DELETE CASCADE`).
- `role text NOT NULL DEFAULT 'JUGADOR'`
- `UNIQUE(player_id, user_id)` + índice único adicional `idx_player_users_one_player_per_user`
  sobre `user_id` solo (no parcial por rol, a diferencia de
  `idx_club_users_admin_club_one_per_user`, porque `lg_player_users` solo
  maneja el rol JUGADOR) — un login de Google queda vinculado a un único jugador.

### Tabla `lg_player_invites`
Mismo shape que `lg_club_invites` pero con `player_id` (FK a `lg_players`,
`ON DELETE CASCADE`) en vez de `club_id` (que en el original no tiene FK).
`invited_by` sin FK cross-schema, `token_hash UNIQUE`, `user_id` nullable,
`accepted_at` nullable, `expires_at NOT NULL`.

### Funciones (`SECURITY DEFINER`, `search_path = auth, public`)
- `fn_invite_player(p_email, p_player_id, p_inviter_id, p_token_hash, p_expires_at)`:
  limpia invites pendientes previos del mismo email+jugador, crea el invite,
  **siempre** actualiza `lg_players.email` con el correo cargado por el
  admin (exista o no ya el usuario en `auth.users`), y si el usuario ya
  existe en `auth.users` vincula de inmediato en `lg_player_users`
  (upsert vía `ON CONFLICT (player_id, user_id)`). Retorna `{is_new, user_id}`.
- `fn_accept_player_invite(p_token_hash, p_user_id)`: busca invite válido
  (no vencido, no aceptado), hace upsert en `lg_player_users`, marca
  `accepted_at` + `user_id` en el invite. Retorna `{success, player_id}` o
  `{success:false, code:'INVALID_INVITE'}`.
- `fn_get_player_link(p_player_id)`: JOIN `lg_player_users` × `auth.users`,
  devuelve `user_id/email/role/assigned_at` del/los vinculados al jugador.

Permisos: `GRANT EXECUTE ... TO anon, authenticated` en las 3 funciones
(mismo criterio que `002_club_admins.sql`).

## RLS — desviación deliberada respecto al precedente literal

`002_club_admins.sql` originalmente dejaba `lg_club_invites` con
`DISABLE ROW LEVEL SECURITY`. Verifiqué que ese estado quedó **superado**
por `sql/migrations/20260818_unify_rls_all_tables.sql`, que unifica el
criterio en TODA la app (lista explícita incluye `lg_club_invites` y
`lg_club_users`) a **RLS habilitado + políticas permisivas** (`USING(true)`
/ `WITH CHECK(true)` para `anon, authenticated`), porque el backend habla
con Supabase con una key de rol `anon` (no `service_role`), y `RLS sin
policy para anon` devuelve vacío aunque la fila exista (motivo documentado
en `sql/migrations/20260815_lg_club_invites_disable_rls.sql`, que es un fix
posterior sobre el propio `002`).

Por lo tanto, para que `lg_player_users`/`lg_player_invites` se comporten
igual que sus tablas hermanas **hoy** (no como decía el `002` original,
que quedó en drift), apliqué directamente en `003_player_users.sql` el
patrón unificado: `ENABLE ROW LEVEL SECURITY` + policies `select/insert/
update/delete` permisivas para `anon, authenticated` en ambas tablas
nuevas. La autorización real sigue viviendo en JS (helper
`assertPlayerAccess`, a implementar por backend-dev), consistente con el
resto del schema.

## Integridad referencial
- `lg_player_users.player_id` y `lg_player_invites.player_id` → FK a
  `lg_players(id) ON DELETE CASCADE`. Verificado que `lg_players.id` es
  `uuid` (mismo tipo usado en FKs existentes de otras tablas hijas de
  `lg_players`).
- `user_id`/`invited_by` sin FK a `auth.users` (cross-schema), igual que
  `lg_club_users.user_id` / `lg_club_invites.invited_by`.
- No se tocó `lg_players`, `lg_club_users`, `lg_club_invites` ni ninguna
  tabla existente — el único `UPDATE lg_players.email` ocurre dentro de
  `fn_invite_player` (parte del requerimiento de negocio, no cambio de
  schema).

## Riesgos destructivos
Ninguno. No hay `DROP`/`TRUNCATE`/`ALTER` con pérdida de datos. Los `DROP
POLICY IF EXISTS` son sobre políticas que esta misma migración crea (no
tocan políticas de otras tablas), y son idempotentes (permiten re-correr la
migración sin error, mismo criterio que `20260818_unify_rls_all_tables.sql`).

## Coordinación pendiente con backend-dev
- Implementar `assertPlayerAccess(playerId, userId, db)` en
  `adf/specialists/lib/` (o donde corresponda), análogo a `assertClubAccess`.
- Nuevas capabilities: `INVITE_PLAYER`, `ACCEPT_PLAYER_INVITE`,
  `GET_MY_PLAYER_PROFILE`, `UPDATE_MY_PLAYER_PROFILE` (whitelist
  `first_name`, `last_name` únicamente — nunca `rut`), según
  `.claude/evidence/T-20260828-103923/plan.md`.
- El backend debe llamar `fn_invite_player` / `fn_accept_player_invite` /
  `fn_get_player_link` vía RPC de Supabase, replicando el flujo ya
  existente en `auth_specialist.js` para `INVITE_CLUB_ADMIN`/
  `ACCEPT_CLUB_INVITE`.

## Checklist
- [x] Migración creada (`backend-liga/migrations/003_player_users.sql`)
- [x] Schema documentado en este output
- [x] Sin cambios fuera de `backend-liga/migrations/` (no se tocó backend
      ni frontend)
- [x] Riesgos destructivos: ninguno detectado, sin cambios irreversibles
- [ ] Probada contra Supabase real: NO ejecutada en este entorno (sin
      credenciales de conexión directa) — validada por revisión estática y
      comparación de tipos/patrones contra migraciones ya aplicadas.
      Recomendado que quien tenga acceso al SQL Editor de Supabase la
      corra y confirme antes de que backend-dev integre las capabilities.

```yaml
task_id: T-20260828-103923
layer: db
status: done
changes:
  - backend-liga/migrations/003_player_users.sql
notes: "Tablas lg_player_users y lg_player_invites + funciones fn_invite_player/fn_accept_player_invite/fn_get_player_link, replicando el patrón de 002_club_admins.sql. RLS habilitada con policies permisivas (no DISABLE), por ser el estado real vigente de las tablas hermanas tras 20260818_unify_rls_all_tables.sql. No ejecutada contra Supabase real en este entorno (sin credenciales) — pendiente de aplicar manualmente vía SQL Editor antes de que backend-dev integre las capabilities nuevas."
```
