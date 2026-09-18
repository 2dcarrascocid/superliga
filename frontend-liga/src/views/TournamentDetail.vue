<template>
  <div class="container mt-md">
    <div class="flex justify-between items-center mb-lg">
      <h2>{{ current?.name || 'Torneo' }}</h2>
      <button class="btn btn-secondary" @click="$router.push('/tournaments')">&larr; Torneos</button>
    </div>

    <div v-if="error" class="alert alert-error mb-md">{{ error }}</div>

    <PanoramaDashboard
      v-if="current"
      class="mb-lg"
      kicker="Resumen del torneo"
      title-start="Panorama del"
      title-accent="torneo"
      :description="tournamentDescription"
      :sub-tabs="menuTabs"
      :active-sub-tab="activeTab"
      @sub-tab-change="selectTab"
    />

    <!-- Tab: Equipos inscritos -->
    <div v-if="activeTab === 'teams'" class="card">
      <div class="flex justify-between items-center mb-md">
        <h3 class="m-0">Equipos Inscritos</h3>
        <span class="text-muted text-sm">{{ teams.length }}{{ current?.max_teams ? ` / ${current.max_teams} cupos` : '' }}</span>
      </div>

      <form v-if="registrationOpen" class="team-register-row" @submit.prevent="onRegisterTeam">
        <div class="input-group flex-1 series-search">
          <label class="label">Serie (Club — Serie)</label>
          <input
            v-model="seriesQuery"
            class="input"
            placeholder="Buscar serie por nombre..."
            autocomplete="off"
            required
            @input="onSeriesSearch"
            @focus="onSeriesSearch"
          />
          <div v-if="filteredSeriesResults.length > 0" class="series-search__dropdown">
            <button
              v-for="s in filteredSeriesResults"
              :key="s.id"
              type="button"
              class="series-search__item"
              @click="selectSeries(s)"
            >
              {{ s.club?.name }} — {{ s.name }}
            </button>
          </div>
        </div>
        <div class="input-group" style="max-width: 140px;">
          <label class="label">Grupo</label>
          <input v-model="teamForm.group_name" class="input" placeholder="A" />
        </div>
        <div class="input-group" style="max-width: 120px;">
          <label class="label">Seed</label>
          <input v-model.number="teamForm.seed" type="number" min="1" class="input" />
        </div>
        <button type="submit" class="btn btn-primary" style="align-self: flex-end;" :disabled="!teamForm.series_id || teamRegistering">
          {{ teamRegistering ? 'Inscribiendo...' : 'Inscribir' }}
        </button>
      </form>
      <p v-else class="text-muted text-sm mt-0 mb-md">
        Las inscripciones están cerradas — el torneo ya no está en período de inscripción.
      </p>

      <div class="table-container mt-md">
        <table class="table">
          <thead>
            <tr>
              <th>Club — Serie</th>
              <th class="text-center">Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="teams.length === 0">
              <td colspan="3" class="text-center py-lg">Aún no hay equipos inscritos.</td>
            </tr>
            <tr v-for="team in teams" :key="team.id">
              <td class="font-medium" :title="`${team.series?.club?.name} — ${team.series?.name}`">
                {{ truncate(team.series?.club?.name, 12) }} — {{ truncate(team.series?.name, 3) }}
              </td>
              <td class="text-center">
                <span class="status-badge" :class="`status-badge--team-${team.status?.toLowerCase()}`">{{ teamStatusLabel(team.status) }}</span>
              </td>
              <td>
                <ActionsMenu v-if="registrationOpen">
                  <button class="btn btn-sm btn-danger" @click="onRemoveTeam(team)">Quitar</button>
                </ActionsMenu>
                <span v-else class="text-muted text-sm">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile: tarjetas -->
      <div class="data-cards mt-md">
        <p v-if="teams.length === 0" class="text-center py-lg text-muted text-sm">Aún no hay equipos inscritos.</p>
        <article v-for="team in teams" :key="team.id" class="data-card">
          <div class="data-card__header">
            <div class="data-card__heading">
              <div class="data-card__title">{{ team.series?.club?.name }}</div>
              <div class="data-card__subtitle">{{ team.series?.name }}</div>
            </div>
            <span class="status-badge" :class="`status-badge--team-${team.status?.toLowerCase()}`">{{ teamStatusLabel(team.status) }}</span>
          </div>
          <div class="data-card__footer" v-if="registrationOpen">
            <ActionsMenu>
              <button class="btn btn-sm btn-danger" @click="onRemoveTeam(team)">Quitar</button>
            </ActionsMenu>
          </div>
        </article>
      </div>
    </div>

    <!-- Tab: Sorteo y Fixture -->
    <div v-if="activeTab === 'fixture-tools'" class="card">
      <div class="flex justify-between items-center mb-md">
        <h3 class="m-0">Sorteo y Fixture</h3>
        <span class="status-badge" :class="fixtureGenerated ? 'status-badge--team-active' : 'status-badge--team-withdrawn'">
          {{ fixtureGenerated ? 'Generado' : 'Pendiente' }}
        </span>
      </div>
      <div class="flex gap-sm flex-wrap items-center">
        <button class="btn btn-primary" :disabled="loading || teams.length < 2" @click="onGenerateFixture(false)">
          Generar Sorteo / Fixture
        </button>
        <button class="btn btn-secondary" :disabled="loading" @click="onGenerateFixture(true)">
          Regenerar (force)
        </button>
        <button
          v-if="current?.format === 'GROUPS_KNOCKOUT'"
          class="btn btn-secondary"
          :disabled="loading"
          @click="onGenerateKnockout"
        >
          Generar Playoffs desde Grupos
        </button>
        <button
          v-if="current?.has_consolation"
          class="btn btn-secondary"
          :disabled="loading"
          @click="onGenerateConsolation"
        >
          Generar {{ current.consolation_name || 'Liguilla' }}
        </button>
      </div>
      <p class="text-muted text-sm mt-sm mb-0">
        Se requieren al menos 2 equipos inscritos. El sorteo arma automáticamente las jornadas y partidos según el formato del torneo.
      </p>
    </div>

    <!-- Tab: Estado del torneo (solo admin de organización) -->
    <div v-if="activeTab === 'status'" class="card">
      <h3 class="mb-md">Estado del Torneo</h3>
      <!-- Sin esto el torneo puede quedar atascado en DRAFT para siempre,
           sin aparecer en "Torneos activos" de ningún club (ese listado
           filtra por status=REGISTRATION). -->
      <div class="status-change-row">
        <div class="input-group" style="max-width: 220px;">
          <label class="label text-sm">Cambiar estado del torneo</label>
          <select v-model="statusForm" class="input">
            <option v-for="s in STATUS_OPTIONS" :key="s" :value="s">{{ statusLabel(s) }}</option>
          </select>
        </div>
        <button
          class="btn btn-sm btn-primary"
          style="align-self: flex-end;"
          :disabled="statusSaving || statusForm === current?.status"
          @click="onSaveStatus"
        >
          {{ statusSaving ? 'Guardando...' : 'Guardar estado' }}
        </button>
        <span v-if="statusError" class="text-sm" style="color:#ef5350;">{{ statusError }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useTournamentsStore } from '../stores/tournaments';
