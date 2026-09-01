# Backend — T-20260825-113906

**Timestamp:** 2026-08-25
**Rol:** backend-dev
**Status:** done

## Changelog — fixes de seguridad (security-reviewer, 2da pasada)

security-reviewer bloqueó la tarea con 3 hallazgos (1 crítico, 1 alto, 1
medio) + 1 menor opcional. Los 4 quedaron corregidos en
`tournaments_specialist.js` / `request_validator.js`, con tests nuevos que
cubren específicamente los escenarios de bypass que describió el reporte.

1. **CRÍTICO — `CREATE_TOURNAMENT`/`UPDATE_TOURNAMENT`/`DELETE_TOURNAMENT`
   sin control de autorización.** Corregido: las tres operaciones ahora
   reciben `userId` (agregado al switch de `execute()`) y exigen
   `isOrgAdmin(userId, org_id, db)` — decisión: gestión de torneos
   (crear/editar/borrar la competencia en sí) es dominio EXCLUSIVO del
   ADMIN de organización, no alcanza con ADMIN_CLUB (documentado en el
   bloque de comentarios de cabecera del archivo). `UPDATE_TOURNAMENT` y
   `DELETE_TOURNAMENT` resuelven el `org_id` del torneo EXISTENTE en DB
   antes de autorizar (no confían en ningún `org_id` del payload — el
   payload de `UPDATE_TOURNAMENT` ni siquiera puede tocar `org_id`, no está
   en `TOURNAMENT_UPDATABLE_FIELDS`). Cierra los 3 vectores del reporte:
   `PATCH category_id:null` cross-org, `PATCH inscription_fee` cross-org, y
   `DELETE` cross-org con cascada sobre `lg_tournament_clubs`/`lg_tournament_teams`.

2. **ALTO — `LIST_TOURNAMENT_CLUBS` exponía datos financieros
   cross-tenant.** Corregido: ahora recibe `userId`, resuelve el `org_id`
   del torneo, y si el caller no es `isOrgAdmin` de esa organización,
   filtra la respuesta con `getAccessibleClubIds(userId, org_id, db)` (mismo
   helper de `lib/club_access.js` que ya usa `club_finance_specialist.js`)
   — un ADMIN_CLUB solo ve los clubes que administra; un usuario sin ningún
   club accesible en esa organización recibe lista vacía (no error, no el
   listado completo).

3. **MEDIO — `_registerClub`/`_registerTeam` no validaban que el club y el
   torneo fueran de la misma organización.** Corregido en ambos (el reporte
   señaló que `_registerTeam` ya tenía el mismo hueco preexistente, y
   correspondía arreglarlo ahora que `REGISTER_CLUB` lo extiende al flujo de
   dinero): después de resolver `tournament`, se hace un fetch adicional de
   `club.org_id` y se compara contra `tournament.org_id` — si no coinciden,
   error **`CLUB_ORG_MISMATCH`**. Este chequeo es necesario porque
   `assertClubAccess` solo valida que el usuario administre el club dentro
   de la organización DEL CLUB, nunca compara contra la organización del
   torneo.

4. **MENOR — `request_validator.js` sin `inscription_fee` en
   `UPDATE_TOURNAMENT`.** Agregada la regla `{ field: 'inscription_fee',
   required: false, type: 'number', min: 0 }` (nombre en snake_case porque
   `UPDATE_TOURNAMENT` recibe el body crudo vía `...body` en `handler.js`,
   a diferencia de `CREATE_TOURNAMENT` que arma el objeto camelCase).

**Tests nuevos** (12 agregados sobre los 15 previos → **27/27 pass**):
`CREATE_TOURNAMENT` rechaza `FORBIDDEN` sin ser admin de org / acepta con
admin; `UPDATE_TOURNAMENT`/`DELETE_TOURNAMENT` rechazan `FORBIDDEN`
cross-org (torneo de `org-ajena`) y aceptan con admin de la org correcta;
`REGISTER_TEAM` y `REGISTER_CLUB` rechazan `CLUB_ORG_MISMATCH` cuando el
club y el torneo son de organizaciones distintas; `LIST_TOURNAMENT_CLUBS`
devuelve el listado completo solo al admin de la org, filtra a los clubes
accesibles para un ADMIN_CLUB, y devuelve lista vacía (no error) para un
usuario sin clubes accesibles en esa org.

