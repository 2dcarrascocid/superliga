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
      <PanoramaDashboard
        class="mb-lg"
        :kicker="panoramaMeta.kicker"
        title-start="Panorama de"
        :title-accent="panoramaMeta.titleAccent"
        :description="panoramaMeta.desc"
        :sub-tabs="panoramaTabs"
        :active-sub-tab="panoramaTab"
        @sub-tab-change="switchPanoramaTab"
        :tiles="dashboardTiles"
        :selected-key="selectedTileKey"
        @select="selectTile"
      />

      <!-- Sub-perspectiva: Temporadas -->
      <div v-if="panoramaTab === 'temporadas'" class="card p-0">
        <div class="flex justify-between items-center p-md" style="border-bottom: 1px solid var(--border-color);">
          <h3 class="m-0">{{ selectedTileLabel }}</h3>
          <span class="text-muted text-sm">{{ filteredSeasons.length }} en total</span>
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
              <tr v-else-if="filteredSeasons.length === 0">
                <td colspan="4" class="text-center py-lg">No hay temporadas en esta selección.</td>
              </tr>
              <tr v-for="season in filteredSeasons" :key="season.id" class="clickable-row" @click="openSeason(season.id)">
                <td><span class="font-medium">{{ season.name }}</span></td>
                <td>{{ season.year }}</td>
                <td class="text-center">
                  <span class="status-badge" :class="season.active ? 'status-badge--active' : 'status-badge--inactive'">
                    {{ season.active ? 'Activa' : 'Cerrada' }}
                  </span>
                </td>
                <td>
                  <ActionsMenu>
                    <button class="btn btn-sm btn-secondary" @click.stop="openSeason(season.id)">Ver Torneos</button>
                    <button class="btn btn-sm btn-secondary" @click.stop="startEdit(season)">Editar</button>
                    <button class="btn btn-sm btn-danger" @click.stop="confirmDelete(season)">Eliminar</button>
                  </ActionsMenu>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Mobile: tarjetas -->
        <div class="data-cards p-md">
          <p v-if="loading && items.length === 0" class="text-center py-lg text-muted text-sm">Cargando...</p>
          <p v-else-if="filteredSeasons.length === 0" class="text-center py-lg text-muted text-sm">No hay temporadas en esta selección.</p>
          <article v-for="season in filteredSeasons" :key="season.id" class="data-card clickable-row" @click="openSeason(season.id)">
            <div class="data-card__header">
              <div class="data-card__heading">
                <div class="data-card__title">{{ season.name }}</div>
                <div class="data-card__subtitle">Año {{ season.year }}</div>
              </div>
              <span class="status-badge" :class="season.active ? 'status-badge--active' : 'status-badge--inactive'">
                {{ season.active ? 'Activa' : 'Cerrada' }}
              </span>
            </div>
            <div class="data-card__footer" @click.stop>
              <ActionsMenu>
                <button class="btn btn-sm btn-secondary" @click.stop="openSeason(season.id)">Ver Torneos</button>
                <button class="btn btn-sm btn-secondary" @click.stop="startEdit(season)">Editar</button>
                <button class="btn btn-sm btn-danger" @click.stop="confirmDelete(season)">Eliminar</button>
              </ActionsMenu>
            </div>
          </article>
        </div>
      </div>

      <!-- Sub-perspectiva: Torneos (resumen en la misma pantalla, sin navegar) -->
      <div v-else class="card p-0">
        <div class="flex justify-between items-center p-md" style="border-bottom: 1px solid var(--border-color);">
          <h3 class="m-0">{{ selectedTileLabel }}</h3>
          <span class="text-muted text-sm">{{ filteredTournaments.length }} en total</span>
        </div>

        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Temporada</th>
                <th>Categoría</th>
                <th class="text-center">Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="filteredTournaments.length === 0">
                <td colspan="5" class="text-center py-lg">No hay torneos en esta selección.</td>
              </tr>
              <tr v-for="tournament in filteredTournaments" :key="tournament.id" class="clickable-row" @click="openTournament(tournament.id)">
                <td><span class="font-medium">{{ tournament.name }}</span></td>
                <td>{{ tournament.season?.name || '—' }}</td>
                <td>{{ tournament.category?.name || '—' }}</td>
                <td class="text-center">
                  <span class="status-badge" :class="`status-badge--${tournament.status?.toLowerCase()}`">
                    {{ TOURNAMENT_STATUS_LABELS[tournament.status] || tournament.status }}
                  </span>
                </td>
                <td>
                  <ActionsMenu>
                    <button class="btn btn-sm btn-secondary" @click.stop="openTournament(tournament.id)">Ver detalle</button>
                  </ActionsMenu>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Mobile: tarjetas -->
        <div class="data-cards p-md">
          <p v-if="filteredTournaments.length === 0" class="text-center py-lg text-muted text-sm">No hay torneos en esta selección.</p>
          <article v-for="tournament in filteredTournaments" :key="tournament.id" class="data-card clickable-row" @click="openTournament(tournament.id)">
            <div class="data-card__header">
              <div class="data-card__heading">
                <div class="data-card__title">{{ tournament.name }}</div>
                <div class="data-card__subtitle">{{ tournament.season?.name || 'Sin temporada' }} · {{ tournament.category?.name || 'Sin categoría' }}</div>
              </div>
              <span class="status-badge" :class="`status-badge--${tournament.status?.toLowerCase()}`">
                {{ TOURNAMENT_STATUS_LABELS[tournament.status] || tournament.status }}
              </span>
            </div>
            <div class="data-card__footer" @click.stop>
              <ActionsMenu>
                <button class="btn btn-sm btn-secondary" @click.stop="openTournament(tournament.id)">Ver detalle</button>
              </ActionsMenu>
            </div>
          </article>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useSeasonsStore } from '../stores/seasons';
