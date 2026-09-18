<template>
  <div class="container mt-md">
    <div class="flex justify-between items-center mb-lg">
      <div>
        <button v-if="scopedSeasonId" class="btn btn-secondary btn-sm mb-sm" @click="$router.push('/seasons')">
          &larr; Temporadas
        </button>
        <h2>{{ scopedSeason ? `Torneos — ${scopedSeason.name}` : 'Torneos' }}</h2>
      </div>
      <button class="btn" :class="viewMode === 'list' ? 'btn-primary' : 'btn-secondary'" @click="toggleViewMode">
        {{ viewMode === 'list' ? 'Nuevo Torneo' : 'Volver al listado' }}
      </button>
    </div>

    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <!-- Formulario de creación / edición -->
    <div v-if="viewMode === 'form'" class="mb-lg card">
      <h3 class="mb-md">{{ editingTournamentId ? 'Editar Torneo' : 'Nuevo Torneo' }}</h3>
      <form @submit.prevent="saveTournament">
        <div class="flex flex-col gap-md">
          <div class="input-group">
            <label class="label">Nombre del torneo *</label>
            <input v-model="form.name" class="input" required />
          </div>

          <div class="form-row-2">
            <div class="input-group">
              <label class="label">Formato *</label>
              <select v-model="form.format" class="input" required>
                <option value="ROUND_ROBIN">Todos contra Todos</option>
                <option value="KNOCKOUT">Eliminación Directa (Playoffs)</option>
                <option value="GROUPS_KNOCKOUT">Formato Mixto (Grupos + Playoffs)</option>
              </select>
            </div>
            <div class="input-group">
              <label class="label">Tipo *</label>
              <select v-model="form.type" class="input" required>
                <option value="OFICIAL">Oficial</option>
                <option value="AMISTOSO">Amistoso</option>
              </select>
            </div>
          </div>

          <div class="input-group" v-if="scopedSeasonId">
            <label class="label">Temporada</label>
            <input class="input" :value="scopedSeason?.name" disabled />
          </div>
          <div class="input-group" v-else>
            <label class="label">Temporada *</label>
            <div class="flex gap-sm">
              <select v-model="form.season_id" class="input" required>
                <option :value="null" disabled>Seleccione una temporada...</option>
                <option v-for="s in seasons" :key="s.id" :value="s.id">{{ s.name }}</option>
              </select>
              <button type="button" class="btn btn-secondary btn-sm" @click="showNewSeasonForm = !showNewSeasonForm">
                + Nueva
              </button>
            </div>
            <div v-if="showNewSeasonForm" class="new-season-row">
              <input v-model="newSeasonForm.name" class="input" placeholder="Nombre (ej: Temporada 2026)" />
              <input v-model.number="newSeasonForm.year" type="number" class="input" placeholder="Año" style="max-width: 100px;" />
              <button type="button" class="btn btn-primary btn-sm" @click="createNewSeason">Crear</button>
            </div>
          </div>

          <div class="input-group">
            <label class="label">Categoría *</label>
            <select v-model="form.category_id" class="input" required>
              <option :value="null" disabled>Seleccione una categoría...</option>
              <option v-for="c in categories" :key="c.id" :value="c.id">{{ categoryLabel(c) }}</option>
            </select>
            <p v-if="categories.length === 0" class="input-hint">
              No hay categorías creadas todavía — créalas en Parámetros → Categorías.
            </p>
          </div>

          <div class="form-row-2">
            <div class="input-group">
              <label class="label">Costo de inscripción *</label>
              <input v-model.number="form.inscription_fee" type="number" min="0" step="1" class="input" required />
              <p class="input-hint">
                Monto que cada club debe pagar para inscribirse al torneo (se cobra una vez por club, no por serie).
              </p>
            </div>
            <div class="input-group">
              <label class="label">Cantidad de equipos-series *</label>
              <input v-model.number="form.max_teams" type="number" min="2" step="1" class="input" required />
              <p class="input-hint">
                Cuántos equipos/series participan del torneo.
              </p>
            </div>
          </div>

          <div class="form-row-2">
            <div class="input-group">
              <label class="label">Fecha de inicio</label>
              <input v-model="form.start_date" type="date" class="input" />
            </div>
            <div class="input-group">
              <label class="label">Fecha de término</label>
              <input v-model="form.end_date" type="date" class="input" />
            </div>
          </div>

          <div class="input-group" v-if="form.format !== 'KNOCKOUT'">
            <label class="label">Ida y vuelta</label>
            <select v-model="form.rounds_type" class="input">
              <option value="SINGLE">Rueda simple</option>
              <option value="DOUBLE">Ida y vuelta</option>
            </select>
          </div>

          <div class="folio-config-row">
            <div class="input-group">
              <label class="label">Puntos por Victoria</label>
              <input v-model.number="form.points_win" type="number" min="0" class="input" />
            </div>
            <div class="input-group">
              <label class="label">Puntos por Empate</label>
              <input v-model.number="form.points_draw" type="number" min="0" class="input" />
            </div>
            <div class="input-group">
              <label class="label">Puntos por Derrota</label>
              <input v-model.number="form.points_loss" type="number" min="0" class="input" />
            </div>
          </div>

          <div class="form-row-2" v-if="form.format === 'GROUPS_KNOCKOUT'">
            <div class="input-group">
              <label class="label">Cantidad de grupos</label>
              <input v-model.number="form.group_count" type="number" min="2" class="input" />
            </div>
            <div class="input-group">
              <label class="label">Clasifican por grupo</label>
              <input v-model.number="form.teams_advance_per_group" type="number" min="1" class="input" />
            </div>
          </div>

          <div class="folio-config-row" v-if="form.format !== 'ROUND_ROBIN'">
            <label class="checkbox-row">
              <input type="checkbox" v-model="form.two_legged_knockout" />
              Playoffs a ida y vuelta
            </label>
            <label class="checkbox-row">
              <input type="checkbox" v-model="form.has_third_place_match" />
              Partido por el 3er lugar
            </label>
            <label class="checkbox-row">
              <input type="checkbox" v-model="form.has_consolation" />
              Liguilla / Ronda de consuelo
            </label>
          </div>

          <div class="input-group" v-if="form.has_consolation">
            <label class="label">Nombre de la liguilla</label>
            <input v-model="form.consolation_name" class="input" placeholder="Liguilla" />
          </div>

          <div class="input-group">
            <label class="label">Notas</label>
            <textarea v-model="form.notes" class="input" rows="2" />
          </div>
        </div>
        <div class="flex justify-between items-center mt-md">
          <span class="text-muted text-sm">* Campos requeridos</span>
          <div class="flex gap-sm">
            <button type="button" class="btn btn-secondary" @click="cancelForm">Cancelar</button>
            <button type="submit" class="btn btn-primary" :disabled="loading">
              {{ loading ? 'Guardando...' : 'Crear Torneo' }}
            </button>
          </div>
        </div>
      </form>
    </div>

    <!-- Listado -->
    <template v-if="viewMode === 'list'">
      <PanoramaDashboard
        class="mb-lg"
        kicker="Resumen de torneos"
        title-start="Panorama de"
        title-accent="torneos"
        :description="scopedSeason ? `Torneos de la temporada ${scopedSeason.name}.` : 'Estado general de los torneos de la organización.'"
        :tiles="dashboardTiles"
        :selected-key="selectedTileKey"
        @select="selectTile"
      />

      <div class="card p-0">
        <div class="flex justify-between items-center p-md" style="border-bottom: 1px solid var(--border-color);">
          <h3 class="m-0">{{ selectedTileLabel }}</h3>
          <span class="text-muted text-sm">{{ filteredTournaments.length }} en total</span>
        </div>

        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Formato</th>
                <th>Tipo</th>
                <th>Categoría</th>
                <th v-if="!scopedSeasonId">Temporada</th>
                <th class="text-center">Estado</th>
                <th class="text-center">Inscritos</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading && items.length === 0">
                <td colspan="8" class="text-center py-lg">Cargando...</td>
              </tr>
              <tr v-else-if="filteredTournaments.length === 0">
                <td colspan="8" class="text-center py-lg">{{ items.length === 0 ? 'Aún no hay torneos creados.' : 'No hay torneos en esta selección.' }}</td>
              </tr>
              <tr v-for="tournament in filteredTournaments" :key="tournament.id" class="clickable-row" @click="openTournament(tournament.id)">
                <td><span class="font-medium">{{ tournament.name }}</span></td>
                <td>{{ formatLabel(tournament.format) }}</td>
                <td>
                  <span class="type-badge" :class="`type-badge--${tournament.type?.toLowerCase()}`">
                    {{ typeLabel(tournament.type) }}
                  </span>
                </td>
                <td>{{ tournament.category?.name || '—' }}</td>
                <td v-if="!scopedSeasonId">{{ tournament.season?.name || '—' }}</td>
                <td class="text-center">
                  <span class="status-badge" :class="`status-badge--${tournament.status?.toLowerCase()}`">
                    {{ statusLabel(tournament.status) }}
                  </span>
                </td>
                <td class="text-center numeric">{{ tournament.teams_count ?? 0 }} / {{ tournament.max_teams ?? '—' }}</td>
                <td>
                  <ActionsMenu>
                    <button class="btn btn-sm btn-secondary" @click.stop="openTournament(tournament.id)">Ver detalle</button>
                    <button class="btn btn-sm btn-secondary" @click.stop="openEditModal(tournament)">Editar</button>
                    <button
                      v-if="tournament.status !== 'FINISHED' && tournament.status !== 'CANCELLED'"
                      class="btn btn-sm btn-secondary"
                      @click.stop="confirmClose(tournament)"
                    >Cerrar</button>
                    <button class="btn btn-sm btn-danger" @click.stop="confirmDelete(tournament)">Eliminar</button>
                  </ActionsMenu>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Mobile: tarjetas -->
        <div class="data-cards p-md">
          <p v-if="loading && items.length === 0" class="text-center py-lg text-muted text-sm">Cargando...</p>
          <p v-else-if="filteredTournaments.length === 0" class="text-center py-lg text-muted text-sm">{{ items.length === 0 ? 'Aún no hay torneos creados.' : 'No hay torneos en esta selección.' }}</p>
          <article v-for="tournament in filteredTournaments" :key="tournament.id" class="data-card clickable-row" @click="openTournament(tournament.id)">
            <div class="data-card__header">
              <div class="data-card__heading">
                <div class="data-card__title">{{ tournament.name }}</div>
                <div class="data-card__subtitle">
                  {{ formatLabel(tournament.format) }} · {{ tournament.category?.name || 'Sin categoría' }}
                  <template v-if="!scopedSeasonId"> · {{ tournament.season?.name || 'Sin temporada' }}</template>
                </div>
              </div>
              <span class="status-badge" :class="`status-badge--${tournament.status?.toLowerCase()}`">
                {{ statusLabel(tournament.status) }}
              </span>
            </div>
            <div class="data-card__body">
              <div class="data-card__row">
                <span class="data-card__row-label">Tipo</span>
                <span class="data-card__row-value">
                  <span class="type-badge" :class="`type-badge--${tournament.type?.toLowerCase()}`">{{ typeLabel(tournament.type) }}</span>
                </span>
              </div>
              <div class="data-card__row">
                <span class="data-card__row-label">Inscritos</span>
                <span class="data-card__row-value numeric">{{ tournament.teams_count ?? 0 }} / {{ tournament.max_teams ?? '—' }}</span>
              </div>
            </div>
            <div class="data-card__footer" @click.stop>
              <ActionsMenu>
                <button class="btn btn-sm btn-secondary" @click.stop="openTournament(tournament.id)">Ver detalle</button>
                <button class="btn btn-sm btn-secondary" @click.stop="openEditModal(tournament)">Editar</button>
                <button
                  v-if="tournament.status !== 'FINISHED' && tournament.status !== 'CANCELLED'"
                  class="btn btn-sm btn-secondary"
                  @click.stop="confirmClose(tournament)"
                >Cerrar</button>
                <button class="btn btn-sm btn-danger" @click.stop="confirmDelete(tournament)">Eliminar</button>
              </ActionsMenu>
            </div>
          </article>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTournamentsStore } from '../stores/tournaments';
