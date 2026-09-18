/**
 * Helper compartido — Deporte de la liga (lg_orgs.sport_id).
 *
 * Usado por:
 *   - org_specialist.js (GET_ORG_SPORT / UPDATE_ORG_SPORT del panel de
 *     configuración de administrador)
 *
 * El frontend deriva el tema de colores de la app a partir de `sportSlug` —
 * este mapeo es la única fuente de verdad de esa conversión nombre→slug.
 * Matching por palabra clave (normalizado sin acentos, case-insensitive)
 * en vez de un mapa exacto {name: slug}: el catálogo real de lg_sports en
 * este proyecto usa nombres en español ("Basquetbol", "Voleibol"), no los
 * nombres en inglés del seed de bootstrap.js ("Basketball", "Volleyball")
 * — un mapa exacto por el nombre en inglés dejaba sportSlug siempre en el
 * default 'futbol' sin importar el deporte real configurado (bug
 * reportado: el acento de color nunca cambiaba al elegir otro deporte).
 * El mismo criterio de keywords ya lo usa AdminSettingsModal.vue en el
 * frontend para resolver sportId a partir del catálogo — se replica acá
 * para que ambos lados sean robustos a variaciones de nombre por igual.
 * Deporte no reconocido o sin configurar → 'futbol' (mismo criterio de
 * "no romper orgs que nunca configuraron nada" usado en
 * scheduling_settings.js).
 */

const SLUG_KEYWORDS = {
  futbol:     ['futbol', 'football', 'soccer'],
  basquetbol: ['basquetbol', 'basketball', 'baloncesto'],
  voleibol:   ['voleibol', 'volleyball', 'voley'],
};

export const DEFAULT_SPORT_SLUG = 'futbol';

const normalize = (str) => str.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * @param {string|null} sportName Nombre del deporte (lg_sports.name)
 * @returns {string} slug de tema para el frontend
 */
export function toSportSlug(sportName) {
  if (!sportName) return DEFAULT_SPORT_SLUG;
  const normalized = normalize(sportName);
  const match = Object.entries(SLUG_KEYWORDS).find(([, keywords]) =>
    keywords.some((k) => normalized.includes(k)));
  return match ? match[0] : DEFAULT_SPORT_SLUG;
}
