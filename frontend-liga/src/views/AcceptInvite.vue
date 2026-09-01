<template>
  <div class="auth-shell flex items-center justify-center h-screen">
    <div class="auth-card card w-full">

      <!-- Loading -->
      <template v-if="state === 'loading'">
        <div class="text-center py-lg">Validando invitación...</div>
      </template>

      <!-- Invalid invite -->
      <template v-else-if="state === 'invalid'">
        <div class="text-center">
          <div class="state-icon state-icon--error" aria-hidden="true">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#DC2626"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h2 class="mb-sm">Invitación inválida</h2>
          <p>{{ errorMsg || 'Este enlace de invitación no es válido o ha expirado.' }}</p>
          <router-link to="/login" class="btn btn-primary btn-full mt-md">
            Ir al inicio de sesión
          </router-link>
        </div>
      </template>

      <!-- Success -->
      <template v-else-if="state === 'success'">
        <div class="text-center">
          <div class="state-icon state-icon--success" aria-hidden="true">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#059669"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <h2 class="mb-sm">¡Acceso configurado!</h2>
          <p v-if="isNew">
            Tu cuenta ha sido creada. Ya puedes iniciar sesión como Administrador del club <strong>{{ clubName }}</strong>.
          </p>
          <p v-else>
            Tu acceso como Administrador del club <strong>{{ clubName }}</strong> ya está activo. Inicia sesión para continuar.
          </p>
          <router-link to="/login" class="btn btn-primary btn-full mt-md">
            Iniciar sesión
          </router-link>
        </div>
      </template>

      <!-- Form: existing user -->
      <template v-else-if="state === 'existing'">
        <div class="text-center">
          <div class="auth-icon-wrap" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#29b6f6"
                 stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <h2 class="mb-sm">Invitación a {{ clubName }}</h2>
          <p>Ya tienes una cuenta asociada a <strong>{{ emailMasked }}</strong>. Tu acceso como Administrador de Club ya fue activado.</p>
          <button class="btn btn-primary btn-full mt-md" @click="confirmExisting" :disabled="submitting">
            <span>{{ submitting ? 'Confirmando...' : 'Confirmar y continuar' }}</span>
          </button>
          <div v-if="error" class="alert alert-error mt-md" role="alert">{{ error }}</div>
        </div>
      </template>

      <!-- Form: new user — set password -->
      <template v-else-if="state === 'form'">
        <div class="auth-icon-wrap" aria-hidden="true">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#29b6f6"
               stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <div class="text-center mb-lg">
          <h2 class="mb-sm">Configurar acceso</h2>
          <p>Has sido invitado como Administrador del club <strong>{{ clubName }}</strong>.<br>Crea una contraseña para activar tu cuenta.</p>
        </div>

        <div v-if="error" class="alert alert-error" role="alert">{{ error }}</div>

        <form @submit.prevent="handleSubmit" novalidate>
          <div class="input-group">
            <label class="label" for="password">Contraseña</label>
            <div class="input-password-wrap">
              <input
                id="password"
                v-model="password"
                :type="showPwd ? 'text' : 'password'"
                required
                minlength="8"
                autocomplete="new-password"
                class="input"
                :class="{ error: passwordError }"
                placeholder="Mínimo 8 caracteres"
                @blur="validatePassword"
              />
              <button type="button" class="eye-btn" @click="showPwd = !showPwd"
                      :aria-label="showPwd ? 'Ocultar' : 'Mostrar'">
                <svg v-if="showPwd" width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
            </div>
            <span v-if="passwordError" class="input-error" role="alert">{{ passwordError }}</span>
          </div>

          <div class="input-group">
            <label class="label" for="confirm">Confirmar contraseña</label>
            <div class="input-password-wrap">
              <input
                id="confirm"
                v-model="confirm"
                :type="showConfirm ? 'text' : 'password'"
                required
                autocomplete="new-password"
                class="input"
                :class="{ error: confirmError }"
                placeholder="Repite tu contraseña"
                @blur="validateConfirm"
              />
              <button type="button" class="eye-btn" @click="showConfirm = !showConfirm"
                      :aria-label="showConfirm ? 'Ocultar' : 'Mostrar'">
                <svg v-if="showConfirm" width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
            </div>
            <span v-if="confirmError" class="input-error" role="alert">{{ confirmError }}</span>
          </div>

          <button
            type="submit"
            :disabled="submitting"
            class="btn btn-primary btn-full"
            style="margin-top: 24px;"
          >
            <svg v-if="submitting" class="spinner" width="16" height="16"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            <span>{{ submitting ? 'Creando cuenta...' : 'Activar acceso' }}</span>
          </button>
        </form>
      </template>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import apiClient from '../api'

const state       = ref('loading')
const token       = ref('')
const clubName    = ref('')
const emailMasked = ref('')
const isNew       = ref(false)
const password    = ref('')
const confirm     = ref('')
const showPwd     = ref(false)
const showConfirm = ref(false)
const passwordError = ref('')
const confirmError  = ref('')
const error       = ref('')
const errorMsg    = ref('')
const submitting  = ref(false)

onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const t = params.get('token')
  if (!t) { state.value = 'invalid'; return }
  token.value = t
  window.history.replaceState(null, '', window.location.pathname)

  try {
    const res = await apiClient.get('/auth/invite-info', { params: { token: t } })
    const data = res.data?.data
    clubName.value    = data.club_name
    emailMasked.value = data.email_masked
    isNew.value       = data.is_new
    state.value       = data.is_new ? 'form' : 'existing'
  } catch (e) {
    errorMsg.value = e.response?.data?.error?.message || 'Invitación inválida o expirada.'
    state.value = 'invalid'
  }
})

const validatePassword = () => {
  passwordError.value = ''
  if (!password.value) { passwordError.value = 'La contraseña es requerida'; return false }
  if (password.value.length < 8) { passwordError.value = 'Debe tener al menos 8 caracteres'; return false }
  return true
}

const validateConfirm = () => {
  confirmError.value = ''
  if (password.value !== confirm.value) { confirmError.value = 'Las contraseñas no coinciden'; return false }
  return true
}

const handleSubmit = async () => {
  error.value = ''
  if (!validatePassword() || !validateConfirm()) return
  await doAccept()
}

const confirmExisting = async () => {
  submitting.value = true
  error.value = ''
  try {
    const res = await apiClient.post('/auth/accept-invite', {
      token:    token.value,
      password: 'existing-user-no-password',
    })
    isNew.value = false
    state.value = 'success'
  } catch (e) {
    error.value = e.response?.data?.error?.message || 'Error al confirmar la invitación.'
  } finally {
    submitting.value = false
  }
}

const doAccept = async () => {
  submitting.value = true
  error.value = ''
  try {
    await apiClient.post('/auth/accept-invite', {
      token:    token.value,
      password: password.value,
    })
    isNew.value  = true
    state.value  = 'success'
  } catch (e) {
    error.value = e.response?.data?.error?.message || 'Error al procesar la invitación.'
  } finally {
    submitting.value = false
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
.state-icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
}
.state-icon--success { background: rgba(5, 150, 105, 0.1); }
.state-icon--error   { background: rgba(220, 38, 38, 0.1); }
.input-password-wrap { position: relative; }
.input-password-wrap .input { padding-right: 44px; }
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
.spinner { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .spinner { animation: none; } }
</style>
