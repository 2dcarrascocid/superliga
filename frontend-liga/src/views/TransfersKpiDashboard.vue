<template>
  <div class="kpi-dashboard-container">
    <!-- Header -->
    <div class="page-header">
      <div class="header-title">
        <h1>Dashboard de KPIs y Métricas de Transferencias</h1>
        <p class="subtitle">Análisis del mercado de pases, montos invertidos y actividad de clubes</p>
      </div>
      <div class="header-actions">
        <router-link to="/transfers" class="btn btn-secondary">
          <span class="icon">📋</span> Volver a Gestión
        </router-link>
        <button @click="fetchSummary" class="btn btn-icon-text">
          <span>🔄 Actualizar</span>
        </button>
      </div>
    </div>

    <!-- Indicador de Carga -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Calculando métricas e indicadores de transferencias...</p>
    </div>

    <div v-else>
      <!-- Tarjetas de Métricas Principales (KPI Cards) -->
      <div class="kpi-grid">
        <div class="kpi-card glow-green">
          <div class="kpi-icon-wrapper green">
            <span>⚽</span>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Total Transferencias</span>
            <h2 class="kpi-value">{{ summary.total_transfers || 0 }}</h2>
            <span class="kpi-subtext">Registradas en la temporada</span>
          </div>
        </div>

        <div class="kpi-card glow-cyan">
          <div class="kpi-icon-wrapper cyan">
            <span>💰</span>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Monto Total Invertido</span>
            <h2 class="kpi-value text-cyan">{{ formatCurrency(summary.total_fee_amount) }}</h2>
            <span class="kpi-subtext">Volumen total del mercado</span>
          </div>
        </div>

        <div class="kpi-card glow-orange">
          <div class="kpi-icon-wrapper orange">
            <span>⏱️</span>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Promedio de Resolución</span>
            <h2 class="kpi-value">{{ summary.avg_resolution_days || 0 }} <span class="unit">días</span></h2>
            <span class="kpi-subtext">Tiempo prom. de procesamiento</span>
          </div>
        </div>

        <div class="kpi-card glow-purple">
          <div class="kpi-icon-wrapper purple">
            <span>🏆</span>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Tasa de Aprobación</span>
            <h2 class="kpi-value">{{ approvalRate }}%</h2>
            <span class="kpi-subtext">{{ summary.by_status?.APPROVED || 0 }} pases aprobados</span>
          </div>
        </div>
      </div>

      <!-- Sección Intermedia: Distribución y Clubes Destacados -->
      <div class="dashboard-middle-row">
        <!-- Tarjeta: Distribución por Estado -->
        <div class="chart-card">
          <div class="card-header">
            <h3>Distribución por Estado</h3>
          </div>
          <div class="status-distribution-grid">
            <div class="status-box approved">
              <div class="status-box-header">
                <span class="dot"></span>
                <span>Aprobadas</span>
              </div>
              <span class="count">{{ summary.by_status?.APPROVED || 0 }}</span>
            </div>

            <div class="status-box pending">
              <div class="status-box-header">
                <span class="dot"></span>
                <span>Pendientes</span>
              </div>
              <span class="count">{{ summary.by_status?.PENDING || 0 }}</span>
            </div>

            <div class="status-box rejected">
              <div class="status-box-header">
                <span class="dot"></span>
                <span>Rechazadas</span>
              </div>
              <span class="count">{{ summary.by_status?.REJECTED || 0 }}</span>
            </div>

            <div class="status-box cancelled">
              <div class="status-box-header">
                <span class="dot"></span>
                <span>Canceladas</span>
              </div>
              <span class="count">{{ summary.by_status?.CANCELLED || 0 }}</span>
            </div>
          </div>
        </div>

        <!-- Tarjeta: Clubes con Mayor Actividad -->
        <div class="activity-card">
          <div class="card-header">
            <h3>Clubes Líderes en el Mercado</h3>
          </div>
          <div class="activity-content">
            <div class="activity-item">
              <div class="activity-badge green">
                <span>🔥 Top Fichajes (Altas)</span>
              </div>
              <div class="activity-detail">
                <h4>{{ summary.top_destination_club?.name || 'Sin datos suficientes' }}</h4>
                <p v-if="summary.top_destination_club">
                  <strong>{{ summary.top_destination_club.count }}</strong> nuevos jugadores incorporados
                </p>
              </div>
            </div>

            <div class="activity-divider"></div>

            <div class="activity-item">
              <div class="activity-badge orange">
                <span>📤 Top Salidas (Bajas)</span>
              </div>
              <div class="activity-detail">
                <h4>{{ summary.top_origin_club?.name || 'Sin datos suficientes' }}</h4>
                <p v-if="summary.top_origin_club">
                  <strong>{{ summary.top_origin_club.count }}</strong> traspasos emitidos
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Sección Inferior: Indicadores Específicos por Club -->
      <div class="club-kpi-section">
        <div class="section-header">
          <div>
            <h2>Indicadores Específicos por Club</h2>
            <p class="subtitle">Selecciona un club para auditar sus gastos, ingresos y compras netas</p>
          </div>
          <div class="club-selector">
            <select v-model="selectedClubId" @change="fetchClubKpis" class="form-select">
              <option value="" disabled>Seleccionar un Club...</option>
              <option v-for="c in clubs" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
        </div>

        <div v-if="loadingClubKpis" class="loading-state compact">
          <div class="spinner"></div>
          <p>Cargando datos del club...</p>
        </div>

        <div v-else-if="clubKpis" class="club-kpi-grid">
          <div class="club-kpi-box">
            <span class="label">Compras (Fichajes)</span>
            <span class="value">{{ clubKpis.purchases || 0 }}</span>
          </div>

          <div class="club-kpi-box">
            <span class="label">Ventas (Salidas)</span>
            <span class="value">{{ clubKpis.sales || 0 }}</span>
          </div>

          <div class="club-kpi-box">
            <span class="label">Total Gastado</span>
            <span class="value text-red">{{ formatCurrency(clubKpis.total_spent) }}</span>
          </div>

          <div class="club-kpi-box">
            <span class="label">Total Ingresado</span>
            <span class="value text-green">{{ formatCurrency(clubKpis.total_revenue) }}</span>
          </div>

          <div :class="['club-kpi-box', 'balance', clubKpis.net_balance >= 0 ? 'positive' : 'negative']">
            <span class="label">Balance Neto de Mercado</span>
            <span class="value">{{ formatCurrency(clubKpis.net_balance) }}</span>
          </div>
        </div>

        <div v-else class="empty-club-prompt">
          <span>👈 Selecciona un club de la lista superior para visualizar sus indicadores financieros.</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import transfersService from '../services/transfersService';
