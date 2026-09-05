<template>
  <div class="container mt-md">
    <div class="flex justify-between items-center mb-lg flex-wrap gap-md">
      <div class="flex items-center gap-md">
        <button class="btn btn-secondary btn-sm" @click="router.push(`/clubs/${clubId}/series`)">&larr; Club</button>
        <h2>Finanzas <span v-if="club"> — {{ club.name }}</span></h2>
      </div>
    </div>

    <div v-if="error" class="alert alert-error mb-md">{{ error }}</div>

    <PanoramaDashboard
      class="mb-lg"
      kicker="Resumen financiero del club"
      title-start="Panorama"
      title-accent="financiero"
      description="Estado de pago y movimientos de tu club en la liga."
      :tiles="financeTiles"
    />

    <div class="card p-0">
      <div class="flex justify-between items-center p-md flex-wrap gap-md" style="border-bottom: 1px solid var(--border-color);">
        <h3 class="m-0">Movimientos</h3>
        <select v-model="filters.category" @change="loadEntries" class="input" style="max-width: 200px;">
          <option :value="null">Todas las categorías</option>
          <option v-for="cat in CATEGORIES" :key="cat" :value="cat">{{ CATEGORY_LABELS[cat] }}</option>
        </select>
      </div>

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Serie</th>
              <th>Categoría</th>
              <th class="text-center">Dirección</th>
              <th class="text-right">Monto</th>
              <th class="text-right">Pagado</th>
              <th>Vence</th>
              <th class="text-center">Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="entriesLoading && entries.length === 0">
              <td colspan="7" class="text-center py-lg">Cargando...</td>
            </tr>
            <tr v-else-if="entries.length === 0">
              <td colspan="7" class="text-center py-lg">No hay movimientos para este filtro.</td>
            </tr>
            <tr v-for="entry in entries" :key="entry.id">
              <td>{{ entry.series?.name || '—' }}</td>
              <td>{{ CATEGORY_LABELS[entry.category] || entry.category }}</td>
              <td class="text-center">{{ entry.direction === 'INGRESO' ? 'Ingreso' : 'Egreso' }}</td>
              <td class="text-right">${{ formatMoney(entry.amount) }}</td>
              <td class="text-right">${{ formatMoney(entry.paid_amount) }}</td>
              <td>{{ entry.due_date || '—' }}</td>
              <td class="text-center">
                <span class="status-badge" :class="`status-badge--${entry.status?.toLowerCase()}`">
                  {{ STATUS_LABELS[entry.status] || entry.status }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile: tarjetas -->
      <div class="data-cards p-md">
        <p v-if="entriesLoading && entries.length === 0" class="text-center py-lg text-muted text-sm">Cargando...</p>
        <p v-else-if="entries.length === 0" class="text-center py-lg text-muted text-sm">No hay movimientos para este filtro.</p>
        <article v-for="entry in entries" :key="entry.id" class="data-card">
          <div class="data-card__header">
            <div class="data-card__heading">
              <div class="data-card__title">{{ entry.series?.name || 'Sin serie' }}</div>
              <div class="data-card__subtitle">{{ CATEGORY_LABELS[entry.category] || entry.category }}</div>
            </div>
            <span class="status-badge" :class="`status-badge--${entry.status?.toLowerCase()}`">
              {{ STATUS_LABELS[entry.status] || entry.status }}
            </span>
          </div>
          <div class="data-card__body">
            <div class="data-card__row">
              <span class="data-card__row-label">Dirección</span>
              <span class="data-card__row-value">{{ entry.direction === 'INGRESO' ? 'Ingreso' : 'Egreso' }}</span>
            </div>
            <div class="data-card__row">
              <span class="data-card__row-label">Monto / Pagado</span>
              <span class="data-card__row-value">${{ formatMoney(entry.amount) }} / ${{ formatMoney(entry.paid_amount) }}</span>
            </div>
            <div class="data-card__row">
              <span class="data-card__row-label">Vence</span>
              <span class="data-card__row-value">{{ entry.due_date || '—' }}</span>
            </div>
          </div>
        </article>
      </div>
    </div>

    <!-- ==================== Eventos ==================== -->
    <div class="card p-0 mt-lg">
      <div class="flex justify-between items-center p-md flex-wrap gap-md" style="border-bottom: 1px solid var(--border-color);">
        <h3 class="m-0">Eventos</h3>
        <button class="btn btn-primary btn-sm" @click="showNewEventForm = true">+ Nuevo evento</button>
      </div>

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Tipo</th>
              <th class="text-center">Dirección</th>
              <th>Fecha</th>
              <th class="text-right">Total</th>
              <th class="text-right">Pagado</th>
              <th class="text-center">Jugadores</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="eventsLoading && events.length === 0">
              <td colspan="8" class="text-center py-lg">Cargando...</td>
            </tr>
            <tr v-else-if="events.length === 0">
              <td colspan="8" class="text-center py-lg">Aún no hay eventos para este club.</td>
            </tr>
            <template v-for="ev in events" :key="ev.id">
              <tr class="clickable-row" @click="toggleEvent(ev)">
                <td>{{ ev.name }}</td>
                <td>{{ EVENT_TYPE_LABELS[ev.event_type] || ev.event_type }}</td>
                <td class="text-center">{{ ev.direction === 'INGRESO' ? 'Ingreso' : 'Egreso' }}</td>
                <td>{{ ev.event_date || '—' }}</td>
                <td class="text-right">${{ formatMoney(ev.total_amount) }}</td>
                <td class="text-right">${{ formatMoney(ev.total_paid) }}</td>
                <td class="text-center">{{ ev.players_count }}</td>
                <td @click.stop>
                  <ActionsMenu triggerLabel="Acciones del evento">
                    <button class="btn btn-sm btn-secondary" @click="toggleEvent(ev)">
                      {{ expandedEventId === ev.id ? 'Ocultar detalle' : 'Ver detalle' }}
                    </button>
                    <button class="btn btn-sm btn-danger" @click="confirmDeleteEvent(ev)">Eliminar</button>
                  </ActionsMenu>
                </td>
              </tr>
              <tr v-if="expandedEventId === ev.id">
                <td colspan="8" class="event-detail-cell">
                  <EventDetailPanel :event-id="ev.id" :club-id="clubId" @changed="loadEvents" />
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- Mobile: tarjetas -->
      <div class="data-cards p-md">
        <p v-if="eventsLoading && events.length === 0" class="text-center py-lg text-muted text-sm">Cargando...</p>
        <p v-else-if="events.length === 0" class="text-center py-lg text-muted text-sm">Aún no hay eventos para este club.</p>
        <article v-for="ev in events" :key="ev.id" class="data-card">
          <div class="data-card__header clickable-row" @click="toggleEvent(ev)">
            <div class="data-card__heading">
              <div class="data-card__title">{{ ev.name }}</div>
              <div class="data-card__subtitle">{{ EVENT_TYPE_LABELS[ev.event_type] || ev.event_type }} · {{ ev.event_date || 'sin fecha' }}</div>
            </div>
          </div>
          <div class="data-card__body">
            <div class="data-card__row">
              <span class="data-card__row-label">Dirección</span>
              <span class="data-card__row-value">{{ ev.direction === 'INGRESO' ? 'Ingreso' : 'Egreso' }}</span>
            </div>
            <div class="data-card__row">
              <span class="data-card__row-label">Total / Pagado</span>
              <span class="data-card__row-value">${{ formatMoney(ev.total_amount) }} / ${{ formatMoney(ev.total_paid) }}</span>
            </div>
            <div class="data-card__row">
              <span class="data-card__row-label">Jugadores</span>
              <span class="data-card__row-value">{{ ev.players_count }}</span>
            </div>
          </div>
          <div class="data-card__footer">
            <button class="btn btn-sm btn-secondary" @click="toggleEvent(ev)">
              {{ expandedEventId === ev.id ? 'Ocultar detalle' : 'Ver detalle' }}
            </button>
            <button class="btn btn-sm btn-danger" @click="confirmDeleteEvent(ev)">Eliminar</button>
          </div>
          <div v-if="expandedEventId === ev.id" class="data-card__subrows" @click.stop>
            <EventDetailPanel :event-id="ev.id" :club-id="clubId" @changed="loadEvents" />
          </div>
        </article>
      </div>
    </div>

    <EventFormModal
      :open="showNewEventForm"
      :saving="creatingEvent"
      @close="showNewEventForm = false"
      @submit="submitNewEvent"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getClubById } from '../services/clubs.service.js';