import { useAuthStore } from '../stores/auth';
import { useNotifyStore } from '../stores/notify';
import { getSeasons, createSeason } from '../services/seasons.service.js';
import { listCategoriesByOrg } from '../services/categories.service.js';
import ActionsMenu from '../components/ActionsMenu.vue';
import PanoramaDashboard from '../components/PanoramaDashboard.vue';

const route = useRoute();
const router = useRouter();
const { items, loading, error, fetchTournaments, createOrUpdateTournament, removeTournament } = useTournamentsStore();
const authStore = useAuthStore();
const { confirm, notifySuccess, notifyError } = useNotifyStore();

// Cuando se navega desde /seasons/:seasonId/tournaments, el torneo queda
// acotado a esa temporada: se filtra el listado y el form fija season_id.
const scopedSeasonId = computed(() => route.params.seasonId || null);
const scopedSeason = computed(() => seasons.value.find(s => s.id === scopedSeasonId.value) || null);

const viewMode = ref('list');
const editingTournamentId = ref(null);

const FORMAT_LABELS = {
  ROUND_ROBIN: 'Todos contra Todos',
  KNOCKOUT: 'Eliminación Directa',
  GROUPS_KNOCKOUT: 'Formato Mixto',
};

const STATUS_LABELS = {
  DRAFT: 'Borrador',
  REGISTRATION: 'Inscripciones',
  IN_PROGRESS: 'En curso',
  FINISHED: 'Finalizado',
  CANCELLED: 'Cancelado',
};

