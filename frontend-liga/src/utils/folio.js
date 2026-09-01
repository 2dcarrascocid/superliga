// Umbral y prefijo deben coincidir con backend-liga/adf/specialists/lib/veteran_folio.js
export const VETERAN_AGE_THRESHOLD = 55;
export const VETERAN_FOLIO_PREFIX = 'D';

export function computeAge(birthDate, atDate = new Date()) {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;

  let age = atDate.getFullYear() - birth.getFullYear();
  const monthDiff = atDate.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && atDate.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function isVeteranAge(birthDate) {
  const age = computeAge(birthDate);
  return age !== null && age >= VETERAN_AGE_THRESHOLD;
}

/**
 * Formatea el folio de un jugador para mostrar en UI.
 * Prioriza club_folio_display si el backend ya lo entregó decorado;
 * si no, lo calcula localmente a partir de birth_date.
 */
export function formatFolio({ clubFolio, clubFolioDisplay, birthDate } = {}) {
  if (clubFolioDisplay) return clubFolioDisplay;
  if (clubFolio === null || clubFolio === undefined || clubFolio === '') return null;
  return isVeteranAge(birthDate) ? `${VETERAN_FOLIO_PREFIX}-${clubFolio}` : String(clubFolio);
}
