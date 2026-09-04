<template>
  <Teleport to="body">
    <div v-if="open" class="series-modal" @mousedown.self="close">
      <section
        ref="dialog"
        class="series-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="series-modal-title"
        @keydown="onKeydown"
      >
        <header class="series-modal__header">
          <div>
            <p class="series-modal__eyebrow">Gestión deportiva</p>
            <h2 id="series-modal-title">{{ series ? 'Editar serie' : 'Nueva serie' }}</h2>
          </div>
          <button ref="closeButton" type="button" class="series-modal__close" aria-label="Cerrar formulario" @click="close">×</button>
        </header>

        <form @submit.prevent="submit">
          <div class="series-modal__grid">
            <div class="input-group series-modal__wide">
              <label class="label" for="series-name">Nombre de la serie</label>
              <input id="series-name" ref="firstInput" v-model.trim="form.name" class="input" placeholder="Serie Honor" required />
            </div>
            <div class="input-group series-modal__wide">
              <label class="label" for="series-description">Descripción</label>
              <textarea id="series-description" v-model.trim="form.description" class="input" rows="3" placeholder="Describe la categoría deportiva" />
            </div>
            <div class="input-group series-modal__wide">
              <label class="label" for="series-category">Categoría</label>
              <select id="series-category" v-model="form.category_id" class="input">
                <option :value="null">Sin categoría</option>
                <option v-for="category in categories" :key="category.id" :value="category.id">{{ categoryLabel(category) }}</option>
              </select>
            </div>
          </div>
          <p class="series-modal__help">Las series nuevas quedan activas inmediatamente. La categoría determina en qué torneos puede inscribirse y define la edad mínima/cálculo de edad de sus jugadores.</p>
          <footer class="series-modal__actions">
            <button type="button" class="btn btn-secondary" @click="close">Cancelar</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">{{ saving ? 'Guardando…' : (series ? 'Guardar cambios' : 'Crear serie') }}</button>
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
  series: { type: Object, default: null },
  categories: { type: Array, default: () => [] },
  saving: { type: Boolean, default: false },
});
const emit = defineEmits(['close', 'submit']);
const dialog = ref(null);
const firstInput = ref(null);
let returnFocus = null;
const form = reactive({ name: '', description: '', category_id: null });

const reset = () => Object.assign(form, {
  name: props.series?.name ?? '',
  description: props.series?.description ?? '',
  category_id: props.series?.category_id ?? null,
});
const categoryLabel = (category) => {
  const details = [category.serie, category.age_from || category.age_to ? `${category.age_from ?? '—'}-${category.age_to ?? '—'} años` : null, category.gender].filter(Boolean);
  return details.length ? `${category.name} (${details.join(' · ')})` : category.name;
};
const close = () => { if (!props.saving) emit('close'); };
const submit = () => emit('submit', {
  name: form.name,
  description: form.description || null,
  category_id: form.category_id || null,
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
watch(() => props.series, reset);
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
