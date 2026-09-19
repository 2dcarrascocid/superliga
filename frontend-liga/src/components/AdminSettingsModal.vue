<template>
  <Teleport to="body">
    <div class="admin-modal" @mousedown.self="close">
      <section
        ref="dialog"
        class="admin-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-settings-title"
        @keydown="onKeydown"
      >
        <header class="admin-modal__header">
          <div>
            <p class="admin-modal__eyebrow">Configuración de la liga</p>
            <h2 id="admin-settings-title">Parámetros de administrador</h2>
          </div>
          <button ref="closeButton" type="button" class="admin-modal__close" aria-label="Cerrar configuración" @click="close">×</button>
        </header>

        <div class="tabs" role="tablist">
          <button
            type="button"
            class="tab-btn"
            :class="{ active: activeTab === 'deporte' }"
            role="tab"
            :aria-selected="activeTab === 'deporte'"
            @click="activeTab = 'deporte'"
          >
            Deporte
          </button>
          <button
            type="button"
            class="tab-btn"
            :class="{ active: activeTab === 'administradores' }"
            role="tab"
            :aria-selected="activeTab === 'administradores'"
            @click="activeTab = 'administradores'"
          >
            Administradores
          </button>
        </div>

        <div v-if="loadingInitial" class="admin-modal__loading">Cargando configuración…</div>
        <div v-else-if="loadError" class="alert alert-error" role="alert">{{ loadError }}</div>

        <template v-else>
          <!-- ── Pestaña Deporte ────────────────────────────────────────── -->
          <div v-if="activeTab === 'deporte'" role="tabpanel">
            <p class="admin-modal__help">
              Elegí el deporte de la liga. Define el color de acento del sitio (claro y oscuro) para toda la organización.
            </p>
            <div v-if="sportError" class="alert alert-error" role="alert">{{ sportError }}</div>

            <div class="sport-grid">
              <button
                v-for="card in sportCards"
                :key="card.slug"
                type="button"
                class="sport-card"
                :class="{ 'sport-card--selected': card.selected, 'sport-card--disabled': !card.sportId }"
                :disabled="!card.sportId || sportSaving"
                :aria-pressed="card.selected"
                @click="selectSport(card)"
              >
                <span class="sport-card__icon" aria-hidden="true">
                  <svg v-if="card.slug === 'futbol'" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="9"/>
                    <path d="M12 7l3 2.2-1.1 3.6h-3.8L9 9.2z"/>
                    <path d="M12 7V3.5"/>
                    <path d="M15 9.2l3.5-1"/>
                    <path d="M13.9 12.8l2 3"/>
                    <path d="M10.1 12.8l-2 3"/>
                    <path d="M9 9.2l-3.5-1"/>
                  </svg>
                  <svg v-else-if="card.slug === 'basquetbol'" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="9"/>
                    <path d="M3 12h18"/>
                    <path d="M12 3v18"/>
                    <path d="M5.6 5.6c3 3 3 9.8 0 12.8"/>
                    <path d="M18.4 5.6c-3 3-3 9.8 0 12.8"/>
                  </svg>
                  <svg v-else width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="9"/>
                    <path d="M4 9c4 2 12 2 16 0"/>
                    <path d="M4 15c4-2 12-2 16 0"/>
                    <path d="M12 3c3 3 3 15 0 18"/>
                  </svg>
                </span>
                <span class="sport-card__label">{{ card.label }}</span>
                <span v-if="card.selected" class="badge badge-success sport-card__badge">Activo</span>
                <span v-else-if="!card.sportId" class="sport-card__unavailable">No disponible</span>
              </button>
            </div>
          </div>

          <!-- ── Pestaña Administradores ────────────────────────────────── -->
          <div v-else role="tabpanel">
            <p class="admin-modal__help">
              Hasta 5 administradores de organización. Cada uno recibe un correo de invitación para configurar su acceso.
            </p>

            <div class="table-container">
              <table class="table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Correo</th>
                    <th>Teléfono</th>
                    <th>Cargo</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="admin in admins" :key="admin.user_id">
                    <td>{{ admin.full_name || '—' }}</td>
                    <td>{{ admin.email }}</td>
                    <td>{{ admin.phone || '—' }}</td>
                    <td>{{ positionLabel(admin.position) }}</td>
                    <td><span class="badge badge-success">Activo</span></td>
                    <td>
                      <button
                        type="button"
                        class="btn btn-danger btn-sm"
                        :disabled="removingId === admin.user_id"
                        @click="handleRemove(admin)"
                      >
                        {{ removingId === admin.user_id ? 'Quitando…' : 'Quitar' }}
                      </button>
                    </td>
                  </tr>
                  <tr v-for="invite in pendingInvites" :key="`pending-${invite.email}`">
                    <td>{{ invite.full_name || '—' }}</td>
                    <td>{{ invite.email }}</td>
                    <td>{{ invite.phone || '—' }}</td>
                    <td>{{ positionLabel(invite.position) }}</td>
                    <td><span class="badge badge-secondary">Pendiente</span></td>
                    <td></td>
                  </tr>
                  <tr v-if="!admins.length && !pendingInvites.length">
                    <td colspan="6" class="text-center text-muted">Sin administradores registrados.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div v-if="limitReached" class="alert" role="status">
              Se alcanzó el máximo de 5 administradores de organización. Quita uno para invitar a otro.
            </div>

            <form class="admin-form" @submit.prevent="submitInvite">
              <h3 class="admin-form__title">Invitar administrador</h3>
              <div v-if="inviteError" class="alert alert-error" role="alert">{{ inviteError }}</div>
              <div class="admin-form__grid">
                <div class="input-group">
                  <label class="label" for="admin-name">Nombre completo</label>
                  <input id="admin-name" v-model.trim="form.fullName" class="input" placeholder="Nombre y apellido" required :disabled="limitReached" />
                </div>
                <div class="input-group">
                  <label class="label" for="admin-email">Correo</label>
                  <input id="admin-email" v-model.trim="form.email" type="email" class="input" placeholder="correo@ejemplo.cl" required :disabled="limitReached" />
                </div>
                <div class="input-group">
                  <label class="label" for="admin-phone">Teléfono</label>
                  <input id="admin-phone" v-model.trim="form.phone" class="input" placeholder="+56 9 1234 5678" :disabled="limitReached" />
                </div>
                <div class="input-group">
                  <label class="label" for="admin-position">Cargo</label>
                  <select id="admin-position" v-model="form.position" class="input" :disabled="limitReached">
                    <option v-for="p in POSITIONS" :key="p.value" :value="p.value">{{ p.label }}</option>
                  </select>
                </div>
              </div>
              <footer class="admin-form__actions">
                <button type="submit" class="btn btn-primary" :disabled="limitReached || inviting">
                  {{ inviting ? 'Enviando invitación…' : 'Invitar administrador' }}
                </button>
              </footer>
            </form>
          </div>
        </template>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useOrgSettingsStore } from '../stores/orgSettings';