import { getClubs } from '../services/clubs.service';

const loading = ref(true);
const loadingClubKpis = ref(false);
const summary = ref({
  total_transfers: 0,
  by_status: { APPROVED: 0, PENDING: 0, REJECTED: 0, CANCELLED: 0 },
  total_fee_amount: 0,
  avg_resolution_days: 0,
  top_destination_club: null,
  top_origin_club: null,
});

const clubs = ref([]);
const selectedClubId = ref('');
const clubKpis = ref(null);

// Tasa de Aprobación (%)
const approvalRate = computed(() => {
  const total = summary.value.total_transfers || 0;
  if (total === 0) return 0;
  const approved = summary.value.by_status?.APPROVED || 0;
  return parseFloat(((approved / total) * 100).toFixed(1));
});

// Cargar catálogo de clubes
const fetchClubs = async () => {
  try {
    const res = await getClubs({ limit: 100 });
    const list = res.data?.data || res.data || [];
    clubs.value = Array.isArray(list) ? list : [];
    if (clubs.value.length > 0) {
      selectedClubId.value = clubs.value[0].id;
      fetchClubKpis();
    }
  } catch (err) {
    console.error('Error al cargar lista de clubes:', err);
  }
};

// Cargar métricas globales de KPIs
const fetchSummary = async () => {
  loading.value = true;
  try {
    const res = await transfersService.getSummaryKpis();
    if (res) {
      summary.value = {
        total_transfers: res.total_transfers ?? 0,
        by_status: res.by_status ?? { APPROVED: 0, PENDING: 0, REJECTED: 0, CANCELLED: 0 },
        total_fee_amount: res.total_fee_amount ?? 0,
        avg_resolution_days: res.avg_resolution_days ?? 0,
        top_destination_club: res.top_destination_club ?? null,
        top_origin_club: res.top_origin_club ?? null,
      };
    }
  } catch (err) {
    console.error('Error al cargar resumen de KPIs:', err);
  } finally {
    loading.value = false;
  }
};

