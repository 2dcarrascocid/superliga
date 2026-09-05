<template>
  <section class="pd-dash">
    <div class="pd-dash__glow pd-dash__glow--green" aria-hidden="true"></div>
    <div class="pd-dash__glow pd-dash__glow--blue" aria-hidden="true"></div>

    <div v-if="subTabs.length" class="pd-tabs" role="tablist">
      <component
        :is="tab.path ? 'router-link' : 'button'"
        v-for="tab in subTabs"
        :key="tab.key"
        :to="tab.path"
        :type="tab.path ? undefined : 'button'"
        role="tab"
        class="pd-tabs__item"
        :class="{ 'pd-tabs__item--active': activeSubTab === tab.key }"
        :aria-selected="activeSubTab === tab.key"
        @click="!tab.path && $emit('sub-tab-change', tab.key)"
      >
        {{ tab.label }}
      </component>
    </div>

    <div class="pd-dash__head">
      <span class="pd-dash__kicker">{{ kicker }}</span>
      <h3 class="pd-dash__title">
        {{ titleStart }} <span class="pd-dash__title-accent">{{ titleAccent }}</span>
      </h3>
      <p v-if="description" class="pd-dash__desc">{{ description }}</p>
    </div>

    <div v-if="tiles.length" class="pd-dash__grid">
      <component
        :is="tile.to ? 'router-link' : 'article'"
        v-for="tile in tiles"
        :key="tile.key"
        :to="tile.to"
        class="pd-tile"
        :class="[`pd-tile--${tile.color}`, { 'pd-tile--selected': selectedKey === tile.key }]"
        :role="tile.to ? undefined : 'button'"
        :tabindex="tile.to ? undefined : 0"
        @click="!tile.to && $emit('select', tile.key)"
        @keyup.enter="!tile.to && $emit('select', tile.key)"
      >
        <div class="pd-tile__icon" v-html="tile.icon"></div>
        <div class="pd-tile__body">
          <span class="pd-tile__label">{{ tile.label }}</span>
          <strong class="pd-tile__value">{{ tile.value }}</strong>
          <span v-if="tile.meta" class="pd-tile__trend">{{ tile.meta }}</span>
        </div>
      </component>
    </div>
  </section>
</template>

<script setup>
/**
 * Dashboard "Panorama de X" — hero con glow + grid de tarjetas (pd-tile).
 * Extraído de ClubsList.vue ("Panorama de clubes") para reusar el mismo
 * patrón visual en cualquier vista con indicadores propios.
 *
 * Cada tile es o bien un FILTRO local (sin `to`: click emite 'select' con
 * `tile.key`, quien lo use decide qué mostrar debajo) o un LINK de
 * navegación (con `to`: navega como <router-link>, no emite 'select'). Los
 * indicadores de un Panorama son, por regla general, un resumen de la
 * pantalla actual — `to` queda reservado para menús de navegación reales
 * (p.ej. el submenú de TournamentDetail.vue), no para KPIs.
 *
 * `subTabs` agrega, opcionalmente, el mismo selector tipo píldora usado en
 * /players (Jugadores / Jugadores Inactivos / Traspasos) arriba del título:
 * permite que un mismo Panorama tenga varias "perspectivas" (cada una con su
 * propio kicker/título/descripción/tiles, definidos por quien usa el
 * componente) sin salir de la pantalla. Cada sub-tab es o bien un botón local
 * (sin `path`: click emite 'sub-tab-change') o un LINK real de navegación
 * (con `path`: navega como <router-link>). `tiles` es opcional — un Panorama
 * puede ser solo un menú (subTabs) sin grilla de KPIs debajo, como el
 * submenú de TournamentDetail.vue (Equipos Inscritos / Ver Fixture / etc.):
 * eso es un MENÚ, no un indicador, y no debe verse como tarjeta de KPI.
 */
defineProps({
  kicker: { type: String, required: true },
  titleStart: { type: String, required: true },
  titleAccent: { type: String, required: true },
  description: { type: String, default: '' },
  // { key, label, value, meta?, color: 'green'|'blue'|'gold'|'red', icon: svgString, to?: routePath }
  tiles: { type: Array, default: () => [] },
  selectedKey: { type: [String, null], default: null },
  // { key, label, path? }[] — pill tabs sobre el título. `path` navega como <router-link>; sin `path` emite 'sub-tab-change'.
  subTabs: { type: Array, default: () => [] },
  activeSubTab: { type: [String, null], default: null },
});
defineEmits(['select', 'sub-tab-change']);
</script>

<style scoped>
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
  cursor: pointer;
  text-decoration: none;
  color: inherit;
  transition: transform var(--transition-fast, 0.15s ease), border-color var(--transition-fast, 0.15s ease);
}

.pd-tile:hover {
  transform: translateY(-3px);
  border-color: var(--pd-accent, var(--color-green-600));
}
.pd-tile:focus-visible {
  outline: 3px solid var(--pd-accent, var(--color-green-600));
  outline-offset: 2px;
}

.pd-tile--selected {
  border-color: var(--pd-accent, var(--color-green-600));
  box-shadow: 0 0 0 1px var(--pd-accent, var(--color-green-600));
}

.pd-tile--green { --pd-accent: var(--color-green-600, #00e676); }
.pd-tile--blue  { --pd-accent: var(--color-blue-500, #4fc3f7); }
.pd-tile--gold  { --pd-accent: var(--color-gold, #ffd54f); }
.pd-tile--red   { --pd-accent: var(--color-danger, #ef5350); }

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
  color: var(--text-muted);
}
</style>