const TYPE_LABELS = {
  OFICIAL: 'Oficial',
  AMISTOSO: 'Amistoso',
};

const formatLabel = (v) => FORMAT_LABELS[v] || v;
const statusLabel = (v) => STATUS_LABELS[v] || v;
const typeLabel = (v) => TYPE_LABELS[v] || v;

// ── Temporadas ──────────────────────────────────────────
const seasons = ref([]);
const showNewSeasonForm = ref(false);
const newSeasonForm = reactive({ name: `Temporada ${new Date().getFullYear()}`, year: new Date().getFullYear() });

// ── Categorías ──────────────────────────────────────────
const categories = ref([]);

const GENDER_LABELS = { MASCULINO: 'Masculino', FEMENINO: 'Femenino', MIXTO: 'Mixto' };

const categoryLabel = (c) => {
  const parts = [c.serie, GENDER_LABELS[c.gender], `${c.age_from ?? 0}-${c.age_to ?? 0} años`].filter(Boolean);
  return parts.length ? `${c.name} (${parts.join(' · ')})` : c.name;
};

const loadCategories = async () => {
  try {
    const res = await listCategoriesByOrg(authStore.state.org?.id);
    categories.value = res.data?.data?.categories ?? res.data?.categories ?? [];
  } catch (e) {
    console.error('[TournamentsList] listCategoriesByOrg error:', e);
  }
};

