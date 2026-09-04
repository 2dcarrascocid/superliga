import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ClubSeriesSpecialist } from '../club_series_specialist.js';
import { createMockDb } from './test_utils/mock_db.js';

function run(operation, payload, db, userId = 'user-1') {
  return new ClubSeriesSpecialist().execute({ input: { operation, payload, db, userId } });
}

test('CREATE_SERIES fuerza active=true aunque el cliente envíe false', async () => {
  let inserted;
  const db = createMockDb({
    lg_clubs: [{ data: { org_id: 'org-1' } }],
    lg_org_users: [{ data: { role: 'ADMIN' } }],
    lg_club_users: [{ data: null }],
    lg_club_series: [{ data: { id: 'series-1', active: true }, error: null }],
  }, { onInsert: (_table, payload) => { inserted = payload; } });

  const result = await run('CREATE_SERIES', { clubId: 'club-1', name: 'Honor', active: false }, db);
  assert.equal(result.success, true);
  assert.equal(inserted.active, true);
});

test('DELETE_SERIES bloquea una serie inscrita con código estable', async () => {
  const db = createMockDb({
    lg_club_series: [{ data: { id: 'series-1', club_id: 'club-1' } }],
    lg_clubs: [{ data: { org_id: 'org-1' } }],
    lg_org_users: [{ data: { role: 'ADMIN' } }],
    lg_club_users: [{ data: null }],
    lg_tournament_teams: [{ data: null, error: null, count: 1 }],
  });

  const result = await run('DELETE_SERIES', { seriesId: 'series-1' }, db);
  assert.equal(result.success, false);
  assert.equal(result.error.code, 'SERIES_REGISTERED_IN_TOURNAMENT');
});

