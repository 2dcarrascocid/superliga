<template>
  <div class="container mt-md">
    <div class="flex justify-between items-center mb-lg">
      <h2>Votaciones</h2>
      <button v-if="isAdmin" type="button" class="btn btn-primary" @click="showForm = true">+ Nueva votación</button>
    </div>

    <p class="text-muted text-sm mb-lg">
      Elecciones de la organización. Cada club vota una vez a través de su representante. Al cerrar, los clubes
      que no votaron quedan como abstención y los resultados se publican aquí.
    </p>

    <div v-if="loadError" class="alert alert-error">{{ loadError }}</div>

    <div class="polls-tabs mb-lg" role="tablist">
      <button
        v-for="t in TABS"
        :key="t.value"
        type="button"
        role="tab"
        class="polls-tabs__tab"
        :class="{ 'is-active': tab === t.value }"
        :aria-selected="tab === t.value"
        @click="tab = t.value"
      >{{ t.label }} <span class="polls-tabs__count">{{ countByStatus[t.value] }}</span></button>
    </div>

    <p v-if="loading && !polls.length" class="text-center text-muted py-lg">Cargando...</p>
    <p v-else-if="!visiblePolls.length" class="text-center text-muted py-lg">
      {{ tab === 'ABIERTA' ? 'No hay votaciones en curso.' : 'Aún no hay resultados publicados.' }}
    </p>

    <article v-for="poll in visiblePolls" :key="poll.id" class="card poll-card mb-lg">
      <header class="poll-card__header">
        <div>
          <h3 class="m-0">{{ poll.title }}</h3>
          <p class="text-muted text-sm m-0">
            {{ periodLabel(poll) }}
            <span v-if="poll.is_secret"> · Voto secreto</span>
          </p>
        </div>
        <span class="badge" :class="statusBadge(poll).cls">{{ statusBadge(poll).label }}</span>
      </header>

      <p v-if="poll.description" class="poll-card__description">{{ poll.description }}</p>

      <!-- Participación -->
      <div class="poll-participation">
        <div class="poll-participation__bar" role="progressbar" :aria-valuenow="poll.summary.voted_count" aria-valuemin="0" :aria-valuemax="poll.summary.electors_count" :aria-label="`Participación: ${poll.summary.voted_count} de ${poll.summary.electors_count} clubes`">
          <span :style="{ width: `${poll.summary.participation_pct}%` }" />
        </div>
        <span class="text-sm">
          <strong>{{ poll.summary.voted_count }}</strong> de {{ poll.summary.electors_count }} clubes votaron
          <template v-if="poll.status === 'CERRADA'"> · {{ poll.summary.abstention_count }} abstención{{ poll.summary.abstention_count === 1 ? '' : 'es' }}</template>
        </span>
      </div>

      <!-- Votación abierta: emitir voto (representante de club) -->
      <template v-if="poll.status === 'ABIERTA'">
        <div v-for="mv in poll.my_votes" :key="mv.club_id" class="poll-ballot">
          <p class="poll-ballot__club">Voto de <strong>{{ mv.club?.name || 'tu club' }}</strong></p>
          <p v-if="mv.status === 'VOTO'" class="poll-ballot__done">
            ✓ Votó por <strong>{{ optionLabel(poll, mv.option_id) }}</strong>
            <span class="text-muted text-sm">({{ formatDateTime(mv.voted_at) }})</span>
          </p>
          <p v-else-if="!hasOpened(poll)" class="text-muted">La votación abre el {{ formatDateTime(poll.opens_at) }}.</p>
          <form v-else class="poll-ballot__form" @submit.prevent="submitVote(poll, mv.club_id)">
            <label v-for="o in poll.options" :key="o.id" class="poll-ballot__option">
              <input v-model="ballots[ballotKey(poll.id, mv.club_id)]" type="radio" :name="ballotKey(poll.id, mv.club_id)" :value="o.id" />
              {{ o.label }}
            </label>
            <button type="submit" class="btn btn-primary btn-sm" :disabled="!ballots[ballotKey(poll.id, mv.club_id)]">Emitir voto</button>
          </form>
        </div>
        <p v-if="!isAdmin && !poll.my_votes.length" class="text-muted text-sm">Tu club no está habilitado para votar en esta elección.</p>
        <p class="text-muted text-sm">Los resultados se publican al cerrar la votación.</p>
      </template>

      <!-- Votación cerrada: resultados publicados -->
      <template v-else>
        <ul class="poll-results">
          <li v-for="r in poll.results" :key="r.option_id" class="poll-results__row" :class="{ 'is-winner': poll.winners.includes(r.option_id) && !poll.is_tie }">
            <div class="poll-results__label">
              <span>{{ r.label }}<span v-if="poll.winners.includes(r.option_id) && !poll.is_tie" class="badge badge-success poll-results__tag">Ganadora</span></span>
              <span class="text-sm"><strong>{{ r.votes }}</strong> voto{{ r.votes === 1 ? '' : 's' }} · {{ r.pct }}%</span>
            </div>
            <div class="poll-results__bar"><span :style="{ width: `${r.pct}%` }" /></div>
          </li>
        </ul>
        <p v-if="poll.is_tie" class="alert poll-tie">Empate entre las alternativas más votadas.</p>
        <p v-else-if="!poll.winners.length" class="text-muted text-sm">No se emitieron votos.</p>

        <p v-for="mv in poll.my_votes" :key="mv.club_id" class="text-sm">
          {{ mv.club?.name || 'Tu club' }}:
          <strong v-if="mv.status === 'VOTO'">votó por {{ optionLabel(poll, mv.option_id) }}</strong>
          <strong v-else>abstención</strong>
        </p>

        <section class="poll-resolution">
          <h4 class="m-0">Resolución</h4>
          <template v-if="editingResolutionId === poll.id">
            <textarea v-model="resolutionDraft" class="input" rows="4" maxlength="5000" aria-label="Resolución" />
            <div class="poll-actions">
              <button type="button" class="btn btn-secondary btn-sm" @click="editingResolutionId = null">Cancelar</button>
              <button type="button" class="btn btn-primary btn-sm" @click="saveResolution(poll)">Guardar resolución</button>
            </div>
          </template>
          <template v-else>
            <p v-if="poll.resolution" class="poll-resolution__text">{{ poll.resolution }}</p>
            <p v-else class="text-muted text-sm">Sin comentario ni resolución registrada.</p>
            <button v-if="isAdmin" type="button" class="btn btn-secondary btn-sm" @click="startEditResolution(poll)">
              {{ poll.resolution ? 'Editar resolución' : 'Agregar resolución' }}
            </button>
          </template>
        </section>
      </template>

      <!-- Cierre anticipado (admin) -->
      <section v-if="isAdmin && poll.status === 'ABIERTA' && closingId === poll.id" class="poll-resolution">
        <label class="label" :for="`close-res-${poll.id}`">Comentario o resolución (opcional)</label>
        <textarea :id="`close-res-${poll.id}`" v-model="resolutionDraft" class="input" rows="4" maxlength="5000" placeholder="Ej: Se aprueba por mayoría el nuevo reglamento, vigente desde la próxima fecha." />
        <p class="text-muted text-sm">Los {{ poll.summary.pending_count }} clubes que aún no votan quedarán como abstención. Esta acción no se puede deshacer.</p>
        <div class="poll-actions">
          <button type="button" class="btn btn-secondary btn-sm" @click="closingId = null">Cancelar</button>
          <button type="button" class="btn btn-danger btn-sm" @click="submitClose(poll)">Cerrar y publicar</button>
        </div>
      </section>

      <footer class="poll-actions">
        <button type="button" class="btn btn-secondary btn-sm" @click="toggleDetail(poll)">
          {{ expandedId === poll.id ? 'Ocultar detalle por club' : 'Ver detalle por club' }}
        </button>
        <template v-if="isAdmin && poll.status === 'ABIERTA' && closingId !== poll.id">
          <button v-if="poll.summary.voted_count === 0" type="button" class="btn btn-secondary btn-sm" @click="confirmDelete(poll)">Eliminar</button>
          <button type="button" class="btn btn-danger btn-sm" @click="startClose(poll)">Cerrar votación</button>
        </template>
      </footer>

      <div v-if="expandedId === poll.id" class="table-container poll-detail">
        <table class="table">
          <thead>
            <tr><th>Club</th><th>Estado</th><th v-if="showChoiceColumn(poll)">Alternativa</th><th>Fecha</th></tr>
          </thead>
          <tbody>
            <tr v-if="!detail"><td :colspan="showChoiceColumn(poll) ? 4 : 3" class="text-center text-muted">Cargando...</td></tr>
            <tr v-for="c in detail?.clubs || []" :key="c.club_id">
              <td>{{ c.club?.name || '—' }}</td>
              <td><span class="badge" :class="VOTE_STATUS[c.status].cls">{{ VOTE_STATUS[c.status].label }}</span></td>
              <td v-if="showChoiceColumn(poll)">{{ c.option_id ? optionLabel(poll, c.option_id) : '—' }}</td>
              <td>{{ c.voted_at ? formatDateTime(c.voted_at) : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>

    <PollFormModal :open="showForm" :saving="saving" :seasons="seasons" @close="showForm = false" @submit="submitCreate" />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useNotifyStore } from '../stores/notify';
import { getSeasons } from '../services/seasons.service.js';
import { listPolls, getPoll, createPoll, castVote, closePoll, updatePollResolution, deletePoll } from '../services/polls.service.js';
import PollFormModal from '../components/PollFormModal.vue';

const TABS = [
  { value: 'ABIERTA', label: 'En curso' },
  { value: 'CERRADA', label: 'Resultados' },
];
const VOTE_STATUS = {
  VOTO: { label: 'Votó', cls: 'badge-success' },
  PENDIENTE: { label: 'Pendiente', cls: 'badge-warning' },
  ABSTENCION: { label: 'Abstención', cls: 'badge-secondary' },
};

const authStore = useAuthStore();
const { notifySuccess, notifyError, confirm } = useNotifyStore();

const isAdmin = computed(() => authStore.isOrgAdmin());
// Un representante (ADMIN_CLUB puro) no tiene org propia: se usa la org de su club.
const orgId = computed(() => authStore.state.org?.id || authStore.myClub()?.org_id);

const polls = ref([]);
const seasons = ref([]);
const loading = ref(false);
const loadError = ref('');
const tab = ref('ABIERTA');
const showForm = ref(false);
const saving = ref(false);
const ballots = reactive({});
const expandedId = ref(null);
const detail = ref(null);
const closingId = ref(null);
const editingResolutionId = ref(null);
const resolutionDraft = ref('');

const visiblePolls = computed(() => polls.value.filter((p) => p.status === tab.value));
const countByStatus = computed(() => ({
  ABIERTA: polls.value.filter((p) => p.status === 'ABIERTA').length,
  CERRADA: polls.value.filter((p) => p.status === 'CERRADA').length,
}));

const ballotKey = (pollId, clubId) => `${pollId}:${clubId}`;
const optionLabel = (poll, optionId) => poll.options.find((o) => o.id === optionId)?.label || '—';
const hasOpened = (poll) => new Date(poll.opens_at) <= new Date();
const showChoiceColumn = (poll) => poll.status === 'CERRADA' && !poll.is_secret;
const formatDateTime = (iso) => (iso ? new Date(iso).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

const periodLabel = (poll) => {
  if (poll.status === 'CERRADA') {
    const early = poll.closed_by && new Date(poll.closed_at) < new Date(poll.closes_at);
    return `Cerrada el ${formatDateTime(poll.closed_at || poll.closes_at)}${early ? ' (cierre anticipado)' : ''}`;
  }
  if (!hasOpened(poll)) return `Abre el ${formatDateTime(poll.opens_at)} · cierra el ${formatDateTime(poll.closes_at)}`;
  return `Abierta hasta el ${formatDateTime(poll.closes_at)}`;
};

const statusBadge = (poll) => {
  if (poll.status === 'CERRADA') return { label: 'Cerrada', cls: 'badge-secondary' };
  if (!hasOpened(poll)) return { label: 'Programada', cls: 'badge-info' };
  return { label: 'Abierta', cls: 'badge-success' };
};

const errMsg = (e, fallback) => e.response?.data?.error?.message || fallback;

const loadPolls = async () => {
  if (!orgId.value) return;
  loading.value = true;
  try {
    const res = await listPolls(orgId.value);
    polls.value = res.data?.data?.polls ?? [];
    loadError.value = '';
  } catch (e) {
    loadError.value = errMsg(e, 'No se pudieron cargar las votaciones.');
  } finally {
    loading.value = false;
  }
};

const loadSeasons = async () => {
  if (!isAdmin.value) return;
  try {
    const res = await getSeasons({ org_id: orgId.value });
    seasons.value = res.data?.data?.seasons ?? res.data?.seasons ?? [];
  } catch (e) {
    console.error('[PollsView] getSeasons error:', e);
  }
};

const refreshDetail = async (pollId) => {
  detail.value = null;
  try {
    const res = await getPoll(pollId);
    detail.value = res.data?.data?.poll ?? null;
  } catch (e) {
    expandedId.value = null;
    notifyError(errMsg(e, 'No se pudo cargar el detalle de la votación.'));
  }
};

const toggleDetail = async (poll) => {
  if (expandedId.value === poll.id) { expandedId.value = null; return; }
  expandedId.value = poll.id;
  await refreshDetail(poll.id);
};

const submitCreate = async (payload) => {
  saving.value = true;
  try {
    await createPoll({ org_id: orgId.value, ...payload });
    showForm.value = false;
    tab.value = 'ABIERTA';
    notifySuccess('Votación creada. Los representantes de los clubes ya pueden votar en el período definido.');
    await loadPolls();
  } catch (e) {
    notifyError(errMsg(e, 'Error al crear la votación.'));
  } finally {
    saving.value = false;
  }
};

const submitVote = async (poll, clubId) => {
  const key = ballotKey(poll.id, clubId);
  const optionId = ballots[key];
  if (!optionId) return;
  const ok = await confirm({
    title: 'Confirmar voto',
    message: `¿Emitir el voto de tu club por "${optionLabel(poll, optionId)}"? El voto es definitivo y no se puede cambiar.`,
    confirmText: 'Votar',
  });
  if (!ok) return;
  try {
    await castVote(poll.id, clubId, optionId);
    delete ballots[key];
    notifySuccess('Voto registrado.');
    await loadPolls();
    if (expandedId.value === poll.id) await refreshDetail(poll.id);
  } catch (e) {
    notifyError(errMsg(e, 'No se pudo registrar el voto.'));
    await loadPolls();
  }
};

const startClose = (poll) => {
  editingResolutionId.value = null;
  resolutionDraft.value = '';
  closingId.value = poll.id;
};

const submitClose = async (poll) => {
  try {
    await closePoll(poll.id, resolutionDraft.value.trim() || null);
    closingId.value = null;
    tab.value = 'CERRADA';
    notifySuccess('Votación cerrada. Los resultados quedaron publicados.');
    await loadPolls();
    if (expandedId.value === poll.id) await refreshDetail(poll.id);
  } catch (e) {
    notifyError(errMsg(e, 'No se pudo cerrar la votación.'));
    await loadPolls();
  }
};

const startEditResolution = (poll) => {
  closingId.value = null;
  resolutionDraft.value = poll.resolution || '';
  editingResolutionId.value = poll.id;
};

const saveResolution = async (poll) => {
  try {
    await updatePollResolution(poll.id, resolutionDraft.value.trim() || null);
    editingResolutionId.value = null;
    notifySuccess('Resolución guardada.');
    await loadPolls();
  } catch (e) {
    notifyError(errMsg(e, 'No se pudo guardar la resolución.'));
  }
};

const confirmDelete = async (poll) => {
  const ok = await confirm({
    title: 'Eliminar votación',
    message: `¿Eliminar la votación "${poll.title}"? Aún no tiene votos emitidos.`,
    isDestructive: true,
  });
  if (!ok) return;
  try {
    await deletePoll(poll.id);
    notifySuccess('Votación eliminada.');
    await loadPolls();
  } catch (e) {
    notifyError(errMsg(e, 'No se pudo eliminar la votación.'));
  }
};

onMounted(async () => {
  await Promise.allSettled([loadPolls(), loadSeasons()]);
  // Si no hay nada en curso, abrir directamente los resultados.
  if (!countByStatus.value.ABIERTA && countByStatus.value.CERRADA) tab.value = 'CERRADA';
});
</script>

<style scoped>
.py-lg { padding-top: var(--spacing-lg); padding-bottom: var(--spacing-lg); }

.polls-tabs { display: flex; gap: 8px; border-bottom: 1px solid var(--border-color); }
.polls-tabs__tab { padding: 8px 16px; background: none; border: 0; border-bottom: 2px solid transparent; color: var(--text-muted); font-weight: 600; cursor: pointer; }
.polls-tabs__tab.is-active { color: var(--text-primary); border-bottom-color: var(--primary-solid); }
.polls-tabs__count { margin-left: 4px; padding: 0 8px; border-radius: var(--radius-full); background: var(--bg-hover); font-size: .75rem; }

.poll-card { display: grid; gap: 16px; }
.poll-card__header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.poll-card__description { margin: 0; white-space: pre-line; }

.poll-participation { display: grid; gap: 6px; }
.poll-participation__bar, .poll-results__bar { height: 8px; border-radius: var(--radius-full); background: var(--bg-hover); overflow: hidden; }
.poll-participation__bar span, .poll-results__bar span { display: block; height: 100%; background: var(--primary-solid); border-radius: inherit; transition: width .3s ease; }

.poll-ballot { padding: 12px 16px; border: 1px solid var(--border-color); border-radius: var(--radius-lg); }
.poll-ballot__club { margin: 0 0 8px; }
.poll-ballot__done { margin: 0; }
.poll-ballot__form { display: grid; gap: 8px; justify-items: start; }
.poll-ballot__option { display: flex; align-items: center; gap: 8px; cursor: pointer; }

.poll-results { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
.poll-results__label { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 4px; }
.poll-results__row.is-winner .poll-results__label { font-weight: 700; }
.poll-results__row:not(.is-winner) .poll-results__bar span { opacity: .55; }
.poll-results__tag { margin-left: 8px; }
.poll-tie { margin: 0; }

.poll-resolution { display: grid; gap: 8px; padding-top: 12px; border-top: 1px solid var(--border-color); justify-items: start; }
.poll-resolution .input { width: 100%; }
.poll-resolution__text { margin: 0; white-space: pre-line; }

.poll-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; width: 100%; }
.poll-detail { margin-top: -4px; }

@media (max-width: 640px) {
  .poll-card__header { flex-direction: column; }
  .poll-results__label { flex-direction: column; gap: 2px; }
  .poll-actions .btn { flex: 1 1 100%; }
}
</style>
