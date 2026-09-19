/**
 * ADF - Club Finance Specialist (Specialists Layer)
 *
 * Dominio financiero de clubes: el "mantenedor de costos" por temporada
 * (lg_season_cost_catalog) y el libro de ingresos/egresos por club
 * (lg_ledger_entries) — INSCRIPCION y FECHA se generan automáticamente
 * desde tournaments_specialist.js (ver lib/ledger.js); MULTA/OTRO/VALOR
 * son altas manuales de este specialist.
 *
 * DO:
 *   - Reutilizar lib/ledger.js para el cálculo de estado y el catálogo de costos
 *   - Reutilizar lib/club_access.js (assertClubAccess/isOrgAdmin) — nunca
 *     reimplementar el chequeo de rol
 *   - Restringir CREATE_LEDGER_ENTRY, RECORD_PAYMENT y UPSERT_COST_CATALOG
 *     al ADMIN de organización ("solo el administrador puede ingresar
 *     los pagos de los clubes")
 *   - Un admin de club solo puede LISTAR/CONSULTAR el estado de su propio club
 *
 * DON'T:
 *   - No gestionar gastos del organizador (arbitraje/cancha) — eso es de "tournament_costs"
 *   - No gestionar inscripciones/fixture — eso es de "tournaments"
 *   - No lanzar excepciones no controladas
 *
 * Módulo de Eventos (lg_club_events / lg_club_event_charges): un evento de
 * club (fecha de partido, colecta, compra de implementos) se reparte entre
 * jugadores con un monto individual cada uno (charges). El total del evento
 * se refleja como UNA fila resumen en lg_ledger_entries (category='EVENTO'),
 * mantenida por lib/ledger.js::upsertEventSummaryEntry — no hay trigger de
 * DB que la sincronice, es responsabilidad de este specialist llamarla
 * después de cualquier alta/edición de charges o de un pago.
 *
 * Capabilities:
 *   LIST_COST_CATALOG | UPSERT_COST_CATALOG
 *   LIST_LEDGER_ENTRIES | CREATE_LEDGER_ENTRY | RECORD_PAYMENT
 *   GET_CLUB_PAYMENT_STATUS | GET_PAYMENT_STATS
 *   CREATE_EVENT | LIST_EVENTS | GET_EVENT_DETAIL | SET_EVENT_PLAYERS
 *   RECORD_EVENT_PLAYER_PAYMENT | DELETE_EVENT
 *   LIST_PENALTY_CATALOG | CREATE_PENALTY_CATALOG_ITEM | UPDATE_PENALTY_CATALOG_ITEM | DELETE_PENALTY_CATALOG_ITEM
 */

import { Skill } from '../contracts/skill_contract.js';
import { createSkillResult } from '../contracts/task_schema.js';
import { assertClubAccess, isOrgAdmin } from './lib/club_access.js';
import { LEDGER_CATEGORIES, LEDGER_DIRECTIONS, decorateLedgerEntry, computeEntryStatus, upsertEventSummaryEntry, getSeasonParticipantClubIds } from './lib/ledger.js';

const EVENT_TYPES = ['FECHA_PARTIDO', 'COLECTA', 'COMPRA_IMPLEMENTOS', 'OTRO'];
const ORG_EVENT_TYPES = ['SOCIAL', 'DEPORTIVO', 'ESPECIAL', 'OTRO'];
const PAYMENT_METHODS = ['TRANSFERENCIA', 'EFECTIVO', 'TARJETA'];

const CAPABILITIES = [
  'LIST_COST_CATALOG', 'UPSERT_COST_CATALOG',
  'LIST_LEDGER_ENTRIES', 'CREATE_LEDGER_ENTRY', 'RECORD_PAYMENT',
  'GET_CLUB_PAYMENT_STATUS', 'GET_PAYMENT_STATS',
  'CREATE_EVENT', 'LIST_EVENTS', 'GET_EVENT_DETAIL', 'SET_EVENT_PLAYERS',
  'RECORD_EVENT_PLAYER_PAYMENT', 'DELETE_EVENT',
  'CREATE_ORG_EVENT', 'LIST_ORG_EVENTS', 'GET_ORG_EVENT_DETAIL',
  'SET_CLUB_EXEMPT', 'RECORD_ORG_EVENT_CLUB_PAYMENT', 'CLOSE_ORG_EVENT',
  'LIST_PENALTY_CATALOG', 'CREATE_PENALTY_CATALOG_ITEM', 'UPDATE_PENALTY_CATALOG_ITEM', 'DELETE_PENALTY_CATALOG_ITEM',
];

