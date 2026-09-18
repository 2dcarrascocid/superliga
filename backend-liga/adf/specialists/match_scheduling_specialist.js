/**
 * ADF - Match Scheduling Specialist (Specialists Layer)
 *
 * Programación de Fecha: asignación automática de cancha/horario para
 * los partidos de una fecha de calendario. Una fecha cruza varios
 * torneos de la misma temporada (uno por categoría — Súper Senior,
 * Senior, Dorados) sobre 3 canchas fijas; un club que juega 2-3
 * categorías el mismo día queda anclado a la MISMA cancha en bloques
 * horarios consecutivos (el rival puede cambiar entre categorías).
 *
 * DO:
 *   - Leer los partidos ya generados por GENERATE_FIXTURE (tournaments)
 *     agrupando por season_id + match_date — nunca crear matchdays ni
 *     torneos desde acá
 *   - Repartir la falla de continuidad equitativamente entre clubes a
 *     lo largo de la temporada (lg_matchday_scheduling_failures)
 *
 * DON'T:
 *   - No generar fixture ni crear torneos — eso es de "tournaments"
 *   - No calcular horarios "de reloj" en el algoritmo puro — eso lo
 *     resuelve buildTimeSlots() acá, antes de llamar a
 *     buildScheduleProposal()
 *
 * Capabilities:
 *   PREVIEW_SCHEDULE | APPLY_SCHEDULE
 */

import { Skill } from '../contracts/skill_contract.js';
import { createSkillResult } from '../contracts/task_schema.js';
import { buildScheduleProposal } from './lib/schedule_generator.js';
import { fetchOrgSchedulingSettings } from './lib/scheduling_settings.js';

const CAPABILITIES = ['PREVIEW_SCHEDULE', 'APPLY_SCHEDULE'];

const MATCH_SELECT = `
  id, tournament_id, match_date,
  home_series:lg_club_series!lg_matches_home_series_id_fkey(id,name,club_id,category_id,club:lg_clubs(id,name)),
  away_series:lg_club_series!lg_matches_away_series_id_fkey(id,name,club_id,category_id,club:lg_clubs(id,name)),
  tournament:lg_tournaments(id,name,category_id)
`;

// Fallback final cuando la org no tiene fila configurada en
// lg_scheduling_settings (módulo "Parámetros" — ver
// scheduling_settings_specialist.js). Antes de esa tabla, estos eran los
// únicos valores posibles; hoy son el último escalón de prioridad en
// buildTimeSlots(): venue explícito > orgSettings > estos defaults.
const DEFAULT_START_TIME = '14:00:00';
const DEFAULT_BLOCK_MINUTES = 60;
const REAL_BLOCK_MINUTES = 70; // 30' de juego x lado + 5' descanso + 5' cambio

/**
 * Deriva la grilla de horarios de una cancha, con esta prioridad:
 *   1. `venue.start_time`/`venue.duration_minutes` si vienen seteados
 *      explícitamente (comportamiento defensivo, ver nota abajo).
 *   2. `orgSettings.defaultStartTime`/`orgSettings.blockDurationMinutes`
 *      (módulo "Parámetros" — lg_scheduling_settings de la organización)
 *      si se proveyeron.
 *   3. Los defaults hardcodeados DEFAULT_START_TIME/REAL_BLOCK_MINUTES,
 *      para orgs que todavía no configuraron una fila en
 *      lg_scheduling_settings.
 *
 * NOTA: `lg_venues.start_time`/`duration_minutes` fueron eliminadas de
 * la tabla en 20260807_lg_venues_drop_capacity_schedule.sql — hoy
 * `venue.start_time`/`venue.duration_minutes` vienen `undefined` para
 * todas las canchas, así que esta función siempre cae a `orgSettings`
 * (o a los defaults hardcodeados si no hay `orgSettings`). Se deja
 * implementada tal como está pedida (defensiva ante que esas columnas
 * existan) para no romper si en el futuro se restauran — ver nota de
 * desviación en el reporte de esta tarea.
 *
 * @param {{ start_time?: string|null, duration_minutes?: number|null }} venue
 * @param {number} blockCount
 * @param {{ defaultStartTime?: string, blockDurationMinutes?: number }|null} orgSettings Parámetros de la organización (lg_scheduling_settings), si se resolvieron antes de llamar a esta función.
 * @returns {{ index: number, time: string, label: string }[]}
 */
export function buildTimeSlots(venue, blockCount = 4, orgSettings = null) {
  const startTime = venue?.start_time ?? orgSettings?.defaultStartTime ?? DEFAULT_START_TIME;
  const durationMinutes = (venue?.duration_minutes && venue.duration_minutes !== DEFAULT_BLOCK_MINUTES)
    ? venue.duration_minutes
    : (orgSettings?.blockDurationMinutes ?? REAL_BLOCK_MINUTES);

  const [h, m, s] = startTime.split(':').map((v) => parseInt(v, 10));
  let totalMinutes = h * 60 + (m || 0);

  const slots = [];
  for (let index = 0; index < blockCount; index++) {
    const hh = Math.floor(totalMinutes / 60) % 24;
    const mm = totalMinutes % 60;
    const hhStr = String(hh).padStart(2, '0');
    const mmStr = String(mm).padStart(2, '0');
    slots.push({ index, time: `${hhStr}:${mmStr}:00`, label: `${hhStr}:${mmStr}` });
    totalMinutes += durationMinutes;
  }
  return slots;
}

