<template>
  <nav class="navbar" role="navigation" aria-label="Navegación principal">
    <div class="container navbar-content">

      <!-- Logo -->
      <div class="navbar-brand">
        <router-link to="/home" class="logo" aria-label="Liga App inicio">
          <svg class="logo-icon" width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
            <circle cx="15" cy="15" r="14" fill="url(#nav-grad)"/>
            <path d="M9 15c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
            <circle cx="15" cy="18.5" r="3" fill="white"/>
            <defs>
              <linearGradient id="nav-grad" x1="0" y1="0" x2="30" y2="30">
                <stop offset="0%" stop-color="#00c853"/>
                <stop offset="100%" stop-color="#00e676"/>
              </linearGradient>
            </defs>
          </svg>
          <span class="logo-text">Liga App</span>
        </router-link>
      </div>

      <!-- Menu principal -->
      <div class="navbar-menu" :class="{ 'is-active': mobileMenuOpen }">

        <template v-if="authStore.isOrgAdmin()">
          <!-- Home -->
          <router-link to="/home" class="nav-link" @click="closeMobileMenu" aria-label="Ir a inicio">
            <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Home
          </router-link>

          <!-- Clubes -->
          <router-link to="/clubs" class="nav-link" @click="closeMobileMenu" aria-label="Ir a clubes">
            <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            Clubes
          </router-link>

          <!-- Temporadas (torneos viven dentro de una temporada) -->
          <router-link
            to="/seasons"
            class="nav-link"
            :class="{ 'router-link-active': isSeasonsRouteActive }"
            @click="closeMobileMenu"
            aria-label="Ir a temporadas"
          >
            <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M7 6H3a4 4 0 0 0 4 4"/><path d="M17 6h4a4 4 0 0 1-4 4"/></svg>
            Temporadas
          </router-link>

          <!-- Finanzas (mantenedor de costos + libro de ingresos/egresos) -->
          <router-link to="/ledger" class="nav-link" @click="closeMobileMenu" aria-label="Ir a finanzas">
            <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            Finanzas
          </router-link>

          <!-- Jugadores (con submenú de Transferencias) -->
          <div class="nav-item" :class="{ 'is-open': playersMenuOpen }">
            <button
              type="button"
              class="nav-link nav-link--dropdown"
              :class="{ 'router-link-active': isPlayersRouteActive }"
              @click.stop="togglePlayersMenu"
              :aria-expanded="playersMenuOpen"
              aria-haspopup="true"
              aria-label="Abrir menú de jugadores"
            >
              <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Jugadores
              <svg class="dropdown-arrow" :class="{ 'is-rotated': playersMenuOpen }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
            </button>

            <div class="nav-dropdown" v-if="playersMenuOpen" role="menu">
              <router-link to="/players" class="nav-dropdown__item" @click="closeAllMenus" role="menuitem">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                Lista de Jugadores
              </router-link>
              <router-link to="/transfers" class="nav-dropdown__item" @click="closeAllMenus" role="menuitem">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="17 1 21 5 17 9"/><line x1="3" y1="5" x2="21" y2="5"/><polyline points="7 23 3 19 7 15"/><line x1="21" y1="19" x2="3" y2="19"/></svg>
                Transferencias
              </router-link>
              <router-link to="/transfers/dashboard" class="nav-dropdown__item" @click="closeAllMenus" role="menuitem">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                KPIs Transferencias
              </router-link>
            </div>
          </div>

          <!-- Parámetros (Árbitros, Canchas, Horarios, Categorías) -->
          <div class="nav-item" :class="{ 'is-open': paramsMenuOpen }">
            <button
              type="button"
              class="nav-link nav-link--dropdown"
              :class="{ 'router-link-active': isParamsRouteActive }"
              @click.stop="toggleParamsMenu"
              :aria-expanded="paramsMenuOpen"
              aria-haspopup="true"
              aria-label="Abrir menú de parámetros"
            >
              <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
              Parámetros
              <svg class="dropdown-arrow" :class="{ 'is-rotated': paramsMenuOpen }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
            </button>

            <div class="nav-dropdown" v-if="paramsMenuOpen" role="menu">
              <router-link to="/referees" class="nav-dropdown__item" @click="closeAllMenus" role="menuitem">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
                Árbitros
              </router-link>
              <router-link to="/venues" class="nav-dropdown__item" @click="closeAllMenus" role="menuitem">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><line x1="12" y1="5" x2="12" y2="19"/><circle cx="12" cy="12" r="3"/></svg>
                Canchas
              </router-link>
              <router-link to="/schedules" class="nav-dropdown__item" @click="closeAllMenus" role="menuitem">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Horarios
              </router-link>
              <router-link to="/categories" class="nav-dropdown__item" @click="closeAllMenus" role="menuitem">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.24L3 3v6.59a2 2 0 0 0 .59 1.41l9.58 9.59a2 2 0 0 0 2.83 0l4.59-4.59a2 2 0 0 0 0-2.83z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>
                Categorías
              </router-link>
            </div>
          </div>
        </template>

        <!-- Administrador de club puro: solo ve su club -->
        <router-link
          v-else-if="myClub"
          :to="`/clubs/${myClub.id}`"
          class="nav-link"
          @click="closeMobileMenu"
          aria-label="Ir a mi club"
        >
          <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          {{ myClub.name }}
        </router-link>

        <!-- Jugador puro (vinculado vía lg_player_users, sin org ni club admin) -->
        <router-link
          v-else-if="authStore.state.player"
          to="/mi-perfil"
          class="nav-link"
          @click="closeMobileMenu"
          aria-label="Ir a mi perfil"
        >
          <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Mi Perfil
        </router-link>

      </div>

      <!-- Acciones de usuario -->
      <div class="navbar-actions">
        <button
          type="button"
          class="theme-toggle"
          @click="toggleTheme"
          :aria-label="theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
          :title="theme === 'dark' ? 'Modo claro' : 'Modo oscuro'"
        >
          <svg v-if="theme === 'dark'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </button>

        <div class="user-menu" @click="toggleUserMenu" role="button" tabindex="0" :aria-expanded="userMenuOpen" aria-haspopup="true" :aria-label="`Menú de ${userName}`">
          <div class="user-avatar" aria-hidden="true">{{ userInitials }}</div>
          <span class="user-name">{{ userName }}</span>
          <svg class="dropdown-arrow" :class="{ 'is-rotated': userMenuOpen }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>

          <div class="user-dropdown" v-if="userMenuOpen" role="menu">
            <button @click="handleLogout" class="dropdown-item logout" role="menuitem">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Cerrar Sesión
            </button>
          </div>
        </div>

        <button class="mobile-menu-toggle" @click="toggleMobileMenu" :aria-expanded="mobileMenuOpen" aria-label="Abrir menú" aria-controls="navbar-menu">
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>

    </div>
  </nav>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useTheme } from '../composables/useTheme';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const { theme, toggleTheme } = useTheme();

