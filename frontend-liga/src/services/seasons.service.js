import apiClient from '../api/index.js';

export const getSeasons = (params) => apiClient.get('/seasons', { params });
export const createSeason = (data) => apiClient.post('/seasons', data);
export const updateSeason = (seasonId, data) => apiClient.patch(`/seasons/${seasonId}`, data);
export const deleteSeason = (seasonId, params) => apiClient.delete(`/seasons/${seasonId}`, { params });
