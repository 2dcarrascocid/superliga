<template>
  <div class="container mt-md">
    <div class="flex justify-between items-center mb-lg">
      <h2>Planilla de Control de Partido</h2>
      <button class="btn btn-secondary" @click="goBack">&larr; Volver</button>
    </div>

    <div v-if="error" class="alert alert-error mb-md">{{ error }}</div>

    <div v-if="current" class="card mb-md text-center">
      <h3 class="mb-sm">{{ seriesLabel(current.home_series) || 'Local' }} vs {{ seriesLabel(current.away_series) || 'Visita' }}</h3>
      <p class="text-muted text-sm mb-0">
        {{ current.match_date || 'Sin fecha' }} {{ current.match_time || '' }} ·
        <span class="status-badge" :class="`status-badge--${current.status?.toLowerCase()}`">{{ statusLabel(current.status) }}</span>
      </p>
    </div>

    <!-- Logística -->
    <div class="card mb-md">
      <h3 class="mb-md">Logística</h3>
      <form @submit.prevent="onSaveLogistics">
        <div class="folio-config-row">
          <div class="input-group">
            <label class="label">Cancha</label>
            <select v-model="logisticsForm.venue_id" class="input">
              <option value="">Sin asignar</option>
              <option v-for="v in venues" :key="v.id" :value="v.id">{{ v.name }}</option>
            </select>
          </div>
          <div class="input-group">
            <label class="label">Árbitro</label>
            <select v-model="logisticsForm.referee_id" class="input">
              <option value="">Sin asignar</option>
              <option v-for="r in referees" :key="r.id" :value="r.id">{{ r.full_name }}</option>
            </select>
          </div>
        </div>
        <div class="folio-config-row mt-md">
          <div class="input-group">
            <label class="label">Fecha</label>
            <input v-model="logisticsForm.match_date" type="date" class="input" />
          </div>
          <div class="input-group">
            <label class="label">Hora</label>
            <input v-model="logisticsForm.match_time" type="time" class="input" />
          </div>
          <div class="input-group">
            <label class="label">Turno / Bloque</label>
            <input v-model="logisticsForm.time_slot" class="input" placeholder="Bloque 1" />
          </div>
        </div>
        <div class="input-group mt-md">
          <label class="label">Observaciones del turno</label>
          <textarea v-model="logisticsForm.observations" class="input" rows="2" />
        </div>
        <div class="flex justify-end mt-md">
          <button type="submit" class="btn btn-primary" :disabled="loading">Guardar Logística</button>
        </div>
      </form>
    </div>

    <!-- Resultado -->
    <div class="card mb-md">
      <h3 class="mb-md">Resultado</h3>
      <form @submit.prevent="onSaveResult">
        <div class="result-row">
          <div class="input-group">
            <label class="label">{{ seriesLabel(current?.home_series) || 'Local' }}</label>
            <input v-model.number="resultForm.home_score" type="number" min="0" class="input" />
          </div>
          <span class="result-vs">—</span>
          <div class="input-group">
            <label class="label">{{ seriesLabel(current?.away_series) || 'Visita' }}</label>
            <input v-model.number="resultForm.away_score" type="number" min="0" class="input" />
          </div>
        </div>
        <div class="result-row mt-sm">
          <div class="input-group">
            <label class="label">Penales Local</label>
            <input v-model.number="resultForm.home_penalty_score" type="number" min="0" class="input" />
          </div>
          <span class="result-vs"></span>
          <div class="input-group">
            <label class="label">Penales Visita</label>
            <input v-model.number="resultForm.away_penalty_score" type="number" min="0" class="input" />
          </div>
        </div>
        <div class="input-group mt-md" style="max-width: 240px;">
          <label class="label">Estado</label>
          <select v-model="resultForm.status" class="input">
            <option value="SCHEDULED">Programado</option>
            <option value="IN_PROGRESS">En juego</option>
            <option value="FINISHED">Finalizado</option>
            <option value="POSTPONED">Postergado</option>
            <option value="CANCELLED">Cancelado</option>
          </select>
        </div>
        <div v-if="bracketNote" class="alert alert-info mt-md">{{ bracketNoteLabel }}</div>
        <div class="flex justify-end mt-md">
          <button type="submit" class="btn btn-primary" :disabled="loading">Guardar Resultado</button>
        </div>
      </form>
    </div>

    <!-- Eventos -->
    <div class="card">
      <h3 class="mb-md">Goles, Tarjetas y Amonestaciones</h3>

      <form class="event-row" @submit.prevent="onAddEvent">
        <div class="input-group">
          <label class="label">Equipo</label>
          <select v-model="eventForm.series_id" class="input" required @change="onEventSeriesChange">
            <option value="" disabled>Selecciona</option>
            <option v-if="current?.home_series_id" :value="current.home_series_id">{{ seriesLabel(current.home_series) }}</option>
            <option v-if="current?.away_series_id" :value="current.away_series_id">{{ seriesLabel(current.away_series) }}</option>
          </select>
        </div>
        <div class="input-group flex-1">
          <label class="label">Jugador</label>
          <select v-model="eventForm.player_id" class="input">
            <option value="">Sin especificar</option>
            <option v-for="p in currentRoster" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>
        <div class="input-group" style="max-width: 180px;">
          <label class="label">Tipo</label>
          <select v-model="eventForm.event_type" class="input" required>
            <option value="GOAL">Gol</option>
            <option value="OWN_GOAL">Autogol</option>
            <option value="YELLOW_CARD">Tarjeta Amarilla</option>
            <option value="RED_CARD">Tarjeta Roja</option>
            <option value="WARNING">Amonestación</option>
          </select>
        </div>
        <div class="input-group" style="max-width: 100px;">
          <label class="label">Minuto</label>
          <input v-model.number="eventForm.minute" type="number" min="0" class="input" />
        </div>
        <button type="submit" class="btn btn-primary" style="align-self: flex-end;">Registrar</button>
      </form>

      <div class="table-container mt-md">
        <table class="table">
          <thead>
            <tr>
              <th>Minuto</th>
              <th>Equipo</th>
              <th>Jugador</th>
              <th>Evento</th>
              <th>Notas</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="events.length === 0">
              <td colspan="6" class="text-center py-lg">Sin eventos registrados.</td>
            </tr>
            <tr v-for="event in events" :key="event.id">
              <td>{{ event.minute ?? '—' }}'</td>
              <td>{{ seriesLabel(event.series) || '—' }}</td>
              <td>{{ event.player ? `${event.player.first_name} ${event.player.last_name}` : '—' }}</td>
              <td>{{ eventTypeLabel(event.event_type) }}</td>
              <td>{{ event.notes || '—' }}</td>
              <td><button class="btn btn-sm btn-danger" @click="onRemoveEvent(event)">Eliminar</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMatchesStore } from '../stores/matches';