import { useAuthStore } from '../stores/auth';
import { useNotifyStore } from '../stores/notify';
import { useClubSeriesStore } from '../stores/clubSeries';
import { updateTournament } from '../services/tournaments.service.js';
import ActionsMenu from '../components/ActionsMenu.vue';
import PanoramaDashboard from '../components/PanoramaDashboard.vue';

const route = useRoute();
const tournamentId = route.params.tournamentId;

const {
  current, teams, loading, error,
  fetchTournamentById, fetchTeams, addTeam, removeTeam, addClub,
  runGenerateFixture, runGenerateKnockoutFromGroups, runGenerateConsolation,
} = useTournamentsStore();
const authStore = useAuthStore();
const { notifySuccess, notifyError, confirm } = useNotifyStore();
const { searchResults: seriesResults, searchAllSeries } = useClubSeriesStore();

const seriesQuery = ref('');

// ── Panorama / sub menú del torneo ────────────────────────────────────────
// Esto es un MENÚ (como el submenú de /players: Jugadores / Jugadores
// Inactivos / Traspasos), no un panel de indicadores — por eso usa el pill
// tab bar de PanoramaDashboard (subTabs), no la grilla de tarjetas KPI
// (tiles). "Ver Fixture"/"Tabla de Posiciones"/"Goleadores"/"Fairplay"
// navegan a su propia ruta completa (con `path`, PanoramaDashboard los
// renderiza como <router-link>); "Equipos Inscritos"/"Sorteo y
// Fixture"/"Estado del Torneo" son paneles locales de esta misma vista.
const activeTab = ref('teams');
const tournamentDescription = computed(() => {
  if (!current.value) return '';
  return `${current.value.name} · ${typeLabel(current.value.type)} · ${formatLabel(current.value.format)} · ${current.value.season?.name || 'Sin temporada'} · ${current.value.category?.name || 'Sin categoría'}`;
});

const menuTabs = computed(() => [
  { key: 'teams', label: 'Equipos Inscritos' },
  { key: 'fixture-view', label: 'Ver Fixture', path: `/tournaments/${tournamentId}/fixture` },
  { key: 'standings', label: 'Tabla de Posiciones', path: `/tournaments/${tournamentId}/standings` },
  { key: 'top-scorers', label: 'Goleadores', path: `/tournaments/${tournamentId}/top-scorers` },
  { key: 'fairplay', label: 'Fairplay', path: `/tournaments/${tournamentId}/fairplay` },
  { key: 'fixture-tools', label: 'Sorteo y Fixture' },
  ...(authStore.isOrgAdmin() ? [{ key: 'status', label: 'Estado del Torneo' }] : []),
]);

