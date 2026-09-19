<template>
  <div class="card">
    <h3 class="mb-md">Resultado</h3>
    <form @submit.prevent="onSaveResult">
      <div class="result-row">
        <div class="input-group">
          <label class="label">{{ seriesLabel(current?.home_series) || 'Local' }}</label>
          <input v-model.number="resultForm.home_score" type="number" min="0" class="input" />
        </div>
        <span class="result-vs">—</span>
        <div class="input-group">
          <label class="label">{{ seriesLabel(current?.away_series) || 'Visita' }}</label>
          <input v-model.number="resultForm.away_score" type="number" min="0" class="input" />
        </div>
      </div>
      <div class="result-row mt-sm">
        <div class="input-group">
          <label class="label">Penales Local</label>
          <input v-model.number="resultForm.home_penalty_score" type="number" min="0" class="input" />
        </div>
        <span class="result-vs"></span>
        <div class="input-group">
          <label class="label">Penales Visita</label>
          <input v-model.number="resultForm.away_penalty_score" type="number" min="0" class="input" />
        </div>
      </div>
      <div class="input-group mt-md" style="max-width: 240px;">
        <label class="label">Estado</label>
        <select v-model="resultForm.status" class="input">
          <option value="SCHEDULED">Programado</option>
          <option value="IN_PROGRESS">En juego</option>
          <option value="FINISHED">Finalizado</option>
          <option value="POSTPONED">Postergado</option>
          <option value="CANCELLED">Cancelado</option>
        </select>
      </div>
      <div v-if="bracketNote" class="alert alert-info mt-md">{{ bracketNoteLabel }}</div>
      <div class="flex justify-end mt-md">
        <button type="submit" class="btn btn-primary" :disabled="loading">Guardar Resultado</button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useMatchesStore } from '../stores/matches';
import { useNotifyStore } from '../stores/notify';

const props = defineProps({
  matchId: { type: String, required: true },
});

const emit = defineEmits(['saved']);

const { current, loading, saveResult } = useMatchesStore();
const { notifySuccess, notifyError } = useNotifyStore();

const BRACKET_NOTE_LABELS = {
  ESPERANDO_PARTIDO_DE_IDA: 'Falta registrar el resultado del partido de ida para definir el global.',
  EMPATE_GLOBAL_SIN_DEFINIR: 'El global quedó empatado. Registra los penales para definir al ganador.',
};

const bracketNote = ref(null);
const bracketNoteLabel = computed(() => BRACKET_NOTE_LABELS[bracketNote.value] || bracketNote.value);
const seriesLabel = (series) => (series ? `${series.club?.name ?? ''} — ${series.name}` : '');

const resultForm = reactive({ home_score: null, away_score: null, home_penalty_score: null, away_penalty_score: null, status: 'FINISHED' });

const fillFormFromMatch = (match) => {
  if (!match) return;
  resultForm.home_score = match.home_score;
  resultForm.away_score = match.away_score;
  resultForm.home_penalty_score = match.home_penalty_score;
  resultForm.away_penalty_score = match.away_penalty_score;
  resultForm.status = match.status === 'SCHEDULED' ? 'FINISHED' : match.status;
};

const onSaveResult = async () => {
  try {
    const data = await saveResult(props.matchId, resultForm);
    bracketNote.value = data.bracketNote || null;
    notifySuccess('Resultado del partido actualizado');
    emit('saved', data);
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al guardar resultado');
  }
};

watch(() => current.value, fillFormFromMatch, { immediate: true });
</script>

<style scoped>
.result-row { display: flex; align-items: flex-end; gap: 12px; justify-content: center; }
.result-vs { padding-bottom: 0.7rem; color: var(--text-muted); font-weight: 700; }
.alert-info { background: rgba(79, 195, 247, 0.12); color: #4fc3f7; border: 1px solid rgba(79, 195, 247, 0.3); border-radius: var(--radius-md, 8px); padding: 0.75rem 1rem; }
</style>
