/**
 * ADF - Matches Specialist (Specialists Layer)
 *
 * Gestión logística y de resultados de cada partido: jornadas,
 * asignación de cancha/árbitro/turno, marcador, y eventos del
 * partido (goles, tarjetas, amonestaciones).
 *
 * DO:
 *   - Al finalizar un partido de llave (KNOCKOUT), resolver el ganador
 *     y propagarlo con lib/bracket_propagation.js
 *   - En cruces de ida y vuelta, esperar la vuelta para resolver el global
 *   - Marcar como ELIMINATED al equipo perdedor de un cruce de llave
 *
 * DON'T:
 *   - No crear ni administrar torneos/fixture — eso es de "tournaments"
 *   - No gestionar costos — eso es de "tournament_costs"
 *
 * Capabilities:
 *   LIST_MATCHDAYS | CREATE_MATCHDAY
 *   LIST_MATCHES | GET_MATCH | UPDATE_MATCH_LOGISTICS | UPDATE_MATCH_RESULT
 *   LIST_MATCH_EVENTS | ADD_MATCH_EVENT | DELETE_MATCH_EVENT
 *   GET_TOP_SCORERS | GET_FAIRPLAY_RANKING | GET_VENUE_TIME_SLOTS
 *   LIST_MATCH_DOCUMENTS | REGISTER_MATCH_DOCUMENT | DELETE_MATCH_DOCUMENT
 *
 * Documentos de partido (Planilla de Control de Partido):
 *   - Los archivos se suben directo a Cloudinary desde el frontend; este
 *     specialist solo guarda metadatos en lg_match_documents (mismo patrón
 *     que player_documents_specialist.js para lg_player_documents).
 *   - Soft-delete: cambiar estado a 'DELETED', nunca borrar la fila.
 */

import { Skill } from '../contracts/skill_contract.js';
import { createSkillResult } from '../contracts/task_schema.js';
import { propagateWinner } from './lib/bracket_propagation.js';
import { buildTimeSlots } from './match_scheduling_specialist.js';
import { fetchOrgSchedulingSettings } from './lib/scheduling_settings.js';

const CAPABILITIES = [
  'LIST_MATCHDAYS', 'CREATE_MATCHDAY',
  'LIST_MATCHES', 'GET_MATCH', 'UPDATE_MATCH_LOGISTICS', 'UPDATE_MATCH_RESULT',
  'LIST_MATCH_EVENTS', 'ADD_MATCH_EVENT', 'DELETE_MATCH_EVENT',
  'GET_TOP_SCORERS', 'GET_FAIRPLAY_RANKING', 'GET_VENUE_TIME_SLOTS',
  'LIST_MATCH_DOCUMENTS', 'REGISTER_MATCH_DOCUMENT', 'DELETE_MATCH_DOCUMENT',
];

const MATCH_SELECT = `
  *,
  home_series:lg_club_series!lg_matches_home_series_id_fkey(id,name,club:lg_clubs(id,name,short_name,logo_url)),
  away_series:lg_club_series!lg_matches_away_series_id_fkey(id,name,club:lg_clubs(id,name,short_name,logo_url)),
  winner_series:lg_club_series!lg_matches_winner_series_id_fkey(id,name,club:lg_clubs(id,name,short_name)),
  venue:lg_venues(id,name,address,city),
  referee:lg_referees(id,full_name,phone)
`;

