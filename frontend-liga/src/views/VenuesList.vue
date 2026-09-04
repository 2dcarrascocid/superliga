<template>
  <div class="container mt-md">
    <!-- Header -->
    <div class="flex justify-between items-center mb-lg">
      <h2>Canchas</h2>
      <button
        class="btn"
        :class="viewMode === 'list' ? 'btn-primary' : 'btn-secondary'"
        @click="toggleViewMode"
      >
        {{ viewMode === 'list' ? 'Nueva Cancha' : 'Volver al listado' }}
      </button>
    </div>

    <div v-if="error" class="alert alert-error">
      {{ error }}
    </div>

    <!-- Create/Edit Form -->
    <div v-if="viewMode === 'form'" class="mb-lg card">
      <h3 class="mb-md">{{ form.id ? 'Editar Cancha' : 'Nueva Cancha' }}</h3>
      <form @submit.prevent="saveVenue">
        <div class="flex flex-col gap-md">
          <div class="input-group">
            <label class="label">Nombre de la cancha *</label>
            <input v-model="form.name" class="input" required />
          </div>

          <div class="input-group">
            <label class="label">Dirección</label>
            <input v-model="form.address" class="input" />
          </div>

          <div class="form-row-2">
            <div class="input-group">
              <label class="label">Región</label>
              <select v-model="form.region" class="input" @change="onRegionChange">
                <option value="" disabled>Selecciona una región</option>
                <option v-for="r in regionOptions" :key="r" :value="r">{{ r }}</option>
              </select>
            </div>
            <div class="input-group">
              <label class="label">Comuna</label>
              <select v-model="form.city" class="input" :disabled="!form.region">
                <option value="" disabled>{{ form.region ? 'Selecciona una comuna' : 'Primero selecciona una región' }}</option>
                <option v-for="c in comunaOptions" :key="c" :value="c">{{ c }}</option>
              </select>
            </div>
          </div>

          <div class="form-row-2">
            <div class="input-group">
              <label class="label">Superficie</label>
              <select v-model="form.surface_type" class="input">
                <option value="NATURAL">Natural</option>
                <option value="SINTETICA">Sintética</option>
                <option value="CEMENTO">Cemento</option>
                <option value="OTRA">Otra</option>
              </select>
            </div>
            <div class="input-group">
              <label class="label">Iluminación</label>
              <select v-model="form.lighting" class="input">
                <option :value="true">Sí</option>
                <option :value="false">No</option>
              </select>
            </div>
          </div>

          <div class="input-group">
            <label class="label">Estado</label>
            <select v-model="form.status" class="input">
              <option value="DISPONIBLE">Disponible</option>
              <option value="MANTENIMIENTO">En mantenimiento</option>
              <option value="INACTIVA">Inactiva</option>
            </select>
          </div>

          <div class="input-group">
            <label class="label">Notas</label>
            <textarea v-model="form.notes" class="input" rows="3" />
          </div>
        </div>
        <div class="flex justify-between items-center mt-md">
          <span class="text-muted text-sm">* Campos requeridos</span>
          <div class="flex gap-sm">
            <button type="button" class="btn btn-secondary" @click="cancelForm">
              Cancelar
            </button>
            <button type="submit" class="btn btn-primary" :disabled="loading">
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
          <span class="pd-dash__kicker">Resumen de infraestructura</span>
          <h3 class="pd-dash__title">
            Panorama de <span class="pd-dash__title-accent">canchas</span>
          </h3>
          <p class="pd-dash__desc">Estado de las canchas registradas en la organización.</p>
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
          <span class="text-muted text-sm">{{ filteredVenues.length }} en total</span>
        </div>

        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Ubicación</th>
                <th>Superficie</th>
                <th class="text-center">Iluminación</th>
                <th class="text-center">Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading && items.length === 0">
                <td colspan="6" class="text-center py-lg">Cargando...</td>
              </tr>
              <tr v-else-if="filteredVenues.length === 0">
                <td colspan="6" class="text-center py-lg">No hay canchas en esta selección.</td>
              </tr>
              <tr v-for="venue in paginatedItems" :key="venue.id">
                <td>
                  <span class="font-medium">{{ venue.name }}</span>
                </td>
                <td>{{ formatLocation(venue) }}</td>
                <td>{{ surfaceLabel(venue.surface_type) }}</td>
                <td class="text-center">{{ venue.lighting ? 'Sí' : 'No' }}</td>
                <td class="text-center">
                  <span class="status-badge" :class="`status-badge--${venue.status?.toLowerCase()}`">
                    {{ statusLabel(venue.status) }}
                  </span>
                </td>
                <td>
                  <ActionsMenu>
                    <button class="btn btn-sm btn-secondary" @click="startEdit(venue)">Editar</button>
                    <button class="btn btn-sm btn-danger" @click="confirmDelete(venue)">Eliminar</button>
                  </ActionsMenu>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="cards-container-mobile">
          <div v-for="venue in paginatedItems" :key="venue.id" class="venue-card-mobile">
            <div class="venue-card-mobile-header">
              <div class="font-medium">{{ venue.name }}</div>
              <span class="status-badge" :class="`status-badge--${venue.status?.toLowerCase()}`">
                {{ statusLabel(venue.status) }}
              </span>
            </div>
            <div class="venue-card-mobile-body">
              <span class="text-sm text-muted">{{ formatLocation(venue) || '—' }}</span>
              <span class="text-sm text-muted">{{ surfaceLabel(venue.surface_type) }} · {{ venue.lighting ? 'Con iluminación' : 'Sin iluminación' }}</span>
            </div>
            <div class="venue-card-mobile-footer">
              <button class="btn btn-sm btn-secondary btn-full" @click="startEdit(venue)">Editar</button>
              <button class="btn btn-sm btn-danger btn-full" @click="confirmDelete(venue)">Eliminar</button>
            </div>
          </div>
        </div>

        <div v-if="filteredVenues.length > 0" class="pagination mb-md">
          <button class="pagination-btn" :disabled="!hasPrevPage" @click="goToPrevPage">Anterior</button>

          <div class="pagination-center">
            <select
              class="input pagination-size"
              :value="itemsPerPage"
              @change="handlePageSizeChange($event.target.value)"
            >
              <option v-for="size in pageSizeOptions" :key="size" :value="size">{{ size }}</option>
            </select>
            <span class="pagination-info">Página {{ currentPage }} de {{ totalPages }}</span>
          </div>

          <button class="pagination-btn" :disabled="!hasNextPage" @click="goToNextPage">Siguiente</button>
        </div>
      </div>
    </template>

    <!-- Post Save Modal/Dialog Overlay -->
    <div v-if="showPostSaveDialog" class="modal-overlay">
      <div class="modal-content card">
        <h3 class="mb-md text-center">¡Cancha Guardada con Éxito!</h3>
        <p class="text-center mb-lg">¿Qué deseas hacer ahora?</p>
        <div class="flex flex-col gap-md">
          <button class="btn btn-primary btn-full" @click="handlePostSaveOption('create_another')">
            Ingresar otra cancha
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
import { useVenuesStore } from '../stores/venues';
import { useAuthStore } from '../stores/auth';
import { useNotifyStore } from '../stores/notify';
import territorios from '../data/territorios.json';
import ActionsMenu from '../components/ActionsMenu.vue';

