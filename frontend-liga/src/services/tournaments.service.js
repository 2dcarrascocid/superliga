import apiClient from '../api/index.js';

export const getTournaments = (params) => apiClient.get('/tournaments', { params });
export const getClubActiveTournaments = (clubId, params) => apiClient.get(`/clubs/${clubId}/active-tournaments`, { params });
export const getClubTournamentDetail = (clubId, tournamentId) => apiClient.get(`/clubs/${clubId}/tournaments/${tournamentId}`);
export const getSeriesTournamentEligibility = (clubId, seriesId, tournamentId) => apiClient.get(`/clubs/${clubId}/series/${seriesId}/tournaments/${tournamentId}/eligibility`);
export const registerSeriesInTournament = (clubId, seriesId, tournamentId, data = {}) => apiClient.post(`/clubs/${clubId}/series/${seriesId}/tournaments/${tournamentId}/registration`, data);
export const createTournament = (data) => apiClient.post('/tournaments', data);
export const getTournamentById = (tournamentId) => apiClient.get(`/tournaments/${tournamentId}`);
export const updateTournament = (tournamentId, data) => apiClient.patch(`/tournaments/${tournamentId}`, data);
export const deleteTournament = (tournamentId) => apiClient.delete(`/tournaments/${tournamentId}`);

export const getTournamentTeams = (tournamentId) => apiClient.get(`/tournaments/${tournamentId}/teams`);
export const registerTeam = (tournamentId, data) => apiClient.post(`/tournaments/${tournamentId}/teams`, data);
export const unregisterTeam = (tournamentId, teamId) => apiClient.delete(`/tournaments/${tournamentId}/teams/${teamId}`);

// Clubes inscritos al torneo (gate previo a inscribir series/equipos)
export const getTournamentClubs = (tournamentId) => apiClient.get(`/tournaments/${tournamentId}/clubs`);
export const registerClub = (tournamentId, clubId) => apiClient.post(`/tournaments/${tournamentId}/clubs`, { club_id: clubId });
export const unregisterClub = (tournamentId, clubId) => apiClient.delete(`/tournaments/${tournamentId}/clubs/${clubId}`);

export const getStages = (tournamentId) => apiClient.get(`/tournaments/${tournamentId}/stages`);

export const generateFixture = (tournamentId, data) => apiClient.post(`/tournaments/${tournamentId}/fixture/generate`, data);
export const generateKnockoutFromGroups = (tournamentId, data) => apiClient.post(`/tournaments/${tournamentId}/fixture/generate-knockout`, data);
export const generateConsolation = (tournamentId, data) => apiClient.post(`/tournaments/${tournamentId}/consolation/generate`, data);

export const getStandings = (tournamentId, params) => apiClient.get(`/tournaments/${tournamentId}/standings`, { params });
