/**
 * ADF - Polls Specialist (Specialists Layer)
 *
 * Votaciones de la organización: el ADMIN de la organización crea una
 * elección (pregunta + 2 o más alternativas) abierta durante un período;
 * cada club habilitado vota una sola vez a través de su representante
 * (usuario ADMIN_CLUB del club). Al cerrar, quienes no votaron quedan como
 * abstención y los resultados se publican junto con un comentario/
 * resolución opcional del admin.
 *
 * DO:
 *   - Reutilizar lib/club_access.js (isOrgAdmin) para la autorización de admin
 *   - Congelar el padrón (lg_poll_votes) al crear la votación
 *   - Cerrar de forma perezosa (_closeIfExpired) toda votación con closes_at
 *     vencido antes de leerla o de aceptar un voto — no hay cron
 *   - Usar lib/poll_results.js para todo cómputo de resultados
 *
 * DON'T:
 *   - No publicar conteos por alternativa mientras la votación está ABIERTA
 *   - No permitir cambiar un voto ya emitido
 *   - No revelar la alternativa elegida por cada club si is_secret = true
 *
 * Capabilities:
 *   CREATE_POLL | LIST_POLLS | GET_POLL | CAST_VOTE | CLOSE_POLL |
 *   UPDATE_POLL_RESOLUTION | DELETE_POLL
 */

import { Skill } from '../contracts/skill_contract.js';
import { createSkillResult } from '../contracts/task_schema.js';
import { isOrgAdmin } from './lib/club_access.js';
import { getSeasonParticipantClubIds } from './lib/ledger.js';
import { buildPollResults, isPollExpired, normalizeOptions } from './lib/poll_results.js';

const CAPABILITIES = [
  'CREATE_POLL', 'LIST_POLLS', 'GET_POLL', 'CAST_VOTE',
  'CLOSE_POLL', 'UPDATE_POLL_RESOLUTION', 'DELETE_POLL',
];

const VOTE_SELECT = 'poll_id, club_id, option_id, status, voted_at, club:lg_clubs(id,name,short_name,logo_url)';

