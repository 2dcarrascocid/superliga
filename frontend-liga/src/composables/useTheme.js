import { ref, watch } from 'vue';

// Estado reactivo a nivel de módulo (singleton), mismo patrón simple que
// stores/notify.js: un solo estado compartido por toda la app, sin Pinia.

const STORAGE_KEY = 'theme';

// Respeta la elección guardada y, en la primera visita, la preferencia del sistema.
const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
const systemTheme = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
  ? 'dark'
  : 'light';
const theme = ref(stored === 'light' || stored === 'dark' ? stored : systemTheme);

function applyTheme(value) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', value);
  document.documentElement.style.colorScheme = value;
}

// Aplica el tema guardado apenas se carga este módulo, para que quede
// seteado antes/durante el mount de la app y evitar flash del tema
// incorrecto al recargar.
applyTheme(theme.value);

watch(theme, (value) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, value);
  }
  applyTheme(value);
});

export function useTheme() {
  const toggleTheme = () => {
    theme.value = theme.value === 'dark' ? 'light' : 'dark';
  };

  return { theme, toggleTheme };
}
