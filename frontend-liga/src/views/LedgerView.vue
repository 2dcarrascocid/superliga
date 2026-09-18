<template>
  <div class="container mt-md">
    <div class="flex justify-between items-center mb-lg">
      <h2>Finanzas</h2>
    </div>

    <div v-if="error" class="alert alert-error mb-md">{{ error }}</div>

    <PanoramaDashboard
      class="mb-lg"
      kicker="Resumen financiero"
      title-start="Panorama"
      title-accent="financiero"
      description="Estado de pago de los clubes de la liga."
      :sub-tabs="ledgerTabs"
      :active-sub-tab="activeTab"
      @sub-tab-change="activeTab = $event"
      :tiles="financeTiles"
      :selected-key="selectedFinanceTile"
      @select="selectFinanceTile"
    />

    <LoadingState :loading="pageLoading" message="Cargando finanzas...">

    <!-- TAB: Movimientos -->
    <div v-if="activeTab === 'movements'">
      <div class="card mb-lg">
        <div class="flex justify-between items-center mb-md flex-wrap gap-md">
          <h3 class="m-0">Libro de ingresos y egresos</h3>
          <button class="btn btn-primary" @click="showNewEntryForm = !showNewEntryForm">
            {{ showNewEntryForm ? 'Cancelar' : '+ Nuevo movimiento' }}
          </button>
        </div>

        <!-- Filtros -->
        <div class="flex gap-md mb-md flex-wrap items-center">
          <select v-model="filters.club_id" @change="loadEntries" class="input" style="max-width: 220px;">
            <option :value="null">Todos los clubes</option>
            <option v-for="c in clubs" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
          <select v-model="filters.category" @change="loadEntries" class="input" style="max-width: 200px;">
            <option :value="null">Todas las categorías</option>
            <option v-for="cat in CATEGORIES" :key="cat" :value="cat">{{ CATEGORY_LABELS[cat] }}</option>
          </select>
        </div>

        <!-- Alta manual -->
        <div v-if="showNewEntryForm" class="new-entry-form mb-md">
          <div class="form-row-3">
            <div class="input-group">
              <label class="label">Club *</label>
              <select v-model="newEntry.club_id" @change="loadSeriesForNewEntry" class="input" required>
                <option :value="null" disabled>Seleccione...</option>
                <option v-for="c in clubs" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </div>
            <div class="input-group">
              <label class="label">Serie (opcional)</label>
              <select v-model="newEntry.series_id" class="input">
                <option :value="null">Sin serie específica</option>
                <option v-for="s in newEntrySeries" :key="s.id" :value="s.id">{{ s.name }}</option>
              </select>
            </div>
            <div class="input-group">
              <label class="label">Categoría *</label>
              <select v-model="newEntry.category" class="input" required>
                <option value="MULTA">Multa</option>
                <option value="OTRO">Otro</option>
                <option value="VALOR">Valor (ajuste de saldo)</option>
              </select>
            </div>
          </div>
          <div class="form-row-3">
            <div class="input-group">
              <label class="label">Dirección *</label>
              <select v-model="newEntry.direction" class="input" required>
                <option value="INGRESO">Ingreso (el club debe)</option>
                <option value="EGRESO">Egreso (se le debe al club)</option>
              </select>
            </div>
            <div class="input-group">
              <label class="label">Monto *</label>
              <input v-model.number="newEntry.amount" type="number" min="0" class="input" required />
            </div>
            <div class="input-group">
              <label class="label">Vence</label>
              <input v-model="newEntry.due_date" type="date" class="input" />
            </div>
          </div>
          <div class="input-group">
            <label class="label">Descripción</label>
            <input v-model="newEntry.description" class="input" placeholder="Ej: Multa por atraso en fecha 3" />
          </div>
          <div class="flex justify-end mt-sm">
            <button class="btn btn-primary btn-sm" :disabled="creatingEntry" @click="submitNewEntry">
              {{ creatingEntry ? 'Guardando...' : 'Guardar movimiento' }}
            </button>
          </div>
        </div>

        <!-- Tabla -->
        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Club</th>
                <th>Serie</th>
                <th>Categoría</th>
                <th class="text-center">Dirección</th>
                <th class="text-right">Monto</th>
                <th class="text-right">Pagado</th>
                <th>Vence</th>
                <th class="text-center">Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="entriesLoading && entries.length === 0">
                <td colspan="9" class="text-center py-lg">Cargando...</td>
              </tr>
              <tr v-else-if="entries.length === 0">
                <td colspan="9" class="text-center py-lg">No hay movimientos para este filtro.</td>
              </tr>
              <tr v-for="entry in entries" :key="entry.id">
                <td>{{ entry.club?.name || '—' }}</td>
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
                <td>
                  <ActionsMenu v-if="entry.status !== 'PAGADO'">
                    <button
                      class="btn btn-sm btn-secondary"
                      @click="openPaymentPrompt(entry)"
                    >
                      Registrar pago
                    </button>
                  </ActionsMenu>
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
                <div class="data-card__title">{{ entry.club?.name || '—' }}</div>
                <div class="data-card__subtitle">{{ entry.series?.name || 'Sin serie' }} · {{ CATEGORY_LABELS[entry.category] || entry.category }}</div>
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
            <div class="data-card__footer" v-if="entry.status !== 'PAGADO'">
              <ActionsMenu>
                <button class="btn btn-sm btn-secondary" @click="openPaymentPrompt(entry)">Registrar pago</button>
              </ActionsMenu>
            </div>
          </article>
        </div>
      </div>
    </div>

    <!-- TAB: Estadísticas -->
    <div v-if="activeTab === 'stats'">
      <div class="card p-0">
        <div class="flex justify-between items-center p-md" style="border-bottom: 1px solid var(--border-color);">
          <h3 class="m-0">Estado de pago por club — {{ selectedFinanceTileLabel }}</h3>
        </div>
        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Club</th>
                <th class="text-right">Cobrado</th>
                <th class="text-right">Pagado</th>
                <th class="text-right">Pendiente</th>
                <th class="text-right">Vencido</th>
                <th class="text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!stats || filteredByClub.length === 0">
                <td colspan="6" class="text-center py-lg">Sin datos para esta selección.</td>
              </tr>
              <template v-for="club in filteredByClub" :key="club.club_id">
                <tr class="clickable-row" @click="toggleClubExpand(club.club_id)">
                  <td><span class="font-medium">{{ club.club_name }}</span></td>
                  <td class="text-right">${{ formatMoney(club.total_charged) }}</td>
                  <td class="text-right">${{ formatMoney(club.total_paid) }}</td>
                  <td class="text-right">${{ formatMoney(club.total_pending) }}</td>
                  <td class="text-right">${{ formatMoney(club.overdue_amount) }}</td>
                  <td class="text-center">
                    <span class="status-badge" :class="`status-badge--club-${club.status?.toLowerCase()}`">
                      {{ CLUB_STATUS_LABELS[club.status] || club.status }}
                    </span>
                  </td>
                </tr>
                <template v-for="series in club.series" :key="`${club.club_id}-${series.series_id}`">
                  <tr v-if="expandedClubs.has(club.club_id)" class="series-row">
                    <td class="pl-lg text-muted text-sm">↳ {{ series.series_name || 'Sin serie' }}</td>
                    <td class="text-right text-sm">${{ formatMoney(series.total_charged) }}</td>
                    <td class="text-right text-sm">${{ formatMoney(series.total_paid) }}</td>
                    <td class="text-right text-sm">${{ formatMoney(series.total_pending) }}</td>
                    <td class="text-right text-sm">${{ formatMoney(series.overdue_amount) }}</td>
                    <td class="text-center">
                      <span class="status-badge status-badge--sm" :class="`status-badge--club-${series.status?.toLowerCase()}`">
                        {{ CLUB_STATUS_LABELS[series.status] || series.status }}
                      </span>
                    </td>
                  </tr>
                </template>
              </template>
            </tbody>
          </table>
        </div>

        <!-- Mobile: tarjetas -->
        <div class="data-cards p-md">
          <p v-if="!stats || filteredByClub.length === 0" class="text-center py-lg text-muted text-sm">Sin datos para esta selección.</p>
          <article v-for="club in filteredByClub" :key="club.club_id" class="data-card clickable-row" @click="toggleClubExpand(club.club_id)">
            <div class="data-card__header">
              <div class="data-card__heading">
                <div class="data-card__title">{{ club.club_name }}</div>
                <div class="data-card__subtitle">{{ expandedClubs.has(club.club_id) ? 'Ocultar series ▲' : 'Ver series ▼' }}</div>
              </div>
              <span class="status-badge" :class="`status-badge--club-${club.status?.toLowerCase()}`">
                {{ CLUB_STATUS_LABELS[club.status] || club.status }}
              </span>
            </div>
            <div class="data-card__body">
              <div class="data-card__row">
                <span class="data-card__row-label">Cobrado / Pagado</span>
                <span class="data-card__row-value">${{ formatMoney(club.total_charged) }} / ${{ formatMoney(club.total_paid) }}</span>
              </div>
              <div class="data-card__row">
                <span class="data-card__row-label">Pendiente / Vencido</span>
                <span class="data-card__row-value">${{ formatMoney(club.total_pending) }} / ${{ formatMoney(club.overdue_amount) }}</span>
              </div>
            </div>
            <div v-if="expandedClubs.has(club.club_id) && club.series?.length" class="data-card__subrows" @click.stop>
              <div v-for="series in club.series" :key="series.series_id" class="data-card__subrow">
                <div class="data-card__row">
                  <span class="data-card__row-label">↳ {{ series.series_name || 'Sin serie' }}</span>
                  <span class="status-badge status-badge--sm" :class="`status-badge--club-${series.status?.toLowerCase()}`">
                    {{ CLUB_STATUS_LABELS[series.status] || series.status }}
                  </span>
                </div>
                <div class="data-card__row">
                  <span class="data-card__row-label">Pend. / Venc.</span>
                  <span class="data-card__row-value">${{ formatMoney(series.total_pending) }} / ${{ formatMoney(series.overdue_amount) }}</span>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>

    <!-- TAB: Eventos de organización -->
    <div v-if="activeTab === 'org_events'">
      <div class="flex justify-between items-center mb-md flex-wrap gap-md">
        <h3 class="m-0">Eventos de organización</h3>
        <button class="btn btn-primary" @click="showNewOrgEventForm = true">+ Nuevo evento</button>
      </div>

      <p v-if="!orgEventsLoading && orgEvents.length === 0" class="text-center py-lg text-muted text-sm">
        Aún no hay eventos de organización creados.
      </p>
      <p v-else-if="orgEventsLoading && orgEvents.length === 0" class="text-center py-lg text-muted text-sm">Cargando...</p>

      <div class="org-events-grid">
        <article v-for="ev in orgEvents" :key="ev.id" class="card org-event-card">
          <div class="org-event-card__header clickable-row" @click="toggleOrgEvent(ev)">
            <div>
              <div class="org-event-card__title">{{ ev.name }}</div>
              <div class="text-muted text-sm">{{ ORG_EVENT_TYPE_LABELS[ev.event_type] || ev.event_type }} · {{ ev.start_date || '—' }}{{ ev.end_date ? ` a ${ev.end_date}` : '' }}</div>
            </div>
            <span class="status-badge" :class="`status-badge--org-${ev.status?.toLowerCase()}`">
              {{ ORG_EVENT_STATUS_LABELS[ev.status] || ev.status }}
            </span>
          </div>
          <div class="org-event-card__body">
            <div class="data-card__row">
              <span class="data-card__row-label">Costo por club</span>
              <span class="data-card__row-value">${{ formatMoney(ev.cost) }}</span>
            </div>
            <div class="data-card__row">
              <span class="data-card__row-label">Total / Pagado</span>
              <span class="data-card__row-value">${{ formatMoney(ev.total_amount) }} / ${{ formatMoney(ev.total_paid) }}</span>
            </div>
            <div class="data-card__row">
              <span class="data-card__row-label">Participantes</span>
              <span class="data-card__row-value">{{ ev.clubs_count }} club(es){{ ev.exempt_count ? ` · ${ev.exempt_count} exento(s)` : '' }}</span>
            </div>
          </div>
          <div class="org-event-card__footer">
            <button class="btn btn-sm btn-secondary" @click="toggleOrgEvent(ev)">
              {{ expandedOrgEventId === ev.id ? 'Ocultar detalle' : 'Ver detalle' }}
            </button>
            <button v-if="ev.status !== 'CERRADO'" class="btn btn-sm btn-secondary" @click="confirmCloseOrgEvent(ev)">Cerrar evento</button>
          </div>
          <div v-if="expandedOrgEventId === ev.id" class="org-event-card__detail" @click.stop>
            <OrgEventDetailPanel :event-id="ev.id" @changed="loadOrgEvents" />
          </div>
        </article>
      </div>
    </div>

    </LoadingState>

    <OrgEventFormModal
      :open="showNewOrgEventForm"
      :saving="creatingOrgEvent"
      :seasons="seasons"
      @close="showNewOrgEventForm = false"
      @submit="submitNewOrgEvent"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useNotifyStore } from '../stores/notify';
