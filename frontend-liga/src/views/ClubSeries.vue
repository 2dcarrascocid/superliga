<template>
  <div class="container mt-md">
    <!-- Bloque "Detalle de Club" (título, card de info, KPIs y tabs):
         compartido con ClubDetail.vue vía este componente, para que se vea
         siempre sin importar en qué pestaña esté el usuario. -->
    <ClubHeader
      :club-id="clubId"
      :club="club"
      active-tab-key="series"
      :tabs="clubTabs"
      @tab-click="onHeaderTabClick"
      class="mb-md"
    />

    <div class="flex justify-between items-center mb-lg">
      <h2>Series — {{ club?.name || '' }}</h2>
      <div class="flex gap-sm">
        <button
          class="btn"
          :class="showNewSeriesForm ? 'btn-secondary' : 'btn-primary'"
          @click="toggleNewSeriesForm"
        >
          {{ showNewSeriesForm ? 'Cancelar' : '+ Nueva Serie' }}
        </button>
        <button class="btn btn-secondary" @click="$router.push(`/clubs/${clubId}`)">← Club</button>
      </div>
    </div>

    <div v-if="error" class="alert alert-error mb-md">{{ error }}</div>

    <!-- Alta/edición de serie (oculto hasta que se pide explícitamente) -->
    <div v-if="showNewSeriesForm" class="card mb-md">
      <h3 class="mb-md">{{ editingSeriesId ? 'Editar Serie' : 'Nueva Serie' }}</h3>
      <form class="series-row" @submit.prevent="onCreateSeries">
        <div class="input-group flex-1">
          <label class="label">Nombre de la serie</label>
          <input v-model="newSeries.name" class="input" placeholder="Serie Honor" required />
        </div>
        <div class="input-group flex-2">
          <label class="label">Descripción</label>
          <textarea v-model="newSeries.description" class="input" rows="1" placeholder="Ej: Serie Honor - jugadores mayores de 18 años" />
        </div>
        <div class="input-group">
          <label class="label">Edad</label>
          <input v-model.number="newSeries.min_age" type="number" min="1" max="100" class="input" placeholder="Ej: 15" style="width: 90px;" />
        </div>
        <div class="input-group">
          <label class="label">Restricción de año</label>
          <select v-model="newSeries.age_restriction" class="input" style="width: 140px;">
            <option :value="true">Sí (edad cumplida)</option>
            <option :value="false">No (por año de nacimiento)</option>
          </select>
        </div>
        <div class="input-group">
          <label class="label">Categoría</label>
          <select v-model="newSeries.category_id" class="input" style="width: 220px;">
            <option :value="null">Sin categoría</option>
            <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ categoryLabel(cat) }}</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary" style="align-self: flex-end;">
          {{ editingSeriesId ? 'Guardar Cambios' : 'Crear Serie' }}
        </button>
      </form>
      <p class="text-muted text-sm mt-sm">
        <strong>Restricción de año = Sí:</strong> el jugador debe tener la edad cumplida (edad real) para jugar.
        <strong>Restricción de año = No:</strong> la elegibilidad se calcula por año de nacimiento, usando la Edad como parámetro (categoría por año, sin exigir cumpleaños).
        <strong>Categoría:</strong> debe coincidir con la categoría del torneo para poder inscribir esta serie; una serie "Sin categoría" solo puede inscribirse en torneos sin categoría definida.
      </p>
    </div>

    <ClubSeriesTable
      v-if="!selectedSeries"
      :items="items"
      :selected-series-id="selectedSeries?.id ?? null"
      @select="selectSeries"
      @edit="onEditSeries"
      @delete="onDeleteSeries"
    />
    <SeriesRosterDetail
      v-else
      :series="selectedSeries"
      :club-roster="clubRoster"
      @back="selectedSeries = null"
    />

    <!-- Torneos activos -->
    <div class="card mt-md">
      <div class="tournaments-header">
        <div>
          <h3 class="mb-0">Torneos activos</h3>
          <p class="text-muted text-sm mt-xs mb-0">Torneos en período de inscripción, de la temporada activa de tu organización.</p>
        </div>
        <button class="btn btn-sm btn-secondary" @click="loadAvailableTournaments" :disabled="tournamentsLoading">
          <span v-if="tournamentsLoading">Cargando…</span>
          <span v-else>↻ Actualizar</span>
        </button>
      </div>

      <div v-if="tournamentsLoading" class="text-center py-md text-muted text-sm">Cargando torneos…</div>
      <div v-else-if="availableTournaments.length === 0" class="empty-tournaments">
        No hay torneos en período de inscripción en este momento.
      </div>
      <div v-else class="tournaments-grid">
        <div
          v-for="t in availableTournaments"
          :key="t.id"
          class="tournament-card"
        >
          <div class="tournament-card-header">
            <div>
              <div class="tournament-name">{{ t.name }}</div>
              <div class="tournament-meta">
                {{ t.category?.name || 'Sin categoría' }} ·
                {{ t.season?.name || 'Sin temporada' }} ·
                {{ formatLabel(t.format) }}
              </div>
            </div>
            <span class="type-badge" :class="`type-badge--${t.type?.toLowerCase()}`">{{ typeLabel(t.type) }}</span>
          </div>
          <div class="tournament-card-body">
            <div class="tournament-stat">
              <span class="stat-label">Inscripción:</span>
              <span class="stat-val">${{ formatMoney(t.inscription_fee || 0) }}</span>
            </div>
            <div class="tournament-stat">
              <span class="stat-label">Equipos:</span>
              <span class="stat-val">{{ t.teams_count ?? 0 }}</span>
            </div>
            <div class="tournament-stat">
              <span class="stat-label">Clubes inscritos:</span>
              <span class="stat-val">{{ t.clubs_count ?? 0 }}</span>
            </div>
          </div>
          <div class="tournament-card-actions">
            <button
              class="btn btn-sm btn-primary"
              @click="$router.push(`/tournaments/${t.id}`)"
            >
              Ver torneo →
            </button>
            <div class="series-for-tournament">
              <span class="text-muted text-sm">Series compatibles:</span>
              <div v-if="compatibleSeries(t).length === 0" class="text-muted text-sm text-italic">
                Ninguna serie del club coincide con este torneo
              </div>
              <div v-else class="inscribe-row">
                <select v-model="seriesSelection[t.id]" class="input input-sm">
                  <option value="" disabled>Selecciona una serie…</option>
                  <option v-for="s in compatibleSeries(t)" :key="s.id" :value="s.id">{{ s.name }}</option>
                </select>
                <button
                  class="btn btn-sm btn-accent"
                  :disabled="!seriesSelection[t.id] || registeringTournamentId === t.id"
                  @click="onRegisterSeries(t)"
                >
                  <span v-if="registeringTournamentId === t.id">Inscribiendo…</span>
                  <span v-else>Inscribir serie</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useClubSeriesStore } from '../stores/clubSeries';
