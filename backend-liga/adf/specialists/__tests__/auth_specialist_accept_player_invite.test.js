import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuthSpecialist } from '../auth_specialist.js';
import { createMockDb } from './test_utils/mock_db.js';

const FUTURE = new Date(Date.now() + 60 * 60 * 1000).toISOString();

/**
 * Mock de un cliente supabase-js para ACCEPT_PLAYER_INVITE: extiende
 * createMockDb (from/rpc) con `.auth.signInWithIdToken()`, que en este flujo
 * reemplaza el signUp/signIn por password de _acceptClubInvite.
 */
function createSupabaseMock(dbQueues, oauthResult) {
  const db = createMockDb(dbQueues);
  db.auth = {
    signInWithIdToken: async () => oauthResult,
  };
  return db;
}

function run(payload, supabase) {
  const specialist = new AuthSpecialist();
  return specialist.execute({ input: { operation: 'ACCEPT_PLAYER_INVITE', payload, supabase } });
}

test('ACCEPT_PLAYER_INVITE retorna INVALID_INVITE si el token no existe', async () => {
  const supabase = createSupabaseMock(
    { lg_player_invites: [{ data: null, error: null }] },
    { data: null, error: null }
  );

  const result = await run({ token: 'a'.repeat(20), idToken: 'google-id-token' }, supabase);

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'INVALID_INVITE');
});

test('ACCEPT_PLAYER_INVITE retorna EMAIL_MISMATCH si la cuenta de Google no coincide con el email invitado', async () => {
  const supabase = createSupabaseMock(
    {
      lg_player_invites: [{ data: { id: 'inv-1', email: 'jugador@test.com', player_id: 'player-1', expires_at: FUTURE, accepted_at: null }, error: null }],
    },
    { data: { session: { access_token: 'tok' }, user: { id: 'user-1', email: 'otro@test.com' } }, error: null }
  );

  const result = await run({ token: 'a'.repeat(20), idToken: 'google-id-token' }, supabase);

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'EMAIL_MISMATCH');
});

test('ACCEPT_PLAYER_INVITE mapea el 23505 de fn_accept_player_invite (cuenta ya vinculada a otro jugador) a USER_ALREADY_LINKED_TO_ANOTHER_PLAYER', async () => {
  const supabase = createSupabaseMock(
    {
      lg_player_invites: [{ data: { id: 'inv-1', email: 'jugador@test.com', player_id: 'player-1', expires_at: FUTURE, accepted_at: null }, error: null }],
      rpc: {
        fn_accept_player_invite: [{ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "idx_player_users_one_player_per_user"' } }],
      },
    },
    { data: { session: { access_token: 'tok' }, user: { id: 'user-1', email: 'jugador@test.com' } }, error: null }
  );

  const result = await run({ token: 'a'.repeat(20), idToken: 'google-id-token' }, supabase);

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'USER_ALREADY_LINKED_TO_ANOTHER_PLAYER');
});

test('ACCEPT_PLAYER_INVITE acepta la invitación y retorna session/user/playerId en el caso feliz', async () => {
  const supabase = createSupabaseMock(
    {
      lg_player_invites: [{ data: { id: 'inv-1', email: 'jugador@test.com', player_id: 'player-1', expires_at: FUTURE, accepted_at: null }, error: null }],
      rpc: {
        fn_accept_player_invite: [{ data: { success: true, player_id: 'player-1' }, error: null }],
      },
    },
    { data: { session: { access_token: 'tok' }, user: { id: 'user-1', email: 'jugador@test.com' } }, error: null }
  );

  const result = await run({ token: 'a'.repeat(20), idToken: 'google-id-token' }, supabase);

  assert.equal(result.success, true);
  assert.equal(result.data.playerId, 'player-1');
  assert.equal(result.data.session.access_token, 'tok');
  assert.equal(result.data.user.id, 'user-1');
});
