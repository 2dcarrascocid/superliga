/**
 * ADF - Org Specialist (Specialists Layer)
 *
 * Panel de configuración de administrador: deporte de la liga (lg_orgs.sport_id,
 * determina el tema de colores del frontend) + gestión de hasta 5 administradores
 * de organización (rol ADMIN a nivel lg_orgs, con login real).
 *
 * DO:
 *   - Operar sobre lg_orgs, lg_sports, lg_org_users, lg_org_admin_invites
 *   - Verificar que requestingUserId sea ADMIN de la org antes de mutaciones
 *     (UPDATE_ORG_SPORT, INVITE_ORG_ADMIN, REMOVE_ORG_ADMIN)
 *   - Respetar el límite de 5 administradores por organización (activos +
 *     invitaciones pendientes) antes de invocar la RPC de invitación
 *   - Garantizar que una organización nunca quede sin ningún ADMIN activo
 *
 * DON'T:
 *   - No crear la fila de lg_orgs — solo lee/actualiza sport_id
 *   - No lanzar excepciones no controladas
 *   - No remover al último ADMIN de una org
 *
 * Capabilities:
 *   GET_SPORTS | GET_ORG_SPORT | UPDATE_ORG_SPORT |
 *   GET_ORG_ADMINS | INVITE_ORG_ADMIN | REMOVE_ORG_ADMIN
 *
 * Checklist:
 *   [ ] ¿UPDATE_ORG_SPORT valida ADMIN de la org y que sportId exista?
 *   [ ] ¿INVITE_ORG_ADMIN respeta el límite de 5 (activos + pendientes)?
 *   [ ] ¿REMOVE_ORG_ADMIN impide dejar la org sin ningún ADMIN?
 *   [ ] ¿Fallos de envío de email no rompen la respuesta de INVITE_ORG_ADMIN?
 */

import { Skill } from '../contracts/skill_contract.js';
import { createSkillResult } from '../contracts/task_schema.js';
import crypto from 'crypto';
import { sendOrgAdminInviteEmail } from '../../utils/mailer.js';
import { isOrgAdmin } from './lib/club_access.js';
import { toSportSlug } from './lib/org_sport.js';

const CAPABILITIES = [
  'GET_SPORTS', 'GET_ORG_SPORT', 'UPDATE_ORG_SPORT',
  'GET_ORG_ADMINS', 'INVITE_ORG_ADMIN', 'REMOVE_ORG_ADMIN',
];

const ORG_ADMIN_POSITIONS = ['PRESIDENTE', 'SECRETARIO', 'TESORERO'];
const MAX_ORG_ADMINS = 5;

export class OrgSpecialist extends Skill {
  constructor() {
    super('org_specialist', '1.0.0');
    this.domain = 'org';
    this.capabilities = CAPABILITIES;

    this.contract = {
      input: [
        { name: 'operation', required: true, type: 'string' },
        { name: 'payload', required: true, type: 'object' },
        { name: 'db', required: true, type: 'object' },
        { name: 'userId', required: false, type: 'string' },
      ],
      output: [
        { name: 'sports', type: 'array' },
        { name: 'admins', type: 'array' },
        { name: 'pendingInvites', type: 'array' },
      ],
      rules: {
        do: [
          'Verificar ADMIN de la org antes de UPDATE_ORG_SPORT/INVITE_ORG_ADMIN/REMOVE_ORG_ADMIN',
          'Respetar el límite de 5 administradores (activos + invitaciones pendientes)',
          'No dejar una org sin ningún ADMIN activo',
        ],
        dont: [
          'No crear lg_orgs desde este specialist',
          'No fallar la invitación si el envío de email falla',
        ],
      },
      checklist: [
        'Permisos de ADMIN de org verificados antes de mutaciones',
        'Límite de 5 administradores respetado en INVITE_ORG_ADMIN',
        'REMOVE_ORG_ADMIN nunca deja la org sin ADMIN',
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
        case 'GET_SPORTS':        return this._getSports(payload, db);
        case 'GET_ORG_SPORT':     return this._getOrgSport(payload, db);
        case 'UPDATE_ORG_SPORT':  return this._updateOrgSport(payload, db, userId);
        case 'GET_ORG_ADMINS':    return this._getOrgAdmins(payload, db);
        case 'INVITE_ORG_ADMIN':  return this._inviteOrgAdmin(payload, db, userId);
        case 'REMOVE_ORG_ADMIN':  return this._removeOrgAdmin(payload, db, userId);
      }
    } catch (err) {
      return createSkillResult({
        success: false,
        errorCode: 'ORG_SPECIALIST_ERROR',
        errorMessage: err.message,
      });
    }
  }

