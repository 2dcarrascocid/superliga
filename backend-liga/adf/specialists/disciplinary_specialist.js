/**
 * ADF - Disciplinary Specialist (Specialists Layer)
 *
 * Tribunal de Disciplina / Código de Faltas — módulo transversal y
 * polimórfico: reglamento (artículos), catálogo de faltas tipificadas,
 * expedientes disciplinarios y resoluciones de sanción, sobre 4 tipos
 * de ente: CLUB | TEAM (lg_club_series) | PLAYER | COACH (lg_team_staff).
 *
 * DO:
 *   - Resolver club_id del sancionado al crear un caso (queda denormalizado
 *     en lg_disciplinary_cases.club_id y lg_sanction_resolutions.club_id
 *     para poder filtrar por club sin importar el tipo de ente)
 *   - Usar disciplinary_engine.js para toda decisión de acumulación/cómputo
 *     de sanción — no reimplementar reglas de negocio acá
 *   - Sólo descontar una fecha de suspensión ante un partido FINISHED
 *   - Reportar TODOS los datos de paginación (next_token, total_registros)
 *
 * DON'T:
 *   - No modificar lg_matches/lg_match_events — eso es de "matches"
 *   - No crear ni administrar torneos/fixture — eso es de "tournaments"
 *   - No decidir habilitación de nómina en la planilla — eso lo resuelve
 *     el frontend consumiendo CHECK_ELIGIBILITY / LIST_SANCTIONED
 *
 * Capabilities:
 *   Reglamento:    LIST_ARTICLES | CREATE_ARTICLE | UPDATE_ARTICLE | DELETE_ARTICLE
 *   Catálogo:      LIST_INFRACTIONS | CREATE_INFRACTION | UPDATE_INFRACTION | DELETE_INFRACTION
 *   Cuerpo técnico:LIST_TEAM_STAFF | CREATE_TEAM_STAFF | UPDATE_TEAM_STAFF | DELETE_TEAM_STAFF
 *   Expedientes:   LIST_CASES | GET_CASE | CREATE_CASE | UPDATE_CASE_STATUS
 *   Resoluciones:  CREATE_RESOLUTION | LIST_RESOLUTIONS | UPDATE_RESOLUTION_STATUS
 *   Consulta:      LIST_SANCTIONED | CHECK_ELIGIBILITY
 *   Motor:         EVALUATE_CARD_ACCUMULATION | PROCESS_MATCHDAY_FULFILLMENT
 */

import { Skill } from '../contracts/skill_contract.js';
import { createSkillResult } from '../contracts/task_schema.js';
import { encodeNext, decodeNext } from '../../utils/pagination.js';
import { toSportSlug } from './lib/org_sport.js';
import {
  evaluateCardAccumulation,
  isMatchdayCountable,
  decrementMatchesSuspension,
  computeDaysSuspensionEndDate,
} from './lib/disciplinary_engine.js';

// Tipos de sanción que quedan "vigentes" hasta que alguien las cierre
// manualmente o el motor de cumplimiento las vaya descontando — arrancan
// PENDING. El resto (multas, quita de puntos, W.O.) se da por aplicado en
// el momento mismo de resolverse, sin seguimiento posterior.
const ONGOING_SANCTION_KINDS = ['MATCHES_SUSPENSION', 'DAYS_SUSPENSION', 'LOCALIA_SUSPENSION', 'DISQUALIFICATION', 'EXPULSION'];

const CAPABILITIES = [
  'LIST_ARTICLES', 'CREATE_ARTICLE', 'UPDATE_ARTICLE', 'DELETE_ARTICLE',
  'LIST_INFRACTIONS', 'CREATE_INFRACTION', 'UPDATE_INFRACTION', 'DELETE_INFRACTION',
  'LIST_TEAM_STAFF', 'CREATE_TEAM_STAFF', 'UPDATE_TEAM_STAFF', 'DELETE_TEAM_STAFF',
  'LIST_CASES', 'GET_CASE', 'CREATE_CASE', 'UPDATE_CASE_STATUS',
  'CREATE_RESOLUTION', 'LIST_RESOLUTIONS', 'UPDATE_RESOLUTION_STATUS',
  'LIST_SANCTIONED', 'CHECK_ELIGIBILITY',
  'EVALUATE_CARD_ACCUMULATION', 'PROCESS_MATCHDAY_FULFILLMENT',
];

// Tabla donde vive cada tipo de ente sancionable — usado para resolver
// club_id y el nombre a mostrar sin acoplar el shape de cada tabla acá.
const SANCTIONED_TABLE = {
  CLUB: { table: 'lg_clubs', nameField: 'name', clubField: 'id' },
  TEAM: { table: 'lg_club_series', nameField: 'name', clubField: 'club_id' },
  PLAYER: { table: 'lg_players', nameField: null, clubField: 'club_id' }, // nombre se arma de first_name+last_name
  COACH: { table: 'lg_team_staff', nameField: 'full_name', clubField: 'club_id' },
};

