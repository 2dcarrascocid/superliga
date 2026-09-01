<template>
  <div class="card">
    <div class="roster-header">
      <h3 class="mb-md">Nómina — {{ series.name }}</h3>
      <button class="btn btn-sm btn-secondary" @click="$emit('back')">← Volver</button>
    </div>

    <!-- Jugadores ya asignados -->
    <div class="table-container mb-md">
      <table class="table">
        <thead>
          <tr><th>Jugador</th><th>Posición</th><th>Estado</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-if="roster.length === 0">
            <td colspan="4" class="text-center py-md text-muted text-sm">Sin jugadores asignados a esta serie.</td>
          </tr>
          <tr v-for="r in roster" :key="r.id">
            <td>
              {{ r.player?.first_name }} {{ r.player?.last_name }}
              <span class="age-chip">{{ playerAgeLabel(r.player?.birth_date) }}</span>
            </td>
            <td>{{ r.player?.position || '—' }}</td>
            <td><span class="status-badge status-badge--active">{{ r.series_status || 'INSCRITO' }}</span></td>
            <td><button class="btn btn-sm btn-danger" @click="onUnassignPlayer(r)">Quitar</button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Jugadores sugeridos por edad -->
    <div class="suggested-section">
      <div class="suggested-header">
        <div>
          <span class="suggested-title">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="vertical-align:middle;margin-right:4px;">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
            Sugeridos por edad
          </span>
          <span v-if="series.min_age" class="text-muted text-sm"> — {{ eligiblePlayers.length }} jugadores cumplen el requisito</span>
          <span v-else class="text-muted text-sm"> — sin restricción de edad</span>
        </div>
        <button
          v-if="eligiblePlayers.length > 0"
          class="btn btn-sm btn-accent"
          :disabled="bulkAssigning"
          @click="onAssignAllEligible"
        >
          <span v-if="bulkAssigning">Asignando…</span>
          <span v-else>⚡ Asignar todos ({{ eligiblePlayers.length }})</span>
        </button>
      </div>

      <p v-if="series.min_age" class="text-muted text-sm mb-sm">
        Edad mínima: <strong>{{ series.min_age }}</strong> ({{ series.age_restriction ? 'edad cumplida' : 'por año de nacimiento' }}).
        Solo se listan jugadores del club que cumplen el requisito y no están asignados aún.
      </p>

      <div v-if="eligiblePlayers.length === 0" class="empty-suggested">
        {{ unassignedClubPlayers.length === 0 ? 'Todos los jugadores elegibles ya están asignados a esta serie.' : 'No hay jugadores del club que cumplan los requisitos de edad.' }}
      </div>

      <div v-else class="player-chips">
        <div
          v-for="p in eligiblePlayers"
          :key="p.id"
          class="player-chip"
        >
          <span class="chip-name">{{ p.first_name }} {{ p.last_name }}</span>
          <span class="age-chip">{{ playerAgeLabel(p.birth_date) }}</span>
          <button class="chip-btn" :disabled="assigningIds.has(p.id)" @click="onAssignSingle(p)">
            <span v-if="assigningIds.has(p.id)">…</span>
            <span v-else>+</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Asignar manualmente -->
    <div class="manual-assign-row" v-if="unassignedClubPlayers.length > 0">
      <form class="series-row" @submit.prevent="onAssignPlayer">
        <div class="input-group flex-1">
          <label class="label text-sm">Asignar jugador manualmente</label>
          <select v-model="playerToAssign" class="input">
            <option value="" disabled>Selecciona un jugador…</option>
            <option v-for="p in unassignedClubPlayersAll" :key="p.id" :value="p.id">
              {{ p.first_name }} {{ p.last_name }} ({{ playerAgeLabel(p.birth_date) }})
              {{ meetsMinAge(p.birth_date) ? '' : '⚠️ no cumple edad' }}
            </option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary btn-sm" :disabled="!playerToAssign" style="align-self:flex-end;">Asignar</button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useClubSeriesStore } from '../stores/clubSeries';
