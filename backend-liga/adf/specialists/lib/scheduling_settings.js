/**
 * Helper compartido — Parámetros de Programación de Fecha
 * (lg_scheduling_settings, una fila por organización).
 *
 * Usado por:
 *   - scheduling_settings_specialist.js (GET/UPDATE del módulo "Parámetros")
 *   - match_scheduling_specialist.js (resuelve los parámetros de la org
 *     antes de llamar a buildTimeSlots(), sin depender del specialist de
 *     Parámetros para evitar un import circular entre specialists)
 *
 * Los campos calculados (matchDurationMinutes/blockDurationMinutes) NUNCA
 * se leen de una columna — se derivan siempre acá a partir de
 * half_duration_minutes/halftime_break_minutes/turnaround_minutes.
 */

// Defaults de negocio — mismos valores que estaban hardcodeados como
// DEFAULT_START_TIME/REAL_BLOCK_MINUTES en match_scheduling_specialist.js
// antes de que existiera lg_scheduling_settings. Se usan para orgs que
// todavía no configuraron una fila propia.
export const DEFAULT_HALF_DURATION_MINUTES = 30;
export const DEFAULT_HALFTIME_BREAK_MINUTES = 5;
export const DEFAULT_TURNAROUND_MINUTES = 5;
export const DEFAULT_START_TIME = '14:00:00';

/**
 * Arma el DTO camelCase (+ campos calculados) a partir de una fila de
 * lg_scheduling_settings (snake_case) o `null` si la org no tiene fila.
 *
 * @param {object|null} row
 * @param {string} orgId
 * @returns {{ orgId: string, halfDurationMinutes: number, halftimeBreakMinutes: number, turnaroundMinutes: number, defaultStartTime: string, matchDurationMinutes: number, blockDurationMinutes: number }}
 */
export function toSchedulingSettingsDTO(row, orgId) {
  const halfDurationMinutes = row?.half_duration_minutes ?? DEFAULT_HALF_DURATION_MINUTES;
  const halftimeBreakMinutes = row?.halftime_break_minutes ?? DEFAULT_HALFTIME_BREAK_MINUTES;
  const turnaroundMinutes = row?.turnaround_minutes ?? DEFAULT_TURNAROUND_MINUTES;
  const defaultStartTime = row?.default_start_time ?? DEFAULT_START_TIME;

  const matchDurationMinutes = halfDurationMinutes * 2 + halftimeBreakMinutes;
  const blockDurationMinutes = matchDurationMinutes + turnaroundMinutes;

  return {
    orgId,
    halfDurationMinutes,
    halftimeBreakMinutes,
    turnaroundMinutes,
    defaultStartTime,
    matchDurationMinutes,
    blockDurationMinutes,
  };
}

/**
 * Busca la fila de lg_scheduling_settings de una org y devuelve el DTO
 * calculado. Nunca falla "duro": si hay error de DB o no hay fila,
 * devuelve el DTO de defaults (mismo criterio que el GET del specialist
 * de Parámetros) para no romper la Programación de Fecha de orgs que no
 * configuraron nada.
 *
 * @param {object} db Cliente supabase-js (o mock)
 * @param {string} orgId
 * @returns {Promise<ReturnType<typeof toSchedulingSettingsDTO>>}
 */
export async function fetchOrgSchedulingSettings(db, orgId) {
  if (!orgId) return toSchedulingSettingsDTO(null, orgId);

  const { data: row } = await db
    .from('lg_scheduling_settings')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle();

  return toSchedulingSettingsDTO(row ?? null, orgId);
}
