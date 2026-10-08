<template>
  <div class="landing">
    <!-- ── Fondo decorativo ── -->
    <div class="landing__glow landing__glow--green" aria-hidden="true"></div>
    <div class="landing__glow landing__glow--blue" aria-hidden="true"></div>

    <!-- ── Nav ── -->
    <header class="lp-nav">
      <div class="lp-nav__inner">
        <div class="lp-brand">
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
            <circle cx="15" cy="15" r="14" fill="url(#lp-nav-grad)"/>
            <path d="M9 15c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="#04120a" stroke-width="2.2" stroke-linecap="round"/>
            <circle cx="15" cy="18.5" r="3" fill="#04120a"/>
            <defs>
              <linearGradient id="lp-nav-grad" x1="0" y1="0" x2="30" y2="30">
                <stop offset="0%" stop-color="#00e676"/>
                <stop offset="100%" stop-color="#4fc3f7"/>
              </linearGradient>
            </defs>
          </svg>
          <span>SuperLigas</span>
        </div>

        <nav class="lp-nav__links" aria-label="Navegación de la página">
          <a href="#modulos">Módulos</a>
          <a href="#torneos">Torneos</a>
          <a href="#dia-de-partido">Día de partido</a>
          <a href="#finanzas">Finanzas</a>
          <a href="#contacto">Contacto</a>
        </nav>

        <router-link to="/login" class="lp-btn lp-btn--ghost lp-nav__cta">Iniciar sesión</router-link>
      </div>
    </header>

    <!-- ── Hero ── -->
    <section class="lp-hero">
      <span class="lp-eyebrow">⚡ Temporada 2026 ya en marcha</span>
      <h1 class="lp-hero__title">
        Toda tu liga en <span class="lp-text-gradient">una sola cancha</span>
      </h1>
      <p class="lp-hero__subtitle">
        Clubes, series, torneos, fixture, programación de fechas, tribunal de disciplina y finanzas por club.
        Con un portal propio para cada jugador. Sin planillas, sin papeles, sin perder un gol.
      </p>
      <div class="lp-hero__actions">
        <a href="#contacto" class="lp-btn lp-btn--primary lp-btn--lg">Solicitar una demo</a>
        <a href="#modulos" class="lp-btn lp-btn--secondary lp-btn--lg">Ver funcionalidades</a>
      </div>

      <div class="lp-hero__stats">
        <div v-for="s in heroStats" :key="s.label" class="lp-hero__stat">
          <strong>{{ s.value }}</strong>
          <span>{{ s.label }}</span>
        </div>
      </div>
    </section>

    <!-- ── Módulos ── -->
    <section id="modulos" class="lp-section">
      <div class="lp-section__head">
        <div>
          <span class="lp-kicker">Plataforma</span>
          <h2>Todo lo que tu liga necesita</h2>
        </div>
        <p class="lp-section__desc">Módulos conectados entre sí: lo que pasa en la cancha se refleja en la tabla, en el tribunal y en la cuenta de cada club.</p>
      </div>

      <div class="lp-grid lp-grid--3">
        <article v-for="f in modules" :key="f.title" class="lp-card lp-feature">
          <div class="lp-feature__icon" :class="`lp-feature__icon--${f.color}`" aria-hidden="true">{{ f.icon }}</div>
          <h3>{{ f.title }}</h3>
          <p>{{ f.desc }}</p>
          <ul class="lp-feature__list">
            <li v-for="item in f.items" :key="item">{{ item }}</li>
          </ul>
        </article>
      </div>
    </section>

    <!-- ── Torneos ── -->
    <section id="torneos" class="lp-section">
      <div class="lp-section__head">
        <div>
          <span class="lp-kicker">Competencia</span>
          <h2>Torneos que se actualizan solos</h2>
        </div>
        <p class="lp-section__desc">Carga el resultado y listo: tabla de posiciones, goleadores y fairplay se recalculan al instante para cada serie.</p>
      </div>

      <div class="lp-split">
        <div class="lp-card">
          <div class="lp-card__head">
            <p class="lp-card__title">Tabla de posiciones</p>
            <span class="lp-badge lp-badge--green">Serie Adulta · Fecha 9</span>
          </div>
          <table class="lp-table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Club</th>
                <th scope="col">PJ</th>
                <th scope="col">DG</th>
                <th scope="col">Pts</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in standings" :key="row.club">
                <td>{{ i + 1 }}</td>
                <td class="lp-table__club">
                  <span class="lp-avatar lp-avatar--sm">{{ row.club.slice(0, 2).toUpperCase() }}</span>
                  {{ row.club }}
                </td>
                <td>{{ row.pj }}</td>
                <td>{{ row.dg > 0 ? '+' + row.dg : row.dg }}</td>
                <td><strong>{{ row.pts }}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="lp-stack">
          <div class="lp-card">
            <div class="lp-card__head">
              <p class="lp-card__title">Goleadores</p>
              <span class="lp-muted">⚽</span>
            </div>
            <ol class="lp-rank">
              <li v-for="p in scorers" :key="p.name">
                <span>{{ p.name }} <span class="lp-muted">· {{ p.club }}</span></span>
                <strong>{{ p.goals }}</strong>
              </li>
            </ol>
          </div>
          <div class="lp-card">
            <div class="lp-card__head">
              <p class="lp-card__title">Fairplay</p>
              <span class="lp-muted">🟨 🟥</span>
            </div>
            <ol class="lp-rank">
              <li v-for="c in fairplay" :key="c.club">
                <span>{{ c.club }}</span>
                <strong>{{ c.points }} pts</strong>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Día de partido ── -->
    <section id="dia-de-partido" class="lp-section">
      <div class="lp-section__head">
        <div>
          <span class="lp-kicker">En cancha</span>
          <h2>Día de partido, sin improvisar</h2>
        </div>
        <p class="lp-section__desc">Programa la fecha completa con canchas, árbitros y horarios, y registra cada partido desde la planilla de control.</p>
      </div>

      <div class="lp-grid lp-grid--3">
        <article v-for="m in matches" :key="m.id" class="lp-card lp-match">
          <div class="lp-match__top">
            <span class="lp-badge" :class="`lp-badge--${m.badgeColor}`">{{ m.competition }}</span>
            <span class="lp-match__date">{{ m.date }}</span>
          </div>
          <div class="lp-match__teams">
            <div class="lp-match__team">
              <div class="lp-avatar">{{ m.home.slice(0, 2).toUpperCase() }}</div>
              <span>{{ m.home }}</span>
            </div>
            <span class="lp-match__vs">VS</span>
            <div class="lp-match__team">
              <div class="lp-avatar">{{ m.away.slice(0, 2).toUpperCase() }}</div>
              <span>{{ m.away }}</span>
            </div>
          </div>
          <div class="lp-match__foot">
            <span>📍 {{ m.venue }}</span>
            <span class="lp-match__time">{{ m.time }}</span>
          </div>
          <p class="lp-match__ref">🧑‍⚖️ Árbitro: {{ m.referee }}</p>
        </article>
      </div>

      <ul class="lp-checks">
        <li v-for="c in matchdayChecks" :key="c">✓ {{ c }}</li>
      </ul>
    </section>

    <!-- ── Disciplina ── -->
    <section id="disciplina" class="lp-section">
      <div class="lp-split lp-split--reverse">
        <div class="lp-section__head lp-section__head--flush">
          <span class="lp-kicker">Tribunal de disciplina</span>
          <h2>Sanciones claras, trazables y automáticas</h2>
          <p class="lp-section__desc">
            Un código de faltas transversal para toda la organización. Las tarjetas y expulsiones del partido
            llegan al tribunal, que resuelve con artículos del reglamento, y la sanción se aplica sola en las
            próximas fechas.
          </p>
          <ul class="lp-checks lp-checks--col">
            <li>✓ Catálogo de faltas y artículos del reglamento</li>
            <li>✓ Causas del tribunal con resolución y fechas de suspensión</li>
            <li>✓ Historial de sanciones por jugador y por club</li>
            <li>✓ Multas que se cargan directo a la cuenta del club</li>
          </ul>
        </div>

        <div class="lp-card lp-case">
          <div class="lp-card__head">
            <p class="lp-card__title">Causa N° 024</p>
            <span class="lp-badge lp-badge--gold">Resuelta</span>
          </div>
          <dl class="lp-case__grid">
            <div><dt>Jugador</dt><dd>Bastián Rojas · Real Andes</dd></div>
            <div><dt>Partido</dt><dd>Real Andes vs Atlético Sur · F8</dd></div>
            <div><dt>Falta</dt><dd>🟥 Conducta violenta (Art. 32)</dd></div>
            <div><dt>Resolución</dt><dd>3 fechas de suspensión</dd></div>
          </dl>
          <div class="lp-case__bar" role="img" aria-label="Suspensión cumplida: 1 de 3 fechas">
            <span class="lp-case__step lp-case__step--done">F9</span>
            <span class="lp-case__step">F10</span>
            <span class="lp-case__step">F11</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Finanzas ── -->
    <section id="finanzas" class="lp-section">
      <div class="lp-split">
        <div class="lp-card">
          <div class="lp-card__head">
            <p class="lp-card__title">Cuenta corriente · Halcones FC</p>
            <span class="lp-trend lp-trend--down">Saldo −$85.000</span>
          </div>
          <ul class="lp-ledger">
            <li v-for="l in ledger" :key="l.concept">
              <div>
                <span>{{ l.concept }}</span>
                <span class="lp-muted">{{ l.type }}</span>
              </div>
              <strong :class="l.amount < 0 ? 'lp-neg' : 'lp-pos'">{{ formatMoney(l.amount) }}</strong>
            </li>
          </ul>
        </div>

        <div class="lp-section__head lp-section__head--flush">
          <span class="lp-kicker">Finanzas por club</span>
          <h2>Cada peso, en su cuenta</h2>
          <p class="lp-section__desc">
            Un ledger por club con todos los movimientos de la temporada. Se acabaron las planillas paralelas y los
            "¿cuánto debíamos?".
          </p>
          <ul class="lp-checks lp-checks--col">
            <li>✓ Costo de inscripción por torneo y por fecha jugada</li>
            <li>✓ Eventos de la organización con cargo obligatorio por club</li>
            <li>✓ Eventos de club con cargos por jugador</li>
            <li>✓ Registro de pagos y saldo al día</li>
          </ul>
        </div>
      </div>
    </section>

    <!-- ── Roles ── -->
    <section id="roles" class="lp-section">
      <div class="lp-section__head lp-section__head--center">
        <span class="lp-kicker">Accesos</span>
        <h2>Cada uno ve lo que le corresponde</h2>
        <p class="lp-section__desc">Invita por correo a los administradores y jugadores; cada rol entra a su propio espacio.</p>
      </div>

      <div class="lp-grid lp-grid--3">
        <article v-for="r in roles" :key="r.title" class="lp-card lp-role">
          <div class="lp-avatar lp-avatar--lg" aria-hidden="true">{{ r.icon }}</div>
          <h3>{{ r.title }}</h3>
          <p class="lp-muted">{{ r.desc }}</p>
        </article>
      </div>
    </section>

    <!-- ── Contacto ── -->
    <section id="contacto" class="lp-section">
      <div class="lp-contact">
        <div class="lp-contact__intro">
          <span class="lp-kicker">Contacto</span>
          <h2>Hablemos de tu liga</h2>
          <p class="lp-section__desc">
            Déjanos tus datos y te contactamos para mostrarte la plataforma, resolver dudas o ayudarte a migrar tu
            liga.
          </p>
          <ul class="lp-checks lp-checks--col">
            <li>✓ Respuesta en menos de 24 horas hábiles</li>
            <li>✓ Demo guiada con datos de tu liga</li>
            <li>✓ Ayuda con la importación de tu nómina desde Excel</li>
          </ul>
        </div>

        <div class="lp-card lp-contact__card">
          <div v-if="contactSent" class="lp-contact__done" role="status">
            <div class="lp-avatar lp-avatar--lg" aria-hidden="true">✓</div>
            <h3>¡Gracias, {{ sentName }}!</h3>
            <p class="lp-muted">Recibimos tu solicitud. Te escribiremos pronto al correo que nos dejaste.</p>
            <button type="button" class="lp-btn lp-btn--secondary" @click="contactSent = false">Enviar otra solicitud</button>
          </div>

          <form v-else class="lp-form" novalidate @submit.prevent="submitContact">
            <div class="lp-form__row">
              <label class="lp-field">
                <span>Nombre *</span>
                <input v-model.trim="form.name" type="text" autocomplete="name" maxlength="100" required />
              </label>
              <label class="lp-field">
                <span>Correo *</span>
                <input v-model.trim="form.email" type="email" autocomplete="email" maxlength="150" required />
              </label>
            </div>
            <div class="lp-form__row">
              <label class="lp-field">
                <span>Teléfono</span>
                <input v-model.trim="form.phone" type="tel" autocomplete="tel" maxlength="30" placeholder="+56 9 1234 5678" />
              </label>
              <label class="lp-field">
                <span>Liga / organización</span>
                <input v-model.trim="form.organization" type="text" autocomplete="organization" maxlength="120" />
              </label>
            </div>
            <label class="lp-field">
              <span>Mensaje</span>
              <textarea v-model.trim="form.message" rows="4" maxlength="2000" placeholder="Cuéntanos cuántos clubes y series tiene tu liga"></textarea>
            </label>

            <!-- Honeypot anti-bots: oculto para personas -->
            <label class="lp-hp" aria-hidden="true">
              Sitio web
              <input v-model="form.website" type="text" tabindex="-1" autocomplete="off" />
            </label>

            <p v-if="contactError" class="lp-form__error" role="alert">{{ contactError }}</p>

            <button type="submit" class="lp-btn lp-btn--primary lp-btn--block lp-btn--lg" :disabled="sending">
              {{ sending ? 'Enviando…' : 'Enviar solicitud' }}
            </button>
          </form>
        </div>
      </div>
    </section>

    <!-- ── CTA final ── -->
    <section class="lp-cta">
      <h2>¿Listo para llevar tu liga al siguiente nivel?</h2>
      <p>Clubes, torneos, disciplina y finanzas conectados desde la primera fecha.</p>
      <div class="lp-hero__actions">
        <a href="#contacto" class="lp-btn lp-btn--primary lp-btn--lg">Quiero que me contacten</a>
        <router-link to="/login" class="lp-btn lp-btn--secondary lp-btn--lg">Ya tengo cuenta</router-link>
      </div>
    </section>

    <footer class="lp-footer">
      <span>© {{ year }} SuperLigas</span>
      <a href="#contacto">Contacto</a>
      <router-link to="/login">Iniciar sesión</router-link>
    </footer>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { authAPI } from '../api';

