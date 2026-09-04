<template>
  <main class="container club-tournament">
    <button class="btn btn-secondary club-tournament__back" @click="router.push(`/clubs/${clubId}/series`)">← Volver a series</button>
    <div v-if="loading" class="card club-tournament__state" role="status">Cargando torneo…</div>
    <div v-else-if="error" class="alert alert-error" role="alert">{{ error }}</div>
    <template v-else-if="tournament">
      <TournamentSummaryCard :tournament="tournament" />
      <TournamentRegisteredClubsTable :participants="participants" />
    </template>
  </main>
</template>
<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getClubTournamentDetail } from '../services/tournaments.service';
import TournamentSummaryCard from '../components/TournamentSummaryCard.vue';
import TournamentRegisteredClubsTable from '../components/TournamentRegisteredClubsTable.vue';

const route = useRoute(); const router = useRouter();
const clubId = route.params.clubId; const tournamentId = route.params.tournamentId;
const tournament = ref(null); const participants = ref([]); const loading = ref(true); const error = ref('');
onMounted(async () => {
  try {
    const response = await getClubTournamentDetail(clubId, tournamentId);
    const data = response.data?.data ?? response.data;
    tournament.value = data?.tournament ?? null;
    participants.value = data?.participants ?? [];
    if (!tournament.value) error.value = 'No fue posible cargar el torneo.';
  } catch (requestError) {
    error.value = requestError.response?.data?.error?.message || 'No fue posible cargar el torneo.';
  } finally { loading.value = false; }
});
</script>
<style scoped>
.club-tournament { display: grid; gap: 16px; padding-top: 24px; padding-bottom: 40px; }
.club-tournament__back { justify-self: start; }.club-tournament__state { padding: 40px; text-align: center; color: var(--text-muted); }
</style>
