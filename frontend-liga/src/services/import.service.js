/**
 * Import Service — Importación masiva de jugadores desde Excel
 *
 * Columnas esperadas en el Excel:
 *   FOLIO | RUT | NOMBRE | FECHA NAC | CELULAR
 *
 * Mapeo a campos de la API:
 *   FOLIO     → jerseyNumber  (número de camiseta / folio)
 *   RUT       → nationalId    (identificación nacional)
 *   NOMBRE    → firstName + lastName  (primera palabra = nombre, resto = apellido)
 *   FECHA NAC → birthDate     (convierte DD/MM/YYYY o serial Excel → YYYY-MM-DD)
 *   CELULAR   → phone
 */

import * as XLSX from 'xlsx';
import { createPlayerForClub } from './players.service.js';

// Cabeceras que reconocemos (en mayúsculas y sin acentos para ser tolerantes)
const HEADER_MAP = {
  'FOLIO':     'folio',
  'RUT':       'rut',
  'NOMBRE':    'nombre',
  'FECHA NAC': 'fechaNac',
  'CELULAR':   'celular',
};

/**
 * Normaliza un string de cabecera:
 * elimina acentos, convierte a mayúsculas, elimina espacios extra.
 */
function normalizeHeader(str) {
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Convierte una fecha de Excel al formato YYYY-MM-DD.
 * Acepta:
 *   - Serial numérico de Excel (ej: 44927)
 *   - String DD/MM/YYYY
 *   - String DD-MM-YYYY
 *   - Objeto Date de JS
 */
function parseExcelDate(value) {
  if (!value) return null;

  // Serial numérico de Excel
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (!date) return null;
    const y = date.y;
    const m = String(date.m).padStart(2, '0');
    const d = String(date.d).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Objeto Date de JS
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // String con separadores / o -
  const str = String(value).trim();
  const match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (match) {
    const [, d, m, y] = match;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Ya viene en YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  return null;
}

/**
 * Divide el campo NOMBRE en firstName y lastName.
 *
 * Patrón de nombres chilenos (todo en una celda):
 *   4 palabras → "JUAN CARLOS PÉREZ GONZÁLEZ"  → nombre: "Juan Carlos" | apellido: "Pérez González"
 *   3 palabras → "JUAN PÉREZ GONZÁLEZ"          → nombre: "Juan"        | apellido: "Pérez González"
 *   2 palabras → "JUAN PÉREZ"                   → nombre: "Juan"        | apellido: "Pérez"
 *   1 palabra  → "JUAN"                         → nombre: "Juan"        | apellido: ""
 *   5+ palabras→ primeras 2 = nombre, resto = apellido
 */
function parseName(nombre) {
  const raw   = String(nombre || '').trim();
  const parts = raw.split(/\s+/).filter(Boolean);

  // Capitaliza: "JUAN CARLOS" → "Juan Carlos"
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: cap(parts[0]), lastName: '' };
  if (parts.length === 2) return { firstName: cap(parts[0]), lastName: cap(parts[1]) };

  // 3 palabras: 1 nombre + 2 apellidos  (patrón más común en Chile con 3 partes)
  if (parts.length === 3) {
    return {
      firstName: cap(parts[0]),
      lastName:  `${cap(parts[1])} ${cap(parts[2])}`,
    };
  }

  // 4+ palabras: primeras 2 = nombres, resto = apellidos
  return {
    firstName: `${cap(parts[0])} ${cap(parts[1])}`,
    lastName:  parts.slice(2).map(cap).join(' '),
  };
}

/**
 * Normaliza un RUT chileno: elimina puntos y deja el guion.
 * "12.345.678-9" → "12345678-9"
 */
function normalizeRut(rut) {
  return String(rut || '').replace(/\./g, '').trim();
}

/**
 * Parsea el archivo Excel y retorna un array de filas normalizadas.
 *
 * @param {File} file              — Archivo .xlsx o .xls seleccionado por el usuario
 * @param {object} [clubConfig]    — Configuración del club { folio_start, folio_end }
 * @returns {Promise<ParsedRow[]>}
 */
export async function parseExcelFile(file, clubConfig = null) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Extraer como array de arrays (con cabeceras)
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (raw.length < 2) {
    throw new Error('El archivo no tiene datos. Verifica que tenga al menos una fila con cabeceras y una fila de datos.');
  }

  // Mapear cabeceras
  const headers = raw[0].map(normalizeHeader);
  const colIndex = {};
  for (const [excelHeader, fieldName] of Object.entries(HEADER_MAP)) {
    const idx = headers.indexOf(normalizeHeader(excelHeader));
    if (idx !== -1) colIndex[fieldName] = idx;
  }

  // Validar que las columnas mínimas existen
  const missing = [];
  if (colIndex.rut    === undefined) missing.push('RUT');
  if (colIndex.nombre === undefined) missing.push('NOMBRE');
  if (missing.length > 0) {
    throw new Error(`El archivo no tiene las columnas requeridas: ${missing.join(', ')}`);
  }

  // Parsear filas de datos (saltar cabecera)
  const rows = [];
  for (let i = 1; i < raw.length; i++) {
    const row = raw[i];

    // Saltar filas completamente vacías
    if (row.every(cell => cell === '' || cell === null || cell === undefined)) continue;

    const nombre    = colIndex.nombre   !== undefined ? row[colIndex.nombre]   : '';
    const rut       = colIndex.rut      !== undefined ? row[colIndex.rut]      : '';
    const folio     = colIndex.folio    !== undefined ? row[colIndex.folio]    : '';
    const fechaNac  = colIndex.fechaNac !== undefined ? row[colIndex.fechaNac] : '';
    const celular   = colIndex.celular  !== undefined ? row[colIndex.celular]  : '';

    const { firstName, lastName } = parseName(nombre);
    const nationalId  = normalizeRut(rut);
    const birthDate   = parseExcelDate(fechaNac);
    const folioRaw    = folio !== '' ? parseInt(String(folio).trim(), 10) : null;
    const phone       = celular !== '' ? String(celular).trim() : null;

    // Validación por fila
    const errors = [];
    if (!nationalId || nationalId === '-') errors.push('RUT vacío o inválido');
    if (!firstName)                         errors.push('NOMBRE vacío');

    // Validar rango del folio si se proporcionó config del club
    if (folioRaw !== null && !isNaN(folioRaw) && clubConfig) {
      const start = clubConfig.folio_start ?? 1;
      const end   = clubConfig.folio_end   ?? 70;
      if (folioRaw < start || folioRaw > end) {
        errors.push(`Folio ${folioRaw} fuera del rango permitido (${start}–${end})`);
      }
    }
    if (folioRaw !== null && isNaN(folioRaw)) {
      errors.push('Folio inválido (debe ser un número)');
    }

    rows.push({
      _rowNum: i + 1,
      firstName,
      lastName,
      nationalId,
      birthDate,
      clubFolio: (!isNaN(folioRaw) && folioRaw !== null) ? folioRaw : null,
      phone,
      _raw: { folio, rut, nombre, fechaNac: fechaNac ? String(fechaNac) : '', celular },
      _errors: errors,
      _status: errors.length > 0 ? 'invalid' : 'pending',
      _importError: null,
    });
  }

  return rows;
}