import { useNotifyStore } from '../stores/notify';
import { getClubById } from '../services/clubs.service';
import { getRosterByClub } from '../services/roster.service';
import { getTournaments, registerClub, registerTeam } from '../services/tournaments.service';
import { getSeasons } from '../services/seasons.service';
import * as categoriesService from '../services/categories.service';
import ClubHeader from '../components/ClubHeader.vue';
import ClubSeriesTable from '../components/ClubSeriesTable.vue';
import SeriesRosterDetail from '../components/SeriesRosterDetail.vue';

const route = useRoute();
const router = useRouter();
const clubId = route.params.clubId;

const { items, error, fetchClubSeries, createOrUpdateSeries, removeSeries } = useClubSeriesStore();
const { confirm, notifySuccess, notifyError } = useNotifyStore();

// Tabs pasados al <ClubHeader> compartido con ClubDetail.vue (sin
// "Categorías", ya eliminado). "Series" es la única entrada activa acá; el
// resto navega de vuelta a ClubDetail.vue vía ?tab=<key> (ClubDetail.vue solo
// redirige a Series cuando NO viene ese query param, evitando un loop de
// redirects entre ambas vistas).
const clubTabs = [
  { key: 'series',           label: 'Series' },
  { key: 'players',          label: 'Jugadores' },
  { key: 'inactive_players', label: 'Jugadores Inactivos' },
  { key: 'transfers',        label: 'Traspasos' },
  { key: 'admins',           label: 'Administradores' },
  { key: 'edit',             label: 'Editar Club' },
];

