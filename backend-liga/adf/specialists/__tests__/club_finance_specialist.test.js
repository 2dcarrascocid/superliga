import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ClubFinanceSpecialist } from '../club_finance_specialist.js';
import { createMockDb } from './test_utils/mock_db.js';

function run(operation, payload, db, userId) {
  const specialist = new ClubFinanceSpecialist();
  return specialist.execute({ input: { operation, payload, db, userId } });
}

// ── CREATE_EVENT ─────────────────────────────────────────────────────────

test('CREATE_EVENT rechaza a un usuario que no es ADMIN de la organización (FORBIDDEN)', async () => {
  const db = createMockDb({
    lg_org_users: [{ data: null, error: null }],
  });

  const result = await run('CREATE_EVENT', {
    orgId: 'org-1', clubId: 'club-1', name: 'Fecha vs Rival', eventType: 'FECHA_PARTIDO', direction: 'EGRESO',
  }, db, 'random-user');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'FORBIDDEN');
});

test('CREATE_EVENT crea el evento cuando el usuario es ADMIN de organización', async () => {
  let insertedRow = null;
  const db = createMockDb(
    {
      lg_org_users: [{ data: { role: 'ADMIN' }, error: null }],
      lg_club_events: [(payload) => ({ data: { id: 'event-1', ...payload }, error: null })],
    },
    { onInsert: (table, payload) => { if (table === 'lg_club_events') insertedRow = payload; } }
  );

  const result = await run('CREATE_EVENT', {
    orgId: 'org-1', clubId: 'club-1', name: 'Colecta viaje', eventType: 'COLECTA', direction: 'INGRESO',
  }, db, 'admin-1');

  assert.equal(result.success, true);
  assert.equal(result.data.event.id, 'event-1');
  assert.equal(insertedRow.event_type, 'COLECTA');
  assert.equal(insertedRow.direction, 'INGRESO');
  assert.equal(insertedRow.created_by, 'admin-1');
});

test('CREATE_EVENT rechaza un event_type inválido (INVALID_EVENT_TYPE) sin llegar a tocar la DB', async () => {
  const result = await run('CREATE_EVENT', {
    orgId: 'org-1', clubId: 'club-1', name: 'Fecha', eventType: 'NO_EXISTE',
  }, createMockDb({}));

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'INVALID_EVENT_TYPE');
});

// ── SET_EVENT_PLAYERS ────────────────────────────────────────────────────

test('SET_EVENT_PLAYERS recalcula la fila resumen del ledger (suma de amount de los charges)', async () => {
  let ledgerInsertedRow = null;
  const db = createMockDb(
    {
      lg_club_events: [{
        data: { id: 'event-1', org_id: 'org-1', club_id: 'club-1', direction: 'EGRESO', description: 'Arriendo cancha', event_date: '2026-09-10' },
        error: null,
      }],
      lg_org_users: [{ data: { role: 'ADMIN' }, error: null }],
      lg_club_event_charges: [
        { data: null, error: null }, // respuesta al upsert(rows).select()
        { data: [{ amount: 1000, paid_amount: 0 }, { amount: 2000, paid_amount: 0 }], error: null }, // suma en upsertEventSummaryEntry
        { data: [], error: null }, // listado final de charges con player
      ],
      lg_ledger_entries: [
        { data: null, error: null }, // no existe fila resumen todavía
        (payload) => ({ data: { id: 'ledger-1', ...payload }, error: null }), // insert de la fila resumen
      ],
    },
    { onInsert: (table, payload) => { if (table === 'lg_ledger_entries') ledgerInsertedRow = payload; } }
  );

  const result = await run('SET_EVENT_PLAYERS', {
    eventId: 'event-1',
    charges: [{ playerId: 'p-1', amount: 1000 }, { playerId: 'p-2', amount: 2000 }],
  }, db, 'admin-1');

  assert.equal(result.success, true);
  assert.equal(ledgerInsertedRow.amount, 3000);
  assert.equal(ledgerInsertedRow.category, 'EVENTO');
  assert.equal(ledgerInsertedRow.event_id, 'event-1');
  assert.equal(ledgerInsertedRow.club_id, 'club-1');
  assert.equal(ledgerInsertedRow.org_id, 'org-1');
});

test('SET_EVENT_PLAYERS rechaza a un usuario que no es ADMIN de la organización (FORBIDDEN)', async () => {
  const db = createMockDb({
    lg_club_events: [{ data: { id: 'event-1', org_id: 'org-1', club_id: 'club-1' }, error: null }],
    lg_org_users: [{ data: null, error: null }],
  });

  const result = await run('SET_EVENT_PLAYERS', {
    eventId: 'event-1', charges: [{ playerId: 'p-1', amount: 1000 }],
  }, db, 'random-user');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'FORBIDDEN');
});

