<template>
  <main class="container club-series">
    <ClubHeader :club-id="clubId" :club="club" active-tab-key="series" :tabs="clubTabs" @tab-click="onHeaderTabClick" />
    <div class="club-series__heading">
      <div><p class="club-series__eyebrow">Gestión deportiva</p><h1>Series — {{ club?.name || '' }}</h1></div>
      <div class="club-series__actions"><button class="btn btn-primary" @click="openCreateModal">Nueva serie</button><button class="btn btn-secondary" @click="router.push(`/clubs/${clubId}`)">← Club</button></div>
    </div>
    <div v-if="error" class="alert alert-error" role="alert">{{ error }}</div>
    <ClubSeriesTable v-if="!selectedSeries" :items="items" :selected-series-id="selectedSeries?.id ?? null" @select="selectedSeries = $event" @edit="openEditModal" @delete="onDeleteSeries" />
    <SeriesRosterDetail v-else :series="selectedSeries" :club-roster="clubRoster" @back="selectedSeries = null" />
    <ActiveTournamentsTable :tournaments="availableTournaments" :series-items="items" :selection="seriesSelection" :eligibility="eligibilityByTournament" :checking-tournament-id="checkingTournamentId" :registering-tournament-id="registeringTournamentId" :loading="tournamentsLoading" :error="tournamentsError" @refresh="refreshTournaments" @view="viewTournament" @select-series="onSelectSeriesForTournament" @register="onRegisterSeries" />
    <SeriesFormModal :open="seriesModalOpen" :series="editingSeries" :categories="categories" :saving="seriesSaving" @close="closeSeriesModal" @submit="onSaveSeries" />
  </main>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useClubSeriesStore } from '../stores/clubSeries';
import { useNotifyStore } from '../stores/notify';
import { getClubById } from '../services/clubs.service';
import { getRosterByClub } from '../services/roster.service';
import { getClubActiveTournaments, getSeriesTournamentEligibility, registerSeriesInTournament } from '../services/tournaments.service';
import * as categoriesService from '../services/categories.service';
import ClubHeader from '../components/ClubHeader.vue';
import ClubSeriesTable from '../components/ClubSeriesTable.vue';
import SeriesRosterDetail from '../components/SeriesRosterDetail.vue';
import SeriesFormModal from '../components/SeriesFormModal.vue';
import ActiveTournamentsTable from '../components/ActiveTournamentsTable.vue';

const route = useRoute(); const router = useRouter(); const clubId = route.params.clubId;
const { items, error, fetchClubSeries, createOrUpdateSeries, removeSeries } = useClubSeriesStore();
const { confirm, notifySuccess, notifyError } = useNotifyStore();
const clubTabs = [{ key: 'series', label: 'Series' }, { key: 'players', label: 'Jugadores' }, { key: 'inactive_players', label: 'Jugadores Inactivos' }, { key: 'transfers', label: 'Traspasos' }, { key: 'admins', label: 'Administradores' }, { key: 'edit', label: 'Editar Club' }];
const club = ref(null); const clubRoster = ref([]); const selectedSeries = ref(null); const categories = ref([]);
const seriesModalOpen = ref(false); const editingSeries = ref(null); const seriesSaving = ref(false);
const availableTournaments = ref([]); const tournamentsLoading = ref(false); const tournamentsError = ref('');
const seriesSelection = reactive({}); const eligibilityByTournament = reactive({});
const checkingTournamentId = ref(null); const registeringTournamentId = ref(null);

const onHeaderTabClick = (key) => { if (key !== 'series') router.push(`/clubs/${clubId}?tab=${key}`); };
const openCreateModal = () => { editingSeries.value = null; seriesModalOpen.value = true; };
const openEditModal = (series) => { editingSeries.value = series; seriesModalOpen.value = true; };
const closeSeriesModal = () => { seriesModalOpen.value = false; editingSeries.value = null; };
const onSaveSeries = async (form) => {
  seriesSaving.value = true;
  try {
    await createOrUpdateSeries({ ...form, clubId, ...(editingSeries.value ? { id: editingSeries.value.id } : {}) });
    notifySuccess(editingSeries.value ? 'Serie actualizada exitosamente' : 'Serie creada y activada exitosamente'); closeSeriesModal();
  } catch (requestError) { notifyError(requestError.response?.data?.error?.message || 'No fue posible guardar la serie'); }
  finally { seriesSaving.value = false; }
};
const onDeleteSeries = async (series) => {
  if (!series.can_delete) { notifyError(`No se puede eliminar: está inscrita en ${series.registration_count} torneo(s)`); return; }
  const accepted = await confirm({ title: '¿Eliminar serie?', message: `¿Eliminar la serie "${series.name}"?`, confirmText: 'Eliminar', isDestructive: true });
  if (!accepted) return;
  try { await removeSeries(series.id); notifySuccess('Serie eliminada'); }
  catch (requestError) {
    const code = requestError.response?.data?.error?.code;
    notifyError(code === 'SERIES_REGISTERED_IN_TOURNAMENT' ? 'No se puede eliminar porque la serie está inscrita en un torneo.' : (requestError.response?.data?.error?.message || 'No fue posible eliminar la serie'));
    if (code === 'SERIES_REGISTERED_IN_TOURNAMENT') await fetchClubSeries(clubId);
  }
};
const loadActiveTournaments = async () => {
  tournamentsLoading.value = true; tournamentsError.value = '';
  try { const response = await getClubActiveTournaments(clubId); availableTournaments.value = response.data?.data?.tournaments ?? response.data?.tournaments ?? []; }
  catch (requestError) { tournamentsError.value = requestError.response?.data?.error?.message || 'No fue posible cargar los torneos activos.'; }
  finally { tournamentsLoading.value = false; }
};

