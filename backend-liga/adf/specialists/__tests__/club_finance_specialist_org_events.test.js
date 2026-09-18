import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ClubFinanceSpecialist } from '../club_finance_specialist.js';
import { createMockDb } from './test_utils/mock_db.js';

function run(operation, payload, db, userId) {
  const specialist = new ClubFinanceSpecialist();
  return specialist.execute({ input: { operation, payload, db, userId } });
}

// ── CREATE_ORG_EVENT ─────────────────────────────────────────────────────

test('CREATE_ORG_EVENT rechaza a un usuario que no es ADMIN de la organización (FORBIDDEN)', async () => {
  const db = createMockDb({ lg_org_users: [{ data: null, error: null }] });

  const result = await run('CREATE_ORG_EVENT', {
    orgId: 'org-1', seasonId: 'season-1', name: 'Cuota social', cost: 5000,
  }, db, 'random-user');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'FORBIDDEN');
});

test('CREATE_ORG_EVENT genera un charge por cada club participante de la temporada', async () => {
  let insertedCharges = null;
  const db = createMockDb(
    {
      lg_org_users: [{ data: { role: 'ADMIN' }, error: null }],
      lg_org_events: [(payload) => ({ data: { id: 'orgevent-1', ...payload }, error: null })],
      lg_tournaments: [{ data: [{ id: 't-1' }, { id: 't-2' }], error: null }],
      lg_tournament_teams: [{
        data: [
          { series_id: 's-1', series: { club_id: 'club-1' } },
          { series_id: 's-2', series: { club_id: 'club-2' } },
          { series_id: 's-3', series: { club_id: 'club-1' } }, // club-1 repetido -> debe deduplicarse
        ],
        error: null,
      }],
      lg_org_event_charges: [{ data: null, error: null }],
    },
    { onInsert: (table, payload) => { if (table === 'lg_org_event_charges') insertedCharges = payload; } }
  );

  const result = await run('CREATE_ORG_EVENT', {
    orgId: 'org-1', seasonId: 'season-1', name: 'Cuota social', cost: 5000, eventType: 'SOCIAL',
  }, db, 'admin-1');

  assert.equal(result.success, true);
  assert.equal(result.data.orgEvent.id, 'orgevent-1');
  assert.equal(result.data.orgEvent.clubs_count, 2);
  assert.equal(insertedCharges.length, 2);
  assert.deepEqual(new Set(insertedCharges.map((c) => c.club_id)), new Set(['club-1', 'club-2']));
  assert.ok(insertedCharges.every((c) => c.org_event_id === 'orgevent-1' && c.amount === 5000));
});

test('CREATE_ORG_EVENT rechaza un eventType inválido (INVALID_EVENT_TYPE) sin tocar la DB', async () => {
  const result = await run('CREATE_ORG_EVENT', {
    orgId: 'org-1', seasonId: 'season-1', name: 'Evento', cost: 100, eventType: 'NO_EXISTE',
  }, createMockDb({}));

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'INVALID_EVENT_TYPE');
});

// ── SET_CLUB_EXEMPT ──────────────────────────────────────────────────────

test('SET_CLUB_EXEMPT rechaza sobre un evento ya CERRADO (EVENT_CLOSED)', async () => {
  const db = createMockDb({
    lg_org_events: [{ data: { id: 'orgevent-1', org_id: 'org-1', status: 'CERRADO' }, error: null }],
    lg_org_users: [{ data: { role: 'ADMIN' }, error: null }],
  });

  const result = await run('SET_CLUB_EXEMPT', {
    eventId: 'orgevent-1', clubId: 'club-1', isExempt: true, exemptReason: 'acuerdo especial',
  }, db, 'admin-1');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'EVENT_CLOSED');
});

test('SET_CLUB_EXEMPT marca un club exento con su motivo', async () => {
  let updatePayload = null;
  const db = createMockDb(
    {
      lg_org_events: [{ data: { id: 'orgevent-1', org_id: 'org-1', status: 'ABIERTO', end_date: null }, error: null }],
      lg_org_users: [{ data: { role: 'ADMIN' }, error: null }],
      lg_org_event_charges: [(payload) => ({ data: { id: 'charge-1', club_id: 'club-1', amount: 5000, paid_amount: 0, ...payload }, error: null })],
    },
    { onUpdate: (table, payload) => { if (table === 'lg_org_event_charges') updatePayload = payload; } }
  );

  const result = await run('SET_CLUB_EXEMPT', {
    eventId: 'orgevent-1', clubId: 'club-1', isExempt: true, exemptReason: 'club nuevo',
  }, db, 'admin-1');

  assert.equal(result.success, true);
  assert.equal(updatePayload.is_exempt, true);
  assert.equal(updatePayload.exempt_reason, 'club nuevo');
  assert.equal(result.data.charge.status, 'EXENTO');
});

// ── RECORD_ORG_EVENT_CLUB_PAYMENT ────────────────────────────────────────