export class PollsSpecialist extends Skill {
  constructor() {
    super('polls_specialist', '1.0.0');
    this.domain = 'polls';
    this.capabilities = CAPABILITIES;

    this.contract = {
      input: [
        { name: 'operation', required: true, type: 'string' },
        { name: 'payload', required: true, type: 'object' },
        { name: 'db', required: true, type: 'object' },
        { name: 'userId', required: false, type: 'string' },
      ],
      output: [
        { name: 'poll', type: 'object' },
        { name: 'polls', type: 'array' },
        { name: 'vote', type: 'object' },
      ],
      rules: {
        do: [
          'CREATE_POLL/CLOSE_POLL/UPDATE_POLL_RESOLUTION/DELETE_POLL verifican isOrgAdmin',
          'CAST_VOTE verifica que el usuario sea ADMIN_CLUB (representante) del club que vota',
          'LIST_POLLS/GET_POLL exigen ser ADMIN de la org o representante de algún club de la org',
          'Cerrar perezosamente las votaciones vencidas antes de leerlas o votar',
        ],
        dont: [
          'No publicar conteos por alternativa mientras la votación está ABIERTA',
          'No permitir cambiar un voto ya emitido',
          'No revelar la alternativa de cada club si is_secret = true',
        ],
      },
      checklist: [
        'CREATE_POLL exige al menos 2 alternativas distintas y closes_at > opens_at',
        'CREATE_POLL genera una fila PENDIENTE en lg_poll_votes por cada club del padrón',
        'CAST_VOTE es idempotente: el UPDATE se condiciona a status = PENDIENTE',
        'Al cerrar, las filas PENDIENTE pasan a ABSTENCION',
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
        case 'CREATE_POLL':            return this._createPoll(payload, db, userId);
        case 'LIST_POLLS':             return this._listPolls(payload, db, userId);
        case 'GET_POLL':               return this._getPoll(payload, db, userId);
        case 'CAST_VOTE':              return this._castVote(payload, db, userId);
        case 'CLOSE_POLL':             return this._closePoll(payload, db, userId);
        case 'UPDATE_POLL_RESOLUTION': return this._updatePollResolution(payload, db, userId);
        case 'DELETE_POLL':            return this._deletePoll(payload, db, userId);
      }
    } catch (err) {
      return createSkillResult({ success: false, errorCode: 'POLLS_SPECIALIST_ERROR', errorMessage: err.message });
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Clubes de `orgId` donde `userId` es representante (ADMIN_CLUB). */
  async _representedClubIds(userId, orgId, db) {
    if (!userId || !orgId) return [];
    const { data: rows } = await db
      .from('lg_club_users')
      .select('club_id, lg_clubs!inner(org_id)')
      .eq('user_id', userId)
      .eq('role', 'ADMIN_CLUB')
      .eq('lg_clubs.org_id', orgId);
    return (rows ?? []).map((r) => r.club_id);
  }

  /** Quién mira: { isAdmin, clubIds } o null si no tiene acceso a las votaciones de la org. */
  async _resolveViewer(userId, orgId, db) {
    const [isAdmin, clubIds] = await Promise.all([
      isOrgAdmin(userId, orgId, db),
      this._representedClubIds(userId, orgId, db),
    ]);
    if (!isAdmin && clubIds.length === 0) return null;
    return { isAdmin, clubIds };
  }

  /** Clubes que votan: participantes de la temporada, o todos los clubes activos de la org. */
  async _electorateClubIds(orgId, seasonId, db) {
    if (seasonId) return getSeasonParticipantClubIds(seasonId, db);
    const { data: clubs } = await db.from('lg_clubs').select('id').eq('org_id', orgId).eq('active', true);
    return (clubs ?? []).map((c) => c.id);
  }

  /**
   * Marca la votación como CERRADA y pasa el padrón PENDIENTE a ABSTENCION.
   * El UPDATE de lg_polls va condicionado a status = ABIERTA para que dos
   * cierres concurrentes (perezoso + manual) no se pisen.
   */
  async _finalizePoll(poll, { closedBy, closedAt, resolution }, db) {
    const patch = {
      status: 'CERRADA',
      closed_by: closedBy ?? null,
      closed_at: closedAt,
      updated_at: new Date().toISOString(),
    };
    if (resolution !== undefined) patch.resolution = resolution;

    const { data: closed, error } = await db
      .from('lg_polls')
      .update(patch)
      .eq('id', poll.id)
      .eq('status', 'ABIERTA')
      .select()
      .maybeSingle();
    if (error) return { error };

    // Las filas que sigan PENDIENTE se cuentan como abstención igual
    // (buildPollResults), así que un fallo acá no corrompe los resultados.
    await db
      .from('lg_poll_votes')
      .update({ status: 'ABSTENCION', updated_at: new Date().toISOString() })
      .eq('poll_id', poll.id)
      .eq('status', 'PENDIENTE');

    if (closed) return { poll: closed };
    // Otro request la cerró primero: devolver el estado real.
    const { data: current } = await db.from('lg_polls').select('*').eq('id', poll.id).maybeSingle();
    return { poll: current ?? { ...poll, ...patch } };
  }

  async _closeIfExpired(poll, db) {
    if (!isPollExpired(poll)) return poll;
    const { poll: closed } = await this._finalizePoll(poll, { closedBy: null, closedAt: poll.closes_at }, db);
    return closed ?? poll;
  }

  _decoratePoll(poll, options, votes, viewer) {
    const computed = buildPollResults(poll, options, votes);
    const myVotes = (votes ?? [])
      .filter((v) => viewer.clubIds.includes(v.club_id))
      .map((v) => ({
        club_id: v.club_id,
        club: v.club ?? null,
        status: computed.clubs.find((c) => c.club_id === v.club_id)?.status ?? v.status,
        option_id: v.option_id ?? null, // el propio club siempre ve su voto, aunque sea secreta
        voted_at: v.voted_at ?? null,
      }));

    return {
      ...poll,
      options: [...(options ?? [])].sort((a, b) => a.position - b.position),
      ...computed,
      my_votes: myVotes,
    };
  }

  // ── Operaciones ──────────────────────────────────────────────────────────

  async _createPoll({ orgId, seasonId, title, description, options, opensAt, closesAt, isSecret }, db, userId) {
    if (!orgId || !title || !closesAt) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'orgId, title y closesAt son requeridos' });
    }
    const normalized = normalizeOptions(options);
    if (normalized.error) {
      return createSkillResult({ success: false, errorCode: 'INVALID_OPTIONS', errorMessage: normalized.error });
    }

