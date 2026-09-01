<template>
  <div class="container mt-md">
    <!-- Header -->
    <div class="flex justify-between items-center mb-lg">
      <h2>Clubes</h2>
      <button 
        class="btn" 
        :class="viewMode === 'list' ? 'btn-primary' : 'btn-secondary'"
        @click="toggleViewMode"
      >
        {{ viewMode === 'list' ? 'Nuevo Club' : 'Volver al listado' }}
      </button>
    </div>

    <div v-if="error" class="alert alert-error">
      {{ error }}
    </div>

    <!-- Create/Edit Form -->
    <div v-if="viewMode === 'form'" class="mb-lg card">
      <h3 class="mb-md">{{ form.id ? 'Editar Club' : 'Crear Nuevo Club' }}</h3>
      <form @submit.prevent="saveClub">
        <div class="flex flex-col gap-md">
          <div class="input-group">
            <label class="label">Nombre</label>
            <input v-model="form.name" class="input" required />
          </div>
          <div class="input-group">
            <label class="label">Nombre corto</label>
            <input v-model="form.short_name" class="input" />
          </div>
          <div class="input-group">
            <label class="label">Colores</label>
            <input v-model="form.colors" class="input" placeholder="Ej: Azul / Blanco" />
          </div>
          
          <!-- Logo Upload -->
          <div class="input-group">
            <label class="label">Logo del Club</label>
            <div class="flex items-center gap-md">
              <div v-if="form.logo_url" class="logo-preview">
                <img :src="form.logo_url" alt="Logo preview" />
                <button type="button" class="btn-icon-remove" @click="removeLogo">×</button>
              </div>
              <div class="flex-1">
                <input 
                  type="file" 
                  accept="image/*" 
                  @change="handleFileChange" 
                  class="input"
                  :disabled="uploading"
                />
                <p v-if="uploading" class="text-sm text-info mt-xs">Subiendo imagen...</p>
              </div>
            </div>
          </div>

          <div class="input-group">
            <label class="label">Descripción</label>
            <textarea v-model="form.description" class="input" rows="3" />
          </div>
          <div class="section-divider">Configuración de Nómina</div>
          <div class="folio-config-row">
            <div class="input-group">
              <label class="label">Folio inicio *</label>
              <input v-model.number="form.folio_start" type="number" min="1" class="input" required />
            </div>
            <div class="input-group">
              <label class="label">Folio término *</label>
              <input v-model.number="form.folio_end" type="number" min="1" class="input" required />
            </div>
            <div class="input-group">
              <label class="label">Máx. jugadores</label>
              <input v-model.number="form.max_players" type="number" min="1" max="200" class="input" />
            </div>
          </div>
          <p v-if="form.folio_start && form.folio_end" class="field-hint">
            Rango: {{ form.folio_start }} – {{ form.folio_end }}
            ({{ form.folio_end - form.folio_start + 1 }} folios)
          </p>
        </div>
        <div class="flex justify-between items-center mt-md">
          <span class="text-muted text-sm">
            * Campos requeridos
          </span>
          <div class="flex gap-sm">
            <button type="button" class="btn btn-secondary" @click="cancelForm">
              Cancelar
            </button>
            <button type="submit" class="btn btn-primary" :disabled="loading || uploading">
              {{ loading ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>
        </div>
      </form>
    </div>

    <template v-if="viewMode === 'list'">
      <!-- Dashboard: tarjetas-submenú -->
      <section class="pd-dash mb-lg">
        <div class="pd-dash__glow pd-dash__glow--green" aria-hidden="true"></div>
        <div class="pd-dash__glow pd-dash__glow--blue" aria-hidden="true"></div>

        <div class="pd-dash__head">
          <span class="pd-dash__kicker">Resumen de la liga</span>
          <h3 class="pd-dash__title">
            Panorama de <span class="pd-dash__title-accent">clubes</span>
          </h3>
          <p class="pd-dash__desc">Estado general de los equipos de la organización, actualizado en vivo.</p>
        </div>

        <div class="pd-dash__grid">
          <article
            v-for="tile in dashboardTiles"
            :key="tile.key"
            class="pd-tile"
            :class="[`pd-tile--${tile.color}`, { 'pd-tile--selected': selectedTileKey === tile.key }]"
            role="button"
            tabindex="0"
            @click="selectTile(tile.key)"
            @keyup.enter="selectTile(tile.key)"
          >
            <div class="pd-tile__icon" v-html="tile.icon"></div>
            <div class="pd-tile__body">
              <span class="pd-tile__label">{{ tile.label }}</span>
              <strong class="pd-tile__value">{{ tile.value }}</strong>
              <span class="pd-tile__trend">{{ tile.meta }}</span>
            </div>
          </article>
        </div>
      </section>

      <!-- Tabla, según la tarjeta seleccionada -->
      <div class="card p-0">
        <div class="flex justify-between items-center p-md" style="border-bottom: 1px solid var(--border-color);">
          <h3 class="m-0">{{ selectedTileLabel }}</h3>
          <span v-if="isClubsTableAvailable" class="text-muted text-sm">
            {{ filteredClubs.length }} en total
          </span>
        </div>

        <template v-if="isClubsTableAvailable">
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Logo</th>
                  <th>Nombre</th>
                  <th>Nombre Corto</th>
                  <th>Colores</th>
                  <th class="text-center">Jugadores Activos</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="loading && items.length === 0">
                  <td colspan="6" class="text-center py-lg">Cargando...</td>
                </tr>
                <tr v-else-if="filteredClubs.length === 0">
                  <td colspan="6" class="text-center py-lg">No hay clubes en esta selección.</td>
                </tr>
                <tr v-for="club in paginatedItems" :key="club.id">
                  <td>
                    <div class="club-logo-small">
                      <img v-if="club.logo_url" :src="club.logo_url" :alt="club.name" />
                      <span v-else class="logo-placeholder">⚽</span>
                    </div>
                  </td>
                  <td>
                    <span class="font-medium">{{ club.name }}</span>
                  </td>
                  <td>{{ club.short_name }}</td>
                  <td>
                    <span class="badge">{{ club.colors || 'N/A' }}</span>
                  </td>
                  <td class="text-center">
                    <span class="player-count-badge" :class="{ 'player-count-badge--empty': !club.active_players_count }">
                      {{ club.active_players_count ?? '—' }}
                    </span>
                  </td>
                  <td>
                    <button class="btn btn-sm btn-secondary" @click="goToDetail(club.id)">
                      Ver Detalle
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="cards-container-mobile">
            <div
              v-for="club in paginatedItems"
              :key="club.id"
              class="club-card-mobile"
            >
              <div class="club-card-mobile-header">
                <div class="club-logo-small">
                  <img v-if="club.logo_url" :src="club.logo_url" :alt="club.name" />
                  <span v-else class="logo-placeholder">⚽</span>
                </div>
                <div class="club-card-mobile-title">
                  <div class="font-medium">
                    {{ club.name }}
                  </div>
                  <div class="text-sm text-muted">
                    {{ club.short_name }}
                  </div>
                </div>
              </div>
              <div class="club-card-mobile-body">
                <span class="badge">{{ club.colors || 'N/A' }}</span>
                <span class="player-count-mobile">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  {{ club.active_players_count ?? 0 }} jugadores activos
                </span>
              </div>
              <div class="club-card-mobile-footer">
                <button class="btn btn-sm btn-secondary btn-full" @click="goToDetail(club.id)">
                  Ver Detalle
                </button>
              </div>
            </div>
          </div>

          <div v-if="filteredClubs.length > 0" class="pagination mb-md">
            <button
              class="pagination-btn"
              :disabled="!hasPrevPage"
              @click="goToPrevPage"
            >
              Anterior
            </button>

            <div class="pagination-center">
              <select
                class="input pagination-size"
                :value="itemsPerPage"
                @change="handlePageSizeChange($event.target.value)"
              >
                <option v-for="size in pageSizeOptions" :key="size" :value="size">
                  {{ size }}
                </option>
              </select>
              <span class="pagination-info">
                Página {{ currentPage }} de {{ totalPages }}
              </span>
            </div>

            <button
              class="pagination-btn"
              :disabled="!hasNextPage"
              @click="goToNextPage"
            >
              Siguiente
            </button>
          </div>
        </template>

        <div v-else class="text-center py-lg text-muted">
          Esta vista aún no está disponible: el backend todavía no expone la fecha de alta de los clubes.
        </div>
      </div>
    </template>

    <!-- Post Save Modal/Dialog Overlay -->
    <div v-if="showPostSaveDialog" class="modal-overlay">
      <div class="modal-content card">
        <h3 class="mb-md text-center">¡Club Guardado con Éxito!</h3>
        <p class="text-center mb-lg">¿Qué deseas hacer ahora?</p>
        <div class="flex flex-col gap-md">
          <button class="btn btn-primary btn-full" @click="handlePostSaveOption('create_another')">
            Ingresar otro club
          </button>
          <button class="btn btn-secondary btn-full" @click="handlePostSaveOption('back')">
            Volver al listado
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useClubsStore } from '../stores/clubs';
import { useAuthStore } from '../stores/auth';
import { useNotifyStore } from '../stores/notify';
import { uploadImage } from '../services/cloudinary.service';

const router = useRouter();
const { items, loading, error, fetchClubs, createOrUpdateClub } = useClubsStore();
const authStore = useAuthStore();
const { notifyError } = useNotifyStore();

const viewMode = ref('list');
const uploading = ref(false);
const showPostSaveDialog = ref(false);

const currentPage = ref(1);
const itemsPerPage = ref(10);
const pageSizeOptions = [10, 20, 50];

// Carga todos los clubes de la org de una vez: sin endpoint de filtro por
// estado/fecha en el backend, el submenú (activos/inactivos/promedio) y su
// paginación se calculan en el cliente sobre este set completo.
const CLUBS_FETCH_LIMIT = 500;

const icons = {
  checkCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  xCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  userPlus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
};

// Un club se considera "activo" si tiene al menos un jugador activo en plantilla;
// no existe (aún) un campo de estado propio del club en el backend.
const activeClubs   = computed(() => items.value.filter(c => (c.active_players_count || 0) > 0));
const inactiveClubs = computed(() => items.value.filter(c => !((c.active_players_count || 0) > 0)));

const avgPlayersPerClub = computed(() => {
  const total = items.value.length;
  if (!total) return 0;
  const sum = items.value.reduce((acc, c) => acc + (c.active_players_count || 0), 0);
  return Math.round((sum / total) * 10) / 10;
});

const dashboardTiles = computed(() => [
  { key: 'active',   label: 'Equipos activos',   value: activeClubs.value.length,   meta: 'con jugadores activos', color: 'green', icon: icons.checkCircle },
  { key: 'inactive', label: 'Equipos inactivos', value: inactiveClubs.value.length, meta: 'sin jugadores activos', color: 'red',   icon: icons.xCircle },
  { key: 'new',      label: 'Equipos nuevos',    value: '—',                        meta: 'aún no disponible',    color: 'gold',  icon: icons.userPlus },
  { key: 'average',  label: 'Promedio de jugadores por equipo', value: avgPlayersPerClub.value, meta: 'jugadores / equipo', color: 'blue', icon: icons.users },
]);

const selectedTileKey = ref('active');

const selectedTileLabel = computed(() => {
  const tile = dashboardTiles.value.find(t => t.key === selectedTileKey.value);
  return tile ? tile.label : '';
});

// "new" no tiene datos reales (sin fecha de alta en el backend); el resto sí.
const isClubsTableAvailable = computed(() => selectedTileKey.value !== 'new');

const filteredClubs = computed(() => {
  if (selectedTileKey.value === 'active')   return activeClubs.value;
  if (selectedTileKey.value === 'inactive') return inactiveClubs.value;
  if (selectedTileKey.value === 'average') {
    return [...items.value].sort((a, b) => (b.active_players_count || 0) - (a.active_players_count || 0));
  }
  return [];
});

const selectTile = (key) => {
  selectedTileKey.value = key;
  currentPage.value = 1;
};

const totalPages = computed(() => Math.max(1, Math.ceil(filteredClubs.value.length / itemsPerPage.value)));

const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  return filteredClubs.value.slice(start, start + itemsPerPage.value);
});