import { useAuthStore } from '../stores/auth';
import { useNotifyStore } from '../stores/notify';
import { getVenues } from '../services/venues.service';
import { getReferees } from '../services/referees.service';
import { getSeriesRoster } from '../services/clubSeries.service';

const route = useRoute();
const router = useRouter();
const matchId = route.params.matchId;

const { current, events, loading, error, fetchMatchById, saveLogistics, saveResult, fetchEvents, addEvent, removeEvent } = useMatchesStore();
const authStore = useAuthStore();
const { confirm, notifySuccess, notifyError } = useNotifyStore();

const venues = ref([]);
const referees = ref([]);
const rosterBySeries = ref({});
const bracketNote = ref(null);

const STATUS_LABELS = {
  SCHEDULED: 'Programado', IN_PROGRESS: 'En juego', FINISHED: 'Finalizado',
  POSTPONED: 'Postergado', WALKOVER: 'Walkover', CANCELLED: 'Cancelado',
};
const EVENT_TYPE_LABELS = {
  GOAL: 'Gol', OWN_GOAL: 'Autogol', YELLOW_CARD: 'Tarjeta Amarilla', RED_CARD: 'Tarjeta Roja', WARNING: 'Amonestación',
};
const BRACKET_NOTE_LABELS = {
  ESPERANDO_PARTIDO_DE_IDA: 'Falta registrar el resultado del partido de ida para definir el global.',
  EMPATE_GLOBAL_SIN_DEFINIR: 'El global quedó empatado. Registra los penales para definir al ganador.',
};

const statusLabel = (v) => STATUS_LABELS[v] || v;
const eventTypeLabel = (v) => EVENT_TYPE_LABELS[v] || v;
const bracketNoteLabel = computed(() => BRACKET_NOTE_LABELS[bracketNote.value] || bracketNote.value);
const seriesLabel = (series) => (series ? `${series.club?.name ?? ''} — ${series.name}` : '');

const logisticsForm = reactive({ venue_id: '', referee_id: '', match_date: '', match_time: '', time_slot: '', observations: '' });
const resultForm = reactive({ home_score: null, away_score: null, home_penalty_score: null, away_penalty_score: null, status: 'FINISHED' });
const eventForm = reactive({ series_id: '', player_id: '', event_type: 'GOAL', minute: null });

const currentRoster = computed(() => rosterBySeries.value[eventForm.series_id] || []);

