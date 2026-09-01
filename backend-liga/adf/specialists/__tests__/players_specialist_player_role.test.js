import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlayersSpecialist } from '../players_specialist.js';
import { createMockDb } from './test_utils/mock_db.js';

function run(operation, payload, db, userId) {
  const specialist = new PlayersSpecialist();
  return specialist.execute({ input: { operation, payload, db, userId } });
}

// ── INVITE_PLAYER ────────────────────────────────────────────────────────

test('INVITE_PLAYER rechaza a un usuario sin acceso al club del jugador (FORBIDDEN) — sin llegar a fn_invite_player', async () => {
  let rpcCalled = false;
  const db = createMockDb(
    {
      lg_players:    [{ data: { club_id: 'club-1', first_name: 'Juan', last_name: 'Perez' }, error: null }],
      lg_clubs:      [{ data: { org_id: 'org-1' }, error: null }],
      lg_org_users:  [{ data: { role: 'MEMBER' }, error: null }],
      lg_club_users: [{ data: null, error: null }],
    },
    { onRpc: () => { rpcCalled = true; } }
  );

  const result = await run('INVITE_PLAYER', { playerId: 'player-1', email: 'jugador@test.com' }, db, 'random-user');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'FORBIDDEN');
  assert.equal(rpcCalled, false);
});

test('INVITE_PLAYER retorna PLAYER_NOT_FOUND si el jugador no existe', async () => {
  const db = createMockDb({
    lg_players: [{ data: null, error: null }],
  });

  const result = await run('INVITE_PLAYER', { playerId: 'no-existe', email: 'jugador@test.com' }, db, 'admin-user');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'PLAYER_NOT_FOUND');
});

test('INVITE_PLAYER mapea el 23505 de fn_invite_player (email ya vinculado a otro jugador) a USER_ALREADY_LINKED_TO_ANOTHER_PLAYER', async () => {
  const db = createMockDb({
    lg_players:    [{ data: { club_id: 'club-1', first_name: 'Juan', last_name: 'Perez' }, error: null }],
    lg_clubs:      [
      { data: { org_id: 'org-1' }, error: null },  // assertClubAccess
      { data: { name: 'Club X' }, error: null },   // nombre del club para el mail
    ],
    lg_org_users:  [{ data: { role: 'ADMIN' }, error: null }],
    lg_club_users: [{ data: null, error: null }],
    rpc: {
      fn_invite_player: [{ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "idx_player_users_one_player_per_user"' } }],
    },
  });

  const result = await run('INVITE_PLAYER', { playerId: 'player-1', email: 'jugador@test.com' }, db, 'admin-user');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'USER_ALREADY_LINKED_TO_ANOTHER_PLAYER');
});

// ── GET_MY_PLAYER_PROFILE ────────────────────────────────────────────────

test('GET_MY_PLAYER_PROFILE retorna NOT_A_PLAYER si el usuario no tiene vínculo en lg_player_users', async () => {
  const db = createMockDb({
    lg_player_users: [{ data: null, error: null }],
  });

  const result = await run('GET_MY_PLAYER_PROFILE', {}, db, 'user-sin-jugador');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'NOT_A_PLAYER');
});

test('GET_MY_PLAYER_PROFILE retorna el jugador con roster/club/series/tournaments en null cuando no hay roster activo', async () => {
  const db = createMockDb({
    lg_player_users:  [{ data: { player_id: 'player-1' }, error: null }],
    lg_players:       [{ data: { id: 'player-1', first_name: 'Juan', last_name: 'Perez', rut: '11111111-1' }, error: null }],
    lg_club_rosters:  [{ data: null, error: null }],
  });

  const result = await run('GET_MY_PLAYER_PROFILE', {}, db, 'user-1');

  assert.equal(result.success, true);
  assert.equal(result.data.player.id, 'player-1');
  assert.equal(result.data.roster, null);
  assert.equal(result.data.club, null);
  assert.equal(result.data.series, null);
  assert.deepEqual(result.data.tournaments, []);
});

test('GET_MY_PLAYER_PROFILE resuelve club, serie y torneos inscritos cuando hay roster activo con serie', async () => {
  const db = createMockDb({
    lg_player_users:     [{ data: { player_id: 'player-1' }, error: null }],
    lg_players:          [{ data: { id: 'player-1', first_name: 'Juan', last_name: 'Perez' }, error: null }],
    lg_club_rosters:     [{ data: { id: 'roster-1', club_id: 'club-1', series_id: 'series-1', series_status: 'INSCRITO', club_folio: 5, status: 'ACTIVE' }, error: null }],
    lg_clubs:            [{ data: { id: 'club-1', name: 'Club X' }, error: null }],
    lg_club_series:      [{ data: { id: 'series-1', name: 'Serie A' }, error: null }],
    lg_tournament_teams: [{
      data: [{ id: 'tt-1', status: 'ACTIVE', tournament: { id: 't-1', name: 'Apertura', status: 'REGISTRATION', season_id: 'season-1' } }],
      error: null,
    }],
  });

  const result = await run('GET_MY_PLAYER_PROFILE', {}, db, 'user-1');

  assert.equal(result.success, true);
  assert.equal(result.data.club.name, 'Club X');
  assert.equal(result.data.series.name, 'Serie A');
  assert.equal(result.data.tournaments.length, 1);
  assert.equal(result.data.tournaments[0].name, 'Apertura');
});

// ── UPDATE_MY_PLAYER_PROFILE ─────────────────────────────────────────────

test('UPDATE_MY_PLAYER_PROFILE retorna NOT_A_PLAYER si el usuario no tiene vínculo', async () => {
  const db = createMockDb({
    lg_player_users: [{ data: null, error: null }],
  });

  const result = await run('UPDATE_MY_PLAYER_PROFILE', { firstName: 'Juan' }, db, 'user-sin-jugador');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'NOT_A_PLAYER');
});

test('UPDATE_MY_PLAYER_PROFILE retorna NO_FIELDS si no llega firstName ni lastName', async () => {
  const db = createMockDb({
    lg_player_users: [{ data: { player_id: 'player-1' }, error: null }],
  });

  const result = await run('UPDATE_MY_PLAYER_PROFILE', {}, db, 'user-1');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'NO_FIELDS');
});

test('UPDATE_MY_PLAYER_PROFILE ignora silenciosamente rut/email/club_id — solo aplica first_name/last_name', async () => {
  let updatedPayload = null;
  const db = createMockDb(
    {
      lg_player_users: [{ data: { player_id: 'player-1' }, error: null }],
      lg_players: [(payload) => ({ data: { id: 'player-1', ...payload }, error: null })],
    },
    { onUpdate: (table, payload) => { if (table === 'lg_players') updatedPayload = payload; } }
  );

  const result = await run(
    'UPDATE_MY_PLAYER_PROFILE',
    {
      firstName: 'Nuevo',
      lastName: 'Apellido',
      rut: '11111111-1',
      email: 'otro@test.com',
      club_id: 'club-x',
      clubId: 'club-y',
    },
    db,
    'user-1'
  );

  assert.equal(result.success, true);
  assert.deepEqual(updatedPayload, { first_name: 'Nuevo', last_name: 'Apellido' });
});
