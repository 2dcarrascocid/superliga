# Plan — T-20260828-103923

**Timestamp:** 2026-08-28
**Rol:** agent_orchestrator (ejecutado manualmente — la skill no está registrada
como invocable en esta sesión, se sigue su SKILL.md al pie de la letra)

## Objetivo
Módulo de vista "Jugador": un rol de usuario nuevo que se loguea con Google
(Gmail), vinculado a un `lg_players` específico, con acceso muy acotado.

## Requerimiento textual del usuario
1. El administrador del club podrá agregar el correo del jugador, con el cual
   el jugador se logueará con Gmail.
2. El jugador podrá modificar su nombre y apellido, nunca el RUT.
3. El jugador podrá ver solo la serie a la que pertenece.
4. El jugador podrá ver la tabla de posiciones, goleadores y fairplay del
   club, torneo y temporada donde participa.

## Estado previo (confirmado por Explore + queries directas a la DB real)
- **Auth**: login con Google ya existe (`auth_specialist.js::_loginOAuth`,
  `supabase.auth.signInWithIdToken`) — sin whitelist, cualquier cuenta de
  Gmail puede loguearse. La diferenciación de rol se hace 100% por la
  existencia de filas en tablas puente (`lg_org_users`, `lg_club_users`), NO
  por RLS (todas las tablas tienen políticas permisivas `USING(true)` — la
  autorización real vive en JS, en cada Specialist, vía helpers como
  `assertClubAccess` en `adf/specialists/lib/club_access.js`).
- **Precedente directo a replicar**: `backend-liga/migrations/002_club_admins.sql`
  (`lg_club_invites` + `fn_invite_club_admin`/`fn_accept_club_invite`) y su
  orquestación en `auth_specialist.js` (`INVITE_INFO`/`ACCEPT_CLUB_INVITE`).
- **`lg_players`**: confirmado por query directa a Supabase — tiene columnas
  `rut` (la real, poblada, formato "14747104-8") y `national_id` (siempre
  `null`, columna muerta/legacy, ignorar). `email` ya existe pero **ningún
  jugador lo tiene cargado hoy** — es 100% funcionalidad nueva.
  `_updatePlayer` (uso de club admin) ya excluye `rut` de sus campos
  editables — no hay que "proteger" ese campo ahí, pero el UPDATE del propio
  jugador necesita su propia whitelist mucho más chica (`first_name`,
  `last_name` únicamente).
- **`lg_club_rosters`**: vínculo jugador↔club↔serie. Columnas relevantes:
  `player_id, club_id, series_id, status (club), series_status, club_folio`.
  De acá se resuelve "mi serie" (roster ACTIVE del jugador).
- **Standings/goleadores/fairplay**: `GET_STANDINGS`, `GET_TOP_SCORERS`,
  `GET_FAIRPLAY_RANKING` (dominios `tournaments`/`matches`) YA son de lectura
  abierta a cualquier usuario autenticado en el backend — sin cambios de
  backend necesarios ahí. El bloqueo hoy es 100% de frontend: esas rutas
  tienen `meta: { orgAdminOnly: true }`.
- **Router guard**: hoy cualquier usuario sin `org` ni `club` es mandado a
  `/bootstrap` (`requiresNoOrg: true`). Hay que agregar el caso "usuario con
  `player` vinculado" para mandarlo a su propio dashboard en cambio.

## Decisiones de diseño
1. **`lg_player_users (id, player_id, user_id, role='JUGADOR', created_at,
   updated_at)`**, UNIQUE(player_id, user_id) y UNIQUE(user_id) — un login
   de Google se vincula a un solo jugador (mismo criterio 1:1 que
   `lg_club_users` para ADMIN_CLUB).
