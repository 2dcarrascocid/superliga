# Frontend — T-20260828-103923

**Timestamp:** 2026-08-28
**Rol:** frontend-dev
**Status:** done

## Resumen

Implementado el rol "Jugador" en `frontend-liga/` (Vue 3 + Vite, sin Pinia —
stores propios con `reactive`/`toRefs`), consumiendo el contrato de
`backend.md` de esta misma tarea sin asumir shapes no documentados. Se
integró Google Identity Services real (reemplazando el mock que existía en
`Login.vue`), se agregó la página pública de aceptación de invitación de
Jugador, la acción de invitar jugador en la ficha de club admin, y el
dashboard propio del Jugador con acceso acotado a standings/goleadores/
fairplay de su torneo.

### 1. Integración real de Google Identity Services
- **`src/composables/useGoogleAuth.js`** (nuevo): carga el script de GIS una
  sola vez (revisa si ya existe un `<script>` con esa src antes de
  inyectarlo de nuevo), inicializa `google.accounts.id.initialize` con
  `VITE_GOOGLE_CLIENT_ID` (ya existía en `.env`/`.env.example`, no hubo que
  agregarlo), y expone `renderButton(elementRef, options)` que pinta el
  botón oficial. Se eligió **botón renderizado explícito** por sobre
  `prompt()` (one-tap), tal como sugería el encargo, por ser más predecible
  en testing manual. El callback de Google deja `response.credential`
  (el idToken JWT) en un `ref` reactivo (`credential`) que los componentes
  observan con `watch`. No se instaló ningún paquete npm nuevo — el script
  de GIS se inyecta dinámicamente vía `<script src="https://accounts.google.com/gsi/client">`.
- **`src/views/Login.vue`**: se eliminó `mockGoogleLogin` (que llamaba a
  `authStore.loginGoogle('mock_google_id_token_123')` con un string
  hardcodeado). El tab "Google" ahora renderiza el botón real vía el
  composable; un `watch` sobre el `credential` dispara
  `authStore.loginGoogle(idToken)` (esa función del store NO cambió su
  firma, solo se le agregó lógica interna — ver punto 4). `checkRedirect`
  se actualizó para contemplar el nuevo caso "es Jugador" además de
  org/club.

### 2. Página de aceptar invitación de Jugador
- **`src/views/AcceptPlayerInvite.vue`** (nuevo), ruta pública
  `/aceptar-invitacion-jugador` (sin `requiresAuth`, agregada en
  `src/router/index.js`). Lee `?token=` de la URL (si falta, muestra un
  estado de error claro sin llamar al backend). Renderiza el botón de
  Google (mismo composable). Al completar el login de Google, llama
  `authStore.acceptPlayerInvite(token, idToken)` (nuevo método del store,
  ver punto 4) → `POST /auth/accept-player-invite` con
  `{ token, id_token }`. Maneja los 4 códigos de error del contrato con
  mensajes específicos (`INVALID_INVITE`, `OAUTH_FAILED`, `EMAIL_MISMATCH`,
  `USER_ALREADY_LINKED_TO_ANOTHER_PLAYER`) vía un diccionario
  `ERROR_MESSAGES`, con fallback al `error.message` del backend o uno
  genérico. En éxito, redirige a `/mi-perfil`.

### 3. Invitar jugador (club admin / org admin)
- **`src/services/players.service.js`**: agregado `invitePlayerAccess(playerId, email)`
  → `POST /players/{playerId}/invite`, y `getMyPlayerProfile`/
  `updateMyPlayerProfile` para `GET`/`PATCH /players/me`.
