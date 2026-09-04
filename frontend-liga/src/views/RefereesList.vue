<template>
  <div class="container mt-md">
    <!-- Header -->
    <div class="flex justify-between items-center mb-lg">
      <h2>Árbitros</h2>
      <button
        class="btn"
        :class="viewMode === 'list' ? 'btn-primary' : 'btn-secondary'"
        @click="toggleViewMode"
      >
        {{ viewMode === 'list' ? 'Nuevo Árbitro' : 'Volver al listado' }}
      </button>
    </div>

    <div v-if="error" class="alert alert-error">
      {{ error }}
    </div>

    <!-- Create/Edit Form -->
    <div v-if="viewMode === 'form'" class="mb-lg card">
      <h3 class="mb-md">{{ form.id ? 'Editar Árbitro' : 'Nuevo Árbitro' }}</h3>
      <form @submit.prevent="saveReferee">
        <div class="flex flex-col gap-md">
          <div class="input-group">
            <label class="label">Nombre completo *</label>
            <input v-model="form.full_name" class="input" required />
          </div>

          <div class="folio-config-row">
            <div class="input-group">
              <label class="label">Teléfono</label>
              <input v-model="form.phone" class="input" />
            </div>
            <div class="input-group">
              <label class="label">Email</label>
              <input v-model="form.email" type="email" class="input" />
            </div>
            <div class="input-group">
              <label class="label">Estado</label>
              <select v-model="form.active" class="input">
                <option :value="true">Activo</option>
                <option :value="false">Inactivo</option>
              </select>
            </div>
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
          <span class="pd-dash__kicker">Resumen de arbitraje</span>
          <h3 class="pd-dash__title">
            Panorama de <span class="pd-dash__title-accent">árbitros</span>
          </h3>
          <p class="pd-dash__desc">Estado de los árbitros registrados en la organización.</p>
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
          <span class="text-muted text-sm">{{ filteredReferees.length }} en total</span>
        </div>

        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Teléfono</th>
                <th>Email</th>
                <th class="text-center">Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading && items.length === 0">
                <td colspan="5" class="text-center py-lg">Cargando...</td>
              </tr>
              <tr v-else-if="filteredReferees.length === 0">
                <td colspan="5" class="text-center py-lg">No hay árbitros en esta selección.</td>
              </tr>
              <tr v-for="referee in paginatedItems" :key="referee.id">
                <td>
                  <span class="font-medium">{{ referee.full_name }}</span>
                </td>
                <td>{{ referee.phone || '—' }}</td>
                <td>{{ referee.email || '—' }}</td>
                <td class="text-center">
                  <span class="status-badge" :class="referee.active ? 'status-badge--active' : 'status-badge--inactive'">
                    {{ referee.active ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>
                <td>
                  <ActionsMenu>
                    <button class="btn btn-sm btn-secondary" @click="startEdit(referee)">Editar</button>
                    <button class="btn btn-sm btn-danger" @click="confirmDelete(referee)">Eliminar</button>
                  </ActionsMenu>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="cards-container-mobile">
          <div v-for="referee in paginatedItems" :key="referee.id" class="referee-card-mobile">
            <div class="referee-card-mobile-header">
              <div class="font-medium">{{ referee.full_name }}</div>
              <span class="status-badge" :class="referee.active ? 'status-badge--active' : 'status-badge--inactive'">
                {{ referee.active ? 'Activo' : 'Inactivo' }}
              </span>
            </div>
            <div class="referee-card-mobile-body">
              <span class="text-sm text-muted">{{ referee.phone || '—' }}</span>
              <span class="text-sm text-muted">{{ referee.email || '—' }}</span>
            </div>
            <div class="referee-card-mobile-footer">
              <button class="btn btn-sm btn-secondary btn-full" @click="startEdit(referee)">Editar</button>
              <button class="btn btn-sm btn-danger btn-full" @click="confirmDelete(referee)">Eliminar</button>
            </div>
          </div>
        </div>

        <div v-if="filteredReferees.length > 0" class="pagination mb-md">
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
        <h3 class="mb-md text-center">¡Árbitro Guardado con Éxito!</h3>
        <p class="text-center mb-lg">¿Qué deseas hacer ahora?</p>
        <div class="flex flex-col gap-md">
          <button class="btn btn-primary btn-full" @click="handlePostSaveOption('create_another')">
            Ingresar otro árbitro
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
import { useRefereesStore } from '../stores/referees';
import { useAuthStore } from '../stores/auth';
import { useNotifyStore } from '../stores/notify';
import ActionsMenu from '../components/ActionsMenu.vue';

const { items, loading, error, fetchReferees, createOrUpdateReferee, removeReferee } = useRefereesStore();
const authStore = useAuthStore();
const { confirm, notifySuccess, notifyError } = useNotifyStore();

const viewMode = ref('list');
const showPostSaveDialog = ref(false);

const currentPage = ref(1);
const itemsPerPage = ref(10);
const pageSizeOptions = [10, 20, 50];

// Carga todos los árbitros de la org de una vez: el submenú (activos/inactivos/
// nuevos) y su paginación se calculan en el cliente sobre este set completo.
const REFEREES_FETCH_LIMIT = 500;

const icons = {
  checkCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  xCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  userPlus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
};

const activeReferees   = computed(() => items.value.filter(r => r.active));
const inactiveReferees = computed(() => items.value.filter(r => !r.active));

const newReferees = computed(() => {
  const now = new Date();
  return items.value.filter(r => {
    if (!r.created_at) return false;
    const created = new Date(r.created_at);
    return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth();
  });
});

const dashboardTiles = computed(() => [
  { key: 'active',   label: 'Árbitros activos',   value: activeReferees.value.length,   meta: 'habilitados para dirigir', color: 'green', icon: icons.checkCircle },
  { key: 'inactive', label: 'Árbitros inactivos', value: inactiveReferees.value.length, meta: 'no disponibles',           color: 'red',   icon: icons.xCircle },
  { key: 'new',      label: 'Nuevos este mes',    value: newReferees.value.length,      meta: 'ingresados en el mes',     color: 'gold',  icon: icons.userPlus },
  { key: 'all',      label: 'Total registrados',  value: items.value.length,            meta: 'árbitros en la org',       color: 'blue',  icon: icons.users },
]);

const selectedTileKey = ref('active');

const selectedTileLabel = computed(() => {
  const tile = dashboardTiles.value.find(t => t.key === selectedTileKey.value);
  return tile ? tile.label : '';
});

const filteredReferees = computed(() => {
  if (selectedTileKey.value === 'active')   return activeReferees.value;
  if (selectedTileKey.value === 'inactive') return inactiveReferees.value;
  if (selectedTileKey.value === 'new')      return newReferees.value;
  return items.value;
});

const selectTile = (key) => {
  selectedTileKey.value = key;
  currentPage.value = 1;
};

const totalPages = computed(() => Math.max(1, Math.ceil(filteredReferees.value.length / itemsPerPage.value)));

const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  return filteredReferees.value.slice(start, start + itemsPerPage.value);
});