import { getLedgerEntries, getClubPaymentStatus, createClubEvent, listClubEvents, deleteClubEvent } from '../services/clubFinance.service.js';
import { useNotifyStore } from '../stores/notify';
import PanoramaDashboard from '../components/PanoramaDashboard.vue';
import ActionsMenu from '../components/ActionsMenu.vue';
import EventFormModal from '../components/EventFormModal.vue';
import EventDetailPanel from '../components/EventDetailPanel.vue';

const { notifySuccess, notifyError, confirm } = useNotifyStore();

const route = useRoute();
const router = useRouter();
const clubId = route.params.clubId;

const club = ref(null);
const error = ref(null);

const CATEGORIES = ['INSCRIPCION', 'FECHA', 'MULTA', 'OTRO', 'VALOR'];
const CATEGORY_LABELS = {
  INSCRIPCION: 'Inscripción', FECHA: 'Fecha', MULTA: 'Multa', OTRO: 'Otro', VALOR: 'Valor',
};
const STATUS_LABELS = {
  PENDIENTE: 'Pendiente', PARCIAL: 'Parcial', PAGADO: 'Pagado', VENCIDO: 'Vencido',
};
const CLUB_STATUS_LABELS = { AL_DIA: 'Al día', PENDIENTE: 'Pendiente', MOROSO: 'Moroso' };
const EVENT_TYPE_LABELS = {
  FECHA_PARTIDO: 'Fecha de partido', COLECTA: 'Colecta', COMPRA_IMPLEMENTOS: 'Compra de implementos', OTRO: 'Otro',
};

