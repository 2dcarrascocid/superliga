/**
 * Poll Results (helper compartido, sin estado ni DB)
 *
 * Cómputo de resultados de una votación (lg_polls) a partir de sus
 * alternativas (lg_poll_options) y su padrón/votos (lg_poll_votes). Lo usa
 * polls_specialist.js tanto para el listado como para el detalle.
 *
 * Reglas:
 *   - Mientras la votación está ABIERTA sólo se publica la participación
 *     (cuántos votaron / cuántos faltan) — nunca el conteo por alternativa,
 *     para no influir en los clubes que todavía no votan.
 *   - Una vez CERRADA, toda fila que siga PENDIENTE cuenta como abstención
 *     (aunque el UPDATE masivo de PENDIENTE -> ABSTENCION haya fallado o
 *     todavía no haya corrido).
 *   - is_secret: al cerrar se publica qué clubes votaron / se abstuvieron,
 *     pero no qué alternativa eligió cada uno.
 */

/** Estado efectivo de una fila del padrón, considerando el estado de la votación. */
export function effectiveVoteStatus(vote, pollStatus) {
  if (pollStatus === 'CERRADA' && vote.status === 'PENDIENTE') return 'ABSTENCION';
  return vote.status;
}

/** true si la votación sigue ABIERTA pero su plazo ya venció (debe cerrarse). */
export function isPollExpired(poll, now = new Date()) {
  return poll.status === 'ABIERTA' && new Date(poll.closes_at) <= now;
}

/**
 * Normaliza y valida la lista de alternativas que manda el admin.
 * @returns {{ options: string[] } | { error: string }}
 */
export function normalizeOptions(rawOptions) {
  if (!Array.isArray(rawOptions)) return { error: 'options debe ser una lista de alternativas' };
  const options = rawOptions.map((o) => (typeof o === 'string' ? o.trim() : '')).filter(Boolean);
  if (options.length < 2) return { error: 'La votación debe tener al menos 2 alternativas' };
  if (options.length > 20) return { error: 'La votación no puede tener más de 20 alternativas' };
  if (options.some((o) => o.length > 200)) return { error: 'Cada alternativa puede tener hasta 200 caracteres' };
  const seen = new Set(options.map((o) => o.toLowerCase()));
  if (seen.size !== options.length) return { error: 'Hay alternativas repetidas' };
  return { options };
}

/**
 * @param {Object}   poll     fila de lg_polls
 * @param {Object[]} options  filas de lg_poll_options
 * @param {Object[]} votes    filas de lg_poll_votes (con club embebido opcional)
 * @returns {{ summary, results, winners, is_tie, clubs }}
 *   results/winners son null mientras la votación está ABIERTA.
 */
export function buildPollResults(poll, options, votes) {
  const closed = poll.status === 'CERRADA';
  const sortedOptions = [...(options ?? [])].sort((a, b) => a.position - b.position);

  const countByOption = new Map(sortedOptions.map((o) => [o.id, 0]));
  let votedCount = 0;
  let abstentionCount = 0;
  let pendingCount = 0;

  for (const v of votes ?? []) {
    const status = effectiveVoteStatus(v, poll.status);
    if (status === 'VOTO') {
      votedCount += 1;
      if (countByOption.has(v.option_id)) countByOption.set(v.option_id, countByOption.get(v.option_id) + 1);
    } else if (status === 'ABSTENCION') {
      abstentionCount += 1;
    } else {
      pendingCount += 1;
    }
  }

  const electorsCount = (votes ?? []).length;
  const summary = {
    electors_count: electorsCount,
    voted_count: votedCount,
    abstention_count: abstentionCount,
    pending_count: pendingCount,
    participation_pct: electorsCount > 0 ? Math.round((votedCount / electorsCount) * 1000) / 10 : 0,
  };

  const clubs = (votes ?? []).map((v) => ({
    club_id: v.club_id,
    club: v.club ?? null,
    status: effectiveVoteStatus(v, poll.status),
    option_id: closed && !poll.is_secret ? (v.option_id ?? null) : null,
    voted_at: v.voted_at ?? null,
  }));

  if (!closed) {
    return { summary, results: null, winners: null, is_tie: false, clubs };
  }

  const results = sortedOptions.map((o) => {
    const count = countByOption.get(o.id) ?? 0;
    return {
      option_id: o.id,
      label: o.label,
      votes: count,
      pct: votedCount > 0 ? Math.round((count / votedCount) * 1000) / 10 : 0,
    };
  });

  const maxVotes = Math.max(0, ...results.map((r) => r.votes));
  const winners = maxVotes > 0 ? results.filter((r) => r.votes === maxVotes).map((r) => r.option_id) : [];

  return { summary, results, winners, is_tie: winners.length > 1, clubs };
}
