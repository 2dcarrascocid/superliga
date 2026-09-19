<template>
  <div class="container mt-md">
    <div class="flex justify-between items-center mb-lg">
      <h2>Tribunal de Disciplina</h2>
    </div>

    <p class="text-muted text-sm mb-lg">
      Expedientes disciplinarios y resoluciones oficiales. Un expediente puede nacer de un reporte arbitral,
      de una tarjeta registrada en la Planilla de Control de Partido, o cargarse manualmente; el tribunal lo
      revisa y, al resolverlo, aplica una sanción formal (boletín) sobre el club, equipo, jugador o cuerpo técnico.
    </p>

    <div v-if="loadError" class="alert alert-error">{{ loadError }}</div>

    <div class="tribunal-layout">
      <!-- ==================== Columna izquierda: listado + filtros ==================== -->
      <div>
        <div class="card p-0 mb-lg">
          <div class="flex justify-between items-center p-md" style="border-bottom: 1px solid var(--border-color);">
            <h3 class="m-0">Expedientes</h3>
            <span class="text-muted text-sm">{{ casesTotal }} en total</span>
          </div>
          <div class="p-md" style="border-bottom: 1px solid var(--border-color);">
            <select v-model="statusFilter" class="input" @change="reloadCases">
              <option value="">Todos los estados</option>
              <option value="PENDING">Pendiente</option>
              <option value="IN_REVIEW">En revisión</option>
              <option value="SANCTIONED">Sancionado</option>
              <option value="DISMISSED">Desestimado</option>
            </select>
          </div>
          <div class="table-container">
            <table class="table">
              <thead><tr><th>Expediente</th><th>Sancionado</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                <tr v-if="loading && !cases.length"><td colspan="4" class="text-center py-lg">Cargando...</td></tr>
                <tr v-for="c in cases" :key="c.id" :class="{ 'row-active': selectedCaseId === c.id }" @click="selectCase(c.id)" style="cursor:pointer;">
                  <td>{{ c.title }}</td>
                  <td>
                    <span class="badge badge-secondary">{{ sanctionedTypeLabel(c.sanctioned_type) }}</span>
                    {{ c.club?.name || '' }}
                  </td>
                  <td><span class="badge" :class="statusBadgeClass(c.status)">{{ statusLabel(c.status) }}</span></td>
                  <td><button type="button" class="btn btn-secondary btn-sm" @click.stop="selectCase(c.id)">Ver</button></td>
                </tr>
                <tr v-if="!loading && !cases.length"><td colspan="4" class="text-center text-muted py-lg">Sin expedientes.</td></tr>
              </tbody>
            </table>
          </div>
          <div v-if="casesNextToken" class="p-md text-center">
            <button type="button" class="btn btn-secondary btn-sm" :disabled="loading" @click="loadMoreCases">Cargar más</button>
          </div>
        </div>

        <div class="card">
          <div class="flex justify-between items-center mb-md">
            <h3 class="m-0">Nuevo expediente</h3>
            <button type="button" class="btn btn-secondary btn-sm" @click="showCreateCase = !showCreateCase">
              {{ showCreateCase ? 'Ocultar' : 'Abrir formulario' }}
            </button>
          </div>
          <form v-if="showCreateCase" @submit.prevent="submitCase">
            <div v-if="caseFormError" class="alert alert-error" role="alert">{{ caseFormError }}</div>
            <div class="form-row-2">
              <div class="input-group">
                <label class="label">Tipo de sancionado</label>
                <select v-model="caseForm.sanctioned_type" class="input" @change="onSanctionedTypeChange">
                  <option value="CLUB">Club</option>
                  <option value="TEAM">Equipo / Serie</option>
                  <option value="PLAYER">Jugador</option>
                  <option value="COACH">Cuerpo técnico / Dirigente</option>
                </select>
              </div>
              <div class="input-group">
                <label class="label">Club</label>
                <select v-model="caseForm.club_id" class="input" required @change="onClubChange">
                  <option value="">Seleccionar club</option>
                  <option v-for="club in clubs" :key="club.id" :value="club.id">{{ club.name }}</option>
                </select>
              </div>
              <div v-if="caseForm.sanctioned_type !== 'CLUB'" class="input-group">
                <label class="label">{{ sanctionedTypeLabel(caseForm.sanctioned_type) }}</label>
                <select v-model="caseForm.sanctioned_id" class="input" required>
                  <option value="">Seleccionar</option>
                  <option v-for="opt in sanctionedOptions" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
                </select>
              </div>
              <div class="input-group">
                <label class="label">Torneo</label>
                <select v-model="caseForm.tournament_id" class="input">
                  <option value="">Sin torneo asociado</option>
                  <option v-for="t in tournaments" :key="t.id" :value="t.id">{{ t.name }}</option>
                </select>
              </div>
              <div class="input-group">
                <label class="label">Falta tipificada</label>
                <select v-model="caseForm.infraction_id" class="input" @change="onInfractionChange">
                  <option value="">Falta no tipificada / manual</option>
                  <option v-for="inf in infractionsForType" :key="inf.id" :value="inf.id">{{ inf.code }} — {{ inf.name }}</option>
                </select>
              </div>
              <div class="input-group">
                <label class="label">Fuente</label>
                <select v-model="caseForm.source" class="input">
                  <option value="MANUAL">Manual</option>
                  <option value="REFEREE_REPORT">Reporte arbitral</option>
                  <option value="MATCH_REPORT">Reporte de partido</option>
                </select>
              </div>
            </div>
            <div class="input-group">
              <label class="label">Título del expediente</label>
              <input v-model.trim="caseForm.title" class="input" placeholder="Ej: Conducta violenta vs. Club X — fecha 5" required />
            </div>
            <div class="input-group">
              <label class="label">Descripción</label>
              <textarea v-model.trim="caseForm.description" class="input" rows="2" placeholder="Detalle de la incidencia"></textarea>
            </div>
            <div class="flex justify-end mt-md">
              <button type="submit" class="btn btn-primary" :disabled="savingCase">{{ savingCase ? 'Creando…' : 'Crear expediente' }}</button>
            </div>
          </form>
        </div>
      </div>

      <!-- ==================== Columna derecha: detalle del expediente ==================== -->
      <div>
        <div v-if="!currentCase" class="card text-center text-muted py-lg">
          Selecciona un expediente para ver su detalle y resoluciones.
        </div>
        <template v-else>
          <div class="card mb-lg">
            <div class="flex justify-between items-center mb-md">
              <h3 class="m-0">{{ currentCase.title }}</h3>
              <span class="badge" :class="statusBadgeClass(currentCase.status)">{{ statusLabel(currentCase.status) }}</span>
            </div>
            <p class="text-muted text-sm mb-md">{{ currentCase.description || 'Sin descripción.' }}</p>
            <div class="detail-grid text-sm mb-md">
              <div><strong>Sancionado:</strong> {{ sanctionedTypeLabel(currentCase.sanctioned_type) }}</div>
              <div><strong>Club:</strong> {{ currentCase.club?.name || '—' }}</div>
              <div><strong>Artículo:</strong> {{ currentCase.article?.code || '—' }}</div>
              <div><strong>Falta:</strong> {{ currentCase.infraction?.name || '—' }}</div>
              <div><strong>Fuente:</strong> {{ sourceLabel(currentCase.source) }}</div>
            </div>
            <div class="flex gap-sm">
              <button type="button" class="btn btn-secondary btn-sm" :disabled="currentCase.status === 'IN_REVIEW'" @click="setCaseStatus('IN_REVIEW')">Poner en revisión</button>
              <button type="button" class="btn btn-danger btn-sm" :disabled="currentCase.status === 'DISMISSED'" @click="setCaseStatus('DISMISSED')">Desestimar</button>
            </div>
          </div>

          <div class="card p-0 mb-lg">
            <div class="p-md" style="border-bottom: 1px solid var(--border-color);"><h3 class="m-0">Resoluciones</h3></div>
            <div class="table-container">
              <table class="table">
                <thead><tr><th>Sanción</th><th>Cantidad</th><th>Cumplimiento</th><th>Fecha</th></tr></thead>
                <tbody>
                  <tr v-for="r in resolutions" :key="r.id">
                    <td>{{ sanctionKindLabel(r.sanction_kind) }}</td>
                    <td>{{ r.sanction_kind === 'MATCHES_SUSPENSION' ? `${r.matches_remaining}/${r.quantity} fechas restantes` : r.quantity }}</td>
                    <td><span class="badge" :class="fulfillmentBadgeClass(r.status_cumplimiento)">{{ fulfillmentLabel(r.status_cumplimiento) }}</span></td>
                    <td>{{ formatDate(r.resolved_at) }}</td>
                  </tr>
                  <tr v-if="!resolutions.length"><td colspan="4" class="text-center text-muted py-lg">Sin resoluciones aplicadas.</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="card">
            <h3 class="mb-md">Aplicar resolución (boletín oficial)</h3>
            <div v-if="resolutionFormError" class="alert alert-error" role="alert">{{ resolutionFormError }}</div>
            <form @submit.prevent="submitResolution">
              <div class="form-row-2">
                <div class="input-group">
                  <label class="label">Tipo de sanción</label>
                  <select v-model="resolutionForm.sanction_kind" class="input" required>
                    <option value="MATCHES_SUSPENSION">Suspensión por partidos</option>
                    <option value="DAYS_SUSPENSION">Suspensión por días</option>
                    <option value="FINE">Multa económica</option>
                    <option value="POINTS_DEDUCTION">Quita de puntos</option>
                    <option value="WALKOVER">Pérdida de partido (W.O.)</option>
                    <option value="LOCALIA_SUSPENSION">Suspensión de localía</option>
                    <option value="DISQUALIFICATION">Descalificación del torneo</option>
                    <option value="EXPULSION">Expulsión de la liga</option>
                  </select>
                </div>
                <div class="input-group">
                  <label class="label">Cantidad (partidos/días/monto/puntos)</label>
                  <input v-model.number="resolutionForm.quantity" type="number" min="0" class="input" required />
                </div>
                <div class="input-group">
                  <label class="label">Fecha de inicio</label>
                  <input v-model="resolutionForm.start_date" type="date" class="input" />
                </div>
              </div>
              <div class="input-group">
                <label class="label">Boletín / resolución oficial</label>
                <textarea v-model.trim="resolutionForm.resolution_text" class="input" rows="3" placeholder="Texto de la resolución firmada por el tribunal"></textarea>
              </div>
              <div class="flex justify-end mt-md">
                <button type="submit" class="btn btn-primary" :disabled="savingResolution">{{ savingResolution ? 'Aplicando…' : 'Aplicar sanción' }}</button>
              </div>
            </form>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useDisciplinaryStore } from '../stores/disciplinary';