const CASE_SELECT = `
  *,
  infraction:lg_disciplinary_infractions(id,code,name,sanction_kind,sanctioned_type),
  article:lg_disciplinary_articles(id,code,title,severity),
  club:lg_clubs(id,name,short_name)
`;

const RESOLUTION_SELECT = `
  *,
  case:lg_disciplinary_cases(id,title,status,sanctioned_type,sanctioned_id)
`;

export class DisciplinarySpecialist extends Skill {
  constructor() {
    super('disciplinary_specialist', '1.0.0');
    this.domain = 'disciplinary';
    this.capabilities = CAPABILITIES;

    this.contract = {
      input: [
        { name: 'operation', required: true, type: 'string' },
        { name: 'payload', required: true, type: 'object' },
        { name: 'db', required: true, type: 'object' },
        { name: 'userId', required: false, type: 'string' },
      ],
      output: [
        { name: 'article', type: 'object' }, { name: 'articles', type: 'array' },
        { name: 'infraction', type: 'object' }, { name: 'infractions', type: 'array' },
        { name: 'staff', type: 'object' }, { name: 'staffList', type: 'array' },
        { name: 'case', type: 'object' }, { name: 'cases', type: 'array' },
        { name: 'resolution', type: 'object' }, { name: 'resolutions', type: 'array' },
        { name: 'sanctioned', type: 'array' },
        { name: 'eligible', type: 'boolean' },
      ],
      rules: {
        do: [
          'Resolver y denormalizar club_id del sancionado al crear un caso/resolución',
          'Usar disciplinary_engine.js para toda decisión de acumulación de tarjetas',
          'Sólo descontar fechas de suspensión ante partidos FINISHED',
        ],
        dont: [
          'No modificar lg_matches ni lg_match_events',
          'No crear ni administrar torneos/fixture',
        ],
      },
      checklist: [
        'CREATE_CASE valida que sanctioned_type/sanctioned_id existan en su tabla',
        'CREATE_RESOLUTION inicializa matches_remaining cuando sanction_kind = MATCHES_SUSPENSION',
        'PROCESS_MATCHDAY_FULFILLMENT es idempotente por (resolution_id, match_id)',
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
        case 'LIST_ARTICLES': return this._listArticles(payload, db);
        case 'CREATE_ARTICLE': return this._createArticle(payload, db);
        case 'UPDATE_ARTICLE': return this._updateArticle(payload, db);
        case 'DELETE_ARTICLE': return this._deleteArticle(payload, db);

        case 'LIST_INFRACTIONS': return this._listInfractions(payload, db);
        case 'CREATE_INFRACTION': return this._createInfraction(payload, db);
        case 'UPDATE_INFRACTION': return this._updateInfraction(payload, db);
        case 'DELETE_INFRACTION': return this._deleteInfraction(payload, db);

        case 'LIST_TEAM_STAFF': return this._listTeamStaff(payload, db);
        case 'CREATE_TEAM_STAFF': return this._createTeamStaff(payload, db);
        case 'UPDATE_TEAM_STAFF': return this._updateTeamStaff(payload, db);
        case 'DELETE_TEAM_STAFF': return this._deleteTeamStaff(payload, db);

        case 'LIST_CASES': return this._listCases(payload, db);
        case 'GET_CASE': return this._getCase(payload, db);
        case 'CREATE_CASE': return this._createCase(payload, db, userId);
        case 'UPDATE_CASE_STATUS': return this._updateCaseStatus(payload, db);

        case 'CREATE_RESOLUTION': return this._createResolution(payload, db, userId);
        case 'LIST_RESOLUTIONS': return this._listResolutions(payload, db);
        case 'UPDATE_RESOLUTION_STATUS': return this._updateResolutionStatus(payload, db);

        case 'LIST_SANCTIONED': return this._listSanctioned(payload, db);
        case 'CHECK_ELIGIBILITY': return this._checkEligibility(payload, db);

        case 'EVALUATE_CARD_ACCUMULATION': return this._evaluateCardAccumulation(payload, db);
        case 'PROCESS_MATCHDAY_FULFILLMENT': return this._processMatchdayFulfillment(payload, db);
      }
    } catch (err) {
      return createSkillResult({ success: false, errorCode: 'DISCIPLINARY_SPECIALIST_ERROR', errorMessage: err.message });
    }
  }

  // ── Reglamento (Artículos) ──────────────────────────────────────────────