test('SET_EVENT_PLAYERS rechaza un charge sin playerId o con amount inválido (INVALID_CHARGE) sin tocar la DB', async () => {
  const result = await run('SET_EVENT_PLAYERS', {
    eventId: 'event-1', charges: [{ playerId: 'p-1', amount: -5 }],
  }, createMockDb({}));

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'INVALID_CHARGE');
});

// ── RECORD_EVENT_PLAYER_PAYMENT ──────────────────────────────────────────

test('RECORD_EVENT_PLAYER_PAYMENT actualiza el charge y recalcula la fila resumen del ledger', async () => {
  let chargeUpdatePayload = null;
  let ledgerUpdatePayload = null;
  const db = createMockDb(
    {
      lg_club_event_charges: [
        {
          data: {
            id: 'charge-1', event_id: 'event-1', player_id: 'p-1', amount: 1000, paid_amount: 0,
            event: { id: 'event-1', org_id: 'org-1', club_id: 'club-1', direction: 'EGRESO', description: 'd', event_date: '2026-09-10' },
          },
          error: null,
        }, // fetch charge + event
        (payload) => ({ data: { id: 'charge-1', amount: 1000, ...payload, player: { id: 'p-1', first_name: 'Juan', last_name: 'Perez' } }, error: null }), // update charge
        { data: [{ amount: 1000, paid_amount: 500 }], error: null }, // suma en upsertEventSummaryEntry
      ],
      lg_org_users: [{ data: { role: 'ADMIN' }, error: null }],
      lg_ledger_entries: [
        { data: { id: 'ledger-1' }, error: null }, // ya existe fila resumen
        (payload) => ({ data: { id: 'ledger-1', ...payload }, error: null }), // update de la fila resumen
      ],
    },
    {
      onUpdate: (table, payload) => {
        if (table === 'lg_club_event_charges') chargeUpdatePayload = payload;
        if (table === 'lg_ledger_entries') ledgerUpdatePayload = payload;
      },
    }
  );

  const result = await run('RECORD_EVENT_PLAYER_PAYMENT', { chargeId: 'charge-1', amount: 500 }, db, 'admin-1');

  assert.equal(result.success, true);
  assert.equal(chargeUpdatePayload.paid_amount, 500);
  assert.equal(result.data.charge.paid_amount, 500);
  assert.equal(ledgerUpdatePayload.paid_amount, 500);
  assert.equal(ledgerUpdatePayload.amount, 1000);
});

test('RECORD_EVENT_PLAYER_PAYMENT rechaza a un usuario que no es ADMIN de la organización (FORBIDDEN)', async () => {
  const db = createMockDb({
    lg_club_event_charges: [{
      data: { id: 'charge-1', amount: 1000, paid_amount: 0, event: { id: 'event-1', org_id: 'org-1', club_id: 'club-1' } },
      error: null,
    }],
    lg_org_users: [{ data: null, error: null }],
  });

  const result = await run('RECORD_EVENT_PLAYER_PAYMENT', { chargeId: 'charge-1', amount: 500 }, db, 'random-user');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'FORBIDDEN');
});

// ── DELETE_EVENT ─────────────────────────────────────────────────────────

test('DELETE_EVENT rechaza si el evento tiene charges ya pagados (EVENT_HAS_PAID_CHARGES)', async () => {
  const db = createMockDb({
    lg_club_events: [{ data: { org_id: 'org-1' }, error: null }],
    lg_org_users: [{ data: { role: 'ADMIN' }, error: null }],
    lg_club_event_charges: [{ data: [{ id: 'charge-1' }], error: null }],
  });

  const result = await run('DELETE_EVENT', { eventId: 'event-1' }, db, 'admin-1');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'EVENT_HAS_PAID_CHARGES');
});

test('DELETE_EVENT elimina el evento cuando no tiene charges pagados', async () => {
  const db = createMockDb({
    lg_club_events: [
      { data: { org_id: 'org-1' }, error: null }, // fetch
      { data: null, error: null }, // delete
    ],
    lg_org_users: [{ data: { role: 'ADMIN' }, error: null }],
    lg_club_event_charges: [{ data: [], error: null }],
  });

  const result = await run('DELETE_EVENT', { eventId: 'event-1' }, db, 'admin-1');

  assert.equal(result.success, true);
  assert.deepEqual(result.data, { deleted: true, eventId: 'event-1' });
});

test('DELETE_EVENT rechaza a un usuario que no es ADMIN de la organización (FORBIDDEN)', async () => {
  const db = createMockDb({
    lg_club_events: [{ data: { org_id: 'org-1' }, error: null }],
    lg_org_users: [{ data: null, error: null }],
  });

  const result = await run('DELETE_EVENT', { eventId: 'event-1' }, db, 'random-user');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'FORBIDDEN');
});
