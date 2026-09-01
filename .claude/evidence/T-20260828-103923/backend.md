# Backend — T-20260828-103923

**Timestamp:** 2026-08-28
**Rol:** backend-dev
**Status:** done

## Resumen

Implementadas las 4 capabilities del rol "Jugador" descritas en `plan.md`,
sobre el schema ya aplicado por db-architect en
`backend-liga/migrations/003_player_users.sql` (`lg_player_users`,
`lg_player_invites`, `fn_invite_player`, `fn_accept_player_invite`,
`fn_get_player_link`). Todo el trabajo quedó dentro de `backend-liga/`, sin
tocar frontend ni el schema de DB.

### 1. `backend-liga/adf/specialists/players_specialist.js`
Capabilities nuevas agregadas a `CAPABILITIES` y al switch de `execute()`:
- **`INVITE_PLAYER`** (`_invitePlayer`): club admin/org admin vincula el
  email de un jugador. Resuelve `existing.club_id` del jugador y llama
  `assertClubAccess(existing.club_id, userId, db)` (mismo patrón que
  `_updatePlayer`). Genera `token = crypto.randomBytes(32).toString('hex')`
  + `tokenHash = sha256(token)` + `expiresAt` a **7 días** (mismo TTL que
  `INVITE_CLUB_ADMIN` en `clubs_specialist.js`). Llama
  `db.rpc('fn_invite_player', {...})` y envía el mail vía
  `sendPlayerInviteEmail` (nueva función en `utils/mailer.js`). El link
  apunta a `${FRONTEND_URL}/aceptar-invitacion-jugador?token=...`.
- **`GET_MY_PLAYER_PROFILE`** (`_getMyPlayerProfile`): sin input además del
  `userId` del JWT. Resuelve `lg_player_users.user_id = userId` → `player_id`
  (si no hay fila → `NOT_A_PLAYER`). Trae `lg_players` completo, el roster
  ACTIVE del jugador en `lg_club_rosters` (puede ser `null` si el jugador
  aún no tiene roster asignado — no es error), y si el roster tiene
  `series_id`, trae la serie (`lg_club_series`) y los torneos donde esa
  serie está inscrita vía `lg_tournament_teams` (join a `lg_tournaments`).
  No se filtró por temporada activa de la organización (el plan lo dejaba
  opcional/"no complicarse si no es trivial") — se devuelven **todos** los
  torneos donde la serie está inscrita; el frontend puede filtrar por
  `season_id`/`status` si lo necesita.
- **`UPDATE_MY_PLAYER_PROFILE`** (`_updateMyPlayerProfile`): resuelve el
  `player_id` igual que `GET_MY_PLAYER_PROFILE` (`NOT_A_PLAYER` si no hay
  vínculo). Whitelist estricta por **destructuring** de la firma del método
  (`{ firstName, lastName }`) — cualquier otro campo del payload (`rut`,
  `email`, `club_id`, etc.) nunca llega a tocar el patch de `UPDATE`, se
  ignora en silencio (no se rechaza la request). Sin campos válidos →
  `NO_FIELDS`.

### 2. `backend-liga/adf/specialists/auth_specialist.js`
- Nueva capability **`ACCEPT_PLAYER_INVITE`** (`_acceptPlayerInvite`),
  agregada a `PUBLIC_OPERATIONS`. Input `{ token, idToken }`. A diferencia
  de `_acceptClubInvite` (password, distingue signUp/signIn manualmente),
  el rol Jugador se loguea **siempre con Google**: se llama
  `supabase.auth.signInWithIdToken({ provider: 'google', token: idToken })`
  (mismo mecanismo que `LOGIN_GOOGLE`), que crea la cuenta si no existe o
  loguea si ya existe, en un solo paso — no hace falta distinguir usuario
  nuevo/existente como en el flujo de contraseña. Antes de tocar Auth,
  valida que el invite exista, no esté aceptado y no haya expirado
  (`INVALID_INVITE`). Después del login OAuth, si el email de la cuenta de
  Google no coincide con el email invitado → `EMAIL_MISMATCH` (evita que
  cualquier cuenta de Google acepte la invitación de otra persona). Luego
  llama `supabase.rpc('fn_accept_player_invite', { p_token_hash, p_user_id
  })` y retorna `{ session, user, playerId }` (mismo shape que login, para
  que el frontend loguee directo tras aceptar).

