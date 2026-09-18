/**
 * Schedule Generator (pure helpers, sin dependencias de DB)
 *
 * Algoritmo de asignación automática de cancha/horario para los
 * partidos de una fecha de calendario, usado por
 * match_scheduling_specialist.js (PREVIEW_SCHEDULE).
 *
 * Contexto de negocio: una fecha de calendario cruza varios torneos
 * (uno por categoría) sobre la misma temporada. Un club que juega
 * 2-3 categorías el mismo día debe quedar anclado a la MISMA cancha
 * en bloques horarios consecutivos (el rival puede cambiar entre
 * categorías). Cuando no alcanza continuidad para todos, la falla se
 * reparte entre clubes a lo largo de la temporada vía `fairnessCounts`.
 *
 * Todas las funciones trabajan sobre arrays de IDs (string) y
 * estructuras planas — no tocan la base de datos, por lo que se
 * pueden probar de forma aislada.
 */

/**
 * Agrupa los partidos de una fecha en componentes conectados por club:
 * dos clubes quedan en el mismo componente si comparten al menos un
 * partido (arista club↔club). Resuelve correctamente los "triángulos"
 * (A-B en una categoría, A-C en otra, B-C en una tercera quedan en un
 * solo componente de 3 clubes), vía union-find.
 *
 * @param {{ matchId: string, homeClubId: string, awayClubId: string }[]} matches
 * @returns {{ clubIds: string[], matches: object[] }[]} componentes, en el
 *   orden en que aparecen por primera vez en `matches` (determinístico).
 */
export function buildClubComponents(matches) {
  const parent = new Map();

  const find = (x) => {
    if (!parent.has(x)) parent.set(x, x);
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root);
    let cur = x;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur);
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };

  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (const m of matches) {
    find(m.homeClubId);
    find(m.awayClubId);
    union(m.homeClubId, m.awayClubId);
  }

  const groups = new Map(); // root → { clubIds: Set, matches: [], firstIndex }
  matches.forEach((m, idx) => {
    const root = find(m.homeClubId);
    if (!groups.has(root)) {
      groups.set(root, { clubIds: new Set(), matches: [], firstIndex: idx });
    }
    const group = groups.get(root);
    group.clubIds.add(m.homeClubId);
    group.clubIds.add(m.awayClubId);
    group.matches.push(m);
    if (idx < group.firstIndex) group.firstIndex = idx;
  });

  return Array.from(groups.values())
    .sort((a, b) => a.firstIndex - b.firstIndex)
    .map((g) => ({ clubIds: Array.from(g.clubIds), matches: g.matches }));
}

/**
 * Ordena los partidos de un componente por `scheduleOrder` ascendente
 * (los `null`/`undefined` van al final). Usa `Array.prototype.sort`,
 * que es estable en Node/V8 — el orden original se preserva como
 * desempate, garantizando un resultado determinístico.
 *
 * @param {{ scheduleOrder: number|null }[]} matchesInComponent
 * @returns {object[]} copia ordenada (no muta el array de entrada)
 */
export function orderChainByScheduleOrder(matchesInComponent) {
  return [...matchesInComponent].sort((a, b) => {
    const av = a.scheduleOrder ?? Infinity;
    const bv = b.scheduleOrder ?? Infinity;
    return av - bv;
  });
}

/**
 * Score de fairness de un componente: el MÍNIMO de `fairnessCounts`
 * entre todos sus clubes (default 0 si un club no tiene historial).
 * Un score bajo indica que, entre los clubes del componente, hay al
 * menos uno que casi no ha sufrido distribución fallida esta temporada.
 *
 * @param {string[]} clubIds
 * @param {Record<string, number>} fairnessCounts
 * @returns {number}
 */
export function computeFairnessScore(clubIds, fairnessCounts = {}) {
  return clubIds.reduce((min, clubId) => {
    const count = fairnessCounts[clubId] ?? 0;
    return count < min ? count : min;
  }, Infinity);
}

/**
 * Busca, recorriendo `venues` en orden, un bloque de `length` slots
 * CONSECUTIVOS libres dentro de `[0, upperBound)` en alguna cancha.
 */
function findConsecutiveBlock(venues, venueState, length, upperBound) {
  for (const venue of venues) {
    const state = venueState.get(venue.id);
    const limit = Math.min(upperBound, state.length);
    for (let start = 0; start + length <= limit; start++) {
      let free = true;
      for (let i = 0; i < length; i++) {
        if (state[start + i] !== null) { free = false; break; }
      }
      if (free) return { venueId: venue.id, start };
    }
  }
  return null;
}

