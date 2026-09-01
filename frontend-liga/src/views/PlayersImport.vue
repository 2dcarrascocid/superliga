<template>
  <div class="import-page">

    <!-- Header -->
    <div class="page-header">
      <button class="btn-back" @click="$router.back()">← Volver</button>
      <div>
        <h1 class="page-title">Importar Jugadores</h1>
        <p class="page-subtitle">Carga masiva desde Excel — Club: <strong>{{ clubId }}</strong></p>
      </div>
    </div>

    <!-- FASE 1: Upload -->
    <div v-if="phase === 'upload'" class="card">
      <h2 class="section-title">Selecciona el archivo Excel</h2>
      <p class="hint">
        Formato esperado: <code>FOLIO · RUT · NOMBRE · FECHA NAC · CELULAR</code>
        <span v-if="clubConfig">
          — Rango de folios permitido:
          <strong>{{ clubConfig.folio_start ?? 1 }} – {{ clubConfig.folio_end ?? 70 }}</strong>
        </span>
      </p>

      <div
        class="dropzone"
        :class="{ 'is-dragover': isDragging, 'is-error': uploadError }"
        @dragenter.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @dragover.prevent
        @drop.prevent="onDrop"
        @click="fileInput.click()"
      >
        <span class="dropzone-icon">📂</span>
        <p class="dropzone-text">Arrastra tu archivo aquí o <u>haz click para seleccionar</u></p>
        <p class="dropzone-hint">Archivos .xlsx · .xls</p>
        <input
          ref="fileInput"
          type="file"
          accept=".xlsx,.xls"
          hidden
          @change="onFileSelected"
        />
      </div>

      <p v-if="uploadError" class="error-msg">{{ uploadError }}</p>
    </div>

    <!-- FASE 2: Preview -->
    <div v-if="phase === 'preview'" class="card">
      <div class="preview-header">
        <div>
          <h2 class="section-title">Previsualización</h2>
          <p class="hint">
            <span class="badge badge-valid">{{ validCount }} válidos</span>
            <span class="badge badge-invalid">{{ invalidCount }} con errores</span>
            <span class="badge badge-total">{{ rows.length }} total</span>
          </p>
        </div>
        <div class="preview-actions">
          <button class="btn btn-secondary" @click="reset">Cambiar archivo</button>
          <button
            class="btn btn-primary"
            :disabled="validCount === 0"
            @click="startImport"
          >
            Importar {{ validCount }} jugadores
          </button>
        </div>
      </div>

      <div class="table-wrapper">
        <table class="preview-table">
          <thead>
            <tr>
              <th>Fila</th>
              <th>FOLIO</th>
              <th>RUT</th>
              <th>NOMBRE (celda original)</th>
              <th>Nombres</th>
              <th>Apellidos</th>
              <th>FECHA NAC</th>
              <th>CELULAR</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in rows"
              :key="row._rowNum"
              :class="`row-${row._status}`"
            >
              <td class="col-num">{{ row._rowNum }}</td>
              <td>{{ row._raw.folio }}</td>
              <td>{{ row._raw.rut }}</td>
              <td class="col-raw-nombre">{{ row._raw.nombre }}</td>
              <td>{{ row.firstName }}</td>
              <td>{{ row.lastName }}</td>
              <td>{{ row._raw.fechaNac }}</td>
              <td>{{ row._raw.celular }}</td>
              <td class="col-status">
                <span v-if="row._status === 'pending'"   class="status-badge pending">Pendiente</span>
                <span v-if="row._status === 'invalid'"   class="status-badge invalid" :title="row._errors.join(', ')">⚠ {{ row._errors.join(', ') }}</span>
                <span v-if="row._status === 'importing'" class="status-badge importing">⏳ Importando…</span>
                <span v-if="row._status === 'success'"   class="status-badge success">✓ OK</span>
                <span v-if="row._status === 'error'"     class="status-badge error" :title="row._importError">✗ {{ row._importError }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- FASE 3: Importando (barra de progreso) -->
    <div v-if="phase === 'importing'" class="card card-progress">
      <h2 class="section-title">Importando jugadores…</h2>
      <div class="progress-bar-track">
        <div class="progress-bar-fill" :style="{ width: progressPct + '%' }"></div>
      </div>
      <p class="progress-label">{{ doneCount }} / {{ rows.length }} procesados</p>

      <div class="table-wrapper">
        <table class="preview-table">
          <thead>
            <tr>
              <th>Fila</th>
              <th>RUT</th>
              <th>Nombre</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row._rowNum" :class="`row-${row._status}`">
              <td class="col-num">{{ row._rowNum }}</td>
              <td>{{ row._raw.rut }}</td>
              <td>{{ row._raw.nombre }}</td>
              <td class="col-status">
                <span v-if="row._status === 'pending'"   class="status-badge pending">En espera</span>
                <span v-if="row._status === 'invalid'"   class="status-badge invalid">Omitido</span>
                <span v-if="row._status === 'importing'" class="status-badge importing">⏳ Procesando…</span>
                <span v-if="row._status === 'success'"   class="status-badge success">✓ OK</span>
                <span v-if="row._status === 'error'"     class="status-badge error" :title="row._importError">✗ Error</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- FASE 4: Resultado final -->
    <div v-if="phase === 'done'" class="card">
      <div class="result-header">
        <span class="result-icon">{{ result.errors === 0 ? '🎉' : '⚠️' }}</span>
        <h2 class="section-title">Importación completada</h2>
      </div>

      <div class="result-summary">
        <div class="result-stat success">
          <span class="stat-num">{{ result.success }}</span>
          <span class="stat-label">Importados correctamente</span>
        </div>
        <div class="result-stat error">
          <span class="stat-num">{{ result.errors }}</span>
          <span class="stat-label">Con errores</span>
        </div>
      </div>

      <div class="result-actions">
        <button class="btn btn-secondary" @click="reset">Nueva importación</button>
        <button class="btn btn-primary" @click="$router.back()">Volver al club</button>
      </div>

      <!-- Detalle de errores -->
      <div v-if="errorRows.length > 0" class="error-detail">
        <h3>Filas con error</h3>
        <table class="preview-table">
          <thead>
            <tr><th>Fila</th><th>RUT</th><th>Nombre</th><th>Error</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in errorRows" :key="row._rowNum" class="row-error">
              <td>{{ row._rowNum }}</td>
              <td>{{ row._raw.rut }}</td>
              <td>{{ row._raw.nombre }}</td>
              <td>{{ row._importError || row._errors.join(', ') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useNotifyStore } from '../stores/notify';
import { parseExcelFile, importPlayers } from '../services/import.service.js';
import { getClubById } from '../services/clubs.service.js';

const route     = useRoute();
const authStore = useAuthStore();
const { notifyError } = useNotifyStore();

const clubId = computed(() => route.params.clubId);
const orgId  = computed(() => authStore.state.org?.id);

// Config del club (para validar rango de folios)
const clubConfig = ref(null);

// Estado de la UI
const phase       = ref('upload');   // upload | preview | importing | done
const isDragging  = ref(false);
const uploadError = ref('');
const fileInput   = ref(null);
const rows        = ref([]);
const result      = ref({ success: 0, errors: 0 });

// Contadores para preview
const validCount   = computed(() => rows.value.filter(r => r._status === 'pending').length);
const invalidCount = computed(() => rows.value.filter(r => r._status === 'invalid').length);
const doneCount    = computed(() => rows.value.filter(r => ['success', 'error', 'invalid'].includes(r._status)).length);
const progressPct  = computed(() => rows.value.length ? Math.round((doneCount.value / rows.value.length) * 100) : 0);
const errorRows    = computed(() => rows.value.filter(r => r._status === 'error' || (r._status === 'invalid' && r._errors.length > 0)));

// Drag & drop
function onDrop(e) {
  isDragging.value = false;
  const file = e.dataTransfer.files[0];
  if (file) processFile(file);
}

function onFileSelected(e) {
  const file = e.target.files[0];
  if (file) processFile(file);
}

async function processFile(file) {
  uploadError.value = '';
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['xlsx', 'xls'].includes(ext)) {
    uploadError.value = 'Solo se aceptan archivos .xlsx o .xls';
    return;
  }
  try {
    rows.value = await parseExcelFile(file, clubConfig.value);
    phase.value = 'preview';
  } catch (err) {
    uploadError.value = err.message;
  }
}

async function startImport() {
  if (!orgId.value) {
    notifyError('No se encontró el ID de la organización. Recarga la página.');
    return;
  }
  phase.value = 'importing';

  const { success, errors } = await importPlayers(
    rows.value,
    clubId.value,
    orgId.value,
    (updated) => { rows.value = updated; }
  );

  result.value = { success, errors };
  phase.value = 'done';
}

function reset() {
  phase.value  = 'upload';
  rows.value   = [];
  uploadError.value = '';
  if (fileInput.value) fileInput.value.value = '';
}

onMounted(async () => {
  try {
    const res = await getClubById(clubId.value);
    clubConfig.value = res.data?.data ?? res.data ?? null;
  } catch (e) {
    console.error('[PlayersImport] getClubById error:', e);
  }
});
</script>

<style scoped>
.import-page {
  max-width: 960px;
  margin: 0 auto;
  padding: var(--spacing-xl);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

/* ── Header ──────────────────────────────────────────────────────────────── */
.page-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
}
.btn-back {
  background: none;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-base);
  white-space: nowrap;
}
.btn-back:hover { background: var(--bg-hover); color: var(--text-primary); }
.page-title    { font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0; }
.page-subtitle { color: var(--text-muted); margin: 0.25rem 0 0; font-size: 0.9rem; }