const year = new Date().getFullYear();

const heroStats = [
  { value: '10', label: 'Módulos integrados' },
  { value: '3', label: 'Roles de acceso' },
  { value: '100%', label: 'En la nube' },
];

const modules = [
  {
    icon: '🛡️', color: 'green', title: 'Clubes y series',
    desc: 'Ficha de cada club, sus administradores y las series que inscribe en cada temporada.',
    items: ['Series por categoría con control de edad', 'Inscripción de series a torneos', 'Panel de KPIs por club'],
  },
  {
    icon: '👟', color: 'blue', title: 'Jugadores y nómina',
    desc: 'Registro único de jugadores con su historial en la liga.',
    items: ['Importación masiva desde Excel', 'Documentos del jugador en la nube', 'Plantel por serie y folios'],
  },
  {
    icon: '🔁', color: 'gold', title: 'Traspasos y préstamos',
    desc: 'Movimientos entre clubes con aprobación y trazabilidad.',
    items: ['Cambio de club con historial', 'Préstamos con fecha de término', 'Dashboard de KPIs de traspasos'],
  },
  {
    icon: '🏆', color: 'green', title: 'Torneos y temporadas',
    desc: 'Arma la temporada, crea torneos y genera el fixture en minutos.',
    items: ['Fixture por fecha y serie', 'Tabla de posiciones automática', 'Goleadores y fairplay'],
  },
  {
    icon: '📅', color: 'blue', title: 'Programación de fechas',
    desc: 'Asigna canchas, árbitros y horarios a toda una fecha de una vez.',
    items: ['Recintos y canchas disponibles', 'Cuerpo arbitral', 'Reglas de programación configurables'],
  },
  {
    icon: '📋', color: 'gold', title: 'Planilla de partido',
    desc: 'Todo lo que ocurre en el partido queda registrado.',
    items: ['Resultado, goles y tarjetas', 'Logística del encuentro', 'Documentos adjuntos al partido'],
  },
  {
    icon: '⚖️', color: 'green', title: 'Tribunal de disciplina',
    desc: 'Código de faltas transversal y causas con resolución.',
    items: ['Catálogo de faltas y artículos', 'Sanciones por fechas', 'Historial disciplinario'],
  },
  {
    icon: '💰', color: 'blue', title: 'Finanzas por club',
    desc: 'Ledger con cargos, pagos y saldo de cada club.',
    items: ['Inscripción y costo por fecha', 'Eventos con cargo obligatorio', 'Cargos por jugador'],
  },
  {
    icon: '🙋', color: 'gold', title: 'Portal del jugador',
    desc: 'Cada jugador entra con su cuenta de Google y ve lo suyo.',
    items: ['Perfil propio', 'Su serie y su plantel', 'Estadísticas de su torneo'],
  },
  {
    icon: '🗳️', color: 'green', title: 'Votaciones',
    desc: 'La liga somete decisiones a votación y cada club vota una sola vez a través de su representante.',
    items: ['Pregunta con 2 o más alternativas y plazo de cierre', 'Voto público o secreto', 'Abstenciones y resultados publicados con resolución'],
  },
];

