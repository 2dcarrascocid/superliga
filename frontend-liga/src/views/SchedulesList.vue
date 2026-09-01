<template>
  <div class="container mt-md">
    <div class="flex justify-between items-center mb-lg">
      <h2>Horarios</h2>
    </div>

    <div v-if="venuesError || schedulingError" class="alert alert-error">
      {{ venuesError || schedulingError }}
    </div>

    <section class="pd-dash mb-lg">
      <div class="pd-dash__glow pd-dash__glow--green" aria-hidden="true"></div>
      <div class="pd-dash__glow pd-dash__glow--blue" aria-hidden="true"></div>

      <div class="pd-dash__head">
        <span class="pd-dash__kicker">Parámetros</span>
        <h3 class="pd-dash__title">
          Disponibilidad y <span class="pd-dash__title-accent">reservas</span> de canchas
        </h3>
        <p class="pd-dash__desc">
          Configura la disponibilidad semanal de cada cancha y revisa/asigna reservas para una fecha específica.
        </p>
      </div>

      <div class="sched-controls">
        <div class="input-group">
          <label class="label">Fecha</label>
          <input v-model="selectedDate" type="date" class="input" />
        </div>
        <div class="input-group">
          <label class="label">Cancha</label>
          <select v-model="selectedVenueId" class="input">
            <option value="all">Todas las canchas</option>
            <option v-for="venue in venues" :key="venue.id" :value="venue.id">{{ venue.name }}</option>
          </select>
        </div>
      </div>
    </section>

    <div v-if="venuesLoading && venues.length === 0" class="text-center text-muted py-lg">
      Cargando canchas...
    </div>

    <div v-else-if="venues.length === 0" class="text-center text-muted py-lg">
      No hay canchas registradas.
      <router-link to="/venues">Crear la primera cancha →</router-link>
    </div>

    <div v-else class="sched-grid">
      <article v-for="venue in venuesToShow" :key="venue.id" class="card sched-card">
        <div class="flex justify-between items-center mb-sm">
          <h4 class="m-0">{{ venue.name }}</h4>
          <span class="status-badge" :class="`status-badge--${venue.status?.toLowerCase()}`">
            {{ statusLabel(venue.status) }}
          </span>
        </div>
        <p class="text-muted text-sm mb-md">
          {{ formatLocation(venue) || '—' }}
        </p>

        <p v-if="venue.status !== 'DISPONIBLE'" class="sched-empty">
          Cancha no disponible para agendar.
        </p>
        <template v-else>
          <!-- Disponibilidad semanal -->
          <div class="sched-section">
            <div class="sched-section__head">
              <span class="sched-section__title">Disponibilidad semanal</span>
            </div>

            <div v-if="availabilityFor(venue.id).length === 0" class="sched-empty">
              Sin franjas configuradas.
            </div>
            <ul v-else class="sched-list">
              <li v-for="row in availabilityFor(venue.id)" :key="row.id" class="sched-list__item">
                <span>{{ dayLabel(row.dia_semana) }} · {{ row.hora_apertura.slice(0, 5) }} - {{ row.hora_cierre.slice(0, 5) }}</span>
                <button class="btn btn-sm btn-danger" @click="removeFranja(venue.id, row.id)">Eliminar</button>
              </li>
            </ul>

            <form class="sched-form" @submit.prevent="submitFranja(venue.id)">
              <select v-model.number="franjaForm[venue.id].diaSemana" class="input">
                <option v-for="d in dayOptions" :key="d.value" :value="d.value">{{ d.label }}</option>
              </select>
              <input v-model="franjaForm[venue.id].horaApertura" type="time" class="input" required />
              <input v-model="franjaForm[venue.id].horaCierre" type="time" class="input" required />
              <button type="submit" class="btn btn-sm btn-secondary">+ Franja</button>
            </form>
          </div>

          <!-- Reservas del día seleccionado -->
          <div class="sched-section">
            <div class="sched-section__head">
              <span class="sched-section__title">Reservas · {{ formattedDateLabel }}</span>
            </div>

            <div v-if="bookingsFor(venue.id).length === 0" class="sched-empty">
              Sin reservas para esta fecha.
            </div>
            <ul v-else class="sched-list">
              <li v-for="booking in bookingsFor(venue.id)" :key="booking.id" class="sched-list__item">
                <span>
                  {{ booking.hora_inicio.slice(0, 5) }} - {{ booking.hora_fin.slice(0, 5) }}
                  <span class="text-muted"> · {{ booking.partido_id ? `Partido ${booking.partido_id.slice(0, 8)}` : 'Reserva' }}</span>
                </span>
                <button class="btn btn-sm btn-danger" @click="removeReserva(venue.id, booking.id)">Eliminar</button>
              </li>
            </ul>

            <form class="sched-form" @submit.prevent="submitReserva(venue.id)">
              <input v-model="bookingForm[venue.id].horaInicio" type="time" class="input" required />
              <input v-model="bookingForm[venue.id].horaFin" type="time" class="input" required />
              <input v-model="bookingForm[venue.id].partidoId" type="text" class="input" placeholder="partido_id (opcional)" />
              <button type="submit" class="btn btn-sm btn-primary">+ Reserva</button>
            </form>
          </div>
        </template>
      </article>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useVenuesStore } from '../stores/venues';
