<template>
  <div class="container mt-md">
    <div class="flex items-center gap-md mb-lg">
       <button class="btn btn-secondary btn-sm" @click="$router.go(-1)">
           &larr; Volver
       </button>
       <h2>Editar Jugador</h2>
    </div>

    <div v-if="loading && !form.id" class="text-center py-lg">
        Cargando datos...
    </div>

    <div v-else-if="error" class="alert alert-error mb-md">
      {{ error }}
    </div>

    <div v-else class="card">
      <form @submit.prevent="savePlayer">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-md">
          <!-- Personal Info -->
          <div class="input-group">
            <label class="label">Nombre *</label>
            <input v-model="form.first_name" class="input" required />
          </div>
          <div class="input-group">
            <label class="label">Apellido *</label>
            <input v-model="form.last_name" class="input" required />
          </div>
          <div class="input-group">
            <label class="label">Fecha de Nacimiento</label>
            <input v-model="form.birth_date" type="date" class="input" />
          </div>
          <div class="input-group">
            <label class="label">RUT / DNI</label>
            <input v-model="form.rut" class="input" />
          </div>
           <div class="input-group">
            <label class="label">Dirección</label>
            <input v-model="form.address" class="input" />
          </div>
           <div class="input-group">
            <label class="label">Teléfono</label>
            <input v-model="form.phone" class="input" />
          </div>
           <div class="input-group">
            <label class="label">Email</label>
            <input v-model="form.email" type="email" class="input" />
          </div>

          <!-- Sports Info -->
          <div class="input-group">
            <label class="label">Categoría</label>
            <select v-model="form.category_id" class="input">
                <option :value="null">Sin categoría</option>
                <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                  {{ cat.name }}
                </option>
            </select>
          </div>
          <div class="input-group">
            <label class="label">Posición</label>
            <select v-model="form.position" class="input">
                 <option value="">Seleccione...</option>
                 <option value="GK">Portero</option>
                 <option value="DEF">Defensa</option>
                 <option value="MID">Mediocampista</option>
                 <option value="FWD">Delantero</option>
            </select>
          </div>
        </div>
        
        <div class="input-group mt-md">
            <label class="label">Foto (Actualizar)</label>
             <input type="file" @change="handleFileChange" accept="image/*" class="input" />
        </div>

        <div class="flex justify-end gap-md mt-lg">
          <button type="button" class="btn btn-secondary" @click="$router.go(-1)">
            Cancelar
          </button>
          <button type="submit" class="btn btn-primary" :disabled="loading">
            {{ loading ? 'Guardando...' : 'Guardar Cambios' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usePlayersStore } from '../stores/players';
import { listCategories } from '../services/categories.service.js';

const route = useRoute();
const router = useRouter();
const playersStore = usePlayersStore();
const playerId = route.params.playerId;

const form = ref({
    id: null,
    first_name: '',
    last_name: '',
    birth_date: '',
    rut: '',
    address: '',
    phone: '',
    email: '',
    category_id: null,
    position: '',
});

const categories  = ref([]);
const selectedFile = ref(null);
const loading = playersStore.loading;
const error = playersStore.error;

const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) selectedFile.value = file;
};

const loadPlayer = async () => {
    await playersStore.fetchPlayerById(playerId);
    const p = playersStore.current.value;
    if (!p) return;

    form.value = {
        id:          p.id,
        first_name:  p.first_name  || '',
        last_name:   p.last_name   || '',
        birth_date:  p.birth_date  ? p.birth_date.split('T')[0] : '',
        rut:         p.rut         || '',
        address:     p.address     || '',
        phone:       p.phone       || '',
        email:       p.email       || '',
        category_id: p.category_id || null,
        position:    p.position    || '',
    };

    const clubId = p.active_roster?.club_id || p.club_id;
    if (clubId) {
        try {
            const res = await listCategories(clubId);
            categories.value = res.data?.data?.categories ?? [];
        } catch (e) {
            console.error('[PlayerEdit] listCategories error:', e);
        }
    }
};

const savePlayer = async () => {
    try {
        const payload = { ...form.value };
        if (!payload.category_id) payload.category_id = null;
        if (!payload.position)    payload.position    = null;
        if (!payload.birth_date)  payload.birth_date  = null;

        await playersStore.createOrUpdatePlayer(payload);

        if (selectedFile.value) {
            await playersStore.uploadPlayerPhoto(playerId, selectedFile.value);
        }

        router.push(`/players/${playerId}`);
    } catch (e) {
        // Error handled in store
    }
};

onMounted(() => {
    loadPlayer();
});
</script>
