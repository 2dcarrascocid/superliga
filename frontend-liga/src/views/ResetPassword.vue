<template>
  <div class="auth-shell flex items-center justify-center h-screen">
    <div class="auth-card card w-full">

      <!-- Invalid token state -->
      <template v-if="tokenState === 'invalid'">
        <div class="text-center">
          <div class="error-icon" aria-hidden="true">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#DC2626"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h2 class="mb-sm">Enlace inválido o expirado</h2>
          <p>El enlace de recuperación no es válido o ya fue utilizado. Solicita uno nuevo.</p>
          <router-link to="/forgot-password" class="btn btn-primary btn-full mt-md">
            Solicitar nuevo enlace
          </router-link>
          <router-link to="/login" class="back-link mt-md">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Ir al login
          </router-link>
        </div>
      </template>

      <!-- Success state -->
      <template v-else-if="tokenState === 'success'">
        <div class="text-center">
          <div class="success-icon" aria-hidden="true">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#059669"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <h2 class="mb-sm">¡Contraseña actualizada!</h2>
          <p>Tu contraseña fue cambiada exitosamente. Ya puedes iniciar sesión con tu nueva contraseña.</p>
          <router-link to="/login" class="btn btn-primary btn-full mt-md">
            Iniciar sesión
          </router-link>
        </div>
      </template>

      <!-- Form state (valid token) -->
      <template v-else>
        <!-- Icon -->
        <div class="auth-icon-wrap" aria-hidden="true">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#29b6f6"
               stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>

        <div class="text-center mb-lg">
          <h2 class="mb-sm">Nueva contraseña</h2>
          <p>Ingresa y confirma tu nueva contraseña. Debe tener al menos 8 caracteres.</p>
        </div>

        <div v-if="error" class="alert alert-error" role="alert">{{ error }}</div>

        <form @submit.prevent="handleSubmit" novalidate>
          <!-- New password -->
          <div class="input-group">
            <label class="label" for="new-password">Nueva contraseña</label>
            <div class="input-password-wrap">
              <input
                id="new-password"
                v-model="newPassword"
                :type="showNew ? 'text' : 'password'"
                required
                minlength="8"
                autocomplete="new-password"
                class="input"
                :class="{ error: newPasswordError }"
                placeholder="Mínimo 8 caracteres"
                @blur="validateNew"
              />
              <button type="button" class="eye-btn" @click="showNew = !showNew"
                      :aria-label="showNew ? 'Ocultar contraseña' : 'Mostrar contraseña'">
                <svg v-if="showNew" width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
            </div>
            <span v-if="newPasswordError" class="input-error" role="alert">{{ newPasswordError }}</span>
          </div>

          <!-- Confirm password -->
          <div class="input-group">
            <label class="label" for="confirm-password">Confirmar contraseña</label>
            <div class="input-password-wrap">
              <input
                id="confirm-password"
                v-model="confirmPassword"
                :type="showConfirm ? 'text' : 'password'"
                required
                autocomplete="new-password"
                class="input"
                :class="{ error: confirmError }"
                placeholder="Repite tu nueva contraseña"
                @blur="validateConfirm"
              />
              <button type="button" class="eye-btn" @click="showConfirm = !showConfirm"
                      :aria-label="showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'">
                <svg v-if="showConfirm" width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
            </div>
            <span v-if="confirmError" class="input-error" role="alert">{{ confirmError }}</span>
          </div>

          <!-- Strength indicator -->
          <div class="strength-wrap" aria-label="Seguridad de la contraseña">
            <div class="strength-bars">
              <div
                v-for="i in 4" :key="i"
                class="strength-bar"
                :class="strengthClass(i)"
              ></div>
            </div>
            <span class="strength-label" :class="`strength-label--${strength.level}`">
              {{ strength.label }}
            </span>
          </div>

          <button
            type="submit"
            :disabled="authStore.state.loading"
            class="btn btn-primary btn-full"
            style="margin-top: 24px;"
            :aria-busy="authStore.state.loading"
          >
            <svg v-if="authStore.state.loading" class="spinner" width="16" height="16"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            <span>{{ authStore.state.loading ? 'Actualizando...' : 'Cambiar contraseña' }}</span>
          </button>
        </form>
      </template>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()