export class MatchesSpecialist extends Skill {
  constructor() {
    super('matches_specialist', '1.0.0');
    this.domain = 'matches';
    this.capabilities = CAPABILITIES;

    this.contract = {
      input: [
        { name: 'operation', required: true, type: 'string' },
        { name: 'payload', required: true, type: 'object' },
        { name: 'db', required: true, type: 'object' },
        { name: 'userId', required: false, type: 'string' },
      ],
      output: [
        { name: 'match', type: 'object' },
        { name: 'matches', type: 'array' },
        { name: 'matchday', type: 'object' },
        { name: 'matchdays', type: 'array' },
        { name: 'events', type: 'array' },
        { name: 'document', type: 'object' },
        { name: 'documents', type: 'array' },
      ],
      rules: {
        do: [
          'Propagar ganador/perdedor de llave al finalizar un partido KNOCKOUT',
          'Resolver el global antes de propagar en cruces de ida y vuelta',
          'Filtrar estado=ACTIVE en LIST_MATCH_DOCUMENTS',
          'Soft-delete en DELETE_MATCH_DOCUMENT',
        ],
        dont: [
          'No crear ni administrar torneos/fixture',
          'No gestionar costos',
          'No subir archivos (cliente sube a Cloudinary directamente)',
        ],
      },
      checklist: [
        'UPDATE_MATCH_RESULT rechaza partidos sin equipos definidos (TBD)',
        'UPDATE_MATCH_RESULT propaga el ganador en fases KNOCKOUT',
      ],
    };
  }

  async execute(task) {
    const { operation, payload, db, userId } = task.input;

    if (!this.capabilities.includes(operation)) {
      return createSkillResult({ success: false, errorCode: 'UNKNOWN_OPERATION', errorMessage: `Operación desconocida: "${operation}"` });
    }

    try {
      switch (operation) {
        case 'LIST_MATCHDAYS': return this._listMatchdays(payload, db);
        case 'CREATE_MATCHDAY': return this._createMatchday(payload, db);
        case 'LIST_MATCHES': return this._listMatches(payload, db);
        case 'GET_MATCH': return this._getMatch(payload, db);
        case 'UPDATE_MATCH_LOGISTICS': return this._updateLogistics(payload, db);
        case 'UPDATE_MATCH_RESULT': return this._updateResult(payload, db);
        case 'LIST_MATCH_EVENTS': return this._listEvents(payload, db);
        case 'ADD_MATCH_EVENT': return this._addEvent(payload, db);
        case 'DELETE_MATCH_EVENT': return this._deleteEvent(payload, db);
        case 'GET_TOP_SCORERS': return this._getTopScorers(payload, db);
        case 'GET_FAIRPLAY_RANKING': return this._getFairplayRanking(payload, db);
        case 'GET_VENUE_TIME_SLOTS': return this._getVenueTimeSlots(payload, db);
        case 'LIST_MATCH_DOCUMENTS': return this._listMatchDocuments(payload, db);
        case 'REGISTER_MATCH_DOCUMENT': return this._registerMatchDocument(payload, db, userId);
        case 'DELETE_MATCH_DOCUMENT': return this._deleteMatchDocument(payload, db);
      }
    } catch (err) {
      return createSkillResult({ success: false, errorCode: 'MATCHES_SPECIALIST_ERROR', errorMessage: err.message });
    }
  }

  // ── Jornadas ─────────────────────────────────────────────────────────────

  async _listMatchdays({ tournamentId, stageId }, db) {
    let query = db.from('lg_matchdays').select('*').eq('tournament_id', tournamentId).order('number', { ascending: true });
    if (stageId) query = query.eq('stage_id', stageId);
    const { data: matchdays, error } = await query;
    if (error) return createSkillResult({ success: false, errorCode: 'LIST_MATCHDAYS_FAILED', errorMessage: error.message });
    return createSkillResult({ success: true, data: { matchdays } });
  }