const loadSeasons = async () => {
  try {
    const res = await getSeasons({ org_id: authStore.state.org?.id });
    seasons.value = res.data?.data?.seasons ?? res.data?.seasons ?? [];
  } catch (e) {
    console.error('[TournamentsList] getSeasons error:', e);
  }
};

const createNewSeason = async () => {
  if (!newSeasonForm.name || !newSeasonForm.year) return;
  try {
    const res = await createSeason({ org_id: authStore.state.org?.id, name: newSeasonForm.name, year: newSeasonForm.year });
    const season = res.data?.data?.season ?? res.data?.season;
    seasons.value.unshift(season);
    form.season_id = season.id;
    showNewSeasonForm.value = false;
  } catch (e) {
    error.value = e.response?.data?.error?.message || 'Error al crear la temporada';
  }
};

const defaultForm = () => ({
  name: '',
  format: 'ROUND_ROBIN',
  type: 'OFICIAL',
  season_id: scopedSeasonId.value,
  category_id: null,
  inscription_fee: 0,
  max_teams: null,
  start_date: '',
  end_date: '',
  rounds_type: 'SINGLE',
  points_win: 3,
  points_draw: 1,
  points_loss: 0,
  group_count: 2,
  teams_advance_per_group: 2,
  two_legged_knockout: false,
  has_third_place_match: false,
  has_consolation: false,
  consolation_name: 'Liguilla',
  notes: '',
});