`adf/specialists/__tests__/test_utils/mock_db.js` se extendió con soporte
para `onUpdate` (antes solo tenía `onInsert`) para poder capturar el patch
exacto que recibe `.update()` en los tests de `UPDATE_TOURNAMENT`.

`npm test` en `backend-liga/` → **27/27 pass**.

## Resumen de cambios (implementación original de la tarea)

### 1. `backend-liga/adf/specialists/tournaments_specialist.js`
- `CREATE_TOURNAMENT` ahora exige `inscriptionFee` (>= 0, numérico). Sin el
  campo → `MISSING_FIELDS`; negativo o no numérico → `INVALID_INSCRIPTION_FEE`.
  Se persiste en `lg_tournaments.inscription_fee`.
- `inscriptionFee: 'inscription_fee'` agregado a `TOURNAMENT_UPDATABLE_FIELDS`
  (editable vía `UPDATE_TOURNAMENT`), con la misma validación (>= 0) si se
  envía en el patch.
- Nueva capability **`REGISTER_CLUB`** (`_registerClub`): inscribe un club a
  un torneo (`lg_tournament_clubs`). Mismos gates que `REGISTER_TEAM`:
  `assertClubAccess`, torneo en `status=REGISTRATION`, temporada activa si
  quien inscribe no es admin de organización. Duplicado (`UNIQUE`, código
  Postgres `23505`) → `DUPLICATE_CLUB_REGISTRATION`. Al inscribir con éxito
  genera 1 cobro `INSCRIPCION` vía `createInscriptionCharge` usando
  `tournament.inscription_fee` (no el catálogo por temporada). Si el cobro
  falla, se loguea pero NO revierte la inscripción (mismo criterio que ya
  usaba `_registerTeam`).
- Nueva capability **`UNREGISTER_CLUB`** (`_unregisterClub`): mismo criterio
  de permisos. Antes de borrar, verifica si el club tiene series inscritas
  en `lg_tournament_teams` para ese torneo; si tiene, rechaza con
  `CLUB_HAS_REGISTERED_TEAMS` (ver "Decisiones de diseño" abajo).
- Nueva capability **`LIST_TOURNAMENT_CLUBS`** (`_listTournamentClubs`):
  lista `lg_tournament_clubs` + join a `lg_clubs`, decorado con
  `inscription_charge` (el ledger entry INSCRIPCION de ese club+torneo,
  `series_id IS NULL`) e `inscription_status` calculado con
  `computeEntryStatus` (`PENDIENTE|PARCIAL|PAGADO|VENCIDO`), o `'SIN_COBRO'`
  si no existe cobro asociado (borde: club inscrito sin `inscription_fee`
  cobrado, no debería pasar en flujo normal pero se contempla).
- `_registerTeam` (inscripción de serie):
  - Agregada validación `CATEGORY_MISMATCH`: si el torneo tiene
    `category_id` definido, la serie (`lg_club_series.category_id`) debe
    coincidir. Si el torneo NO tiene categoría (`NULL`), se omite la
    validación (decisión: un torneo sin categoría acepta series de
    cualquier categoría).
  - Agregado gate `CLUB_NOT_REGISTERED`: el club dueño de la serie debe
    estar ya en `lg_tournament_clubs` para ese torneo.
  - **Removida** la llamada a `createInscriptionCharge` — ese cobro ahora
    es responsabilidad exclusiva de `REGISTER_CLUB` (una vez por club, no
    por serie).
  - `createMatchdayCharges` (cobro FECHA, en `GENERATE_FIXTURE` /
    `GENERATE_KNOCKOUT_FROM_GROUPS` / `GENERATE_CONSOLATION`) **no se tocó**
    — sigue funcionando igual, por serie ACTIVE inscrita.