import { useAuthStore } from '../stores/auth';
import { useNotifyStore } from '../stores/notify';
import { getCostCatalog, upsertCostCatalog } from '../services/clubFinance.service.js';
import { getTournaments } from '../services/tournaments.service.js';
import ActionsMenu from '../components/ActionsMenu.vue';
import PanoramaDashboard from '../components/PanoramaDashboard.vue';

const router = useRouter();
const { items, loading, error, fetchSeasons, createOrUpdateSeason, removeSeason } = useSeasonsStore();
const authStore = useAuthStore();
const { confirm, notifySuccess, notifyError } = useNotifyStore();

const viewMode = ref('list');

// ── Panorama de temporadas ────────────────────────────────────────────────
const icons = {
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  archive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>',
  layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
  clipboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1Z"/><path d="M8 4H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="15" y2="16"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M17 5h3a2 2 0 0 1-2 4h-1M7 5H4a2 2 0 0 0 2 4h1"/></svg>',
};

const activeSeasons = computed(() => items.value.filter((s) => s.active));
const closedSeasons = computed(() => items.value.filter((s) => !s.active));

// ── Torneos (org-wide, resumen local — el sub-tab "Torneos" de este mismo
// Panorama filtra una mini tabla acá abajo, no navega a /tournaments) ───────
const tournaments = ref([]);
const loadTournaments = async () => {
  try {
    const res = await getTournaments({ org_id: authStore.state.org?.id, limit: 100 });
    tournaments.value = res.data?.data?.tournaments ?? res.data?.tournaments ?? [];
  } catch (e) {
    console.error('[SeasonsList] getTournaments error:', e);
  }
};
const tournamentsRegistration = computed(() => tournaments.value.filter((t) => t.status === 'REGISTRATION').length);
const tournamentsInProgress = computed(() => tournaments.value.filter((t) => t.status === 'IN_PROGRESS').length);
const tournamentsFinished = computed(() => tournaments.value.filter((t) => t.status === 'FINISHED').length);

