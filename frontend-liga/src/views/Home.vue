<template>
  <div class="container mt-md home-dashboard">
    <div class="flex justify-between items-center mb-lg flex-wrap gap-md">
      <div>
        <p class="home-eyebrow">Panel de administración</p>
        <h2 class="mb-0">{{ orgName || 'Liga' }}</h2>
        <p class="text-muted text-sm mt-xs mb-0">
          Hola, {{ authStore.state.user?.nombre || authStore.state.user?.email || 'administrador' }} — resumen general de la liga.
        </p>
      </div>
      <button @click="handleLogout" class="btn btn-secondary">Cerrar Sesión</button>
    </div>

    <div v-if="loadError" class="alert alert-error mb-md">{{ loadError }}</div>

    <div class="kpi-grid">
      <!-- Clubes -->
      <router-link to="/clubs" class="card kpi-card kpi-card-link">
        <span class="kpi-label">Clubes</span>
        <span class="kpi-value">{{ loading ? '—' : kpis.clubsCount }}</span>
        <span class="kpi-sub">registrados en la liga</span>
      </router-link>

      <!-- Jugadores activos -->
      <router-link to="/players" class="card kpi-card kpi-card-link">
        <span class="kpi-label">Jugadores activos</span>
        <span class="kpi-value">{{ loading ? '—' : kpis.activePlayers }}</span>
        <span class="kpi-sub">con roster activo</span>
      </router-link>

      <!-- Series activas -->
      <div class="card kpi-card">
        <span class="kpi-label">Series activas</span>
        <span class="kpi-value">{{ loading ? '—' : kpis.activeSeries }}</span>
        <span class="kpi-sub">de {{ loading ? '—' : kpis.totalSeries }} en total</span>
      </div>

      <!-- Temporada activa -->
      <router-link to="/seasons" class="card kpi-card kpi-card-link">
        <span class="kpi-label">Temporada activa</span>
        <span class="kpi-value kpi-value-text">{{ loading ? '—' : (activeSeason?.name || 'Sin temporada activa') }}</span>
        <span v-if="activeSeason" class="badge badge-success kpi-badge">{{ activeSeason.year }}</span>
      </router-link>

      <!-- Torneos por estado -->
      <router-link to="/tournaments" class="card kpi-card kpi-card-split kpi-card-link">
        <span class="kpi-label">Torneos</span>
        <div class="kpi-split-row">
          <div class="kpi-split-item">
            <span class="kpi-value kpi-value-sm stat-blue">{{ loading ? '—' : kpis.tournamentsRegistration }}</span>
            <span class="kpi-split-label">Inscripción</span>
          </div>
          <div class="kpi-split-item">
            <span class="kpi-value kpi-value-sm">{{ loading ? '—' : kpis.tournamentsInProgress }}</span>
            <span class="kpi-split-label">En curso</span>
          </div>
          <div class="kpi-split-item">
            <span class="kpi-value kpi-value-sm">{{ loading ? '—' : kpis.tournamentsFinished }}</span>
            <span class="kpi-split-label">Finalizados</span>
          </div>
        </div>
      </router-link>

      <!-- Equipos inscritos / cupos -->
      <router-link to="/tournaments" class="card kpi-card kpi-card-link">
        <span class="kpi-label">Equipos-series inscritos</span>
        <span class="kpi-value">{{ loading ? '—' : kpis.teamsRegistered }}</span>
        <span class="kpi-sub">{{ loading ? '—' : (kpis.maxTeamsKnown ? `de ${kpis.maxTeamsKnown} cupos configurados` : 'en torneos activos') }}</span>
      </router-link>

      <!-- Estado financiero -->
      <router-link to="/ledger" class="card kpi-card kpi-card-split kpi-card-link">
        <span class="kpi-label">Estado financiero</span>
        <div class="kpi-split-row">
          <div class="kpi-split-item">
            <span class="kpi-value kpi-value-sm kpi-warning">{{ loading ? '—' : money(kpis.totalPending) }}</span>
            <span class="kpi-split-label">Por cobrar</span>
          </div>
          <div class="kpi-split-item">
            <span class="kpi-value kpi-value-sm kpi-danger">{{ loading ? '—' : money(kpis.overdueAmount) }}</span>
            <span class="kpi-split-label">Vencido</span>
          </div>
        </div>
      </router-link>

      <!-- Clubes por estado de pago -->
      <router-link to="/ledger" class="card kpi-card kpi-card-split kpi-card-link">
        <span class="kpi-label">Clubes — estado de pago</span>
        <div class="kpi-split-row">
          <div class="kpi-split-item">
            <span class="kpi-value kpi-value-sm stat-green">{{ loading ? '—' : kpis.clubsAlDia }}</span>
            <span class="kpi-split-label">Al día</span>
          </div>
          <div class="kpi-split-item">
            <span class="kpi-value kpi-value-sm kpi-warning">{{ loading ? '—' : kpis.clubsPendientes }}</span>
            <span class="kpi-split-label">Pendientes</span>
          </div>
          <div class="kpi-split-item">
            <span class="kpi-value kpi-value-sm kpi-danger">{{ loading ? '—' : kpis.clubsMorosos }}</span>
            <span class="kpi-split-label">Morosos</span>
          </div>
        </div>
      </router-link>

      <!-- Traspasos pendientes -->
      <router-link to="/transfers/dashboard" class="card kpi-card kpi-card-link">
        <span class="kpi-label">Traspasos pendientes</span>
        <span class="kpi-value" :class="!loading && kpis.transfersPending > 0 ? 'kpi-warning' : 'stat-green'">
          {{ loading || kpis.transfersPending === null ? '—' : kpis.transfersPending }}
        </span>
        <span class="kpi-sub">esperando resolución</span>
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { getClubs } from '../services/clubs.service.js';
import { listActivePlayersByOrg } from '../services/players.service.js';
import { searchSeries } from '../services/clubSeries.service.js';
import { getTournaments } from '../services/tournaments.service.js';
import { getSeasons } from '../services/seasons.service.js';
import { getPaymentStats } from '../services/clubFinance.service.js';
import { transfersService } from '../services/transfersService.js';

