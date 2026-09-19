<template>
  <div class="container mt-md">
    <!-- Header -->
    <div class="flex justify-between items-center mb-lg">
      <h2>Castigos</h2>
    </div>

    <p class="text-muted text-sm mb-lg">
      Catálogo de multas y sanciones. El monto configurado acá se cobra automáticamente al club al registrarse en la Planilla de Control de Partido.
    </p>

    <div v-if="loadError" class="alert alert-error">{{ loadError }}</div>

    <div class="card p-0 mb-lg">
      <div class="flex justify-between items-center p-md" style="border-bottom: 1px solid var(--border-color);">
        <h3 class="m-0">Castigos registrados</h3>
        <span class="text-muted text-sm">{{ penalties.length }} en total</span>
      </div>

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Código</th>
              <th>Monto</th>
              <th>Regla de negocio</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading && !penalties.length">
              <td colspan="6" class="text-center py-lg">Cargando...</td>
            </tr>
            <tr v-for="penalty in penalties" :key="penalty.id">
              <td>{{ penalty.name }}</td>
              <td>{{ penalty.code }}</td>
              <td>{{ formatCurrency(penalty.amount) }}</td>
              <td>{{ penalty.business_rule || '—' }}</td>
              <td>
                <span v-if="penalty.active" class="badge badge-success">Activo</span>
                <span v-else class="badge badge-secondary">Inactivo</span>
              </td>
              <td>
                <div class="table-actions">
                  <button type="button" class="btn btn-secondary btn-sm" @click="handleEditPenalty(penalty)">Editar</button>
                  <button
                    type="button"
                    class="btn btn-danger btn-sm"
                    :disabled="removingPenaltyId === penalty.id"
                    @click="handleRemovePenalty(penalty)"
                  >
                    {{ removingPenaltyId === penalty.id ? 'Eliminando…' : 'Eliminar' }}
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!loading && !penalties.length">
              <td colspan="6" class="text-center text-muted py-lg">Sin castigos registrados.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <form @submit.prevent="submitPenalty">
        <h3 class="mb-md">{{ editingPenaltyId ? 'Editar castigo' : 'Nuevo castigo' }}</h3>
        <div v-if="penaltyFormError" class="alert alert-error" role="alert">{{ penaltyFormError }}</div>
        <div class="form-row-2">
          <div class="input-group">
            <label class="label" for="penalty-name">Nombre</label>
            <input id="penalty-name" v-model.trim="penaltyForm.name" class="input" placeholder="Ej: Tarjeta roja" required />
          </div>
          <div class="input-group">
            <label class="label" for="penalty-code">Código</label>
            <input id="penalty-code" v-model.trim="penaltyForm.code" class="input" placeholder="Ej: RED_CARD" required />
          </div>
          <div class="input-group">
            <label class="label" for="penalty-description">Descripción</label>
            <input id="penalty-description" v-model.trim="penaltyForm.description" class="input" placeholder="Descripción breve" />
          </div>
          <div class="input-group">
            <label class="label" for="penalty-amount">Monto a pagar</label>
            <input id="penalty-amount" v-model.number="penaltyForm.amount" type="number" min="0" class="input" required />
          </div>
        </div>
        <div class="input-group">
          <label class="label" for="penalty-business-rule">Regla de negocio</label>
          <textarea id="penalty-business-rule" v-model.trim="penaltyForm.business_rule" class="input" rows="2" placeholder="Condiciones o criterios de aplicación"></textarea>
        </div>
        <div class="flex justify-end gap-sm mt-md">
          <button v-if="editingPenaltyId" type="button" class="btn btn-secondary" @click="cancelEditPenalty">Cancelar edición</button>
          <button type="submit" class="btn btn-primary" :disabled="savingPenalty">
            {{ savingPenalty ? 'Guardando…' : (editingPenaltyId ? 'Guardar cambios' : 'Crear castigo') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { usePenaltyCatalogStore } from '../stores/penaltyCatalog';

const authStore = useAuthStore();
const penaltyCatalogStore = usePenaltyCatalogStore();

const orgId = computed(() => authStore.state.org?.id);

const loading = computed(() => penaltyCatalogStore.state.loading);
const loadError = ref('');
const penalties = computed(() => penaltyCatalogStore.state.items || []);

const penaltyForm = reactive({ name: '', code: '', description: '', amount: 0, business_rule: '' });
const editingPenaltyId = ref(null);
const savingPenalty = ref(false);
const penaltyFormError = ref('');
const removingPenaltyId = ref(null);

const formatCurrency = (amount) => {
  const num = parseFloat(amount || 0);
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(num);
};

const resetPenaltyForm = () => {
  Object.assign(penaltyForm, { name: '', code: '', description: '', amount: 0, business_rule: '' });
  editingPenaltyId.value = null;
};

const handleEditPenalty = (penalty) => {
  editingPenaltyId.value = penalty.id;
  Object.assign(penaltyForm, {
    name: penalty.name || '',
    code: penalty.code || '',
    description: penalty.description || '',
    amount: penalty.amount ?? 0,
    business_rule: penalty.business_rule || '',
  });
  penaltyFormError.value = '';
};

const cancelEditPenalty = () => {
  resetPenaltyForm();
  penaltyFormError.value = '';
};

const submitPenalty = async () => {
  if (savingPenalty.value) return;
  savingPenalty.value = true;
  penaltyFormError.value = '';
  try {
    const payload = { ...penaltyForm };
    if (editingPenaltyId.value) {
      await penaltyCatalogStore.updatePenalty(editingPenaltyId.value, orgId.value, payload);
    } else {
      await penaltyCatalogStore.createPenalty(orgId.value, payload);
    }
    resetPenaltyForm();
  } catch (error) {
    penaltyFormError.value = error.response?.data?.error?.message || penaltyCatalogStore.state.error || 'No se pudo guardar el castigo.';
  } finally {
    savingPenalty.value = false;
  }
};

const handleRemovePenalty = async (penalty) => {
  const ok = confirm(`¿Eliminar el castigo "${penalty.name}"?`);
  if (!ok) return;
  removingPenaltyId.value = penalty.id;
  try {
    await penaltyCatalogStore.deletePenalty(penalty.id, orgId.value);
    if (editingPenaltyId.value === penalty.id) resetPenaltyForm();
  } catch (error) {
    alert(error.response?.data?.error?.message || penaltyCatalogStore.state.error || 'No se pudo eliminar el castigo.');
  } finally {
    removingPenaltyId.value = null;
  }
};

onMounted(async () => {
  try {
    await penaltyCatalogStore.fetchPenalties(orgId.value);
  } catch (error) {
    loadError.value = penaltyCatalogStore.state.error || 'No se pudo cargar el catálogo de castigos.';
  }
});
</script>

<style scoped>
.form-row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.table-actions { display: flex; gap: var(--spacing-xs, 8px); flex-wrap: wrap; }

.p-0 { padding: 0 !important; }

.py-lg {
  padding-top: var(--spacing-lg);
  padding-bottom: var(--spacing-lg);
}

@media (max-width: 640px) {
  .form-row-2 { grid-template-columns: 1fr; }
}
</style>
