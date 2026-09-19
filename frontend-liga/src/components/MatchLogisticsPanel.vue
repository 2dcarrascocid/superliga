<template>
  <div class="card">
    <h3 class="mb-md">Logística</h3>
    <form @submit.prevent="onSaveLogistics">
      <div class="folio-config-row">
        <div class="input-group">
          <label class="label">Cancha</label>
          <select v-model="logisticsForm.venue_id" class="input" @change="loadTimeSlots">
            <option value="">Sin asignar</option>
            <option v-for="v in venues" :key="v.id" :value="v.id">{{ v.name }}</option>
          </select>
        </div>
        <div class="input-group">
          <label class="label">Árbitro</label>
          <select v-model="logisticsForm.referee_id" class="input">
            <option value="">Sin asignar</option>
            <option v-for="r in referees" :key="r.id" :value="r.id">{{ r.full_name }}</option>
          </select>
        </div>
      </div>
      <div class="folio-config-row mt-md">
        <div class="input-group">
          <label class="label">Fecha</label>
          <input v-model="logisticsForm.match_date" type="date" class="input" @change="loadTimeSlots" />
        </div>
        <div class="input-group">
          <label class="label">Hora</label>
          <input v-model="logisticsForm.match_time" type="time" class="input" />
        </div>
        <div class="input-group">
          <label class="label">Bloque horario disponible</label>
          <select
            v-model="logisticsForm.time_slot"
            class="input"
            :disabled="!logisticsForm.venue_id || !logisticsForm.match_date"
            @change="onTimeSlotChange"
          >
            <option value="">{{ timeSlotsHint }}</option>
            <option v-for="slot in timeSlots" :key="slot.index" :value="slot.label" :disabled="!slot.available">
              {{ slot.label }}{{ slot.available ? '' : ' (ocupado)' }}
            </option>
          </select>
        </div>
      </div>
      <div class="input-group mt-md">
        <label class="label">Observaciones del turno</label>
        <textarea v-model="logisticsForm.observations" class="input" rows="2" />
      </div>
      <div class="flex justify-end mt-md">
        <button type="submit" class="btn btn-primary" :disabled="loading">Guardar Logística</button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useMatchesStore } from '../stores/matches';
import { useNotifyStore } from '../stores/notify';
import { getVenueTimeSlots } from '../services/venues.service';

const props = defineProps({
  matchId: { type: String, required: true },
  venues: { type: Array, default: () => [] },
  referees: { type: Array, default: () => [] },
});

const emit = defineEmits(['saved']);

const { current, loading, saveLogistics } = useMatchesStore();
const { notifySuccess, notifyError } = useNotifyStore();

const timeSlots = ref([]);
const loadingSlots = ref(false);

const logisticsForm = reactive({ venue_id: '', referee_id: '', match_date: '', match_time: '', time_slot: '', observations: '' });

const timeSlotsHint = computed(() => {
  if (!logisticsForm.venue_id || !logisticsForm.match_date) return 'Selecciona cancha y fecha';
  if (loadingSlots.value) return 'Cargando bloques...';
  if (timeSlots.value.length === 0) return 'Sin bloques configurados';
  return 'Selecciona un bloque';
});

const fillFormFromMatch = (match) => {
  if (!match) return;
  logisticsForm.venue_id = match.venue_id || '';
  logisticsForm.referee_id = match.referee_id || '';
  logisticsForm.match_date = match.match_date || '';
  logisticsForm.match_time = match.match_time || '';
  logisticsForm.time_slot = match.time_slot || '';
  logisticsForm.observations = match.observations || '';
  loadTimeSlots();
};

const loadTimeSlots = async () => {
  if (!logisticsForm.venue_id || !logisticsForm.match_date) {
    timeSlots.value = [];
    return;
  }
  loadingSlots.value = true;
  try {
    const res = await getVenueTimeSlots(logisticsForm.venue_id, {
      date: logisticsForm.match_date,
      exclude_match_id: props.matchId,
    });
    timeSlots.value = res.data?.data?.slots ?? [];
  } catch (e) {
    timeSlots.value = [];
  } finally {
    loadingSlots.value = false;
  }
};

const onTimeSlotChange = () => {
  const slot = timeSlots.value.find((s) => s.label === logisticsForm.time_slot);
  if (slot) logisticsForm.match_time = slot.time.slice(0, 5);
};

const onSaveLogistics = async () => {
  try {
    const payload = { ...logisticsForm };
    if (!payload.venue_id) payload.venue_id = null;
    if (!payload.referee_id) payload.referee_id = null;
    const match = await saveLogistics(props.matchId, payload);
    notifySuccess('Logística guardada exitosamente');
    emit('saved', match);
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al guardar logística');
  }
};

watch(() => current.value, fillFormFromMatch, { immediate: true });
</script>

<style scoped>
.folio-config-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
</style>