- `CAPABILITIES` y el bloque de comentarios de cabecera (reglas de negocio,
  capabilities) actualizados con el nuevo flujo club→serie y el cambio de
  responsabilidad del cobro INSCRIPCION.

### 2. `backend-liga/adf/specialists/lib/ledger.js`
- `createInscriptionCharge` ahora acepta `amount` opcional. Si se pasa
  explícito (caso `REGISTER_CLUB`, usa `tournament.inscription_fee`), se usa
  ese valor sin consultar `lg_season_cost_catalog`. Si se omite, cae al
  comportamiento histórico (consulta el catálogo por temporada) — no rompe
  ningún otro caller. `seriesId` ahora tiene default `null` en la firma
  (antes era implícitamente requerido); `lg_ledger_entries.series_id` es
  nullable en el schema, así que un cobro con `seriesId: null` queda
  asociado solo a `club_id + tournament_id` (consistente con cómo
  `LIST_TOURNAMENT_CLUBS` filtra `series_id IS NULL` para distinguir el
  cobro de club del histórico cobro por serie).

### 3. `backend-liga/adf/validators/request_validator.js`
- `ValidationRules.tournaments.CREATE_TOURNAMENT`: agregada regla
  `{ field: 'inscriptionFee', required: true, type: 'number', min: 0 }`.
- Agregadas entradas `LIST_TOURNAMENT_CLUBS`, `REGISTER_CLUB`,
  `UNREGISTER_CLUB` con sus campos requeridos (`tournamentId`, y `clubId`
  para las dos últimas).

### 4. `backend-liga/handler.js`
- `POST /tournaments` (CREATE_TOURNAMENT): agregado `inscriptionFee` al
  input desde `body.inscription_fee`.
- Nuevas rutas, mismo patrón que `/tournaments/{id}/teams`:
  - `GET /tournaments/{tournamentId}/clubs` → `LIST_TOURNAMENT_CLUBS`
  - `POST /tournaments/{tournamentId}/clubs` → `REGISTER_CLUB`
    (body: `club_id`)
  - `DELETE /tournaments/{tournamentId}/clubs/{clubId}` → `UNREGISTER_CLUB`
- `UPDATE_TOURNAMENT` (`PATCH /tournaments/{tournamentId}`) ya pasaba
  `...body` tal cual al specialist — no requirió cambios; `inscription_fee`
  en el body ya matchea `TOURNAMENT_UPDATABLE_FIELDS`.

### 5. `backend-liga/package.json`
- `"test": "node --test"` (antes era un stub que fallaba siempre). No había
  ningún framework de test instalado en el proyecto ni archivos de test
  previos en todo el repo; se usó el test runner nativo de Node 22
  (`node:test` + `node:assert/strict`), sin agregar dependencias nuevas.

### 6. Tests nuevos (`backend-liga/adf/specialists/__tests__/`)
- `test_utils/mock_db.js`: mock mínimo, sin dependencias, de un cliente
  estilo supabase-js — `.from(table)` devuelve un builder encadenable
  (`select/eq/neq/in/is/order/insert/update/delete/maybeSingle/single`) que
  es "thenable": el `await` en cualquier punto de la cadena resuelve con la
  siguiente respuesta en cola para esa tabla (FIFO). No interpreta SQL, solo
  reproduce `{ data, error, count }`.
- `ledger.test.js` (2 tests): `createInscriptionCharge` con `amount`
  explícito no consulta el catálogo y usa ese valor; sin `amount` cae al
  catálogo por temporada (compatibilidad histórica).
