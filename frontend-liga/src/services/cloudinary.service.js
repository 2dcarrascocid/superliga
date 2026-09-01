import axios from 'axios';
import CryptoJS from 'crypto-js';

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const API_KEY    = import.meta.env.VITE_CLOUDINARY_API_KEY;
const API_SECRET = import.meta.env.VITE_CLOUDINARY_API_SECRET;

function assertCredentials() {
  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    throw new Error('Faltan credenciales de Cloudinary en .env');
  }
}

// Firma Cloudinary: parámetros en orden alfabético + secret al final
function buildSignature(params) {
  const sorted = Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');
  return CryptoJS.SHA1(`${sorted}${API_SECRET}`).toString();
}

// Subida de imágenes (fotos de jugadores, etc.)
export const uploadImage = async (file) => {
  assertCredentials();
  const timestamp = Math.round(Date.now() / 1000);
  const params = { timestamp };
  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', API_KEY);
  formData.append('timestamp', timestamp);
  formData.append('signature', buildSignature(params));

  const response = await axios.post(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    formData
  );
  return response.data;
};

/**
 * Subida de documentos (PDF, Word, Excel, imágenes, etc.)
 * Usa resource_type=auto para que Cloudinary detecte el tipo.
 * @param {File} file
 * @param {string} folder - carpeta en Cloudinary, ej: 'players/uuid/documents'
 * @param {Function} onProgress - callback(percent)
 * @returns {Promise<{ secure_url, public_id, bytes, format, resource_type }>}
 */
export const uploadDocument = async (file, folder, onProgress = () => {}) => {
  assertCredentials();
  const timestamp = Math.round(Date.now() / 1000);
  const params = { folder, timestamp };
  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', API_KEY);
  formData.append('timestamp', timestamp);
  formData.append('folder', folder);
  formData.append('signature', buildSignature(params));

  const response = await axios.post(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`,
    formData,
    {
      onUploadProgress: (evt) => {
        if (evt.total) onProgress(Math.round((evt.loaded / evt.total) * 100));
      },
    }
  );
  return response.data;
};
