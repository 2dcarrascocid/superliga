<template>
  <section class="card" aria-labelledby="participants-title">
    <div class="participants-header">
      <div><h2 id="participants-title">Clubes y series inscritas</h2><p>Participantes, estado deportivo y situación del pago de inscripción.</p></div>
      <span class="participants-count">{{ participants.length }} participante(s)</span>
    </div>
    <div class="table-container">
      <table class="table participants-table">
        <caption class="sr-only">Clubes y series inscritas en el torneo</caption>
        <thead><tr><th scope="col">N°</th><th scope="col">Club</th><th scope="col">Serie</th><th scope="col">Estado</th><th scope="col">Inscripción</th></tr></thead>
        <tbody>
          <tr v-if="!participants.length"><td colspan="5" class="empty-state">Aún no hay series inscritas.</td></tr>
          <tr v-for="(participant, index) in participants" :key="participant.id">
            <td class="row-number">{{ index + 1 }}</td>
            <td class="club-name">{{ participant.series?.club?.name || '—' }}</td>
            <td>{{ participant.series?.name || '—' }}</td>
            <td><span class="participant-badge">{{ teamStatus(participant.status) }}</span></td>
            <td><span class="payment-badge" :class="`payment-badge--${String(participant.inscription_status).toLowerCase()}`">{{ paymentStatus(participant.inscription_status) }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
<script setup>
defineProps({ participants: { type: Array, default: () => [] } });
const TEAM = { ACTIVE: 'Activo', ELIMINATED: 'Eliminado', WITHDRAWN: 'Retirado', CHAMPION: 'Campeón' };
const PAYMENT = { PENDIENTE: 'Pendiente', PARCIAL: 'Parcial', PAGADO: 'Pagado', VENCIDO: 'Vencido', SIN_COBRO: 'Sin cobro' };
const teamStatus = (value) => TEAM[value] || value || '—';
const paymentStatus = (value) => PAYMENT[value] || value || '—';
</script>
<style scoped>
.participants-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
.participants-header h2 { margin-bottom: 4px; font-size: 1.5rem; }.participants-header p { margin: 0; }
.participants-count { padding: 6px 10px; color: var(--text-secondary); background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: var(--radius-full); font-size: .8125rem; white-space: nowrap; }
.participants-table { min-width: 680px; }.row-number { width: 64px; font-variant-numeric: tabular-nums; }.club-name { color: var(--text-primary); font-weight: 700; }
.participant-badge, .payment-badge { display: inline-flex; padding: 4px 10px; border-radius: var(--radius-full); font-size: .75rem; font-weight: 700; white-space: nowrap; }
.participant-badge { color: var(--sport-blue); background: var(--info-bg); }.payment-badge { color: var(--text-secondary); background: var(--bg-tertiary); }
.payment-badge--pagado { color: var(--primary-solid); background: var(--success-bg); }.payment-badge--parcial { color: var(--sport-gold); background: var(--gold-bg); }.payment-badge--vencido { color: var(--accent-red); background: var(--danger-bg); }
.empty-state { padding: 32px; text-align: center; color: var(--text-muted); }.sr-only { position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0; }
@media (max-width: 640px) { .participants-header { flex-direction: column; } }
</style>
