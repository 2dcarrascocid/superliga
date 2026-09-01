<template>
  <div class="container mt-md">
    <!-- Header -->
    <div class="flex justify-between items-center mb-lg flex-wrap gap-md">
      <div class="flex items-center gap-md">
         <button class="btn btn-secondary btn-sm" @click="$router.push('/clubs')">
             &larr; Clubes
         </button>
         <h2>Jugadores <span v-if="club"> - {{ club.name }}</span></h2>
         <span v-if="club" class="badge" :class="activeCount >= 70 ? 'badge-danger' : 'badge-success'">
             Activos: {{ activeCount }} / 70
         </span>
      </div>
      <div class="flex gap-md" v-if="activeTab === 'activos'">
        <button
          class="btn btn-secondary"
          @click="$router.push(`/clubs/${clubId}/players/import`)"
        >
          📥 Importar Excel
        </button>
        <button
          class="btn btn-primary"
          @click="$router.push(`/clubs/${clubId}/players/new`)"
        >
          Nuevo Jugador
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs mb-md">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'activos' }"
        @click="switchTab('activos')"
      >
        Jugadores Activos
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'inactivos' }"
        @click="switchTab('inactivos')"
      >
        Jugadores Inactivos
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'administradores' }"
        @click="switchTab('administradores')"
      >
        Administradores
      </button>
    </div>

    <!-- Filters (solo en activos) -->
    <div v-if="activeTab === 'activos'" class="card mb-md p-md flex gap-md flex-wrap items-center">
        <div class="input-group flex-1" style="min-width: 200px;">
            <input
                v-model="filters.q"
                @input="handleSearch"
                placeholder="Buscar por nombre o ID..."
                class="input"
            />
        </div>
        <div class="input-group" style="min-width: 160px;">
            <select v-model="filters.category_id" @change="handleFilter" class="input">
                <option :value="null">Todas las categorías</option>
                <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                    {{ cat.name }}
                </option>
            </select>
        </div>
    </div>

    <div v-if="error" class="alert alert-error mb-md">
      {{ error }}
    </div>

    <!-- Loading -->
    <div v-if="loading && filteredItems.length === 0" class="text-center py-lg">
        Cargando jugadores...
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredItems.length === 0" class="text-center py-lg card">
        <span v-if="activeTab === 'activos'">No hay jugadores activos registrados en este club.</span>
        <span v-else>No hay jugadores inactivos en este club.</span>
    </div>

    <!-- List -->
    <div v-else class="card p-0 overflow-hidden">
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Folio</th>
              <th>Foto</th>
              <th>Nombre</th>
              <th>Categoría</th>
              <th v-if="activeTab === 'inactivos'">Traspasado el</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filteredItems" :key="item.id">
              <td>{{ formatFolio({ clubFolio: item.club_folio, clubFolioDisplay: item.club_folio_display, birthDate: item.player?.birth_date }) ?? '—' }}</td>
              <td>
                <div class="avatar-small">
                  <img :src="item.player?.photo_url || '/placeholder-player.svg'" alt="Foto" class="avatar-img" />
                </div>
              </td>
              <td>{{ item.player?.first_name }} {{ item.player?.last_name }}</td>
              <td>
                <span
                  v-if="getPlayerCategory(item.player?.birth_date)"
                  class="badge"
                  :style="{ backgroundColor: getPlayerCategory(item.player?.birth_date).color, color: '#fff' }"
                >
                  {{ getPlayerCategory(item.player?.birth_date).name }}
                </span>
                <span v-else class="text-muted">—</span>
              </td>
              <td v-if="activeTab === 'inactivos'" class="text-muted text-sm">
                {{ item.valid_to ? new Date(item.valid_to).toLocaleDateString('es-CL') : '—' }}
              </td>
              <td>
                <!-- Activos: Ver + Editar + Desactivar -->
                <div v-if="activeTab === 'activos'" class="flex gap-sm">
                  <button
                    class="btn btn-sm btn-secondary"
                    @click="$router.push(`/players/${item.player_id}`)"
                    title="Ver detalle"
                  >
                    Ver
                  </button>
                  <button
                    class="btn btn-sm btn-secondary"
                    @click="$router.push(`/players/${item.player_id}/edit`)"
                    title="Editar"
                  >
                    Editar
                  </button>
                </div>
                <!-- Inactivos: solo Ver -->
                <div v-else>
                  <button
                    class="btn btn-sm btn-secondary"
                    @click="$router.push(`/players/${item.player_id}`)"
                    title="Ver detalle"
                  >
                    Ver
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

       <!-- Pagination -->
       <div class="pagination-center" v-if="items.length > 0">
           <div class="pagination">
                <button
                    class="btn btn-secondary btn-sm"
                    :disabled="page === 1"
                    @click="changePage(page - 1)"
                >
                    Anterior
                </button>
                 <span class="text-sm mx-md">Página {{ page }}</span>
                <button
                    class="btn btn-secondary btn-sm"
                    :disabled="!meta.next_token"
                    @click="changePage(page + 1)"
                >
                    Siguiente
                </button>
           </div>
       </div>
    </div>

    <!-- TAB: Administradores -->
    <div v-if="activeTab === 'administradores'">
      <div class="card mb-md">
        <h3 class="mb-md">Administradores del Club</h3>
        <div v-if="clubsStore.loading.value" class="text-center py-lg">Cargando...</div>
        <div v-else-if="!clubAdmins.length" class="text-muted text-sm">
          No hay administradores asignados a este club.
        </div>
        <div v-else class="admins-list">
          <div v-for="admin in clubAdmins" :key="admin.user_id" class="admin-item">
            <div class="admin-avatar-sm">{{ (admin.email || '?')[0].toUpperCase() }}</div>
            <div>
              <div class="admin-email">{{ admin.email }}</div>
              <div class="text-muted text-sm">Admin Club</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { usePlayersStore } from '../stores/players';
