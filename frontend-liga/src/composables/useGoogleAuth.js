import { ref } from 'vue';

// Integración real con Google Identity Services (GIS), reemplaza el mock
// `mockGoogleLogin` que existía en Login.vue. Se usa el flujo de botón
// renderizado explícito (`renderButton`) en vez de `prompt()` (one-tap),
// por ser más predecible en testing manual y no depender de heurísticas
// del navegador para decidir si muestra el prompt.
//
// El script de GIS se inyecta una sola vez a nivel de documento (no hay
// paquete npm de Google instalado en el proyecto — se decidió no agregar
// una dependencia nueva solo para esto, el script oficial es liviano y no
// requiere build step).

const GIS_SRC = 'https://accounts.google.com/gsi/client';
let scriptLoadingPromise = null;

function loadGoogleScript() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Identity Services requiere un entorno de navegador.'));
  }
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }
  if (scriptLoadingPromise) {
    return scriptLoadingPromise;
  }

  const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
  if (existing) {
    scriptLoadingPromise = new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('No se pudo cargar Google Identity Services.')));
    });
    return scriptLoadingPromise;
  }

  scriptLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Google Identity Services.'));
    document.head.appendChild(script);
  });
  return scriptLoadingPromise;
}

/**
 * Composable de login con Google (GIS). Cada componente que lo invoque
 * obtiene su propia instancia de estado reactivo (`credential`/`error`),
 * pero todas comparten el mismo script/objeto global `window.google`
 * (cargado una sola vez).
 *
 * Uso típico:
 *   const { credential, error, renderButton } = useGoogleAuth();
 *   const btnEl = ref(null);
 *   onMounted(() => renderButton(btnEl));
 *   watch(credential, (idToken) => { if (idToken) ...enviar al backend... });
 */
export function useGoogleAuth() {
  const credential = ref(null);
  const error = ref(null);
  const ready = ref(false);

  const init = async () => {
    error.value = null;
    try {
      await loadGoogleScript();
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      if (!clientId) {
        error.value = 'Falta configurar VITE_GOOGLE_CLIENT_ID en el entorno del frontend.';
        return false;
      }
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          // response.credential ES el idToken/JWT de Google que hay que
          // reenviar al backend (loginGoogle / accept-player-invite).
          error.value = null;
          credential.value = response?.credential || null;
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      ready.value = true;
      return true;
    } catch (e) {
      error.value = e?.message || 'No se pudo inicializar el login con Google.';
      return false;
    }
  };

  /**
   * Renderiza el botón oficial de Google dentro del elemento referenciado
   * por `elementRef` (un `ref()` de un `<div>` en el template del
   * componente que llama a este composable). Inicializa GIS si todavía no
   * lo estaba.
   */
  const renderButton = async (elementRef, options = {}) => {
    const ok = ready.value || (await init());
    if (!ok) return false;
    if (!elementRef?.value) return false;
    // Limpia el contenido previo por si se vuelve a renderizar (ej. cambio
    // de tab en Login.vue).
    elementRef.value.innerHTML = '';
    window.google.accounts.id.renderButton(elementRef.value, {
      theme: 'outline',
      size: 'large',
      width: 320,
      text: 'continue_with',
      locale: 'es',
      ...options,
    });
    return true;
  };

  return { credential, error, ready, init, renderButton };
}
