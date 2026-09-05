<template>
  <div class="event-detail p-md">
    <p v-if="loading" class="text-center py-md text-muted text-sm">Cargando detalle del evento...</p>
    <template v-else-if="eventDetail">
      <p v-if="eventDetail.event?.description" class="text-sm text-muted mb-md">{{ eventDetail.event.description }}</p>

      <h4 class="event-detail__subtitle">Jugadores del evento</h4>
      <p v-if="!eventDetail.charges || eventDetail.charges.length === 0" class="text-sm text-muted mb-md">
        Aún no se han agregado jugadores a este evento.
      </p>
      <div v-else class="event-detail__charges">
        <article v-for="charge in eventDetail.charges" :key="charge.id" class="event-charge-card">
          <div class="event-charge-card__header">
            <div>
              <div class="font-bold">{{ charge.player?.first_name }} {{ charge.player?.last_name }}</div>
              <div class="text-muted text-sm">{{ charge.player?.rut || 'Sin RUT' }}</div>
            </div>
            <span class="status-badge" :class="`status-badge--${charge.status?.toLowerCase()}`">
              {{ STATUS_LABELS[charge.status] || charge.status }}
            </span>
          </div>
          <div class="data-card__row">
            <span class="data-card__row-label">Monto / Pagado</span>
            <span class="data-card__row-value">${{ formatMoney(charge.amount) }} / ${{ formatMoney(charge.paid_amount) }}</span>
          </div>
          <div v-if="charge.status !== 'PAGADO'" class="flex justify-end mt-sm">
            <button class="btn btn-sm btn-secondary" :disabled="payingChargeId === charge.id" @click="openChargePaymentPrompt(charge)">
              Registrar pago
            </button>
          </div>
        </article>
      </div>

      <h4 class="event-detail__subtitle">Agregar jugadores de la plantilla</h4>
      <p v-if="pickerRows.length === 0" class="text-sm text-muted mb-md">
        Todos los jugadores activos de la plantilla ya fueron agregados a este evento.
      </p>
      <template v-else>
        <div class="event-detail__default-amount">
          <label class="label" for="picker-default-amount">Monto sugerido</label>
          <div class="flex gap-sm items-center flex-wrap">
            <input id="picker-default-amount" v-model.number="pickerDefaultAmount" type="number" min="0" class="input" style="max-width: 160px;" />
            <button type="button" class="btn btn-secondary btn-sm" @click="applyDefaultAmount">Aplicar a marcados</button>
          </div>
        </div>
        <div class="event-detail__picker-list">
          <label v-for="row in pickerRows" :key="row.player_id" class="event-detail__picker-row">
            <input type="checkbox" v-model="row.checked" class="event-detail__picker-checkbox" />
            <span class="event-detail__picker-name">
              {{ row.first_name }} {{ row.last_name }}
              <span class="text-muted text-sm">({{ row.rut || 'sin RUT' }})</span>
            </span>
            <input v-model.number="row.amount" type="number" min="0" class="input event-detail__picker-amount" :disabled="!row.checked" />
          </label>
        </div>
        <div class="flex justify-end mt-md">
          <button class="btn btn-primary btn-sm" :disabled="addingPlayers" @click="submitAddPlayers">
            {{ addingPlayers ? 'Guardando…' : 'Agregar jugadores seleccionados' }}
          </button>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { getEventDetail, setEventPlayers, recordEventPlayerPayment } from '../services/clubFinance.service.js';
import { listPlayersByClub } from '../services/players.service.js';
import { useNotifyStore } from '../stores/notify';

const props = defineProps({
  eventId: { type: [String, Number], required: true },
  clubId: { type: [String, Number], required: true },
});
const emit = defineEmits(['changed']);

const { notifySuccess, notifyError, prompt } = useNotifyStore();

const STATUS_LABELS = { PENDIENTE: 'Pendiente', PARCIAL: 'Parcial', PAGADO: 'Pagado', VENCIDO: 'Vencido' };
const formatMoney = (v) => Math.round(Number(v) || 0).toLocaleString('es-CL');

const loading = ref(true);
const eventDetail = ref(null);
const pickerRows = ref([]);
const pickerDefaultAmount = ref(0);
const addingPlayers = ref(false);
const payingChargeId = ref(null);