/** Busca el primer slot libre en cualquier cancha, recorriendo TODOS los slots (incluido el de reserva). */
function findFirstFreeSlotAnywhere(venues, venueState) {
  for (const venue of venues) {
    const state = venueState.get(venue.id);
    for (let i = 0; i < state.length; i++) {
      if (state[i] === null) return { venueId: venue.id, index: i };
    }
  }
  return null;
}

/**
 * Arma la propuesta de cancha/horario para los partidos de una fecha.
 *
 * @param {Object} params
 * @param {{ matchId: string, homeClubId: string, awayClubId: string, categoryId: string, scheduleOrder: number|null }[]} params.matches
 * @param {{ id: string, slots: { index: number, time: string, label: string }[] }[]} params.venues
 * @param {Record<string, number>} [params.fairnessCounts]
 * @returns {{ assignments: { matchId: string, venueId: string, matchTime: string, timeSlot: string }[], failedClubIds: string[], partiallyFailedClubIds: string[] }}
 */
export function buildScheduleProposal({ matches, venues, fairnessCounts = {} }) {
  if (!matches || matches.length === 0) {
    return { assignments: [], failedClubIds: [], partiallyFailedClubIds: [] };
  }
  if (!venues || venues.length === 0) {
    throw new Error('No hay capacidad suficiente: no se recibieron canchas.');
  }

  const normalSlotCount = Math.min(...venues.map((v) => v.slots.length)) - 1;

  const components = buildClubComponents(matches).map((component) => ({
    ...component,
    chain: orderChainByScheduleOrder(component.matches),
  }));

  // Prioridad: cadenas más largas primero; en empate, protege a los
  // clubes que YA sufrieron más distribuciones fallidas esta temporada
  // (fairnessScore más ALTO primero) para no repetir siempre al mismo
  // club — así la falla, cuando no alcanza continuidad para todos, cae
  // sobre clubes con menos historial de fallas (que aún no les "tocó").
  const ordered = [...components].sort((a, b) => {
    const lenDiff = b.chain.length - a.chain.length;
    if (lenDiff !== 0) return lenDiff;
    const scoreA = computeFairnessScore(a.clubIds, fairnessCounts);
    const scoreB = computeFairnessScore(b.clubIds, fairnessCounts);
    return scoreB - scoreA;
  });

  const venueState = new Map(venues.map((v) => [v.id, new Array(v.slots.length).fill(null)]));
  const rawAssignments = [];
  const failedClubIds = new Set();
  const partiallyFailedClubIds = new Set();

  const place = (chainSlice, venueId, startIndex) => {
    const state = venueState.get(venueId);
    chainSlice.forEach((match, offset) => {
      state[startIndex + offset] = match.matchId;
      rawAssignments.push({ matchId: match.matchId, venueId, index: startIndex + offset });
    });
  };

  const placeLoose = (match) => {
    const free = findFirstFreeSlotAnywhere(venues, venueState);
    if (!free) throw new Error('No hay capacidad suficiente para programar todos los partidos de la fecha.');
    place([match], free.venueId, free.index);
  };

  for (const component of ordered) {
    const { chain, clubIds } = component;

    const full = findConsecutiveBlock(venues, venueState, chain.length, normalSlotCount);
    if (full) {
      place(chain, full.venueId, full.start);
      continue;
    }

    if (chain.length >= 2) {
      const partial = findConsecutiveBlock(venues, venueState, 2, normalSlotCount);
      if (partial) {
        place(chain.slice(0, 2), partial.venueId, partial.start);
        for (const match of chain.slice(2)) placeLoose(match);
        clubIds.forEach((id) => partiallyFailedClubIds.add(id));
        continue;
      }
    }

    for (const match of chain) placeLoose(match);
    if (chain.length >= 2) clubIds.forEach((id) => failedClubIds.add(id));
  }

  const venueById = new Map(venues.map((v) => [v.id, v]));
  const assignments = rawAssignments.map(({ matchId, venueId, index }) => {
    const slot = venueById.get(venueId).slots[index];
    return { matchId, venueId, matchTime: slot.time, timeSlot: slot.label };
  });

  return {
    assignments,
    failedClubIds: Array.from(failedClubIds),
    partiallyFailedClubIds: Array.from(partiallyFailedClubIds),
  };
}