- **`src/views/PlayerDetail.vue`**: nueva sección "Vincular acceso de
  Jugador" con input de email (precargado con `player.email` si ya existe)
  + botón "Invitar como Jugador". Feedback de éxito ("Invitación enviada...")
  y errores específicos por código (`MISSING_EMAIL`, `PLAYER_NOT_FOUND`,
  `FORBIDDEN`, `CLUB_NOT_FOUND`, `USER_ALREADY_LINKED_TO_ANOTHER_PLAYER`).
  No se agregó gating adicional de rol en esta sección: la ruta
  `/players/:playerId` ya es accesible para club admin/org admin (meta
  `requiresOrg: true`, sin `orgAdminOnly`), y el backend re-valida acceso
  vía `assertClubAccess` — consistente con el resto de acciones de esta
  misma vista (ej. "Editar").

### 4. Store de auth + dashboard del Jugador + router
- **`src/stores/auth.js`**: agregado `state.player` (null si no hay vínculo,
  persistido en `localStorage` bajo la key `player`, restaurado al bootear
  con el mismo patrón IIFE que `orgs`/`clubs`). Nueva función interna
  `refreshMyPlayerProfile()` que llama `GET /players/me` y setea
  `state.player`; `NOT_A_PLAYER` se trata en silencio (caso normal para
  admins), otros errores solo se loguean en consola sin romper el login.
  Se invoca automáticamente al final de `loginGoogle()` y del nuevo
  `acceptPlayerInvite(token, idToken)`. **No se duplicó** la lógica de
  persistir sesión: `acceptPlayerInvite` reusa `setSession` tal cual estaba
  (ya soporta `orgs`/`clubs` ausentes, que es el caso del payload
  `{ session, user, playerId }` de este endpoint). `logout()` limpia
  `state.player` y su entrada en `localStorage`.
- **`src/views/PlayerProfile.vue`** (nuevo), ruta `/mi-perfil` (`meta: { requiresAuth: true }`,
  **sin** `requiresOrg`). Al montar trae `GET /players/me` (no reusa
  `state.player` del store directamente para evitar datos stale, pero lo
  sincroniza después de cargar). Muestra nombre/apellido editables (form +
  `PATCH /players/me`), RUT **solo lectura** (`input disabled` + ícono de
  candado + texto explicativo "no se puede editar"), club y "mi serie"
  (nombre + descripción — **no** reutiliza `ClubSeries.vue` ni ninguna
  vista que liste todas las series). Si `roster`/`club`/`series` vienen
  `null`, muestra un estado vacío claro. Si hay `tournaments`, muestra un
  bloque por torneo con 3 botones directos (Tabla de Posiciones /
  Goleadores / Fairplay) hacia las rutas nuevas descritas abajo — sin
  buscador libre de torneos.
- **Rutas nuevas de standings/goleadores/fairplay para Jugador** — mismos
  componentes que las rutas de administración, **rutas alternativas sin
  `orgAdminOnly`**:
  - `/mi-perfil/torneos/:tournamentId/posiciones` → `TournamentStandings.vue`
  - `/mi-perfil/torneos/:tournamentId/goleadores` → `TournamentTopScorers.vue`
  - `/mi-perfil/torneos/:tournamentId/fairplay` → `TournamentFairplay.vue`

  Se eligió este criterio (rutas alternativas) en vez de "ajustar el guard
  para permitir `orgAdminOnly` cuando hay `state.player`" porque mantiene
  `orgAdminOnly` con un significado único y sin excepciones — más fácil de
  auditar a futuro que un guard con casos especiales por meta.
