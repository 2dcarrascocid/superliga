<template>
  <Teleport to="body">
    <div v-if="open" class="series-modal" @mousedown.self="close">
      <section
        ref="dialog"
        class="series-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="poll-modal-title"
        @keydown="onKeydown"
      >
        <header class="series-modal__header">
          <div>
            <p class="series-modal__eyebrow">Votaciones</p>
            <h2 id="poll-modal-title">Nueva votación</h2>
          </div>
          <button type="button" class="series-modal__close" aria-label="Cerrar formulario" @click="close">×</button>
        </header>

        <form @submit.prevent="submit">
          <div class="series-modal__grid">
            <div class="input-group series-modal__wide">
              <label class="label" for="poll-title">Pregunta</label>
              <input id="poll-title" ref="firstInput" v-model.trim="form.title" class="input" maxlength="300" placeholder="¿Aprueba el nuevo reglamento de la liga?" required />
            </div>
            <div class="input-group series-modal__wide">
              <label class="label" for="poll-description">Descripción</label>
              <textarea id="poll-description" v-model.trim="form.description" class="input" rows="2" maxlength="2000" placeholder="Contexto opcional para los representantes" />
            </div>

            <fieldset class="input-group series-modal__wide poll-options">
              <legend class="label">Alternativas</legend>
              <div v-for="(opt, i) in form.options" :key="opt.key" class="poll-options__row">
                <span class="poll-options__num" aria-hidden="true">{{ i + 1 }}</span>
                <input
                  v-model.trim="opt.label"
                  class="input"
                  maxlength="200"
                  :aria-label="`Alternativa ${i + 1}`"
                  :placeholder="i === 0 ? 'Sí' : i === 1 ? 'No' : 'Otra alternativa'"
                  required
                />
                <button
                  v-if="form.options.length > 2"
                  type="button"
                  class="btn btn-secondary btn-sm"
                  :aria-label="`Quitar alternativa ${i + 1}`"
                  @click="removeOption(i)"
                >Quitar</button>
              </div>
              <button v-if="form.options.length < 20" type="button" class="btn btn-secondary btn-sm" @click="addOption">+ Agregar alternativa</button>
            </fieldset>

            <div class="input-group">
              <label class="label" for="poll-opens">Abre</label>
              <input id="poll-opens" v-model="form.opens_at" type="datetime-local" class="input" required />
            </div>
            <div class="input-group">
              <label class="label" for="poll-closes">Cierra</label>
              <input id="poll-closes" v-model="form.closes_at" type="datetime-local" class="input" :min="form.opens_at" required />
            </div>
            <div class="input-group">
              <label class="label" for="poll-season">Clubes que votan</label>
              <select id="poll-season" v-model="form.season_id" class="input">
                <option :value="null">Todos los clubes activos</option>
                <option v-for="s in seasons" :key="s.id" :value="s.id">Participantes de {{ s.name }}</option>
              </select>
            </div>
            <div class="input-group poll-secret">
              <label class="poll-secret__label">
                <input v-model="form.is_secret" type="checkbox" />
                Voto secreto
              </label>
              <span class="text-muted text-sm">Se publica quién votó, pero no qué eligió cada club.</span>
            </div>
          </div>
          <p v-if="formError" class="alert alert-error">{{ formError }}</p>
          <p class="series-modal__help">Cada club vota una sola vez a través de su representante. Al cerrar, los clubes que no votaron quedan como abstención y los resultados se publican en esta sección.</p>
          <footer class="series-modal__actions">
            <button type="button" class="btn btn-secondary" @click="close">Cancelar</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">{{ saving ? 'Guardando…' : 'Crear votación' }}</button>
          </footer>
        </form>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { nextTick, reactive, ref, watch } from 'vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
  seasons: { type: Array, default: () => [] },
});
const emit = defineEmits(['close', 'submit']);
const dialog = ref(null);
const firstInput = ref(null);
const formError = ref('');
let returnFocus = null;
let optionKey = 0;

// datetime-local trabaja en hora local sin zona: 'YYYY-MM-DDTHH:mm'
const toLocalInput = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const newOption = (label = '') => ({ key: ++optionKey, label });

const form = reactive({});
const reset = () => {
  const now = new Date();
  Object.assign(form, {
    title: '',
    description: '',
    options: [newOption('Sí'), newOption('No')],
    opens_at: toLocalInput(now),
    closes_at: toLocalInput(new Date(now.getTime() + 7 * 24 * 3600 * 1000)),
    season_id: null,
    is_secret: false,
  });
  formError.value = '';
};
reset();

const addOption = () => form.options.push(newOption());
const removeOption = (i) => form.options.splice(i, 1);

const close = () => { if (!props.saving) emit('close'); };
const submit = () => {
  const labels = form.options.map((o) => o.label).filter(Boolean);
  if (labels.length < 2) { formError.value = 'Ingrese al menos 2 alternativas.'; return; }
  if (new Set(labels.map((l) => l.toLowerCase())).size !== labels.length) { formError.value = 'Hay alternativas repetidas.'; return; }
  const opens = new Date(form.opens_at);
  const closes = new Date(form.closes_at);
  if (!(closes > opens)) { formError.value = 'La fecha de cierre debe ser posterior a la de apertura.'; return; }
  if (closes <= new Date()) { formError.value = 'La fecha de cierre debe ser futura.'; return; }
  formError.value = '';
  emit('submit', {
    title: form.title,
    description: form.description || null,
    options: labels,
    opens_at: opens.toISOString(),
    closes_at: closes.toISOString(),
    season_id: form.season_id,
    is_secret: form.is_secret,
  });
};

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

.poll-options { border: 0; padding: 0; margin: 0 0 16px; display: grid; gap: 8px; justify-items: start; }
.poll-options__row { display: flex; align-items: center; gap: 8px; width: 100%; }
.poll-options__row .input { flex: 1; margin: 0; }
.poll-options__num { width: 24px; text-align: center; color: var(--text-muted); font-weight: 600; }
.poll-secret { justify-content: center; }
.poll-secret__label { display: flex; align-items: center; gap: 8px; font-weight: 600; }

@media (max-width: 640px) { .series-modal__dialog { padding: 16px; } .series-modal__grid { grid-template-columns: 1fr; } .series-modal__wide { grid-column: auto; } .series-modal__actions { align-items: stretch; flex-direction: column-reverse; } .series-modal__actions .btn { width: 100%; } }
</style>
