import { reactive, toRefs, watch } from 'vue';
import { useTheme } from '../composables/useTheme';

const { sport: activeOrgSport } = useTheme();

// Estado reactivo a nivel de módulo (singleton), mismo patrón que
// stores/notify.js y stores/auth.js: un solo estado compartido por toda la
// app, sin Pinia. Es el ÚNICO estado de loading global: cualquier petición
// HTTP (ver api/index.js) pasa por acá en vez de manejar un `loading` local
// por vista.

const DEFAULT_MESSAGE = 'Actualizando datos de la liga...';
const DEFAULT_SPORT = 'auto';
const DEFAULT_TIMEOUT_MS = 10000;

// useTheme() ya trackea el deporte de la organización activa (slugs en
// español, usados para el acento de color del sitio). Lo reusamos acá para
// que el loader arranque mostrando el deporte correcto de la liga sin
// duplicar esa selección.
const SPORT_SLUG_MAP = {
  futbol: 'football',
  basquetbol: 'basketball',
  voleibol: 'volleyball',
};

const state = reactive({
  isLoading: false,
  activeSport: DEFAULT_SPORT,
  message: DEFAULT_MESSAGE,
  hasTimedOut: false,
  pendingRequestsCount: 0,
  timeoutMs: DEFAULT_TIMEOUT_MS,
});

// Solo actualiza el deporte "de fondo" cuando no hay peticiones en curso,
// para no pisar un `sport` específico pasado por una petición activa
// (ver `meta.sport` en api/index.js).
watch(activeOrgSport, (slug) => {
  if (state.pendingRequestsCount === 0) {
    state.activeSport = SPORT_SLUG_MAP[slug] || DEFAULT_SPORT;
  }
}, { immediate: true });

// Ids de peticiones activas + sus AbortController (cuando el caller no trae
// ya su propio `signal`). Viven fuera de `state` porque no son datos para
// la UI, solo housekeeping interno para poder cancelar en bloque.
let requestSeq = 0;
const activeIds = new Set();
const controllers = new Map();
let timeoutHandle = null;

function armTimeout() {
  clearTimeout(timeoutHandle);
  timeoutHandle = setTimeout(() => {
    if (state.pendingRequestsCount > 0) {
      state.hasTimedOut = true;
    }
  }, state.timeoutMs);
}

function disarmTimeout() {
  clearTimeout(timeoutHandle);
  timeoutHandle = null;
}

export const useLoaderStore = () => {
  // Registra el inicio de una petición. `controller` es opcional (permite
  // cancelarla desde el botón de salida). Devuelve un requestId que el
  // caller debe pasar a `endRequest` cuando la petición resuelva/falle.
  const startRequest = ({ message, sport, controller } = {}) => {
    const requestId = `req_${++requestSeq}`;
    activeIds.add(requestId);
    if (controller) controllers.set(requestId, controller);

    const isFirstOfBatch = state.pendingRequestsCount === 0;
    if (isFirstOfBatch) {
      state.message = message || DEFAULT_MESSAGE;
      state.activeSport = sport || SPORT_SLUG_MAP[activeOrgSport.value] || DEFAULT_SPORT;
      state.hasTimedOut = false;
      armTimeout();
    } else {
      if (message) state.message = message;
      if (sport) state.activeSport = sport;
    }

    state.pendingRequestsCount += 1;
    state.isLoading = true;
    return requestId;
  };

  const endRequest = (requestId) => {
    if (!requestId || !activeIds.has(requestId)) return;
    activeIds.delete(requestId);
    controllers.delete(requestId);

    if (state.pendingRequestsCount > 0) {
      state.pendingRequestsCount -= 1;
    }
    if (state.pendingRequestsCount === 0) {
      state.isLoading = false;
      state.hasTimedOut = false;
      disarmTimeout();
    }
  };

  // Botón "Cancelar / Salir": aborta todas las peticiones pendientes,
  // resetea el contador de inmediato (no espera a que el abort se
  // propague) y libera la UI para que el usuario pueda reintentar.
  const cancelAll = () => {
    controllers.forEach((controller) => {
      try {
        controller.abort();
      } catch (e) {
        // noop: abortar un controller ya abortado no debe romper el flujo
      }
    });
    controllers.clear();
    activeIds.clear();
    disarmTimeout();

    state.pendingRequestsCount = 0;
    state.isLoading = false;
    state.hasTimedOut = false;
  };

  const setTimeoutMs = (ms) => {
    if (typeof ms === 'number' && ms > 0) {
      state.timeoutMs = ms;
    }
  };

  return {
    ...toRefs(state),
    state,
    startRequest,
    endRequest,
    cancelAll,
    setTimeoutMs,
  };
};
