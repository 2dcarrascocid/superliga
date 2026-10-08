import apiClient from '../api/index.js';

// ==================== Votaciones ====================
export const listPolls = (orgId, params = {}) =>
  apiClient.get('/polls', { params: { org_id: orgId, ...params } });

export const getPoll = (pollId) => apiClient.get(`/polls/${pollId}`);

// body: { org_id, season_id?, title, description?, options: string[], opens_at?, closes_at, is_secret }
export const createPoll = (data) => apiClient.post('/polls', data);

export const castVote = (pollId, clubId, optionId) =>
  apiClient.post(`/polls/${pollId}/votes`, { club_id: clubId, option_id: optionId }, { meta: { loaderMessage: 'Registrando voto...' } });

export const closePoll = (pollId, resolution) => apiClient.post(`/polls/${pollId}/close`, { resolution });

export const updatePollResolution = (pollId, resolution) => apiClient.put(`/polls/${pollId}/resolution`, { resolution });

export const deletePoll = (pollId) => apiClient.delete(`/polls/${pollId}`);