  async _listArticles({ orgId, sportId, active }, db) {
    let query = db.from('lg_disciplinary_articles').select('*, sport:lg_sports(id,name)').eq('org_id', orgId);
    if (sportId) query = query.or(`sport_id.eq.${sportId},sport_id.is.null`);
    if (active !== undefined) query = query.eq('active', active === 'true' || active === true);
    query = query.order('code', { ascending: true });
    const { data: articles, error } = await query;
    if (error) return createSkillResult({ success: false, errorCode: 'LIST_ARTICLES_FAILED', errorMessage: error.message });
    return createSkillResult({ success: true, data: { articles } });
  }

  async _createArticle({ orgId, sportId, variant, code, title, description, severity }, db) {
    if (!orgId || !code || !title) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'orgId, code y title son requeridos' });
    }
    const { data: article, error } = await db
      .from('lg_disciplinary_articles')
      .insert({
        org_id: orgId, sport_id: sportId ?? null, variant: variant ?? null,
        code, title, description: description ?? null, severity: severity ?? 'LEVE',
      })
      .select().single();
    if (error) return createSkillResult({ success: false, errorCode: 'CREATE_ARTICLE_FAILED', errorMessage: error.message });
    return createSkillResult({ success: true, data: { article } });
  }

  async _updateArticle({ articleId, sportId, variant, code, title, description, severity, active }, db) {
    const patch = { updated_at: new Date().toISOString() };
    if (sportId !== undefined) patch.sport_id = sportId;
    if (variant !== undefined) patch.variant = variant;
    if (code !== undefined) patch.code = code;
    if (title !== undefined) patch.title = title;
    if (description !== undefined) patch.description = description;
    if (severity !== undefined) patch.severity = severity;
    if (active !== undefined) patch.active = active;

    const { data: article, error } = await db.from('lg_disciplinary_articles').update(patch).eq('id', articleId).select().single();
    if (error) return createSkillResult({ success: false, errorCode: 'UPDATE_ARTICLE_FAILED', errorMessage: error.message });
    return createSkillResult({ success: true, data: { article } });
  }

  async _deleteArticle({ articleId }, db) {
    const { error } = await db.from('lg_disciplinary_articles').delete().eq('id', articleId);
    if (error) return createSkillResult({ success: false, errorCode: 'DELETE_ARTICLE_FAILED', errorMessage: error.message });
    return createSkillResult({ success: true, data: { deleted: true, articleId } });
  }

  // ── Catálogo de faltas tipificadas (Infracciones) ───────────────────────

  async _listInfractions({ orgId, sportId, sanctionedType, active }, db) {
    let query = db
      .from('lg_disciplinary_infractions')
      .select('*, article:lg_disciplinary_articles(id,code,title), sport:lg_sports(id,name)')
      .eq('org_id', orgId);
    if (sportId) query = query.or(`sport_id.eq.${sportId},sport_id.is.null`);
    if (sanctionedType) query = query.eq('sanctioned_type', sanctionedType);
    if (active !== undefined) query = query.eq('active', active === 'true' || active === true);
    query = query.order('code', { ascending: true });
    const { data: infractions, error } = await query;
    if (error) return createSkillResult({ success: false, errorCode: 'LIST_INFRACTIONS_FAILED', errorMessage: error.message });
    return createSkillResult({ success: true, data: { infractions } });
  }

  async _createInfraction({ orgId, articleId, sportId, variant, code, name, description, sanctionedType, sanctionKind, defaultQuantity, autoTrigger, autoRule }, db) {
    if (!orgId || !code || !name || !sanctionedType || !sanctionKind) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'orgId, code, name, sanctionedType y sanctionKind son requeridos' });
    }
    const { data: infraction, error } = await db
      .from('lg_disciplinary_infractions')
      .insert({
        org_id: orgId, article_id: articleId ?? null, sport_id: sportId ?? null, variant: variant ?? null,
        code, name, description: description ?? null,
        sanctioned_type: sanctionedType, sanction_kind: sanctionKind,
        default_quantity: defaultQuantity ?? null,
        auto_trigger: autoTrigger ?? null, auto_rule: autoRule ?? null,
      })
      .select().single();
    if (error) return createSkillResult({ success: false, errorCode: 'CREATE_INFRACTION_FAILED', errorMessage: error.message });
    return createSkillResult({ success: true, data: { infraction } });
  }

  async _updateInfraction({ infractionId, articleId, sportId, variant, code, name, description, sanctionedType, sanctionKind, defaultQuantity, autoTrigger, autoRule, active }, db) {
    const patch = { updated_at: new Date().toISOString() };
    if (articleId !== undefined) patch.article_id = articleId;
    if (sportId !== undefined) patch.sport_id = sportId;
    if (variant !== undefined) patch.variant = variant;
    if (code !== undefined) patch.code = code;
    if (name !== undefined) patch.name = name;
    if (description !== undefined) patch.description = description;
    if (sanctionedType !== undefined) patch.sanctioned_type = sanctionedType;
    if (sanctionKind !== undefined) patch.sanction_kind = sanctionKind;
    if (defaultQuantity !== undefined) patch.default_quantity = defaultQuantity;
    if (autoTrigger !== undefined) patch.auto_trigger = autoTrigger;
    if (autoRule !== undefined) patch.auto_rule = autoRule;
    if (active !== undefined) patch.active = active;

    const { data: infraction, error } = await db.from('lg_disciplinary_infractions').update(patch).eq('id', infractionId).select().single();
    if (error) return createSkillResult({ success: false, errorCode: 'UPDATE_INFRACTION_FAILED', errorMessage: error.message });
    return createSkillResult({ success: true, data: { infraction } });
  }

  async _deleteInfraction({ infractionId }, db) {
    const { error } = await db.from('lg_disciplinary_infractions').delete().eq('id', infractionId);
    if (error) return createSkillResult({ success: false, errorCode: 'DELETE_INFRACTION_FAILED', errorMessage: error.message });
    return createSkillResult({ success: true, data: { deleted: true, infractionId } });
  }

  // ── Cuerpo técnico / dirigentes (mínimo, sólo para poder sancionar COACH) ─

  async _listTeamStaff({ clubId, active }, db) {
    let query = db.from('lg_team_staff').select('*').eq('club_id', clubId);
    if (active !== undefined) query = query.eq('active', active === 'true' || active === true);
    query = query.order('full_name', { ascending: true });
    const { data: staffList, error } = await query;
    if (error) return createSkillResult({ success: false, errorCode: 'LIST_TEAM_STAFF_FAILED', errorMessage: error.message });
    return createSkillResult({ success: true, data: { staffList } });
  }

  async _createTeamStaff({ clubId, fullName, role }, db) {
    if (!clubId || !fullName) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'clubId y fullName son requeridos' });
    }
    const { data: staff, error } = await db
      .from('lg_team_staff').insert({ club_id: clubId, full_name: fullName, role: role ?? 'DT' }).select().single();
    if (error) return createSkillResult({ success: false, errorCode: 'CREATE_TEAM_STAFF_FAILED', errorMessage: error.message });
    return createSkillResult({ success: true, data: { staff } });
  }

  async _updateTeamStaff({ staffId, fullName, role, active }, db) {
    const patch = { updated_at: new Date().toISOString() };
    if (fullName !== undefined) patch.full_name = fullName;
    if (role !== undefined) patch.role = role;
    if (active !== undefined) patch.active = active;
    const { data: staff, error } = await db.from('lg_team_staff').update(patch).eq('id', staffId).select().single();
    if (error) return createSkillResult({ success: false, errorCode: 'UPDATE_TEAM_STAFF_FAILED', errorMessage: error.message });
    return createSkillResult({ success: true, data: { staff } });
  }

  async _deleteTeamStaff({ staffId }, db) {
    const { error } = await db.from('lg_team_staff').delete().eq('id', staffId);
    if (error) return createSkillResult({ success: false, errorCode: 'DELETE_TEAM_STAFF_FAILED', errorMessage: error.message });
    return createSkillResult({ success: true, data: { deleted: true, staffId } });
  }

  // ── Helpers internos de resolución polimórfica ──────────────────────────

  /** Resuelve club_id y nombre a mostrar del ente sancionado, según su tipo. */
  async _resolveSanctionedEntity(sanctionedType, sanctionedId, db) {
    const meta = SANCTIONED_TABLE[sanctionedType];
    if (!meta) return { found: false, clubId: null, displayName: null };

    if (sanctionedType === 'PLAYER') {
      const { data } = await db.from('lg_players').select('id, first_name, last_name, club_id').eq('id', sanctionedId).maybeSingle();
      if (!data) return { found: false, clubId: null, displayName: null };
      return { found: true, clubId: data.club_id ?? null, displayName: `${data.first_name} ${data.last_name}` };
    }

    const { data } = await db.from(meta.table).select(`id, ${meta.clubField}, ${meta.nameField}`).eq('id', sanctionedId).maybeSingle();
    if (!data) return { found: false, clubId: null, displayName: null };
    return {
      found: true,
      clubId: sanctionedType === 'CLUB' ? data.id : data[meta.clubField] ?? null,
      displayName: data[meta.nameField] ?? null,
    };
  }

  // ── Expedientes (Casos) ──────────────────────────────────────────────────

  async _listCases({ orgId, tournamentId, clubId, status, sanctionedType, limit = 20, nextToken }, db) {
    let offset = 0;
    let effectiveLimit = parseInt(limit, 10) || 20;
    if (nextToken) {
      const decoded = decodeNext(nextToken, { orgId });
      if (!decoded) return createSkillResult({ success: false, errorCode: 'INVALID_NEXT_TOKEN', errorMessage: 'Token de paginación inválido' });
      offset = decoded.offset;
      effectiveLimit = decoded.limit;
    }

    let query = db.from('lg_disciplinary_cases').select(CASE_SELECT, { count: 'exact' }).eq('org_id', orgId);
    if (tournamentId) query = query.eq('tournament_id', tournamentId);
    if (clubId) query = query.eq('club_id', clubId);
    if (status) query = query.eq('status', status);
    if (sanctionedType) query = query.eq('sanctioned_type', sanctionedType);
    query = query.order('created_at', { ascending: false }).range(offset, offset + effectiveLimit - 1);

    const { data: cases, error, count } = await query;
    if (error) return createSkillResult({ success: false, errorCode: 'LIST_CASES_FAILED', errorMessage: error.message });

    const total = count ?? 0;
    const hasMore = offset + effectiveLimit < total;
    const newToken = hasMore ? encodeNext(offset + effectiveLimit, effectiveLimit, { orgId }) : null;

    return createSkillResult({ success: true, data: { cases, next_token: newToken, total_registros: total, limit: effectiveLimit } });
  }

  async _getCase({ caseId }, db) {
    const { data: caseRow, error } = await db.from('lg_disciplinary_cases').select(CASE_SELECT).eq('id', caseId).maybeSingle();
    if (error || !caseRow) return createSkillResult({ success: false, errorCode: 'CASE_NOT_FOUND', errorMessage: 'Expediente no encontrado' });

    const { data: resolutions } = await db
      .from('lg_sanction_resolutions').select('*').eq('case_id', caseId).order('created_at', { ascending: false });

    return createSkillResult({ success: true, data: { case: caseRow, resolutions: resolutions ?? [] } });
  }

  async _createCase({ orgId, tournamentId, matchId, matchEventId, sanctionedType, sanctionedId, infractionId, articleId, source, title, description }, db, userId) {
    if (!orgId || !sanctionedType || !sanctionedId || !title) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'orgId, sanctionedType, sanctionedId y title son requeridos' });
    }

    const entity = await this._resolveSanctionedEntity(sanctionedType, sanctionedId, db);
    if (!entity.found) {
      return createSkillResult({ success: false, errorCode: 'SANCTIONED_ENTITY_NOT_FOUND', errorMessage: `No se encontró el ente sancionado de tipo ${sanctionedType}` });
    }

    const { data: caseRow, error } = await db
      .from('lg_disciplinary_cases')
      .insert({
        org_id: orgId, tournament_id: tournamentId ?? null, match_id: matchId ?? null, match_event_id: matchEventId ?? null,
        sanctioned_type: sanctionedType, sanctioned_id: sanctionedId, club_id: entity.clubId,
        infraction_id: infractionId ?? null, article_id: articleId ?? null,
        source: source ?? 'MANUAL', title, description: description ?? null,
        status: 'PENDING', reported_by: userId ?? null,
      })
      .select(CASE_SELECT).single();
    if (error) return createSkillResult({ success: false, errorCode: 'CREATE_CASE_FAILED', errorMessage: error.message, errorDetails: { pgCode: error.code } });
    return createSkillResult({ success: true, data: { case: caseRow } });
  }

  async _updateCaseStatus({ caseId, status }, db) {
    if (!['PENDING', 'IN_REVIEW', 'SANCTIONED', 'DISMISSED'].includes(status)) {
      return createSkillResult({ success: false, errorCode: 'INVALID_STATUS', errorMessage: 'Estado inválido' });
    }
    const { data: caseRow, error } = await db
      .from('lg_disciplinary_cases').update({ status, updated_at: new Date().toISOString() }).eq('id', caseId).select(CASE_SELECT).single();
    if (error) return createSkillResult({ success: false, errorCode: 'UPDATE_CASE_STATUS_FAILED', errorMessage: error.message });
    return createSkillResult({ success: true, data: { case: caseRow } });
  }

  // ── Resoluciones (boletín oficial / sanción aplicada) ───────────────────

  async _createResolution({ caseId, tournamentId, sanctionKind, quantity, startDate, resolutionText }, db, userId) {
    const { data: caseRow, error: caseErr } = await db.from('lg_disciplinary_cases').select('*').eq('id', caseId).maybeSingle();
    if (caseErr || !caseRow) return createSkillResult({ success: false, errorCode: 'CASE_NOT_FOUND', errorMessage: 'Expediente no encontrado' });

    if (!sanctionKind || quantity === undefined || quantity === null) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'sanctionKind y quantity son requeridos' });
    }

    const isMatches = sanctionKind === 'MATCHES_SUSPENSION';
    const isDays = sanctionKind === 'DAYS_SUSPENSION';
    const effectiveStartDate = startDate ?? new Date().toISOString().slice(0, 10);

    const insertPayload = {
      case_id: caseId, org_id: caseRow.org_id,
      sanctioned_type: caseRow.sanctioned_type, sanctioned_id: caseRow.sanctioned_id, club_id: caseRow.club_id,
      tournament_id: tournamentId ?? caseRow.tournament_id ?? null,
      sanction_kind: sanctionKind, quantity: Number(quantity),
      matches_remaining: isMatches ? Number(quantity) : null,
      start_date: effectiveStartDate,
      end_date: isDays ? computeDaysSuspensionEndDate(effectiveStartDate, quantity) : null,
      resolution_text: resolutionText ?? null,
      resolved_by: userId ?? null, resolved_at: new Date().toISOString(),
      status_cumplimiento: ONGOING_SANCTION_KINDS.includes(sanctionKind) ? 'PENDING' : 'COMPLETED',
    };

    const { data: resolution, error } = await db.from('lg_sanction_resolutions').insert(insertPayload).select().single();
    if (error) return createSkillResult({ success: false, errorCode: 'CREATE_RESOLUTION_FAILED', errorMessage: error.message });

    await db.from('lg_disciplinary_cases').update({ status: 'SANCTIONED', updated_at: new Date().toISOString() }).eq('id', caseId);

    return createSkillResult({ success: true, data: { resolution } });
  }

  async _listResolutions({ orgId, sanctionedType, sanctionedId, tournamentId, status }, db) {
    let query = db.from('lg_sanction_resolutions').select(RESOLUTION_SELECT).eq('org_id', orgId);
    if (sanctionedType) query = query.eq('sanctioned_type', sanctionedType);
    if (sanctionedId) query = query.eq('sanctioned_id', sanctionedId);
    if (tournamentId) query = query.eq('tournament_id', tournamentId);
    if (status) query = query.eq('status_cumplimiento', status);
    query = query.order('created_at', { ascending: false });

    const { data: resolutions, error } = await query;
    if (error) return createSkillResult({ success: false, errorCode: 'LIST_RESOLUTIONS_FAILED', errorMessage: error.message });
    return createSkillResult({ success: true, data: { resolutions } });
  }

  async _updateResolutionStatus({ resolutionId, statusCumplimiento }, db) {
    if (!['PENDING', 'IN_FULFILLMENT', 'COMPLETED', 'APPEALED'].includes(statusCumplimiento)) {
      return createSkillResult({ success: false, errorCode: 'INVALID_STATUS', errorMessage: 'Estado de cumplimiento inválido' });
    }
    const { data: resolution, error } = await db
      .from('lg_sanction_resolutions').update({ status_cumplimiento: statusCumplimiento, updated_at: new Date().toISOString() }).eq('id', resolutionId).select().single();
    if (error) return createSkillResult({ success: false, errorCode: 'UPDATE_RESOLUTION_STATUS_FAILED', errorMessage: error.message });
    return createSkillResult({ success: true, data: { resolution } });
  }

  // ── Consulta de sancionados / habilitación (consumida por la planilla) ──

  async _listSanctioned({ orgId, tournamentId, clubId, sanctionedType, limit = 20, nextToken }, db) {
    let offset = 0;
    let effectiveLimit = parseInt(limit, 10) || 20;
    if (nextToken) {
      const decoded = decodeNext(nextToken, { orgId });
      if (!decoded) return createSkillResult({ success: false, errorCode: 'INVALID_NEXT_TOKEN', errorMessage: 'Token de paginación inválido' });
      offset = decoded.offset;
      effectiveLimit = decoded.limit;
    }

    let query = db.from('vw_active_sanctions').select('*', { count: 'exact' }).eq('org_id', orgId);
    if (tournamentId) query = query.eq('tournament_id', tournamentId);
    if (clubId) query = query.eq('club_id', clubId);
    if (sanctionedType) query = query.eq('sanctioned_type', sanctionedType);
    query = query.order('start_date', { ascending: false }).range(offset, offset + effectiveLimit - 1);

    const { data: sanctioned, error, count } = await query;
    if (error) return createSkillResult({ success: false, errorCode: 'LIST_SANCTIONED_FAILED', errorMessage: error.message });

    const total = count ?? 0;
    const hasMore = offset + effectiveLimit < total;
    const newToken = hasMore ? encodeNext(offset + effectiveLimit, effectiveLimit, { orgId }) : null;

    return createSkillResult({ success: true, data: { sanctioned, next_token: newToken, total_registros: total, limit: effectiveLimit } });
  }

  async _checkEligibility({ sanctionedType, sanctionedId, tournamentId }, db) {
    if (!sanctionedType || !sanctionedId) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'sanctionedType y sanctionedId son requeridos' });
    }
    let query = db
      .from('lg_sanction_resolutions')
      .select('*')
      .eq('sanctioned_type', sanctionedType)
      .eq('sanctioned_id', sanctionedId)
      .in('status_cumplimiento', ['PENDING', 'IN_FULFILLMENT']);
    if (tournamentId) query = query.or(`tournament_id.eq.${tournamentId},tournament_id.is.null`);

    const { data: resolutions, error } = await query;
    if (error) return createSkillResult({ success: false, errorCode: 'CHECK_ELIGIBILITY_FAILED', errorMessage: error.message });

    const activeSanctions = (resolutions ?? []).filter((r) => {
      if (r.sanction_kind === 'MATCHES_SUSPENSION') return (r.matches_remaining ?? 0) > 0;
      if (r.sanction_kind === 'DAYS_SUSPENSION') return !r.end_date || r.end_date >= new Date().toISOString().slice(0, 10);
      return ['DISQUALIFICATION', 'EXPULSION', 'LOCALIA_SUSPENSION'].includes(r.sanction_kind);
    });

    return createSkillResult({ success: true, data: { eligible: activeSanctions.length === 0, activeSanctions } });
  }

  // ── Motor: acumulación de tarjetas y cumplimiento de fechas ─────────────

  /**
   * Cuenta los eventos del tipo dado que ya tiene el jugador/ente en el
   * torneo (incluyendo el recién agregado), evalúa la regla de acumulación
   * del deporte y, si dispara, crea el caso + resolución automáticamente.
   */
  async _evaluateCardAccumulation({ matchId, playerId, eventType, matchEventId }, db) {
    if (!matchId || !playerId || !eventType) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'matchId, playerId y eventType son requeridos' });
    }

    const { data: match, error: matchErr } = await db
      .from('lg_matches').select('*, tournament:lg_tournaments(id,org_id,category_id)').eq('id', matchId).maybeSingle();
    if (matchErr || !match) return createSkillResult({ success: false, errorCode: 'MATCH_NOT_FOUND', errorMessage: 'Partido no encontrado' });

    const { data: player } = await db.from('lg_players').select('id, first_name, last_name, club_id').eq('id', playerId).maybeSingle();
    if (!player) return createSkillResult({ success: false, errorCode: 'PLAYER_NOT_FOUND', errorMessage: 'Jugador no encontrado' });

    // Idempotencia: si ya existe un expediente automático para este evento
    // puntual (la tarjeta que disparó la evaluación), no se vuelve a crear
    // — evita duplicar caso+resolución ante un reintento del cliente.
    if (matchEventId) {
      const { data: existingCase } = await db
        .from('lg_disciplinary_cases').select(CASE_SELECT).eq('match_event_id', matchEventId).maybeSingle();
      if (existingCase) {
        const { data: existingResolutions } = await db.from('lg_sanction_resolutions').select('*').eq('case_id', existingCase.id);
        return createSkillResult({ success: true, data: { triggered: true, alreadyProcessed: true, case: existingCase, resolution: existingResolutions?.[0] ?? null } });
      }
    }

    const { data: category } = match.tournament?.category_id
      ? await db.from('lg_categories').select('sport:lg_sports(id,name)').eq('id', match.tournament.category_id).maybeSingle()
      : { data: null };
    const sportSlug = toSportSlug(category?.sport?.name ?? null);

    // Cuenta todas las tarjetas de este tipo del jugador en partidos del
    // mismo torneo (incluye la recién registrada, ya insertada por matches_specialist).
    const { data: tournamentMatches } = await db.from('lg_matches').select('id').eq('tournament_id', match.tournament_id);
    const matchIds = (tournamentMatches ?? []).map((m) => m.id);
    const { data: events, error: eventsErr } = await db
      .from('lg_match_events').select('id').eq('player_id', playerId).eq('event_type', eventType).in('match_id', matchIds);
    if (eventsErr) return createSkillResult({ success: false, errorCode: 'EVALUATE_CARD_ACCUMULATION_FAILED', errorMessage: eventsErr.message });

    const count = (events ?? []).length;
    const decision = evaluateCardAccumulation({ sportSlug, variant: null, eventType, count });

    if (!decision.triggers) {
      return createSkillResult({ success: true, data: { triggered: false, count } });
    }

    const caseResult = await this._createCase({
      orgId: match.tournament?.org_id,
      tournamentId: match.tournament_id,
      matchId,
      matchEventId: matchEventId ?? null,
      sanctionedType: 'PLAYER',
      sanctionedId: playerId,
      source: 'AUTO_CARD_ACCUMULATION',
      title: `Acumulación de ${eventType === 'YELLOW_CARD' ? 'amarillas' : eventType} — ${player.first_name} ${player.last_name}`,
      description: `Generado automáticamente: ${count} ${eventType} acumuladas en el torneo.`,
    }, db, null);

    if (!caseResult.success) {
      // Carrera entre dos evaluaciones concurrentes del mismo evento: la que
      // pierde la carrera choca contra el índice único de match_event_id.
      if (caseResult.error?.details?.pgCode === '23505') {
        return createSkillResult({ success: true, data: { triggered: true, alreadyProcessed: true } });
      }
      return caseResult;
    }

    const resolutionResult = await this._createResolution({
      caseId: caseResult.data.case.id,
      tournamentId: match.tournament_id,
      sanctionKind: decision.sanctionKind,
      quantity: decision.quantity,
      resolutionText: 'Sanción automática por acumulación de tarjetas (motor disciplinario).',
    }, db, null);

    if (!resolutionResult.success) return resolutionResult;

    return createSkillResult({
      success: true,
      data: { triggered: true, count, case: caseResult.data.case, resolution: resolutionResult.data.resolution },
    });
  }

  /**
   * Al finalizar un partido oficial (FINISHED), descuenta una fecha a toda
   * resolución MATCHES_SUSPENSION activa de jugadores que integran alguno
   * de los dos equipos del partido, dentro del mismo torneo. Idempotente:
   * lg_sanction_fulfillments tiene UNIQUE(resolution_id, match_id).
   */
  async _processMatchdayFulfillment({ matchId }, db) {
    const { data: match, error: matchErr } = await db.from('lg_matches').select('*').eq('id', matchId).maybeSingle();
    if (matchErr || !match) return createSkillResult({ success: false, errorCode: 'MATCH_NOT_FOUND', errorMessage: 'Partido no encontrado' });

    if (!isMatchdayCountable(match)) {
      return createSkillResult({ success: true, data: { processed: false, reason: 'MATCH_NOT_FINISHED' } });
    }

    const seriesIds = [match.home_series_id, match.away_series_id].filter(Boolean);
    if (seriesIds.length === 0) {
      return createSkillResult({ success: true, data: { processed: false, reason: 'NO_TEAMS' } });
    }

    // Clubes de esos equipos/series — cubre jugadores (por club) y también
    // resoluciones directamente sobre el CLUB o el TEAM (misma fecha jugada
    // descuenta la suspensión del club/equipo también).
    const { data: seriesRows } = await db.from('lg_club_series').select('id, club_id').in('id', seriesIds);
    const clubIds = [...new Set((seriesRows ?? []).map((s) => s.club_id).filter(Boolean))];

    const { data: candidates, error: candErr } = await db
      .from('lg_sanction_resolutions')
      .select('*')
      .eq('sanction_kind', 'MATCHES_SUSPENSION')
      .eq('tournament_id', match.tournament_id)
      .in('status_cumplimiento', ['PENDING', 'IN_FULFILLMENT'])
      .gt('matches_remaining', 0)
      .or([...clubIds.map((id) => `club_id.eq.${id}`), ...seriesIds.map((id) => `sanctioned_id.eq.${id}`)].join(',') || 'club_id.is.null');
    if (candErr) return createSkillResult({ success: false, errorCode: 'PROCESS_FULFILLMENT_FAILED', errorMessage: candErr.message });

    const processed = [];
    for (const resolution of candidates ?? []) {
      const { error: fulfillErr } = await db
        .from('lg_sanction_fulfillments').insert({ resolution_id: resolution.id, match_id: matchId });
      if (fulfillErr) {
        // Ya se descontó esta fecha para esta resolución (UNIQUE constraint) — se omite, no es un error.
        if (fulfillErr.code === '23505') continue;
        return createSkillResult({ success: false, errorCode: 'PROCESS_FULFILLMENT_FAILED', errorMessage: fulfillErr.message });
      }

      const { matches_remaining, status_cumplimiento } = decrementMatchesSuspension(resolution);
      const { data: updated, error: updErr } = await db
        .from('lg_sanction_resolutions')
        .update({ matches_remaining, status_cumplimiento, updated_at: new Date().toISOString() })
        .eq('id', resolution.id).select().single();
      if (updErr) return createSkillResult({ success: false, errorCode: 'PROCESS_FULFILLMENT_FAILED', errorMessage: updErr.message });

      processed.push(updated);
    }

    return createSkillResult({ success: true, data: { processed: true, resolutions: processed } });
  }
}
