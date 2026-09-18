import apiClient from '../api/index.js';

export const getSports = () => apiClient.get('/sports');

export const getOrgSport = (orgId) => apiClient.get(`/orgs/${orgId}/sport`);

export const updateOrgSport = (orgId, sportId) =>
  apiClient.put(`/orgs/${orgId}/sport`, { sportId });

export const getOrgAdmins = (orgId) => apiClient.get(`/orgs/${orgId}/admins`);

export const inviteOrgAdmin = (orgId, payload) =>
  apiClient.post(`/orgs/${orgId}/admins`, payload);

export const removeOrgAdmin = (orgId, adminUserId) =>
  apiClient.delete(`/orgs/${orgId}/admins/${adminUserId}`);
