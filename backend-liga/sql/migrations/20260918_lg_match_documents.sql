-- ============================================================
-- Migration: lg_match_documents
-- Descripción: Tabla para almacenar documentación adjunta
--              a partidos (control de partido: actas, fotos, etc.)
-- Fecha: 2026-09-18
-- ============================================================

CREATE TABLE IF NOT EXISTS lg_match_documents (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id        uuid        NOT NULL REFERENCES lg_matches(id) ON DELETE CASCADE,
  uploaded_by     uuid        NOT NULL,                     -- auth.users.id del que subió
  nombre_original text        NOT NULL,                     -- nombre original del archivo
  mime_type       text        NOT NULL,                     -- application/pdf, image/jpeg, etc.
  size            bigint      NOT NULL,                     -- tamaño en bytes
  bucket          text        NOT NULL DEFAULT 'cloudinary', -- los archivos van a Cloudinary, no a Supabase Storage
  path            text        NOT NULL,                     -- public_id de Cloudinary (único)
  url_publica     text,                                     -- URL pública devuelta por Cloudinary
  hash            text,                                     -- hash SHA-256 para integridad/dedup (opcional)
  estado          text        NOT NULL DEFAULT 'ACTIVE'
                              CHECK (estado IN ('ACTIVE', 'DELETED')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_match_documents_match_id
  ON lg_match_documents(match_id);

CREATE INDEX IF NOT EXISTS idx_match_documents_estado
  ON lg_match_documents(estado);

CREATE UNIQUE INDEX IF NOT EXISTS idx_match_documents_path
  ON lg_match_documents(path);

-- ============================================================
-- RLS
-- Todos los accesos van por el backend con service_role,
-- que bypasea RLS por defecto en Supabase.
-- Se habilita RLS de todas formas para proteger accesos directos,
-- con políticas explícitas para cada operación del backend.
-- ============================================================

ALTER TABLE lg_match_documents ENABLE ROW LEVEL SECURITY;

-- SELECT: usuarios autenticados ven documentos ACTIVE
CREATE POLICY "match_documents_select"
  ON lg_match_documents
  FOR SELECT
  TO authenticated
  USING (estado = 'ACTIVE');

-- INSERT: usuarios autenticados pueden insertar (service_role bypasea esto igualmente)
CREATE POLICY "match_documents_insert"
  ON lg_match_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE: usuarios autenticados pueden actualizar (soft-delete)
CREATE POLICY "match_documents_update"
  ON lg_match_documents
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
