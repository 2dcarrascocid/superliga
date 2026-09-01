<template>
  <div class="container mt-md">
    <div class="flex justify-between items-center mb-lg">
      <h2>Tabla de Posiciones</h2>
      <button class="btn btn-secondary" @click="$router.push(backTarget)">&larr; {{ backLabel }}</button>
    </div>

    <div v-if="error" class="alert alert-error mb-md">{{ error }}</div>

    <div v-if="!loading && groupedStandings.length === 0" class="card text-center py-lg">
      Aún no hay partidos finalizados para calcular la tabla de posiciones.
    </div>

    <div v-for="group in groupedStandings" :key="group.key" class="card mb-md p-0">
      <div class="flex justify-between items-center p-md" style="border-bottom: 1px solid var(--border-color);">
        <h3 class="m-0">{{ group.label }}</h3>
      </div>
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th class="text-center">#</th>
              <th>Equipo</th>
              <th class="text-center">PJ</th>
              <th class="text-center">PG</th>
              <th class="text-center">PE</th>
              <th class="text-center">PP</th>
              <th class="text-center">GF</th>
              <th class="text-center">GC</th>
              <th class="text-center">DG</th>
              <th class="text-center">PTS</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in group.rows" :key="row.series_id">
              <td class="text-center font-bold">{{ row.position }}</td>
              <td class="font-medium">{{ row.club_name }} — {{ row.series_name }}</td>
              <td class="text-center">{{ row.played }}</td>
              <td class="text-center">{{ row.won }}</td>
              <td class="text-center">{{ row.drawn }}</td>
              <td class="text-center">{{ row.lost }}</td>
              <td class="text-center">{{ row.goals_for }}</td>
              <td class="text-center">{{ row.goals_against }}</td>
              <td class="text-center">{{ row.goal_diff > 0 ? '+' : '' }}{{ row.goal_diff }}</td>
              <td class="text-center font-bold">{{ row.points }}</td>
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
import { useTournamentsStore } from '../stores/tournaments';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const tournamentId = route.params.tournamentId;
const authStore = useAuthStore();

const { standings, loading, error, fetchStandings } = useTournamentsStore();

// Un Jugador puro (sin org ni club admin) no tiene acceso a /tournaments/:id
// (orgAdminOnly) — accede a esta vista vía /mi-perfil/torneos/:id/posiciones
// (misma tabla, ruta alternativa, ver router/index.js). Su botón "volver"
// debe llevarlo de vuelta a su perfil, no al detalle de torneo.
const isPlayerOnly = computed(() => !!authStore.state.player && !authStore.state.org && !authStore.myClub());
const backTarget = computed(() => isPlayerOnly.value ? '/mi-perfil' : `/tournaments/${tournamentId}`);
const backLabel = computed(() => isPlayerOnly.value ? 'Mi perfil' : 'Torneo');

const groupedStandings = computed(() => {
  const groups = {};
  for (const row of standings.value) {
    const key = `${row.stage_id}-${row.group_name || '_'}`;
    if (!groups[key]) {
      groups[key] = {
        key,
        label: row.group_name ? `Grupo ${row.group_name}` : 'Clasificación General',
        rows: [],
      };
    }
    groups[key].rows.push(row);
  }
  return Object.values(groups);
});

onMounted(() => {
  fetchStandings(tournamentId, {});
});
</script>

<style scoped>
.p-0 { padding: 0 !important; }
.py-lg { padding-top: var(--spacing-lg); padding-bottom: var(--spacing-lg); }
.font-medium { font-weight: 500; }
</style>
