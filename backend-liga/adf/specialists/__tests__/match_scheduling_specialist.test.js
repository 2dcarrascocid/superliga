import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MatchSchedulingSpecialist } from '../match_scheduling_specialist.js';
import { createMockDb } from './test_utils/mock_db.js';

function run(operation, payload, db, userId) {
  const specialist = new MatchSchedulingSpecialist();
  return specialist.execute({ input: { operation, payload, db, userId } });
}

test('PREVIEW_SCHEDULE sin torneos en la temporada devuelve listas vacías sin error', async () => {
  const db = createMockDb({
    lg_seasons: [{ data: { id: 'season-1', org_id: 'org-1' } }],
    lg_tournaments: [{ data: [], error: null }],
  });
  const result = await run('PREVIEW_SCHEDULE', { seasonId: 'season-1', date: '2026-09-12' }, db);

  assert.equal(result.success, true);
  assert.deepEqual(result.data.matches, []);
  assert.deepEqual(result.data.proposal, []);
});

test('PREVIEW_SCHEDULE informa SEASON_NOT_FOUND si la temporada no existe', async () => {
  const db = createMockDb({
    lg_seasons: [{ data: null, error: null }],
  });
  const result = await run('PREVIEW_SCHEDULE', { seasonId: 'season-x', date: '2026-09-12' }, db);

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'SEASON_NOT_FOUND');
});

test('APPLY_SCHEDULE con 2 assignments actualiza cada partido con venue_id/match_time/time_slot', async () => {
  const updatePayloads = [];
  const db = createMockDb({
    lg_matches: [{ data: null, error: null }, { data: null, error: null }],
  }, {
    onUpdate: (table, payload) => { if (table === 'lg_matches') updatePayloads.push(payload); },
  });

  const result = await run('APPLY_SCHEDULE', {
    seasonId: 'season-1',
    date: '2026-09-12',
    orgId: 'org-1',
    assignments: [
      { matchId: 'm-1', venueId: 'v-1', matchTime: '14:00:00', timeSlot: '14:00' },
      { matchId: 'm-2', venueId: 'v-1', matchTime: '15:10:00', timeSlot: '15:10' },
    ],
  }, db, 'admin-1');

  assert.equal(result.success, true);
  assert.equal(result.data.matchesUpdated, 2);
  assert.equal(updatePayloads.length, 2);
  assert.equal(updatePayloads[0].venue_id, 'v-1');
  assert.equal(updatePayloads[0].match_time, '14:00:00');
  assert.equal(updatePayloads[0].time_slot, '14:00');
  assert.equal(updatePayloads[1].match_time, '15:10:00');
  assert.equal(updatePayloads[1].time_slot, '15:10');
});

test('APPLY_SCHEDULE con failedClubIds no vacío hace upsert de lg_matchday_scheduling_failures con las filas esperadas', async () => {
  let upsertPayload;
  const db = createMockDb({
    lg_matches: [{ data: null, error: null }],
    lg_matchday_scheduling_failures: [{ data: null, error: null }],
  }, {
    onInsert: (table, payload) => { if (table === 'lg_matchday_scheduling_failures') upsertPayload = payload; },
  });

  const result = await run('APPLY_SCHEDULE', {
    seasonId: 'season-1',
    date: '2026-09-12',
    orgId: 'org-1',
    assignments: [{ matchId: 'm-1', venueId: 'v-1', matchTime: '14:00:00', timeSlot: '14:00' }],
    failedClubIds: ['club-1'],
    partiallyFailedClubIds: ['club-2'],
  }, db, 'admin-1');

  assert.equal(result.success, true);
  assert.deepEqual(upsertPayload, [
    { org_id: 'org-1', season_id: 'season-1', club_id: 'club-1', match_date: '2026-09-12', reason: 'SPLIT_VENUE', created_by: 'admin-1' },
    { org_id: 'org-1', season_id: 'season-1', club_id: 'club-2', match_date: '2026-09-12', reason: 'PARTIAL_CONTINUITY', created_by: 'admin-1' },
  ]);
});

test('APPLY_SCHEDULE cuando un update de lg_matches falla devuelve APPLY_SCHEDULE_PARTIAL_FAILURE', async () => {
  const db = createMockDb({
    lg_matches: [{ data: null, error: new Error('boom') }],
  });

  const result = await run('APPLY_SCHEDULE', {
    seasonId: 'season-1',
    date: '2026-09-12',
    orgId: 'org-1',
    assignments: [{ matchId: 'm-1', venueId: 'v-1', matchTime: '14:00:00', timeSlot: '14:00' }],
  }, db, 'admin-1');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'APPLY_SCHEDULE_PARTIAL_FAILURE');
});

test('APPLY_SCHEDULE rechaza sin assignments (MISSING_FIELDS)', async () => {
  const result = await run('APPLY_SCHEDULE', { seasonId: 'season-1', date: '2026-09-12', assignments: [] }, createMockDb({}));
  assert.equal(result.success, false);
  assert.equal(result.error.code, 'MISSING_FIELDS');
});