  // ── Deporte de la liga ────────────────────────────────────────────────────

  async _getSports(_payload, db) {
    const { data: sports, error } = await db
      .from('lg_sports')
      .select('*')
      .eq('team_sport', true)
      .order('name');

    if (error) {
      return createSkillResult({ success: false, errorCode: 'GET_SPORTS_FAILED', errorMessage: error.message });
    }

    return createSkillResult({ success: true, data: { sports: sports || [] } });
  }

  async _resolveOrgSportDTO(orgId, db) {
    const { data: org, error } = await db
      .from('lg_orgs')
      .select('sport_id')
      .eq('id', orgId)
      .maybeSingle();

    if (error) {
      return { error };
    }

    if (!org?.sport_id) {
      return { dto: { sportId: null, sportName: null, sportSlug: toSportSlug(null) } };
    }

    const { data: sport } = await db
      .from('lg_sports')
      .select('id, name')
      .eq('id', org.sport_id)
      .maybeSingle();

    return {
      dto: {
        sportId: org.sport_id,
        sportName: sport?.name || null,
        sportSlug: toSportSlug(sport?.name),
      },
    };
  }

  async _getOrgSport({ orgId }, db) {
    if (!orgId) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'orgId es requerido' });
    }

    const { dto, error } = await this._resolveOrgSportDTO(orgId, db);
    if (error) {
      return createSkillResult({ success: false, errorCode: 'GET_ORG_SPORT_FAILED', errorMessage: error.message });
    }

    return createSkillResult({ success: true, data: dto });
  }

  async _updateOrgSport({ orgId, sportId }, db, requestingUserId) {
    if (!orgId || !sportId) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'orgId y sportId son requeridos' });
    }

    if (!(await isOrgAdmin(requestingUserId, orgId, db))) {
      return createSkillResult({ success: false, errorCode: 'FORBIDDEN', errorMessage: 'Solo el ADMIN de la organización puede cambiar el deporte de la liga' });
    }

    const { data: sport } = await db.from('lg_sports').select('id').eq('id', sportId).maybeSingle();
    if (!sport) {
      return createSkillResult({ success: false, errorCode: 'SPORT_NOT_FOUND', errorMessage: 'El deporte indicado no existe' });
    }

    const { error } = await db
      .from('lg_orgs')
      .update({ sport_id: sportId })
      .eq('id', orgId);

    if (error) {
      return createSkillResult({ success: false, errorCode: 'UPDATE_ORG_SPORT_FAILED', errorMessage: error.message });
    }

    const { dto, error: fetchErr } = await this._resolveOrgSportDTO(orgId, db);
    if (fetchErr) {
      return createSkillResult({ success: false, errorCode: 'UPDATE_ORG_SPORT_FAILED', errorMessage: fetchErr.message });
    }

    return createSkillResult({ success: true, data: dto });
  }

  // ── Administradores de organización ───────────────────────────────────────

  async _countCurrentOrgAdmins(orgId, db) {
    const nowIso = new Date().toISOString();

    const [{ count: activeCount }, { count: pendingCount }] = await Promise.all([
      db.from('lg_org_users').select('*', { count: 'exact', head: true })
        .eq('org_id', orgId).eq('role', 'ADMIN'),
      db.from('lg_org_admin_invites').select('*', { count: 'exact', head: true })
        .eq('org_id', orgId).is('accepted_at', null).gt('expires_at', nowIso),
    ]);

    return (activeCount || 0) + (pendingCount || 0);
  }

  async _getOrgAdmins({ orgId }, db) {
    if (!orgId) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'orgId es requerido' });
    }

    const { data: admins, error } = await db.rpc('fn_get_org_admins', { p_org_id: orgId });

    if (error) {
      console.error('fn_get_org_admins error:', error.message);
      return createSkillResult({ success: false, errorCode: 'GET_ADMINS_FAILED', errorMessage: error.message });
    }

    const { data: pendingInvites, error: pendingErr } = await db
      .from('lg_org_admin_invites')
      .select('email, full_name, phone, position, expires_at')
      .eq('org_id', orgId)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString());

    if (pendingErr) {
      return createSkillResult({ success: false, errorCode: 'GET_ADMINS_FAILED', errorMessage: pendingErr.message });
    }

    return createSkillResult({ success: true, data: { admins: admins || [], pendingInvites: pendingInvites || [] } });
  }

  async _inviteOrgAdmin({ orgId, fullName, email, phone, position }, db, requestingUserId) {
    if (!orgId || !fullName || !email) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'orgId, fullName y email son requeridos' });
    }

    if (!(await isOrgAdmin(requestingUserId, orgId, db))) {
      return createSkillResult({ success: false, errorCode: 'FORBIDDEN', errorMessage: 'Solo el ADMIN puede invitar administradores de la organización' });
    }

    if (position && !ORG_ADMIN_POSITIONS.includes(position)) {
      return createSkillResult({
        success: false,
        errorCode: 'INVALID_POSITION',
        errorMessage: `position debe ser uno de: ${ORG_ADMIN_POSITIONS.join(', ')}`,
      });
    }

    const { data: org } = await db.from('lg_orgs').select('name').eq('id', orgId).maybeSingle();
    if (!org) {
      return createSkillResult({ success: false, errorCode: 'ORG_NOT_FOUND', errorMessage: 'Organización no encontrada' });
    }

    // Límite: máximo 5 administradores por organización (activos + pendientes)
    const currentCount = await this._countCurrentOrgAdmins(orgId, db);
    if (currentCount >= MAX_ORG_ADMINS) {
      return createSkillResult({
        success: false,
        errorCode: 'ADMIN_LIMIT_REACHED',
        errorMessage: 'Ya se alcanzó el límite de 5 administradores.',
      });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    // Token generado en JS — evita depender de pgcrypto en SQL
    const token     = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: invite, error: inviteErr } = await db.rpc('fn_invite_org_admin', {
      p_email:      email.toLowerCase(),
      p_org_id:     orgId,
      p_full_name:  fullName,
      p_phone:      phone || null,
      p_position:   position || null,
      p_inviter_id: requestingUserId,
      p_token_hash: tokenHash,
      p_expires_at: expiresAt,
    });

    if (inviteErr) {
      console.error('fn_invite_org_admin error:', inviteErr.message);
      return createSkillResult({ success: false, errorCode: 'INVITE_FAILED', errorMessage: inviteErr.message });
    }

    const { is_new } = invite;

    // Enviar email de invitación — un fallo de SMTP no debe romper la respuesta
    try {
      const link = `${frontendUrl}/accept-org-invite?token=${token}`;
      await sendOrgAdminInviteEmail(email, org.name, link, is_new);
    } catch (mailErr) {
      console.error('SMTP invite error:', mailErr.message);
    }

    return createSkillResult({
      success: true,
      data: { invited: true, isNewUser: is_new, email },
    });
  }

  async _removeOrgAdmin({ orgId, adminUserId }, db, requestingUserId) {
    if (!orgId || !adminUserId) {
      return createSkillResult({ success: false, errorCode: 'MISSING_FIELDS', errorMessage: 'orgId y adminUserId son requeridos' });
    }

    if (!(await isOrgAdmin(requestingUserId, orgId, db))) {
      return createSkillResult({ success: false, errorCode: 'FORBIDDEN', errorMessage: 'Solo el ADMIN puede remover administradores de la organización' });
    }

    // Nunca dejar la org sin ningún ADMIN activo.
    const { count: activeAdminCount } = await db
      .from('lg_org_users')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId).eq('role', 'ADMIN');

    if ((activeAdminCount || 0) <= 1) {
      return createSkillResult({
        success: false,
        errorCode: 'CANNOT_REMOVE_LAST_ADMIN',
        errorMessage: 'No es posible remover al único administrador de la organización.',
      });
    }

    const { error } = await db
      .from('lg_org_users')
      .delete()
      .eq('org_id', orgId)
      .eq('user_id', adminUserId)
      .eq('role', 'ADMIN');

    if (error) return createSkillResult({ success: false, errorCode: 'REMOVE_ADMIN_FAILED', errorMessage: error.message });

    return createSkillResult({ success: true, data: { removed: true } });
  }
}