const form = reactive(defaultForm());

const loadTournaments = async () => {
  const params = { org_id: authStore.state.org?.id, limit: 100 };
  if (scopedSeasonId.value) params.season_id = scopedSeasonId.value;
  await fetchTournaments(params);
};

const toggleViewMode = () => {
  if (viewMode.value === 'list') {
    editingTournamentId.value = null;
    Object.assign(form, defaultForm());
    viewMode.value = 'form';
  } else {
    cancelForm();
  }
};

const cancelForm = () => {
  editingTournamentId.value = null;
  Object.assign(form, defaultForm());
  showNewSeasonForm.value = false;
  viewMode.value = 'list';
};

const openEditModal = (tournament) => {
  editingTournamentId.value = tournament.id;
  Object.assign(form, {
    name: tournament.name,
    format: tournament.format,
    type: tournament.type,
    season_id: tournament.season_id,
    category_id: tournament.category_id,
    inscription_fee: tournament.inscription_fee,
    max_teams: tournament.max_teams,
    start_date: tournament.start_date ?? '',
    end_date: tournament.end_date ?? '',
    rounds_type: tournament.rounds_type ?? 'SINGLE',
    points_win: tournament.points_win ?? 3,
    points_draw: tournament.points_draw ?? 1,
    points_loss: tournament.points_loss ?? 0,
    group_count: tournament.group_count ?? 2,
    teams_advance_per_group: tournament.teams_advance_per_group ?? 2,
    two_legged_knockout: tournament.two_legged_knockout ?? false,
    has_third_place_match: tournament.has_third_place_match ?? false,
    has_consolation: tournament.has_consolation ?? false,
    consolation_name: tournament.consolation_name ?? 'Liguilla',
    notes: tournament.notes ?? '',
  });
  viewMode.value = 'form';
};

const saveTournament = async () => {
  if (!form.season_id) {
    error.value = 'Selecciona una temporada';
    return;
  }
  if (!form.category_id) {
    error.value = 'Selecciona una categoría';
    return;
  }
  if (form.inscription_fee === null || form.inscription_fee === '' || Number(form.inscription_fee) < 0) {
    error.value = 'El costo de inscripción es requerido y no puede ser negativo';
    return;
  }
  if (form.max_teams === null || form.max_teams === '' || Number(form.max_teams) < 2) {
    error.value = 'La cantidad de equipos-series es requerida y debe ser al menos 2';
    return;
  }
  const payload = { ...form, org_id: authStore.state.org?.id, ...(editingTournamentId.value ? { id: editingTournamentId.value } : {}) };
  try {
    const tournament = await createOrUpdateTournament(payload);
    const wasEditing = Boolean(editingTournamentId.value);
    cancelForm();
    if (!wasEditing) router.push(`/tournaments/${tournament.id}`);
  } catch (e) {
    // Error manejado en el store
  }
};

const confirmDelete = async (tournament) => {
  const ok = await confirm({
    title: '¿Eliminar torneo?',
    message: `¿Estás seguro de que deseas eliminar el torneo "${tournament.name}"? Esta acción no se puede deshacer.`,
    confirmText: 'Eliminar',
    isDestructive: true,
  });
  if (!ok) return;
  try {
    await removeTournament(tournament.id);
    notifySuccess('Torneo eliminado exitosamente');
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al eliminar el torneo');
  }
};