    const now = new Date();
    const opens = opensAt ? new Date(opensAt) : now;
    const closes = new Date(closesAt);
    if (Number.isNaN(opens.getTime()) || Number.isNaN(closes.getTime())) {
      return createSkillResult({ success: false, errorCode: 'INVALID_PERIOD', errorMessage: 'Las fechas de apertura/cierre no son válidas' });
    }
    if (closes <= opens) {
      return createSkillResult({ success: false, errorCode: 'INVALID_PERIOD', errorMessage: 'La fecha de cierre debe ser posterior a la de apertura' });
    }
    if (closes <= now) {
      return createSkillResult({ success: false, errorCode: 'INVALID_PERIOD', errorMessage: 'La fecha de cierre debe ser futura' });
    }

    if (!(await isOrgAdmin(userId, orgId, db))) {
      return createSkillResult({ success: false, errorCode: 'FORBIDDEN', errorMessage: 'Solo el administrador de la organización puede crear votaciones' });
    }

    const clubIds = await this._electorateClubIds(orgId, seasonId, db);
    if (clubIds.length === 0) {
      return createSkillResult({
        success: false,
        errorCode: 'NO_ELECTORS',
        errorMessage: seasonId ? 'La temporada no tiene clubes participantes que puedan votar' : 'La organización no tiene clubes activos que puedan votar',
      });
    }

    const { data: poll, error } = await db
      .from('lg_polls')
      .insert({
        org_id: orgId,
        season_id: seasonId ?? null,
        title,
        description: description ?? null,
        opens_at: opens.toISOString(),
        closes_at: closes.toISOString(),
        is_secret: !!isSecret,
        created_by: userId ?? null,
      })
      .select()
      .single();
    if (error) {
      return createSkillResult({ success: false, errorCode: 'CREATE_POLL_FAILED', errorMessage: error.message });
    }

    const { data: optionRows, error: optionsError } = await db
      .from('lg_poll_options')
      .insert(normalized.options.map((label, i) => ({ poll_id: poll.id, label, position: i })))
      .select();
    const { error: votesError } = optionsError
      ? { error: null }
      : await db.from('lg_poll_votes').insert(clubIds.map((clubId) => ({ poll_id: poll.id, club_id: clubId })));

    if (optionsError || votesError) {
      // Sin transacciones en supabase-js: deshacer la votación a medio crear
      // (ON DELETE CASCADE limpia opciones/padrón).
      await db.from('lg_polls').delete().eq('id', poll.id);
      return createSkillResult({ success: false, errorCode: 'CREATE_POLL_FAILED', errorMessage: (optionsError ?? votesError).message });
    }