  async _createMatchday({ tournamentId, stageId, number, name, date }, db) {
    if (!tournamentId || !stageId || !number) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'tournamentId, stageId y number son requeridos' });
    }
    const { data: matchday, error } = await db
      .from('lg_matchdays')
      .insert({ tournament_id: tournamentId, stage_id: stageId, number, name: name ?? null, date: date ?? null })
      .select().single();
    if (error) return createSkillResult({ success: false, errorCode: 'CREATE_MATCHDAY_FAILED', errorMessage: error.message });
    return createSkillResult({ success: true, data: { matchday } });
  }

  // ── Partidos ─────────────────────────────────────────────────────────────

  async _listMatches({ tournamentId, matchdayId, stageId, seriesId, status }, db) {
    if (!tournamentId) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'tournamentId es requerido' });
    }
    let query = db.from('lg_matches').select(MATCH_SELECT).eq('tournament_id', tournamentId);
    if (matchdayId) query = query.eq('matchday_id', matchdayId);
    if (stageId) query = query.eq('stage_id', stageId);
    if (status) query = query.eq('status', status);
    if (seriesId) query = query.or(`home_series_id.eq.${seriesId},away_series_id.eq.${seriesId}`);
    query = query.order('round_number', { ascending: true }).order('match_date', { ascending: true });

    const { data: matches, error } = await query;
    if (error) return createSkillResult({ success: false, errorCode: 'LIST_MATCHES_FAILED', errorMessage: error.message });
    return createSkillResult({ success: true, data: { matches } });
  }

  async _getMatch({ matchId }, db) {
    const { data: match, error } = await db.from('lg_matches').select(MATCH_SELECT).eq('id', matchId).maybeSingle();
    if (error || !match) {
      return createSkillResult({ success: false, errorCode: 'MATCH_NOT_FOUND', errorMessage: 'Partido no encontrado' });
    }
    return createSkillResult({ success: true, data: { match } });
  }

  async _updateLogistics({ matchId, venueId, refereeId, matchDate, matchTime, timeSlot, observations, matchdayId, status }, db) {
    const patch = { updated_at: new Date().toISOString() };
    if (venueId !== undefined) patch.venue_id = venueId;
    if (refereeId !== undefined) patch.referee_id = refereeId;
    if (matchDate !== undefined) patch.match_date = matchDate || null;
    if (matchTime !== undefined) patch.match_time = matchTime || null;
    if (timeSlot !== undefined) patch.time_slot = timeSlot || null;
    if (observations !== undefined) patch.observations = observations;
    if (matchdayId !== undefined) patch.matchday_id = matchdayId;
    if (status !== undefined) patch.status = status;

    // Un árbitro no puede quedar asignado a dos partidos la misma fecha y
    // hora. Se resuelven los valores finales (nuevos o los ya guardados en
    // el partido) antes de chequear, para no dejar pasar un PATCH parcial
    // que solo cambia la fecha/hora de un partido que ya tenía árbitro.
    const finalRefereeId = refereeId !== undefined ? refereeId : undefined;
    if ((refereeId !== undefined && refereeId) || matchDate !== undefined || matchTime !== undefined) {
      const { data: current, error: curErr } = await db
        .from('lg_matches').select('referee_id, match_date, match_time').eq('id', matchId).maybeSingle();
      if (curErr || !current) {
        return createSkillResult({ success: false, errorCode: 'MATCH_NOT_FOUND', errorMessage: 'Partido no encontrado' });
      }
      const effectiveRefereeId = finalRefereeId !== undefined ? finalRefereeId : current.referee_id;
      const effectiveDate = patch.match_date !== undefined ? patch.match_date : current.match_date;
      const effectiveTime = patch.match_time !== undefined ? patch.match_time : current.match_time;

      if (effectiveRefereeId && effectiveDate && effectiveTime) {
        const { data: conflicts, error: conflictErr } = await db
          .from('lg_matches')
          .select('id')
          .eq('referee_id', effectiveRefereeId)
          .eq('match_date', effectiveDate)
          .eq('match_time', effectiveTime)
          .neq('id', matchId)
          .limit(1);
        if (conflictErr) {
          return createSkillResult({ success: false, errorCode: 'UPDATE_LOGISTICS_FAILED', errorMessage: conflictErr.message });
        }
        if (conflicts && conflicts.length > 0) {
          return createSkillResult({
            success: false,
            errorCode: 'REFEREE_CONFLICT',
            errorMessage: 'El árbitro ya está asignado a otro partido en esa fecha y hora',
          });
        }
      }
    }

    const { data: match, error } = await db.from('lg_matches').update(patch).eq('id', matchId).select(MATCH_SELECT).single();
    if (error) return createSkillResult({ success: false, errorCode: 'UPDATE_LOGISTICS_FAILED', errorMessage: error.message });
    return createSkillResult({ success: true, data: { match } });
  }

  // Bloques de horario disponibles de una cancha, según los parámetros de
  // programación de la organización (lg_scheduling_settings: horario de
  // inicio y duración de partido) — misma lógica que usa "Programación de
  // Fecha" (buildTimeSlots), reutilizada acá para un único partido.
  async _getVenueTimeSlots({ venueId, date, excludeMatchId, blockCount }, db) {
    if (!venueId || !date) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'venueId y date son requeridos' });
    }

    const { data: venue, error: venueErr } = await db.from('lg_venues').select('*').eq('id', venueId).maybeSingle();
    if (venueErr || !venue) {
      return createSkillResult({ success: false, errorCode: 'VENUE_NOT_FOUND', errorMessage: 'Cancha no encontrada' });
    }

    const orgSettings = await fetchOrgSchedulingSettings(db, venue.org_id);
    const slots = buildTimeSlots(venue, blockCount || 6, orgSettings);

    let occupiedQuery = db.from('lg_matches').select('id, match_time').eq('venue_id', venueId).eq('match_date', date).not('match_time', 'is', null);
    if (excludeMatchId) occupiedQuery = occupiedQuery.neq('id', excludeMatchId);
    const { data: occupiedMatches, error: occErr } = await occupiedQuery;
    if (occErr) return createSkillResult({ success: false, errorCode: 'GET_VENUE_TIME_SLOTS_FAILED', errorMessage: occErr.message });

    const occupiedTimes = new Set((occupiedMatches || []).map((m) => m.match_time));
    const slotsWithAvailability = slots.map((s) => ({ ...s, available: !occupiedTimes.has(s.time) }));

    return createSkillResult({ success: true, data: { slots: slotsWithAvailability } });
  }

  async _updateResult({ matchId, homeScore, awayScore, homePenaltyScore, awayPenaltyScore, status, observations }, db) {
    const { data: current, error: curErr } = await db.from('lg_matches').select('*').eq('id', matchId).maybeSingle();
    if (curErr || !current) {
      return createSkillResult({ success: false, errorCode: 'MATCH_NOT_FOUND', errorMessage: 'Partido no encontrado' });
    }
    if (!current.home_series_id || !current.away_series_id) {
      return createSkillResult({ success: false, errorCode: 'MATCH_NOT_READY', errorMessage: 'El partido aún no tiene ambos equipos definidos' });
    }

    const patch = {
      home_score: homeScore ?? null,
      away_score: awayScore ?? null,
      home_penalty_score: homePenaltyScore ?? null,
      away_penalty_score: awayPenaltyScore ?? null,
      status: status ?? 'FINISHED',
      updated_at: new Date().toISOString(),
    };
    if (observations !== undefined) patch.observations = observations;

    // Ganador de ESTE partido individual (para mostrar en pantalla incluso
    // fuera de fases de llave). En empate sin penales, queda sin resolver.
    if (patch.status === 'FINISHED' && patch.home_score != null && patch.away_score != null) {
      if (patch.home_score > patch.away_score) patch.winner_series_id = current.home_series_id;
      else if (patch.away_score > patch.home_score) patch.winner_series_id = current.away_series_id;
      else if (patch.home_penalty_score != null && patch.away_penalty_score != null && patch.home_penalty_score !== patch.away_penalty_score) {
        patch.winner_series_id = patch.home_penalty_score > patch.away_penalty_score ? current.home_series_id : current.away_series_id;
      } else {
        patch.winner_series_id = null;
      }
    }

    const { data: updated, error } = await db.from('lg_matches').update(patch).eq('id', matchId).select(MATCH_SELECT).single();
    if (error) return createSkillResult({ success: false, errorCode: 'UPDATE_RESULT_FAILED', errorMessage: error.message });

    let bracketNote = null;
    if (updated.status === 'FINISHED') {
      const { data: stage } = await db.from('lg_tournament_stages').select('*').eq('id', updated.stage_id).maybeSingle();

      if (stage?.stage_type === 'KNOCKOUT') {
        const isTwoLegged = updated.leg_number === 2;
        let decisiveMatch = updated;

        if (isTwoLegged) {
          // Busca la ida: mismo cruce, fuente de local/visita invertida.
          const { data: firstLeg } = await db
            .from('lg_matches').select('*')
            .eq('stage_id', updated.stage_id).eq('round_number', updated.round_number).eq('leg_number', 1)
            .eq('home_series_id', updated.away_series_id).eq('away_series_id', updated.home_series_id)
            .maybeSingle();

          if (firstLeg && firstLeg.home_score != null && firstLeg.away_score != null && updated.home_score != null && updated.away_score != null) {
            // Agregado: "updated" es la vuelta (home=B,away=A); "firstLeg" es la ida (home=A,away=B).
            const aggA = (firstLeg.home_score || 0) + (updated.away_score || 0);
            const aggB = (firstLeg.away_score || 0) + (updated.home_score || 0);
            let winner = null;
            if (aggA > aggB) winner = firstLeg.home_series_id;
            else if (aggB > aggA) winner = firstLeg.away_series_id;
            else if (updated.home_penalty_score != null && updated.away_penalty_score != null && updated.home_penalty_score !== updated.away_penalty_score) {
              winner = updated.home_penalty_score > updated.away_penalty_score ? updated.home_series_id : updated.away_series_id;
            }

            if (winner) {
              await db.from('lg_matches').update({ winner_series_id: winner }).eq('id', updated.id);
              decisiveMatch = { ...updated, winner_series_id: winner };
            } else {
              bracketNote = 'EMPATE_GLOBAL_SIN_DEFINIR';
              decisiveMatch = null;
            }
          } else {
            bracketNote = 'ESPERANDO_PARTIDO_DE_IDA';
            decisiveMatch = null;
          }
        }

        if (decisiveMatch?.winner_series_id) {
          await propagateWinner(db, decisiveMatch);
          const loserSeriesId = decisiveMatch.winner_series_id === decisiveMatch.home_series_id ? decisiveMatch.away_series_id : decisiveMatch.home_series_id;
          if (loserSeriesId) {
            await db.from('lg_tournament_teams').update({ status: 'ELIMINATED' })
              .eq('tournament_id', updated.tournament_id).eq('series_id', loserSeriesId);
          }
        }
      }
    }

    return createSkillResult({ success: true, data: { match: updated, bracketNote } });
  }

  // ── Eventos (goles, tarjetas, amonestaciones) ───────────────────────────

  async _listEvents({ matchId }, db) {
    const { data: events, error } = await db
      .from('lg_match_events')
      .select('*, player:lg_players(id,first_name,last_name), series:lg_club_series(id,name,club:lg_clubs(id,name,short_name)), penalty:lg_penalty_catalog(id,name,code,amount)')
      .eq('match_id', matchId)
      .order('minute', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });
    if (error) return createSkillResult({ success: false, errorCode: 'LIST_EVENTS_FAILED', errorMessage: error.message });
    return createSkillResult({ success: true, data: { events } });
  }

  async _addEvent({ matchId, seriesId, playerId, eventType, minute, notes, penaltyId }, db) {
    if (!matchId || !seriesId || !eventType) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'matchId, seriesId y eventType son requeridos' });
    }
    const { data: event, error } = await db
      .from('lg_match_events')
      .insert({ match_id: matchId, series_id: seriesId, player_id: playerId ?? null, event_type: eventType, minute: minute ?? null, notes: notes ?? null, penalty_id: penaltyId ?? null })
      .select('*, player:lg_players(id,first_name,last_name), series:lg_club_series(id,name,club:lg_clubs(id,name,short_name)), penalty:lg_penalty_catalog(id,name,code,amount)')
      .single();
    if (error) return createSkillResult({ success: false, errorCode: 'ADD_EVENT_FAILED', errorMessage: error.message });
    return createSkillResult({ success: true, data: { event } });
  }

  async _deleteEvent({ matchId, eventId }, db) {
    const { error } = await db.from('lg_match_events').delete().eq('id', eventId).eq('match_id', matchId);
    if (error) return createSkillResult({ success: false, errorCode: 'DELETE_EVENT_FAILED', errorMessage: error.message });
    return createSkillResult({ success: true, data: { deleted: true, eventId } });
  }

  // ── Estadísticas de torneo (goleadores, fairplay) ───────────────────────

  async _getTopScorers({ tournamentId, limit = 50 }, db) {
    if (!tournamentId) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'tournamentId es requerido' });
    }

    const { data: matches, error: matchesErr } = await db.from('lg_matches').select('id').eq('tournament_id', tournamentId);
    if (matchesErr) return createSkillResult({ success: false, errorCode: 'TOP_SCORERS_FAILED', errorMessage: matchesErr.message });
    const matchIds = (matches || []).map((m) => m.id);
    if (matchIds.length === 0) return createSkillResult({ success: true, data: { scorers: [] } });

    const { data: events, error } = await db
      .from('lg_match_events')
      .select('player_id, series_id, player:lg_players(id,first_name,last_name,photo_url), series:lg_club_series(id,name,club:lg_clubs(id,name,short_name))')
      .eq('event_type', 'GOAL')
      .in('match_id', matchIds)
      .not('player_id', 'is', null);
    if (error) return createSkillResult({ success: false, errorCode: 'TOP_SCORERS_FAILED', errorMessage: error.message });

    const byPlayer = {};
    for (const e of events || []) {
      if (!byPlayer[e.player_id]) {
        byPlayer[e.player_id] = {
          player_id: e.player_id,
          player_name: e.player ? `${e.player.first_name} ${e.player.last_name}` : 'Jugador',
          photo_url: e.player?.photo_url || null,
          series_id: e.series_id,
          series_name: e.series?.name || null,
          club_name: e.series?.club?.name || null,
          goals: 0,
        };
      }
      byPlayer[e.player_id].goals++;
    }

    const scorers = Object.values(byPlayer)
      .sort((a, b) => b.goals - a.goals)
      .slice(0, limit)
      .map((row, i) => ({ ...row, position: i + 1 }));

    return createSkillResult({ success: true, data: { scorers } });
  }

  async _getFairplayRanking({ tournamentId }, db) {
    if (!tournamentId) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'tournamentId es requerido' });
    }

    const { data: matches, error: matchesErr } = await db.from('lg_matches').select('id').eq('tournament_id', tournamentId);
    if (matchesErr) return createSkillResult({ success: false, errorCode: 'FAIRPLAY_FAILED', errorMessage: matchesErr.message });
    const matchIds = (matches || []).map((m) => m.id);

    const bySeries = {};

    // Parte de los equipos inscritos (0 sanciones) — igual que en la tabla
    // de posiciones, para que se vea el ranking completo desde el inicio.
    const { data: teams } = await db
      .from('lg_tournament_teams')
      .select('series_id, series:lg_club_series(id,name,club:lg_clubs(id,name,short_name))')
      .eq('tournament_id', tournamentId);
    for (const t of teams || []) {
      bySeries[t.series_id] = {
        series_id: t.series_id,
        series_name: t.series?.name || null,
        club_name: t.series?.club?.name || null,
        yellow_cards: 0, red_cards: 0, warnings: 0, total: 0,
      };
    }

    if (matchIds.length > 0) {
      const { data: events, error } = await db
        .from('lg_match_events')
        .select('series_id, event_type, series:lg_club_series(id,name,club:lg_clubs(id,name,short_name))')
        .in('match_id', matchIds)
        .in('event_type', ['YELLOW_CARD', 'RED_CARD', 'WARNING']);
      if (error) return createSkillResult({ success: false, errorCode: 'FAIRPLAY_FAILED', errorMessage: error.message });

      for (const e of events || []) {
        if (!bySeries[e.series_id]) {
          bySeries[e.series_id] = {
            series_id: e.series_id,
            series_name: e.series?.name || null,
            club_name: e.series?.club?.name || null,
            yellow_cards: 0, red_cards: 0, warnings: 0, total: 0,
          };
        }
        const row = bySeries[e.series_id];
        if (e.event_type === 'YELLOW_CARD') row.yellow_cards++;
        else if (e.event_type === 'RED_CARD') row.red_cards++;
        else if (e.event_type === 'WARNING') row.warnings++;
        row.total++;
      }
    }

    // Mejor fairplay primero: menos sanciones totales; a igualdad, menos rojas, luego menos amarillas.
    const ranking = Object.values(bySeries)
      .sort((a, b) => a.total - b.total || a.red_cards - b.red_cards || a.yellow_cards - b.yellow_cards)
      .map((row, i) => ({ ...row, position: i + 1 }));

    return createSkillResult({ success: true, data: { ranking } });
  }

  // ── Documentos de Partido (Planilla de Control de Partido) ─────────────

  async _listMatchDocuments({ matchId }, db) {
    const { data: documents, error } = await db
      .from('lg_match_documents')
      .select('*')
      .eq('match_id', matchId)
      .eq('estado', 'ACTIVE')
      .order('created_at', { ascending: false });

    if (error) {
      return createSkillResult({ success: false, errorCode: 'LIST_MATCH_DOCUMENTS_FAILED', errorMessage: error.message });
    }

    return createSkillResult({ success: true, data: { documents: documents ?? [] } });
  }

  async _registerMatchDocument({ matchId, nombreOriginal, mimeType, size, path, bucket, urlPublica }, db, userId) {
    if (!matchId || !nombreOriginal || !mimeType || !size || !path) {
      return createSkillResult({
        success: false,
        errorCode: 'VALIDATION_FAILED',
        errorMessage: 'Se requiere matchId, nombreOriginal, mimeType, size y path',
      });
    }

    const { data: doc, error } = await db
      .from('lg_match_documents')
      .insert({
        match_id:        matchId,
        uploaded_by:     userId,
        nombre_original: nombreOriginal,
        mime_type:       mimeType,
        size:            parseInt(size, 10),
        bucket:          bucket || 'cloudinary',
        path,
        url_publica:     urlPublica || null,
        estado:          'ACTIVE',
      })
      .select()
      .single();

    if (error) {
      return createSkillResult({ success: false, errorCode: 'REGISTER_MATCH_DOCUMENT_FAILED', errorMessage: error.message });
    }

    return createSkillResult({ success: true, data: { document: doc } });
  }

  async _deleteMatchDocument({ matchId, documentId }, db) {
    const { data: doc, error } = await db
      .from('lg_match_documents')
      .update({ estado: 'DELETED' })
      .eq('id', documentId)
      .eq('match_id', matchId)
      .eq('estado', 'ACTIVE')
      .select()
      .single();

    if (error || !doc) {
      return createSkillResult({ success: false, errorCode: 'DELETE_MATCH_DOCUMENT_FAILED', errorMessage: 'Documento no encontrado o ya eliminado' });
    }

    return createSkillResult({ success: true, data: { document: doc } });
  }
}
