import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PollsSpecialist } from '../polls_specialist.js';
import { buildPollResults, normalizeOptions } from '../lib/poll_results.js';
import { createMockDb } from './test_utils/mock_db.js';

function run(operation, payload, db, userId) {
  const specialist = new PollsSpecialist();
  return specialist.execute({ input: { operation, payload, db, userId } });
}

const FUTURE = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
const PAST = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
const LONG_AGO = new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString();

// ── lib/poll_results.js ──────────────────────────────────────────────────

test('normalizeOptions exige al menos 2 alternativas distintas', () => {
  assert.ok(normalizeOptions(['Sí']).error);
  assert.ok(normalizeOptions(['Sí', '  ']).error);
  assert.ok(normalizeOptions(['Sí', 'sí']).error);
  assert.deepEqual(normalizeOptions([' Sí ', 'No', 'Me abstengo']).options, ['Sí', 'No', 'Me abstengo']);
});

test('buildPollResults no publica conteos mientras la votación está ABIERTA', () => {
  const poll = { status: 'ABIERTA', is_secret: false };
  const options = [{ id: 'o1', label: 'Sí', position: 0 }, { id: 'o2', label: 'No', position: 1 }];
  const votes = [
    { club_id: 'c1', status: 'VOTO', option_id: 'o1' },
    { club_id: 'c2', status: 'PENDIENTE', option_id: null },
  ];
  const r = buildPollResults(poll, options, votes);
  assert.equal(r.results, null);
  assert.equal(r.summary.voted_count, 1);
  assert.equal(r.summary.pending_count, 1);
  assert.ok(r.clubs.every((c) => c.option_id === null));
});

test('buildPollResults al cerrar cuenta PENDIENTE como abstención y detecta empate', () => {
  const poll = { status: 'CERRADA', is_secret: false };
  const options = [{ id: 'o1', label: 'Sí', position: 0 }, { id: 'o2', label: 'No', position: 1 }];
  const votes = [
    { club_id: 'c1', status: 'VOTO', option_id: 'o1' },
    { club_id: 'c2', status: 'VOTO', option_id: 'o2' },
    { club_id: 'c3', status: 'PENDIENTE', option_id: null },
    { club_id: 'c4', status: 'ABSTENCION', option_id: null },
  ];
  const r = buildPollResults(poll, options, votes);
  assert.equal(r.summary.abstention_count, 2);
  assert.equal(r.summary.pending_count, 0);
  assert.equal(r.summary.participation_pct, 50);
  assert.deepEqual(r.results.map((x) => x.votes), [1, 1]);
  assert.equal(r.is_tie, true);
  assert.equal(r.clubs.find((c) => c.club_id === 'c1').option_id, 'o1');
  assert.equal(r.clubs.find((c) => c.club_id === 'c3').status, 'ABSTENCION');
});

test('buildPollResults en votación secreta no revela la alternativa de cada club', () => {
  const poll = { status: 'CERRADA', is_secret: true };
  const options = [{ id: 'o1', label: 'Sí', position: 0 }, { id: 'o2', label: 'No', position: 1 }];
  const votes = [{ club_id: 'c1', status: 'VOTO', option_id: 'o1' }];
  const r = buildPollResults(poll, options, votes);
  assert.equal(r.results[0].votes, 1);
  assert.deepEqual(r.winners, ['o1']);
  assert.equal(r.clubs[0].option_id, null);
  assert.equal(r.clubs[0].status, 'VOTO');
});

// ── CREATE_POLL ──────────────────────────────────────────────────────────

test('CREATE_POLL rechaza a un usuario que no es ADMIN de la organización (FORBIDDEN)', async () => {
  const db = createMockDb({ lg_org_users: [{ data: null, error: null }] });
  const result = await run('CREATE_POLL', {
    orgId: 'org-1', title: '¿Aprobar reglamento?', options: ['Sí', 'No'], closesAt: FUTURE,
  }, db, 'random-user');
  assert.equal(result.success, false);
  assert.equal(result.error.code, 'FORBIDDEN');
});