const mobileMenuOpen = ref(false);
const userMenuOpen   = ref(false);
const paramsMenuOpen = ref(false);
const playersMenuOpen = ref(false);

const myClub = computed(() => authStore.myClub());

const isParamsRouteActive = computed(() =>
  route.path.startsWith('/referees') || route.path.startsWith('/venues') || route.path.startsWith('/schedules') || route.path.startsWith('/categories')
);

const isSeasonsRouteActive = computed(() =>
  route.path.startsWith('/seasons') || route.path.startsWith('/tournaments') || route.path.startsWith('/matches')
);

const isPlayersRouteActive = computed(() =>
  route.path.startsWith('/players') || route.path.startsWith('/transfers')
);

const userName = computed(() =>
  authStore.user?.value?.nombre || authStore.state?.user?.email || 'Usuario'
);

const userInitials = computed(() => {
  const name = authStore.user?.value?.nombre || authStore.state?.user?.email || 'U';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
});

const toggleMobileMenu = () => { mobileMenuOpen.value = !mobileMenuOpen.value; };
const closeMobileMenu  = () => { mobileMenuOpen.value = false; paramsMenuOpen.value = false; playersMenuOpen.value = false; };
const toggleUserMenu   = () => { userMenuOpen.value = !userMenuOpen.value; };
const toggleParamsMenu = () => { paramsMenuOpen.value = !paramsMenuOpen.value; playersMenuOpen.value = false; };
const togglePlayersMenu = () => { playersMenuOpen.value = !playersMenuOpen.value; paramsMenuOpen.value = false; };
const closeAllMenus    = () => { paramsMenuOpen.value = false; playersMenuOpen.value = false; closeMobileMenu(); };

