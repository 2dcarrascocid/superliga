<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="visible" class="modal-overlay" @click.self="handleCancel">
        <div 
          class="notify-modal card" 
          :class="[`notify-modal--${type}`, { 'notify-modal--destructive': isDestructive }]"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="'modal-title'"
        >
          <!-- Botón de Cerrar (X) -->
          <button class="notify-modal__close-btn" @click="handleCancel" aria-label="Cerrar">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>

          <!-- Ícono con halo de luz -->
          <div class="notify-modal__icon-wrapper">
            <div class="notify-modal__icon">
              <!-- Success -->
              <svg v-if="type === 'success'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
              <!-- Error -->
              <svg v-else-if="type === 'error'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              <!-- Warning -->
              <svg v-else-if="type === 'warning'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <!-- Question -->
              <svg v-else-if="type === 'question'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <!-- Info (Default) -->
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
            </div>
          </div>

          <!-- Título y Mensaje -->
          <div class="notify-modal__body">
            <h3 id="modal-title" class="notify-modal__title">{{ title || defaultTitle }}</h3>
            <p v-if="message" class="notify-modal__message">{{ message }}</p>

            <!-- Input para modo Prompt -->
            <div v-if="mode === 'prompt'" class="notify-modal__input-container">
              <input
                ref="promptInputRef"
                v-model="inputValue"
                :type="inputType"
                :placeholder="inputPlaceholder"
                class="input notify-modal__input"
                @keydown.enter.prevent="handleConfirm"
              />
            </div>
          </div>

          <!-- Acciones / Botones -->
          <div class="notify-modal__actions">
            <template v-if="mode === 'confirm' || mode === 'prompt'">
              <button 
                type="button" 
                class="btn btn-secondary notify-modal__btn" 
                @click="handleCancel"
              >
                {{ cancelText || 'Cancelar' }}
              </button>
              <button 
                ref="confirmBtnRef"
                type="button" 
                :class="['btn', isDestructive ? 'btn-danger' : 'btn-primary', 'notify-modal__btn']" 
                @click="handleConfirm"
              >
                {{ confirmText || (isDestructive ? 'Eliminar' : 'Confirmar') }}
              </button>
            </template>

            <template v-else>
              <button 
                ref="confirmBtnRef"
                type="button" 
                class="btn btn-primary btn-full notify-modal__btn" 
                @click="handleConfirm"
              >
                {{ confirmText || 'Aceptar' }}
              </button>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useNotifyStore } from '../stores/notify';

const {
  visible,
  mode,
  type,
  title,
  message,
  confirmText,
  cancelText,
  isDestructive,
  inputValue,
  inputType,
  inputPlaceholder,
  handleConfirm,
  handleCancel,
} = useNotifyStore();

const promptInputRef = ref(null);
const confirmBtnRef = ref(null);

const DEFAULT_TITLES = {
  success: '¡Operación Exitosa!',
  error: 'Ocurrió un Error',
  warning: 'Atención',
  info: 'Aviso del Sistema',
  question: '¿Confirmar Acción?',
};

const defaultTitle = computed(() => DEFAULT_TITLES[type.value] || 'Mensaje');

// Manejar foco automáticamente cuando el modal se abre
watch(visible, async (isOpen) => {
  if (isOpen) {
    await nextTick();
    if (mode.value === 'prompt' && promptInputRef.value) {
      promptInputRef.value.focus();
      promptInputRef.value.select();
    } else if (confirmBtnRef.value) {
      confirmBtnRef.value.focus();
    }
  }
});

// Teclado: Escape para cancelar / cerrar
const handleKeyDown = (e) => {
  if (!visible.value) return;
  if (e.key === 'Escape') {
    handleCancel();
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(6, 7, 12, 0.78);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  padding: 1.25rem;
}

.notify-modal {
  position: relative;
  width: 100%;
  max-width: 440px;
  background: #141622;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-lg, 20px);
  padding: 2rem 1.75rem 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.8), 0 0 1px 1px rgba(255, 255, 255, 0.05);
}

