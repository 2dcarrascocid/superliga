import apiClient from '../api/index.js';

export const listTransfers   = (clubId)                      => apiClient.get(`/clubs/${clubId}/transfers`);
export const createTransfer  = (clubId, data)                => apiClient.post(`/clubs/${clubId}/transfers`, data);
export const acceptTransfer  = (clubId, transferId)          => apiClient.patch(`/clubs/${clubId}/transfers/${transferId}/accept`);
export const rejectTransfer  = (clubId, transferId)          => apiClient.patch(`/clubs/${clubId}/transfers/${transferId}/reject`);
export const cancelTransfer  = (clubId, transferId)          => apiClient.delete(`/clubs/${clubId}/transfers/${transferId}`);