const standings = [
  { club: 'Real Andes', pj: 9, dg: 14, pts: 22 },
  { club: 'Halcones FC', pj: 9, dg: 9, pts: 19 },
  { club: 'Unión Central', pj: 9, dg: 4, pts: 16 },
  { club: 'Cóndor FC', pj: 9, dg: -2, pts: 12 },
  { club: 'Atlético Sur', pj: 9, dg: -7, pts: 9 },
];

const scorers = [
  { name: 'Bastián Rojas', club: 'Real Andes', goals: 11 },
  { name: 'Matías Soto', club: 'Halcones FC', goals: 9 },
  { name: 'Diego Fuentes', club: 'Unión Central', goals: 7 },
];

const fairplay = [
  { club: 'Cóndor FC', points: 4 },
  { club: 'Halcones FC', points: 6 },
  { club: 'Real Andes', points: 9 },
];

const matches = [
  { id: 1, home: 'Real Andes', away: 'Atlético Sur', date: 'Sáb 10 Oct', time: '18:00', venue: 'Estadio Municipal · Cancha 1', referee: 'P. González', competition: 'Serie Adulta', badgeColor: 'green' },
  { id: 2, home: 'Halcones FC', away: 'Deportivo Norte', date: 'Dom 11 Oct', time: '16:30', venue: 'Complejo Halcones · Cancha 2', referee: 'C. Muñoz', competition: 'Serie Juvenil', badgeColor: 'blue' },
  { id: 3, home: 'Unión Central', away: 'Cóndor FC', date: 'Dom 11 Oct', time: '19:00', venue: 'Estadio Central · Cancha 1', referee: 'R. Díaz', competition: 'Serie Senior', badgeColor: 'green' },
];

