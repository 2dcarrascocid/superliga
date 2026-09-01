import { reactive, toRefs } from 'vue';
import { getRosterByClub, addToRoster, updateRosterEntry } from '../services/roster.service';

const state = reactive({
  items: [],
  loading: false,
  error: null,
  clubId: null,
  limit: 70,
});

export const useRosterStore = () => {
  const setError = (message) => {
    state.error = message;
  };

  const fetchRoster = async (clubId) => {
    state.loading = true;
    state.error = null;
    state.clubId = clubId;
    try {
      const response = await getRosterByClub(clubId);
      // Backend retorna { success, data: { data: [...], ... } }
      const envelope = response.data;
      const data = envelope?.data ?? envelope;

      if (Array.isArray(data)) {
        state.items = data;
      } else if (data && Array.isArray(data.data)) {
        state.items = data.data;
      } else if (data && Array.isArray(data.roster)) {
        state.items = data.roster;
      } else if (data && Array.isArray(data.items)) {
        state.items = data.items;
      } else {
        console.warn('Unexpected roster response format:', data);
        state.items = [];
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Error al cargar roster');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const addPlayerToRoster = async (clubId, data) => {
    state.loading = true;
    state.error = null;
    try {
      const response = await addToRoster(clubId, data);
      state.items.push(response.data);
      return response.data;
    } catch (error) {
      setError(error.response?.data?.message || 'Error al agregar jugador al roster');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const updateRosterStatus = async (clubId, rosterId, data) => {
    state.loading = true;
    state.error = null;
    try {
      const response = await updateRosterEntry(clubId, rosterId, data);
      const index = state.items.findIndex((r) => r.id === rosterId);
      if (index !== -1) {
        state.items[index] = response.data;
      }
      return response.data;
    } catch (error) {
      setError(error.response?.data?.message || 'Error al actualizar jugador del roster');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  return {
    ...toRefs(state),
    state,
    fetchRoster,
    addPlayerToRoster,
    updateRosterStatus,
  };
};