const { items, loading, error, fetchVenues, createOrUpdateVenue, removeVenue } = useVenuesStore();
const authStore = useAuthStore();
const { confirm, notifySuccess, notifyError } = useNotifyStore();

const viewMode = ref('list');
const showPostSaveDialog = ref(false);

const currentPage = ref(1);
const itemsPerPage = ref(10);
const pageSizeOptions = [10, 20, 50];

// Carga todas las canchas de la org de una vez: el submenú (disponibles/
// mantenimiento/inactivas/nuevas) y su paginación se calculan en el cliente.
const VENUES_FETCH_LIMIT = 500;

const SURFACE_LABELS = {
  NATURAL: 'Natural',
  SINTETICA: 'Sintética',
  CEMENTO: 'Cemento',
  OTRA: 'Otra',
};

const STATUS_LABELS = {
  DISPONIBLE: 'Disponible',
  MANTENIMIENTO: 'En mantenimiento',
  INACTIVA: 'Inactiva',
};

const icons = {
  checkCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  tool: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
  xCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  plusCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
  mapPin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
};

const availableVenues     = computed(() => items.value.filter(v => v.status === 'DISPONIBLE'));
const maintenanceVenues   = computed(() => items.value.filter(v => v.status === 'MANTENIMIENTO'));
const inactiveVenues      = computed(() => items.value.filter(v => v.status === 'INACTIVA'));

const newVenues = computed(() => {
  const now = new Date();
  return items.value.filter(v => {
    if (!v.created_at) return false;
    const created = new Date(v.created_at);
    return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth();
  });
});

const dashboardTiles = computed(() => [
  { key: 'available',    label: 'Disponibles',        value: availableVenues.value.length,   meta: 'listas para jugar',        color: 'green', icon: icons.checkCircle },
  { key: 'maintenance',  label: 'En mantenimiento',    value: maintenanceVenues.value.length,  meta: 'temporalmente fuera',      color: 'gold',  icon: icons.tool },
  { key: 'inactive',     label: 'Inactivas',           value: inactiveVenues.value.length,     meta: 'no disponibles',           color: 'red',   icon: icons.xCircle },
  { key: 'new',          label: 'Nuevas este mes',     value: newVenues.value.length,          meta: 'ingresadas en el mes',     color: 'blue',  icon: icons.plusCircle },
  { key: 'all',          label: 'Total registradas',   value: items.value.length,              meta: 'canchas en la org',        color: 'blue',  icon: icons.mapPin },
]);

const selectedTileKey = ref('available');

