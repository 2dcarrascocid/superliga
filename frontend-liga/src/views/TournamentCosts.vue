<template>
  <div class="container mt-md">
    <div class="flex justify-between items-center mb-lg">
      <h2>Costos y Finanzas del Torneo</h2>
      <button class="btn btn-secondary" @click="$router.push(`/tournaments/${tournamentId}`)">&larr; Torneo</button>
    </div>

    <div v-if="error" class="alert alert-error mb-md">{{ error }}</div>

    <div class="stats-row mb-md">
      <div class="card stat-card">
        <span class="text-muted text-sm">Costos por Jornada</span>
        <strong class="stat-value">{{ formatMoney(summary?.totalMatchdayCosts) }}</strong>
      </div>
      <div class="card stat-card">
        <span class="text-muted text-sm">Costos por Partido</span>
        <strong class="stat-value">{{ formatMoney(summary?.totalMatchCosts) }}</strong>
      </div>
      <div class="card stat-card">
        <span class="text-muted text-sm">Total General</span>
        <strong class="stat-value">{{ formatMoney(summary?.grandTotal) }}</strong>
      </div>
    </div>

    <!-- Costos por Fecha/Jornada -->
    <div class="card mb-md">
      <h3 class="mb-md">Costos por Fecha / Jornada</h3>
      <form class="cost-row" @submit.prevent="onAddMatchdayCost">
        <div class="input-group flex-1">
          <label class="label">Jornada</label>
          <select v-model="matchdayCostForm.matchday_id" class="input" required>
            <option value="" disabled>Selecciona una jornada</option>
            <option v-for="m in matchdays" :key="m.id" :value="m.id">{{ m.name || `Fecha ${m.number}` }}</option>
          </select>
        </div>
        <div class="input-group flex-1">
          <label class="label">Concepto</label>
          <input v-model="matchdayCostForm.concept" class="input" placeholder="Arriendo general" required />
        </div>
        <div class="input-group" style="max-width: 160px;">
          <label class="label">Monto</label>
          <input v-model.number="matchdayCostForm.amount" type="number" min="0" step="1" class="input" required />
        </div>
        <button type="submit" class="btn btn-primary" style="align-self: flex-end;">Agregar</button>
      </form>

      <div class="table-container mt-md">
        <table class="table">
          <thead>
            <tr><th>Jornada</th><th>Concepto</th><th class="text-center">Monto</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-if="matchdayCosts.length === 0"><td colspan="4" class="text-center py-lg">Sin costos registrados.</td></tr>
            <tr v-for="cost in matchdayCosts" :key="cost.id">
              <td>{{ matchdayLabel(cost.matchday_id) }}</td>
              <td>{{ cost.concept }}</td>
              <td class="text-center">{{ formatMoney(cost.amount) }}</td>
              <td><button class="btn btn-sm btn-danger" @click="onRemoveMatchdayCost(cost)">Eliminar</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Costos por Partido -->
    <div class="card">
      <h3 class="mb-md">Costos por Partido</h3>
      <form class="cost-row" @submit.prevent="onAddMatchCost">
        <div class="input-group flex-1">
          <label class="label">Partido</label>
          <select v-model="matchCostForm.match_id" class="input" required>
            <option value="" disabled>Selecciona un partido</option>
            <option v-for="m in matches" :key="m.id" :value="m.id">
              {{ m.home_club?.name || '?' }} vs {{ m.away_club?.name || '?' }}
            </option>
          </select>
        </div>
        <div class="input-group flex-1">
          <label class="label">Concepto</label>
          <input v-model="matchCostForm.concept" class="input" placeholder="Arbitraje" required />
        </div>
        <div class="input-group" style="max-width: 160px;">
          <label class="label">Monto</label>
          <input v-model.number="matchCostForm.amount" type="number" min="0" step="1" class="input" required />
        </div>
        <button type="submit" class="btn btn-primary" style="align-self: flex-end;">Agregar</button>
      </form>

      <div class="table-container mt-md">
        <table class="table">
          <thead>
            <tr><th>Partido</th><th>Concepto</th><th class="text-center">Monto</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-if="matchCosts.length === 0"><td colspan="4" class="text-center py-lg">Sin costos registrados.</td></tr>
            <tr v-for="cost in matchCosts" :key="cost.id">
              <td>{{ matchLabel(cost.match_id) }}</td>
              <td>{{ cost.concept }}</td>
              <td class="text-center">{{ formatMoney(cost.amount) }}</td>
              <td><button class="btn btn-sm btn-danger" @click="onRemoveMatchCost(cost)">Eliminar</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useMatchesStore } from '../stores/matches';