export class ClubFinanceSpecialist extends Skill {
  constructor() {
    super('club_finance_specialist', '1.0.0');
    this.domain = 'club_finance';
    this.capabilities = CAPABILITIES;

    this.contract = {
      input: [
        { name: 'operation', required: true, type: 'string' },
        { name: 'payload', required: true, type: 'object' },
        { name: 'db', required: true, type: 'object' },
        { name: 'userId', required: false, type: 'string' },
      ],
      output: [
        { name: 'catalog', type: 'object' },
        { name: 'entries', type: 'array' },
        { name: 'entry', type: 'object' },
        { name: 'status', type: 'object' },
        { name: 'stats', type: 'object' },
        { name: 'event', type: 'object' },
        { name: 'events', type: 'array' },
        { name: 'charges', type: 'array' },
        { name: 'charge', type: 'object' },
        { name: 'orgEvent', type: 'object' },
        { name: 'orgEvents', type: 'array' },
        { name: 'penalty', type: 'object' },
        { name: 'penalties', type: 'array' },
      ],
      rules: {
        do: [
          'Restringir altas manuales y registro de pagos al ADMIN de organización',
          'Calcular el status de cada movimiento en vivo (computeEntryStatus), nunca confiar en un valor guardado',
          'Reutilizar upsertEventSummaryEntry (lib/ledger.js) para mantener la fila resumen del evento en lg_ledger_entries después de crear/editar charges o registrar un pago — nunca escribirla a mano',
          'CREATE_EVENT/SET_EVENT_PLAYERS/RECORD_EVENT_PLAYER_PAYMENT/DELETE_EVENT verifican isOrgAdmin (mismo criterio que CREATE_LEDGER_ENTRY/RECORD_PAYMENT)',
          'DELETE_EVENT rechaza si algún charge del evento ya tiene paid_amount > 0',
          'CREATE_ORG_EVENT/LIST_ORG_EVENTS/GET_ORG_EVENT_DETAIL/SET_CLUB_EXEMPT/RECORD_ORG_EVENT_CLUB_PAYMENT/CLOSE_ORG_EVENT verifican isOrgAdmin — un evento de organización es 100% admin, sin autoservicio de club',
          'SET_CLUB_EXEMPT/RECORD_ORG_EVENT_CLUB_PAYMENT rechazan si el evento de organización ya está CERRADO',
          'CLOSE_ORG_EVENT es un traspaso de un solo sentido: inserta en lg_ledger_entries (category=EVENTO_ORG) un movimiento por cada charge no exento, y bloquea al evento contra más cambios',
          'CREATE_PENALTY_CATALOG_ITEM/UPDATE_PENALTY_CATALOG_ITEM/DELETE_PENALTY_CATALOG_ITEM verifican isOrgAdmin — el catálogo de castigos lo administra solo el admin de organización',
        ],
        dont: [
          'No gestionar gastos del organizador ni inscripciones/fixture',
          'No agregar "EVENTO" ni "EVENTO_ORG" a LEDGER_CATEGORIES (CREATE_LEDGER_ENTRY) — son categorías derivadas, solo las escriben upsertEventSummaryEntry y _closeOrgEvent respectivamente',
          'No permitir reabrir un evento de organización ya CERRADO (no hay REOPEN_ORG_EVENT a propósito)',
        ],
      },
      checklist: [
        'CREATE_LEDGER_ENTRY y RECORD_PAYMENT verifican isOrgAdmin',
        'LIST_LEDGER_ENTRIES/GET_CLUB_PAYMENT_STATUS verifican assertClubAccess cuando hay clubId',
        'GET_PAYMENT_STATS agrupa por club y por serie dentro del club',
        'CREATE_EVENT/SET_EVENT_PLAYERS/RECORD_EVENT_PLAYER_PAYMENT/DELETE_EVENT verifican isOrgAdmin',
        'LIST_EVENTS/GET_EVENT_DETAIL verifican assertClubAccess',
        'SET_EVENT_PLAYERS y RECORD_EVENT_PLAYER_PAYMENT siempre recalculan la fila resumen vía upsertEventSummaryEntry',
        'CREATE_ORG_EVENT genera un lg_org_event_charges por cada club participante de la temporada (getSeasonParticipantClubIds)',
        'SET_CLUB_EXEMPT/RECORD_ORG_EVENT_CLUB_PAYMENT rechazan sobre un evento CERRADO',
        'CLOSE_ORG_EVENT es idempotente contra doble cierre (rechaza si status ya es CERRADO) y excluye los charges exentos del traspaso',
        'CREATE/UPDATE/DELETE_PENALTY_CATALOG_ITEM verifican isOrgAdmin',
      ],
    };
  }

  async execute(task) {
    const { operation, payload, db, userId } = task.input;

    if (!this.capabilities.includes(operation)) {
      return createSkillResult({
        success: false,
        errorCode: 'UNKNOWN_OPERATION',
        errorMessage: `Operación desconocida: "${operation}"`,
      });
    }

    try {
      switch (operation) {
        case 'LIST_COST_CATALOG':      return this._listCostCatalog(payload, db);
        case 'UPSERT_COST_CATALOG':    return this._upsertCostCatalog(payload, db, userId);
        case 'LIST_LEDGER_ENTRIES':    return this._listLedgerEntries(payload, db, userId);
        case 'CREATE_LEDGER_ENTRY':    return this._createLedgerEntry(payload, db, userId);
        case 'RECORD_PAYMENT':         return this._recordPayment(payload, db, userId);
        case 'GET_CLUB_PAYMENT_STATUS': return this._getClubPaymentStatus(payload, db, userId);
        case 'GET_PAYMENT_STATS':      return this._getPaymentStats(payload, db, userId);
        case 'CREATE_EVENT':                return this._createEvent(payload, db, userId);
        case 'LIST_EVENTS':                  return this._listEvents(payload, db, userId);
        case 'GET_EVENT_DETAIL':             return this._getEventDetail(payload, db, userId);
        case 'SET_EVENT_PLAYERS':            return this._setEventPlayers(payload, db, userId);
        case 'RECORD_EVENT_PLAYER_PAYMENT':  return this._recordEventPlayerPayment(payload, db, userId);
        case 'DELETE_EVENT':                 return this._deleteEvent(payload, db, userId);
        case 'CREATE_ORG_EVENT':             return this._createOrgEvent(payload, db, userId);
        case 'LIST_ORG_EVENTS':              return this._listOrgEvents(payload, db, userId);
        case 'GET_ORG_EVENT_DETAIL':         return this._getOrgEventDetail(payload, db, userId);
        case 'SET_CLUB_EXEMPT':              return this._setClubExempt(payload, db, userId);
        case 'RECORD_ORG_EVENT_CLUB_PAYMENT': return this._recordOrgEventClubPayment(payload, db, userId);
        case 'CLOSE_ORG_EVENT':              return this._closeOrgEvent(payload, db, userId);
        case 'LIST_PENALTY_CATALOG':          return this._listPenaltyCatalog(payload, db);
        case 'CREATE_PENALTY_CATALOG_ITEM':   return this._createPenaltyCatalogItem(payload, db, userId);
        case 'UPDATE_PENALTY_CATALOG_ITEM':   return this._updatePenaltyCatalogItem(payload, db, userId);
        case 'DELETE_PENALTY_CATALOG_ITEM':   return this._deletePenaltyCatalogItem(payload, db, userId);
      }
    } catch (err) {
      return createSkillResult({
        success: false,
        errorCode: 'CLUB_FINANCE_SPECIALIST_ERROR',
        errorMessage: err.message,
      });
    }
  }

  // ── Mantenedor de costos por temporada ──────────────────────────────────

