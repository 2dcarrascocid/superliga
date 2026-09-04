<template>
  <section class="card active-tournaments" aria-labelledby="active-tournaments-title">
    <div class="active-tournaments__header">
      <div>
        <h3 id="active-tournaments-title">Torneos activos</h3>
        <p>Temporada activa: inscripciones abiertas y competencias en curso.</p>
      </div>
      <button class="btn btn-secondary" :disabled="loading" @click="$emit('refresh')">{{ loading ? 'Actualizando…' : 'Actualizar' }}</button>
    </div>

    <div v-if="error" class="alert alert-error" role="alert">{{ error }}</div>
    <p v-if="loading" class="active-tournaments__state" role="status">Cargando torneos…</p>
    <p v-else-if="!sortedTournaments.length" class="active-tournaments__state">No hay torneos activos en este momento.</p>

    <div v-else class="tournament-grid">
      <article
        v-for="tournament in sortedTournaments"
        :key="tournament.id"
        class="tournament-card"
        :class="`tournament-card--${cardState(tournament)}`"
      >
        <header class="tournament-card__header">
          <span class="tournament-card__state-badge">
            <span class="state-dot" aria-hidden="true" />
            {{ STATE_LABEL[cardState(tournament)] }}
          </span>
          <span class="tournament-card__type">{{ typeLabel(tournament.type) }}</span>
        </header>

        <h4 class="tournament-card__name">{{ tournament.name }}</h4>
        <p class="tournament-card__meta">
          {{ tournament.category?.name || 'Sin categoría' }} · {{ tournament.season?.name || 'Sin temporada' }}
        </p>

        <dl class="tournament-card__stats">
          <div><dt>Formato</dt><dd>{{ formatLabel(tournament.format) }}</dd></div>
          <div><dt>Inscripción</dt><dd>{{ money(tournament.inscription_fee) }}</dd></div>
          <div><dt>Equipos</dt><dd>{{ tournament.teams_count ?? 0 }}</dd></div>
          <div><dt>Clubes</dt><dd>{{ tournament.clubs_count ?? 0 }}</dd></div>
        </dl>

        <div v-if="tournament.status === 'REGISTRATION'" class="tournament-card__registration">
          <p v-if="cardState(tournament) === 'registered'" class="tournament-card__note tournament-card__note--success">
            ✓ Tu serie ya está inscrita en este torneo.
          </p>
          <template v-else>
            <select
              :value="selection[tournament.id] || ''"
              class="input registration-select"
              :aria-label="`Serie para ${tournament.name}`"
              :disabled="registeringTournamentId === tournament.id"
              @change="selectSeries(tournament, $event.target.value)"
            >
              <option value="">Selecciona una serie</option>
              <option v-for="series in seriesItems" :key="series.id" :value="series.id">{{ series.name }}</option>
            </select>
            <button
              class="btn btn-primary registration-button"
              :disabled="!canRegister(tournament)"
              @click="$emit('register', { tournament, seriesId: selection[tournament.id] })"
            >{{ registeringTournamentId === tournament.id ? 'Inscribiendo…' : 'Inscribir' }}</button>
            <p v-if="reasonText(tournament)" class="registration-reason" role="status">{{ reasonText(tournament) }}</p>
          </template>
        </div>
        <p v-else class="tournament-card__note tournament-card__note--closed">
          Torneo cerrado — las inscripciones no están disponibles.
        </p>

        <footer class="tournament-card__footer">
          <button class="btn btn-secondary btn-sm" @click="$emit('view', tournament)">Ver detalle</button>
        </footer>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  tournaments: { type: Array, default: () => [] },
  seriesItems: { type: Array, default: () => [] },
  selection: { type: Object, required: true },
  eligibility: { type: Object, required: true },
  checkingTournamentId: { type: [String, Number], default: null },
  registeringTournamentId: { type: [String, Number], default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
});
const emit = defineEmits(['refresh', 'view', 'select-series', 'register']);

const REASONS = {
  SERIES_NOT_ACTIVE: 'La serie está inactiva.', CLUB_ORG_MISMATCH: 'La serie pertenece a otra organización.',
  TOURNAMENT_NOT_OPEN: 'El torneo no admite nuevas inscripciones.', CATEGORY_MISMATCH: 'La categoría de la serie no coincide.',
  SEASON_NOT_ACTIVE: 'La temporada no está activa.', ALREADY_REGISTERED: 'La serie ya está inscrita.',
  SERIES_NOT_FOUND: 'La serie no está disponible.', TOURNAMENT_NOT_FOUND: 'El torneo no está disponible.',
  NO_MATCHING_SERIES: 'El club no tiene una serie en esta categoría.',
};
const FORMAT = { ROUND_ROBIN: 'Todos contra todos', KNOCKOUT: 'Eliminación directa', GROUPS_KNOCKOUT: 'Grupos y eliminación' };
const TYPE = { OFICIAL: 'Oficial', AMISTOSO: 'Amistoso' };
const STATE_LABEL = {
  registered: 'Inscrita',
  available: 'Disponible para inscribir',
  blocked: 'No disponible',
  closed: 'Torneo cerrado',
  pending: 'Verificando…',
};

