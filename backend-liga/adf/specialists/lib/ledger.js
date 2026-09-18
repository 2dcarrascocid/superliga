/**
 * Ledger (helper compartido, sin estado)
 *
 * Inserts reutilizables del libro de ingresos/egresos (lg_ledger_entries) y
 * el cálculo de estado de un movimiento. Lo usan tanto tournaments_specialist.js
 * (para generar los cobros automáticos de INSCRIPCION/FECHA) como
 * club_finance_specialist.js (para leerlos/decorarlos y para altas manuales).
 *
 * No es un Specialist — es lógica de dominio pura + inserts, sin permisos ni
 * validación de request (eso vive en quien la llama).
 */

// NOTA: 'EVENTO' es una categoría derivada (ver upsertEventSummaryEntry más
// abajo) — no se agrega a LEDGER_CATEGORIES a propósito, para que
// CREATE_LEDGER_ENTRY (alta manual) siga sin poder crear una fila 'EVENTO'
// suelta sin event_id. La única vía para escribir category='EVENTO' es esta
// función, desde club_finance_specialist.js.
export const LEDGER_CATEGORIES = ['INSCRIPCION', 'FECHA', 'MULTA', 'OTRO', 'VALOR'];
export const LEDGER_DIRECTIONS = ['INGRESO', 'EGRESO'];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Catálogo de costos de una temporada. Si no existe fila configurada,
 * devuelve costo 0 — no bloquea inscripción/fixture si el admin todavía
 * no configuró el mantenedor de costos.
 */
export async function getSeasonCostCatalog(seasonId, db) {
  if (!seasonId) return { inscription_fee: 0, matchday_fee: 0 };

  const { data } = await db
    .from('lg_season_cost_catalog')
    .select('inscription_fee, matchday_fee')
    .eq('season_id', seasonId)
    .maybeSingle();

  return {
    inscription_fee: data?.inscription_fee ?? 0,
    matchday_fee: data?.matchday_fee ?? 0,
  };
}

/**
 * Estado de un movimiento, calculado en vivo (no se guarda en BD):
 *   PAGADO   → paid_amount cubre el amount
 *   PARCIAL  → hay un abono pero no cubre el total
 *   VENCIDO  → no pagado y due_date ya pasó
 *   PENDIENTE → todavía no vence (o no tiene fecha de pago)
 */
export function computeEntryStatus(entry) {
  const amount = Number(entry.amount) || 0;
  const paid = Number(entry.paid_amount) || 0;

  if (amount > 0 && paid >= amount) return 'PAGADO';
  if (paid > 0) return 'PARCIAL';
  if (entry.due_date && entry.due_date < todayStr()) return 'VENCIDO';
  return 'PENDIENTE';
}

export function decorateLedgerEntry(entry) {
  return { ...entry, status: computeEntryStatus(entry) };
}

/**
 * Cobro de INSCRIPCION al inscribir un club (o, históricamente, una serie)
 * en un torneo. No lanza si falla — quien la llama decide si loguear y
 * continuar (una inscripción ya confirmada no debe revertirse por un
 * problema del libro).
 *
 * `seriesId` es opcional (null): el cobro de inscripción hoy se dispara a
 * nivel de CLUB (REGISTER_CLUB en tournaments_specialist.js), una sola vez
 * por club por torneo — no por cada serie inscrita. `lg_ledger_entries.series_id`
 * es nullable, así que un cobro con seriesId null queda asociado solo a
 * club_id + tournament_id.
 *
 * `amount` (opcional): si se pasa explícito, se usa ese valor (p.ej.
 * lg_tournaments.inscription_fee, el costo propio del torneo). Si se omite,
 * cae al valor histórico del catálogo por temporada (lg_season_cost_catalog),
 * para no romper llamadas existentes.
 */
export async function createInscriptionCharge({ orgId, clubId, seriesId = null, tournamentId, seasonId, amount }, db) {
  let effectiveAmount = amount;
  if (effectiveAmount === undefined || effectiveAmount === null) {
    const catalog = await getSeasonCostCatalog(seasonId, db);
    effectiveAmount = catalog.inscription_fee;
  }

  return db
    .from('lg_ledger_entries')
    .insert({
      org_id: orgId,
      club_id: clubId,
      series_id: seriesId,
      tournament_id: tournamentId,
      category: 'INSCRIPCION',
      direction: 'INGRESO',
      amount: effectiveAmount,
      description: 'Inscripción a torneo',
      due_date: todayStr(),
    })
    .select()
    .single();
}

/**
 * Cobro de FECHA para cada serie inscrita en el torneo que siga jugando
 * (ACTIVE, ELIMINATED — sigue jugando en liguilla de consuelo, o CHAMPION),
 * al generarse un matchday del fixture. Se excluyen solo las WITHDRAWN.
 * due_date = fecha del matchday (se paga esa fecha).
 *
 * Simplificación consciente: se cobra a todo el grupo inscrito no-retirado
 * en el momento en que se genera el matchday, no solo a quienes efectivamente
 * jugarán esa fecha puntual — en llaves de eliminación directa, quién avanza
 * a una ronda futura recién se sabe al cargar resultados (matches_specialist),
 * después de que el fixture ya generó todas las rondas de una vez.
 *
 * `onlySeriesIds` (opcional) acota el cobro a un subconjunto conocido de
 * antemano — lo usa la liguilla de consuelo, donde sí se sabe exactamente
 * quién participa (a diferencia de una llave de eliminación directa).
 */