/* ── Card ────────────────────────────────────────────────────────────────── */
.card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
}
.section-title { font-size: 1.15rem; font-weight: 600; color: var(--text-primary); margin: 0 0 var(--spacing-sm); }
.hint { color: var(--text-muted); font-size: 0.875rem; margin: 0 0 var(--spacing-lg); }
.hint code {
  background: var(--bg-tertiary);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  color: var(--primary-light);
}

/* ── Dropzone ────────────────────────────────────────────────────────────── */
.dropzone {
  border: 2px dashed var(--border-color);
  border-radius: var(--radius-lg);
  padding: 3rem 2rem;
  text-align: center;
  cursor: pointer;
  transition: all var(--transition-base);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
}
.dropzone:hover,
.dropzone.is-dragover {
  border-color: var(--primary-light);
  background: rgba(102, 126, 234, 0.05);
}
.dropzone.is-error { border-color: var(--accent-red); }
.dropzone-icon  { font-size: 3rem; }
.dropzone-text  { color: var(--text-secondary); font-size: 0.95rem; margin: 0; }
.dropzone-text u { color: var(--primary-light); cursor: pointer; }
.dropzone-hint  { color: var(--text-muted); font-size: 0.8rem; margin: 0; }
.error-msg { color: var(--accent-red); font-size: 0.875rem; margin-top: var(--spacing-sm); }