import { getClubs } from '../services/clubs.service.js';
import { getClubSeries } from '../services/clubSeries.service.js';
import { getLedgerEntries, createLedgerEntry, recordPayment, getPaymentStats, listOrgEvents, createOrgEvent, closeOrgEvent } from '../services/clubFinance.service.js';
import { getSeasons } from '../services/seasons.service.js';
import LoadingState from '../components/LoadingState.vue';
import ActionsMenu from '../components/ActionsMenu.vue';
import PanoramaDashboard from '../components/PanoramaDashboard.vue';
import OrgEventFormModal from '../components/OrgEventFormModal.vue';
import OrgEventDetailPanel from '../components/OrgEventDetailPanel.vue';

const authStore = useAuthStore();
const { notifySuccess, notifyError, prompt, confirm } = useNotifyStore();

const ledgerTabs = [
  { key: 'movements', label: 'Movimientos' },
  { key: 'stats', label: 'Estadísticas' },
  { key: 'org_events', label: 'Eventos' },
];
const activeTab = ref('movements');
const pageLoading = ref(true);
const error = ref(null);

const CATEGORIES = ['INSCRIPCION', 'FECHA', 'MULTA', 'OTRO', 'VALOR'];
const CATEGORY_LABELS = {
  INSCRIPCION: 'Inscripción', FECHA: 'Fecha', MULTA: 'Multa', OTRO: 'Otro', VALOR: 'Valor',
};
const STATUS_LABELS = {
  PENDIENTE: 'Pendiente', PARCIAL: 'Parcial', PAGADO: 'Pagado', VENCIDO: 'Vencido',
};
const CLUB_STATUS_LABELS = {
  AL_DIA: 'Al día', PENDIENTE: 'Pendiente', MOROSO: 'Moroso',
};
const ORG_EVENT_TYPE_LABELS = {
  SOCIAL: 'Social', DEPORTIVO: 'Deportivo', ESPECIAL: 'Especial', OTRO: 'Otro',
};
const ORG_EVENT_STATUS_LABELS = { ABIERTO: 'Abierto', CERRADO: 'Cerrado' };

