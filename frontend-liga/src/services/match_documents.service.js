import apiClient from '../api';
import { uploadDocument as cloudinaryUpload } from './cloudinary.service.js';

// Listar documentos ACTIVE de un partido
export const listDocuments = (matchId) =>
  apiClient.get(`/matches/${matchId}/documents`);

// Registrar metadatos en el backend tras subir a Cloudinary
export const registerDocument = (matchId, data) =>
  apiClient.post(`/matches/${matchId}/documents`, data);

// Soft-delete de un documento
export const deleteDocument = (matchId, documentId) =>
  apiClient.delete(`/matches/${matchId}/documents/${documentId}`);

/**
 * Flujo completo de subida:
 *   1. Sube el archivo directo a Cloudinary (resource_type=auto)
 *   2. Registra metadatos en el backend (lg_match_documents)
 *
 * @param {string} matchId
 * @param {File} file
 * @param {string} nombre
 * @param {Function} onProgress - callback(percent: 0-100)
 * @returns {Promise<Object>} documento registrado
 */
export async function uploadDocument(matchId, file, nombre, onProgress = () => {}) {
  const folder = `matches/${matchId}/documents`;

  // 1. Subir a Cloudinary
  const cloudRes = await cloudinaryUpload(file, folder, onProgress);

  // 2. Registrar en el backend con el nombre que el usuario eligió
  const regRes = await registerDocument(matchId, {
    nombre_original: nombre || file.name,
    mime_type:       file.type || cloudRes.resource_type || 'application/octet-stream',
    size:            cloudRes.bytes,
    path:            cloudRes.public_id,
    bucket:          'cloudinary',
    url_publica:     cloudRes.secure_url,
  });

  return regRes.data.data.document;
}

export const formatFileSize = (bytes) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