const matchdayChecks = [
  'Programación por fecha: canchas, árbitros y horarios',
  'Planilla de control con goles, tarjetas y cambios',
  'Logística y documentos del partido',
  'Resultados que alimentan tabla, goleadores y tribunal',
];

const ledger = [
  { concept: 'Inscripción Torneo Apertura', type: 'Cargo · Inscripción', amount: -120000 },
  { concept: 'Costo fecha 8 (3 series)', type: 'Cargo · Por fecha', amount: -45000 },
  { concept: 'Aniversario de la liga', type: 'Cargo · Evento de organización', amount: -20000 },
  { concept: 'Transferencia', type: 'Pago recibido', amount: 100000 },
];

const roles = [
  { icon: '🏛️', title: 'Administrador de liga', desc: 'Configura la organización, el deporte, torneos, programación, tribunal, finanzas y votaciones. Invita a otros administradores.' },
  { icon: '🛡️', title: 'Administrador de club', desc: 'Gestiona su club: jugadores, series, inscripciones, documentos y su cuenta corriente. Vota en nombre del club.' },
  { icon: '🙋', title: 'Jugador', desc: 'Entra con Google para ver su perfil, su serie y las estadísticas de su torneo.' },
];

const emptyForm = () => ({ name: '', email: '', phone: '', organization: '', message: '', website: '' });
const form = reactive(emptyForm());
const sending = ref(false);
const contactSent = ref(false);
const contactError = ref('');
const sentName = ref('');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function submitContact() {
  contactError.value = '';
  if (form.name.length < 2) {
    contactError.value = 'Ingresa tu nombre.';
    return;
  }
  if (!EMAIL_RE.test(form.email)) {
    contactError.value = 'Ingresa un correo válido.';
    return;
  }

  sending.value = true;
  try {
    await authAPI.contact({ ...form });
    sentName.value = form.name.split(' ')[0];
    Object.assign(form, emptyForm());
    contactSent.value = true;
  } catch {
    contactError.value = 'No pudimos enviar tu solicitud. Intenta de nuevo en unos minutos.';
  } finally {
    sending.value = false;
  }
}

