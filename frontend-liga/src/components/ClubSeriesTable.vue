<template>
  <div class="card">
    <h3 class="mb-md">Series del Club</h3>
    <div class="table-container">
      <table class="table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Categoría</th>
            <th>Edad</th>
            <th>Restricción de año</th>
            <th class="text-center">Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="items.length === 0">
            <td colspan="6" class="text-center py-lg">Este club aún no tiene series creadas.</td>
          </tr>
          <tr
            v-for="series in items"
            :key="series.id"
            :class="{ 'row--selected': selectedSeriesId === series.id }"
          >
            <td class="font-medium">
              {{ series.name }}
              <div v-if="series.description" class="text-muted text-sm">{{ series.description }}</div>
            </td>
            <td>{{ series.category?.name ?? 'Sin categoría' }}</td>
            <td>{{ series.category?.age_from || '—' }}</td>
            <td>{{ series.category ? (series.category.age_restriction ? 'Sí (edad cumplida)' : 'No (por año)') : '—' }}</td>
            <td class="text-center">
              <span class="status-badge" :class="series.active ? 'status-badge--active' : 'status-badge--inactive'">
                {{ series.active ? 'Activa' : 'Inactiva' }}
              </span>
            </td>
            <td class="actions-cell">
              <ActionsMenu>
                <button class="btn btn-sm btn-secondary" @click="$emit('select', series)">
                  {{ selectedSeriesId === series.id ? 'Viendo…' : 'Detalle' }}
                </button>
                <button class="btn btn-sm btn-secondary" @click="$emit('edit', series)">Editar</button>
                <button
                  class="btn btn-sm btn-danger"
                  :disabled="!series.can_delete"
                  :title="deleteReason(series)"
                  @click="$emit('delete', series)"
                >Eliminar</button>
                <span v-if="!series.can_delete" class="delete-reason">
                  Inscrita en {{ series.registration_count }} torneo(s)
                </span>
              </ActionsMenu>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import ActionsMenu from './ActionsMenu.vue';

const deleteReason = (series) => series.can_delete
  ? 'Eliminar serie'
  : `No se puede eliminar: está inscrita en ${series.registration_count} torneo(s)`;

defineProps({
  items: { type: Array, required: true },
  selectedSeriesId: { type: [String, Number], default: null },
});

defineEmits(['select', 'delete', 'edit']);
</script>

<style scoped>
.font-medium { font-weight: 500; }
.py-lg { padding-top: var(--spacing-lg); padding-bottom: var(--spacing-lg); }
.btn-sm { padding: 0.4rem 0.8rem; font-size: 0.875rem; }
.actions-cell { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.delete-reason { width: 100%; color: var(--text-muted); font-size: 0.8125rem; }

/* Rows */
.row--selected { background: rgba(0, 230, 118, 0.08); }

/* Status badges */
.status-badge {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0.2rem 0.6rem; border-radius: var(--radius-full);
  font-size: 0.75rem; font-weight: 700;
}
.status-badge--active   { background: rgba(0, 230, 118, 0.14); color: var(--primary-solid, #00e676); }
.status-badge--inactive { background: rgba(239, 83, 80, 0.14); color: #ef5350; }

.mb-md { margin-bottom: 1rem; }
</style>
