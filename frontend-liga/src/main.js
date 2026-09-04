import { createApp } from 'vue';
import './style.css';
import App from './App.vue';
import router from './router';
import { useTheme } from './composables/useTheme';

// Aplica el tema guardado (o la preferencia del sistema) antes del mount, para
// evitar un flash del tema incorrecto al recargar.
useTheme();

const app = createApp(App);

app.use(router);

app.mount('#app');