  async _listCostCatalog({ seasonId }, db) {
    if (!seasonId) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'seasonId es requerido' });
    }
    const { data: catalog, error } = await db
      .from('lg_season_cost_catalog').select('*').eq('season_id', seasonId).maybeSingle();
    if (error) {
      return createSkillResult({ success: false, errorCode: 'LIST_COST_CATALOG_FAILED', errorMessage: error.message });
    }
    return createSkillResult({ success: true, data: { catalog: catalog ?? { season_id: seasonId, inscription_fee: 0, matchday_fee: 0 } } });
  }

  async _upsertCostCatalog({ orgId, seasonId, inscriptionFee, matchdayFee }, db, userId) {
    if (!orgId || !seasonId) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'orgId y seasonId son requeridos' });
    }
    if (!(await isOrgAdmin(userId, orgId, db))) {
      return createSkillResult({ success: false, errorCode: 'FORBIDDEN', errorMessage: 'Solo el administrador de la organización puede configurar el mantenedor de costos' });
    }

    const { data: catalog, error } = await db
      .from('lg_season_cost_catalog')
      .upsert({
        org_id: orgId,
        season_id: seasonId,
        inscription_fee: inscriptionFee ?? 0,
        matchday_fee: matchdayFee ?? 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'season_id' })
      .select()
      .single();

    if (error) {
      return createSkillResult({ success: false, errorCode: 'UPSERT_COST_CATALOG_FAILED', errorMessage: error.message });
    }
    return createSkillResult({ success: true, data: { catalog } });
  }

  // ── Libro de ingresos/egresos ────────────────────────────────────────────

  async _listLedgerEntries({ orgId, clubId, seriesId, tournamentId, category, limit = 50 }, db, userId) {
    if (clubId) {
      const accessError = await assertClubAccess(clubId, userId, db);
      if (accessError) {
        return createSkillResult({ success: false, errorCode: accessError, errorMessage: 'No tienes permisos para ver los movimientos de este club' });
      }
    } else {
      if (!orgId || !(await isOrgAdmin(userId, orgId, db))) {
        return createSkillResult({ success: false, errorCode: 'FORBIDDEN', errorMessage: 'Solo el administrador de la organización puede ver el libro completo' });
      }
    }

    let query = db
      .from('lg_ledger_entries')
      .select('*, club:lg_clubs(id,name,short_name), series:lg_club_series(id,name)')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(limit);

    if (orgId) query = query.eq('org_id', orgId);
    if (clubId) query = query.eq('club_id', clubId);
    if (seriesId) query = query.eq('series_id', seriesId);
    if (tournamentId) query = query.eq('tournament_id', tournamentId);
    if (category) query = query.eq('category', category);

    const { data: entries, error } = await query;
    if (error) {
      return createSkillResult({ success: false, errorCode: 'LIST_LEDGER_ENTRIES_FAILED', errorMessage: error.message });
    }

    return createSkillResult({ success: true, data: { entries: (entries ?? []).map(decorateLedgerEntry) } });
  }

  async _createLedgerEntry({ orgId, clubId, seriesId, tournamentId, matchId, category, direction = 'INGRESO', amount, description, dueDate }, db, userId) {
    if (!orgId || !clubId || !category || amount === undefined || amount === null) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'orgId, clubId, category y amount son requeridos' });
    }
    if (!LEDGER_CATEGORIES.includes(category)) {
      return createSkillResult({ success: false, errorCode: 'INVALID_CATEGORY', errorMessage: `Categoría inválida: "${category}"` });
    }
    if (!LEDGER_DIRECTIONS.includes(direction)) {
      return createSkillResult({ success: false, errorCode: 'INVALID_DIRECTION', errorMessage: `Dirección inválida: "${direction}"` });
    }
    if (!(await isOrgAdmin(userId, orgId, db))) {
      return createSkillResult({ success: false, errorCode: 'FORBIDDEN', errorMessage: 'Solo el administrador de la organización puede registrar movimientos' });
    }

    const { data: entry, error } = await db
      .from('lg_ledger_entries')
      .insert({
        org_id: orgId,
        club_id: clubId,
        series_id: seriesId ?? null,
        tournament_id: tournamentId ?? null,
        match_id: matchId ?? null,
        category,
        direction,
        amount,
        description: description ?? null,
        due_date: dueDate ?? null,
      })
      .select('*, club:lg_clubs(id,name,short_name), series:lg_club_series(id,name)')
      .single();

    if (error) {
      return createSkillResult({ success: false, errorCode: 'CREATE_LEDGER_ENTRY_FAILED', errorMessage: error.message });
    }
    return createSkillResult({ success: true, data: { entry: decorateLedgerEntry(entry) } });
  }

  async _recordPayment({ entryId, amount }, db, userId) {
    if (!entryId || !amount || amount <= 0) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'entryId y amount (> 0) son requeridos' });
    }

    const { data: existing } = await db.from('lg_ledger_entries').select('*').eq('id', entryId).maybeSingle();
    if (!existing) {
      return createSkillResult({ success: false, errorCode: 'ENTRY_NOT_FOUND', errorMessage: 'Movimiento no encontrado' });
    }
    if (!(await isOrgAdmin(userId, existing.org_id, db))) {
      return createSkillResult({ success: false, errorCode: 'FORBIDDEN', errorMessage: 'Solo el administrador de la organización puede registrar pagos' });
    }

    const newPaidAmount = Number(existing.paid_amount || 0) + Number(amount);

    const { data: entry, error } = await db
      .from('lg_ledger_entries')
      .update({
        paid_amount: newPaidAmount,
        paid_at: new Date().toISOString(),
        recorded_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entryId)
      .select('*, club:lg_clubs(id,name,short_name), series:lg_club_series(id,name)')
      .single();

    if (error) {
      return createSkillResult({ success: false, errorCode: 'RECORD_PAYMENT_FAILED', errorMessage: error.message });
    }
    return createSkillResult({ success: true, data: { entry: decorateLedgerEntry(entry) } });
  }

  // ── Estado de pago / estadísticas ────────────────────────────────────────

  /** Agrega un set de filas de lg_ledger_entries en los totales de estado de pago. */
  _aggregatePaymentStatus(rows) {
    let totalCharged = 0;
    let totalPaid = 0;
    let overdueAmount = 0;
    let egresosTotal = 0;

    for (const row of rows) {
      const amount = Number(row.amount) || 0;
      const paid = Number(row.paid_amount) || 0;

      if (row.direction === 'EGRESO') {
        egresosTotal += amount;
        continue;
      }
      totalCharged += amount;
      totalPaid += paid;
      if (computeEntryStatus(row) === 'VENCIDO') overdueAmount += (amount - paid);
    }

    const totalPending = Math.max(0, totalCharged - totalPaid);
    const status = overdueAmount > 0 ? 'MOROSO' : (totalPending > 0 ? 'PENDIENTE' : 'AL_DIA');

    return {
      total_charged: totalCharged,
      total_paid: totalPaid,
      total_pending: totalPending,
      overdue_amount: overdueAmount,
      egresos_total: egresosTotal,
      status,
    };
  }

  async _getClubPaymentStatus({ clubId }, db, userId) {
    if (!clubId) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'clubId es requerido' });
    }
    const accessError = await assertClubAccess(clubId, userId, db);
    if (accessError) {
      return createSkillResult({ success: false, errorCode: accessError, errorMessage: 'No tienes permisos para ver el estado de pago de este club' });
    }

    const { data: rows, error } = await db
      .from('lg_ledger_entries').select('amount, paid_amount, direction, due_date').eq('club_id', clubId);
    if (error) {
      return createSkillResult({ success: false, errorCode: 'GET_CLUB_PAYMENT_STATUS_FAILED', errorMessage: error.message });
    }

    return createSkillResult({ success: true, data: { status: { club_id: clubId, ...this._aggregatePaymentStatus(rows ?? []) } } });
  }

  /** "Módulo de estadísticas de quiénes pagaron": por club, y por serie dentro del club. */
  async _getPaymentStats({ orgId }, db, userId) {
    if (!orgId) {
      return createSkillResult({ success: false, errorCode: 'MISSING_ORG', errorMessage: 'orgId es requerido' });
    }
    if (!(await isOrgAdmin(userId, orgId, db))) {
      return createSkillResult({ success: false, errorCode: 'FORBIDDEN', errorMessage: 'Solo el administrador de la organización puede ver las estadísticas de pago' });
    }

    const [{ data: clubs }, { data: rows }] = await Promise.all([
      db.from('lg_clubs').select('id,name,short_name').eq('org_id', orgId),
      db.from('lg_ledger_entries')
        .select('club_id, series_id, amount, paid_amount, direction, due_date, series:lg_club_series(name)')
        .eq('org_id', orgId),
    ]);

    const rowsByClub = new Map();
    for (const row of rows ?? []) {
      if (!rowsByClub.has(row.club_id)) rowsByClub.set(row.club_id, []);
      rowsByClub.get(row.club_id).push(row);
    }

    const byClub = (clubs ?? []).map((club) => {
      const clubRows = rowsByClub.get(club.id) ?? [];

      const rowsBySeries = new Map();
      for (const row of clubRows) {
        const key = row.series_id ?? '_sin_serie';
        if (!rowsBySeries.has(key)) rowsBySeries.set(key, { series_id: row.series_id, series_name: row.series?.name ?? null, rows: [] });
        rowsBySeries.get(key).rows.push(row);
      }

      const series = Array.from(rowsBySeries.values()).map((s) => ({
        series_id: s.series_id,
        series_name: s.series_name,
        ...this._aggregatePaymentStatus(s.rows),
      }));

      return {
        club_id: club.id,
        club_name: club.name,
        club_short_name: club.short_name,
        series,
        ...this._aggregatePaymentStatus(clubRows),
      };
    });

    const orgTotals = byClub.reduce((acc, c) => ({
      total_charged: acc.total_charged + c.total_charged,
      total_paid: acc.total_paid + c.total_paid,
      total_pending: acc.total_pending + c.total_pending,
      overdue_amount: acc.overdue_amount + c.overdue_amount,
    }), { total_charged: 0, total_paid: 0, total_pending: 0, overdue_amount: 0 });

    return createSkillResult({
      success: true,
      data: {
        stats: {
          org_id: orgId,
          clubs_al_dia: byClub.filter((c) => c.status === 'AL_DIA').length,
          clubs_pendientes: byClub.filter((c) => c.status === 'PENDIENTE').length,
          clubs_morosos: byClub.filter((c) => c.status === 'MOROSO').length,
          ...orgTotals,
          by_club: byClub,
        },
      },
    });
  }

  // ── Eventos de club ──────────────────────────────────────────────────────

  async _createEvent({ orgId, clubId, name, eventType, direction = 'EGRESO', eventDate, description }, db, userId) {
    if (!orgId || !clubId || !name) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'orgId, clubId y name son requeridos' });
    }
    if (eventType && !EVENT_TYPES.includes(eventType)) {
      return createSkillResult({ success: false, errorCode: 'INVALID_EVENT_TYPE', errorMessage: `Tipo de evento inválido: "${eventType}"` });
    }
    if (!LEDGER_DIRECTIONS.includes(direction)) {
      return createSkillResult({ success: false, errorCode: 'INVALID_DIRECTION', errorMessage: `Dirección inválida: "${direction}"` });
    }
    if (!(await isOrgAdmin(userId, orgId, db))) {
      return createSkillResult({ success: false, errorCode: 'FORBIDDEN', errorMessage: 'Solo el administrador de la organización puede crear eventos' });
    }

    const { data: event, error } = await db
      .from('lg_club_events')
      .insert({
        org_id: orgId,
        club_id: clubId,
        name,
        event_type: eventType ?? 'OTRO',
        direction,
        event_date: eventDate ?? null,
        description: description ?? null,
        created_by: userId ?? null,
      })
      .select()
      .single();

    if (error) {
      return createSkillResult({ success: false, errorCode: 'CREATE_EVENT_FAILED', errorMessage: error.message });
    }
    return createSkillResult({ success: true, data: { event } });
  }

  async _listEvents({ orgId, clubId }, db, userId) {
    if (clubId) {
      const accessError = await assertClubAccess(clubId, userId, db);
      if (accessError) {
        return createSkillResult({ success: false, errorCode: accessError, errorMessage: 'No tienes permisos para ver los eventos de este club' });
      }
    } else {
      if (!orgId || !(await isOrgAdmin(userId, orgId, db))) {
        return createSkillResult({ success: false, errorCode: 'FORBIDDEN', errorMessage: 'Solo el administrador de la organización puede ver todos los eventos' });
      }
    }

    let query = db.from('lg_club_events').select('*').order('event_date', { ascending: false, nullsFirst: false });
    if (orgId) query = query.eq('org_id', orgId);
    if (clubId) query = query.eq('club_id', clubId);

    const { data: events, error } = await query;
    if (error) {
      return createSkillResult({ success: false, errorCode: 'LIST_EVENTS_FAILED', errorMessage: error.message });
    }

    const eventIds = (events ?? []).map((e) => e.id);
    let charges = [];
    if (eventIds.length > 0) {
      const { data: chargeRows, error: chargesError } = await db
        .from('lg_club_event_charges')
        .select('event_id, amount, paid_amount')
        .in('event_id', eventIds);
      if (chargesError) {
        return createSkillResult({ success: false, errorCode: 'LIST_EVENTS_FAILED', errorMessage: chargesError.message });
      }
      charges = chargeRows ?? [];
    }

    const totalsByEvent = new Map();
    for (const c of charges) {
      const acc = totalsByEvent.get(c.event_id) ?? { total_amount: 0, total_paid: 0, players_count: 0 };
      acc.total_amount += Number(c.amount) || 0;
      acc.total_paid += Number(c.paid_amount) || 0;
      acc.players_count += 1;
      totalsByEvent.set(c.event_id, acc);
    }

    const decoratedEvents = (events ?? []).map((e) => ({
      ...e,
      ...(totalsByEvent.get(e.id) ?? { total_amount: 0, total_paid: 0, players_count: 0 }),
    }));

    return createSkillResult({ success: true, data: { events: decoratedEvents } });
  }

  async _getEventDetail({ eventId }, db, userId) {
    if (!eventId) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'eventId es requerido' });
    }

    const { data: event } = await db.from('lg_club_events').select('*').eq('id', eventId).maybeSingle();
    if (!event) {
      return createSkillResult({ success: false, errorCode: 'EVENT_NOT_FOUND', errorMessage: 'Evento no encontrado' });
    }

    const accessError = await assertClubAccess(event.club_id, userId, db);
    if (accessError) {
      return createSkillResult({ success: false, errorCode: accessError, errorMessage: 'No tienes permisos para ver este evento' });
    }

    const { data: charges, error } = await db
      .from('lg_club_event_charges')
      .select('*, player:lg_players(id,first_name,last_name,rut)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    if (error) {
      return createSkillResult({ success: false, errorCode: 'GET_EVENT_DETAIL_FAILED', errorMessage: error.message });
    }

    const decoratedCharges = (charges ?? []).map((c) => decorateLedgerEntry({ ...c, due_date: event.event_date }));
    return createSkillResult({ success: true, data: { event, charges: decoratedCharges } });
  }

  async _setEventPlayers({ eventId, charges }, db, userId) {
    if (!eventId || !Array.isArray(charges) || charges.length === 0) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'eventId y charges (array no vacío) son requeridos' });
    }
    for (const c of charges) {
      if (!c || !c.playerId || c.amount === undefined || c.amount === null || Number(c.amount) < 0) {
        return createSkillResult({ success: false, errorCode: 'INVALID_CHARGE', errorMessage: 'Cada charge requiere playerId y amount (>= 0)' });
      }
    }

    const { data: event } = await db.from('lg_club_events').select('*').eq('id', eventId).maybeSingle();
    if (!event) {
      return createSkillResult({ success: false, errorCode: 'EVENT_NOT_FOUND', errorMessage: 'Evento no encontrado' });
    }
    if (!(await isOrgAdmin(userId, event.org_id, db))) {
      return createSkillResult({ success: false, errorCode: 'FORBIDDEN', errorMessage: 'Solo el administrador de la organización puede agregar jugadores al evento' });
    }

    const rows = charges.map((c) => ({
      event_id: eventId,
      player_id: c.playerId,
      amount: c.amount,
    }));

    const { error: upsertError } = await db
      .from('lg_club_event_charges')
      .upsert(rows, { onConflict: 'event_id,player_id' })
      .select();

    if (upsertError) {
      return createSkillResult({ success: false, errorCode: 'SET_EVENT_PLAYERS_FAILED', errorMessage: upsertError.message });
    }

    const { error: summaryError } = await upsertEventSummaryEntry({
      orgId: event.org_id,
      clubId: event.club_id,
      eventId,
      direction: event.direction,
      description: event.description,
      dueDate: event.event_date,
    }, db);
    if (summaryError) {
      return createSkillResult({ success: false, errorCode: 'EVENT_SUMMARY_SYNC_FAILED', errorMessage: summaryError.message });
    }

    const { data: allCharges, error: listError } = await db
      .from('lg_club_event_charges')
      .select('*, player:lg_players(id,first_name,last_name,rut)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });
    if (listError) {
      return createSkillResult({ success: false, errorCode: 'SET_EVENT_PLAYERS_FAILED', errorMessage: listError.message });
    }

    const decoratedCharges = (allCharges ?? []).map((c) => decorateLedgerEntry({ ...c, due_date: event.event_date }));
    return createSkillResult({ success: true, data: { charges: decoratedCharges } });
  }

  async _recordEventPlayerPayment({ chargeId, amount }, db, userId) {
    if (!chargeId || !amount || amount <= 0) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'chargeId y amount (> 0) son requeridos' });
    }

    const { data: charge } = await db
      .from('lg_club_event_charges')
      .select('*, event:lg_club_events(*)')
      .eq('id', chargeId)
      .maybeSingle();
    if (!charge) {
      return createSkillResult({ success: false, errorCode: 'CHARGE_NOT_FOUND', errorMessage: 'Cobro no encontrado' });
    }
    const event = charge.event;
    if (!event) {
      return createSkillResult({ success: false, errorCode: 'EVENT_NOT_FOUND', errorMessage: 'Evento del cobro no encontrado' });
    }
    if (!(await isOrgAdmin(userId, event.org_id, db))) {
      return createSkillResult({ success: false, errorCode: 'FORBIDDEN', errorMessage: 'Solo el administrador de la organización puede registrar pagos' });
    }

    const newPaidAmount = Number(charge.paid_amount || 0) + Number(amount);

    const { data: updatedCharge, error } = await db
      .from('lg_club_event_charges')
      .update({
        paid_amount: newPaidAmount,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', chargeId)
      .select('*, player:lg_players(id,first_name,last_name,rut)')
      .single();

    if (error) {
      return createSkillResult({ success: false, errorCode: 'RECORD_EVENT_PLAYER_PAYMENT_FAILED', errorMessage: error.message });
    }

    const { error: summaryError } = await upsertEventSummaryEntry({
      orgId: event.org_id,
      clubId: event.club_id,
      eventId: event.id,
      direction: event.direction,
      description: event.description,
      dueDate: event.event_date,
    }, db);
    if (summaryError) {
      return createSkillResult({ success: false, errorCode: 'EVENT_SUMMARY_SYNC_FAILED', errorMessage: summaryError.message });
    }

    return createSkillResult({ success: true, data: { charge: decorateLedgerEntry({ ...updatedCharge, due_date: event.event_date }) } });
  }

  async _deleteEvent({ eventId }, db, userId) {
    if (!eventId) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'eventId es requerido' });
    }

    const { data: event } = await db.from('lg_club_events').select('org_id').eq('id', eventId).maybeSingle();
    if (!event) {
      return createSkillResult({ success: false, errorCode: 'EVENT_NOT_FOUND', errorMessage: 'Evento no encontrado' });
    }
    if (!(await isOrgAdmin(userId, event.org_id, db))) {
      return createSkillResult({ success: false, errorCode: 'FORBIDDEN', errorMessage: 'Solo el administrador de la organización puede eliminar eventos' });
    }

    // Mismo espíritu que clearUnpaidMatchdayCharges (lib/ledger.js): un
    // charge ya pagado no debe poder borrarse silenciosamente junto con el
    // evento — el admin tiene que resolver esos pagos (reembolso, ajuste)
    // antes de eliminar.
    const { data: paidCharges, error: paidError } = await db
      .from('lg_club_event_charges')
      .select('id')
      .eq('event_id', eventId)
      .gt('paid_amount', 0);
    if (paidError) {
      return createSkillResult({ success: false, errorCode: 'DELETE_EVENT_FAILED', errorMessage: paidError.message });
    }
    if ((paidCharges ?? []).length > 0) {
      return createSkillResult({ success: false, errorCode: 'EVENT_HAS_PAID_CHARGES', errorMessage: 'El evento tiene cobros ya pagados; no se puede eliminar' });
    }

    const { error } = await db.from('lg_club_events').delete().eq('id', eventId);
    if (error) {
      return createSkillResult({ success: false, errorCode: 'DELETE_EVENT_FAILED', errorMessage: error.message });
    }
    return createSkillResult({ success: true, data: { deleted: true, eventId } });
  }

  // ── Eventos de organización (cargo obligatorio por club, no por jugador) ──

  /** Estado de un charge de evento de organización: EXENTO gana sobre el resto. */
  _computeOrgChargeStatus(charge, dueDate) {
    if (charge.is_exempt) return 'EXENTO';
    return computeEntryStatus({ amount: charge.amount, paid_amount: charge.paid_amount, due_date: dueDate });
  }

  async _createOrgEvent({ orgId, seasonId, name, description, eventType, cost, direction = 'INGRESO', startDate, endDate }, db, userId) {
    if (!orgId || !seasonId || !name || cost === undefined || cost === null) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'orgId, seasonId, name y cost son requeridos' });
    }
    if (eventType && !ORG_EVENT_TYPES.includes(eventType)) {
      return createSkillResult({ success: false, errorCode: 'INVALID_EVENT_TYPE', errorMessage: `Tipo de evento inválido: "${eventType}"` });
    }
    if (!LEDGER_DIRECTIONS.includes(direction)) {
      return createSkillResult({ success: false, errorCode: 'INVALID_DIRECTION', errorMessage: `Dirección inválida: "${direction}"` });
    }
    if (!(await isOrgAdmin(userId, orgId, db))) {
      return createSkillResult({ success: false, errorCode: 'FORBIDDEN', errorMessage: 'Solo el administrador de la organización puede crear eventos' });
    }

    const { data: event, error } = await db
      .from('lg_org_events')
      .insert({
        org_id: orgId,
        season_id: seasonId,
        name,
        description: description ?? null,
        event_type: eventType ?? 'OTRO',
        cost,
        direction,
        start_date: startDate ?? null,
        end_date: endDate ?? null,
        created_by: userId ?? null,
      })
      .select()
      .single();

    if (error) {
      return createSkillResult({ success: false, errorCode: 'CREATE_ORG_EVENT_FAILED', errorMessage: error.message });
    }

    const clubIds = await getSeasonParticipantClubIds(seasonId, db);
    if (clubIds.length > 0) {
      const { error: chargesError } = await db
        .from('lg_org_event_charges')
        .insert(clubIds.map((clubId) => ({ org_event_id: event.id, club_id: clubId, amount: cost })));
      if (chargesError) {
        return createSkillResult({ success: false, errorCode: 'CREATE_ORG_EVENT_FAILED', errorMessage: chargesError.message });
      }
    }

    return createSkillResult({ success: true, data: { orgEvent: { ...event, clubs_count: clubIds.length } } });
  }

  async _listOrgEvents({ orgId, seasonId }, db, userId) {
    if (!orgId) {
      return createSkillResult({ success: false, errorCode: 'MISSING_ORG', errorMessage: 'orgId es requerido' });
    }
    if (!(await isOrgAdmin(userId, orgId, db))) {
      return createSkillResult({ success: false, errorCode: 'FORBIDDEN', errorMessage: 'Solo el administrador de la organización puede ver los eventos de organización' });
    }

    let query = db.from('lg_org_events').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
    if (seasonId) query = query.eq('season_id', seasonId);

    const { data: events, error } = await query;
    if (error) {
      return createSkillResult({ success: false, errorCode: 'LIST_ORG_EVENTS_FAILED', errorMessage: error.message });
    }

    const eventIds = (events ?? []).map((e) => e.id);
    let charges = [];
    if (eventIds.length > 0) {
      const { data: chargeRows, error: chargesError } = await db
        .from('lg_org_event_charges')
        .select('org_event_id, amount, paid_amount, is_exempt')
        .in('org_event_id', eventIds);
      if (chargesError) {
        return createSkillResult({ success: false, errorCode: 'LIST_ORG_EVENTS_FAILED', errorMessage: chargesError.message });
      }
      charges = chargeRows ?? [];
    }

    const totalsByEvent = new Map();
    for (const c of charges) {
      const acc = totalsByEvent.get(c.org_event_id) ?? { total_amount: 0, total_paid: 0, clubs_count: 0, exempt_count: 0 };
      if (!c.is_exempt) {
        acc.total_amount += Number(c.amount) || 0;
        acc.total_paid += Number(c.paid_amount) || 0;
      } else {
        acc.exempt_count += 1;
      }
      acc.clubs_count += 1;
      totalsByEvent.set(c.org_event_id, acc);
    }

    const decoratedEvents = (events ?? []).map((e) => ({
      ...e,
      ...(totalsByEvent.get(e.id) ?? { total_amount: 0, total_paid: 0, clubs_count: 0, exempt_count: 0 }),
    }));

    return createSkillResult({ success: true, data: { orgEvents: decoratedEvents } });
  }

  async _getOrgEventDetail({ eventId }, db, userId) {
    if (!eventId) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'eventId es requerido' });
    }

    const { data: event } = await db.from('lg_org_events').select('*').eq('id', eventId).maybeSingle();
    if (!event) {
      return createSkillResult({ success: false, errorCode: 'EVENT_NOT_FOUND', errorMessage: 'Evento no encontrado' });
    }
    if (!(await isOrgAdmin(userId, event.org_id, db))) {
      return createSkillResult({ success: false, errorCode: 'FORBIDDEN', errorMessage: 'Solo el administrador de la organización puede ver este evento' });
    }

    const { data: charges, error } = await db
      .from('lg_org_event_charges')
      .select('*, club:lg_clubs(id,name,short_name)')
      .eq('org_event_id', eventId)
      .order('created_at', { ascending: true });

    if (error) {
      return createSkillResult({ success: false, errorCode: 'GET_ORG_EVENT_DETAIL_FAILED', errorMessage: error.message });
    }

    const decoratedCharges = (charges ?? []).map((c) => ({ ...c, status: this._computeOrgChargeStatus(c, event.end_date) }));
    return createSkillResult({ success: true, data: { orgEvent: event, charges: decoratedCharges } });
  }

  async _setClubExempt({ eventId, clubId, isExempt, exemptReason }, db, userId) {
    if (!eventId || !clubId || isExempt === undefined || isExempt === null) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'eventId, clubId e isExempt son requeridos' });
    }

    const { data: event } = await db.from('lg_org_events').select('*').eq('id', eventId).maybeSingle();
    if (!event) {
      return createSkillResult({ success: false, errorCode: 'EVENT_NOT_FOUND', errorMessage: 'Evento no encontrado' });
    }
    if (!(await isOrgAdmin(userId, event.org_id, db))) {
      return createSkillResult({ success: false, errorCode: 'FORBIDDEN', errorMessage: 'Solo el administrador de la organización puede marcar clubes exentos' });
    }
    if (event.status === 'CERRADO') {
      return createSkillResult({ success: false, errorCode: 'EVENT_CLOSED', errorMessage: 'El evento ya está cerrado, no se puede modificar' });
    }

    const { data: charge, error } = await db
      .from('lg_org_event_charges')
      .update({ is_exempt: isExempt, exempt_reason: isExempt ? (exemptReason ?? null) : null, updated_at: new Date().toISOString() })
      .eq('org_event_id', eventId)
      .eq('club_id', clubId)
      .select('*, club:lg_clubs(id,name,short_name)')
      .single();

    if (error) {
      return createSkillResult({ success: false, errorCode: 'SET_CLUB_EXEMPT_FAILED', errorMessage: error.message });
    }
    return createSkillResult({ success: true, data: { charge: { ...charge, status: this._computeOrgChargeStatus(charge, event.end_date) } } });
  }

  async _recordOrgEventClubPayment({ chargeId, amount, paymentMethod }, db, userId) {
    if (!chargeId || !amount || amount <= 0) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'chargeId y amount (> 0) son requeridos' });
    }
    if (paymentMethod && !PAYMENT_METHODS.includes(paymentMethod)) {
      return createSkillResult({ success: false, errorCode: 'INVALID_PAYMENT_METHOD', errorMessage: `Medio de pago inválido: "${paymentMethod}"` });
    }

    const { data: charge } = await db
      .from('lg_org_event_charges')
      .select('*, event:lg_org_events(*)')
      .eq('id', chargeId)
      .maybeSingle();
    if (!charge) {
      return createSkillResult({ success: false, errorCode: 'CHARGE_NOT_FOUND', errorMessage: 'Cobro no encontrado' });
    }
    const event = charge.event;
    if (!event) {
      return createSkillResult({ success: false, errorCode: 'EVENT_NOT_FOUND', errorMessage: 'Evento del cobro no encontrado' });
    }
    if (!(await isOrgAdmin(userId, event.org_id, db))) {
      return createSkillResult({ success: false, errorCode: 'FORBIDDEN', errorMessage: 'Solo el administrador de la organización puede registrar pagos' });
    }
    if (event.status === 'CERRADO') {
      return createSkillResult({ success: false, errorCode: 'EVENT_CLOSED', errorMessage: 'El evento ya está cerrado, no se puede modificar' });
    }
    if (charge.is_exempt) {
      return createSkillResult({ success: false, errorCode: 'CHARGE_IS_EXEMPT', errorMessage: 'El club está exento de este evento, no se puede registrar un pago' });
    }

    const newPaidAmount = Number(charge.paid_amount || 0) + Number(amount);

    const { data: updatedCharge, error } = await db
      .from('lg_org_event_charges')
      .update({
        paid_amount: newPaidAmount,
        payment_method: paymentMethod ?? charge.payment_method,
        paid_at: new Date().toISOString(),
        recorded_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', chargeId)
      .select('*, club:lg_clubs(id,name,short_name)')
      .single();

    if (error) {
      return createSkillResult({ success: false, errorCode: 'RECORD_ORG_EVENT_CLUB_PAYMENT_FAILED', errorMessage: error.message });
    }
    return createSkillResult({ success: true, data: { charge: { ...updatedCharge, status: this._computeOrgChargeStatus(updatedCharge, event.end_date) } } });
  }

  async _closeOrgEvent({ eventId }, db, userId) {
    if (!eventId) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'eventId es requerido' });
    }

    const { data: event } = await db.from('lg_org_events').select('*').eq('id', eventId).maybeSingle();
    if (!event) {
      return createSkillResult({ success: false, errorCode: 'EVENT_NOT_FOUND', errorMessage: 'Evento no encontrado' });
    }
    if (!(await isOrgAdmin(userId, event.org_id, db))) {
      return createSkillResult({ success: false, errorCode: 'FORBIDDEN', errorMessage: 'Solo el administrador de la organización puede cerrar eventos' });
    }
    if (event.status === 'CERRADO') {
      return createSkillResult({ success: false, errorCode: 'EVENT_ALREADY_CLOSED', errorMessage: 'El evento ya está cerrado' });
    }

    const { data: charges, error: chargesError } = await db
      .from('lg_org_event_charges')
      .select('*')
      .eq('org_event_id', eventId);
    if (chargesError) {
      return createSkillResult({ success: false, errorCode: 'CLOSE_ORG_EVENT_FAILED', errorMessage: chargesError.message });
    }

    const rows = (charges ?? [])
      .filter((c) => !c.is_exempt)
      .map((c) => ({
        org_id: event.org_id,
        club_id: c.club_id,
        org_event_id: eventId,
        category: 'EVENTO_ORG',
        direction: event.direction,
        amount: c.amount,
        paid_amount: c.paid_amount,
        paid_at: c.paid_at,
        description: event.name,
        due_date: event.end_date,
      }));

    if (rows.length > 0) {
      const { error: insertError } = await db.from('lg_ledger_entries').insert(rows);
      if (insertError) {
        return createSkillResult({ success: false, errorCode: 'CLOSE_ORG_EVENT_FAILED', errorMessage: insertError.message });
      }
    }

    const { data: closedEvent, error: closeError } = await db
      .from('lg_org_events')
      .update({ status: 'CERRADO', closed_at: new Date().toISOString(), closed_by: userId ?? null, updated_at: new Date().toISOString() })
      .eq('id', eventId)
      .select()
      .single();
    if (closeError) {
      return createSkillResult({ success: false, errorCode: 'CLOSE_ORG_EVENT_FAILED', errorMessage: closeError.message });
    }

    return createSkillResult({ success: true, data: { orgEvent: closedEvent } });
  }

  // ── Catálogo de castigos (Parámetros → Castigos) ─────────────────────────

  async _listPenaltyCatalog({ orgId }, db) {
    if (!orgId) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'orgId es requerido' });
    }
    const { data: penalties, error } = await db
      .from('lg_penalty_catalog')
      .select('*')
      .eq('org_id', orgId)
      .order('name', { ascending: true });
    if (error) {
      return createSkillResult({ success: false, errorCode: 'LIST_PENALTY_CATALOG_FAILED', errorMessage: error.message });
    }
    return createSkillResult({ success: true, data: { penalties: penalties ?? [] } });
  }

  async _createPenaltyCatalogItem({ orgId, name, code, description, amount, businessRule }, db, userId) {
    if (!orgId || !name || !code || amount === undefined || amount === null) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'orgId, name, code y amount son requeridos' });
    }
    if (!(await isOrgAdmin(userId, orgId, db))) {
      return createSkillResult({ success: false, errorCode: 'FORBIDDEN', errorMessage: 'Solo el administrador de la organización puede configurar el catálogo de castigos' });
    }

    const { data: penalty, error } = await db
      .from('lg_penalty_catalog')
      .insert({
        org_id: orgId,
        name,
        code,
        description: description ?? null,
        amount,
        business_rule: businessRule ?? null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return createSkillResult({ success: false, errorCode: 'DUPLICATE_CODE', errorMessage: 'Ya existe un castigo con ese código' });
      }
      return createSkillResult({ success: false, errorCode: 'CREATE_PENALTY_CATALOG_ITEM_FAILED', errorMessage: error.message });
    }
    return createSkillResult({ success: true, data: { penalty } });
  }

  async _updatePenaltyCatalogItem({ penaltyId, orgId, name, code, description, amount, businessRule, active }, db, userId) {
    if (!penaltyId || !orgId) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'penaltyId y orgId son requeridos' });
    }
    if (!(await isOrgAdmin(userId, orgId, db))) {
      return createSkillResult({ success: false, errorCode: 'FORBIDDEN', errorMessage: 'Solo el administrador de la organización puede configurar el catálogo de castigos' });
    }

    const patch = { updated_at: new Date().toISOString() };
    if (name !== undefined) patch.name = name;
    if (code !== undefined) patch.code = code;
    if (description !== undefined) patch.description = description;
    if (amount !== undefined) patch.amount = amount;
    if (businessRule !== undefined) patch.business_rule = businessRule;
    if (active !== undefined) patch.active = active;

    const { data: penalty, error } = await db
      .from('lg_penalty_catalog')
      .update(patch)
      .eq('id', penaltyId)
      .eq('org_id', orgId)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return createSkillResult({ success: false, errorCode: 'DUPLICATE_CODE', errorMessage: 'Ya existe un castigo con ese código' });
      }
      return createSkillResult({ success: false, errorCode: 'UPDATE_PENALTY_CATALOG_ITEM_FAILED', errorMessage: error.message });
    }
    return createSkillResult({ success: true, data: { penalty } });
  }

  async _deletePenaltyCatalogItem({ penaltyId, orgId }, db, userId) {
    if (!penaltyId || !orgId) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'penaltyId y orgId son requeridos' });
    }
    if (!(await isOrgAdmin(userId, orgId, db))) {
      return createSkillResult({ success: false, errorCode: 'FORBIDDEN', errorMessage: 'Solo el administrador de la organización puede configurar el catálogo de castigos' });
    }

    const { error } = await db.from('lg_penalty_catalog').delete().eq('id', penaltyId).eq('org_id', orgId);
    if (error) {
      return createSkillResult({ success: false, errorCode: 'DELETE_PENALTY_CATALOG_ITEM_FAILED', errorMessage: error.message });
    }
    return createSkillResult({ success: true, data: { deleted: true, penaltyId } });
  }
}