test('CREATE_POLL rechaza menos de 2 alternativas (INVALID_OPTIONS) sin tocar la DB', async () => {
  const result = await run('CREATE_POLL', {
    orgId: 'org-1', title: '¿Aprobar?', options: ['Sí'], closesAt: FUTURE,
  }, createMockDb({}), 'admin-1');
  assert.equal(result.error.code, 'INVALID_OPTIONS');
});

test('CREATE_POLL rechaza una fecha de cierre pasada (INVALID_PERIOD)', async () => {
  const result = await run('CREATE_POLL', {
    orgId: 'org-1', title: '¿Aprobar?', options: ['Sí', 'No'], closesAt: PAST,
  }, createMockDb({}), 'admin-1');
  assert.equal(result.error.code, 'INVALID_PERIOD');
});

test('CREATE_POLL genera opciones y una fila PENDIENTE por club activo de la org', async () => {
  let insertedOptions = null;
  let insertedVotes = null;
  const db = createMockDb(
    {
      lg_org_users: [{ data: { role: 'ADMIN' }, error: null }],
      lg_clubs: [{ data: [{ id: 'club-1' }, { id: 'club-2' }, { id: 'club-3' }], error: null }],
      lg_polls: [(payload) => ({ data: { id: 'poll-1', ...payload }, error: null })],
      lg_poll_options: [(payload) => ({ data: payload.map((o, i) => ({ id: `opt-${i}`, ...o })), error: null })],
      lg_poll_votes: [{ data: null, error: null }],
    },
    {
      onInsert: (table, payload) => {
        if (table === 'lg_poll_options') insertedOptions = payload;
        if (table === 'lg_poll_votes') insertedVotes = payload;
      },
    },
  );

  const result = await run('CREATE_POLL', {
    orgId: 'org-1', title: '¿Aprobar reglamento?', options: ['Sí', 'No', 'Postergar'], closesAt: FUTURE,
  }, db, 'admin-1');

  assert.equal(result.success, true);
  assert.equal(result.data.poll.electors_count, 3);
  assert.deepEqual(insertedOptions.map((o) => [o.label, o.position]), [['Sí', 0], ['No', 1], ['Postergar', 2]]);
  assert.equal(insertedVotes.length, 3);
  assert.ok(insertedVotes.every((v) => v.poll_id === 'poll-1'));
});

test('CREATE_POLL sin clubes habilitados falla con NO_ELECTORS', async () => {
  const db = createMockDb({
    lg_org_users: [{ data: { role: 'ADMIN' }, error: null }],
    lg_clubs: [{ data: [], error: null }],
  });
  const result = await run('CREATE_POLL', {
    orgId: 'org-1', title: '¿Aprobar?', options: ['Sí', 'No'], closesAt: FUTURE,
  }, db, 'admin-1');
  assert.equal(result.error.code, 'NO_ELECTORS');
});

// ── CAST_VOTE ────────────────────────────────────────────────────────────

const openPoll = { id: 'poll-1', org_id: 'org-1', status: 'ABIERTA', opens_at: LONG_AGO, closes_at: FUTURE };

test('CAST_VOTE rechaza a quien no es representante del club (FORBIDDEN)', async () => {
  const db = createMockDb({
    lg_polls: [{ data: openPoll, error: null }],
    lg_club_users: [{ data: null, error: null }],
  });
  const result = await run('CAST_VOTE', { pollId: 'poll-1', clubId: 'club-1', optionId: 'opt-1' }, db, 'user-x');
  assert.equal(result.error.code, 'FORBIDDEN');
});

test('CAST_VOTE rechaza un segundo voto del mismo club (ALREADY_VOTED)', async () => {
  const db = createMockDb({
    lg_polls: [{ data: openPoll, error: null }],
    lg_club_users: [{ data: { role: 'ADMIN_CLUB' }, error: null }],
    lg_poll_options: [{ data: { id: 'opt-1' }, error: null }],
    lg_poll_votes: [{ data: { status: 'VOTO' }, error: null }],
  });
  const result = await run('CAST_VOTE', { pollId: 'poll-1', clubId: 'club-1', optionId: 'opt-1' }, db, 'rep-1');
  assert.equal(result.error.code, 'ALREADY_VOTED');
});