    return createSkillResult({
      success: true,
      data: { poll: { ...poll, options: optionRows ?? [], electors_count: clubIds.length } },
    });
  }

  async _listPolls({ orgId, status }, db, userId) {
    if (!orgId) {
      return createSkillResult({ success: false, errorCode: 'MISSING_ORG', errorMessage: 'orgId es requerido' });
    }
    const viewer = await this._resolveViewer(userId, orgId, db);
    if (!viewer) {
      return createSkillResult({ success: false, errorCode: 'FORBIDDEN', errorMessage: 'No tienes acceso a las votaciones de esta organización' });
    }

    const { data: rawPolls, error } = await db
      .from('lg_polls')
      .select('*')
      .eq('org_id', orgId)
      .order('closes_at', { ascending: false });
    if (error) {
      return createSkillResult({ success: false, errorCode: 'LIST_POLLS_FAILED', errorMessage: error.message });
    }

    const polls = [];
    for (const p of rawPolls ?? []) polls.push(await this._closeIfExpired(p, db));
    const filtered = status ? polls.filter((p) => p.status === status) : polls;

    const pollIds = filtered.map((p) => p.id);
    if (pollIds.length === 0) {
      return createSkillResult({ success: true, data: { polls: [] } });
    }

    const [{ data: options, error: optionsError }, { data: votes, error: votesError }] = await Promise.all([
      db.from('lg_poll_options').select('*').in('poll_id', pollIds),
      db.from('lg_poll_votes').select(VOTE_SELECT).in('poll_id', pollIds),
    ]);
    if (optionsError || votesError) {
      return createSkillResult({ success: false, errorCode: 'LIST_POLLS_FAILED', errorMessage: (optionsError ?? votesError).message });
    }

    const decorated = filtered.map((p) => {
      const { clubs, ...rest } = this._decoratePoll(
        p,
        (options ?? []).filter((o) => o.poll_id === p.id),
        (votes ?? []).filter((v) => v.poll_id === p.id),
        viewer,
      );
      return rest; // el detalle por club va sólo en GET_POLL
    });

    return createSkillResult({ success: true, data: { polls: decorated } });
  }

  async _getPoll({ pollId }, db, userId) {
    const { data: found } = await db.from('lg_polls').select('*').eq('id', pollId).maybeSingle();
    if (!found) {
      return createSkillResult({ success: false, errorCode: 'POLL_NOT_FOUND', errorMessage: 'Votación no encontrada' });
    }
    const viewer = await this._resolveViewer(userId, found.org_id, db);
    if (!viewer) {
      return createSkillResult({ success: false, errorCode: 'FORBIDDEN', errorMessage: 'No tienes acceso a esta votación' });
    }

    const poll = await this._closeIfExpired(found, db);
    const [{ data: options, error: optionsError }, { data: votes, error: votesError }] = await Promise.all([
      db.from('lg_poll_options').select('*').eq('poll_id', pollId),
      db.from('lg_poll_votes').select(VOTE_SELECT).eq('poll_id', pollId),
    ]);
    if (optionsError || votesError) {
      return createSkillResult({ success: false, errorCode: 'GET_POLL_FAILED', errorMessage: (optionsError ?? votesError).message });
    }

    const decorated = this._decoratePoll(poll, options, votes, viewer);
    decorated.clubs.sort((a, b) => (a.club?.name ?? '').localeCompare(b.club?.name ?? ''));
    return createSkillResult({ success: true, data: { poll: decorated } });
  }

  async _castVote({ pollId, clubId, optionId }, db, userId) {
    if (!pollId || !clubId || !optionId) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'pollId, clubId y optionId son requeridos' });
    }

    const { data: found } = await db.from('lg_polls').select('*').eq('id', pollId).maybeSingle();
    if (!found) {
      return createSkillResult({ success: false, errorCode: 'POLL_NOT_FOUND', errorMessage: 'Votación no encontrada' });
    }
    const poll = await this._closeIfExpired(found, db);
    if (poll.status === 'CERRADA') {
      return createSkillResult({ success: false, errorCode: 'POLL_CLOSED', errorMessage: 'La votación ya está cerrada' });
    }
    if (new Date(poll.opens_at) > new Date()) {
      return createSkillResult({ success: false, errorCode: 'POLL_NOT_OPEN', errorMessage: 'La votación todavía no está abierta' });
    }

    const { data: rep } = await db
      .from('lg_club_users').select('role')
      .eq('user_id', userId).eq('club_id', clubId).eq('role', 'ADMIN_CLUB')
      .maybeSingle();
    if (!rep) {
      return createSkillResult({ success: false, errorCode: 'FORBIDDEN', errorMessage: 'Solo el representante del club puede votar en su nombre' });
    }

    const { data: option } = await db
      .from('lg_poll_options').select('id')
      .eq('id', optionId).eq('poll_id', pollId)
      .maybeSingle();
    if (!option) {
      return createSkillResult({ success: false, errorCode: 'INVALID_OPTION', errorMessage: 'La alternativa no pertenece a esta votación' });
    }

    const { data: ballot } = await db
      .from('lg_poll_votes').select('status')
      .eq('poll_id', pollId).eq('club_id', clubId)
      .maybeSingle();
    if (!ballot) {
      return createSkillResult({ success: false, errorCode: 'NOT_ELIGIBLE', errorMessage: 'El club no está habilitado para votar en esta elección' });
    }
    if (ballot.status !== 'PENDIENTE') {
      return createSkillResult({ success: false, errorCode: 'ALREADY_VOTED', errorMessage: 'El club ya emitió su voto' });
    }

    const now = new Date().toISOString();
    const { data: vote, error } = await db
      .from('lg_poll_votes')
      .update({ status: 'VOTO', option_id: optionId, voted_by: userId, voted_at: now, updated_at: now })
      .eq('poll_id', pollId)
      .eq('club_id', clubId)
      .eq('status', 'PENDIENTE')
      .select(VOTE_SELECT)
      .maybeSingle();
    if (error) {
      return createSkillResult({ success: false, errorCode: 'CAST_VOTE_FAILED', errorMessage: error.message });
    }
    if (!vote) {
      return createSkillResult({ success: false, errorCode: 'ALREADY_VOTED', errorMessage: 'El club ya emitió su voto' });
    }

    return createSkillResult({ success: true, data: { vote } });
  }

  async _closePoll({ pollId, resolution }, db, userId) {
    const { data: found } = await db.from('lg_polls').select('*').eq('id', pollId).maybeSingle();
    if (!found) {
      return createSkillResult({ success: false, errorCode: 'POLL_NOT_FOUND', errorMessage: 'Votación no encontrada' });
    }
    if (!(await isOrgAdmin(userId, found.org_id, db))) {
      return createSkillResult({ success: false, errorCode: 'FORBIDDEN', errorMessage: 'Solo el administrador de la organización puede cerrar votaciones' });
    }
    if (found.status === 'CERRADA') {
      return createSkillResult({ success: false, errorCode: 'POLL_ALREADY_CLOSED', errorMessage: 'La votación ya está cerrada' });
    }

    // Si el plazo ya venció, la fecha de cierre oficial es closes_at (no
    // "ahora"); si el admin cierra antes de plazo, es un cierre anticipado.
    const closedAt = isPollExpired(found) ? found.closes_at : new Date().toISOString();
    const { poll, error } = await this._finalizePoll(
      found,
      { closedBy: userId, closedAt, resolution: resolution?.trim() || null },
      db,
    );
    if (error) {
      return createSkillResult({ success: false, errorCode: 'CLOSE_POLL_FAILED', errorMessage: error.message });
    }
    return createSkillResult({ success: true, data: { poll } });
  }

  async _updatePollResolution({ pollId, resolution }, db, userId) {
    const { data: found } = await db.from('lg_polls').select('*').eq('id', pollId).maybeSingle();
    if (!found) {
      return createSkillResult({ success: false, errorCode: 'POLL_NOT_FOUND', errorMessage: 'Votación no encontrada' });
    }
    if (!(await isOrgAdmin(userId, found.org_id, db))) {
      return createSkillResult({ success: false, errorCode: 'FORBIDDEN', errorMessage: 'Solo el administrador de la organización puede registrar la resolución' });
    }
    const poll = await this._closeIfExpired(found, db);
    if (poll.status !== 'CERRADA') {
      return createSkillResult({ success: false, errorCode: 'POLL_NOT_CLOSED', errorMessage: 'La resolución se registra una vez cerrada la votación' });
    }

    const { data: updated, error } = await db
      .from('lg_polls')
      .update({ resolution: resolution?.trim() || null, updated_at: new Date().toISOString() })
      .eq('id', pollId)
      .select()
      .single();
    if (error) {
      return createSkillResult({ success: false, errorCode: 'UPDATE_POLL_RESOLUTION_FAILED', errorMessage: error.message });
    }
    return createSkillResult({ success: true, data: { poll: updated } });
  }

  async _deletePoll({ pollId }, db, userId) {
    const { data: found } = await db.from('lg_polls').select('*').eq('id', pollId).maybeSingle();
    if (!found) {
      return createSkillResult({ success: false, errorCode: 'POLL_NOT_FOUND', errorMessage: 'Votación no encontrada' });
    }
    if (!(await isOrgAdmin(userId, found.org_id, db))) {
      return createSkillResult({ success: false, errorCode: 'FORBIDDEN', errorMessage: 'Solo el administrador de la organización puede eliminar votaciones' });
    }
    if (found.status === 'CERRADA') {
      return createSkillResult({ success: false, errorCode: 'POLL_CLOSED', errorMessage: 'Una votación cerrada queda publicada y no se puede eliminar' });
    }

    const { data: cast } = await db
      .from('lg_poll_votes').select('id')
      .eq('poll_id', pollId).eq('status', 'VOTO')
      .limit(1);
    if ((cast ?? []).length > 0) {
      return createSkillResult({ success: false, errorCode: 'POLL_HAS_VOTES', errorMessage: 'La votación ya tiene votos emitidos; ciérrela en vez de eliminarla' });
    }

    const { error } = await db.from('lg_polls').delete().eq('id', pollId);
    if (error) {
      return createSkillResult({ success: false, errorCode: 'DELETE_POLL_FAILED', errorMessage: error.message });
    }
    return createSkillResult({ success: true, data: { deleted: true, pollId } });
  }
}