function formatMoney(n) {
  const abs = Math.abs(n).toLocaleString('es-CL');
  return `${n < 0 ? '−' : '+'}$${abs}`;
}
</script>

<style scoped>
.landing {
  --lp-bg: #06060a;
  --lp-bg-raised: #0d0e14;
  --lp-card: #14151d;
  --lp-border: #23252f;
  --lp-text: #f4f5fb;
  --lp-text-secondary: #a8adc4;
  --lp-text-muted: #6b7089;
  --lp-green: #00e676;
  --lp-green-dark: #00c766;
  --lp-blue: #4fc3f7;
  --lp-gold: #ffd54f;
  --lp-danger: #ef5350;
  --lp-radius-sm: 10px;
  --lp-radius-md: 16px;
  --lp-radius-lg: 24px;

  /* La landing es siempre oscura: se fijan los tokens globales para que
     h1–h6 y p (style.css) no tomen los colores oscuros del tema claro. */
  --text-primary: var(--lp-text);
  --text-secondary: var(--lp-text-secondary);
  --text-muted: var(--lp-text-muted);

  position: relative;
  min-height: 100vh;
  background: var(--lp-bg);
  color: var(--lp-text);
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  overflow-x: hidden;
}

.landing__glow {
  position: absolute;
  width: 560px;
  height: 560px;
  border-radius: 50%;
  filter: blur(120px);
  opacity: .22;
  pointer-events: none;
  z-index: 0;
}
.landing__glow--green { top: -160px; left: -120px; background: var(--lp-green); }
.landing__glow--blue  { top: 380px; right: -160px; background: var(--lp-blue); }

/* ── Nav ── */
.lp-nav {
  position: sticky;
  top: 0;
  z-index: 40;
  background: rgba(6, 6, 10, .78);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--lp-border);
}
.lp-nav__inner {
  max-width: 1180px;
  margin: 0 auto;
  padding: 14px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}
.lp-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 800;
  font-size: 1.05rem;
  letter-spacing: -0.01em;
}
.lp-nav__links {
  display: none;
  gap: 24px;
}
.lp-nav__links a {
  color: var(--lp-text-secondary);
  text-decoration: none;
  font-size: .88rem;
  font-weight: 600;
  transition: color .15s ease;
}
.lp-nav__links a:hover { color: var(--lp-text); }

