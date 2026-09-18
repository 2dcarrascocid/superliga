import apiClient from '../api/index.js';

export const getSchedulingSettings = (orgId) => apiClient.get(`/orgs/${orgId}/scheduling-settings`);

export const updateSchedulingSettings = (orgId, data) =>
  apiClient.put(`/orgs/${orgId}/scheduling-settings`, data);
