import { reactive, toRefs } from 'vue';
import { getReferees, createReferee, getRefereeById, updateReferee, deleteReferee as deleteRefereeApi } from '../services/referees.service';

const state = reactive({
  items: [],
  current: null,
  loading: false,
  error: null,
  meta: {
    limit: 20,
    next_token: null,
    total_registros: 0,
  },
});

export const useRefereesStore = () => {
  const setError = (message) => {
    state.error = message;
  };

  const fetchReferees = async (params) => {
    state.loading = true;
    state.error = null;
    try {
      const response = await getReferees(params);
      const envelope = response.data;
      const data = envelope?.data ?? envelope;

      if (Array.isArray(data)) {
        state.items = data;
        state.meta.next_token = null;
        state.meta.total_registros = data.length;
      } else if (data && Array.isArray(data.referees)) {
        state.items = data.referees;
        state.meta.next_token = data.nextToken ?? data.next_token ?? null;
        state.meta.total_registros = data.referees.length;
      } else {
        console.warn('Unexpected referees response format:', data);
        state.items = [];
        state.meta.next_token = null;
      }
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al cargar árbitros');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const fetchRefereeById = async (refereeId) => {
    state.loading = true;
    state.error = null;
    try {
      const response = await getRefereeById(refereeId);
      const inner = response.data?.data ?? response.data;
      state.current = inner?.referee ?? inner;
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al cargar árbitro');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const createOrUpdateReferee = async (payload) => {
    state.loading = true;
    state.error = null;
    try {
      if (payload.id) {
        const response = await updateReferee(payload.id, payload);
        const inner = response.data?.data ?? response.data;
        const referee = inner?.referee ?? inner;
        state.current = referee;
        const index = state.items.findIndex((r) => r.id === payload.id);
        if (index !== -1) state.items[index] = referee;
        return referee;
      }
      const response = await createReferee(payload);
      const inner = response.data?.data ?? response.data;
      const referee = inner?.referee ?? inner;
      state.items.push(referee);
      return referee;
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al guardar árbitro');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const removeReferee = async (refereeId) => {
    state.loading = true;
    state.error = null;
    try {
      await deleteRefereeApi(refereeId);
      state.items = state.items.filter((r) => r.id !== refereeId);
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al eliminar árbitro');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  return {
    ...toRefs(state),
    state,
    fetchReferees,
    fetchRefereeById,
    createOrUpdateReferee,
    removeReferee,
  };
};