import { useVenueSchedulingStore } from '../stores/venueScheduling';
import { useAuthStore } from '../stores/auth';
import { useNotifyStore } from '../stores/notify';

const { items: venues, loading: venuesLoading, error: venuesError, fetchVenues } = useVenuesStore();
const {
  availabilityByVenue,
  bookingsByKey,
  error: schedulingError,
  fetchAvailability,
  addAvailability,
  removeAvailability,
  fetchBookings,
  addBooking,
  removeBooking,
} = useVenueSchedulingStore();
const authStore = useAuthStore();
const { confirm, notifySuccess, notifyError } = useNotifyStore();

const todayIso = () => new Date().toISOString().slice(0, 10);

const selectedDate = ref(todayIso());
const selectedVenueId = ref('all');

const STATUS_LABELS = {
  DISPONIBLE: 'Disponible',
  MANTENIMIENTO: 'En mantenimiento',
  INACTIVA: 'Inactiva',
};
const statusLabel = (value) => STATUS_LABELS[value] || value || '—';

const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const dayOptions = DAY_LABELS.map((label, value) => ({ value, label }));
const dayLabel = (value) => DAY_LABELS[value] ?? '—';

const formatLocation = (venue) => [venue.address, venue.city].filter(Boolean).join(', ');

const formattedDateLabel = computed(() => {
  const date = new Date(`${selectedDate.value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
});

const venuesToShow = computed(() => {
  if (selectedVenueId.value === 'all') return venues.value;
  return venues.value.filter((v) => v.id === selectedVenueId.value);
});

const franjaForm = reactive({});
const bookingForm = reactive({});

const ensureForms = (venueId) => {
  if (!franjaForm[venueId]) {
    franjaForm[venueId] = { diaSemana: 1, horaApertura: '09:00', horaCierre: '22:00' };
  }
  if (!bookingForm[venueId]) {
    bookingForm[venueId] = { horaInicio: '', horaFin: '', partidoId: '' };
  }
};

const availabilityFor = (venueId) => availabilityByVenue.value[venueId] || [];
const bookingsFor = (venueId) => bookingsByKey.value[`${venueId}:${selectedDate.value}`] || [];

const loadVenueSchedule = async (venueId) => {
  ensureForms(venueId);
  await Promise.all([
    fetchAvailability(venueId).catch(() => {}),
    fetchBookings(venueId, selectedDate.value).catch(() => {}),
  ]);
};

const loadVisibleSchedules = async () => {
  await Promise.all(venuesToShow.value.map((v) => loadVenueSchedule(v.id)));
};

const submitFranja = async (venueId) => {
  const form = franjaForm[venueId];
  try {
    await addAvailability(venueId, { ...form });
    form.horaApertura = '09:00';
    form.horaCierre = '22:00';
  } catch (e) {
    // Error manejado en el store
  }
};

const removeFranja = async (venueId, availabilityId) => {
  const ok = await confirm({
    title: '¿Eliminar franja?',
    message: '¿Estás seguro de que deseas eliminar esta franja de disponibilidad?',
    confirmText: 'Eliminar',
    isDestructive: true,
  });
  if (!ok) return;
  try {
    await removeAvailability(venueId, availabilityId);
    notifySuccess('Franja de disponibilidad eliminada');
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al eliminar la franja');
  }
};

const submitReserva = async (venueId) => {
  const form = bookingForm[venueId];
  try {
    await addBooking(venueId, { fecha: selectedDate.value, ...form });
    form.horaInicio = '';
    form.horaFin = '';
    form.partidoId = '';
    notifySuccess('Reserva registrada exitosamente');
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al registrar la reserva');
  }
};

const removeReserva = async (venueId, bookingId) => {
  const ok = await confirm({
    title: '¿Eliminar reserva?',
    message: '¿Estás seguro de que deseas eliminar esta reserva?',
    confirmText: 'Eliminar',
    isDestructive: true,
  });
  if (!ok) return;
  try {
    await removeBooking(venueId, bookingId, selectedDate.value);
    notifySuccess('Reserva eliminada exitosamente');
  } catch (e) {
    notifyError(e.response?.data?.error?.message || 'Error al eliminar la reserva');
  }
};

// Se inicializan los forms de forma síncrona (flush: 'pre') apenas una
// cancha aparece en la lista, para que el template nunca intente leer
// franjaForm[venue.id] / bookingForm[venue.id] antes de que existan.
watch(venues, (list) => {
  list.forEach((v) => ensureForms(v.id));
}, { immediate: true });

watch(selectedDate, () => {
  venuesToShow.value.forEach((v) => fetchBookings(v.id, selectedDate.value).catch(() => {}));
});

watch(venuesToShow, (list) => {
  list.forEach((v) => {
    if (!availabilityByVenue.value[v.id]) fetchAvailability(v.id).catch(() => {});
    if (!bookingsByKey.value[`${v.id}:${selectedDate.value}`]) fetchBookings(v.id, selectedDate.value).catch(() => {});
  });
});

onMounted(async () => {
  await fetchVenues({ limit: 500, org_id: authStore.state.org?.id });
  await loadVisibleSchedules();
});
</script>

<style scoped>
.sched-controls {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1rem;
  margin-top: 0.5rem;
}
.sched-controls .input-group { min-width: 200px; }

.sched-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1rem;
}

.sched-card { display: flex; flex-direction: column; }

.sched-empty {
  color: var(--text-muted);
  font-size: 0.875rem;
}

.sched-section + .sched-section {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}

.sched-section__head {
  margin-bottom: 0.5rem;
}

.sched-section__title {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}

.sched-list {
  list-style: none;
  margin: 0 0 0.6rem;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.sched-list__item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  background: var(--bg-tertiary, rgba(255, 255, 255, 0.03));
  border-radius: var(--radius-md, 8px);
  padding: 0.4rem 0.6rem;
}

.sched-form {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr auto;
  gap: 0.4rem;
}

.sched-form .input {
  padding: 0.35rem 0.5rem;
  font-size: 0.8rem;
}

.btn-sm {
  padding: 0.35rem 0.7rem;
  font-size: 0.8rem;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 700;
}
.status-badge--disponible    { background: rgba(0, 230, 118, 0.14); color: var(--primary-solid, #00e676); }
.status-badge--mantenimiento { background: rgba(255, 213, 79, 0.16); color: #ffd54f; }
.status-badge--inactiva      { background: rgba(239, 83, 80, 0.14); color: #ef5350; }

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

.pd-dash__head {
  position: relative;
  z-index: 1;
  text-align: center;
  max-width: 520px;
  margin: 0 auto;
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
</style>