@media (min-width: 960px) {
  .lp-nav__links { display: flex; }
}

/* ── Buttons ── */
.lp-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-family: inherit;
  font-weight: 700;
  font-size: .9rem;
  padding: 10px 20px;
  border-radius: var(--lp-radius-sm);
  border: 1px solid transparent;
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
  transition: transform .15s ease, box-shadow .15s ease, background .15s ease, border-color .15s ease;
}
.lp-btn:disabled { opacity: .6; cursor: not-allowed; transform: none; box-shadow: none; }
.lp-btn--primary {
  background: linear-gradient(135deg, var(--lp-green), #33ec8e);
  color: #04120a;
  box-shadow: 0 0 0 rgba(0,230,118,0);
}
.lp-btn--primary:not(:disabled):hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 28px rgba(0,230,118,.35);
}
.lp-btn--secondary {
  background: var(--lp-bg-raised);
  color: var(--lp-text);
  border-color: var(--lp-border);
}
.lp-btn--secondary:hover { border-color: var(--lp-blue); color: var(--lp-blue); }
.lp-btn--ghost {
  background: transparent;
  color: var(--lp-text);
  border-color: var(--lp-border);
}
.lp-btn--ghost:hover { border-color: var(--lp-green); color: var(--lp-green); }
.lp-btn--lg { padding: 14px 28px; font-size: 1rem; border-radius: var(--lp-radius-md); }
.lp-btn--block { width: 100%; }
.lp-nav__cta { flex-shrink: 0; }

/* ── Hero ── */
.lp-hero {
  position: relative;
  z-index: 1;
  max-width: 800px;
  margin: 0 auto;
  padding: 96px 24px 64px;
  text-align: center;
}
.lp-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: .8rem;
  font-weight: 700;
  color: var(--lp-green);
  background: rgba(0,230,118,.1);
  border: 1px solid rgba(0,230,118,.25);
  padding: 6px 14px;
  border-radius: 999px;
  margin-bottom: 24px;
}
.lp-hero__title {
  font-size: clamp(2.1rem, 5vw, 3.5rem);
  font-weight: 900;
  line-height: 1.08;
  letter-spacing: -0.03em;
  margin-bottom: 20px;
}
.lp-text-gradient {
  background: linear-gradient(135deg, var(--lp-green), var(--lp-blue));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.lp-hero__subtitle {
  font-size: 1.05rem;
  color: var(--lp-text-secondary);
  line-height: 1.65;
  margin-bottom: 36px;
}
.lp-hero__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 14px;
  margin-bottom: 56px;
}
.lp-hero__stats {
  display: flex;
  justify-content: center;
  gap: 40px;
  flex-wrap: wrap;
}
.lp-hero__stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.lp-hero__stat strong { font-size: 1.6rem; font-weight: 800; }
.lp-hero__stat span { font-size: .8rem; color: var(--lp-text-muted); }

/* ── Sections ── */
.lp-section {
  position: relative;
  z-index: 1;
  max-width: 1180px;
  margin: 0 auto;
  padding: 64px 24px;
  scroll-margin-top: 64px;
}
.lp-section__head {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 32px;
}
.lp-section__head--center { align-items: center; text-align: center; }
.lp-section__head--flush { margin-bottom: 0; justify-content: center; }
.lp-kicker {
  font-size: .78rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .1em;
  color: var(--lp-blue);
}
.lp-section h2 { font-size: 1.85rem; font-weight: 800; letter-spacing: -0.02em; margin-top: 4px; }
.lp-section__desc { color: var(--lp-text-secondary); max-width: 520px; font-size: .95rem; line-height: 1.6; }
.lp-muted { color: var(--lp-text-muted); font-size: .85rem; }

/* ── Card / Grid ── */
.lp-card {
  background: var(--lp-card);
  border: 1px solid var(--lp-border);
  border-radius: var(--lp-radius-md);
  padding: 22px;
  transition: border-color .2s ease, transform .2s ease;
}
.lp-card:hover { border-color: rgba(0,230,118,.35); }
.lp-card__head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
.lp-card__title { font-weight: 800; font-size: 1rem; }

