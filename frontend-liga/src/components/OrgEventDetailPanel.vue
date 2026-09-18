<template>
  <div class="org-event-detail p-md">
    <p v-if="loading" class="text-center py-md text-muted text-sm">Cargando detalle del evento...</p>
    <template v-else-if="detail">
      <p v-if="detail.orgEvent?.description" class="text-sm text-muted mb-md">{{ detail.orgEvent.description }}</p>

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Club</th>
              <th class="text-center">Estado</th>
              <th class="text-right">Monto</th>
              <th class="text-right">Pagado</th>
              <th>Motivo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!detail.charges || detail.charges.length === 0">
              <td colspan="6" class="text-center py-lg">No hay clubes asociados a este evento.</td>
            </tr>
            <tr v-for="charge in detail.charges" :key="charge.id">
              <td>{{ charge.club?.name || '—' }}</td>
              <td class="text-center">
                <span class="status-badge" :class="`status-badge--${charge.status?.toLowerCase()}`">
                  {{ STATUS_LABELS[charge.status] || charge.status }}
                </span>
              </td>
              <td class="text-right">${{ formatMoney(charge.amount) }}</td>
              <td class="text-right">${{ formatMoney(charge.paid_amount) }}</td>
              <td class="text-sm text-muted">{{ charge.is_exempt ? (charge.exempt_reason || 'Exento') : '—' }}</td>
              <td @click.stop>
                <ActionsMenu v-if="!closed" triggerLabel="Acciones del club">
                  <button v-if="!charge.is_exempt && charge.status !== 'PAGADO'" class="btn btn-sm btn-secondary" @click="openPaymentModal(charge)">
                    Pagar
                  </button>
                  <button v-if="!charge.is_exempt" class="btn btn-sm btn-secondary" :disabled="busyChargeId === charge.id" @click="markExempt(charge)">
                    Marcar exento
                  </button>
                  <button v-else class="btn btn-sm btn-secondary" :disabled="busyChargeId === charge.id" @click="clearExempt(charge)">
                    Quitar exención
                  </button>
                </ActionsMenu>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile: tarjetas -->
      <div class="data-cards">
        <p v-if="!detail.charges || detail.charges.length === 0" class="text-center py-lg text-muted text-sm">No hay clubes asociados a este evento.</p>
        <article v-for="charge in detail.charges" :key="charge.id" class="data-card">
          <div class="data-card__header">
            <div class="data-card__heading">
              <div class="data-card__title">{{ charge.club?.name || '—' }}</div>
              <div v-if="charge.is_exempt" class="data-card__subtitle">{{ charge.exempt_reason || 'Exento' }}</div>
            </div>
            <span class="status-badge" :class="`status-badge--${charge.status?.toLowerCase()}`">
              {{ STATUS_LABELS[charge.status] || charge.status }}
            </span>
          </div>
          <div class="data-card__body">
            <div class="data-card__row">
              <span class="data-card__row-label">Monto / Pagado</span>
              <span class="data-card__row-value">${{ formatMoney(charge.amount) }} / ${{ formatMoney(charge.paid_amount) }}</span>
            </div>
          </div>
          <div v-if="!closed" class="data-card__footer">
            <button v-if="!charge.is_exempt && charge.status !== 'PAGADO'" class="btn btn-sm btn-secondary" @click="openPaymentModal(charge)">Pagar</button>
            <button v-if="!charge.is_exempt" class="btn btn-sm btn-secondary" :disabled="busyChargeId === charge.id" @click="markExempt(charge)">Marcar exento</button>
            <button v-else class="btn btn-sm btn-secondary" :disabled="busyChargeId === charge.id" @click="clearExempt(charge)">Quitar exención</button>
          </div>
        </article>
      </div>
    </template>

    <OrgEventPaymentModal
      :open="showPaymentModal"
      :saving="payingChargeId !== null"
      :club-name="paymentTarget?.club?.name || ''"
      :pending-amount="paymentPending"
      @close="showPaymentModal = false"
      @submit="submitPayment"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { getOrgEventDetail, setClubExempt, recordOrgEventClubPayment } from '../services/clubFinance.service.js';
