import apiClient from '../api';

export const requestLoan = (playerId, data) => apiClient.post(`/players/${playerId}/loan`, data);

export const approveLoan = (loanId) => apiClient.post(`/loans/${loanId}/approve`);

export const rejectLoan = (loanId) => apiClient.post(`/loans/${loanId}/reject`);

export const returnLoan = (loanId) => apiClient.post(`/loans/${loanId}/return`);