import { getClubs } from '../services/clubs.service';
import { getClubSeries } from '../services/clubSeries.service';
import { listPlayersByClub } from '../services/players.service';
import { listTeamStaff } from '../services/disciplinary.service';
import { getTournaments } from '../services/tournaments.service';

const authStore = useAuthStore();
const disciplinaryStore = useDisciplinaryStore();

const orgId = computed(() => authStore.state.org?.id);
const loading = computed(() => disciplinaryStore.state.loading);
const loadError = ref('');

const cases = computed(() => disciplinaryStore.state.cases || []);
const casesTotal = computed(() => disciplinaryStore.state.casesTotal || 0);
const casesNextToken = computed(() => disciplinaryStore.state.casesNextToken);
const currentCase = computed(() => disciplinaryStore.state.currentCase);
const resolutions = computed(() => disciplinaryStore.state.resolutions || []);
const infractions = computed(() => disciplinaryStore.state.infractions || []);

const statusFilter = ref('');
const selectedCaseId = ref(null);
const clubs = ref([]);
const tournaments = ref([]);
const sanctionedOptions = ref([]);

const infractionsForType = computed(() =>
  infractions.value.filter((i) => i.sanctioned_type === caseForm.sanctioned_type)
);

const STATUS_LABELS = { PENDING: 'Pendiente', IN_REVIEW: 'En revisión', SANCTIONED: 'Sancionado', DISMISSED: 'Desestimado' };
const statusLabel = (s) => STATUS_LABELS[s] || s;
const statusBadgeClass = (s) => ({ PENDING: 'badge-secondary', IN_REVIEW: 'badge-warning', SANCTIONED: 'badge-success', DISMISSED: 'badge-danger' }[s] || 'badge-secondary');