import { useNotifyStore } from '../stores/notify';
import ActionsMenu from './ActionsMenu.vue';
import OrgEventPaymentModal from './OrgEventPaymentModal.vue';

const props = defineProps({
  eventId: { type: [String, Number], required: true },
});
const emit = defineEmits(['changed']);

const { notifySuccess, notifyError, prompt, confirm } = useNotifyStore();

const STATUS_LABELS = { PENDIENTE: 'Pendiente', PARCIAL: 'Parcial', PAGADO: 'Pagado', VENCIDO: 'Vencido', EXENTO: 'Exento' };
const formatMoney = (v) => Math.round(Number(v) || 0).toLocaleString('es-CL');

const loading = ref(true);
const detail = ref(null);
const busyChargeId = ref(null);

const closed = computed(() => detail.value?.orgEvent?.status === 'CERRADO');

const load = async () => {
  loading.value = true;
  try {
    const res = await getOrgEventDetail(props.eventId);
    detail.value = res.data?.data ?? null;
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al cargar el detalle del evento');
  } finally {
    loading.value = false;
  }
};

// ── Pagos ────────────────────────────────────────────────────────────────
const showPaymentModal = ref(false);
const paymentTarget = ref(null);
const payingChargeId = ref(null);
const paymentPending = computed(() => {
  if (!paymentTarget.value) return 0;
  return Number(paymentTarget.value.amount) - Number(paymentTarget.value.paid_amount || 0);
});

const openPaymentModal = (charge) => {
  paymentTarget.value = charge;
  showPaymentModal.value = true;
};

const submitPayment = async ({ amount, payment_method }) => {
  if (!amount || amount <= 0) {
    notifyError('Monto inválido');
    return;
  }
  payingChargeId.value = paymentTarget.value.id;
  try {
    await recordOrgEventClubPayment(props.eventId, paymentTarget.value.id, { amount, payment_method });
    notifySuccess('Pago registrado correctamente');
    showPaymentModal.value = false;
    await load();
    emit('changed');
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al registrar el pago');
  } finally {
    payingChargeId.value = null;
  }
};

// ── Exención ─────────────────────────────────────────────────────────────
const markExempt = async (charge) => {
  const reason = await prompt({
    title: 'Marcar club exento',
    message: `Motivo de la exención para ${charge.club?.name || 'el club'}`,
    inputType: 'text',
    placeholder: 'Ej: club de reciente ingreso, acuerdo especial, etc.',
    confirmText: 'Marcar exento',
  });
  if (reason === null) return;
  busyChargeId.value = charge.id;
  try {
    await setClubExempt(props.eventId, charge.club_id, { is_exempt: true, exempt_reason: reason || null });
    notifySuccess('Club marcado como exento');
    await load();
    emit('changed');
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al marcar el club como exento');
  } finally {
    busyChargeId.value = null;
  }
};

const clearExempt = async (charge) => {
  const ok = await confirm({
    title: 'Quitar exención',
    message: `¿Quitar la exención de ${charge.club?.name || 'este club'}? Volverá a quedar con el cobro pendiente.`,
  });
  if (!ok) return;
  busyChargeId.value = charge.id;
  try {
    await setClubExempt(props.eventId, charge.club_id, { is_exempt: false });
    notifySuccess('Exención removida');
    await load();
    emit('changed');
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al quitar la exención');
  } finally {
    busyChargeId.value = null;
  }
};

onMounted(load);
</script>

<style scoped>
.p-0 { padding: 0 !important; }
.py-lg { padding-top: var(--spacing-lg); padding-bottom: var(--spacing-lg); }
.text-right { text-align: right; }
.btn-sm { padding: 0.4rem 0.8rem; font-size: 0.875rem; }

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
.status-badge--exento    { background: rgba(158, 158, 158, 0.18); color: #9e9e9e; }
</style>
