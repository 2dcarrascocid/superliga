import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TournamentsSpecialist } from '../tournaments_specialist.js';
import { createMockDb } from './test_utils/mock_db.js';

function run(operation, payload, db, userId) {
  const specialist = new TournamentsSpecialist();
  return specialist.execute({ input: { operation, payload, db, userId } });
}

test('GET_SERIES_TOURNAMENT_ELIGIBILITY informa razones estables y no confía en club_id del cliente', async () => {
  const db = createMockDb({
    lg_clubs: [
      { data: { org_id: 'org-1' } },
      { data: { id: 'club-1', org_id: 'org-1' } },
    ],
    lg_org_users: [{ data: { role: 'ADMIN' } }],
    lg_club_users: [{ data: null }],
    lg_club_series: [{ data: { id: 'series-1', club_id: 'club-1', category_id: 'cat-2', active: false } }],
    lg_tournaments: [{ data: { id: 't-1', org_id: 'org-1', season_id: 'season-1', status: 'REGISTRATION', category_id: 'cat-1' } }],
    lg_seasons: [{ data: { active: true } }],
    lg_tournament_teams: [{ data: null }],
  });
  const result = await run('GET_SERIES_TOURNAMENT_ELIGIBILITY', {
    clubId: 'club-1', seriesId: 'series-1', tournamentId: 't-1',
  }, db, 'admin-1');
  assert.equal(result.success, true);
  assert.equal(result.data.eligibility.eligible, false);
  assert.deepEqual(result.data.eligibility.reasons, ['SERIES_NOT_ACTIVE', 'CATEGORY_MISMATCH']);
});

test('REGISTER_CLUB_SERIES_ATOMIC inscribe club + cobro + serie (sin depender de la RPC restringida a service_role) e ignora dueDate del cliente', async () => {
  let clubUpsertPayload;
  const db = createMockDb({
    lg_clubs: [
      { data: { org_id: 'org-1' } },
      { data: { id: 'club-1', org_id: 'org-1' } },
    ],
    lg_org_users: [{ data: { role: 'ADMIN' } }],
    lg_club_users: [{ data: null }],
    lg_club_series: [{ data: { id: 'series-1', club_id: 'club-1', category_id: 'cat-1', active: true } }],
    lg_tournaments: [{ data: { id: 't-1', org_id: 'org-1', season_id: 'season-1', status: 'REGISTRATION', category_id: 'cat-1', inscription_fee: 15000 } }],
    lg_seasons: [{ data: { active: true } }],
    lg_tournament_teams: [
      { data: null }, // ALREADY_REGISTERED check en _loadEligibility
      { data: { id: 'team-1' }, error: null }, // upsert de REGISTER_TEAM
    ],
    lg_tournament_clubs: [{ data: { id: 'tc-1' }, error: null }],
    lg_ledger_entries: [{ data: { id: 'ledger-1' }, error: null }],
  }, { onInsert: (table, payload) => { if (table === 'lg_tournament_clubs') clubUpsertPayload = payload; } });
  const result = await run('REGISTER_CLUB_SERIES_ATOMIC', {
    clubId: 'club-1', seriesId: 'series-1', tournamentId: 't-1', dueDate: '2026-09-30',
  }, db, 'admin-1');
  assert.equal(result.success, true);
  assert.equal(result.data.registration.tournamentClubId, 'tc-1');
  assert.equal(result.data.registration.teamId, 'team-1');
  assert.equal(clubUpsertPayload.registered_by, 'admin-1');
  assert.equal('due_date' in clubUpsertPayload, false); // dueDate del payload del cliente nunca llega a la inscripción del club
});