/**
 * Importa todas las filas válidas al backend, una por una.
 * Llama onProgress(updatedRows) después de cada fila.
 *
 * @param {ParsedRow[]} rows   — Resultado de parseExcelFile()
 * @param {string} clubId      — ID del club destino
 * @param {string} orgId       — ID de la organización
 * @param {Function} onProgress — Callback recibe el array actualizado
 * @returns {Promise<{ success: number, errors: number }>}
 */
export async function importPlayers(rows, clubId, orgId, onProgress) {
  const working = rows.map(r => ({ ...r }));
  let success = 0;
  let errors  = 0;

  for (let i = 0; i < working.length; i++) {
    const row = working[i];

    if (row._status === 'invalid') {
      errors++;
      continue;
    }

    row._status = 'importing';
    onProgress?.([...working]);

    try {
      const payload = {
        first_name: row.firstName,
        last_name:  row.lastName,
        rut:        row.nationalId,
      };
      if (row.birthDate) payload.birth_date = row.birthDate;
      if (row.phone)     payload.phone      = row.phone;
      if (row.clubFolio) payload.club_folio = row.clubFolio;

      console.log(`[IMPORT] Fila ${row._rowNum} → POST /clubs/${clubId}/players`, payload);

      const res = await createPlayerForClub(clubId, payload);

      console.log(`[IMPORT] Fila ${row._rowNum} ← respuesta:`, res.status, res.data);

      // El backend devuelve 201 con { player, roster }
      // Si por alguna razón devuelve success:false marcamos como error
      if (res.data?.error) {
        throw { message: res.data.error?.message || res.data.error, response: res };
      }

      row._status = 'success';
      success++;
    } catch (err) {
      console.error(`[IMPORT] Fila ${row._rowNum} ← ERROR:`, err.response?.status, err.response?.data || err.message);
      row._status = 'error';
      row._importError =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'Error desconocido';
      errors++;
    }

    onProgress?.([...working]);
  }

  return { success, errors };
}