- `tournaments_specialist.test.js` (13 tests): `CREATE_TOURNAMENT` exige
  `inscriptionFee` (falta / negativo / acepta 0); `REGISTER_TEAM` con
  `CATEGORY_MISMATCH`, con `CLUB_NOT_REGISTERED` (con y sin categoría en el
  torneo), y confirma que ya NO dispara cobro INSCRIPCION propio;
  `REGISTER_CLUB` con `DUPLICATE_CLUB_REGISTRATION`, `TOURNAMENT_NOT_OPEN`,
  y flujo exitoso verificando que el cobro generado usa
  `tournament.inscription_fee` con `series_id: null`; `UNREGISTER_CLUB` con
  `CLUB_HAS_REGISTERED_TEAMS`, caso permitido sin series inscritas, y
  `FORBIDDEN` sin acceso al club.
- Resultado: `npm test` → **15/15 pass**.

## Decisiones de diseño

1. **`UNREGISTER_CLUB` bloquea si el club tiene series/equipos inscritos**
   (`lg_tournament_teams`, vía join a `lg_club_series.club_id`) en ese
   torneo — error `CLUB_HAS_REGISTERED_TEAMS`. Motivo: si se permitiera
   retirar el club dejando series inscritas, quedarían equipos "huérfanos"
   sin su club inscrito (posiblemente ya con fixture/resultados generados),
   rompiendo el gate de `_registerTeam` de forma retroactiva. El flujo
   correcto es primero `UNREGISTER_TEAM` de cada serie del club, luego
   `UNREGISTER_CLUB`. No se agregó `ON DELETE CASCADE` a nivel de negocio
   (la FK en DB sí es `ON DELETE CASCADE`, pero eso es solo para el caso de
   borrar el torneo/club completo, no para este flujo de negocio).

2. **`createInscriptionCharge` y `seriesId: null`**: la función ya soportaba
   `series_id NULL` a nivel de columna (nullable en el schema desde su
   creación). El único ajuste necesario fue permitir pasar `amount`
   explícito (antes solo derivaba el monto de `lg_season_cost_catalog` vía
   `seasonId`) — se agregó el parámetro `amount` opcional con fallback al
   comportamiento histórico si se omite, para no romper compatibilidad. El
   default `seriesId = null` en la firma es solo azúcar sintáctica — el
   comportamiento con `null` explícito ya funcionaba antes del cambio.

3. **`LIST_TOURNAMENT_CLUBS` filtra `lg_ledger_entries` con
   `series_id IS NULL`**: para distinguir el cobro de INSCRIPCION nuevo (a
   nivel de club, disparado por `REGISTER_CLUB`) de cualquier cobro
   histórico de INSCRIPCION por serie que pudiera existir de antes de esta
   migración (generado por la vieja lógica de `_registerTeam`, ahora
   removida). Evita que el frontend muestre un estado de pago erróneo
   heredado de datos previos.

4. **Validación de categoría omitida si `tournament.category_id` es NULL**:
   criterio elegido porque `category_id` es NOT NULL en `CREATE_TOURNAMENT`
   hoy (siempre se exige), así que en la práctica el caso NULL solo aplica a
   torneos legacy o si el campo se vacía manualmente vía `UPDATE_TOURNAMENT`
   — se prefirió no bloquear inscripciones en ese caso borde en lugar de
   rechazar todo, dado que `UPDATE_TOURNAMENT` sí permite `categoryId: null`
   técnicamente (no hay validación de "no nulificar" en el patch).

## Contrato de API (para el Specialist de frontend)