import { useClubsStore } from '../stores/clubs';
import { listCategories } from '../services/categories.service.js';
import { formatFolio } from '../utils/folio.js';

const route = useRoute();
const playersStore = usePlayersStore();
const clubsStore = useClubsStore();
const clubId = route.params.clubId;

const activeTab = ref('activos');

const filters = ref({
    q: '',
    category_id: null,
});

const page = ref(1);

const club    = clubsStore.current;
const items   = playersStore.items;
const loading = playersStore.loading;
const error   = playersStore.error;
const meta    = playersStore.meta;

const clubAdmins = computed(() => clubsStore.admins?.value ?? []);

const filteredItems = computed(() => {
    if (!Array.isArray(items.value)) return [];
    return items.value.filter(item => {
        if (!item?.id) return false;
        if (activeTab.value === 'activos' && filters.value.category_id) {
            const cat = getPlayerCategory(item.player?.birth_date);
            if (!cat || cat.id !== filters.value.category_id) return false;
        }
        return true;
    });
});

const activeCount = computed(() => {
    if (club.value && club.value.active_players_count !== undefined) {
        return club.value.active_players_count;
    }
    return 0;
});

const categories = ref([]);

const getPlayerCategory = (birthDate) => {
    if (!birthDate || !categories.value.length) return null;
    const age = Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    return categories.value.find(cat => {
        const fromOk = cat.age_from == null || age >= cat.age_from;
        const toOk   = cat.age_to   == null || age <= cat.age_to;
        return fromOk && toOk;
    }) ?? null;
};

const loadData = async () => {
    try {
        await clubsStore.fetchClubById(clubId);
    } catch (e) {
        console.error('[ClubPlayers] fetchClubById error:', e);
    }
    try {
        const res = await listCategories(clubId);
        categories.value = res.data?.data ?? [];
    } catch (e) {
        console.error('[ClubPlayers] listCategories error:', e);
    }
    await fetchPlayers();
};

const fetchPlayers = async () => {
    const status = activeTab.value === 'activos' ? 'ACTIVE' : 'INACTIVE';
    const params = { status, limit: 20 };
    if (activeTab.value === 'activos') {
        if (filters.value.q) params.q = filters.value.q;
    }
    try {
        await playersStore.fetchPlayersByClub(clubId, params);
    } catch (e) {
        console.error('[ClubPlayers] fetchPlayersByClub error:', e?.response?.data || e?.message);
    }
};

const switchTab = async (tab) => {
    activeTab.value = tab;
    page.value = 1;
    filters.value.q = '';
    filters.value.category_id = null;
    if (tab === 'administradores') {
        try {
            await clubsStore.fetchClubAdmins(clubId);
        } catch (e) {
            console.error('[ClubPlayers] fetchClubAdmins error:', e);
        }
    } else {
        await fetchPlayers();
    }
};

const handleSearch = () => {
    page.value = 1;
    fetchPlayers();
};

const handleFilter = () => {
    page.value = 1;
    fetchPlayers();
};

const changePage = (newPage) => {
    page.value = newPage;
    fetchPlayers();
};

onMounted(() => {
    loadData();
});
</script>

<style scoped>
.tabs {
    display: flex;
    border-bottom: 2px solid var(--border-color);
    gap: 0;
}

.tab-btn {
    padding: var(--spacing-sm) var(--spacing-lg);
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    cursor: pointer;
    font-size: 0.95rem;
    color: var(--text-muted);
    transition: color 0.15s, border-color 0.15s;
}

.tab-btn:hover {
    color: var(--text-primary);
}

.tab-btn.active {
    color: var(--primary);
    border-bottom-color: var(--primary);
    font-weight: 600;
}

.avatar-small {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    overflow: hidden;
    background: var(--bg-secondary);
}
.avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}
.pagination-center {
    display: flex;
    justify-content: center;
    padding: var(--spacing-md);
    border-top: 1px solid var(--border-color);
}
</style>
