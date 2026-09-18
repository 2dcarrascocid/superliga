import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildScheduleProposal,
  buildClubComponents,
  orderChainByScheduleOrder,
  computeFairnessScore,
} from '../schedule_generator.js';

// Canchas "típicas" del negocio: 4 slots (3 normales + 1 de reserva).
function makeVenues4() {
  const times = [
    { time: '14:00:00', label: '14:00' },
    { time: '15:10:00', label: '15:10' },
    { time: '16:20:00', label: '16:20' },
    { time: '17:30:00', label: '17:30' },
  ];
  return ['v1', 'v2', 'v3'].map((id) => ({
    id,
    slots: times.map((t, index) => ({ index, ...t })),
  }));
}

// Canchas de 6 slots (5 normales + 1 de reserva) — usadas en el test de
// sobrecarga parcial (test 2) para poder demostrar el camino real de
// "2 continuos + 1 suelto en reserva": con canchas de 4 slots, 3 canchas
// de capacidad normal 3 y 4 cadenas de largo 3 consumen EXACTAMENTE toda
// la capacidad normal (9 slots) sin dejar ningún hueco de 2 consecutivos
// en ninguna cancha, así que la 4ta cadena cae directo a fallo total
// (nunca parcial) — es una consecuencia matemática de esa combinación
// exacta de números, no del algoritmo. Con 6 slots por cancha queda un
// remanente de 2 slots consecutivos tras la primera cadena que ocupa una
// cancha, que es justo lo que necesita la 4ta cadena para su tramo parcial.
function makeVenues6() {
  const times = [
    { time: '14:00:00', label: '14:00' },
    { time: '15:10:00', label: '15:10' },
    { time: '16:20:00', label: '16:20' },
    { time: '17:30:00', label: '17:30' },
    { time: '18:40:00', label: '18:40' },
    { time: '19:50:00', label: '19:50' },
  ];
  return ['v1', 'v2', 'v3'].map((id) => ({
    id,
    slots: times.map((t, index) => ({ index, ...t })),
  }));
}

function chainOf(prefix, clubA, clubB, categories) {
  return categories.map((categoryId, i) => ({
    matchId: `${prefix}-${i}`,
    homeClubId: clubA,
    awayClubId: clubB,
    categoryId,
    scheduleOrder: i + 1,
  }));
}

function assignmentsByMatch(result) {
  return Object.fromEntries(result.assignments.map((a) => [a.matchId, a]));
}

// ── 1. Caso ideal: 6 clubes, 3 componentes de 3 partidos, 3 canchas ────────

test('6 clubes ideal: los 3 componentes quedan continuos en slots 0-1-2, sin fallas', () => {
  const matches = [
    ...chainOf('AB', 'A', 'B', ['cat-1', 'cat-2', 'cat-3']),
    ...chainOf('CD', 'C', 'D', ['cat-1', 'cat-2', 'cat-3']),
    ...chainOf('EF', 'E', 'F', ['cat-1', 'cat-2', 'cat-3']),
  ];
  const result = buildScheduleProposal({ matches, venues: makeVenues4() });

  assert.deepEqual(result.failedClubIds, []);
  assert.deepEqual(result.partiallyFailedClubIds, []);
  assert.equal(result.assignments.length, 9);

  const byMatch = assignmentsByMatch(result);
  for (const prefix of ['AB', 'CD', 'EF']) {
    const venueId = byMatch[`${prefix}-0`].venueId;
    const timesUsed = [0, 1, 2].map((i) => byMatch[`${prefix}-${i}`]);
    // Los 3 partidos de la cadena quedan en la MISMA cancha...
    assert.ok(timesUsed.every((a) => a.venueId === venueId));
    // ...en horarios consecutivos (14:00, 15:10, 16:20 — nunca 17:30, que es la reserva).
    assert.deepEqual(timesUsed.map((a) => a.matchTime), ['14:00:00', '15:10:00', '16:20:00']);
  }
  // El slot de reserva (17:30) de ninguna cancha se usó.
  assert.ok(!result.assignments.some((a) => a.matchTime === '17:30:00'));
});

// ── 2. Sobrecarga leve: 4 componentes de 3, 3 canchas → 1 queda parcial ────