const selectTab = (key) => { activeTab.value = key; };

// Recorta nombres largos en la tabla de Equipos Inscritos para que la fila
// quede compacta — el título completo queda disponible en el tooltip (:title).
const truncate = (text, max) => {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}…` : text;
};

const FORMAT_LABELS = {
  ROUND_ROBIN: 'Todos contra Todos',
  KNOCKOUT: 'Eliminación Directa',
  GROUPS_KNOCKOUT: 'Formato Mixto',
};
const STATUS_LABELS = {
  DRAFT: 'Borrador', REGISTRATION: 'Inscripciones', IN_PROGRESS: 'En curso', FINISHED: 'Finalizado', CANCELLED: 'Cancelado',
};
const TEAM_STATUS_LABELS = {
  ACTIVE: 'Activo', ELIMINATED: 'Eliminado', WITHDRAWN: 'Retirado', CHAMPION: 'Campeón',
};
const TYPE_LABELS = {
  OFICIAL: 'Oficial', AMISTOSO: 'Amistoso',
};

const formatLabel = (v) => FORMAT_LABELS[v] || v;
const statusLabel = (v) => STATUS_LABELS[v] || v;
const teamStatusLabel = (v) => TEAM_STATUS_LABELS[v] || v;
const typeLabel = (v) => TYPE_LABELS[v] || v;

// ── Cambio de estado del torneo (solo admin de organización) ────────────
// El backend valida `status` contra el CHECK de la tabla
// (DRAFT|REGISTRATION|IN_PROGRESS|FINISHED|CANCELLED) — no hace falta
// replicar acá una máquina de estados con transiciones permitidas.
const STATUS_OPTIONS = ['DRAFT', 'REGISTRATION', 'IN_PROGRESS', 'FINISHED', 'CANCELLED'];
const statusForm   = ref('DRAFT');
const statusSaving = ref(false);
const statusError  = ref(null);

watch(current, (t) => {
  if (t?.status) statusForm.value = t.status;
}, { immediate: true });

const onSaveStatus = async () => {
  if (!current.value || statusForm.value === current.value.status) return;
  statusSaving.value = true;
  statusError.value  = null;
  try {
    await updateTournament(tournamentId, { status: statusForm.value });
    current.value.status = statusForm.value;
    notifySuccess(`Estado del torneo actualizado a "${statusLabel(statusForm.value)}"`);
  } catch (e) {
    statusError.value = e.response?.data?.error?.message || e.message || 'Error al cambiar el estado';
    notifyError(statusError.value);
  } finally {
    statusSaving.value = false;
  }
};

// club_id se completa automáticamente al elegir una serie (ver selectSeries) —
// ya no hay un <select> de club: la inscripción del club es automática (ver
// onRegisterTeam más abajo).
const teamForm = reactive({ series_id: '', club_id: null, group_name: '', seed: null });
const teamRegistering = ref(false);

// La categoría del torneo puede venir como current.category_id (columna cruda) o current.category?.id (join).
const tournamentCategoryId = computed(() => current.value?.category_id ?? current.value?.category?.id ?? null);

// El backend rechaza REGISTER_TEAM/UNREGISTER_TEAM (TOURNAMENT_NOT_OPEN) cuando
// el torneo no está en período de inscripción — reflejamos esa regla en la UI
// para no ofrecer acciones que van a fallar del lado del servidor.
const registrationOpen = computed(() => current.value?.status === 'REGISTRATION');
const fixtureGenerated = computed(() => current.value?.status === 'IN_PROGRESS' || current.value?.status === 'FINISHED');

// Filtra el dropdown de series por la categoría del torneo, si es posible
// derivarla (evita CATEGORY_MISMATCH). Ya no filtra por club pre-inscrito: la
// inscripción del club ahora es automática al inscribir su primera serie (ver
// onRegisterTeam). Si la serie no trae category_id no se filtra por eso — el
// backend queda como última línea de defensa y su mensaje de error se muestra igual.
const filteredSeriesResults = computed(() =>
  seriesResults.value.filter((s) => {
    if (tournamentCategoryId.value && s.category_id && s.category_id !== tournamentCategoryId.value) return false;
    return true;
  })
);

const loadAll = async () => {
  await Promise.all([
    fetchTournamentById(tournamentId),
    fetchTeams(tournamentId),
  ]);
};

const onSeriesSearch = async () => {
  await searchAllSeries({ org_id: authStore.state.org?.id, q: seriesQuery.value });
};

const selectSeries = (series) => {
  teamForm.series_id = series.id;
  teamForm.club_id = series.club_id ?? series.club?.id ?? null;
  seriesQuery.value = `${series.club?.name} — ${series.name}`;
  seriesResults.value = [];
};

// La regla de negocio dice que un club solo debe quedar "Inscrito" cuando
// inscribió al menos una serie: ya no existe un form para inscribir un club
// suelto. En su lugar, igual que ClubSeries.vue → onRegisterSeries, un solo
// submit encadena club → equipo:
//   1) addClub: si el club ya estaba inscrito (por una serie anterior) el
//      backend responde DUPLICATE_CLUB_REGISTRATION, que tratamos como éxito
//      silencioso (no hay que generar el cobro de nuevo). Cualquier otro
//      error corta el flujo acá.
//   2) addTeam: inscribe la serie elegida como equipo del torneo.
// Se usan addClub/addTeam del store (no el servicio directo) porque ambos
// re-lanzan el error original de axios sin perder `error.response.data.error.code`,
// así que igual podemos distinguir DUPLICATE_CLUB_REGISTRATION del resto.
const onRegisterTeam = async () => {
  if (!teamForm.series_id || !teamForm.club_id) return;
  teamRegistering.value = true;
  try {
    try {
      await addClub(tournamentId, teamForm.club_id);
    } catch (e) {
      if (e.response?.data?.error?.code !== 'DUPLICATE_CLUB_REGISTRATION') {
        notifyError(e.response?.data?.error?.message || 'Error al inscribir el club en el torneo');
        return;
      }
      error.value = null; // duplicado tolerado: no es un error real para el usuario
    }

    await addTeam(tournamentId, teamForm);
    notifySuccess('Serie inscrita — cobro de inscripción generado, pendiente de pago');
    teamForm.series_id = '';
    teamForm.club_id = null;
    teamForm.group_name = '';
    teamForm.seed = null;
    seriesQuery.value = '';
    await fetchTeams(tournamentId);
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al inscribir el equipo');
  } finally {
    teamRegistering.value = false;
  }
};

const onRemoveTeam = async (team) => {
  const ok = await confirm({
    title: '¿Quitar equipo?',
    message: `¿Quitar a "${team.series?.club?.name} — ${team.series?.name}" del torneo?`,
    confirmText: 'Quitar Equipo',
    isDestructive: true,
  });
  if (!ok) return;
  try {
    await removeTeam(tournamentId, team.id);
    notifySuccess('Equipo quitado del torneo');
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al quitar el equipo');
  }
};

const onGenerateFixture = async (force) => {
  try {
    const result = await runGenerateFixture(tournamentId, { force });
    notifySuccess(`Fixture generado: ${result.matchesCreated} partido(s) creados.`);
    await fetchTournamentById(tournamentId);
  } catch (e) {
    // Error manejado en el store
  }
};

const onGenerateKnockout = async () => {
  try {
    const result = await runGenerateKnockoutFromGroups(tournamentId, {});
    notifySuccess(`Llave de playoffs generada: ${result.matchesCreated} partido(s) creados.`);
  } catch (e) {
    // Error manejado en el store
  }
};

const onGenerateConsolation = async () => {
  try {
    const result = await runGenerateConsolation(tournamentId, {});
    notifySuccess(`Liguilla generada: ${result.matchesCreated} partido(s) creados.`);
  } catch (e) {
    // Error manejado en el store
  }
};

onMounted(() => {
  loadAll();
});
</script>

<style scoped>
.team-register-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  flex-wrap: wrap;
}
.flex-1 { flex: 1; min-width: 220px; }

.status-change-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  flex-wrap: wrap;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}

.series-search { position: relative; }
.series-search__dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 20;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  max-height: 240px;
  overflow-y: auto;
  margin-top: 4px;
}
.series-search__item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.6rem 0.9rem;
  background: none;
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.9rem;
}
.series-search__item:hover { background: var(--bg-hover); }
.font-medium { font-weight: 500; }
.py-lg { padding-top: var(--spacing-lg); padding-bottom: var(--spacing-lg); }
.btn-sm { padding: 0.4rem 0.8rem; font-size: 0.875rem; }

.status-badge {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0.2rem 0.6rem; border-radius: var(--radius-full);
  font-size: 0.75rem; font-weight: 700;
}
.status-badge--team-active     { background: rgba(0, 230, 118, 0.14); color: var(--primary-solid, #00e676); }
.status-badge--team-eliminated { background: rgba(239, 83, 80, 0.14); color: #ef5350; }
.status-badge--team-withdrawn  { background: rgba(255, 255, 255, 0.08); color: var(--text-muted); }
.status-badge--team-champion   { background: rgba(255, 213, 79, 0.16); color: #ffd54f; }
</style>