const resetToken     = ref('')
const tokenState     = ref('loading') // 'loading' | 'valid' | 'invalid' | 'success'
const newPassword    = ref('')
const confirmPassword = ref('')
const showNew        = ref(false)
const showConfirm    = ref(false)
const newPasswordError = ref('')
const confirmError   = ref('')
const error          = ref('')

// Lee ?token=XXX del query string (enviado por nuestro propio SMTP)
onMounted(() => {
  const params = new URLSearchParams(window.location.search)
  const token  = params.get('token')

  if (token) {
    resetToken.value = token
    tokenState.value = 'valid'
    // Limpiar el token de la URL sin recargar la página
    window.history.replaceState(null, '', window.location.pathname)
  } else {
    tokenState.value = 'invalid'
  }
})

// Password strength
const strength = computed(() => {
  const pwd = newPassword.value
  if (!pwd) return { score: 0, level: 'empty', label: '' }
  let score = 0
  if (pwd.length >= 8)  score++
  if (pwd.length >= 12) score++
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++
  if (/[0-9]/.test(pwd)) score++
  if (/[^A-Za-z0-9]/.test(pwd)) score++
  if (score <= 1) return { score: 1, level: 'weak',   label: 'Débil' }
  if (score <= 2) return { score: 2, level: 'fair',   label: 'Regular' }
  if (score <= 3) return { score: 3, level: 'good',   label: 'Buena' }
  return           { score: 4, level: 'strong', label: 'Fuerte' }
})

const strengthClass = (bar) => {
  if (!newPassword.value) return ''
  return bar <= strength.value.score ? `bar--${strength.value.level}` : ''
}

const validateNew = () => {
  newPasswordError.value = ''
  if (!newPassword.value) {
    newPasswordError.value = 'La contraseña es requerida'
    return false
  }
  if (newPassword.value.length < 8) {
    newPasswordError.value = 'Debe tener al menos 8 caracteres'
    return false
  }
  return true
}

const validateConfirm = () => {
  confirmError.value = ''
  if (newPassword.value !== confirmPassword.value) {
    confirmError.value = 'Las contraseñas no coinciden'
    return false
  }
  return true
}

const handleSubmit = async () => {
  error.value = ''
  const validNew     = validateNew()
  const validConfirm = validateConfirm()
  if (!validNew || !validConfirm) return

  try {
    await authStore.resetPassword(resetToken.value, newPassword.value)
    tokenState.value = 'success'
  } catch (e) {
    error.value = authStore.state.error || 'Error al cambiar la contraseña. Intenta solicitar un nuevo enlace.'
  }
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

.error-icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(220, 38, 38, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-muted);
  text-decoration: none;
  transition: color var(--transition-fast);
  cursor: pointer;
}
.back-link:hover { color: var(--primary-solid); }
.back-link.mt-md { margin-top: var(--spacing-md); display: flex; justify-content: center; }

/* Password input with eye icon */
.input-password-wrap {
  position: relative;
}

.input-password-wrap .input {
  padding-right: 44px;
}

.eye-btn {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  transition: color var(--transition-fast);
  border-radius: var(--radius-sm);
}
.eye-btn:hover { color: var(--primary-solid); }

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

/* Strength indicator */
.strength-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
}

.strength-bars {
  display: flex;
  gap: 4px;
  flex: 1;
}

.strength-bar {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--border-color);
  transition: background var(--transition-base);
}

.bar--weak   { background: #EF4444; }
.bar--fair   { background: #F59E0B; }
.bar--good   { background: #3B82F6; }
.bar--strong { background: #059669; }

.strength-label {
  font-size: 0.75rem;
  font-weight: 700;
  min-width: 48px;
  text-align: right;
}
.strength-label--weak   { color: #EF4444; }
.strength-label--fair   { color: #F59E0B; }
.strength-label--good   { color: #3B82F6; }
.strength-label--strong { color: #059669; }
.strength-label--empty  { color: transparent; }

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