const hasNextPage = computed(() => currentPage.value < totalPages.value);
const hasPrevPage = computed(() => currentPage.value > 1);

const form = reactive({
  id:        null,
  full_name: '',
  phone:     '',
  email:     '',
  notes:     '',
  active:    true,
});

const loadReferees = async () => {
  await fetchReferees({
    limit: REFEREES_FETCH_LIMIT,
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

const startEdit = (referee) => {
  form.id        = referee.id;
  form.full_name = referee.full_name || '';
  form.phone     = referee.phone || '';
  form.email     = referee.email || '';
  form.notes     = referee.notes || '';
  form.active    = referee.active ?? true;
  viewMode.value = 'form';
};

const cancelForm = () => {
  resetForm();
  viewMode.value = 'list';
};

const resetForm = () => {
  form.id        = null;
  form.full_name = '';
  form.phone     = '';
  form.email     = '';
  form.notes     = '';
  form.active    = true;
  showPostSaveDialog.value = false;
};

const saveReferee = async () => {
  const payload = {
    ...form,
    org_id: authStore.state.org?.id,
  };
  try {
    await createOrUpdateReferee(payload);
    await loadReferees();
    showPostSaveDialog.value = true;
  } catch (e) {
    // Error manejado en el store
  }
};

const confirmDelete = async (referee) => {
  const ok = await confirm({
    title: '¿Eliminar árbitro?',
    message: `¿Estás seguro de que deseas eliminar al árbitro "${referee.full_name}"?`,
    confirmText: 'Eliminar',
    isDestructive: true,
  });
  if (!ok) return;
  try {
    await removeReferee(referee.id);
    notifySuccess('Árbitro eliminado exitosamente');
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al eliminar el árbitro');
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
  loadReferees();
});
</script>

<style scoped>
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

.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 700;
}

.status-badge--active   { background: rgba(0, 230, 118, 0.14); color: var(--primary-solid, #00e676); }
.status-badge--inactive { background: rgba(239, 83, 80, 0.14); color: #ef5350; }

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

.referee-card-mobile {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 1rem 1.25rem;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-md);
}

.referee-card-mobile + .referee-card-mobile { margin-top: 0.75rem; }

.referee-card-mobile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.referee-card-mobile-body {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
}

.referee-card-mobile-footer {
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