// "Series" ya es la pestaña activa en esta vista: un click sobre ella no
// navega a ningún lado. El resto de las pestañas vuelve a ClubDetail.vue.
const onHeaderTabClick = (key) => {
  if (key === 'series') return;
  router.push(`/clubs/${clubId}?tab=${key}`);
};

const club = ref(null);
const clubRoster = ref([]);
const selectedSeries = ref(null);
const showNewSeriesForm = ref(false);
const editingSeriesId = ref(null);
const newSeries = ref({ name: '', description: '', min_age: null, age_restriction: false, category_id: null });

// Categorías del club (Parámetros → Categorías), para vincular la serie a la
// categoría del torneo al inscribirla (el backend valida category_id de la
// serie contra category_id del torneo — ver CATEGORY_MISMATCH).
const categories = ref([]);

const loadCategories = async () => {
  try {
    const response = await categoriesService.listCategories(clubId);
    categories.value = response.data?.data?.categories ?? [];
  } catch (e) {
    console.error('[ClubSeries] loadCategories:', e);
    categories.value = [];
  }
};

/** Label descriptivo para el <select> de categoría (nombre + serie/edad/género si están definidos). */
const categoryLabel = (cat) => {
  const extra = [];
  if (cat.serie) extra.push(cat.serie);
  if (cat.age_from || cat.age_to) extra.push(`${cat.age_from ?? '—'}-${cat.age_to ?? '—'} años`);
  if (cat.gender) extra.push(cat.gender);
  return extra.length ? `${cat.name} (${extra.join(' · ')})` : cat.name;
};

// ── Torneos activos ──────────────────────────────────────────────────────────
const availableTournaments = ref([]);
const tournamentsLoading = ref(false);
const seriesSelection = reactive({}); // tournamentId -> seriesId elegida para inscribir
const registeringTournamentId = ref(null);

const loadAvailableTournaments = async () => {
  tournamentsLoading.value = true;
  try {
    // El org_id del torneo es el de ESTE club (club.org_id), no el de la
    // organización activa del usuario logueado: un admin de club puro no
    // tiene authStore.state.org seteado (solo aplica a admins de org), y
    // aun así debe poder ver los torneos disponibles de su propio club.
    const orgId = club.value?.org_id;
    if (!orgId) {
      availableTournaments.value = [];
      return;
    }

    // Solo "activos": en período de inscripción Y de la temporada activa
    // de la organización. Sin temporada activa no hay torneos que mostrar.
    const seasonsRes = await getSeasons({ org_id: orgId, active: true });
    const seasons = seasonsRes.data?.data?.seasons ?? seasonsRes.data?.seasons ?? [];
    const activeSeasonId = seasons[0]?.id;
    if (!activeSeasonId) {
      availableTournaments.value = [];
      return;
    }

    const res = await getTournaments({ org_id: orgId, status: 'REGISTRATION', season_id: activeSeasonId, limit: 50 });
    availableTournaments.value = res.data?.data?.tournaments ?? res.data?.tournaments ?? [];
    // Inicializa el selector de series por torneo sin pisar una selección ya hecha.
    availableTournaments.value.forEach((t) => {
      if (!(t.id in seriesSelection)) seriesSelection[t.id] = '';
    });
  } catch (e) {
    console.error('[ClubSeries] loadAvailableTournaments:', e);
    availableTournaments.value = [];
  } finally {
    tournamentsLoading.value = false;
  }
};