// La tarjeta de cada torneo se colorea sola (verde/gris/naranja/rojo) sin que
// el club tenga que elegir manualmente una serie primero: se busca la serie
// del club cuya categoría coincide con la del torneo (misma regla que valida
// el backend en REGISTER_TEAM) y se dispara la misma verificación de
// elegibilidad que ya usaba el selector manual. Si no hay ninguna serie de
// esa categoría, se marca como no disponible con un motivo propio del cliente
// (NO_MATCHING_SERIES) — no requiere ningún endpoint nuevo.
const findMatchedSeries = (tournament) => {
  const matches = items.value.filter((series) => series.category_id === tournament.category_id);
  return matches.find((series) => series.active) ?? matches[0] ?? null;
};
const autoResolveEligibility = async () => {
  const pending = availableTournaments.value
    .filter((tournament) => tournament.status === 'REGISTRATION')
    .map(async (tournament) => {
      const matched = findMatchedSeries(tournament);
      if (!matched) {
        seriesSelection[tournament.id] = '';
        eligibilityByTournament[tournament.id] = { eligible: false, reasons: ['NO_MATCHING_SERIES'] };
        return;
      }
      await onSelectSeriesForTournament({ tournament, seriesId: matched.id });
    });
  await Promise.all(pending);
};
const refreshTournaments = async () => {
  await loadActiveTournaments();
  await autoResolveEligibility();
};
const onSelectSeriesForTournament = async ({ tournament, seriesId }) => {
  seriesSelection[tournament.id] = seriesId; delete eligibilityByTournament[tournament.id];
  if (!seriesId || tournament.status !== 'REGISTRATION') return;
  checkingTournamentId.value = tournament.id;
  try { const response = await getSeriesTournamentEligibility(clubId, seriesId, tournament.id); eligibilityByTournament[tournament.id] = response.data?.data?.eligibility ?? response.data?.eligibility ?? { eligible: false, reasons: [] }; }
  catch (requestError) { eligibilityByTournament[tournament.id] = { eligible: false, reasons: [requestError.response?.data?.error?.code || 'UNKNOWN'] }; }
  finally { checkingTournamentId.value = null; }
};
const onRegisterSeries = async ({ tournament, seriesId }) => {
  if (!eligibilityByTournament[tournament.id]?.eligible) return;
  registeringTournamentId.value = tournament.id;
  try {
    await registerSeriesInTournament(clubId, seriesId, tournament.id); notifySuccess('Serie inscrita; la inscripción y su cobro fueron generados correctamente.');
    seriesSelection[tournament.id] = ''; delete eligibilityByTournament[tournament.id]; await Promise.all([loadActiveTournaments(), fetchClubSeries(clubId)]);
    await autoResolveEligibility();
  } catch (requestError) { notifyError(requestError.response?.data?.error?.message || 'No fue posible inscribir la serie.'); }
  finally { registeringTournamentId.value = null; }
};
const viewTournament = (tournament) => router.push(`/clubs/${clubId}/tournaments/${tournament.id}`);
onMounted(async () => {
  try { const clubResponse = await getClubById(clubId); club.value = clubResponse.data?.data?.club ?? null; }
  catch (requestError) { notifyError(requestError.response?.data?.error?.message || 'No fue posible cargar el club.'); }
  await Promise.allSettled([
    fetchClubSeries(clubId), loadActiveTournaments(),
    getRosterByClub(clubId).then((response) => { clubRoster.value = (response.data?.data?.roster ?? []).filter((entry) => entry.status === 'ACTIVE'); }),
    categoriesService.listCategories(clubId).then((response) => { categories.value = response.data?.data?.categories ?? []; }),
  ]);
  await autoResolveEligibility();
});
</script>
<style scoped>
.club-series { display:grid; gap:16px; padding-top:16px; padding-bottom:40px; }.club-series__heading { display:flex; align-items:center; justify-content:space-between; gap:20px; margin:8px 0; }.club-series__heading h1 { margin:0; font-size:clamp(1.5rem,3vw,2rem); }.club-series__eyebrow { margin:0 0 4px; color:var(--primary-solid); font-size:.75rem; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }.club-series__actions { display:flex; gap:8px; }
@media (max-width:640px) { .club-series__heading { align-items:stretch; flex-direction:column; }.club-series__actions { flex-direction:column; }.club-series__actions .btn { width:100%; } }
</style>
