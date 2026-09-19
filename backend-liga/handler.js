/**
 * handler.js — Monolithic ADF-Integrated Handler
 *
 * Single Lambda entry point. Todas las rutas pasan por el ADF Orchestrator:
 *   Security Validation → Request Validation → Specialist → Response
 *
 * Rutas especiales (no pasan por ADF):
 *   GET /adf/health  — diagnóstico del ADF sin autenticación
 */

import { adf, buildTask, extractHeaders, taskResultToLambdaResponse } from './adf/index.js'
import { handler as adfHealthHandler } from './routes/adf/health.js'
import { getSwaggerDocs } from './routes/docs/docs.js'
import { errorResponse } from './utils/response.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const parseBody = (event) => {
  if (!event.body) return {}
  try {
    return typeof event.body === 'string' ? JSON.parse(event.body) : event.body
  } catch {
    return {}
  }
}

/**
 * Compila un patrón de ruta como '/clubs/{clubId}/roster/{rosterId}'
 * en un regex con named groups.
 *
 * @param {string} method   - Método HTTP
 * @param {string} pattern  - Patrón de ruta
 * @param {Function} taskFn - (pathParams, body, qs, event) → { type, domain, input }
 */
function route(method, pattern, taskFn) {
  const regexStr = pattern
    .split('/')
    .filter(Boolean)
    .map((seg) => (/^\{.+\}$/.test(seg) ? `(?<${seg.slice(1, -1)}>[^/]+)` : seg))
    .join('\\/')
  return {
    method: method.toUpperCase(),
    regex: new RegExp(`^\\/${regexStr}$`),
    taskFn,
  }
}

// ─── Tabla de Rutas ──────────────────────────────────────────────────────────
//
// Firma de taskFn: (pp, body, qs, event) => { type, domain, input }
//   pp   = pathParameters (ej: { clubId, playerId })
//   body = cuerpo parseado de la request
//   qs   = queryStringParameters
//   event= evento Lambda completo (disponible si se necesita)

