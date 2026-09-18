import apiClient from '../api/index.js';

export const previewSchedule = (data) => apiClient.post('/match-scheduling/preview', data);
export const applySchedule = (data) => apiClient.post('/match-scheduling/apply', data);
