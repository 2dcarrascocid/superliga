-- ============================================================
-- Migration: lg_categories_schedule_order
-- Descripción: Orden manual de categorías para el módulo de
--              Programación de Fecha (asignación automática de
--              cancha/horario). schedule_order es la posición en
--              que la categoría debe procesarse al armar la agenda
--              de una fecha; nullable porque no todas las
--              organizaciones van a usar este módulo.
--
--              Backfill: para las categorías que todavía no tienen
--              schedule_order asignado, se les asigna un valor
--              correlativo por organización usando el mismo
--              criterio de orden que ya usa hoy
--              categories_specialist.js al listar categorías
--              (age_from ASC NULLS FIRST), con name ASC como
--              desempate para que el backfill sea determinístico
--              cuando dos categorías comparten age_from.
--
-- Nota: idempotente — el UPDATE de backfill solo toca filas con
-- schedule_order IS NULL, así que correr esta migración de nuevo
-- no pisa valores ya asignados manualmente.
-- Fecha: 2026-09-05
-- ============================================================

ALTER TABLE lg_categories ADD COLUMN IF NOT EXISTS schedule_order integer NULL;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY org_id
      ORDER BY age_from ASC NULLS FIRST, name ASC
    ) AS rn
  FROM lg_categories
  WHERE schedule_order IS NULL
)
UPDATE lg_categories c
SET schedule_order = ranked.rn
FROM ranked
WHERE ranked.id = c.id;

NOTIFY pgrst, 'reload schema';