.lp-grid { display: grid; gap: 20px; }
.lp-grid--3 { grid-template-columns: 1fr; }
@media (min-width: 720px) { .lp-grid--3 { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 1000px) { .lp-grid--3 { grid-template-columns: repeat(3, 1fr); } }

.lp-split { display: grid; gap: 32px; grid-template-columns: 1fr; align-items: center; }
@media (min-width: 900px) {
  .lp-split { grid-template-columns: 1.3fr 1fr; }
  .lp-split--reverse { grid-template-columns: 1fr 1.1fr; }
}
.lp-stack { display: flex; flex-direction: column; gap: 20px; }

/* ── Badge ── */
.lp-badge {
  font-size: .72rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 999px;
}
.lp-badge--green { background: rgba(0,230,118,.12); color: var(--lp-green); }
.lp-badge--blue  { background: rgba(79,195,247,.12); color: var(--lp-blue); }
.lp-badge--gold  { background: rgba(255,213,79,.12); color: var(--lp-gold); }

/* ── Avatar ── */
.lp-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: .8rem;
  background: var(--lp-bg-raised);
  border: 1px solid var(--lp-border);
  color: var(--lp-text-secondary);
  flex-shrink: 0;
}
.lp-avatar--sm { width: 26px; height: 26px; font-size: .62rem; }
.lp-avatar--lg {
  width: 64px;
  height: 64px;
  font-size: 1.5rem;
  margin: 0 auto 14px;
  background: linear-gradient(135deg, rgba(0,230,118,.18), rgba(79,195,247,.18));
  color: var(--lp-text);
}

/* ── Feature card ── */
.lp-feature { display: flex; flex-direction: column; gap: 10px; }
.lp-feature:hover { transform: translateY(-3px); }
@media (min-width: 1000px) {
  .lp-feature:last-child:nth-child(3n+1) { grid-column: 1 / -1; }
}
.lp-feature__icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
}
.lp-feature__icon--green { background: rgba(0,230,118,.12); }
.lp-feature__icon--blue  { background: rgba(79,195,247,.12); }
.lp-feature__icon--gold  { background: rgba(255,213,79,.12); }
.lp-feature h3 { font-size: 1.05rem; font-weight: 800; }
.lp-feature p { font-size: .88rem; color: var(--lp-text-secondary); line-height: 1.55; }
.lp-feature__list {
  list-style: none;
  padding: 12px 0 0;
  margin: auto 0 0;
  border-top: 1px solid var(--lp-border);
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: .8rem;
  color: var(--lp-text-muted);
}
.lp-feature__list li::before { content: '•'; color: var(--lp-green); margin-right: 8px; }

/* ── Standings table ── */
.lp-table { width: 100%; border-collapse: collapse; font-size: .87rem; }
.lp-table th {
  text-align: left;
  font-size: .7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--lp-text-muted);
  padding: 0 8px 10px;
}
.lp-table td { padding: 10px 8px; border-top: 1px solid var(--lp-border); color: var(--lp-text-secondary); }
.lp-table td strong { color: var(--lp-green); }
.lp-table tbody tr:first-child td { color: var(--lp-text); }
.lp-table__club { display: flex; align-items: center; gap: 10px; font-weight: 700; color: var(--lp-text) !important; }

.lp-rank { list-style: none; display: flex; flex-direction: column; gap: 10px; font-size: .87rem; }
.lp-rank li { display: flex; justify-content: space-between; gap: 12px; }
.lp-rank strong { color: var(--lp-green); }

/* ── Match card ── */
.lp-match__top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
.lp-match__date { font-size: .8rem; color: var(--lp-text-muted); font-weight: 600; }
.lp-match__teams { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 18px; }
.lp-match__team { display: flex; flex-direction: column; align-items: center; gap: 8px; font-size: .82rem; font-weight: 700; text-align: center; flex: 1; }
.lp-match__vs { font-size: .75rem; font-weight: 800; color: var(--lp-text-muted); }
.lp-match__foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: .78rem; color: var(--lp-text-muted); padding-top: 14px; border-top: 1px solid var(--lp-border); }
.lp-match__time { color: var(--lp-green); font-weight: 700; }
.lp-match__ref { font-size: .78rem; color: var(--lp-text-muted); margin-top: 10px; }

.lp-checks {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 10px 28px;
  margin-top: 28px;
  font-size: .9rem;
  color: var(--lp-text-secondary);
}
.lp-checks--col { flex-direction: column; margin-top: 16px; }

/* ── Disciplina ── */
.lp-case__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 0 0 20px; }
.lp-case__grid dt { font-size: .7rem; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: var(--lp-text-muted); margin-bottom: 4px; }
.lp-case__grid dd { margin: 0; font-size: .88rem; font-weight: 600; }
.lp-case__bar { display: flex; gap: 8px; }
.lp-case__step {
  flex: 1;
  text-align: center;
  font-size: .75rem;
  font-weight: 800;
  padding: 8px 0;
  border-radius: 8px;
  background: var(--lp-bg-raised);
  color: var(--lp-text-muted);
  border: 1px solid var(--lp-border);
}
.lp-case__step--done { background: rgba(239,83,80,.14); color: var(--lp-danger); border-color: rgba(239,83,80,.3); }

