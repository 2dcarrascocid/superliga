import apiClient from '../api';

// Listados
export const getPlayers = (params) => apiClient.get('/players', { params });
export const listPlayersByClub = (clubId, params) => apiClient.get(`/clubs/${clubId}/players`, { params });
export const listPlayersByOrg = (orgId, params) => apiClient.get(`/orgs/${orgId}/players`, { params });
export const listActivePlayersByOrg = (orgId, params) => apiClient.get(`/orgs/${orgId}/players/active`, { params });
export const listInactivePlayersByOrg = (orgId, params) => apiClient.get(`/orgs/${orgId}/players/inactive`, { params });

// Folios disponibles
export const getAvailableFolios = (clubId) => apiClient.get(`/clubs/${clubId}/available-folios`);

// Detalle
export const getPlayerById = (playerId) => apiClient.get(`/players/${playerId}`);

// Creación
export const createPlayer = (data) => apiClient.post('/players', data);
export const createPlayerForClub = (clubId, data) => apiClient.post(`/clubs/${clubId}/players`, data);

// Edición
export const updatePlayer = (playerId, data) => apiClient.patch(`/players/${playerId}`, data);

// Estado en club
export const setPlayerStatus = (clubId, playerId, data) => apiClient.patch(`/clubs/${clubId}/players/${playerId}/status`, data);

// Cambio de club
export const changeClub = (playerId, data) => apiClient.post(`/players/${playerId}/change-club`, data);

// Foto
export const uploadPhoto = (playerId, data) => {
    const formData = new FormData();
    formData.append('file', data);
    return apiClient.post(`/players/${playerId}/photo`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
};

// ==================== Rol Jugador ====================
// Invitar a un jugador a vincular su acceso (club admin / org admin).
export const invitePlayerAccess = (playerId, email) => apiClient.post(`/players/${playerId}/invite`, { email });

// Perfil propio del usuario logueado como Jugador.
export const getMyPlayerProfile = () => apiClient.get('/players/me');
export const updateMyPlayerProfile = (data) => apiClient.patch('/players/me', data);