const formatLabel = (value) => FORMAT[value] || value || '—';
const typeLabel = (value) => TYPE[value] || value || '—';
const money = (value) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value || 0));
const selectSeries = (tournament, seriesId) => emit('select-series', { tournament, seriesId });

// Orden cronológico de apertura: fecha de inicio del torneo (fallback a la
// fecha de creación si aún no tiene start_date definida), más próxima primero.
const openingDate = (tournament) => {
  const raw = tournament.start_date || tournament.created_at;
  return raw ? new Date(raw).getTime() : Number.MAX_SAFE_INTEGER;
};
const sortedTournaments = computed(() => [...props.tournaments].sort((a, b) => openingDate(a) - openingDate(b)));

// Estado visual de la tarjeta:
//   registered -> verde  (la serie del club ya está inscrita)
//   available  -> gris   (no inscrita, pero puede inscribirse)
//   blocked    -> naranja (no puede inscribirse: sin serie que calce, inactiva, temporada cerrada, etc.)
//   closed     -> rojo   (el torneo ya no admite inscripciones)
//   pending    -> mientras se resuelve la elegibilidad automática (ClubSeries.vue la dispara al cargar)
const cardState = (tournament) => {
  if (tournament.status !== 'REGISTRATION') return 'closed';
  if (props.checkingTournamentId === tournament.id) return 'pending';
  const elig = props.eligibility[tournament.id];
  if (!elig) return 'pending';
  if (elig.reasons?.includes('ALREADY_REGISTERED')) return 'registered';
  if (elig.eligible) return 'available';
  return 'blocked';
};

const canRegister = (tournament) => tournament.status === 'REGISTRATION' && Boolean(props.selection[tournament.id]) && props.eligibility[tournament.id]?.eligible === true && props.registeringTournamentId !== tournament.id && props.checkingTournamentId !== tournament.id;

const reasonText = (tournament) => {
  if (props.checkingTournamentId === tournament.id) return 'Validando condiciones…';
  const reasons = (props.eligibility[tournament.id]?.reasons || []).filter((reason) => reason !== 'ALREADY_REGISTERED');
  if (!reasons.length) return '';
  return reasons.map((reason) => REASONS[reason] || 'No cumple una condición de inscripción.').join(' ');
};
</script>

<style scoped>
.active-tournaments { margin-top: var(--spacing-md); }
.active-tournaments__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
.active-tournaments__header h3 { margin-bottom: 4px; }
.active-tournaments__header p, .active-tournaments__state { margin: 0; color: var(--text-muted); }
@media (max-width: 640px) { .active-tournaments__header { align-items: stretch; flex-direction: column; } .active-tournaments__header .btn { width: 100%; } }

/* ── Grid de tarjetas ── */
.tournament-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--spacing-md);
}

.tournament-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: var(--spacing-lg);
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-left: 4px solid var(--border-color);
  box-shadow: var(--shadow-sm);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.tournament-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }

.tournament-card--registered { border-left-color: var(--sport-green); background: var(--success-bg); }
.tournament-card--available  { border-left-color: var(--border-color); }
.tournament-card--blocked    { border-left-color: var(--sport-gold); background: var(--gold-bg); }
.tournament-card--closed     { border-left-color: var(--accent-red); background: var(--danger-bg); }
.tournament-card--pending    { border-left-color: var(--border-color); opacity: 0.7; }

.tournament-card__header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.tournament-card__state-badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 3px 10px; border-radius: var(--radius-full);
  font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
  background: var(--bg-tertiary); color: var(--text-muted);
}
.tournament-card--registered .tournament-card__state-badge { background: var(--success-bg); color: var(--sport-green); }
.tournament-card--blocked    .tournament-card__state-badge { background: var(--gold-bg);    color: var(--sport-gold); }
.tournament-card--closed     .tournament-card__state-badge { background: var(--danger-bg);  color: var(--accent-red); }
.state-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; flex-shrink: 0; }

.tournament-card__type { font-size: 0.75rem; color: var(--text-muted); font-weight: 600; }
.tournament-card__name { margin: 0; font-size: 1.05rem; }
.tournament-card__meta { margin: 0; color: var(--text-muted); font-size: 0.85rem; }

.tournament-card__stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px 12px;
  margin: 4px 0 0;
}
.tournament-card__stats dt { font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.03em; }
.tournament-card__stats dd { margin: 0; font-weight: 700; font-variant-numeric: tabular-nums; }

.tournament-card__registration { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
.registration-select { width: 100%; }
.registration-button { width: 100%; }
.registration-reason { margin: 0; color: var(--text-muted); font-size: 0.8125rem; line-height: 1.4; }

.tournament-card__note { margin: 4px 0 0; font-size: 0.85rem; line-height: 1.4; }
.tournament-card__note--success { color: var(--sport-green); font-weight: 600; }
.tournament-card__note--closed  { color: var(--accent-red); }

.tournament-card__footer { margin-top: auto; padding-top: 8px; }
.tournament-card__footer .btn { width: 100%; }
.btn-sm { padding: 0.4rem 0.8rem; font-size: 0.875rem; }
</style>
