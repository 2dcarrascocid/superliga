import apiClient from '../api/index.js';

// ==================== Reglamento (Artículos) ====================
export const listArticles = (orgId, params = {}) =>
  apiClient.get('/disciplinary/articles', { params: { org_id: orgId, ...params } });

export const createArticle = (data) => apiClient.post('/disciplinary/articles', data);

export const updateArticle = (articleId, data) => apiClient.patch(`/disciplinary/articles/${articleId}`, data);

export const deleteArticle = (articleId) => apiClient.delete(`/disciplinary/articles/${articleId}`);

// ==================== Catálogo de faltas tipificadas ====================
export const listInfractions = (orgId, params = {}) =>
  apiClient.get('/disciplinary/infractions', { params: { org_id: orgId, ...params } });

export const createInfraction = (data) => apiClient.post('/disciplinary/infractions', data);

export const updateInfraction = (infractionId, data) => apiClient.patch(`/disciplinary/infractions/${infractionId}`, data);

export const deleteInfraction = (infractionId) => apiClient.delete(`/disciplinary/infractions/${infractionId}`);

// ==================== Cuerpo técnico / dirigentes ====================
export const listTeamStaff = (clubId, params = {}) => apiClient.get(`/clubs/${clubId}/staff`, { params });

export const createTeamStaff = (clubId, data) => apiClient.post(`/clubs/${clubId}/staff`, data);

export const updateTeamStaff = (clubId, staffId, data) => apiClient.patch(`/clubs/${clubId}/staff/${staffId}`, data);

export const deleteTeamStaff = (clubId, staffId) => apiClient.delete(`/clubs/${clubId}/staff/${staffId}`);

// ==================== Expedientes (Casos) ====================
export const listCases = (orgId, params = {}) =>
  apiClient.get('/disciplinary/cases', { params: { org_id: orgId, ...params } });

export const getCase = (caseId) => apiClient.get(`/disciplinary/cases/${caseId}`);

export const createCase = (data) => apiClient.post('/disciplinary/cases', data);

export const updateCaseStatus = (caseId, status) => apiClient.patch(`/disciplinary/cases/${caseId}/status`, { status });

// ==================== Resoluciones (boletín oficial) ====================
export const createResolution = (caseId, data) => apiClient.post(`/disciplinary/cases/${caseId}/resolutions`, data);

export const listResolutions = (orgId, params = {}) =>
  apiClient.get('/disciplinary/resolutions', { params: { org_id: orgId, ...params } });

export const updateResolutionStatus = (resolutionId, statusCumplimiento) =>
  apiClient.patch(`/disciplinary/resolutions/${resolutionId}/status`, { status_cumplimiento: statusCumplimiento });

// ==================== Consulta pública / habilitación ====================
export const listSanctioned = (orgId, params = {}) =>
  apiClient.get('/disciplinary/sanctioned', { params: { org_id: orgId, ...params } });

export const checkEligibility = (sanctionedType, sanctionedId, tournamentId) =>
  apiClient.get('/disciplinary/eligibility', {
    params: { sanctioned_type: sanctionedType, sanctioned_id: sanctionedId, tournament_id: tournamentId },
  });

// ==================== Motor (uso desde la Planilla de Control de Partido) ====================
// matchEventId: id del evento (lg_match_events) que disparó la evaluación —
// se usa como llave de idempotencia en el backend, evita duplicar el
// expediente automático si se reintenta la llamada.
export const evaluateCardAccumulation = (matchId, playerId, eventType, matchEventId) =>
  apiClient.post(`/matches/${matchId}/disciplinary/evaluate-cards`, { player_id: playerId, event_type: eventType, match_event_id: matchEventId });

export const processMatchdayFulfillment = (matchId) =>
  apiClient.post(`/matches/${matchId}/disciplinary/process-fulfillment`);
