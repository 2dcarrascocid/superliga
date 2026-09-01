import apiClient from '../api/index.js';

export const getMatchdayCosts = (matchdayId) => apiClient.get(`/matchdays/${matchdayId}/costs`);
export const createMatchdayCost = (matchdayId, data) => apiClient.post(`/matchdays/${matchdayId}/costs`, data);
export const deleteMatchdayCost = (costId) => apiClient.delete(`/matchday-costs/${costId}`);

export const getMatchCosts = (matchId) => apiClient.get(`/matches/${matchId}/costs`);
export const createMatchCost = (matchId, data) => apiClient.post(`/matches/${matchId}/costs`, data);
export const deleteMatchCost = (costId) => apiClient.delete(`/match-costs/${costId}`);

export const getCostsSummary = (tournamentId) => apiClient.get(`/tournaments/${tournamentId}/costs/summary`);
