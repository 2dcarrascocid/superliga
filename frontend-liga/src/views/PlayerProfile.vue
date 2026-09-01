<template>
  <div class="container mt-md player-profile">
    <div class="flex justify-between items-center mb-lg">
      <h2>Mi Perfil</h2>
    </div>

    <div v-if="loading && !loaded" class="text-center py-lg">Cargando...</div>
    <div v-else-if="loadError" class="alert alert-error mb-md">{{ loadError }}</div>

    <template v-else>
      <div class="player-layout">

        <!-- Columna izquierda: datos personales editables -->
        <div class="card mb-md">
          <h3 class="section-title">Datos Personales</h3>

          <div v-if="saveSuccess" class="alert alert-success mb-md" role="status">{{ saveSuccess }}</div>
          <div v-if="saveError" class="alert alert-error mb-md" role="alert">{{ saveError }}</div>

          <form @submit.prevent="handleSave">
            <div class="input-group">
              <label class="label" for="first_name">Nombre</label>
              <input id="first_name" v-model="form.first_name" class="input" required />
            </div>
            <div class="input-group">
              <label class="label" for="last_name">Apellido</label>
              <input id="last_name" v-model="form.last_name" class="input" required />
            </div>
            <div class="input-group">
              <label class="label" for="rut">
                RUT
                <svg class="lock-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </label>
              <input id="rut" :value="player.rut || '—'" class="input" disabled aria-describedby="rut-hint" />
              <span id="rut-hint" class="text-muted text-sm">El RUT no se puede editar. Si está incorrecto, contacta a tu club.</span>
            </div>

            <button type="submit" class="btn btn-primary btn-full mt-md" :disabled="saving">
              {{ saving ? 'Guardando...' : 'Guardar cambios' }}
            </button>
          </form>
        </div>

        <!-- Columna derecha: club, serie y torneos -->
        <div class="player-body">
          <div class="card mb-md">
            <h3 class="section-title">Mi Club y Serie</h3>

            <div v-if="!roster || !club || !series" class="empty-state">
              Todavía no estás asignado a ninguna serie. Cuando tu club te incorpore a un roster activo, aquí verás tu club y tu serie.
            </div>
            <div v-else class="info-grid">
              <div class="info-item">
                <span class="info-label">Club</span>
                <span class="info-value">{{ club.name }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Mi serie</span>
                <span class="info-value">{{ series.name }}</span>
              </div>
              <div class="info-item" v-if="series.description">
                <span class="info-label">Descripción</span>
                <span class="info-value">{{ series.description }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Estado en el roster</span>
                <span class="badge" :class="roster.status === 'ACTIVE' ? 'badge-success' : 'badge-secondary'">
                  {{ roster.status || '—' }}
                </span>
              </div>
            </div>
          </div>

          <div class="card">
            <h3 class="section-title">Torneos de mi serie</h3>

            <div v-if="!tournaments.length" class="empty-state">
              Tu serie no está inscrita en ningún torneo por el momento.
            </div>
            <div v-else class="tournaments-list">
              <div v-for="t in tournaments" :key="t.id" class="tournament-item">
                <div class="tournament-item__header">
                  <span class="font-bold">{{ t.name }}</span>
                  <span class="badge badge-secondary">{{ t.status || '—' }}</span>
                </div>
                <div class="flex gap-sm mt-sm tournament-item__actions">
                  <router-link :to="`/mi-perfil/torneos/${t.id}/posiciones`" class="btn btn-secondary btn-sm">
                    Tabla de Posiciones
                  </router-link>
                  <router-link :to="`/mi-perfil/torneos/${t.id}/goleadores`" class="btn btn-secondary btn-sm">
                    Goleadores
                  </router-link>
                  <router-link :to="`/mi-perfil/torneos/${t.id}/fairplay`" class="btn btn-secondary btn-sm">
                    Fairplay
                  </router-link>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { getMyPlayerProfile, updateMyPlayerProfile } from '../services/players.service';

const authStore = useAuthStore();

const loading = ref(true);
const loaded = ref(false);
const loadError = ref('');

const player = ref({});
const roster = ref(null);
const club = ref(null);
const series = ref(null);
const tournaments = ref([]);

const form = reactive({ first_name: '', last_name: '' });

const saving = ref(false);
const saveError = ref('');
const saveSuccess = ref('');

const applyProfile = (profile) => {
  player.value = profile?.player || {};
  roster.value = profile?.roster || null;
  club.value = profile?.club || null;
  series.value = profile?.series || null;
  tournaments.value = profile?.tournaments || [];
  form.first_name = player.value.first_name || '';
  form.last_name = player.value.last_name || '';
};

const loadProfile = async () => {
  loading.value = true;
  loadError.value = '';
  try {
    const response = await getMyPlayerProfile();
    const inner = response.data?.data ?? response.data;
    applyProfile(inner);
    // Mantiene el store de auth sincronizado (por si otra vista lo consulta).
    authStore.state.player = inner;
    loaded.value = true;
  } catch (e) {
    const code = e.response?.data?.error?.code;
    if (code === 'NOT_A_PLAYER') {
      loadError.value = 'Tu cuenta no está vinculada a ningún jugador. Si crees que es un error, contacta a tu club.';
    } else {
      loadError.value = e.response?.data?.error?.message || 'No se pudo cargar tu perfil.';
    }
  } finally {
    loading.value = false;
  }
};

const handleSave = async () => {
  saving.value = true;
  saveError.value = '';
  saveSuccess.value = '';
  try {
    const response = await updateMyPlayerProfile({
      first_name: form.first_name,
      last_name: form.last_name,
    });
    const inner = response.data?.data ?? response.data;
    if (inner?.player) {
      player.value = inner.player;
    }
    saveSuccess.value = 'Tus datos se guardaron correctamente.';
  } catch (e) {
    saveError.value = e.response?.data?.error?.message || 'No se pudieron guardar los cambios.';
  } finally {
    saving.value = false;
  }
};

onMounted(loadProfile);
</script>

<style scoped>
.player-layout {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: var(--spacing-lg);
  align-items: start;
}
@media (max-width: 768px) {
  .player-layout { grid-template-columns: 1fr; }
}
.player-body { display: flex; flex-direction: column; gap: var(--spacing-md); }

.section-title {
  font-size: 0.95rem;
  font-weight: 600;
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--border-color);
  margin-bottom: var(--spacing-md);
}

.lock-icon {
  vertical-align: -2px;
  margin-left: 4px;
  color: var(--text-muted);
}

.input:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.empty-state {
  color: var(--text-muted);
  font-size: 0.9rem;
  padding: var(--spacing-md) 0;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: var(--spacing-md);
}
.info-item { display: flex; flex-direction: column; gap: 3px; }
.info-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}
.info-value { font-size: 0.95rem; }

.tournaments-list { display: flex; flex-direction: column; gap: var(--spacing-md); }
.tournament-item {
  padding: var(--spacing-md);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}
.tournament-item__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-sm);
}
.tournament-item__actions { flex-wrap: wrap; }

.alert-success {
  background: rgba(52, 211, 153, 0.1);
  border: 1px solid rgba(52, 211, 153, 0.28);
  color: #6ee7b7;
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
}

.font-bold { font-weight: 600; }
</style>