const formatMoney = (n) => Number(n).toLocaleString('es-AR');

const FORMAT_LABELS = {
  ROUND_ROBIN: 'Todos contra Todos',
  KNOCKOUT: 'Eliminación Directa',
  GROUPS_KNOCKOUT: 'Formato Mixto',
};
const TYPE_LABELS = { OFICIAL: 'Oficial', AMISTOSO: 'Amistoso' };
const formatLabel = (v) => FORMAT_LABELS[v] || v;
const typeLabel = (v) => TYPE_LABELS[v] || v;

/** Series del club cuya categoría coincide con la del torneo (null = sin categoría → acepta todo) */
const compatibleSeries = (tournament) => {
  if (!tournament.category_id) return items.value;
  return items.value.filter((s) => s.category_id === tournament.category_id || !s.category_id);
};

// ── Loaders ─────────────────────────────────────────────────────────────────

const loadClub = async () => {
  const response = await getClubById(clubId);
  club.value = response.data?.data?.club ?? null;
};

const loadClubRoster = async () => {
  const response = await getRosterByClub(clubId);
  clubRoster.value = (response.data?.data?.roster ?? []).filter((r) => r.status === 'ACTIVE');
};

const selectSeries = (series) => {
  selectedSeries.value = series;
};

// ── Acciones de serie ────────────────────────────────────────────────────────

const resetSeriesForm = () => {
  newSeries.value = { name: '', description: '', min_age: null, age_restriction: false, category_id: null };
  editingSeriesId.value = null;
};

const toggleNewSeriesForm = () => {
  showNewSeriesForm.value = !showNewSeriesForm.value;
  if (!showNewSeriesForm.value) {
    resetSeriesForm();
  }
};

// Reusa el mismo formulario de "Nueva Serie" pero precargado, para poder
// corregir series existentes (p.ej. las que quedaron con category_id: null).
const onEditSeries = (series) => {
  editingSeriesId.value = series.id;
  newSeries.value = {
    name: series.name,
    description: series.description || '',
    min_age: series.min_age ?? null,
    age_restriction: !!series.age_restriction,
    category_id: series.category_id ?? null,
  };
  showNewSeriesForm.value = true;
};

const onCreateSeries = async () => {
  try {
    const payload = {
      clubId,
      name: newSeries.value.name,
      description: newSeries.value.description || null,
      min_age: newSeries.value.min_age || null,
      age_restriction: newSeries.value.age_restriction,
      category_id: newSeries.value.category_id || null,
    };
    if (editingSeriesId.value) payload.id = editingSeriesId.value;

    await createOrUpdateSeries(payload);
    const wasEditing = !!editingSeriesId.value;
    resetSeriesForm();
    showNewSeriesForm.value = false;
    notifySuccess(wasEditing ? 'Serie actualizada exitosamente' : 'Serie creada exitosamente');
  } catch (e) {
    notifyError(e.response?.data?.error?.message || (editingSeriesId.value ? 'Error al actualizar la serie' : 'Error al crear la serie'));
  }
};

const onDeleteSeries = async (series) => {
  const ok = await confirm({
    title: '¿Eliminar serie?',
    message: `¿Estás seguro de que deseas eliminar la serie "${series.name}"?`,
    confirmText: 'Eliminar',
    isDestructive: true,
  });
  if (!ok) return;
  try {
    await removeSeries(series.id);
    if (selectedSeries.value?.id === series.id) selectedSeries.value = null;
    notifySuccess('Serie eliminada');
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al eliminar la serie');
  }
};

// ── Inscripción de series a torneos ──────────────────────────────────────────