### 3. Manejo del caso borde de índice único (aviso del orchestrator)
`lg_player_users` tiene `UNIQUE(player_id, user_id)` + índice único
adicional solo sobre `user_id` (1 login = 1 jugador). Si una cuenta ya
vinculada a un jugador distinto intenta vincularse a otro, el
`INSERT...ON CONFLICT(player_id, user_id)` de las funciones SQL no matchea
ese conflicto y Postgres devuelve `23505`. Se capturó explícitamente en
**ambos** puntos donde puede ocurrir:
- `auth_specialist.js::_acceptPlayerInvite` → si `db.rpc('fn_accept_player_invite', ...)`
  devuelve `error.code === '23505'` → `errorCode: 'USER_ALREADY_LINKED_TO_ANOTHER_PLAYER'`.
- `players_specialist.js::_invitePlayer` → mismo caso puede ocurrir dentro
  de `fn_invite_player` cuando el email invitado ya pertenece a un
  `auth.users` vinculado a OTRO jugador (esa función vincula de inmediato si
  el usuario ya existe) → mismo `errorCode: 'USER_ALREADY_LINKED_TO_ANOTHER_PLAYER'`.

Ninguno de los dos casos deja propagar un error crudo de Postgres ni un 500
genérico.

### 4. `backend-liga/adf/specialists/lib/player_access.js` (nuevo)
`assertPlayerAccess(playerId, userId, db)`, mismo estilo que
`club_access.js`. Autoriza si: (a) `userId` es ADMIN de la org del jugador,
(b) ADMIN_CLUB del club actual del jugador (ambos resueltos reusando
`assertClubAccess(player.club_id, userId, db)`), o (c) el propio jugador
(fila en `lg_player_users` con ese `player_id` + `userId`). **No se usa
todavía** en `GET_MY_PLAYER_PROFILE`/`UPDATE_MY_PLAYER_PROFILE` — esas dos
operaciones no reciben `playerId` en el payload, resuelven "soy yo mismo"
directo vía `lg_player_users.user_id = userId` (más simple y no da pie a que
alguien pase un `playerId` ajeno). Queda documentado y listo en el archivo
para operaciones futuras donde un club admin necesite actuar sobre el
perfil de un jugador puntual pasando su `playerId` explícito.