test('LIST_ACTIVE_TOURNAMENTS_FOR_CLUB agrega teams_count y clubs_count reales en dos consultas agrupadas', async () => {
  const db = createMockDb({
    lg_clubs: [{ data: { org_id: 'org-1' } }, { data: { org_id: 'org-1' } }],
    lg_org_users: [{ data: { role: 'ADMIN' } }],
    lg_club_users: [{ data: null }],
    lg_tournaments: [{ data: [{ id: 't-1' }, { id: 't-2' }], error: null }],
    lg_tournament_teams: [{ data: [{ tournament_id: 't-1' }, { tournament_id: 't-1' }] }],
    lg_tournament_clubs: [{ data: [{ tournament_id: 't-1' }, { tournament_id: 't-2' }] }],
  });
  const result = await run('LIST_ACTIVE_TOURNAMENTS_FOR_CLUB', { clubId: 'club-1' }, db, 'admin-1');
  assert.equal(result.success, true);
  assert.deepEqual(result.data.tournaments.map(({ id, teams_count, clubs_count }) => ({ id, teams_count, clubs_count })), [
    { id: 't-1', teams_count: 2, clubs_count: 1 },
    { id: 't-2', teams_count: 0, clubs_count: 1 },
  ]);
});

test('GET_CLUB_TOURNAMENT_DETAIL no expone montos ni identificador del cobro', async () => {
  const db = createMockDb({
    lg_clubs: [{ data: { org_id: 'org-1' } }, { data: { org_id: 'org-1' } }],
    lg_org_users: [{ data: null }],
    lg_club_users: [{ data: { role: 'ADMIN_CLUB' } }],
    lg_tournaments: [{ data: { id: 't-1', org_id: 'org-1', status: 'REGISTRATION' } }],
    lg_tournament_teams: [{ data: [{ id: 'team-1', status: 'ACTIVE', series: { club_id: 'club-2' } }], error: null }],
    lg_ledger_entries: [{ data: [{ id: 'secret-ledger', club_id: 'club-2', amount: 10000, paid_amount: 0, due_date: null }] }],
  });
  const result = await run('GET_CLUB_TOURNAMENT_DETAIL', { clubId: 'club-1', tournamentId: 't-1' }, db, 'club-admin');
  assert.equal(result.success, true);
  assert.equal(result.data.participants[0].inscription_status, 'PENDIENTE');
  assert.equal('inscription_charge' in result.data.participants[0], false);
  assert.equal(JSON.stringify(result.data).includes('secret-ledger'), false);
  assert.equal(JSON.stringify(result.data).includes('10000'), false);
});

test('GET_CLUB_TOURNAMENT_DETAIL bloquea torneo de otra organización', async () => {
  const db = createMockDb({
    lg_clubs: [{ data: { org_id: 'org-1' } }, { data: { org_id: 'org-1' } }],
    lg_org_users: [{ data: { role: 'ADMIN' } }],
    lg_club_users: [{ data: null }],
    lg_tournaments: [{ data: { id: 't-other', org_id: 'org-2', status: 'REGISTRATION' } }],
  });
  const result = await run('GET_CLUB_TOURNAMENT_DETAIL', { clubId: 'club-1', tournamentId: 't-other' }, db, 'admin-1');
  assert.equal(result.success, false);
  assert.equal(result.error.code, 'CLUB_ORG_MISMATCH');
});

test('REGISTER_CLUB_SERIES_ATOMIC no filtra error DB al cliente', async () => {
  const db = createMockDb({
    lg_clubs: [{ data: { org_id: 'org-1' } }, { data: { id: 'club-1', org_id: 'org-1' } }],
    lg_org_users: [{ data: { role: 'ADMIN' } }],
    lg_club_users: [{ data: null }],
    lg_club_series: [{ data: { id: 'series-1', club_id: 'club-1', category_id: 'cat-1', active: true } }],
    lg_tournaments: [{ data: { id: 't-1', org_id: 'org-1', season_id: 'season-1', status: 'REGISTRATION', category_id: 'cat-1', inscription_fee: 15000 } }],
    lg_seasons: [{ data: { active: true } }],
    lg_tournament_teams: [{ data: null }],
    lg_tournament_clubs: [{ data: null, error: new Error('secret database detail') }],
  });
  const result = await run('REGISTER_CLUB_SERIES_ATOMIC', { clubId: 'club-1', seriesId: 'series-1', tournamentId: 't-1' }, db, 'admin-1');
  assert.equal(result.success, false);
  assert.equal(result.error.code, 'REGISTER_SERIES_FAILED');
  assert.equal(result.error.message.includes('secret database detail'), false);
});

// ── CREATE_TOURNAMENT: inscriptionFee obligatorio + autorización ───────────

