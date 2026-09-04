<template>
  <section class="card tournament-summary" aria-labelledby="tournament-title">
    <div class="tournament-summary__heading">
      <div>
        <p class="tournament-summary__eyebrow">Torneo activo</p>
        <h1 id="tournament-title">{{ tournament.name }}</h1>
        <p class="tournament-summary__description">{{ tournament.description || 'Sin descripción disponible.' }}</p>
      </div>
      <span class="tournament-summary__status">{{ statusLabel(tournament.status) }}</span>
    </div>
    <dl class="tournament-summary__facts">
      <div><dt>Temporada</dt><dd>{{ tournament.season?.name || '—' }}</dd></div>
      <div><dt>Categoría</dt><dd>{{ tournament.category?.name || 'Sin categoría' }}</dd></div>
      <div><dt>Tipo</dt><dd>{{ typeLabel(tournament.type) }}</dd></div>
      <div><dt>Formato</dt><dd>{{ formatLabel(tournament.format) }}</dd></div>
      <div><dt>Inscripción</dt><dd>{{ money(tournament.inscription_fee) }}</dd></div>
    </dl>
  </section>
</template>
<script setup>
defineProps({ tournament: { type: Object, required: true } });
const STATUS = { REGISTRATION: 'Inscripciones abiertas', IN_PROGRESS: 'En curso' };
const TYPE = { OFICIAL: 'Oficial', AMISTOSO: 'Amistoso' };
const FORMAT = { ROUND_ROBIN: 'Todos contra todos', KNOCKOUT: 'Eliminación directa', GROUPS_KNOCKOUT: 'Grupos y eliminación' };
const statusLabel = (value) => STATUS[value] || value || '—';
const typeLabel = (value) => TYPE[value] || value || '—';
const formatLabel = (value) => FORMAT[value] || value || '—';
const money = (value) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value || 0));
</script>
<style scoped>
.tournament-summary { overflow: hidden; border-top: 4px solid var(--primary-solid); }
.tournament-summary__heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }
.tournament-summary__eyebrow { margin: 0 0 4px; color: var(--primary-solid); font-size: .75rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.tournament-summary h1 { margin: 0; font-size: clamp(1.75rem, 4vw, 2.5rem); }
.tournament-summary__description { max-width: 70ch; margin: 10px 0 0; }
.tournament-summary__status { display: inline-flex; flex-shrink: 0; padding: 7px 12px; color: var(--sport-blue); background: var(--info-bg); border-radius: var(--radius-full); font-size: .8125rem; font-weight: 700; }
.tournament-summary__facts { display: grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap: 12px; margin: 24px 0 0; }
.tournament-summary__facts div { padding: 14px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: var(--radius-md); }
.tournament-summary dt { color: var(--text-muted); font-size: .75rem; font-weight: 700; text-transform: uppercase; }
.tournament-summary dd { margin: 4px 0 0; color: var(--text-primary); font-weight: 700; font-variant-numeric: tabular-nums; }
@media (max-width: 800px) { .tournament-summary__facts { grid-template-columns: repeat(2, minmax(0,1fr)); } }
@media (max-width: 520px) { .tournament-summary__heading { flex-direction: column; } .tournament-summary__facts { grid-template-columns: 1fr; } }
</style>