### 5. `backend-liga/utils/mailer.js`
Nueva función `sendPlayerInviteEmail(toEmail, playerName, clubName,
inviteLink)` — mismo template/estilo visual que `sendClubAdminInviteEmail`,
adaptado: el CTA dice "Aceptar invitación con Google" (no "crear
contraseña", porque el rol Jugador nunca usa password) y el aviso de
expiración dice 7 días (mismo TTL que el invite de club admin).

### 6. `backend-liga/handler.js`
Rutas nuevas (ver contrato completo abajo). **Importante sobre orden**:
`GET /players/me` y `PATCH /players/me` se registraron **antes** de
`GET /players/{playerId}` y `PATCH /players/{playerId}` en el array
`ROUTES` — el router hace matching secuencial por regex y ambos patrones
matchean la misma forma de 2 segmentos (`/players/xxx`); si `{playerId}`
quedara primero, `/players/me` se interpretaría como `playerId: "me"`.

### 7. `backend-liga/adf/orchestrator/agent_orchestrator.js`
`ACCEPT_PLAYER_INVITE` agregado al `Set` `PUBLIC_OPERATIONS` (no requiere
JWT previo — es exactamente el paso que genera el JWT).

### 8. `backend-liga/adf/validators/request_validator.js`
Reglas agregadas al catálogo `ValidationRules`:
- `players.INVITE_PLAYER`: `playerId` (uuid, requerido), `email` (email, requerido).
- `auth.ACCEPT_PLAYER_INVITE`: `token` (string, minLength 10, requerido),
  `idToken` (string, minLength 20, requerido).

`GET_MY_PLAYER_PROFILE`/`UPDATE_MY_PLAYER_PROFILE` no tienen entrada en el
catálogo (no tienen campos estructuralmente requeridos, mismo criterio que
otras operaciones "sobre el propio usuario" del proyecto) —
`ValidationRules[domain]?.[type] || []` maneja el caso sin reglas.

### 9. Tests (`node --test`)
- `adf/specialists/__tests__/test_utils/mock_db.js` extendido de forma
  **aditiva** (no rompe ningún test existente) con soporte para `.rpc(fnName,
  params)`: se agrega la clave especial `queues.rpc = { fnName: [...] }`
  (mismo mecanismo FIFO que las tablas) y el callback opcional `onRpc`.
  Necesario porque `INVITE_PLAYER`/`ACCEPT_PLAYER_INVITE` llaman a
  `db.rpc(...)` y el mock no lo soportaba todavía.
- `adf/specialists/__tests__/players_specialist_player_role.test.js` (9 tests):
  `INVITE_PLAYER` → `FORBIDDEN` sin acceso al club (y confirma que el RPC
  **no** se llega a invocar), `PLAYER_NOT_FOUND`, y el caso borde
  `USER_ALREADY_LINKED_TO_ANOTHER_PLAYER` (RPC devuelve `23505`).
  `GET_MY_PLAYER_PROFILE` → `NOT_A_PLAYER` sin vínculo, perfil con
  roster/club/series/tournaments en `null`/`[]` sin roster activo, y perfil
  completo con club+serie+torneos cuando hay roster con serie asignada.
  `UPDATE_MY_PLAYER_PROFILE` → `NOT_A_PLAYER` sin vínculo, `NO_FIELDS` sin
  `firstName`/`lastName`, y **test explícito de la whitelist**: se envían
  `rut`, `email`, `club_id`/`clubId` junto con `firstName`/`lastName` y se
  verifica (capturando el payload exacto de `.update()` vía `onUpdate`) que
  el patch aplicado es *exactamente* `{ first_name, last_name }`, sin rastro
  de los otros campos.
- `adf/specialists/__tests__/auth_specialist_accept_player_invite.test.js`
  (4 tests): `INVALID_INVITE` sin invite, `EMAIL_MISMATCH` cuando la cuenta
  de Google no coincide con el email invitado, el caso borde
  `USER_ALREADY_LINKED_TO_ANOTHER_PLAYER` (RPC `fn_accept_player_invite`
  devuelve `23505`), y el caso feliz (retorna `session`/`user`/`playerId`).
  Se mockeó `supabase.auth.signInWithIdToken` con un wrapper local sobre
  `createMockDb` (no se tocó `mock_db.js` para esto, es específico de auth).
- No se ejercitó el camino feliz de `INVITE_PLAYER` (que sí llega a llamar
  `sendPlayerInviteEmail`) para no disparar una conexión SMTP real durante
  los tests — mismo motivo por el que no hay tests previos de
  `INVITE_CLUB_ADMIN` en el repo. El caso `USER_ALREADY_LINKED_TO_ANOTHER_PLAYER`
  de `INVITE_PLAYER` sí se cubre porque el error del RPC corta el flujo
  antes de llegar al envío de mail.

**Resultado:** `npm test` en `backend-liga/` → los 2 archivos nuevos pasan
completos (13 tests nuevos, 0 fallas) y los archivos preexistentes que sí
corren en este entorno (`ledger.test.js`, `tournaments_specialist.test.js`)
siguen en verde. **Nota de entorno, no regresión introducida por esta
tarea:** `adf/adapters/__tests__/lambda_adapter.test.js` falla en este
entorno (`ReferenceError: Headers is not defined` al construir el cliente
real de `@supabase/supabase-js` desde `services/db.js`, por correr en
Node 16 — la librería exige Node 18+/20+). Confirmado con `git stash` que
esta falla **ya existía en el baseline antes de esta tarea** (no la causó
ningún cambio de este trabajo); no se tocó ese archivo ni `services/db.js`.
No pude reproducir el "32/32" mencionado en el encargo en este entorno
puntual por el mismo problema de versión de Node, no por regresiones.

## Decisiones de diseño

1. **`ACCEPT_PLAYER_INVITE` usa `signInWithIdToken` en vez de
   `signUp`/`signIn` manual.** El flujo de club admin (`_acceptClubInvite`)
   distingue usuario nuevo/existente porque usa contraseña. El rol Jugador
   solo usa Google — `signInWithIdToken` ya resuelve "crear si no existe,
   loguear si existe" de forma atómica (mismo mecanismo que `LOGIN_GOOGLE`),
   por lo que no hace falta esa distinción ni un paso de confirmación de
   email (`fn_confirm_user_email`) — Google ya garantiza el email verificado.
2. **`EMAIL_MISMATCH` como chequeo adicional no pedido explícitamente en el
   encargo, pero necesario por consistencia de seguridad**: sin él, el
   `token_hash` de la URL sería la única barrera — cualquiera con el link
   (reenviado, filtrado, etc.) podría loguearse con SU PROPIA cuenta de
   Google y vincularse al jugador ajeno. Se comparan `invite.email` vs
   `oauthData.user.email` (case-insensitive) antes de llamar al RPC.
3. **`GET_MY_PLAYER_PROFILE` no filtra torneos por temporada activa de la
   organización.** El plan lo dejaba explícitamente opcional ("no te
   compliques si no es trivial, devolvé todos y que el frontend filtre").
   Derivar la temporada activa de la organización desde el jugador hubiera
   requerido resolver `player.org_id → lg_seasons.active`, agregando una
   query más sin necesidad de negocio urgente — se documenta acá para que
   frontend-dev decida si filtra client-side por `season_id`/`status`.
4. **`_invitePlayer` no valida "email ya usado por otro jugador de ESTE
   club"** (a diferencia de `INVITE_CLUB_ADMIN`, que sí tiene la regla de
   negocio "un admin solo puede administrar un club"). No hay una regla de
   negocio equivalente documentada en el plan para jugadores — un mismo
   jugador puede en teoría no tener email único a nivel de negocio (la
   migración no puso `UNIQUE` en `lg_players.email`). El único control real
   es el índice único de `lg_player_users.user_id` (1 login = 1 jugador),
   que si se llega a violar se mapea a `USER_ALREADY_LINKED_TO_ANOTHER_PLAYER`.
5. **`mock_db.js` extendido en vez de crear un mock nuevo para `.rpc()`.**
   Se agregó de forma aditiva (clave especial `queues.rpc`) para no duplicar
   la utilidad y mantener el mismo patrón FIFO ya usado por `.from()`. No
   afecta ningún test existente (ninguno usaba antes una tabla llamada
   `"rpc"` ni llamaba a `.rpc()`).

## Contrato de API completo

```
POST /players/{playerId}/invite
  Auth: requiere JWT. Autorización: assertClubAccess(club_id del jugador, userId) —
        ADMIN de la organización del club, o ADMIN_CLUB de ese club puntual.
  body: { email }
  → 200 { invited: true, isNewUser: boolean, email: string }
  errores:
    MISSING_EMAIL            — falta email en el body
    PLAYER_NOT_FOUND         — playerId no existe
    FORBIDDEN                — sin acceso al club del jugador
    CLUB_NOT_FOUND           — el club del jugador ya no existe (dato inconsistente)
    USER_ALREADY_LINKED_TO_ANOTHER_PLAYER — el email invitado ya pertenece a una
                                cuenta de Google vinculada a OTRO jugador
    INVITE_FAILED            — error de DB no clasificado al invocar fn_invite_player

POST /auth/accept-player-invite   (PÚBLICA — no requiere JWT previo)
  body: { token, id_token | idToken }   (idToken: JWT de Google ya obtenido en frontend)
  → 200 { session, user, playerId }     (mismo shape que login — loguear directo tras aceptar)
  errores:
    INVALID_INVITE                 — token inexistente, ya aceptado, o expirado
    OAUTH_FAILED                   — signInWithIdToken de Supabase falló (idToken inválido/expirado)
    EMAIL_MISMATCH                 — la cuenta de Google no coincide con el email invitado
    USER_ALREADY_LINKED_TO_ANOTHER_PLAYER — esta cuenta de Google ya está vinculada a otro jugador
    ACCEPT_INVITE_FAILED           — error de DB no clasificado al invocar fn_accept_player_invite

GET /players/me
  Auth: requiere JWT. Sin permisos adicionales — resuelve el jugador del propio usuario.
  → 200 {
      player: { id, org_id, club_id, first_name, last_name, rut, birth_date,
                address, phone, email, photo_url, position, category_id,
                club_folio, ... (fila completa de lg_players) },
      roster: { id, club_id, series_id, series_status, club_folio, status } | null,
      club:   { id, name, short_name, logo_url, colors } | null,
      series: { id, name, description, category_id, min_age, age_restriction, active } | null,
      tournaments: [ { id, name, status, season_id } ]   // [] si no hay serie/roster activo
    }
  errores:
    NOT_A_PLAYER      — la cuenta autenticada no tiene fila en lg_player_users
    PLAYER_NOT_FOUND  — el player_id vinculado ya no existe en lg_players (dato inconsistente)

PATCH /players/me
  Auth: requiere JWT.
  body: { first_name?, last_name? }   — whitelist ESTRICTA, cualquier otro campo
        (rut, email, club_id, etc.) se ignora en silencio, no rechaza la request.
  → 200 { player: <fila completa actualizada de lg_players> }
  errores:
    NOT_A_PLAYER            — sin vínculo en lg_player_users
    NO_FIELDS               — ni first_name ni last_name vinieron en el body
    UPDATE_PLAYER_FAILED    — error de DB al hacer el UPDATE
```

## Checklist
- [x] Lógica implementada y testeada (13 tests nuevos, `npm test` en
      `backend-liga/`, sin regresiones en los suites que corren en este
      entorno; ver nota sobre `lambda_adapter.test.js` — preexistente, no
      causada por esta tarea)
- [x] Sin secretos hardcodeados
- [x] Contrato de API documentado arriba
- [x] Sin cambios fuera de `backend-liga/` (no se tocó DB/migraciones ni frontend)
- [x] No se tocó `_updatePlayer` ni sus campos editables existentes
- [x] No se tocaron `GET_STANDINGS`/`GET_TOP_SCORERS`/`GET_FAIRPLAY_RANKING`

## Fuera de alcance (no tocado, según instrucciones)
- Frontend (rutas `/aceptar-invitacion-jugador`, guard de router, vistas del
  rol Jugador, botón "Invitar jugador" en la ficha de club admin) — queda
  para frontend-dev.
- Schema/migraciones — ya aplicado por db-architect en
  `backend-liga/migrations/003_player_users.sql`. **Pendiente de correr en
  Supabase real** según lo documentado en `db.md` de esta misma tarea (no se
  ejecutó en el entorno de db-architect por falta de credenciales directas)
  — necesario ejecutarla antes de probar estas capabilities contra la base
  real.

## Coordinación pendiente (para el orchestrator)
1. Confirmar que `migrations/003_player_users.sql` ya corrió en Supabase
   real (bloqueante para probar `INVITE_PLAYER`/`ACCEPT_PLAYER_INVITE` end
   to end — sin las tablas/funciones, `db.rpc('fn_invite_player', ...)`
   devolvería un error de "function does not exist").
2. Siguiente paso: frontend-dev (vistas del rol Jugador, guard de router,
   UI de invitación en ficha de club admin) y luego security-reviewer /
   qa-tester según el plan (el propio plan marca security-reviewer como
   OBLIGATORIO por ser rol nuevo + invitación por email).

```yaml
task_id: T-20260828-103923
layer: backend
status: done
changes:
  - backend-liga/adf/specialists/players_specialist.js
  - backend-liga/adf/specialists/auth_specialist.js
  - backend-liga/adf/specialists/lib/player_access.js
  - backend-liga/adf/orchestrator/agent_orchestrator.js
  - backend-liga/adf/validators/request_validator.js
  - backend-liga/utils/mailer.js
  - backend-liga/handler.js
  - backend-liga/adf/specialists/__tests__/test_utils/mock_db.js
  - backend-liga/adf/specialists/__tests__/players_specialist_player_role.test.js
  - backend-liga/adf/specialists/__tests__/auth_specialist_accept_player_invite.test.js
api_contract: "POST /players/{playerId}/invite (club/org admin, body {email}) | POST /auth/accept-player-invite PÚBLICA (body {token, id_token}, retorna {session,user,playerId}) | GET /players/me (retorna {player,roster,club,series,tournaments}) | PATCH /players/me (body {first_name?,last_name?} whitelist estricta) — códigos de error nuevos: NOT_A_PLAYER, USER_ALREADY_LINKED_TO_ANOTHER_PLAYER, EMAIL_MISMATCH, MISSING_EMAIL, NO_FIELDS. Contrato completo con shapes de respuesta en el cuerpo de este documento."
notes: "13 tests nuevos (node --test), 0 fallas, sin tocar DB/migraciones ni frontend. Caso borde de índice único (usuario ya vinculado a otro jugador) manejado tanto en INVITE_PLAYER como en ACCEPT_PLAYER_INVITE con errorCode USER_ALREADY_LINKED_TO_ANOTHER_PLAYER. lambda_adapter.test.js falla en este entorno por Node 16 vs requerimiento de @supabase/supabase-js (Node 18+) — confirmado preexistente vía git stash, no es regresión de esta tarea."
```