test('CREATE_TOURNAMENT rechaza sin inscriptionFee (MISSING_FIELDS) — sin llegar a tocar la DB', async () => {
  const result = await run('CREATE_TOURNAMENT', {
    orgId: 'org-1', name: 'Apertura', format: 'ROUND_ROBIN', seasonId: 'season-1', categoryId: 'cat-1',
    // inscriptionFee omitido
  }, createMockDb({}));

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'MISSING_FIELDS');
});

test('CREATE_TOURNAMENT rechaza inscriptionFee negativo (INVALID_INSCRIPTION_FEE) — sin llegar a tocar la DB', async () => {
  const result = await run('CREATE_TOURNAMENT', {
    orgId: 'org-1', name: 'Apertura', format: 'ROUND_ROBIN', seasonId: 'season-1', categoryId: 'cat-1',
    inscriptionFee: -100,
  }, createMockDb({}));

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'INVALID_INSCRIPTION_FEE');
});

test('CREATE_TOURNAMENT rechaza a un usuario que no es ADMIN de la organización (FORBIDDEN)', async () => {
  const db = createMockDb({
    lg_org_users: [{ data: { role: 'MEMBER' }, error: null }],
  });

  const result = await run('CREATE_TOURNAMENT', {
    orgId: 'org-1', name: 'Apertura', format: 'ROUND_ROBIN', seasonId: 'season-1', categoryId: 'cat-1',
    inscriptionFee: 10000,
  }, db, 'random-user');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'FORBIDDEN');
});

test('CREATE_TOURNAMENT acepta inscriptionFee = 0, valida isOrgAdmin y lo persiste en inscription_fee', async () => {
  let insertedRow = null;
  const db = createMockDb(
    {
      lg_org_users: [{ data: { role: 'ADMIN' }, error: null }],
      lg_seasons: [{ data: { id: 'season-1' }, error: null }],
      lg_categories: [{ data: { id: 'cat-1' }, error: null }],
      lg_tournaments: [(payload) => ({ data: { id: 'tournament-1', ...payload }, error: null })],
    },
    { onInsert: (table, payload) => { if (table === 'lg_tournaments') insertedRow = payload; } }
  );

  const result = await run('CREATE_TOURNAMENT', {
    orgId: 'org-1', name: 'Apertura', format: 'ROUND_ROBIN', seasonId: 'season-1', categoryId: 'cat-1',
    inscriptionFee: 0,
  }, db, 'admin-user');

  assert.equal(result.success, true);
  assert.equal(insertedRow.inscription_fee, 0);
});

// ── LIST_TOURNAMENTS: clubs_count agregado sin N+1 ──────────────────────────

test('LIST_TOURNAMENTS agrega clubs_count por torneo (con y sin clubes inscritos), en una sola query', async () => {
  const db = createMockDb({
    lg_tournaments: [{
      data: [
        { id: 't-1', org_id: 'org-1', name: 'Con clubes' },
        { id: 't-2', org_id: 'org-1', name: 'Sin clubes' },
      ],
      error: null,
      count: 2,
    }],
    lg_tournament_clubs: [{
      data: [
        { tournament_id: 't-1' },
        { tournament_id: 't-1' },
        { tournament_id: 't-1' },
      ],
      error: null,
    }],
  });

  const result = await run('LIST_TOURNAMENTS', { orgId: 'org-1' }, db);

  assert.equal(result.success, true);
  const byId = Object.fromEntries(result.data.tournaments.map((t) => [t.id, t]));
  assert.equal(byId['t-1'].clubs_count, 3);
  assert.equal(byId['t-2'].clubs_count, 0);
});

// ── UPDATE_TOURNAMENT / DELETE_TOURNAMENT: autorización cross-org ──────────

test('UPDATE_TOURNAMENT rechaza a un usuario que no es ADMIN de la organización DUEÑA del torneo (bypass cross-org)', async () => {
  const db = createMockDb({
    lg_tournaments: [{ data: { id: 't-1', org_id: 'org-ajena' }, error: null }],
    lg_org_users: [{ data: null, error: null }], // no es admin de org-ajena
  });

  // Intento típico del reporte: un usuario de otra org intenta nulificar
  // category_id para hacer bypass de CATEGORY_MISMATCH en REGISTER_TEAM.
  const result = await run('UPDATE_TOURNAMENT', { tournamentId: 't-1', category_id: null }, db, 'intruso');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'FORBIDDEN');
});

