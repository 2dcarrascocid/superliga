# T-20260825-113906 — Frontend: inscripción de clubes a torneos

- timestamp: 2026-08-25T00:00:00-04:00 (fecha de trabajo)
- status: done
- layer: frontend

## Resumen de cambios

Se implementó en `frontend-liga/` el flujo nuevo de inscripción de clubes a
un torneo (gate previo a inscribir series/equipos), consumiendo el contrato
de API ya implementado y testeado en `backend-liga/adf/specialists/tournaments_specialist.js`.

### Archivos tocados

- `frontend-liga/src/services/tournaments.service.js`
  Se agregaron `getTournamentClubs(tournamentId)`, `registerClub(tournamentId, clubId)`
  y `unregisterClub(tournamentId, clubId)`, siguiendo el mismo patrón que
  `getTournamentTeams`/`registerTeam`/`unregisterTeam`.

- `frontend-liga/src/stores/tournaments.js`
  Se agregó `state.clubs` (lista de clubes inscritos al torneo actual) y las
  acciones `fetchTournamentClubs`, `addClub`, `removeClub`, siguiendo el
  mismo patrón que `fetchTeams`/`addTeam`/`removeTeam` (manejo de loading,
  error vía `setError` con el mensaje que devuelve el backend, y actualización
  optimista del array local tras cada acción exitosa).

- `frontend-liga/src/views/TournamentsList.vue`
  Se agregó el campo obligatorio "Costo de inscripción" (`form.inscription_fee`,
  numérico, `min="0"`) al formulario de creación de torneo (el único form de
  torneo que existe hoy en el frontend — no hay un form de edición separado;
  `createOrUpdateTournament` en el store ya soporta ambos casos vía
  `payload.id`, así que si en el futuro se agrega edición reusando este mismo
  form, el campo ya queda cubierto). Se agregó validación de front antes del
  submit: no deja enviar si `inscription_fee` está vacío o es negativo,
  mostrando el mismo alert de error que ya usa el resto del form.

- `frontend-liga/src/views/TournamentDetail.vue`
  - Nueva sección "Clubes Inscritos" (arriba de "Equipos Inscritos"):
    - Selector de club a inscribir, poblado con `getClubs` (mismo servicio
      y patrón que usa `LedgerView.vue`) filtrando los clubes que ya están
      inscritos en este torneo (`availableClubsToRegister`). No se creó
      ningún endpoint nuevo de "clubes disponibles" — se filtra en el
      cliente sobre la lista de clubes que el backend ya devuelve scoped
      al usuario (igual que hace `LedgerView.vue` hoy).
    - Tabla de clubes inscritos con badge de `inscription_status`
      (Pendiente/Parcial/Pagado/Vencido/Sin cobro), reutilizando exactamente
      las mismas clases CSS `status-badge--pendiente/parcial/pagado/vencido`
      que ya usa `LedgerView.vue`, para consistencia visual. Se agregó
      `status-badge--sin_cobro` (gris, mismo criterio que "borrador"/"retirado").
    - Acción "Registrar pago" visible solo si `authStore.isOrgAdmin()` y el
      club tiene `inscription_charge` pendiente — reutiliza directamente
      `recordPayment` de `clubFinance.service.js` (el mismo servicio que usa
      `LedgerView.vue`, con el mismo flujo de prompt de monto), en vez de
      duplicar el flujo de registro de pago o crear una vista nueva.
    - Acción "Quitar" (unregisterClub) con confirm, delega en el store y
      muestra el error de backend (`CLUB_HAS_REGISTERED_TEAMS`, etc.) vía el
      alert genérico ya existente en la vista.
  - El form de "Equipos Inscritos" (`teamForm.series_id`) ahora filtra el
    dropdown de series (`filteredSeriesResults`, antes `seriesResults`
    directo) para:
    1. Mostrar solo series de clubes que ya figuran en la lista de clubes
       inscritos al torneo (evita `CLUB_NOT_REGISTERED` antes de que ocurra).
    2. Si la serie trae `category_id` (viene en el payload de
       `searchSeries`, ya que el backend selecciona `'*'` sobre
       `lg_club_series`), también se filtra por la categoría del torneo
       (`current.category_id` / `current.category?.id`) para evitar
       `CATEGORY_MISMATCH` antes de que ocurra. Si la serie no trae
       `category_id`, no se filtra por eso — el backend queda como última
       línea de defensa.
    3. Si igual llegan `CLUB_NOT_REGISTERED` o `CATEGORY_MISMATCH` (o
       cualquier otro error) desde el backend, se muestran con el mismo
       alert de error genérico que ya usaba esta vista (el store propaga
       `error.response.data.error.message`, que ya trae el texto en
       español que define el backend).
    - Se agregó un hint visual: si no hay ningún club inscrito todavía, el
      input de búsqueda de series queda deshabilitado con un mensaje
      indicando que primero hay que inscribir un club.

## Decisiones de UX

1. No se creó un endpoint nuevo de "clubes disponibles para inscribir" — se
   reutilizó `GET /clubs` (ya usado en `LedgerView.vue`) y se filtró
   client-side contra la lista de clubes ya inscritos al torneo. El scoping
   por rol (admin de organización ve todos, admin de club solo el propio) ya
   lo resuelve el backend de `GET /clubs`, igual que hace hoy `LedgerView.vue`.
2. El "marcar como pagado" se implementó como un botón inline en la propia
   fila del club (prompt de monto + `recordPayment`), en vez de redirigir a
   `LedgerView.vue` con query params — es más simple, reutiliza el mismo
   servicio (`clubFinance.service.js`) sin tocar `LedgerView.vue`, y evita
   introducir soporte de filtros por query string que hoy esa vista no tiene.
3. No se tocó `LedgerView.vue` en absoluto — ya sea para movimientos de
   categoría `INSCRIPCION` seguirá apareciendo ahí también (vía
   `GET /ledger-entries`), sin cambios de comportamiento.
4. El filtro de categoría de serie en el dropdown de "Inscribir equipo" es
   best-effort: como `lg_club_series` expone `category_id` en el mismo
   select que ya usa `searchSeries`, se pudo filtrar sin fetch extra. No se
   agregó ningún llamado adicional al backend para esto.
5. No existe hoy un form de edición de torneo separado del de creación en el
   frontend (`TournamentsList.vue` solo tiene modo "Nuevo Torneo"), así que
   el campo `inscription_fee` solo se agregó ahí; si se agrega edición en el
   futuro reusando el mismo `form` reactive, ya queda cubierto porque
   `createOrUpdateTournament` soporta PATCH vía `payload.id`.

## Validación

- `npm run build` (Vite) corrió sin errores sobre `frontend-liga/`.
- No se probó visualmente en navegador (no hay entorno de backend local
  corriendo en esta sesión) — se validó por lectura de código, consistencia
  con los patrones ya usados en `LedgerView.vue`/`TournamentDetail.vue`, y
  build exitoso.

## Fuera de alcance / no tocado

- No se modificó nada de `backend-liga/`.
- No se modificó `LedgerView.vue`.
- No se introdujeron dependencias nuevas.
- No se creó ningún endpoint nuevo — todo el consumo respeta exactamente el
  contrato reportado (`GET/POST/DELETE /tournaments/{id}/clubs`, `POST/PATCH
  /tournaments` con `inscription_fee`, `POST /tournaments/{id}/teams` con
  los nuevos errores `CATEGORY_MISMATCH`/`CLUB_NOT_REGISTERED`).
