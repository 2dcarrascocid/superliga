import { reactive, toRefs } from 'vue';
import {
  getSports,
  getOrgSport,
  updateOrgSport,
  getOrgAdmins,
  inviteOrgAdmin,
  removeOrgAdmin,
} from '../services/org.service';

const state = reactive({
  sports: [],
  sport: null,
  admins: [],
  pendingInvites: [],
  loading: false,
  error: null,
});

const unwrap = (response) => {
  const envelope = response.data;
  return envelope?.data ?? envelope;
};

export const useOrgSettingsStore = () => {
  const setError = (message) => {
    state.error = message;
  };

  const fetchSports = async () => {
    state.loading = true;
    state.error = null;
    try {
      const data = unwrap(await getSports());
      state.sports = data?.sports ?? [];
      return state.sports;
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al cargar el catálogo de deportes');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const fetchSport = async (orgId) => {
    state.loading = true;
    state.error = null;
    try {
      const data = unwrap(await getOrgSport(orgId));
      state.sport = data ?? null;
      return state.sport;
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al cargar el deporte de la organización');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const saveSport = async (orgId, sportId) => {
    state.loading = true;
    state.error = null;
    try {
      const data = unwrap(await updateOrgSport(orgId, sportId));
      state.sport = data ?? null;
      return state.sport;
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al guardar el deporte de la organización');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const fetchAdmins = async (orgId) => {
    state.loading = true;
    state.error = null;
    try {
      const data = unwrap(await getOrgAdmins(orgId));
      state.admins = data?.admins ?? [];
      state.pendingInvites = data?.pendingInvites ?? [];
      return { admins: state.admins, pendingInvites: state.pendingInvites };
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al cargar los administradores');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const inviteAdmin = async (orgId, payload) => {
    state.loading = true;
    state.error = null;
    try {
      const data = unwrap(await inviteOrgAdmin(orgId, payload));
      await fetchAdmins(orgId);
      return data;
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al invitar al administrador');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const removeAdmin = async (orgId, adminUserId) => {
    state.loading = true;
    state.error = null;
    try {
      const data = unwrap(await removeOrgAdmin(orgId, adminUserId));
      await fetchAdmins(orgId);
      return data;
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al quitar al administrador');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  return {
    ...toRefs(state),
    state,
    fetchSports,
    fetchSport,
    saveSport,
    fetchAdmins,
    inviteAdmin,
    removeAdmin,
  };
};
