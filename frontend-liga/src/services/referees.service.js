import apiClient from '../api/index.js';

export const getReferees = (params) => apiClient.get('/referees', { params });

export const createReferee = (data) => apiClient.post('/referees', data);

export const getRefereeById = (refereeId) => apiClient.get(`/referees/${refereeId}`);

export const updateReferee = (refereeId, data) => apiClient.patch(`/referees/${refereeId}`, data);

export const deleteReferee = (refereeId) => apiClient.delete(`/referees/${refereeId}`);
