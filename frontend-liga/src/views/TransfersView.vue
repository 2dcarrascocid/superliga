<template>
  <div class="transfers-container">
    <!-- Header -->
    <div class="page-header">
      <div class="header-title">
        <h1>Gestión de Transferencias</h1>
        <p class="subtitle">Administra las solicitudes, aprobaciones y pases de jugadores entre clubes</p>
      </div>
      <div class="header-actions">
        <router-link to="/transfers/dashboard" class="btn btn-secondary">
          <span class="icon">📊</span> Dashboard KPIs
        </router-link>
        <button @click="openCreateModal" class="btn btn-primary">
          <span class="icon">➕</span> Nueva Solicitud
        </button>
      </div>
    </div>

    <!-- Filtros -->
    <div class="filters-card">
      <div class="filter-group">
        <label>Club Origen</label>
        <select v-model="filters.origin_club_id" @change="applyFilters" class="form-select">
          <option value="">Todos los clubes origen</option>
          <option v-for="c in clubs" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>

      <div class="filter-group">
        <label>Club Destino</label>
        <select v-model="filters.destination_club_id" @change="applyFilters" class="form-select">
          <option value="">Todos los clubes destino</option>
          <option v-for="c in clubs" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>

      <div class="filter-group">
        <label>Estado</label>
        <select v-model="filters.status" @change="applyFilters" class="form-select">
          <option value="">Todos los estados</option>
          <option value="PENDING">Pendientes</option>
          <option value="APPROVED">Aprobadas</option>
          <option value="REJECTED">Rechazadas</option>
          <option value="CANCELLED">Canceladas</option>
        </select>
      </div>

      <div class="filter-actions-group">
        <button @click="resetFilters" class="btn btn-icon-text">
          <span>🔄 Limpiar</span>
        </button>
      </div>
    </div>

    <!-- Tabla de Transferencias -->
    <div class="table-card">
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>Cargando transferencias...</p>
      </div>

      <div v-else-if="transfers.length === 0" class="empty-state">
        <div class="empty-icon">🔄</div>
        <h3>No se encontraron transferencias</h3>
        <p>Intenta ajustar los filtros de búsqueda o registra una nueva solicitud.</p>
      </div>

      <div v-else class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Fecha Solicitud</th>
              <th>Jugador</th>
              <th>Club Origen</th>
              <th>Club Destino</th>
              <th>Monto Pase (Fee)</th>
              <th>Estado</th>
              <th class="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in transfers" :key="t.id">
              <td class="date-cell">{{ formatDate(t.created_at || t.transfer_date) }}</td>
              <td>
                <div class="player-info">
                  <div class="player-avatar">
                    <img :src="t.player?.photo_url || defaultAvatar" alt="Player" />
                  </div>
                  <div>
                    <span class="player-name">{{ getPlayerFullName(t.player) }}</span>
                    <span v-if="t.player?.rut" class="player-rut">RUT: {{ t.player.rut }}</span>
                  </div>
                </div>
              </td>
              <td>
                <span class="club-badge origin">
                  {{ t.origin_club?.name || t.from_club?.name || '—' }}
                </span>
              </td>
              <td>
                <span class="club-badge destination">
                  {{ t.destination_club?.name || t.to_club?.name || '—' }}
                </span>
              </td>
              <td class="fee-cell">
                {{ formatCurrency(t.fee) }}
              </td>
              <td>
                <span :class="['status-pill', getStatusClass(t.status)]">
                  {{ formatStatusLabel(t.status) }}
                </span>
              </td>
              <td class="text-right">
                <div class="action-buttons" v-if="isPending(t.status)">
                  <button @click="processStatus(t.id, 'APPROVED')" class="btn-action approve" title="Aprobar pase">
                    ✓ Aprobar
                  </button>
                  <button @click="processStatus(t.id, 'REJECTED')" class="btn-action reject" title="Rechazar pase">
                    ✕ Rechazar
                  </button>
                  <button @click="processStatus(t.id, 'CANCELLED')" class="btn-action cancel" title="Cancelar solicitud">
                    🚫 Cancelar
                  </button>
                </div>
                <span v-else class="text-muted text-sm">Sin acciones pendientes</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Paginación basada en Tokens -->
      <div class="pagination-bar" v-if="totalRegistros > 0">
        <div class="pagination-info">
          Mostrando {{ transfers.length }} de {{ totalRegistros }} transferencias registradas
        </div>
        <div class="pagination-controls">
          <button 
            @click="prevPage" 
            :disabled="tokenStack.length <= 1 || loading" 
            class="btn btn-page"
          >
            ← Anterior
          </button>
          <span class="page-badge">Página {{ tokenStack.length }}</span>
          <button 
            @click="nextPage" 
            :disabled="!nextToken || loading" 
            class="btn btn-page"
          >
            Siguiente →
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Formulario Nueva Solicitud -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeCreateModal">
      <div class="modal-card">
        <div class="modal-header">
          <h2>Nueva Solicitud de Transferencia</h2>
          <button @click="closeCreateModal" class="modal-close">✕</button>
        </div>

        <form @submit.prevent="handleCreateSubmit" class="modal-body">
          <div class="form-group">
            <label class="required">Club Origen</label>
            <select v-model="form.origin_club_id" @change="onOriginClubChange" class="form-control" required>
              <option value="" disabled>Selecciona el club de origen</option>
              <option v-for="c in clubs" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>

          <div class="form-group">
            <label class="required">Jugador a Transferir</label>
            <select v-model="form.player_id" class="form-control" :disabled="!form.origin_club_id || loadingPlayers" required>
              <option value="" disabled>
                {{ loadingPlayers ? 'Cargando jugadores...' : (!form.origin_club_id ? 'Primero selecciona el club origen' : 'Selecciona un jugador') }}
              </option>
              <option v-for="p in clubPlayers" :key="p.id" :value="p.id">
                {{ p.first_name }} {{ p.last_name }} (RUT: {{ p.rut || 'N/A' }})
              </option>
            </select>
          </div>

          <div class="form-group">
            <label class="required">Club Destino</label>
            <select v-model="form.destination_club_id" class="form-control" required>
              <option value="" disabled>Selecciona el club de destino</option>
              <option v-for="c in availableDestinationClubs" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Monto de la Operación (CLP)</label>
              <input 
                type="number" 
                v-model.number="form.fee" 
                placeholder="Ej. 150000" 
                min="0" 
                step="1000" 
                class="form-control"
              />
            </div>
            <div class="form-group">
              <label>Fecha del Pase</label>
              <input type="date" v-model="form.transfer_date" class="form-control" />
            </div>
          </div>

          <div class="form-group">
            <label>Observaciones / Notas</label>
            <textarea 
              v-model="form.notes" 
              rows="3" 
              placeholder="Notas opcionales sobre condiciones del pase..." 
              class="form-control"
            ></textarea>
          </div>

          <div class="modal-footer">
            <button type="button" @click="closeCreateModal" class="btn btn-secondary">Cancelar</button>
            <button type="submit" class="btn btn-primary" :disabled="submitting">
              <span v-if="submitting" class="spinner-sm"></span>
              <span v-else>Enviar Solicitud</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import transfersService from '../services/transfersService';