test('4 componentes de 3 con 3 canchas: uno resuelve parcial (2 continuos + 1 en reserva), ninguno falla total', () => {
  const matches = [
    ...chainOf('AB', 'A', 'B', ['cat-1', 'cat-2', 'cat-3']),
    ...chainOf('CD', 'C', 'D', ['cat-1', 'cat-2', 'cat-3']),
    ...chainOf('EF', 'E', 'F', ['cat-1', 'cat-2', 'cat-3']),
    ...chainOf('GH', 'G', 'H', ['cat-1', 'cat-2', 'cat-3']),
  ];
  const result = buildScheduleProposal({ matches, venues: makeVenues6() });

  // Ningún club queda con fallo TOTAL — a lo sumo, alguno resuelve parcial
  // (2 partidos continuos + 1 suelto, ver reparto de huecos más abajo).
  assert.deepEqual(result.failedClubIds, []);
  assert.equal(result.partiallyFailedClubIds.length, 2); // el par de clubes de la cadena sacrificada
  assert.equal(result.assignments.length, 12);

  // Las primeras 3 cadenas en orden de aparición (AB, CD, EF) alcanzan
  // continuidad total: sus 3 partidos comparten cancha y quedan en 3
  // horarios consecutivos.
  const byMatch = assignmentsByMatch(result);
  for (const prefix of ['AB', 'CD', 'EF']) {
    const assigns = [0, 1, 2].map((i) => byMatch[`${prefix}-${i}`]);
    assert.ok(assigns.every((a) => a.venueId === assigns[0].venueId), `${prefix} debe quedar en una sola cancha`);
  }

  // La 4ta cadena (GH) es la sacrificada: sus clubes quedan en
  // partiallyFailedClubIds (nunca en failedClubIds).
  assert.ok(result.partiallyFailedClubIds.includes('G'));
  assert.ok(result.partiallyFailedClubIds.includes('H'));
  assert.equal(Object.keys(byMatch).filter((id) => id.startsWith('GH-')).length, 3);

  // No hay 2 partidos apuntando al mismo (venueId, matchTime) — el
  // algoritmo nunca pisa una asignación ya hecha.
  const seen = new Set();
  for (const a of result.assignments) {
    const key = `${a.venueId}|${a.matchTime}`;
    assert.equal(seen.has(key), false, `slot duplicado: ${key}`);
    seen.add(key);
  }
});

// ── 3. Sobrecarga fuerte: 5 componentes de 3, 3 canchas → prioriza por fairness ─

test('sobrecarga fuerte: el componente con fairness BAJO es el sacrificado, el de fairness ALTO queda protegido', () => {
  const matches = [
    ...chainOf('HIGH', 'club-high-1', 'club-high-2', ['cat-1', 'cat-2', 'cat-3']),
    ...chainOf('MID1', 'club-mid1-1', 'club-mid1-2', ['cat-1', 'cat-2', 'cat-3']),
    ...chainOf('MID2', 'club-mid2-1', 'club-mid2-2', ['cat-1', 'cat-2', 'cat-3']),
    ...chainOf('MID3', 'club-mid3-1', 'club-mid3-2', ['cat-1', 'cat-2', 'cat-3']),
    ...chainOf('LOW', 'club-low-1', 'club-low-2', ['cat-1', 'cat-2', 'cat-3']),
  ];
  const fairnessCounts = {
    'club-high-1': 10, 'club-high-2': 10,
    'club-mid1-1': 5, 'club-mid1-2': 5,
    'club-mid2-1': 4, 'club-mid2-2': 4,
    'club-mid3-1': 3, 'club-mid3-2': 3,
    'club-low-1': 0, 'club-low-2': 0,
  };

  const result = buildScheduleProposal({ matches, venues: makeVenues6(), fairnessCounts });

  const failedOrPartial = new Set([...result.failedClubIds, ...result.partiallyFailedClubIds]);
  assert.ok(failedOrPartial.has('club-low-1') && failedOrPartial.has('club-low-2'));
  assert.ok(!failedOrPartial.has('club-high-1') && !failedOrPartial.has('club-high-2'));
});

// ── 4. Cadena de largo 1 nunca falla ────────────────────────────────────────

test('un club con cadena de largo 1 nunca queda en failedClubIds ni partiallyFailedClubIds', () => {
  const matches = [
    ...chainOf('AB', 'A', 'B', ['cat-1', 'cat-2', 'cat-3']),
    ...chainOf('CD', 'C', 'D', ['cat-1', 'cat-2', 'cat-3']),
    ...chainOf('EF', 'E', 'F', ['cat-1', 'cat-2', 'cat-3']),
    { matchId: 'solo-1', homeClubId: 'SOLO_A', awayClubId: 'SOLO_B', categoryId: 'cat-1', scheduleOrder: 1 },
  ];
  const result = buildScheduleProposal({ matches, venues: makeVenues4() });

  assert.ok(!result.failedClubIds.includes('SOLO_A'));
  assert.ok(!result.failedClubIds.includes('SOLO_B'));
  assert.ok(!result.partiallyFailedClubIds.includes('SOLO_A'));
  assert.ok(!result.partiallyFailedClubIds.includes('SOLO_B'));
  // Igual quedó asignado a algún slot (aunque sea el de reserva).
  assert.ok(result.assignments.some((a) => a.matchId === 'solo-1'));
});

