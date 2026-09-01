import { reactive, toRefs } from 'vue';
import { getClubs, createClub, getClubById, updateClub, addClubUser, removeClubUser, inviteClubAdmin, getClubAdmins, removeClubAdmin } from '../services/clubs.service';

const state = reactive({
  items: [],
  current: null,
  users: [],
  admins: [],
  loading: false,
  error: null,
  meta: {
    limit: 10,
    next_token: null,
    total_registros: 0,
  },
});

export const useClubsStore = () => {
  const setError = (message) => {
    state.error = message;
  };

  const fetchClubs = async (params) => {
    state.loading = true;
    state.error = null;
    try {
      const response = await getClubs(params);
      // Backend retorna { success, data: { clubs, nextToken } }
      const envelope = response.data;
      const data = envelope?.data ?? envelope;

      if (Array.isArray(data)) {
        state.items = data;
        state.meta.next_token = null;
        state.meta.total_registros = data.length;
      } else if (data && Array.isArray(data.clubs)) {
        state.items = data.clubs;
        state.meta.next_token = data.nextToken ?? data.next_token ?? null;
        state.meta.total_registros = data.clubs.length;
      } else if (data && Array.isArray(data.data)) {
        state.items = data.data;
        state.meta.next_token = data.nextToken ?? data.next_token ?? null;
        state.meta.total_registros = data.total_registros ?? data.total ?? state.meta.total_registros;
      } else if (data && Array.isArray(data.items)) {
        state.items = data.items;
        state.meta.next_token = data.nextToken ?? data.next_token ?? null;
        state.meta.total_registros = data.total_registros ?? data.total ?? state.meta.total_registros;
      } else {
        console.warn('Unexpected clubs response format:', data);
        state.items = [];
        state.meta.next_token = null;
      }
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al cargar clubes');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const fetchClubById = async (clubId) => {
    state.loading = true;
    state.error = null;
    try {
      const response = await getClubById(clubId);
      const inner = response.data?.data ?? response.data;
      const club = inner?.club ?? inner;
      state.current = club;
      state.users = club?.users || [];
    } catch (error) {
      setError(error.response?.data?.message || 'Error al cargar club');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const createOrUpdateClub = async (payload) => {
    state.loading = true;
    state.error = null;
    try {
      if (payload.id) {
        const response = await updateClub(payload.id, payload);
        const inner = response.data?.data ?? response.data;
        const club = inner?.club ?? inner;
        state.current = club;
        const index = state.items.findIndex((c) => c.id === payload.id);
        if (index !== -1) state.items[index] = club;
        return club;
      }
      const response = await createClub(payload);
      const inner = response.data?.data ?? response.data;
      const club = inner?.club ?? inner;
      state.items.push(club);
      return club;
    } catch (error) {
      setError(error.response?.data?.message || 'Error al guardar club');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const addUserToClub = async (clubId, data) => {
    state.loading = true;
    state.error = null;
    try {
      const response = await addClubUser(clubId, data);
      state.users = response.data?.users || state.users;
      return response.data;
    } catch (error) {
      setError(error.response?.data?.message || 'Error al agregar usuario');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const removeUserFromClub = async (clubId, userId) => {
    state.loading = true;
    state.error = null;
    try {
      await removeClubUser(clubId, userId);
      state.users = state.users.filter((u) => u.id !== userId);
    } catch (error) {
      setError(error.response?.data?.message || 'Error al quitar usuario');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const fetchClubAdmins = async (clubId) => {
    state.loading = true;
    state.error = null;
    try {
      const response = await getClubAdmins(clubId);
      state.admins = response.data?.data?.admins || [];
    } catch (error) {
      setError(error.response?.data?.message || 'Error al cargar administradores');
    } finally {
      state.loading = false;
    }
  };

  const inviteAdmin = async (clubId, email) => {
    state.loading = true;
    state.error = null;
    try {
      await inviteClubAdmin(clubId, { email });
      await fetchClubAdmins(clubId);
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al invitar administrador');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const removeAdmin = async (clubId, adminUserId) => {
    state.loading = true;
    state.error = null;
    try {
      await removeClubAdmin(clubId, adminUserId);
      state.admins = state.admins.filter(a => a.user_id !== adminUserId);
    } catch (error) {
      setError(error.response?.data?.message || 'Error al quitar administrador');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  return {
    ...toRefs(state),
    state,
    fetchClubs,
    fetchClubById,
    createOrUpdateClub,
    addUserToClub,
    removeUserFromClub,
    fetchClubAdmins,
    inviteAdmin,
    removeAdmin,
  };
};
