import apiClient from '../api/index.js';

export const getAvailability = (venueId) => apiClient.get(`/venues/${venueId}/availability`);

export const createAvailability = (venueId, data) => apiClient.post(`/venues/${venueId}/availability`, data);

export const deleteAvailability = (venueId, availabilityId) =>
  apiClient.delete(`/venues/${venueId}/availability/${availabilityId}`);

export const getBookings = (venueId, fecha) =>
  apiClient.get(`/venues/${venueId}/bookings`, { params: { fecha } });

export const createBooking = (venueId, data) => apiClient.post(`/venues/${venueId}/bookings`, data);

export const deleteBooking = (venueId, bookingId) =>
  apiClient.delete(`/venues/${venueId}/bookings/${bookingId}`);
