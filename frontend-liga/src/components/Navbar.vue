<template>
  <nav
    class="navbar"
    :class="{ 'navbar--sidebar': navLayout === 'sidebar', 'navbar--top': navLayout === 'top' }"
    role="navigation"
    aria-label="Navegación principal"
  >
    <div class="container navbar-content">

      <!-- Logo -->
      <div class="navbar-brand">
        <router-link to="/home" class="logo" aria-label="SuperLigas inicio">
          <svg class="logo-icon" width="30" height="30" viewBox="0 0 100 100" fill="none" aria-hidden="true">
            <circle cx="50" cy="50" r="46" fill="url(#nav-grad)" stroke="#ffffff" stroke-width="4"/>
            <path d="M 50 32 L 50 14" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
            <path d="M 67 44 L 85 38" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
            <path d="M 61 65 L 75 83" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
            <path d="M 39 65 L 25 83" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
            <path d="M 33 44 L 15 38" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
            <polygon points="50,32 67,44 61,65 39,65 33,44" fill="#ffffff" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round"/>
            <polygon points="50,14 36,4 64,4" fill="#ffffff" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
            <polygon points="85,38 96,24 94,54" fill="#ffffff" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
            <polygon points="75,83 88,72 63,95" fill="#ffffff" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
            <polygon points="25,83 37,95 12,72" fill="#ffffff" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
            <polygon points="15,38 6,54 4,24" fill="#ffffff" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
            <defs>
              <linearGradient id="nav-grad" x1="0" y1="0" x2="30" y2="30">
                <stop offset="0%" stop-color="var(--primary-dark)"/>
                <stop offset="100%" stop-color="var(--primary-solid)"/>
              </linearGradient>
            </defs>
          </svg>
          <span class="logo-text">SuperLigas</span>
        </router-link>
      </div>

      <!-- Menu principal -->
      <div id="navbar-menu" class="navbar-menu" :class="{ 'is-active': mobileMenuOpen }">

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

          <!-- Votaciones (elecciones por club) -->
          <router-link to="/votaciones" class="nav-link" @click="closeMobileMenu" aria-label="Ir a votaciones">
            <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 12l2 2 4-4"/><path d="M5 7V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><rect x="3" y="7" width="18" height="14" rx="2"/></svg>
            Votaciones
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
              <router-link to="/match-scheduling" class="nav-dropdown__item" @click="closeAllMenus" role="menuitem">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Programación de Fecha
              </router-link>
              <router-link to="/scheduling-settings" class="nav-dropdown__item" @click="closeAllMenus" role="menuitem">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><polyline points="12 9 12 13 14.5 14.5"/><path d="M9 2h6"/><path d="M19 5l-1.5-1.5"/></svg>
                Duración de Partidos
              </router-link>
              <router-link to="/penalty-catalog" class="nav-dropdown__item" @click="closeAllMenus" role="menuitem">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="14" rx="2"/><line x1="2" y1="9" x2="22" y2="9"/><line x1="6" y1="14" x2="10" y2="14"/></svg>
                Castigos
              </router-link>
              <router-link to="/disciplinary/articles" class="nav-dropdown__item" @click="closeAllMenus" role="menuitem">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                Reglamento y Faltas
              </router-link>
              <router-link to="/disciplinary/tribunal" class="nav-dropdown__item" @click="closeAllMenus" role="menuitem">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v18"/><path d="M5 7l-3 6a4 4 0 0 0 6 0z"/><path d="M19 7l-3 6a4 4 0 0 0 6 0z"/><path d="M3 21h18"/><path d="M5 7h14"/></svg>
                Tribunal de Disciplina
              </router-link>
              <router-link to="/disciplinary/sanctions" class="nav-dropdown__item" @click="closeAllMenus" role="menuitem">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                Sancionados Vigentes
              </router-link>
            </div>
          </div>
        </template>

        <!-- Administrador de club puro: solo ve su club, sus temporadas/torneos y sus finanzas -->
        <template v-else-if="myClub">
          <router-link
            :to="`/clubs/${myClub.id}`"
            class="nav-link"
            @click="closeMobileMenu"
            aria-label="Ir a mi club"
          >
            <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            {{ myClub.name }}
          </router-link>

          <router-link
            :to="`/clubs/${myClub.id}/seasons`"
            class="nav-link"
            @click="closeMobileMenu"
            aria-label="Ir a temporadas"
          >
            <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M7 6H3a4 4 0 0 0 4 4"/><path d="M17 6h4a4 4 0 0 1-4 4"/></svg>
            Temporadas
          </router-link>

          <router-link
            :to="`/clubs/${myClub.id}/finance`"
            class="nav-link"
            @click="closeMobileMenu"
            aria-label="Ir a finanzas"
          >
            <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            Finanzas
          </router-link>

          <router-link to="/votaciones" class="nav-link" @click="closeMobileMenu" aria-label="Ir a votaciones">
            <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 12l2 2 4-4"/><path d="M5 7V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><rect x="3" y="7" width="18" height="14" rx="2"/></svg>
            Votaciones
          </router-link>
        </template>

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

      <!-- Acciones de usuario y controles -->
      <div class="navbar-actions">
        <div class="control-buttons">
          <button
            v-if="authStore.isOrgAdmin()"
            type="button"
            class="icon-btn"
            @click="showAdminSettings = true"
            aria-label="Abrir configuración de administrador"
            title="Configuración de administrador"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>

          <!-- Botón de cambio de posición de barra (Superior / Lateral) -->
          <button
            type="button"
            class="icon-btn layout-toggle-btn"
            @click="toggleNavLayout"
            :aria-label="navLayout === 'sidebar' ? 'Cambiar a barra superior' : 'Cambiar a barra lateral izquierda'"
            :title="navLayout === 'sidebar' ? 'Cambiar a barra superior' : 'Cambiar a barra lateral izquierda'"
          >
            <!-- Ícono barra superior activa (muestra opción de lateral) -->
            <svg v-if="navLayout === 'top'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="3"/>
              <line x1="9" y1="3" x2="9" y2="21"/>
              <path d="M14 9l3 3-3 3"/>
            </svg>
            <!-- Ícono barra lateral activa (muestra opción de superior) -->
            <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="3"/>
              <line x1="3" y1="9" x2="21" y2="9"/>
              <path d="M9 14l3-3 3 3"/>
            </svg>
          </button>

          <!-- Tema Claro / Oscuro -->
          <button
            type="button"
            class="icon-btn theme-toggle"
            @click="toggleTheme"
            :aria-label="theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
            :title="theme === 'dark' ? 'Modo claro' : 'Modo oscuro'"
            :aria-pressed="theme === 'dark'"
          >
            <svg v-if="theme === 'dark'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          </button>

          <!-- Toggle Menú Móvil -->
          <button class="mobile-menu-toggle" @click="toggleMobileMenu" :aria-expanded="mobileMenuOpen" :aria-label="mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'" aria-controls="navbar-menu">
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>

        <!-- Menú de Usuario -->
        <div class="user-menu" @click="toggleUserMenu" @keydown.enter.prevent="toggleUserMenu" @keydown.space.prevent="toggleUserMenu" role="button" tabindex="0" :aria-expanded="userMenuOpen" aria-haspopup="true" :aria-label="`Menú de ${userName}`">
          <div class="user-avatar" aria-hidden="true">{{ userInitials }}</div>
          <div class="user-info">
            <span class="user-name" :title="userName">{{ userName }}</span>
            <span class="user-role-label">{{ authStore.isOrgAdmin() ? 'Administrador' : (myClub ? 'Club' : 'Jugador') }}</span>
          </div>
          <svg class="dropdown-arrow" :class="{ 'is-rotated': userMenuOpen }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>

          <div class="user-dropdown" v-if="userMenuOpen" role="menu">
            <button @click="toggleNavLayout" class="dropdown-item" role="menuitem">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <line x1="9" y1="3" x2="9" y2="21"/>
              </svg>
              {{ navLayout === 'sidebar' ? 'Cambiar a Barra Superior' : 'Cambiar a Barra Lateral' }}
            </button>
            <button @click="handleLogout" class="dropdown-item logout" role="menuitem">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>

    </div>

    <AdminSettingsModal v-if="showAdminSettings" @close="showAdminSettings = false" />
  </nav>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useTheme } from '../composables/useTheme';
