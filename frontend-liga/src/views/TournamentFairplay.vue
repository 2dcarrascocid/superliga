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
              <th class="text-center">Amarillas</th>
              <th class="text-center">Rojas</th>
              <th class="text-center">Amonestaciones</th>
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
// vía /mi-perfil/torneos/:id/fairplay (orgAdminOnly no aplica a esa ruta).
const isPlayerOnly = computed(() => !!authStore.state.player && !authStore.state.org && !authStore.myClub());
const backTarget = computed(() => isPlayerOnly.value ? '/mi-perfil' : `/tournaments/${tournamentId}`);
const backLabel = computed(() => isPlayerOnly.value ? 'Mi perfil' : 'Torneo');

onMounted(() => {
  fetchFairplayRanking(tournamentId);
});
</script>

<style scoped>
.p-0 { padding: 0 !important; }
.py-lg { padding-top: var(--spacing-lg); padding-bottom: var(--spacing-lg); }
.font-medium { font-weight: 500; }
</style>
