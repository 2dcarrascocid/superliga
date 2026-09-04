<template>
  <div class="container mt-md">
    <div class="flex justify-between items-center mb-lg">
      <h2>Finanzas</h2>
    </div>

    <div v-if="error" class="alert alert-error mb-md">{{ error }}</div>

    <!-- Tabs -->
    <div class="ledger-tabs mb-md">
      <button class="ledger-tab" :class="{ 'ledger-tab-active': activeTab === 'movements' }" @click="activeTab = 'movements'">
        Movimientos
      </button>
      <button class="ledger-tab" :class="{ 'ledger-tab-active': activeTab === 'stats' }" @click="switchToStats">
        Estadísticas
      </button>
    </div>

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
      </div>
    </div>

    <!-- TAB: Estadísticas -->
    <div v-if="activeTab === 'stats'">
      <div class="kpi-grid mb-lg">
        <div class="card kpi-card">
          <span class="kpi-label">Clubes al día</span>
          <span class="kpi-value kpi-success">{{ stats?.clubs_al_dia ?? 0 }}</span>
        </div>
        <div class="card kpi-card">
          <span class="kpi-label">Clubes pendientes</span>
          <span class="kpi-value kpi-warning">{{ stats?.clubs_pendientes ?? 0 }}</span>
        </div>
        <div class="card kpi-card">
          <span class="kpi-label">Clubes morosos</span>
          <span class="kpi-value kpi-danger">{{ stats?.clubs_morosos ?? 0 }}</span>
        </div>
        <div class="card kpi-card">
          <span class="kpi-label">Total cobrado</span>
          <span class="kpi-value">${{ formatMoney(stats?.total_charged) }}</span>
        </div>
        <div class="card kpi-card">
          <span class="kpi-label">Total pendiente</span>
          <span class="kpi-value">${{ formatMoney(stats?.total_pending) }}</span>
        </div>
      </div>

      <div class="card p-0">
        <div class="flex justify-between items-center p-md" style="border-bottom: 1px solid var(--border-color);">
          <h3 class="m-0">Estado de pago por club</h3>
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
              <tr v-if="!stats || (stats.by_club ?? []).length === 0">
                <td colspan="6" class="text-center py-lg">Sin datos todavía.</td>
              </tr>
              <template v-for="club in stats?.by_club ?? []" :key="club.club_id">
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
      </div>
    </div>

    </LoadingState>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useNotifyStore } from '../stores/notify';
import { getClubs } from '../services/clubs.service.js';
import { getClubSeries } from '../services/clubSeries.service.js';
import { getLedgerEntries, createLedgerEntry, recordPayment, getPaymentStats } from '../services/clubFinance.service.js';
import LoadingState from '../components/LoadingState.vue';
import ActionsMenu from '../components/ActionsMenu.vue';

const authStore = useAuthStore();
const { notifySuccess, notifyError, prompt } = useNotifyStore();

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

const switchToStats = () => {
  activeTab.value = 'stats';
  if (!stats.value) loadStats();
};

const toggleClubExpand = (clubId) => {
  if (expandedClubs.value.has(clubId)) expandedClubs.value.delete(clubId);
  else expandedClubs.value.add(clubId);
};

onMounted(async () => {
  pageLoading.value = true;
  try {
    await Promise.allSettled([loadClubs(), loadEntries()]);
  } finally {
    pageLoading.value = false;
  }
});
</script>

<style scoped>
.ledger-tabs {
  display: flex;
  gap: 2px;
  border-bottom: 2px solid var(--border-color);
}
.ledger-tab {
  padding: 0.6rem 1.1rem;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  font-weight: 600;
  font-size: 0.9rem;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
}
.ledger-tab-active {
  color: var(--primary-solid, #00e676);
  border-bottom-color: var(--primary-solid, #00e676);
}

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

/* ── KPIs (mismo patrón que ClubDetail.vue) ── */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}
.kpi-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
}
.kpi-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-muted);
}
.kpi-value {
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1.1;
}
.kpi-success { color: var(--primary-solid, #00e676); }
.kpi-warning { color: #eab308; }
.kpi-danger  { color: var(--color-danger, #ef4444); }
</style>