import { useNavLayout } from '../composables/useNavLayout';
import AdminSettingsModal from './AdminSettingsModal.vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const { theme, toggleTheme } = useTheme();
const { navLayout, toggleNavLayout } = useNavLayout();

const mobileMenuOpen = ref(false);
const userMenuOpen   = ref(false);
const paramsMenuOpen = ref(false);
const playersMenuOpen = ref(false);
const showAdminSettings = ref(false);

const myClub = computed(() => authStore.myClub());

const isParamsRouteActive = computed(() =>
  route.path.startsWith('/referees') || route.path.startsWith('/venues') || route.path.startsWith('/schedules') || route.path.startsWith('/categories') || route.path.startsWith('/match-scheduling') || route.path.startsWith('/scheduling-settings') || route.path.startsWith('/penalty-catalog') || route.path.startsWith('/disciplinary')
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

const toggleMobileMenu = () => {
  mobileMenuOpen.value = !mobileMenuOpen.value;
  userMenuOpen.value = false;
};
const closeMobileMenu  = () => { mobileMenuOpen.value = false; paramsMenuOpen.value = false; playersMenuOpen.value = false; };
const toggleUserMenu   = () => {
  userMenuOpen.value = !userMenuOpen.value;
  mobileMenuOpen.value = false;
  paramsMenuOpen.value = false;
  playersMenuOpen.value = false;
};
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
  max-width: 1440px;
  height: 62px;
  background: color-mix(in srgb, var(--surface-raised) 88%, transparent);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-radius: 60px;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-lg);
  z-index: 1000;
  transition: all var(--transition-base, 0.3s ease);
}

