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
          <span>Liga App</span>
        </div>

        <nav class="lp-nav__links" aria-label="Navegación de la página">
          <a href="#partidos">Partidos</a>
          <a href="#rendimiento">Rendimiento</a>
          <a href="#cuerpo-tecnico">Cuerpo técnico</a>
          <a href="#planes">Planes</a>
        </nav>

        <router-link to="/login" class="lp-btn lp-btn--ghost lp-nav__cta">Iniciar sesión</router-link>
      </div>
    </header>

    <!-- ── Hero ── -->
    <section class="lp-hero">
      <span class="lp-eyebrow">⚡ Temporada 2026 ya en marcha</span>
      <h1 class="lp-hero__title">
        Gestiona tu liga con la <span class="lp-text-gradient">energía</span> que merece
      </h1>
      <p class="lp-hero__subtitle">
        Clubes, jugadores, traspasos y estadísticas en una sola plataforma. Rápida, en vivo y hecha para
        equipos que compiten en serio.
      </p>
      <div class="lp-hero__actions">
        <router-link to="/login" class="lp-btn lp-btn--primary lp-btn--lg">Empezar ahora</router-link>
        <a href="#planes" class="lp-btn lp-btn--secondary lp-btn--lg">Ver planes</a>
      </div>

      <div class="lp-hero__stats">
        <div v-for="s in heroStats" :key="s.label" class="lp-hero__stat">
          <strong>{{ s.value }}</strong>
          <span>{{ s.label }}</span>
        </div>
      </div>
    </section>

    <!-- ── Próximos partidos ── -->
    <section id="partidos" class="lp-section">
      <div class="lp-section__head">
        <div>
          <span class="lp-kicker">En cancha</span>
          <h2>Próximos partidos</h2>
        </div>
        <p class="lp-section__desc">Fixtures en vivo de tus clubes, con horario, sede y competencia de un vistazo.</p>
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
        </article>
      </div>
    </section>

    <!-- ── Seguimiento de rendimiento ── -->
    <section id="rendimiento" class="lp-section">
      <div class="lp-section__head">
        <div>
          <span class="lp-kicker">Datos en vivo</span>
          <h2>Seguimiento de rendimiento</h2>
        </div>
        <p class="lp-section__desc">Sigue la evolución de cada jugador y club fecha a fecha, sin planillas.</p>
      </div>

      <div class="lp-perf">
        <div class="lp-card lp-perf__chart">
          <div class="lp-perf__chart-head">
            <div>
              <p class="lp-perf__player">Bastián Rojas</p>
              <span class="lp-muted">Delantero · Real Andes</span>
            </div>
            <span class="lp-trend lp-trend--up">▲ 18% este mes</span>
          </div>
          <div class="lp-bars" role="img" aria-label="Goles por fecha en las últimas seis jornadas">
            <div v-for="b in performance" :key="b.label" class="lp-bars__col">
              <div class="lp-bars__track">
                <div class="lp-bars__fill" :style="{ height: b.pct + '%' }"></div>
              </div>
              <span>{{ b.label }}</span>
            </div>
          </div>
        </div>

        <div class="lp-perf__tiles">
          <div v-for="t in perfTiles" :key="t.label" class="lp-card lp-tile" :class="`lp-tile--${t.color}`">
            <span class="lp-tile__label">{{ t.label }}</span>
            <strong class="lp-tile__value">{{ t.value }}</strong>
            <span class="lp-trend" :class="t.trend > 0 ? 'lp-trend--up' : 'lp-trend--down'">
              {{ t.trend > 0 ? '▲' : '▼' }} {{ Math.abs(t.trend) }}%
            </span>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Cuerpo técnico ── -->
    <section id="cuerpo-tecnico" class="lp-section">
      <div class="lp-section__head">
        <div>
          <span class="lp-kicker">Perfiles</span>
          <h2>Cuerpo técnico destacado</h2>
        </div>
        <p class="lp-section__desc">Los entrenadores mejor rankeados de la temporada, con su historial de club.</p>
      </div>

      <div class="lp-grid lp-grid--3">
        <article v-for="t in trainers" :key="t.name" class="lp-card lp-trainer">
          <div class="lp-avatar lp-avatar--lg">{{ initials(t.name) }}</div>
          <h3>{{ t.name }}</h3>
          <p class="lp-muted">{{ t.role }} · {{ t.club }}</p>
          <div class="lp-trainer__stats">
            <div>
              <strong>{{ t.winRate }}%</strong>
              <span>Victorias</span>
            </div>
            <div>
              <strong>{{ t.matches }}</strong>
              <span>Dirigidos</span>
            </div>
          </div>
        </article>
      </div>
    </section>

    <!-- ── Planes / Suscripción ── -->
    <section id="planes" class="lp-section">
      <div class="lp-section__head lp-section__head--center">
        <span class="lp-kicker">Planes</span>
        <h2>Elige el plan de tu club</h2>
        <p class="lp-section__desc">Empieza gratis y escala cuando tu liga crezca. Sin contratos forzosos.</p>
      </div>

      <div class="lp-grid lp-grid--3 lp-plans">
        <article
          v-for="p in plans"
          :key="p.name"
          class="lp-card lp-plan"
          :class="{ 'lp-plan--featured': p.featured }"
        >
          <span v-if="p.featured" class="lp-plan__ribbon">Más elegido</span>
          <h3>{{ p.name }}</h3>
          <p class="lp-plan__price">
            {{ p.price }}<span v-if="p.price !== 'Gratis'">/mes</span>
          </p>
          <ul class="lp-plan__features">
            <li v-for="f in p.features" :key="f">✓ {{ f }}</li>
          </ul>
          <router-link
            to="/login"
            class="lp-btn lp-btn--block"
            :class="p.featured ? 'lp-btn--primary' : 'lp-btn--secondary'"
          >
            {{ p.cta }}
          </router-link>
        </article>
      </div>
    </section>

    <!-- ── CTA final ── -->
    <section class="lp-cta">
      <h2>¿Listo para llevar tu liga al siguiente nivel?</h2>
      <p>Crea tu organización en minutos y empieza a gestionar clubes, jugadores y traspasos hoy mismo.</p>
      <router-link to="/login" class="lp-btn lp-btn--primary lp-btn--lg">Crear mi cuenta gratis</router-link>
    </section>

    <footer class="lp-footer">
      <span>© {{ year }} Liga App</span>
      <router-link to="/login">Iniciar sesión</router-link>
    </footer>
  </div>
