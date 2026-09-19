import { reactive, toRefs } from 'vue';
import {
  listPenalties,
  createPenalty as createPenaltyApi,
  updatePenalty as updatePenaltyApi,
  deletePenalty as deletePenaltyApi,
} from '../services/penaltyCatalog.service';

const state = reactive({
  items: [],
  loading: false,
  error: null,
});

const unwrap = (response) => {
  const envelope = response.data;
  return envelope?.data ?? envelope;
};

export const usePenaltyCatalogStore = () => {
  const setError = (message) => {
    state.error = message;
  };

  const fetchPenalties = async (orgId) => {
    state.loading = true;
    state.error = null;
    try {
      const data = unwrap(await listPenalties(orgId));
      state.items = data?.penalties ?? [];
      return state.items;
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al cargar el catálogo de castigos');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const createPenalty = async (orgId, payload) => {
    state.loading = true;
    state.error = null;
    try {
      const data = unwrap(await createPenaltyApi({ org_id: orgId, ...payload }));
      await fetchPenalties(orgId);
      return data.penalty;
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al crear el castigo');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const updatePenalty = async (penaltyId, orgId, payload) => {
    state.loading = true;
    state.error = null;
    try {
      const data = unwrap(await updatePenaltyApi(penaltyId, { org_id: orgId, ...payload }));
      await fetchPenalties(orgId);
      return data.penalty;
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al actualizar el castigo');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const deletePenalty = async (penaltyId, orgId) => {
    state.loading = true;
    state.error = null;
    try {
      const data = unwrap(await deletePenaltyApi(penaltyId, orgId));
      await fetchPenalties(orgId);
      return data;
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al eliminar el castigo');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  return {
    ...toRefs(state),
    state,
    fetchPenalties,
    createPenalty,
    updatePenalty,
    deletePenalty,
  };
};