import { useTheme } from '../composables/useTheme';

const emit = defineEmits(['close']);

const authStore = useAuthStore();
const orgSettingsStore = useOrgSettingsStore();
const { applySport } = useTheme();

const orgId = computed(() => authStore.state.org?.id);

const dialog = ref(null);
const closeButton = ref(null);
let returnFocus = null;

const activeTab = ref('deporte');
const loadingInitial = ref(true);
const loadError = ref('');

// ── Deporte ──────────────────────────────────────────────────────────────
const SPORT_OPTIONS = [
  { slug: 'futbol', label: 'Fútbol', keywords: ['futbol', 'fútbol', 'football', 'soccer'] },
  { slug: 'basquetbol', label: 'Básquetbol', keywords: ['basquetbol', 'básquetbol', 'basketball', 'baloncesto'] },
  { slug: 'voleibol', label: 'Vóleibol', keywords: ['voleibol', 'vóleibol', 'volleyball', 'voley'] },
];
const sportSaving = ref(false);
const sportError = ref('');

const sportCards = computed(() => SPORT_OPTIONS.map((opt) => {
  const catalogMatch = (orgSettingsStore.state.sports || []).find((s) =>
    opt.keywords.some((k) => (s.name || '').toLowerCase().includes(k)));
  return {
    ...opt,
    sportId: catalogMatch?.id ?? null,
    selected: orgSettingsStore.state.sport?.sportSlug === opt.slug,
  };
}));

const selectSport = async (card) => {
  if (!card.sportId || sportSaving.value || card.selected) return;
  sportSaving.value = true;
  sportError.value = '';
  try {
    const updated = await orgSettingsStore.saveSport(orgId.value, card.sportId);
    applySport(updated?.sportSlug || card.slug);
  } catch (error) {
    sportError.value = orgSettingsStore.state.error || 'No se pudo actualizar el deporte de la liga.';
  } finally {
    sportSaving.value = false;
  }
};

// ── Administradores ──────────────────────────────────────────────────────
const POSITIONS = [
  { value: 'PRESIDENTE', label: 'Presidente' },
  { value: 'SECRETARIO', label: 'Secretario' },
  { value: 'TESORERO', label: 'Tesorero' },
];
const positionLabel = (value) => POSITIONS.find((p) => p.value === value)?.label || value || '—';

const admins = computed(() => orgSettingsStore.state.admins || []);
const pendingInvites = computed(() => orgSettingsStore.state.pendingInvites || []);
const limitReached = computed(() => admins.value.length + pendingInvites.value.length >= 5);

const form = reactive({ fullName: '', email: '', phone: '', position: 'PRESIDENTE' });
const inviting = ref(false);
const inviteError = ref('');
const removingId = ref(null);

