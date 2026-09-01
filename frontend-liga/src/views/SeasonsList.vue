<template>
  <div class="container mt-md">
    <div class="flex justify-between items-center mb-lg">
      <h2>Temporadas</h2>
      <button class="btn" :class="viewMode === 'list' ? 'btn-primary' : 'btn-secondary'" @click="toggleViewMode">
        {{ viewMode === 'list' ? 'Nueva Temporada' : 'Volver al listado' }}
      </button>
    </div>

    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <!-- Formulario -->
    <div v-if="viewMode === 'form'" class="mb-lg card">
      <h3 class="mb-md">{{ form.id ? 'Editar Temporada' : 'Nueva Temporada' }}</h3>
      <form @submit.prevent="saveSeason">
        <div class="form-row-2">
          <div class="input-group">
            <label class="label">Nombre *</label>
            <input v-model="form.name" class="input" placeholder="Temporada 2026" required />
          </div>
          <div class="input-group">
            <label class="label">Año *</label>
            <input v-model.number="form.year" type="number" class="input" required />
          </div>
        </div>
        <div class="input-group">
          <label class="label">Estado</label>
          <select v-model="form.active" class="input">
            <option :value="true">Activa</option>
            <option :value="false">Cerrada</option>
          </select>
        </div>
        <div class="flex justify-between items-center mt-md">
          <span class="text-muted text-sm">* Campos requeridos</span>
          <div class="flex gap-sm">
            <button type="button" class="btn btn-secondary" @click="cancelForm">Cancelar</button>
            <button type="submit" class="btn btn-primary" :disabled="loading">
              {{ loading ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>
        </div>
      </form>

      <!-- Mantenedor de costos: inscripción y fecha, aplican a todos los torneos de esta temporada -->
      <div v-if="form.id" class="cost-catalog-box mt-lg">
        <h4 class="mb-sm">Costos de la temporada</h4>
        <p class="text-muted text-sm mb-md">
          Se cobran automáticamente: al inscribir una serie a un torneo (Inscripción) y por cada fecha que genere el fixture (Fecha), a cada serie inscrita.
        </p>
        <div class="form-row-2">
          <div class="input-group">
            <label class="label">Costo de Inscripción</label>
            <input v-model.number="costForm.inscription_fee" type="number" min="0" class="input" />
          </div>
          <div class="input-group">
            <label class="label">Costo por Fecha</label>
            <input v-model.number="costForm.matchday_fee" type="number" min="0" class="input" />
          </div>
        </div>
        <div class="flex justify-end mt-sm">
          <button type="button" class="btn btn-primary btn-sm" :disabled="costLoading" @click="saveCostCatalog">
            {{ costLoading ? 'Guardando...' : 'Guardar costos' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Listado -->
    <template v-if="viewMode === 'list'">
      <div class="card p-0">
        <div class="flex justify-between items-center p-md" style="border-bottom: 1px solid var(--border-color);">
          <h3 class="m-0">Todas las temporadas</h3>
          <span class="text-muted text-sm">{{ items.length }} en total</span>
        </div>

        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Año</th>
                <th class="text-center">Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading && items.length === 0">
                <td colspan="4" class="text-center py-lg">Cargando...</td>
              </tr>
              <tr v-else-if="items.length === 0">
                <td colspan="4" class="text-center py-lg">Aún no hay temporadas creadas.</td>
              </tr>
              <tr v-for="season in items" :key="season.id" class="clickable-row" @click="openSeason(season.id)">
                <td><span class="font-medium">{{ season.name }}</span></td>
                <td>{{ season.year }}</td>
                <td class="text-center">
                  <span class="status-badge" :class="season.active ? 'status-badge--active' : 'status-badge--inactive'">
                    {{ season.active ? 'Activa' : 'Cerrada' }}
                  </span>
                </td>
                <td>
                  <div class="flex gap-sm">
                    <button class="btn btn-sm btn-secondary" @click.stop="openSeason(season.id)">Ver Torneos</button>
                    <button class="btn btn-sm btn-secondary" @click.stop="startEdit(season)">Editar</button>
                    <button class="btn btn-sm btn-danger" @click.stop="confirmDelete(season)">Eliminar</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useSeasonsStore } from '../stores/seasons';
import { useAuthStore } from '../stores/auth';
import { useNotifyStore } from '../stores/notify';
import { getCostCatalog, upsertCostCatalog } from '../services/clubFinance.service.js';

const router = useRouter();
const { items, loading, error, fetchSeasons, createOrUpdateSeason, removeSeason } = useSeasonsStore();
const authStore = useAuthStore();
const { confirm, notifySuccess, notifyError } = useNotifyStore();

const viewMode = ref('list');

const defaultForm = () => ({
  id: null,
  name: '',
  year: new Date().getFullYear(),
  active: true,
});

const form = reactive(defaultForm());

const costForm = reactive({ inscription_fee: 0, matchday_fee: 0 });
const costLoading = ref(false);

const loadCostCatalog = async (seasonId) => {
  try {
    const res = await getCostCatalog(seasonId);
    const catalog = res.data?.data?.catalog ?? res.data?.catalog ?? {};
    costForm.inscription_fee = catalog.inscription_fee ?? 0;
    costForm.matchday_fee = catalog.matchday_fee ?? 0;
  } catch (e) {
    console.error('[SeasonsList] getCostCatalog error:', e);
  }
};

const saveCostCatalog = async () => {
  costLoading.value = true;
  try {
    await upsertCostCatalog(form.id, {
      org_id: authStore.state.org?.id,
      inscription_fee: costForm.inscription_fee,
      matchday_fee: costForm.matchday_fee,
    });
  } catch (e) {
    error.value = e.response?.data?.error?.message || 'Error al guardar los costos';
  } finally {
    costLoading.value = false;
  }
};

const loadSeasons = async () => {
  await fetchSeasons({ org_id: authStore.state.org?.id });
};

const toggleViewMode = () => {
  if (viewMode.value === 'list') {
    Object.assign(form, defaultForm());
    Object.assign(costForm, { inscription_fee: 0, matchday_fee: 0 });
    viewMode.value = 'form';
  } else {
    cancelForm();
  }
};

const cancelForm = () => {
  Object.assign(form, defaultForm());
  Object.assign(costForm, { inscription_fee: 0, matchday_fee: 0 });
  viewMode.value = 'list';
};

const startEdit = (season) => {
  form.id = season.id;
  form.name = season.name;
  form.year = season.year;
  form.active = season.active;
  viewMode.value = 'form';
  loadCostCatalog(season.id);
};

const saveSeason = async () => {
  const payload = { ...form, org_id: authStore.state.org?.id };
  try {
    const wasNew = !form.id;
    const season = await createOrUpdateSeason(payload);
    if (wasNew) {
      // Recién creada: se queda editando para poder configurar sus costos.
      startEdit(season);
    } else {
      cancelForm();
    }
  } catch (e) {
    // Error manejado en el store
  }
};

const confirmDelete = async (season) => {
  const ok = await confirm({
    title: '¿Eliminar temporada?',
    message: `¿Estás seguro de eliminar la temporada "${season.name}"? Los torneos que pertenezcan a ella quedarán sin temporada.`,
    confirmText: 'Eliminar',
    isDestructive: true,
  });
  if (!ok) return;
  try {
    await removeSeason(season.id, authStore.state.org?.id);
    notifySuccess('Temporada eliminada exitosamente');
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al eliminar la temporada');
  }
};

const openSeason = (seasonId) => router.push(`/seasons/${seasonId}/tournaments`);

onMounted(() => {
  loadSeasons();
});
</script>

<style scoped>
.form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

.cost-catalog-box {
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}
.font-medium { font-weight: 500; }
.p-0 { padding: 0 !important; }
.py-lg { padding-top: var(--spacing-lg); padding-bottom: var(--spacing-lg); }

.clickable-row { cursor: pointer; }
.clickable-row:hover { background: var(--surface-hover, rgba(255,255,255,0.03)); }

.btn-sm { padding: 0.4rem 0.8rem; font-size: 0.875rem; }

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
.status-badge--inactive { background: rgba(255, 255, 255, 0.08); color: var(--text-muted); }
</style>
