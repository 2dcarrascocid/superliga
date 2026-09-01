/* Configuración base oscura para Chart.js — importar y extender */

export const CHART_COLORS = [
  '#00e676', // green
  '#4fc3f7', // blue
  '#ffd54f', // gold
  '#ff7043', // orange
  '#ab47bc', // purple
  '#26c6da', // cyan
  '#ec407a', // pink
  '#9ccc65', // lime
];

export const CHART_SEMANTIC = {
  win:   '#00e676',
  draw:  '#ffd54f',
  loss:  '#ef5350',
  home:  '#4fc3f7',
  away:  '#ff7043',
  goals: '#00e676',
  xg:    'rgba(0,230,118,0.4)',
};

const GRID_COLOR  = 'rgba(255,255,255,0.06)';
const TICK_COLOR  = '#505668';
const FONT_FAMILY = "'Inter', system-ui, sans-serif";

export const darkDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 400, easing: 'easeOutQuart' },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#1a1c23',
      borderColor: '#272a34',
      borderWidth: 1,
      titleColor: '#9aa0bb',
      bodyColor: '#e4e7f2',
      padding: 12,
      cornerRadius: 10,
      titleFont: { family: FONT_FAMILY, size: 11, weight: '600' },
      bodyFont:  { family: FONT_FAMILY, size: 13, weight: '600' },
      callbacks: {},
    },
  },
  scales: {
    x: {
      grid: { color: GRID_COLOR, drawBorder: false },
      ticks: { color: TICK_COLOR, font: { family: FONT_FAMILY, size: 11 } },
      border: { display: false },
    },
    y: {
      grid: { color: GRID_COLOR, drawBorder: false },
      ticks: { color: TICK_COLOR, font: { family: FONT_FAMILY, size: 11 } },
      border: { display: false },
      beginAtZero: true,
    },
  },
};

/* ── Preset: Línea de puntos por jornada ── */
export function linePointsConfig(labels, data, opts = {}) {
  return {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: opts.label || 'Puntos',
        data,
        borderColor: CHART_COLORS[0],
        backgroundColor: 'rgba(0,230,118,0.08)',
        borderWidth: 2.5,
        pointRadius: 4,
        pointBackgroundColor: CHART_COLORS[0],
        pointBorderColor: '#0d0e12',
        pointBorderWidth: 2,
        tension: 0.35,
        fill: true,
      }],
    },
    options: { ...darkDefaults, ...opts.overrides },
  };
}

/* ── Preset: Barras goles favor/contra ── */
export function goalsBarConfig(labels, favor, contra) {
  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Goles a favor',
          data: favor,
          backgroundColor: 'rgba(0,230,118,0.7)',
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: 'Goles en contra',
          data: contra.map(v => -v),
          backgroundColor: 'rgba(239,83,80,0.7)',
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    },
    options: {
      ...darkDefaults,
      scales: {
        ...darkDefaults.scales,
        y: {
          ...darkDefaults.scales.y,
          ticks: {
            ...darkDefaults.scales.y.ticks,
            callback: v => Math.abs(v),
          },
        },
      },
    },
  };
}

/* ── Preset: Donut W/D/L ── */
export function wdlDonutConfig(wins, draws, losses) {
  return {
    type: 'doughnut',
    data: {
      labels: ['Victorias', 'Empates', 'Derrotas'],
      datasets: [{
        data: [wins, draws, losses],
        backgroundColor: [CHART_SEMANTIC.win, CHART_SEMANTIC.draw, CHART_SEMANTIC.loss],
        borderWidth: 0,
        hoverOffset: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      animation: { duration: 500 },
      plugins: {
        legend: { display: false },
        tooltip: darkDefaults.plugins.tooltip,
      },
    },
  };
}

/* ── Preset: Radar de atributos de equipo ── */
export function teamRadarConfig(labels, datasets) {
  return {
    type: 'radar',
    data: {
      labels,
      datasets: datasets.map((ds, i) => ({
        ...ds,
        borderColor: CHART_COLORS[i],
        backgroundColor: CHART_COLORS[i].replace(')', ',0.1)').replace('rgb', 'rgba'),
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: CHART_COLORS[i],
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      scales: {
        r: {
          grid:      { color: GRID_COLOR },
          angleLines:{ color: GRID_COLOR },
          ticks:     { display: false, backdropColor: 'transparent' },
          pointLabels: { color: TICK_COLOR, font: { family: FONT_FAMILY, size: 11 } },
        },
      },
      plugins: { legend: { display: false }, tooltip: darkDefaults.plugins.tooltip },
    },
  };
}