const router = useRouter();
const authStore = useAuthStore();

const orgName = computed(() => authStore.state.org?.name || authStore.state.org?.org_name || '');

const handleLogout = () => {
  authStore.logout();
  router.push('/login');
};

const loading = ref(true);
const loadError = ref('');
const activeSeason = ref(null);

const kpis = reactive({
  clubsCount: 0,
  activePlayers: 0,
  activeSeries: 0,
  totalSeries: 0,
  tournamentsRegistration: 0,
  tournamentsInProgress: 0,
  tournamentsFinished: 0,
  teamsRegistered: 0,
  maxTeamsKnown: 0,
  totalPending: 0,
  overdueAmount: 0,
  clubsAlDia: 0,
  clubsPendientes: 0,
  clubsMorosos: 0,
  transfersPending: null, // null = aún no cargado o falló la carga (se muestra "—", nunca "0" engañoso)
});

const money = (value) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value || 0));

const loadClubs = async (orgId) => {
  const res = await getClubs({ org_id: orgId, limit: 200 });
  const clubs = res.data?.data?.clubs ?? res.data?.clubs ?? [];
  kpis.clubsCount = clubs.length;
};

const loadPlayers = async (orgId) => {
  const res = await listActivePlayersByOrg(orgId, { limit: 1 });
  const data = res.data?.data ?? res.data ?? {};
  kpis.activePlayers = data.total_registros ?? 0;
};

const loadSeries = async (orgId) => {
  const res = await searchSeries({ org_id: orgId, limit: 300 });
  const seriesList = res.data?.data?.seriesList ?? res.data?.seriesList ?? [];
  kpis.totalSeries = seriesList.length;
  kpis.activeSeries = seriesList.filter((s) => s.active).length;
};