</template>

<script setup>
const year = new Date().getFullYear();

const heroStats = [
  { value: '120+', label: 'Clubes activos' },
  { value: '4.800+', label: 'Jugadores' },
  { value: '99.9%', label: 'Disponibilidad' },
];

const matches = [
  { id: 1, home: 'Real Andes', away: 'Atlético Sur', date: 'Sáb 09 Ago', time: '18:00', venue: 'Estadio Municipal', competition: 'Liga 1ª División', badgeColor: 'green' },
  { id: 2, home: 'Halcones FC', away: 'Deportivo Norte', date: 'Dom 10 Ago', time: '16:30', venue: 'Complejo Halcones', competition: 'Copa Liga', badgeColor: 'blue' },
  { id: 3, home: 'Unión Central', away: 'Cóndor FC', date: 'Dom 10 Ago', time: '19:00', venue: 'Estadio Central', competition: 'Liga 1ª División', badgeColor: 'green' },
];

const performance = [
  { label: 'F1', pct: 40 },
  { label: 'F2', pct: 55 },
  { label: 'F3', pct: 35 },
  { label: 'F4', pct: 70 },
  { label: 'F5', pct: 60 },
  { label: 'F6', pct: 90 },
];

const perfTiles = [
  { label: 'Goles', value: '128', trend: 12, color: 'green' },
  { label: 'Asistencias', value: '84', trend: 8, color: 'blue' },
  { label: 'Minutos jugados', value: '45.2k', trend: -3, color: 'gold' },
];

