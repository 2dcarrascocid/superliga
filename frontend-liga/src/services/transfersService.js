import apiClient from '../api/index.js';

export const transfersService = {
  /**
   * Listar transferencias con paginación por token y filtros opcionales
   * @param {Object} params - { player_id, origin_club_id, destination_club_id, status, limit, next_token }
   */
  async getTransfers(params = {}) {
    const response = await apiClient.get('/transfers', { params });
    // Soporta { data: { data, next_token, total_registros, limit } } o { data, next_token, ... }
    const result = response.data?.data ?? response.data;
    return result;
  },

  /**
   * Obtener el detalle de una transferencia específica por su ID
   * @param {string} id
   */
  async getTransferById(id) {
    const response = await apiClient.get(`/transfers/${id}`);
    return response.data?.data?.transfer ?? response.data?.transfer ?? response.data;
  },

  /**
   * Solicitar/crear una nueva transferencia de jugador
   * @param {Object} payload - { player_id, origin_club_id, destination_club_id, fee, notes, transfer_date }
   */
  async createTransfer(payload) {
    const response = await apiClient.post('/transfers', payload);
    return response.data?.data?.transfer ?? response.data?.transfer ?? response.data;
  },

  /**
   * Cambiar el estado de una transferencia (APPROVED, REJECTED, CANCELLED)
   * @param {string} id
   * @param {string} status - APPROVED | REJECTED | CANCELLED
   * @param {string} [notes]
   */
  async updateTransferStatus(id, status, notes = '') {
    const response = await apiClient.patch(`/transfers/${id}/status`, { status, notes });
    return response.data?.data?.transfer ?? response.data?.transfer ?? response.data;
  },

  /**
   * Obtener métricas globales y resumen de KPIs del período/temporada
   */
  async getSummaryKpis() {
    const response = await apiClient.get('/transfers/kpis/summary');
    return response.data?.data?.summary ?? response.data?.summary ?? response.data;
  },

  /**
   * Obtener indicadores de transferencias específicos para un club
   * @param {string} clubId
   */
  async getClubKpis(clubId) {
    const response = await apiClient.get(`/transfers/kpis/club/${clubId}`);
    return response.data?.data?.club_kpis ?? response.data?.club_kpis ?? response.data;
  },
};

export default transfersService;