```
POST   /tournaments   (requiere ser ADMIN de la organización — FORBIDDEN si no)
  body: { org_id, name, format, season_id, category_id, inscription_fee (number >= 0, REQUERIDO), ... }
  errores: MISSING_FIELDS (si falta inscription_fee), INVALID_INSCRIPTION_FEE (< 0 o no numérico),
           FORBIDDEN (si el usuario no es ADMIN de org_id)

PATCH  /tournaments/{tournamentId}   (requiere ser ADMIN de la organización DUEÑA del torneo)
  body: { ..., inscription_fee? } — mismo patrón ya existente, ahora acepta inscription_fee
  errores: TOURNAMENT_NOT_FOUND, FORBIDDEN, INVALID_INSCRIPTION_FEE, INVALID_TYPE, NO_FIELDS

DELETE /tournaments/{tournamentId}   (requiere ser ADMIN de la organización DUEÑA del torneo)
  errores: TOURNAMENT_NOT_FOUND, FORBIDDEN

GET    /tournaments/{tournamentId}/clubs
  ADMIN de la organización del torneo ve el listado completo. Cualquier otro
  usuario (ej. ADMIN_CLUB) solo ve los clubes a los que tiene acceso — si no
  tiene ninguno, responde { clubs: [] } (200, no error).
  → 200 { clubs: [{ id, tournament_id, club_id, registered_by, created_at, updated_at,
                     club: { id, name, short_name, logo_url },
                     inscription_charge: { id, amount, paid_amount, due_date } | null,
                     inscription_status: 'PENDIENTE'|'PARCIAL'|'PAGADO'|'VENCIDO'|'SIN_COBRO' }] }
  errores: MISSING_FIELDS, TOURNAMENT_NOT_FOUND

POST   /tournaments/{tournamentId}/clubs
  body: { club_id }
  → 200 { tournamentClub: { id, tournament_id, club_id, registered_by, created_at, updated_at,
                             club: { id, name, short_name, logo_url } } }
  errores: MISSING_FIELDS, FORBIDDEN, CLUB_NOT_FOUND, TOURNAMENT_NOT_FOUND,
           TOURNAMENT_NOT_OPEN, CLUB_ORG_MISMATCH (el club no es de la misma
           organización que el torneo), SEASON_NOT_ACTIVE, DUPLICATE_CLUB_REGISTRATION

DELETE /tournaments/{tournamentId}/clubs/{clubId}
  → 200 { deleted: true, tournamentId, clubId }
  errores: FORBIDDEN, CLUB_NOT_REGISTERED, CLUB_HAS_REGISTERED_TEAMS

POST   /tournaments/{tournamentId}/teams   (ya existía, cambia el comportamiento)
  body: { series_id, group_name?, seed? }
  errores nuevos: CLUB_ORG_MISMATCH (el club de la serie no es de la misma
  organización que el torneo), CATEGORY_MISMATCH, CLUB_NOT_REGISTERED
  YA NO genera cobro INSCRIPCION (antes sí) — el frontend debe asegurar que
  el club ya esté inscrito (vía LIST_TOURNAMENT_CLUBS / REGISTER_CLUB) antes
  de ofrecer "agregar equipo".

RECORD_PAYMENT (sin cambios): POST /ledger-entries/{entryId}/payment — se
  reutiliza tal cual para marcar como pagado el cobro INSCRIPCION del club
  (obtenido vía inscription_charge.id en LIST_TOURNAMENT_CLUBS).
```

## Checklist
- [x] Lógica implementada y testeada (27/27 tests, `npm test` en
      `backend-liga/`, incluye los 3 hallazgos de security-reviewer)
- [x] Sin secretos hardcodeados
- [x] Contrato de API documentado arriba (actualizado con FORBIDDEN/CLUB_ORG_MISMATCH)
- [x] Sin cambios fuera de `backend-liga/` (no se tocó `club_finance_specialist.js`,
      `lg_season_cost_catalog`, ni frontend)

## Fuera de alcance (no tocado, según instrucciones)
- `club_finance_specialist.js` / flujo `RECORD_PAYMENT` — se reutiliza tal
  cual.
- `lg_season_cost_catalog` y su specialist — `matchday_fee` sigue igual.
- Frontend.

## Coordinación pendiente (para el orchestrator)
Siguiente paso: frontend-dev (UI de inscripción de club, filtro de "agregar
equipo" a clubes ya inscritos + series de la categoría del torneo, campo de
costo obligatorio al crear torneo, indicador PENDIENTE/PAGADO por club) y
luego security-reviewer / qa-tester según el plan.
