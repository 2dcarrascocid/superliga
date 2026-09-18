/**
 * ADF - Scheduling Settings Specialist (Specialists Layer)
 *
 * Módulo "Parámetros" de la Programación de Fecha: expone y permite editar,
 * por organización, los valores que alimentan el algoritmo de asignación
 * automática de cancha/horario (ver match_scheduling_specialist.js) — hoy
 * hardcodeados ahí como DEFAULT_START_TIME/REAL_BLOCK_MINUTES.
 *
 * DO:
 *   - Operar sobre lg_scheduling_settings (una fila por org_id, UNIQUE)
 *   - Devolver siempre matchDurationMinutes/blockDurationMinutes CALCULADOS
 *     en código a partir de half_duration_minutes/halftime_break_minutes/
 *     turnaround_minutes — nunca leídos de una columna, la tabla no los
 *     persiste
 *   - Si no existe fila para la org (GET), devolver los defaults de negocio
 *     actuales (30/5/5/'14:00:00') sin crearla — para no romper orgs que
 *     nunca configuraron nada
 *
 * DON'T:
 *   - No crear la fila en el GET (solo lectura con fallback en memoria)
 *   - No lanzar excepciones no controladas
 *
 * Capabilities:
 *   GET_SCHEDULING_SETTINGS | UPDATE_SCHEDULING_SETTINGS
 *
 * Checklist:
 *   [ ] ¿GET devuelve defaults cuando no hay fila, sin crearla?
 *   [ ] ¿UPDATE valida orgId y los tres minutos antes de tocar la DB?
 *   [ ] ¿UPDATE hace upsert con onConflict: 'org_id' preservando lo existente?
 */

import { Skill } from '../contracts/skill_contract.js';
import { createSkillResult } from '../contracts/task_schema.js';
import {
  toSchedulingSettingsDTO,
  DEFAULT_HALF_DURATION_MINUTES,
  DEFAULT_HALFTIME_BREAK_MINUTES,
  DEFAULT_TURNAROUND_MINUTES,
  DEFAULT_START_TIME,
} from './lib/scheduling_settings.js';

const CAPABILITIES = ['GET_SCHEDULING_SETTINGS', 'UPDATE_SCHEDULING_SETTINGS'];

export class SchedulingSettingsSpecialist extends Skill {
  constructor() {
    super('scheduling_settings_specialist', '1.0.0');
    this.domain = 'scheduling_settings';
    this.capabilities = CAPABILITIES;

    this.contract = {
      input: [
        { name: 'operation', required: true, type: 'string' },
        { name: 'payload', required: true, type: 'object' },
        { name: 'db', required: true, type: 'object' },
        { name: 'userId', required: false, type: 'string' },
      ],
      output: [
        { name: 'settings', type: 'object' },
      ],
      rules: {
        do: [
          'Devolver matchDurationMinutes/blockDurationMinutes siempre calculados en código',
          'GET devuelve defaults de negocio (30/5/5/14:00:00) si la org no tiene fila configurada',
          'UPDATE hace upsert sobre lg_scheduling_settings con onConflict: org_id, preservando campos no provistos',
        ],
        dont: [
          'No crear una fila en la DB desde GET_SCHEDULING_SETTINGS',
          'No persistir matchDurationMinutes/blockDurationMinutes como columnas',
        ],
      },
      checklist: [
        'GET_SCHEDULING_SETTINGS no escribe nada en la base de datos',
        'UPDATE_SCHEDULING_SETTINGS valida orgId y los minutos antes del upsert',
        'UPDATE_SCHEDULING_SETTINGS mergea con la fila existente antes de escribir',
      ],
    };
  }

  async execute(task) {
    const { operation, payload, db } = task.input;

    if (!this.capabilities.includes(operation)) {
      return createSkillResult({
        success: false,
        errorCode: 'UNKNOWN_OPERATION',
        errorMessage: `Operación desconocida: "${operation}"`,
      });
    }

    try {
      switch (operation) {
        case 'GET_SCHEDULING_SETTINGS': return this._getSchedulingSettings(payload, db);
        case 'UPDATE_SCHEDULING_SETTINGS': return this._updateSchedulingSettings(payload, db);
      }
    } catch (err) {
      return createSkillResult({
        success: false,
        errorCode: 'SCHEDULING_SETTINGS_SPECIALIST_ERROR',
        errorMessage: err.message,
      });
    }
  }

  async _getSchedulingSettings({ orgId }, db) {
    if (!orgId) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'orgId es requerido' });
    }

    const { data: row, error } = await db
      .from('lg_scheduling_settings')
      .select('*')
      .eq('org_id', orgId)
      .maybeSingle();

    if (error) {
      return createSkillResult({ success: false, errorCode: 'GET_SCHEDULING_SETTINGS_FAILED', errorMessage: error.message });
    }

    return createSkillResult({ success: true, data: { settings: toSchedulingSettingsDTO(row, orgId) } });
  }

  async _updateSchedulingSettings({ orgId, halfDurationMinutes, halftimeBreakMinutes, turnaroundMinutes, defaultStartTime }, db) {
    if (!orgId) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'orgId es requerido' });
    }

    const isInvalidMinutes = (value, { allowZero }) => {
      if (value === undefined || value === null) return false;
      if (!Number.isInteger(value)) return true;
      return allowZero ? value < 0 : value <= 0;
    };

    if (
      isInvalidMinutes(halfDurationMinutes, { allowZero: false }) ||
      isInvalidMinutes(halftimeBreakMinutes, { allowZero: true }) ||
      isInvalidMinutes(turnaroundMinutes, { allowZero: true })
    ) {
      return createSkillResult({
        success: false,
        errorCode: 'INVALID_FIELDS',
        errorMessage: 'halfDurationMinutes debe ser un entero > 0; halftimeBreakMinutes y turnaroundMinutes deben ser enteros >= 0',
      });
    }

    const { data: existing, error: fetchErr } = await db
      .from('lg_scheduling_settings')
      .select('*')
      .eq('org_id', orgId)
      .maybeSingle();

    if (fetchErr) {
      return createSkillResult({ success: false, errorCode: 'UPDATE_SCHEDULING_SETTINGS_FAILED', errorMessage: fetchErr.message });
    }

    const merged = {
      org_id: orgId,
      half_duration_minutes: halfDurationMinutes ?? existing?.half_duration_minutes ?? DEFAULT_HALF_DURATION_MINUTES,
      halftime_break_minutes: halftimeBreakMinutes ?? existing?.halftime_break_minutes ?? DEFAULT_HALFTIME_BREAK_MINUTES,
      turnaround_minutes: turnaroundMinutes ?? existing?.turnaround_minutes ?? DEFAULT_TURNAROUND_MINUTES,
      default_start_time: defaultStartTime ?? existing?.default_start_time ?? DEFAULT_START_TIME,
      updated_at: new Date().toISOString(),
    };

    const { data: row, error } = await db
      .from('lg_scheduling_settings')
      .upsert(merged, { onConflict: 'org_id' })
      .select('*')
      .single();

    if (error) {
      return createSkillResult({ success: false, errorCode: 'UPDATE_SCHEDULING_SETTINGS_FAILED', errorMessage: error.message });
    }

    return createSkillResult({ success: true, data: { settings: toSchedulingSettingsDTO(row, orgId) } });
  }
}
