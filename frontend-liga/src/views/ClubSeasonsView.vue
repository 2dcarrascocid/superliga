<template>
  <div class="container mt-md">
    <div class="flex justify-between items-center mb-lg flex-wrap gap-md">
      <div class="flex items-center gap-md">
        <button class="btn btn-secondary btn-sm" @click="router.push(`/clubs/${clubId}/series`)">&larr; Club</button>
        <h2>Temporadas <span v-if="club"> — {{ club.name }}</span></h2>
      </div>
    </div>

    <div v-if="error" class="alert alert-error mb-md">{{ error }}</div>

    <div v-if="loading" class="card text-center py-lg">Cargando temporadas...</div>
    <div v-else-if="seasons.length === 0" class="card text-center py-lg text-muted">
      Aún no hay temporadas creadas en la organización.
    </div>

    <div v-for="season in seasons" :key="season.id" class="card mb-lg p-0">
      <div class="flex justify-between items-center p-md" style="border-bottom: 1px solid var(--border-color);">
        <div class="flex items-center gap-sm">
          <h3 class="m-0">{{ season.name }}</h3>
          <span class="status-badge" :class="season.active ? 'status-badge--active' : 'status-badge--inactive'">
            {{ season.active ? 'Activa' : 'Cerrada' }}
          </span>
        </div>
        <span class="text-muted text-sm">{{ tournamentsBySeason[season.id]?.length ?? 0 }} torneo(s)</span>
      </div>

      <div v-if="!tournamentsBySeason[season.id]?.length" class="text-center py-lg text-muted text-sm">
        Sin torneos en esta temporada.
      </div>

      <template v-else>
        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Categoría</th>
                <th class="text-center">Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="tournament in tournamentsBySeason[season.id]" :key="tournament.id" class="clickable-row" @click="openTournament(tournament.id)">
                <td><span class="font-medium">{{ tournament.name }}</span></td>
                <td>{{ tournament.category?.name || '—' }}</td>
                <td class="text-center">
                  <span class="status-badge" :class="`status-badge--${tournament.status?.toLowerCase()}`">
                    {{ TOURNAMENT_STATUS_LABELS[tournament.status] || tournament.status }}
                  </span>
                </td>
                <td>
                  <button class="btn btn-sm btn-secondary" @click.stop="openTournament(tournament.id)">Ver detalle</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Mobile: tarjetas -->
        <div class="data-cards p-md">
          <article v-for="tournament in tournamentsBySeason[season.id]" :key="tournament.id" class="data-card clickable-row" @click="openTournament(tournament.id)">
            <div class="data-card__header">
              <div class="data-card__heading">
                <div class="data-card__title">{{ tournament.name }}</div>
                <div class="data-card__subtitle">{{ tournament.category?.name || 'Sin categoría' }}</div>
              </div>
              <span class="status-badge" :class="`status-badge--${tournament.status?.toLowerCase()}`">
                {{ TOURNAMENT_STATUS_LABELS[tournament.status] || tournament.status }}
              </span>
            </div>
            <div class="data-card__footer" @click.stop>
              <button class="btn btn-sm btn-secondary" @click.stop="openTournament(tournament.id)">Ver detalle</button>
            </div>
          </article>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getClubById } from '../services/clubs.service.js';
import { getSeasons } from '../services/seasons.service.js';
import { getTournaments } from '../services/tournaments.service.js';

const route = useRoute();
const router = useRouter();
const clubId = route.params.clubId;

const club = ref(null);
const seasons = ref([]);
const tournaments = ref([]);
const loading = ref(true);
const error = ref(null);

const TOURNAMENT_STATUS_LABELS = {
  DRAFT: 'Borrador', REGISTRATION: 'Inscripciones', IN_PROGRESS: 'En curso', FINISHED: 'Finalizado', CANCELLED: 'Cancelado',
};

const tournamentsBySeason = computed(() => {
  const map = {};
  for (const t of tournaments.value) {
    if (!t.season_id) continue;
    if (!map[t.season_id]) map[t.season_id] = [];
    map[t.season_id].push(t);
  }
  return map;
});

const openTournament = (tournamentId) => router.push(`/clubs/${clubId}/tournaments/${tournamentId}`);

onMounted(async () => {
  loading.value = true;
  try {
    const clubRes = await getClubById(clubId);
    club.value = clubRes.data?.data?.club ?? null;
    const orgId = club.value?.org_id;
    const [seasonsRes, tournamentsRes] = await Promise.all([
      getSeasons({ org_id: orgId }),
      getTournaments({ org_id: orgId, limit: 200 }),
    ]);
    seasons.value = (seasonsRes.data?.data?.seasons ?? seasonsRes.data?.seasons ?? [])
      .slice()
      .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
    tournaments.value = tournamentsRes.data?.data?.tournaments ?? tournamentsRes.data?.tournaments ?? [];
  } catch (e) {
    error.value = e.response?.data?.error?.message || 'No fue posible cargar las temporadas y torneos.';
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.p-0 { padding: 0 !important; }
.py-lg { padding-top: var(--spacing-lg); padding-bottom: var(--spacing-lg); }
.font-medium { font-weight: 500; }
.btn-sm { padding: 0.4rem 0.8rem; font-size: 0.875rem; }

.clickable-row { cursor: pointer; }
.clickable-row:hover { background: var(--surface-hover, rgba(255,255,255,0.03)); }

.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 700;
}
.status-badge--active       { background: rgba(0, 230, 118, 0.14); color: var(--primary-solid, #00e676); }
.status-badge--inactive     { background: rgba(255, 255, 255, 0.08); color: var(--text-muted); }
.status-badge--draft        { background: rgba(255, 255, 255, 0.08); color: var(--text-muted); }
.status-badge--registration { background: rgba(79, 195, 247, 0.16); color: #4fc3f7; }
.status-badge--in_progress  { background: rgba(0, 230, 118, 0.14); color: var(--primary-solid, #00e676); }
.status-badge--finished     { background: rgba(255, 213, 79, 0.16); color: #ffd54f; }
.status-badge--cancelled    { background: rgba(239, 83, 80, 0.14); color: #ef5350; }
</style>
