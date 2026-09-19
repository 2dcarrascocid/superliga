import apiClient from '../api/index.js';

export const listPenalties = (orgId) => apiClient.get('/penalty-catalog', { params: { org_id: orgId } });

export const createPenalty = (data) => apiClient.post('/penalty-catalog', data);

export const updatePenalty = (penaltyId, data) => apiClient.patch(`/penalty-catalog/${penaltyId}`, data);

export const deletePenalty = (penaltyId, orgId) =>
  apiClient.delete(`/penalty-catalog/${penaltyId}`, { params: { org_id: orgId } });