// ── 5. Determinismo ──────────────────────────────────────────────────────

test('empate total de tamaño y fairness: correr 2 veces da exactamente el mismo resultado', () => {
  const matches = [
    ...chainOf('AB', 'A', 'B', ['cat-1', 'cat-2', 'cat-3']),
    ...chainOf('CD', 'C', 'D', ['cat-1', 'cat-2', 'cat-3']),
    ...chainOf('EF', 'E', 'F', ['cat-1', 'cat-2', 'cat-3']),
    ...chainOf('GH', 'G', 'H', ['cat-1', 'cat-2', 'cat-3']),
  ];
  const run1 = buildScheduleProposal({ matches, venues: makeVenues4() });
  const run2 = buildScheduleProposal({ matches, venues: makeVenues4() });

  assert.deepEqual(run1, run2);
});

// ── 6. scheduleOrder null no rompe ni desordena ────────────────────────────

test('scheduleOrder null en algunos partidos no lanza excepción ni desordena el resto', () => {
  const matches = [
    { matchId: 'AB-0', homeClubId: 'A', awayClubId: 'B', categoryId: 'cat-1', scheduleOrder: 1 },
    { matchId: 'AB-1', homeClubId: 'A', awayClubId: 'B', categoryId: 'cat-2', scheduleOrder: null },
    { matchId: 'AB-2', homeClubId: 'A', awayClubId: 'B', categoryId: 'cat-3', scheduleOrder: 2 },
  ];
  assert.doesNotThrow(() => buildScheduleProposal({ matches, venues: makeVenues4() }));

  const ordered = orderChainByScheduleOrder(matches);
  // scheduleOrder 1 y 2 van antes que null (que se manda al final).
  assert.deepEqual(ordered.map((m) => m.matchId), ['AB-0', 'AB-2', 'AB-1']);
});

// ── 7. Triángulo de 3 clubes → un solo componente ──────────────────────────

test('triángulo A-B, A-C, B-C se agrupa en un solo componente de 3 partidos', () => {
  const matches = [
    { matchId: 'm-ab', homeClubId: 'A', awayClubId: 'B', categoryId: 'super-senior', scheduleOrder: 1 },
    { matchId: 'm-ac', homeClubId: 'A', awayClubId: 'C', categoryId: 'senior', scheduleOrder: 2 },
    { matchId: 'm-bc', homeClubId: 'B', awayClubId: 'C', categoryId: 'dorados', scheduleOrder: 3 },
  ];

  const components = buildClubComponents(matches);
  assert.equal(components.length, 1);
  assert.equal(components[0].matches.length, 3);
  assert.deepEqual(components[0].clubIds.sort(), ['A', 'B', 'C']);

  const result = buildScheduleProposal({ matches, venues: makeVenues4() });
  assert.equal(result.assignments.length, 3);
  assert.deepEqual(result.failedClubIds, []);
  assert.deepEqual(result.partiallyFailedClubIds, []);

  const seen = new Set();
  for (const a of result.assignments) {
    const key = `${a.venueId}|${a.matchTime}`;
    assert.equal(seen.has(key), false, `slot duplicado: ${key}`);
    seen.add(key);
  }
});

// ── Helpers sueltos ─────────────────────────────────────────────────────

test('computeFairnessScore devuelve el mínimo entre los clubes del componente, default 0', () => {
  assert.equal(computeFairnessScore(['a', 'b'], { a: 3, b: 1 }), 1);
  assert.equal(computeFairnessScore(['a', 'c'], { a: 3 }), 0); // 'c' sin historial → 0
  assert.equal(computeFairnessScore(['x'], {}), 0);
});

test('buildClubComponents no duplica partidos entre componentes', () => {
  const matches = [
    { matchId: 'm1', homeClubId: 'A', awayClubId: 'B', categoryId: 'c1', scheduleOrder: 1 },
    { matchId: 'm2', homeClubId: 'C', awayClubId: 'D', categoryId: 'c1', scheduleOrder: 1 },
  ];
  const components = buildClubComponents(matches);
  assert.equal(components.length, 2);
  const totalMatches = components.reduce((sum, c) => sum + c.matches.length, 0);
  assert.equal(totalMatches, 2);
});