const hasNextPage = computed(() => currentPage.value < totalPages.value);
const hasPrevPage = computed(() => currentPage.value > 1);

const form = reactive({
  id:          null,
  name:        '',
  short_name:  '',
  colors:      '',
  description: '',
  logo_url:    '',
  folio_start: null,
  folio_end:   null,
  max_players: 70,
});

const loadClubs = async () => {
  await fetchClubs({
    limit: CLUBS_FETCH_LIMIT,
    org_id: authStore.state.org?.id,
  });
  currentPage.value = 1;
};

const toggleViewMode = () => {
  if (viewMode.value === 'list') {
    startCreate();
  } else {
    cancelForm();
  }
};

const startCreate = () => {
  resetForm();
  viewMode.value = 'form';
};

const cancelForm = () => {
  resetForm();
  viewMode.value = 'list';
};

const resetForm = () => {
  form.id          = null;
  form.name        = '';
  form.short_name  = '';
  form.colors      = '';
  form.description = '';
  form.logo_url    = '';
  form.folio_start = null;
  form.folio_end   = null;
  form.max_players = 70;
  showPostSaveDialog.value = false;
};

const handleFileChange = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  uploading.value = true;
  try {
    const data = await uploadImage(file);
    form.logo_url = data.secure_url;
  } catch (e) {
    notifyError('Error al subir imagen: ' + e.message);
  } finally {
    uploading.value = false;
    // Clear input
    event.target.value = '';
  }
};