const SOURCE_LABELS = { MANUAL: 'Manual', REFEREE_REPORT: 'Reporte arbitral', MATCH_REPORT: 'Reporte de partido', AUTO_CARD_ACCUMULATION: 'Motor automático (tarjetas)' };
const sourceLabel = (s) => SOURCE_LABELS[s] || s;

const SANCTIONED_TYPE_LABELS = { CLUB: 'Club', TEAM: 'Equipo/Serie', PLAYER: 'Jugador', COACH: 'Cuerpo técnico' };
const sanctionedTypeLabel = (t) => SANCTIONED_TYPE_LABELS[t] || t;

const SANCTION_KIND_LABELS = {
  MATCHES_SUSPENSION: 'Suspensión por partidos', DAYS_SUSPENSION: 'Suspensión por días', FINE: 'Multa económica',
  POINTS_DEDUCTION: 'Quita de puntos', WALKOVER: 'Pérdida de partido (W.O.)', LOCALIA_SUSPENSION: 'Suspensión de localía',
  DISQUALIFICATION: 'Descalificación', EXPULSION: 'Expulsión de la liga',
};
const sanctionKindLabel = (k) => SANCTION_KIND_LABELS[k] || k;

const FULFILLMENT_LABELS = { PENDING: 'Pendiente', IN_FULFILLMENT: 'Cumpliendo', COMPLETED: 'Cumplida', APPEALED: 'Apelada' };
const fulfillmentLabel = (s) => FULFILLMENT_LABELS[s] || s;
const fulfillmentBadgeClass = (s) => ({ PENDING: 'badge-secondary', IN_FULFILLMENT: 'badge-warning', COMPLETED: 'badge-success', APPEALED: 'badge-danger' }[s] || 'badge-secondary');