const loadTournaments = async (orgId) => {
  const res = await getTournaments({ org_id: orgId, limit: 100 });
  const tournaments = res.data?.data?.tournaments ?? res.data?.tournaments ?? [];
  kpis.tournamentsRegistration = tournaments.filter((t) => t.status === 'REGISTRATION').length;
  kpis.tournamentsInProgress = tournaments.filter((t) => t.status === 'IN_PROGRESS').length;
  kpis.tournamentsFinished = tournaments.filter((t) => t.status === 'FINISHED').length;

  const active = tournaments.filter((t) => t.status === 'REGISTRATION' || t.status === 'IN_PROGRESS');
  kpis.teamsRegistered = active.reduce((sum, t) => sum + (t.teams_count ?? 0), 0);
  const withMaxTeams = active.filter((t) => t.max_teams);
  kpis.maxTeamsKnown = withMaxTeams.length === active.length && active.length > 0
    ? withMaxTeams.reduce((sum, t) => sum + t.max_teams, 0)
    : 0;
};

const loadSeasons = async (orgId) => {
  const res = await getSeasons({ org_id: orgId, active: true });
  const seasons = res.data?.data?.seasons ?? res.data?.seasons ?? [];
  activeSeason.value = seasons[0] ?? null;
};

const loadFinance = async (orgId) => {
  const res = await getPaymentStats(orgId);
  const stats = res.data?.data?.stats ?? res.data?.stats ?? {};
  kpis.totalPending = stats.total_pending ?? 0;
  kpis.overdueAmount = stats.overdue_amount ?? 0;
  kpis.clubsAlDia = stats.clubs_al_dia ?? 0;
  kpis.clubsPendientes = stats.clubs_pendientes ?? 0;
  kpis.clubsMorosos = stats.clubs_morosos ?? 0;
};

const loadTransfers = async () => {
  const summary = await transfersService.getSummaryKpis();
  kpis.transfersPending = summary?.by_status?.PENDING ?? 0;
};

const loadAll = async () => {
  const orgId = authStore.state.org?.id;
  if (!orgId) return;
  loading.value = true;
  loadError.value = '';
  const results = await Promise.allSettled([
    loadClubs(orgId),
    loadPlayers(orgId),
    loadSeries(orgId),
    loadTournaments(orgId),
    loadSeasons(orgId),
    loadFinance(orgId),
    loadTransfers(),
  ]);
  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    console.error('[Home] KPI load errors:', failed.map((r) => r.reason));
    loadError.value = 'Algunos indicadores no pudieron cargarse completamente.';
  }
  loading.value = false;
};

onMounted(loadAll);
</script>

<style scoped>
.home-eyebrow {
  margin: 0 0 4px;
  color: var(--primary-solid);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.kpi-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
  text-decoration: none;
  color: inherit;
}

.kpi-card-link {
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.kpi-card-link:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}
.kpi-card-link:focus-visible {
  outline: 3px solid var(--primary-solid);
  outline-offset: 2px;
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
  font-variant-numeric: tabular-nums;
}
.kpi-value-text { font-size: 1.15rem; }
.kpi-sub { font-size: 0.75rem; color: var(--text-muted); }
.kpi-badge { align-self: flex-start; margin-top: 2px; }

.kpi-card-split { justify-content: space-between; }
.kpi-split-row { display: flex; gap: 16px; flex-wrap: wrap; }
.kpi-split-item { display: flex; flex-direction: column; }
.kpi-value-sm { font-size: 1.35rem; font-variant-numeric: tabular-nums; }
.kpi-split-label { font-size: 0.72rem; color: var(--text-muted); }

.stat-blue  { color: var(--sport-blue, #38bdf8); }
.stat-green { color: var(--sport-green, #18d66b); }
.kpi-warning { color: var(--sport-gold, #f6c945); }
.kpi-danger  { color: var(--accent-red, #f87171); }

.mt-xs { margin-top: 4px; }
</style>
