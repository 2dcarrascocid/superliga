-- ============================================================
-- Migration: lg_categories_age_restriction
-- Descripción: La configuración de edad mínima y modo de cálculo
--              ("Cálculo de edad": edad cumplida vs año de nacimiento) pasa
--              de vivir en cada serie de club (lg_club_series.min_age /
--              age_restriction) a vivir en la CATEGORÍA (lg_categories),
--              que ya tenía age_from/age_to como piso/techo de edad — ahora
--              age_from cumple también el rol de "edad mínima" para esta
--              regla, y se agrega age_restriction con el mismo significado
--              que tenía en lg_club_series (ver
--              20260817_lg_club_series_add_fields.sql):
--                true  -> edad CUMPLIDA (edad real) >= age_from
--                false -> por AÑO DE NACIMIENTO (categoría por año, sin
--                         exigir cumpleaños)
--
--              lg_club_series.min_age / age_restriction quedan en la tabla
--              (no se eliminan acá para no perder datos sin confirmación
--              explícita) pero el backend deja de leerlos y escribirlos —
--              la app ahora resuelve la edad de una serie a través de su
--              categoría (lg_club_series.category_id -> lg_categories).
--
-- Nota: idempotente, se puede correr las veces que haga falta.
-- Fecha: 2026-09-04
-- ============================================================

ALTER TABLE lg_categories ADD COLUMN IF NOT EXISTS age_restriction boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