const formatMoney = (v) => Math.round(Number(v) || 0).toLocaleString('es-CL');

// ── Movimientos (siempre acotados a este club — LIST_LEDGER_ENTRIES exige
// clubId o isOrgAdmin, ver club_finance_specialist.js) ─────────────────────
const entries = ref([]);
const entriesLoading = ref(false);
const filters = reactive({ category: null });

const loadEntries = async () => {
  entriesLoading.value = true;
  try {
    const params = { club_id: clubId };
    if (filters.category) params.category = filters.category;
    const res = await getLedgerEntries(params);
    entries.value = res.data?.data?.entries ?? res.data?.entries ?? [];
  } catch (e) {
    error.value = e.response?.data?.error?.message || 'Error al cargar los movimientos';
  } finally {
    entriesLoading.value = false;
  }
};

// ── Panorama financiero del club ───────────────────────────────────────────
const icons = {
  checkCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  dollar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  alertTriangle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
};

const STATUS_TILE_COLOR = { AL_DIA: 'green', PENDIENTE: 'gold', MOROSO: 'red' };
const paymentStatus = ref(null);

const financeTiles = computed(() => [
  {
    key: 'status', label: 'Estado actual', color: STATUS_TILE_COLOR[paymentStatus.value?.status] || 'blue',
    icon: paymentStatus.value?.status === 'MOROSO' ? icons.alertTriangle : icons.checkCircle,
    value: CLUB_STATUS_LABELS[paymentStatus.value?.status] || '—',
  },
  { key: 'charged', label: 'Total cobrado', value: `$${formatMoney(paymentStatus.value?.total_charged)}`, color: 'blue', icon: icons.dollar },
  { key: 'paid', label: 'Total pagado', value: `$${formatMoney(paymentStatus.value?.total_paid)}`, color: 'green', icon: icons.checkCircle },
  { key: 'pending', label: 'Total pendiente', value: `$${formatMoney(paymentStatus.value?.total_pending)}`, meta: paymentStatus.value?.overdue_amount > 0 ? `$${formatMoney(paymentStatus.value.overdue_amount)} vencido` : undefined, color: 'gold', icon: icons.clock },
]);