const fillFormsFromMatch = () => {
  if (!current.value) return;
  logisticsForm.venue_id = current.value.venue_id || '';
  logisticsForm.referee_id = current.value.referee_id || '';
  logisticsForm.match_date = current.value.match_date || '';
  logisticsForm.match_time = current.value.match_time || '';
  logisticsForm.time_slot = current.value.time_slot || '';
  logisticsForm.observations = current.value.observations || '';
  resultForm.home_score = current.value.home_score;
  resultForm.away_score = current.value.away_score;
  resultForm.home_penalty_score = current.value.home_penalty_score;
  resultForm.away_penalty_score = current.value.away_penalty_score;
  resultForm.status = current.value.status === 'SCHEDULED' ? 'FINISHED' : current.value.status;
};

const loadRoster = async (seriesId) => {
  if (!seriesId || rosterBySeries.value[seriesId]) return;
  try {
    const response = await getSeriesRoster(seriesId);
    const rosterItems = response.data?.data?.roster ?? [];
    rosterBySeries.value = {
      ...rosterBySeries.value,
      [seriesId]: rosterItems
        .filter((item) => item.player)
        .map((item) => ({ id: item.player.id, name: `${item.player.first_name} ${item.player.last_name}` })),
    };
  } catch (e) {
    rosterBySeries.value = { ...rosterBySeries.value, [seriesId]: [] };
  }
};

const onEventSeriesChange = () => {
  eventForm.player_id = '';
  loadRoster(eventForm.series_id);
};

const onSaveLogistics = async () => {
  try {
    const payload = { ...logisticsForm };
    if (!payload.venue_id) payload.venue_id = null;
    if (!payload.referee_id) payload.referee_id = null;
    await saveLogistics(matchId, payload);
    notifySuccess('Logística guardada exitosamente');
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al guardar logística');
  }
};

const onSaveResult = async () => {
  try {
    const data = await saveResult(matchId, resultForm);
    bracketNote.value = data.bracketNote || null;
    notifySuccess('Resultado del partido actualizado');
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al guardar resultado');
  }
};

const onAddEvent = async () => {
  try {
    await addEvent(matchId, { ...eventForm, player_id: eventForm.player_id || null });
    eventForm.player_id = '';
    eventForm.minute = null;
    notifySuccess('Evento registrado');
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al registrar evento');
  }
};

const onRemoveEvent = async (event) => {
  const ok = await confirm({
    title: '¿Eliminar evento?',
    message: `¿Estás seguro de eliminar este evento (${eventTypeLabel(event.event_type)})?`,
    confirmText: 'Eliminar',
    isDestructive: true,
  });
  if (!ok) return;
  try {
    await removeEvent(matchId, event.id);
    notifySuccess('Evento eliminado');
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al eliminar el evento');
  }
};

const goBack = () => router.back();

onMounted(async () => {
  await fetchMatchById(matchId);
  fillFormsFromMatch();
  await fetchEvents(matchId);

  const orgId = authStore.state.org?.id;
  const [venuesRes, refereesRes] = await Promise.all([
    getVenues({ org_id: orgId, limit: 200 }),
    getReferees({ org_id: orgId, limit: 200 }),
  ]);
  venues.value = venuesRes.data?.data?.venues ?? venuesRes.data?.data ?? [];
  referees.value = refereesRes.data?.data?.referees ?? refereesRes.data?.data ?? [];

  if (current.value?.home_series_id) loadRoster(current.value.home_series_id);
  if (current.value?.away_series_id) loadRoster(current.value.away_series_id);
});
</script>

<style scoped>
.folio-config-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }

.result-row { display: flex; align-items: flex-end; gap: 12px; justify-content: center; }
.result-vs { padding-bottom: 0.7rem; color: var(--text-muted); font-weight: 700; }

.event-row { display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap; }
.flex-1 { flex: 1; min-width: 200px; }

.py-lg { padding-top: var(--spacing-lg); padding-bottom: var(--spacing-lg); }
.btn-sm { padding: 0.4rem 0.8rem; font-size: 0.875rem; }

.alert-info { background: rgba(79, 195, 247, 0.12); color: #4fc3f7; border: 1px solid rgba(79, 195, 247, 0.3); border-radius: var(--radius-md, 8px); padding: 0.75rem 1rem; }

.status-badge {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0.2rem 0.6rem; border-radius: var(--radius-full);
  font-size: 0.75rem; font-weight: 700;
}
.status-badge--scheduled   { background: rgba(79, 195, 247, 0.16); color: #4fc3f7; }
.status-badge--in_progress { background: rgba(255, 213, 79, 0.16); color: #ffd54f; }
.status-badge--finished    { background: rgba(0, 230, 118, 0.14); color: var(--primary-solid, #00e676); }
.status-badge--postponed   { background: rgba(255, 255, 255, 0.08); color: var(--text-muted); }
.status-badge--walkover    { background: rgba(255, 255, 255, 0.08); color: var(--text-muted); }
.status-badge--cancelled   { background: rgba(239, 83, 80, 0.14); color: #ef5350; }
</style>