import { useNotifyStore } from '../stores/notify';
import {
  getCostsSummary, createMatchdayCost, deleteMatchdayCost, createMatchCost, deleteMatchCost,
} from '../services/tournamentCosts.service';

const route = useRoute();
const tournamentId = route.params.tournamentId;

const { matchdays, items: matches, fetchMatchdays, fetchMatches } = useMatchesStore();
const { confirm, notifySuccess, notifyError } = useNotifyStore();

const error = ref(null);
const summary = ref(null);
const matchdayCosts = ref([]);
const matchCosts = ref([]);

const matchdayCostForm = reactive({ matchday_id: '', concept: '', amount: null });
const matchCostForm = reactive({ match_id: '', concept: '', amount: null });

const formatMoney = (value) => `$${Number(value || 0).toLocaleString('es-CL')}`;
const matchdayLabel = (id) => {
  const m = matchdays.value.find((x) => x.id === id);
  return m ? (m.name || `Fecha ${m.number}`) : '—';
};
const matchLabel = (id) => {
  const m = matches.value.find((x) => x.id === id);
  return m ? `${m.home_club?.name || '?'} vs ${m.away_club?.name || '?'}` : '—';
};

const loadSummary = async () => {
  try {
    const response = await getCostsSummary(tournamentId);
    const data = response.data?.data ?? response.data;
    summary.value = data.summary;
    matchdayCosts.value = data.matchdayCosts ?? [];
    matchCosts.value = data.matchCosts ?? [];
  } catch (e) {
    error.value = e.response?.data?.error?.message || 'Error al cargar los costos';
  }
};

const onAddMatchdayCost = async () => {
  try {
    await createMatchdayCost(matchdayCostForm.matchday_id, matchdayCostForm);
    matchdayCostForm.concept = '';
    matchdayCostForm.amount = null;
    notifySuccess('Costo de fecha agregado');
    await loadSummary();
  } catch (e) {
    error.value = e.response?.data?.error?.message || 'Error al agregar el costo';
    notifyError(error.value);
  }
};

const onRemoveMatchdayCost = async (cost) => {
  const ok = await confirm({
    title: '¿Eliminar costo?',
    message: `¿Estás seguro de eliminar el costo "${cost.concept || 'sin concepto'}" ($${Number(cost.amount || 0).toLocaleString('es-CL')})?`,
    confirmText: 'Eliminar',
    isDestructive: true,
  });
  if (!ok) return;
  try {
    await deleteMatchdayCost(cost.id);
    notifySuccess('Costo eliminado');
    await loadSummary();
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al eliminar el costo');
  }
};

const onAddMatchCost = async () => {
  try {
    await createMatchCost(matchCostForm.match_id, matchCostForm);
    matchCostForm.concept = '';
    matchCostForm.amount = null;
    notifySuccess('Costo de partido agregado');
    await loadSummary();
  } catch (e) {
    error.value = e.response?.data?.error?.message || 'Error al agregar el costo';
    notifyError(error.value);
  }
};

const onRemoveMatchCost = async (cost) => {
  const ok = await confirm({
    title: '¿Eliminar costo?',
    message: `¿Estás seguro de eliminar el costo "${cost.concept || 'sin concepto'}" ($${Number(cost.amount || 0).toLocaleString('es-CL')})?`,
    confirmText: 'Eliminar',
    isDestructive: true,
  });
  if (!ok) return;
  try {
    await deleteMatchCost(cost.id);
    notifySuccess('Costo eliminado');
    await loadSummary();
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al eliminar el costo');
  }
};

onMounted(async () => {
  await Promise.all([
    fetchMatchdays(tournamentId),
    fetchMatches(tournamentId, {}),
    loadSummary(),
  ]);
});
</script>

<style scoped>
.stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
.stat-card { display: flex; flex-direction: column; gap: 0.35rem; }
.stat-value { font-size: 1.5rem; font-weight: 800; color: var(--text-primary); }

.cost-row { display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap; }
.flex-1 { flex: 1; min-width: 200px; }

.py-lg { padding-top: var(--spacing-lg); padding-bottom: var(--spacing-lg); }
.btn-sm { padding: 0.4rem 0.8rem; font-size: 0.875rem; }
</style>
