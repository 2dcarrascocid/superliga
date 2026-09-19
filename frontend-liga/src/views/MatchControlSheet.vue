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

    <div class="tabs mb-md">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-btn"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <MatchLogisticsPanel
      v-show="activeTab === 'logistics'"
      :match-id="matchId"
      :venues="venues"
      :referees="referees"
    />

    <MatchResultPanel
      v-show="activeTab === 'result'"
      :match-id="matchId"
    />

    <MatchEventsPanel
      v-show="activeTab === 'events'"
      :match-id="matchId"
      :roster-by-series="rosterBySeries"
      @request-roster="loadRoster"
    />

    <MatchDocuments
      v-show="activeTab === 'documents'"
      :match-id="matchId"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMatchesStore } from '../stores/matches';
import { useAuthStore } from '../stores/auth';
import { getVenues } from '../services/venues.service';
import { getReferees } from '../services/referees.service';
import { getSeriesRoster } from '../services/clubSeries.service';
import MatchLogisticsPanel from '../components/MatchLogisticsPanel.vue';
import MatchResultPanel from '../components/MatchResultPanel.vue';
import MatchEventsPanel from '../components/MatchEventsPanel.vue';
import MatchDocuments from '../components/MatchDocuments.vue';

const route = useRoute();
const router = useRouter();
const matchId = route.params.matchId;

const { current, error, fetchMatchById, fetchEvents } = useMatchesStore();
const authStore = useAuthStore();

const venues = ref([]);
const referees = ref([]);
const rosterBySeries = ref({});

const tabs = [
  { id: 'logistics', label: 'Logística' },
  { id: 'result', label: 'Resultado' },
  { id: 'events', label: 'Goles, Tarjetas y Amonestaciones' },
  { id: 'documents', label: 'Adjuntos' },
];
const activeTab = ref('logistics');

const STATUS_LABELS = {
  SCHEDULED: 'Programado', IN_PROGRESS: 'En juego', FINISHED: 'Finalizado',
  POSTPONED: 'Postergado', WALKOVER: 'Walkover', CANCELLED: 'Cancelado',
};
const statusLabel = (v) => STATUS_LABELS[v] || v;
const seriesLabel = (series) => (series ? `${series.club?.name ?? ''} — ${series.name}` : '');

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

const goBack = () => router.back();

onMounted(async () => {
  await fetchMatchById(matchId);
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