const resetForm = () => Object.assign(form, { fullName: '', email: '', phone: '', position: 'PRESIDENTE' });

const submitInvite = async () => {
  if (limitReached.value || inviting.value) return;
  inviting.value = true;
  inviteError.value = '';
  try {
    await orgSettingsStore.inviteAdmin(orgId.value, { ...form });
    resetForm();
  } catch (error) {
    inviteError.value = error.response?.data?.error?.message || orgSettingsStore.state.error || 'No se pudo enviar la invitación.';
  } finally {
    inviting.value = false;
  }
};

const handleRemove = async (admin) => {
  const ok = confirm(`¿Quitar a ${admin.full_name || admin.email} como administrador de la organización?`);
  if (!ok) return;
  removingId.value = admin.user_id;
  try {
    await orgSettingsStore.removeAdmin(orgId.value, admin.user_id);
  } catch (error) {
    alert(error.response?.data?.error?.message || orgSettingsStore.state.error || 'No se pudo quitar al administrador.');
  } finally {
    removingId.value = null;
  }
};

// ── Modal: accesibilidad, carga inicial y ciclo de vida ─────────────────
const close = () => emit('close');

const focusables = () => [...dialog.value.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])')];
const onKeydown = (event) => {
  if (event.key === 'Escape') { event.preventDefault(); close(); return; }
  if (event.key !== 'Tab') return;
  const nodes = focusables();
  if (!nodes.length) return;
  const first = nodes[0]; const last = nodes[nodes.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
};

onMounted(async () => {
  returnFocus = document.activeElement;
  document.body.style.overflow = 'hidden';
  try {
    if (orgId.value) {
      await Promise.all([
        orgSettingsStore.fetchSports(),
        orgSettingsStore.fetchSport(orgId.value),
        orgSettingsStore.fetchAdmins(orgId.value),
      ]);
    } else {
      await orgSettingsStore.fetchSports();
    }
  } catch (error) {
    loadError.value = orgSettingsStore.state.error || 'No se pudo cargar la configuración de la organización.';
  } finally {
    loadingInitial.value = false;
  }
  await nextTick();
  closeButton.value?.focus();
});

onUnmounted(() => {
  document.body.style.overflow = '';
  returnFocus?.focus?.();
});
</script>

<style scoped>
.admin-modal {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 16px;
  background: color-mix(in srgb, var(--bg-primary) 78%, transparent);
}
.admin-modal__dialog {
  width: min(100%, 760px);
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
  padding: 24px;
  color: var(--text-primary);
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
}
.admin-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: var(--spacing-md);
}
.admin-modal__header h2 { margin: 0; }
.admin-modal__eyebrow {
  margin: 0 0 4px;
  color: var(--primary-solid);
  font-size: .75rem;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.admin-modal__close {
  width: 44px;
  min-width: 44px;
  padding: 0;
  color: var(--text-primary);
  background: var(--bg-hover);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-full);
  font-size: 1.5rem;
}
.admin-modal__help {
  color: var(--text-muted);
  font-size: .875rem;
  margin: 0 0 var(--spacing-md);
}
.admin-modal__loading {
  padding: var(--spacing-xl) 0;
  text-align: center;
  color: var(--text-muted);
}

/* ── Tarjetas de deporte ── */
.sport-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--spacing-md);
}
.sport-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-lg) var(--spacing-md);
  background: var(--bg-hover);
  border: 2px solid var(--border-color);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  cursor: pointer;
  transition: border-color var(--transition-fast), transform var(--transition-fast);
}
.sport-card:hover:not(:disabled) { border-color: var(--primary-solid); }
.sport-card--selected { border-color: var(--primary-solid); box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-solid) 20%, transparent); }
.sport-card--disabled { opacity: .5; cursor: not-allowed; }
.sport-card__icon { color: var(--primary-solid); }
.sport-card__label { font-weight: 600; font-size: .9375rem; }
.sport-card__badge { margin-top: 2px; }
.sport-card__unavailable { font-size: .75rem; color: var(--text-muted); }

/* ── Formulario de invitación ── */
.admin-form {
  margin-top: var(--spacing-lg);
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--border-color);
}
.admin-form__title { margin: 0 0 var(--spacing-md); font-size: 1.0625rem; }
.admin-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
}
.admin-form__actions { display: flex; justify-content: flex-end; gap: var(--spacing-sm); margin-top: var(--spacing-sm); }
.table-actions { display: flex; gap: var(--spacing-xs, 8px); flex-wrap: wrap; }

@media (max-width: 640px) {
  .admin-modal__dialog { padding: 16px; }
  .sport-grid { grid-template-columns: 1fr; }
  .admin-form__grid { grid-template-columns: 1fr; }
  .admin-form__actions { align-items: stretch; }
  .admin-form__actions .btn { width: 100%; }
}
</style>
