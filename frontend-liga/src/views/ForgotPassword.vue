<template>
  <div class="auth-shell flex items-center justify-center h-screen">
    <div class="auth-card card w-full">

      <!-- Back to login -->
      <router-link to="/login" class="back-link">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Volver al login
      </router-link>

      <!-- Icon -->
      <div class="auth-icon-wrap" aria-hidden="true">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#29b6f6"
             stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>

      <!-- Success state -->
      <template v-if="sent">
        <div class="text-center">
          <div class="success-icon" aria-hidden="true">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#059669"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <h2 class="mb-sm">¡Revisa tu correo!</h2>
          <p>
            Si <strong>{{ email }}</strong> está registrado, recibirás un enlace
            para restablecer tu contraseña en los próximos minutos.
          </p>
          <p class="text-muted text-sm">
            Revisa también tu carpeta de spam.
          </p>
          <button @click="resetForm" class="btn btn-secondary w-full mt-md">
            Enviar de nuevo
          </button>
          <router-link to="/login" class="btn btn-primary w-full mt-sm" style="margin-top:10px;">
            Ir al login
          </router-link>
        </div>
      </template>

      <!-- Form state -->
      <template v-else>
        <div class="text-center mb-lg">
          <h2 class="mb-sm">Recuperar contraseña</h2>
          <p>
            Ingresa el email de tu cuenta y te enviaremos un enlace para crear una nueva contraseña.
          </p>
        </div>

        <div v-if="error" class="alert alert-error" role="alert">{{ error }}</div>

        <form @submit.prevent="handleSubmit" novalidate>
          <div class="input-group">
            <label class="label" for="email">Correo electrónico</label>
            <input
              id="email"
              v-model.trim="email"
              type="email"
              required
              autocomplete="email"
              class="input"
              :class="{ error: emailError }"
              placeholder="tu@email.com"
              @blur="validateEmail"
            />
            <span v-if="emailError" class="input-error" role="alert">{{ emailError }}</span>
          </div>

          <button
            type="submit"
            :disabled="authStore.state.loading"
            class="btn btn-primary btn-full"
            :aria-busy="authStore.state.loading"
          >
            <svg v-if="authStore.state.loading" class="spinner" width="16" height="16"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            <span>{{ authStore.state.loading ? 'Enviando...' : 'Enviar enlace de recuperación' }}</span>
          </button>
        </form>
      </template>

    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()

const email      = ref('')
const emailError = ref('')
const error      = ref('')
const sent       = ref(false)

const validateEmail = () => {
  emailError.value = ''
  if (!email.value) {
    emailError.value = 'El email es requerido'
    return false
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
    emailError.value = 'Ingresa un email válido'
    return false
  }
  return true
}

const handleSubmit = async () => {
  error.value = ''
  if (!validateEmail()) return

  try {
    await authStore.forgotPassword(email.value)
    sent.value = true
  } catch (e) {
    error.value = authStore.state.error || 'Error al enviar el correo. Intenta de nuevo.'
  }
}

const resetForm = () => {
  sent.value = false
  error.value = ''
  emailError.value = ''
}
</script>

<style scoped>
.auth-shell {
  background: var(--bg-primary);
  padding: 16px;
}

.auth-card {
  max-width: 440px;
  margin: 0 auto;
  padding: 40px 36px;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-muted);
  text-decoration: none;
  margin-bottom: 24px;
  transition: color var(--transition-fast);
  cursor: pointer;
}
.back-link:hover { color: var(--primary-solid); }

.auth-icon-wrap {
  width: 68px;
  height: 68px;
  border-radius: 20px;
  background: rgba(41, 182, 246, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 24px;
  box-shadow: var(--shadow-sm);
}

.success-icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(5, 150, 105, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
}

.input.error {
  border-color: var(--accent-red);
  box-shadow: var(--shadow-pressed), 0 0 0 3px rgba(220, 38, 38, 0.1);
}

.input-error {
  font-size: 0.78rem;
  color: var(--accent-red);
  margin-top: 4px;
  display: block;
}

.spinner {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .spinner { animation: none; }
}
</style>