test('CAST_VOTE registra el voto del representante', async () => {
  let votePatch = null;
  const db = createMockDb(
    {
      lg_polls: [{ data: openPoll, error: null }],
      lg_club_users: [{ data: { role: 'ADMIN_CLUB' }, error: null }],
      lg_poll_options: [{ data: { id: 'opt-1' }, error: null }],
      lg_poll_votes: [
        { data: { status: 'PENDIENTE' }, error: null },
        (patch) => ({ data: { poll_id: 'poll-1', club_id: 'club-1', ...patch }, error: null }),
      ],
    },
    { onUpdate: (table, payload) => { if (table === 'lg_poll_votes') votePatch = payload; } },
  );
  const result = await run('CAST_VOTE', { pollId: 'poll-1', clubId: 'club-1', optionId: 'opt-1' }, db, 'rep-1');
  assert.equal(result.success, true);
  assert.equal(votePatch.status, 'VOTO');
  assert.equal(votePatch.option_id, 'opt-1');
  assert.equal(votePatch.voted_by, 'rep-1');
});

test('CAST_VOTE sobre una votación con plazo vencido la cierra y rechaza (POLL_CLOSED)', async () => {
  const updates = [];
  const expired = { ...openPoll, closes_at: PAST };
  const db = createMockDb(
    {
      lg_polls: [
        { data: expired, error: null },
        (patch) => ({ data: { ...expired, ...patch }, error: null }),
      ],
      lg_poll_votes: [{ data: null, error: null }],
    },
    { onUpdate: (table, payload) => updates.push([table, payload.status]) },
  );
  const result = await run('CAST_VOTE', { pollId: 'poll-1', clubId: 'club-1', optionId: 'opt-1' }, db, 'rep-1');
  assert.equal(result.error.code, 'POLL_CLOSED');
  assert.deepEqual(updates, [['lg_polls', 'CERRADA'], ['lg_poll_votes', 'ABSTENCION']]);
});

// ── CLOSE_POLL ───────────────────────────────────────────────────────────

test('CLOSE_POLL cierra anticipadamente con resolución y marca abstenciones', async () => {
  const updates = [];
  const db = createMockDb(
    {
      lg_polls: [
        { data: openPoll, error: null },
        (patch) => ({ data: { ...openPoll, ...patch }, error: null }),
      ],
      lg_org_users: [{ data: { role: 'ADMIN' }, error: null }],
      lg_poll_votes: [{ data: null, error: null }],
    },
    { onUpdate: (table, payload) => updates.push([table, payload]) },
  );
  const result = await run('CLOSE_POLL', { pollId: 'poll-1', resolution: '  Se aprueba el reglamento.  ' }, db, 'admin-1');
  assert.equal(result.success, true);
  assert.equal(result.data.poll.status, 'CERRADA');
  assert.equal(result.data.poll.resolution, 'Se aprueba el reglamento.');
  assert.equal(result.data.poll.closed_by, 'admin-1');
  assert.equal(updates[1][0], 'lg_poll_votes');
  assert.equal(updates[1][1].status, 'ABSTENCION');
});

test('CLOSE_POLL rechaza a un no-admin (FORBIDDEN)', async () => {
  const db = createMockDb({
    lg_polls: [{ data: openPoll, error: null }],
    lg_org_users: [{ data: null, error: null }],
  });
  const result = await run('CLOSE_POLL', { pollId: 'poll-1' }, db, 'rep-1');
  assert.equal(result.error.code, 'FORBIDDEN');
});

// ── DELETE_POLL ──────────────────────────────────────────────────────────

test('DELETE_POLL rechaza si ya hay votos emitidos (POLL_HAS_VOTES)', async () => {
  const db = createMockDb({
    lg_polls: [{ data: openPoll, error: null }],
    lg_org_users: [{ data: { role: 'ADMIN' }, error: null }],
    lg_poll_votes: [{ data: [{ id: 'v-1' }], error: null }],
  });
  const result = await run('DELETE_POLL', { pollId: 'poll-1' }, db, 'admin-1');
  assert.equal(result.error.code, 'POLL_HAS_VOTES');
});