// Cierra los menús desplegables al hacer click fuera del navbar
function onClickOutside(e) {
  if (!e.target.closest('.navbar')) {
    userMenuOpen.value = false;
    paramsMenuOpen.value = false;
    playersMenuOpen.value = false;
  }
}
onMounted(()  => document.addEventListener('click', onClickOutside));
onUnmounted(() => document.removeEventListener('click', onClickOutside));

const handleLogout = async () => {
  authStore.logout();
  router.push('/login');
  userMenuOpen.value = false;
};
</script>

<style scoped>
/* ── Base navbar ─────────────────────────────────────────────────────────── */
.navbar {
  position: fixed;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 32px);
  max-width: 1200px;
  height: 62px;
  background: rgba(13, 14, 20, 0.78);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-radius: 60px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

.navbar-content {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  gap: var(--spacing-xl);
}

/* ── Logo ────────────────────────────────────────────────────────────────── */
.navbar-brand { flex-shrink: 0; }

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  color: var(--text-primary);
  font-family: 'Lora', serif;
  font-weight: 700;
  font-size: 1.2rem;
  transition: opacity var(--transition-fast);
}
.logo:hover { opacity: 0.8; }
.logo-icon { flex-shrink: 0; }
.logo-text {
  background: linear-gradient(135deg, #00e676, #4fc3f7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* ── Nav menu container ──────────────────────────────────────────────────── */
.navbar-menu {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex: 1;
}

/* ── Nav link base ───────────────────────────────────────────────────────── */
.nav-link {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0.45rem 0.9rem;
  color: var(--text-muted);
  text-decoration: none;
  border-radius: var(--radius-full);
  font-family: 'Raleway', sans-serif;
  font-weight: 600;
  font-size: 0.9rem;
  transition: all var(--transition-base);
  background: none;
  border: none;
  cursor: pointer;
}

.nav-link:hover {
  color: var(--primary-solid);
  background: rgba(0, 230, 118, 0.1);
}
.nav-link.router-link-active {
  color: var(--primary-solid);
  background: rgba(0, 230, 118, 0.14);
  box-shadow: inset 0 0 0 1px rgba(0, 230, 118, 0.25);
}

.nav-icon { flex-shrink: 0; }

/* ── Nav item con submenú (Parámetros) ──────────────────────────────────── */
.nav-item {
  position: relative;
}

.nav-link--dropdown .dropdown-arrow {
  margin-left: 2px;
}

.nav-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  min-width: 180px;
  background: rgba(16, 17, 24, 0.97);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 16px;
  border: 1px solid var(--border-color);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55);
  padding: var(--spacing-sm);
  display: flex;
  flex-direction: column;
  gap: 2px;
  animation: dropdownIn 0.18s ease-out;
  z-index: 20;
}

