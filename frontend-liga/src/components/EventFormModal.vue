<template>
  <Teleport to="body">
    <div v-if="open" class="series-modal" @mousedown.self="close">
      <section
        ref="dialog"
        class="series-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-modal-title"
        @keydown="onKeydown"
      >
        <header class="series-modal__header">
          <div>
            <p class="series-modal__eyebrow">Finanzas de club</p>
            <h2 id="event-modal-title">Nuevo evento</h2>
          </div>
          <button ref="closeButton" type="button" class="series-modal__close" aria-label="Cerrar formulario" @click="close">×</button>
        </header>

        <form @submit.prevent="submit">
          <div class="series-modal__grid">
            <div class="input-group series-modal__wide">
              <label class="label" for="event-name">Nombre del evento</label>
              <input id="event-name" ref="firstInput" v-model.trim="form.name" class="input" placeholder="Fecha 5 vs Deportivo Sur" required />
            </div>
            <div class="input-group">
              <label class="label" for="event-type">Tipo</label>
              <select id="event-type" v-model="form.event_type" class="input">
                <option v-for="t in EVENT_TYPES" :key="t" :value="t">{{ EVENT_TYPE_LABELS[t] }}</option>
              </select>
            </div>
            <div class="input-group">
              <label class="label" for="event-direction">Dirección</label>
              <select id="event-direction" v-model="form.direction" class="input">
                <option value="EGRESO">Egreso (el club cobra a sus jugadores)</option>
                <option value="INGRESO">Ingreso (se le devuelve al club)</option>
              </select>
            </div>
            <div class="input-group">
              <label class="label" for="event-date">Fecha</label>
              <input id="event-date" v-model="form.event_date" type="date" class="input" />
            </div>
            <div class="input-group series-modal__wide">
              <label class="label" for="event-description">Descripción</label>
              <textarea id="event-description" v-model.trim="form.description" class="input" rows="2" placeholder="Detalle opcional del evento" />
            </div>
          </div>
          <p class="series-modal__help">Después de crear el evento podrás agregar jugadores de la plantilla con un monto individual cada uno.</p>
          <footer class="series-modal__actions">
            <button type="button" class="btn btn-secondary" @click="close">Cancelar</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">{{ saving ? 'Guardando…' : 'Crear evento' }}</button>
          </footer>
        </form>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { nextTick, reactive, ref, watch } from 'vue';

const EVENT_TYPES = ['FECHA_PARTIDO', 'COLECTA', 'COMPRA_IMPLEMENTOS', 'OTRO'];
const EVENT_TYPE_LABELS = {
  FECHA_PARTIDO: 'Fecha de partido',
  COLECTA: 'Colecta',
  COMPRA_IMPLEMENTOS: 'Compra de implementos',
  OTRO: 'Otro',
};

const props = defineProps({
  open: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
});
const emit = defineEmits(['close', 'submit']);
const dialog = ref(null);
const firstInput = ref(null);
let returnFocus = null;
const form = reactive({ name: '', event_type: 'OTRO', direction: 'EGRESO', event_date: '', description: '' });

const reset = () => Object.assign(form, { name: '', event_type: 'OTRO', direction: 'EGRESO', event_date: '', description: '' });
const close = () => { if (!props.saving) emit('close'); };
const submit = () => emit('submit', {
  name: form.name,
  event_type: form.event_type,
  direction: form.direction,
  event_date: form.event_date || null,
  description: form.description || null,
});
const focusables = () => [...dialog.value.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])')];
const onKeydown = (event) => {
  if (event.key === 'Escape') { event.preventDefault(); close(); return; }
  if (event.key !== 'Tab') return;
  const nodes = focusables();
  const first = nodes[0]; const last = nodes[nodes.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
};

watch(() => props.open, async (open) => {
  if (open) {
    returnFocus = document.activeElement;
    reset();
    document.body.style.overflow = 'hidden';
    await nextTick();
    firstInput.value?.focus();
  } else {
    document.body.style.overflow = '';
    returnFocus?.focus?.();
  }
});
</script>

<style scoped>
.series-modal { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 16px; background: color-mix(in srgb, var(--bg-primary) 78%, transparent); }
.series-modal__dialog { width: min(100%, 720px); max-height: calc(100dvh - 32px); overflow-y: auto; padding: 24px; color: var(--text-primary); background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); box-shadow: var(--shadow-xl); }
.series-modal__header, .series-modal__actions { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.series-modal__header { margin-bottom: 24px; }
.series-modal__header h2 { margin: 0; }
.series-modal__eyebrow { margin: 0 0 4px; color: var(--primary-solid); font-size: .75rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.series-modal__close { width: 44px; min-width: 44px; padding: 0; color: var(--text-primary); background: var(--bg-hover); border: 1px solid var(--border-color); border-radius: var(--radius-full); font-size: 1.5rem; }
.series-modal__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 16px; }
.series-modal__wide { grid-column: 1 / -1; }
.series-modal__help { margin: 0 0 20px; color: var(--text-muted); font-size: .875rem; }
.series-modal__actions { justify-content: flex-end; border-top: 1px solid var(--border-color); padding-top: 20px; }
@media (max-width: 640px) { .series-modal__dialog { padding: 16px; } .series-modal__grid { grid-template-columns: 1fr; } .series-modal__wide { grid-column: auto; } .series-modal__actions { align-items: stretch; flex-direction: column-reverse; } .series-modal__actions .btn { width: 100%; } }
</style>
