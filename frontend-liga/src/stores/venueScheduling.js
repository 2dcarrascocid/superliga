import { reactive, toRefs } from 'vue';
import {
  getAvailability,
  createAvailability,
  deleteAvailability as deleteAvailabilityApi,
  getBookings,
  createBooking,
  deleteBooking as deleteBookingApi,
} from '../services/venueScheduling.service';

const state = reactive({
  availabilityByVenue: {}, // { [venueId]: Array }
  bookingsByKey: {},       // { [`${venueId}:${fecha}`]: Array }
  loading: false,
  error: null,
});

const unwrap = (response) => {
  const envelope = response.data;
  return envelope?.data ?? envelope;
};

export const useVenueSchedulingStore = () => {
  const setError = (message) => {
    state.error = message;
  };

  const fetchAvailability = async (venueId) => {
    state.loading = true;
    state.error = null;
    try {
      const data = unwrap(await getAvailability(venueId));
      state.availabilityByVenue[venueId] = data?.availability ?? [];
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al cargar disponibilidad');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const addAvailability = async (venueId, { diaSemana, horaApertura, horaCierre }) => {
    state.loading = true;
    state.error = null;
    try {
      await createAvailability(venueId, {
        dia_semana: diaSemana,
        hora_apertura: horaApertura,
        hora_cierre: horaCierre,
      });
      await fetchAvailability(venueId);
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al guardar la franja horaria');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const removeAvailability = async (venueId, availabilityId) => {
    state.loading = true;
    state.error = null;
    try {
      await deleteAvailabilityApi(venueId, availabilityId);
      state.availabilityByVenue[venueId] =
        (state.availabilityByVenue[venueId] || []).filter((a) => a.id !== availabilityId);
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al eliminar la franja horaria');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const fetchBookings = async (venueId, fecha) => {
    state.loading = true;
    state.error = null;
    try {
      const data = unwrap(await getBookings(venueId, fecha));
      state.bookingsByKey[`${venueId}:${fecha}`] = data?.bookings ?? [];
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al cargar reservas');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const addBooking = async (venueId, { fecha, horaInicio, horaFin, partidoId }) => {
    state.loading = true;
    state.error = null;
    try {
      await createBooking(venueId, {
        fecha,
        hora_inicio: horaInicio,
        hora_fin: horaFin,
        partido_id: partidoId || null,
      });
      await fetchBookings(venueId, fecha);
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al crear la reserva');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const removeBooking = async (venueId, bookingId, fecha) => {
    state.loading = true;
    state.error = null;
    try {
      await deleteBookingApi(venueId, bookingId);
      const key = `${venueId}:${fecha}`;
      state.bookingsByKey[key] = (state.bookingsByKey[key] || []).filter((b) => b.id !== bookingId);
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al eliminar la reserva');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  return {
    ...toRefs(state),
    state,
    fetchAvailability,
    addAvailability,
    removeAvailability,
    fetchBookings,
    addBooking,
    removeBooking,
  };
};
