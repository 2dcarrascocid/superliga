import { reactive, toRefs } from 'vue';
import {
  getTournaments, createTournament, getTournamentById, updateTournament, deleteTournament as deleteTournamentApi,
  getTournamentTeams, registerTeam, unregisterTeam as unregisterTeamApi,
  getTournamentClubs, registerClub as registerClubApi, unregisterClub as unregisterClubApi,
  getStages, generateFixture, generateKnockoutFromGroups, generateConsolation,
  getStandings,
} from '../services/tournaments.service';

const state = reactive({
  items: [],
  current: null,
  teams: [],
  clubs: [],
  stages: [],
  standings: [],
  loading: false,
  error: null,
});

const unwrap = (response) => {
  const envelope = response.data;
  return envelope?.data ?? envelope;
};

export const useTournamentsStore = () => {
  const setError = (message) => { state.error = message; };

  const fetchTournaments = async (params) => {
    state.loading = true;
    state.error = null;
    try {
      const data = unwrap(await getTournaments(params));
      state.items = data?.tournaments ?? [];
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al cargar torneos');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const fetchTournamentById = async (tournamentId) => {
    state.loading = true;
    state.error = null;
    try {
      const data = unwrap(await getTournamentById(tournamentId));
      state.current = data?.tournament ?? null;
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al cargar el torneo');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const createOrUpdateTournament = async (payload) => {
    state.loading = true;
    state.error = null;
    try {
      let tournament;
      if (payload.id) {
        tournament = unwrap(await updateTournament(payload.id, payload)).tournament;
        const idx = state.items.findIndex((t) => t.id === payload.id);
        if (idx !== -1) state.items[idx] = tournament;
      } else {
        tournament = unwrap(await createTournament(payload)).tournament;
        state.items.unshift(tournament);
      }
      return tournament;
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al guardar el torneo');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const removeTournament = async (tournamentId) => {
    state.loading = true;
    state.error = null;
    try {
      await deleteTournamentApi(tournamentId);
      state.items = state.items.filter((t) => t.id !== tournamentId);
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al eliminar el torneo');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const fetchTeams = async (tournamentId) => {
    state.loading = true;
    state.error = null;
    try {
      const data = unwrap(await getTournamentTeams(tournamentId));
      state.teams = data?.teams ?? [];
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al cargar equipos inscritos');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const addTeam = async (tournamentId, payload) => {
    state.error = null;
    try {
      const data = unwrap(await registerTeam(tournamentId, payload));
      state.teams.push(data.team);
      return data.team;
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al inscribir el equipo');
      throw error;
    }
  };

  const removeTeam = async (tournamentId, teamId) => {
    state.error = null;
    try {
      await unregisterTeamApi(tournamentId, teamId);
      state.teams = state.teams.filter((t) => t.id !== teamId);
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al quitar el equipo');
      throw error;
    }
  };

  const fetchTournamentClubs = async (tournamentId) => {
    state.loading = true;
    state.error = null;
    try {
      const data = unwrap(await getTournamentClubs(tournamentId));
      state.clubs = data?.clubs ?? [];
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al cargar los clubes inscritos');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const addClub = async (tournamentId, clubId) => {
    state.error = null;
    try {
      const data = unwrap(await registerClubApi(tournamentId, clubId));
      state.clubs.push(data.tournamentClub);
      return data.tournamentClub;
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al inscribir el club');
      throw error;
    }
  };

  const removeClub = async (tournamentId, clubId) => {
    state.error = null;
    try {
      await unregisterClubApi(tournamentId, clubId);
      state.clubs = state.clubs.filter((c) => c.club_id !== clubId);
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al desinscribir el club');
      throw error;
    }
  };

  const fetchStages = async (tournamentId) => {
    state.error = null;
    try {
      const data = unwrap(await getStages(tournamentId));
      state.stages = data?.stages ?? [];
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al cargar las fases');
      throw error;
    }
  };

  const runGenerateFixture = async (tournamentId, payload) => {
    state.loading = true;
    state.error = null;
    try {
      return unwrap(await generateFixture(tournamentId, payload));
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al generar el fixture');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const runGenerateKnockoutFromGroups = async (tournamentId, payload) => {
    state.loading = true;
    state.error = null;
    try {
      return unwrap(await generateKnockoutFromGroups(tournamentId, payload));
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al generar la llave de playoffs');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const runGenerateConsolation = async (tournamentId, payload) => {
    state.loading = true;
    state.error = null;
    try {
      return unwrap(await generateConsolation(tournamentId, payload));
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al generar la liguilla de consuelo');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const fetchStandings = async (tournamentId, params) => {
    state.loading = true;
    state.error = null;
    try {
      const data = unwrap(await getStandings(tournamentId, params));
      state.standings = data?.standings ?? [];
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al cargar la tabla de posiciones');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  return {
    ...toRefs(state),
    state,
    fetchTournaments,
    fetchTournamentById,
    createOrUpdateTournament,
    removeTournament,
    fetchTeams,
    addTeam,
    removeTeam,
    fetchTournamentClubs,
    addClub,
    removeClub,
    fetchStages,
    runGenerateFixture,
    runGenerateKnockoutFromGroups,
    runGenerateConsolation,
    fetchStandings,
  };
};
