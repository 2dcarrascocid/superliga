import apiClient from '../api/index.js';

export const getMatchdays = (tournamentId, params) => apiClient.get(`/tournaments/${tournamentId}/matchdays`, { params });
export const createMatchday = (tournamentId, data) => apiClient.post(`/tournaments/${tournamentId}/matchdays`, data);

export const getMatches = (tournamentId, params) => apiClient.get(`/tournaments/${tournamentId}/matches`, { params });
export const getMatchById = (matchId) => apiClient.get(`/matches/${matchId}`);
export const updateMatchLogistics = (matchId, data) => apiClient.patch(`/matches/${matchId}/logistics`, data);
export const updateMatchResult = (matchId, data) => apiClient.patch(`/matches/${matchId}/result`, data);

export const getMatchEvents = (matchId) => apiClient.get(`/matches/${matchId}/events`);
export const addMatchEvent = (matchId, data) => apiClient.post(`/matches/${matchId}/events`, data);
export const deleteMatchEvent = (matchId, eventId) => apiClient.delete(`/matches/${matchId}/events/${eventId}`);

export const getTopScorers = (tournamentId) => apiClient.get(`/tournaments/${tournamentId}/top-scorers`);
export const getFairplayRanking = (tournamentId) => apiClient.get(`/tournaments/${tournamentId}/fairplay`);
