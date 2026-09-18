import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuthSpecialist } from '../auth_specialist.js';
import { createMockDb } from './test_utils/mock_db.js';

const FUTURE = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const PAST = new Date(Date.now() - 60 * 60 * 1000).toISOString();

/**
 * Mock de un cliente supabase-js para ORG_INVITE_INFO/ACCEPT_ORG_INVITE:
 * extiende createMockDb (from/rpc) con `.auth.signUp()`, mismo mecanismo
 * usado en _acceptClubInvite.
 */
function createSupabaseMock(dbQueues, signUpResult) {
  const db = createMockDb(dbQueues);
  db.auth = {
    signUp: async () => signUpResult ?? { data: { user: { id: 'new-user-1' } }, error: null },
  };
  return db;
}

function run(operation, payload, supabase) {
  const specialist = new AuthSpecialist();
  return specialist.execute({ input: { operation, payload, supabase } });
}

// ── ORG_INVITE_INFO ───────────────────────────────────────────────────────

test('ORG_INVITE_INFO retorna INVALID_INVITE si el token no existe', async () => {
  const supabase = createSupabaseMock({ lg_org_admin_invites: [{ data: null, error: null }] });

  const result = await run('ORG_INVITE_INFO', { token: 'a'.repeat(20) }, supabase);

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'INVALID_INVITE');
});

test('ORG_INVITE_INFO retorna ALREADY_ACCEPTED si la invitación ya fue usada', async () => {
  const supabase = createSupabaseMock({
    lg_org_admin_invites: [{ data: { email: 'a@test.com', org_id: 'org-1', user_id: null, expires_at: FUTURE, accepted_at: FUTURE }, error: null }],
  });

  const result = await run('ORG_INVITE_INFO', { token: 'a'.repeat(20) }, supabase);

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'ALREADY_ACCEPTED');
});

test('ORG_INVITE_INFO retorna INVITE_EXPIRED si la invitación expiró', async () => {
  const supabase = createSupabaseMock({
    lg_org_admin_invites: [{ data: { email: 'a@test.com', org_id: 'org-1', user_id: null, expires_at: PAST, accepted_at: null }, error: null }],
  });

  const result = await run('ORG_INVITE_INFO', { token: 'a'.repeat(20) }, supabase);

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'INVITE_EXPIRED');
});

test('ORG_INVITE_INFO retorna is_new/org_name/email_masked en el caso feliz', async () => {
  const supabase = createSupabaseMock({
    lg_org_admin_invites: [{ data: { email: 'presidente@test.com', org_id: 'org-1', user_id: null, expires_at: FUTURE, accepted_at: null }, error: null }],
    lg_orgs: [{ data: { name: 'Liga Test' }, error: null }],
  });

  const result = await run('ORG_INVITE_INFO', { token: 'a'.repeat(20) }, supabase);

  assert.equal(result.success, true);
  assert.deepEqual(result.data, { is_new: true, org_name: 'Liga Test', email_masked: 'pr***@test.com' });
});

// ── ACCEPT_ORG_INVITE ─────────────────────────────────────────────────────

test('ACCEPT_ORG_INVITE retorna INVALID_INVITE si el token no existe o ya fue usado', async () => {
  const supabase = createSupabaseMock({ lg_org_admin_invites: [{ data: null, error: null }] });

  const result = await run('ACCEPT_ORG_INVITE', { token: 'a'.repeat(20), password: 'secret123' }, supabase);

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'INVALID_INVITE');
});

test('ACCEPT_ORG_INVITE re-chequea el límite de 5 admins antes de aceptar (ADMIN_LIMIT_REACHED)', async () => {
  const supabase = createSupabaseMock({
    lg_org_admin_invites: [{ id: 'inv-1', data: { id: 'inv-1', email: 'a@test.com', org_id: 'org-1', full_name: 'A', phone: null, position: null, user_id: null, expires_at: FUTURE, accepted_at: null }, error: null }],
    lg_org_users: [{ data: null, error: null, count: 5 }],
  });

  const result = await run('ACCEPT_ORG_INVITE', { token: 'a'.repeat(20), password: 'secret123' }, supabase);

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'ADMIN_LIMIT_REACHED');
});

test('ACCEPT_ORG_INVITE — usuario existente: solo marca accepted_at y retorna is_new:false', async () => {
  let updatedInvite = null;
  const supabase = createSupabaseMock(
    {
      lg_org_admin_invites: [
        { data: { id: 'inv-1', email: 'a@test.com', org_id: 'org-1', full_name: 'A', phone: null, position: null, user_id: 'existing-user-1', expires_at: FUTURE, accepted_at: null }, error: null },
        { data: null, error: null }, // update accepted_at
      ],
      lg_org_users: [{ data: null, error: null, count: 1 }],
    }
  );

  const result = await run('ACCEPT_ORG_INVITE', { token: 'a'.repeat(20), password: 'secret123' }, supabase);

  assert.equal(result.success, true);
  assert.deepEqual(result.data, { is_new: false });
});

test('ACCEPT_ORG_INVITE — usuario nuevo: crea cuenta, confirma email, asigna rol ADMIN y marca aceptado', async () => {
  const supabase = createSupabaseMock(
    {
      lg_org_admin_invites: [
        { data: { id: 'inv-1', email: 'nuevo@test.com', org_id: 'org-1', full_name: 'Nuevo Admin', phone: '+56911111111', position: 'TESORERO', user_id: null, expires_at: FUTURE, accepted_at: null }, error: null },
        { data: null, error: null }, // update accepted_at + user_id
      ],
      lg_org_users: [
        { data: null, error: null, count: 1 }, // re-chequeo de límite
        { data: null, error: null }, // upsert ADMIN
      ],
      rpc: {
        fn_confirm_user_email: [{ data: true, error: null }],
      },
    },
    { data: { user: { id: 'new-user-1' } }, error: null }
  );

  const result = await run('ACCEPT_ORG_INVITE', { token: 'a'.repeat(20), password: 'secret123' }, supabase);

  assert.equal(result.success, true);
  assert.deepEqual(result.data, { is_new: true });
});

test('ACCEPT_ORG_INVITE retorna SIGNUP_FAILED si supabase.auth.signUp falla', async () => {
  const supabase = createSupabaseMock(
    {
      lg_org_admin_invites: [
        { data: { id: 'inv-1', email: 'nuevo@test.com', org_id: 'org-1', full_name: 'Nuevo Admin', phone: null, position: null, user_id: null, expires_at: FUTURE, accepted_at: null }, error: null },
      ],
      lg_org_users: [{ data: null, error: null, count: 1 }],
    },
    { data: null, error: { message: 'email already registered' } }
  );

  const result = await run('ACCEPT_ORG_INVITE', { token: 'a'.repeat(20), password: 'secret123' }, supabase);

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'SIGNUP_FAILED');
});