// Cargar indicadores de un club específico
const fetchClubKpis = async () => {
  if (!selectedClubId.value) return;
  loadingClubKpis.value = true;
  try {
    const res = await transfersService.getClubKpis(selectedClubId.value);
    clubKpis.value = res || null;
  } catch (err) {
    console.error('Error al obtener KPIs del club:', err);
  } finally {
    loadingClubKpis.value = false;
  }
};

const formatCurrency = (amount) => {
  const num = parseFloat(amount || 0);
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(num);
};

onMounted(() => {
  fetchSummary();
  fetchClubs();
});
</script>

<style scoped>
.kpi-dashboard-container {
  padding: var(--spacing-xl);
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-xl);
  flex-wrap: wrap;
  gap: var(--spacing-md);
}

.header-title h1 {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.subtitle {
  color: var(--text-secondary);
  font-size: 0.95rem;
}

.header-actions {
  display: flex;
  gap: var(--spacing-md);
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 1.25rem;
  font-weight: 600;
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  text-decoration: none;
  font-size: 0.9rem;
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-icon-text {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

/* Grid de KPI Cards */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-xl);
}

.kpi-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1.25rem;
  box-shadow: var(--shadow-md);
  transition: transform var(--transition-fast);
}

.kpi-card:hover {
  transform: translateY(-2px);
}

.kpi-icon-wrapper {
  width: 54px;
  height: 54px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.6rem;
}

.kpi-icon-wrapper.green {
  background: rgba(0, 230, 118, 0.15);
}

.kpi-icon-wrapper.cyan {
  background: rgba(79, 195, 247, 0.15);
}

.kpi-icon-wrapper.orange {
  background: rgba(245, 158, 11, 0.15);
}

.kpi-icon-wrapper.purple {
  background: rgba(168, 85, 247, 0.15);
}

.kpi-label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 0.2rem;
}

.kpi-value {
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.1;
}

.unit {
  font-size: 1rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.kpi-subtext {
  font-size: 0.775rem;
  color: var(--text-muted);
  display: block;
  margin-top: 0.25rem;
}

.text-cyan {
  color: var(--accent-cyan);
}

.text-green {
  color: var(--accent-green);
}

.text-red {
  color: var(--accent-red);
}

/* Secciones intermedias */
.dashboard-middle-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-xl);
}

@media (max-width: 900px) {
  .dashboard-middle-row {
    grid-template-columns: 1fr;
  }
}

.chart-card, .activity-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  box-shadow: var(--shadow-md);
}

.card-header h3 {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 1.25rem;
}

/* Grid de estados */
.status-distribution-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.status-box {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.status-box-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-box.approved .dot { background: var(--accent-green); }
.status-box.pending .dot { background: var(--accent-orange); }
.status-box.rejected .dot { background: var(--accent-red); }
.status-box.cancelled .dot { background: var(--text-muted); }

.status-box .count {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-top: 0.5rem;
}

/* Clubes líderes */
.activity-content {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.activity-badge {
  display: inline-block;
  font-size: 0.8rem;
  font-weight: 700;
  padding: 0.25rem 0.65rem;
  border-radius: var(--radius-sm);
  margin-bottom: 0.5rem;
}

.activity-badge.green {
  background: rgba(0, 230, 118, 0.15);
  color: var(--accent-green);
}

.activity-badge.orange {
  background: rgba(245, 158, 11, 0.15);
  color: var(--accent-orange);
}

.activity-detail h4 {
  font-size: 1.2rem;
  color: var(--text-primary);
}

.activity-detail p {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.activity-divider {
  height: 1px;
  background: var(--border-color);
}

/* Indicadores por club */
.club-kpi-section {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 1.75rem;
  box-shadow: var(--shadow-md);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.section-header h2 {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--text-primary);
}

.form-select {
  padding: 0.6rem 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 0.95rem;
  outline: none;
  min-width: 250px;
}

.club-kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.25rem;
}

.club-kpi-box {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
}

.club-kpi-box .label {
  font-size: 0.825rem;
  color: var(--text-secondary);
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.club-kpi-box .value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.club-kpi-box.balance.positive .value {
  color: var(--accent-green);
}

.club-kpi-box.balance.negative .value {
  color: var(--accent-red);
}

.empty-club-prompt {
  padding: 2rem;
  text-align: center;
  color: var(--text-secondary);
}

.loading-state {
  text-align: center;
  padding: 4rem 1.5rem;
  color: var(--text-secondary);
}

.loading-state.compact {
  padding: 2rem 1.5rem;
}

.spinner {
  width: 38px;
  height: 38px;
  border: 3px solid var(--border-color);
  border-top-color: var(--primary-solid);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