// El cobro de inscripción lo dispara el backend al inscribir el CLUB al
// torneo (POST /tournaments/:id/clubs), no al inscribir la serie/equipo. Para
// lograr "un clic inscribe la serie y genera el cobro" sin tocar el backend,
// encadenamos club → equipo acá:
//   1) registerClub: si el club ya estaba inscrito (DUPLICATE_CLUB_REGISTRATION)
//      lo tratamos como éxito silencioso (no hay que generar el cobro de nuevo).
//      Cualquier otro error corta el flujo.
//   2) registerTeam: inscribe la serie como equipo del torneo.
const onRegisterSeries = async (tournament) => {
  const seriesId = seriesSelection[tournament.id];
  if (!seriesId) return;

  registeringTournamentId.value = tournament.id;
  try {
    try {
      await registerClub(tournament.id, clubId);
    } catch (e) {
      if (e.response?.data?.error?.code !== 'DUPLICATE_CLUB_REGISTRATION') {
        notifyError(e.response?.data?.error?.message || 'Error al inscribir el club en el torneo');
        return;
      }
    }

    await registerTeam(tournament.id, { series_id: seriesId });
    seriesSelection[tournament.id] = '';
    notifySuccess('Serie inscrita — cobro de inscripción generado, pendiente de pago');
    await loadAvailableTournaments();
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al inscribir la serie en el torneo');
  } finally {
    registeringTournamentId.value = null;
  }
};

onMounted(async () => {
  await loadClub();
  loadClubRoster();
  fetchClubSeries(clubId);
  loadAvailableTournaments();
  loadCategories();
});
</script>

<style scoped>
.series-row { display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap; }
.flex-1 { flex: 1; min-width: 200px; }
.flex-2 { flex: 2; min-width: 240px; }

.py-md { padding-top: var(--spacing-md); padding-bottom: var(--spacing-md); }
.btn-sm { padding: 0.4rem 0.8rem; font-size: 0.875rem; }
.text-italic { font-style: italic; }

/* Accent button (también usado por la sección de Torneos activos, más abajo) */
.btn-accent {
  background: linear-gradient(135deg, #00e676, #1de9b6);
  color: #141622;
  font-weight: 700;
  border: none;
}
.btn-accent:hover:not(:disabled) { opacity: 0.88; }
.btn-accent:disabled { opacity: 0.45; cursor: default; }

/* Tournaments section */
.tournaments-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}
.empty-tournaments {
  text-align: center;
  padding: 2rem;
  color: var(--text-muted);
  font-style: italic;
  font-size: 0.9rem;
}
.tournaments-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}
.tournament-card {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--radius-md, 8px);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.tournament-card:hover {
  border-color: rgba(0, 230, 118, 0.3);
  box-shadow: 0 0 16px rgba(0,230,118,0.06);
}
.tournament-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
}
.tournament-name {
  font-weight: 700;
  font-size: 1rem;
  margin-bottom: 2px;
}
.tournament-meta {
  font-size: 0.8rem;
  color: var(--text-muted);
}
.tournament-card-body {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}
.tournament-stat {
  font-size: 0.82rem;
}
.stat-label { color: var(--text-muted); margin-right: 3px; }
.stat-val { font-weight: 600; }
.tournament-card-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border-top: 1px solid rgba(255,255,255,0.06);
  padding-top: 0.75rem;
}
.series-for-tournament {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.inscribe-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}
.input-sm {
  width: auto;
  flex: 1;
  min-width: 140px;
  padding: 0.4rem 0.6rem;
  font-size: 0.85rem;
}

/* Type badges */
.type-badge {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0.2rem 0.6rem; border-radius: var(--radius-full);
  font-size: 0.7rem; font-weight: 700;
  flex-shrink: 0;
}
.type-badge--oficial  { background: rgba(79,195,247,0.14); color: #4fc3f7; }
.type-badge--amistoso { background: rgba(245,158,11,0.14); color: #f59e0b; }

.mt-xs { margin-top: 0.25rem; }
.mb-0  { margin-bottom: 0; }
.mb-sm { margin-bottom: 0.5rem; }
.mb-md { margin-bottom: 1rem; }
</style>