const selectedTileLabel = computed(() => {
  const tile = dashboardTiles.value.find(t => t.key === selectedTileKey.value);
  return tile ? tile.label : '';
});

const filteredVenues = computed(() => {
  if (selectedTileKey.value === 'available')   return availableVenues.value;
  if (selectedTileKey.value === 'maintenance') return maintenanceVenues.value;
  if (selectedTileKey.value === 'inactive')    return inactiveVenues.value;
  if (selectedTileKey.value === 'new')         return newVenues.value;
  return items.value;
});

const selectTile = (key) => {
  selectedTileKey.value = key;
  currentPage.value = 1;
};

const totalPages = computed(() => Math.max(1, Math.ceil(filteredVenues.value.length / itemsPerPage.value)));

const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  return filteredVenues.value.slice(start, start + itemsPerPage.value);
});

const hasNextPage = computed(() => currentPage.value < totalPages.value);
const hasPrevPage = computed(() => currentPage.value > 1);

const form = reactive({
  id:           null,
  name:         '',
  address:      '',
  region:       '',
  city:         '',
  surface_type: 'NATURAL',
  lighting:     false,
  status:       'DISPONIBLE',
  notes:        '',
});

// Regiones y comunas de Chile (backend-liga/sql/json/territorios.json)
// para los selects encadenados Región → Comuna del mantenedor.
const regionOptions = [...territorios].sort((a, b) => a.region.localeCompare(b.region, 'es')).map(r => r.region);

const comunaOptions = computed(() => {
  const region = territorios.find(r => r.region === form.region);
  if (!region) return [];
  return region.provincias
    .flatMap(p => p.comunas.map(c => c.name))
    .sort((a, b) => a.localeCompare(b, 'es'));
});

const onRegionChange = () => {
  form.city = '';
};

const surfaceLabel = (value) => SURFACE_LABELS[value] || value || '—';
const statusLabel  = (value) => STATUS_LABELS[value] || value || '—';
const formatLocation = (venue) => [venue.address, venue.city, venue.region].filter(Boolean).join(', ');

const loadVenues = async () => {
  await fetchVenues({
    limit: VENUES_FETCH_LIMIT,
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

const startEdit = (venue) => {
  form.id           = venue.id;
  form.name         = venue.name || '';
  form.address      = venue.address || '';
  form.region       = venue.region || '';
  form.city         = venue.city || '';
  form.surface_type = venue.surface_type || 'NATURAL';
  form.lighting     = venue.lighting ?? false;
  form.status       = venue.status || 'DISPONIBLE';
  form.notes        = venue.notes || '';
  viewMode.value    = 'form';
};

const cancelForm = () => {
  resetForm();
  viewMode.value = 'list';
};

const resetForm = () => {
  form.id           = null;
  form.name         = '';
  form.address      = '';
  form.region       = '';
  form.city         = '';
  form.surface_type = 'NATURAL';
  form.lighting     = false;
  form.status       = 'DISPONIBLE';
  form.notes        = '';
  showPostSaveDialog.value = false;
};

const saveVenue = async () => {
  const payload = {
    ...form,
    org_id: authStore.state.org?.id,
  };
  try {
    await createOrUpdateVenue(payload);
    await loadVenues();
    showPostSaveDialog.value = true;
  } catch (e) {
    // Error manejado en el store
  }
};

const confirmDelete = async (venue) => {
  const ok = await confirm({
    title: '¿Eliminar cancha?',
    message: `¿Estás seguro de que deseas eliminar la cancha "${venue.name}"?`,
    confirmText: 'Eliminar',
    isDestructive: true,
  });
  if (!ok) return;
  try {
    await removeVenue(venue.id);
    notifySuccess('Cancha eliminada exitosamente');
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al eliminar la cancha');
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
  loadVenues();
});
</script>

<style scoped>
.form-row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
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

.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 700;
}

.status-badge--disponible    { background: rgba(0, 230, 118, 0.14); color: var(--primary-solid, #00e676); }
.status-badge--mantenimiento { background: rgba(255, 213, 79, 0.16); color: #ffd54f; }
.status-badge--inactiva      { background: rgba(239, 83, 80, 0.14); color: #ef5350; }

.font-medium { font-weight: 500; }

.btn-sm {
  padding: 0.4rem 0.8rem;
  font-size: 0.875rem;
}

.p-0 { padding: 0 !important; }

.py-lg {
  padding-top: var(--spacing-lg);
  padding-bottom: var(--spacing-lg);
}

.cards-container-mobile { display: none; }

.venue-card-mobile {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 1rem 1.25rem;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-md);
}

.venue-card-mobile + .venue-card-mobile { margin-top: 0.75rem; }

.venue-card-mobile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.venue-card-mobile-body {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
}

.venue-card-mobile-footer {
  display: flex;
  gap: 0.5rem;
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
  .table-container { display: none; }

  .cards-container-mobile {
    display: block;
    padding: 1rem 1.5rem 0.5rem;
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
