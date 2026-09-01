import { reactive, toRefs } from 'vue';
import { getVenues, createVenue, getVenueById, updateVenue, deleteVenue as deleteVenueApi } from '../services/venues.service';

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

export const useVenuesStore = () => {
  const setError = (message) => {
    state.error = message;
  };

  const fetchVenues = async (params) => {
    state.loading = true;
    state.error = null;
    try {
      const response = await getVenues(params);
      const envelope = response.data;
      const data = envelope?.data ?? envelope;

      if (Array.isArray(data)) {
        state.items = data;
        state.meta.next_token = null;
        state.meta.total_registros = data.length;
      } else if (data && Array.isArray(data.venues)) {
        state.items = data.venues;
        state.meta.next_token = data.nextToken ?? data.next_token ?? null;
        state.meta.total_registros = data.venues.length;
      } else {
        console.warn('Unexpected venues response format:', data);
        state.items = [];
        state.meta.next_token = null;
      }
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al cargar canchas');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const fetchVenueById = async (venueId) => {
    state.loading = true;
    state.error = null;
    try {
      const response = await getVenueById(venueId);
      const inner = response.data?.data ?? response.data;
      state.current = inner?.venue ?? inner;
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al cargar cancha');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const createOrUpdateVenue = async (payload) => {
    state.loading = true;
    state.error = null;
    try {
      if (payload.id) {
        const response = await updateVenue(payload.id, payload);
        const inner = response.data?.data ?? response.data;
        const venue = inner?.venue ?? inner;
        state.current = venue;
        const index = state.items.findIndex((v) => v.id === payload.id);
        if (index !== -1) state.items[index] = venue;
        return venue;
      }
      const response = await createVenue(payload);
      const inner = response.data?.data ?? response.data;
      const venue = inner?.venue ?? inner;
      state.items.push(venue);
      return venue;
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al guardar cancha');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const removeVenue = async (venueId) => {
    state.loading = true;
    state.error = null;
    try {
      await deleteVenueApi(venueId);
      state.items = state.items.filter((v) => v.id !== venueId);
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al eliminar cancha');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  return {
    ...toRefs(state),
    state,
    fetchVenues,
    fetchVenueById,
    createOrUpdateVenue,
    removeVenue,
  };
};