test('UPDATE_TOURNAMENT permite al ADMIN de la organización dueña del torneo editar inscription_fee', async () => {
  let updatedPatch = null;
  const db = createMockDb(
    {
      lg_tournaments: [
        { data: { id: 't-1', org_id: 'org-1' }, error: null }, // fetch existente
        (payload) => ({ data: { id: 't-1', org_id: 'org-1', ...payload }, error: null }), // update
      ],
      lg_org_users: [{ data: { role: 'ADMIN' }, error: null }],
    },
    { onUpdate: (table, payload) => { if (table === 'lg_tournaments') updatedPatch = payload; } }
  );

  const result = await run('UPDATE_TOURNAMENT', { tournamentId: 't-1', inscription_fee: 5000 }, db, 'admin-user');

  assert.equal(result.success, true);
  assert.equal(updatedPatch.inscription_fee, 5000);
});

test('UPDATE_TOURNAMENT responde TOURNAMENT_NOT_FOUND si el torneo no existe (no filtra si es admin de qué org)', async () => {
  const db = createMockDb({
    lg_tournaments: [{ data: null, error: null }],
  });

  const result = await run('UPDATE_TOURNAMENT', { tournamentId: 'no-existe', name: 'x' }, db, 'cualquiera');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'TOURNAMENT_NOT_FOUND');
});

test('DELETE_TOURNAMENT rechaza a un usuario que no es ADMIN de la organización dueña del torneo (bypass cross-org)', async () => {
  const db = createMockDb({
    lg_tournaments: [{ data: { id: 't-1', org_id: 'org-ajena' }, error: null }],
    lg_org_users: [{ data: null, error: null }],
  });

  const result = await run('DELETE_TOURNAMENT', { tournamentId: 't-1' }, db, 'intruso');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'FORBIDDEN');
});

test('DELETE_TOURNAMENT permite al ADMIN de la organización dueña del torneo eliminarlo', async () => {
  const db = createMockDb({
    lg_tournaments: [
      { data: { id: 't-1', org_id: 'org-1' }, error: null },
      { data: null, error: null }, // delete: sin error
    ],
    lg_org_users: [{ data: { role: 'ADMIN' }, error: null }],
  });

  const result = await run('DELETE_TOURNAMENT', { tournamentId: 't-1' }, db, 'admin-user');

  assert.equal(result.success, true);
  assert.deepEqual(result.data, { deleted: true, tournamentId: 't-1' });
});

// ── REGISTER_TEAM: categoría + gate de club inscrito + org matching ────────

test('REGISTER_TEAM rechaza cuando el club de la serie pertenece a otra organización que el torneo (CLUB_ORG_MISMATCH)', async () => {
  const db = createMockDb({
    lg_club_series: [{ data: { id: 'series-1', club_id: 'club-1', category_id: 'cat-A' }, error: null }],
    lg_clubs: [
      { data: { org_id: 'org-1' }, error: null }, // assertClubAccess: club pertenece a org-1
      { data: { org_id: 'org-1' }, error: null }, // chequeo de organización club vs torneo
    ],
    lg_org_users: [{ data: { role: 'ADMIN' }, error: null }],
    lg_club_users: [{ data: null, error: null }],
    // El torneo es de OTRA organización (org-2)
    lg_tournaments: [{ data: { id: 't-1', org_id: 'org-2', season_id: 's-1', status: 'REGISTRATION', category_id: 'cat-A' }, error: null }],
  });

  const result = await run('REGISTER_TEAM', { tournamentId: 't-1', seriesId: 'series-1' }, db, 'admin-user');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'CLUB_ORG_MISMATCH');
});