.navbar-content {
  position: relative;
  width: 100%;
  max-width: none;
  margin: 0;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  gap: var(--spacing-xl, 24px);
  min-width: 0;
}

/* ── Logo ────────────────────────────────────────────────────────────────── */
.navbar-brand { flex-shrink: 0; }

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: var(--text-primary);
  font-family: var(--font-ui);
  font-weight: 700;
  font-size: 1.2rem;
  transition: opacity var(--transition-fast, 0.15s ease);
}
.logo:hover { opacity: 0.85; }
.logo-icon { flex-shrink: 0; }
.logo-text {
  background: linear-gradient(135deg, var(--primary-solid), var(--sport-blue, #29b6f6));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: -0.02em;
}

/* ── Nav menu container ──────────────────────────────────────────────────── */
.navbar-menu {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm, 8px);
  flex: 1;
  min-width: 0;
}

/* ── Nav link base ───────────────────────────────────────────────────────── */
.nav-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0.5rem 0.95rem;
  color: var(--text-muted);
  text-decoration: none;
  border-radius: var(--radius-full, 9999px);
  font-family: var(--font-ui);
  font-weight: 600;
  font-size: 0.9rem;
  background: none;
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast, 0.15s ease);
}

.nav-link:hover {
  color: var(--primary-solid);
  background: var(--success-bg, rgba(0, 230, 118, 0.12));
}
.nav-link.router-link-active {
  color: var(--primary-solid);
  background: var(--success-bg, rgba(0, 230, 118, 0.12));
  box-shadow: inset 0 0 0 1px var(--primary-solid);
}

.nav-icon { flex-shrink: 0; }

/* ── Nav item con submenú (Parámetros / Jugadores) ───────────────────────── */
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
  min-width: 190px;
  background: var(--surface-overlay, #1a1c23);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-radius: 16px;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-xl);
  padding: var(--spacing-sm, 8px);
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
  min-height: 40px;
  box-sizing: border-box;
  padding: 0.5rem 0.8rem;
  color: var(--text-muted);
  text-decoration: none;
  border-radius: 10px;
  font-family: var(--font-ui);
  font-weight: 600;
  font-size: 0.875rem;
  white-space: nowrap;
  transition: all var(--transition-fast, 0.15s ease);
}
.nav-dropdown__item:hover {
  color: var(--primary-solid);
  background: var(--success-bg, rgba(0, 230, 118, 0.12));
}
.nav-dropdown__item.router-link-active {
  color: var(--primary-solid);
  background: var(--success-bg, rgba(0, 230, 118, 0.12));
}

@keyframes dropdownIn {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── User menu & actions ─────────────────────────────────────────────────── */
.navbar-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-md, 12px);
  min-width: 0;
  margin-left: auto;
  flex: 0 1 auto;
}

.control-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  background: var(--surface-hover);
  border: 1px solid var(--border-color);
  border-radius: 50%;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-fast, 0.15s ease);
}
.icon-btn:hover {
  background: var(--success-bg, rgba(0, 230, 118, 0.12));
  color: var(--primary-solid);
  border-color: var(--primary-solid);
}

