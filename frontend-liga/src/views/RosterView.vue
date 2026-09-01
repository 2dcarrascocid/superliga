<template>
  <div class="container mt-md">
    <div class="flex justify-between items-center mb-lg">
      <h2>Equipo del Club</h2>
      <button class="btn btn-secondary" @click="goBack">
        Volver
      </button>
    </div>

    <div v-if="error" class="alert alert-error">
      {{ error }}
    </div>

    <div class="card mb-lg">
      <div class="flex justify-between items-center mb-md">
        <h3>Roster</h3>
        <div class="badge-count" :class="{ 'badge-full': isFull }">
          {{ items.length }} / {{ limit }}
        </div>
      </div>
      <p class="text-muted text-sm mb-md">
        Jugadores activos en el club. Límite máximo {{ limit }}.
      </p>
      <button
        class="btn btn-primary btn-full"
        :disabled="isFull"
        @click="toggleAddPlayer"
      >
        {{ showAddPlayer ? 'Cancelar' : 'Agregar jugador existente' }}
      </button>
      <p v-if="isFull" class="text-danger text-sm mt-md">
        Límite alcanzado, no es posible agregar más jugadores.
      </p>
    </div>

    <div v-if="showAddPlayer" class="card mb-lg">
      <h3 class="mb-md">Agregar jugador al club</h3>
      <form class="flex flex-col gap-md" @submit.prevent="handleAddPlayer">
        <div class="input-group">
          <label class="label">ID jugador</label>
          <input v-model="addForm.player_id" class="input" required />
        </div>
        <button class="btn btn-primary" type="submit" :disabled="loading || isFull">
          {{ loading ? 'Agregando...' : 'Agregar al roster' }}
        </button>
      </form>
    </div>

    <div class="card">
      <div v-if="items.length === 0" class="text-muted text-sm">
        No hay jugadores en el roster.
      </div>
      <div v-else class="roster-list">
        <div
          v-for="entry in items"
          :key="entry.id"
          class="roster-row"
        >
          <div class="roster-info">
            <div class="roster-main">
              <span class="folio">#{{ formatFolio({ clubFolio: entry.club_folio, clubFolioDisplay: entry.club_folio_display, birthDate: entry.player?.birth_date }) ?? entry.id }}</span>
              <span class="name">{{ entry.player_name }}</span>
            </div>
            <div class="roster-meta">
              <span class="badge" :class="statusClass(entry.status)">
                {{ entry.status }}
              </span>
            </div>
          </div>
          <button
            class="btn btn-secondary"
            :disabled="entry.status === 'INACTIVE'"
            @click="deactivate(entry)"
          >
            Desactivar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useRosterStore } from '../stores/roster';
import { useNotifyStore } from '../stores/notify';
import { formatFolio } from '../utils/folio.js';

const route = useRoute();
const router = useRouter();
const { items, loading, error, limit, fetchRoster, addPlayerToRoster, updateRosterStatus } = useRosterStore();
const { confirm, notifySuccess, notifyError } = useNotifyStore();

const showAddPlayer = ref(false);

const addForm = reactive({
  player_id: '',
});

const isFull = computed(() => items.value.length >= limit.value);

const loadRoster = async () => {
  await fetchRoster(route.params.clubId);
};

const toggleAddPlayer = () => {
  showAddPlayer.value = !showAddPlayer.value;
};

const handleAddPlayer = async () => {
  try {
    await addPlayerToRoster(route.params.clubId, { ...addForm });
    addForm.player_id = '';
    notifySuccess('Jugador añadido al roster');
    await loadRoster();
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al añadir jugador al roster');
  }
};

const deactivate = async (entry) => {
  const ok = await confirm({
    title: '¿Desactivar jugador?',
    message: `¿Estás seguro de desactivar a ${entry.player?.first_name || ''} ${entry.player?.last_name || ''} del roster?`,
    confirmText: 'Desactivar',
    isDestructive: true,
  });
  if (!ok) return;
  try {
    await updateRosterStatus(route.params.clubId, entry.id, { status: 'INACTIVE' });
    notifySuccess('Jugador desactivado del roster');
    await loadRoster();
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al desactivar jugador');
  }
};

const goBack = () => {
  router.push(`/clubs/${route.params.clubId}`);
};

const statusClass = (status) => {
  if (status === 'ACTIVE') return 'status-active';
  return 'status-inactive';
};

onMounted(() => {
  loadRoster();
});
</script>

<style scoped>
.badge-count {
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  background: var(--bg-tertiary);
}

.badge-full {
  background: rgba(239, 68, 68, 0.2);
  color: #fecaca;
}

.roster-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.roster-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
}

.roster-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.roster-main {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.folio {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.name {
  font-weight: 500;
}

.badge {
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
}

.status-active {
  background: rgba(16, 185, 129, 0.15);
  color: #6ee7b7;
}

.status-inactive {
  background: rgba(148, 163, 184, 0.2);
  color: #cbd5e1;
}
</style>

