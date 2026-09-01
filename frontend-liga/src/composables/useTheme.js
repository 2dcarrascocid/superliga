import { ref, watch } from 'vue';

// Estado reactivo a nivel de módulo (singleton), mismo patrón simple que
// stores/notify.js: un solo estado compartido por toda la app, sin Pinia.

const STORAGE_KEY = 'theme';

// El proyecto es "dark-mode first" (ver src/styles/tokens.css): si no hay
// nada guardado en localStorage, el default es 'dark' (no se usa
// prefers-color-scheme a propósito).
const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
const theme = ref(stored === 'light' ? 'light' : 'dark');

function applyTheme(value) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', value);
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