export class MatchSchedulingSpecialist extends Skill {
  constructor() {
    super('match_scheduling_specialist', '1.0.0');
    this.domain = 'match_scheduling';
    this.capabilities = CAPABILITIES;

    this.contract = {
      input: [
        { name: 'operation', required: true, type: 'string' },
        { name: 'payload', required: true, type: 'object' },
        { name: 'db', required: true, type: 'object' },
        { name: 'userId', required: false, type: 'string' },
      ],
      output: [
        { name: 'proposal', type: 'array' },
        { name: 'matches', type: 'array' },
        { name: 'venues', type: 'array' },
        { name: 'failedClubIds', type: 'array' },
        { name: 'partiallyFailedClubIds', type: 'array' },
      ],
      rules: {
        do: [
          'Leer partidos ya generados por tournaments (GENERATE_FIXTURE), agrupando por season_id + match_date',
          'Repartir la falla de continuidad entre clubes a lo largo de la temporada',
        ],
        dont: [
          'No generar fixture ni crear/administrar torneos o matchdays',
          'No calcular horarios de reloj dentro del algoritmo puro (schedule_generator.js)',
        ],
      },
      checklist: [
        'PREVIEW_SCHEDULE no escribe nada en la base de datos',
        'APPLY_SCHEDULE actualiza venue_id/match_time/time_slot de cada partido',
        'APPLY_SCHEDULE registra el historial de fallas de continuidad (lg_matchday_scheduling_failures)',
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
        case 'PREVIEW_SCHEDULE': return this._previewSchedule(payload, db);
        case 'APPLY_SCHEDULE': return this._applySchedule(payload, db, userId);
      }
    } catch (err) {
      return createSkillResult({ success: false, errorCode: 'MATCH_SCHEDULING_SPECIALIST_ERROR', errorMessage: err.message });
    }
  }

  // ── PREVIEW_SCHEDULE ─────────────────────────────────────────────────────

