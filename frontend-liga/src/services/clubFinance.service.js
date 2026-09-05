import apiClient from '../api/index.js';

// Mantenedor de costos (por temporada)
export const getCostCatalog = (seasonId) => apiClient.get(`/seasons/${seasonId}/cost-catalog`);
export const upsertCostCatalog = (seasonId, data) => apiClient.put(`/seasons/${seasonId}/cost-catalog`, data);

// Libro de ingresos y egresos
export const getLedgerEntries = (params) => apiClient.get('/ledger-entries', { params });
export const createLedgerEntry = (data) => apiClient.post('/ledger-entries', data);
export const recordPayment = (entryId, data) => apiClient.post(`/ledger-entries/${entryId}/payment`, data);

// Estado de pago / estadísticas
export const getClubPaymentStatus = (clubId) => apiClient.get(`/clubs/${clubId}/payment-status`);
export const getPaymentStats = (orgId) => apiClient.get(`/orgs/${orgId}/payment-stats`);

// Eventos de club (fecha de partido, colecta, compra de implementos) —
// se reparten entre jugadores con un monto individual cada uno (charges).
export const createClubEvent = (clubId, data) => apiClient.post(`/clubs/${clubId}/events`, data);
export const listClubEvents = (clubId, params) => apiClient.get(`/clubs/${clubId}/events`, { params });
export const getEventDetail = (eventId) => apiClient.get(`/events/${eventId}`);
export const setEventPlayers = (eventId, data) => apiClient.put(`/events/${eventId}/players`, data);
export const recordEventPlayerPayment = (eventId, chargeId, data) => apiClient.post(`/events/${eventId}/charges/${chargeId}/payment`, data);
export const deleteClubEvent = (eventId) => apiClient.delete(`/events/${eventId}`);
