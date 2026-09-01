<template>
  <div class="card">
    <div class="flex justify-between items-center mb-md">
      <h3 class="section-title mb-0">Documentación</h3>
      <button class="btn btn-primary btn-sm" @click="openUploadModal">
        + Adjuntar
      </button>
    </div>

    <!-- Estado vacío -->
    <div v-if="!loading && documents.length === 0" class="text-center py-lg text-muted text-sm">
      No hay documentos adjuntos para este jugador.
    </div>

    <!-- Cargando -->
    <div v-else-if="loading" class="text-center py-md text-muted text-sm">Cargando...</div>

    <!-- Error -->
    <div v-else-if="listError" class="alert alert-error text-sm">{{ listError }}</div>

    <!-- Tabla de documentos -->
    <div v-else class="docs-table-wrapper">
      <table class="docs-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Tipo</th>
            <th>Tamaño</th>
            <th>Fecha</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="doc in documents" :key="doc.id">
            <td class="doc-name">
              <span class="doc-icon">{{ getFileIcon(doc.mime_type) }}</span>
              {{ doc.nombre_original }}
            </td>
            <td class="text-muted text-sm">{{ getMimeLabel(doc.mime_type) }}</td>
            <td class="text-sm">{{ formatFileSize(doc.size) }}</td>
            <td class="text-sm text-muted">{{ formatDate(doc.created_at) }}</td>
            <td class="doc-actions">
              <a
                v-if="doc.url_publica"
                :href="doc.url_publica"
                target="_blank"
                rel="noopener"
                class="btn btn-secondary btn-xs"
              >Ver</a>
              <button
                class="btn btn-danger btn-xs"
                @click="confirmDelete(doc)"
              >Eliminar</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal: Subir documento -->
    <div v-if="showUploadModal" class="modal-backdrop" @click.self="closeUploadModal">
      <div class="modal-box">
        <h4 class="mb-md">Adjuntar documento</h4>

        <div
          class="dropzone"
          :class="{ 'dropzone-active': isDragging }"
          @dragover.prevent="isDragging = true"
          @dragleave="isDragging = false"
          @drop.prevent="handleDrop"
          @click="triggerFileInput"
        >
          <input type="file" ref="fileInputRef" class="hidden" @change="handleFileSelected" />
          <p v-if="!selectedFile" class="text-muted text-sm">
            Arrastra un archivo aquí o <span class="link">haz clic para seleccionar</span>
          </p>
          <p v-else class="text-sm font-bold">{{ selectedFile.name }} ({{ formatFileSize(selectedFile.size) }})</p>
        </div>

        <!-- Nombre personalizado -->
        <div v-if="selectedFile" class="mt-md">
          <label class="info-label">Nombre del documento</label>
          <input
            v-model="docName"
            type="text"
            class="doc-name-input mt-xs"
            placeholder="Ej: Contrato 2026, Ficha médica..."
            :disabled="uploading"
            @click.stop
          />
        </div>

        <div v-if="uploadError" class="alert alert-error mt-sm text-sm">{{ uploadError }}</div>

        <!-- Barra de progreso -->
        <div v-if="uploading" class="progress-bar-wrapper mt-md">
          <div class="progress-bar" :style="{ width: uploadProgress + '%' }"></div>
          <span class="progress-label">{{ uploadProgress }}%</span>
        </div>

        <div class="flex gap-sm justify-end mt-lg">
          <button class="btn btn-secondary" @click="closeUploadModal" :disabled="uploading">
            Cancelar
          </button>
          <button
            class="btn btn-primary"
            :disabled="!selectedFile || uploading"
            @click="doUpload"
          >
            {{ uploading ? 'Subiendo...' : 'Subir' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal: Confirmar eliminación -->
    <div v-if="docToDelete" class="modal-backdrop" @click.self="docToDelete = null">
      <div class="modal-box modal-sm">
        <h4 class="mb-sm">Eliminar documento</h4>
        <p class="text-sm text-muted mb-md">
          ¿Seguro que quieres eliminar "<strong>{{ docToDelete.nombre_original }}</strong>"?
          Esta acción no se puede deshacer.
        </p>
        <div class="flex gap-sm justify-end">
          <button class="btn btn-secondary btn-sm" @click="docToDelete = null">Cancelar</button>
          <button class="btn btn-danger btn-sm" :disabled="deleting" @click="doDelete">
            {{ deleting ? 'Eliminando...' : 'Eliminar' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import {
  listDocuments,
  uploadDocument,
  deleteDocument,
  formatFileSize,
} from '../services/player_documents.service.js';

const props = defineProps({
  playerId: { type: String, required: true },
});

// ── Estado ────────────────────────────────────────────────────────────────────
const documents     = ref([]);
const loading       = ref(false);
const listError     = ref('');

const showUploadModal = ref(false);
const selectedFile    = ref(null);
const docName         = ref('');
const isDragging      = ref(false);
const uploading       = ref(false);
const uploadProgress  = ref(0);
const uploadError     = ref('');
const fileInputRef    = ref(null);

const docToDelete = ref(null);
const deleting    = ref(false);

// ── Carga ─────────────────────────────────────────────────────────────────────
async function loadDocuments() {
  loading.value   = true;
  listError.value = '';
  try {
    const res = await listDocuments(props.playerId);
    documents.value = res.data?.data?.documents ?? [];
  } catch (e) {
    listError.value = e.response?.data?.error?.message || 'Error al cargar documentos';
  } finally {
    loading.value = false;
  }
}

onMounted(loadDocuments);

// ── Upload ────────────────────────────────────────────────────────────────────
function openUploadModal() {
  selectedFile.value   = null;
  docName.value        = '';
  uploadError.value    = '';
  uploadProgress.value = 0;
  showUploadModal.value = true;
}

function closeUploadModal() {
  if (uploading.value) return;
  showUploadModal.value = false;
}

function triggerFileInput() { fileInputRef.value?.click(); }

function handleFileSelected(e) {
  selectedFile.value = e.target.files[0] || null;
  docName.value      = selectedFile.value?.name ?? '';
  uploadError.value  = '';
}

function handleDrop(e) {
  isDragging.value   = false;
  selectedFile.value = e.dataTransfer.files[0] || null;
  docName.value      = selectedFile.value?.name ?? '';
  uploadError.value  = '';
}

async function doUpload() {
  if (!selectedFile.value) return;
  uploading.value      = true;
  uploadError.value    = '';
  uploadProgress.value = 0;

  try {
    const doc = await uploadDocument(
      props.playerId,
      selectedFile.value,
      docName.value.trim() || selectedFile.value.name,
      (pct) => { uploadProgress.value = pct; }
    );
    documents.value.unshift(doc);
    uploading.value = false;
    showUploadModal.value = false;
  } catch (e) {
    uploading.value   = false;
    uploadError.value = e.response?.data?.error?.message || 'Error al subir el archivo';
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────
function confirmDelete(doc) { docToDelete.value = doc; }

async function doDelete() {
  if (!docToDelete.value) return;
  deleting.value = true;
  try {
    await deleteDocument(props.playerId, docToDelete.value.id);
    documents.value = documents.value.filter(d => d.id !== docToDelete.value.id);
    docToDelete.value = null;
  } catch (e) {
    // el error lo maneja el modal — no colapsamos la vista
  } finally {
    deleting.value = false;
  }
}

// ── Formato ───────────────────────────────────────────────────────────────────
function formatDate(val) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getMimeLabel(mime) {
  if (!mime) return '—';
  const map = {
    'application/pdf': 'PDF',
    'image/jpeg': 'Imagen',
    'image/png':  'Imagen',
    'image/webp': 'Imagen',
    'application/msword': 'Word',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
    'application/vnd.ms-excel': 'Excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
  };
  return map[mime] || mime.split('/')[1]?.toUpperCase() || mime;
}

function getFileIcon(mime) {
  if (!mime) return '📄';
  if (mime.startsWith('image/')) return '🖼️';
  if (mime === 'application/pdf') return '📕';
  if (mime.includes('word')) return '📝';
  if (mime.includes('excel') || mime.includes('sheet')) return '📊';
  return '📄';
}
</script>

<style scoped>
.section-title {
  font-size: 0.95rem;
  font-weight: 600;
}

.docs-table-wrapper {
  overflow-x: auto;
}

.docs-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}

.docs-table th {
  text-align: left;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-bottom: 1px solid var(--border-color);
}

.docs-table td {
  padding: var(--spacing-sm);
  border-bottom: 1px solid var(--border-color);
  vertical-align: middle;
}

.docs-table tr:last-child td { border-bottom: none; }

.doc-name {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-weight: 500;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc-icon { font-size: 1.1rem; flex-shrink: 0; }

.doc-actions {
  display: flex;
  gap: var(--spacing-xs);
  justify-content: flex-end;
}

/* Modal */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-box {
  background: var(--bg-primary, #fff);
  border-radius: 8px;
  padding: var(--spacing-lg);
  width: 100%;
  max-width: 460px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
}

.modal-sm { max-width: 360px; }

/* Dropzone */
.dropzone {
  border: 2px dashed var(--border-color);
  border-radius: 6px;
  padding: var(--spacing-lg);
  text-align: center;
  cursor: pointer;
  transition: border-color 0.15s;
}

.dropzone:hover,
.dropzone-active {
  border-color: var(--color-primary, #3b82f6);
}

.link {
  color: var(--color-primary, #3b82f6);
  text-decoration: underline;
  cursor: pointer;
}

/* Progreso */
.progress-bar-wrapper {
  position: relative;
  height: 8px;
  background: var(--bg-secondary, #f3f4f6);
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: var(--color-primary, #3b82f6);
  transition: width 0.2s;
}

.progress-label {
  position: absolute;
  right: 0;
  top: -18px;
  font-size: 0.75rem;
  color: var(--text-muted);
}

/* Input de nombre */
.doc-name-input {
  width: 100%;
  padding: 8px 10px;
  font-size: 0.9rem;
  border: 1px solid var(--border-color);
  border-radius: 5px;
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #111);
  display: block;
  box-sizing: border-box;
}
.doc-name-input:focus {
  outline: none;
  border-color: var(--color-primary, #3b82f6);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary, #3b82f6) 20%, transparent);
}
.doc-name-input:disabled { opacity: 0.6; cursor: not-allowed; }

/* Utilitarios mínimos (compatibles con los que ya usa el proyecto) */
.hidden { display: none; }
.font-bold { font-weight: 600; }
.btn-xs { padding: 3px 8px; font-size: 0.78rem; }
.btn-danger { background: #ef4444; color: #fff; border: none; }
.btn-danger:hover { background: #dc2626; }
</style>