const ROUTES = [

  // ── Auth ──────────────────────────────────────────────────────────────────

  route('POST', '/auth/login/local', (_pp, body) => ({
    type: 'LOGIN_LOCAL', domain: 'auth',
    input: { email: body.email, password: body.password },
  })),

  route('POST', '/auth/login/google', (_pp, body) => ({
    type: 'LOGIN_GOOGLE', domain: 'auth',
    input: { idToken: body.id_token ?? body.idToken },
  })),

  route('POST', '/auth/login/facebook', (_pp, body) => ({
    type: 'LOGIN_FACEBOOK', domain: 'auth',
    input: { idToken: body.access_token ?? body.id_token ?? body.idToken },
  })),

  route('POST', '/auth/bootstrap', (_pp, body) => ({
    type: 'BOOTSTRAP', domain: 'auth',
    input: {
      orgName:     body.org_name,
      orgSlug:     body.org_slug,
      countryCode: body.country_code ?? 'CL',
    },
  })),

  route('POST', '/auth/forgot-password', (_pp, body) => ({
    type: 'FORGOT_PASSWORD', domain: 'auth',
    input: { email: body.email },
  })),

  route('POST', '/auth/reset-password', (_pp, body) => ({
    type: 'RESET_PASSWORD', domain: 'auth',
    input: {
      token:       body.token,
      newPassword: body.new_password,
    },
  })),

  route('GET', '/auth/invite-info', (pp, _body, qs) => ({
    type: 'INVITE_INFO', domain: 'auth',
    input: { token: qs?.token },
  })),

  route('POST', '/auth/accept-invite', (_pp, body) => ({
    type: 'ACCEPT_CLUB_INVITE', domain: 'auth',
    input: { token: body.token, password: body.password },
  })),

  // T-20260828-103923: acepta invitación de Jugador — login/registro con
  // Google (idToken), a diferencia de /auth/accept-invite (club admin, password).
  route('POST', '/auth/accept-player-invite', (_pp, body) => ({
    type: 'ACCEPT_PLAYER_INVITE', domain: 'auth',
    input: { token: body.token, idToken: body.id_token ?? body.idToken },
  })),

  // ── Clubs ─────────────────────────────────────────────────────────────────

  route('POST', '/clubs', (_pp, body) => ({
    type: 'CREATE_CLUB', domain: 'clubs',
    input: {
      orgId:       body.org_id,
      name:        body.name,
      shortName:   body.short_name,
      colors:      body.colors,
      logoUrl:     body.logo_url,
      description: body.description,
      folioStart:  body.folio_start != null ? parseInt(body.folio_start, 10) : undefined,
      folioEnd:    body.folio_end   != null ? parseInt(body.folio_end,   10) : undefined,
      maxPlayers:  body.max_players != null ? parseInt(body.max_players, 10) : 70,
    },
  })),

  route('GET', '/clubs', (_pp, _body, qs) => ({
    type: 'GET_CLUBS', domain: 'clubs',
    input: {
      orgId:     qs.org_id,
      limit:     qs.limit ? parseInt(qs.limit, 10) : 20,
      nextToken: qs.next_token,
    },
  })),

  route('GET', '/clubs/{clubId}', (pp) => ({
    type: 'GET_CLUB', domain: 'clubs',
    input: { clubId: pp.clubId },
  })),

  route('GET', '/clubs/{clubId}/kpis', (pp) => ({
    type: 'GET_CLUB_KPIS', domain: 'clubs',
    input: { clubId: pp.clubId },
  })),

  route('PATCH', '/clubs/{clubId}', (pp, body) => ({
    type: 'UPDATE_CLUB', domain: 'clubs',
    input: { clubId: pp.clubId, ...body },
  })),

  route('POST', '/clubs/{clubId}/users', (pp, body) => ({
    type: 'ADD_CLUB_USER', domain: 'clubs',
    input: { clubId: pp.clubId, userId: body.user_id, role: body.role ?? 'MEMBER' },
  })),

  route('DELETE', '/clubs/{clubId}/users/{userId}', (pp) => ({
    type: 'REMOVE_CLUB_USER', domain: 'clubs',
    input: { clubId: pp.clubId, userId: pp.userId },
  })),

  route('POST', '/clubs/{clubId}/admins', (pp, body) => ({
    type: 'INVITE_CLUB_ADMIN', domain: 'clubs',
    input: { clubId: pp.clubId, email: body.email },
  })),

  route('GET', '/clubs/{clubId}/admins', (pp) => ({
    type: 'GET_CLUB_ADMINS', domain: 'clubs',
    input: { clubId: pp.clubId },
  })),

  route('DELETE', '/clubs/{clubId}/admins/{adminUserId}', (pp) => ({
    type: 'REMOVE_CLUB_ADMIN', domain: 'clubs',
    input: { clubId: pp.clubId, adminUserId: pp.adminUserId },
  })),

  route('POST', '/clubs/{clubId}/roster', (pp, body) => ({
    type: 'ADD_ROSTER', domain: 'clubs',
    input: {
      clubId:    pp.clubId,
      playerId:  body.player_id,
      validFrom: body.valid_from,
      validTo:   body.valid_to,
    },
  })),

  route('GET', '/clubs/{clubId}/roster', (pp, _body, qs) => ({
    type: 'GET_ROSTER', domain: 'clubs',
    input: {
      clubId:    pp.clubId,
      limit:     qs.limit ? parseInt(qs.limit, 10) : 20,
      nextToken: qs.next_token,
      status:    qs.status,
    },
  })),

  route('PATCH', '/clubs/{clubId}/roster/{rosterId}', (pp, body) => ({
    type: 'UPDATE_ROSTER', domain: 'clubs',
    input: { rosterId: pp.rosterId, status: body.status, validTo: body.valid_to },
  })),

  // ── Series de Club ───────────────────────────────────────────────────────

  route('GET', '/clubs/{clubId}/series', (pp) => ({
    type: 'LIST_SERIES', domain: 'club_series',
    input: { clubId: pp.clubId },
  })),

  route('POST', '/clubs/{clubId}/series', (pp, body) => ({
    type: 'CREATE_SERIES', domain: 'club_series',
    input: {
      clubId: pp.clubId, name: body.name, description: body.description,
      categoryId: body.category_id,
      active: body.active,
    },
  })),

  route('GET', '/series', (_pp, _body, qs) => ({
    type: 'LIST_SERIES', domain: 'club_series',
    input: { orgId: qs.org_id, q: qs.q, limit: qs.limit ? parseInt(qs.limit, 10) : 50 },
  })),

  route('GET', '/series/{seriesId}', (pp) => ({
    type: 'GET_SERIES', domain: 'club_series',
    input: { seriesId: pp.seriesId },
  })),

  route('PATCH', '/series/{seriesId}', (pp, body) => ({
    type: 'UPDATE_SERIES', domain: 'club_series',
    input: {
      seriesId: pp.seriesId, name: body.name, description: body.description,
      categoryId: body.category_id,
      active: body.active,
    },
  })),

  route('DELETE', '/series/{seriesId}', (pp) => ({
    type: 'DELETE_SERIES', domain: 'club_series',
    input: { seriesId: pp.seriesId },
  })),

  route('GET', '/clubs/{clubId}/series/{seriesId}/tournaments/{tournamentId}/eligibility', (pp) => ({
    type: 'GET_SERIES_TOURNAMENT_ELIGIBILITY', domain: 'tournaments',
    input: { clubId: pp.clubId, seriesId: pp.seriesId, tournamentId: pp.tournamentId },
  })),

  route('POST', '/clubs/{clubId}/series/{seriesId}/tournaments/{tournamentId}/registration', (pp) => ({
    type: 'REGISTER_CLUB_SERIES_ATOMIC', domain: 'tournaments',
    input: { clubId: pp.clubId, seriesId: pp.seriesId, tournamentId: pp.tournamentId },
  })),

  route('GET', '/clubs/{clubId}/active-tournaments', (pp, _body, qs) => ({
    type: 'LIST_ACTIVE_TOURNAMENTS_FOR_CLUB', domain: 'tournaments',
    input: { clubId: pp.clubId, seriesId: qs.series_id },
  })),

  route('GET', '/clubs/{clubId}/tournaments/{tournamentId}', (pp) => ({
    type: 'GET_CLUB_TOURNAMENT_DETAIL', domain: 'tournaments',
    input: { clubId: pp.clubId, tournamentId: pp.tournamentId },
  })),

  route('GET', '/series/{seriesId}/roster', (pp) => ({
    type: 'GET_SERIES_ROSTER', domain: 'club_series',
    input: { seriesId: pp.seriesId },
  })),

  route('POST', '/series/{seriesId}/players/{playerId}', (pp) => ({
    type: 'ASSIGN_PLAYER', domain: 'club_series',
    input: { seriesId: pp.seriesId, playerId: pp.playerId },
  })),

  route('DELETE', '/series/{seriesId}/players/{playerId}', (pp) => ({
    type: 'UNASSIGN_PLAYER', domain: 'club_series',
    input: { seriesId: pp.seriesId, playerId: pp.playerId },
  })),

  // ── Players ───────────────────────────────────────────────────────────────

  route('POST', '/clubs/{clubId}/players', (pp, body) => ({
    type: 'CREATE_PLAYER', domain: 'players',
    input: {
      clubId:     pp.clubId,
      firstName:  body.first_name,
      lastName:   body.last_name,
      rut:        body.rut,
      birthDate:  body.birth_date,
      address:    body.address,
      phone:      body.phone,
      email:      body.email,
      photoUrl:   body.photo_url,
      position:   body.position,
      categoryId: body.category_id,
      clubFolio:  body.club_folio,
    },
  })),

  route('GET', '/clubs/{clubId}/players', (pp, _body, qs) => ({
    type: 'LIST_PLAYERS_BY_CLUB', domain: 'players',
    input: {
      clubId:     pp.clubId,
      q:          qs.q,
      status:     qs.status ?? 'ACTIVE',
      limit:      qs.limit ? parseInt(qs.limit, 10) : 10,
      next_token: qs.next_token,
    },
  })),

  route('GET', '/clubs/{clubId}/available-folios', (pp) => ({
    type: 'LIST_AVAILABLE_FOLIOS', domain: 'players',
    input: { clubId: pp.clubId },
  })),

  route('PATCH', '/clubs/{clubId}/players/{playerId}/status', (pp, body) => ({
    type: 'UPDATE_STATUS', domain: 'players',
    input: { clubId: pp.clubId, playerId: pp.playerId, status: body.status },
  })),

  route('GET', '/orgs/{orgId}/players', (pp, _body, qs) => ({
    type: 'LIST_PLAYERS_BY_ORG', domain: 'players',
    input: {
      orgId:      pp.orgId,
      q:          qs.q,
      status:     qs.status ?? 'ACTIVE',
      limit:      qs.limit ? parseInt(qs.limit, 10) : 10,
      next_token: qs.next_token,
    },
  })),

  route('GET', '/orgs/{orgId}/players/active', (pp, _body, qs) => ({
    type: 'LIST_PLAYERS_BY_ORG', domain: 'players',
    input: {
      orgId:      pp.orgId,
      q:          qs.q,
      status:     'ACTIVE',
      limit:      qs.limit ? parseInt(qs.limit, 10) : 10,
      next_token: qs.next_token,
    },
  })),

  route('GET', '/orgs/{orgId}/players/inactive', (pp, _body, qs) => ({
    type: 'LIST_PLAYERS_BY_ORG', domain: 'players',
    input: {
      orgId:      pp.orgId,
      q:          qs.q,
      status:     'INACTIVE',
      limit:      qs.limit ? parseInt(qs.limit, 10) : 10,
      next_token: qs.next_token,
    },
  })),

  // T-20260828-103923: rol Jugador — deben ir ANTES de /players/{playerId}
  // (mismo shape de ruta: /players/me matchearía como playerId="me" si se
  // registrara después).
  route('GET', '/players/me', () => ({
    type: 'GET_MY_PLAYER_PROFILE', domain: 'players',
    input: {},
  })),

  route('PATCH', '/players/me', (_pp, body) => ({
    type: 'UPDATE_MY_PLAYER_PROFILE', domain: 'players',
    input: { firstName: body.first_name, lastName: body.last_name },
  })),

  route('POST', '/players/{playerId}/invite', (pp, body) => ({
    type: 'INVITE_PLAYER', domain: 'players',
    input: { playerId: pp.playerId, email: body.email },
  })),

  route('GET', '/players/{playerId}', (pp) => ({
    type: 'GET_PLAYER', domain: 'players',
    input: { playerId: pp.playerId },
  })),

  route('PATCH', '/players/{playerId}', (pp, body) => ({
    type: 'UPDATE_PLAYER', domain: 'players',
    input: { playerId: pp.playerId, ...body },
  })),

  route('POST', '/players/{playerId}/change-club', (pp, body) => ({
    type: 'CHANGE_CLUB', domain: 'players',
    input: {
      playerId:   pp.playerId,
      toClubId:   body.to_club_id,
      fromClubId: body.from_club_id, // opcional — si no se envía, el specialist lo resuelve
    },
  })),

  route('POST', '/players/{playerId}/photo', (pp, body) => ({
    type: 'UPLOAD_PHOTO', domain: 'players',
    input: { playerId: pp.playerId, photoUrl: body.photo_url },
  })),

  // ── Documentos de Jugador ─────────────────────────────────────────────────

  route('GET', '/players/{playerId}/documents', (pp) => ({
    type: 'LIST_DOCUMENTS', domain: 'player_documents',
    input: { playerId: pp.playerId },
  })),

  route('POST', '/players/{playerId}/documents', (pp, body) => ({
    type: 'REGISTER_DOCUMENT', domain: 'player_documents',
    input: {
      playerId:       pp.playerId,
      nombreOriginal: body.nombre_original,
      mimeType:       body.mime_type,
      size:           body.size,
      path:           body.path,
      bucket:         body.bucket,
      urlPublica:     body.url_publica,
    },
  })),

  route('GET', '/players/{playerId}/documents/{documentId}', (pp) => ({
    type: 'GET_DOCUMENT', domain: 'player_documents',
    input: { playerId: pp.playerId, documentId: pp.documentId },
  })),

  route('DELETE', '/players/{playerId}/documents/{documentId}', (pp) => ({
    type: 'DELETE_DOCUMENT', domain: 'player_documents',
    input: { playerId: pp.playerId, documentId: pp.documentId },
  })),

  // ── Categorías ────────────────────────────────────────────────────────────

  route('GET', '/sports', () => ({
    type: 'LIST_SPORTS', domain: 'categories',
    input: {},
  })),

  route('GET', '/clubs/{clubId}/categories', (pp) => ({
    type: 'LIST_CATEGORIES', domain: 'categories',
    input: { clubId: pp.clubId },
  })),

  route('POST', '/clubs/{clubId}/categories', (pp, body) => ({
    type: 'CREATE_CATEGORY', domain: 'categories',
    input: {
      clubId:      pp.clubId,
      name:        body.name,
      color:       body.color,
      ageFrom:     body.age_from,
      ageTo:       body.age_to,
      ageRestriction: body.age_restriction,
      description: body.description,
      sportId:     body.sport_id,
      gender:      body.gender,
      serie:       body.serie,
    },
  })),

  route('PATCH', '/clubs/{clubId}/categories/{categoryId}', (pp, body) => ({
    type: 'UPDATE_CATEGORY', domain: 'categories',
    input: { clubId: pp.clubId, categoryId: pp.categoryId, ...body },
  })),

  route('DELETE', '/clubs/{clubId}/categories/{categoryId}', (pp) => ({
    type: 'DELETE_CATEGORY', domain: 'categories',
    input: { clubId: pp.clubId, categoryId: pp.categoryId },
  })),

  // ── Categorías (mantenedor a nivel de organización, Parámetros) ────────────

  route('GET', '/orgs/{orgId}/categories', (pp) => ({
    type: 'LIST_CATEGORIES', domain: 'categories',
    input: { orgId: pp.orgId },
  })),

  route('POST', '/orgs/{orgId}/categories', (pp, body) => ({
    type: 'CREATE_CATEGORY', domain: 'categories',
    input: {
      orgId:       pp.orgId,
      name:        body.name,
      color:       body.color,
      ageFrom:     body.age_from,
      ageTo:       body.age_to,
      ageRestriction: body.age_restriction,
      description: body.description,
      sportId:     body.sport_id,
      gender:      body.gender,
      serie:       body.serie,
    },
  })),

  route('PATCH', '/categories/{categoryId}', (pp, body) => ({
    type: 'UPDATE_CATEGORY', domain: 'categories',
    input: {
      categoryId:  pp.categoryId,
      name:        body.name,
      color:       body.color,
      ageFrom:     body.age_from,
      ageTo:       body.age_to,
      ageRestriction: body.age_restriction,
      description: body.description,
      sportId:     body.sport_id,
      gender:      body.gender,
      serie:       body.serie,
    },
  })),

  route('DELETE', '/categories/{categoryId}', (pp, _body, qs) => ({
    type: 'DELETE_CATEGORY', domain: 'categories',
    input: { categoryId: pp.categoryId, orgId: qs.org_id },
  })),

  // ── Traspasos y KPIs ───────────────────────────────────────────────────────

  route('POST', '/transfers', (_pp, body, _qs, event) => ({
    type: 'CREATE_TRANSFER', domain: 'transfers',
    input: {
      playerId:          body.player_id ?? body.playerId,
      originClubId:      body.origin_club_id ?? body.from_club_id ?? body.originClubId,
      destinationClubId: body.destination_club_id ?? body.to_club_id ?? body.destinationClubId,
      fee:               body.fee ?? 0,
      notes:             body.notes,
      transferDate:      body.transfer_date ?? body.transferDate,
      requestedBy:       body.requested_by,
    },
  })),

  route('GET', '/transfers', (_pp, _body, qs) => ({
    type: 'LIST_TRANSFERS', domain: 'transfers',
    input: {
      playerId:          qs.player_id ?? qs.playerId,
      originClubId:      qs.origin_club_id ?? qs.from_club_id ?? qs.originClubId,
      destinationClubId: qs.destination_club_id ?? qs.to_club_id ?? qs.destinationClubId,
      status:            qs.status,
      limit:             qs.limit ? parseInt(qs.limit, 10) : 10,
      nextToken:         qs.next_token ?? qs.nextToken,
    },
  })),

  route('GET', '/transfers/kpis/summary', () => ({
    type: 'GET_KPIS_SUMMARY', domain: 'transfers',
    input: {},
  })),

  route('GET', '/transfers/kpis/club/{clubId}', (pp) => ({
    type: 'GET_KPIS_CLUB', domain: 'transfers',
    input: { clubId: pp.clubId },
  })),

  route('GET', '/transfers/{id}', (pp) => ({
    type: 'GET_TRANSFER', domain: 'transfers',
    input: { transferId: pp.id },
  })),

  route('PATCH', '/transfers/{id}/status', (pp, body) => ({
    type: 'UPDATE_TRANSFER_STATUS', domain: 'transfers',
    input: {
      transferId: pp.id,
      status:     body.status,
      approvedBy: body.approved_by ?? body.approvedBy,
      notes:      body.notes,
    },
  })),

  route('GET', '/clubs/{clubId}/transfers', (pp) => ({
    type: 'LIST_TRANSFERS', domain: 'transfers',
    input: { clubId: pp.clubId },
  })),

  route('POST', '/clubs/{clubId}/transfers', (pp, body) => ({
    type: 'CREATE_TRANSFER', domain: 'transfers',
    input: {
      clubId:            pp.clubId,
      originClubId:      pp.clubId,
      destinationClubId: body.to_club_id,
      playerId:          body.player_id,
      notes:             body.notes,
    },
  })),

  route('PATCH', '/clubs/{clubId}/transfers/{transferId}/accept', (pp) => ({
    type: 'ACCEPT_TRANSFER', domain: 'transfers',
    input: { clubId: pp.clubId, transferId: pp.transferId, status: 'APPROVED' },
  })),

  route('PATCH', '/clubs/{clubId}/transfers/{transferId}/reject', (pp) => ({
    type: 'REJECT_TRANSFER', domain: 'transfers',
    input: { clubId: pp.clubId, transferId: pp.transferId, status: 'REJECTED' },
  })),

  route('DELETE', '/clubs/{clubId}/transfers/{transferId}', (pp) => ({
    type: 'CANCEL_TRANSFER', domain: 'transfers',
    input: { clubId: pp.clubId, transferId: pp.transferId, status: 'CANCELLED' },
  })),

  // ── Árbitros ──────────────────────────────────────────────────────────────

  route('GET', '/referees', (_pp, _body, qs) => ({
    type: 'LIST_REFEREES', domain: 'referees',
    input: {
      orgId:     qs.org_id,
      active:    qs.active,
      q:         qs.q,
      limit:     qs.limit ? parseInt(qs.limit, 10) : 20,
      nextToken: qs.next_token,
    },
  })),

  route('POST', '/referees', (_pp, body) => ({
    type: 'CREATE_REFEREE', domain: 'referees',
    input: {
      orgId:    body.org_id,
      fullName: body.full_name,
      phone:    body.phone,
      email:    body.email,
      notes:    body.notes,
      active:   body.active,
    },
  })),

  route('GET', '/referees/{refereeId}', (pp) => ({
    type: 'GET_REFEREE', domain: 'referees',
    input: { refereeId: pp.refereeId },
  })),

  route('PATCH', '/referees/{refereeId}', (pp, body) => ({
    type: 'UPDATE_REFEREE', domain: 'referees',
    input: { refereeId: pp.refereeId, ...body },
  })),

  route('DELETE', '/referees/{refereeId}', (pp) => ({
    type: 'DELETE_REFEREE', domain: 'referees',
    input: { refereeId: pp.refereeId },
  })),

  // ── Canchas ───────────────────────────────────────────────────────────────

  route('GET', '/venues', (_pp, _body, qs) => ({
    type: 'LIST_VENUES', domain: 'venues',
    input: {
      orgId:     qs.org_id,
      status:    qs.status,
      q:         qs.q,
      limit:     qs.limit ? parseInt(qs.limit, 10) : 20,
      nextToken: qs.next_token,
    },
  })),

  route('POST', '/venues', (_pp, body) => ({
    type: 'CREATE_VENUE', domain: 'venues',
    input: {
      orgId:       body.org_id,
      name:        body.name,
      address:     body.address,
      region:      body.region,
      city:        body.city,
      surfaceType: body.surface_type,
      lighting:    body.lighting,
      status:      body.status,
      notes:       body.notes,
    },
  })),

  route('GET', '/venues/{venueId}', (pp) => ({
    type: 'GET_VENUE', domain: 'venues',
    input: { venueId: pp.venueId },
  })),

  route('PATCH', '/venues/{venueId}', (pp, body) => ({
    type: 'UPDATE_VENUE', domain: 'venues',
    input: { venueId: pp.venueId, ...body },
  })),

  route('DELETE', '/venues/{venueId}', (pp) => ({
    type: 'DELETE_VENUE', domain: 'venues',
    input: { venueId: pp.venueId },
  })),

  // ── Agenda de canchas ────────────────────────────────────────────────────

  route('GET', '/venues/{venueId}/availability', (pp) => ({
    type: 'LIST_AVAILABILITY', domain: 'venue_scheduling',
    input: { venueId: pp.venueId },
  })),

  route('POST', '/venues/{venueId}/availability', (pp, body) => ({
    type: 'CREATE_AVAILABILITY', domain: 'venue_scheduling',
    input: {
      venueId:      pp.venueId,
      diaSemana:    body.dia_semana,
      horaApertura: body.hora_apertura,
      horaCierre:   body.hora_cierre,
    },
  })),

  route('DELETE', '/venues/{venueId}/availability/{availabilityId}', (pp) => ({
    type: 'DELETE_AVAILABILITY', domain: 'venue_scheduling',
    input: { availabilityId: pp.availabilityId },
  })),

  route('GET', '/venues/{venueId}/bookings', (pp, _body, qs) => ({
    type: 'LIST_BOOKINGS', domain: 'venue_scheduling',
    input: { venueId: pp.venueId, fecha: qs.fecha },
  })),

  route('POST', '/venues/{venueId}/bookings', (pp, body) => ({
    type: 'CREATE_BOOKING', domain: 'venue_scheduling',
    input: {
      venueId:    pp.venueId,
      fecha:      body.fecha,
      horaInicio: body.hora_inicio,
      horaFin:    body.hora_fin,
      partidoId:  body.partido_id,
    },
  })),

  route('DELETE', '/venues/{venueId}/bookings/{bookingId}', (pp) => ({
    type: 'DELETE_BOOKING', domain: 'venue_scheduling',
    input: { bookingId: pp.bookingId },
  })),

  // ── Temporadas ────────────────────────────────────────────────────────────

  route('GET', '/seasons', (_pp, _body, qs) => ({
    type: 'LIST_SEASONS', domain: 'seasons',
    input: { orgId: qs.org_id, active: qs.active },
  })),

  route('POST', '/seasons', (_pp, body) => ({
    type: 'CREATE_SEASON', domain: 'seasons',
    input: { orgId: body.org_id, name: body.name, year: body.year !== undefined ? Number(body.year) : undefined, active: body.active },
  })),

  route('PATCH', '/seasons/{seasonId}', (pp, body) => ({
    type: 'UPDATE_SEASON', domain: 'seasons',
    input: { seasonId: pp.seasonId, name: body.name, year: body.year !== undefined ? Number(body.year) : undefined, active: body.active },
  })),

  route('POST', '/seasons/{seasonId}/close', (pp, body) => ({
    type: 'CLOSE_SEASON', domain: 'seasons',
    input: { seasonId: pp.seasonId, orgId: body.org_id },
  })),

  route('DELETE', '/seasons/{seasonId}', (pp, _body, qs) => ({
    type: 'DELETE_SEASON', domain: 'seasons',
    input: { seasonId: pp.seasonId, orgId: qs.org_id },
  })),

  // ── Finanzas de Clubes (mantenedor de costos + libro de ingresos/egresos) ──

  route('GET', '/seasons/{seasonId}/cost-catalog', (pp) => ({
    type: 'LIST_COST_CATALOG', domain: 'club_finance',
    input: { seasonId: pp.seasonId },
  })),

  route('PUT', '/seasons/{seasonId}/cost-catalog', (pp, body) => ({
    type: 'UPSERT_COST_CATALOG', domain: 'club_finance',
    input: {
      orgId: body.org_id,
      seasonId: pp.seasonId,
      inscriptionFee: body.inscription_fee !== undefined ? Number(body.inscription_fee) : undefined,
      matchdayFee: body.matchday_fee !== undefined ? Number(body.matchday_fee) : undefined,
    },
  })),

  // ── Catálogo de castigos (Parámetros → Castigos) ────────────────────────

  route('GET', '/penalty-catalog', (_pp, _body, qs) => ({
    type: 'LIST_PENALTY_CATALOG', domain: 'club_finance',
    input: { orgId: qs.org_id },
  })),

  route('POST', '/penalty-catalog', (_pp, body) => ({
    type: 'CREATE_PENALTY_CATALOG_ITEM', domain: 'club_finance',
    input: {
      orgId: body.org_id,
      name: body.name,
      code: body.code,
      description: body.description,
      amount: body.amount !== undefined ? Number(body.amount) : undefined,
      businessRule: body.business_rule,
    },
  })),

  route('PATCH', '/penalty-catalog/{penaltyId}', (pp, body) => ({
    type: 'UPDATE_PENALTY_CATALOG_ITEM', domain: 'club_finance',
    input: {
      penaltyId: pp.penaltyId,
      orgId: body.org_id,
      name: body.name,
      code: body.code,
      description: body.description,
      amount: body.amount !== undefined ? Number(body.amount) : undefined,
      businessRule: body.business_rule,
      active: body.active,
    },
  })),

  route('DELETE', '/penalty-catalog/{penaltyId}', (pp, _body, qs) => ({
    type: 'DELETE_PENALTY_CATALOG_ITEM', domain: 'club_finance',
    input: { penaltyId: pp.penaltyId, orgId: qs.org_id },
  })),

  route('GET', '/ledger-entries', (_pp, _body, qs) => ({
    type: 'LIST_LEDGER_ENTRIES', domain: 'club_finance',
    input: {
      orgId: qs.org_id,
      clubId: qs.club_id,
      seriesId: qs.series_id,
      tournamentId: qs.tournament_id,
      category: qs.category,
      limit: qs.limit ? parseInt(qs.limit, 10) : 50,
    },
  })),

  route('POST', '/ledger-entries', (_pp, body) => ({
    type: 'CREATE_LEDGER_ENTRY', domain: 'club_finance',
    input: {
      orgId: body.org_id,
      clubId: body.club_id,
      seriesId: body.series_id,
      tournamentId: body.tournament_id,
      matchId: body.match_id,
      category: body.category,
      direction: body.direction,
      amount: body.amount !== undefined ? Number(body.amount) : undefined,
      description: body.description,
      dueDate: body.due_date,
    },
  })),

  route('POST', '/ledger-entries/{entryId}/payment', (pp, body) => ({
    type: 'RECORD_PAYMENT', domain: 'club_finance',
    input: { entryId: pp.entryId, amount: body.amount !== undefined ? Number(body.amount) : undefined },
  })),

  route('GET', '/clubs/{clubId}/payment-status', (pp) => ({
    type: 'GET_CLUB_PAYMENT_STATUS', domain: 'club_finance',
    input: { clubId: pp.clubId },
  })),

  route('GET', '/orgs/{orgId}/payment-stats', (pp) => ({
    type: 'GET_PAYMENT_STATS', domain: 'club_finance',
    input: { orgId: pp.orgId },
  })),

  // ── Eventos de club (sobre el módulo financiero) ────────────────────────

  route('POST', '/clubs/{clubId}/events', (pp, body) => ({
    type: 'CREATE_EVENT', domain: 'club_finance',
    input: {
      orgId: body.org_id,
      clubId: pp.clubId,
      name: body.name,
      eventType: body.event_type,
      direction: body.direction,
      eventDate: body.event_date,
      description: body.description,
    },
  })),

  route('GET', '/clubs/{clubId}/events', (pp, _body, qs) => ({
    type: 'LIST_EVENTS', domain: 'club_finance',
    input: { orgId: qs.org_id, clubId: pp.clubId },
  })),

  route('GET', '/events/{eventId}', (pp) => ({
    type: 'GET_EVENT_DETAIL', domain: 'club_finance',
    input: { eventId: pp.eventId },
  })),

  route('PUT', '/events/{eventId}/players', (pp, body) => ({
    type: 'SET_EVENT_PLAYERS', domain: 'club_finance',
    input: { eventId: pp.eventId, charges: body.charges },
  })),

  route('POST', '/events/{eventId}/charges/{chargeId}/payment', (pp, body) => ({
    type: 'RECORD_EVENT_PLAYER_PAYMENT', domain: 'club_finance',
    input: { chargeId: pp.chargeId, amount: body.amount !== undefined ? Number(body.amount) : undefined },
  })),

  route('DELETE', '/events/{eventId}', (pp) => ({
    type: 'DELETE_EVENT', domain: 'club_finance',
    input: { eventId: pp.eventId },
  })),

  // ── Eventos de organización (cargo obligatorio por club, no por jugador) ──

  route('POST', '/org-events', (_pp, body) => ({
    type: 'CREATE_ORG_EVENT', domain: 'club_finance',
    input: {
      orgId: body.org_id,
      seasonId: body.season_id,
      name: body.name,
      description: body.description,
      eventType: body.event_type,
      cost: body.cost !== undefined ? Number(body.cost) : undefined,
      direction: body.direction,
      startDate: body.start_date,
      endDate: body.end_date,
    },
  })),

  route('GET', '/org-events', (_pp, _body, qs) => ({
    type: 'LIST_ORG_EVENTS', domain: 'club_finance',
    input: { orgId: qs.org_id, seasonId: qs.season_id },
  })),

  route('GET', '/org-events/{eventId}', (pp) => ({
    type: 'GET_ORG_EVENT_DETAIL', domain: 'club_finance',
    input: { eventId: pp.eventId },
  })),

  route('PUT', '/org-events/{eventId}/charges/{clubId}/exempt', (pp, body) => ({
    type: 'SET_CLUB_EXEMPT', domain: 'club_finance',
    input: { eventId: pp.eventId, clubId: pp.clubId, isExempt: body.is_exempt, exemptReason: body.exempt_reason },
  })),

  route('POST', '/org-events/{eventId}/charges/{chargeId}/payment', (pp, body) => ({
    type: 'RECORD_ORG_EVENT_CLUB_PAYMENT', domain: 'club_finance',
    input: { chargeId: pp.chargeId, amount: body.amount !== undefined ? Number(body.amount) : undefined, paymentMethod: body.payment_method },
  })),

  route('POST', '/org-events/{eventId}/close', (pp) => ({
    type: 'CLOSE_ORG_EVENT', domain: 'club_finance',
    input: { eventId: pp.eventId },
  })),

  // ── Torneos ───────────────────────────────────────────────────────────────

  route('GET', '/tournaments', (_pp, _body, qs) => ({
    type: 'LIST_TOURNAMENTS', domain: 'tournaments',
    input: {
      orgId:      qs.org_id,
      status:     qs.status,
      categoryId: qs.category_id,
      seasonId:   qs.season_id,
      type:       qs.type,
      limit:      qs.limit ? parseInt(qs.limit, 10) : 20,
      nextToken:  qs.next_token,
    },
  })),

  route('POST', '/tournaments', (_pp, body) => ({
    type: 'CREATE_TOURNAMENT', domain: 'tournaments',
    input: {
      orgId:                 body.org_id,
      categoryId:            body.category_id,
      seasonId:              body.season_id,
      name:                  body.name,
      type:                  body.type,
      format:                body.format,
      status:                body.status,
      inscriptionFee:        body.inscription_fee !== undefined ? Number(body.inscription_fee) : undefined,
      maxTeams:              body.max_teams !== undefined ? Number(body.max_teams) : undefined,
      startDate:             body.start_date,
      endDate:               body.end_date,
      roundsType:            body.rounds_type,
      pointsWin:             body.points_win,
      pointsDraw:            body.points_draw,
      pointsLoss:            body.points_loss,
      groupCount:            body.group_count,
      teamsAdvancePerGroup:  body.teams_advance_per_group,
      twoLeggedKnockout:     body.two_legged_knockout,
      hasThirdPlaceMatch:    body.has_third_place_match,
      hasConsolation:        body.has_consolation,
      consolationName:       body.consolation_name,
      notes:                 body.notes,
    },
  })),

  route('GET', '/tournaments/{tournamentId}', (pp) => ({
    type: 'GET_TOURNAMENT', domain: 'tournaments',
    input: { tournamentId: pp.tournamentId },
  })),

  route('PATCH', '/tournaments/{tournamentId}', (pp, body) => ({
    type: 'UPDATE_TOURNAMENT', domain: 'tournaments',
    input: { tournamentId: pp.tournamentId, ...body },
  })),

  route('DELETE', '/tournaments/{tournamentId}', (pp) => ({
    type: 'DELETE_TOURNAMENT', domain: 'tournaments',
    input: { tournamentId: pp.tournamentId },
  })),

  route('GET', '/tournaments/{tournamentId}/teams', (pp) => ({
    type: 'LIST_TOURNAMENT_TEAMS', domain: 'tournaments',
    input: { tournamentId: pp.tournamentId },
  })),

  route('POST', '/tournaments/{tournamentId}/teams', (pp, body) => ({
    type: 'REGISTER_TEAM', domain: 'tournaments',
    input: { tournamentId: pp.tournamentId, seriesId: body.series_id, groupName: body.group_name, seed: body.seed },
  })),

  route('DELETE', '/tournaments/{tournamentId}/teams/{teamId}', (pp) => ({
    type: 'UNREGISTER_TEAM', domain: 'tournaments',
    input: { tournamentId: pp.tournamentId, teamId: pp.teamId },
  })),

  route('GET', '/tournaments/{tournamentId}/clubs', (pp) => ({
    type: 'LIST_TOURNAMENT_CLUBS', domain: 'tournaments',
    input: { tournamentId: pp.tournamentId },
  })),

  route('POST', '/tournaments/{tournamentId}/clubs', (pp, body) => ({
    type: 'REGISTER_CLUB', domain: 'tournaments',
    input: { tournamentId: pp.tournamentId, clubId: body.club_id },
  })),

  route('DELETE', '/tournaments/{tournamentId}/clubs/{clubId}', (pp) => ({
    type: 'UNREGISTER_CLUB', domain: 'tournaments',
    input: { tournamentId: pp.tournamentId, clubId: pp.clubId },
  })),

  route('GET', '/tournaments/{tournamentId}/stages', (pp) => ({
    type: 'LIST_STAGES', domain: 'tournaments',
    input: { tournamentId: pp.tournamentId },
  })),

  route('POST', '/tournaments/{tournamentId}/fixture/generate', (pp, body) => ({
    type: 'GENERATE_FIXTURE', domain: 'tournaments',
    input: {
      tournamentId:          pp.tournamentId,
      startDate:             body.start_date,
      daysBetweenMatchdays:  body.days_between_matchdays,
      force:                 body.force,
    },
  })),

  route('POST', '/tournaments/{tournamentId}/fixture/generate-knockout', (pp, body) => ({
    type: 'GENERATE_KNOCKOUT_FROM_GROUPS', domain: 'tournaments',
    input: { tournamentId: pp.tournamentId, stageId: body.stage_id },
  })),

  route('POST', '/tournaments/{tournamentId}/consolation/generate', (pp, body) => ({
    type: 'GENERATE_CONSOLATION', domain: 'tournaments',
    input: { tournamentId: pp.tournamentId, teamIds: body.team_ids ?? body.series_ids },
  })),

  route('GET', '/tournaments/{tournamentId}/standings', (pp, _body, qs) => ({
    type: 'GET_STANDINGS', domain: 'tournaments',
    input: { tournamentId: pp.tournamentId, stageId: qs.stage_id, groupName: qs.group_name },
  })),

  route('GET', '/tournaments/{tournamentId}/top-scorers', (pp, _body, qs) => ({
    type: 'GET_TOP_SCORERS', domain: 'matches',
    input: { tournamentId: pp.tournamentId, limit: qs.limit ? parseInt(qs.limit, 10) : undefined },
  })),

  route('GET', '/tournaments/{tournamentId}/fairplay', (pp) => ({
    type: 'GET_FAIRPLAY_RANKING', domain: 'matches',
    input: { tournamentId: pp.tournamentId },
  })),

  // ── Partidos ──────────────────────────────────────────────────────────────

  route('GET', '/tournaments/{tournamentId}/matchdays', (pp, _body, qs) => ({
    type: 'LIST_MATCHDAYS', domain: 'matches',
    input: { tournamentId: pp.tournamentId, stageId: qs.stage_id },
  })),

  route('POST', '/tournaments/{tournamentId}/matchdays', (pp, body) => ({
    type: 'CREATE_MATCHDAY', domain: 'matches',
    input: { tournamentId: pp.tournamentId, stageId: body.stage_id, number: body.number, name: body.name, date: body.date },
  })),

  route('GET', '/tournaments/{tournamentId}/matches', (pp, _body, qs) => ({
    type: 'LIST_MATCHES', domain: 'matches',
    input: {
      tournamentId: pp.tournamentId,
      matchdayId:   qs.matchday_id,
      stageId:      qs.stage_id,
      seriesId:     qs.series_id,
      status:       qs.status,
    },
  })),

  route('GET', '/matches/{matchId}', (pp) => ({
    type: 'GET_MATCH', domain: 'matches',
    input: { matchId: pp.matchId },
  })),

  route('GET', '/venues/{venueId}/time-slots', (pp, _body, qs) => ({
    type: 'GET_VENUE_TIME_SLOTS', domain: 'matches',
    input: {
      venueId:        pp.venueId,
      date:           qs.date,
      excludeMatchId: qs.exclude_match_id,
      blockCount:     qs.block_count ? parseInt(qs.block_count, 10) : undefined,
    },
  })),

  route('PATCH', '/matches/{matchId}/logistics', (pp, body) => ({
    type: 'UPDATE_MATCH_LOGISTICS', domain: 'matches',
    input: {
      matchId:       pp.matchId,
      venueId:       body.venue_id,
      refereeId:     body.referee_id,
      matchDate:     body.match_date,
      matchTime:     body.match_time,
      timeSlot:      body.time_slot,
      observations:  body.observations,
      matchdayId:    body.matchday_id,
      status:        body.status,
    },
  })),

  route('PATCH', '/matches/{matchId}/result', (pp, body) => ({
    type: 'UPDATE_MATCH_RESULT', domain: 'matches',
    input: {
      matchId:            pp.matchId,
      homeScore:          body.home_score,
      awayScore:          body.away_score,
      homePenaltyScore:   body.home_penalty_score,
      awayPenaltyScore:   body.away_penalty_score,
      status:             body.status,
      observations:       body.observations,
    },
  })),

  route('GET', '/matches/{matchId}/events', (pp) => ({
    type: 'LIST_MATCH_EVENTS', domain: 'matches',
    input: { matchId: pp.matchId },
  })),

  route('POST', '/matches/{matchId}/events', (pp, body) => ({
    type: 'ADD_MATCH_EVENT', domain: 'matches',
    input: {
      matchId:   pp.matchId,
      seriesId:  body.series_id,
      playerId:  body.player_id,
      eventType: body.event_type,
      minute:    body.minute,
      notes:     body.notes,
      penaltyId: body.penalty_id,
    },
  })),

  route('DELETE', '/matches/{matchId}/events/{eventId}', (pp) => ({
    type: 'DELETE_MATCH_EVENT', domain: 'matches',
    input: { matchId: pp.matchId, eventId: pp.eventId },
  })),

  // ── Documentos de Partido (Planilla de Control de Partido) ──────────────

  route('GET', '/matches/{matchId}/documents', (pp) => ({
    type: 'LIST_MATCH_DOCUMENTS', domain: 'matches',
    input: { matchId: pp.matchId },
  })),

  route('POST', '/matches/{matchId}/documents', (pp, body) => ({
    type: 'REGISTER_MATCH_DOCUMENT', domain: 'matches',
    input: {
      matchId:        pp.matchId,
      nombreOriginal: body.nombre_original,
      mimeType:       body.mime_type,
      size:           body.size,
      path:           body.path,
      bucket:         body.bucket,
      urlPublica:     body.url_publica,
    },
  })),

  route('DELETE', '/matches/{matchId}/documents/{documentId}', (pp) => ({
    type: 'DELETE_MATCH_DOCUMENT', domain: 'matches',
    input: { matchId: pp.matchId, documentId: pp.documentId },
  })),

  // ── Programación de Fecha (match_scheduling) ─────────────────────────────

  route('POST', '/match-scheduling/preview', (_pp, body) => ({
    type: 'PREVIEW_SCHEDULE', domain: 'match_scheduling',
    input: {
      seasonId: body.season_id,
      date:     body.date,
      venueIds: body.venue_ids,
    },
  })),

  route('POST', '/match-scheduling/apply', (_pp, body) => ({
    type: 'APPLY_SCHEDULE', domain: 'match_scheduling',
    input: {
      seasonId:               body.season_id,
      date:                   body.date,
      orgId:                  body.org_id,
      assignments:            body.assignments,
      failedClubIds:          body.failed_club_ids,
      partiallyFailedClubIds: body.partially_failed_club_ids,
    },
  })),

  // ── Parámetros de Programación (scheduling_settings) ─────────────────────

  route('GET', '/orgs/{orgId}/scheduling-settings', (pp) => ({
    type: 'GET_SCHEDULING_SETTINGS', domain: 'scheduling_settings',
    input: { orgId: pp.orgId },
  })),

  route('PUT', '/orgs/{orgId}/scheduling-settings', (pp, body) => ({
    type: 'UPDATE_SCHEDULING_SETTINGS', domain: 'scheduling_settings',
    input: {
      orgId:                pp.orgId,
      halfDurationMinutes:  body.half_duration_minutes,
      halftimeBreakMinutes: body.halftime_break_minutes,
      turnaroundMinutes:    body.turnaround_minutes,
      defaultStartTime:     body.default_start_time,
    },
  })),

  // ── Panel de Configuración de Administrador (deporte + admins de org) ────
  // Nota: no hay ruta GET /sports acá — ya existe más arriba
  // (LIST_SPORTS, domain 'categories', línea ~428), devuelve el mismo
  // shape { sports: [...] }. Una segunda ruta '/sports' quedaba muerta
  // (el router usa "primera coincidencia gana"), así que este panel
  // reutiliza esa ruta existente en vez de duplicarla.

  route('GET', '/orgs/{orgId}/sport', (pp) => ({
    type: 'GET_ORG_SPORT', domain: 'org',
    input: { orgId: pp.orgId },
  })),

  route('PUT', '/orgs/{orgId}/sport', (pp, body) => ({
    type: 'UPDATE_ORG_SPORT', domain: 'org',
    input: { orgId: pp.orgId, sportId: body.sportId },
  })),

  route('GET', '/orgs/{orgId}/admins', (pp) => ({
    type: 'GET_ORG_ADMINS', domain: 'org',
    input: { orgId: pp.orgId },
  })),

  route('POST', '/orgs/{orgId}/admins', (pp, body) => ({
    type: 'INVITE_ORG_ADMIN', domain: 'org',
    input: {
      orgId:    pp.orgId,
      fullName: body.fullName,
      email:    body.email,
      phone:    body.phone,
      position: body.position,
    },
  })),

  route('DELETE', '/orgs/{orgId}/admins/{adminUserId}', (pp) => ({
    type: 'REMOVE_ORG_ADMIN', domain: 'org',
    input: { orgId: pp.orgId, adminUserId: pp.adminUserId },
  })),

  route('GET', '/auth/org-invite-info', (_pp, _body, qs) => ({
    type: 'ORG_INVITE_INFO', domain: 'auth',
    input: { token: qs?.token },
  })),

  route('POST', '/auth/accept-org-invite', (_pp, body) => ({
    type: 'ACCEPT_ORG_INVITE', domain: 'auth',
    input: { token: body.token, password: body.password },
  })),

  // ── Costos de Torneo ──────────────────────────────────────────────────────

  route('GET', '/matchdays/{matchdayId}/costs', (pp) => ({
    type: 'LIST_MATCHDAY_COSTS', domain: 'tournament_costs',
    input: { matchdayId: pp.matchdayId },
  })),

  route('POST', '/matchdays/{matchdayId}/costs', (pp, body) => ({
    type: 'CREATE_MATCHDAY_COST', domain: 'tournament_costs',
    input: { matchdayId: pp.matchdayId, concept: body.concept, amount: body.amount, notes: body.notes },
  })),

  route('DELETE', '/matchday-costs/{costId}', (pp) => ({
    type: 'DELETE_MATCHDAY_COST', domain: 'tournament_costs',
    input: { costId: pp.costId },
  })),

  route('GET', '/matches/{matchId}/costs', (pp) => ({
    type: 'LIST_MATCH_COSTS', domain: 'tournament_costs',
    input: { matchId: pp.matchId },
  })),

  route('POST', '/matches/{matchId}/costs', (pp, body) => ({
    type: 'CREATE_MATCH_COST', domain: 'tournament_costs',
    input: { matchId: pp.matchId, concept: body.concept, amount: body.amount, notes: body.notes },
  })),

  route('DELETE', '/match-costs/{costId}', (pp) => ({
    type: 'DELETE_MATCH_COST', domain: 'tournament_costs',
    input: { costId: pp.costId },
  })),

  route('GET', '/tournaments/{tournamentId}/costs/summary', (pp) => ({
    type: 'GET_COSTS_SUMMARY', domain: 'tournament_costs',
    input: { tournamentId: pp.tournamentId },
  })),

  // ── Tribunal de Disciplina / Código de Faltas ──────────────────────────

  route('GET', '/disciplinary/articles', (_pp, _body, qs) => ({
    type: 'LIST_ARTICLES', domain: 'disciplinary',
    input: { orgId: qs.org_id, sportId: qs.sport_id, active: qs.active },
  })),

  route('POST', '/disciplinary/articles', (_pp, body) => ({
    type: 'CREATE_ARTICLE', domain: 'disciplinary',
    input: {
      orgId: body.org_id, sportId: body.sport_id, variant: body.variant,
      code: body.code, title: body.title, description: body.description, severity: body.severity,
    },
  })),

  route('PATCH', '/disciplinary/articles/{articleId}', (pp, body) => ({
    type: 'UPDATE_ARTICLE', domain: 'disciplinary',
    input: {
      articleId: pp.articleId, sportId: body.sport_id, variant: body.variant,
      code: body.code, title: body.title, description: body.description,
      severity: body.severity, active: body.active,
    },
  })),

  route('DELETE', '/disciplinary/articles/{articleId}', (pp) => ({
    type: 'DELETE_ARTICLE', domain: 'disciplinary',
    input: { articleId: pp.articleId },
  })),

  route('GET', '/disciplinary/infractions', (_pp, _body, qs) => ({
    type: 'LIST_INFRACTIONS', domain: 'disciplinary',
    input: { orgId: qs.org_id, sportId: qs.sport_id, sanctionedType: qs.sanctioned_type, active: qs.active },
  })),

  route('POST', '/disciplinary/infractions', (_pp, body) => ({
    type: 'CREATE_INFRACTION', domain: 'disciplinary',
    input: {
      orgId: body.org_id, articleId: body.article_id, sportId: body.sport_id, variant: body.variant,
      code: body.code, name: body.name, description: body.description,
      sanctionedType: body.sanctioned_type, sanctionKind: body.sanction_kind,
      defaultQuantity: body.default_quantity !== undefined ? Number(body.default_quantity) : undefined,
      autoTrigger: body.auto_trigger, autoRule: body.auto_rule,
    },
  })),

  route('PATCH', '/disciplinary/infractions/{infractionId}', (pp, body) => ({
    type: 'UPDATE_INFRACTION', domain: 'disciplinary',
    input: {
      infractionId: pp.infractionId, articleId: body.article_id, sportId: body.sport_id, variant: body.variant,
      code: body.code, name: body.name, description: body.description,
      sanctionedType: body.sanctioned_type, sanctionKind: body.sanction_kind,
      defaultQuantity: body.default_quantity !== undefined ? Number(body.default_quantity) : undefined,
      autoTrigger: body.auto_trigger, autoRule: body.auto_rule, active: body.active,
    },
  })),

  route('DELETE', '/disciplinary/infractions/{infractionId}', (pp) => ({
    type: 'DELETE_INFRACTION', domain: 'disciplinary',
    input: { infractionId: pp.infractionId },
  })),

  route('GET', '/clubs/{clubId}/staff', (pp, _body, qs) => ({
    type: 'LIST_TEAM_STAFF', domain: 'disciplinary',
    input: { clubId: pp.clubId, active: qs.active },
  })),

  route('POST', '/clubs/{clubId}/staff', (pp, body) => ({
    type: 'CREATE_TEAM_STAFF', domain: 'disciplinary',
    input: { clubId: pp.clubId, fullName: body.full_name, role: body.role },
  })),

  route('PATCH', '/clubs/{clubId}/staff/{staffId}', (pp, body) => ({
    type: 'UPDATE_TEAM_STAFF', domain: 'disciplinary',
    input: { staffId: pp.staffId, fullName: body.full_name, role: body.role, active: body.active },
  })),

  route('DELETE', '/clubs/{clubId}/staff/{staffId}', (pp) => ({
    type: 'DELETE_TEAM_STAFF', domain: 'disciplinary',
    input: { staffId: pp.staffId },
  })),

  route('GET', '/disciplinary/cases', (_pp, _body, qs) => ({
    type: 'LIST_CASES', domain: 'disciplinary',
    input: {
      orgId: qs.org_id, tournamentId: qs.tournament_id, clubId: qs.club_id,
      status: qs.status, sanctionedType: qs.sanctioned_type,
      limit: qs.limit ? parseInt(qs.limit, 10) : 20, nextToken: qs.next_token,
    },
  })),

  route('GET', '/disciplinary/cases/{caseId}', (pp) => ({
    type: 'GET_CASE', domain: 'disciplinary',
    input: { caseId: pp.caseId },
  })),

  route('POST', '/disciplinary/cases', (_pp, body) => ({
    type: 'CREATE_CASE', domain: 'disciplinary',
    input: {
      orgId: body.org_id, tournamentId: body.tournament_id, matchId: body.match_id, matchEventId: body.match_event_id,
      sanctionedType: body.sanctioned_type, sanctionedId: body.sanctioned_id,
      infractionId: body.infraction_id, articleId: body.article_id,
      source: body.source, title: body.title, description: body.description,
    },
  })),

  route('PATCH', '/disciplinary/cases/{caseId}/status', (pp, body) => ({
    type: 'UPDATE_CASE_STATUS', domain: 'disciplinary',
    input: { caseId: pp.caseId, status: body.status },
  })),

  route('POST', '/disciplinary/cases/{caseId}/resolutions', (pp, body) => ({
    type: 'CREATE_RESOLUTION', domain: 'disciplinary',
    input: {
      caseId: pp.caseId, tournamentId: body.tournament_id,
      sanctionKind: body.sanction_kind, quantity: body.quantity !== undefined ? Number(body.quantity) : undefined,
      startDate: body.start_date, resolutionText: body.resolution_text,
    },
  })),

  route('GET', '/disciplinary/resolutions', (_pp, _body, qs) => ({
    type: 'LIST_RESOLUTIONS', domain: 'disciplinary',
    input: {
      orgId: qs.org_id, sanctionedType: qs.sanctioned_type, sanctionedId: qs.sanctioned_id,
      tournamentId: qs.tournament_id, status: qs.status,
    },
  })),

  route('PATCH', '/disciplinary/resolutions/{resolutionId}/status', (pp, body) => ({
    type: 'UPDATE_RESOLUTION_STATUS', domain: 'disciplinary',
    input: { resolutionId: pp.resolutionId, statusCumplimiento: body.status_cumplimiento },
  })),

  route('GET', '/disciplinary/sanctioned', (_pp, _body, qs) => ({
    type: 'LIST_SANCTIONED', domain: 'disciplinary',
    input: {
      orgId: qs.org_id, tournamentId: qs.tournament_id, clubId: qs.club_id, sanctionedType: qs.sanctioned_type,
      limit: qs.limit ? parseInt(qs.limit, 10) : 20, nextToken: qs.next_token,
    },
  })),

  route('GET', '/disciplinary/eligibility', (_pp, _body, qs) => ({
    type: 'CHECK_ELIGIBILITY', domain: 'disciplinary',
    input: { sanctionedType: qs.sanctioned_type, sanctionedId: qs.sanctioned_id, tournamentId: qs.tournament_id },
  })),

  route('POST', '/matches/{matchId}/disciplinary/evaluate-cards', (pp, body) => ({
    type: 'EVALUATE_CARD_ACCUMULATION', domain: 'disciplinary',
    input: { matchId: pp.matchId, playerId: body.player_id, eventType: body.event_type, matchEventId: body.match_event_id },
  })),

  route('POST', '/matches/{matchId}/disciplinary/process-fulfillment', (pp) => ({
    type: 'PROCESS_MATCHDAY_FULFILLMENT', domain: 'disciplinary',
    input: { matchId: pp.matchId },
  })),
]