import { getClubs } from '../services/clubs.service';
import { listPlayersByClub } from '../services/players.service';
import { useNotifyStore } from '../stores/notify';

const defaultAvatar = 'https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/www/public/avatars/01.png';

const { notifySuccess, notifyError, confirm } = useNotifyStore();

// Estado
const loading = ref(false);
const submitting = ref(false);
const loadingPlayers = ref(false);
const transfers = ref([]);
const clubs = ref([]);
const clubPlayers = ref([]);
const totalRegistros = ref(0);
const nextToken = ref(null);
const tokenStack = ref(['']); // Para manejar historial de tokens de paginación
const showModal = ref(false);

// Filtros
const filters = reactive({
  origin_club_id: '',
  destination_club_id: '',
  status: '',
});

// Formulario de creación
const form = reactive({
  origin_club_id: '',
  destination_club_id: '',
  player_id: '',
  fee: 0,
  transfer_date: new Date().toISOString().substring(0, 10),
  notes: '',
});

// Clubes destino excluyendo el origen seleccionado
const availableDestinationClubs = computed(() => {
  if (!form.origin_club_id) return clubs.value;
  return clubs.value.filter((c) => c.id !== form.origin_club_id);
});

// Cargar catálogo de clubes
const fetchClubs = async () => {
  try {
    const res = await getClubs({ limit: 100 });
    const clubData = res.data?.data?.clubs || res.data?.clubs || res.data || [];
    clubs.value = Array.isArray(clubData) ? clubData : [];
  } catch (err) {
    console.error('Error cargando clubes:', err);
  }
};

