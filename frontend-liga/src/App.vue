<template>
  <div id="app">
    <a class="skip-link" href="#main-content">Saltar al contenido principal</a>
    <Navbar v-if="isAuthenticated" />
    <main id="main-content" :class="{ 'with-navbar': isAuthenticated }">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
    <NotifyModal />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useAuthStore } from './stores/auth';
import Navbar from './components/Navbar.vue';
import NotifyModal from './components/NotifyModal.vue';

const authStore = useAuthStore();
const isAuthenticated = computed(() => authStore.isAuthenticated.value);
</script>

<style scoped>
#app {
  min-height: 100dvh;
}

main {
  min-height: 100dvh;
  transition: opacity var(--transition-base);
}

main.with-navbar {
  padding-top: 86px;
}

/* Transiciones entre vistas */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

@media (prefers-reduced-motion: reduce) {
  .fade-enter-active,
  .fade-leave-active { transition: none; }
  .fade-enter-from,
  .fade-leave-to { transform: none; }
}
</style>
