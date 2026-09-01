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
