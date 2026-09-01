import apiClient from '../api/index.js';

export const getClubSeries = (clubId) => apiClient.get(`/clubs/${clubId}/series`);
export const createSeries = (clubId, data) => apiClient.post(`/clubs/${clubId}/series`, data);

export const searchSeries = (params) => apiClient.get('/series', { params });
export const getSeriesById = (seriesId) => apiClient.get(`/series/${seriesId}`);
export const updateSeries = (seriesId, data) => apiClient.patch(`/series/${seriesId}`, data);
export const deleteSeries = (seriesId) => apiClient.delete(`/series/${seriesId}`);

export const getSeriesRoster = (seriesId) => apiClient.get(`/series/${seriesId}/roster`);
export const assignPlayerToSeries = (seriesId, playerId) => apiClient.post(`/series/${seriesId}/players/${playerId}`);
export const unassignPlayerFromSeries = (seriesId, playerId) => apiClient.delete(`/series/${seriesId}/players/${playerId}`);
