import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OrgSpecialist } from '../org_specialist.js';
import { createMockDb } from './test_utils/mock_db.js';

const FUTURE = new Date(Date.now() + 60 * 60 * 1000).toISOString();

function run(operation, payload, db, userId) {
  const specialist = new OrgSpecialist();
  return specialist.execute({ input: { operation, payload, db, userId } });
}

// ── GET_SPORTS ────────────────────────────────────────────────────────────

test('GET_SPORTS devuelve el catálogo de deportes de equipo', async () => {
  const db = createMockDb({
    lg_sports: [{ data: [{ id: 'sport-1', name: 'Futbol', team_sport: true }], error: null }],
  });

  const result = await run('GET_SPORTS', {}, db);

  assert.equal(result.success, true);
  assert.deepEqual(result.data.sports, [{ id: 'sport-1', name: 'Futbol', team_sport: true }]);
});

// ── GET_ORG_SPORT ─────────────────────────────────────────────────────────

test('GET_ORG_SPORT rechaza sin orgId (MISSING_FIELDS)', async () => {
  const result = await run('GET_ORG_SPORT', {}, createMockDb({}));
  assert.equal(result.success, false);
  assert.equal(result.error.code, 'MISSING_FIELDS');
});

test('GET_ORG_SPORT devuelve sportSlug default (futbol) cuando la org no tiene sport_id configurado', async () => {
  const db = createMockDb({
    lg_orgs: [{ data: { sport_id: null }, error: null }],
  });

  const result = await run('GET_ORG_SPORT', { orgId: 'org-1' }, db);

  assert.equal(result.success, true);
  assert.deepEqual(result.data, { sportId: null, sportName: null, sportSlug: 'futbol' });
});

test('GET_ORG_SPORT mapea el nombre del deporte configurado al sportSlug correspondiente', async () => {
  const db = createMockDb({
    lg_orgs: [{ data: { sport_id: 'sport-1' }, error: null }],
    lg_sports: [{ data: { id: 'sport-1', name: 'Volleyball' }, error: null }],
  });

  const result = await run('GET_ORG_SPORT', { orgId: 'org-1' }, db);

  assert.equal(result.success, true);
  assert.deepEqual(result.data, { sportId: 'sport-1', sportName: 'Volleyball', sportSlug: 'voleibol' });
});

// ── UPDATE_ORG_SPORT ──────────────────────────────────────────────────────

test('UPDATE_ORG_SPORT rechaza si requestingUserId no es ADMIN de la org (FORBIDDEN)', async () => {
  const db = createMockDb({
    lg_org_users: [{ data: null, error: null }],
  });

  const result = await run('UPDATE_ORG_SPORT', { orgId: 'org-1', sportId: 'sport-1' }, db, 'user-1');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'FORBIDDEN');
});

test('UPDATE_ORG_SPORT rechaza si el sportId no existe en el catálogo (SPORT_NOT_FOUND)', async () => {
  const db = createMockDb({
    lg_org_users: [{ data: { role: 'ADMIN' }, error: null }],
    lg_sports: [{ data: null, error: null }],
  });

  const result = await run('UPDATE_ORG_SPORT', { orgId: 'org-1', sportId: 'sport-x' }, db, 'user-1');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'SPORT_NOT_FOUND');
});

test('UPDATE_ORG_SPORT actualiza sport_id y devuelve el DTO recalculado', async () => {
  const db = createMockDb({
    lg_org_users: [{ data: { role: 'ADMIN' }, error: null }],
    lg_sports: [
      { data: { id: 'sport-1' }, error: null }, // validación de existencia
      { data: { id: 'sport-1', name: 'Basketball' }, error: null }, // _resolveOrgSportDTO
    ],
    lg_orgs: [
      { data: null, error: null }, // update
      { data: { sport_id: 'sport-1' }, error: null }, // _resolveOrgSportDTO
    ],
  });

  const result = await run('UPDATE_ORG_SPORT', { orgId: 'org-1', sportId: 'sport-1' }, db, 'user-1');

  assert.equal(result.success, true);
  assert.deepEqual(result.data, { sportId: 'sport-1', sportName: 'Basketball', sportSlug: 'basquetbol' });
});

// ── GET_ORG_ADMINS ────────────────────────────────────────────────────────