// Cargar transferencias con el token actual
const fetchTransfers = async () => {
  loading.value = true;
  try {
    const currentToken = tokenStack.value[tokenStack.value.length - 1];
    const params = {
      limit: 10,
      ...(currentToken ? { next_token: currentToken } : {}),
      ...(filters.origin_club_id ? { origin_club_id: filters.origin_club_id } : {}),
      ...(filters.destination_club_id ? { destination_club_id: filters.destination_club_id } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };

    const res = await transfersService.getTransfers(params);
    transfers.value = res.data || [];
    nextToken.value = res.next_token || null;
    totalRegistros.value = res.total_registros ?? transfers.value.length;
  } catch (err) {
    notifyError('Error al cargar la lista de transferencias');
  } finally {
    loading.value = false;
  }
};

// Filtros
const applyFilters = () => {
  tokenStack.value = [''];
  fetchTransfers();
};

const resetFilters = () => {
  filters.origin_club_id = '';
  filters.destination_club_id = '';
  filters.status = '';
  tokenStack.value = [''];
  fetchTransfers();
};

// Paginación
const nextPage = () => {
  if (nextToken.value) {
    tokenStack.value.push(nextToken.value);
    fetchTransfers();
  }
};

const prevPage = () => {
  if (tokenStack.value.length > 1) {
    tokenStack.value.pop();
    fetchTransfers();
  }
};

// Al cambiar club origen en modal
const onOriginClubChange = async () => {
  form.player_id = '';
  clubPlayers.value = [];
  if (!form.origin_club_id) return;

  loadingPlayers.value = true;
  try {
    const res = await listPlayersByClub(form.origin_club_id, { status: 'ACTIVE', limit: 100 });
    const players = res.data?.data || res.data || [];
    clubPlayers.value = Array.isArray(players) ? players : [];
  } catch (err) {
    console.error('Error cargando jugadores del club:', err);
  } finally {
    loadingPlayers.value = false;
  }
};

// Modal handlers
const openCreateModal = () => {
  form.origin_club_id = '';
  form.destination_club_id = '';
  form.player_id = '';
  form.fee = 0;
  form.notes = '';
  form.transfer_date = new Date().toISOString().substring(0, 10);
  clubPlayers.value = [];
  showModal.value = true;
};

const closeCreateModal = () => {
  showModal.value = false;
};

// Guardar nueva solicitud
const handleCreateSubmit = async () => {
  submitting.value = true;
  try {
    await transfersService.createTransfer({
      player_id: form.player_id,
      origin_club_id: form.origin_club_id,
      destination_club_id: form.destination_club_id,
      fee: form.fee,
      notes: form.notes,
      transfer_date: form.transfer_date,
    });
    notifySuccess('Solicitud de transferencia registrada exitosamente');
    closeCreateModal();
    tokenStack.value = [''];
    fetchTransfers();
  } catch (err) {
    const msg = err.response?.data?.errorMessage || err.response?.data?.message || err.message;
    notifyError(`No se pudo registrar la transferencia: ${msg}`);
  } finally {
    submitting.value = false;
  }
};

// Cambiar estado (Aprobar, Rechazar, Cancelar)
const processStatus = async (transferId, status) => {
  const statusNames = { APPROVED: 'aprobar', REJECTED: 'rechazar', CANCELLED: 'cancelar' };
  const ok = await confirm({
    title: `¿Confirmar ${statusNames[status]}?`,
    message: `¿Estás seguro de que deseas ${statusNames[status]} esta transferencia?`,
    confirmText: statusNames[status].charAt(0).toUpperCase() + statusNames[status].slice(1),
    isDestructive: status === 'REJECTED' || status === 'CANCELLED',
  });
  if (!ok) return;

  try {
    await transfersService.updateTransferStatus(transferId, status);
    notifySuccess(`Transferencia ${status.toLowerCase()}ada correctamente`);
    fetchTransfers();
  } catch (err) {
    const msg = err.response?.data?.errorMessage || err.message;
    notifyError(`Error al actualizar estado: ${msg}`);
  }
};

// Formatos & Helpers
const isPending = (status) => {
  if (!status) return false;
  const s = status.toUpperCase();
  return s === 'PENDING' || s === 'ENVIADO';
};

const formatStatusLabel = (status) => {
  if (!status) return 'Pendiente';
  const map = {
    PENDING: 'PENDIENTE',
    ENVIADO: 'PENDIENTE',
    APPROVED: 'APROBADA',
    ACEPTADO: 'APROBADA',
    REJECTED: 'RECHAZADA',
    RECHAZADO: 'RECHAZADA',
    CANCELLED: 'CANCELADA',
    CANCELADO: 'CANCELADA',
  };
  return map[status.toUpperCase()] || status;
};

const getStatusClass = (status) => {
  if (!status) return 'pending';
  const s = status.toUpperCase();
  if (s === 'APPROVED' || s === 'ACEPTADO') return 'approved';
  if (s === 'REJECTED' || s === 'RECHAZADO') return 'rejected';
  if (s === 'CANCELLED' || s === 'CANCELADO') return 'cancelled';
  return 'pending';
};

const getPlayerFullName = (player) => {
  if (!player) return 'Jugador Desconocido';
  return `${player.first_name || ''} ${player.last_name || ''}`.trim() || 'Jugador sin nombre';
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-CL', { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatCurrency = (amount) => {
  const num = parseFloat(amount || 0);
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(num);
};

onMounted(() => {
  fetchClubs();
  fetchTransfers();
});
</script>

<style scoped>
.transfers-container {
  padding: var(--spacing-xl);
  max-width: 1400px;
  margin: 0 auto;
}

/* Header */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-xl);
  flex-wrap: wrap;
  gap: var(--spacing-md);
}

