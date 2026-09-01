import { reactive, toRefs } from 'vue';
import {
  getClubSeries, createSeries, searchSeries, updateSeries, deleteSeries as deleteSeriesApi,
  getSeriesRoster, assignPlayerToSeries, unassignPlayerFromSeries,
} from '../services/clubSeries.service';

const state = reactive({
  items: [],
  searchResults: [],
  roster: [],
  loading: false,
  error: null,
});

const unwrap = (response) => {
  const envelope = response.data;
  return envelope?.data ?? envelope;
};

export const useClubSeriesStore = () => {
  const setError = (message) => { state.error = message; };

  const fetchClubSeries = async (clubId) => {
    state.loading = true;
    state.error = null;
    try {
      const data = unwrap(await getClubSeries(clubId));
      state.items = data?.seriesList ?? [];
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al cargar las series del club');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const searchAllSeries = async (params) => {
    state.error = null;
    try {
      const data = unwrap(await searchSeries(params));
      state.searchResults = data?.seriesList ?? [];
      return state.searchResults;
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al buscar series');
      throw error;
    }
  };

  const createOrUpdateSeries = async (payload) => {
    state.loading = true;
    state.error = null;
    try {
      let series;
      if (payload.id) {
        series = unwrap(await updateSeries(payload.id, payload)).series;
        const idx = state.items.findIndex((s) => s.id === payload.id);
        if (idx !== -1) state.items[idx] = series;
      } else {
        series = unwrap(await createSeries(payload.clubId, payload)).series;
        state.items.push(series);
      }
      return series;
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al guardar la serie');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const removeSeries = async (seriesId) => {
    state.loading = true;
    state.error = null;
    try {
      await deleteSeriesApi(seriesId);
      state.items = state.items.filter((s) => s.id !== seriesId);
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al eliminar la serie');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const fetchSeriesRoster = async (seriesId) => {
    state.error = null;
    try {
      const data = unwrap(await getSeriesRoster(seriesId));
      state.roster = data?.roster ?? [];
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al cargar la nómina de la serie');
      throw error;
    }
  };

  const assignPlayer = async (seriesId, playerId) => {
    state.error = null;
    try {
      const data = unwrap(await assignPlayerToSeries(seriesId, playerId));
      state.roster.push(data.roster);
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al asignar el jugador a la serie');
      throw error;
    }
  };

  const unassignPlayer = async (seriesId, playerId) => {
    state.error = null;
    try {
      await unassignPlayerFromSeries(seriesId, playerId);
      state.roster = state.roster.filter((r) => r.player?.id !== playerId);
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al quitar el jugador de la serie');
      throw error;
    }
  };

  return {
    ...toRefs(state),
    state,
    fetchClubSeries,
    searchAllSeries,
    createOrUpdateSeries,
    removeSeries,
    fetchSeriesRoster,
    assignPlayer,
    unassignPlayer,
  };
};
