<template>
  <div class="container mt-md">
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <section class="pd-dash mb-lg">
      <div class="pd-dash__glow pd-dash__glow--green" aria-hidden="true"></div>
      <div class="pd-dash__glow pd-dash__glow--blue" aria-hidden="true"></div>

      <div class="pd-dash__head">
        <span class="pd-dash__kicker">Parámetros</span>
        <h3 class="pd-dash__title">
          Duración de <span class="pd-dash__title-accent">partidos y bloques</span>
        </h3>
        <p class="pd-dash__desc">
          Configura la duración de juego, los descansos y el cambio de cancha que usa el algoritmo
          de Programación de Fecha para armar los bloques horarios.
        </p>
      </div>
    </section>

    <div class="card ss-card">
      <form @submit.prevent="onSave">
        <div class="ss-grid">
          <div class="input-group">
            <label class="label" for="half-duration">Duración por lado (min)</label>
            <input
              id="half-duration"
              v-model.number="form.halfDurationMinutes"
              type="number"
              min="1"
              class="input"
              required
            />
          </div>

          <div class="input-group">
            <label class="label" for="halftime-break">Descanso entre lados (min)</label>
            <input
              id="halftime-break"
              v-model.number="form.halftimeBreakMinutes"
              type="number"
              min="0"
              class="input"
              required
            />
          </div>

          <div class="input-group">
            <label class="label" for="turnaround">Cambio de cancha entre partidos (min)</label>
            <input
              id="turnaround"
              v-model.number="form.turnaroundMinutes"
              type="number"
              min="0"
              class="input"
              required
            />
          </div>

          <div class="input-group">
            <label class="label" for="default-start-time">Hora de inicio por defecto</label>
            <input
              id="default-start-time"
              v-model="form.defaultStartTime"
              type="time"
              class="input"
              required
            />
          </div>
        </div>

        <div class="ss-summary">
          <div class="ss-summary__item">
            <span class="ss-summary__label">Duración total del partido</span>
            <span class="ss-summary__value">{{ computedMatchDuration }} min</span>
          </div>
          <div class="ss-summary__item">
            <span class="ss-summary__label">Duración del bloque en cancha</span>
            <span class="ss-summary__value">{{ computedBlockDuration }} min</span>
          </div>
        </div>

        <div class="flex justify-end mt-md">
          <button type="submit" class="btn btn-primary" :disabled="loading">
            {{ loading ? 'Guardando...' : 'Guardar cambios' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive } from 'vue';
import { useSchedulingSettingsStore } from '../stores/schedulingSettings';
import { useAuthStore } from '../stores/auth';
import { useNotifyStore } from '../stores/notify';

const { settings, loading, error, fetchSettings, saveSettings } = useSchedulingSettingsStore();
const authStore = useAuthStore();
const { notifySuccess, notifyError } = useNotifyStore();

const form = reactive({
  halfDurationMinutes: 30,
  halftimeBreakMinutes: 5,
  turnaroundMinutes: 5,
  defaultStartTime: '14:00',
});

// matchDurationMinutes/blockDurationMinutes son calculados por el backend;
// se recalculan en el cliente en vivo para dar feedback inmediato mientras
// el usuario tipea, y se sobreescriben con los valores reales que devuelve
// el backend tras cada fetch/guardado (ver watch de `settings` más abajo).
const computedMatchDuration = computed(
  () => (form.halfDurationMinutes || 0) * 2 + (form.halftimeBreakMinutes || 0)
);
const computedBlockDuration = computed(
  () => computedMatchDuration.value + (form.turnaroundMinutes || 0)
);

const applySettingsToForm = (data) => {
  if (!data) return;
  form.halfDurationMinutes = data.halfDurationMinutes;
  form.halftimeBreakMinutes = data.halftimeBreakMinutes;
  form.turnaroundMinutes = data.turnaroundMinutes;
  form.defaultStartTime = (data.defaultStartTime || '14:00:00').slice(0, 5);
};

const onSave = async () => {
  try {
    const payload = {
      half_duration_minutes: form.halfDurationMinutes,
      halftime_break_minutes: form.halftimeBreakMinutes,
      turnaround_minutes: form.turnaroundMinutes,
      default_start_time: `${form.defaultStartTime}:00`,
    };
    const updated = await saveSettings(authStore.state.org?.id, payload);
    applySettingsToForm(updated);
    notifySuccess('Parámetros de programación actualizados');
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al guardar los parámetros');
  }
};

onMounted(async () => {
  try {
    await fetchSettings(authStore.state.org?.id);
    applySettingsToForm(settings.value);
  } catch (e) {
    // Error manejado en el store
  }
});
</script>

<style scoped>
.ss-card {
  max-width: 640px;
  margin: 0 auto;
}

.ss-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

.ss-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}

.ss-summary__item {
  flex: 1 1 200px;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  background: var(--bg-tertiary, rgba(255, 255, 255, 0.03));
  border-radius: var(--radius-md, 8px);
  padding: 0.75rem 1rem;
}

.ss-summary__label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}

.ss-summary__value {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--primary-solid, #00e676);
}

/* ── Dashboard (estilo landing) ── */
.pd-dash {
  position: relative;
  overflow: hidden;
  background: var(--surface-card, #14151d);
  border: 1px solid var(--border-subtle, #23252f);
  border-radius: var(--border-radius-lg, 16px);
  padding: 2rem 1.5rem;
}

.pd-dash__glow {
  position: absolute;
  width: 360px;
  height: 360px;
  border-radius: 50%;
  filter: blur(110px);
  opacity: 0.2;
  pointer-events: none;
  z-index: 0;
}
.pd-dash__glow--green { top: -140px; left: -100px; background: var(--color-green-600, #00e676); }
.pd-dash__glow--blue  { bottom: -160px; right: -100px; background: var(--color-blue-500, #4fc3f7); }

.pd-dash__head {
  position: relative;
  z-index: 1;
  text-align: center;
  max-width: 520px;
  margin: 0 auto;
}

.pd-dash__kicker {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-blue-500, #4fc3f7);
  margin-bottom: 0.5rem;
}

.pd-dash__title {
  font-size: clamp(1.4rem, 3vw, 1.9rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0 0 0.5rem;
}

.pd-dash__title-accent {
  background: linear-gradient(135deg, var(--color-green-600, #00e676), var(--color-blue-500, #4fc3f7));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.pd-dash__desc {
  color: var(--text-muted);
  font-size: 0.9rem;
}
</style>