const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString('es-CL') : '—');

// ── Listado + filtros ────────────────────────────────────────────────────
const reloadCases = async () => {
  try {
    await disciplinaryStore.fetchCases(orgId.value, { status: statusFilter.value || undefined, limit: 20 });
  } catch (error) {
    loadError.value = disciplinaryStore.state.error || 'No se pudieron cargar los expedientes.';
  }
};

const loadMoreCases = async () => {
  if (!casesNextToken.value) return;
  await disciplinaryStore.fetchCases(orgId.value, { status: statusFilter.value || undefined, limit: 20, next_token: casesNextToken.value });
};

const selectCase = async (caseId) => {
  selectedCaseId.value = caseId;
  try {
    await disciplinaryStore.fetchCase(caseId);
  } catch (error) {
    loadError.value = disciplinaryStore.state.error || 'No se pudo cargar el expediente.';
  }
};

const setCaseStatus = async (status) => {
  if (!currentCase.value) return;
  try {
    await disciplinaryStore.updateCaseStatus(currentCase.value.id, status);
    await reloadCases();
  } catch (error) {
    alert(error.response?.data?.error?.message || disciplinaryStore.state.error || 'No se pudo actualizar el estado.');
  }
};

// ── Nuevo expediente ─────────────────────────────────────────────────────
const showCreateCase = ref(false);
const caseForm = reactive({
  sanctioned_type: 'PLAYER', club_id: '', sanctioned_id: '', tournament_id: '',
  infraction_id: '', article_id: '', source: 'MANUAL', title: '', description: '',
});
const savingCase = ref(false);
const caseFormError = ref('');

const onSanctionedTypeChange = () => {
  caseForm.sanctioned_id = '';
  caseForm.infraction_id = '';
  loadSanctionedOptions();
};

const onClubChange = () => {
  caseForm.sanctioned_id = '';
  loadSanctionedOptions();
};

const loadSanctionedOptions = async () => {
  sanctionedOptions.value = [];
  if (!caseForm.club_id || caseForm.sanctioned_type === 'CLUB') return;
  try {
    if (caseForm.sanctioned_type === 'TEAM') {
      const res = await getClubSeries(caseForm.club_id);
      sanctionedOptions.value = (res.data?.data?.series ?? res.data?.series ?? []).map((s) => ({ id: s.id, label: s.name }));
    } else if (caseForm.sanctioned_type === 'PLAYER') {
      const res = await listPlayersByClub(caseForm.club_id, { limit: 200 });
      sanctionedOptions.value = (res.data?.data?.data ?? []).map((p) => ({ id: p.id, label: `${p.first_name} ${p.last_name}` }));
    } else if (caseForm.sanctioned_type === 'COACH') {
      const res = await listTeamStaff(caseForm.club_id);
      sanctionedOptions.value = (res.data?.data?.staffList ?? []).map((s) => ({ id: s.id, label: `${s.full_name} (${s.role})` }));
    }
  } catch {
    sanctionedOptions.value = [];
  }
};