test('REGISTER_TEAM rechaza cuando la categoría de la serie no coincide con la del torneo (CATEGORY_MISMATCH)', async () => {
  const db = createMockDb({
    lg_club_series: [{ data: { id: 'series-1', club_id: 'club-1', category_id: 'cat-A' }, error: null }],
    lg_clubs: [
      { data: { org_id: 'org-1' }, error: null },
      { data: { org_id: 'org-1' }, error: null },
    ],
    lg_org_users: [{ data: { role: 'ADMIN' }, error: null }],
    lg_club_users: [{ data: null, error: null }],
    lg_tournaments: [{ data: { id: 't-1', org_id: 'org-1', season_id: 's-1', status: 'REGISTRATION', category_id: 'cat-B' }, error: null }],
  });

  const result = await run('REGISTER_TEAM', { tournamentId: 't-1', seriesId: 'series-1' }, db, 'admin-user');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'CATEGORY_MISMATCH');
});

test('REGISTER_TEAM omite la validación de categoría si el torneo no tiene category_id', async () => {
  const db = createMockDb({
    lg_club_series: [{ data: { id: 'series-1', club_id: 'club-1', category_id: 'cat-A' }, error: null }],
    lg_clubs: [
      { data: { org_id: 'org-1' }, error: null },
      { data: { org_id: 'org-1' }, error: null },
    ],
    lg_org_users: [{ data: { role: 'ADMIN' }, error: null }],
    lg_club_users: [{ data: null, error: null }],
    lg_tournaments: [{ data: { id: 't-1', org_id: 'org-1', season_id: 's-1', status: 'REGISTRATION', category_id: null }, error: null }],
    // torneo sin categoría → se salta CATEGORY_MISMATCH, sigue al gate de club inscrito
    lg_tournament_clubs: [{ data: null, error: null }],
  });

  const result = await run('REGISTER_TEAM', { tournamentId: 't-1', seriesId: 'series-1' }, db, 'admin-user');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'CLUB_NOT_REGISTERED');
});

test('REGISTER_TEAM rechaza cuando el club dueño de la serie no está inscrito al torneo (CLUB_NOT_REGISTERED)', async () => {
  const db = createMockDb({
    lg_club_series: [{ data: { id: 'series-1', club_id: 'club-1', category_id: 'cat-A' }, error: null }],
    lg_clubs: [
      { data: { org_id: 'org-1' }, error: null },
      { data: { org_id: 'org-1' }, error: null },
    ],
    lg_org_users: [{ data: { role: 'ADMIN' }, error: null }],
    lg_club_users: [{ data: null, error: null }],
    lg_tournaments: [{ data: { id: 't-1', org_id: 'org-1', season_id: 's-1', status: 'REGISTRATION', category_id: 'cat-A' }, error: null }],
    lg_tournament_clubs: [{ data: null, error: null }],
  });

  const result = await run('REGISTER_TEAM', { tournamentId: 't-1', seriesId: 'series-1' }, db, 'admin-user');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'CLUB_NOT_REGISTERED');
});

test('REGISTER_TEAM ya no dispara cobro INSCRIPCION propio (responsabilidad de REGISTER_CLUB)', async () => {
  const db = createMockDb({
    lg_club_series: [{ data: { id: 'series-1', club_id: 'club-1', category_id: 'cat-A' }, error: null }],
    lg_clubs: [
      { data: { org_id: 'org-1' }, error: null },
      { data: { org_id: 'org-1' }, error: null },
    ],
    lg_org_users: [
      { data: { role: 'ADMIN' }, error: null }, // assertClubAccess
      { data: { role: 'ADMIN' }, error: null }, // isOrgAdmin
    ],
    lg_club_users: [{ data: null, error: null }],
    lg_tournaments: [{ data: { id: 't-1', org_id: 'org-1', season_id: 's-1', status: 'REGISTRATION', category_id: 'cat-A' }, error: null }],
    lg_tournament_clubs: [{ data: { id: 'tc-1' }, error: null }],
    lg_tournament_teams: [(payload) => ({ data: { id: 'team-1', ...payload }, error: null })],
    // Si REGISTER_TEAM llegara a llamar createInscriptionCharge, este error haría fallar el test.
    lg_ledger_entries: [{ data: null, error: new Error('REGISTER_TEAM no debe generar cobros INSCRIPCION') }],
  });

  const result = await run('REGISTER_TEAM', { tournamentId: 't-1', seriesId: 'series-1' }, db, 'admin-user');

  assert.equal(result.success, true);
  assert.equal(result.data.team.series_id, 'series-1');
});