export async function createMatchdayCharges({ orgId, tournamentId, seasonId, matchdayId, matchdayDate, onlySeriesIds }, db) {
  const catalog = await getSeasonCostCatalog(seasonId, db);

  let query = db
    .from('lg_tournament_teams')
    .select('series_id, series:lg_club_series(club_id)')
    .eq('tournament_id', tournamentId)
    .neq('status', 'WITHDRAWN');
  if (onlySeriesIds && onlySeriesIds.length > 0) query = query.in('series_id', onlySeriesIds);

  const { data: teams } = await query;

  const rows = (teams ?? [])
    .filter((t) => t.series?.club_id)
    .map((t) => ({
      org_id: orgId,
      club_id: t.series.club_id,
      series_id: t.series_id,
      tournament_id: tournamentId,
      matchday_id: matchdayId,
      category: 'FECHA',
      direction: 'INGRESO',
      amount: catalog.matchday_fee,
      description: 'Costo de fecha',
      due_date: matchdayDate,
    }));

  if (rows.length === 0) return { data: [], error: null };

  return db.from('lg_ledger_entries').insert(rows).select();
}

/**
 * Al regenerar un fixture (force=true), limpia los cobros de FECHA de los
 * matchdays que se van a reemplazar — solo los que nadie pagó todavía.
 * Los ya pagados se dejan intactos (matchday_id queda en NULL vía
 * ON DELETE SET NULL cuando el matchday efectivamente se borra).
 */
export async function clearUnpaidMatchdayCharges(matchdayIds, db) {
  if (!matchdayIds || matchdayIds.length === 0) return;
  await db
    .from('lg_ledger_entries')
    .delete()
    .in('matchday_id', matchdayIds)
    .eq('category', 'FECHA')
    .eq('paid_amount', 0);
}

/**
 * Recalcula la suma de `amount`/`paid_amount` de todos los
 * lg_club_event_charges de un evento y hace upsert de la única fila
 * resumen (category='EVENTO', event_id=eventId) en lg_ledger_entries.
 * La usa club_finance_specialist.js después de crear/editar charges o de
 * registrar un pago de un charge — así GET_PAYMENT_STATS/ClubFinanceView
 * ven el total del evento sin enterarse del detalle por jugador.
 *
 * NOTA: no existe hoy un UNIQUE index sobre lg_ledger_entries.event_id, así
 * que esta función NO usa `.upsert(..., { onConflict: 'event_id' })` (no
 * habría constraint que lo respalde) — hace un select explícito por
 * event_id + category='EVENTO' y decide insert vs update en el código. Si
 * en el futuro se agrega ese UNIQUE index, se puede simplificar a un upsert
 * real.
 *
 * No lanza si falla — retorna { data, error } como el resto de los helpers
 * de este archivo; quien la llama decide si es un error bloqueante.
 */
/**
 * Club_ids distintos con al menos una serie inscrita (lg_tournament_teams)
 * en algún torneo de la temporada `seasonId`. La usa
 * club_finance_specialist.js::_createOrgEvent para saber a qué clubes
 * generarles un cargo al crear un evento de organización.
 *
 * En dos pasos (torneos de la temporada -> equipos inscritos en esos
 * torneos) en vez de un filtro sobre el recurso embebido `tournament`,
 * mismo estilo que createMatchdayCharges/_generateMatchdayCharges de este
 * archivo/tournaments_specialist.js.
 */
export async function getSeasonParticipantClubIds(seasonId, db) {
  const { data: tournaments } = await db
    .from('lg_tournaments').select('id').eq('season_id', seasonId);

  const tournamentIds = (tournaments ?? []).map((t) => t.id);
  if (tournamentIds.length === 0) return [];

  const { data: teams } = await db
    .from('lg_tournament_teams')
    .select('series_id, series:lg_club_series(club_id)')
    .in('tournament_id', tournamentIds);

  const clubIds = new Set();
  for (const t of teams ?? []) {
    if (t.series?.club_id) clubIds.add(t.series.club_id);
  }
  return Array.from(clubIds);
}

export async function upsertEventSummaryEntry({ orgId, clubId, eventId, direction, description, dueDate }, db) {
  const { data: charges, error: chargesError } = await db
    .from('lg_club_event_charges')
    .select('amount, paid_amount')
    .eq('event_id', eventId);
  if (chargesError) return { data: null, error: chargesError };

  const totalAmount = (charges ?? []).reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const totalPaid = (charges ?? []).reduce((sum, c) => sum + (Number(c.paid_amount) || 0), 0);

  const { data: existing, error: existingError } = await db
    .from('lg_ledger_entries')
    .select('id')
    .eq('event_id', eventId)
    .eq('category', 'EVENTO')
    .maybeSingle();
  if (existingError) return { data: null, error: existingError };

  if (existing) {
    return db
      .from('lg_ledger_entries')
      .update({
        amount: totalAmount,
        paid_amount: totalPaid,
        paid_at: totalPaid > 0 ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single();
  }

  return db
    .from('lg_ledger_entries')
    .insert({
      org_id: orgId,
      club_id: clubId,
      event_id: eventId,
      category: 'EVENTO',
      direction,
      amount: totalAmount,
      paid_amount: totalPaid,
      paid_at: totalPaid > 0 ? new Date().toISOString() : null,
      description: description ?? null,
      due_date: dueDate ?? null,
    })
    .select()
    .single();
}
