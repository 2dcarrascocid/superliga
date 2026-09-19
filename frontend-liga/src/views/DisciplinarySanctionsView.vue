<template>
  <div class="container mt-md">
    <div class="flex justify-between items-center mb-lg">
      <h2>Sancionados vigentes</h2>
    </div>

    <p class="text-muted text-sm mb-lg">
      Clubes, equipos, jugadores y cuerpo técnico con una sanción disciplinaria vigente. Las suspensiones por
      partidos se descuentan automáticamente a medida que el equipo disputa partidos oficiales del torneo.
    </p>

    <div v-if="loadError" class="alert alert-error">{{ loadError }}</div>

    <div class="filters-row mb-lg">
      <select v-model="filters.tournament_id" class="input" @change="reload">
        <option value="">Todos los torneos</option>
        <option v-for="t in tournaments" :key="t.id" :value="t.id">{{ t.name }}</option>
      </select>
      <select v-model="filters.sanctioned_type" class="input" @change="reload">
        <option value="">Todos los tipos</option>
        <option value="CLUB">Club</option>
        <option value="TEAM">Equipo / Serie</option>
        <option value="PLAYER">Jugador</option>
        <option value="COACH">Cuerpo técnico</option>
      </select>
    </div>

    <div class="card p-0">
      <div class="flex justify-between items-center p-md" style="border-bottom: 1px solid var(--border-color);">
        <h3 class="m-0">Castigos vigentes</h3>
        <span class="text-muted text-sm">{{ sanctionedTotal }} en total</span>
      </div>
      <div class="table-container">
        <table class="table">
          <thead>
            <tr><th>Club</th><th>Tipo</th><th>Motivo</th><th>Sanción</th><th>Situación</th></tr>
          </thead>
          <tbody>
            <tr v-if="loading && !sanctioned.length"><td colspan="5" class="text-center py-lg">Cargando...</td></tr>
            <tr v-for="s in sanctioned" :key="s.resolution_id">
              <td>{{ s.club_name || '—' }}</td>
              <td><span class="badge badge-secondary">{{ sanctionedTypeLabel(s.sanctioned_type) }}</span></td>
              <td>
                <div>{{ s.case_title }}</div>
                <div v-if="s.article_code" class="text-muted text-sm">Art. {{ s.article_code }}<span v-if="s.infraction_name"> — {{ s.infraction_name }}</span></div>
              </td>
              <td>{{ sanctionKindLabel(s.sanction_kind) }}</td>
              <td>
                <span v-if="s.sanction_kind === 'MATCHES_SUSPENSION'">{{ s.matches_remaining }} de {{ s.quantity }} fechas restantes</span>
                <span v-else-if="s.sanction_kind === 'DAYS_SUSPENSION'">Hasta {{ formatDate(s.end_date) }}</span>
                <span v-else>{{ s.quantity }}</span>
              </td>
            </tr>
            <tr v-if="!loading && !sanctioned.length"><td colspan="5" class="text-center text-muted py-lg">Sin sanciones vigentes.</td></tr>
          </tbody>
        </table>
      </div>
      <div v-if="sanctionedNextToken" class="p-md text-center">
        <button type="button" class="btn btn-secondary btn-sm" :disabled="loading" @click="loadMore">Cargar más</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useDisciplinaryStore } from '../stores/disciplinary';
import { getTournaments } from '../services/tournaments.service';

const authStore = useAuthStore();
const disciplinaryStore = useDisciplinaryStore();

const orgId = computed(() => authStore.state.org?.id);
const club = computed(() => authStore.myClub());
const loading = computed(() => disciplinaryStore.state.loading);
const loadError = ref('');

const sanctioned = computed(() => disciplinaryStore.state.sanctioned || []);
const sanctionedTotal = computed(() => disciplinaryStore.state.sanctionedTotal || 0);
const sanctionedNextToken = computed(() => disciplinaryStore.state.sanctionedNextToken);

const tournaments = ref([]);
const filters = reactive({ tournament_id: '', sanctioned_type: '' });

const SANCTIONED_TYPE_LABELS = { CLUB: 'Club', TEAM: 'Equipo/Serie', PLAYER: 'Jugador', COACH: 'Cuerpo técnico' };
const sanctionedTypeLabel = (t) => SANCTIONED_TYPE_LABELS[t] || t;

const SANCTION_KIND_LABELS = {
  MATCHES_SUSPENSION: 'Suspensión por partidos', DAYS_SUSPENSION: 'Suspensión por días', FINE: 'Multa económica',
  POINTS_DEDUCTION: 'Quita de puntos', WALKOVER: 'Pérdida de partido (W.O.)', LOCALIA_SUSPENSION: 'Suspensión de localía',
  DISQUALIFICATION: 'Descalificación', EXPULSION: 'Expulsión de la liga',
};
const sanctionKindLabel = (k) => SANCTION_KIND_LABELS[k] || k;

const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString('es-CL') : '—');

const reload = async () => {
  try {
    await disciplinaryStore.fetchSanctioned(orgId.value, {
      tournament_id: filters.tournament_id || undefined,
      sanctioned_type: filters.sanctioned_type || undefined,
      club_id: club.value ? club.value.id : undefined,
      limit: 20,
    });
  } catch (error) {
    loadError.value = disciplinaryStore.state.error || 'No se pudieron cargar los sancionados.';
  }
};

const loadMore = async () => {
  if (!sanctionedNextToken.value) return;
  await disciplinaryStore.fetchSanctioned(orgId.value, {
    tournament_id: filters.tournament_id || undefined,
    sanctioned_type: filters.sanctioned_type || undefined,
    club_id: club.value ? club.value.id : undefined,
    limit: 20,
    next_token: sanctionedNextToken.value,
  });
};

onMounted(async () => {
  try {
    const res = await getTournaments({ org_id: orgId.value });
    tournaments.value = res.data?.data?.tournaments ?? res.data?.tournaments ?? [];
    await reload();
  } catch (error) {
    loadError.value = disciplinaryStore.state.error || 'No se pudo cargar la información.';
  }
});
</script>

<style scoped>
.filters-row { display: flex; gap: 12px; flex-wrap: wrap; }
.filters-row .input { max-width: 260px; }
.p-0 { padding: 0 !important; }
.py-lg { padding-top: var(--spacing-lg); padding-bottom: var(--spacing-lg); }

@media (max-width: 640px) {
  .filters-row .input { max-width: 100%; flex: 1 1 100%; }
}
</style>
