import apiClient from '../api';

export const getClubs = (params) => apiClient.get('/clubs', { params });

export const createClub = (data) => apiClient.post('/clubs', data);

export const getClubById = (clubId) => apiClient.get(`/clubs/${clubId}`);

export const getClubKpis = (clubId) => apiClient.get(`/clubs/${clubId}/kpis`);

export const updateClub = (clubId, data) => apiClient.patch(`/clubs/${clubId}`, data);

export const addClubUser = (clubId, data) => apiClient.post(`/clubs/${clubId}/users`, data);

export const removeClubUser = (clubId, userId) => apiClient.delete(`/clubs/${clubId}/users/${userId}`);

export const inviteClubAdmin   = (clubId, data)        => apiClient.post(`/clubs/${clubId}/admins`, data);
export const getClubAdmins     = (clubId)               => apiClient.get(`/clubs/${clubId}/admins`);
export const removeClubAdmin   = (clubId, adminUserId)  => apiClient.delete(`/clubs/${clubId}/admins/${adminUserId}`);