/* ── Preview header ──────────────────────────────────────────────────────── */
.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}
.preview-actions { display: flex; gap: var(--spacing-sm); align-items: center; }

.badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: var(--radius-full);
  font-size: 0.78rem;
  font-weight: 600;
  margin-right: var(--spacing-xs);
}
.badge-valid   { background: rgba(16,185,129,0.15); color: #10b981; }
.badge-invalid { background: rgba(239,68,68,0.15);  color: #ef4444; }
.badge-total   { background: var(--bg-tertiary);    color: var(--text-muted); }

/* ── Buttons ─────────────────────────────────────────────────────────────── */
.btn {
  padding: 0.5rem 1.25rem;
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  border: none;
  transition: all var(--transition-base);
}
.btn-primary  { background: var(--primary-gradient); color: var(--primary-ink); }
.btn-primary:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
.btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-secondary { background: var(--bg-tertiary); color: var(--text-secondary); border: 1px solid var(--border-color); }
.btn-secondary:hover { background: var(--bg-hover); color: var(--text-primary); }

/* ── Table ───────────────────────────────────────────────────────────────── */
.table-wrapper { overflow-x: auto; margin-top: var(--spacing-md); }
.preview-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}
.preview-table th {
  background: var(--bg-tertiary);
  color: var(--text-muted);
  font-weight: 600;
  text-align: left;
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--border-color);
  white-space: nowrap;
}
.preview-table td {
  padding: 0.55rem 0.75rem;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-secondary);
  vertical-align: middle;
}
.col-num { color: var(--text-muted); width: 50px; text-align: center; }
.col-raw-nombre { color: var(--text-muted); font-size: 0.8rem; }
.col-status { min-width: 160px; }

/* Row highlight por estado */
.row-success td { background: rgba(16,185,129,0.05); }
.row-error   td { background: rgba(239,68,68,0.05); }
.row-importing td { background: rgba(102,126,234,0.05); }
.row-invalid td { opacity: 0.55; }

/* ── Status badges ───────────────────────────────────────────────────────── */
.status-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.status-badge.pending   { background: var(--bg-tertiary); color: var(--text-muted); }
.status-badge.invalid   { background: rgba(251,191,36,0.15); color: #f59e0b; }
.status-badge.importing { background: rgba(102,126,234,0.15); color: var(--primary-light); }
.status-badge.success   { background: rgba(16,185,129,0.15); color: #10b981; }
.status-badge.error     { background: rgba(239,68,68,0.15); color: #ef4444; cursor: help; }

/* ── Progress ────────────────────────────────────────────────────────────── */
.progress-bar-track {
  background: var(--bg-tertiary);
  border-radius: var(--radius-full);
  height: 10px;
  margin: var(--spacing-md) 0 var(--spacing-sm);
  overflow: hidden;
}
.progress-bar-fill {
  height: 100%;
  background: var(--primary-gradient);
  border-radius: var(--radius-full);
  transition: width 0.3s ease;
}
.progress-label { color: var(--text-muted); font-size: 0.875rem; margin: 0 0 var(--spacing-lg); }

/* ── Result ──────────────────────────────────────────────────────────────── */
.result-header { display: flex; align-items: center; gap: var(--spacing-md); margin-bottom: var(--spacing-lg); }
.result-icon   { font-size: 2.5rem; }

.result-summary {
  display: flex;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-xl);
  flex-wrap: wrap;
}
.result-stat {
  flex: 1;
  min-width: 140px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  text-align: center;
  border: 1px solid var(--border-color);
}
.result-stat.success { border-color: rgba(16,185,129,0.3); }
.result-stat.error   { border-color: rgba(239,68,68,0.3); }
.stat-num   { display: block; font-size: 2.5rem; font-weight: 700; color: var(--text-primary); line-height: 1; }
.result-stat.success .stat-num { color: #10b981; }
.result-stat.error   .stat-num { color: #ef4444; }
.stat-label { display: block; font-size: 0.85rem; color: var(--text-muted); margin-top: var(--spacing-xs); }

.result-actions { display: flex; gap: var(--spacing-sm); margin-bottom: var(--spacing-xl); flex-wrap: wrap; }

.error-detail h3 { font-size: 1rem; font-weight: 600; color: var(--text-primary); margin: 0 0 var(--spacing-md); }
</style>
