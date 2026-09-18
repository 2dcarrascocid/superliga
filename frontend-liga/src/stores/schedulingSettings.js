import { reactive, toRefs } from 'vue';
import { getSchedulingSettings, updateSchedulingSettings } from '../services/schedulingSettings.service';

const state = reactive({
  settings: null,
  loading: false,
  error: null,
});

const unwrap = (response) => {
  const envelope = response.data;
  return envelope?.data ?? envelope;
};

export const useSchedulingSettingsStore = () => {
  const setError = (message) => {
    state.error = message;
  };

  const fetchSettings = async (orgId) => {
    state.loading = true;
    state.error = null;
    try {
      const data = unwrap(await getSchedulingSettings(orgId));
      state.settings = data?.settings ?? null;
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al cargar los parámetros de programación');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const saveSettings = async (orgId, payload) => {
    state.loading = true;
    state.error = null;
    try {
      const data = unwrap(await updateSchedulingSettings(orgId, payload));
      state.settings = data?.settings ?? null;
      return state.settings;
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al guardar los parámetros de programación');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  return {
    ...toRefs(state),
    state,
    fetchSettings,
    saveSettings,
  };
};