/* ── Botón cerrar X ── */
.notify-modal__close-btn {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: transparent;
  border: none;
  color: var(--text-muted, #6b7089);
  cursor: pointer;
  padding: 0.4rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast, 150ms ease);
}
.notify-modal__close-btn:hover {
  color: var(--text-primary, #f4f5fb);
  background: rgba(255, 255, 255, 0.06);
}

/* ── Halo e Ícono ── */
.notify-modal__icon-wrapper {
  margin-bottom: 1.25rem;
}

.notify-modal__icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.notify-modal__icon svg {
  width: 32px;
  height: 32px;
}

/* Temas de Íconos */
.notify-modal--success .notify-modal__icon {
  background: rgba(0, 230, 118, 0.12);
  color: #00e676;
  box-shadow: 0 0 28px rgba(0, 230, 118, 0.25);
  border: 1px solid rgba(0, 230, 118, 0.3);
}

.notify-modal--error .notify-modal__icon,
.notify-modal--destructive .notify-modal__icon {
  background: rgba(248, 113, 113, 0.12);
  color: #f87171;
  box-shadow: 0 0 28px rgba(248, 113, 113, 0.25);
  border: 1px solid rgba(248, 113, 113, 0.3);
}

.notify-modal--warning .notify-modal__icon {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
  box-shadow: 0 0 28px rgba(245, 158, 11, 0.25);
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.notify-modal--info .notify-modal__icon,
.notify-modal--question .notify-modal__icon {
  background: rgba(79, 195, 247, 0.12);
  color: #4fc3f7;
  box-shadow: 0 0 28px rgba(79, 195, 247, 0.25);
  border: 1px solid rgba(79, 195, 247, 0.3);
}

/* ── Contenido ── */
.notify-modal__body {
  width: 100%;
  text-align: center;
  margin-bottom: 1.5rem;
}

.notify-modal__title {
  font-family: 'Lora', Georgia, serif;
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--text-primary, #f4f5fb);
  margin-bottom: 0.6rem;
  line-height: 1.3;
}

.notify-modal--error .notify-modal__title {
  color: #f87171;
}
.notify-modal--success .notify-modal__title {
  color: #00e676;
}
.notify-modal--warning .notify-modal__title {
  color: #f59e0b;
}

.notify-modal__message {
  color: var(--text-secondary, #a8adc4);
  font-size: 0.95rem;
  line-height: 1.6;
  white-space: pre-line;
  word-break: break-word;
  margin-bottom: 0;
}

/* ── Input de Prompt ── */
.notify-modal__input-container {
  margin-top: 1.25rem;
  width: 100%;
}

.notify-modal__input {
  width: 100%;
  text-align: center;
  font-size: 1.05rem;
  padding: 0.8rem 1rem;
  border-radius: var(--radius-md, 10px);
  background: #0d0e15;
  border: 1px solid #2d3142;
  color: var(--text-primary, #ffffff);
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.5);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.notify-modal__input:focus {
  border-color: var(--primary-solid, #00e676);
  box-shadow: 0 0 0 3px rgba(0, 230, 118, 0.2), inset 0 2px 4px rgba(0,0,0,0.5);
  outline: none;
}

/* ── Acciones ── */
.notify-modal__actions {
  width: 100%;
  display: flex;
  gap: 0.75rem;
  justify-content: center;
}

.notify-modal__btn {
  flex: 1;
  min-height: 44px;
  font-size: 0.95rem;
  letter-spacing: 0.01em;
}

/* ── Animaciones ── */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-fade-enter-active .notify-modal,
.modal-fade-leave-active .notify-modal {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .notify-modal {
  transform: scale(0.92) translateY(12px);
  opacity: 0;
}

.modal-fade-leave-to .notify-modal {
  transform: scale(0.94) translateY(8px);
  opacity: 0;
}

@media (max-width: 480px) {
  .notify-modal {
    padding: 1.5rem 1.25rem 1.25rem;
  }
  .notify-modal__actions {
    flex-direction: column-reverse;
  }
}
</style>
