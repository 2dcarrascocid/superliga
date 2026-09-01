import { reactive, toRefs } from 'vue';
import { 
  getPlayers, 
  createPlayer, 
  getPlayerById, 
  updatePlayer,
  listPlayersByClub,
  listPlayersByOrg,
  listActivePlayersByOrg,
  listInactivePlayersByOrg,
  createPlayerForClub,
  setPlayerStatus,
  changeClub,
  uploadPhoto
} from '../services/players.service';

const state = reactive({
  items: [],
  current: null,
  loading: false,
  error: null,
  meta: {
    total_registros: 0,
    limit: 10,
    next_token: null
  },
  filters: {
    clubId: null,
    category: null,
  },
});

export const usePlayersStore = () => {
  const setError = (message) => {
    state.error = message;
  };

  const processResponse = (response) => {
    // Backend retorna { data: [...], next_token, total_registros, limit }, pero
    // las rutas servidas por el orquestador ADF envuelven ese payload una vez más
    // en { success, data: {...} }. Desenvolvemos ese nivel extra si está presente.
    const raw = response.data;
    const envelope = (raw && typeof raw === 'object' && 'success' in raw && raw.data) ? raw.data : raw;

    if (envelope && Array.isArray(envelope.data)) {
      state.items = envelope.data;
      state.meta = {
        next_token:      envelope.next_token      ?? null,
        total_registros: envelope.total_registros ?? envelope.data.length,
        limit:           envelope.limit           ?? state.meta.limit,
      };
    } else if (Array.isArray(envelope)) {
      state.items = envelope;
      state.meta = { next_token: null, total_registros: envelope.length, limit: state.meta.limit };
    } else if (envelope && Array.isArray(envelope.items)) {
      state.items = envelope.items;
      state.meta = { next_token: envelope.next_token ?? null, total_registros: envelope.items.length, limit: state.meta.limit };
    } else if (envelope && Array.isArray(envelope.players)) {
      state.items = envelope.players;
      state.meta = { next_token: null, total_registros: envelope.players.length, limit: state.meta.limit };
    } else {
      console.warn('Unexpected players response format:', envelope);
      state.items = [];
    }
  };

  const fetchPlayers = async (params = {}) => {
    state.loading = true;
    state.error = null;
    try {
      const response = await getPlayers({ ...state.filters, ...params });
      processResponse(response);
    } catch (error) {
      setError(error.response?.data?.message || 'Error al cargar jugadores');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const fetchPlayersByClub = async (clubId, params = {}) => {
    state.loading = true;
    state.error = null;
    try {
        const response = await listPlayersByClub(clubId, params);
        processResponse(response);
    } catch (error) {
        setError(error.response?.data?.message || 'Error al cargar jugadores del club');
        throw error;
    } finally {
        state.loading = false;
    }
  };

  const fetchPlayersByOrg = async (orgId, params = {}) => {
      state.loading = true;
      state.error = null;
      try {
          const response = await listPlayersByOrg(orgId, { limit: state.meta.limit, ...params });
          processResponse(response);
      } catch (error) {
          setError(error.response?.data?.message || 'Error al cargar jugadores de la organización');
          throw error;
      } finally {
          state.loading = false;
      }
  };

  const fetchActivePlayersByOrg = async (orgId, params = {}) => {
      state.loading = true;
      state.error = null;
      try {
          const response = await listActivePlayersByOrg(orgId, { limit: state.meta.limit, ...params });
          processResponse(response);
      } catch (error) {
          setError(error.response?.data?.message || 'Error al cargar jugadores activos de la organización');
          throw error;
      } finally {
          state.loading = false;
      }
  };

  const fetchInactivePlayersByOrg = async (orgId, params = {}) => {
      state.loading = true;
      state.error = null;
      try {
          const response = await listInactivePlayersByOrg(orgId, { limit: state.meta.limit, ...params });
          processResponse(response);
      } catch (error) {
          setError(error.response?.data?.message || 'Error al cargar jugadores inactivos de la organización');
          throw error;
      } finally {
          state.loading = false;
      }
  };

  const fetchPlayerById = async (playerId) => {
    state.loading = true;
    state.error = null;
    try {
      const response = await getPlayerById(playerId);
      const inner = response.data?.data ?? response.data;
      state.current = inner?.player ?? inner;
    } catch (error) {
      setError(error.response?.data?.message || 'Error al cargar jugador');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const createOrUpdatePlayer = async (payload, clubId = null) => {
    state.loading = true;
    state.error = null;
    try {
      if (payload.id) {
        const response = await updatePlayer(payload.id, payload);
        const inner = response.data?.data ?? response.data;
        const player = inner?.player ?? inner;
        state.current = player;
        const index = state.items.findIndex((p) => p.id === payload.id);
        if (index !== -1) {
          state.items[index] = { ...state.items[index], ...player };
        }
        return player;
      }
      
      let response;
      if (clubId) {
          response = await createPlayerForClub(clubId, payload);
      } else {
          response = await createPlayer(payload);
      }

      return response.data;
    } catch (error) {
      setError(error.response?.data?.message || 'Error al guardar jugador');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const updatePlayerStatus = async (clubId, playerId, statusPayload) => {
      state.loading = true;
      state.error = null;
      try {
          const response = await setPlayerStatus(clubId, playerId, statusPayload);
          // Update in list if exists
          const index = state.items.findIndex((p) => p.id === playerId);
          if (index !== -1) {
              state.items[index] = { ...state.items[index], ...response.data };
          }
           // Update current if matches
           if (state.current && state.current.id === playerId) {
               state.current = { ...state.current, ...response.data };
           }
          return response.data;
      } catch (error) {
          setError(error.response?.data?.message || 'Error al actualizar estado del jugador');
          throw error;
      } finally {
          state.loading = false;
      }
  };

  const changePlayerClub = async (playerId, payload) => {
      state.loading = true;
      state.error = null;
      try {
          const response = await changeClub(playerId, payload);
          return response.data;
      } catch (error) {
          setError(error.response?.data?.message || 'Error al cambiar de club');
          throw error;
      } finally {
          state.loading = false;
      }
  };

  const uploadPlayerPhoto = async (playerId, filePayload) => {
      state.loading = true;
      state.error = null;
      try {
          const response = await uploadPhoto(playerId, filePayload);
           // Update current if matches
           if (state.current && state.current.id === playerId) {
              // Assuming response contains the updated player or photo url
               // If response structure is different, adjust accordingly. 
               // Often upload returns the updated resource or just the url.
               // Let's assume it returns updated player object for now based on other endpoints.
              if (response.data && response.data.photo_url) {
                  state.current.photo_url = response.data.photo_url;
              }
           }
          return response.data;
      } catch (error) {
          setError(error.response?.data?.message || 'Error al subir foto');
          throw error;
      } finally {
          state.loading = false;
      }
  };

  const setFilters = (filters) => {
    state.filters = { ...state.filters, ...filters };
  };

  return {
    ...toRefs(state),
    fetchPlayers,
    fetchPlayersByClub,
    fetchPlayersByOrg,
    fetchActivePlayersByOrg,
    fetchInactivePlayersByOrg,
    fetchPlayerById,
    createOrUpdatePlayer,
    updatePlayerStatus,
    changePlayerClub,
    uploadPlayerPhoto,
    setFilters
  };
};
