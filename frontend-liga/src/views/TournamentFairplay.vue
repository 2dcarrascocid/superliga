<template>
  <div class="container mt-md">
    <div class="flex justify-between items-center mb-lg">
      <h2>Ranking de Fairplay</h2>
      <button class="btn btn-secondary" @click="$router.push(backTarget)">&larr; {{ backLabel }}</button>
    </div>

    <div v-if="error" class="alert alert-error mb-md">{{ error }}</div>

    <div v-if="!loading && fairplay.length === 0" class="card text-center py-lg">
      Aún no hay equipos inscritos en este torneo.
    </div>

    <div v-else class="card p-0">
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th class="text-center">#</th>
              <th>Equipo</th>
              <th class="text-center" title="Amarillas">TA</th>
              <th class="text-center" title="Rojas">TR</th>
              <th class="text-center" title="Amonestaciones">Amon.</th>
              <th class="text-center">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in fairplay" :key="row.series_id">
              <td class="text-center font-bold">{{ row.position }}</td>
              <td class="font-medium">{{ row.club_name }} — {{ row.series_name }}</td>
              <td class="text-center">{{ row.yellow_cards }}</td>
              <td class="text-center">{{ row.red_cards }}</td>
              <td class="text-center">{{ row.warnings }}</td>
              <td class="text-center font-bold">{{ row.total }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile: tarjetas -->
      <div class="data-cards p-md">
        <article v-for="row in fairplay" :key="row.series_id" class="data-card">
          <div class="data-card__header">
            <div class="data-card__heading">
              <div class="data-card__title">#{{ row.position }} {{ row.club_name }} — {{ row.series_name }}</div>
            </div>
            <span class="total-badge">{{ row.total }} pts</span>
          </div>
          <div class="data-card__body">
            <div class="data-card__row">
              <span class="data-card__row-label">TA/TR/Amon.</span>
              <span class="data-card__row-value">{{ row.yellow_cards }}/{{ row.red_cards }}/{{ row.warnings }}</span>
            </div>
          </div>
        </article>
      </div>
    </div>
    <p class="text-muted text-sm mt-md">Menos sanciones = mejor ubicación en el ranking.</p>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useMatchesStore } from '../stores/matches';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const tournamentId = route.params.tournamentId;
const authStore = useAuthStore();

const { fairplay, loading, error, fetchFairplayRanking } = useMatchesStore();

// Ver nota equivalente en TournamentStandings.vue: un Jugador puro accede acá
// vía /mi-perfil/torneos/:id/fairplay (orgAdminOnly no aplica a esa ruta),
// y un admin de club vía /clubs/:clubId/tournaments/:id/fairplay.
const clubIdParam = route.params.clubId || null;
const isPlayerOnly = computed(() => !!authStore.state.player && !authStore.state.org && !authStore.myClub());
const backTarget = computed(() => {
  if (clubIdParam) return `/clubs/${clubIdParam}/tournaments/${tournamentId}`;
  return isPlayerOnly.value ? '/mi-perfil' : `/tournaments/${tournamentId}`;
});
const backLabel = computed(() => (!clubIdParam && isPlayerOnly.value) ? 'Mi perfil' : 'Torneo');

onMounted(() => {
  fetchFairplayRanking(tournamentId);
});
</script>

<style scoped>
.p-0 { padding: 0 !important; }
.py-lg { padding-top: var(--spacing-lg); padding-bottom: var(--spacing-lg); }
.font-medium { font-weight: 500; }

.total-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
  flex-shrink: 0;
}
</style>
