<template>
  <div class="container mt-md">
    <div class="card">
      <div class="flex justify-between items-center mb-lg">
        <h2>Dashboard</h2>
        <button @click="handleLogout" class="btn btn-secondary">
          Cerrar Sesión
        </button>
      </div>

      <div class="mb-lg">
        <h3 class="mb-md">Bienvenido, {{ authStore.state.user?.nombre || authStore.state.user?.email || 'Usuario' }}</h3>
        <p>Has iniciado sesión correctamente.</p>
      </div>

      <div class="mb-lg" style="padding: 1rem; background: var(--bg-secondary); border-radius: var(--radius-md); border: 1px solid var(--border-color);">
        <h4 class="mb-md" style="color: var(--primary-light);">Organismo Activo</h4>
        <div v-if="authStore.state.org">
          <p style="margin-bottom: 0.5rem;"><strong>Nombre:</strong> {{ authStore.state.org.name || authStore.state.org.org_name }}</p>
          <p style="margin-bottom: 0;"><strong>Slug:</strong> {{ authStore.state.org.slug || authStore.state.org.org_slug }}</p>
        </div>
        <div v-else>
          <p class="text-danger">No hay organismo seleccionado.</p>
        </div>
      </div>

      <div class="text-center text-muted text-sm">
        <p>Esta es una pantalla placeholder para el MVP.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const handleLogout = () => {
  authStore.logout();
  router.push('/login');
};
</script>