import { useNotifyStore } from '../stores/notify';

const props = defineProps({
  series: { type: Object, required: true },
  clubRoster: { type: Array, default: () => [] },
});

defineEmits(['back']);

const { roster, fetchSeriesRoster, assignPlayer, unassignPlayer } = useClubSeriesStore();
const { confirm, notifySuccess, notifyError } = useNotifyStore();

const playerToAssign = ref('');
const bulkAssigning = ref(false);
const assigningIds = reactive(new Set());

// ── Cálculo de edades ────────────────────────────────────────────────────────

// Edad cumplida: años reales, considerando si ya pasó el cumpleaños de este año.
const exactAge = (birthDate) => {
  const b = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - b.getFullYear();
  const hadBirthdayThisYear = today.getMonth() > b.getMonth()
    || (today.getMonth() === b.getMonth() && today.getDate() >= b.getDate());
  if (!hadBirthdayThisYear) age--;
  return age;
};

// Edad por año de nacimiento: categoría, sin exigir cumpleaños ya pasado.
const ageByBirthYear = (birthDate) => new Date().getFullYear() - new Date(birthDate).getFullYear();

// Calcula la edad de un jugador según el modo configurado en la serie seleccionada.
const playerAge = (birthDate) => {
  if (!birthDate) return null;
  return props.series?.age_restriction ? exactAge(birthDate) : ageByBirthYear(birthDate);
};

const meetsMinAge = (birthDate) => {
  const minAge = props.series?.min_age;
  if (!minAge) return true;
  const age = playerAge(birthDate);
  return age === null ? true : age >= minAge;
};

// "EDAD-AÑO" (ej: 15-2011)
const playerAgeLabel = (birthDate) => {
  if (!birthDate) return 'sin edad';
  const age = playerAge(birthDate);
  const year = new Date(birthDate).getFullYear();
  return `${age}-${year}`;
};

// ── Jugadores ───────────────────────────────────────────────────────────────

/** IDs de jugadores ya asignados a la serie activa */
const assignedPlayerIds = computed(() => new Set(roster.value.map((r) => r.player?.id)));

/** Todos los jugadores del club activos en el roster (no asignados a esta serie) */
const unassignedClubPlayersAll = computed(() =>
  props.clubRoster
    .map((r) => r.player)
    .filter((p) => p && !assignedPlayerIds.value.has(p.id))
);

/** Jugadores no asignados que ADEMÁS cumplen edad → se usan en el selector de selección manual */
const unassignedClubPlayers = computed(() =>
  unassignedClubPlayersAll.value.filter((p) => meetsMinAge(p.birth_date))
);

/** Jugadores elegibles por edad para el panel de sugeridos (mismos que unassignedClubPlayers) */
const eligiblePlayers = computed(() => unassignedClubPlayers.value);

// ── Asignación de jugadores ──────────────────────────────────────────────────

const onAssignPlayer = async () => {
  if (!playerToAssign.value || !props.series) return;
  try {
    await assignPlayer(props.series.id, playerToAssign.value);
    playerToAssign.value = '';
    notifySuccess('Jugador asignado a la serie');
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al asignar jugador');
  }
};

const onAssignSingle = async (player) => {
  if (!props.series) return;
  assigningIds.add(player.id);
  try {
    await assignPlayer(props.series.id, player.id);
  } catch (e) {
    notifyError(e.response?.data?.error?.message || `Error al asignar a ${player.first_name}`);
  } finally {
    assigningIds.delete(player.id);
  }
};

const onAssignAllEligible = async () => {
  if (!props.series || eligiblePlayers.value.length === 0) return;
  bulkAssigning.value = true;
  let ok = 0;
  let fail = 0;
  for (const p of eligiblePlayers.value) {
    try {
      await assignPlayer(props.series.id, p.id);
      ok++;
    } catch {
      fail++;
    }
  }
  bulkAssigning.value = false;
  if (ok > 0 && fail === 0) notifySuccess(`${ok} jugador(es) asignado(s) exitosamente`);
  else if (ok > 0 && fail > 0) notifySuccess(`${ok} asignado(s), ${fail} con error (verifique edades)`);
  else notifyError('No se pudo asignar ningún jugador');
};