// "Cerrar" torneo = darlo por finalizado (status FINISHED): deja de admitir
// inscripciones y de estar activo en la vista de club (ver
// club-series-tournament-lifecycle.md, torneos activos = REGISTRATION | IN_PROGRESS).
const confirmClose = async (tournament) => {
  const ok = await confirm({
    title: '¿Cerrar torneo?',
    message: `¿Dar por finalizado el torneo "${tournament.name}"? Dejará de admitir inscripciones y de aparecer como activo para los clubes.`,
    confirmText: 'Cerrar torneo',
    isDestructive: true,
  });
  if (!ok) return;
  try {
    await createOrUpdateTournament({ id: tournament.id, status: 'FINISHED' });
    notifySuccess('Torneo cerrado (finalizado) exitosamente');
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al cerrar el torneo');
  }
};

const openTournament = (tournamentId) => router.push(`/tournaments/${tournamentId}`);

// ── Panorama de torneos ───────────────────────────────────────────────────
const icons = {
  layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
  clipboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1Z"/><path d="M8 4H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="15" y2="16"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M17 5h3a2 2 0 0 1-2 4h-1M7 5H4a2 2 0 0 0 2 4h1"/></svg>',
};

const TOURNAMENT_TILE_STATUS = { registration: 'REGISTRATION', in_progress: 'IN_PROGRESS', finished: 'FINISHED' };

const dashboardTiles = computed(() => [
  { key: 'all', label: 'Total torneos', value: items.value.length, meta: scopedSeason.value ? scopedSeason.value.name : 'todas las temporadas', color: 'blue', icon: icons.layers },
  { key: 'registration', label: 'En inscripción', value: items.value.filter(t => t.status === 'REGISTRATION').length, meta: 'admiten series', color: 'blue', icon: icons.clipboard },
  { key: 'in_progress', label: 'En curso', value: items.value.filter(t => t.status === 'IN_PROGRESS').length, meta: 'con fixture jugándose', color: 'green', icon: icons.play },
  { key: 'finished', label: 'Finalizados', value: items.value.filter(t => t.status === 'FINISHED').length, meta: 'temporadas anteriores', color: 'gold', icon: icons.trophy },
]);

const selectedTileKey = ref('all');
const selectedTileLabel = computed(() => dashboardTiles.value.find((t) => t.key === selectedTileKey.value)?.label ?? '');
const selectTile = (key) => { selectedTileKey.value = key; };

const filteredTournaments = computed(() => {
  const status = TOURNAMENT_TILE_STATUS[selectedTileKey.value];
  if (!status) return items.value;
  return items.value.filter((t) => t.status === status);
});

onMounted(() => {
  loadTournaments();
  loadSeasons();
  loadCategories();
});

// La misma vista se usa en /tournaments y /seasons/:seasonId/tournaments —
// si el usuario navega de una temporada a otra sin recargar, refresca el listado.
watch(() => route.params.seasonId, () => {
  loadTournaments();
});
</script>

<style scoped>
.form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.folio-config-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  color: var(--text-secondary, var(--text-muted));
}

.font-medium { font-weight: 500; }
.p-0 { padding: 0 !important; }
.py-lg { padding-top: var(--spacing-lg); padding-bottom: var(--spacing-lg); }

.clickable-row { cursor: pointer; }
.clickable-row:hover { background: var(--surface-hover, rgba(255,255,255,0.03)); }
.numeric { font-variant-numeric: tabular-nums; white-space: nowrap; }

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
.status-badge--draft        { background: rgba(255, 255, 255, 0.08); color: var(--text-muted); }
.status-badge--registration { background: rgba(79, 195, 247, 0.16); color: #4fc3f7; }
.status-badge--in_progress  { background: rgba(0, 230, 118, 0.14); color: var(--primary-solid, #00e676); }
.status-badge--finished     { background: rgba(255, 213, 79, 0.16); color: #ffd54f; }
.status-badge--cancelled    { background: rgba(239, 83, 80, 0.14); color: #ef5350; }

.type-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 700;
}
.type-badge--oficial  { background: rgba(0, 230, 118, 0.14); color: var(--primary-solid, #00e676); }
.type-badge--amistoso { background: rgba(79, 195, 247, 0.16); color: #4fc3f7; }

.new-season-row {
  display: grid;
  grid-template-columns: 2fr 1fr auto;
  gap: 8px;
  margin-top: 8px;
}
</style>