const onInfractionChange = () => {
  const inf = infractions.value.find((i) => i.id === caseForm.infraction_id);
  caseForm.article_id = inf?.article_id || '';
};

const submitCase = async () => {
  if (savingCase.value) return;
  savingCase.value = true;
  caseFormError.value = '';
  try {
    const sanctionedId = caseForm.sanctioned_type === 'CLUB' ? caseForm.club_id : caseForm.sanctioned_id;
    if (!sanctionedId) throw { response: { data: { error: { message: 'Selecciona el ente sancionado.' } } } };
    await disciplinaryStore.createCase({
      org_id: orgId.value, tournament_id: caseForm.tournament_id || null,
      sanctioned_type: caseForm.sanctioned_type, sanctioned_id: sanctionedId,
      infraction_id: caseForm.infraction_id || null, article_id: caseForm.article_id || null,
      source: caseForm.source, title: caseForm.title, description: caseForm.description,
    });
    Object.assign(caseForm, { sanctioned_id: '', tournament_id: '', infraction_id: '', article_id: '', title: '', description: '' });
    showCreateCase.value = false;
  } catch (error) {
    caseFormError.value = error.response?.data?.error?.message || disciplinaryStore.state.error || 'No se pudo crear el expediente.';
  } finally {
    savingCase.value = false;
  }
};

// ── Resolución ────────────────────────────────────────────────────────────
const resolutionForm = reactive({ sanction_kind: 'MATCHES_SUSPENSION', quantity: 1, start_date: '', resolution_text: '' });
const savingResolution = ref(false);
const resolutionFormError = ref('');

watch(currentCase, (c) => {
  if (c?.infraction) {
    resolutionForm.sanction_kind = c.infraction.sanction_kind || 'MATCHES_SUSPENSION';
  }
});

const submitResolution = async () => {
  if (!currentCase.value || savingResolution.value) return;
  savingResolution.value = true;
  resolutionFormError.value = '';
  try {
    await disciplinaryStore.createResolution(currentCase.value.id, {
      tournament_id: currentCase.value.tournament_id,
      sanction_kind: resolutionForm.sanction_kind, quantity: resolutionForm.quantity,
      start_date: resolutionForm.start_date || undefined, resolution_text: resolutionForm.resolution_text,
    });
    await reloadCases();
    resolutionForm.resolution_text = '';
  } catch (error) {
    resolutionFormError.value = error.response?.data?.error?.message || disciplinaryStore.state.error || 'No se pudo aplicar la resolución.';
  } finally {
    savingResolution.value = false;
  }
};

onMounted(async () => {
  try {
    const [clubsRes, tournamentsRes] = await Promise.all([
      getClubs({ org_id: orgId.value }),
      getTournaments({ org_id: orgId.value }),
    ]);
    clubs.value = clubsRes.data?.data?.clubs ?? clubsRes.data?.clubs ?? [];
    tournaments.value = tournamentsRes.data?.data?.tournaments ?? tournamentsRes.data?.tournaments ?? [];
    await disciplinaryStore.fetchInfractions(orgId.value);
    await reloadCases();
  } catch (error) {
    loadError.value = disciplinaryStore.state.error || 'No se pudo cargar el panel del tribunal.';
  }
});
</script>

<style scoped>
.tribunal-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; }
.form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.p-0 { padding: 0 !important; }
.py-lg { padding-top: var(--spacing-lg); padding-bottom: var(--spacing-lg); }
.row-active { background: var(--surface-hover, rgba(25, 118, 210, 0.08)); }
.badge-warning { background: #fff3cd; color: #856404; }
.badge-danger { background: #f8d7da; color: #721c24; }

@media (max-width: 900px) {
  .tribunal-layout { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .form-row-2, .detail-grid { grid-template-columns: 1fr; }
}
</style>
