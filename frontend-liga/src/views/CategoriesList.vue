<template>
  <div class="container mt-md">
    <div class="flex justify-between items-center mb-lg">
      <h2>Categorías</h2>
      <button class="btn" :class="viewMode === 'list' ? 'btn-primary' : 'btn-secondary'" @click="toggleViewMode">
        {{ viewMode === 'list' ? 'Nueva Categoría' : 'Volver al listado' }}
      </button>
    </div>

    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <!-- Formulario -->
    <div v-if="viewMode === 'form'" class="mb-lg card">
      <h3 class="mb-md">{{ form.id ? 'Editar Categoría' : 'Nueva Categoría' }}</h3>
      <form @submit.prevent="saveCategory">
        <div class="form-row-2">
          <div class="input-group">
            <label class="label">Nombre de la categoría *</label>
            <input v-model="form.name" class="input" placeholder="Ej: Senior Damas Todo Competidor" required />
          </div>
          <div class="input-group">
            <label class="label">Tipo de deporte *</label>
            <select v-model="form.sport_id" class="input" required>
              <option :value="null" disabled>Seleccione...</option>
              <option v-for="s in sports" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </div>
        </div>

        <div class="form-row-3">
          <div class="input-group">
            <label class="label">Serie *</label>
            <input v-model="form.serie" class="input" placeholder="Ej: Todo Competidor, Senior, Súper Senior" required />
          </div>
          <div class="input-group">
            <label class="label">Género *</label>
            <select v-model="form.gender" class="input" required>
              <option value="MASCULINO">Masculino</option>
              <option value="FEMENINO">Femenino</option>
              <option value="MIXTO">Mixto</option>
            </select>
          </div>
          <div class="input-group">
            <label class="label">Color</label>
            <input v-model="form.color" type="color" class="input" style="height: 40px; padding: 4px;" />
          </div>
        </div>

        <div class="form-row-2">
          <div class="input-group">
            <label class="label">Edad mínima *</label>
            <input v-model.number="form.age_from" type="number" min="0" class="input" required />
            <p class="input-hint">0 si la categoría no tiene piso de edad.</p>
          </div>
          <div class="input-group">
            <label class="label">Edad máxima *</label>
            <input v-model.number="form.age_to" type="number" min="0" class="input" required />
            <p class="input-hint">0 si la categoría no tiene techo de edad.</p>
          </div>
        </div>

        <div class="input-group">
          <label class="label">Descripción</label>
          <textarea v-model="form.description" class="input" rows="2" />
        </div>

        <div class="flex justify-between items-center mt-md">
          <span class="text-muted text-sm">* Campos requeridos</span>
          <div class="flex gap-sm">
            <button type="button" class="btn btn-secondary" @click="cancelForm">Cancelar</button>
            <button type="submit" class="btn btn-primary" :disabled="loading">
              {{ loading ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>
        </div>
      </form>
    </div>

    <!-- Listado -->
    <template v-if="viewMode === 'list'">
      <div class="card p-0">
        <div class="flex justify-between items-center p-md" style="border-bottom: 1px solid var(--border-color);">
          <h3 class="m-0">Todas las categorías</h3>
          <span class="text-muted text-sm">{{ items.length }} en total</span>
        </div>

        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Deporte</th>
                <th>Serie</th>
                <th class="text-center">Género</th>
                <th class="text-center">Edad</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading && items.length === 0">
                <td colspan="6" class="text-center py-lg">Cargando...</td>
              </tr>
              <tr v-else-if="items.length === 0">
                <td colspan="6" class="text-center py-lg">Aún no hay categorías creadas.</td>
              </tr>
              <tr v-for="cat in items" :key="cat.id">
                <td>
                  <span class="color-dot" :style="{ backgroundColor: cat.color || '#6366f1' }"></span>
                  <span class="font-medium">{{ cat.name }}</span>
                </td>
                <td>{{ cat.sport?.name || '—' }}</td>
                <td>{{ cat.serie || '—' }}</td>
                <td class="text-center">{{ GENDER_LABELS[cat.gender] || '—' }}</td>
                <td class="text-center">{{ cat.age_from ?? 0 }} – {{ cat.age_to ?? 0 }}</td>
                <td>
                  <div class="flex gap-sm">
                    <button class="btn btn-sm btn-secondary" @click="startEdit(cat)">Editar</button>
                    <button class="btn btn-sm btn-danger" @click="confirmDelete(cat)">Eliminar</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useNotifyStore } from '../stores/notify';
import {
  listSports, listCategoriesByOrg, createCategoryForOrg, updateCategoryById, deleteCategoryById,
} from '../services/categories.service.js';

const authStore = useAuthStore();
const { confirm, notifySuccess, notifyError } = useNotifyStore();

const viewMode = ref('list');
const items = ref([]);
const sports = ref([]);
const loading = ref(false);
const error = ref(null);

const GENDER_LABELS = { MASCULINO: 'Masculino', FEMENINO: 'Femenino', MIXTO: 'Mixto' };

const defaultForm = () => ({
  id: null,
  name: '',
  sport_id: null,
  serie: '',
  gender: 'MIXTO',
  color: '#6366f1',
  age_from: 0,
  age_to: 0,
  description: '',
});

const form = reactive(defaultForm());

const loadSports = async () => {
  try {
    const res = await listSports();
    sports.value = res.data?.data?.sports ?? res.data?.sports ?? [];
  } catch (e) {
    console.error('[CategoriesList] listSports error:', e);
  }
};

const loadCategories = async () => {
  loading.value = true;
  try {
    const res = await listCategoriesByOrg(authStore.state.org?.id);
    items.value = res.data?.data?.categories ?? res.data?.categories ?? [];
  } catch (e) {
    error.value = e.response?.data?.error?.message || 'Error al cargar las categorías';
  } finally {
    loading.value = false;
  }
};

const toggleViewMode = () => {
  if (viewMode.value === 'list') {
    Object.assign(form, defaultForm());
    viewMode.value = 'form';
  } else {
    cancelForm();
  }
};

const cancelForm = () => {
  Object.assign(form, defaultForm());
  viewMode.value = 'list';
};

const startEdit = (cat) => {
  form.id = cat.id;
  form.name = cat.name;
  form.sport_id = cat.sport_id;
  form.serie = cat.serie ?? '';
  form.gender = cat.gender ?? 'MIXTO';
  form.color = cat.color || '#6366f1';
  form.age_from = cat.age_from ?? 0;
  form.age_to = cat.age_to ?? 0;
  form.description = cat.description ?? '';
  viewMode.value = 'form';
};

const saveCategory = async () => {
  loading.value = true;
  error.value = null;
  const payload = {
    name: form.name,
    sport_id: form.sport_id,
    serie: form.serie,
    gender: form.gender,
    color: form.color,
    age_from: form.age_from,
    age_to: form.age_to,
    description: form.description || null,
  };
  try {
    if (form.id) {
      await updateCategoryById(form.id, payload);
      notifySuccess('Categoría actualizada');
    } else {
      await createCategoryForOrg(authStore.state.org?.id, payload);
      notifySuccess('Categoría creada exitosamente');
    }
    await loadCategories();
    cancelForm();
  } catch (e) {
    error.value = e.response?.data?.error?.message || 'Error al guardar la categoría';
    notifyError(error.value);
  } finally {
    loading.value = false;
  }
};

const confirmDelete = async (cat) => {
  const ok = await confirm({
    title: '¿Eliminar categoría?',
    message: `¿Estás seguro de eliminar la categoría "${cat.name}"?`,
    confirmText: 'Eliminar',
    isDestructive: true,
  });
  if (!ok) return;
  try {
    await deleteCategoryById(cat.id, authStore.state.org?.id);
    notifySuccess('Categoría eliminada exitosamente');
    await loadCategories();
  } catch (e) {
    error.value = e.response?.data?.error?.message || 'Error al eliminar la categoría';
    notifyError(error.value);
  }
};

onMounted(() => {
  loadSports();
  loadCategories();
});
</script>

<style scoped>
.form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
.font-medium { font-weight: 500; }
.p-0 { padding: 0 !important; }
.py-lg { padding-top: var(--spacing-lg); padding-bottom: var(--spacing-lg); }
.btn-sm { padding: 0.4rem 0.8rem; font-size: 0.875rem; }

.color-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 8px;
}
</style>