- **Controles de administración encontrados en esas 3 vistas: NINGUNO.**
  `TournamentStandings.vue`, `TournamentTopScorers.vue` y
  `TournamentFairplay.vue` ya eran, antes de este cambio, tablas de solo
  lectura sin ningún botón de edición/gestión embebido (no hay "editar
  resultado", "gestionar equipos", etc. en ninguna de las tres). El único
  ajuste que necesitaron fue el botón "volver": antes apuntaba siempre a
  `/tournaments/:id` (ruta `orgAdminOnly`, inaccesible para un Jugador
  puro). Se agregó un `computed isPlayerOnly` (mismo criterio que el guard:
  `!!authStore.state.player && !authStore.state.org && !authStore.myClub()`)
  que cambia el destino/label del botón a "← Mi perfil" → `/mi-perfil`
  cuando aplica, sin tocar la tabla ni el resto de la lógica de datos.

## Guard del router — código exacto de la condición nueva

En `src/router/index.js`, dentro de `router.beforeEach`:

```js
const club = authStore.myClub();
const hasOrg = !!authStore.state.org || !!club;
// Un usuario vinculado como Jugador (fila en lg_player_users, resuelto por
// authStore.state.player vía GET /players/me tras el login) que NO tiene
// org ni club admin: su "home" es su propio dashboard (/mi-perfil), nunca
// /bootstrap ni las rutas de administración de organización/club.
const isPlayerOnly = !hasOrg && !!authStore.state.player;
const playerHome = '/mi-perfil';

// 2. guestOnly (ej. /login) estando ya autenticado:
if (to.meta.guestOnly && isAuthenticated) {
    if (hasOrg) return next('/home');
    if (isPlayerOnly) return next(playerHome);
    return next('/bootstrap');
}

// 3. requiresOrg (ej. /home) sin org -> antes siempre /bootstrap:
if (to.meta.requiresOrg && !hasOrg) {
    return next(isPlayerOnly ? playerHome : '/bootstrap');
}

// 4. requiresNoOrg (Bootstrap) — un Jugador puro tampoco debe entrar ahí:
if (to.meta.requiresNoOrg && (hasOrg || isPlayerOnly)) {
    return next(hasOrg ? '/home' : playerHome);
}

// 6. Caso simétrico al punto 5 (ADMIN_CLUB puro), para Jugador puro:
if (isPlayerOnly) {
    if (to.meta.orgAdminOnly) return next(playerHome);
    if (to.name === 'Home') return next(playerHome);
}
```

El punto 5 preexistente (ADMIN_CLUB puro → su club) quedó intacto; el punto
6 es su análogo para Jugador puro. Casos cubiertos: login estando ya
logueado, cualquier ruta `requiresOrg`, `Bootstrap`, cualquier ruta
`orgAdminOnly`, y `Home` — en todos, un Jugador puro termina en
`/mi-perfil` en vez de rebotar a `/bootstrap` o quedar en una ruta de
administración que no le corresponde.

## Otros archivos tocados (UX incremental, fuera del pedido explícito pero de bajo riesgo)
- **`src/components/Navbar.vue`**: agregado un `v-else-if="authStore.state.player"`
  con un link "Mi Perfil" → `/mi-perfil`, en el mismo lugar donde antes solo
  existían las ramas "org admin" / "club admin puro" / nada. Antes de este
  cambio, un Jugador puro veía el navbar vacío en el medio (sin links) — no
  rompía nada, pero era peor UX. El logout ya funcionaba para cualquier rol
  autenticado (no dependía de org/club).

## Decisiones de diseño
1. **`useGoogleAuth.js` no es un singleton global**: cada componente que lo
   invoca obtiene su propio `credential`/`error` reactivos, pero todos
   comparten el mismo script/objeto `window.google` (cargado una sola vez a
   nivel de módulo). Como `Login.vue` y `AcceptPlayerInvite.vue` nunca están
   montados simultáneamente, no hay conflicto de callbacks.
2. **Rutas alternativas para standings/goleadores/fairplay** en vez de tocar
   el guard para permitir `orgAdminOnly` con `state.player` — ver
   justificación en la sección de arriba.
3. **`PlayerProfile.vue` no usa una store dedicada** (a diferencia de la
   mayoría de los dominios del proyecto, que sí tienen `stores/*.js`): se
   siguió el patrón más liviano que ya usa `AcceptInvite.vue` (estado local
   con `ref`/`reactive` + llamada directa al service), suficiente para una
   vista de un solo perfil sin necesidad de compartir ese estado entre
   componentes.
4. **No se agregó ninguna dependencia npm nueva** — Google Identity Services
   se integra vía script tag dinámico, como pedía el encargo explícitamente.

## Verificación
- `npm run build` (Vite): **el entorno de este sandbox corre Node 16.20.2**,
  y Vite 7 requiere Node 20.19+/22.12+ (`crypto.getRandomValues is not a
  function` al arrancar `vite build`) — limitación de entorno preexistente,
  no causada por este cambio (mismo tipo de limitación que documentó
  backend-dev con Node 16 vs `@supabase/supabase-js` en `backend.md`). Se
  confirmó el build cambiando temporalmente a Node 20.20.0 (disponible vía
  `nvm4w` en esta máquina): **`npm run build` completa exitosamente**,
  genera `PlayerProfile-*.js/css`, `AcceptPlayerInvite` queda bundleado
  dentro del chunk de `Login`/rutas públicas, y no hay errores de
  compilación en ningún archivo tocado. Se restauró Node 16.20.2 al
  terminar para no dejar el entorno global alterado.
- Revisión visual de código de las 3 vistas de standings/goleadores/
  fairplay confirmando ausencia de controles de administración (ver
  sección dedicada arriba).

## Checklist
- [x] UI implementada (botón real de Google, invitación de jugador, perfil
      propio editable con RUT bloqueado, links acotados a standings/
      goleadores/fairplay del torneo propio) — probada visualmente vía
      lectura de código y `npm run build` exitoso (Node 20 temporal)
- [x] Consumo de API alineado al contrato de `backend.md`: `POST /players/{playerId}/invite`,
      `POST /auth/accept-player-invite` (`{token, id_token}` →
      `{session, user, playerId}`), `GET /players/me`
      (`{player, roster, club, series, tournaments}`), `PATCH /players/me`
      (`{first_name?, last_name?}`)
- [x] Sin cambios fuera de `frontend-liga/src/` (no se tocó backend ni DB)
- [x] No se duplicó lógica de standings/goleadores/fairplay — se reusaron
      los mismos componentes, solo se ajustó ruteo/acceso y el botón
      "volver"
- [x] No se tocaron `NotifyModal.vue`, `stores/notify.js` ni las vistas con
      cambios sin commitear del refactor paralelo de notificaciones (se
      verificó con `git status` antes y después: esos archivos ya
      figuraban como modificados antes de esta tarea y no fueron editados
      en esta sesión)
- [x] Sin dependencias nuevas (Google Identity Services vía script tag
      dinámico, no paquete npm)

```yaml
task_id: T-20260828-103923
layer: frontend
status: done
changes:
  - frontend-liga/src/composables/useGoogleAuth.js
  - frontend-liga/src/views/Login.vue
  - frontend-liga/src/views/AcceptPlayerInvite.vue
  - frontend-liga/src/views/PlayerProfile.vue
  - frontend-liga/src/views/PlayerDetail.vue
  - frontend-liga/src/views/TournamentStandings.vue
  - frontend-liga/src/views/TournamentTopScorers.vue
  - frontend-liga/src/views/TournamentFairplay.vue
  - frontend-liga/src/router/index.js
  - frontend-liga/src/stores/auth.js
  - frontend-liga/src/services/players.service.js
  - frontend-liga/src/api/index.js
  - frontend-liga/src/components/Navbar.vue
notes: "npm run build no corre en este sandbox con Node 16.20.2 (Vite 7 requiere Node 20+, limitación de entorno preexistente); verificado exitoso cambiando temporalmente a Node 20.20.0 vía nvm4w y restaurado a 16.20.2 al terminar. Standings/goleadores/fairplay no tenían ningún control de administración embebido que ocultar — el único ajuste fue el botón 'volver', ahora consciente de si el usuario es un Jugador puro. Guard del router extendido con un caso simétrico al de ADMIN_CLUB puro (punto 6), documentado en detalle arriba con el código exacto."
```
