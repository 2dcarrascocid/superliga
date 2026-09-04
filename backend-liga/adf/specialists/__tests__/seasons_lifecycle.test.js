import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SeasonsSpecialist } from '../seasons_specialist.js';
import { createMockDb } from './test_utils/mock_db.js';

function run(payload, db, userId = 'user-1') {
  return new SeasonsSpecialist().execute({ input: { operation: 'CLOSE_SEASON', payload, db, userId } });
}

test('CLOSE_SEASON exige ADMIN de la organización', async () => {
  const db = createMockDb({ lg_org_users: [{ data: { role: 'MEMBER' } }] });
  const result = await run({ seasonId: 'season-1', orgId: 'org-1' }, db);
  assert.equal(result.success, false);
  assert.equal(result.error.code, 'FORBIDDEN');
});

test('CLOSE_SEASON invoca RPC atómica con identidad derivada del backend', async () => {
  let call;
  const db = createMockDb({
    lg_org_users: [{ data: { role: 'ADMIN' } }],
    rpc: { fn_close_season_atomic: [{ data: { ok: true, code: 'SEASON_CLOSED', deactivatedSeries: 3 }, error: null }] },
  }, { onRpc: (name, params) => { call = { name, params }; } });
  const result = await run({ seasonId: 'season-1', orgId: 'org-1' }, db, 'admin-1');
  assert.equal(result.success, true);
  assert.deepEqual(call, { name: 'fn_close_season_atomic', params: { p_season_id: 'season-1', p_org_id: 'org-1' } });
});

