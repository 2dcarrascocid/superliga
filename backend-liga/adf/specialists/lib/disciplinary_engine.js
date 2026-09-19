/**
 * ADF - Disciplinary Engine (lib)
 *
 * Motor de cálculo de sanciones automáticas del Tribunal de Disciplina.
 * Puro y sin acceso a base de datos (recibe los datos ya leídos y
 * devuelve decisiones) — lo que lo hace testeable y reusable desde
 * disciplinary_specialist.js sin acoplarse a Supabase.
 *
 * Polimorfismo por deporte: SPORT_ACCUMULATION_RULES define, por slug
 * de deporte (y opcionalmente por variante), cómo se acumulan las
 * tarjetas/faltas y qué sanción disparan. Un `lg_disciplinary_infraction`
 * con auto_trigger + auto_rule puede sobreescribir estos defaults sin
 * tocar código (auto_rule tiene la misma forma que las reglas de acá).
 *
 * DO:
 *   - Mantener este módulo puro (sin fetch a Supabase)
 *   - Todo umbral/regla nueva por deporte se agrega a SPORT_ACCUMULATION_RULES
 * DON'T:
 *   - No leer/escribir la base acá — eso vive en disciplinary_specialist.js
 */

// ── Reglas de acumulación por deporte (defaults) ────────────────────────────
//
// Cada regla describe, para un tipo de evento de partido (lg_match_events.
// event_type), el umbral de acumulación dentro del torneo y la sanción que
// dispara. `resetOnSuspension: true` reinicia el contador del jugador tras
// cumplir la suspensión (típico de amarillas acumuladas).

export const SPORT_ACCUMULATION_RULES = {
  FUTBOL: {
    YELLOW_CARD: { threshold: 3, sanctionKind: 'MATCHES_SUSPENSION', quantity: 1, resetOnSuspension: true },
    RED_CARD: { direct: true, sanctionKind: 'MATCHES_SUSPENSION', quantity: 1 }, // mínimo — el artículo puede pedir más
    variants: {
      F7: { YELLOW_CARD: { threshold: 3, sanctionKind: 'MATCHES_SUSPENSION', quantity: 1, resetOnSuspension: true } },
      FUTSAL: { YELLOW_CARD: { threshold: 3, sanctionKind: 'MATCHES_SUSPENSION', quantity: 1, resetOnSuspension: true } },
      PLAYA: { YELLOW_CARD: { threshold: 2, sanctionKind: 'MATCHES_SUSPENSION', quantity: 1, resetOnSuspension: true } },
    },
  },
  BASQUETBOL: {
    // Descalificación por 2 faltas técnicas/antideportivas en el mismo partido
    // (evento puntual, no acumulado en el torneo).
    TECHNICAL_FOUL: { perMatchThreshold: 2, sanctionKind: 'DISQUALIFICATION', quantity: 1 },
    // Acumulación de técnicas en el torneo (informe del juez/planilla).
    ACCUMULATED_TECHNICAL: { threshold: 5, sanctionKind: 'MATCHES_SUSPENSION', quantity: 1, resetOnSuspension: true },
  },
  VOLEIBOL: {
    // Tarjeta roja: pérdida de punto/saque — no genera suspensión por sí sola.
    RED_CARD: { direct: false, sanctionKind: null },
    // Roja + amarilla juntas (misma jugada): expulsión del set o del partido,
    // según lo tipifique el artículo (informe de conducta decide cuál).
    RED_YELLOW_TOGETHER: { direct: true, sanctionKind: 'MATCHES_SUSPENSION', quantity: 1 },
  },
};

/** Resuelve la regla de acumulación efectiva para un deporte/variante/evento. */
export function resolveAccumulationRule(sportSlug, variant, eventType) {
  const sportRules = SPORT_ACCUMULATION_RULES[sportSlug?.toUpperCase()];
  if (!sportRules) return null;
  const variantRules = variant ? sportRules.variants?.[variant.toUpperCase()] : null;
  return variantRules?.[eventType] ?? sportRules[eventType] ?? null;
}

/**
 * Evalúa si un conteo de eventos (tarjetas) de un jugador/ente en el
 * torneo dispara una sanción automática.
 *
 * @param {object} params
 * @param {string} params.sportSlug         Slug del deporte (lg_sports.name normalizado o código)
 * @param {string|null} params.variant       Variante (F7, FUTSAL, PLAYA...) o null
 * @param {string} params.eventType          Tipo de evento acumulado (YELLOW_CARD, RED_CARD, ...)
 * @param {number} params.count              Cantidad acumulada del ente en el torneo (incluyendo el evento recién agregado)
 * @param {object|null} params.infractionAutoRule  auto_rule de un lg_disciplinary_infraction que sobreescribe el default
 * @returns {{ triggers: boolean, sanctionKind: string|null, quantity: number, resetOnSuspension: boolean }}
 */
export function evaluateCardAccumulation({ sportSlug, variant, eventType, count, infractionAutoRule = null }) {
  const rule = infractionAutoRule ?? resolveAccumulationRule(sportSlug, variant, eventType);
  if (!rule) return { triggers: false, sanctionKind: null, quantity: 0, resetOnSuspension: false };

  // Evento directo (roja, roja+amarilla en vóleibol): dispara siempre que ocurra.
  if (rule.direct) {
    return {
      triggers: !!rule.sanctionKind,
      sanctionKind: rule.sanctionKind ?? null,
      quantity: rule.quantity ?? 0,
      resetOnSuspension: !!rule.resetOnSuspension,
    };
  }

  // Acumulación por umbral: dispara sólo cuando el conteo es múltiplo exacto
  // del umbral (evita re-disparar en cada tarjeta subsiguiente si el umbral
  // no se reseteó todavía, y permite que "cada 3 amarillas" siga sumando).
  const threshold = rule.threshold ?? rule.perMatchThreshold;
  if (!threshold) return { triggers: false, sanctionKind: null, quantity: 0, resetOnSuspension: false };

  const triggers = count > 0 && count % threshold === 0;
  return {
    triggers,
    sanctionKind: triggers ? rule.sanctionKind : null,
    quantity: triggers ? (rule.quantity ?? 0) : 0,
    resetOnSuspension: !!rule.resetOnSuspension,
  };
}

/**
 * Determina si un partido cuenta como "oficial y válido" para efectos de
 * descontar una fecha de suspensión. Regla de negocio transversal: sólo
 * cuenta un partido FINISHED del calendario del torneo — no cuenta un
 * partido suspendido/pospuesto/cancelado, ni un WALKOVER (no se jugó).
 */
export function isMatchdayCountable(match) {
  return match?.status === 'FINISHED';
}

/**
 * Calcula el nuevo estado de una resolución de tipo MATCHES_SUSPENSION tras
 * descontar una fecha.
 */
export function decrementMatchesSuspension(resolution) {
  const remaining = Math.max((resolution.matches_remaining ?? resolution.quantity) - 1, 0);
  return {
    matches_remaining: remaining,
    status_cumplimiento: remaining === 0 ? 'COMPLETED' : 'IN_FULFILLMENT',
  };
}

/** Calcula la fecha de término de una suspensión por días, desde start_date. */
export function computeDaysSuspensionEndDate(startDate, days) {
  const start = startDate ? new Date(startDate) : new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + Number(days || 0));
  return end.toISOString().slice(0, 10);
}