const onUnassignPlayer = async (rosterRow) => {
  if (!props.series) return;
  const ok = await confirm({
    title: '¿Quitar de la serie?',
    message: `¿Quitar a ${rosterRow.player?.first_name || ''} ${rosterRow.player?.last_name || ''} de esta serie?`,
    confirmText: 'Quitar',
    isDestructive: true,
  });
  if (!ok) return;
  try {
    await unassignPlayer(props.series.id, rosterRow.player.id);
    notifySuccess('Jugador quitado de la serie');
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al quitar jugador');
  }
};

watch(
  () => props.series?.id,
  (seriesId) => {
    playerToAssign.value = '';
    if (seriesId) fetchSeriesRoster(seriesId);
  },
);

onMounted(() => {
  if (props.series?.id) fetchSeriesRoster(props.series.id);
});
</script>

<style scoped>
.roster-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}
.roster-header h3 { margin-bottom: 0; }

.series-row { display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap; }
.flex-1 { flex: 1; min-width: 200px; }

.py-md { padding-top: var(--spacing-md); padding-bottom: var(--spacing-md); }
.btn-sm { padding: 0.4rem 0.8rem; font-size: 0.875rem; }

/* Status badges */
.status-badge {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0.2rem 0.6rem; border-radius: var(--radius-full);
  font-size: 0.75rem; font-weight: 700;
}
.status-badge--active { background: rgba(0, 230, 118, 0.14); color: var(--primary-solid, #00e676); }

/* Age chip */
.age-chip {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 600;
  background: rgba(79, 195, 247, 0.12);
  color: #4fc3f7;
  border-radius: 4px;
  padding: 1px 5px;
  margin-left: 5px;
  vertical-align: middle;
}

/* Suggested section */
.suggested-section {
  background: rgba(0, 230, 118, 0.04);
  border: 1px solid rgba(0, 230, 118, 0.15);
  border-radius: var(--radius-md, 8px);
  padding: 1rem;
  margin-bottom: 1rem;
}
.suggested-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}
.suggested-title {
  font-size: 0.875rem;
  font-weight: 700;
  color: #00e676;
}
.empty-suggested {
  font-size: 0.85rem;
  color: var(--text-muted);
  font-style: italic;
  padding: 0.5rem 0;
}

/* Player chips */
.player-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
.player-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 20px;
  padding: 4px 8px 4px 10px;
  font-size: 0.82rem;
  transition: border-color 0.2s;
}
.player-chip:hover { border-color: rgba(0,230,118,0.4); }
.chip-name { font-weight: 500; }
.chip-btn {
  width: 20px; height: 20px;
  border-radius: 50%;
  border: none;
  background: #00e676;
  color: #141622;
  font-weight: 800;
  font-size: 1rem;
  cursor: pointer;
  line-height: 20px;
  text-align: center;
  padding: 0;
  display: flex; align-items: center; justify-content: center;
  transition: opacity 0.15s;
}
.chip-btn:disabled { opacity: 0.4; cursor: default; }

/* Accent button */
.btn-accent {
  background: linear-gradient(135deg, #00e676, #1de9b6);
  color: #141622;
  font-weight: 700;
  border: none;
}
.btn-accent:hover:not(:disabled) { opacity: 0.88; }
.btn-accent:disabled { opacity: 0.45; cursor: default; }

/* Manual assign */
.manual-assign-row {
  border-top: 1px solid rgba(255,255,255,0.06);
  padding-top: 1rem;
  margin-top: 0.5rem;
}

.mb-md { margin-bottom: 1rem; }
.mb-sm { margin-bottom: 0.5rem; }
</style>