// ─── Handler Principal ───────────────────────────────────────────────────────

export const handler = async (event, context) => {
  const method = (
    event.requestContext?.http?.method ??
    event.httpMethod ??
    'GET'
  ).toUpperCase()

  const path = event.rawPath ?? event.path ?? '/'

  // Ruta especial: health check del ADF
  if (method === 'GET' && path === '/adf/health') {
    return adfHealthHandler(event, context)
  }

  // Ruta especial: Documentación OpenAPI / Swagger
  if (method === 'GET' && (path === '/api/docs' || path === '/docs')) {
    return getSwaggerDocs(event, context)
  }

  const qs   = event.queryStringParameters ?? {}
  const body = parseBody(event)
  const { apiKey, bearerToken } = extractHeaders(event)

  for (const r of ROUTES) {
    if (r.method !== method) continue
    const match = path.match(r.regex)
    if (!match) continue

    const pathParams = match.groups ?? {}
    const { type, domain, input } = r.taskFn(pathParams, body, qs, event)

    const task = buildTask({ type, domain, input, event, context })

    const result = await adf.orchestrator.execute(task, {
      apiKey,
      bearerToken,
      ...adf.getRuntime(),
    })

    return taskResultToLambdaResponse(result)
  }

  return errorResponse(`Cannot ${method} ${path}`, 404, 'NOT_FOUND')
}