/* ── Finanzas ── */
.lp-trend { display: inline-flex; align-items: center; gap: 4px; font-size: .75rem; font-weight: 800; padding: 3px 9px; border-radius: 999px; }
.lp-trend--down { background: rgba(239,83,80,.12); color: var(--lp-danger); }
.lp-ledger { list-style: none; display: flex; flex-direction: column; }
.lp-ledger li { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0; border-top: 1px solid var(--lp-border); }
.lp-ledger li > div { display: flex; flex-direction: column; gap: 2px; font-size: .88rem; font-weight: 600; }
.lp-ledger .lp-muted { font-size: .75rem; font-weight: 500; }
.lp-neg { color: var(--lp-danger); }
.lp-pos { color: var(--lp-green); }

/* ── Roles ── */
.lp-role { text-align: center; }
.lp-role h3 { font-size: 1rem; font-weight: 800; margin-bottom: 6px; }
.lp-role p { line-height: 1.55; }

/* ── Contacto ── */
.lp-contact {
  display: grid;
  gap: 32px;
  grid-template-columns: 1fr;
}
@media (min-width: 900px) { .lp-contact { grid-template-columns: 1fr 1.25fr; align-items: center; } }
.lp-contact__intro { display: flex; flex-direction: column; gap: 8px; }
.lp-contact__card { padding: 28px; }

.lp-form { display: flex; flex-direction: column; gap: 16px; }
.lp-form__row { display: grid; gap: 16px; grid-template-columns: 1fr; }
@media (min-width: 560px) { .lp-form__row { grid-template-columns: 1fr 1fr; } }
.lp-field { display: flex; flex-direction: column; gap: 6px; font-size: .8rem; font-weight: 700; color: var(--lp-text-secondary); }
.lp-field input,
.lp-field select,
.lp-field textarea {
  font: inherit;
  font-size: .92rem;
  font-weight: 500;
  color: var(--lp-text);
  background: var(--lp-bg-raised);
  border: 1px solid var(--lp-border);
  border-radius: var(--lp-radius-sm);
  padding: 11px 14px;
  width: 100%;
  transition: border-color .15s ease, box-shadow .15s ease;
}
.lp-field textarea { resize: vertical; min-height: 100px; }
.lp-field input::placeholder,
.lp-field textarea::placeholder { color: var(--lp-text-muted); }
.lp-field input:focus,
.lp-field select:focus,
.lp-field textarea:focus {
  outline: none;
  border-color: var(--lp-green);
  box-shadow: 0 0 0 3px rgba(0,230,118,.15);
}
.lp-form__error {
  font-size: .85rem;
  color: var(--lp-danger);
  background: rgba(239,83,80,.1);
  border: 1px solid rgba(239,83,80,.25);
  border-radius: var(--lp-radius-sm);
  padding: 10px 14px;
}
.lp-hp { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }

.lp-contact__done { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 24px 0; }
.lp-contact__done h3 { font-size: 1.2rem; font-weight: 800; }
.lp-contact__done .lp-avatar--lg { color: var(--lp-green); margin-bottom: 4px; }

/* ── CTA final ── */
.lp-cta {
  position: relative;
  z-index: 1;
  max-width: 680px;
  margin: 40px auto 0;
  padding: 64px 24px 48px;
  text-align: center;
}
.lp-cta h2 { font-size: 2rem; font-weight: 900; letter-spacing: -0.02em; margin-bottom: 12px; }
.lp-cta p { color: var(--lp-text-secondary); margin-bottom: 28px; }

/* ── Footer ── */
.lp-footer {
  position: relative;
  z-index: 1;
  border-top: 1px solid var(--lp-border);
  padding: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  font-size: .82rem;
  color: var(--lp-text-muted);
}
.lp-footer a { color: var(--lp-text-muted); text-decoration: none; }
.lp-footer a:hover { color: var(--lp-green); }

/* ── Móvil ── */
@media (max-width: 600px) {
  .lp-nav__inner { padding: 12px 16px; gap: 12px; }
  .lp-nav__cta { padding: 8px 14px; font-size: .82rem; }

  .lp-hero { padding: 56px 16px 48px; }
  .lp-hero__subtitle { font-size: .98rem; margin-bottom: 28px; }
  .lp-hero__actions { flex-direction: column; align-items: stretch; margin-bottom: 40px; }
  .lp-hero__stats { gap: 20px 28px; }
  .lp-hero__stat strong { font-size: 1.35rem; }

  .lp-section { padding: 48px 16px; }
  .lp-section h2 { font-size: 1.5rem; }
  .lp-card { padding: 18px; }
  .lp-contact__card { padding: 20px; }

  .lp-table th, .lp-table td { padding-left: 4px; padding-right: 4px; }
  .lp-table__club { gap: 6px; }
  .lp-case__grid { grid-template-columns: 1fr; }
  .lp-checks { gap: 10px; }

  .lp-cta { padding: 48px 16px 40px; }
  .lp-cta h2 { font-size: 1.6rem; }
  .lp-footer { flex-direction: column; gap: 10px; padding: 20px 16px; text-align: center; }
}
</style>
