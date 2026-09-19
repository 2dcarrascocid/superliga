<template>
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
      <div class="input-group" style="max-width: 220px;">
        <label class="label">Castigo</label>
        <select v-model="eventForm.penalty_id" class="input">
          <option value="">Sin castigo asociado</option>
          <option v-for="p in activePenalties" :key="p.id" :value="p.id">{{ p.name }} — {{ formatCurrency(p.amount) }}</option>
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
            <th>Costo</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="events.length === 0">
            <td colspan="7" class="text-center py-lg">Sin eventos registrados.</td>
          </tr>
          <tr v-for="event in events" :key="event.id">
            <td>{{ event.minute ?? '—' }}'</td>
            <td>{{ seriesLabel(event.series) || '—' }}</td>
            <td>{{ event.player ? `${event.player.first_name} ${event.player.last_name}` : '—' }}</td>
            <td>{{ eventTypeLabel(event.event_type) }}</td>
            <td>{{ event.notes || '—' }}</td>
            <td>{{ event.penalty ? formatCurrency(event.penalty.amount) : '—' }}</td>
            <td><button class="btn btn-sm btn-danger" @click="onRemoveEvent(event)">Eliminar</button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Mobile: tarjetas -->
    <div class="data-cards mt-md">
      <p v-if="events.length === 0" class="text-center py-lg text-muted text-sm">Sin eventos registrados.</p>
      <article v-for="event in events" :key="event.id" class="data-card">
        <div class="data-card__header">
          <div class="data-card__heading">
            <div class="data-card__title">{{ event.minute ?? '—' }}' · {{ eventTypeLabel(event.event_type) }}</div>
            <div class="data-card__subtitle">{{ seriesLabel(event.series) || '—' }} · {{ event.player ? `${event.player.first_name} ${event.player.last_name}` : 'Sin jugador' }}</div>
          </div>
        </div>
        <div class="data-card__body" v-if="event.notes || event.penalty">
          <div class="data-card__row" v-if="event.notes">
            <span class="data-card__row-label">Notas</span>
            <span class="data-card__row-value">{{ event.notes }}</span>
          </div>
          <div class="data-card__row" v-if="event.penalty">
            <span class="data-card__row-label">Costo</span>
            <span class="data-card__row-value">{{ formatCurrency(event.penalty.amount) }}</span>
          </div>
        </div>
        <div class="data-card__footer">
          <button class="btn btn-sm btn-danger" @click="onRemoveEvent(event)">Eliminar</button>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive } from 'vue';
import { useMatchesStore } from '../stores/matches';
import { useNotifyStore } from '../stores/notify';
import { useAuthStore } from '../stores/auth';
import { usePenaltyCatalogStore } from '../stores/penaltyCatalog';
import { createLedgerEntry } from '../services/clubFinance.service';

const props = defineProps({
  matchId: { type: String, required: true },
  rosterBySeries: { type: Object, default: () => ({}) },
});

const emit = defineEmits(['request-roster']);

const { current, events, addEvent, removeEvent } = useMatchesStore();
const { confirm, notifySuccess, notifyError } = useNotifyStore();
const authStore = useAuthStore();
const penaltyCatalogStore = usePenaltyCatalogStore();

const orgId = computed(() => authStore.state.org?.id);

const EVENT_TYPE_LABELS = {
  GOAL: 'Gol', OWN_GOAL: 'Autogol', YELLOW_CARD: 'Tarjeta Amarilla', RED_CARD: 'Tarjeta Roja', WARNING: 'Amonestación',
};

const eventTypeLabel = (v) => EVENT_TYPE_LABELS[v] || v;
const seriesLabel = (series) => (series ? `${series.club?.name ?? ''} — ${series.name}` : '');

const formatCurrency = (amount) => {
  const num = parseFloat(amount || 0);
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(num);
};

const eventForm = reactive({ series_id: '', player_id: '', event_type: 'GOAL', minute: null, penalty_id: '' });

const currentRoster = computed(() => props.rosterBySeries[eventForm.series_id] || []);
const activePenalties = computed(() => (penaltyCatalogStore.state.items || []).filter((p) => p.active !== false));

const onEventSeriesChange = () => {
  eventForm.player_id = '';
  emit('request-roster', eventForm.series_id);
};

const resolveClubId = (seriesId) => {
  if (current?.home_series_id === seriesId) return current?.home_series?.club?.id ?? null;
  if (current?.away_series_id === seriesId) return current?.away_series?.club?.id ?? null;
  return null;
};

const onAddEvent = async () => {
  try {
    await addEvent(props.matchId, {
      ...eventForm,
      player_id: eventForm.player_id || null,
      penalty_id: eventForm.penalty_id || null,
    });

    let chargeCreated = false;
    if (eventForm.penalty_id) {
      const penalty = (penaltyCatalogStore.state.items || []).find((p) => p.id === eventForm.penalty_id);
      const clubId = resolveClubId(eventForm.series_id);
      if (penalty && clubId && orgId.value) {
        try {
          const player = currentRoster.value.find((p) => p.id === eventForm.player_id);
          await createLedgerEntry({
            org_id: orgId.value,
            club_id: clubId,
            tournament_id: current?.tournament_id ?? null,
            category: 'MULTA',
            direction: 'INGRESO',
            amount: penalty.amount,
            description: `${penalty.code} - ${penalty.name}${player ? ` · ${player.name}` : ''}`,
            match_id: props.matchId,
          });
          chargeCreated = true;
        } catch (chargeError) {
          notifyError('Evento registrado, pero no se pudo generar el cobro asociado');
        }
      }
    }

    eventForm.player_id = '';
    eventForm.minute = null;
    eventForm.penalty_id = '';
    notifySuccess(chargeCreated ? 'Evento registrado y cobro generado' : 'Evento registrado');
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
    await removeEvent(props.matchId, event.id);
    notifySuccess('Evento eliminado');
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al eliminar el evento');
  }
};

onMounted(() => {
  if (orgId.value) {
    penaltyCatalogStore.fetchPenalties(orgId.value);
  }
});
</script>

<style scoped>
.event-row { display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap; }
.py-lg { padding-top: var(--spacing-lg); padding-bottom: var(--spacing-lg); }
</style>
