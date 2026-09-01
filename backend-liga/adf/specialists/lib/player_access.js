/**
 * Player Access (helper compartido, sin estado)
 *
 * Centraliza la regla de autorización del rol "Jugador" (T-20260828-103923):
 *   - Un ADMIN de la organización del jugador tiene acceso.
 *   - Un ADMIN_CLUB del club actual del jugador tiene acceso (vía
 *     assertClubAccess, mismo criterio que el resto de operaciones de club admin).
 *   - El propio jugador tiene acceso a su propio perfil (fila en
 *     lg_player_users con ese player_id + userId).
 *
 * Nota: GET_MY_PLAYER_PROFILE / UPDATE_MY_PLAYER_PROFILE en
 * players_specialist.js NO usan este helper — resuelven "soy yo mismo"
 * directo vía lg_player_users.user_id = userId (no reciben playerId en el
 * payload, lo derivan del propio usuario autenticado). Este helper queda
 * listo para operaciones futuras donde un club admin necesite actuar sobre
 * el perfil de un jugador puntual (ej. edición asistida, moderación), donde
 * sí hace falta decidir acceso a partir de un playerId explícito.
 */

import { assertClubAccess } from './club_access.js';

/**
 * Verifica que `userId` tenga acceso sobre el jugador `playerId`.
 * @returns {Promise<string|null>} código de error ('PLAYER_NOT_FOUND' | 'FORBIDDEN') o null si tiene acceso
 */
export async function assertPlayerAccess(playerId, userId, db) {
  if (!userId) return 'FORBIDDEN';

  const { data: player } = await db.from('lg_players').select('id, club_id').eq('id', playerId).maybeSingle();
  if (!player) return 'PLAYER_NOT_FOUND';

  // (c) El propio jugador
  const { data: link } = await db
    .from('lg_player_users')
    .select('id')
    .eq('player_id', playerId)
    .eq('user_id', userId)
    .maybeSingle();
  if (link) return null;

  // (a) ADMIN de la org / (b) ADMIN_CLUB del club actual del jugador
  if (player.club_id) {
    const clubAccessError = await assertClubAccess(player.club_id, userId, db);
    if (!clubAccessError) return null;
  }

  return 'FORBIDDEN';
}