.header-title h1 {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.subtitle {
  color: var(--text-secondary);
  font-size: 0.95rem;
}

.header-actions {
  display: flex;
  gap: var(--spacing-md);
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 1.25rem;
  font-weight: 600;
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);
  text-decoration: none;
  font-size: 0.9rem;
}

.btn-primary {
  background: var(--primary-gradient);
  color: var(--primary-ink);
  box-shadow: var(--shadow-sm);
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-glow);
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
  background: var(--bg-hover);
  color: #fff;
}

.btn-icon-text {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  cursor: pointer;
}

.btn-icon-text:hover {
  color: var(--text-primary);
  border-color: var(--text-muted);
}

/* Filters Card */
.filters-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)) auto;
  gap: var(--spacing-md);
  align-items: end;
  margin-bottom: var(--spacing-xl);
  box-shadow: var(--shadow-sm);
}

.filter-group label {
  display: block;
  font-size: 0.825rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 0.35rem;
}

.form-select, .form-control {
  width: 100%;
  padding: 0.6rem 0.85rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 0.9rem;
  outline: none;
  transition: border-color var(--transition-fast);
}

.form-select:focus, .form-control:focus {
  border-color: var(--primary-solid);
}

/* Table Card */
.table-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-md);
}

.table-responsive {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.data-table th {
  background: var(--bg-secondary);
  padding: 1rem 1.25rem;
  font-weight: 600;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
  white-space: nowrap;
}

.data-table td {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
  vertical-align: middle;
  font-size: 0.9375rem;
  overflow-wrap: anywhere;
}

.data-table tbody tr:hover {
  background: var(--bg-hover);
}

.player-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.player-avatar img {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--border-color);
}

