<template>
  <div v-if="isLoading" class="loading-state">
    <span class="loading-state__spinner" aria-hidden="true"></span>
    <p class="loading-state__message">{{ message }}</p>
  </div>
  <slot v-else />
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  // Boolean, o array de booleans si hay varias peticiones en paralelo:
  // :loading="[loadingA, loadingB]" — se muestra el spinner mientras alguna sea true.
  loading: { type: [Boolean, Array], default: false },
  message: { type: String, default: 'Cargando...' },
});

const isLoading = computed(() =>
  Array.isArray(props.loading) ? props.loading.some(Boolean) : !!props.loading
);
</script>

<script>
export default {
  name: 'LoadingState',
};
</script>

<style scoped>
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 4rem 1rem;
  color: var(--text-muted);
}

.loading-state__spinner {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 3px solid var(--border-subtle, rgba(148, 163, 184, 0.25));
  border-top-color: var(--color-primary, #00e676);
  animation: loading-state-spin 0.8s linear infinite;
}

.loading-state__message {
  font-size: 0.875rem;
}

@keyframes loading-state-spin {
  to { transform: rotate(360deg); }
}
</style>