  async _previewSchedule({ seasonId, date, venueIds }, db) {
    if (!seasonId || !date) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'seasonId y date son requeridos' });
    }

    const { data: season, error: seasonErr } = await db.from('lg_seasons').select('*').eq('id', seasonId).maybeSingle();
    if (seasonErr || !season) {
      return createSkillResult({ success: false, errorCode: 'SEASON_NOT_FOUND', errorMessage: 'Temporada no encontrada' });
    }

    const { data: tournaments, error: tournamentsErr } = await db
      .from('lg_tournaments').select('id, category_id').eq('season_id', seasonId);
    if (tournamentsErr) {
      return createSkillResult({ success: false, errorCode: 'PREVIEW_SCHEDULE_FAILED', errorMessage: tournamentsErr.message });
    }
    if (!tournaments || tournaments.length === 0) {
      return createSkillResult({ success: true, data: { season, date, venues: [], matches: [], proposal: [], failedClubIds: [], partiallyFailedClubIds: [], fairnessCounts: {} } });
    }
    const tournamentIds = tournaments.map((t) => t.id);

    const { data: matches, error: matchesErr } = await db
      .from('lg_matches')
      .select(MATCH_SELECT)
      .in('tournament_id', tournamentIds)
      .eq('match_date', date);
    if (matchesErr) {
      return createSkillResult({ success: false, errorCode: 'PREVIEW_SCHEDULE_FAILED', errorMessage: matchesErr.message });
    }
    if (!matches || matches.length === 0) {
      return createSkillResult({ success: true, data: { season, date, venues: [], matches: [], proposal: [], failedClubIds: [], partiallyFailedClubIds: [], fairnessCounts: {} } });
    }

    // ── Canchas ──────────────────────────────────────────────────────────
    let venuesQuery;
    if (venueIds && venueIds.length > 0) {
      venuesQuery = db.from('lg_venues').select('*').in('id', venueIds);
    } else {
      venuesQuery = db.from('lg_venues').select('*').eq('org_id', season.org_id).eq('status', 'DISPONIBLE').order('name', { ascending: true }).limit(3);
    }
    const { data: venues, error: venuesErr } = await venuesQuery;
    if (venuesErr) {
      return createSkillResult({ success: false, errorCode: 'PREVIEW_SCHEDULE_FAILED', errorMessage: venuesErr.message });
    }
    if (!venues || venues.length === 0) {
      return createSkillResult({ success: false, errorCode: 'NO_VENUES', errorMessage: 'No hay canchas disponibles para programar esta fecha' });
    }

    // ── Parámetros de programación de la org (módulo "Parámetros") ─────
    // Nunca falla "duro": si la org no configuró lg_scheduling_settings,
    // fetchOrgSchedulingSettings devuelve los defaults de negocio.
    const orgSettings = await fetchOrgSchedulingSettings(db, season.org_id);

    const venuesConSlots = venues.map((venue) => ({ ...venue, slots: buildTimeSlots(venue, 4, orgSettings) }));

    // ── Categorías (para scheduleOrder) ─────────────────────────────────
    const categoryIds = [...new Set(tournaments.map((t) => t.category_id).filter(Boolean))];
    const { data: categories, error: categoriesErr } = categoryIds.length
      ? await db.from('lg_categories').select('id, name, schedule_order').in('id', categoryIds)
      : { data: [], error: null };
    if (categoriesErr) {
      return createSkillResult({ success: false, errorCode: 'PREVIEW_SCHEDULE_FAILED', errorMessage: categoriesErr.message });
    }
    const scheduleOrderByCategory = Object.fromEntries((categories || []).map((c) => [c.id, c.schedule_order ?? null]));

    // ── Fairness (historial de fallas de continuidad en la temporada) ──
    const clubIds = [...new Set(matches.flatMap((m) => [m.home_series?.club_id, m.away_series?.club_id]).filter(Boolean))];
    const fairnessCounts = Object.fromEntries(clubIds.map((id) => [id, 0]));
    if (clubIds.length > 0) {
      const { data: failures, error: failuresErr } = await db
        .from('lg_matchday_scheduling_failures')
        .select('club_id')
        .eq('season_id', seasonId)
        .in('club_id', clubIds);
      if (failuresErr) {
        return createSkillResult({ success: false, errorCode: 'PREVIEW_SCHEDULE_FAILED', errorMessage: failuresErr.message });
      }
      for (const row of failures || []) {
        fairnessCounts[row.club_id] = (fairnessCounts[row.club_id] ?? 0) + 1;
      }
    }

    // ── Algoritmo puro ───────────────────────────────────────────────────
    const enrichedMatches = matches
      .filter((m) => m.home_series?.club_id && m.away_series?.club_id)
      .map((m) => ({
        matchId: m.id,
        homeClubId: m.home_series.club_id,
        awayClubId: m.away_series.club_id,
        categoryId: m.tournament?.category_id ?? null,
        scheduleOrder: scheduleOrderByCategory[m.tournament?.category_id] ?? null,
      }));

    const { assignments, failedClubIds, partiallyFailedClubIds } = buildScheduleProposal({
      matches: enrichedMatches,
      venues: venuesConSlots,
      fairnessCounts,
    });

    return createSkillResult({
      success: true,
      data: {
        season, date,
        venues: venuesConSlots,
        matches,
        proposal: assignments,
        failedClubIds,
        partiallyFailedClubIds,
        fairnessCounts,
      },
    });
  }

  // ── APPLY_SCHEDULE ───────────────────────────────────────────────────────

  async _applySchedule({ seasonId, date, orgId, assignments, failedClubIds = [], partiallyFailedClubIds = [] }, db, userId) {
    if (!seasonId || !date || !Array.isArray(assignments) || assignments.length === 0) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'seasonId, date y assignments (no vacío) son requeridos' });
    }

    const updateErrors = [];
    for (const a of assignments) {
      const { error } = await db
        .from('lg_matches')
        .update({ venue_id: a.venueId, match_time: a.matchTime, time_slot: a.timeSlot ?? null, updated_at: new Date().toISOString() })
        .eq('id', a.matchId);
      if (error) updateErrors.push({ matchId: a.matchId, message: error.message });
    }

    let resolvedOrgId = orgId;
    if (!resolvedOrgId) {
      const { data: season } = await db.from('lg_seasons').select('org_id').eq('id', seasonId).maybeSingle();
      resolvedOrgId = season?.org_id ?? null;
    }

    const failureRows = [
      ...failedClubIds.map((clubId) => ({ org_id: resolvedOrgId, season_id: seasonId, club_id: clubId, match_date: date, reason: 'SPLIT_VENUE', created_by: userId ?? null })),
      ...partiallyFailedClubIds.map((clubId) => ({ org_id: resolvedOrgId, season_id: seasonId, club_id: clubId, match_date: date, reason: 'PARTIAL_CONTINUITY', created_by: userId ?? null })),
    ];
    if (failureRows.length > 0) {
      const { error: upsertErr } = await db
        .from('lg_matchday_scheduling_failures')
        .upsert(failureRows, { onConflict: 'season_id,club_id,match_date' });
      if (upsertErr) updateErrors.push({ table: 'lg_matchday_scheduling_failures', message: upsertErr.message });
    }

    if (updateErrors.length > 0) {
      return createSkillResult({
        success: false,
        errorCode: 'APPLY_SCHEDULE_PARTIAL_FAILURE',
        errorMessage: 'Algunas actualizaciones fallaron al aplicar la programación',
        errorDetails: updateErrors,
      });
    }

    return createSkillResult({ success: true, data: { applied: true, matchesUpdated: assignments.length, seasonId, date } });
  }
}
