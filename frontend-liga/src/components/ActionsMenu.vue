<template>
  <div ref="rootRef" class="actions-menu">
    <button
      ref="triggerRef"
      type="button"
      class="actions-menu__trigger"
      :class="{ 'actions-menu__trigger--open': open }"
      :aria-expanded="open ? 'true' : 'false'"
      aria-haspopup="true"
      :aria-label="triggerLabel"
      @click.stop="toggle"
    >
      <svg class="actions-menu__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
        <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        ref="panelRef"
        class="actions-menu__panel"
        role="menu"
        :style="panelStyle"
        @click="handlePanelClick"
      >
        <slot />
      </div>
    </Teleport>
  </div>
</template>

<script setup>
/**
 * Botón único "⋮" por fila que despliega las acciones de esa fila en un
 * panel colapsable — reemplaza columnas "Acciones" con varios botones
 * sueltos. El panel se monta vía <Teleport to="body"> y se posiciona con
 * `position: fixed` calculado desde el botón disparador, para no quedar
 * recortado por contenedores con overflow:hidden/auto (ej. .table-container
 * con scroll horizontal).
 *
 * Uso: el contenido de las acciones va como slot por defecto — cada botón
 * mantiene su propio @click/:disabled/v-if tal como estaba antes de envolverlo.
 * El panel se cierra solo al hacer click en cualquier <button>/<a> interno,
 * así ningún caller necesita cerrar el menú manualmente.
 */
import { ref, reactive, nextTick, onBeforeUnmount } from 'vue';

defineProps({
  triggerLabel: { type: String, default: 'Más acciones' },
});

const open = ref(false);
const rootRef = ref(null);
const triggerRef = ref(null);
const panelRef = ref(null);
const panelStyle = reactive({ top: '0px', left: '0px', right: 'auto', bottom: 'auto' });

const PANEL_MARGIN = 4;
const ESTIMATED_PANEL_WIDTH = 180;
const ESTIMATED_PANEL_HEIGHT = 220;

const updatePosition = () => {
  const trigger = triggerRef.value;
  if (!trigger) return;
  const rect = trigger.getBoundingClientRect();

  const opensUp = rect.bottom + PANEL_MARGIN + ESTIMATED_PANEL_HEIGHT > window.innerHeight;
  panelStyle.top = opensUp ? 'auto' : `${rect.bottom + PANEL_MARGIN}px`;
  panelStyle.bottom = opensUp ? `${window.innerHeight - rect.top + PANEL_MARGIN}px` : 'auto';

  const opensLeft = rect.right - ESTIMATED_PANEL_WIDTH < 0 ? false : (window.innerWidth - rect.right < ESTIMATED_PANEL_WIDTH && rect.left >= ESTIMATED_PANEL_WIDTH);
  panelStyle.left = opensLeft ? 'auto' : `${rect.left}px`;
  panelStyle.right = opensLeft ? `${window.innerWidth - rect.right}px` : 'auto';
};

const onDocClick = (e) => {
  if (rootRef.value?.contains(e.target)) return;
  if (panelRef.value?.contains(e.target)) return;
  close();
};
const onKeydown = (e) => { if (e.key === 'Escape') close(); };
const onScrollOrResize = () => close();

const attachGlobalListeners = () => {
  document.addEventListener('click', onDocClick, true);
  document.addEventListener('keydown', onKeydown);
  window.addEventListener('scroll', onScrollOrResize, true);
  window.addEventListener('resize', onScrollOrResize);
};
const detachGlobalListeners = () => {
  document.removeEventListener('click', onDocClick, true);
  document.removeEventListener('keydown', onKeydown);
  window.removeEventListener('scroll', onScrollOrResize, true);
  window.removeEventListener('resize', onScrollOrResize);
};

const close = () => {
  if (!open.value) return;
  open.value = false;
  detachGlobalListeners();
};

const toggle = async () => {
  if (open.value) { close(); return; }
  open.value = true;
  await nextTick();
  updatePosition();
  attachGlobalListeners();
};

// Cualquier click en un botón/link de las acciones cierra el panel — evita
// que cada tabla tenga que cerrar el menú manualmente en su propio @click.
const handlePanelClick = (e) => {
  if (e.target.closest('button, a')) close();
};

onBeforeUnmount(detachGlobalListeners);

defineExpose({ close });
</script>

<style scoped>
.actions-menu {
  position: relative;
  display: inline-block;
}

.actions-menu__trigger {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: var(--radius-full);
  background: var(--primary-solid);
  background-image: linear-gradient(135deg, rgba(255, 255, 255, 0.35), transparent 60%);
  color: #0b0d14;
  cursor: pointer;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--primary-solid) 45%, transparent);
  transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
}
.actions-menu__trigger:hover {
  transform: translateY(-1px) scale(1.06);
  box-shadow: 0 4px 14px color-mix(in srgb, var(--primary-solid) 60%, transparent);
}
.actions-menu__trigger:active { transform: scale(0.96); }
.actions-menu__trigger--open {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-solid) 30%, transparent),
              0 4px 14px color-mix(in srgb, var(--primary-solid) 60%, transparent);
}
.actions-menu__trigger:focus-visible {
  outline: 2px solid var(--primary-solid);
  outline-offset: 2px;
}

.actions-menu__icon {
  width: 18px;
  height: 18px;
  transition: transform 0.2s ease;
}
.actions-menu__trigger--open .actions-menu__icon { transform: rotate(90deg); }
</style>

<style>
/* Panel teletransportado a <body> — fuera del scope del componente, así que
   sin `scoped`. Usa position: fixed (coordenadas ya calculadas en JS). */
.actions-menu__panel {
  position: fixed;
  z-index: 50;
  min-width: 160px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

.actions-menu__panel button,
.actions-menu__panel a {
  width: 100%;
  justify-content: flex-start;
  text-align: left;
  white-space: nowrap;
}

.actions-menu__panel .delete-reason {
  white-space: normal;
}
</style>