const removeLogo = () => {
  form.logo_url = '';
};

const saveClub = async () => {
  const payload = { 
    ...form,
    org_id: authStore.state.org?.id
  };
  try {
    await createOrUpdateClub(payload);
    await loadClubs();
    // Show post-save dialog instead of immediate reset
    showPostSaveDialog.value = true;
  } catch (e) {
    // Error is handled in store
  }
};

const handlePostSaveOption = (option) => {
  if (option === 'create_another') {
    resetForm();
  } else {
    resetForm();
    viewMode.value = 'list';
  }
};

const goToDetail = (id) => {
  router.push(`/clubs/${id}`);
};

const goToNextPage = () => {
  if (!hasNextPage.value) return;
  currentPage.value += 1;
};

const goToPrevPage = () => {
  if (!hasPrevPage.value) return;
  currentPage.value -= 1;
};

const handlePageSizeChange = (value) => {
  const size = Number(value);
  if (!pageSizeOptions.includes(size)) return;
  itemsPerPage.value = size;
  currentPage.value = 1;
};

onMounted(() => {
  loadClubs();
});
</script>

<style scoped>
.field-hint {
  font-size: 0.78rem;
  color: var(--text-muted);
  margin-top: 4px;
}

.section-divider {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 4px;
  margin-top: 4px;
}

