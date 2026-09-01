<template>
  <div class="container mt-md">
    <div class="flex justify-between items-center mb-lg">
      <h2>Fixture — {{ tournament?.name || '' }}</h2>
      <button class="btn btn-secondary" @click="$router.push(`/tournaments/${tournamentId}`)">&larr; Torneo</button>
    </div>

    <div v-if="error" class="alert alert-error mb-md">{{ error }}</div>

    <div v-if="matchdays.length === 0 && !loading" class="card text-center py-lg">
      Aún no se ha generado el fixture de este torneo.
    </div>

    <div v-for="matchday in matchdays" :key="matchday.id" class="card mb-md">
      <div class="flex justify-between items-center mb-md">
        <h3 class="m-0">{{ matchday.name || `Fecha ${matchday.number}` }}</h3>
        <span class="text-muted text-sm">{{ matchday.date || 'Sin fecha' }}</span>
      </div>

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Local</th>
              <th class="text-center">Resultado</th>
              <th>Visita</th>
              <th>Grupo</th>
              <th class="text-center">Estado</th>
              <th>Cancha / Árbitro</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="match in matchesByMatchday(matchday.id)" :key="match.id">
              <td>{{ seriesLabel(match.home_series) || (match.status === 'WALKOVER' ? '(bye)' : 'Por definir') }}</td>
              <td class="text-center">
                <span v-if="match.status === 'FINISHED' || match.status === 'WALKOVER'">
                  {{ match.home_score ?? '—' }} - {{ match.away_score ?? '—' }}
                </span>
                <span v-else class="text-muted">vs</span>
              </td>
              <td>{{ seriesLabel(match.away_series) || (match.status === 'WALKOVER' ? '' : 'Por definir') }}</td>
              <td>{{ match.group_name || '—' }}</td>
              <td class="text-center">
                <span class="status-badge" :class="`status-badge--${match.status?.toLowerCase()}`">{{ statusLabel(match.status) }}</span>
              </td>
              <td class="text-sm text-muted">
                {{ match.venue?.name || 'Sin cancha' }}<br />
                {{ match.referee?.full_name || 'Sin árbitro' }}
              </td>
              <td>
                <button
                  class="btn btn-sm btn-secondary"
                  :disabled="!match.home_series_id || !match.away_series_id"
                  @click="$router.push(`/matches/${match.id}`)"
                >
                  Planilla
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useMatchesStore } from '../stores/matches';
import { useTournamentsStore } from '../stores/tournaments';

const route = useRoute();
const tournamentId = route.params.tournamentId;

const { matchdays, items, loading, error, fetchMatchdays, fetchMatches } = useMatchesStore();
const { current: tournament, fetchTournamentById } = useTournamentsStore();

const STATUS_LABELS = {
  SCHEDULED: 'Programado', IN_PROGRESS: 'En juego', FINISHED: 'Finalizado',
  POSTPONED: 'Postergado', WALKOVER: 'Walkover', CANCELLED: 'Cancelado',
};
const statusLabel = (v) => STATUS_LABELS[v] || v;

const seriesLabel = (series) => (series ? `${series.club?.name ?? ''} — ${series.name}` : '');

const matchesByMatchday = (matchdayId) => items.value.filter((m) => m.matchday_id === matchdayId);

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
