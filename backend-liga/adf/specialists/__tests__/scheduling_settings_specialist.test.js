import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SchedulingSettingsSpecialist } from '../scheduling_settings_specialist.js';
import { createMockDb } from './test_utils/mock_db.js';

function run(operation, payload, db, userId) {
  const specialist = new SchedulingSettingsSpecialist();
  return specialist.execute({ input: { operation, payload, db, userId } });
}

/**
 * createMockDb().from(table).upsert(payload) del mock no propaga el segundo
 * argumento (options: { onConflict }) al callback onInsert — solo reproduce
 * la forma { data, error }. Para poder aserir sobre onConflict acá,
 * envolvemos `.from()` y espiamos `.upsert()` antes de delegar al builder
 * real del mock.
 */
function createDbWithUpsertSpy(queues, onUpsertCall) {
  const baseDb = createMockDb(queues);
  return {
    ...baseDb,
    from(table) {
      const builder = baseDb.from(table);
      const originalUpsert = builder.upsert;
      builder.upsert = (payload, options) => {
        onUpsertCall(table, payload, options);
        return originalUpsert(payload);
      };
      return builder;
    },
  };
}

test('GET_SCHEDULING_SETTINGS devuelve los defaults de negocio cuando la org no tiene fila configurada', async () => {
  const db = createMockDb({
    lg_scheduling_settings: [{ data: null, error: null }],
  });
  const result = await run('GET_SCHEDULING_SETTINGS', { orgId: 'org-1' }, db);

  assert.equal(result.success, true);
  assert.deepEqual(result.data.settings, {
    orgId: 'org-1',
    halfDurationMinutes: 30,
    halftimeBreakMinutes: 5,
    turnaroundMinutes: 5,
    defaultStartTime: '14:00:00',
    matchDurationMinutes: 65,
    blockDurationMinutes: 70,
  });
});

test('GET_SCHEDULING_SETTINGS devuelve la fila existente con los campos calculados correctos', async () => {
  const db = createMockDb({
    lg_scheduling_settings: [{
      data: {
        org_id: 'org-1',
        half_duration_minutes: 25,
        halftime_break_minutes: 10,
        turnaround_minutes: 8,
        default_start_time: '15:30:00',
      },
      error: null,
    }],
  });
  const result = await run('GET_SCHEDULING_SETTINGS', { orgId: 'org-1' }, db);

  assert.equal(result.success, true);
  assert.deepEqual(result.data.settings, {
    orgId: 'org-1',
    halfDurationMinutes: 25,
    halftimeBreakMinutes: 10,
    turnaroundMinutes: 8,
    defaultStartTime: '15:30:00',
    matchDurationMinutes: 60, // 25*2 + 10
    blockDurationMinutes: 68, // 60 + 8
  });
});

test('GET_SCHEDULING_SETTINGS rechaza sin orgId (MISSING_FIELDS)', async () => {
  const result = await run('GET_SCHEDULING_SETTINGS', {}, createMockDb({}));
  assert.equal(result.success, false);
  assert.equal(result.error.code, 'MISSING_FIELDS');
});

test('UPDATE_SCHEDULING_SETTINGS rechaza sin orgId (MISSING_FIELDS)', async () => {
  const result = await run('UPDATE_SCHEDULING_SETTINGS', { halfDurationMinutes: 30 }, createMockDb({}));
  assert.equal(result.success, false);
  assert.equal(result.error.code, 'MISSING_FIELDS');
});

test('UPDATE_SCHEDULING_SETTINGS rechaza con halfDurationMinutes <= 0 (INVALID_FIELDS)', async () => {
  const result = await run('UPDATE_SCHEDULING_SETTINGS', { orgId: 'org-1', halfDurationMinutes: 0 }, createMockDb({}));
  assert.equal(result.success, false);
  assert.equal(result.error.code, 'INVALID_FIELDS');
});

test('UPDATE_SCHEDULING_SETTINGS rechaza con halftimeBreakMinutes negativo (INVALID_FIELDS)', async () => {
  const result = await run('UPDATE_SCHEDULING_SETTINGS', { orgId: 'org-1', halftimeBreakMinutes: -1 }, createMockDb({}));
  assert.equal(result.success, false);
  assert.equal(result.error.code, 'INVALID_FIELDS');
});

test('UPDATE_SCHEDULING_SETTINGS hace upsert con onConflict org_id mergeando con la fila existente', async () => {
  let upsertPayload;
  let upsertOptions;
  const db = createDbWithUpsertSpy({
    lg_scheduling_settings: [
      { data: { org_id: 'org-1', half_duration_minutes: 25, halftime_break_minutes: 10, turnaround_minutes: 8, default_start_time: '15:30:00' }, error: null }, // SELECT existente
      {
        data: { org_id: 'org-1', half_duration_minutes: 35, halftime_break_minutes: 10, turnaround_minutes: 8, default_start_time: '15:30:00' },
        error: null,
      }, // upsert().select().single()
    ],
  }, (table, payload, options) => {
    if (table === 'lg_scheduling_settings') {
      upsertPayload = payload;
      upsertOptions = options;
    }
  });

  const result = await run('UPDATE_SCHEDULING_SETTINGS', { orgId: 'org-1', halfDurationMinutes: 35 }, db);

  assert.equal(result.success, true);
  assert.equal(upsertPayload.org_id, 'org-1');
  assert.equal(upsertPayload.half_duration_minutes, 35);
  assert.equal(upsertPayload.halftime_break_minutes, 10); // preservado de la fila existente
  assert.equal(upsertPayload.turnaround_minutes, 8); // preservado de la fila existente
  assert.equal(upsertPayload.default_start_time, '15:30:00'); // preservado de la fila existente
  assert.ok(upsertPayload.updated_at);
  assert.deepEqual(upsertOptions, { onConflict: 'org_id' });

  assert.equal(result.data.settings.halfDurationMinutes, 35);
  assert.equal(result.data.settings.matchDurationMinutes, 80); // 35*2 + 10
  assert.equal(result.data.settings.blockDurationMinutes, 88); // 80 + 8
});