.player-name {
  display: block;
  font-weight: 600;
  color: var(--text-primary);
}

.player-rut {
  font-size: 0.775rem;
  color: var(--text-muted);
}

.club-badge {
  display: inline-block;
  padding: 0.35rem 0.75rem;
  border-radius: var(--radius-sm);
  font-size: 0.825rem;
  font-weight: 600;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
}

.fee-cell {
  font-family: monospace;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--accent-green);
}

/* Status Pills */
.status-pill {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.03em;
}

.status-pill.pending {
  background: rgba(245, 158, 11, 0.15);
  color: var(--accent-orange);
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.status-pill.approved {
  background: rgba(0, 230, 118, 0.15);
  color: var(--accent-green);
  border: 1px solid rgba(0, 230, 118, 0.3);
}

.status-pill.rejected {
  background: rgba(248, 113, 113, 0.15);
  color: var(--accent-red);
  border: 1px solid rgba(248, 113, 113, 0.3);
}

.status-pill.cancelled {
  background: rgba(107, 112, 137, 0.2);
  color: var(--text-muted);
  border: 1px solid var(--border-color);
}

/* Action Buttons */
.action-buttons {
  display: flex;
  gap: 0.35rem;
  justify-content: flex-end;
}

.btn-action {
  padding: 0.35rem 0.65rem;
  font-size: 0.775rem;
  font-weight: 600;
  border-radius: var(--radius-sm);
  border: none;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.btn-action.approve {
  background: rgba(0, 230, 118, 0.2);
  color: var(--accent-green);
}

.btn-action.reject {
  background: rgba(248, 113, 113, 0.2);
  color: var(--accent-red);
}

.btn-action.cancel {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.btn-action:hover {
  opacity: 0.85;
}

/* Pagination Bar */
.pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.btn-page {
  background: var(--bg-card);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  padding: 0.4rem 0.85rem;
  border-radius: var(--radius-sm);
}

.btn-page:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-badge {
  font-weight: 600;
  color: var(--text-primary);
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 580px;
  box-shadow: var(--shadow-xl);
  overflow: hidden;
}

.modal-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 {
  font-size: 1.25rem;
  color: var(--text-primary);
}

.modal-close {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 1.2rem;
  cursor: pointer;
}

.modal-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.required::after {
  content: ' *';
  color: var(--accent-red);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

/* Loading & Empty States */
.loading-state, .empty-state {
  text-align: center;
  padding: 3rem 1.5rem;
  color: var(--text-secondary);
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--border-color);
  border-top-color: var(--primary-solid);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-icon {
  font-size: 2.5rem;
  margin-bottom: 0.75rem;
}

.alert {
  padding: 0.85rem 1.25rem;
  border-radius: var(--radius-md);
  margin-bottom: 1.25rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
}

.alert-success {
  background: rgba(0, 230, 118, 0.15);
  border: 1px solid var(--accent-green);
  color: var(--accent-green);
}

.alert-error {
  background: rgba(248, 113, 113, 0.15);
  border: 1px solid var(--accent-red);
  color: var(--accent-red);
}

.alert-close {
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
}
</style>
