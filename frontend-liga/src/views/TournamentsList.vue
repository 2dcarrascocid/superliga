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

    <!-- Formulario de creación -->
    <div v-if="viewMode === 'form'" class="mb-lg card">
      <h3 class="mb-md">Nuevo Torneo</h3>
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

          <div class="input-group">
            <label class="label">Costo de inscripción *</label>
            <input v-model.number="form.inscription_fee" type="number" min="0" step="1" class="input" required />
            <p class="input-hint">
              Monto que cada club debe pagar para inscribirse al torneo (se cobra una vez por club, no por serie).
            </p>
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
      <div class="card p-0">
        <div class="flex justify-between items-center p-md" style="border-bottom: 1px solid var(--border-color);">
          <h3 class="m-0">{{ scopedSeason ? `Torneos de ${scopedSeason.name}` : 'Todos los torneos' }}</h3>
          <span class="text-muted text-sm">{{ items.length }} en total</span>
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
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading && items.length === 0">
                <td colspan="7" class="text-center py-lg">Cargando...</td>
              </tr>
              <tr v-else-if="items.length === 0">
                <td colspan="7" class="text-center py-lg">Aún no hay torneos creados.</td>
              </tr>
              <tr v-for="tournament in items" :key="tournament.id" class="clickable-row" @click="openTournament(tournament.id)">
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
                <td>
                  <div class="flex gap-sm">
                    <button class="btn btn-sm btn-secondary" @click.stop="openTournament(tournament.id)">Administrar</button>
                    <button class="btn btn-sm btn-danger" @click.stop="confirmDelete(tournament)">Eliminar</button>
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
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTournamentsStore } from '../stores/tournaments';
import { useAuthStore } from '../stores/auth';
import { useNotifyStore } from '../stores/notify';
import { getSeasons, createSeason } from '../services/seasons.service.js';
import { listCategoriesByOrg } from '../services/categories.service.js';

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
    Object.assign(form, defaultForm());
    viewMode.value = 'form';
  } else {
    cancelForm();
  }
};

const cancelForm = () => {
  Object.assign(form, defaultForm());
  showNewSeasonForm.value = false;
  viewMode.value = 'list';
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
  const payload = { ...form, org_id: authStore.state.org?.id };
  try {
    const tournament = await createOrUpdateTournament(payload);
    viewMode.value = 'list';
    router.push(`/tournaments/${tournament.id}`);
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

const openTournament = (tournamentId) => router.push(`/tournaments/${tournamentId}`);

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