const TOURNAMENT_STATUS_LABELS = {
  DRAFT: 'Borrador', REGISTRATION: 'Inscripciones', IN_PROGRESS: 'En curso', FINISHED: 'Finalizado', CANCELLED: 'Cancelado',
};

// ── Panorama: sub-perspectivas "Temporadas" / "Torneos" ───────────────────
const panoramaTabs = [
  { key: 'temporadas', label: 'Temporadas' },
  { key: 'torneos', label: 'Torneos' },
];
const panoramaTab = ref('temporadas');
const panoramaMeta = computed(() => panoramaTab.value === 'temporadas'
  ? { kicker: 'Resumen de temporadas', titleAccent: 'temporadas', desc: 'Estado general de las temporadas de la organización.' }
  : { kicker: 'Resumen de torneos', titleAccent: 'torneos', desc: 'Estado general de los torneos de la organización, sin salir de esta pantalla.' });

const seasonTiles = computed(() => [
  { key: 'active', label: 'Temporada activa', value: activeSeasons.value.length, meta: activeSeasons.value[0]?.name ?? 'ninguna en curso', color: 'green', icon: icons.calendar },
  { key: 'closed', label: 'Temporadas cerradas', value: closedSeasons.value.length, meta: 'sin actividad', color: 'red', icon: icons.archive },
  { key: 'all', label: 'Total temporadas', value: items.value.length, meta: 'histórico completo', color: 'blue', icon: icons.layers },
]);

const tournamentTiles = computed(() => [
  { key: 'reg', label: 'Torneos en inscripción', value: tournamentsRegistration.value, meta: 'admiten series', color: 'blue', icon: icons.clipboard },
  { key: 'progress', label: 'Torneos en curso', value: tournamentsInProgress.value, meta: 'con fixture jugándose', color: 'green', icon: icons.play },
  { key: 'finished', label: 'Torneos finalizados', value: tournamentsFinished.value, meta: 'temporadas anteriores', color: 'gold', icon: icons.trophy },
  { key: 'tAll', label: 'Total torneos', value: tournaments.value.length, meta: 'todas las temporadas', color: 'blue', icon: icons.layers },
]);

const dashboardTiles = computed(() => panoramaTab.value === 'temporadas' ? seasonTiles.value : tournamentTiles.value);

const selectedTileKey = ref('all');
const selectedTileLabel = computed(() => dashboardTiles.value.find((t) => t.key === selectedTileKey.value)?.label ?? '');
const selectTile = (key) => { selectedTileKey.value = key; };

const switchPanoramaTab = (key) => {
  panoramaTab.value = key;
  selectedTileKey.value = key === 'temporadas' ? 'all' : 'tAll';
};

const filteredSeasons = computed(() => {
  if (selectedTileKey.value === 'active') return activeSeasons.value;
  if (selectedTileKey.value === 'closed') return closedSeasons.value;
  return items.value;
});

const TOURNAMENT_TILE_STATUS = { reg: 'REGISTRATION', progress: 'IN_PROGRESS', finished: 'FINISHED' };
const filteredTournaments = computed(() => {
  const status = TOURNAMENT_TILE_STATUS[selectedTileKey.value];
  if (!status) return tournaments.value;
  return tournaments.value.filter((t) => t.status === status);
});

const openTournament = (tournamentId) => router.push(`/tournaments/${tournamentId}`);

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
  loadTournaments();
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
.status-badge--draft        { background: rgba(255, 255, 255, 0.08); color: var(--text-muted); }
.status-badge--registration { background: rgba(79, 195, 247, 0.16); color: #4fc3f7; }
.status-badge--in_progress  { background: rgba(0, 230, 118, 0.14); color: var(--primary-solid, #00e676); }
.status-badge--finished     { background: rgba(255, 213, 79, 0.16); color: #ffd54f; }
.status-badge--cancelled    { background: rgba(239, 83, 80, 0.14); color: #ef5350; }
</style>