:global([data-theme="light"]) .navbar {
  background: color-mix(in srgb, var(--surface-raised, #ffffff) 94%, transparent);
  border-color: color-mix(in srgb, var(--surface-border, #e2e8f0) 86%, var(--primary-solid));
  box-shadow: 0 12px 34px rgba(24, 61, 42, 0.12), 0 1px 3px rgba(24, 61, 42, 0.08);
}

:global([data-theme="light"]) .icon-btn {
  background: var(--surface-overlay, #f8fafc);
  color: var(--text-secondary);
}

.user-menu {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 12px 4px 5px;
  background: var(--surface-hover);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-full, 9999px);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  min-width: 0;
  max-width: min(220px, 100%);
  min-height: 42px;
  flex: 0 1 auto;
  transition: all var(--transition-fast, 0.15s ease);
}
.user-menu:hover {
  background: var(--surface-overlay);
  border-color: var(--border-strong, var(--border-color));
}

.user-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary-dark), var(--sport-blue, #29b6f6));
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.8125rem;
  color: #ffffff;
  flex-shrink: 0;
}

.user-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.2;
}

.user-name {
  font-family: var(--font-ui);
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--text-primary);
  min-width: 0;
  max-width: 14ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-role-label {
  font-size: 0.7rem;
  color: var(--text-muted);
  font-weight: 500;
}

.dropdown-arrow {
  color: var(--text-muted);
  transition: transform var(--transition-base, 0.3s ease);
  flex-shrink: 0;
  margin-left: auto;
}
.dropdown-arrow.is-rotated { transform: rotate(180deg); }

.user-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 220px;
  background: var(--surface-overlay, #1a1c23);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-radius: 16px;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-xl);
  padding: var(--spacing-sm, 8px);
  animation: dropdownIn 0.18s ease-out;
  z-index: 40;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 0.65rem 0.9rem;
  background: none;
  border: none;
  color: var(--text-muted);
  border-radius: 10px;
  cursor: pointer;
  font-family: var(--font-ui);
  font-size: 0.85rem;
  font-weight: 600;
  text-align: left;
  transition: all var(--transition-fast, 0.15s ease);
}
.dropdown-item:hover        { background: var(--success-bg, rgba(0, 230, 118, 0.12)); color: var(--primary-solid); }
.dropdown-item.logout       { color: var(--accent-red, #ef5350); }
.dropdown-item.logout:hover { background: rgba(239, 83, 80, 0.12); color: var(--accent-red, #ef5350); }

/* ── Mobile hamburger ────────────────────────────────────────────────────── */
.mobile-menu-toggle {
  display: none;
  flex-direction: column;
  gap: 5px;
  background: none;
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: var(--radius-md, 10px);
}
.mobile-menu-toggle:hover {
  background: var(--surface-hover);
}
.mobile-menu-toggle span {
  width: 20px;
  height: 2px;
  background: var(--text-primary);
  border-radius: 2px;
  display: block;
  transition: transform var(--transition-base, 0.3s ease), opacity var(--transition-base, 0.3s ease);
}

/* ==========================================================================
   BARRA LATERAL (SIDEBAR MODE)
   ========================================================================== */
@media (min-width: 992px) {
  .navbar.navbar--sidebar {
    top: 14px;
    left: 14px;
    bottom: 14px;
    transform: none;
    width: 250px;
    max-width: 250px;
    height: calc(100vh - 28px);
    border-radius: 22px;
    padding: 0;
    display: flex;
    flex-direction: column;
  }

  .navbar.navbar--sidebar .navbar-content {
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    padding: 20px 14px 16px 14px;
    gap: 14px;
    height: 100%;
    overflow: hidden;
  }

  .navbar.navbar--sidebar .navbar-brand {
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border-color);
    width: 100%;
  }

  .navbar.navbar--sidebar .navbar-menu {
    position: static;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    width: 100%;
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding-right: 2px;
    gap: 4px;
    opacity: 1;
    visibility: visible;
    transform: none;
    background: none;
    box-shadow: none;
    border: none;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    max-height: none;
  }

  /* Scrollbar estético */
  .navbar.navbar--sidebar .navbar-menu::-webkit-scrollbar {
    width: 4px;
  }
  .navbar.navbar--sidebar .navbar-menu::-webkit-scrollbar-thumb {
    background: var(--surface-hover);
    border-radius: 4px;
  }

  .navbar.navbar--sidebar .nav-link {
    width: 100%;
    justify-content: flex-start;
    padding: 0.62rem 0.85rem;
    border-radius: 12px;
  }

  .navbar.navbar--sidebar .nav-item {
    width: 100%;
  }

  .navbar.navbar--sidebar .nav-dropdown {
    position: static;
    margin-top: 4px;
    margin-bottom: 4px;
    box-shadow: none;
    border: 1px solid var(--border-color);
    background: var(--surface-hover);
    padding: 6px;
    border-radius: 12px;
    gap: 2px;
    animation: none;
  }

  .navbar.navbar--sidebar .nav-dropdown__item {
    min-height: 36px;
    padding: 0.45rem 0.65rem;
    font-size: 0.825rem;
    white-space: normal;
  }

  .navbar.navbar--sidebar .navbar-actions {
    flex-direction: column;
    align-items: stretch;
    width: 100%;
    margin-top: auto;
    padding-top: 12px;
    border-top: 1px solid var(--border-color);
    gap: 10px;
    margin-left: 0;
  }

  .navbar.navbar--sidebar .control-buttons {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    gap: 6px;
  }

  .navbar.navbar--sidebar .icon-btn {
    flex: 1;
    border-radius: 12px;
  }

  .navbar.navbar--sidebar .user-menu {
    width: 100%;
    max-width: 100%;
    border-radius: 14px;
    padding: 6px 10px;
  }

  .navbar.navbar--sidebar .user-dropdown {
    top: auto;
    bottom: calc(100% + 8px);
    right: 0;
    left: 0;
    min-width: 100%;
  }
}

/* ── Responsive para modo Top Bar o pantallas pequeñas ───────────────────── */
@media (max-width: 1360px) {
  /* Si está en modo top (o en pantallas intermedias sin sidebar), el menú se colapsa */
  .navbar--top .navbar-menu {
    position: absolute;
    top: calc(100% + 10px);
    left: 0;
    right: 0;
    flex-direction: column;
    align-items: stretch;
    background: var(--surface-overlay);
    backdrop-filter: blur(14px);
    border-radius: 20px;
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-xl);
    padding: var(--spacing-md);
    gap: 4px;
    transform: translateY(-10px);
    opacity: 0;
    visibility: hidden;
    transition: transform var(--transition-base), opacity var(--transition-base);
    pointer-events: none;
    max-height: calc(100dvh - 98px);
    overflow-y: auto;
    z-index: 30;
  }
  .navbar--top .navbar-menu.is-active {
    transform: translateY(0);
    opacity: 1;
    visibility: visible;
    pointer-events: all;
  }

  .navbar--top .nav-link { width: 100%; justify-content: flex-start; }
  .navbar--top .nav-item { width: 100%; }
  .navbar--top .nav-dropdown {
    position: static;
    margin-top: 4px;
    box-shadow: none;
    border-color: transparent;
    background: var(--surface-hover);
  }

  .navbar--top .mobile-menu-toggle { display: flex; }
}

@media (max-width: 991px) {
  /* En pantallas móviles y tablets, el sidebar se convierte en top bar drawer */
  .navbar {
    top: 0;
    left: 0;
    transform: none;
    width: 100%;
    border-radius: 0 0 20px 20px;
    max-width: 100%;
  }

  .navbar-content {
    padding-inline: var(--spacing-md, 16px);
    gap: var(--spacing-md, 16px);
  }

  .navbar-menu {
    position: absolute;
    top: calc(100% + 10px);
    left: 12px;
    right: 12px;
    flex-direction: column;
    align-items: stretch;
    background: var(--surface-overlay);
    backdrop-filter: blur(14px);
    border-radius: 20px;
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-xl);
    padding: var(--spacing-md);
    gap: 4px;
    transform: translateY(-10px);
    opacity: 0;
    visibility: hidden;
    transition: transform var(--transition-base), opacity var(--transition-base);
    pointer-events: none;
    max-height: calc(100dvh - 84px);
    overflow-y: auto;
    z-index: 30;
  }

  .navbar-menu.is-active {
    transform: translateY(0);
    opacity: 1;
    visibility: visible;
    pointer-events: all;
  }

  .nav-link { width: 100%; justify-content: flex-start; }
  .nav-item { width: 100%; }
  .nav-dropdown {
    position: static;
    margin-top: 4px;
    box-shadow: none;
    border-color: transparent;
    background: var(--surface-hover);
  }

  .mobile-menu-toggle { display: flex; }
  .user-role-label { display: none; }
  .user-name { display: none; }
  .user-menu { padding: 4px; }
  .user-menu .dropdown-arrow { display: none; }
  .layout-toggle-btn { display: none; } /* Ocultar toggle en móviles ya que el sidebar es solo desktop */
}
</style>