// ── REGISTER_CLUB ───────────────────────────────────────────────────────────

test('REGISTER_CLUB rechaza cuando el club pertenece a otra organización que el torneo (CLUB_ORG_MISMATCH)', async () => {
  const db = createMockDb({
    lg_clubs: [
      { data: { org_id: 'org-1' }, error: null }, // assertClubAccess
      { data: { org_id: 'org-1' }, error: null }, // chequeo de organización club vs torneo
    ],
    lg_org_users: [{ data: { role: 'ADMIN' }, error: null }],
    lg_club_users: [{ data: null, error: null }],
    // El torneo es de OTRA organización (org-2) — mismo escenario que el
    // reporte de seguridad: un ADMIN_CLUB de la Org A inscribiendo en un
    // torneo de la Org B.
    lg_tournaments: [{ data: { id: 't-1', org_id: 'org-2', season_id: 's-1', status: 'REGISTRATION', inscription_fee: 15000 }, error: null }],
  });

  const result = await run('REGISTER_CLUB', { tournamentId: 't-1', clubId: 'club-1' }, db, 'admin-club-org1');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'CLUB_ORG_MISMATCH');
});

test('REGISTER_CLUB rechaza doble inscripción del mismo club (DUPLICATE_CLUB_REGISTRATION)', async () => {
  const db = createMockDb({
    lg_clubs: [
      { data: { org_id: 'org-1' }, error: null },
      { data: { org_id: 'org-1' }, error: null },
    ],
    lg_org_users: [
      { data: { role: 'ADMIN' }, error: null }, // assertClubAccess
      { data: { role: 'ADMIN' }, error: null }, // isOrgAdmin
    ],
    lg_club_users: [{ data: null, error: null }],
    lg_tournaments: [{ data: { id: 't-1', org_id: 'org-1', season_id: 's-1', status: 'REGISTRATION', inscription_fee: 15000 }, error: null }],
    lg_tournament_clubs: [{ data: null, error: { code: '23505', message: 'duplicate key' } }],
  });

  const result = await run('REGISTER_CLUB', { tournamentId: 't-1', clubId: 'club-1' }, db, 'admin-user');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'DUPLICATE_CLUB_REGISTRATION');
});

test('REGISTER_CLUB rechaza torneo que no está en REGISTRATION (TOURNAMENT_NOT_OPEN)', async () => {
  const db = createMockDb({
    lg_clubs: [{ data: { org_id: 'org-1' }, error: null }],
    lg_org_users: [{ data: { role: 'ADMIN' }, error: null }],
    lg_club_users: [{ data: null, error: null }],
    lg_tournaments: [{ data: { id: 't-1', org_id: 'org-1', season_id: 's-1', status: 'DRAFT', inscription_fee: 15000 }, error: null }],
  });

  const result = await run('REGISTER_CLUB', { tournamentId: 't-1', clubId: 'club-1' }, db, 'admin-user');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'TOURNAMENT_NOT_OPEN');
});

test('REGISTER_CLUB inscribe con éxito y genera 1 cobro INSCRIPCION usando inscription_fee del torneo', async () => {
  let ledgerInsertedRow = null;
  const db = createMockDb(
    {
      lg_clubs: [
        { data: { org_id: 'org-1' }, error: null },
        { data: { org_id: 'org-1' }, error: null },
      ],
      lg_org_users: [
        { data: { role: 'ADMIN' }, error: null }, // assertClubAccess
        { data: { role: 'ADMIN' }, error: null }, // isOrgAdmin
      ],
      lg_club_users: [{ data: null, error: null }],
      lg_tournaments: [{ data: { id: 't-1', org_id: 'org-1', season_id: 's-1', status: 'REGISTRATION', inscription_fee: 20000 }, error: null }],
      lg_tournament_clubs: [(payload) => ({ data: { id: 'tc-1', ...payload }, error: null })],
      lg_ledger_entries: [(payload) => ({ data: { id: 'entry-1', ...payload }, error: null })],
    },
    { onInsert: (table, payload) => { if (table === 'lg_ledger_entries') ledgerInsertedRow = payload; } }
  );

  const result = await run('REGISTER_CLUB', { tournamentId: 't-1', clubId: 'club-1' }, db, 'admin-user');

  assert.equal(result.success, true);
  assert.equal(result.data.tournamentClub.club_id, 'club-1');
  assert.equal(ledgerInsertedRow.amount, 20000);
  assert.equal(ledgerInsertedRow.series_id, null);
  assert.equal(ledgerInsertedRow.club_id, 'club-1');
  assert.equal(ledgerInsertedRow.category, 'INSCRIPCION');
});

