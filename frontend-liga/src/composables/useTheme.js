import { ref, watch } from 'vue';

// Estado reactivo a nivel de módulo (singleton), mismo patrón simple que
// stores/notify.js: un solo estado compartido por toda la app, sin Pinia.

const STORAGE_KEY = 'theme';
const SPORT_STORAGE_KEY = 'sport';

// Respeta la elección guardada y, en la primera visita, la preferencia del sistema.
const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
const systemTheme = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
  ? 'dark'
  : 'light';
const theme = ref(stored === 'light' || stored === 'dark' ? stored : systemTheme);

// Deporte de la liga activa (determina el color de acento del sitio vía
// [data-sport] en tokens.css). 'futbol' es el valor por defecto: no
// necesita bloque propio en tokens.css porque :root ya es verde.
const storedSport = typeof localStorage !== 'undefined' ? localStorage.getItem(SPORT_STORAGE_KEY) : null;
const sport = ref(storedSport || 'futbol');

function applyTheme(value) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', value);
  document.documentElement.style.colorScheme = value;
}

function applySportAttr(value) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-sport', value || 'futbol');
}

// Aplica el tema guardado apenas se carga este módulo, para que quede
// seteado antes/durante el mount de la app y evitar flash del tema
// incorrecto al recargar.
applyTheme(theme.value);

// Ídem para el deporte: aplica el valor persistido en localStorage de
// inmediato (fallback optimista), antes de que resuelva GET /orgs/{id}/sport,
// para evitar un flash del acento por defecto (fútbol) al recargar.
applySportAttr(sport.value);

watch(theme, (value) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, value);
  }
  applyTheme(value);
});

watch(sport, (value) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(SPORT_STORAGE_KEY, value);
  }
  applySportAttr(value);
});

export function useTheme() {
  const toggleTheme = () => {
    theme.value = theme.value === 'dark' ? 'light' : 'dark';
  };

  // Setea el deporte activo (slug: 'futbol'|'basquetbol'|'voleibol') y lo
  // persiste, para preview instantáneo del acento del sitio.
  const applySport = (slug) => {
    sport.value = slug || 'futbol';
  };

  return { theme, toggleTheme, sport, applySport };
}
