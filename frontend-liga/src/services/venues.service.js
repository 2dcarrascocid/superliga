import apiClient from '../api/index.js';

export const getVenues = (params) => apiClient.get('/venues', { params });

export const createVenue = (data) => apiClient.post('/venues', data);

export const getVenueById = (venueId) => apiClient.get(`/venues/${venueId}`);

export const updateVenue = (venueId, data) => apiClient.patch(`/venues/${venueId}`, data);

export const deleteVenue = (venueId) => apiClient.delete(`/venues/${venueId}`);