const trainers = [
  { name: 'Marcelo Ibáñez', role: 'DT', club: 'Real Andes', winRate: 62, matches: 48 },
  { name: 'Fernanda Ruiz', role: 'DT', club: 'Halcones FC', winRate: 55, matches: 36 },
  { name: 'Tomás Herrera', role: 'DT', club: 'Unión Central', winRate: 58, matches: 41 },
];

const plans = [
  {
    name: 'Básico',
    price: 'Gratis',
    features: ['1 club', 'Hasta 25 jugadores', 'Estadísticas básicas'],
    cta: 'Comenzar gratis',
    featured: false,
  },
  {
    name: 'Pro',
    price: '$19.990',
    features: ['Clubes ilimitados', 'Importación masiva', 'Reportes avanzados', 'Gestión de traspasos'],
    cta: 'Elegir Pro',
    featured: true,
  },
  {
    name: 'Elite',
    price: '$49.990',
    features: ['Todo lo de Pro', 'Multi-organización', 'Soporte prioritario', 'Acceso API'],
    cta: 'Elegir Elite',
    featured: false,
  },
];

function initials(name) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
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
  gap: 28px;
}
.lp-nav__links a {
  color: var(--lp-text-secondary);
  text-decoration: none;
  font-size: .9rem;
  font-weight: 600;
  transition: color .15s ease;
}
.lp-nav__links a:hover { color: var(--lp-text); }

@media (min-width: 860px) {
  .lp-nav__links { display: flex; }
}

/* ── Buttons ── */
.lp-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
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
.lp-btn--primary {
  background: linear-gradient(135deg, var(--lp-green), #33ec8e);
  color: #04120a;
  box-shadow: 0 0 0 rgba(0,230,118,0);
}
.lp-btn--primary:hover {
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
.lp-nav__cta { display: none; }
@media (min-width: 640px) { .lp-nav__cta { display: inline-flex; } }

/* ── Hero ── */
.lp-hero {
  position: relative;
  z-index: 1;
  max-width: 780px;
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
}
.lp-section__head {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 32px;
}
.lp-section__head--center { align-items: center; text-align: center; }
.lp-kicker {
  font-size: .78rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .1em;
  color: var(--lp-blue);
}
.lp-section h2 { font-size: 1.85rem; font-weight: 800; letter-spacing: -0.02em; margin-top: 4px; }
.lp-section__desc { color: var(--lp-text-secondary); max-width: 460px; font-size: .95rem; }
.lp-muted { color: var(--lp-text-muted); font-size: .85rem; }

/* ── Card / Grid ── */
.lp-card {
  background: var(--lp-card);
  border: 1px solid var(--lp-border);
  border-radius: var(--lp-radius-md);
  padding: 22px;
  transition: border-color .2s ease, transform .2s ease;
}
.lp-card:hover { border-color: rgba(0,230,118,.35); transform: translateY(-3px); }

.lp-grid { display: grid; gap: 20px; }
.lp-grid--3 { grid-template-columns: 1fr; }
@media (min-width: 720px) { .lp-grid--3 { grid-template-columns: repeat(3, 1fr); } }

/* ── Badge ── */
.lp-badge {
  font-size: .72rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 999px;
}
.lp-badge--green { background: rgba(0,230,118,.12); color: var(--lp-green); }
.lp-badge--blue  { background: rgba(79,195,247,.12); color: var(--lp-blue); }

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
.lp-avatar--lg {
  width: 64px;
  height: 64px;
  font-size: 1.1rem;
  margin: 0 auto 14px;
  background: linear-gradient(135deg, rgba(0,230,118,.18), rgba(79,195,247,.18));
  color: var(--lp-text);
}

/* ── Match card ── */
.lp-match__top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
.lp-match__date { font-size: .8rem; color: var(--lp-text-muted); font-weight: 600; }
.lp-match__teams { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 18px; }
.lp-match__team { display: flex; flex-direction: column; align-items: center; gap: 8px; font-size: .82rem; font-weight: 700; text-align: center; flex: 1; }
.lp-match__vs { font-size: .75rem; font-weight: 800; color: var(--lp-text-muted); }
.lp-match__foot { display: flex; align-items: center; justify-content: space-between; font-size: .78rem; color: var(--lp-text-muted); padding-top: 14px; border-top: 1px solid var(--lp-border); }
.lp-match__time { color: var(--lp-green); font-weight: 700; }

/* ── Performance ── */
.lp-perf { display: grid; gap: 20px; grid-template-columns: 1fr; }
@media (min-width: 860px) { .lp-perf { grid-template-columns: 1.6fr 1fr; } }

.lp-perf__chart-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 10px; }
.lp-perf__player { font-weight: 800; font-size: 1rem; }

.lp-trend { display: inline-flex; align-items: center; gap: 4px; font-size: .75rem; font-weight: 800; padding: 3px 9px; border-radius: 999px; }
.lp-trend--up   { background: rgba(0,230,118,.12); color: var(--lp-green); }
.lp-trend--down { background: rgba(239,83,80,.12); color: var(--lp-danger); }

.lp-bars { display: flex; align-items: flex-end; gap: 14px; height: 160px; }
.lp-bars__col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px; height: 100%; }
.lp-bars__track { width: 100%; flex: 1; display: flex; align-items: flex-end; background: var(--lp-bg-raised); border-radius: 8px; overflow: hidden; }
.lp-bars__fill {
  width: 100%;
  border-radius: 8px 8px 0 0;
  background: linear-gradient(180deg, var(--lp-green), var(--lp-green-dark));
  transition: height .6s ease;
}
.lp-bars__col span { font-size: .72rem; color: var(--lp-text-muted); font-weight: 700; }

