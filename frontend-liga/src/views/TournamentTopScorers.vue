<template>
  <div class="container mt-md">
    <div class="flex justify-between items-center mb-lg">
      <h2>Clasificación de Goleadores</h2>
      <button class="btn btn-secondary" @click="$router.push(backTarget)">&larr; {{ backLabel }}</button>
    </div>

    <div v-if="error" class="alert alert-error mb-md">{{ error }}</div>

    <div v-if="!loading && scorers.length === 0" class="card text-center py-lg">
      Aún no hay goles registrados en este torneo.
    </div>

    <div v-else class="card p-0">
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th class="text-center">#</th>
              <th>Jugador</th>
              <th>Equipo</th>
              <th class="text-center">Goles</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in scorers" :key="row.player_id">
              <td class="text-center font-bold">{{ row.position }}</td>
              <td class="font-medium">{{ row.player_name }}</td>
              <td>{{ row.club_name }} — {{ row.series_name }}</td>
              <td class="text-center font-bold">{{ row.goals }}</td>
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
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const tournamentId = route.params.tournamentId;
const authStore = useAuthStore();

const { scorers, loading, error, fetchTopScorers } = useMatchesStore();

// Ver nota equivalente en TournamentStandings.vue: un Jugador puro accede acá
// vía /mi-perfil/torneos/:id/goleadores (orgAdminOnly no aplica a esa ruta).
const isPlayerOnly = computed(() => !!authStore.state.player && !authStore.state.org && !authStore.myClub());
const backTarget = computed(() => isPlayerOnly.value ? '/mi-perfil' : `/tournaments/${tournamentId}`);
const backLabel = computed(() => isPlayerOnly.value ? 'Mi perfil' : 'Torneo');

onMounted(() => {
  fetchTopScorers(tournamentId);
});
</script>

<style scoped>
.p-0 { padding: 0 !important; }
.py-lg { padding-top: var(--spacing-lg); padding-bottom: var(--spacing-lg); }
.font-medium { font-weight: 500; }
</style>
