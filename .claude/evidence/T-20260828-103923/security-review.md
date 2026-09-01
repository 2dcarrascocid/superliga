# Security Review — T-20260828-103923

**Timestamp:** 2026-08-28
**Rol:** security-reviewer
**Status:** approved (sin hallazgos críticos ni altos)

## Hallazgos

1. **[LOW] Race condition sin `FOR UPDATE`** en `fn_accept_player_invite` — dos requests concurrentes con el mismo token podrían pasar ambas la validación antes de que se marque `accepted_at`. Impacto mínimo (requiere ya controlar el email invitado, protegido además por `EMAIL_MISMATCH` y el UNIQUE de `user_id`). **Corregido**: se agregó `FOR UPDATE` al `SELECT` en `migrations/003_player_users.sql` (la migración aún no se aplicó a la base real, se editó el mismo archivo en vez de crear una nueva).
2. **[MEDIUM] Funciones `SECURITY DEFINER` sin chequeo interno de autorización, otorgadas a `anon`** — `fn_invite_player`/`fn_accept_player_invite`/`fn_get_player_link` confían en que la autorización ya se validó en el Lambda/ADF. Quien tuviera la `SUPABASE_ANON_KEY_LIGA` (hoy solo vive server-side, confirmado que el frontend no la expone) podría invocarlas directo contra PostgREST, bypaseando el ADF. **No es una superficie nueva** — replica exactamente el patrón ya existente y aceptado en `fn_invite_club_admin`/`002_club_admins.sql`. Recomendación a mediano plazo (no bloqueante, decisión de arquitectura ya tomada por el equipo): considerar mover estas RPCs a `service_role` o agregar chequeo interno.
3. **[INFO] `fn_get_player_link` no se invoca desde ningún Specialist** — código muerto, dejado "listo para uso futuro" según el comentario de la migración. Sin riesgo adicional más allá del punto 2.
4. **[INFO] Pre-existente, no introducido por esta tarea**: `GET_STANDINGS`/`GET_TOP_SCORERS`/`GET_FAIRPLAY_RANKING` no filtran por pertenencia al torneo — cualquier autenticado (ahora también el rol Jugador) puede ver esos datos de cualquier torneo conocido. Dato de solo lectura, no sensible por naturaleza (posiciones/goleadores públicos). Mismo hallazgo que reportó qa-tester.

## Confirmaciones sin hallazgo explotable
- `GET/PATCH /players/me` resuelven el `playerId` exclusivamente vía `userId` del JWT — nunca aceptan un `playerId` del cliente.
- Whitelist de `UPDATE_MY_PLAYER_PROFILE`: RUT y cualquier campo sensible nunca modificables, verificado por destructuring explícito + test.
- `INVITE_PLAYER` correctamente acotado por `assertClubAccess` al club del jugador puntual.
- `ACCEPT_PLAYER_INVITE`: `EMAIL_MISMATCH` se valida en JS ANTES de vincular en `lg_player_users` — nunca queda una vinculación indebida.
- RLS permisiva (`USING(true)`) consistente con el resto del schema — la autorización real vive en JS, tal como está documentado.
- Google Identity Services: el backend nunca confía en nada del cliente más allá del `idToken`, verificado vía `supabase.auth.signInWithIdToken` (valida la firma).
- Sin secretos hardcodeados en el código nuevo/modificado.

## Veredicto final: **APPROVED**. Sin hallazgos bloqueantes. El hallazgo LOW ya fue corregido.