.folio-config-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
}

/* Modal Overlay */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-content {
  width: 100%;
  max-width: 400px;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.badge {
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-full);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: 0.75rem;
}

.logo-preview {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.logo-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.btn-icon-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border: none;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 14px;
}

.club-logo-small {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.club-logo-small img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.logo-placeholder {
  font-size: 1.25rem;
}

.font-medium {
  font-weight: 500;
}

.btn-sm {
  padding: 0.4rem 0.8rem;
  font-size: 0.875rem;
}

.p-0 {
  padding: 0 !important;
}

.py-lg {
  padding-top: var(--spacing-lg);
  padding-bottom: var(--spacing-lg);
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem 0;
  gap: var(--spacing-md);
}

.list-header-right {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.cards-container-mobile {
  display: none;
}

.club-card-mobile {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 1rem 1.25rem;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-md);
}

.club-card-mobile + .club-card-mobile {
  margin-top: 0.75rem;
}

.club-card-mobile-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: 0.75rem;
}

.club-card-mobile-body {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.player-count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-full);
  background: rgba(41, 182, 246, 0.12);
  color: var(--primary-solid);
  font-size: 0.8rem;
  font-weight: 700;
}

.player-count-badge--empty {
  background: var(--bg-tertiary);
  color: var(--text-muted);
}

