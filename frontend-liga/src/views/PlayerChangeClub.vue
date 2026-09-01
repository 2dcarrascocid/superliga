<template>
  <div class="container mt-md">
    <div class="flex items-center gap-md mb-lg">
       <button class="btn btn-secondary btn-sm" @click="$router.go(-1)">
           &larr; Volver
       </button>
       <h2>Cambio de Club</h2>
    </div>

    <div v-if="loading && !clubs.length" class="text-center py-lg">
        Cargando...
    </div>

    <div v-if="error" class="alert alert-error mb-md">
      {{ error }}
    </div>

    <div class="card max-w-lg mx-auto">
       <div class="mb-md p-md bg-secondary rounded text-sm" v-if="player">
           <p><strong>Jugador:</strong> {{ player.first_name }} {{ player.last_name }}</p>
           <p><strong>Club Actual:</strong> {{ player.club?.name || 'Sin Club' }}</p>
       </div>

       <form @submit.prevent="submitChange">
           <div class="input-group">
               <label class="label">Club de Destino *</label>
               <select v-model="form.to_club_id" class="input" required>
                   <option :value="null">Seleccione un club...</option>
                   <option v-for="club in availableClubs" :key="club.id" :value="club.id">
                       {{ club.name }}
                   </option>
               </select>
           </div>

           <div class="input-group">
               <label class="label">Tipo de Movimiento *</label>
               <select v-model="form.type" class="input" required>
                   <option value="TRANSFER">Transferencia Definitiva</option>
                   <option value="LOAN">Préstamo</option>
               </select>
           </div>

           <div v-if="form.type === 'LOAN'" class="grid grid-cols-2 gap-md">
               <div class="input-group">
                   <label class="label">Fecha Inicio</label>
                   <input v-model="form.start_date" type="date" class="input" />
               </div>
               <div class="input-group">
                   <label class="label">Fecha Fin</label>
                   <input v-model="form.end_date" type="date" class="input" />
               </div>
           </div>

           <div class="flex justify-end gap-md mt-lg">
              <button type="button" class="btn btn-secondary" @click="$router.go(-1)">
                Cancelar
              </button>
              <button type="submit" class="btn btn-primary" :disabled="loading">
                {{ loading ? 'Procesando...' : 'Confirmar Cambio' }}
              </button>
           </div>
       </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usePlayersStore } from '../stores/players';
import { useClubsStore } from '../stores/clubs';
import { useAuthStore } from '../stores/auth';
import { useNotifyStore } from '../stores/notify';

const route = useRoute();
const router = useRouter();
const playersStore = usePlayersStore();
const clubsStore = useClubsStore();
const authStore = useAuthStore();
const { confirm, notifySuccess, notifyError } = useNotifyStore();

const playerId = route.params.playerId;

const form = ref({
    to_club_id: null,
    type: 'TRANSFER',
    start_date: '',
    end_date: ''
});

const player = computed(() => playersStore.current);
const clubs = computed(() => clubsStore.items);
const loading = computed(() => playersStore.loading || clubsStore.loading);
const error = computed(() => playersStore.error || clubsStore.error);

// Filter out current club from list
const availableClubs = computed(() => {
    if (!player.value || !player.value.club_id) return clubs.value;
    return clubs.value.filter(c => c.id !== player.value.club_id);
});

const loadData = async () => {
    await playersStore.fetchPlayerById(playerId);
    // Fetch all clubs for the org (assuming default fetch does this or we pass filters)
    // We assume the user is in an org context.
    await clubsStore.fetchClubs({ limit: 100 }); // Fetch enough clubs
};

const submitChange = async () => {
    try {
        const ok = await confirm({
            title: '¿Confirmar cambio de club?',
            message: '¿Estás seguro de realizar este cambio de club para el jugador?',
            confirmText: 'Confirmar Cambio',
        });
        if (!ok) return;
        
        await playersStore.changePlayerClub(playerId, {
            to_club_id: form.value.to_club_id,
            type: form.value.type,
            start_date: form.value.start_date || null,
            end_date: form.value.end_date || null
        });
        notifySuccess('Cambio de club realizado exitosamente');
        router.push(`/players/${playerId}`);
    } catch (e) {
        notifyError(e.response?.data?.error?.message || 'Error al realizar el cambio de club');
    }
};

onMounted(() => {
    loadData();
});
</script>
