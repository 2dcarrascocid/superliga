<template>
  <div class="container mt-md">
    <div class="flex justify-between items-center mb-lg">
      <h2>Jugadores</h2>
    </div>

    <section class="pd-dash">
      <div class="pd-dash__glow pd-dash__glow--green" aria-hidden="true"></div>
      <div class="pd-dash__glow pd-dash__glow--blue" aria-hidden="true"></div>

      <div class="pd-tabs" role="tablist">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          role="tab"
          class="pd-tabs__item"
          :class="{ 'pd-tabs__item--active': activeTab === tab.key }"
          :aria-selected="activeTab === tab.key"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>

      <div class="pd-dash__head">
        <span class="pd-dash__kicker">{{ currentMeta.kicker }}</span>
        <h3 class="pd-dash__title">
          {{ currentMeta.titlePrefix }} <span class="pd-dash__title-accent">{{ currentMeta.titleAccent }}</span>
        </h3>
        <p class="pd-dash__desc">{{ currentMeta.desc }}</p>
      </div>

      <div class="pd-dash__grid">
        <article
          v-for="tile in dashboardTiles"
          :key="tile.key"
          class="pd-tile"
          :class="[`pd-tile--${tile.color}`, { 'pd-tile--selected': selectedTileKey === tile.key }]"
          role="button"
          tabindex="0"
          @click="selectTile(tile.key)"
          @keyup.enter="selectTile(tile.key)"
        >
          <div class="pd-tile__icon" v-html="tile.icon"></div>
          <div class="pd-tile__body">
            <span class="pd-tile__label">{{ tile.label }}</span>
            <strong class="pd-tile__value">{{ tile.value }}</strong>
            <span class="pd-tile__trend" :class="tile.trend >= 0 ? 'pd-tile__trend--up' : 'pd-tile__trend--down'">
              {{ tile.trend >= 0 ? '▲' : '▼' }} {{ Math.abs(tile.trend) }}% · {{ tile.meta }}
            </span>
          </div>
        </article>
      </div>
    </section>

    <!-- Tabla paginada, según el tile seleccionado -->
    <section class="card mt-lg p-0 overflow-hidden">
      <div class="flex justify-between items-center p-md" style="border-bottom: 1px solid var(--border-color);">
        <h3 class="m-0">{{ selectedTileLabel }}</h3>
        <span v-if="isPlayersTable" class="text-muted text-sm">
          {{ meta.total_registros }} en total
        </span>
      </div>

      <div v-if="error" class="alert alert-error m-md">
        {{ error }}
      </div>

      <template v-if="isPlayersTable">
        <div v-if="loading && items.length === 0" class="text-center py-lg">
          Cargando jugadores...
        </div>
        <div v-else-if="items.length === 0" class="text-center py-lg text-muted">
          No hay jugadores registrados.
        </div>
        <div v-else class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Foto</th>
                <th>Nombre</th>
                <th>Folio</th>
                <th>Club</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="player in items"
                :key="player.id"
                class="table-row-clickable"
                @click="goToDetail(player.id)"
              >
                <td>
                  <div class="avatar-small">
                    <img :src="player.photo_url || '/placeholder-player.svg'" alt="Foto" class="avatar-img" />
                  </div>
                </td>
                <td>{{ player.first_name }} {{ player.last_name }}</td>
                <td>{{ formatFolio({ clubFolio: player.club_folio, clubFolioDisplay: player.club_folio_display, birthDate: player.birth_date }) ?? '—' }}</td>
                <td>{{ player.club_name || 'Sin club' }}</td>
                <td>
                  <span class="badge" :class="statusClass(player.status)">
                    {{ statusLabel(player.status) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="flex justify-between items-center p-md" style="border-top: 1px solid var(--border-color);" v-if="items.length > 0">
          <span class="text-muted text-sm">Página {{ pageIndex + 1 }}</span>
          <div class="flex gap-sm">
            <button class="btn btn-secondary btn-sm" :disabled="pageIndex === 0 || loading" @click="goPrev">
              Anterior
            </button>
            <button class="btn btn-secondary btn-sm" :disabled="!meta.next_token || loading" @click="goNext">
              Siguiente
            </button>
          </div>
        </div>
      </template>

      <div v-else class="text-center py-lg text-muted">
        Esta vista aún no está disponible: el backend todavía no expone estos datos.
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { usePlayersStore } from '../stores/players';
import { useAuthStore } from '../stores/auth';
import { formatFolio } from '../utils/folio.js';

const router = useRouter();
const { items, loading, error, meta, fetchActivePlayersByOrg, fetchInactivePlayersByOrg } = usePlayersStore();
const { state: authState } = useAuthStore();

const icons = {
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  transfer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
  card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="2"/></svg>',
  userPlus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/></svg>',
  userMinus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M23 11h-6"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  checkCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  xCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
};

const tabs = [
  { key: 'jugadores', label: 'Jugadores' },
  { key: 'inactivos', label: 'Jugadores Inactivos' },
  { key: 'traspasos', label: 'Traspasos' },
];
const activeTab = ref('jugadores');

const tabMeta = {
  jugadores: {
    kicker: 'Resumen de la liga',
    titlePrefix: 'Panorama de',
    titleAccent: 'jugadores',
    desc: 'Estado general del plantel de la organización, actualizado en vivo.',
  },
  inactivos: {
    kicker: 'Seguimiento disciplinario',
    titlePrefix: 'Jugadores',
    titleAccent: 'inactivos',
    desc: 'Expulsados, suspendidos y lesionados fuera de competencia.',
  },
  traspasos: {
    kicker: 'Mercado de pases',
    titlePrefix: 'Estado de',
    titleAccent: 'traspasos',
    desc: 'Movimientos de jugadores entre clubes de la liga.',
  },
};
const currentMeta = computed(() => tabMeta[activeTab.value]);

// Mock: traspasos, expulsados, tarjetas, suspensiones y lesiones aún no se registran en el backend.
const tileSets = computed(() => ({
  jugadores: [
    { key: 'total', label: 'Jugadores de la liga', value: meta.value?.total_registros || 0, meta: 'total registrados', color: 'blue', trend: 4, icon: icons.users },
    { key: 'newPlayers', label: 'Jugadores nuevos', value: 9, meta: 'últimos 30 días', color: 'green', trend: 18, icon: icons.userPlus },
    { key: 'removed', label: 'Eliminados', value: 3, meta: 'últimos 30 días', color: 'red', trend: -5, icon: icons.userMinus },
    { key: 'yellowCards', label: 'Tarjeta amarilla', value: 14, meta: 'amonestados', color: 'gold', trend: 6, icon: icons.card },
  ],
  inactivos: [
    { key: 'totalInactive', label: 'Jugadores inactivos', value: meta.value?.total_registros || 0, meta: 'total actual', color: 'red', trend: -3, icon: icons.userMinus },
    { key: 'expelled', label: 'Expulsados', value: 2, meta: 'tarjeta roja', color: 'red', trend: -8, icon: icons.card },
    { key: 'suspended', label: 'Suspendidos', value: 5, meta: 'por acumulación', color: 'gold', trend: 2, icon: icons.alert },
    { key: 'injured', label: 'Lesionados', value: 4, meta: 'baja médica', color: 'blue', trend: 1, icon: icons.alert },
  ],
  traspasos: [
    { key: 'totalTransfers', label: 'Traspasos', value: 6, meta: 'últimos 30 días', color: 'gold', trend: 12, icon: icons.transfer },
    { key: 'pending', label: 'Pendientes', value: 2, meta: 'en revisión', color: 'blue', trend: 0, icon: icons.clock },
    { key: 'approved', label: 'Aprobados', value: 3, meta: 'este mes', color: 'green', trend: 9, icon: icons.checkCircle },
    { key: 'rejected', label: 'Rechazados', value: 1, meta: 'este mes', color: 'red', trend: -2, icon: icons.xCircle },
  ],
}));

const dashboardTiles = computed(() => tileSets.value[activeTab.value]);

// Selección del tile: determina qué carga la tabla de abajo.
// Solo "Jugadores de la liga" (tab jugadores, tile total) tiene datos reales hoy;
// el resto de los tiles son mock (ver comentario más arriba) y muestran un estado "no disponible".
const selectedTileKey = ref('total');

const selectedTileLabel = computed(() => {
  const tile = dashboardTiles.value.find(t => t.key === selectedTileKey.value);
  return tile ? tile.label : '';
});

// Tiles respaldados por datos reales del backend: tab + tile -> función de carga.
const tableFetchers = {
  jugadores: { total: fetchActivePlayersByOrg },
  inactivos: { totalInactive: fetchInactivePlayersByOrg },
};

const isPlayersTable = computed(() => !!tableFetchers[activeTab.value]?.[selectedTileKey.value]);

// Paginación por cursor: guardamos los next_token ya vistos para poder retroceder.
const pageTokens = ref([null]);
const pageIndex = ref(0);

const loadPlayers = async () => {
  const orgId = authState.org?.id;
  const fetcher = tableFetchers[activeTab.value]?.[selectedTileKey.value];
  if (!orgId || !fetcher) return;
  await fetcher(orgId, { next_token: pageTokens.value[pageIndex.value] || undefined });
};

const goToPage = async (index) => {
  pageIndex.value = index;
  await loadPlayers();
};

const goNext = () => {
  if (!meta.value.next_token) return;
  if (pageTokens.value.length === pageIndex.value + 1) {
    pageTokens.value.push(meta.value.next_token);
  }
  goToPage(pageIndex.value + 1);
};

const goPrev = () => {
  if (pageIndex.value === 0) return;
  goToPage(pageIndex.value - 1);
};

const selectTile = (key) => {
  selectedTileKey.value = key;
  if (tableFetchers[activeTab.value]?.[key]) {
    pageTokens.value = [null];
    pageIndex.value = 0;
    loadPlayers();
  }
};

const goToDetail = (id) => {
  router.push(`/players/${id}`);
};

const statusMeta = {
  ACTIVE:   { label: 'Activo',    class: 'status-active' },
  INACTIVE: { label: 'Inactivo',  class: 'status-inactive' },
  LOAN:     { label: 'Préstamo',  class: 'status-loan' },
};

const statusClass = (status) => statusMeta[status]?.class || 'status-inactive';
const statusLabel = (status) => statusMeta[status]?.label || status || 'Sin estado';

// Al cambiar de tab, seleccionamos su primer tile por defecto.
watch(activeTab, () => {
  selectTile(dashboardTiles.value[0].key);
});

onMounted(() => {
  loadPlayers();
});
</script>

<style scoped>
/* ── Dashboard (estilo landing) ── */
.pd-dash {
  position: relative;
  overflow: hidden;
  background: var(--surface-card, #14151d);
  border: 1px solid var(--border-subtle, #23252f);
  border-radius: var(--border-radius-lg, 16px);
  padding: 2rem 1.5rem;
}

.pd-dash__glow {
  position: absolute;
  width: 360px;
  height: 360px;
  border-radius: 50%;
  filter: blur(110px);
  opacity: 0.2;
  pointer-events: none;
  z-index: 0;
}
.pd-dash__glow--green { top: -140px; left: -100px; background: var(--color-green-600, #00e676); }
.pd-dash__glow--blue  { bottom: -160px; right: -100px; background: var(--color-blue-500, #4fc3f7); }

.pd-tabs {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 1.75rem;
}

.pd-tabs__item {
  padding: 0.5rem 1.1rem;
  border-radius: var(--border-radius-full, 9999px);
  border: 1px solid var(--border-subtle);
  background: var(--bg-tertiary, rgba(255,255,255,0.03));
  color: var(--text-muted);
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all var(--transition-fast, 0.15s ease);
}

.pd-tabs__item:hover {
  color: var(--text-primary);
  border-color: var(--color-blue-500, #4fc3f7);
}

.pd-tabs__item--active {
  color: #04120a;
  border-color: transparent;
  background: linear-gradient(135deg, var(--color-green-600, #00e676), var(--color-blue-500, #4fc3f7));
}

.pd-dash__head {
  position: relative;
  z-index: 1;
  text-align: center;
  max-width: 520px;
  margin: 0 auto 1.75rem;
}

.pd-dash__kicker {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-blue-500, #4fc3f7);
  margin-bottom: 0.5rem;
}

.pd-dash__title {
  font-size: clamp(1.4rem, 3vw, 1.9rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0 0 0.5rem;
}

.pd-dash__title-accent {
  background: linear-gradient(135deg, var(--color-green-600, #00e676), var(--color-blue-500, #4fc3f7));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.pd-dash__desc {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.pd-dash__grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.pd-tile {
  display: flex;
  align-items: flex-start;
  gap: 0.9rem;
  background: var(--bg-tertiary, rgba(255,255,255,0.03));
  border: 1px solid var(--border-subtle);
  border-radius: var(--border-radius-md, 12px);
  padding: 1.1rem;
  transition: transform var(--transition-fast, 0.15s ease), border-color var(--transition-fast, 0.15s ease);
}

.pd-tile:hover {
  transform: translateY(-3px);
  border-color: var(--pd-accent, var(--color-green-600));
}

.pd-tile--green { --pd-accent: var(--color-green-600, #00e676); }
.pd-tile--blue  { --pd-accent: var(--color-blue-500, #4fc3f7); }
.pd-tile--gold  { --pd-accent: var(--color-gold, #ffd54f); }
.pd-tile--red   { --pd-accent: var(--color-danger, #ef5350); }

.pd-tile { cursor: pointer; }
.pd-tile--selected {
  border-color: var(--pd-accent, var(--color-green-600));
  box-shadow: 0 0 0 1px var(--pd-accent, var(--color-green-600));
}

.pd-tile__icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--pd-accent) 16%, transparent);
  color: var(--pd-accent);
}

.pd-tile__icon :deep(svg) {
  width: 20px;
  height: 20px;
}

.pd-tile__body {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.pd-tile__label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

.pd-tile__value {
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  line-height: 1.2;
}

.pd-tile__trend {
  font-size: 0.72rem;
  font-weight: 700;
}

.pd-tile__trend--up   { color: var(--color-green-500, #33ec8e); }
.pd-tile__trend--down { color: var(--color-danger, #ef5350); }

.table-row-clickable { cursor: pointer; }
.table-row-clickable:hover { background: var(--bg-tertiary, rgba(255,255,255,0.03)); }

.status-active {
  background: rgba(16, 185, 129, 0.15);
  color: #6ee7b7;
}

.status-inactive {
  background: rgba(148, 163, 184, 0.2);
  color: #cbd5e1;
}

.status-loan {
  background: rgba(59, 130, 246, 0.2);
  color: #93c5fd;
}
</style>

