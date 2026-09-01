<template>
  <div class="flex items-center justify-center h-screen container-sm">
    <div class="card w-full">
      <div class="text-center mb-lg">
        <h2 class="mb-md">Configuración Inicial</h2>
        <p>Crea tu primera Liga u Organismo para comenzar.</p>
      </div>

      <div v-if="authStore.state.error" class="alert alert-error">
        {{ authStore.state.error }}
      </div>

      <form @submit.prevent="handleBootstrap">
        <div class="input-group">
          <label class="label">Nombre de la Liga *</label>
          <input 
            v-model="orgName" 
            type="text" 
            required
            class="input"
            placeholder="Ej: Liga Mayor de Fútbol"
          />
        </div>
        
        <div class="input-group">
          <label class="label">Slug (URL amigable)</label>
          <input 
            v-model="orgSlug" 
            type="text" 
            class="input"
            placeholder="ej: liga-mayor"
          />
          <small class="text-muted" style="font-size: 0.75rem; display: block; margin-top: 0.25rem;">Opcional. Se generará automáticamente si lo dejas vacío.</small>
        </div>

        <div class="input-group">
          <label class="label">Código de País</label>
          <input 
            v-model="countryCode" 
            type="text" 
            class="input"
            placeholder="CL"
            maxlength="2"
          />
        </div>

        <button 
          type="submit" 
          :disabled="authStore.state.loading"
          class="btn btn-primary btn-full mt-md"
        >
          <span v-if="authStore.state.loading">Creando...</span>
          <span v-else>Crear Liga/Organismo</span>
        </button>
      </form>
      
      <div class="text-center mt-md">
        <button @click="handleLogout" class="text-muted text-sm" style="background: none; border: none; cursor: pointer;">
          Cerrar sesión
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const orgName = ref('');
const orgSlug = ref('');
const countryCode = ref('CL');

const handleBootstrap = async () => {
  try {
    await authStore.bootstrap({
      org_name: orgName.value,
      org_slug: orgSlug.value || undefined,
      country_code: countryCode.value
    });
    router.push('/home');
  } catch (e) {
    // Error handled in store
  }
};

const handleLogout = () => {
    authStore.logout();
    router.push('/login');
};
</script>
