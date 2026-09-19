<template>
  <div class="container mt-md">
    <div class="flex justify-between items-center mb-lg">
      <h2>Fixture — {{ tournament?.name || '' }}</h2>
      <button class="btn btn-secondary" @click="$router.push(backTarget)">&larr; Torneo</button>
    </div>

    <div v-if="error" class="alert alert-error mb-md">{{ error }}</div>

    <div v-if="matchdays.length === 0 && !loading" class="card text-center py-lg">
      Aún no se ha generado el fixture de este torneo.
    </div>

    <div v-if="matchdays.length > 0" class="tabs mb-md">
      <button
        v-for="(md, idx) in matchdays"
        :key="md.id"
        class="tab-btn"
        :class="{ active: idx === currentIndex }"
        @click="currentIndex = idx"
      >
        {{ md.name || `Fecha ${md.number}` }}
      </button>
    </div>

    <div v-if="currentMatchday" class="card mb-md">
      <div class="flex justify-between items-center mb-md">
        <button class="btn btn-sm btn-secondary" :disabled="currentIndex === 0" @click="currentIndex--">&larr; Anterior</button>
        <div class="text-center">
          <h3 class="m-0">{{ currentMatchday.name || `Fecha ${currentMatchday.number}` }}</h3>
          <span class="text-muted text-sm">{{ formatDate(currentMatchday.date) }}</span>
        </div>
        <button class="btn btn-sm btn-secondary" :disabled="currentIndex === matchdays.length - 1" @click="currentIndex++">Siguiente &rarr;</button>
      </div>

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Local</th>
              <th class="text-center">Resultado</th>
              <th>Visita</th>
              <th class="text-center">Horario</th>
              <th class="text-center">Estado</th>
              <th title="Cancha / Árbitro">Cancha/Árb.</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="match in matchesByMatchday(currentMatchday.id)" :key="match.id">
              <td>{{ seriesLabel(match.home_series) || (match.status === 'WALKOVER' ? '(bye)' : 'Por definir') }}</td>
              <td class="text-center">
                <span v-if="match.status === 'FINISHED' || match.status === 'WALKOVER'">
                  {{ match.home_score ?? '—' }} - {{ match.away_score ?? '—' }}
                </span>
                <span v-else class="text-muted">vs</span>
              </td>
              <td>{{ seriesLabel(match.away_series) || (match.status === 'WALKOVER' ? '' : 'Por definir') }}</td>
              <td class="text-center text-sm">{{ match.match_time ? match.match_time.slice(0, 5) : '—' }}</td>
              <td class="text-center">
                <span class="status-badge" :class="`status-badge--${match.status?.toLowerCase()}`">{{ statusLabel(match.status) }}</span>
              </td>
              <td class="text-sm text-muted">
                {{ match.venue?.name || 'Sin cancha' }}<br />
                {{ match.referee?.full_name || 'Sin árbitro' }}
              </td>
              <td>
                <ActionsMenu>
                  <button
                    class="btn btn-sm btn-secondary"
                    :disabled="!match.home_series_id || !match.away_series_id"
                    @click="$router.push(`/matches/${match.id}`)"
                  >
                    Planilla
                  </button>
                </ActionsMenu>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile: tarjetas -->
      <div class="data-cards">
        <article v-for="match in matchesByMatchday(currentMatchday.id)" :key="match.id" class="data-card">
          <div class="data-card__header">
            <div class="data-card__heading">
              <div class="data-card__title">
                {{ seriesLabel(match.home_series) || (match.status === 'WALKOVER' ? '(bye)' : 'Por definir') }}
                vs
                {{ seriesLabel(match.away_series) || (match.status === 'WALKOVER' ? '' : 'Por definir') }}
              </div>
              <div class="data-card__subtitle">
                <span v-if="match.status === 'FINISHED' || match.status === 'WALKOVER'">
                  Resultado: {{ match.home_score ?? '—' }} - {{ match.away_score ?? '—' }}
                </span>
                <span v-else>Sin resultado</span>
              </div>
            </div>
            <span class="status-badge" :class="`status-badge--${match.status?.toLowerCase()}`">{{ statusLabel(match.status) }}</span>
          </div>
          <div class="data-card__body">
            <div class="data-card__row">
              <span class="data-card__row-label">Horario</span>
              <span class="data-card__row-value">{{ match.match_time ? match.match_time.slice(0, 5) : 'Sin horario' }}</span>
            </div>
            <div class="data-card__row">
              <span class="data-card__row-label">Cancha/Árb.</span>
              <span class="data-card__row-value">{{ match.venue?.name || 'Sin cancha' }} · {{ match.referee?.full_name || 'Sin árbitro' }}</span>
            </div>
          </div>
          <div class="data-card__footer">
            <ActionsMenu>
              <button
                class="btn btn-sm btn-secondary"
                :disabled="!match.home_series_id || !match.away_series_id"
                @click="$router.push(`/matches/${match.id}`)"
              >
                Planilla
              </button>
            </ActionsMenu>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useMatchesStore } from '../stores/matches';
import { useTournamentsStore } from '../stores/tournaments';
import ActionsMenu from '../components/ActionsMenu.vue';

const route = useRoute();
const tournamentId = route.params.tournamentId;

// Un admin de club accede acá vía /clubs/:clubId/tournaments/:id/fixture
// (mismo componente, ruta alternativa sin orgAdminOnly) y vuelve al detalle
// de torneo del club en vez del detalle de administración de la org.
const clubIdParam = route.params.clubId || null;
const backTarget = computed(() => clubIdParam ? `/clubs/${clubIdParam}/tournaments/${tournamentId}` : `/tournaments/${tournamentId}`);

const { matchdays, items, loading, error, fetchMatchdays, fetchMatches } = useMatchesStore();
const { current: tournament, fetchTournamentById } = useTournamentsStore();

const STATUS_LABELS = {
  SCHEDULED: 'Programado', IN_PROGRESS: 'En juego', FINISHED: 'Finalizado',
  POSTPONED: 'Postergado', WALKOVER: 'Walkover', CANCELLED: 'Cancelado',
};
const statusLabel = (v) => STATUS_LABELS[v] || v;

const seriesLabel = (series) => (series ? `${series.club?.name ?? ''} — ${series.name}` : '');

const matchesByMatchday = (matchdayId) => items.value.filter((m) => m.matchday_id === matchdayId);

const formatDate = (dateStr) => {
  if (!dateStr) return 'Sin fecha';
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 'Sin fecha';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
};

const currentIndex = ref(0);
const currentMatchday = computed(() => matchdays.value[currentIndex.value] || null);

watch(matchdays, (list) => {
  if (currentIndex.value >= list.length) currentIndex.value = 0;
});

onMounted(async () => {
  await Promise.all([
    fetchTournamentById(tournamentId),
    fetchMatchdays(tournamentId),
    fetchMatches(tournamentId, {}),
  ]);
});
</script>

<style scoped>
.py-lg { padding-top: var(--spacing-lg); padding-bottom: var(--spacing-lg); }
.btn-sm { padding: 0.4rem 0.8rem; font-size: 0.875rem; }

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
