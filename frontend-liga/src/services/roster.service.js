import apiClient from '../api';

export const getRosterByClub = (clubId) => apiClient.get(`/clubs/${clubId}/roster`);

export const addToRoster = (clubId, data) => apiClient.post(`/clubs/${clubId}/roster`, data);

export const updateRosterEntry = (clubId, rosterId, data) => apiClient.patch(`/clubs/${clubId}/roster/${rosterId}`, data);

