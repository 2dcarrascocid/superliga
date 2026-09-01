import { reactive, toRefs } from 'vue';
import { getSeasons, createSeason, updateSeason, deleteSeason as deleteSeasonApi } from '../services/seasons.service';

const state = reactive({
  items: [],
  loading: false,
  error: null,
});

export const useSeasonsStore = () => {
  const setError = (message) => {
    state.error = message;
  };

  const fetchSeasons = async (params) => {
    state.loading = true;
    state.error = null;
    try {
      const response = await getSeasons(params);
      const envelope = response.data;
      const data = envelope?.data ?? envelope;
      state.items = data?.seasons ?? [];
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al cargar temporadas');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const createOrUpdateSeason = async (payload) => {
    state.loading = true;
    state.error = null;
    try {
      if (payload.id) {
        const response = await updateSeason(payload.id, payload);
        const inner = response.data?.data ?? response.data;
        const season = inner?.season ?? inner;
        const index = state.items.findIndex((s) => s.id === payload.id);
        if (index !== -1) state.items[index] = season;
        return season;
      }
      const response = await createSeason(payload);
      const inner = response.data?.data ?? response.data;
      const season = inner?.season ?? inner;
      state.items.unshift(season);
      return season;
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al guardar la temporada');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const removeSeason = async (seasonId, orgId) => {
    state.loading = true;
    state.error = null;
    try {
      await deleteSeasonApi(seasonId, { org_id: orgId });
      state.items = state.items.filter((s) => s.id !== seasonId);
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al eliminar la temporada');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  return {
    ...toRefs(state),
    state,
    fetchSeasons,
    createOrUpdateSeason,
    removeSeason,
  };
};