test('RECORD_ORG_EVENT_CLUB_PAYMENT rechaza un pago sobre un charge exento (CHARGE_IS_EXEMPT)', async () => {
  const db = createMockDb({
    lg_org_event_charges: [{
      data: {
        id: 'charge-1', amount: 5000, paid_amount: 0, is_exempt: true,
        event: { id: 'orgevent-1', org_id: 'org-1', status: 'ABIERTO' },
      },
      error: null,
    }],
    lg_org_users: [{ data: { role: 'ADMIN' }, error: null }],
  });

  const result = await run('RECORD_ORG_EVENT_CLUB_PAYMENT', { chargeId: 'charge-1', amount: 1000 }, db, 'admin-1');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'CHARGE_IS_EXEMPT');
});

test('RECORD_ORG_EVENT_CLUB_PAYMENT rechaza sobre un evento CERRADO (EVENT_CLOSED)', async () => {
  const db = createMockDb({
    lg_org_event_charges: [{
      data: {
        id: 'charge-1', amount: 5000, paid_amount: 0, is_exempt: false,
        event: { id: 'orgevent-1', org_id: 'org-1', status: 'CERRADO' },
      },
      error: null,
    }],
    lg_org_users: [{ data: { role: 'ADMIN' }, error: null }],
  });

  const result = await run('RECORD_ORG_EVENT_CLUB_PAYMENT', { chargeId: 'charge-1', amount: 1000 }, db, 'admin-1');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'EVENT_CLOSED');
});

test('RECORD_ORG_EVENT_CLUB_PAYMENT acumula paid_amount y guarda el medio de pago', async () => {
  let updatePayload = null;
  const db = createMockDb(
    {
      lg_org_event_charges: [
        {
          data: {
            id: 'charge-1', amount: 5000, paid_amount: 2000, is_exempt: false, payment_method: null,
            event: { id: 'orgevent-1', org_id: 'org-1', status: 'ABIERTO' },
          },
          error: null,
        },
        (payload) => ({ data: { id: 'charge-1', amount: 5000, ...payload, club: { id: 'club-1', name: 'Deportivo Sur' } }, error: null }),
      ],
      lg_org_users: [{ data: { role: 'ADMIN' }, error: null }],
    },
    { onUpdate: (table, payload) => { if (table === 'lg_org_event_charges') updatePayload = payload; } }
  );

  const result = await run('RECORD_ORG_EVENT_CLUB_PAYMENT', {
    chargeId: 'charge-1', amount: 3000, paymentMethod: 'TRANSFERENCIA',
  }, db, 'admin-1');

  assert.equal(result.success, true);
  assert.equal(updatePayload.paid_amount, 5000);
  assert.equal(updatePayload.payment_method, 'TRANSFERENCIA');
  assert.equal(result.data.charge.status, 'PAGADO');
});

// ── CLOSE_ORG_EVENT ───────────────────────────────────────────────────────

test('CLOSE_ORG_EVENT rechaza si el evento ya está CERRADO (EVENT_ALREADY_CLOSED)', async () => {
  const db = createMockDb({
    lg_org_events: [{ data: { id: 'orgevent-1', org_id: 'org-1', status: 'CERRADO' }, error: null }],
    lg_org_users: [{ data: { role: 'ADMIN' }, error: null }],
  });

  const result = await run('CLOSE_ORG_EVENT', { eventId: 'orgevent-1' }, db, 'admin-1');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'EVENT_ALREADY_CLOSED');
});

test('CLOSE_ORG_EVENT traspasa solo los charges no exentos a lg_ledger_entries y cierra el evento', async () => {
  let ledgerInsertedRows = null;
  const db = createMockDb(
    {
      lg_org_events: [
        { data: { id: 'orgevent-1', org_id: 'org-1', status: 'ABIERTO', direction: 'INGRESO', name: 'Cuota social', end_date: '2026-12-01' }, error: null }, // fetch
        (payload) => ({ data: { id: 'orgevent-1', ...payload }, error: null }), // update a CERRADO
      ],
      lg_org_users: [{ data: { role: 'ADMIN' }, error: null }],
      lg_org_event_charges: [{
        data: [
          { id: 'charge-1', club_id: 'club-1', amount: 5000, paid_amount: 5000, paid_at: '2026-10-01', is_exempt: false },
          { id: 'charge-2', club_id: 'club-2', amount: 5000, paid_amount: 0, paid_at: null, is_exempt: true },
        ],
        error: null,
      }],
      lg_ledger_entries: [{ data: null, error: null }],
    },
    { onInsert: (table, payload) => { if (table === 'lg_ledger_entries') ledgerInsertedRows = payload; } }
  );

  const result = await run('CLOSE_ORG_EVENT', { eventId: 'orgevent-1' }, db, 'admin-1');

  assert.equal(result.success, true);
  assert.equal(ledgerInsertedRows.length, 1);
  assert.equal(ledgerInsertedRows[0].club_id, 'club-1');
  assert.equal(ledgerInsertedRows[0].category, 'EVENTO_ORG');
  assert.equal(ledgerInsertedRows[0].org_event_id, 'orgevent-1');
  assert.equal(ledgerInsertedRows[0].amount, 5000);
  assert.equal(result.data.orgEvent.status, 'CERRADO');
});