const loadPaymentStatus = async () => {
  try {
    const res = await getClubPaymentStatus(clubId);
    paymentStatus.value = res.data?.data?.status ?? res.data?.status ?? null;
  } catch (e) {
    console.error('[ClubFinanceView] getClubPaymentStatus error:', e);
  }
};

// ── Eventos de club (fecha de partido, colecta, compra de implementos) ─────
const events = ref([]);
const eventsLoading = ref(false);
const showNewEventForm = ref(false);
const creatingEvent = ref(false);
const expandedEventId = ref(null);

const loadEvents = async () => {
  eventsLoading.value = true;
  try {
    const res = await listClubEvents(clubId, { org_id: club.value?.org_id });
    events.value = res.data?.data?.events ?? [];
  } catch (e) {
    error.value = e.response?.data?.error?.message || 'Error al cargar los eventos';
  } finally {
    eventsLoading.value = false;
  }
};

const toggleEvent = (ev) => {
  expandedEventId.value = expandedEventId.value === ev.id ? null : ev.id;
};

const submitNewEvent = async (payload) => {
  creatingEvent.value = true;
  try {
    await createClubEvent(clubId, { org_id: club.value?.org_id, ...payload });
    showNewEventForm.value = false;
    notifySuccess('Evento creado correctamente');
    await loadEvents();
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al crear el evento');
  } finally {
    creatingEvent.value = false;
  }
};

const confirmDeleteEvent = async (ev) => {
  const ok = await confirm({
    title: 'Eliminar evento',
    message: `¿Eliminar el evento "${ev.name}"? Esta acción no se puede deshacer.`,
    isDestructive: true,
  });
  if (!ok) return;
  try {
    await deleteClubEvent(ev.id);
    notifySuccess('Evento eliminado correctamente');
    if (expandedEventId.value === ev.id) expandedEventId.value = null;
    await loadEvents();
  } catch (e) {
    const code = e.response?.data?.error?.code;
    const message = e.response?.data?.error?.message || 'Error al eliminar el evento';
    // EVENT_HAS_PAID_CHARGES: el backend rechaza el borrado si algún cobro ya
    // tiene pagos registrados — se muestra el mensaje del backend tal cual,
    // sin intentar forzar el borrado.
    notifyError(message, code === 'EVENT_HAS_PAID_CHARGES' ? 'No se puede eliminar el evento' : 'Ocurrió un error');
  }
};

onMounted(async () => {
  try {
    const clubRes = await getClubById(clubId);
    club.value = clubRes.data?.data?.club ?? null;
  } catch (e) {
    console.error('[ClubFinanceView] getClubById error:', e);
  }
  await Promise.allSettled([loadEntries(), loadPaymentStatus(), loadEvents()]);
});
</script>

<style scoped>
.p-0 { padding: 0 !important; }
.py-lg { padding-top: var(--spacing-lg); padding-bottom: var(--spacing-lg); }
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
.status-badge--pendiente { background: rgba(79, 195, 247, 0.16); color: #4fc3f7; }
.status-badge--parcial   { background: rgba(255, 213, 79, 0.16); color: #ffd54f; }
.status-badge--pagado    { background: rgba(0, 230, 118, 0.14); color: var(--primary-solid, #00e676); }
.status-badge--vencido   { background: rgba(239, 83, 80, 0.14); color: #ef5350; }

.clickable-row { cursor: pointer; }
.clickable-row:hover { background: var(--bg-hover, rgba(255,255,255,0.03)); }
.event-detail-cell { padding: 0; background: var(--bg-hover, rgba(255,255,255,0.02)); }
</style>