.player-count-mobile {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.78rem;
  color: var(--text-muted);
  font-weight: 500;
}

.club-card-mobile-footer {
  margin-top: 0.25rem;
}

.pagination-center {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-inline: var(--spacing-md);
}

.pagination-size {
  width: auto;
  padding-top: 0.35rem;
  padding-bottom: 0.35rem;
  font-size: 0.8rem;
}

.pagination-info {
  font-size: 0.8rem;
  color: var(--text-muted);
}

@media (max-width: 768px) {
  .table-container {
    display: none;
  }

  .cards-container-mobile {
    display: block;
    padding: 1rem 1.5rem 0.5rem;
  }

  .list-header {
    padding-inline: 1rem;
  }
  
.tag {
  background: rgba(255, 255, 255, 0.1);
  padding: 0.5rem 1rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  color: var(--color-dark-text);
  border: 1px solid rgba(255, 255, 255, 0.2);
}
}

/* ── Dashboard (estilo landing) ── */
.pd-dash {
  position: relative;
  overflow: hidden;
  background: var(--surface-card, #14151d);
  border: 1px solid var(--border-subtle, #23252f);
  border-radius: var(--border-radius-lg, 16px);
  padding: 2rem 1.5rem;
}

.pd-dash__glow {
  position: absolute;
  width: 360px;
  height: 360px;
  border-radius: 50%;
  filter: blur(110px);
  opacity: 0.2;
  pointer-events: none;
  z-index: 0;
}
.pd-dash__glow--green { top: -140px; left: -100px; background: var(--color-green-600, #00e676); }
.pd-dash__glow--blue  { bottom: -160px; right: -100px; background: var(--color-blue-500, #4fc3f7); }

.pd-dash__head {
  position: relative;
  z-index: 1;
  text-align: center;
  max-width: 520px;
  margin: 0 auto 1.75rem;
}

.pd-dash__kicker {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-blue-500, #4fc3f7);
  margin-bottom: 0.5rem;
}

.pd-dash__title {
  font-size: clamp(1.4rem, 3vw, 1.9rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0 0 0.5rem;
}

.pd-dash__title-accent {
  background: linear-gradient(135deg, var(--color-green-600, #00e676), var(--color-blue-500, #4fc3f7));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.pd-dash__desc {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.pd-dash__grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.pd-tile {
  display: flex;
  align-items: flex-start;
  gap: 0.9rem;
  background: var(--bg-tertiary, rgba(255,255,255,0.03));
  border: 1px solid var(--border-subtle);
  border-radius: var(--border-radius-md, 12px);
  padding: 1.1rem;
  cursor: pointer;
  transition: transform var(--transition-fast, 0.15s ease), border-color var(--transition-fast, 0.15s ease);
}

.pd-tile:hover {
  transform: translateY(-3px);
  border-color: var(--pd-accent, var(--color-green-600));
}

.pd-tile--selected {
  border-color: var(--pd-accent, var(--color-green-600));
  box-shadow: 0 0 0 1px var(--pd-accent, var(--color-green-600));
}

.pd-tile--green { --pd-accent: var(--color-green-600, #00e676); }
.pd-tile--blue  { --pd-accent: var(--color-blue-500, #4fc3f7); }
.pd-tile--gold  { --pd-accent: var(--color-gold, #ffd54f); }
.pd-tile--red   { --pd-accent: var(--color-danger, #ef5350); }

.pd-tile__icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--pd-accent) 16%, transparent);
  color: var(--pd-accent);
}

.pd-tile__icon :deep(svg) {
  width: 20px;
  height: 20px;
}

.pd-tile__body {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.pd-tile__label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

.pd-tile__value {
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  line-height: 1.2;
}

.pd-tile__trend {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-muted);
}
</style>