const formatMoney = (v) => Math.round(Number(v) || 0).toLocaleString('es-CL');

// ── Movimientos ───────────────────────────────────────
const clubs = ref([]);
const entries = ref([]);
const entriesLoading = ref(false);
const showNewEntryForm = ref(false);
const creatingEntry = ref(false);
const newEntrySeries = ref([]);

const filters = reactive({ club_id: null, category: null });

const newEntry = reactive({
  club_id: null,
  series_id: null,
  category: 'MULTA',
  direction: 'INGRESO',
  amount: 0,
  due_date: '',
  description: '',
});

const loadClubs = async () => {
  try {
    const res = await getClubs({ org_id: authStore.state.org?.id, limit: 200 });
    clubs.value = res.data?.data?.clubs ?? res.data?.clubs ?? [];
  } catch (e) {
    console.error('[LedgerView] getClubs error:', e);
  }
};

const loadEntries = async () => {
  entriesLoading.value = true;
  try {
    const params = { org_id: authStore.state.org?.id };
    if (filters.club_id) params.club_id = filters.club_id;
    if (filters.category) params.category = filters.category;
    const res = await getLedgerEntries(params);
    entries.value = res.data?.data?.entries ?? res.data?.entries ?? [];
  } catch (e) {
    error.value = e.response?.data?.error?.message || 'Error al cargar los movimientos';
  } finally {
    entriesLoading.value = false;
  }
};

