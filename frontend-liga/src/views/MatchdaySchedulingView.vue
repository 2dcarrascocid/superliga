<template>
  <div class="container mt-md">
    <div class="flex justify-between items-center mb-lg">
      <h2>Programación de Fecha</h2>
    </div>

    <!-- FASE: select -->
    <div v-if="phase === 'select'" class="card mb-md">
      <h3 class="mb-md">Selecciona temporada y fecha</h3>
      <form @submit.prevent="onGeneratePreview">
        <div class="scheduling-form-row">
          <div class="input-group">
            <label class="label">Temporada</label>
            <select v-model="selectedSeasonId" class="input" required>
              <option value="" disabled>Selecciona una temporada</option>
              <option v-for="s in seasons" :key="s.id" :value="s.id">{{ s.name }}{{ s.year ? ` (${s.year})` : '' }}</option>
            </select>
          </div>
          <div class="input-group">
            <label class="label">Fecha</label>
            <input v-model="selectedDate" type="date" class="input" required />
          </div>
        </div>

        <div class="input-group">
          <label class="label">Canchas a usar (opcional)</label>
          <p class="text-muted text-sm mb-sm">Si no eliges canchas, el sistema usa las 3 primeras disponibles.</p>
          <div class="scheduling-form-row">
            <select v-for="(_, idx) in selectedVenueIds" :key="idx" v-model="selectedVenueIds[idx]" class="input">
              <option value="">Sin especificar</option>
              <option v-for="v in venues" :key="v.id" :value="v.id">{{ v.name }}</option>
            </select>
          </div>
        </div>

        <div class="flex justify-end mt-md">
          <button type="submit" class="btn btn-primary" :disabled="generating">
            {{ generating ? 'Generando…' : 'Generar propuesta' }}
          </button>
        </div>
      </form>
    </div>

    <!-- FASE: preview -->
    <div v-if="phase === 'preview' && previewData" class="card mb-md">
      <div class="flex justify-between items-center mb-md">
        <div>
          <h3 class="mb-0">Propuesta de programación</h3>
          <p class="text-muted text-sm mb-0">
            {{ previewData.season?.name }}<span v-if="previewData.season?.year"> ({{ previewData.season.year }})</span>
            — {{ previewData.date }}
          </p>
        </div>
        <button class="btn btn-secondary" @click="onBackToSelect">&larr; Volver</button>
      </div>

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Local</th>
              <th>Visita</th>
              <th>Categoría</th>
              <th>Cancha</th>
              <th>Hora</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="previewData.matches.length === 0">
              <td colspan="5" class="text-center py-lg">No hay partidos para esa fecha.</td>
            </tr>
            <tr v-for="match in previewData.matches" :key="match.id">
              <td>
                <div>{{ match.home_series?.club?.name || '—' }}</div>
                <div class="club-flags">
                  <span v-if="isFailedClub(match.home_series?.club_id)" class="badge badge-danger">Distribución fallida</span>
                  <span v-else-if="isPartialClub(match.home_series?.club_id)" class="badge badge-warning">Parcial</span>
                  <span v-if="fairnessCount(match.home_series?.club_id)" class="text-muted text-sm" :title="`${fairnessCount(match.home_series?.club_id)} fallas esta temporada`">
                    {{ fairnessCount(match.home_series?.club_id) }} fallas esta temporada
                  </span>
                </div>
              </td>
              <td>
                <div>{{ match.away_series?.club?.name || '—' }}</div>
                <div class="club-flags">
                  <span v-if="isFailedClub(match.away_series?.club_id)" class="badge badge-danger">Distribución fallida</span>
                  <span v-else-if="isPartialClub(match.away_series?.club_id)" class="badge badge-warning">Parcial</span>
                  <span v-if="fairnessCount(match.away_series?.club_id)" class="text-muted text-sm" :title="`${fairnessCount(match.away_series?.club_id)} fallas esta temporada`">
                    {{ fairnessCount(match.away_series?.club_id) }} fallas esta temporada
                  </span>
                </div>
              </td>
              <td>{{ categoryLabel(match) }}</td>
              <td>
                <select
                  v-model="editedAssignments[match.id].venueId"
                  class="input"
                  @change="onVenueChange(match.id)"
                >
                  <option v-for="v in previewData.venues" :key="v.id" :value="v.id">{{ v.name }}</option>
                </select>
              </td>
              <td>
                <select
                  v-model="editedAssignments[match.id].matchTime"
                  class="input"
                  @change="onTimeChange(match.id)"
                >
                  <option v-for="slot in slotsForMatch(match.id)" :key="slot.index" :value="slot.time">{{ slot.label }}</option>
                </select>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex justify-end gap-sm mt-md">
        <button class="btn btn-secondary" @click="onBackToSelect">Volver</button>
        <button class="btn btn-primary" @click="onSave">Guardar programación</button>
      </div>
    </div>

    <!-- FASE: saving -->
    <div v-if="phase === 'saving'" class="card text-center">
      <h3 class="mb-sm">Guardando programación…</h3>
      <p class="text-muted text-sm mb-0">Por favor espera unos segundos.</p>
    </div>

    <!-- FASE: done -->
    <div v-if="phase === 'done'" class="card text-center">
      <h3 class="mb-sm">Programación guardada</h3>
      <p class="text-muted mb-md">
        Se actualizaron {{ applyResult?.matchesUpdated ?? 0 }} partidos.
      </p>
      <button class="btn btn-primary" @click="onReset">Programar otra fecha</button>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useNotifyStore } from '../stores/notify';