.lp-perf__tiles { display: flex; flex-direction: column; gap: 16px; }
.lp-tile { display: flex; flex-direction: column; gap: 6px; position: relative; overflow: hidden; }
.lp-tile::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; }
.lp-tile--green::before { background: var(--lp-green); }
.lp-tile--blue::before  { background: var(--lp-blue); }
.lp-tile--gold::before  { background: var(--lp-gold); }
.lp-tile__label { font-size: .75rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--lp-text-muted); }
.lp-tile__value { font-size: 1.7rem; font-weight: 800; }

/* ── Trainer ── */
.lp-trainer { text-align: center; }
.lp-trainer h3 { font-size: 1rem; font-weight: 800; margin-bottom: 2px; }
.lp-trainer__stats { display: flex; justify-content: center; gap: 28px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--lp-border); }
.lp-trainer__stats strong { display: block; font-size: 1.15rem; font-weight: 800; }
.lp-trainer__stats span { font-size: .72rem; color: var(--lp-text-muted); }

/* ── Plans ── */
.lp-plan { position: relative; display: flex; flex-direction: column; gap: 16px; }
.lp-plan--featured { border-color: var(--lp-green); box-shadow: 0 0 40px rgba(0,230,118,.12); }
.lp-plan__ribbon {
  position: absolute;
  top: -12px;
  right: 20px;
  background: var(--lp-green);
  color: #04120a;
  font-size: .7rem;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: 999px;
}
.lp-plan h3 { font-size: 1.1rem; font-weight: 800; }
.lp-plan__price { font-size: 2rem; font-weight: 900; }
.lp-plan__price span { font-size: .9rem; font-weight: 600; color: var(--lp-text-muted); }
.lp-plan__features { list-style: none; display: flex; flex-direction: column; gap: 10px; font-size: .87rem; color: var(--lp-text-secondary); flex: 1; }

/* ── CTA final ── */
.lp-cta {
  position: relative;
  z-index: 1;
  max-width: 680px;
  margin: 40px auto 0;
  padding: 64px 24px 96px;
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
</style>