const loadSeriesForNewEntry = async () => {
  newEntry.series_id = null;
  newEntrySeries.value = [];
  if (!newEntry.club_id) return;
  try {
    const res = await getClubSeries(newEntry.club_id);
    newEntrySeries.value = res.data?.data?.data ?? res.data?.data ?? [];
  } catch (e) {
    console.error('[LedgerView] getClubSeries error:', e);
  }
};

const submitNewEntry = async () => {
  if (!newEntry.club_id || !newEntry.amount) {
    error.value = 'Club y monto son requeridos';
    return;
  }
  creatingEntry.value = true;
  try {
    await createLedgerEntry({
      org_id: authStore.state.org?.id,
      club_id: newEntry.club_id,
      series_id: newEntry.series_id,
      category: newEntry.category,
      direction: newEntry.direction,
      amount: newEntry.amount,
      due_date: newEntry.due_date || null,
      description: newEntry.description || null,
    });
    showNewEntryForm.value = false;
    Object.assign(newEntry, { club_id: null, series_id: null, category: 'MULTA', direction: 'INGRESO', amount: 0, due_date: '', description: '' });
    await loadEntries();
  } catch (e) {
    error.value = e.response?.data?.error?.message || 'Error al registrar el movimiento';
  } finally {
    creatingEntry.value = false;
  }
};