2. **`lg_player_invites`**, mismo shape que `lg_club_invites` pero con
   `player_id` en vez de `club_id`: `email, player_id, invited_by,
   token_hash UNIQUE, user_id nullable, accepted_at, expires_at`.
   Funciones SQL `fn_invite_player`/`fn_accept_player_invite`
   /`fn_get_player_link`, mismo patrón `SECURITY DEFINER` que
   `002_club_admins.sql`.
3. **Nuevo helper `assertPlayerAccess(playerId, userId, db)`** en
   `adf/specialists/lib/` — autoriza si: (a) el userId es ADMIN de la org
   del jugador, (b) ADMIN_CLUB del club del jugador, o (c) el propio jugador
   (fila en `lg_player_users` con ese `player_id`+`userId`). Reutilizado en
   toda operación del rol Jugador.
4. **Nuevas capabilities** (en `players_specialist.js` y `auth_specialist.js`,
   sin nuevo specialist/dominio salvo que backend-dev vea razón de peso para
   separarlo):
   - `INVITE_PLAYER` (club admin/org admin, dispara invitación por email —
     mismo flujo que `INVITE_CLUB_ADMIN`).
   - `ACCEPT_PLAYER_INVITE` (público, mismo patrón que `ACCEPT_CLUB_INVITE`).
   - `GET_MY_PLAYER_PROFILE` (resuelve userId → jugador vinculado → club →
     roster ACTIVE → serie → torneo(s) activos de esa serie vía
     `lg_tournament_teams`, para que el frontend sepa qué `tournamentId`
     pasarle a standings/goleadores/fairplay).
   - `UPDATE_MY_PLAYER_PROFILE` (whitelist: SOLO `first_name`, `last_name`;
     usa `assertPlayerAccess` en modo "soy yo mismo").
5. **Frontend**: vistas nuevas para el rol Jugador (perfil propio editable,
   "mi serie", standings/goleadores/fairplay de su torneo activo sin
   `orgAdminOnly`), acción "Invitar jugador por email" en la ficha del
   jugador (vista de club admin), y ajuste del guard de router para
   reconocer el caso "usuario con player vinculado".

## Capas y orden
1. **DB** (db-architect): migración con `lg_player_users`, `lg_player_invites`,
   funciones SQL, RLS consistente con el resto del schema.
2. **Backend** (backend-dev): `assertPlayerAccess`, las 4 capabilities nuevas,
   rutas en `handler.js`.
3. **Frontend** (frontend-dev): UI de invitación (club admin), vistas del
   rol Jugador, ajuste de router/guard/store de auth.
4. **Validación**: `security-reviewer` es OBLIGATORIO acá (rol nuevo +
   control de acceso nuevo + invitación por email = superficie de auth) y
   `qa-tester` contra los 4 puntos del requerimiento.
5. **Evidencia**: este archivo + outputs de cada Specialist + validación.

## Cierre

**Status final: done.** DB → backend → frontend implementados (incluye,
como hallazgo del propio orchestrator, la integración real de Google
Identity Services en el frontend — el login con Google estaba mockeado
hasta esta tarea). QA aprobó los 4 puntos del requerimiento (evidencia en
`qa-report.md`), con una salvedad no bloqueante sobre el punto 4: los
endpoints de standings/goleadores/fairplay no validan pertenencia al
torneo — gap pre-existente, no introducido por esta tarea, dejado
explícitamente fuera de alcance. Security-reviewer aprobó sin hallazgos
críticos ni altos (`security-review.md`); el único hallazgo de severidad
baja (race condition sin `FOR UPDATE` en `fn_accept_player_invite`) se
corrigió directamente en la migración antes de aplicarla a la base real.
Backend: 46/46 tests. Frontend: build exitoso (Node 20 — el sandbox usa
Node 16 por defecto vía nvm, incompatible con `@supabase/supabase-js`/Vite,
hay que anteponer `PATH="/c/nvm4w/v20.20.0:$PATH"` a los comandos npm).

**Pendiente de aplicar**: `backend-liga/migrations/003_player_users.sql`
todavía no se ejecutó contra la base real de Supabase.
