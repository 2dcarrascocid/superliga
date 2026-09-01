import { reactive, toRefs } from 'vue';
import {
  getMatchdays, createMatchday,
  getMatches, getMatchById, updateMatchLogistics, updateMatchResult,
  getMatchEvents, addMatchEvent, deleteMatchEvent as deleteMatchEventApi,
  getTopScorers, getFairplayRanking,
} from '../services/matches.service';

const state = reactive({
  matchdays: [],
  items: [],
  current: null,
  events: [],
  scorers: [],
  fairplay: [],
  loading: false,
  error: null,
});

const unwrap = (response) => {
  const envelope = response.data;
  return envelope?.data ?? envelope;
};

export const useMatchesStore = () => {
  const setError = (message) => { state.error = message; };

  const fetchMatchdays = async (tournamentId, params) => {
    state.error = null;
    try {
      const data = unwrap(await getMatchdays(tournamentId, params));
      state.matchdays = data?.matchdays ?? [];
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al cargar las jornadas');
      throw error;
    }
  };

  const addMatchday = async (tournamentId, payload) => {
    state.error = null;
    try {
      const data = unwrap(await createMatchday(tournamentId, payload));
      state.matchdays.push(data.matchday);
      return data.matchday;
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al crear la jornada');
      throw error;
    }
  };

  const fetchMatches = async (tournamentId, params) => {
    state.loading = true;
    state.error = null;
    try {
      const data = unwrap(await getMatches(tournamentId, params));
      state.items = data?.matches ?? [];
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al cargar los partidos');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const fetchMatchById = async (matchId) => {
    state.loading = true;
    state.error = null;
    try {
      const data = unwrap(await getMatchById(matchId));
      state.current = data?.match ?? null;
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al cargar el partido');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const saveLogistics = async (matchId, payload) => {
    state.loading = true;
    state.error = null;
    try {
      const data = unwrap(await updateMatchLogistics(matchId, payload));
      state.current = data.match;
      return data.match;
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al guardar la logística');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const saveResult = async (matchId, payload) => {
    state.loading = true;
    state.error = null;
    try {
      const data = unwrap(await updateMatchResult(matchId, payload));
      state.current = data.match;
      return data;
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al guardar el resultado');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const fetchEvents = async (matchId) => {
    state.error = null;
    try {
      const data = unwrap(await getMatchEvents(matchId));
      state.events = data?.events ?? [];
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al cargar los eventos del partido');
      throw error;
    }
  };

  const addEvent = async (matchId, payload) => {
    state.error = null;
    try {
      const data = unwrap(await addMatchEvent(matchId, payload));
      state.events.push(data.event);
      return data.event;
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al registrar el evento');
      throw error;
    }
  };

  const removeEvent = async (matchId, eventId) => {
    state.error = null;
    try {
      await deleteMatchEventApi(matchId, eventId);
      state.events = state.events.filter((e) => e.id !== eventId);
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al eliminar el evento');
      throw error;
    }
  };

  const fetchTopScorers = async (tournamentId) => {
    state.loading = true;
    state.error = null;
    try {
      const data = unwrap(await getTopScorers(tournamentId));
      state.scorers = data?.scorers ?? [];
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al cargar la clasificación de goleadores');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const fetchFairplayRanking = async (tournamentId) => {
    state.loading = true;
    state.error = null;
    try {
      const data = unwrap(await getFairplayRanking(tournamentId));
      state.fairplay = data?.ranking ?? [];
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al cargar el ranking de fairplay');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  return {
    ...toRefs(state),
    state,
    fetchMatchdays,
    addMatchday,
    fetchMatches,
    fetchMatchById,
    saveLogistics,
    saveResult,
    fetchEvents,
    addEvent,
    removeEvent,
    fetchTopScorers,
    fetchFairplayRanking,
  };
};
