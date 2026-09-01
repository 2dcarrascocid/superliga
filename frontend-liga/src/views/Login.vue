<template>
  <div class="flex items-center justify-center h-screen container-sm">
    <div class="card w-full">
      <div class="text-center mb-lg">
        <h2 class="mb-md">Bienvenido</h2>
        <p>Inicia sesión para gestionar tu liga</p>
      </div>

      <div class="tabs">
        <button 
          v-for="tab in ['Email', 'Google', 'Facebook']" 
          :key="tab"
          @click="currentTab = tab"
          class="tab-btn"
          :class="{ active: currentTab === tab }"
        >
          {{ tab }}
        </button>
      </div>

      <div v-if="authStore.state.error" class="alert alert-error">
        {{ authStore.state.error }}
      </div>

      <!-- Email Login -->
      <form v-if="currentTab === 'Email'" @submit.prevent="handleLogin">
        <div class="input-group">
          <label class="label">Email</label>
          <input 
            v-model="email" 
            type="email" 
            required
            class="input"
            placeholder="tu@email.com"
          />
        </div>
        <div class="input-group">
          <label class="label">Contraseña</label>
          <input 
            v-model="password" 
            type="password" 
            required
            minlength="8"
            class="input"
            placeholder="••••••••"
          />
        </div>
        <div class="forgot-row">
          <router-link to="/forgot-password" class="forgot-link">
            ¿Olvidaste tu contraseña?
          </router-link>
        </div>

        <button
          type="submit"
          :disabled="authStore.state.loading"
          class="btn btn-primary btn-full"
        >
          <span v-if="authStore.state.loading">Cargando...</span>
          <span v-else>Ingresar</span>
        </button>
      </form>

      <!-- Google Login -->
      <div v-else-if="currentTab === 'Google'" class="text-center">
        <p class="mb-md">Accede con tu cuenta de Google</p>
        <div ref="googleBtnEl" class="google-btn-wrap"></div>
        <p v-if="googleError" class="input-error mt-sm" role="alert">{{ googleError }}</p>
      </div>

      <!-- Facebook Login -->
      <div v-else-if="currentTab === 'Facebook'" class="text-center">
         <p class="mb-md">Accede con tu cuenta de Facebook</p>
         <button 
           @click="mockFacebookLogin" 
           :disabled="authStore.state.loading"
           class="btn btn-primary btn-full"
           style="background: #1877F2; color: #fff;"
         >
           Continuar con Facebook
         </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.forgot-row {
  text-align: right;
  margin-bottom: 12px;
}
.forgot-link {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--primary-solid);
  text-decoration: none;
  transition: opacity var(--transition-fast);
  cursor: pointer;
}
.forgot-link:hover { opacity: 0.75; }
.google-btn-wrap {
  display: flex;
  justify-content: center;
  min-height: 44px;
}
.input-error {
  font-size: 0.78rem;
  color: var(--accent-red);
  margin-top: 4px;
  display: block;
}
</style>

<script setup>
import { ref, watch, nextTick, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useGoogleAuth } from '../composables/useGoogleAuth';

const router = useRouter();
const authStore = useAuthStore();
const currentTab = ref('Email');
const email = ref('');
const password = ref('');

// Login real con Google (Google Identity Services) — reemplaza el mock
// `mockGoogleLogin` que llamaba a authStore.loginGoogle con un string
// hardcodeado. El resto del flujo (authStore.loginGoogle(idToken)) no cambia.
const googleBtnEl = ref(null);
const { credential: googleCredential, error: googleError, renderButton } = useGoogleAuth();

const mountGoogleButton = async () => {
  await nextTick();
  await renderButton(googleBtnEl);
};

// Renderiza el botón cuando se entra al tab de Google (o directo al montar
// si esa es la tab inicial).
watch(currentTab, (tab) => {
  if (tab === 'Google') mountGoogleButton();
});
onMounted(() => {
  if (currentTab.value === 'Google') mountGoogleButton();
});

// El callback de GIS deja el idToken en googleCredential — de ahí se dispara
// el login real contra el backend.
watch(googleCredential, async (idToken) => {
  if (!idToken) return;
  try {
    await authStore.loginGoogle(idToken);
    checkRedirect();
  } catch (e) {
    // Error queda en authStore.state.error, se muestra arriba del formulario
  }
});

const handleLogin = async () => {
  try {
    await authStore.loginLocal({ email: email.value, password: password.value });
    checkRedirect();
  } catch (e) {
    // Error is handled in store
  }
};

const mockFacebookLogin = async () => {
    try {
        await authStore.loginFacebook('mock_fb_access_token_123');
        checkRedirect();
    } catch (e) {}
};

const checkRedirect = () => {
    if (authStore.state.player) {
        router.push('/mi-perfil');
    } else if (authStore.state.org || authStore.myClub()) {
        router.push('/home');
    } else {
        router.push('/bootstrap');
    }
};
</script>
