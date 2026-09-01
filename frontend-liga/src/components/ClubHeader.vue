<template>
  <div class="club-header">
    <!-- Header -->
    <div class="flex justify-between items-center mb-lg">
      <h2>Detalle de Club</h2>
      <button class="btn btn-secondary" @click="goBack">
        &larr; Clubes
      </button>
    </div>

    <!-- Club Info Card (always visible) -->
    <div v-if="club" class="card club-card-detail mb-md">
      <div class="club-card-header">
        <div class="club-logo-large">
          <span v-if="!club.logo_url" class="logo-placeholder">⚽</span>
          <img v-else :src="club.logo_url" :alt="club.name" />
        </div>
        <div class="club-card-title">
          <h3>{{ club.name }}</h3>
          <p class="text-muted text-sm">{{ club.short_name || 'Sin nombre corto' }}</p>
        </div>
        <div class="ml-auto flex items-center gap-md">
          <span class="badge" :class="activeCount >= 70 ? 'badge-danger' : 'badge-success'">
            Activos: {{ activeCount }} / 70
          </span>
        </div>
      </div>
    </div>

    <!-- KPIs Dashboard -->
    <div class="kpi-grid mb-md">
      <div class="card kpi-card">
        <span class="kpi-label">Jugadores inscritos</span>
        <span class="kpi-value">{{ kpisLoading ? '—' : (kpis?.registered_players ?? 0) }}</span>
      </div>
      <div class="card kpi-card">
        <span class="kpi-label">Folios disponibles</span>
        <span class="kpi-value">{{ kpisLoading ? '—' : (kpis?.available_folios ?? 0) }}</span>
        <span v-if="kpis" class="kpi-sub">de {{ kpis.total_folios }}</span>
      </div>
      <div class="card kpi-card kpi-card-split">
        <span class="kpi-label">Tarjetas</span>
        <div class="kpi-split-row">
          <div class="kpi-split-item">
            <span class="kpi-value kpi-value-sm kpi-danger">{{ kpisLoading ? '—' : (kpis?.expelled_players ?? 0) }}</span>
            <span class="kpi-split-label">Expulsados</span>
          </div>
          <div class="kpi-split-item">
            <span class="kpi-value kpi-value-sm kpi-warning">{{ kpisLoading ? '—' : (kpis?.yellow_card_players ?? 0) }}</span>
            <span class="kpi-split-label">Amarillas</span>
          </div>
        </div>
      </div>
      <div class="card kpi-card kpi-card-split">
        <span class="kpi-label">Traspasos</span>
        <div class="kpi-split-row">
          <div class="kpi-split-item">
            <span class="kpi-value kpi-value-sm">{{ kpisLoading ? '—' : (kpis?.transferred_players ?? 0) }}</span>
            <span class="kpi-split-label">Transferidos</span>
          </div>
          <div class="kpi-split-item">
            <span class="kpi-value kpi-value-sm">{{ kpisLoading ? '—' : (kpis?.pending_transfers ?? 0) }}</span>
            <span class="kpi-split-label">Pendientes</span>
          </div>
        </div>
      </div>
      <div class="card kpi-card">
        <span class="kpi-label">Series activas {{ currentYear }}</span>
        <span class="kpi-value">{{ kpisLoading ? '—' : (kpis?.active_series_this_year ?? 0) }}</span>
      </div>
      <div class="card kpi-card">
        <span class="kpi-label">Estado de pago</span>
        <span v-if="paymentStatusLoading" class="kpi-value">—</span>
        <span v-else class="badge" :class="PAY_STATUS_BADGE_CLASS[paymentStatus?.status] || 'badge-secondary'">
          {{ PAY_STATUS_LABELS[paymentStatus?.status] || 'Sin datos' }}
        </span>
        <span v-if="paymentStatus?.total_pending > 0" class="kpi-sub">${{ Math.round(paymentStatus.total_pending).toLocaleString('es-CL') }} pendiente</span>
      </div>
    </div>

    <!-- Sub Menu / Tabs -->
    <div class="club-tabs mb-md">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="club-tab"
        :class="{ 'club-tab-active': activeTabKey === tab.key }"
        @click="onTabClick(tab)"
      >
        {{ tab.label }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { getClubKpis } from '../services/clubs.service.js';
import { getClubPaymentStatus } from '../services/clubFinance.service.js';

const props = defineProps({
  clubId: { type: String, required: true },
  // Registro completo del club (name, logo_url, short_name,
  // active_players_count, etc.). Se recibe por prop en vez de fetchearse acá
  // porque las vistas padre (ClubDetail.vue / ClubSeries.vue) ya cargan este
  // mismo recurso (GET /clubs/:clubId) para sus propias necesidades — evita
  // duplicar esa petición.
  club: { type: Object, default: null },
  activeTabKey: { type: String, required: true },
  tabs: { type: Array, required: true },
});

const emit = defineEmits(['tab-click']);

const router = useRouter();

const onTabClick = (tab) => {
  if (tab.path) {
    router.push(tab.path);
    return;
  }
  emit('tab-click', tab.key);
};

const goBack = () => router.push('/clubs');

// ── Active count ──────────────────────────────────────
const activeCount = computed(() => props.club?.active_players_count ?? 0);

// ── KPIs dashboard ────────────────────────────────────
const kpis        = ref(null);
const kpisLoading  = ref(false);
const currentYear  = new Date().getFullYear();

const loadKpis = async () => {
  kpisLoading.value = true;
  try {
    const res = await getClubKpis(props.clubId);
    kpis.value = res.data?.data?.kpis ?? res.data?.kpis ?? null;
  } catch (e) {
    console.error('[ClubHeader] getClubKpis error:', e);
    kpis.value = null;
  } finally {
    kpisLoading.value = false;
  }
};

// ── Payment status ────────────────────────────────────
const PAY_STATUS_LABELS = { AL_DIA: 'Al día', PENDIENTE: 'Pendiente', MOROSO: 'Moroso' };
const PAY_STATUS_BADGE_CLASS = { AL_DIA: 'badge-success', PENDIENTE: 'badge-secondary', MOROSO: 'badge-danger' };

const paymentStatus        = ref(null);
const paymentStatusLoading = ref(false);

const loadPaymentStatus = async () => {
  paymentStatusLoading.value = true;
  try {
    const res = await getClubPaymentStatus(props.clubId);
    paymentStatus.value = res.data?.data?.status ?? res.data?.status ?? null;
  } catch (e) {
    console.error('[ClubHeader] getClubPaymentStatus error:', e);
    paymentStatus.value = null;
  } finally {
    paymentStatusLoading.value = false;
  }
};

const loadAll = () => {
  loadKpis();
  loadPaymentStatus();
};

onMounted(loadAll);
watch(() => props.clubId, (newId, oldId) => {
  if (newId && newId !== oldId) loadAll();
});
</script>

<style scoped>
/* ── KPIs dashboard ── */
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
.kpi-sub {
  font-size: 0.75rem;
  color: var(--text-muted);
}
.kpi-card-split {
  justify-content: space-between;
}
.kpi-split-row {
  display: flex;
  gap: 20px;
}
.kpi-split-item {
  display: flex;
  flex-direction: column;
}
.kpi-value-sm {
  font-size: 1.35rem;
}
.kpi-split-label {
  font-size: 0.72rem;
  color: var(--text-muted);
}
.kpi-danger {
  color: var(--color-danger, #ef4444);
}
.kpi-warning {
  color: #eab308;
}

/* ── Tabs ── */
.club-tabs {
  display: flex;
  gap: 2px;
  border-bottom: 2px solid var(--border-color);
}

.club-tab {
  padding: var(--spacing-sm) var(--spacing-md);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  cursor: pointer;
  color: var(--text-muted);
  font-size: 0.9rem;
  font-weight: 500;
  transition: color 0.15s, border-color 0.15s;
}

.club-tab:hover {
  color: var(--text-primary);
}

.club-tab-active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

/* ── Club card ── */
.club-card-detail {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.club-card-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.club-logo-large {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.club-logo-large img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.club-card-title h3 { margin-bottom: 0.2rem; }
</style>
