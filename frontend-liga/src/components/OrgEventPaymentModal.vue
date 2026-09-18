<template>
  <Teleport to="body">
    <div v-if="open" class="payment-modal" @mousedown.self="close">
      <section
        ref="dialog"
        class="payment-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="org-event-payment-title"
        @keydown="onKeydown"
      >
        <header class="payment-modal__header">
          <h2 id="org-event-payment-title">Registrar pago</h2>
          <button ref="closeButton" type="button" class="payment-modal__close" aria-label="Cerrar" @click="close">×</button>
        </header>

        <p v-if="clubName" class="payment-modal__subtitle">{{ clubName }} — pendiente: ${{ formatMoney(pendingAmount) }}</p>

        <form @submit.prevent="submit">
          <div class="input-group">
            <label class="label" for="org-payment-amount">Monto a abonar</label>
            <input id="org-payment-amount" ref="firstInput" v-model.number="form.amount" type="number" min="0" class="input" required />
          </div>
          <div class="input-group">
            <label class="label" for="org-payment-method">Medio de pago</label>
            <select id="org-payment-method" v-model="form.payment_method" class="input">
              <option value="TRANSFERENCIA">Transferencia</option>
              <option value="EFECTIVO">Efectivo</option>
              <option value="TARJETA">Tarjeta</option>
            </select>
          </div>
          <footer class="payment-modal__actions">
            <button type="button" class="btn btn-secondary" @click="close">Cancelar</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">{{ saving ? 'Guardando…' : 'Registrar pago' }}</button>
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
  clubName: { type: String, default: '' },
  pendingAmount: { type: Number, default: 0 },
});
const emit = defineEmits(['close', 'submit']);
const dialog = ref(null);
const firstInput = ref(null);
let returnFocus = null;
const form = reactive({ amount: 0, payment_method: 'TRANSFERENCIA' });

const formatMoney = (v) => Math.round(Number(v) || 0).toLocaleString('es-CL');
const reset = () => Object.assign(form, { amount: props.pendingAmount > 0 ? props.pendingAmount : 0, payment_method: 'TRANSFERENCIA' });
const close = () => { if (!props.saving) emit('close'); };
const submit = () => emit('submit', { amount: form.amount, payment_method: form.payment_method });
const focusables = () => [...dialog.value.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])')];
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
.payment-modal { position: fixed; inset: 0; z-index: 1100; display: grid; place-items: center; padding: 16px; background: color-mix(in srgb, var(--bg-primary) 78%, transparent); }
.payment-modal__dialog { width: min(100%, 420px); padding: 24px; color: var(--text-primary); background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); box-shadow: var(--shadow-xl); }
.payment-modal__header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 4px; }
.payment-modal__header h2 { margin: 0; }
.payment-modal__close { width: 40px; min-width: 40px; padding: 0; color: var(--text-primary); background: var(--bg-hover); border: 1px solid var(--border-color); border-radius: var(--radius-full); font-size: 1.4rem; }
.payment-modal__subtitle { margin: 0 0 16px; color: var(--text-muted); font-size: .875rem; }
.payment-modal__actions { display: flex; justify-content: flex-end; gap: 12px; border-top: 1px solid var(--border-color); padding-top: 16px; margin-top: 16px; }
@media (max-width: 480px) { .payment-modal__actions { flex-direction: column-reverse; } .payment-modal__actions .btn { width: 100%; } }
</style>