const openPaymentPrompt = async (entry) => {
  const pending = Number(entry.amount) - Number(entry.paid_amount || 0);
  const input = await prompt({
    title: 'Registrar Abono',
    message: `Monto a abonar (pendiente: $${formatMoney(pending)})`,
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
  try {
    await recordPayment(entry.id, { amount });
    notifySuccess('Pago registrado exitosamente');
    await loadEntries();
  } catch (e) {
    error.value = e.response?.data?.error?.message || 'Error al registrar el pago';
    notifyError(error.value);
  }
};

// ── Estadísticas ──────────────────────────────────────
const stats = ref(null);
const statsLoading = ref(false);
const expandedClubs = ref(new Set());

const loadStats = async () => {
  statsLoading.value = true;
  try {
    const res = await getPaymentStats(authStore.state.org?.id);
    stats.value = res.data?.data?.stats ?? res.data?.stats ?? null;
  } catch (e) {
    error.value = e.response?.data?.error?.message || 'Error al cargar las estadísticas';
  } finally {
    statsLoading.value = false;
  }
};

// ── Panorama financiero ───────────────────────────────────────────────────
const icons = {
  checkCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  alertTriangle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  dollar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
};

const financeTiles = computed(() => [
  { key: 'al_dia', label: 'Clubes al día', value: stats.value?.clubs_al_dia ?? 0, meta: 'al día con sus pagos', color: 'green', icon: icons.checkCircle },
  { key: 'pendiente', label: 'Clubes pendientes', value: stats.value?.clubs_pendientes ?? 0, meta: 'con saldo pendiente', color: 'gold', icon: icons.clock },
  { key: 'moroso', label: 'Clubes morosos', value: stats.value?.clubs_morosos ?? 0, meta: 'con pagos vencidos', color: 'red', icon: icons.alertTriangle },
  { key: 'total', label: 'Por cobrar en total', value: `$${formatMoney(stats.value?.total_pending)}`, meta: `de $${formatMoney(stats.value?.total_charged)} cobrado`, color: 'blue', icon: icons.dollar },
]);

const selectedFinanceTile = ref('total');
const selectedFinanceTileLabel = computed(() => financeTiles.value.find((t) => t.key === selectedFinanceTile.value)?.label ?? '');
const selectFinanceTile = (key) => {
  selectedFinanceTile.value = key;
  activeTab.value = 'stats'; // el filtro solo se ve en la tabla "Estado de pago por club"
};

const FINANCE_TILE_STATUS = { al_dia: 'AL_DIA', pendiente: 'PENDIENTE', moroso: 'MOROSO' };
const filteredByClub = computed(() => {
  const byClub = stats.value?.by_club ?? [];
  const status = FINANCE_TILE_STATUS[selectedFinanceTile.value];
  if (!status) return byClub;
  return byClub.filter((c) => c.status === status);
});

const toggleClubExpand = (clubId) => {
  if (expandedClubs.value.has(clubId)) expandedClubs.value.delete(clubId);
  else expandedClubs.value.add(clubId);
};

// ── Eventos de organización (cargo obligatorio por club a nivel temporada) ─
const seasons = ref([]);
const orgEvents = ref([]);
const orgEventsLoading = ref(false);
const showNewOrgEventForm = ref(false);
const creatingOrgEvent = ref(false);
const expandedOrgEventId = ref(null);

const loadSeasons = async () => {
  try {
    const res = await getSeasons({ org_id: authStore.state.org?.id });
    seasons.value = res.data?.data?.seasons ?? res.data?.seasons ?? [];
  } catch (e) {
    console.error('[LedgerView] getSeasons error:', e);
  }
};

const loadOrgEvents = async () => {
  orgEventsLoading.value = true;
  try {
    const res = await listOrgEvents({ org_id: authStore.state.org?.id });
    orgEvents.value = res.data?.data?.orgEvents ?? [];
  } catch (e) {
    error.value = e.response?.data?.error?.message || 'Error al cargar los eventos de organización';
  } finally {
    orgEventsLoading.value = false;
  }
};

const toggleOrgEvent = (ev) => {
  expandedOrgEventId.value = expandedOrgEventId.value === ev.id ? null : ev.id;
};

const submitNewOrgEvent = async (payload) => {
  creatingOrgEvent.value = true;
  try {
    await createOrgEvent({ org_id: authStore.state.org?.id, ...payload });
    showNewOrgEventForm.value = false;
    notifySuccess('Evento creado correctamente');
    await loadOrgEvents();
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al crear el evento');
  } finally {
    creatingOrgEvent.value = false;
  }
};

const confirmCloseOrgEvent = async (ev) => {
  const ok = await confirm({
    title: 'Cerrar evento',
    message: `¿Cerrar el evento "${ev.name}"? Los cargos no exentos se traspasarán al libro de ingresos/egresos y no se podrán registrar más pagos ni exenciones. Esta acción no se puede deshacer.`,
    isDestructive: true,
    confirmText: 'Cerrar evento',
  });
  if (!ok) return;
  try {
    await closeOrgEvent(ev.id);
    notifySuccess('Evento cerrado correctamente');
    await loadOrgEvents();
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al cerrar el evento');
  }
};

onMounted(async () => {
  pageLoading.value = true;
  try {
    await Promise.allSettled([loadClubs(), loadEntries(), loadStats(), loadSeasons(), loadOrgEvents()]);
  } finally {
    pageLoading.value = false;
  }
});
</script>

<style scoped>
.form-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 10px; }

.new-entry-form {
  padding: 1rem;
  border-radius: var(--radius-md);
  background: var(--surface-hover, rgba(255,255,255,0.03));
  border: 1px solid var(--border-color);
}

.font-medium { font-weight: 500; }
.p-0 { padding: 0 !important; }
.py-lg { padding-top: var(--spacing-lg); padding-bottom: var(--spacing-lg); }
.pl-lg { padding-left: 2rem; }
.text-right { text-align: right; }

.clickable-row { cursor: pointer; }
.clickable-row:hover { background: var(--surface-hover, rgba(255,255,255,0.03)); }
.series-row td { border-top: none; }

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
.status-badge--sm { padding: 0.1rem 0.5rem; font-size: 0.7rem; }
.status-badge--pendiente { background: rgba(79, 195, 247, 0.16); color: #4fc3f7; }
.status-badge--parcial   { background: rgba(255, 213, 79, 0.16); color: #ffd54f; }
.status-badge--pagado    { background: rgba(0, 230, 118, 0.14); color: var(--primary-solid, #00e676); }
.status-badge--vencido   { background: rgba(239, 83, 80, 0.14); color: #ef5350; }

.status-badge--club-al_dia    { background: rgba(0, 230, 118, 0.14); color: var(--primary-solid, #00e676); }
.status-badge--club-pendiente { background: rgba(255, 213, 79, 0.16); color: #ffd54f; }
.status-badge--club-moroso    { background: rgba(239, 83, 80, 0.14); color: #ef5350; }

.status-badge--org-abierto { background: rgba(79, 195, 247, 0.16); color: #4fc3f7; }
.status-badge--org-cerrado { background: rgba(158, 158, 158, 0.18); color: #9e9e9e; }

.org-events-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--spacing-md, 1rem);
}
.org-event-card { display: flex; flex-direction: column; gap: 0.75rem; padding: var(--spacing-md, 1rem); }
.org-event-card__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; }
.org-event-card__title { font-weight: 700; font-size: 1rem; }
.org-event-card__body { display: flex; flex-direction: column; gap: 0.4rem; }
.org-event-card__footer { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.org-event-card__detail {
  margin: 0 -1rem -1rem;
  padding: 0;
  border-top: 1px solid var(--border-color);
  background: var(--bg-hover, rgba(255,255,255,0.02));
}
</style>