// ── UNREGISTER_CLUB ───────────────────────────────────────────────────────

test('UNREGISTER_CLUB bloquea el retiro si el club tiene series/equipos ya inscritos en el torneo (CLUB_HAS_REGISTERED_TEAMS)', async () => {
  const db = createMockDb({
    lg_clubs: [{ data: { org_id: 'org-1' }, error: null }],
    lg_org_users: [{ data: { role: 'ADMIN' }, error: null }],
    lg_club_users: [{ data: null, error: null }],
    lg_tournament_clubs: [{ data: { id: 'tc-1' }, error: null }],
    lg_club_series: [{ data: [{ id: 'series-1' }], error: null }],
    lg_tournament_teams: [{ data: null, error: null, count: 1 }],
  });

  const result = await run('UNREGISTER_CLUB', { tournamentId: 't-1', clubId: 'club-1' }, db, 'admin-user');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'CLUB_HAS_REGISTERED_TEAMS');
});

test('UNREGISTER_CLUB permite el retiro si el club no tiene series inscritas en el torneo', async () => {
  const db = createMockDb({
    lg_clubs: [{ data: { org_id: 'org-1' }, error: null }],
    lg_org_users: [{ data: { role: 'ADMIN' }, error: null }],
    lg_club_users: [{ data: null, error: null }],
    lg_tournament_clubs: [{ data: { id: 'tc-1' }, error: null }, { data: null, error: null }],
    lg_club_series: [{ data: [], error: null }],
  });

  const result = await run('UNREGISTER_CLUB', { tournamentId: 't-1', clubId: 'club-1' }, db, 'admin-user');

  assert.equal(result.success, true);
  assert.deepEqual(result.data, { deleted: true, tournamentId: 't-1', clubId: 'club-1' });
});

test('UNREGISTER_CLUB rechaza si el usuario no tiene acceso al club (FORBIDDEN)', async () => {
  const db = createMockDb({
    lg_clubs: [{ data: { org_id: 'org-1' }, error: null }],
    lg_org_users: [{ data: null, error: null }],
    lg_club_users: [{ data: null, error: null }],
  });

  const result = await run('UNREGISTER_CLUB', { tournamentId: 't-1', clubId: 'club-1' }, db, 'random-user');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'FORBIDDEN');
});

// ── UNREGISTER_TEAM: no se puede quitar una serie fuera de REGISTRATION ────

test('UNREGISTER_TEAM rechaza con TOURNAMENT_NOT_OPEN cuando el torneo ya está IN_PROGRESS (fixture generado)', async () => {
  const db = createMockDb({
    lg_tournament_teams: [{ data: { series_id: 'series-1' }, error: null }], // existingTeam
    lg_club_series: [{ data: { club_id: 'club-1' }, error: null }],
    lg_clubs: [{ data: { org_id: 'org-1' }, error: null }], // assertClubAccess
    lg_org_users: [{ data: { role: 'ADMIN' }, error: null }],
    lg_club_users: [{ data: null, error: null }],
    lg_tournaments: [{ data: { id: 't-1', status: 'IN_PROGRESS' }, error: null }],
  });

  const result = await run('UNREGISTER_TEAM', { tournamentId: 't-1', teamId: 'team-1' }, db, 'admin-user');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'TOURNAMENT_NOT_OPEN');
});

test('UNREGISTER_TEAM sigue funcionando normalmente cuando el torneo está en REGISTRATION', async () => {
  const db = createMockDb({
    lg_tournament_teams: [
      { data: { series_id: 'series-1' }, error: null }, // existingTeam
      { data: null, error: null }, // delete
    ],
    lg_club_series: [{ data: { club_id: 'club-1' }, error: null }],
    lg_clubs: [{ data: { org_id: 'org-1' }, error: null }],
    lg_org_users: [{ data: { role: 'ADMIN' }, error: null }],
    lg_club_users: [{ data: null, error: null }],
    lg_tournaments: [{ data: { id: 't-1', status: 'REGISTRATION' }, error: null }],
  });

  const result = await run('UNREGISTER_TEAM', { tournamentId: 't-1', teamId: 'team-1' }, db, 'admin-user');

  assert.equal(result.success, true);
  assert.deepEqual(result.data, { deleted: true, teamId: 'team-1' });
});