const buildPickerRows = (rosterRows) => {
  const chargedIds = new Set((eventDetail.value?.charges ?? []).map((c) => c.player_id));
  pickerRows.value = rosterRows
    .filter((r) => !chargedIds.has(r.player_id))
    .map((r) => ({ ...r, checked: false, amount: pickerDefaultAmount.value || 0 }));
};

const load = async () => {
  loading.value = true;
  try {
    const [detailRes, rosterRes] = await Promise.all([
      getEventDetail(props.eventId),
      listPlayersByClub(props.clubId, { status: 'ACTIVE', limit: 200 }),
    ]);
    eventDetail.value = detailRes.data?.data ?? null;
    const rosterRows = (rosterRes.data?.data?.data ?? [])
      .map((row) => ({
        player_id: row.player_id ?? row.player?.id ?? null,
        first_name: row.player?.first_name ?? '',
        last_name: row.player?.last_name ?? '',
        rut: row.player?.rut ?? null,
      }))
      .filter((r) => r.player_id);
    buildPickerRows(rosterRows);
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al cargar el detalle del evento');
  } finally {
    loading.value = false;
  }
};

const applyDefaultAmount = () => {
  pickerRows.value.forEach((row) => { if (row.checked) row.amount = pickerDefaultAmount.value; });
};

const submitAddPlayers = async () => {
  const charges = pickerRows.value
    .filter((row) => row.checked)
    .map((row) => ({ playerId: row.player_id, amount: Number(row.amount) || 0 }));
  if (charges.length === 0) {
    notifyError('Selecciona al menos un jugador para agregar al evento');
    return;
  }
  addingPlayers.value = true;
  try {
    await setEventPlayers(props.eventId, { charges });
    notifySuccess('Jugadores agregados al evento');
    await load();
    emit('changed');
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al agregar jugadores al evento');
  } finally {
    addingPlayers.value = false;
  }
};

const openChargePaymentPrompt = async (charge) => {
  const pending = Number(charge.amount) - Number(charge.paid_amount || 0);
  const input = await prompt({
    title: 'Registrar pago',
    message: `${charge.player?.first_name ?? ''} ${charge.player?.last_name ?? ''} — pendiente: $${formatMoney(pending)}`,
    defaultValue: pending > 0 ? pending : '',
    inputType: 'number',
    placeholder: 'Ingresa el monto a abonar',
    confirmText: 'Registrar Pago',
  });
  if (input === null || input === '') return;
  const amount = Number(input);
  if (!amount || amount <= 0) {
    notifyError('Monto inválido');
    return;
  }
  payingChargeId.value = charge.id;
  try {
    await recordEventPlayerPayment(props.eventId, charge.id, { amount });
    notifySuccess('Pago registrado correctamente');
    await load();
    emit('changed');
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al registrar el pago');
  } finally {
    payingChargeId.value = null;
  }
};

onMounted(load);
</script>

<style scoped>
.event-detail__subtitle {
  margin: 1rem 0 0.6rem;
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--text-primary);
}
.event-detail__subtitle:first-of-type { margin-top: 0; }

.event-detail__charges {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-bottom: 1rem;
}

.event-charge-card {
  padding: 0.75rem 1rem;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}
.event-charge-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.event-detail__default-amount { margin-bottom: 0.75rem; }

.event-detail__picker-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-height: 280px;
  overflow-y: auto;
  padding: 0.25rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

.event-detail__picker-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.4rem 0.5rem;
  border-radius: var(--radius-sm, 6px);
  cursor: pointer;
}
.event-detail__picker-row:hover { background: var(--bg-hover, rgba(255,255,255,0.03)); }

.event-detail__picker-checkbox {
  width: 20px;
  height: 20px;
  min-width: 20px;
  accent-color: var(--primary-solid);
}

.event-detail__picker-name { flex: 1; min-width: 0; overflow-wrap: anywhere; }

.event-detail__picker-amount { max-width: 120px; }

.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
}
.status-badge--pendiente { background: rgba(79, 195, 247, 0.16); color: #4fc3f7; }
.status-badge--parcial   { background: rgba(255, 213, 79, 0.16); color: #ffd54f; }
.status-badge--pagado    { background: rgba(0, 230, 118, 0.14); color: var(--primary-solid, #00e676); }
.status-badge--vencido   { background: rgba(239, 83, 80, 0.14); color: #ef5350; }
</style>
