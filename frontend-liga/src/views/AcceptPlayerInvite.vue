<template>
  <div class="auth-shell flex items-center justify-center h-screen">
    <div class="auth-card card w-full">

      <!-- Sin token en la URL -->
      <template v-if="state === 'missing-token'">
        <div class="text-center">
          <div class="state-icon state-icon--error" aria-hidden="true">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#DC2626"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h2 class="mb-sm">Enlace incompleto</h2>
          <p>Este enlace de invitación no incluye el código necesario. Solicita al club que te reenvíe la invitación.</p>
          <router-link to="/login" class="btn btn-primary btn-full mt-md">
            Ir al inicio de sesión
          </router-link>
        </div>
      </template>

      <!-- Formulario: pedir login con Google -->
      <template v-else-if="state === 'form'">
        <div class="auth-icon-wrap" aria-hidden="true">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#29b6f6"
               stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <div class="text-center mb-lg">
          <h2 class="mb-sm">Invitación como Jugador</h2>
          <p>Te invitaron a vincular tu acceso como jugador. Para continuar, inicia sesión con la cuenta de Google del email al que llegó la invitación.</p>
        </div>

        <div v-if="error" class="alert alert-error" role="alert">{{ error }}</div>

        <div class="text-center">
          <div ref="googleBtnEl" class="google-btn-wrap"></div>
          <p v-if="googleError" class="input-error mt-sm" role="alert">{{ googleError }}</p>
          <p v-if="submitting" class="text-muted text-sm mt-md">Confirmando invitación...</p>
        </div>
      </template>

      <!-- Invitación inválida / error del backend -->
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
          <h2 class="mb-sm">No se pudo aceptar la invitación</h2>
          <p>{{ errorMsg }}</p>
          <button class="btn btn-secondary btn-full mt-md" @click="retry">
            Intentar de nuevo
          </button>
          <router-link to="/login" class="btn btn-primary btn-full mt-md">
            Ir al inicio de sesión
          </router-link>
        </div>
      </template>

      <!-- Éxito -->
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
          <p>Tu acceso como Jugador ya está activo. Te llevamos a tu perfil.</p>
        </div>
      </template>

    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useGoogleAuth } from '../composables/useGoogleAuth'

const router = useRouter()
const authStore = useAuthStore()

const state = ref('form')
const token = ref('')
const error = ref('')
const errorMsg = ref('')
const submitting = ref(false)

const googleBtnEl = ref(null)
const { credential: googleCredential, error: googleError, renderButton } = useGoogleAuth()

// Mensajes específicos por código de error del contrato de
// POST /auth/accept-player-invite (ver backend.md de T-20260828-103923).
const ERROR_MESSAGES = {
  INVALID_INVITE: 'Este enlace de invitación ya no es válido: puede haber expirado o haber sido usado antes. Pide al club que te envíe una invitación nueva.',
  OAUTH_FAILED: 'No se pudo validar tu sesión de Google. Intenta iniciar sesión nuevamente.',
  EMAIL_MISMATCH: 'La cuenta de Google con la que iniciaste sesión no coincide con el email al que se envió esta invitación. Inicia sesión con la cuenta correcta.',
  USER_ALREADY_LINKED_TO_ANOTHER_PLAYER: 'Esta cuenta de Google ya está vinculada a otro jugador. Cada cuenta de Google solo puede vincularse a un jugador.',
}

onMounted(() => {
  const params = new URLSearchParams(window.location.search)
  const t = params.get('token')
  if (!t) {
    state.value = 'missing-token'
    return
  }
  token.value = t
  window.history.replaceState(null, '', window.location.pathname)
  mountGoogleButton()
})

const mountGoogleButton = async () => {
  await nextTick()
  await renderButton(googleBtnEl)
}

const retry = () => {
  error.value = ''
  errorMsg.value = ''
  state.value = 'form'
  mountGoogleButton()
}

watch(googleCredential, async (idToken) => {
  if (!idToken || !token.value) return
  submitting.value = true
  error.value = ''
  try {
    await authStore.acceptPlayerInvite(token.value, idToken)
    state.value = 'success'
    setTimeout(() => router.push('/mi-perfil'), 900)
  } catch (e) {
    const code = e.response?.data?.error?.code
    errorMsg.value = ERROR_MESSAGES[code] || e.response?.data?.error?.message || 'Ocurrió un error al procesar la invitación. Intenta de nuevo.'
    state.value = 'invalid'
  } finally {
    submitting.value = false
  }
})
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
.google-btn-wrap {
  display: flex;
  justify-content: center;
  min-height: 44px;
}
.input-error {
  font-size: 0.78rem;
  color: var(--accent-red);
  margin-top: 4px;
  display: block;
}
</style>