// ── LIST_TOURNAMENT_CLUBS: no debe filtrar datos financieros cross-tenant ──

test('LIST_TOURNAMENT_CLUBS responde TOURNAMENT_NOT_FOUND si el torneo no existe', async () => {
  const db = createMockDb({
    lg_tournaments: [{ data: null, error: null }],
  });

  const result = await run('LIST_TOURNAMENT_CLUBS', { tournamentId: 'no-existe' }, db, 'cualquiera');

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'TOURNAMENT_NOT_FOUND');
});

test('LIST_TOURNAMENT_CLUBS: el ADMIN de la organización ve todos los clubes inscritos sin filtrar', async () => {
  const db = createMockDb({
    lg_tournaments: [{ data: { id: 't-1', org_id: 'org-1' }, error: null }],
    lg_org_users: [{ data: { role: 'ADMIN' }, error: null }],
    lg_tournament_clubs: [{
      data: [
        { id: 'tc-1', tournament_id: 't-1', club_id: 'club-1', club: { id: 'club-1', name: 'Club A' } },
        { id: 'tc-2', tournament_id: 't-1', club_id: 'club-2', club: { id: 'club-2', name: 'Club B' } },
      ],
      error: null,
    }],
    lg_ledger_entries: [{ data: [], error: null }],
  });

  const result = await run('LIST_TOURNAMENT_CLUBS', { tournamentId: 't-1' }, db, 'admin-org1');

  assert.equal(result.success, true);
  assert.equal(result.data.clubs.length, 2);
});

test('LIST_TOURNAMENT_CLUBS: un usuario que NO es admin de la organización solo ve los clubes a los que tiene acceso (no cross-tenant leak)', async () => {
  const db = createMockDb({
    lg_tournaments: [{ data: { id: 't-1', org_id: 'org-1' }, error: null }],
    // no es admin de org-1 → cae a getAccessibleClubIds (que vuelve a
    // consultar lg_org_users internamente, de ahí las 2 entradas)
    lg_org_users: [{ data: null, error: null }, { data: null, error: null }],
    lg_club_users: [{ data: [{ club_id: 'club-1' }], error: null }], // solo administra club-1
    // Solo debe pedirse el club accesible — el mock no valida el filtro
    // .in(), pero sí que la respuesta decorada solo contenga club-1.
    lg_tournament_clubs: [{
      data: [
        { id: 'tc-1', tournament_id: 't-1', club_id: 'club-1', club: { id: 'club-1', name: 'Club A' } },
      ],
      error: null,
    }],
    lg_ledger_entries: [{ data: [{ club_id: 'club-1', amount: 10000, paid_amount: 0, due_date: null }], error: null }],
  });

  const result = await run('LIST_TOURNAMENT_CLUBS', { tournamentId: 't-1' }, db, 'admin-club-1');

  assert.equal(result.success, true);
  assert.equal(result.data.clubs.length, 1);
  assert.equal(result.data.clubs[0].club_id, 'club-1');
  assert.equal(result.data.clubs[0].inscription_status, 'PENDIENTE');
});

test('LIST_TOURNAMENT_CLUBS: un usuario sin ningún club accesible en esa organización recibe lista vacía, no un error ni el listado completo', async () => {
  const db = createMockDb({
    lg_tournaments: [{ data: { id: 't-1', org_id: 'org-1' }, error: null }],
    lg_org_users: [{ data: null, error: null }, { data: null, error: null }],
    lg_club_users: [{ data: [], error: null }], // no administra ningún club de esa org
  });

  const result = await run('LIST_TOURNAMENT_CLUBS', { tournamentId: 't-1' }, db, 'intruso');

  assert.equal(result.success, true);
  assert.deepEqual(result.data.clubs, []);
});