import { getSeasons } from '../services/seasons.service.js';
import { getVenues } from '../services/venues.service.js';
import { previewSchedule, applySchedule } from '../services/matchScheduling.service.js';

const authStore = useAuthStore();
const { notifySuccess, notifyError } = useNotifyStore();

const phase = ref('select'); // 'select' | 'preview' | 'saving' | 'done'
const generating = ref(false);

const seasons = ref([]);
const venues = ref([]);

const selectedSeasonId = ref('');
const selectedDate = ref('');
const selectedVenueIds = ref(['', '', '']);

const previewData = ref(null);
const editedAssignments = reactive({});
const applyResult = ref(null);

const isFailedClub = (clubId) => !!clubId && (previewData.value?.failedClubIds || []).includes(clubId);
const isPartialClub = (clubId) => !!clubId && (previewData.value?.partiallyFailedClubIds || []).includes(clubId);
const fairnessCount = (clubId) => (clubId ? previewData.value?.fairnessCounts?.[clubId] || 0 : 0);

const categoryLabel = (match) =>
  match.tournament?.category?.name
  || match.home_series?.category?.name
  || match.away_series?.category?.name
  || match.tournament?.name
  || '—';

const slotsForMatch = (matchId) => {
  const venueId = editedAssignments[matchId]?.venueId;
  const venue = (previewData.value?.venues || []).find((v) => v.id === venueId);
  return venue?.slots || [];
};

const onVenueChange = (matchId) => {
  const slots = slotsForMatch(matchId);
  const current = editedAssignments[matchId].matchTime;
  if (!slots.find((s) => s.time === current)) {
    const first = slots[0];
    editedAssignments[matchId].matchTime = first?.time || '';
    editedAssignments[matchId].timeSlot = first?.label || '';
  }
};

const onTimeChange = (matchId) => {
  const slots = slotsForMatch(matchId);
  const slot = slots.find((s) => s.time === editedAssignments[matchId].matchTime);
  editedAssignments[matchId].timeSlot = slot?.label || '';
};

const initEditedAssignments = () => {
  Object.keys(editedAssignments).forEach((key) => delete editedAssignments[key]);
  (previewData.value?.proposal || []).forEach((p) => {
    editedAssignments[p.matchId] = {
      venueId: p.venueId,
      matchTime: p.matchTime,
      timeSlot: p.timeSlot,
    };
  });
};

const onGeneratePreview = async () => {
  if (!selectedSeasonId.value || !selectedDate.value) return;
  generating.value = true;
  try {
    const venueIds = selectedVenueIds.value.filter(Boolean);
    const payload = { season_id: selectedSeasonId.value, date: selectedDate.value };
    if (venueIds.length) payload.venue_ids = venueIds;

    const res = await previewSchedule(payload);
    const envelope = res.data;
    previewData.value = envelope?.data ?? envelope;
    initEditedAssignments();
    phase.value = 'preview';
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al generar la propuesta de programación');
  } finally {
    generating.value = false;
  }
};

const onSave = async () => {
  phase.value = 'saving';
  try {
    const assignments = Object.entries(editedAssignments).map(([matchId, a]) => ({
      matchId,
      venueId: a.venueId,
      matchTime: a.matchTime,
      timeSlot: a.timeSlot,
    }));
    const payload = {
      season_id: selectedSeasonId.value,
      date: selectedDate.value,
      assignments,
      failed_club_ids: previewData.value?.failedClubIds || [],
      partially_failed_club_ids: previewData.value?.partiallyFailedClubIds || [],
    };
    if (authStore.state.org?.id) payload.org_id = authStore.state.org.id;

    const res = await applySchedule(payload);
    const envelope = res.data;
    applyResult.value = envelope?.data ?? envelope;
    notifySuccess('Programación guardada exitosamente');
    phase.value = 'done';
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al guardar la programación');
    phase.value = 'preview';
  }
};

const onBackToSelect = () => {
  phase.value = 'select';
};

const onReset = () => {
  phase.value = 'select';
  previewData.value = null;
  applyResult.value = null;
  Object.keys(editedAssignments).forEach((key) => delete editedAssignments[key]);
  selectedSeasonId.value = '';
  selectedDate.value = '';
  selectedVenueIds.value = ['', '', ''];
};

onMounted(async () => {
  const orgId = authStore.state.org?.id;

  try {
    const res = await getSeasons({ org_id: orgId });
    const envelope = res.data;
    const data = envelope?.data ?? envelope;
    seasons.value = data?.seasons ?? [];
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al cargar temporadas');
  }

  try {
    const res = await getVenues({ org_id: orgId, limit: 200 });
    venues.value = res.data?.data?.venues ?? res.data?.data ?? [];
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al cargar canchas');
  }
});
</script>

<style scoped>
.scheduling-form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.club-flags {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  margin-top: 4px;
}

.mb-0 { margin-bottom: 0; }
.py-lg { padding-top: var(--spacing-lg); padding-bottom: var(--spacing-lg); }
</style>