.nav-dropdown__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0.6rem 0.8rem;
  color: var(--text-muted);
  text-decoration: none;
  border-radius: 12px;
  font-family: 'Raleway', sans-serif;
  font-weight: 600;
  font-size: 0.875rem;
  transition: all var(--transition-base);
  white-space: nowrap;
}
.nav-dropdown__item:hover {
  color: var(--primary-solid);
  background: rgba(0, 230, 118, 0.1);
}
.nav-dropdown__item.router-link-active {
  color: var(--primary-solid);
  background: rgba(0, 230, 118, 0.14);
}

@keyframes dropdownIn {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── User menu ───────────────────────────────────────────────────────────── */
.navbar-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 50%;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-base);
}
.theme-toggle:hover {
  background: rgba(0, 230, 118, 0.1);
  color: var(--primary-solid);
}

.user-menu {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px 6px 6px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-full);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
  cursor: pointer;
  transition: all var(--transition-base);
}
.user-menu:hover {
  background: rgba(255, 255, 255, 0.1);
}

.user-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(135deg, #00c853, #4fc3f7);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.8125rem;
  color: #04120a;
  flex-shrink: 0;
}

.user-name {
  font-family: 'Raleway', sans-serif;
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--text-primary);
}
.dropdown-arrow {
  color: var(--text-muted);
  transition: transform var(--transition-base);
  flex-shrink: 0;
}
.dropdown-arrow.is-rotated { transform: rotate(180deg); }

.user-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 200px;
  background: rgba(16, 17, 24, 0.97);
  backdrop-filter: blur(12px);
  border-radius: 18px;
  border: 1px solid var(--border-color);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55);
  padding: var(--spacing-sm);
  animation: dropdownIn 0.18s ease-out;
  z-index: 20;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 0.7rem 1rem;
  background: none;
  border: none;
  color: var(--text-muted);
  border-radius: 12px;
  cursor: pointer;
  transition: all var(--transition-base);
  font-family: 'Raleway', sans-serif;
  font-size: 0.875rem;
  font-weight: 600;
  text-align: left;
}
.dropdown-item:hover        { background: rgba(0, 230, 118, 0.1); color: var(--primary-solid); }
.dropdown-item.logout       { color: var(--accent-red); }
.dropdown-item.logout:hover { background: rgba(248, 113, 113, 0.1); color: var(--accent-red); }

/* ── Mobile hamburger ────────────────────────────────────────────────────── */
.mobile-menu-toggle {
  display: none;
  flex-direction: column;
  gap: 5px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: var(--radius-md);
  transition: box-shadow var(--transition-base);
}
.mobile-menu-toggle:hover {
  background: rgba(255, 255, 255, 0.07);
}
.mobile-menu-toggle span {
  width: 22px;
  height: 2px;
  background: var(--text-primary);
  border-radius: 2px;
  display: block;
  transition: all var(--transition-base);
}

/* ── Responsive ──────────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .navbar {
    top: 0;
    width: 100%;
    border-radius: 0 0 24px 24px;
  }

  .navbar-menu {
    position: fixed;
    top: 72px;
    left: 12px;
    right: 12px;
    flex-direction: column;
    align-items: stretch;
    background: rgba(16, 17, 24, 0.97);
    backdrop-filter: blur(14px);
    border-radius: 20px;
    border: 1px solid var(--border-color);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55);
    padding: var(--spacing-md);
    gap: 4px;
    transform: translateY(-10px);
    opacity: 0;
    transition: all var(--transition-base);
    pointer-events: none;
  }
  .navbar-menu.is-active {
    transform: translateY(0);
    opacity: 1;
    pointer-events: all;
  }

  .nav-link { width: 100%; justify-content: flex-start; }

  .nav-item { width: 100%; }
  .nav-dropdown {
    position: static;
    margin-top: 4px;
    box-shadow: none;
    border-color: transparent;
    background: rgba(255, 255, 255, 0.04);
  }

  .mobile-menu-toggle { display: flex; }
  .user-name { display: none; }
}
</style>