test('GET_ORG_ADMINS devuelve admins activos y pendingInvites', async () => {
  const db = createMockDb({
    rpc: {
      fn_get_org_admins: [{ data: [{ user_id: 'u1', email: 'admin@test.com', position: 'PRESIDENTE' }], error: null }],
    },
    lg_org_admin_invites: [{ data: [{ email: 'pendiente@test.com', full_name: 'Pendiente', phone: null, position: null, expires_at: FUTURE }], error: null }],
  });

  const result = await run('GET_ORG_ADMINS', { orgId: 'org-1' }, db);

  assert.equal(result.success, true);
  assert.equal(result.data.admins.length, 1);
  assert.equal(result.data.admins[0].email, 'admin@test.com');
  assert.equal(result.data.pendingInvites.length, 1);
  assert.equal(result.data.pendingInvites[0].email, 'pendiente@test.com');
});

// ── INVITE_ORG_ADMIN ──────────────────────────────────────────────────────

test('INVITE_ORG_ADMIN rechaza si requestingUserId no es ADMIN de la org (FORBIDDEN)', async () => {
  const db = createMockDb({
    lg_org_users: [{ data: null, error: null }],
  });

  const result = await run('INVITE_ORG_ADMIN', { orgId: 'org-1', fullName: 'Juan Perez', email: 'juan@test.com' }, db, 'user-1');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'FORBIDDEN');
});

test('INVITE_ORG_ADMIN rechaza position fuera del catálogo (INVALID_POSITION)', async () => {
  const db = createMockDb({
    lg_org_users: [{ data: { role: 'ADMIN' }, error: null }],
  });

  const result = await run(
    'INVITE_ORG_ADMIN',
    { orgId: 'org-1', fullName: 'Juan Perez', email: 'juan@test.com', position: 'CAPITAN' },
    db,
    'user-1'
  );

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'INVALID_POSITION');
});

test('INVITE_ORG_ADMIN retorna ORG_NOT_FOUND si la organización no existe', async () => {
  const db = createMockDb({
    lg_org_users: [{ data: { role: 'ADMIN' }, error: null }],
    lg_orgs: [{ data: null, error: null }],
  });

  const result = await run('INVITE_ORG_ADMIN', { orgId: 'org-1', fullName: 'Juan Perez', email: 'juan@test.com' }, db, 'user-1');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'ORG_NOT_FOUND');
});

test('INVITE_ORG_ADMIN rechaza al llegar al límite de 5 (activos + pendientes) sin llamar a la RPC', async () => {
  const db = createMockDb({
    lg_org_users: [
      { data: { role: 'ADMIN' }, error: null }, // isOrgAdmin
      { data: null, error: null, count: 4 }, // count activos
    ],
    lg_orgs: [{ data: { name: 'Liga Test' }, error: null }],
    lg_org_admin_invites: [{ data: null, error: null, count: 1 }], // count pendientes
    rpc: { fn_invite_org_admin: [{ data: { is_new: true }, error: null }] },
  });

  const result = await run('INVITE_ORG_ADMIN', { orgId: 'org-1', fullName: 'Juan Perez', email: 'juan@test.com' }, db, 'user-1');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'ADMIN_LIMIT_REACHED');
});

// ── REMOVE_ORG_ADMIN ──────────────────────────────────────────────────────

test('REMOVE_ORG_ADMIN rechaza si requestingUserId no es ADMIN de la org (FORBIDDEN)', async () => {
  const db = createMockDb({
    lg_org_users: [{ data: null, error: null }],
  });

  const result = await run('REMOVE_ORG_ADMIN', { orgId: 'org-1', adminUserId: 'user-2' }, db, 'user-1');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'FORBIDDEN');
});

test('REMOVE_ORG_ADMIN rechaza remover al único ADMIN activo (CANNOT_REMOVE_LAST_ADMIN)', async () => {
  const db = createMockDb({
    lg_org_users: [
      { data: { role: 'ADMIN' }, error: null }, // isOrgAdmin
      { data: null, error: null, count: 1 }, // count activos
    ],
  });

  const result = await run('REMOVE_ORG_ADMIN', { orgId: 'org-1', adminUserId: 'user-1' }, db, 'user-1');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'CANNOT_REMOVE_LAST_ADMIN');
});

test('REMOVE_ORG_ADMIN remueve correctamente cuando hay más de un ADMIN activo', async () => {
  const db = createMockDb({
    lg_org_users: [
      { data: { role: 'ADMIN' }, error: null }, // isOrgAdmin
      { data: null, error: null, count: 2 }, // count activos
      { data: null, error: null }, // delete
    ],
  });

  const result = await run('REMOVE_ORG_ADMIN', { orgId: 'org-1', adminUserId: 'user-2' }, db, 'user-1');

  assert.equal(result.success, true);
  assert.deepEqual(result.data, { removed: true });
});
